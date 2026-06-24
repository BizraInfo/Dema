import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildPatSatBlackboardDryRun,
  verifyPatSatBlackboardDryRun,
  PAT_SAT_BLACKBOARD_DRY_RUN_SCHEMA,
  PAT_SAT_BLACKBOARD_DRY_RUN_TRUTH_LABEL,
  PAT_SAT_BLACKBOARD_MAX_STEPS,
} from "../packages/core/src/pat-sat-blackboard-dry-run.js";

const FULL_SEED = { pain: "slow local triage", goal: "ship a preview slice" };

test("constants are stable", () => {
  assert.equal(
    PAT_SAT_BLACKBOARD_DRY_RUN_SCHEMA,
    "bizra.dema.pat_sat_blackboard_dry_run.v0.1",
  );
  assert.equal(
    PAT_SAT_BLACKBOARD_DRY_RUN_TRUTH_LABEL,
    "PAT_SAT_BLACKBOARD_DRY_RUN_LOCAL_ONLY",
  );
  assert.equal(PAT_SAT_BLACKBOARD_MAX_STEPS, 32);
});

test("determinism: two builds deep-equal", () => {
  const a = buildPatSatBlackboardDryRun(FULL_SEED);
  const b = buildPatSatBlackboardDryRun(FULL_SEED);
  assert.deepEqual(a, b);
  assert.equal(a.preview_hash, b.preview_hash);
});

test("full seed reaches QUIESCENT_CONSENT_READY with board length 8", () => {
  const report = buildPatSatBlackboardDryRun(FULL_SEED);
  assert.equal(report.final_state, "QUIESCENT_CONSENT_READY");
  assert.equal(report.board.length, 8);
  // Normal runs never approach the cap.
  assert.ok(report.board.length <= 8);
  assert.ok(report.board.length < PAT_SAT_BLACKBOARD_MAX_STEPS);
  const ids = report.board.map((e) => e.source_id);
  assert.deepEqual(ids, [
    "discover",
    "draft",
    "propose",
    "self_critique",
    "verify",
    "gate",
    "refuse_or_permit_preview",
    "critique",
  ]);
});

test("incomplete seed is BLOCKED_INTERVIEW_INCOMPLETE", () => {
  const noGoal = buildPatSatBlackboardDryRun({ pain: "x", goal: null });
  assert.equal(noGoal.final_state, "BLOCKED_INTERVIEW_INCOMPLETE");
  const empty = buildPatSatBlackboardDryRun({});
  assert.equal(empty.final_state, "BLOCKED_INTERVIEW_INCOMPLETE");
  // boundary still all-false even when blocked.
  assert.ok(Object.values(empty.boundary).every((v) => v === false));
});

test("all boundary keys are false and include the dry-run keys", () => {
  const report = buildPatSatBlackboardDryRun(FULL_SEED);
  assert.ok(Object.values(report.boundary).every((v) => v === false));
  assert.equal(report.boundary.live_coordination_performed, false);
  assert.equal(report.boundary.agent_runtime_executed, false);
  assert.equal(report.boundary.model_invoked, false);
});

test("what_this_does_not_prove carries the required disclaimers", () => {
  const report = buildPatSatBlackboardDryRun(FULL_SEED);
  const text = report.what_this_does_not_prove.join(" | ");
  assert.match(text, /NOT a live PAT\/SAT runtime/);
  assert.match(text, /no agent executed/);
  assert.match(text, /no model invoked/);
  assert.match(text, /no reward, token, PoI, or federation/);
  assert.match(text, /DETERMINISTIC FUNCTION OF THE SEED/);
  assert.match(text, /not learned/);
});

test("verify on an honest report is ok", () => {
  const report = buildPatSatBlackboardDryRun(FULL_SEED);
  const v = verifyPatSatBlackboardDryRun(report);
  assert.equal(v.ok, true);
  assert.deepEqual(v.blocked_by, []);
});

test("forgery: mutated entry summary is blocked", () => {
  const report = buildPatSatBlackboardDryRun(FULL_SEED);
  const forged = structuredClone(report);
  forged.board[0].summary = "tampered summary";
  const v = verifyPatSatBlackboardDryRun(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.length > 0);
  assert.ok(v.blocked_by.includes("board_relaundered"));
});

test("forgery: reordered coordination_trace is blocked", () => {
  const report = buildPatSatBlackboardDryRun(FULL_SEED);
  const forged = structuredClone(report);
  const t = forged.coordination_trace;
  [t[0], t[1]] = [t[1], t[0]];
  const v = verifyPatSatBlackboardDryRun(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("trace_mismatch"));
});

test("forgery: flipped boundary key is blocked", () => {
  const report = buildPatSatBlackboardDryRun(FULL_SEED);
  const forged = structuredClone(report);
  forged.boundary.model_invoked = true;
  const v = verifyPatSatBlackboardDryRun(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("boundary_not_all_false"));
});

test("forgery: tampered preview_hash is blocked", () => {
  const report = buildPatSatBlackboardDryRun(FULL_SEED);
  const forged = structuredClone(report);
  forged.preview_hash = "0".repeat(64);
  const v = verifyPatSatBlackboardDryRun(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("preview_hash_mismatch"));
});

test("forgery: forged final_state (FAKE_LIVE_EXECUTED) is blocked", () => {
  const report = buildPatSatBlackboardDryRun(FULL_SEED);
  const forged = structuredClone(report);
  forged.final_state = "FAKE_LIVE_EXECUTED";
  const v = verifyPatSatBlackboardDryRun(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("envelope_relaundered"));
});

test("forgery: tampered next_safe_actions is blocked", () => {
  const report = buildPatSatBlackboardDryRun(FULL_SEED);
  const forged = structuredClone(report);
  forged.next_safe_actions = ["EXECUTE NOW"];
  const v = verifyPatSatBlackboardDryRun(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("envelope_relaundered"));
});

test("forgery: gutted what_this_does_not_prove is blocked", () => {
  const report = buildPatSatBlackboardDryRun(FULL_SEED);
  const forged = structuredClone(report);
  forged.what_this_does_not_prove = ["all good, fully live"];
  const v = verifyPatSatBlackboardDryRun(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("envelope_relaundered"));
});

test("forgery: stealth extra all-false boundary key is blocked", () => {
  const report = buildPatSatBlackboardDryRun(FULL_SEED);
  const forged = structuredClone(report);
  forged.boundary.some_new_capability = false;
  const v = verifyPatSatBlackboardDryRun(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("envelope_relaundered"));
});

test("returned envelope is deep-frozen", () => {
  const report = buildPatSatBlackboardDryRun(FULL_SEED);
  assert.ok(Object.isFrozen(report));
  assert.ok(Object.isFrozen(report.board));
  assert.ok(Object.isFrozen(report.board[0]));
  assert.ok(Object.isFrozen(report.boundary));
  assert.ok(Object.isFrozen(report.coordination_trace));
  assert.ok(Object.isFrozen(report.what_this_does_not_prove));
});
