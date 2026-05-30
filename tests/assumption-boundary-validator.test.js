// ASSUMPTION-GATE-1A · Law of Assumption boundary validator tests
//
// Makes docs/canon/LAW_OF_ASSUMPTION.md executable as a structural gate.
// The canon's claim is: every claim/act/proposal carries exactly one
// V/D/A/U label, and an A (Assumed-with-Iḥsān) claim must declare the
// non-negotiable shape (assumption X · ground Y · boundary Z · rejectable).
// A claim without a V/D/A/U label is a doctrine violation.
//
// This gate is STRUCTURAL, not semantic — it checks that the envelope
// *declares* its epistemic ground, not whether the ground is true. That
// is exactly why it is deterministically re-derivable (Level-B-compatible),
// unlike the Ihsān excellence floor which bottoms out in model judgment.
//
// Canon reference: docs/canon/LAW_OF_ASSUMPTION.md §"V/D/A/U" + §"shape of
// assumption-with-Iḥsān (non-negotiable)".
//
// SCOPE (this slice): pure deterministic validator only. No CLI, no I/O,
// no Date.now, no Math.random, no model call, no network, no key material,
// no token/PoI/economy/federation. Fail-closed.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  validateAssumptionBoundary,
  CLAIM_STATES,
  ASSUMPTION_VALIDATOR_SCHEMA,
} from "../packages/receipts/src/assumption-boundary-validator.js";

