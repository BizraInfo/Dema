import test from "node:test";
import assert from "node:assert/strict";

import {
  planDemaSkilloptEditLedgerPreview,
  buildDemaSkilloptEditLedgerPreviewPayload,
  verifyDemaSkilloptEditLedgerPreview,
  runDemaSkilloptEditLedgerPreview,
  DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_SCHEMA,
  DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_TRUTH_LABEL,
  DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_GO_PHRASE,
} from "../packages/core/src/dema-skillopt-edit-ledger-preview.js";
import { runDemaSkilloptEditLedgerPreviewCheck } from "../scripts/review/dema-skillopt-edit-ledger-preview-check.mjs";

const GO = DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_GO_PHRASE;

// An accepted edit attempt: bounded `replace`, cites held-out validation refs,
// zero authority delta, boundary/consent/honesty surfaces all unchanged.
const ACCEPTED_FIXTURE = {
  skill_id: "skill.dema.example-router",
  skill_version: "v0.3",
  base_skill_hash: `sha256:${"a".repeat(64)}`,
  candidate_skill_hash: `sha256:${"b".repeat(64)}`,
  edit_type: "replace",
  edit_budget: 200,
  training_rollout_refs: ["receipt:rollout-1", "receipt:rollout-2"],
  heldout_validation_refs: ["receipt:heldout-1"],
  score_before: 0.61,
  score_after: 0.72,
  accepted: true,
  rejected_edit_reason: null,
  authority_delta: 0,
  boundary_unchanged: true,
  consent_unchanged: true,
  current_limits_unchanged: true,
};

// A rejected edit attempt: rejection needs a stated reason, NOT held-out refs
// (a rejected edit may have been rejected precisely because held-out validation
// was absent or did not improve).
const REJECTED_FIXTURE = {
  ...ACCEPTED_FIXTURE,
  edit_type: "add",
  candidate_skill_hash: `sha256:${"c".repeat(64)}`,
  heldout_validation_refs: [],
  score_after: 0.60,
  accepted: false,
  rejected_edit_reason: "heldout_validation_absent",
};

// --- scaffold contract tests (generic proof loop) ---

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planDemaSkilloptEditLedgerPreview({ consent: "wrong", input: ACCEPTED_FIXTURE });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with exact consent and well-formed input", () => {
  const plan = planDemaSkilloptEditLedgerPreview({ consent: GO, input: ACCEPTED_FIXTURE });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
});

test("payload is content-addressed and carries an all-false boundary", () => {
  const payload = buildDemaSkilloptEditLedgerPreviewPayload(ACCEPTED_FIXTURE);
  assert.equal(payload.schema, DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_SCHEMA);
  assert.equal(payload.truth_label, DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.boundary.execution_allowed, false);
  assert.equal(payload.boundary.live_execution_performed, false);
  assert.equal(payload.boundary.model_invocation_performed, false);
});

test("verify accepts a freshly built payload", () => {
  const payload = buildDemaSkilloptEditLedgerPreviewPayload(ACCEPTED_FIXTURE);
  assert.equal(verifyDemaSkilloptEditLedgerPreview(payload).ok, true);
});

test("verify rejects a tampered content_hash", () => {
  const payload = buildDemaSkilloptEditLedgerPreviewPayload(ACCEPTED_FIXTURE);
  const tampered = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  assert.equal(verifyDemaSkilloptEditLedgerPreview(tampered).ok, false);
});

test("verify rejects a field change that did not update the content_hash", () => {
  const payload = buildDemaSkilloptEditLedgerPreviewPayload(ACCEPTED_FIXTURE);
  const forged = { ...payload, truth_label: "FORGED" };
  assert.equal(verifyDemaSkilloptEditLedgerPreview(forged).ok, false);
});

test("verify re-checks entry invariants: an authority-expanding payload fails closed", () => {
  // Forge authority_delta AND recompute nothing — even if a caller re-hashed the
  // body to make it self-consistent, the entry invariant still rejects it.
  const bad = buildDemaSkilloptEditLedgerPreviewPayload({ ...ACCEPTED_FIXTURE, authority_delta: 1 });
  const v = verifyDemaSkilloptEditLedgerPreview(bad);
  assert.equal(v.ok, false);
  assert.ok(v.reasons.includes("authority_delta_nonzero"));
});

test("review gate closes the loop: build -> verify -> tamper-reject", () => {
  const result = runDemaSkilloptEditLedgerPreviewCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_SCHEMA);
  assert.equal(result.truth_label, DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_TRUTH_LABEL);
});

test("orchestrator boundary stays all-false (no execution authority)", () => {
  const result = runDemaSkilloptEditLedgerPreview({ consent: GO, input: ACCEPTED_FIXTURE });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
  assert.equal(result.boundary.live_execution_performed, false);
});

// --- slice proof contract (DEMA-SKILLOPT-EDIT-LEDGER-PREVIEW-1A) ---

test("accepts a valid rejected-edit receipt (reason, no held-out refs required)", () => {
  const result = runDemaSkilloptEditLedgerPreview({ consent: GO, input: REJECTED_FIXTURE });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
});

