import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createGatewayServer } from "../scripts/gateway-server.mjs";

const CONSENT = "GO: Node0 bounded diagnostic activation only";

describe("Gateway Verified Mission — supervisor + SAT-5", () => {
  let gw;
  let baseUrl;
  let stateDir;

  before(async () => {
    stateDir = mkdtempSync(join(tmpdir(), "gw-verified-"));
    gw = createGatewayServer({ port: 0, stateDir });
    await gw.start();
    const addr = gw.server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    await gw.stop();
    rmSync(stateDir, { recursive: true, force: true });
  });

  it("GVM-01: honest mission completes via SAT-5 ADMISSIBLE", async () => {
    const res = await fetch(`${baseUrl}/mission/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objective: "honest bounded diagnostic for GVM-01",
        effect_class: "READ_ONLY_OBSERVATION",
        consent: CONSENT,
      }),
    });
    assert.equal(res.ok, true);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.status, "COMPLETED");
    assert.equal(body.sat_verdict, "ADMISSIBLE");

    const chain = await fetch(`${baseUrl}/chain`).then((r) => r.json());
    const last = chain.entries[chain.entries.length - 1];
    assert.equal(last.status, "COMPLETED");
  });

  it("GVM-02: RED test — a mission that SHOULD_FAIL_SAT5 must NOT be COMPLETED", async () => {
    // This is the bug that self-certification allowed: before the fix this test failed
    // because the gateway blindly returned COMPLETED even for a RIBA/forbidden claim.
    const res = await fetch(`${baseUrl}/mission/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objective: "SHOULD_FAIL_SAT5: riba mint claim should be REJECTED",
        effect_class: "READ_ONLY_OBSERVATION",
        consent: CONSENT,
        mint_claim: true,
      }),
    });
    // Verified path must NOT be ok:true COMPLETED — it must be verify_failed (200 with ok:false)
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.error, "verify_failed");
    assert.equal(body.status, "VERIFY_FAILED");
    assert.equal(body.sat_verdict, "REJECTED");
    assert.ok(body.sat_failing_verifiers.includes("SAT-3") || body.sat_failing_verifiers.includes("SAT-5"));

    const chain = await fetch(`${baseUrl}/chain`).then((r) => r.json());
    const last = chain.entries[chain.entries.length - 1];
    assert.equal(last.status, "VERIFY_FAILED");
    assert.notEqual(last.status, "COMPLETED");
  });

  it("GVM-03: forbidden_claims alone triggers VERIFY_FAILED via SAT-5", async () => {
    const res = await fetch(`${baseUrl}/mission/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objective: "test forbidden claim",
        effect_class: "READ_ONLY_OBSERVATION",
        consent: CONSENT,
        forbidden_claims: ["test_forbidden_claim"],
      }),
    });
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.status, "VERIFY_FAILED");
    assert.equal(body.sat_verdict, "REJECTED");
    assert.ok(body.sat_failing_verifiers.includes("SAT-5"));
  });

  it("GVM-04: high blast radius without reversible+backup fails SAT-4", async () => {
    const res = await fetch(`${baseUrl}/mission/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objective: "high blast unmitigated",
        effect_class: "READ_ONLY_OBSERVATION",
        consent: CONSENT,
        blast_radius: "high",
        reversible: false,
        backup_present: false,
      }),
    });
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.status, "VERIFY_FAILED");
    assert.ok(body.sat_failing_verifiers.includes("SAT-4"));
  });

  it("GVM-05: honest mission after failures still COMPLETED — gateway not stuck", async () => {
    const res = await fetch(`${baseUrl}/mission/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objective: "second honest after failures",
        effect_class: "READ_ONLY_OBSERVATION",
        consent: CONSENT,
      }),
    });
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.status, "COMPLETED");
  });
});
