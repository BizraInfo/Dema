import test from "node:test";
import assert from "node:assert/strict";

import {
  planDemaActiveWorkloopComposerPreview,
  buildDemaActiveWorkloopComposerPreviewPayload,
  verifyDemaActiveWorkloopComposerPreview,
  runDemaActiveWorkloopComposerPreview,
  computeActiveWorkloopContentHash,
  deriveActiveWorkloopState,
  DEMA_ACTIVE_WORKLOOP_CANONICAL_FIXTURE,
  DEMA_ACTIVE_WORKLOOP_MALICIOUS_FIXTURE,
  DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_SCHEMA,
  DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_GO_PHRASE,
} from "../packages/core/src/dema-active-workloop-composer-preview.js";
import { runDemaActiveWorkloopComposerPreviewCheck } from "../scripts/review/dema-active-workloop-composer-preview-check.mjs";
import { REQUIRED_CAPABILITY_IDS } from "../packages/core/src/dema-capability-truth-registry.js";

const GO = DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_GO_PHRASE;
const clone = (v) => JSON.parse(JSON.stringify(v));
const run = (input, consent = GO) => runDemaActiveWorkloopComposerPreview({ consent, input });

// 1. happy path: pain/goal composes into mission + a safe bounded task proposal
test("1 happy path: composes a safe run-envelope from goal + mission + task", () => {
  const r = run(DEMA_ACTIVE_WORKLOOP_CANONICAL_FIXTURE);
  assert.equal(r.ok, true, (r.blocked_by || []).join(", "));
  assert.equal(r.operator_goal, "organize my BIZRA workspace");
  assert.equal(r.mission_ref.ref_id, "mission:workspace-triage");
  assert.equal(r.proposed_task_ref.ref_id, "task:triage-report");
  assert.equal(r.allowed_next_action, "run_safe_task");
  assert.match(r.content_hash, /^sha256:[0-9a-f]{64}$/);
});

// 2. missing NodeSpace boundary blocks
test("2 missing NodeSpace boundary blocks", () => {
  const input = clone(DEMA_ACTIVE_WORKLOOP_CANONICAL_FIXTURE);
  delete input.boundary_ref;
  const r = run(input);
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("boundary_missing"));
});

// 3. missing consent blocks
test("3 missing consent blocks", () => {
  const r = run(DEMA_ACTIVE_WORKLOOP_CANONICAL_FIXTURE, "wrong");
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("consent_phrase_mismatch"));
});

// 4. monitor critical blocks
test("4 monitor critical blocks (stop_blocked)", () => {
  const r = run(DEMA_ACTIVE_WORKLOOP_MALICIOUS_FIXTURE);
  assert.equal(r.ok, false);
  assert.equal(r.proceed_allowed, false);
  assert.equal(r.allowed_next_action, "stop_blocked");
  assert.ok(r.blocked_by.includes("monitor_critical"));
});

// 5. irreversible file action blocks
test("5 irreversible file action blocks", () => {
  const input = clone(DEMA_ACTIVE_WORKLOOP_CANONICAL_FIXTURE);
  input.proposed_task.irreversible = true;
  input.proposed_task.file_action = true;
  const r = run(input);
  assert.equal(r.proceed_allowed, false);
  assert.equal(r.allowed_next_action, "stop_blocked");
  assert.ok(r.blocked_by.includes("irreversible_file_action"));
});

// 6. task autonomy L3+ requires approval (not auto-run, but not a hard block)
test("6 L3+ task requires approval", () => {
  const input = clone(DEMA_ACTIVE_WORKLOOP_CANONICAL_FIXTURE);
  input.proposed_task.autonomy_level = "L4";
  const r = run(input);
  assert.equal(r.requires_approval, true);
  assert.equal(r.allowed_next_action, "await_approval");
  assert.equal(r.proceed_allowed, true);
});

// 7. absence-queue candidate created when operator absent with unfinished work
test("7 absent operator with unfinished work yields an absence-queue candidate", () => {
  const input = clone(DEMA_ACTIVE_WORKLOOP_CANONICAL_FIXTURE);
  input.operator_present = false;
  input.unfinished = true;
  const r = run(input);
  assert.equal(r.allowed_next_action, "queue_for_absence");
  assert.ok(r.absence_queue_candidate_ref && r.absence_queue_candidate_ref.ref_id.startsWith("absence-queue-candidate:"));
});

// 8. return-review candidate created when the operator returns
test("8 returning operator yields a return-review candidate", () => {
  const input = clone(DEMA_ACTIVE_WORKLOOP_CANONICAL_FIXTURE);
  input.returning = true;
  const r = run(input);
  assert.equal(r.allowed_next_action, "return_review");
  assert.ok(r.return_review_ref && r.return_review_ref.ref_id.startsWith("return-review-candidate:"));
});