test("accepts an accepted-edit receipt only when it cites held-out validation refs", () => {
  const good = runDemaSkilloptEditLedgerPreview({ consent: GO, input: ACCEPTED_FIXTURE });
  assert.equal(good.ok, true, good.blocked_by?.join(", "));
});

test("rejects authority_delta > 0 (authority may not self-expand)", () => {
  const bad = runDemaSkilloptEditLedgerPreview({ consent: GO, input: { ...ACCEPTED_FIXTURE, authority_delta: 1 } });
  assert.equal(bad.ok, false);
  assert.ok(bad.blocked_by.includes("authority_delta_nonzero"));
});

test("rejects boundary_unchanged: false", () => {
  const bad = runDemaSkilloptEditLedgerPreview({ consent: GO, input: { ...ACCEPTED_FIXTURE, boundary_unchanged: false } });
  assert.equal(bad.ok, false);
  assert.ok(bad.blocked_by.includes("boundary_changed"));
});

test("rejects consent_unchanged: false", () => {
  const bad = runDemaSkilloptEditLedgerPreview({ consent: GO, input: { ...ACCEPTED_FIXTURE, consent_unchanged: false } });
  assert.equal(bad.ok, false);
  assert.ok(bad.blocked_by.includes("consent_changed"));
});

test("rejects current_limits_unchanged: false", () => {
  const bad = runDemaSkilloptEditLedgerPreview({ consent: GO, input: { ...ACCEPTED_FIXTURE, current_limits_unchanged: false } });
  assert.equal(bad.ok, false);
  assert.ok(bad.blocked_by.includes("current_limits_changed"));
});

test("rejects an accepted edit with missing held-out validation", () => {
  const bad = runDemaSkilloptEditLedgerPreview({ consent: GO, input: { ...ACCEPTED_FIXTURE, heldout_validation_refs: [] } });
  assert.equal(bad.ok, false);
  assert.ok(bad.blocked_by.includes("accepted_without_heldout_validation"));
});

test("produces a stable, deterministic receipt hash", () => {
  const a = buildDemaSkilloptEditLedgerPreviewPayload(ACCEPTED_FIXTURE);
  const b = buildDemaSkilloptEditLedgerPreviewPayload({ ...ACCEPTED_FIXTURE });
  assert.equal(a.receipt_hash, b.receipt_hash);
  assert.equal(a.receipt_hash, a.content_hash);
  assert.match(a.receipt_hash, /^sha256:[0-9a-f]{64}$/);
});

// --- positive-validation coverage: each malformed field rejects with its own block ---

test("each malformed field is rejected with its own named block", () => {
  const cases = [
    [{ skill_id: "" }, "skill_id_invalid"],
    [{ skill_version: 3 }, "skill_version_invalid"],
    [{ base_skill_hash: "nope" }, "base_skill_hash_invalid"],
    [{ candidate_skill_hash: "sha256:xyz" }, "candidate_skill_hash_invalid"],
    [{ edit_type: "rewrite" }, "edit_type_invalid"],
    [{ edit_budget: -5 }, "edit_budget_invalid"],
    [{ training_rollout_refs: "not-array" }, "training_rollout_refs_invalid"],
    [{ heldout_validation_refs: [1] }, "heldout_validation_refs_invalid"],
    [{ score_before: "high" }, "score_before_invalid"],
    [{ score_after: NaN }, "score_after_invalid"],
    [{ accepted: "yes" }, "accepted_invalid"],
    [{ accepted: false, rejected_edit_reason: null, heldout_validation_refs: [] }, "rejected_without_reason"],
  ];
  for (const [mut, code] of cases) {
    const plan = planDemaSkilloptEditLedgerPreview({ consent: GO, input: { ...ACCEPTED_FIXTURE, ...mut } });
    assert.equal(plan.eligible, false, `${code}: expected block`);
    assert.ok(plan.blocked_by.includes(code), `expected ${code}, got [${plan.blocked_by.join(", ")}]`);
  }
});

test("verify rejects a non-object payload and a mismatched receipt_hash", () => {
  assert.equal(verifyDemaSkilloptEditLedgerPreview(null).ok, false);
  assert.equal(verifyDemaSkilloptEditLedgerPreview("nope").ok, false);
  const payload = buildDemaSkilloptEditLedgerPreviewPayload(ACCEPTED_FIXTURE);
  const desynced = { ...payload, receipt_hash: `sha256:${"0".repeat(64)}` };
  const v = verifyDemaSkilloptEditLedgerPreview(desynced);
  assert.equal(v.ok, false);
  assert.ok(v.reasons.includes("receipt_hash_mismatch"));
});

test("plan blocks a null / non-object input as input_not_object", () => {
  const plan = planDemaSkilloptEditLedgerPreview({ consent: GO, input: null });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("input_not_object"));
});

test("buildPayload normalizes missing ref arrays to [] and still hashes", () => {
  const payload = buildDemaSkilloptEditLedgerPreviewPayload({
    ...ACCEPTED_FIXTURE,
    training_rollout_refs: undefined,
    heldout_validation_refs: undefined,
  });
  assert.deepEqual(payload.ledger_entry.training_rollout_refs, []);
  assert.deepEqual(payload.ledger_entry.heldout_validation_refs, []);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
});
