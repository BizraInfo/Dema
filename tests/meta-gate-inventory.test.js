import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import {
  auditMetaGateInventory,
  validateProvenancePromotion,
  CANONICAL_META_GATE_INVENTORY,
  META_GATE_INVENTORY_SCHEMA,
  META_GATE_INVENTORY_TRUTH_LABEL,
} from "../packages/core/src/meta-gate-inventory.js";

// A fully-specified invariant row: every rail present. This is the positive
// control — a rule with an executable gate, a negative-control test (path +
// fault), and a re-derivation path.
function completeRow(overrides = {}) {
  return {
    invariantId: "SAMPLE_INVARIANT_1A",
    covenantClause: "No claim without an independent verify re-derivation path.",
    proseRule: "Every kernel claim must be re-derivable on disk.",
    executableGatePath: "scripts/review/kernel-purity-check.mjs",
    negativeControlTestPath: "tests/kernel-purity-check.test.js",
    negativeControlFault: "forbidden_side_effect_import_detected",
    verifyFunctionName: "checkKernelPurity",
    ...overrides,
  };
}

test("positive control: a complete invariant row is VERIFIED_FALSIFIABLE_CONTROL", () => {
  const result = auditMetaGateInventory([completeRow()]);

  assert.equal(result.schema, META_GATE_INVENTORY_SCHEMA);
  assert.equal(result.truth_label, META_GATE_INVENTORY_TRUTH_LABEL);
  assert.equal(result.allEnforcedAndFalsifiable, true);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].classification, "VERIFIED_FALSIFIABLE_CONTROL");
  assert.equal(result.rows[0].invariantId, "SAMPLE_INVARIANT_1A");
  assert.equal(result.boundary.runtimeActivated, false);
  assert.equal(result.boundary.networkCalled, false);
  assert.equal(result.boundary.authorityDelta, 0);
});

test("negative control 1: missing executableGatePath is UNENFORCED_WISH", () => {
  const row = completeRow({ executableGatePath: undefined });
  const result = auditMetaGateInventory([row]);

  assert.equal(result.allEnforcedAndFalsifiable, false);
  assert.equal(result.rows[0].classification, "UNENFORCED_WISH");
});

test("negative control 2: gate present but missing negative-control test or fault is UNPROVEN_HAPPY_PATH_ONLY", () => {
  const missingPath = auditMetaGateInventory([
    completeRow({ negativeControlTestPath: undefined }),
  ]);
  assert.equal(missingPath.allEnforcedAndFalsifiable, false);
  assert.equal(missingPath.rows[0].classification, "UNPROVEN_HAPPY_PATH_ONLY");

  const missingFault = auditMetaGateInventory([
    completeRow({ negativeControlFault: undefined }),
  ]);
  assert.equal(missingFault.allEnforcedAndFalsifiable, false);
  assert.equal(missingFault.rows[0].classification, "UNPROVEN_HAPPY_PATH_ONLY");
});

test("negative control 3: missing verifyFunctionName is MISSING_REDERIVATION_PATH", () => {
  const result = auditMetaGateInventory([
    completeRow({ verifyFunctionName: undefined }),
  ]);

  assert.equal(result.allEnforcedAndFalsifiable, false);
  assert.equal(result.rows[0].classification, "MISSING_REDERIVATION_PATH");
});

test("negative control 4: provenance promotion refuses attestation without on-disk re-derivation", () => {
  const subagent = validateProvenancePromotion({
    sourceProvenance: "ATTESTED_BY_SUBAGENT",
    claimedLabel: "VERIFIED_BY_ORCHESTRATOR",
  });
  assert.equal(subagent.ok, false);
  assert.equal(subagent.reason, "REFUSED_PROMOTION_WITHOUT_REDERIVATION");

  const operator = validateProvenancePromotion({
    sourceProvenance: "ATTESTED_BY_OPERATOR",
    claimedLabel: "VERIFIED_BY_ORCHESTRATOR",
  });
  assert.equal(operator.ok, false);
  assert.equal(operator.reason, "REFUSED_PROMOTION_WITHOUT_REDERIVATION");
});

// META-GATE-CLAIM-HONESTY-1A — a caller-supplied Boolean is not re-derivation.
test("negative control 5: rederivedOnDisk Boolean alone cannot promote to VERIFIED", () => {
  const laundered = validateProvenancePromotion({
    sourceProvenance: "ATTESTED_BY_SUBAGENT",
    claimedLabel: "VERIFIED_BY_ORCHESTRATOR",
    rederivedOnDisk: true,
  });
  assert.equal(laundered.ok, false);
  assert.equal(laundered.reason, "REFUSED_CALLER_BOOLEAN_NOT_EVIDENCE");
  assert.equal(laundered.claim_ceiling, "CONTROL_MAPPING_COMPLETE");
});

test("negative control 6: malformed rederivationEvidence cannot promote to VERIFIED", () => {
  // Isolate malformed evidence: omit rederivedOnDisk so the reason is not
  // conflated with REFUSED_CALLER_BOOLEAN_NOT_EVIDENCE.
  const bad = validateProvenancePromotion({
    sourceProvenance: "ATTESTED_BY_OPERATOR",
    claimedLabel: "VERIFIED_BY_ORCHESTRATOR",
    rederivationEvidence: { note: "trust me" },
  });
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, "REFUSED_PROMOTION_WITHOUT_REDERIVATION");
  assert.equal(bad.claim_ceiling, "CONTROL_MAPPING_COMPLETE");
});

test("negative control 7: structured evidence still cannot promote in pure kernel", () => {
  const structured = validateProvenancePromotion({
    sourceProvenance: "ATTESTED_BY_SUBAGENT",
    claimedLabel: "VERIFIED_BY_ORCHESTRATOR",
    rederivationEvidence: {
      kind: "content_sha256",
      path: "packages/core/src/meta-gate-inventory.js",
      content_sha256: "a".repeat(64),
    },
  });
  assert.equal(structured.ok, false);
  assert.equal(structured.reason, "REFUSED_PURE_KERNEL_CANNOT_VERIFY_DISK");
  assert.equal(structured.claim_ceiling, "CONTROL_MAPPING_COMPLETE");
});

test("canonical meta-gate inventory is fully enforced and maps real on-disk paths", () => {
  assert.ok(Array.isArray(CANONICAL_META_GATE_INVENTORY));
  assert.ok(CANONICAL_META_GATE_INVENTORY.length >= 5);

  const result = auditMetaGateInventory(CANONICAL_META_GATE_INVENTORY);
  assert.equal(
    result.allEnforcedAndFalsifiable,
    true,
    `canonical inventory must be fully enforced; rows=${JSON.stringify(
      result.rows.map((r) => [r.invariantId, r.classification]),
    )}`,
  );

  for (const row of CANONICAL_META_GATE_INVENTORY) {
    assert.ok(
      existsSync(row.executableGatePath),
      `missing gate on disk: ${row.executableGatePath}`,
    );
    assert.ok(
      existsSync(row.negativeControlTestPath),
      `missing negative-control test on disk: ${row.negativeControlTestPath}`,
    );
  }
});

test("audit is deterministic and pure (no mutation of input rows)", () => {
  const rows = [completeRow()];
  const frozenCopy = JSON.stringify(rows);
  const first = auditMetaGateInventory(rows);
  const second = auditMetaGateInventory(rows);

  assert.equal(JSON.stringify(rows), frozenCopy);
  assert.equal(first.inventory_hash, second.inventory_hash);
  assert.match(first.inventory_hash, /^sha256:[0-9a-f]{64}$/);
});