// 9-14. boundary is all-false: no execution / daemon / network / file-mutation /
// URP write / mint.
test("9-14 boundary is all-false (no execution/daemon/network/file/URP/mint)", () => {
  const r = run(DEMA_ACTIVE_WORKLOOP_CANONICAL_FIXTURE);
  assert.equal(r.boundary.execution_performed, false); // 9
  assert.equal(r.boundary.arbitrary_task_executed, false);
  assert.equal(r.boundary.daemon_started, false); // 10
  assert.equal(r.boundary.network_used, false); // 11
  assert.equal(r.boundary.file_mutation_performed, false); // 12
  assert.equal(r.boundary.urp_write_performed, false); // 13
  assert.equal(r.boundary.token_minted, false); // 14
  assert.equal(r.authority_delta, 0);
});

// 15. deterministic workloop hash
test("15 deterministic workloop hash", () => {
  const a = buildDemaActiveWorkloopComposerPreviewPayload(DEMA_ACTIVE_WORKLOOP_CANONICAL_FIXTURE);
  const b = buildDemaActiveWorkloopComposerPreviewPayload(DEMA_ACTIVE_WORKLOOP_CANONICAL_FIXTURE);
  assert.equal(a.workloop_hash, b.workloop_hash);
  assert.equal(a.content_hash, a.workloop_hash);
  assert.match(a.workloop_hash, /^sha256:[0-9a-f]{64}$/);
});

// 16. forged conclusion rejected by re-derivation (recomputed hash does not help)
test("16 forged next-action with recomputed hash rejected by re-derivation", () => {
  // Start from a monitor-critical (true state: stop_blocked) payload.
  const p = buildDemaActiveWorkloopComposerPreviewPayload(DEMA_ACTIVE_WORKLOOP_MALICIOUS_FIXTURE);
  const forgedCore = {
    schema: p.schema, truth_label: p.truth_label, mode: p.mode, workloop_id: p.workloop_id,
    operator_goal: p.operator_goal, operator_present: p.operator_present, unfinished: p.unfinished,
    returning: p.returning, pain_goal_ref: p.pain_goal_ref, mission_ref: p.mission_ref,
    boundary_ref: p.boundary_ref, homebase_state_ref: p.homebase_state_ref,
    proposed_task_ref: p.proposed_task_ref, receipt_preview_ref: p.receipt_preview_ref,
    monitor_status_ref: p.monitor_status_ref, required_consent: p.required_consent,
    requires_approval: p.requires_approval, allowed_next_action: "run_safe_task", // the lie
    absence_queue_candidate_ref: p.absence_queue_candidate_ref, return_review_ref: p.return_review_ref,
    blocked_by: [], authority_delta: p.authority_delta, boundary: p.boundary,
  };
  const forgedHash = computeActiveWorkloopContentHash(forgedCore);
  const forged = { ...forgedCore, content_hash: forgedHash, workloop_hash: forgedHash };
  assert.equal(computeActiveWorkloopContentHash(forged), forgedHash); // internally consistent
  const v = verifyDemaActiveWorkloopComposerPreview(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("allowed_next_action_not_rederivable"));
  assert.ok(v.blocked_by.includes("blocked_by_not_rederivable"));
});

// 17. review gate: clean fixture proceeds, monitor-critical fixture is stopped
test("17 review gate passes clean fixture and stops the critical fixture", () => {
  const result = runDemaActiveWorkloopComposerPreviewCheck();
  assert.equal(result.ok, true, (result.blocked_by || []).join(", "));
  assert.equal(result.clean_next_action, "run_safe_task");
  assert.equal(result.malicious_next_action, "stop_blocked");
});

// 18. capability id registered and bound to a passing gate
test("18 capability row registered and bound to a passing gate", () => {
  assert.ok(REQUIRED_CAPABILITY_IDS.includes("DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_1A"));
  assert.equal(runDemaActiveWorkloopComposerPreviewCheck().ok, true);
});

// ---------------------------------------------------------------------------
// Branch-coverage completions.
// ---------------------------------------------------------------------------

function planBlocks(mutate) {
  const input = clone(DEMA_ACTIVE_WORKLOOP_CANONICAL_FIXTURE);
  mutate(input);
  return planDemaActiveWorkloopComposerPreview({ consent: GO, input }).blocked_by;
}

test("cov: non-object input fail-closed", () => {
  assert.ok(planDemaActiveWorkloopComposerPreview({ consent: GO, input: 5 }).blocked_by.includes("input_not_object"));
});