describe("ASSUMPTION-GATE-1A · validateAssumptionBoundary", () => {
  // ---- happy paths: each canonical claim-state ----

  it("V · verified with evidence_refs → valid", () => {
    const r = validateAssumptionBoundary({
      claim_state: "V",
      evidence_refs: ["packages/receipts/src/consent-proof.js:31"],
    });
    assert.equal(r.valid, true);
    assert.equal(r.claim_state, "V");
  });

  it("D · derived with derivation chain → valid", () => {
    const r = validateAssumptionBoundary({
      claim_state: "D",
      derived_from: ["V1", "V2"],
    });
    assert.equal(r.valid, true);
  });

  it("A · assumed-with-Iḥsān full shape (no mutation) → valid", () => {
    const r = validateAssumptionBoundary({
      claim_state: "A",
      assumption: "The candidate node runs Node 20+.",
      ground: "Install doc states Node 20 minimum; not yet probed on disk.",
      boundary: "Fails if the operator's runtime reports <20 at boot.",
      rejectable: true,
    });
    assert.equal(r.valid, true);
    assert.equal(r.claim_state, "A");
  });

  it("U · unknown (no mutation) → valid; the label is the deliverable", () => {
    const r = validateAssumptionBoundary({ claim_state: "U" });
    assert.equal(r.valid, true);
    assert.equal(r.claim_state, "U");
  });

  // ---- fail-closed: envelope shape ----

  it("null envelope → envelope_invalid", () => {
    const r = validateAssumptionBoundary(null);
    assert.equal(r.valid, false);
    assert.equal(r.error, "envelope_invalid");
  });

  it("array envelope → envelope_invalid", () => {
    const r = validateAssumptionBoundary(["A"]);
    assert.equal(r.valid, false);
    assert.equal(r.error, "envelope_invalid");
  });

  // ---- fail-closed: V/D/A/U label discipline ----

  it("missing claim_state → claim_state_missing (doctrine violation)", () => {
    const r = validateAssumptionBoundary({ evidence_refs: ["x:1"] });
    assert.equal(r.valid, false);
    assert.equal(r.error, "claim_state_missing");
  });

  it("invalid claim_state → claim_state_invalid", () => {
    const r = validateAssumptionBoundary({ claim_state: "X" });
    assert.equal(r.valid, false);
    assert.equal(r.error, "claim_state_invalid");
  });

  // ---- fail-closed: per-state shape ----

  it("V without evidence pointer → unsupported_certainty", () => {
    const r = validateAssumptionBoundary({ claim_state: "V" });
    assert.equal(r.valid, false);
    assert.equal(r.error, "unsupported_certainty");
  });

  it("V with empty-string evidence ref → unsupported_certainty", () => {
    const r = validateAssumptionBoundary({
      claim_state: "V",
      evidence_refs: ["   "],
    });
    assert.equal(r.valid, false);
    assert.equal(r.error, "unsupported_certainty");
  });

  // REMEDIATION-0 #3 · a single valid entry must NOT launder a malformed array
  it("V with a partially-malformed evidence array (valid + null) → unsupported_certainty", () => {
    const r = validateAssumptionBoundary({
      claim_state: "V",
      evidence_refs: ["packages/x.js:1", null],
    });
    assert.equal(r.valid, false);
    assert.equal(r.error, "unsupported_certainty");
  });

  it("V with a valid + empty-string evidence entry → unsupported_certainty", () => {
    const r = validateAssumptionBoundary({
      claim_state: "V",
      evidence_refs: ["ok", "   "],
    });
    assert.equal(r.valid, false);
    assert.equal(r.error, "unsupported_certainty");
  });

  it("D with a non-string entry in the derivation chain → derivation_chain_missing", () => {
    const r = validateAssumptionBoundary({
      claim_state: "D",
      derived_from: ["V1", 42],
    });
    assert.equal(r.valid, false);
    assert.equal(r.error, "derivation_chain_missing");
  });

  it("D without derivation chain → derivation_chain_missing", () => {
    const r = validateAssumptionBoundary({ claim_state: "D" });
    assert.equal(r.valid, false);
    assert.equal(r.error, "derivation_chain_missing");
  });

  it("A missing assumption statement → assumption_statement_missing", () => {
    const r = validateAssumptionBoundary({
      claim_state: "A",
      ground: "y",
      boundary: "z",
      rejectable: true,
    });
    assert.equal(r.valid, false);
    assert.equal(r.error, "assumption_statement_missing");
  });

  it("A missing ground → assumption_ground_missing", () => {
    const r = validateAssumptionBoundary({
      claim_state: "A",
      assumption: "x",
      boundary: "z",
      rejectable: true,
    });
    assert.equal(r.valid, false);
    assert.equal(r.error, "assumption_ground_missing");
  });

  it("A missing boundary → assumption_boundary_missing", () => {
    const r = validateAssumptionBoundary({
      claim_state: "A",
      assumption: "x",
      ground: "y",
      rejectable: true,
    });
    assert.equal(r.valid, false);
    assert.equal(r.error, "assumption_boundary_missing");
  });

  it("A not rejectable → assumption_not_rejectable", () => {
    const r = validateAssumptionBoundary({
      claim_state: "A",
      assumption: "x",
      ground: "y",
      boundary: "z",
      rejectable: false,
    });
    assert.equal(r.valid, false);
    assert.equal(r.error, "assumption_not_rejectable");
  });

  // ---- fail-closed: mutation + risk gates ----

  it("high-risk mutation under assumption without operator ack → high_risk_uncertainty_not_acknowledged", () => {
    const r = validateAssumptionBoundary({
      claim_state: "A",
      assumption: "x",
      ground: "y",
      boundary: "z",
      rejectable: true,
      mutation: true,
      risk: "high",
    });
    assert.equal(r.valid, false);
    assert.equal(r.error, "high_risk_uncertainty_not_acknowledged");
  });

  it("high-risk mutation under assumption WITH operator ack → valid", () => {
    const r = validateAssumptionBoundary({
      claim_state: "A",
      assumption: "x",
      ground: "y",
      boundary: "z",
      rejectable: true,
      mutation: true,
      risk: "high",
      operator_acknowledged: true,
    });
    assert.equal(r.valid, true);
  });

  it("U claim attached to a mutation → unknown_claim_cannot_mutate (act does not happen)", () => {
    const r = validateAssumptionBoundary({
      claim_state: "U",
      mutation: true,
    });
    assert.equal(r.valid, false);
    assert.equal(r.error, "unknown_claim_cannot_mutate");
  });

  // ---- fail-closed: public/canonical audience ----

  it("public claim with assumption but no boundary → assumption_boundary_missing", () => {
    const r = validateAssumptionBoundary({
      claim_state: "A",
      audience: "public",
      assumption: "x",
      ground: "y",
      rejectable: true,
    });
    assert.equal(r.valid, false);
    assert.equal(r.error, "assumption_boundary_missing");
  });

  it("public claim labeled U → public_claim_unverified", () => {
    const r = validateAssumptionBoundary({
      claim_state: "U",
      audience: "public",
    });
    assert.equal(r.valid, false);
    assert.equal(r.error, "public_claim_unverified");
  });

  // ---- determinism, frozen, boundary cleanliness ----

  it("deterministic: same envelope twice → deep-equal result", () => {
    const envelope = {
      claim_state: "A",
      assumption: "x",
      ground: "y",
      boundary: "z",
      rejectable: true,
    };
    assert.deepEqual(
      validateAssumptionBoundary(envelope),
      validateAssumptionBoundary(envelope),
    );
  });

  it("result is frozen", () => {
    const r = validateAssumptionBoundary({ claim_state: "U" });
    assert.ok(Object.isFrozen(r));
  });

  it("result carries no key / token / network / mutation fields", () => {
    const r = validateAssumptionBoundary({
      claim_state: "A",
      assumption: "x",
      ground: "y",
      boundary: "z",
      rejectable: true,
    });
    const s = JSON.stringify(r);
    assert.ok(!s.includes("PRIVATE KEY"));
    assert.ok(!/token|federation|network|private_key/i.test(s));
  });

  it("exports canonical V/D/A/U claim states + schema id", () => {
    assert.deepEqual([...CLAIM_STATES].sort(), ["A", "D", "U", "V"]);
    assert.equal(
      ASSUMPTION_VALIDATOR_SCHEMA,
      "bizra.dema.assumption_boundary_validator.v0.1",
    );
  });
});
