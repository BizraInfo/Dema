// DEMA-FDE-DUAL-DIAGNOSTIC-1A
//
// Deterministic inward (code/proof) and outward (environment) failure diagnosis.
// FDE diagnoses only — it does not patch, commit, push, merge, or execute.

import { createHash } from "node:crypto";

export const DEMA_FDE_DUAL_DIAGNOSTIC_SCHEMA =
  "bizra.dema.fde_dual_diagnostic.v0.1";
export const DEMA_FDE_DUAL_DIAGNOSTIC_TRUTH_LABEL =
  "DEMA_FDE_DUAL_DIAGNOSTIC_PREVIEW_ONLY";
export const DEMA_FDE_DUAL_DIAGNOSTIC_STAGE =
  "FDE_DUAL_DIAGNOSTIC_CLASSIFICATION_PREVIEW";

export const FDE_FAILURE_CLASSES = Object.freeze([
  "implementation_defect",
  "test_drift",
  "doc_drift",
  "environment_gap",
  "dependency_gap",
  "permission_gap",
  "proof_gap",
  "boundary_violation",
  "unknown",
]);

export const FDE_CONFIDENCE_LEVELS = Object.freeze(["low", "medium", "high"]);

export const FDE_MEASURED_STATUSES = Object.freeze([
  "UNKNOWN",
  "HYPOTHESIS",
  "PARTIALLY_MEASURED",
  "MEASURED",
]);

const FDE_BOUNDARY_KEYS = Object.freeze([
  "patch_applied",
  "file_write_performed",
  "network_used",
  "daemon_started",
  "autopatch_performed",
  "commit_performed",
  "push_performed",
  "merge_performed",
  "live_execution_performed",
  "token_minted",
  "wallet_accessed",
  "live_urp_started",
  "model_invocation_performed",
]);

const BOUNDARY_VIOLATION_MARKERS = Object.freeze([
  "token mint",
  "mint token",
  "wallet access",
  "wallet_accessed",
  "start daemon",
  "daemon_started",
  "network_used",
  "live urp",
  "live rsi",
  "live poi",
  "federation started",
  "autopatch_performed",
  "autopatch: true",
  "eligible_for_autopatch: true",
  "fde:boundary_not_false:",
  "boundary_not_false:",
]);

const PROOF_GAP_MARKERS = Object.freeze([
  "missing_source:",
  "missing_source_file",
  "missing_test:",
  "missing_test_file",
  "missing_review_gate:",
  "missing_receipt",
  "missing_evidence",
  "required_capability_not_measured_repo",
  "proof_gap",
]);

export const FDE_HHMM_PHASES = Object.freeze([
  "S0_OBSERVE_FAILURE",
  "S1_PARSE_EVIDENCE",
  "S2_CLASSIFY_INWARD",
  "S3_CLASSIFY_OUTWARD",
  "S4_COMPARE_DIFFERENTIAL",
  "S5_DECLARE_MEASURED_STATUS",
  "S6_PROPOSE_MINIMAL_FIX_PLAN",
  "S7_REQUIRE_CONSENT",
  "S8_BLOCK_AUTOPATCH",
]);

const CLASSIFICATION_RULES = Object.freeze([
  {
    failure_class: "permission_gap",
    inward_markers: ["eacces", "eperm", "permission denied"],
    outward_markers: ["eacces", "eperm", "permission denied"],
  },
  {
    failure_class: "dependency_gap",
    inward_markers: ["cannot find module", "missing script", "module not found"],
    outward_markers: ["npm err!", "enoent", "command not found"],
  },
  {
    failure_class: "doc_drift",
    inward_markers: [
      "doc-freshness",
      "doc-staleness",
      "doc freshness",
      "doc staleness",
      "documentation drift",
    ],
    outward_markers: ["doc-freshness", "doc-staleness"],
  },
  {
    failure_class: "environment_gap",
    inward_markers: ["kernel purity", "io tier"],
    outward_markers: [
      "node version",
      "econnrefused",
      "timed out",
      "etimedout",
      "sigtrap",
      "flaky",
      "wrong node",
    ],
  },
  {
    failure_class: "test_drift",
    inward_markers: [
      "not ok",
      "assertionerror",
      "assertion failed",
      "expected",
      "actual",
      "tests failed",
      "coverage threshold",
    ],
    outward_markers: ["test matrix", "node 20", "node 22"],
  },
  {
    failure_class: "implementation_defect",
    inward_markers: [
      "registry_hash_mismatch",
      "invalid_schema",
      "syntaxerror",
      "referenceerror",
      "typeerror",
      "blocked_by",
      "fail closed",
    ],
    outward_markers: [],
  },
]);

