import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createGatewayServer } from "../scripts/gateway-server.mjs";

const CONSENT = "GO: Node0 bounded diagnostic activation only";

describe("Gateway Server — lifecycle", () => {
  let gw;
  let stateDir;

  before(async () => {
    stateDir = mkdtempSync(join(tmpdir(), "gw-test-"));
    gw = createGatewayServer({ port: 0, stateDir }); // port 0 = random
    await gw.start();
  });

  after(async () => {
    await gw.stop();
    rmSync(stateDir, { recursive: true, force: true });
  });

  it("is ready after start", () => {
    assert.equal(gw.isReady(), true);
  });
});

describe("Gateway Server — endpoints", () => {
  let gw;
  let baseUrl;
  let stateDir;

  before(async () => {
    stateDir = mkdtempSync(join(tmpdir(), "gw-test-"));
    gw = createGatewayServer({ port: 0, stateDir });
    await gw.start();
    const addr = gw.server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    await gw.stop();
    rmSync(stateDir, { recursive: true, force: true });
  });

  it("GET /health returns ok with correct domain", async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.ok, true);
    const body = await res.json();
    assert.equal(body.status, "ok");
    assert.equal(body.domain, "bizra-cognition-gateway-v1");
    assert.equal(typeof body.version, "string");
    assert.equal(typeof body.chain_length, "number");
  });

  it("GET /chain returns empty chain initially", async () => {
    const res = await fetch(`${baseUrl}/chain`);
    assert.equal(res.ok, true);
    const body = await res.json();
    assert.equal(body.head, null);
    assert.equal(body.length, 0);
    assert.equal(body.latestTimestamp, null);
  });

  it("GET /poi/summary returns zero entries initially", async () => {
    const res = await fetch(`${baseUrl}/poi/summary`);
    assert.equal(res.ok, true);
    const body = await res.json();
    assert.equal(body.totalEntries, 0);
    assert.equal(body.totalImpact, 0);
    assert.equal(body.avgImpact, 0);
  });

  it("GET /resources/list returns resources", async () => {
    const res = await fetch(`${baseUrl}/resources/list`);
    assert.equal(res.ok, true);
    const body = await res.json();
    assert.ok(Array.isArray(body.resources));
    assert.ok(body.resources.length >= 1);
    assert.ok(body.resources.some((r) => r.type === "compute"));
  });

  it("POST /mission/run with consent executes mission and returns receipt", async () => {
    const res = await fetch(`${baseUrl}/mission/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objective: "test bounded mission",
        effect_class: "READ_ONLY_OBSERVATION",
        consent: CONSENT,
      }),
    });
    assert.equal(res.ok, true);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.effect_count, 1);
    assert.equal(body.duplicate_effects, 0);
    assert.ok(body.receipt_hash.startsWith("sha256:"));
    assert.ok(body.mission_id);
  });

  it("after mission, chain length is 1", async () => {
    const res = await fetch(`${baseUrl}/chain`);
    const body = await res.json();
    assert.equal(body.length, 1);
    assert.ok(body.head !== null);
    assert.ok(body.latestTimestamp !== null);
  });

  it("POST /mission/run without consent returns 403", async () => {
    const res = await fetch(`${baseUrl}/mission/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objective: "unauthorized mission" }),
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error, "consent_required");
    assert.ok(body.expected_consent_phrase);
  });

  it("POST /mission/run with bare GO returns 403", async () => {
    const res = await fetch(`${baseUrl}/mission/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objective: "bare GO", consent: "GO" }),
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error, "consent_required");
  });

  it("POST /mission/run without objective returns 400", async () => {
    const res = await fetch(`${baseUrl}/mission/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consent: CONSENT }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, "objective_required");
  });

  it("POST /mission/run with oversized body returns 413", async () => {
    // Use raw node:http to send a body larger than the 64KB server limit,
    // bypassing fetch's own internal limits.
    const http = await import("node:http");
    const addr = gw.server.address();
    const bigBody = JSON.stringify({
      objective: "x".repeat(70000),
      consent: CONSENT,
    });
    const result = await new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: "/mission/run",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(bigBody),
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            resolve({ status: res.statusCode, body: data });
          });
        },
      );
      req.on("error", reject);
      req.write(bigBody);
      req.end();
    });
    assert.equal(result.status, 413);
    const parsed = JSON.parse(result.body);
    assert.equal(parsed.error, "payload_too_large");
  });

  it("GET /nonexistent returns 404", async () => {
    const res = await fetch(`${baseUrl}/nonexistent`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error, "not_found");
  });
});

