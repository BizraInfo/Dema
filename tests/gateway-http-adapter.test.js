import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
  composeNode0StatusFromGateway,
  createGatewayHttpAdapter,
  fetchGatewayState,
} from "../packages/node-adapter/src/gateway-http-adapter.js";
import { createNode0Adapter } from "../packages/node-adapter/src/node0-adapter.js";

const HEALTHY_GATEWAY_DOMAIN = "bizra-cognition-gateway-v1";
const PRINCIPAL_STATUS_SCHEMA = "bizra.node0.principal_identity_status.v0.3";
const READ_ONLY_OPERATION_EFFECTS = Object.freeze({
  mutationPerformed: false,
  activationPerformed: false,
  witnessIssued: false,
  poiMinted: false,
  soakStarted: false,
});
const VERIFIED_PRINCIPAL_IDENTITY = Object.freeze({
  principalId: "bizra:human-node:v1:0",
  principalProfileHash: "ab".repeat(32),
  subjectKind: "human-node",
  subjectId: "bizra:human-node:v1:0",
  nodePubkey: "cd".repeat(32),
  activationReceiptRef: "receipt:activation:1",
  receiptId: "receipt-1",
  timestampNs: "1234567890",
  prevChain: "0".repeat(64),
});
const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);

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
    "DEMA_NODE0_STATUS_COMMAND",
  ];
  const originals = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  try {
    for (const name of names) {
      if (Object.hasOwn(values, name)) restoreEnv(name, values[name]);
    }
    return await fn();
  } finally {
    for (const [name, value] of Object.entries(originals))
      restoreEnv(name, value);
  }
}

function jsonResponse(body, status = 200) {
  return { status, body, headers: { "content-type": "application/json" } };
}

function principalStatus(overrides = {}) {
  const base = {
    schema: PRINCIPAL_STATUS_SCHEMA,
    runtimeDomain: HEALTHY_GATEWAY_DOMAIN,
    verdict: "ABSENT",
    identityVerified: false,
    bridgeEligible: false,
    verifiedIdentity: null,
    evidenceState: {
      profilePresent: false,
      activeChainRecordFound: false,
      durableReceiptMetadataFound: false,
      canonicalPayloadAvailable: false,
      chainContinuityVerified: false,
    },
    chainHead: "0".repeat(64),
    chainLength: 0,
    authorityPolicy: {
      activationRequires: "EXPLICIT_GO",
      authorityDelta: 0,
    },
    operationEffects: READ_ONLY_OPERATION_EFFECTS,
    reasonCodes: [],
  };
  return {
    ...base,
    ...overrides,
    evidenceState: { ...base.evidenceState, ...overrides.evidenceState },
    authorityPolicy: { ...base.authorityPolicy, ...overrides.authorityPolicy },
    operationEffects: {
      ...base.operationEffects,
      ...overrides.operationEffects,
    },
  };
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
    res.writeHead(
      result.status ?? 200,
      result.headers ?? { "content-type": "application/json" },
    );
    res.end(
      typeof result.body === "string"
        ? result.body
        : JSON.stringify(result.body),
    );
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        calls,
        async stop() {
          await new Promise((r) => server.close(r));
        },
      });
    });
  });
}

const HEALTHY_ROUTES = {
  "/health": () =>
    jsonResponse({ status: "ok", domain: HEALTHY_GATEWAY_DOMAIN }),
  "/chain": () =>
    jsonResponse({ head: "0".repeat(64), length: 0, latestTimestamp: null }),
  "/poi/summary": () =>
    jsonResponse({
      chainHead: "0".repeat(64),
      totalEntries: 0,
      totalImpact: 0,
      avgImpact: 0,
    }),
  "/resources/list": () => jsonResponse({ resources: [] }),
  "/principal/status": () => jsonResponse(principalStatus()),
};

test("gateway-http adapter composes v0.2 status from five read-only endpoints", async () => {
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
    assert.equal(status.principal.observation, "MEASURED");
    assert.equal(status.principal.contractValid, true);
    assert.equal(status.principal.verdict, "ABSENT");
    assert.equal(status.principal.identityVerified, false);
    assert.equal(status.principal.bridgeEligible, false);
    assert.equal(status.principal.authorityDelta, 0);
    assert.deepEqual(
      status.principal.operationEffects,
      READ_ONLY_OPERATION_EFFECTS,
    );
    assert.equal(status.activationGate, "EXPLICIT_GO_REQUIRED");
    assert.equal(status.consoleReady, true);
    assert.ok(status.findings.some((f) => f.includes("first mission")));

    // Adapter must be read-only — only GET requests, only the declared endpoints.
    const methods = new Set(gw.calls.map((c) => c.method));
    assert.deepEqual([...methods], ["GET"]);
    const paths = new Set(gw.calls.map((c) => c.url));
    assert.deepEqual([...paths].sort(), [
      "/chain",
      "/health",
      "/poi/summary",
      "/principal/status",
      "/resources/list",
    ]);
  } finally {
    await gw.stop();
  }
});