const INWARD_COMMAND_HINTS = Object.freeze([
  "npm test",
  "npm run check",
  "node --test",
  "scripts/review/",
  "kernel-purity",
  "no-overclaim",
]);

const OUTWARD_COMMAND_HINTS = Object.freeze([
  "dema setup",
  "dema status",
  "npm install",
  "node apps/cli",
]);

function freezeDeep(value) {
  if (!value || typeof value !== "object") return value;
  for (const child of Object.values(value)) freezeDeep(child);
  if (!Object.isFrozen(value)) Object.freeze(value);
  return value;
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item) ?? "null").join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .flatMap((key) => {
        const serialized = stableStringify(value[key]);
        return serialized === undefined ? [] : [`${JSON.stringify(key)}:${serialized}`];
      });
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function diagnosticHash(payload) {
  return `sha256:${sha256(stableStringify(payload))}`;
}

function text(value) {
  return typeof value === "string" ? value : "";
}

function normalizeExcerpt(value) {
  return text(value).trim().slice(0, 4000);
}

function combinedFailureText(input) {
  return `${normalizeExcerpt(input.stderr_excerpt)}\n${normalizeExcerpt(input.stdout_excerpt)}`.toLowerCase();
}

function countMarkerHits(haystack, markers) {
  const hits = [];
  for (const marker of markers) {
    if (haystack.includes(marker)) hits.push(marker);
  }
  return hits;
}

function scoreRules(haystack, lens) {
  const scored = [];
  for (const rule of CLASSIFICATION_RULES) {
    const markers =
      lens === "inward" ? rule.inward_markers : rule.outward_markers;
    const hits = countMarkerHits(haystack, markers);
    if (hits.length > 0) {
      scored.push({ failure_class: rule.failure_class, hits, score: hits.length });
    }
  }
  scored.sort((a, b) => b.score - a.score || a.failure_class.localeCompare(b.failure_class));
  return scored;
}

function confidenceFromHits(hits, commandHintMatch) {
  if (hits.length >= 2 || (hits.length === 1 && commandHintMatch)) return "high";
  if (hits.length === 1) return "medium";
  return "low";
}

