// NODE0-PROOF-OF-TRUTH-CONTROL-PLANE-1B — LOCAL_ONLY release proof ledger.
//
// Joins formal, cryptographic, empirical, and economic rails into one frozen
// verdict object. Max auto-verdict in 1A: READY_LOCAL. READY_REMOTE and
// PUBLIC_SAFE are overclaim verdicts rejected by verifyNode0ProofOfTruthControlPlane.
//
// Purity: no fs, no network, no process, no Date/clock. Enforced by kernel-purity.

import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import {
  buildControlPlaneBoundary,
  detectEconomicOverclaim,
  summarizeCiCd,
  summarizeCryptographicRail,
  summarizeDevops,
  summarizeEconomicRail,
  summarizeEmpiricalRail,
  summarizeFormalRail,
  summarizeManagementBok,
  summarizePerfQuality,
} from "./node0-proof-rails.js";
import {
  computeNextAction,
  computeReleaseVerdict,
  CONTROL_PLANE_OVERCLAIM_VERDICTS,
  RELEASE_VERDICT_OVERCLAIM,
} from "./node0-release-verdict.js";

export {
  buildControlPlaneBoundary,
  detectEconomicOverclaim,
  summarizeFormalRail,
  summarizeCryptographicRail,
  summarizeEmpiricalRail,
  summarizeEconomicRail,
  summarizeManagementBok,
  summarizeDevops,
  summarizeCiCd,
  summarizePerfQuality,
} from "./node0-proof-rails.js";

export {
  computeReleaseVerdict,
  computeNextAction,
  CONTROL_PLANE_OVERCLAIM_VERDICTS,
  RELEASE_VERDICT_OVERCLAIM,
  NODE0_RELEASE_VERDICT_SCHEMA,
  NODE0_RELEASE_VERDICT_TRUTH_LABEL,
  verifyReleaseVerdict,
} from "./node0-release-verdict.js";

export const NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_SCHEMA =
  "bizra.dema.node0_proof_of_truth_control_plane.v0.1";

export const NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_TRUTH_LABEL =
  "NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_LOCAL_ONLY";

function freezeDeep(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
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
  const claims = Array.isArray(input.claims)
    ? input.claims.filter((c) => typeof c === "string")
    : [];
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