test("gateway-http adapter exposes a fully verified principal without making Node0 ready", async () => {
  const gw = await startFakeGateway({
    ...HEALTHY_ROUTES,
    "/principal/status": () =>
      jsonResponse(
        principalStatus({
          verdict: "VERIFIED",
          identityVerified: true,
          bridgeEligible: true,
          verifiedIdentity: VERIFIED_PRINCIPAL_IDENTITY,
          evidenceState: {
            profilePresent: true,
            activeChainRecordFound: true,
            durableReceiptMetadataFound: true,
            canonicalPayloadAvailable: true,
            chainContinuityVerified: true,
          },
        }),
      ),
  });
  try {
    const status = await createGatewayHttpAdapter({ baseUrl: gw.url }).status();

    assert.equal(status.truth_label, "MEASURED_PARTIAL");
    assert.equal(status.principal.observation, "MEASURED");
    assert.equal(status.principal.contractValid, true);
    assert.equal(status.principal.verdict, "VERIFIED");
    assert.equal(status.principal.identityVerified, true);
    assert.equal(status.principal.bridgeEligible, true);
    assert.deepEqual(
      status.principal.verifiedIdentity,
      VERIFIED_PRINCIPAL_IDENTITY,
    );
    assert.equal(status.ready, false);
  } finally {
    await gw.stop();
  }
});

test("gateway-http adapter rejects a forged verified principal with authority or effect drift", async () => {
  const gw = await startFakeGateway({
    ...HEALTHY_ROUTES,
    "/principal/status": () =>
      jsonResponse(
        principalStatus({
          verdict: "VERIFIED",
          identityVerified: true,
          bridgeEligible: true,
          verifiedIdentity: VERIFIED_PRINCIPAL_IDENTITY,
          evidenceState: {
            profilePresent: true,
            activeChainRecordFound: true,
            durableReceiptMetadataFound: true,
            canonicalPayloadAvailable: true,
            chainContinuityVerified: true,
          },
          authorityPolicy: { authorityDelta: 1 },
          operationEffects: { activationPerformed: true },
        }),
      ),
  });
  try {
    const status = await createGatewayHttpAdapter({ baseUrl: gw.url }).status();

    assert.equal(status.truth_label, "DEGRADED");
    assert.equal(status.principal.observation, "INVALID");
    assert.equal(status.principal.contractValid, false);
    assert.equal(status.principal.identityVerified, null);
    assert.equal(status.principal.verifiedIdentity, null);
    assert.ok(
      status.principal.contractIssues.includes("authority_policy_not_read_only"),
    );
    assert.ok(
      status.principal.contractIssues.includes("operation_effects_not_read_only"),
    );
  } finally {
    await gw.stop();
  }
});

test("gateway-http adapter leaves principal identity unknown when the endpoint is absent", async () => {
  const routes = { ...HEALTHY_ROUTES };
  delete routes["/principal/status"];
  const gw = await startFakeGateway(routes);
  try {
    const status = await createGatewayHttpAdapter({ baseUrl: gw.url }).status();

    assert.equal(status.gateway.reachable, true);
    assert.equal(status.truth_label, "MEASURED_PARTIAL");
    assert.equal(status.principal.observation, "UNAVAILABLE");
    assert.equal(status.principal.contractValid, false);
    assert.equal(status.principal.identityVerified, null);
    assert.equal(status.ready, false);
    assert.ok(
      status.unknown.includes("principal_identity_not_exposed_by_gateway"),
    );
  } finally {
    await gw.stop();
  }
});