function classifyLens(input, lens) {
  const haystack = combinedFailureText(input);
  const boundaryHits = countMarkerHits(haystack, BOUNDARY_VIOLATION_MARKERS);
  if (boundaryHits.length > 0) {
    const failedCommand = text(input.failed_command).toLowerCase();
    const commandHintMatch = INWARD_COMMAND_HINTS.some((hint) =>
      failedCommand.includes(hint),
    );
    return {
      failure_class: "boundary_violation",
      hits: freezeDeep(boundaryHits),
      confidence: confidenceFromHits(boundaryHits, commandHintMatch),
    };
  }
  if (lens === "inward") {
    const proofGapHits = countMarkerHits(haystack, PROOF_GAP_MARKERS);
    const failedCommand = text(input.failed_command).toLowerCase();
    const registryCheckFailure =
      failedCommand.includes("dema-capability-truth-registry-check") &&
      proofGapHits.length > 0;
    if (proofGapHits.length > 0) {
      const commandHintMatch = INWARD_COMMAND_HINTS.some((hint) =>
        failedCommand.includes(hint),
      );
      return {
        failure_class: "proof_gap",
        hits: freezeDeep(proofGapHits),
        confidence: confidenceFromHits(
          proofGapHits,
          commandHintMatch || registryCheckFailure,
        ),
      };
    }
    if (haystack.includes("registry_hash_mismatch") || haystack.includes("invalid_schema")) {
      const hits = countMarkerHits(haystack, [
        "registry_hash_mismatch",
        "invalid_schema",
        "blocked_by",
      ]).filter(Boolean);
      const commandHintMatch = INWARD_COMMAND_HINTS.some((hint) =>
        failedCommand.includes(hint),
      );
      return {
        failure_class: "implementation_defect",
        hits: hits.length > 0 ? hits : ["registry_hash_mismatch"],
        confidence: confidenceFromHits(hits.length > 0 ? hits : ["registry_hash_mismatch"], commandHintMatch),
      };
    }
  }
  const scored = scoreRules(haystack, lens);
  if (scored.length === 0) {
    return { failure_class: "unknown", hits: [], confidence: "low" };
  }
  const top = scored[0];
  const commandHints =
    lens === "inward" ? INWARD_COMMAND_HINTS : OUTWARD_COMMAND_HINTS;
  const failedCommand = text(input.failed_command).toLowerCase();
  const commandHintMatch = commandHints.some((hint) => failedCommand.includes(hint));
  return {
    failure_class: top.failure_class,
    hits: top.hits,
    confidence: confidenceFromHits(top.hits, commandHintMatch),
  };
}

function classifyPrimary(inward, outward) {
  if (
    inward.failure_class === "boundary_violation" ||
    outward.failure_class === "boundary_violation"
  ) {
    return "boundary_violation";
  }
  if (inward.failure_class === "proof_gap" && inward.confidence !== "low") {
    return "proof_gap";
  }
  if (inward.confidence === "high" && outward.confidence === "high") {
    if (inward.failure_class === outward.failure_class) return inward.failure_class;
    if (outward.failure_class === "environment_gap") return outward.failure_class;
    if (inward.failure_class === "implementation_defect") return inward.failure_class;
    return inward.failure_class;
  }
  if (inward.confidence === "high") return inward.failure_class;
  if (outward.confidence === "high") return outward.failure_class;
  if (inward.confidence === "medium") return inward.failure_class;
  if (outward.confidence === "medium") return outward.failure_class;
  return "unknown";
}

function symptomSummary(input) {
  const command = text(input.failed_command) || "unknown command";
  const code =
    typeof input.exit_code === "number" ? String(input.exit_code) : "unknown";
  return `Command "${command}" exited with code ${code}.`;
}

function inwardHypothesis(input, inward) {
  const symptom = symptomSummary(input);
  if (inward.failure_class === "implementation_defect") {
    return `${symptom} Inward evidence suggests a code, schema, verifier, or proof-gate defect in the checked-out tree.`;
  }
  if (inward.failure_class === "test_drift") {
    return `${symptom} Inward evidence suggests test expectation drift or a failing assertion in the repo proof surface.`;
  }
  if (inward.failure_class === "doc_drift") {
    return `${symptom} Inward evidence suggests documentation freshness or staleness drift relative to the repo gate.`;
  }
  if (inward.failure_class === "environment_gap") {
    return `${symptom} Inward markers may reflect an environment-sensitive proof gate (for example kernel purity IO tier classification).`;
  }
  if (inward.failure_class === "dependency_gap") {
    return `${symptom} Inward evidence suggests a missing module or script reference in the repository layout.`;
  }
  if (inward.failure_class === "proof_gap") {
    return `${symptom} Inward evidence suggests missing or incomplete proof evidence for a capability or review gate row.`;
  }
  if (inward.failure_class === "boundary_violation") {
    return `${symptom} Inward evidence suggests a forbidden live boundary was requested or implied in the failure output.`;
  }
  if (inward.failure_class === "permission_gap") {
    return `${symptom} Inward classification sees permission markers; confirm whether a proof script attempted disallowed IO.`;
  }
  return `${symptom} Inward root cause remains unclassified from the supplied excerpts.`;
}