describe("Gateway Server — chain corruption", () => {
  let stateDir;

  before(() => {
    stateDir = mkdtempSync(join(tmpdir(), "gw-corrupt-"));
  });

  after(() => {
    rmSync(stateDir, { recursive: true, force: true });
  });

  it("corrupt chain file → 503 on /health, /chain; mission refuses", async () => {
    // Write a corrupt chain file
    const chainPath = join(stateDir, "chain.jsonl");
    writeFileSync(
      chainPath,
      '{"valid":true}\nNOT JSON\n{"also_valid":true}\n',
      "utf8",
    );

    const gw = createGatewayServer({ port: 0, stateDir });
    await gw.start();
    const addr = gw.server.address();
    const base = `http://127.0.0.1:${addr.port}`;

    try {
      // /health should report degraded
      const health = await fetch(`${base}/health`);
      assert.equal(health.status, 503);
      const hBody = await health.json();
      assert.equal(hBody.status, "degraded");
      assert.equal(hBody.error, "CHAIN_CORRUPT");

      // /chain should report error
      const chain = await fetch(`${base}/chain`);
      assert.equal(chain.status, 503);
      const cBody = await chain.json();
      assert.equal(cBody.error, "CHAIN_CORRUPT");

      // mission/run should refuse
      const mission = await fetch(`${base}/mission/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objective: "should not execute",
          consent: CONSENT,
        }),
      });
      assert.equal(mission.status, 503);
      const mBody = await mission.json();
      assert.equal(mBody.ok, false);
      assert.equal(mBody.error, "CHAIN_CORRUPT");
    } finally {
      await gw.stop();
    }
  });

  it("clean chain → gateway recovers after corruption is fixed", async () => {
    // Fix the chain file
    const chainPath = join(stateDir, "chain.jsonl");
    writeFileSync(chainPath, '{"valid":true}\n', "utf8");

    const gw = createGatewayServer({ port: 0, stateDir });
    await gw.start();
    const addr = gw.server.address();
    const base = `http://127.0.0.1:${addr.port}`;

    try {
      const health = await fetch(`${base}/health`);
      assert.equal(health.status, 200);
      const body = await health.json();
      assert.equal(body.status, "ok");
      assert.equal(body.chain_length, 1);
    } finally {
      await gw.stop();
    }
  });
});

describe("Gateway Server — restart recovery", () => {
  let stateDir;

  before(() => {
    stateDir = mkdtempSync(join(tmpdir(), "gw-restart-"));
  });

  after(() => {
    rmSync(stateDir, { recursive: true, force: true });
  });

  it("survives stop + start and recovers chain from disk", async () => {
    // First lifecycle: run a mission
    const gw1 = createGatewayServer({ port: 0, stateDir });
    await gw1.start();
    const addr1 = gw1.server.address();
    const base1 = `http://127.0.0.1:${addr1.port}`;

    const res1 = await fetch(`${base1}/mission/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objective: "first mission",
        consent: CONSENT,
      }),
    });
    const body1 = await res1.json();
    assert.equal(body1.ok, true);

    const chain1 = await fetch(`${base1}/chain`).then((r) => r.json());
    assert.equal(chain1.length, 1);

    await gw1.stop();

    // Second lifecycle: verify chain persists
    const gw2 = createGatewayServer({ port: 0, stateDir });
    await gw2.start();
    const addr2 = gw2.server.address();
    const base2 = `http://127.0.0.1:${addr2.port}`;

    const chain2 = await fetch(`${base2}/chain`).then((r) => r.json());
    assert.equal(chain2.length, 1, "chain persisted across restart");
    assert.equal(chain2.entries[0].mission_id, body1.mission_id);

    // Run second mission
    const res2 = await fetch(`${base2}/mission/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objective: "second mission",
        consent: CONSENT,
      }),
    });
    const body2 = await res2.json();
    assert.equal(body2.ok, true);

    const chain3 = await fetch(`${base2}/chain`).then((r) => r.json());
    assert.equal(chain3.length, 2);

    await gw2.stop();
  });
});
