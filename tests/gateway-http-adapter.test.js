import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  composeNode0StatusFromGateway,
  createGatewayHttpAdapter,
  fetchGatewayState
} from "../packages/node-adapter/src/gateway-http-adapter.js";
import { createNode0Adapter } from "../packages/node-adapter/src/node0-adapter.js";

const HEALTHY_GATEWAY_DOMAIN = "bizra-cognition-gateway-v1";

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

async function withNode0AdapterEnv(values, fn) {
  const names = [
    "DEMA_NODE0_ADAPTER",
    "DEMA_GATEWAY_URL",
    "DEMA_NODE0_STATUS_COMMAND"
  ];
  const originals = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    for (const name of names) {
      if (Object.hasOwn(values, name)) restoreEnv(name, values[name]);
    }
    return await fn();
  } finally {
    for (const [name, value] of Object.entries(originals)) restoreEnv(name, value);
  }
}

function jsonResponse(body, status = 200) {
  return { status, body, headers: { "content-type": "application/json" } };
}

function startFakeGateway(routes) {
  const calls = [];
  const server = createServer((req, res) => {
    calls.push({ method: req.method, url: req.url });
    const handler = routes[req.url];
    if (!handler) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
      return;
    }
    const result = handler(req);
    res.writeHead(result.status ?? 200, result.headers ?? { "content-type": "application/json" });
    res.end(typeof result.body === "string" ? result.body : JSON.stringify(result.body));
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        calls,
        async stop() {
          await new Promise((r) => server.close(r));
        }
      });
    });
  });
}

const HEALTHY_ROUTES = {
  "/health": () => jsonResponse({ status: "ok", domain: HEALTHY_GATEWAY_DOMAIN }),
  "/chain": () => jsonResponse({ head: "0".repeat(64), length: 0, latestTimestamp: null }),
  "/poi/summary": () =>
    jsonResponse({
      chainHead: "0".repeat(64),
      totalEntries: 0,
      totalImpact: 0,
      avgImpact: 0
    }),
  "/resources/list": () => jsonResponse({ resources: [] })
};

test("gateway-http adapter composes v0.2 status from /health + /chain + /poi + /resources", async () => {
  const gw = await startFakeGateway(HEALTHY_ROUTES);
  try {
    const adapter = createGatewayHttpAdapter({ baseUrl: gw.url });
    const status = await adapter.status();

    assert.equal(status.schema, "bizra.dema.node0_status.v0.2");
    assert.equal(status.source, "gateway-http-composed");
    assert.equal(status.truth_label, "MEASURED_PARTIAL");
    assert.equal(status.gateway.reachable, true);
    assert.equal(status.gateway.domain, HEALTHY_GATEWAY_DOMAIN);
    assert.equal(status.chain.length, 0);
    assert.equal(status.poi.totalEntries, 0);
    assert.equal(status.resources.count, 0);
    assert.equal(status.activationGate, "EXPLICIT_GO_REQUIRED");
    assert.equal(status.consoleReady, true);
    assert.ok(status.findings.some((f) => f.includes("first mission")));

    // Adapter must be read-only — only GET requests, only the four endpoints.
    const methods = new Set(gw.calls.map((c) => c.method));
    assert.deepEqual([...methods], ["GET"]);
    const paths = new Set(gw.calls.map((c) => c.url));
    assert.deepEqual([...paths].sort(), ["/chain", "/health", "/poi/summary", "/resources/list"]);
  } finally {
    await gw.stop();
  }
});

test("gateway-http adapter never claims ready=true even with a populated chain", async () => {
  const gw = await startFakeGateway({
    "/health": () => jsonResponse({ status: "ok", domain: HEALTHY_GATEWAY_DOMAIN }),
    "/chain": () =>
      jsonResponse({
        head: "ab".repeat(32),
        length: 5,
        latestTimestamp: 1234567890
      }),
    "/poi/summary": () =>
      jsonResponse({ totalEntries: 5, totalImpact: 1.5, avgImpact: 0.3 }),
    "/resources/list": () => jsonResponse({ resources: [{ id: "r1" }, { id: "r2" }] })
  });
  try {
    const adapter = createGatewayHttpAdapter({ baseUrl: gw.url });
    const status = await adapter.status();

    // Even with chain.length=5, ready remains false — only ARTIFACT-011's
    // first issuance flips Node0 into SPROUT readiness, and that lives
    // upstream of this adapter.
    assert.equal(status.ready, false);
    assert.equal(status.missionExecuted, true);
    assert.equal(status.chain.length, 5);
    assert.equal(status.resources.count, 2);
    assert.equal(status.poi.totalEntries, 5);
    assert.equal(status.proof.latestChainHash, "ab".repeat(32));
  } finally {
    await gw.stop();
  }
});

