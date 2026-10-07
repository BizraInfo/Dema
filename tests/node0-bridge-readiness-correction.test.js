// NODE0-BRIDGE-READINESS-CORRECTION-1B — BRC acceptance matrix.
//
// 1A proved health CONSUMES an adapter status instead of a constant. It did not
// prove WHO produced that status: `normalizeNode0Status` ASSIGNS node:"Node0",
// and the legacy adapter is an operator-owned shell-out, so any script emitting
// four accepted fields reached CLEAN. These tests encode the corrected law —
// CLEAN only when the exact observed runtime, home, endpoint and witness
// converge on one observation hash.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, utimes } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildRuntimeObservation,
  verifyObservationHash,
  isCleanEligibleObservation,
  isLoopbackEndpoint,
  CANONICAL_RUNTIME_DOMAIN,
  NODE0_RUNTIME_OBSERVATION_SCHEMA,
} from "../packages/core/src/node0-runtime-observation.js";
import {
  evaluateWitnessBinding,
  verifyWitnessReceipt,
  findBoundWitness,
  WITNESS_RUNTIME_BOUND_SCHEMA,
} from "../packages/receipts/src/witness-verify.js";
import { sha256, stableStringify } from "../packages/consent/src/consent-common.js";

const hash = (facts) => sha256(stableStringify(facts));
const HEALTHY_RAW = Object.freeze({
  runtime_identity: "node0-alpha",
  runtime_domain: CANONICAL_RUNTIME_DOMAIN,
  ready: true,
  console_ready: true,
  activation_gate: "EXPLICIT_GO_REQUIRED",
  health: "healthy",
});

const observed = (over = {}) =>
  buildRuntimeObservation({
    adapterMode: "gateway-http",
    configuredEndpoint: "http://127.0.0.1:7421",
    observedEndpoint: "http://127.0.0.1:7421",
    protocol: "http",
    inspectedHome: "/tmp/home-a",
    raw: HEALTHY_RAW,
    evidenceClass: "OBSERVED",
    hash,
    ...over,
  });

// A runtime-bound (v0.2) witness receipt, built to bind one exact observation.
async function writeWitness(home, { schema, binding }, name = "witness-a.json") {
  const dir = join(home, "receipts");
  await mkdir(dir, { recursive: true });
  const attests = { node: "Node0", token_claim: false, model_invocation: false, binding };
  const receipt = {
    schema,
    truth_label: "LOCAL_OPERATOR_MISSION",
    witnessed_at: "2026-08-06T00:00:00.000Z",
    attests,
    content_hash: sha256(stableStringify(attests)),
    boundary: {
      federation_invoked: false,
      public_network_used: false,
      consent_collected: true,
    },
  };
  const p = join(dir, name);
  await writeFile(p, JSON.stringify(receipt, null, 2));
  return p;
}

const bindingFor = (obs, over = {}) => ({
  home_identity: obs.inspected_home,
  runtime_identity: obs.runtime_identity,
  observed_endpoint: obs.observed_endpoint,
  observation_hash: obs.observation_hash,
  code_identity: "code-abc",
  authority_delta: 0,
  federation_invoked: false,
  ...over,
});

const expectedFor = (obs, over = {}) => ({
  expectedHomeIdentity: obs.inspected_home,
  expectedRuntimeIdentity: obs.runtime_identity,
  expectedEndpoint: obs.observed_endpoint,
  expectedObservationHash: obs.observation_hash,
  expectedCodeIdentity: "code-abc",
  ...over,
});

