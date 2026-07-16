// DEMA-FDE-DUAL-DIAGNOSTIC-1A
//
// Deterministic inward (code/proof) and outward (environment) failure diagnosis.
// FDE diagnoses only — it does not patch, commit, push, merge, or execute.

import { createHash } from "node:crypto";

export const DEMA_FDE_DUAL_DIAGNOSTIC_SCHEMA =
  "bizra.dema.fde_dual_diagnostic.v0.2";
export const DEMA_FDE_DUAL_DIAGNOSTIC_LEGACY_SCHEMA =
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
  "github_actions_billing_lock",
  "unknown",
]);

export const FDE_CONFIDENCE_LEVELS = Object.freeze(["low", "medium", "high"]);

export const FDE_MEASURED_STATUSES = Object.freeze([
  "UNKNOWN",
  "HYPOTHESIS",
  "PARTIALLY_MEASURED",
  "MEASURED",
]);

export const FDE_BOUNDARY_KEYS = Object.freeze([
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

const BOUNDARY_ACTION_PATTERNS = Object.freeze([
  Object.freeze({
    evidence: "token_mint_action",
    pattern:
      /\b(?:mint|minted|minting)\s+(?:a\s+)?token\b|\btoken\s+mint(?:ed|ing)?\s+(?:requested|attempted|started|performed|enabled)\b/g,
  }),
  Object.freeze({
    evidence: "wallet_access_action",
    pattern:
      /\b(?:access|accessed|accessing)\s+(?:a\s+)?wallet\b|\bwallet\s+access\s+(?:requested|attempted|performed|enabled)\b/g,
  }),
  Object.freeze({
    evidence: "daemon_start_action",
    pattern:
      /\b(?:start|started|starting|launch|launched|enable|enabled)\s+(?:a\s+)?daemon\b|\bdaemon\s+(?:start|started|starting|launch|launched|enabled)\b/g,
  }),
  Object.freeze({
    evidence: "live_surface_action",
    pattern:
      /\blive\s+(?:urp|rsi|poi)\b(?:(?!\blive\s+(?:urp|rsi|poi)\b)[^.;,\n]){0,48}?\b(?:start|started|launch|launched|enable|enabled|invoke|invoked|requested)\b/g,
  }),
  Object.freeze({
    evidence: "federation_start_action",
    pattern:
      /\bfederation\s+(?:start|started|launch|launched|enable|enabled|invoke|invoked|requested)\b/g,
  }),
]);

// PR #396 P1 repair: the parent 1A classifier accepted bare machine sentinels
// (producers emit them without prose or `key: true` syntax). Dropping them let
// mixed evidence downgrade a hard stop to billing repair. A bare sentinel is
// positive evidence unless clause-negated or explicitly valued false — so the
// canonical all-false boundary JSON stays silent. Verb-suffixed forms are
// excluded here because BOUNDARY_ACTION_PATTERNS already owns them.
const BARE_BOUNDARY_SENTINEL_PATTERNS = Object.freeze([
  Object.freeze({
    evidence: "token mint",
    pattern:
      /\btoken\s+mint(?:ed|ing)?\b(?!\s+(?:requested|attempted|started|performed|enabled)\b)/g,
  }),
  Object.freeze({
    evidence: "wallet access",
    pattern:
      /\bwallet\s+access(?:ed)?\b(?!\s+(?:requested|attempted|performed|enabled)\b)/g,
  }),
  Object.freeze({ evidence: "live urp", pattern: /\blive\s+urp\b/g }),
  Object.freeze({ evidence: "live rsi", pattern: /\blive\s+rsi\b/g }),
  Object.freeze({ evidence: "live poi", pattern: /\blive\s+poi\b/g }),
  ...["wallet_accessed", "daemon_started", "network_used", "autopatch_performed"].map(
    (key) =>
      Object.freeze({
        evidence: key,
        pattern: new RegExp(
          `\\b${key}\\b(?!["']?\\s*[:=]\\s*(?:true|false)\\b)`,
          "g",
        ),
      }),
  ),
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
  "github actions",
  "gh pr checks",
  "gh run",
]);

const GITHUB_ACTIONS_BILLING_LOCK_MARKERS = Object.freeze([
  "account is locked",
  "billing issue",
  "due to a billing",
  "billing lock",
]);

const GITHUB_ACTIONS_STARTUP_FAIL_MARKERS = Object.freeze([
  "job was not started",
  "runner_id=0",
  "runner_id: 0",
  "log not found",
  "steps=[]",
  "runner_assigned: false",
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

function regexEscape(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const CLAUSE_BOUNDARY_PATTERN =
  /[.;,\n]|\b(?:although|but|however|later|then|yet)\b/g;
const PRE_ACTION_NEGATION_PATTERN =
  /(?:\b(?:blocked|denied|failed|forbidden|never|no|prevented|refused|without)\b|\b(?:are|can|could|did|do|does|had|has|have|is|should|was|were|will|would)\s+not\b|\bnot\b)(?:\W+(?:action|actually|allowed|any|attempt|attempted|attempting|authorization|authority|been|being|effort|evidence|ever|for|from|intent|intention|made|move|of|operation|permission|perform|performed|plan|planned|request|requested|sign|step|to|tried|try|trying))*\W*$/;
const POST_ACTION_NEGATION_PATTERN =
  /^\W*(?:(?:are|became|got|had|has|have|is|remained|remains|was|were)\W+)?(?:blocked|denied|disabled|disallowed|forbidden|never|not|prevented|refused|rejected)\b/;
const COMPLETED_ACTION_PATTERN =
  /\b(?:accessed|enabled|invoked|launched|minted|performed|started)\b/;

function clauseBefore(haystack, index) {
  const prefix = haystack.slice(0, index);
  let start = 0;
  for (const boundary of prefix.matchAll(CLAUSE_BOUNDARY_PATTERN)) {
    start = boundary.index + boundary[0].length;
  }
  return prefix.slice(start);
}

function clauseAfter(haystack, index) {
  const suffix = haystack.slice(index);
  const boundaryIndex = suffix.search(CLAUSE_BOUNDARY_PATTERN);
  return boundaryIndex === -1 ? suffix : suffix.slice(0, boundaryIndex);
}

function evidenceIsNegated(haystack, match, { postposed = true } = {}) {
  if (PRE_ACTION_NEGATION_PATTERN.test(clauseBefore(haystack, match.index))) {
    return true;
  }
  if (/\b(?:never|no|not|without)\b/.test(match[0])) return true;
  if (postposed && !COMPLETED_ACTION_PATTERN.test(match[0])) {
    return POST_ACTION_NEGATION_PATTERN.test(
      clauseAfter(haystack, match.index + match[0].length),
    );
  }
  return false;
}

function boundaryViolationHits(haystack) {
  const hits = [];
  for (const match of haystack.matchAll(/\b(?:fde:)?boundary_not_false:[a-z0-9_:-]*/g)) {
    if (!evidenceIsNegated(haystack, match)) {
      hits.push(match[0]);
    }
  }
  for (const key of [
    ...FDE_BOUNDARY_KEYS,
    "eligible_for_autopatch",
    "autopatch",
  ]) {
    const pattern = new RegExp(
      `["']?${regexEscape(key)}["']?\\s*[:=]\\s*true\\b`,
      "g",
    );
    for (const match of haystack.matchAll(pattern)) {
      if (!evidenceIsNegated(haystack, match, { postposed: false })) {
        hits.push(`${key}=true`);
      }
    }
  }
  for (const rule of BOUNDARY_ACTION_PATTERNS) {
    for (const match of haystack.matchAll(rule.pattern)) {
      if (!evidenceIsNegated(haystack, match)) {
        hits.push(rule.evidence);
        break;
      }
    }
  }
  for (const rule of BARE_BOUNDARY_SENTINEL_PATTERNS) {
    for (const match of haystack.matchAll(rule.pattern)) {
      if (!evidenceIsNegated(haystack, match)) {
        hits.push(rule.evidence);
        break;
      }
    }
  }
  return [...new Set(hits)];
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

function isGithubActionsContext(input) {
  const failedCommand = text(input.failed_command).toLowerCase();
  const env = input.environment && typeof input.environment === "object" ? input.environment : {};
  return (
    text(env.ci_provider).toLowerCase().includes("github") ||
    failedCommand.includes("github actions") ||
    failedCommand.includes("gh pr checks") ||
    failedCommand.includes("gh run")
  );
}

function classifyGithubActionsBillingLock(input, lens, { v01AnyLens = false } = {}) {
  // v0.2 keeps billing outward-only; the frozen v0.1 algorithm ran it on both
  // lenses and legacy rederivation must reproduce that behavior exactly.
  if (!v01AnyLens && lens !== "outward") return null;
  const haystack = combinedFailureText(input);
  const billingHits = countMarkerHits(haystack, GITHUB_ACTIONS_BILLING_LOCK_MARKERS);
  const startupHits = countMarkerHits(haystack, GITHUB_ACTIONS_STARTUP_FAIL_MARKERS);
  const env = input.environment && typeof input.environment === "object" ? input.environment : {};
  const runnerNotAssigned =
    env.runner_assigned === false ||
    env.runner_id === 0 ||
    haystack.includes("runner_id=0") ||
    haystack.includes("runner_id: 0");
  const githubContext = isGithubActionsContext(input);

  // The github_actions_billing_lock class is provider-specific: it opens the
  // LOCAL proof lane on the premise that REMOTE GitHub CI is billing-locked.
  // Billing prose alone (Stripe, AWS, npm, ...) must NOT manufacture it —
  // genuine GitHub context is required, or the lane could be opened by generic
  // input (DEMA-FDE-SEMANTIC-REDERIVATION-1B).
  if (billingHits.length > 0 && githubContext) {
    return {
      failure_class: "github_actions_billing_lock",
      hits: freezeDeep([...new Set([...billingHits, ...startupHits])]),
      confidence: "high",
    };
  }
  if (githubContext && runnerNotAssigned && startupHits.length >= 2) {
    return {
      failure_class: "github_actions_billing_lock",
      hits: freezeDeep(startupHits),
      confidence: "medium",
    };
  }
  return null;
}

function boundaryLensResult(input, boundaryHits) {
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

function classifyLens(input, lens) {
  const haystack = combinedFailureText(input);
  // A forbidden boundary is a hard stop and must dominate any lower-authority
  // environment diagnosis carried by the same evidence.
  const boundaryHits = boundaryViolationHits(haystack);
  if (boundaryHits.length > 0) {
    return boundaryLensResult(input, boundaryHits);
  }
  const billingLock = classifyGithubActionsBillingLock(input, lens);
  if (billingLock) return billingLock;
  return classifyLensSharedTail(input, lens, haystack);
}

// Shared below the boundary/billing precedence head: identical in v0.1 and
// v0.2. The frozen v0.1 fixture regression pins this against silent drift.
function classifyLensSharedTail(input, lens, haystack) {
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
  // Failure classification is authority-monotonic: a boundary stop cannot be
  // downgraded to an environment repair such as billing unlock.
  // NOTE: boundary precedence is primarily decided one layer down in
  // classifyLens (boundary is returned before billing there, and
  // combinedFailureText is lens-independent so both lenses agree on boundary
  // evidence). This guard is therefore defense-in-depth for the monotonicity
  // invariant — it holds even if a future change makes the lenses diverge.
  if (
    inward.failure_class === "boundary_violation" ||
    outward.failure_class === "boundary_violation"
  ) {
    return "boundary_violation";
  }
  if (
    outward.failure_class === "github_actions_billing_lock" &&
    outward.confidence !== "low"
  ) {
    return "github_actions_billing_lock";
  }
  return classifyPrimarySharedTail(inward, outward);
}

function classifyPrimarySharedTail(inward, outward) {
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
  if (outward.failure_class === "github_actions_billing_lock") {
    return `${prefix} Outward evidence indicates GitHub Actions jobs never started because the account is billing-locked; application code is not implicated until startup jobs run.`;
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

function deriveMeasuredStatus(failureClass, inward, outward) {
  if (
    failureClass === "github_actions_billing_lock" &&
    outward.failure_class === "github_actions_billing_lock" &&
    outward.confidence === "high"
  ) {
    return "MEASURED";
  }
  return deriveMeasuredStatusBase(inward, outward);
}

function deriveMeasuredStatusBase(inward, outward) {
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
  if (
    failure_class === "github_actions_billing_lock" ||
    outward.failure_class === "github_actions_billing_lock"
  ) {
    plan.push("Resolve GitHub account billing lock at https://github.com/settings/billing.");
    plan.push("Rerun failed Actions workflows after billing unlock; do not patch application code for startup-only CI failures.");
    plan.push("Confirm check-run annotations no longer report account locked due to a billing issue.");
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
          ci_provider: text(safeInput.environment.ci_provider),
          runner_assigned:
            typeof safeInput.environment.runner_assigned === "boolean"
              ? safeInput.environment.runner_assigned
              : null,
          runner_id:
            typeof safeInput.environment.runner_id === "number"
              ? safeInput.environment.runner_id
              : null,
        }
      : {
          node_version: "",
          os: "",
          branch: text(safeInput.branch),
          ci_provider: "",
          runner_assigned: null,
          runner_id: null,
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

// ---- Frozen v0.1 rederivation algorithm (parent DEMA-FDE-DUAL-DIAGNOSTIC-1A)
// Historical v0.1 reports predate the 1C precedence policy, so verifying one
// means re-deriving it under the algorithm that produced it — a schema label
// alone must never mint historical provenance (PR #396 P1). The frozen fixture
// tests/fixtures/dema-fde-dual-diagnostic-v0.1.json pins this section (and the
// shared tails above) against drift: editing any shared derivation input
// breaks that regression.
const V0_1_BOUNDARY_VIOLATION_MARKERS = Object.freeze([
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

function classifyLensLegacyV01(input, lens) {
  const billingLock = classifyGithubActionsBillingLock(input, lens, {
    v01AnyLens: true,
  });
  if (billingLock) return billingLock;
  const haystack = combinedFailureText(input);
  const boundaryHits = countMarkerHits(haystack, V0_1_BOUNDARY_VIOLATION_MARKERS);
  if (boundaryHits.length > 0) {
    return boundaryLensResult(input, boundaryHits);
  }
  return classifyLensSharedTail(input, lens, haystack);
}

function classifyPrimaryLegacyV01(inward, outward) {
  // Frozen v0.1 primary ordering: billing before boundary, as the parent
  // commit (403c674) shipped it. As in v0.2, both lens results already agree
  // on boundary/billing (classifyLensLegacyV01 decides one layer down over
  // lens-independent text), so this primary ordering is not independently
  // exercisable through the public API; it is preserved for byte-faithful
  // legacy rederivation, not as a live decision point.
  if (
    outward.failure_class === "github_actions_billing_lock" &&
    outward.confidence !== "low"
  ) {
    return "github_actions_billing_lock";
  }
  if (
    inward.failure_class === "boundary_violation" ||
    outward.failure_class === "boundary_violation"
  ) {
    return "boundary_violation";
  }
  return classifyPrimarySharedTail(inward, outward);
}

const FDE_ALGORITHM_V0_2 = Object.freeze({
  schema: DEMA_FDE_DUAL_DIAGNOSTIC_SCHEMA,
  classifyLens,
  classifyPrimary,
  deriveMeasuredStatus,
});

const FDE_ALGORITHM_V0_1 = Object.freeze({
  schema: DEMA_FDE_DUAL_DIAGNOSTIC_LEGACY_SCHEMA,
  classifyLens: classifyLensLegacyV01,
  classifyPrimary: classifyPrimaryLegacyV01,
  deriveMeasuredStatus: (_failureClass, inward, outward) =>
    deriveMeasuredStatusBase(inward, outward),
});

function buildDemaFdeDualDiagnosticInternal(input = {}, algo = FDE_ALGORITHM_V0_2) {
  const normalized = normalizeInput(input);
  const inward = algo.classifyLens(normalized, "inward");
  const outward = algo.classifyLens(normalized, "outward");
  const failure_class = algo.classifyPrimary(inward, outward);
  const measured_status = algo.deriveMeasuredStatus(failure_class, inward, outward);
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
    failure_class === "dependency_gap" ||
    failure_class === "github_actions_billing_lock";

  const body = {
    schema: algo.schema,
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
    code_implicated: failure_class === "github_actions_billing_lock" ? false : null,
    operator_action_required:
      failure_class === "github_actions_billing_lock" ? "billing_unlock" : null,
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

function verifyDemaFdeDualDiagnosticStructure(report, expectedSchema) {
  const blocked_by = [];
  if (!report || report.schema !== expectedSchema) {
    return ["invalid_schema"];
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
  return blocked_by;
}

export function verifyDemaFdeDualDiagnostic(report) {
  const blocked_by = verifyDemaFdeDualDiagnosticStructure(
    report,
    DEMA_FDE_DUAL_DIAGNOSTIC_SCHEMA,
  );
  if (blocked_by.includes("invalid_schema")) {
    return freezeDeep({
      ok: false,
      blocked_by,
      verification_mode: "semantic_rederivation_v0_2",
      authority_eligible: false,
    });
  }

  // Semantic re-derivation: the whole diagnosis is a pure function of its
  // carried input, so re-derive it and require the result to match. Internal
  // consistency (a body that agrees with its own recomputed hash) is NOT
  // enough — a forger can flip a derived field and recompute the hash. The
  // claim must match what its own input actually produces. This is
  // "verify must be input-bound", one layer above body-bound.
  // (Trusting the input's PROVENANCE — attacker-supplied but self-consistent
  // input — is the consumer's signing/consent concern, out of this scope.)
  if (!report.input || typeof report.input !== "object") {
    blocked_by.push("input_missing_for_rederivation");
  } else if (buildDemaFdeDualDiagnosticInternal(report.input).diagnostic_hash !== report.diagnostic_hash) {
    blocked_by.push("semantic_rederivation_mismatch");
  }

  return freezeDeep({
    ok: blocked_by.length === 0,
    blocked_by,
    verification_mode: "semantic_rederivation_v0_2",
    authority_eligible: blocked_by.length === 0,
  });
}

// Historical v0.1 reports remain replayable as evidence only. They predate
// the 1C precedence policy, so they must never open an authority lane or
// drive a current forwarding decision. Verification re-derives the whole
// diagnosis under the frozen v0.1 algorithm: relabeling a rejected v0.2
// report as v0.1 and rehashing it does not survive, because the fabricated
// classification is not what v0.1 derives from the carried input (PR #396 P1).
export function verifyLegacyDemaFdeDualDiagnosticIntegrity(report) {
  const blocked_by = verifyDemaFdeDualDiagnosticStructure(
    report,
    DEMA_FDE_DUAL_DIAGNOSTIC_LEGACY_SCHEMA,
  );
  if (blocked_by.includes("invalid_schema")) {
    return freezeDeep({
      ok: false,
      blocked_by,
      verification_mode: "legacy_v0_1_semantic_rederivation",
      authority_eligible: false,
    });
  }
  if (!report.input || typeof report.input !== "object") {
    blocked_by.push("input_missing_for_rederivation");
  } else if (
    buildDemaFdeDualDiagnosticInternal(report.input, FDE_ALGORITHM_V0_1)
      .diagnostic_hash !== report.diagnostic_hash
  ) {
    blocked_by.push("legacy_semantic_rederivation_mismatch");
  }
  return freezeDeep({
    ok: blocked_by.length === 0,
    blocked_by,
    verification_mode: "legacy_v0_1_semantic_rederivation",
    authority_eligible: false,
  });
}

export function verifyDemaFdeDualDiagnosticForHistoricalReceipt(report) {
  if (report?.schema === DEMA_FDE_DUAL_DIAGNOSTIC_SCHEMA) {
    return verifyDemaFdeDualDiagnostic(report);
  }
  if (report?.schema === DEMA_FDE_DUAL_DIAGNOSTIC_LEGACY_SCHEMA) {
    return verifyLegacyDemaFdeDualDiagnosticIntegrity(report);
  }
  return freezeDeep({
    ok: false,
    blocked_by: ["invalid_schema"],
    verification_mode: "unsupported",
    authority_eligible: false,
  });
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
