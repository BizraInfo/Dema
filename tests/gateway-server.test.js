import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createGatewayServer } from "../scripts/gateway-server.mjs";

describe("Gateway Server — read-only fixture", () => {
  let gw, stateDir, baseUrl;
  before(async () => {
    stateDir = mkdtempSync(join(tmpdir(), "gw-readonly-"));
    gw = createGatewayServer({ port: 0, stateDir });
    await gw.start();
    baseUrl = `http://127.0.0.1:${gw.server.address().port}`;
  });
  after(async () => {
    await gw.stop();
    rmSync(stateDir, { recursive: true, force: true });
  });
  it("starts on loopback", () => {
    assert.equal(gw.isReady(), true);
    assert.equal(gw.server.address().address, "127.0.0.1");
  });
  it("GET /health reads empty fixture state", async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "ok");
    assert.equal(body.domain, "bizra-cognition-gateway-v1");
    assert.equal(body.chain_length, 0);
  });
  it("GET /chain returns empty fixture state", async () => {
    const body = await fetch(`${baseUrl}/chain`).then(r => r.json());
    assert.equal(body.head, null);
    assert.equal(body.length, 0);
    assert.equal(body.latestTimestamp, null);
  });
  it("GET /poi/summary reads empty fixture state", async () => {
    const body = await fetch(`${baseUrl}/poi/summary`).then(r => r.json());
    assert.deepEqual(body, { totalEntries: 0, totalImpact: 0, avgImpact: 0 });
  });
  it("GET /resources/list reads fixture defaults", async () => {
    const body = await fetch(`${baseUrl}/resources/list`).then(r => r.json());
    assert.ok(body.resources.some(r => r.type === "compute"));
  });
  for (const consent of [undefined, "GO", "GO: Node0 bounded diagnostic activation only"]) {
    it(`POST /mission/run remains retired with consent ${String(consent)}`, async () => {
      const res = await fetch(`${baseUrl}/mission/run`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective: "refusal fixture", consent }),
      });
      assert.equal(res.status, 410);
      assert.equal((await res.json()).error, "gateway_retired");
      assert.equal(existsSync(join(stateDir, "chain.jsonl")), false);
    });
  }
  it("unknown endpoints return 404", async () => {
    assert.equal((await fetch(`${baseUrl}/nonexistent`)).status, 404);
  });
  it("corrupt fixture chain stays degraded on reads and cannot activate missions", async () => {
    const path = join(stateDir, "chain.jsonl");
    const corrupt = '{"fixture_only":true}\nNOT JSON\n';
    writeFileSync(path, corrupt);
    for (const endpoint of ["/health", "/chain"]) {
      const res = await fetch(`${baseUrl}${endpoint}`);
      assert.equal(res.status, 503);
      assert.equal((await res.json()).error, "CHAIN_CORRUPT");
    }
    const res = await fetch(`${baseUrl}/mission/run`, { method: "POST", body: "{}" });
    assert.equal(res.status, 410);
    await res.arrayBuffer();
    assert.equal(readFileSync(path, "utf8"), corrupt);
  });
  it("restart preserves seeded fixture bytes without producing receipts", async () => {
    const path = join(stateDir, "chain.jsonl");
    const seeded = JSON.stringify({ mission_id: "fixture-only", timestamp: "2026-01-01T00:00:00Z" }) + "\n";
    writeFileSync(path, seeded);
    await gw.stop();
    gw = createGatewayServer({ port: 0, stateDir });
    await gw.start();
    baseUrl = `http://127.0.0.1:${gw.server.address().port}`;
    const chain = await fetch(`${baseUrl}/chain`).then(r => r.json());
    assert.equal(chain.length, 1);
    assert.equal(chain.entries[0].mission_id, "fixture-only");
    assert.equal(readFileSync(path, "utf8"), seeded);
  });
  it("reads resource metadata and falls back when its fixture JSON is malformed", async () => {
    const path = join(stateDir, "resources.json");
    writeFileSync(path, JSON.stringify({ compute: { available: false, type: "fixture" }, storage: { available: true } }));
    const read = () => fetch(`${baseUrl}/resources/list`).then(r => r.json());
    assert.deepEqual((await read()).resources, [
      { type: "compute", available: false, capability: "fixture" },
      { type: "storage", available: true },
    ]);
    writeFileSync(path, "{");
    assert.deepEqual((await read()).resources, [{ type: "compute", available: true, capability: "local" }]);
    assert.equal(readFileSync(path, "utf8"), "{");
  });
  it("summarizes only impact-bearing fixture entries without changing them", async () => {
    const path = join(stateDir, "chain.jsonl");
    const bytes = [{ impact: 2 }, { fixture_only: true }, { impact: 4 }].map(e => JSON.stringify(e)).join("\n") + "\n";
    writeFileSync(path, bytes);
    const body = await fetch(`${baseUrl}/poi/summary`).then(r => r.json());
    assert.deepEqual(body, { totalEntries: 2, totalImpact: 6, avgImpact: 3 });
    assert.equal(readFileSync(path, "utf8"), bytes);
  });
  it("an unreadable chain target fails closed on both read endpoints", async () => {
    const path = join(stateDir, "chain.jsonl");
    rmSync(path);
    mkdirSync(path);
    for (const endpoint of ["/health", "/chain"]) {
      const res = await fetch(`${baseUrl}${endpoint}`);
      assert.equal(res.status, 503);
      assert.equal((await res.json()).error, "CHAIN_UNREADABLE");
    }
  });
  it("default fixture reads honor an explicitly isolated DEMA_HOME", async () => {
    const original = process.env.DEMA_HOME;
    const home = join(stateDir, "default-home");
    mkdirSync(join(home, "node0"), { recursive: true });
    const bytes = '{"mission_id":"default-home-fixture"}\n';
    writeFileSync(join(home, "node0", "chain.jsonl"), bytes);
    process.env.DEMA_HOME = home;
    const defaultGateway = createGatewayServer({ port: 0 });
    try {
      await defaultGateway.start();
      const res = await fetch(`http://127.0.0.1:${defaultGateway.server.address().port}/chain`);
      assert.equal(res.status, 200);
      assert.equal((await res.json()).entries[0].mission_id, "default-home-fixture");
      assert.equal(readFileSync(join(home, "node0", "chain.jsonl"), "utf8"), bytes);
    } finally {
      await defaultGateway.stop();
      if (original === undefined) delete process.env.DEMA_HOME;
      else process.env.DEMA_HOME = original;
    }
  });
  it("CORS preflight cannot revive the retired mission route", async () => {
    const res = await fetch(`${baseUrl}/mission/run`, { method: "OPTIONS" });
    assert.equal(res.status, 204);
    assert.equal(await res.text(), "");
    const mission = await fetch(`${baseUrl}/mission/run`, { method: "POST", body: "{}" });
    assert.equal(mission.status, 410);
    await mission.arrayBuffer();
  });
  it("invalid resource shape returns an error without altering its fixture", async () => {
    const path = join(stateDir, "resources.json");
    writeFileSync(path, "null");
    const res = await fetch(`${baseUrl}/resources/list`);
    assert.equal(res.status, 500);
    assert.equal((await res.json()).error, "internal");
    assert.equal(readFileSync(path, "utf8"), "null");
  });
});