test("gateway-http adapter never claims ready=true even with a populated chain", async () => {
  const gw = await startFakeGateway({
    "/health": () =>
      jsonResponse({ status: "ok", domain: HEALTHY_GATEWAY_DOMAIN }),
    "/chain": () =>
      jsonResponse({
        head: "ab".repeat(32),
        length: 5,
        latestTimestamp: 1234567890,
      }),
    "/poi/summary": () =>
      jsonResponse({ totalEntries: 5, totalImpact: 1.5, avgImpact: 0.3 }),
    "/resources/list": () =>
      jsonResponse({ resources: [{ id: "r1" }, { id: "r2" }] }),
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
    "/chain": () =>
      jsonResponse({ head: "0".repeat(64), length: 0, latestTimestamp: null }),
    "/poi/summary": () =>
      jsonResponse({ totalEntries: 0, totalImpact: 0, avgImpact: 0 }),
    "/resources/list": () => jsonResponse({ resources: [] }),
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
    "/health": () =>
      jsonResponse({ status: "ok", domain: "some-other-server-v3" }),
  });
  try {
    const adapter = createGatewayHttpAdapter({ baseUrl: gw.url });
    const status = await adapter.status();
    assert.equal(status.gateway.reachable, false);
    assert.equal(status.truth_label, "DEGRADED");
    assert.ok(
      status.findings.some(
        (f) =>
          f.includes("domain mismatch") && f.includes("some-other-server-v3"),
      ),
    );
  } finally {
    await gw.stop();
  }
});

test("gateway-http adapter network failure is reported, never thrown", async () => {
  // Port 1 is reserved on Linux + unlikely to be bound; should fail to connect.
  const adapter = createGatewayHttpAdapter({
    baseUrl: "http://127.0.0.1:1",
    timeoutMs: 500,
  });
  const status = await adapter.status();

  assert.equal(status.schema, "bizra.dema.node0_status.v0.2");
  assert.equal(status.gateway.reachable, false);
  assert.equal(status.truth_label, "DEGRADED");
  assert.ok(status.findings.length > 0);
  // All five endpoints failed → at least 5 findings (one per endpoint).
  assert.ok(status.findings.length >= 5);
});

test("gateway-http adapter refuses public HTTPS endpoints before fetch", async () => {
  const adapter = createGatewayHttpAdapter({
    baseUrl: "https://example.com",
    timeoutMs: 500,
  });
  const status = await adapter.status();

  assert.equal(status.gateway.reachable, false);
  assert.equal(status.gateway.base_url, "https://example.com");
  assert.equal(status.truth_label, "DEGRADED");
  assert.ok(
    status.findings.every((finding) =>
      finding.includes("non-localhost_gateway_url_refused"),
    ),
  );
});

test("gateway-http adapter refuses LAN IP endpoints before fetch", async () => {
  const adapter = createGatewayHttpAdapter({
    baseUrl: "http://192.168.1.25:7421",
    timeoutMs: 500,
  });
  const status = await adapter.status();

  assert.equal(status.gateway.reachable, false);
  assert.equal(status.gateway.base_url, "http://192.168.1.25:7421");
  assert.equal(status.truth_label, "DEGRADED");
  assert.ok(
    status.findings.every((finding) =>
      finding.includes("non-localhost_gateway_url_refused"),
    ),
  );
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
      gatewayUrl: gw.url,
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
        DEMA_NODE0_STATUS_COMMAND: 'node -e "process.exit(42)"',
      },
      async () => {
        const adapter = createNode0Adapter({ timeoutMs: 1000 });
        const status = await adapter.status();

        assert.equal(status.schema, "bizra.dema.node0_status.v0.2");
        assert.equal(status.source, "gateway-http-composed");
        assert.equal(status.gateway.base_url, gw.url);
        assert.deepEqual(
          gw.calls.map((call) => call.method),
          ["GET", "GET", "GET", "GET", "GET"],
        );
      },
    );
  } finally {
    await gw.stop();
  }
});

test("createNode0Adapter labels shellout status as legacy and operator-owned", async () => {
  const adapter = createNode0Adapter({
    adapterMode: "shellout",
    command:
      'node -e "process.stdout.write(JSON.stringify({ ready: true, findings: [] }))"',
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
    available: true,
  });
});

test("createNode0Adapter treats shell metacharacters as literal argv in shellout command", async () => {
  const adapter = createNode0Adapter({
    adapterMode: "shellout",
    command:
      'node -e "process.stdout.write(JSON.stringify({ human: process.argv.slice(1).join(`|`), findings: process.argv.slice(1) }))" "semi;echo SHOULD_NOT_RUN" "$(echo SHOULD_NOT_EXPAND)" "plain&&echo NO"',
  });
  const status = await adapter.status();

  assert.equal(
    status.human,
    "semi;echo SHOULD_NOT_RUN|$(echo SHOULD_NOT_EXPAND)|plain&&echo NO",
  );
  assert.deepEqual(status.findings, [
    "semi;echo SHOULD_NOT_RUN",
    "$(echo SHOULD_NOT_EXPAND)",
    "plain&&echo NO",
  ]);
  assert.equal(status.adapter.shell, false);
});

