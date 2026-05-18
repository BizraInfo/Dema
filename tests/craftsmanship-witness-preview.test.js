import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildCraftsmanshipWitnessPreview,
  MASTER_CRAFTSMANSHIP_INVARIANTS,
  CRAFTSMANSHIP_WITNESS_REQUIRED_BLOCKED_EFFECTS,
  CRAFTSMANSHIP_WITNESS_PRIMARY_REFUSALS,
} from "../packages/core/src/craftsmanship-witness-preview.js";
import { isCanonicalBoundary, PREVIEW_BOUNDARY_CANONICAL_KEYS } from "../packages/core/src/preview-boundary.js";

// ─── BASE TESTS (16) ────────────────────────────────────────────────────────

test("CW-01: emits canonical schema bizra.dema.craftsmanship_witness.v0.1", () => {
  const out = buildCraftsmanshipWitnessPreview();
  assert.equal(out.schema, "bizra.dema.craftsmanship_witness.v0.1");
});

test("CW-02: truth_label === NODE0_LOCAL_SEED", () => {
  const out = buildCraftsmanshipWitnessPreview();
  assert.equal(out.truth_label, "NODE0_LOCAL_SEED");
});

test("CW-03: mode === preview_only", () => {
  const out = buildCraftsmanshipWitnessPreview();
  assert.equal(out.mode, "preview_only");
});

test("CW-04: receipt_shape_ready === true", () => {
  const out = buildCraftsmanshipWitnessPreview();
  assert.equal(out.receipt_shape_ready, true);
});

test("CW-05: boundary is canonical 16-key all-false (verified by isCanonicalBoundary)", () => {
  const out = buildCraftsmanshipWitnessPreview();
  assert.equal(isCanonicalBoundary(out.boundary), true);
  assert.equal(Object.keys(out.boundary).length, PREVIEW_BOUNDARY_CANONICAL_KEYS.length);
});

test("CW-06: output is deep-frozen at top level + every sub-view", () => {
  const out = buildCraftsmanshipWitnessPreview();
  assert.equal(Object.isFrozen(out), true);
  assert.equal(Object.isFrozen(out.master_craftsmanship_compliance), true);
  assert.equal(Object.isFrozen(out.rsi_signals), true);
  assert.equal(Object.isFrozen(out.doctrine_health), true);
  assert.equal(Object.isFrozen(out.process_mining_of_self), true);
  assert.equal(Object.isFrozen(out.next_slice_observables), true);
  assert.equal(Object.isFrozen(out.counters), true);
  assert.equal(Object.isFrozen(out.canon_anchors), true);
  assert.equal(Object.isFrozen(out.boundary), true);
});

test("CW-07: all 10 Master Craftsmanship invariants surfaced", () => {
  const out = buildCraftsmanshipWitnessPreview();
  const ids = out.master_craftsmanship_compliance.invariants.map((i) => i.id);
  assert.equal(ids.length, 10, `expected 10 MC invariants · got ${ids.length}`);
  for (const expected of [
    "canon_bound",
    "test_backed",
    "consent_gated",
    "receipt_emitting",
    "doctrine_coherent",
    "boundary_disciplined",
    "adversarial_tested",
    "verify_before_asserting",
    "reversible",
    "cross_referenced",
  ]) {
    assert.ok(ids.includes(expected), `MC invariant ${expected} missing`);
  }
});

test("CW-08: every MC invariant declares self_assertion + evidence_anchor", () => {
  const out = buildCraftsmanshipWitnessPreview();
  for (const inv of out.master_craftsmanship_compliance.invariants) {
    assert.equal(typeof inv.self_assertion, "boolean", `${inv.id} missing self_assertion`);
    assert.equal(typeof inv.evidence_anchor, "string", `${inv.id} missing evidence_anchor`);
    assert.ok(inv.evidence_anchor.length > 0, `${inv.id} empty evidence_anchor`);
  }
});

