// META-GATE-INVENTORY-1A — pure kernel. PREVIEW_ONLY · NOT ML · NOT runtime.
//
// Implements the governing law of this repository as an executable construct:
// "No claim without an independent verify re-derivation path, and no rule
// without an executable gate and negative control." This kernel does NOT run
// any gate, read any file, or activate any runtime. It classifies a declared
// inventory of invariants by whether each carries the four rails required to
// make its rule falsifiable, and refuses to promote an attested label into a
// re-derived one unless the re-derivation was actually performed on disk.
//
// The classification is a PREVIEW only: a VERIFIED_FALSIFIABLE_CONTROL row
// means the inventory DECLARES a gate, a negative-control test, a fault, and a
// verify function — the companion review gate (scripts/review/meta-gate-check.mjs)
// is what checks those declared paths against the real filesystem. A green
// classification here is never a runtime or activation claim.

import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";

export const META_GATE_INVENTORY_SCHEMA = "bizra.dema.meta_gate_inventory.v0.1";
export const META_GATE_INVENTORY_TRUTH_LABEL = "META_GATE_INVENTORY_PREVIEW_ONLY";

// Classification taxonomy. Order matters: the first failing rail wins so the
// reported classification names the strongest missing guard.
export const META_GATE_CLASSIFICATIONS = Object.freeze([
  "VERIFIED_FALSIFIABLE_CONTROL",
  "UNENFORCED_WISH",
  "UNPROVEN_HAPPY_PATH_ONLY",
  "MISSING_REDERIVATION_PATH",
]);

// Provenance labels that may NOT be promoted to a re-derived label on the
// strength of attestation alone. Memory, a transcript, or an attestation does
// not grant authority: only a fresh on-disk re-derivation does.
const ATTESTED_PROVENANCE = Object.freeze([
  "ATTESTED_BY_SUBAGENT",
  "ATTESTED_BY_OPERATOR",
]);
const REDERIVED_LABEL = "VERIFIED_BY_ORCHESTRATOR";

const boundary = () =>
  Object.freeze({ runtimeActivated: false, networkCalled: false, authorityDelta: 0 });

const nonEmptyString = (v) => typeof v === "string" && v.length > 0;

// Classify one declared invariant row. Pure: reads only the declared fields,
// performs no filesystem access (the companion review gate does that).
export function classifyInvariant(row) {
  if (!row || typeof row !== "object") return "MISSING_REDERIVATION_PATH";
  if (!nonEmptyString(row.executableGatePath)) return "UNENFORCED_WISH";
  if (!nonEmptyString(row.negativeControlTestPath) || !nonEmptyString(row.negativeControlFault)) {
    return "UNPROVEN_HAPPY_PATH_ONLY";
  }
  if (!nonEmptyString(row.verifyFunctionName)) return "MISSING_REDERIVATION_PATH";
  return "VERIFIED_FALSIFIABLE_CONTROL";
}

// Audit a declared inventory of invariants. Returns a frozen report whose
// `allEnforcedAndFalsifiable` is true only when EVERY row is a
// VERIFIED_FALSIFIABLE_CONTROL. Input rows are never mutated.
export function auditMetaGateInventory(invariants) {
  const list = Array.isArray(invariants) ? invariants : [];
  const rows = list.map((row) => {
    const classification = classifyInvariant(row);
    return Object.freeze({
      invariantId: nonEmptyString(row?.invariantId) ? row.invariantId : null,
      covenantClause: nonEmptyString(row?.covenantClause) ? row.covenantClause : null,
      classification,
      enforcedAndFalsifiable: classification === "VERIFIED_FALSIFIABLE_CONTROL",
    });
  });
  const allEnforcedAndFalsifiable =
    rows.length > 0 && rows.every((r) => r.enforcedAndFalsifiable);

  const payload = {
    schema: META_GATE_INVENTORY_SCHEMA,
    truth_label: META_GATE_INVENTORY_TRUTH_LABEL,
    rows,
    allEnforcedAndFalsifiable,
  };
  const inventory_hash = sha256CanonicalJsonV1(payload);

  return Object.freeze({
    ...payload,
    rows: Object.freeze(rows),
    inventory_hash,
    boundary: boundary(),
  });
}

// Refuse to promote an attested provenance to the re-derived orchestrator label
// unless the caller confirms the re-derivation ran on disk. A tool being
// available, or an attestation existing, does not grant the promotion.
export function validateProvenancePromotion({
  sourceProvenance,
  claimedLabel,
  rederivedOnDisk = false,
} = {}) {
  const base = { source_provenance: sourceProvenance ?? null, claimed_label: claimedLabel ?? null };
  const promotingToRederived = claimedLabel === REDERIVED_LABEL;
  const fromAttested = ATTESTED_PROVENANCE.includes(sourceProvenance);

  if (promotingToRederived && fromAttested && rederivedOnDisk !== true) {
    return Object.freeze({
      ...base,
      ok: false,
      reason: "REFUSED_PROMOTION_WITHOUT_REDERIVATION",
      boundary: boundary(),
    });
  }

  if (promotingToRederived && fromAttested && rederivedOnDisk === true) {
    return Object.freeze({
      ...base,
      ok: true,
      reason: "PROMOTION_BACKED_BY_REDERIVATION",
      boundary: boundary(),
    });
  }

  // Not an attestation->rederived promotion: nothing to refuse here.
  return Object.freeze({
    ...base,
    ok: true,
    reason: "NO_ATTESTED_PROMOTION_REQUESTED",
    boundary: boundary(),
  });
}