function outwardHypothesis(input, outward) {
  const env = input.environment && typeof input.environment === "object"
    ? input.environment
    : {};
  const nodeVersion = text(env.node_version) || "unknown";
  const osName = text(env.os) || "unknown";
  const branch = text(env.branch) || text(input.branch) || "unknown";
  const prefix = `On ${osName} with Node ${nodeVersion} on branch ${branch}.`;
  if (outward.failure_class === "environment_gap") {
    return `${prefix} Outward evidence suggests a local environment mismatch, timeout, flaky harness, or unavailable local service.`;
  }
  if (outward.failure_class === "permission_gap") {
    return `${prefix} Outward evidence suggests filesystem or operator permission limits in this environment.`;
  }
  if (outward.failure_class === "dependency_gap") {
    return `${prefix} Outward evidence suggests install path, PATH, or npm execution context problems.`;
  }
  if (outward.failure_class === "doc_drift") {
    return `${prefix} Outward evidence may indicate doc gates failing because the working tree differs from expected docs state.`;
  }
  if (outward.failure_class === "test_drift") {
    return `${prefix} Outward evidence may indicate Node version matrix drift between local and CI expectations.`;
  }
  if (outward.failure_class === "boundary_violation") {
    return `${prefix} Outward evidence suggests the environment or operator context attempted a blocked live boundary.`;
  }
  return `${prefix} Outward root cause remains unclassified from the supplied environment summary.`;
}

function rootCauseHypothesis(failure_class, inward, outward) {
  if (failure_class === "unknown") {
    return "Symptom recorded; root cause unknown until additional stdout/stderr and environment evidence is supplied.";
  }
  if (inward.confidence === "high" && outward.confidence === "high" && inward.failure_class !== outward.failure_class) {
    return `Split diagnosis: inward=${inward.failure_class}, outward=${outward.failure_class}. Treat symptom separately from dominant failure_class=${failure_class}.`;
  }
  return `Dominant failure_class=${failure_class} with inward confidence ${inward.confidence} and outward confidence ${outward.confidence}.`;
}

function deriveMeasuredStatus(inward, outward) {
  if (inward.confidence === "high" && outward.confidence === "high") return "MEASURED";
  if (inward.confidence === "high" || outward.confidence === "high") {
    return "PARTIALLY_MEASURED";
  }
  if (inward.confidence === "medium" || outward.confidence === "medium") {
    return "HYPOTHESIS";
  }
  return "UNKNOWN";
}

function buildMinimalFixPlan(failure_class, inward, outward) {
  const plan = [];
  if (failure_class === "implementation_defect" || inward.failure_class === "implementation_defect") {
    plan.push("Reproduce with the narrowest focused test file before editing production code.");
    plan.push("Inspect verifier blocked_by codes and restore fail-closed invariants.");
  }
  if (failure_class === "test_drift" || inward.failure_class === "test_drift") {
    plan.push("Update the failing test only after confirming the product boundary intentionally changed.");
    plan.push("Run the focused test file, then npm test.");
  }
  if (failure_class === "doc_drift" || inward.failure_class === "doc_drift") {
    plan.push("Refresh docs/TESTING.md, docs/CURRENT_LIMITS.md, or receipt docs referenced by the failing gate.");
    plan.push("Re-run doc-freshness and doc-staleness gates.");
  }
  if (failure_class === "environment_gap" || outward.failure_class === "environment_gap") {
    plan.push("Record node -v, npm -v, branch, and DEMA_HOME before retrying.");
    plan.push("Retry on Node 22.x if the failure only appears on the advisory coverage/check path.");
  }
  if (failure_class === "dependency_gap" || outward.failure_class === "dependency_gap") {
    plan.push("Verify stdlib-only posture and that no undeclared npm packages were expected.");
    plan.push("Confirm the command is launched from the repository root.");
  }
  if (failure_class === "proof_gap" || inward.failure_class === "proof_gap") {
    plan.push("Restore missing source, test, review-gate, or receipt/doc evidence for the failing capability row.");
    plan.push("Re-run dema-capability-truth-registry-check.mjs --json after evidence is on disk.");
  }
  if (failure_class === "boundary_violation") {
    plan.push("Stop any live token, wallet, daemon, network, federation, or autopatch request.");
    plan.push("Return to preview-only surfaces until explicit operator consent and proof gates pass.");
  }
  if (failure_class === "permission_gap" || outward.failure_class === "permission_gap") {
    plan.push("Check filesystem permissions for DEMA_HOME, /tmp logs, and the workspace checkout.");
  }
  if (plan.length === 0) {
    plan.push("Collect full stderr/stdout and environment summary, then rerun FDE classification.");
  }
  return freezeDeep([...new Set(plan)]);
}

