import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildProfileFoundationPreview,
  buildProfileFoundationSummary
} from "../packages/core/src/profiles.js";
import {
  buildMissionLoopPreview,
  buildMissionLoopSummary
} from "../packages/core/src/mission-loop-preview.js";
import {
  isCanonicalBoundary,
  PREVIEW_BOUNDARY_CANONICAL_KEYS
} from "../packages/core/src/preview-boundary.js";

// The canonical 16-key boundary alone is 18 lines pretty-printed, so any
// summary that preserves the boundary floors at ~20 lines. Budget set to
// 40 gives ~20 lines of content above the boundary while still enforcing
// a ~10x reduction from the 200-374 line full previews.
const SUMMARY_LINE_BUDGET = 40;

test("ProfileFoundationSummary emits suffix-tagged schema and preserves truth label", () => {
  const summary = buildProfileFoundationSummary();
  assert.equal(summary.schema, "bizra.dema.profile_foundation_summary.v0.1");
  assert.equal(summary.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(summary.mode, "summary");
  assert.equal(summary.source_schema, "bizra.dema.profile_foundation.v0.1");
});

test("ProfileFoundationSummary surfaces all 4 actor schemas + capsule schema", () => {
  const summary = buildProfileFoundationSummary();
  assert.equal(summary.actors.user, "bizra.dema.user_profile.v0.1");
  assert.equal(summary.actors.pat, "bizra.dema.pat_profile.v0.1");
  assert.equal(summary.actors.sat, "bizra.dema.sat_profile.v0.1");
  assert.equal(summary.actors.mission, "bizra.dema.mission_profile.v0.1");
  assert.equal(summary.context_capsule_schema, "bizra.dema.context_capsule.v0.1");
});

test("ProfileFoundationSummary boundary is the canonical 16-key frozen object", () => {
  const summary = buildProfileFoundationSummary();
  assert.ok(isCanonicalBoundary(summary.boundary), "boundary must be canonical");
  for (const key of PREVIEW_BOUNDARY_CANONICAL_KEYS) {
    assert.equal(summary.boundary[key], false, `boundary.${key} must be false`);
  }
});

test("ProfileFoundationSummary fits within line budget pretty-printed", () => {
  const summary = buildProfileFoundationSummary();
  const lines = JSON.stringify(summary, null, 2).split("\n").length;
  assert.ok(
    lines <= SUMMARY_LINE_BUDGET,
    `summary must be <= ${SUMMARY_LINE_BUDGET} lines, got ${lines}`
  );
});

test("ProfileFoundationSummary is deep-frozen", () => {
  const summary = buildProfileFoundationSummary();
  assert.ok(Object.isFrozen(summary));
  assert.ok(Object.isFrozen(summary.actors));
  assert.ok(Object.isFrozen(summary.boundary));
});

test("ProfileFoundationSummary is materially smaller than full preview", () => {
  const full = buildProfileFoundationPreview();
  const summary = buildProfileFoundationSummary();
  const fullLines = JSON.stringify(full, null, 2).split("\n").length;
  const summaryLines = JSON.stringify(summary, null, 2).split("\n").length;
  assert.ok(
    summaryLines < fullLines / 4,
    `summary (${summaryLines}) must be < 1/4 of full (${fullLines})`
  );
});

test("MissionLoopSummary emits suffix-tagged schema and preserves HOLD status", () => {
  const summary = buildMissionLoopSummary();
  assert.equal(summary.schema, "bizra.dema.mission_loop_summary.v0.1");
  assert.equal(summary.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(summary.mode, "summary");
  assert.equal(summary.source_schema, "bizra.dema.mission_loop_preview.v0.1");
  assert.equal(summary.preview_lifecycle_status, "HOLD");
});

test("MissionLoopSummary surfaces lifecycle phase and next safe action", () => {
  const summary = buildMissionLoopSummary();
  assert.equal(typeof summary.lifecycle_phase, "string");
  assert.equal(typeof summary.next_safe_action, "string");
  assert.ok(summary.lifecycle_phase.length > 0);
  assert.ok(summary.next_safe_action.length > 0);
});

test("MissionLoopSummary surfaces all 6 child schemas/statuses", () => {
  const summary = buildMissionLoopSummary();
  assert.equal(summary.children.state_load, "bizra.dema.node0_state.v0.1");
  assert.equal(summary.children.profile_foundation, "bizra.dema.profile_foundation.v0.1");
  assert.equal(summary.children.consent_card, "bizra.dema.consent_card_preview.v0.1");
  assert.equal(summary.children.local_model_invocation_status, "not_executed_preview_only");
  assert.equal(summary.children.evidence_chain_event_status, "not_prepared");
  assert.equal(summary.children.receipt_preview_status, "not_prepared");
});

test("MissionLoopSummary boundary is the canonical 16-key frozen object", () => {
  const summary = buildMissionLoopSummary();
  assert.ok(isCanonicalBoundary(summary.boundary), "boundary must be canonical");
  for (const key of PREVIEW_BOUNDARY_CANONICAL_KEYS) {
    assert.equal(summary.boundary[key], false, `boundary.${key} must be false`);
  }
});

test("MissionLoopSummary fits within line budget pretty-printed", () => {
  const summary = buildMissionLoopSummary();
  const lines = JSON.stringify(summary, null, 2).split("\n").length;
  assert.ok(
    lines <= SUMMARY_LINE_BUDGET,
    `summary must be <= ${SUMMARY_LINE_BUDGET} lines, got ${lines}`
  );
});

test("MissionLoopSummary is deep-frozen", () => {
  const summary = buildMissionLoopSummary();
  assert.ok(Object.isFrozen(summary));
  assert.ok(Object.isFrozen(summary.children));
  assert.ok(Object.isFrozen(summary.boundary));
});

test("MissionLoopSummary is materially smaller than full preview", () => {
  const full = buildMissionLoopPreview();
  const summary = buildMissionLoopSummary();
  const fullLines = JSON.stringify(full, null, 2).split("\n").length;
  const summaryLines = JSON.stringify(summary, null, 2).split("\n").length;
  assert.ok(
    summaryLines < fullLines / 8,
    `summary (${summaryLines}) must be < 1/8 of full (${fullLines})`
  );
});

test("Summary boundaries match the canonical boundary of their full preview", () => {
  const fullProfile = buildProfileFoundationPreview();
  const summaryProfile = buildProfileFoundationSummary();
  assert.deepEqual(summaryProfile.boundary, fullProfile.boundary);

  const fullMission = buildMissionLoopPreview();
  const summaryMission = buildMissionLoopSummary();
  assert.deepEqual(summaryMission.boundary, fullMission.boundary);
});