test("gateway-http adapter labels DEGRADED + records finding when /health is missing", async () => {
  const gw = await startFakeGateway({
    // no /health route → 404
    "/chain": () => jsonResponse({ head: "0".repeat(64), length: 0, latestTimestamp: null }),
    "/poi/summary": () => jsonResponse({ totalEntries: 0, totalImpact: 0, avgImpact: 0 }),
    "/resources/list": () => jsonResponse({ resources: [] })
  });
  try {
    const adapter = createGatewayHttpAdapter({ baseUrl: gw.url });
    const status = await adapter.status();

    assert.equal(status.gateway.reachable, false);
    assert.equal(status.truth_label, "DEGRADED");
    assert.ok(status.findings.some((f) => f.toLowerCase().includes("health")));
  } finally {
    await gw.stop();
  }
});

test("gateway-http adapter handles a domain mismatch on /health honestly", async () => {
  const gw = await startFakeGateway({
    ...HEALTHY_ROUTES,
    "/health": () => jsonResponse({ status: "ok", domain: "some-other-server-v3" })
  });
  try {
    const adapter = createGatewayHttpAdapter({ baseUrl: gw.url });
    const status = await adapter.status();
    assert.equal(status.gateway.reachable, false);
    assert.equal(status.truth_label, "DEGRADED");
    assert.ok(
      status.findings.some((f) => f.includes("domain mismatch") && f.includes("some-other-server-v3"))
    );
  } finally {
    await gw.stop();
  }
});

test("gateway-http adapter network failure is reported, never thrown", async () => {
  // Port 1 is reserved on Linux + unlikely to be bound; should fail to connect.
  const adapter = createGatewayHttpAdapter({ baseUrl: "http://127.0.0.1:1", timeoutMs: 500 });
  const status = await adapter.status();

  assert.equal(status.schema, "bizra.dema.node0_status.v0.2");
  assert.equal(status.gateway.reachable, false);
  assert.equal(status.truth_label, "DEGRADED");
  assert.ok(status.findings.length > 0);
  // All four endpoints failed → at least 4 findings (one per endpoint).
  assert.ok(status.findings.length >= 4);
});

test("gateway-http adapter exposes UNKNOWN for fields not in the gateway surface", async () => {
  const gw = await startFakeGateway(HEALTHY_ROUTES);
  try {
    const adapter = createGatewayHttpAdapter({ baseUrl: gw.url });
    const status = await adapter.status();

    assert.ok(status.unknown.some((u) => u.includes("lm_studio")));
    assert.ok(status.unknown.some((u) => u.includes("pyO3")));
    assert.ok(status.unknown.some((u) => u.includes("preferred_name")));
    assert.equal(status.model._truth, "NOT_EXPOSED_BY_GATEWAY");
    assert.equal(status.daemonStatus, "n/a-via-gateway");
    assert.equal(status.human, null);
  } finally {
    await gw.stop();
  }
});

test("createNode0Adapter dispatches to gateway-http when DEMA_NODE0_ADAPTER=gateway-http", async () => {
  const gw = await startFakeGateway(HEALTHY_ROUTES);
  try {
    const adapter = createNode0Adapter({
      adapterMode: "gateway-http",
      gatewayUrl: gw.url
    });
    const status = await adapter.status();
    assert.equal(status.schema, "bizra.dema.node0_status.v0.2");
    assert.equal(status.gateway.base_url, gw.url);
  } finally {
    await gw.stop();
  }
});

test("createNode0Adapter prefers a configured gateway URL over legacy status command by default", async () => {
  const gw = await startFakeGateway(HEALTHY_ROUTES);
  try {
    await withNode0AdapterEnv(
      {
        DEMA_NODE0_ADAPTER: undefined,
        DEMA_GATEWAY_URL: gw.url,
        DEMA_NODE0_STATUS_COMMAND: 'node -e "process.exit(42)"'
      },
      async () => {
        const adapter = createNode0Adapter({ timeoutMs: 1000 });
        const status = await adapter.status();

        assert.equal(status.schema, "bizra.dema.node0_status.v0.2");
        assert.equal(status.source, "gateway-http-composed");
        assert.equal(status.gateway.base_url, gw.url);
        assert.deepEqual(gw.calls.map((call) => call.method), ["GET", "GET", "GET", "GET"]);
      }
    );
  } finally {
    await gw.stop();
  }
});

test("createNode0Adapter labels shellout status as legacy and operator-owned", async () => {
  const adapter = createNode0Adapter({
    adapterMode: "shellout",
    command: 'node -e "process.stdout.write(JSON.stringify({ ready: true, findings: [] }))"'
  });
  const status = await adapter.status();

  assert.equal(status.schema, "bizra.dema.status.v0.1");
  assert.equal(status.source, "legacy-shellout");
  assert.deepEqual(status.adapter, {
    mode: "legacy-shellout",
    legacy: true,
    operator_owned: true,
    execution: "execFile",
    shell: false,
    available: true
  });
});