// The canonical inventory maps this repository's core constitutional laws to
// their REAL on-disk review gates, negative-control test suites, and verify /
// re-derivation functions. Every path here is checked against the real
// filesystem by scripts/review/meta-gate-check.mjs (the anti-phantom-path
// guard). Each row is a DECLARED mapping; the gate is the enforcement.
export const CANONICAL_META_GATE_INVENTORY = Object.freeze([
  Object.freeze({
    invariantId: "KERNEL_PURITY_1A",
    covenantClause: "Kernel-tier modules perform no hidden side effects.",
    proseRule:
      "A packages/core kernel may not import a side-effect surface (fs/net/http/child_process/fetch) without an explicit allowlist entry.",
    executableGatePath: "scripts/review/kernel-purity-check.mjs",
    negativeControlTestPath: "tests/kernel-purity-check.test.js",
    negativeControlFault: "forbidden_side_effect_import_detected",
    verifyFunctionName: "checkKernelPurity",
  }),
  Object.freeze({
    invariantId: "CAPABILITY_TRUTH_REGISTRY_1A",
    covenantClause: "Every shipped capability is measured, not asserted.",
    proseRule:
      "Each registered capability must cite source, test, review gate, and receipt evidence that exists on disk; no row may claim live execution.",
    executableGatePath: "scripts/review/dema-capability-truth-registry-check.mjs",
    negativeControlTestPath: "tests/dema-capability-truth-registry.test.js",
    negativeControlFault: "missing_source_or_preview_implies_execution",
    verifyFunctionName: "verifyDemaCapabilityTruthRegistry",
  }),
  Object.freeze({
    invariantId: "NO_OVERCLAIM_1A",
    covenantClause: "No claim exceeds the evidence on disk.",
    proseRule:
      "Changed files may not assert live network, federation, token value, or pure-marketing superlatives without a same-line truth label.",
    executableGatePath: "scripts/review/no-overclaim.mjs",
    negativeControlTestPath: "tests/no-overclaim.test.js",
    negativeControlFault: "overclaim_pattern_or_hard_fail_bombast_detected",
    verifyFunctionName: "classifyLine",
  }),
  Object.freeze({
    invariantId: "ARTIFACT_011_READ_ONLY_HOME_1A",
    covenantClause: "Local state stays under DEMA_HOME; HOME stays read-only.",
    proseRule:
      "The preflight ceremony must honor --home/DEMA_HOME and fall back to tmpdir on a read-only HOME without writing outside the sandbox.",
    executableGatePath: "scripts/review/artifact-011-preflight-gate.mjs",
    negativeControlTestPath: "tests/artifact-011-preflight-gate.test.js",
    negativeControlFault: "preflight_wrote_outside_sandbox_or_ignored_home",
    verifyFunctionName: "runArtifact011PreflightGate",
  }),
  Object.freeze({
    invariantId: "SKILL_PROJECTION_PARITY_1A",
    covenantClause: "A projected skill matches its source byte-for-byte.",
    proseRule:
      "Each skill projection must hash-match its source directory; a drifted or missing projection fails closed.",
    executableGatePath: "scripts/skills/check-projection-parity.mjs",
    negativeControlTestPath: "tests/skill-manifest-preview.test.js",
    negativeControlFault: "projection_source_hash_mismatch",
    verifyFunctionName: "checkParity",
  }),
  Object.freeze({
    invariantId: "TRACE_DIAGNOSTIC_CONTRACT_1A",
    covenantClause: "No insight promotion without four-rail re-derivation.",
    proseRule:
      "A trace may be promoted only when provenance, consistency, disambiguation, and corroboration rails each pass with explicit limits.",
    executableGatePath: "scripts/review/dema-trace-diagnostic-contract-check.mjs",
    negativeControlTestPath: "tests/dema-trace-diagnostic-contract.test.js",
    negativeControlFault: "rail_failure_or_tampered_promotion_detected",
    verifyFunctionName: "verifyTraceDiagnosticContract",
  }),
  Object.freeze({
    invariantId: "ZERO_SPIN_EXECUTION_GATE_1A",
    covenantClause: "No step is spent without verifiable progress toward the goal.",
    proseRule:
      "A step sequence must converge (OK:VERIFIED) or be classified as the first falsifiable spin (F-I ctx_spin, F-II ctx_cycle, F-III action_stall) or F-IV budget_exhausted, with a tamper-evident linear receipt chain; telemetry noise is scrubbed and the context/action gates are orthogonal.",
    executableGatePath: "scripts/review/zero-spin-gate-check.mjs",
    negativeControlTestPath: "tests/zero-spin-gate.test.js",
    negativeControlFault: "spin_misclassified_or_tampered_receipt_chain_accepted",
    verifyFunctionName: "verifyZeroSpinReceiptChain",
  }),
]);
