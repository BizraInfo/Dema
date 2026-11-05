// Read-only fixture adapter integration. This does not execute a Node0 mission.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createGatewayServer } from "../scripts/gateway-server.mjs";
import { fetchGatewayState, composeNode0StatusFromGateway } from "../packages/node-adapter/src/gateway-http-adapter.js";

test("read-only gateway fixture composes adapter observations across refusal and restart", async t => {
  const stateDir = mkdtempSync(join(tmpdir(), "n0-readonly-integration-"));
  let gw = createGatewayServer({ port: 0, stateDir });
  t.after(async () => {
    await gw.stop();
    rmSync(stateDir, { recursive: true, force: true });
  });
  await gw.start();
  const status = async () => composeNode0StatusFromGateway(await fetchGatewayState(
    `http://127.0.0.1:${gw.server.address().port}`, { timeoutMs: 5000 },
  ));
  const before = await status();
  assert.equal(before.schema, "bizra.dema.node0_status.v0.2");
  assert.equal(before.source, "gateway-http-composed");
  assert.equal(before.gateway.reachable, true);
  assert.equal(before.ready, false);
  assert.equal(before.chain.length, 0);
  const res = await fetch(`http://127.0.0.1:${gw.server.address().port}/mission/run`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ objective: "retired fixture", consent: "GO: Node0 bounded diagnostic activation only" }),
  });
  assert.equal(res.status, 410);
  await res.arrayBuffer();
  assert.equal((await status()).chain.length, 0);
  assert.equal(existsSync(join(stateDir, "chain.jsonl")), false);
  await gw.stop();
  gw = createGatewayServer({ port: 0, stateDir });
  await gw.start();
  const after = await status();
  assert.equal(after.gateway.reachable, true);
  assert.equal(after.ready, false);
  assert.equal(after.chain.length, 0);
  assert.equal(existsSync(join(stateDir, "chain.jsonl")), false);
});