test("CW-09: every emitted next_slice_observable carries its own consent_phrase_required_to_act", () => {
  const out = buildCraftsmanshipWitnessPreview({
    next_slice_signals: [
      { id: "test-signal", text: "consider adding T-N", evidence: "N=8 preflight pattern" },
    ],
  });
  assert.equal(out.next_slice_observables.length, 1);
  for (const s of out.next_slice_observables) {
    assert.equal(typeof s.consent_phrase_required_to_act, "string");
    assert.ok(
      s.consent_phrase_required_to_act.startsWith("GO: act on craftsmanship-witness suggestion "),
      `consent phrase template violated: ${s.consent_phrase_required_to_act}`,
    );
    assert.equal(s.auto_applied, false, "auto_applied must be structurally false");
  }
});

test("CW-10: rsi_signals declare V/D/A/U claim_state on every entry", () => {
  const out = buildCraftsmanshipWitnessPreview({
    rsi_signal_inputs: [
      { kind: "first_run_green_streak", value: 8, claim_state: "V", evidence: "tests 1420/1420 first-run" },
      { kind: "refusal_density", value: 5, claim_state: "V", evidence: "refusal-as-product N=5" },
    ],
  });
  for (const s of out.rsi_signals) {
    assert.ok(["V", "D", "A", "U"].includes(s.claim_state), `bad claim_state: ${s.claim_state}`);
  }
});

test("CW-11: blocked_effects array includes all required entries", () => {
  const out = buildCraftsmanshipWitnessPreview();
  for (const required of CRAFTSMANSHIP_WITNESS_REQUIRED_BLOCKED_EFFECTS) {
    assert.ok(
      out.blocked_effects.includes(required),
      `blocked_effects missing required entry: ${required}`,
    );
  }
});

test("CW-12: primary_refusals exposes refuse-as-product taxonomy", () => {
  const out = buildCraftsmanshipWitnessPreview();
  assert.deepEqual([...out.primary_refusals], [...CRAFTSMANSHIP_WITNESS_PRIMARY_REFUSALS]);
  assert.ok(out.primary_refusals.length >= 6, "at least 6 named refusals");
});

test("CW-13: doctrine_health surfaces refusal_count + doctrine_catch_count + drift_markers", () => {
  const out = buildCraftsmanshipWitnessPreview({
    doctrine_health_inputs: {
      refusal_events: [{ phrase_refused: "GO 1", reason: "too_short" }],
      doctrine_catches: [{ name: "preferred_name vs name", evidence: "commit 5b2e89e" }],
    },
  });
  assert.equal(typeof out.doctrine_health.refusal_count, "number");
  assert.equal(typeof out.doctrine_health.doctrine_catch_count, "number");
  assert.equal(Array.isArray(out.doctrine_health.drift_markers), true);
});

test("CW-14: process_mining_of_self emits slice-level metrics", () => {
  const out = buildCraftsmanshipWitnessPreview({
    slice_history: {
      commits_in_session: 14,
      tests_total: 1420,
      tests_delta: 58,
      first_run_green_streak: 8,
    },
  });
  assert.equal(out.process_mining_of_self.commits_in_session, 14);
  assert.equal(out.process_mining_of_self.tests_total, 1420);
  assert.equal(out.process_mining_of_self.tests_delta, 58);
  assert.equal(out.process_mining_of_self.first_run_green_streak, 8);
});

test("CW-15: canon_anchors block cites foundational canon", () => {
  const out = buildCraftsmanshipWitnessPreview();
  assert.ok(typeof out.canon_anchors.law_of_assumption === "string");
  assert.ok(typeof out.canon_anchors.adr_005 === "string");
  assert.ok(typeof out.canon_anchors.master_craftsmanship_source === "string");
  assert.ok(out.canon_anchors.law_of_assumption.includes("LAW_OF_ASSUMPTION.md"));
  assert.ok(out.canon_anchors.adr_005.includes("ADR-005"));
});

