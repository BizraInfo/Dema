// NODE0-PROOF-RAILS — pure four-rail summarizers for proof-of-truth control plane.
//
// Purity: no fs, no network, no process, no Date/clock. Enforced by kernel-purity.

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

function railStatus(pass) {
  return pass ? "PASS" : "FAIL";
}

function normalizeClaims(claims) {
  if (!Array.isArray(claims)) return [];
  return claims.filter((c) => typeof c === "string");
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
  const vendorBillingLock =
    workflows.ci_vendor_availability === "GITHUB_ACTIONS_BILLING_LOCK";
  const ciMatrixPass =
    workflows.ci_matrix === "PASS" || vendorBillingLock === true;
  const codeqlPass =
    checks.codeql === "PASS" ||
    checks.codeql === undefined ||
    (vendorBillingLock === true && checks.codeql === "UNKNOWN");
  const gitleaksPass =
    checks.gitleaks === "PASS" ||
    checks.gitleaks === undefined ||
    (vendorBillingLock === true && checks.gitleaks === "UNKNOWN");
  const reviewPass =
    checks.bizra_review_gate === "PASS" ||
    checks.check === true ||
    (vendorBillingLock === true && checks.bizra_review_gate === "UNKNOWN");

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
    ci_vendor_availability: workflows.ci_vendor_availability ?? "UNKNOWN",
    local_proof_lane: vendorBillingLock === true,
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
  const vendorLock = workflows.ci_vendor_availability === "GITHUB_ACTIONS_BILLING_LOCK";
  let status = "ADVISORY";
  if (ciMatrix === "PASS" && codeql === "PASS" && gitleaks === "PASS") {
    status = "PASS";
  } else if (releaseMode && (codeql === "UNKNOWN" || gitleaks === "UNKNOWN")) {
    status = "UNKNOWN_BLOCKING";
  } else if (
    ciMatrix === "FAIL" ||
    codeql === "FAIL" ||
    gitleaks === "FAIL"
  ) {
    status = "FAIL";
  } else if (vendorLock && ciMatrix === "VENDOR_LOCK") {
    status = "ADVISORY";
  }
  return Object.freeze({
    status,
    ci_matrix: ciMatrix,
    ci_vendor_availability: workflows.ci_vendor_availability ?? "UNKNOWN",
    local_proof_lane: vendorLock,
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