test("createNode0Adapter reports missing legacy shellout command as unavailable status", async () => {
  const adapter = createNode0Adapter({
    adapterMode: "shellout",
    command: "dema-node0-status-command-that-should-not-exist",
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
  assert.ok(
    status.findings.some((finding) =>
      finding.includes("DEMA_NODE0_STATUS_COMMAND unavailable"),
    ),
  );
});

test("createNode0Adapter reports absent legacy shellout command as unavailable status", async () => {
  await withNode0AdapterEnv(
    {
      DEMA_NODE0_ADAPTER: "shellout",
      DEMA_GATEWAY_URL: undefined,
      DEMA_NODE0_STATUS_COMMAND: undefined,
    },
    async () => {
      const status = await createNode0Adapter().status();

      assert.equal(status.schema, "bizra.dema.status.v0.1");
      assert.equal(status.ready, false);
      assert.equal(status.source, "legacy-shellout-unavailable");
      assert.equal(status.adapter.available, false);
      assert.equal(
        status.adapter.reason,
        "legacy_status_command_not_configured",
      );
    },
  );
});

test("node0 adapter env test helper restores adapter environment variables", async () => {
  const originals = {
    DEMA_NODE0_ADAPTER: process.env.DEMA_NODE0_ADAPTER,
    DEMA_GATEWAY_URL: process.env.DEMA_GATEWAY_URL,
    DEMA_NODE0_STATUS_COMMAND: process.env.DEMA_NODE0_STATUS_COMMAND,
  };

  await withNode0AdapterEnv(
    {
      DEMA_NODE0_ADAPTER: "gateway-http",
      DEMA_GATEWAY_URL: "http://127.0.0.1:65534",
      DEMA_NODE0_STATUS_COMMAND: "node fake.js",
    },
    async () => {
      assert.equal(process.env.DEMA_NODE0_ADAPTER, "gateway-http");
      assert.equal(process.env.DEMA_GATEWAY_URL, "http://127.0.0.1:65534");
      assert.equal(process.env.DEMA_NODE0_STATUS_COMMAND, "node fake.js");
    },
  );

  assert.equal(process.env.DEMA_NODE0_ADAPTER, originals.DEMA_NODE0_ADAPTER);
  assert.equal(process.env.DEMA_GATEWAY_URL, originals.DEMA_GATEWAY_URL);
  assert.equal(
    process.env.DEMA_NODE0_STATUS_COMMAND,
    originals.DEMA_NODE0_STATUS_COMMAND,
  );
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

test("dema status:json under gateway-http adapter overlays local profile.preferred_name at CLI boundary", async () => {
  // End-to-end lock: with DEMA_NODE0_ADAPTER=gateway-http (the production
  // operator config), the gateway-http adapter still returns human:null per
  // its NOT_EXPOSED_BY_GATEWAY honesty contract, but the CLI wrapper
  // statusWithLocalIdentity() must enrich the displayed JSON from
  // ~/.dema/profile.json. This is the exact path that originally showed
  // "Human: unknown" on the operator machine before commit d24bb4c.
  const gw = await startFakeGateway(HEALTHY_ROUTES);
  const demaRoot = await mkdtemp(join(tmpdir(), "dema-gw-cli-human-"));
  try {
    await writeFile(
      join(demaRoot, "profile.json"),
      JSON.stringify({ preferred_name: "Mumu" }),
    );
    const { stdout } = await execFileAsync("node", [cliPath, "status:json"], {
      env: {
        ...process.env,
        DEMA_NODE0_ADAPTER: "gateway-http",
        DEMA_GATEWAY_URL: gw.url,
        DEMA_HOME: demaRoot,
        DEMA_NODE0_STATUS_COMMAND: "",
      },
    });
    const status = JSON.parse(stdout);
    assert.equal(status.schema, "bizra.dema.node0_status.v0.2");
    assert.equal(status.source, "gateway-http-composed");
    assert.equal(status.human, "Mumu");
    // Adapter contract still in force: preferred_name is in unknown[] (the
    // gateway did not expose it; the CLI overlaid local truth).
    assert.ok(status.unknown.some((u) => u.includes("preferred_name")));
  } finally {
    await rm(demaRoot, { recursive: true, force: true });
    await gw.stop();
  }
});