test("CW-16: counters aggregate correctly across input arrays", () => {
  const out = buildCraftsmanshipWitnessPreview({
    rsi_signal_inputs: [
      { kind: "first_run_green_streak", value: 8, claim_state: "V", evidence: "ev1" },
      { kind: "refusal_density", value: 5, claim_state: "V", evidence: "ev2" },
    ],
    doctrine_health_inputs: {
      refusal_events: [{ phrase_refused: "x", reason: "y" }, { phrase_refused: "z", reason: "w" }],
      doctrine_catches: [{ name: "n1", evidence: "e1" }],
    },
    next_slice_signals: [
      { id: "s1", text: "t1", evidence: "e1" },
      { id: "s2", text: "t2", evidence: "e2" },
    ],
  });
  assert.equal(out.counters.rsi_signals_total, 2);
  assert.equal(out.counters.refusal_events_total, 2);
  assert.equal(out.counters.doctrine_catches_total, 1);
  assert.equal(out.counters.next_slice_observables_total, 2);
  assert.equal(out.counters.master_craftsmanship_invariants_total, 10);
});

// ─── ADVERSARIAL TESTS (16) ─────────────────────────────────────────────────

test("ADV-01: prototype pollution attempt does not leak into output", () => {
  const dirty = { rsi_signal_inputs: [] };
  Object.defineProperty(dirty, "__proto__", { value: { evil: "yes" }, enumerable: true });
  const out = buildCraftsmanshipWitnessPreview(dirty);
  assert.equal("evil" in out, false);
  assert.equal(Object.getPrototypeOf(out), Object.prototype);
});

test("ADV-02: caller cannot inject auto_applied=true on a next_slice_observable", () => {
  const out = buildCraftsmanshipWitnessPreview({
    next_slice_signals: [
      { id: "x", text: "t", evidence: "e", auto_applied: true },
    ],
  });
  assert.equal(out.next_slice_observables[0].auto_applied, false);
});

test("ADV-03: caller cannot suppress canonical boundary by injecting their own", () => {
  const out = buildCraftsmanshipWitnessPreview({
    boundary: { runtime_execution_performed: true, federation_invoked: true },
  });
  assert.equal(isCanonicalBoundary(out.boundary), true);
  assert.equal(out.boundary.runtime_execution_performed, false);
  assert.equal(out.boundary.federation_invoked, false);
});

test("ADV-04: caller cannot inject mode=runtime to bypass preview-only", () => {
  const out = buildCraftsmanshipWitnessPreview({ mode: "runtime_active" });
  assert.equal(out.mode, "preview_only");
});

test("ADV-05: caller cannot inject truth_label=PRODUCTION", () => {
  const out = buildCraftsmanshipWitnessPreview({ truth_label: "PRODUCTION_VERIFIED" });
  assert.equal(out.truth_label, "NODE0_LOCAL_SEED");
});

test("ADV-06: non-array rsi_signal_inputs handled gracefully", () => {
  const out = buildCraftsmanshipWitnessPreview({ rsi_signal_inputs: "not-an-array" });
  assert.deepEqual(Array.from(out.rsi_signals), []);
});

test("ADV-07: rsi signal with invalid claim_state coerced to U (unknown)", () => {
  const out = buildCraftsmanshipWitnessPreview({
    rsi_signal_inputs: [
      { kind: "x", value: 1, claim_state: "INVALID_LABEL", evidence: "e" },
    ],
  });
  assert.equal(out.rsi_signals[0].claim_state, "U");
});

test("ADV-08: function-valued evidence is silently dropped to empty string", () => {
  const out = buildCraftsmanshipWitnessPreview({
    rsi_signal_inputs: [{ kind: "x", value: 1, claim_state: "V", evidence: () => "lol" }],
  });
  assert.equal(typeof out.rsi_signals[0].evidence, "string");
  assert.equal(out.rsi_signals[0].evidence, "");
});

test("ADV-09: symbol-valued kind silently coerced", () => {
  const out = buildCraftsmanshipWitnessPreview({
    rsi_signal_inputs: [{ kind: Symbol("not-string"), value: 1, claim_state: "V", evidence: "e" }],
  });
  assert.equal(typeof out.rsi_signals[0].kind, "string");
  assert.equal(out.rsi_signals[0].kind, "unknown");
});

test("ADV-10: deep mutation of returned output rejected", () => {
  const out = buildCraftsmanshipWitnessPreview();
  assert.throws(() => {
    "use strict";
    out.master_craftsmanship_compliance.invariants[0] = "hijacked";
  });
});

