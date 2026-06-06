import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  formatBanner,
  gatherBannerInputs,
  probeGateway,
} from "../packages/core/src/banner.js";
import { tokenize } from "../packages/core/src/shell.js";

const HEALTHY_DOMAIN = "bizra-cognition-gateway-v1";

function startFakeGateway(routes) {
  const server = createServer((req, res) => {
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
        async stop() {
          await new Promise((r) => server.close(r));
        },
      });
    });
  });
}

test("probeGateway returns reachable when /health responds with correct domain", async () => {
  const gw = await startFakeGateway({
    "/health": () => ({ body: { status: "ok", domain: HEALTHY_DOMAIN } }),
  });
  try {
    const result = await probeGateway(gw.url);
    assert.equal(result.reachable, true);
    assert.equal(result.domain, HEALTHY_DOMAIN);
    assert.equal(result.status, "ok");
  } finally {
    await gw.stop();
  }
});

test("probeGateway returns unreachable when domain mismatches", async () => {
  const gw = await startFakeGateway({
    "/health": () => ({ body: { status: "ok", domain: "some-other-server" } }),
  });
  try {
    const result = await probeGateway(gw.url);
    assert.equal(result.reachable, false);
    assert.equal(result.domain, "some-other-server");
  } finally {
    await gw.stop();
  }
});

test("probeGateway returns unreachable on connection failure", async () => {
  const result = await probeGateway("http://127.0.0.1:1", { timeoutMs: 500 });
  assert.equal(result.reachable, false);
  assert.ok(result.error);
});

test("gatherBannerInputs returns null profile + null bizraContext when ~/.dema is empty", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-banner-empty-"));
  await mkdir(join(root, "memory"), { recursive: true });
  const inputs = await gatherBannerInputs({
    home: root,
    gatewayUrl: "http://127.0.0.1:1",
  });
  assert.equal(inputs.profile, null);
  assert.equal(inputs.bizraContext, null);
  assert.equal(inputs.receiptCount, 0);
  assert.equal(inputs.gateway.reachable, false);
});

test("gatherBannerInputs surfaces profile name + stage + receipt count", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-banner-full-"));
  await mkdir(join(root, "memory"), { recursive: true });
  await mkdir(join(root, "receipts"), { recursive: true });
  await writeFile(
    join(root, "profile.json"),
    JSON.stringify({
      schema: "bizra.dema.profile.v0.1",
      preferred_name: "Mumu",
    }),
  );
  await writeFile(
    join(root, "memory", "bizra-context.json"),
    JSON.stringify({ stage: { current: "SPROUT", next: "TREE" } }),
  );
  await writeFile(
    join(root, "receipts", "artifact-011.json"),
    JSON.stringify({
      receipt_id: "r-1",
      artifact_id: "ARTIFACT-011",
      action: "bounded_diagnostic_activation",
      truth_label: "MEASURED",
      created_at: "2026-05-06T00:00:00Z",
    }),
  );

  const inputs = await gatherBannerInputs({
    home: root,
    gatewayUrl: "http://127.0.0.1:1",
  });
  assert.equal(inputs.profile.preferred_name, "Mumu");
  assert.equal(inputs.bizraContext.stage.current, "SPROUT");
  assert.equal(inputs.receiptCount, 1);
  assert.ok(
    inputs.receiptHighlights.find((r) => r.artifact_id === "ARTIFACT-011"),
  );
});

test("formatBanner suggests setup when profile is missing", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-banner-no-profile-"));
  await mkdir(join(root, "memory"), { recursive: true });
  const inputs = await gatherBannerInputs({
    home: root,
    gatewayUrl: "http://127.0.0.1:1",
  });
  const banner = formatBanner(inputs);
  assert.match(banner, /name\s+:\s+operator/);
  assert.match(banner, /Local-first cockpit/);
  assert.match(banner, /\$ dema setup/);
  assert.match(banner, /First run/i);
  assert.match(banner, /\$ dema onboard/);
});

test("formatBanner suggests downloads.audit.preview when fully ready", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-banner-ready-"));
  await mkdir(join(root, "memory"), { recursive: true });
  await mkdir(join(root, "receipts"), { recursive: true });
  await writeFile(
    join(root, "profile.json"),
    JSON.stringify({ preferred_name: "Mumu" }),
  );
  await writeFile(
    join(root, "memory", "bizra-context.json"),
    JSON.stringify({ stage: { current: "SPROUT", next: "TREE" } }),
  );
  await writeFile(
    join(root, "receipts", "artifact-011.json"),
    JSON.stringify({ receipt_id: "r-1", artifact_id: "ARTIFACT-011" }),
  );

  const gw = await startFakeGateway({
    "/health": () => ({ body: { status: "ok", domain: HEALTHY_DOMAIN } }),
  });
  try {
    const inputs = await gatherBannerInputs({ home: root, gatewayUrl: gw.url });
    const banner = formatBanner(inputs);
    assert.match(banner, /name\s+:\s+Mumu/);
    assert.match(banner, /stage\s+:\s+SPROUT/);
    assert.match(banner, /gateway\s+:\s+connected/);
    assert.match(banner, /\$ dema task downloads\.audit\.preview/);
  } finally {
    await gw.stop();
  }
});

test("shell tokenize handles plain words, quotes, and escapes", () => {
  assert.deepEqual(tokenize("status"), ["status"]);
  assert.deepEqual(tokenize("memory show profile"), [
    "memory",
    "show",
    "profile",
  ]);
  assert.deepEqual(tokenize('mission propose --consent "GO: phrase"'), [
    "mission",
    "propose",
    "--consent",
    "GO: phrase",
  ]);
  assert.deepEqual(tokenize("a\\ b c"), ["a b", "c"]);
});

test("shell tokenize throws on unclosed quote", () => {
  assert.throws(() => tokenize('say "hello'), /Unclosed quote/);
});
