// NODE0-PROOF-OF-TRUTH-CONTROL-PLANE-1B — LOCAL_ONLY release proof ledger.
//
// Joins formal, cryptographic, empirical, and economic rails into one frozen
// verdict object. Max auto-verdict in 1A: READY_LOCAL. READY_REMOTE and
// PUBLIC_SAFE are overclaim verdicts rejected by verifyNode0ProofOfTruthControlPlane.
//
// Purity: no fs, no network, no process, no Date/clock. Enforced by kernel-purity.

import { sha256, stableStringify } from "../../consent/src/consent-common.js";

export const NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_SCHEMA =
  "bizra.dema.node0_proof_of_truth_control_plane.v0.1";

export const NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_TRUTH_LABEL =
  "NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_LOCAL_ONLY";

export const CONTROL_PLANE_OVERCLAIM_VERDICTS = Object.freeze([
  "READY_REMOTE",
  "PUBLIC_SAFE",
]);

const ECONOMIC_OVERCLAIM_PATTERNS = Object.freeze([
  /\bLIVE_TOKEN/i,
  /\bLIVE_POI/i,
  /\bLIVE_FEDERATION/i,
  /\bLIVE_URP/i,
  /\bECONOMY_ACTIVE_LIVE\b/i,
  /\bTOKEN_MINT(?:ED|ING)?_LIVE\b/i,
  /\bWALLET_ACTION_LIVE\b/i,
  /\bAUTONOMOUS_RUNTIME_ACTIVE\b/i,
]);