test("createNode0Adapter treats shell metacharacters as literal argv in shellout command", async () => {
  const adapter = createNode0Adapter({
    adapterMode: "shellout",
    command:
      'node -e "process.stdout.write(JSON.stringify({ human: process.argv.slice(1).join(`|`), findings: process.argv.slice(1) }))" "semi;echo SHOULD_NOT_RUN" "$(echo SHOULD_NOT_EXPAND)" "plain&&echo NO"'
  });
  const status = await adapter.status();

  assert.equal(
    status.human,
    "semi;echo SHOULD_NOT_RUN|$(echo SHOULD_NOT_EXPAND)|plain&&echo NO"
  );
  assert.deepEqual(status.findings, [
    "semi;echo SHOULD_NOT_RUN",
    "$(echo SHOULD_NOT_EXPAND)",
    "plain&&echo NO"
  ]);
  assert.equal(status.adapter.shell, false);
});

test("createNode0Adapter reports missing legacy shellout command as unavailable status", async () => {
  const adapter = createNode0Adapter({
    adapterMode: "shellout",
    command: "dema-node0-status-command-that-should-not-exist"
  });
  const status = await adapter.status();

  assert.equal(status.schema, "bizra.dema.status.v0.1");
  assert.equal(status.ready, false);
  assert.equal(status.source, "legacy-shellout-unavailable");
  assert.equal(status.adapter.mode, "legacy-shellout");
  assert.equal(status.adapter.legacy, true);
  assert.equal(status.adapter.operator_owned, true);
  assert.equal(status.adapter.shell, false);
  assert.equal(status.adapter.available, false);
  assert.equal(status.adapter.reason, "legacy_status_command_unavailable");
  assert.ok(status.findings.some((finding) => finding.includes("DEMA_NODE0_STATUS_COMMAND unavailable")));
});

test("createNode0Adapter reports absent legacy shellout command as unavailable status", async () => {
  await withNode0AdapterEnv(
    {
      DEMA_NODE0_ADAPTER: "shellout",
      DEMA_GATEWAY_URL: undefined,
      DEMA_NODE0_STATUS_COMMAND: undefined
    },
    async () => {
      const status = await createNode0Adapter().status();

      assert.equal(status.schema, "bizra.dema.status.v0.1");
      assert.equal(status.ready, false);
      assert.equal(status.source, "legacy-shellout-unavailable");
      assert.equal(status.adapter.available, false);
      assert.equal(status.adapter.reason, "legacy_status_command_not_configured");
    }
  );
});

test("node0 adapter env test helper restores adapter environment variables", async () => {
  const originals = {
    DEMA_NODE0_ADAPTER: process.env.DEMA_NODE0_ADAPTER,
    DEMA_GATEWAY_URL: process.env.DEMA_GATEWAY_URL,
    DEMA_NODE0_STATUS_COMMAND: process.env.DEMA_NODE0_STATUS_COMMAND
  };

  await withNode0AdapterEnv(
    {
      DEMA_NODE0_ADAPTER: "gateway-http",
      DEMA_GATEWAY_URL: "http://127.0.0.1:65534",
      DEMA_NODE0_STATUS_COMMAND: "node fake.js"
    },
    async () => {
      assert.equal(process.env.DEMA_NODE0_ADAPTER, "gateway-http");
      assert.equal(process.env.DEMA_GATEWAY_URL, "http://127.0.0.1:65534");
      assert.equal(process.env.DEMA_NODE0_STATUS_COMMAND, "node fake.js");
    }
  );

  assert.equal(process.env.DEMA_NODE0_ADAPTER, originals.DEMA_NODE0_ADAPTER);
  assert.equal(process.env.DEMA_GATEWAY_URL, originals.DEMA_GATEWAY_URL);
  assert.equal(process.env.DEMA_NODE0_STATUS_COMMAND, originals.DEMA_NODE0_STATUS_COMMAND);
});

test("createNode0Adapter still honors the shellout path when adapterMode is unset", async () => {
  // No DEMA_NODE0_ADAPTER, no DEMA_NODE0_STATUS_COMMAND, no command option:
  // the adapter must fall through to a blocked legacy-unavailable status.
  const originalAdapterMode = process.env.DEMA_NODE0_ADAPTER;
  const originalStatusCommand = process.env.DEMA_NODE0_STATUS_COMMAND;
  try {
    delete process.env.DEMA_NODE0_ADAPTER;
    delete process.env.DEMA_NODE0_STATUS_COMMAND;

    const adapter = createNode0Adapter();
    const status = await adapter.status();
    assert.equal(status.schema, "bizra.dema.status.v0.1");
    assert.equal(status.ready, false);
    assert.equal(status.activationGate, "BLOCKED");
  } finally {
    restoreEnv("DEMA_NODE0_ADAPTER", originalAdapterMode);
    restoreEnv("DEMA_NODE0_STATUS_COMMAND", originalStatusCommand);
  }
});

test("composeNode0StatusFromGateway is pure: same input -> same output", async () => {
  const gw = await startFakeGateway(HEALTHY_ROUTES);
  try {
    const state = await fetchGatewayState(gw.url, { timeoutMs: 1000 });
    const a = composeNode0StatusFromGateway(state);
    const b = composeNode0StatusFromGateway(state);
    // Strip schema/source which include no nondeterministic content,
    // then deepEqual everything else.
    assert.deepEqual(a, b);
  } finally {
    await gw.stop();
  }
});
