import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  planRewardEligibilityContractPreview,
  buildRewardEligibilityContractPreviewPayload,
  verifyRewardEligibilityContractPreview,
  runRewardEligibilityContractPreview,
  REWARD_ELIGIBILITY_CONTRACT_PREVIEW_SCHEMA,
  REWARD_ELIGIBILITY_CONTRACT_PREVIEW_TRUTH_LABEL,
  REWARD_ELIGIBILITY_CONTRACT_PREVIEW_GO_PHRASE,
} from "../packages/core/src/reward-eligibility-contract-preview.js";
import { runRewardEligibilityContractPreviewCheck } from "../scripts/review/reward-eligibility-contract-preview-check.mjs";

// RED-FIRST: each test encodes part of the REWARD-ELIGIBILITY-CONTRACT-PREVIEW-1A proof contract. They fail until
// the kernel bodies are implemented. Build to green — do not soften the asserts.

const NO_CLAIMS = Object.freeze({
  mint_claim: false,
  wallet_claim: false,
  urp_live_claim: false,
  federation_claim: false,
  public_safe_claim: false,
  authority_delta_nonzero: false,
  cost_called_value: false,
  simulated_impact_as_real: false,
});

const CLEAN_MONITOR = Object.freeze({ critical_count: 0, all_clear: true, weakened_to_hide_drift: false });

// Fixture 1 — the eligible case: a monitor-proven repair loop, evidenced, all-clear.
const FIXTURE_INPUT = {
  outcome: {
    outcome_kind: "monitor_all_clear_after_repair",
    evidence_refs: ["PR#327:af88492", "monitor:sha256:6c05117f", "gate:npm-test-6551"],
    monitor_state: { ...CLEAN_MONITOR },
    claims: { ...NO_CLAIMS },
  },
};

const outcome = (over = {}, claims = {}, ms = {}) => ({
  outcome: {
    outcome_kind: "gates_green",
    evidence_refs: ["evref-1"],
    monitor_state: { ...CLEAN_MONITOR, ...ms },
    claims: { ...NO_CLAIMS, ...claims },
    ...over,
  },
});
const runOf = (inp) => runRewardEligibilityContractPreview({ consent: REWARD_ELIGIBILITY_CONTRACT_PREVIEW_GO_PHRASE, input: inp });

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planRewardEligibilityContractPreview({ consent: "wrong", input: {} });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with exact consent and well-formed input", () => {
  const plan = planRewardEligibilityContractPreview({ consent: REWARD_ELIGIBILITY_CONTRACT_PREVIEW_GO_PHRASE, input: FIXTURE_INPUT });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
});

test("payload is content-addressed and carries an all-false boundary", () => {
  const payload = buildRewardEligibilityContractPreviewPayload(FIXTURE_INPUT);
  assert.equal(payload.schema, REWARD_ELIGIBILITY_CONTRACT_PREVIEW_SCHEMA);
  assert.equal(payload.truth_label, REWARD_ELIGIBILITY_CONTRACT_PREVIEW_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.boundary.execution_allowed, false);
  assert.equal(payload.boundary.live_execution_performed, false);
});

test("verify accepts a freshly built payload", () => {
  const payload = buildRewardEligibilityContractPreviewPayload(FIXTURE_INPUT);
  assert.equal(verifyRewardEligibilityContractPreview(payload).ok, true);
});

test("verify rejects a tampered content_hash", () => {
  const payload = buildRewardEligibilityContractPreviewPayload(FIXTURE_INPUT);
  const tampered = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  assert.equal(verifyRewardEligibilityContractPreview(tampered).ok, false);
});

