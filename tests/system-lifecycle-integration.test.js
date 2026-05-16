import test from "node:test";
import assert from "node:assert/strict";

import { buildConsentPlanPreview } from "../packages/consent/src/consent-planner.js";
import {
  buildConsentHashTablePreview,
  verifyConsentHashTablePreview,
  lookupConsentHashTablePreview
} from "../packages/consent/src/consent-hash-preview.js";
import { buildEvidenceChainPreview } from "../packages/verifier/src/evidence-chain-preview.js";
import {
  evaluateIhsanFloorPreview,
  DEFAULT_IHSAN_FLOOR,
  IHSAN_SCORER_ID
} from "../packages/verifier/src/ihsan-floor-preview.js";
import { buildTrueValuePreview } from "../packages/core/src/process-value-preview.js";
import { buildNode0HomebaseStatePreview } from "../packages/core/src/node0-homebase-state-preview.js";
import { buildSharedUrpWorldPreview } from "../packages/core/src/shared-urp-world-preview.js";
import { buildExternalPatternRegistryPreview } from "../packages/core/src/external-pattern-registry-preview.js";

const FIXED_NOW = new Date("2026-05-16T11:25:00.000Z");
const FIXED_EXPIRES = "2026-05-17T11:25:00.000Z";
const SAMPLE_INTENT = "review the local repository state under preview-only constraints";

test("system lifecycle: intent → consent_plan → consent_hash_table builds clean", () => {
  const plan = buildConsentPlanPreview({ intent: SAMPLE_INTENT, now: FIXED_NOW });
  assert.equal(plan.schema, "bizra.dema.consent_plan_preview.v0.1");
  assert.equal(plan.mode, "PREVIEW_ONLY");
  assert.equal(plan.boundary.execution_enabled, false);
  assert.equal(plan.boundary.approval_recorded, false);
  assert.equal(plan.boundary.capability_minted, false);
  assert.equal(plan.boundary.receipt_minted, false);

  const table = buildConsentHashTablePreview({ plan, expiresAt: FIXED_EXPIRES, now: FIXED_NOW });
  assert.equal(table.schema, "bizra.dema.consent_hash_table_preview.v0.1");
  assert.equal(table.boundary.runtime_execution, false);
  assert.equal(table.boundary.receipt_minted, false);
  assert.equal(table.boundary.capability_minted, false);
  assert.equal(table.boundary.federation_initiated, false);
});

test("system lifecycle: consent hash table self-verifies its own commitment", () => {
  const plan = buildConsentPlanPreview({ intent: SAMPLE_INTENT, now: FIXED_NOW });
  const table = buildConsentHashTablePreview({ plan, expiresAt: FIXED_EXPIRES, now: FIXED_NOW });
  const verification = verifyConsentHashTablePreview(table);
  assert.equal(verification.ok, true);
});

test("system lifecycle: lookup against the table is preview-only and authority-free", () => {
  const plan = buildConsentPlanPreview({ intent: SAMPLE_INTENT, now: FIXED_NOW });
  const table = buildConsentHashTablePreview({ plan, expiresAt: FIXED_EXPIRES, now: FIXED_NOW });
  const probeRequest = { resource_type: "file", resource_id: "nonexistent", operation: "read" };
  const lookup = lookupConsentHashTablePreview(table, probeRequest, { now: FIXED_NOW });
  assert.equal(lookup.not_an_authorization, true);
  assert.equal(lookup.boundary.runtime_execution, false);
});

test("system lifecycle: homebase identity + shared URP world compose", () => {
  const homebase = buildNode0HomebaseStatePreview();
  assert.equal(homebase.schema, "bizra.dema.node0_homebase_state_preview.v0.1");
  assert.equal(homebase.player, "momo");
  assert.equal(homebase.primary_device, "MSI laptop");
  assert.equal(homebase.companion_device, "Z Fold 6");
  assert.equal(homebase.pat_count, 7);
  assert.equal(homebase.sat_count, 5);

  const world = buildSharedUrpWorldPreview();
  assert.equal(world.status, "locked_preview_only");
  assert.equal(world.node_count, 4);
  for (const node of world.nodes) {
    assert.equal(node.status, "ghost_hold");
    assert.equal(node.reachable, false);
    assert.equal(node.federation_open, false);
  }
});