function missingEvidence(input, inward, outward) {
  const missing = [];
  if (!normalizeExcerpt(input.stderr_excerpt) && !normalizeExcerpt(input.stdout_excerpt)) {
    missing.push("stdout_or_stderr_excerpt");
  }
  if (!text(input.failed_command)) missing.push("failed_command");
  if (typeof input.exit_code !== "number") missing.push("exit_code");
  const env = input.environment;
  if (!env || typeof env !== "object") {
    missing.push("environment_summary");
  } else {
    if (!text(env.node_version)) missing.push("environment.node_version");
    if (!text(env.os)) missing.push("environment.os");
  }
  if (inward.confidence === "low") missing.push("inward_marker_evidence");
  if (outward.confidence === "low") missing.push("outward_marker_evidence");
  return freezeDeep([...new Set(missing)].sort());
}

function fdeBoundary() {
  return freezeDeep(Object.fromEntries(FDE_BOUNDARY_KEYS.map((key) => [key, false])));
}

function normalizeInput(input) {
  const safeInput = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const environment =
    safeInput.environment && typeof safeInput.environment === "object"
      ? {
          node_version: text(safeInput.environment.node_version),
          os: text(safeInput.environment.os),
          branch: text(safeInput.environment.branch) || text(safeInput.branch),
        }
      : {
          node_version: "",
          os: "",
          branch: text(safeInput.branch),
        };

  return freezeDeep({
    failed_command: text(safeInput.failed_command),
    exit_code: typeof safeInput.exit_code === "number" ? safeInput.exit_code : null,
    stdout_excerpt: normalizeExcerpt(safeInput.stdout_excerpt),
    stderr_excerpt: normalizeExcerpt(safeInput.stderr_excerpt),
    changed_files: Array.isArray(safeInput.changed_files)
      ? freezeDeep(
          [...new Set(safeInput.changed_files.map((item) => text(item).trim()).filter(Boolean))].sort(),
        )
      : Object.freeze([]),
    environment,
    capability_registry_row:
      text(safeInput.capability_registry_row) || "DEMA_FDE_DUAL_DIAGNOSTIC_1A",
  });
}

function buildLifecyclePhases() {
  return freezeDeep(
    FDE_HHMM_PHASES.map((phase) => ({
      phase,
      completed: true,
      terminal: phase === "S8_BLOCK_AUTOPATCH",
    })),
  );
}

export function buildDemaFdeDualDiagnostic(input = {}) {
  return buildDemaFdeDualDiagnosticInternal(input);
}

export function diagnoseDemaFailure(input = {}) {
  return buildDemaFdeDualDiagnosticInternal(input);
}