function freezeDeep(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

function railStatus(pass) {
  return pass ? "PASS" : "FAIL";
}

function normalizeClaims(claims) {
  if (!Array.isArray(claims)) return [];
  return claims.filter((c) => typeof c === "string");
}

export function detectEconomicOverclaim(claims = []) {
  const normalized = normalizeClaims(claims);
  for (const claim of normalized) {
    if (ECONOMIC_OVERCLAIM_PATTERNS.some((re) => re.test(claim))) {
      return true;
    }
    if (/\bLIVE/i.test(claim) && !/\bDESIGNED_NOT_LIVE\b/i.test(claim) && !/\bMEASURED\b/i.test(claim)) {
      if (/\b(TOKEN|POI|FEDERATION|URP|WALLET|ECONOMY)|LIVE_(TOKEN|POI|URP)/i.test(claim)) {
        return true;
      }
    }
  }
  return false;
}

export function buildControlPlaneBoundary(overrides = {}) {
  return Object.freeze({
    local_only: overrides.local_only !== false,
    no_network_required: overrides.no_network_required !== false,
    no_token_mint: overrides.no_token_mint !== false,
    no_wallet_action: overrides.no_wallet_action !== false,
    no_node1_activation: overrides.no_node1_activation !== false,
    no_urp_publication: overrides.no_urp_publication !== false,
    no_autonomous_runtime: overrides.no_autonomous_runtime !== false,
  });
}

function claimIsTruthLabeled(claim) {
  return (
    /\bMEASURED\b/i.test(claim) ||
    /_MEASURED$/i.test(claim) ||
    /\bDESIGNED_NOT_LIVE\b/i.test(claim) ||
    /_DESIGNED_NOT_LIVE$/i.test(claim) ||
    /\bLOCAL_ONLY\b/i.test(claim) ||
    /_LOCAL_ONLY$/i.test(claim) ||
    /\bPREVIEW_ONLY\b/i.test(claim) ||
    /_PREVIEW_ONLY$/i.test(claim) ||
    /\bDOCS_ONLY\b/i.test(claim) ||
    /_DOCS_ONLY$/i.test(claim)
  );
}

export function summarizeFormalRail(checks = {}, claims = []) {
  const normalized = normalizeClaims(claims);
  const claimsTruthLabeled =
    normalized.length === 0 || normalized.every((c) => claimIsTruthLabeled(c));
  return Object.freeze({
    status: railStatus(
      checks.schema !== false &&
        checks.invariants !== false &&
        checks.fail_closed !== false &&
        claimsTruthLabeled &&
        !detectEconomicOverclaim(normalized),
    ),
    schema_valid: checks.schema !== false,
    invariants_held: checks.invariants !== false,
    fail_closed_verifier: checks.fail_closed !== false,
    claims_truth_labeled: claimsTruthLabeled,
  });
}

export function summarizeCryptographicRail(checks = {}) {
  return Object.freeze({
    status: railStatus(checks.sha256 !== false),
    sha256_ledger: checks.sha256 !== false,
    local_operator_seal: checks.local_operator_seal ?? "PENDING",
    ci_remote_seal: checks.ci_remote_seal ?? "PENDING",
  });
}

export function summarizeEmpiricalRail(checks = {}, coverage = {}, perf = {}, workflows = {}) {
  const testsPass = checks.test === true;
  const coveragePresent = coverage.present === true;
  const coverageMet =
    !coveragePresent ||
    (typeof coverage.lines === "number" &&
      typeof coverage.threshold === "number" &&
      coverage.lines >= coverage.threshold);
  const perfPresent = perf.present === true;
  const perfMet =
    !perfPresent ||
    (typeof perf.boot_latency_ms === "number" &&
      typeof perf.ceiling === "number" &&
      perf.boot_latency_ms <= perf.ceiling);
  const deliveryPass = checks.delivery === true;
  const ciMatrixPass = workflows.ci_matrix === "PASS";
  const codeqlPass = checks.codeql === "PASS" || checks.codeql === undefined;
  const gitleaksPass = checks.gitleaks === "PASS" || checks.gitleaks === undefined;
  const reviewPass = checks.bizra_review_gate === "PASS" || checks.check === true;

  const pass =
    testsPass &&
    coveragePresent &&
    coverageMet &&
    perfPresent &&
    perfMet &&
    deliveryPass &&
    checks.check !== false &&
    ciMatrixPass &&
    codeqlPass &&
    gitleaksPass &&
    reviewPass;

  return Object.freeze({
    status: railStatus(pass),
    tests_pass: testsPass,
    coverage_met: coverageMet,
    coverage_present: coveragePresent,
    perf_met: perfMet,
    perf_present: perfPresent,
    delivery_check_pass: deliveryPass,
    ci_matrix_pass: ciMatrixPass,
    codeql_pass: codeqlPass,
    gitleaks_pass: gitleaksPass,
    bizra_review_gate_pass: reviewPass,
  });
}

export function summarizeEconomicRail(claims = [], boundaries = {}) {
  const overclaimed = detectEconomicOverclaim(claims);
  const boundaryIntact =
    boundaries.no_token_mint !== false &&
    boundaries.no_wallet_action !== false &&
    boundaries.no_node1_activation !== false &&
    boundaries.no_urp_publication !== false &&
    boundaries.no_autonomous_runtime !== false;

  const status = overclaimed ? "OVERCLAIMED" : "BLOCKED_UNLESS_MEASURED";

  return Object.freeze({
    status,
    active_claims: normalizeClaims(claims),
    boundary_blocked: boundaryIntact,
    live_token_claim: false,
    live_poi_reward_claim: false,
    live_federation_claim: false,
  });
}

export function summarizeManagementBok(checks = {}, risks = []) {
  const riskList = Array.isArray(risks) ? risks : [];
  const highOpen = riskList.some((r) => r?.severity === "HIGH" && r?.status !== "CLOSED");
  return Object.freeze({
    scope: "truth-labeled local proof cockpit",
    quality: checks.check === true ? "gate-driven" : "gate-pending",
    risk: highOpen ? "register-has-open-high" : "register-bound",
    communications: "public-safe receipt",
  });
}

export function summarizeDevops(workflows = {}) {
  return Object.freeze({
    value_stream:
      "plan → code → test → verify → seal → review → proof ledger → next action",
    local_operator_seal: workflows.local_operator_seal ?? "PENDING",
    ci_remote_seal: workflows.ci_remote_seal ?? "PENDING",
  });
}

export function summarizeCiCd(workflows = {}, releaseMode = false) {
  const codeql = workflows.codeql ?? "UNKNOWN";
  const gitleaks = workflows.gitleaks ?? "UNKNOWN";
  const ciMatrix = workflows.ci_matrix ?? "UNKNOWN";
  let status = "ADVISORY";
  if (ciMatrix === "PASS" && codeql === "PASS" && gitleaks === "PASS") {
    status = "PASS";
  } else if (releaseMode && (codeql === "UNKNOWN" || gitleaks === "UNKNOWN")) {
    status = "UNKNOWN_BLOCKING";
  } else if (ciMatrix === "FAIL" || codeql === "FAIL" || gitleaks === "FAIL") {
    status = "FAIL";
  }
  return Object.freeze({
    status,
    ci_matrix: ciMatrix,
    codeql,
    gitleaks,
    release_mode: releaseMode === true,
  });
}

export function summarizePerfQuality(perf = {}) {
  const value = perf.boot_latency_ms;
  const ceiling = perf.ceiling;
  const hasNumbers = typeof value === "number" && typeof ceiling === "number";
  const pass = hasNumbers && value <= ceiling;
  return Object.freeze({
    boot_latency_ms: hasNumbers
      ? Object.freeze({ value, ceiling, status: pass ? "PASS" : "FAIL" })
      : Object.freeze({ value: null, ceiling: null, status: "MISSING" }),
    mode: perf.mode ?? "A_PLUS_LOCAL_OR_CI_HEADROOM",
    slo_status: "REGRESSION_GATE_NOT_PRODUCTION_SLO",
  });
}

export function computeReleaseVerdict({
  checks = {},
  workflows = {},
  coverage = {},
  perf = {},
  claims = [],
  boundaries = {},
  release_mode = false,
} = {}) {
  if (CONTROL_PLANE_OVERCLAIM_VERDICTS.some((v) => checks.release_verdict === v)) {
    return "BLOCKED";
  }

  const resolvedBoundaries = buildControlPlaneBoundary(boundaries);
  const formal = summarizeFormalRail(checks, claims);
  const empirical = summarizeEmpiricalRail(checks, coverage, perf, workflows);
  const economic = summarizeEconomicRail(claims, resolvedBoundaries);
  const ci = summarizeCiCd(workflows, release_mode);

  if (formal.status === "FAIL") return "BLOCKED";
  if (economic.status === "OVERCLAIMED") return "BLOCKED";
  if (empirical.status === "FAIL") return "BLOCKED";
  if (checks.delivery === false) return "BLOCKED";
  if (coverage.present !== true) return "BLOCKED";
  if (perf.present !== true) return "BLOCKED";
  if (release_mode && ci.status === "UNKNOWN_BLOCKING") return "BLOCKED";
  if (ci.status === "FAIL") return "BLOCKED";

  return "READY_LOCAL";
}

export function computeNextAction(verdict, context = {}) {
  if (verdict === "READY_LOCAL") {
    if (context.workflows?.ci_remote_seal === "PENDING") {
      return "Push to main to verify remote CI seal";
    }
    return "Continue next bounded slice with proof ledger attached";
  }
  if (context.checks?.test === false) return "Fix failing unit tests";
  if (context.checks?.delivery === false) return "Fix delivery:check failures";
  if (context.coverage?.present !== true) return "Wire coverage rail into proof ledger";
  if (context.perf?.present !== true) return "Wire perf rail into proof ledger";
  if (detectEconomicOverclaim(context.claims)) {
    return "Remove live economic overclaims; keep BLOCKED_UNLESS_MEASURED";
  }
  if (context.release_mode && context.workflows?.codeql === "UNKNOWN") {
    return "Resolve CodeQL status before release-mode proof";
  }
  if (context.release_mode && context.workflows?.gitleaks === "UNKNOWN") {
    return "Resolve gitleaks status before release-mode proof";
  }
  return "Resolve blocking proof rails before release";
}

export const HERMETIC_CONTROL_PLANE_FIXTURE = Object.freeze({
  commit: "hermetic-control-plane-fixture-commit",
  checks: Object.freeze({
    schema: true,
    invariants: true,
    fail_closed: true,
    test: true,
    coverage: true,
    check: true,
    perf: true,
    delivery: true,
    sha256: true,
    codeql: "PASS",
    gitleaks: "PASS",
    bizra_review_gate: "PASS",
    local_operator_seal: "PASS",
    ci_remote_seal: "PENDING",
  }),
  workflows: Object.freeze({
    ci_matrix: "PASS",
    local_operator_seal: "PASS",
    ci_remote_seal: "PENDING",
    codeql: "PASS",
    gitleaks: "PASS",
  }),
  coverage: Object.freeze({ present: true, lines: 95, threshold: 80 }),
  perf: Object.freeze({
    present: true,
    boot_latency_ms: 120,
    ceiling: 150,
    mode: "A_PLUS_LOCAL_OR_CI_HEADROOM",
  }),
  claims: Object.freeze([]),
  risks: Object.freeze([
    Object.freeze({
      id: "R-HERMETIC-001",
      desc: "Hermetic fixture — not a live CI snapshot",
      severity: "LOW",
      status: "OPEN",
    }),
  ]),
  boundaries: buildControlPlaneBoundary(),
  release_mode: false,
});

export function buildNode0ProofOfTruthControlPlane(input = {}) {
  const commit = input.commit;
  if (commit === undefined || commit === null || String(commit).trim() === "") {
    throw new Error("node0_proof_of_truth_control_plane: commit hash required");
  }

  const checks = input.checks ?? {};
  const workflows = input.workflows ?? {};
  const coverage = input.coverage ?? {};
  const perf = input.perf ?? {};
  const claims = normalizeClaims(input.claims);
  const risks = Array.isArray(input.risks) ? input.risks : [];
  const boundaries = buildControlPlaneBoundary(input.boundaries ?? {});
  const release_mode = input.release_mode === true;

  const formal = summarizeFormalRail(checks, claims);
  const cryptographic = summarizeCryptographicRail(checks);
  const empirical = summarizeEmpiricalRail(checks, coverage, perf, workflows);
  const economic = summarizeEconomicRail(claims, boundaries);
  const management_bok = summarizeManagementBok(checks, risks);
  const devops = summarizeDevops(workflows);
  const ci_cd = summarizeCiCd(workflows, release_mode);
  const performance_quality = summarizePerfQuality(perf);

  const release_verdict = computeReleaseVerdict({
    checks,
    workflows,
    coverage,
    perf,
    claims,
    boundaries,
    release_mode,
  });

  const next_action = computeNextAction(release_verdict, {
    checks,
    workflows,
    coverage,
    perf,
    claims,
    release_mode,
  });

  const body = {
    schema: NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_SCHEMA,
    truth_label: NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_TRUTH_LABEL,
    commit: String(commit),
    formal,
    cryptographic,
    empirical,
    economic,
    management_bok,
    devops,
    ci_cd,
    performance_quality,
    risk_register: risks,
    release_verdict,
    next_action,
    boundary: boundaries,
  };

  const receipt_hash = `sha256:${sha256(stableStringify(body))}`;
  return Object.freeze({ ...body, receipt_hash });
}

export function verifyNode0ProofOfTruthControlPlane(ledger) {
  const blocked_by = [];

  if (!ledger || typeof ledger !== "object") {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["ledger_missing"]) });
  }
  if (ledger.schema !== NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_SCHEMA) {
    blocked_by.push("missing_schema");
  }
  if (ledger.truth_label !== NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_TRUTH_LABEL) {
    blocked_by.push("missing_truth_label");
  }
  if (!ledger.commit || String(ledger.commit).trim() === "") {
    blocked_by.push("missing_commit");
  }
  if (String(ledger.commit).trim() === "UNKNOWN") {
    blocked_by.push("commit_unknown_sentinel");
  }
  if (!ledger.receipt_hash || !String(ledger.receipt_hash).startsWith("sha256:")) {
    blocked_by.push("missing_receipt_hash");
  }

  const expectedBody = { ...ledger };
  delete expectedBody.receipt_hash;
  const expectedHash = `sha256:${sha256(stableStringify(expectedBody))}`;
  if (ledger.receipt_hash && ledger.receipt_hash !== expectedHash) {
    blocked_by.push("receipt_hash_mismatch");
  }

  if (CONTROL_PLANE_OVERCLAIM_VERDICTS.includes(ledger.release_verdict)) {
    blocked_by.push("overclaim_verdict");
  }

  const boundary = ledger.boundary ?? {};
  if (boundary.local_only !== true) blocked_by.push("boundary_local_only");
  if (boundary.no_network_required !== true) blocked_by.push("boundary_no_network_required");
  if (boundary.no_token_mint !== true) blocked_by.push("boundary_no_token_mint");
  if (boundary.no_wallet_action !== true) blocked_by.push("boundary_no_wallet_action");
  if (boundary.no_node1_activation !== true) blocked_by.push("boundary_no_node1_activation");
  if (boundary.no_urp_publication !== true) blocked_by.push("boundary_no_urp_publication");
  if (boundary.no_autonomous_runtime !== true) blocked_by.push("boundary_no_autonomous_runtime");

  if (ledger.economic?.status === "OVERCLAIMED") {
    blocked_by.push("economic_overclaim");
  }

  if (ledger.empirical?.delivery_check_pass === false) {
    blocked_by.push("delivery_check_failed");
  }
  if (ledger.empirical?.coverage_present === false) {
    blocked_by.push("coverage_rail_missing");
  }
  if (ledger.empirical?.perf_present === false) {
    blocked_by.push("perf_rail_missing");
  }
  if (ledger.empirical?.status === "FAIL") {
    blocked_by.push("empirical_rail_failed");
  }
  if (ledger.formal?.status === "FAIL") {
    blocked_by.push("formal_rail_failed");
  }

  if (ledger.ci_cd?.release_mode === true) {
    if (ledger.ci_cd?.codeql === "UNKNOWN") blocked_by.push("codeql_unknown_release_mode");
    if (ledger.ci_cd?.gitleaks === "UNKNOWN") blocked_by.push("gitleaks_unknown_release_mode");
  }

  if (ledger.release_verdict === "READY_LOCAL" || ledger.release_verdict === "READY_REMOTE") {
    if (blocked_by.length > 0) {
      blocked_by.push("status_summary_mismatch");
    }
  }

  return Object.freeze({ ok: blocked_by.length === 0, blocked_by: Object.freeze(blocked_by) });
}

export function runNode0ProofOfTruthControlPlane(input = {}) {
  const ledger = buildNode0ProofOfTruthControlPlane(input);
  const verified = verifyNode0ProofOfTruthControlPlane(ledger);
  return freezeDeep({
    ok: verified.ok,
    schema: NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_SCHEMA,
    truth_label: NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_TRUTH_LABEL,
    verified,
    ledger,
  });
}