test("ADV-11: caller cannot inject blocked_effects entry that flips structurally", () => {
  const out = buildCraftsmanshipWitnessPreview({
    blocked_effects: ["only_one_lol"],
  });
  for (const required of CRAFTSMANSHIP_WITNESS_REQUIRED_BLOCKED_EFFECTS) {
    assert.ok(
      out.blocked_effects.includes(required),
      `caller bypassed required blocked_effect: ${required}`,
    );
  }
});

test("ADV-12: deterministic: same input → byte-equal JSON", () => {
  const input = {
    rsi_signal_inputs: [
      { kind: "k", value: 1, claim_state: "V", evidence: "e" },
    ],
    slice_history: { commits_in_session: 5, tests_total: 100, tests_delta: 10, first_run_green_streak: 3 },
  };
  const a = JSON.stringify(buildCraftsmanshipWitnessPreview(input));
  const b = JSON.stringify(buildCraftsmanshipWitnessPreview(input));
  assert.equal(a, b);
});

test("ADV-13: nested non-frozen sub-array becomes frozen after build", () => {
  const out = buildCraftsmanshipWitnessPreview({
    rsi_signal_inputs: [
      { kind: "k", value: 1, claim_state: "V", evidence: "e" },
    ],
  });
  assert.equal(Object.isFrozen(out.rsi_signals), true);
  assert.equal(Object.isFrozen(out.rsi_signals[0]), true);
});

test("ADV-14: caller cannot suppress receipt_shape_ready", () => {
  const out = buildCraftsmanshipWitnessPreview({ receipt_shape_ready: false });
  assert.equal(out.receipt_shape_ready, true);
});

test("ADV-15: empty input still produces valid Master Craftsmanship 10-invariant compliance", () => {
  const out = buildCraftsmanshipWitnessPreview();
  assert.equal(out.master_craftsmanship_compliance.invariants.length, 10);
  assert.equal(typeof out.master_craftsmanship_compliance.overall_compliant, "boolean");
});

test("ADV-16: 10000-entry input array does not crash · counters bounded honestly", () => {
  const huge = Array.from({ length: 10000 }, (_, i) => ({
    kind: `kind-${i}`,
    value: i,
    claim_state: "V",
    evidence: `ev-${i}`,
  }));
  const out = buildCraftsmanshipWitnessPreview({ rsi_signal_inputs: huge });
  assert.equal(out.counters.rsi_signals_total, 10000);
  assert.equal(Object.isFrozen(out.rsi_signals), true);
});

// ─── EXPORT/CONSTANTS HEALTH (3) ────────────────────────────────────────────

test("EXPORTS-01: MASTER_CRAFTSMANSHIP_INVARIANTS exported with 10 entries", () => {
  assert.equal(MASTER_CRAFTSMANSHIP_INVARIANTS.length, 10);
  assert.equal(Object.isFrozen(MASTER_CRAFTSMANSHIP_INVARIANTS), true);
});

test("EXPORTS-02: CRAFTSMANSHIP_WITNESS_REQUIRED_BLOCKED_EFFECTS frozen array of strings", () => {
  assert.ok(Array.isArray(CRAFTSMANSHIP_WITNESS_REQUIRED_BLOCKED_EFFECTS));
  assert.equal(Object.isFrozen(CRAFTSMANSHIP_WITNESS_REQUIRED_BLOCKED_EFFECTS), true);
  for (const b of CRAFTSMANSHIP_WITNESS_REQUIRED_BLOCKED_EFFECTS) {
    assert.equal(typeof b, "string");
  }
});

test("EXPORTS-03: CRAFTSMANSHIP_WITNESS_PRIMARY_REFUSALS frozen array of strings · ≥6 entries", () => {
  assert.ok(Array.isArray(CRAFTSMANSHIP_WITNESS_PRIMARY_REFUSALS));
  assert.equal(Object.isFrozen(CRAFTSMANSHIP_WITNESS_PRIMARY_REFUSALS), true);
  assert.ok(CRAFTSMANSHIP_WITNESS_PRIMARY_REFUSALS.length >= 6);
});