function buildDemaFdeDualDiagnosticInternal(input = {}) {
  const normalized = normalizeInput(input);
  const inward = classifyLens(normalized, "inward");
  const outward = classifyLens(normalized, "outward");
  const failure_class = classifyPrimary(inward, outward);
  const measured_status = deriveMeasuredStatus(inward, outward);
  const regression_test_required =
    (inward.confidence === "high" || inward.confidence === "medium") &&
    (failure_class === "implementation_defect" ||
      failure_class === "test_drift" ||
      inward.failure_class === "implementation_defect" ||
      inward.failure_class === "test_drift");
  const field_validation_required =
    outward.confidence === "high" ||
    outward.confidence === "medium" ||
    failure_class === "environment_gap" ||
    failure_class === "permission_gap" ||
    failure_class === "dependency_gap";

  const body = {
    schema: DEMA_FDE_DUAL_DIAGNOSTIC_SCHEMA,
    truth_label: DEMA_FDE_DUAL_DIAGNOSTIC_TRUTH_LABEL,
    stage: DEMA_FDE_DUAL_DIAGNOSTIC_STAGE,
    input: normalized,
    failure_class,
    symptom_summary: symptomSummary(normalized),
    root_cause_hypothesis: rootCauseHypothesis(failure_class, inward, outward),
    separates_symptom_from_root_cause: failure_class !== "unknown",
    inward_diagnosis: {
      question: "Why did it break in code/proof?",
      hypothesis: inwardHypothesis(normalized, inward),
      evidence: freezeDeep(inward.hits),
      confidence: inward.confidence,
      failure_class: inward.failure_class,
    },
    outward_diagnosis: {
      question: "Why did it break here?",
      hypothesis: outwardHypothesis(normalized, outward),
      evidence: freezeDeep(outward.hits),
      confidence: outward.confidence,
      failure_class: outward.failure_class,
    },
    measured_status,
    missing_evidence: missingEvidence(normalized, inward, outward),
    minimal_fix_plan: buildMinimalFixPlan(failure_class, inward, outward),
    regression_test_required,
    field_validation_required,
    consent_required: true,
    eligible_for_autopatch: false,
    capability_registry_reference: normalized.capability_registry_row,
    lifecycle_phases: buildLifecyclePhases(),
    terminal_state:
      measured_status === "MEASURED"
        ? "MEASURED_DIAGNOSIS"
        : measured_status === "PARTIALLY_MEASURED"
          ? "PARTIALLY_MEASURED_DIAGNOSIS"
          : measured_status === "UNKNOWN"
            ? "INSUFFICIENT_EVIDENCE"
            : "ESCALATE_TO_HUMAN",
    boundaries: fdeBoundary(),
    what_this_proves: [
      "Dema can classify a failed command into inward code/proof vs outward environment hypotheses without executing fixes.",
      "Failure classes, confidence, and missing evidence remain explicit and fail-closed.",
    ],
    what_this_does_not_prove: [
      "FDE does not patch files, commit, push, merge, start daemons, use networks, mint tokens, access wallets, or prove production readiness.",
      "A hypothesis is not ground truth until a focused test or field validation confirms it.",
    ],
  };

  return freezeDeep({
    ...body,
    diagnostic_hash: diagnosticHash(body),
  });
}