test("system lifecycle: ihsan floor gate passes at threshold and fails below", () => {
  const pass = evaluateIhsanFloorPreview({
    score: DEFAULT_IHSAN_FLOOR + 0.02,
    scorerId: IHSAN_SCORER_ID,
    now: FIXED_NOW
  });
  assert.equal(pass.schema, "bizra.dema.ihsan_floor_preview.v0.1");
  assert.equal(pass.verdict, "PARTIAL_PLACEHOLDER");
  assert.equal(pass.certifies, false);

  const fail = evaluateIhsanFloorPreview({
    score: 0.5,
    scorerId: IHSAN_SCORER_ID,
    now: FIXED_NOW
  });
  assert.equal(fail.verdict, "PREVIEW_REJECT");
});

test("system lifecycle: evidence chain preview is preview-only and emits its schema", () => {
  const chain = buildEvidenceChainPreview({ receipts: [], purpose: "lifecycle test", now: FIXED_NOW });
  assert.equal(chain.schema, "bizra.dema.evidence_chain_preview.v0.1");
  assert.equal(chain.mode, "PREVIEW_ONLY");
});

test("system lifecycle: process value preview composes blockers + boundary discipline", () => {
  const value = buildTrueValuePreview({
    processEvents: [{ type: "clean_commit" }, { type: "gate_passed" }],
    proofSignals: [{ id: "tests", status: "passed" }],
    blockers: [],
    now: FIXED_NOW
  });
  assert.equal(value.schema, "bizra.dema.true_value_preview.v0.1");
  assert.equal(value.boundary.runtime_started, false);
  assert.equal(value.boundary.federation_started, false);
  assert.equal(value.boundary.receipt_minted, false);
  assert.equal(value.certifies, false);
});

test("system lifecycle: external pattern registry binds every entry to an existing primitive", () => {
  const registry = buildExternalPatternRegistryPreview();
  assert.equal(registry.pattern_count, 11);
  assert.equal(registry.boundary.runtime, false);
  assert.equal(registry.boundary.federation, false);
  assert.equal(registry.boundary.authority_imported, false);
  for (const pattern of registry.patterns) {
    assert.ok(pattern.bizra_binding.on_disk_anchor.startsWith("packages/"));
    assert.notEqual(pattern.current_status, "LIVE");
  }
});

test("system lifecycle: all 8 organs share the boundary discipline (zero authority flag is ever true)", () => {
  const plan = buildConsentPlanPreview({ intent: SAMPLE_INTENT, now: FIXED_NOW });
  const table = buildConsentHashTablePreview({ plan, expiresAt: FIXED_EXPIRES, now: FIXED_NOW });
  const homebase = buildNode0HomebaseStatePreview();
  const world = buildSharedUrpWorldPreview();
  const value = buildTrueValuePreview({
    processEvents: [{ type: "clean_commit" }],
    proofSignals: [{ id: "tests", status: "passed" }],
    blockers: [],
    now: FIXED_NOW
  });
  const registry = buildExternalPatternRegistryPreview();
  const chain = buildEvidenceChainPreview({ receipts: [], purpose: "lifecycle test", now: FIXED_NOW });

  const envelopes = [plan, table, homebase, world, value, registry, chain];
  for (const env of envelopes) {
    const boundary = env.boundary ?? {};
    for (const [key, val] of Object.entries(boundary)) {
      if (typeof val === "boolean") {
        assert.equal(val, false, `${env.schema} boundary.${key} must be false (got true)`);
      }
    }
  }
});

test("system lifecycle: composition is deterministic across two runs", () => {
  const run1 = {
    plan: buildConsentPlanPreview({ intent: SAMPLE_INTENT, now: FIXED_NOW }),
    homebase: buildNode0HomebaseStatePreview(),
    world: buildSharedUrpWorldPreview(),
    registry: buildExternalPatternRegistryPreview()
  };
  const run2 = {
    plan: buildConsentPlanPreview({ intent: SAMPLE_INTENT, now: FIXED_NOW }),
    homebase: buildNode0HomebaseStatePreview(),
    world: buildSharedUrpWorldPreview(),
    registry: buildExternalPatternRegistryPreview()
  };
  assert.deepEqual(run1, run2);
});

test("system lifecycle: each builder returns a fresh frozen reference per call", () => {
  const a = buildNode0HomebaseStatePreview();
  const b = buildNode0HomebaseStatePreview();
  assert.notEqual(a, b);
  assert.ok(Object.isFrozen(a));
  assert.ok(Object.isFrozen(b));

  const c = buildSharedUrpWorldPreview();
  const d = buildSharedUrpWorldPreview();
  assert.notEqual(c, d);
  assert.ok(Object.isFrozen(c));

  const e = buildExternalPatternRegistryPreview();
  const f = buildExternalPatternRegistryPreview();
  assert.notEqual(e, f);
  assert.ok(Object.isFrozen(e));
});