test("verify rejects a field change that did not update the content_hash", () => {
  // Internal-consistency check: a field changed but the stored hash did not, so
  // recompute-over-body must differ from content_hash.
  //
  // NOTE the harder launder this scaffold does NOT yet defend against: changing a
  // field AND recomputing the hash so the body is self-consistent. Internal
  // consistency alone cannot catch that — you need an INDEPENDENT anchor
  // (a signature over the payload, or an externally measured state hash). When
  // this slice gains one, add a test that forges + recomputes and still expects
  // rejection. Until then, do not claim launder-resistance.
  const payload = buildRewardEligibilityContractPreviewPayload(FIXTURE_INPUT);
  const forged = { ...payload, truth_label: "FORGED" };
  assert.equal(verifyRewardEligibilityContractPreview(forged).ok, false);
});

test("review gate closes the loop: build -> verify -> tamper-reject", () => {
  const result = runRewardEligibilityContractPreviewCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, REWARD_ELIGIBILITY_CONTRACT_PREVIEW_SCHEMA);
  assert.equal(result.truth_label, REWARD_ELIGIBILITY_CONTRACT_PREVIEW_TRUTH_LABEL);
});

test("orchestrator boundary stays all-false (no execution authority)", () => {
  const result = runRewardEligibilityContractPreview({ consent: REWARD_ELIGIBILITY_CONTRACT_PREVIEW_GO_PHRASE, input: FIXTURE_INPUT });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
  assert.equal(result.boundary.live_execution_performed, false);
});

// ── The six operator target fixtures ──────────────────────────────────────

test("F1 eligible: monitor-proven repair loop, evidenced, all-clear after repair", () => {
  const r = runOf(FIXTURE_INPUT);
  assert.equal(r.ok, true, r.blocked_by?.join(", "));
  assert.equal(r.eligibility.eligible, true, r.eligibility.refusal_codes.join(", "));
  assert.deepEqual(r.eligibility.refusal_codes, []);
});

test("F2 ineligible: forged clean verdict (intrinsically bad outcome kind)", () => {
  const r = runOf(outcome({ outcome_kind: "forged_clean_verdict" }));
  assert.equal(r.eligibility.eligible, false);
  assert.ok(r.eligibility.refusal_codes.includes("outcome_intrinsically_ineligible:forged_clean_verdict"));
});

test("F3 ineligible: monitor weakened to hide drift is the dominant negative", () => {
  // Even as a claimed positive outcome with evidence, hiding drift is never eligible.
  const r = runOf(outcome({ outcome_kind: "monitor_all_clear_after_repair" }, {}, { weakened_to_hide_drift: true }));
  assert.equal(r.eligibility.eligible, false);
  assert.ok(r.eligibility.refusal_codes.includes("monitor_weakened_to_hide_drift"));
});

test("F4 ineligible: positive outcome with no evidence refs", () => {
  const r = runOf(outcome({ evidence_refs: [] }));
  assert.equal(r.eligibility.eligible, false);
  assert.ok(r.eligibility.refusal_codes.includes("evidence_refs_missing"));
});

test("F5 ineligible: mint claim and simulated-impact-as-real each refuse", () => {
  const mint = runOf(outcome({}, { mint_claim: true }));
  assert.equal(mint.eligibility.eligible, false);
  assert.ok(mint.eligibility.refusal_codes.includes("mint_claimed"));
  const sim = runOf(outcome({}, { simulated_impact_as_real: true }));
  assert.equal(sim.eligibility.eligible, false);
  assert.ok(sim.eligibility.refusal_codes.includes("simulated_impact_as_real"));
});

test("F6 ineligible: cost measured but called value", () => {
  const r = runOf(outcome({}, { cost_called_value: true }));
  assert.equal(r.eligibility.eligible, false);
  assert.ok(r.eligibility.refusal_codes.includes("cost_called_value"));
});

// ── Invariants: monitor criticals block, coherence, inertness, launder ─────

test("monitor criticals block a positive outcome", () => {
  const r = runOf(outcome({}, {}, { critical_count: 2, all_clear: false }));
  assert.equal(r.eligibility.eligible, false);
  assert.ok(r.eligibility.refusal_codes.includes("monitor_criticals_present"));
});