export function verifyDemaFdeDualDiagnostic(report) {
  const blocked_by = [];
  if (!report || report.schema !== DEMA_FDE_DUAL_DIAGNOSTIC_SCHEMA) {
    return freezeDeep({ ok: false, blocked_by: ["invalid_schema"] });
  }
  if (report.truth_label !== DEMA_FDE_DUAL_DIAGNOSTIC_TRUTH_LABEL) {
    blocked_by.push("invalid_truth_label");
  }
  if (report.stage !== DEMA_FDE_DUAL_DIAGNOSTIC_STAGE) {
    blocked_by.push("invalid_stage");
  }
  if (!FDE_FAILURE_CLASSES.includes(report.failure_class)) {
    blocked_by.push("unsupported_failure_class");
  }
  if (!FDE_MEASURED_STATUSES.includes(report.measured_status)) {
    blocked_by.push("unsupported_measured_status");
  }
  if (report.eligible_for_autopatch !== false) {
    blocked_by.push("autopatch_not_false");
  }
  if (report.consent_required !== true) {
    blocked_by.push("consent_not_required");
  }
  if (report.separates_symptom_from_root_cause !== (report.failure_class !== "unknown")) {
    blocked_by.push("symptom_root_cause_separation_mismatch");
  }
  for (const side of ["inward_diagnosis", "outward_diagnosis"]) {
    const diagnosis = report[side];
    if (!diagnosis || typeof diagnosis !== "object") {
      blocked_by.push(`${side}_missing`);
      continue;
    }
    if (!FDE_CONFIDENCE_LEVELS.includes(diagnosis.confidence)) {
      blocked_by.push(`${side}_confidence_invalid`);
    }
    if (!FDE_FAILURE_CLASSES.includes(diagnosis.failure_class)) {
      blocked_by.push(`${side}_failure_class_invalid`);
    }
    if (!text(diagnosis.hypothesis)) {
      blocked_by.push(`${side}_hypothesis_missing`);
    }
    if (!Array.isArray(diagnosis.evidence)) {
      blocked_by.push(`${side}_evidence_missing`);
    }
  }
  if (
    report.regression_test_required === true &&
    report.failure_class === "unknown" &&
    report.inward_diagnosis?.confidence === "low"
  ) {
    blocked_by.push("regression_required_without_inward_signal");
  }
  blocked_by.push(
    ...verifyFalseBoundary({
      boundary: report.boundaries,
      expectedKeys: FDE_BOUNDARY_KEYS,
      prefix: "fde",
    }),
  );
  const { diagnostic_hash: _omit, ...hashBody } = report;
  if (report.diagnostic_hash !== diagnosticHash(hashBody)) {
    blocked_by.push("diagnostic_hash_mismatch");
  }
  return freezeDeep({ ok: blocked_by.length === 0, blocked_by });
}

function verifyFalseBoundary({ boundary, expectedKeys, prefix }) {
  const blocked = [];
  if (!boundary || typeof boundary !== "object" || Array.isArray(boundary)) {
    return [`${prefix}:boundary_missing`];
  }
  const actualKeys = Object.keys(boundary).sort();
  for (const key of expectedKeys) {
    if (!actualKeys.includes(key)) blocked.push(`${prefix}:boundary_key_missing:${key}`);
    else if (boundary[key] !== false) blocked.push(`${prefix}:boundary_not_false:${key}`);
  }
  for (const key of actualKeys) {
    if (!expectedKeys.includes(key)) blocked.push(`${prefix}:boundary_key_extra:${key}`);
  }
  return blocked;
}

export function defaultDemaFdeDualDiagnosticFixture() {
  return freezeDeep({
    failed_command: "npm test",
    exit_code: 1,
    stdout_excerpt:
      "not ok 1 - registry output hash detects tampering\n  AssertionError: expected false to equal true",
    stderr_excerpt: "registry_hash_mismatch blocked_by",
    changed_files: ["packages/core/src/dema-capability-truth-registry.js"],
    environment: {
      node_version: "22.x",
      os: "linux",
      branch: "main",
    },
    capability_registry_row: "DEMA_FDE_DUAL_DIAGNOSTIC_1A",
  });
}

export function runDemaFdeDualDiagnosticGate({
  input = defaultDemaFdeDualDiagnosticFixture(),
  report,
} = {}) {
  const built = report ?? buildDemaFdeDualDiagnostic(input);
  const verified = verifyDemaFdeDualDiagnostic(built);
  const inward = built?.inward_diagnosis;
  const outward = built?.outward_diagnosis;
  return freezeDeep({
    ok: verified.ok,
    schema: DEMA_FDE_DUAL_DIAGNOSTIC_SCHEMA,
    truth_label: DEMA_FDE_DUAL_DIAGNOSTIC_TRUTH_LABEL,
    failure_class: built?.failure_class ?? "unknown",
    measured_status: built?.measured_status ?? "UNKNOWN",
    inward_confidence: inward?.confidence ?? "low",
    outward_confidence: outward?.confidence ?? "low",
    regression_test_required: built?.regression_test_required ?? false,
    field_validation_required: built?.field_validation_required ?? false,
    eligible_for_autopatch: built?.eligible_for_autopatch ?? false,
    diagnostic_hash: built?.diagnostic_hash ?? "",
    verified,
    report: built,
  });
}