test("cov: structural fields fail-closed", () => {
  assert.ok(planBlocks((i) => { i.operator_goal = ""; }).includes("operator_goal_missing"));
  assert.ok(planBlocks((i) => { i.operator_present = "yes"; }).includes("operator_present_invalid"));
  assert.ok(planBlocks((i) => { i.unfinished = 1; }).includes("unfinished_invalid"));
  assert.ok(planBlocks((i) => { i.returning = null; }).includes("returning_invalid"));
  assert.ok(planBlocks((i) => { delete i.pain_goal_ref; }).includes("pain_goal_ref_missing"));
  assert.ok(planBlocks((i) => { delete i.mission_ref; }).includes("mission_ref_missing"));
  assert.ok(planBlocks((i) => { delete i.homebase_state_ref; }).includes("homebase_state_ref_missing"));
  assert.ok(planBlocks((i) => { delete i.receipt_preview_ref; }).includes("receipt_preview_missing"));
  assert.ok(planBlocks((i) => { i.monitor_status = {}; }).includes("monitor_status_invalid"));
  assert.ok(planBlocks((i) => { delete i.proposed_task; }).includes("proposed_task_invalid"));
  assert.ok(planBlocks((i) => { i.proposed_task.autonomy_level = "L9"; }).includes("proposed_task_invalid"));
});

test("cov: verify rejects non-object, malformed hash, tampered hash", () => {
  assert.equal(verifyDemaActiveWorkloopComposerPreview(null).ok, false);
  const p = buildDemaActiveWorkloopComposerPreviewPayload(DEMA_ACTIVE_WORKLOOP_CANONICAL_FIXTURE);
  assert.ok(verifyDemaActiveWorkloopComposerPreview({ ...p, content_hash: "nope" }).blocked_by.includes("content_hash_malformed"));
  assert.ok(verifyDemaActiveWorkloopComposerPreview({ ...p, content_hash: `sha256:${"0".repeat(64)}` }).blocked_by.includes("content_hash_mismatch"));
});

test("cov: verify rejects boundary/authority/mode/consent/hash-alias deviations", () => {
  const p = buildDemaActiveWorkloopComposerPreviewPayload(DEMA_ACTIVE_WORKLOOP_CANONICAL_FIXTURE);
  assert.ok(verifyDemaActiveWorkloopComposerPreview({ ...p, boundary: { ...p.boundary, network_used: true } }).blocked_by.includes("boundary_not_all_false"));
  assert.ok(verifyDemaActiveWorkloopComposerPreview({ ...p, authority_delta: 2 }).blocked_by.includes("authority_delta_nonzero"));
  assert.ok(verifyDemaActiveWorkloopComposerPreview({ ...p, mode: "live" }).blocked_by.includes("mode_invalid"));
  assert.ok(verifyDemaActiveWorkloopComposerPreview({ ...p, required_consent: "x" }).blocked_by.includes("required_consent_invalid"));
  assert.ok(verifyDemaActiveWorkloopComposerPreview({ ...p, workloop_hash: `sha256:${"3".repeat(64)}` }).blocked_by.includes("workloop_hash_mismatch"));
});

test("cov: verify rejects forged approval / absence / return conclusions", () => {
  const p = buildDemaActiveWorkloopComposerPreviewPayload(DEMA_ACTIVE_WORKLOOP_CANONICAL_FIXTURE);
  assert.ok(verifyDemaActiveWorkloopComposerPreview({ ...p, requires_approval: true }).blocked_by.includes("requires_approval_not_rederivable"));
  assert.ok(verifyDemaActiveWorkloopComposerPreview({ ...p, absence_queue_candidate_ref: { ref_id: "x" } }).blocked_by.includes("absence_queue_candidate_not_rederivable"));
  assert.ok(verifyDemaActiveWorkloopComposerPreview({ ...p, return_review_ref: { ref_id: "x" } }).blocked_by.includes("return_review_ref_not_rederivable"));
});

test("cov: deriveActiveWorkloopState direct — approval + blocked ordering", () => {
  const s = deriveActiveWorkloopState({
    operator_present: true, unfinished: false, returning: false,
    monitor_status_ref: { critical_count: 0, warning_count: 0 },
    proposed_task_ref: { task_id: "t", autonomy_level: "L5", irreversible: false },
  });
  assert.equal(s.allowed_next_action, "await_approval");
  assert.equal(s.requires_approval, true);
});

test("cov: default workloop_id derived when absent", () => {
  const input = clone(DEMA_ACTIVE_WORKLOOP_CANONICAL_FIXTURE);
  delete input.workloop_id;
  const p = buildDemaActiveWorkloopComposerPreviewPayload(input);
  assert.equal(p.workloop_id, "workloop:task:triage-report");
});
