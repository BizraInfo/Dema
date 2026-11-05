import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createGatewayServer } from "../scripts/gateway-server.mjs";

test("retirement dominates exact consent and cannot be revived by any phrase", async t => {
  const stateDir = mkdtempSync(join(tmpdir(), "gw-retired-consent-"));
  const gw = createGatewayServer({ port: 0, stateDir });
  t.after(async () => {
    await gw.stop();
    rmSync(stateDir, { recursive: true, force: true });
  });
  await gw.start();
  const base = `http://127.0.0.1:${gw.server.address().port}`;
  for (const consent of ["GO: Node0 bounded diagnostic activation only", "GO: unrelated authority escalation", "GO", null]) {
    const res = await fetch(`${base}/mission/run`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objective: "retirement control", consent }),
    });
    assert.equal(res.status, 410);
    assert.equal((await res.json()).error, "gateway_retired");
  }
  assert.equal(existsSync(join(stateDir, "chain.jsonl")), false);
});