test("all-clear-after-repair asserting all_clear while monitor is not clear is incoherent", () => {
  const r = runOf(outcome({ outcome_kind: "monitor_all_clear_after_repair" }, {}, { all_clear: false }));
  assert.equal(r.eligibility.eligible, false);
  assert.ok(r.eligibility.refusal_codes.includes("outcome_monitor_state_incoherent"));
});

test("the verdict is inert: no score, no actuation signal, no permission, no authority", () => {
  const r = runOf(FIXTURE_INPUT);
  assert.equal(r.eligibility.is_score, false);
  assert.equal(r.eligibility.is_actuation_signal, false);
  assert.equal(r.eligibility.confers_permission, false);
  assert.equal(r.eligibility.authority_delta, 0);
  assert.equal(r.eligibility.mint_allowed, false);
  assert.equal(r.eligibility.cost_is_not_value, true);
  assert.equal(r.eligibility.simulated_is_not_real, true);
});

test("verify rejects a forged eligible verdict: ineligible flipped to eligible AND hash recomputed", () => {
  // Take a genuinely ineligible outcome, forge it eligible with a clean hash.
  const payload = buildRewardEligibilityContractPreviewPayload(outcome({ outcome_kind: "forged_clean_verdict" }));
  const forged = { ...payload.eligibility, eligible: true, refusal_codes: [] };
  const { content_hash: _drop, ...body } = { ...payload, eligibility: forged };
  const laundered = verifyRewardEligibilityContractPreview({ ...body, content_hash: rehash(body) });
  assert.equal(laundered.ok, false);
  assert.ok(laundered.blocked_by.includes("eligibility_not_rederivable"));
});

test("verify rejects an inertness breach: is_actuation_signal flipped true with recomputed hash", () => {
  const payload = buildRewardEligibilityContractPreviewPayload(FIXTURE_INPUT);
  const breached = { ...payload.eligibility, is_actuation_signal: true };
  const { content_hash: _drop, ...body } = { ...payload, eligibility: breached };
  const laundered = verifyRewardEligibilityContractPreview({ ...body, content_hash: rehash(body) });
  assert.equal(laundered.ok, false);
  // Re-derivation catches it first; the inertness guard is the backstop.
  assert.ok(
    laundered.blocked_by.includes("eligibility_not_rederivable") ||
      laundered.blocked_by.includes("verdict_is_actuation_signal"),
  );
});

test("plan refuses malformed outcomes (missing claim flags, bad monitor state)", () => {
  const badClaims = { outcome: { outcome_kind: "gates_green", evidence_refs: ["x"], monitor_state: { ...CLEAN_MONITOR }, claims: { mint_claim: false } } };
  const p1 = planRewardEligibilityContractPreview({ consent: REWARD_ELIGIBILITY_CONTRACT_PREVIEW_GO_PHRASE, input: badClaims });
  assert.equal(p1.eligible, false);
  assert.ok(p1.blocked_by.includes("claims_invalid"));
  const badMs = { outcome: { outcome_kind: "gates_green", evidence_refs: ["x"], monitor_state: { critical_count: -1, all_clear: true, weakened_to_hide_drift: false }, claims: { ...NO_CLAIMS } } };
  const p2 = planRewardEligibilityContractPreview({ consent: REWARD_ELIGIBILITY_CONTRACT_PREVIEW_GO_PHRASE, input: badMs });
  assert.equal(p2.eligible, false);
  assert.ok(p2.blocked_by.includes("monitor_state_invalid"));
});

test("determinism: same outcome, same content hash", () => {
  const a = buildRewardEligibilityContractPreviewPayload(FIXTURE_INPUT);
  const b = buildRewardEligibilityContractPreviewPayload(FIXTURE_INPUT);
  assert.equal(a.content_hash, b.content_hash);
});

// Recompute a content hash the same way the kernel does, for launder fixtures.
function rehash(body) {
  const stable = (v) => {
    if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
    if (v && typeof v === "object") {
      return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
    }
    return JSON.stringify(v);
  };
  return `sha256:${createHash("sha256").update(stable(body), "utf8").digest("hex")}`;
}
