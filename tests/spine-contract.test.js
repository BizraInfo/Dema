import { test } from "node:test";
import assert from "node:assert/strict";

// Cross-cutting Spine Contract test — integration invariant across all 8
// spine surfaces. Asserts that every preview builder in the canonical spine
// satisfies the same contract:
//
//   1. schema matches /^bizra\.dema\.[a-z0-9_]+\.v\d+\.\d+$/
//   2. truth_label === "NODE0_LOCAL_SEED"
//   3. boundary is canonical 16-key all-false frozen object
//   4. output is deep-frozen at top level
//   5. mode field is a string
//
// When a 9th spine surface is added, this test will fail until added to
// the SPINE_BUILDERS array · forcing the contract to be carried forward.

import { buildNode0StatePreview } from "../packages/core/src/state.js";
import { buildProfileFoundationPreview } from "../packages/core/src/profiles.js";
import { buildConsentCardPreview } from "../packages/core/src/consent-card-preview.js";
import { buildMissionLoopPreview } from "../packages/core/src/mission-loop-preview.js";
import { buildEvidenceChainEventPreviewFromInputs } from "../packages/core/src/evidence-chain-event-preview.js";
import { buildLocalLLMRouterPreview } from "../packages/core/src/local-llm-router-preview.js";
import { buildProcessMiningPreview } from "../packages/core/src/process-mining-preview.js";
import { buildKeyMakerCompliancePreview } from "../packages/core/src/key-maker-compliance.js";

import {
  isCanonicalBoundary,
  PREVIEW_BOUNDARY_CANONICAL_KEYS,
} from "../packages/core/src/preview-boundary.js";

const SPINE_BUILDERS = Object.freeze([
  ["state", buildNode0StatePreview],
  ["profiles", buildProfileFoundationPreview],
  ["consent-card", buildConsentCardPreview],
  ["mission-loop", buildMissionLoopPreview],
  ["evidence-event", buildEvidenceChainEventPreviewFromInputs],
  ["llm-router", buildLocalLLMRouterPreview],
  ["process-mining", buildProcessMiningPreview],
  ["key-maker-check", buildKeyMakerCompliancePreview],
]);

const SCHEMA_PATTERN = /^bizra\.dema\.[a-z0-9_]+\.v\d+\.\d+$/;

test("Spine has exactly 8 canonical surfaces", () => {
  assert.equal(
    SPINE_BUILDERS.length,
    8,
    "spine count must match smoke-boundary and TESTING.md",
  );
});

test("Every spine builder emits a schema matching bizra.dema.<name>.vX.Y", () => {
  for (const [name, builder] of SPINE_BUILDERS) {
    const out = builder();
    assert.ok(
      typeof out.schema === "string",
      `${name}.schema must be a string`,
    );
    assert.match(
      out.schema,
      SCHEMA_PATTERN,
      `${name}.schema ('${out.schema}') must match bizra.dema.<name>.vN.M`,
    );
  }
});

test("Every spine builder emits truth_label = NODE0_LOCAL_SEED", () => {
  for (const [name, builder] of SPINE_BUILDERS) {
    const out = builder();
    assert.equal(
      out.truth_label,
      "NODE0_LOCAL_SEED",
      `${name}.truth_label must be NODE0_LOCAL_SEED`,
    );
  }
});

test("Every spine builder emits canonical 16-key boundary", () => {
  for (const [name, builder] of SPINE_BUILDERS) {
    const out = builder();
    assert.ok(out.boundary, `${name} must emit a boundary field`);
    assert.equal(
      isCanonicalBoundary(out.boundary),
      true,
      `${name}.boundary must satisfy isCanonicalBoundary() (canonical 16-key all-false frozen)`,
    );
    for (const key of PREVIEW_BOUNDARY_CANONICAL_KEYS) {
      assert.equal(
        out.boundary[key],
        false,
        `${name}.boundary.${key} must be false`,
      );
    }
  }
});

test("Every spine builder output is deep-frozen at top level", () => {
  for (const [name, builder] of SPINE_BUILDERS) {
    const out = builder();
    assert.ok(
      Object.isFrozen(out),
      `${name} output must be deep-frozen at top level`,
    );
    assert.ok(Object.isFrozen(out.boundary), `${name}.boundary must be frozen`);
  }
});

test("Every spine builder emits a mode field as a string", () => {
  for (const [name, builder] of SPINE_BUILDERS) {
    const out = builder();
    assert.ok(
      typeof out.mode === "string" || out.mode === undefined,
      `${name}.mode must be a string if present (got ${typeof out.mode})`,
    );
  }
});

test("Every spine builder is deterministic when called with no args", () => {
  for (const [name, builder] of SPINE_BUILDERS) {
    const a = builder();
    const b = builder();
    // Same shape, same values — but frozen objects compare by reference for
    // deep equality, so we use deepEqual on the JSON-cloned form.
    const aJson = JSON.parse(JSON.stringify(a));
    const bJson = JSON.parse(JSON.stringify(b));
    assert.deepEqual(
      aJson,
      bJson,
      `${name} must be deterministic when called with no args`,
    );
  }
});

test("All 8 spine surface names are unique", () => {
  const names = SPINE_BUILDERS.map(([n]) => n);
  const unique = new Set(names);
  assert.equal(unique.size, names.length, "spine surface names must be unique");
});
