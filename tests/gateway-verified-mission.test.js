import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { createGatewayServer } from "../scripts/gateway-server.mjs";

// Every protected root here is synthetic. No operator state is read or written.
async function fixture(t, kind) {
  const root = mkdtempSync(join(tmpdir(), "gateway-quarantine-"));
  const protectedHome = join(root, "protected-home");
  const protectedDir = join(protectedHome, "node0");
  const isolated = join(root, "isolated");
  mkdirSync(protectedDir, { recursive: true });
  mkdirSync(isolated);
  const chain = join(protectedDir, "chain.jsonl");
  const before = Buffer.from('{"fixture_only":true,"mission_id":"protected-sentinel"}\n');
  writeFileSync(chain, before);
  const originalHome = process.env.DEMA_HOME;
  process.env.DEMA_HOME = protectedHome;
  let gw;
  t.after(async () => {
    if (gw) await gw.stop();
    if (originalHome === undefined) delete process.env.DEMA_HOME;
    else process.env.DEMA_HOME = originalHome;
    rmSync(root, { recursive: true, force: true });
  });
  let stateDir = isolated;
  if (kind === "production") stateDir = protectedDir;
  if (kind === "directory alias") {
    stateDir = join(root, "alias");
    symlinkSync(protectedDir, stateDir);
  }
  if (kind === "chain alias") symlinkSync(chain, join(isolated, "chain.jsonl"));
  if (kind === "missing target") stateDir = join(root, "missing");
  if (kind === "unresolvable target") {
    stateDir = join(root, "loop");
    symlinkSync(stateDir, stateDir);
  }
  gw = createGatewayServer({ port: 0, stateDir });
  await gw.start();
  if (kind === "directory swap") {
    rmSync(isolated, { recursive: true });
    symlinkSync(protectedDir, isolated);
  }
  if (kind === "chain swap") {
    const path = join(isolated, "chain.jsonl");
    writeFileSync(path, "");
    unlinkSync(path);
    symlinkSync(chain, path);
  }
  return {
    stateDir, url: `http://127.0.0.1:${gw.server.address().port}`,
    unchanged() {
      assert.equal(readFileSync(chain).toString(), before.toString(), "protected chain bytes changed");
      if (kind === "missing target") assert.equal(existsSync(stateDir), false);
      if (kind === "isolated") assert.equal(existsSync(join(isolated, "chain.jsonl")), false);
    },
  };
}

for (const kind of ["production", "isolated", "directory alias", "chain alias", "missing target", "unresolvable target", "directory swap", "chain swap"]) {
  test(`retired mission route: ${kind} returns 410 without writing`, async (t) => {
    const f = await fixture(t, kind);
    const response = await fetch(`${f.url}/mission/run`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objective: "synthetic refusal control", consent: "GO: Node0 bounded diagnostic activation only" }),
    });
    const body = await response.json();
    f.unchanged();
    assert.equal(response.status, 410);
    assert.equal(body.error, "gateway_retired");
    assert.equal(body.retired, true);
  });
}

test("retired route does not parse or buffer mission payloads", async (t) => {
  const f = await fixture(t, "isolated");
  for (const body of ["{", "{}", JSON.stringify({ objective: "x".repeat(70_000) })]) {
    const response = await fetch(`${f.url}/mission/run`, { method: "POST", body });
    assert.equal(response.status, 410);
    await response.arrayBuffer();
  }
  f.unchanged();
});

test("direct CLI cannot revive the retired gateway with a fixture override", async (t) => {
  const f = await fixture(t, "isolated");
  const result = spawnSync(process.execPath, [new URL("../scripts/gateway-server.mjs", import.meta.url).pathname], {
    env: { ...process.env, BIZRA_COGNITION_PORT: "0", BIZRA_SOVEREIGN_STATE_PATH: f.stateDir, DEMA_GATEWAY_ALLOW_FIXTURE: "1" },
    encoding: "utf8", timeout: 2000,
  });
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stderr).error, "gateway_retired");
  f.unchanged();
});
