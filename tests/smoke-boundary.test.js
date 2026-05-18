import { test } from "node:test";
import assert from "node:assert/strict";

import {
  runSmokeBoundary,
  SMOKE_BOUNDARY_SPINE_COMMANDS
} from "../scripts/smoke-boundary.mjs";
import {
  isCanonicalBoundary,
  PREVIEW_BOUNDARY_CANONICAL_KEYS
} from "../packages/core/src/preview-boundary.js";

// In-process verification: import the 8 builders directly and assert that
// each emits a canonical boundary. Faster than the subprocess path used by
// the CLI script, but covers the same invariant.

import { buildNode0StatePreview } from "../packages/core/src/state.js";
import { buildProfileFoundationPreview } from "../packages/core/src/profiles.js";
import { buildConsentCardPreview } from "../packages/core/src/consent-card-preview.js";
import { buildMissionLoopPreview } from "../packages/core/src/mission-loop-preview.js";
import { buildEvidenceChainEventPreviewFromInputs } from "../packages/core/src/evidence-chain-event-preview.js";
import { buildLocalLLMRouterPreview } from "../packages/core/src/local-llm-router-preview.js";
import { buildProcessMiningPreview } from "../packages/core/src/process-mining-preview.js";
import { buildKeyMakerCompliancePreview } from "../packages/core/src/key-maker-compliance.js";

const IN_PROCESS_BUILDERS = [
  ["state", buildNode0StatePreview],
  ["profiles", buildProfileFoundationPreview],
  ["consent-card", buildConsentCardPreview],
  ["mission-loop", buildMissionLoopPreview],
  ["evidence-event", buildEvidenceChainEventPreviewFromInputs],
  ["llm-router", buildLocalLLMRouterPreview],
  ["process-mining", buildProcessMiningPreview],
  ["key-maker-check", buildKeyMakerCompliancePreview]
];

test("SMOKE_BOUNDARY_SPINE_COMMANDS lists exactly the 8 spine surfaces", () => {
  assert.deepEqual([...SMOKE_BOUNDARY_SPINE_COMMANDS], [
    "state",
    "profiles",
    "consent-card",
    "mission-loop",
    "evidence-event",
    "llm-router",
    "process-mining",
    "key-maker-check"
  ]);
});

test("Every spine builder emits a canonical boundary (in-process · fast)", () => {
  for (const [name, builder] of IN_PROCESS_BUILDERS) {
    const out = builder();
    assert.ok(out.boundary, `${name} must emit a boundary field`);
    assert.equal(
      isCanonicalBoundary(out.boundary),
      true,
      `${name}.boundary must satisfy isCanonicalBoundary()`
    );
  }
});

test("runSmokeBoundary returns the canonical report schema (subprocess path)", async () => {
  const report = await runSmokeBoundary();
  assert.equal(report.schema, "bizra.dema.smoke_boundary_report.v0.1");
  assert.equal(report.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(report.mode, "preview_only");
  assert.equal(report.commands_checked, 8);
  assert.equal(report.canonical_keys_expected, PREVIEW_BOUNDARY_CANONICAL_KEYS.length);
  assert.equal(report.canonical_keys_expected, 16);
});

test("runSmokeBoundary all_canonical=true on the current spine", async () => {
  const report = await runSmokeBoundary();
  assert.equal(report.all_canonical, true,
    `at least one spine command emitted a non-canonical boundary: ${JSON.stringify(report.results)}`);
  for (const r of report.results) {
    assert.equal(r.ok, true, `${r.cmd} not canonical: ${r.reason}`);
  }
});

test("runSmokeBoundary report results include all 8 spine commands", async () => {
  const report = await runSmokeBoundary();
  const cmds = report.results.map((r) => r.cmd).sort();
  assert.deepEqual(cmds, [
    "consent-card",
    "evidence-event",
    "key-maker-check",
    "llm-router",
    "mission-loop",
    "process-mining",
    "profiles",
    "state"
  ]);
});

test("runSmokeBoundary next_safe_action reflects canonical state", async () => {
  const report = await runSmokeBoundary();
  if (report.all_canonical) {
    assert.equal(report.next_safe_action, "promote_new_preview_surface_with_confidence");
  } else {
    assert.equal(report.next_safe_action, "investigate_non_canonical_emitter");
  }
});

test("Smoke boundary report is JSON-serializable (no circular refs, no functions)", async () => {
  const report = await runSmokeBoundary();
  // Round-trip via JSON: any non-serializable values throw
  const serialized = JSON.stringify(report);
  const parsed = JSON.parse(serialized);
  assert.equal(parsed.all_canonical, report.all_canonical);
  assert.equal(parsed.commands_checked, report.commands_checked);
});