describe("NODE0-BRIDGE-READINESS-CORRECTION-1B", () => {
  it("BRC1 an unconfigured adapter cannot reach CLEAN", () => {
    const o = buildRuntimeObservation({ hash });
    assert.equal(o.verdict, "UNCONFIGURED");
    assert.equal(isCleanEligibleObservation(o), false);
    assert.ok(o.blocked_by.includes("no_adapter_configured"));
  });

  it("BRC2 a favourable injected status cannot reach bridge readiness", () => {
    const o = observed({ evidenceClass: "TEST_INJECTION" });
    assert.equal(o.verdict, "CONFIGURED_NOT_OBSERVED");
    assert.equal(isCleanEligibleObservation(o), false);
    assert.ok(o.blocked_by.includes("test_injection_is_not_observation"));
  });

  it("BRC3 a favourable shell script is OPERATOR_ASSERTED, never CLEAN", () => {
    const o = observed({ evidenceClass: "OPERATOR_ASSERTED", adapterMode: "legacy-shellout" });
    assert.equal(o.verdict, "OPERATOR_ASSERTED_STATUS");
    assert.equal(isCleanEligibleObservation(o), false);
  });

  it("BRC3b a configured adapter that produced nothing is not an endpoint refusal", () => {
    // Measured on the real home: an unavailable adapter reported
    // `non_local_endpoint_refused`, describing a rejection that never happened.
    // "Nothing answered" and "something wrong answered" are different facts.
    const o = observed({ evidenceClass: "NONE", observedEndpoint: null, adapterMode: "legacy-shellout-unavailable" });
    assert.equal(o.verdict, "CONFIGURED_NOT_OBSERVED");
    assert.ok(o.blocked_by.includes("adapter_configured_but_no_observation_produced"));
    assert.equal(o.blocked_by.includes("non_local_endpoint_refused"), false);
    assert.equal(isCleanEligibleObservation(o), false);
  });

  it("BRC4 a malformed gateway response fails closed", () => {
    for (const bad of [null, "healthy", 42]) {
      const o = observed({ raw: bad });
      assert.equal(o.verdict, "CONFIGURED_NOT_OBSERVED", `raw=${bad}`);
      assert.equal(isCleanEligibleObservation(o), false);
    }
  });

  it("BRC5 a wrong runtime domain fails closed", () => {
    const o = observed({ raw: { ...HEALTHY_RAW, runtime_domain: "evil.node" } });
    assert.equal(o.verdict, "OBSERVED_IDENTITY_MISMATCH");
    assert.ok(o.blocked_by.some((b) => b.startsWith("runtime_domain_mismatch")));
  });

  it("BRC6 a non-local endpoint is refused before any health reading", () => {
    assert.equal(isLoopbackEndpoint("http://10.0.0.5:7421"), false);
    assert.equal(isLoopbackEndpoint("http://127.0.0.1:7421"), true);
    const o = observed({ observedEndpoint: "http://evil.example.com:7421" });
    assert.equal(o.verdict, "OBSERVED_IDENTITY_MISMATCH");
    assert.ok(o.blocked_by.includes("non_local_endpoint_refused"));
  });

  it("BRC7 a healthy localhost gateway yields OBSERVED_HEALTHY", () => {
    const o = observed();
    assert.equal(o.schema, NODE0_RUNTIME_OBSERVATION_SCHEMA);
    assert.equal(o.verdict, "OBSERVED_HEALTHY");
    assert.equal(isCleanEligibleObservation(o), true);
    assert.equal(o.authority_delta, 0);
    assert.equal(o.activation_performed, false);
  });

  it("BRC8 the observation binds the exact configured and observed endpoint", () => {
    const o = observed({ configuredEndpoint: "http://127.0.0.1:7421", observedEndpoint: "http://127.0.0.1:9999" });
    assert.equal(o.configured_endpoint, "http://127.0.0.1:7421");
    assert.equal(o.observed_endpoint, "http://127.0.0.1:9999");
    // The hash covers the facts, so a different endpoint is a different
    // observation and no witness bound to the first can satisfy the second.
    assert.notEqual(o.observation_hash, observed().observation_hash);
  });

  it("BRC9 the observation binds the exact inspected home", () => {
    assert.notEqual(
      observed({ inspectedHome: "/tmp/home-a" }).observation_hash,
      observed({ inspectedHome: "/tmp/home-b" }).observation_hash,
    );
  });

  it("BRC10 boundary fields report actual capability per adapter mode", () => {
    const gw = observed();
    assert.equal(gw.local_loopback_used, true);
    assert.equal(gw.child_process_invoked, false);
    assert.equal(gw.external_call_performed, true);
    assert.equal(gw.public_network_used, false);

    const sh = observed({ evidenceClass: "OPERATOR_ASSERTED" });
    assert.equal(sh.child_process_invoked, true);
    assert.equal(sh.local_loopback_used, false);
    assert.equal(sh.external_call_performed, true);
  });

  it("BRC11 a forged all-zero observation boundary is rejected by re-derivation", () => {
    const o = observed();
    assert.equal(verifyObservationHash(o, hash), true);
    const forged = { ...o, external_call_performed: false, local_loopback_used: false };
    assert.equal(
      verifyObservationHash(forged, hash),
      false,
      "a laundered boundary must not re-derive to the recorded hash",
    );
  });

  it("BRC12 a generic v0.1 witness cannot satisfy bridge CLEAN", async () => {
    const home = await mkdtemp(join(tmpdir(), "brc12-"));
    const o = observed({ inspectedHome: home });
    const p = await writeWitness(home, {
      schema: "bizra.dema.node0_witness_receipt.v0.1",
      binding: bindingFor(o),
    });
    const v = await verifyWitnessReceipt(p, expectedFor(o));
    assert.equal(v.verdict, "VERIFIED", "historical v0.1 receipts still verify");
    assert.equal(v.eligible_for_bridge_clean, false);
    assert.equal(v.binding.reason, "witness_not_runtime_bound");
  });

  for (const [id, label, over] of [
    ["BRC13", "another home", { home_identity: "/tmp/other-home" }],
    ["BRC14", "another endpoint", { observed_endpoint: "http://127.0.0.1:1" }],
    ["BRC15", "another runtime identity", { runtime_identity: "node0-beta" }],
    ["BRC16", "another observation hash", { observation_hash: "deadbeef" }],
    ["BRC17", "stale code", { code_identity: "code-stale" }],
  ]) {
    it(`${id} a witness for ${label} cannot satisfy CLEAN`, async () => {
      const home = await mkdtemp(join(tmpdir(), `${id.toLowerCase()}-`));
      const o = observed({ inspectedHome: home });
      const p = await writeWitness(home, {
        schema: WITNESS_RUNTIME_BOUND_SCHEMA,
        binding: bindingFor(o, over),
      });
      const v = await verifyWitnessReceipt(p, expectedFor(o));
      assert.equal(v.eligible_for_bridge_clean, false, `${id} must refuse`);
      assert.equal(v.binding.reason, "binding_mismatch");
    });
  }

  it("BRC18 the newest-by-mtime wrong witness cannot displace the exact bound one", async () => {
    const home = await mkdtemp(join(tmpdir(), "brc18-"));
    const o = observed({ inspectedHome: home });
    await writeWitness(home, { schema: WITNESS_RUNTIME_BOUND_SCHEMA, binding: bindingFor(o) }, "witness-aaa-correct.json");
    const wrong = await writeWitness(
      home,
      { schema: WITNESS_RUNTIME_BOUND_SCHEMA, binding: bindingFor(o, { runtime_identity: "node0-imposter" }) },
      "witness-zzz-wrong.json",
    );
    // Make the WRONG one newest. Under mtime selection it would win.
    const future = new Date(Date.now() + 60_000);
    await utimes(wrong, future, future);
    const chosen = await findBoundWitness(home, expectedFor(o));
    assert.ok(chosen, "an exactly bound witness exists and must be found");
    assert.match(chosen, /witness-aaa-correct\.json$/);
  });

  it("BRC19 a fully bound observation and witness can produce eligibility", async () => {
    const home = await mkdtemp(join(tmpdir(), "brc19-"));
    const o = observed({ inspectedHome: home });
    const p = await writeWitness(home, {
      schema: WITNESS_RUNTIME_BOUND_SCHEMA,
      binding: bindingFor(o),
    });
    const v = await verifyWitnessReceipt(p, expectedFor(o));
    assert.equal(v.eligible_for_bridge_clean, true);
    assert.equal(isCleanEligibleObservation(o), true);
  });

  it("BRC20 that convergence is a FIXTURE and promotes no elapsed health claim", () => {
    const o = observed();
    // Eligibility is about one instant. Nothing here carries elapsed time, so
    // no 24h/72h/closure claim can be derived from it.
    assert.equal(o.authority_delta, 0);
    assert.equal(o.activation_performed, false);
    assert.equal("elapsed_ms" in o, false);
    assert.equal("target_met" in o, false);
  });

  it("BRC-binding absent expectation is fail-closed, never permissive", () => {
    const o = observed();
    const r = evaluateWitnessBinding(
      { schema: WITNESS_RUNTIME_BOUND_SCHEMA, attests: { binding: bindingFor(o) } },
      null,
    );
    assert.equal(r.valid, false);
    assert.equal(r.reason, "no_expected_binding_supplied");
  });

  it("BRC-availability never grants activation", () => {
    const o = observed({ raw: { ...HEALTHY_RAW, activation_gate: "BLOCKED" } });
    assert.equal(o.activation_gate, "BLOCKED");
    assert.equal(isCleanEligibleObservation(o), false);
    assert.ok(o.blocked_by.some((b) => b.startsWith("activation_gate_not_explicit_go")));
  });
});
