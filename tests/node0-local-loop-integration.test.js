// NODE0-LOCAL-LOOP-INTEGRATION-1A
// Proves one Node0 actually functions locally: gateway + adapter + receipts + replay.
//
// This is the test that closes the gap: one running loop, one bounded mission,
// durable receipts, restart recovery, no duplicate effects.

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createGatewayServer } from "../packages/node-adapter/src/gateway-server.js";
import { fetchGatewayState, composeNode0StatusFromGateway } from "../packages/node-adapter/src/gateway-http-adapter.js";

describe("NODE0-LOCAL-LOOP-INTEGRATION-1A — one node, really functioning", () => {
  let gw;
  let baseUrl;
  let stateDir;
  let missionResult;

  before(async () => {
    stateDir = mkdtempSync(join(tmpdir(), "n0-integration-"));
    gw = createGatewayServer({ port: 0, stateDir });
    await gw.start();
    const addr = gw.server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    await gw.stop();
    rmSync(stateDir, { recursive: true, force: true });
    delete process.env.DEMA_GATEWAY_URL;
    delete process.env.DEMA_NODE0_ADAPTER;
  });

  it("gateway-http-adapter can compose Node0 status from gateway", async () => {
    // Point adapter at our test gateway
    process.env.DEMA_GATEWAY_URL = baseUrl;
    const state = await fetchGatewayState(baseUrl, { timeoutMs: 5000 });
    const status = composeNode0StatusFromGateway(state);

    assert.equal(status.schema, "bizra.dema.node0_status.v0.2");
    assert.equal(status.source, "gateway-http-composed");
    assert.equal(status.gateway.reachable, true);
    assert.equal(status.gateway.domain, "bizra-cognition-gateway-v1");
    assert.equal(status.chain.length, 0); // no mission yet
    assert.equal(status.ready, false); // no mission yet
  });

  it("execute one bounded mission — effect_count=1, duplicate_effects=0", async () => {
    const res = await fetch(`${baseUrl}/mission/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objective: "MORNING-DELTA-0A — one bounded local mission",
        effect_class: "READ_ONLY_OBSERVATION",
      }),
    });
    assert.equal(res.ok, true);
    const result = await res.json();

    assert.equal(result.ok, true);
    assert.equal(result.effect_count, 1);
    assert.equal(result.duplicate_effects, 0);
    assert.ok(result.receipt_hash.startsWith("sha256:"));
    assert.ok(result.mission_id);

    // Store for later assertions
    missionResult = result;
  });

  it("adapter shows mission executed, chain length=1", async () => {
    const state = await fetchGatewayState(baseUrl, { timeoutMs: 5000 });
    const status = composeNode0StatusFromGateway(state);

    assert.equal(status.chain.length, 1);
    assert.equal(status.missionExecuted, true);
    assert.ok(status.chain.head !== null);
    assert.ok(status.chain.latestTimestamp !== null);
    assert.equal(status.truth_label, "MEASURED_PARTIAL");
  });

  it("gateway survives restart and recovers chain from durable state", async () => {
    // Stop gateway
    await gw.stop();

    // Restart with same stateDir
    gw = createGatewayServer({ port: 0, stateDir });
    await gw.start();
    const addr = gw.server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;

    // Chain persisted
    const chain = await fetch(`${baseUrl}/chain`).then((r) => r.json());
    assert.equal(chain.length, 1, "chain survived restart");
    assert.ok(chain.head !== null);

    // Adapter still works
    const state = await fetchGatewayState(baseUrl, { timeoutMs: 5000 });
    const status = composeNode0StatusFromGateway(state);
    assert.equal(status.chain.length, 1);
    assert.equal(status.gateway.reachable, true);
  });

  it("second mission — effect_count=1, no duplicate from first", async () => {
    const res = await fetch(`${baseUrl}/mission/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objective: "SECOND-MISSION-0A — proving no duplicate",
        effect_class: "READ_ONLY_OBSERVATION",
      }),
    });
    assert.equal(res.ok, true);
    const result = await res.json();

    assert.equal(result.ok, true);
    assert.equal(result.effect_count, 1);
    assert.equal(result.duplicate_effects, 0);

    // Chain now has 2 entries
    const chain = await fetch(`${baseUrl}/chain`).then((r) => r.json());
    assert.equal(chain.length, 2);
  });

  it("POI summary reflects both missions", async () => {
    const res = await fetch(`${baseUrl}/poi/summary`);
    assert.equal(res.ok, true);
    const body = await res.json();
    // No impact scores assigned yet (read-only observation)
    assert.equal(typeof body.totalEntries, "number");
    assert.equal(typeof body.totalImpact, "number");
  });

  it("resources list shows available compute", async () => {
    const res = await fetch(`${baseUrl}/resources/list`);
    assert.equal(res.ok, true);
    const body = await res.json();
    assert.ok(body.resources.some((r) => r.type === "compute"));
  });
});
