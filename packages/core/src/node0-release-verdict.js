// NODE0-RELEASE-VERDICT-KERNEL-1A — pure release verdict cap (READY_LOCAL max).
//
// Extracted from the proof-of-truth control plane so verdict logic is independently
// testable and hermetically gated. Max auto-verdict: READY_LOCAL.
//
// Purity: no fs, no network, no process, no Date/clock. Enforced by kernel-purity.

import {
  buildControlPlaneBoundary,
  detectEconomicOverclaim,
  summarizeCiCd,
  summarizeEconomicRail,
  summarizeEmpiricalRail,
  summarizeFormalRail,
} from "./node0-proof-rails.js";

export const NODE0_RELEASE_VERDICT_SCHEMA = "bizra.dema.node0_release_verdict.v0.1";

export const NODE0_RELEASE_VERDICT_TRUTH_LABEL = "NODE0_RELEASE_VERDICT_LOCAL_ONLY";

export const RELEASE_VERDICT_OVERCLAIM = Object.freeze(["READY_REMOTE", "PUBLIC_SAFE"]);

/** @deprecated use RELEASE_VERDICT_OVERCLAIM — kept for control-plane re-export parity */
export const CONTROL_PLANE_OVERCLAIM_VERDICTS = RELEASE_VERDICT_OVERCLAIM;

export const RELEASE_VERDICT_ALLOWED = Object.freeze(["BLOCKED", "READY_LOCAL"]);

export function computeReleaseVerdict({
  checks = {},
  workflows = {},
  coverage = {},
  perf = {},
  claims = [],
  boundaries = {},
  release_mode = false,
} = {}) {
  if (RELEASE_VERDICT_OVERCLAIM.some((v) => checks.release_verdict === v)) {
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

export function verifyReleaseVerdict(verdict) {
  const blocked_by = [];
  if (verdict == null || String(verdict).trim() === "") {
    blocked_by.push("verdict_missing");
  } else if (!RELEASE_VERDICT_ALLOWED.includes(verdict)) {
    blocked_by.push("verdict_not_allowed");
  }
  if (RELEASE_VERDICT_OVERCLAIM.includes(verdict)) {
    blocked_by.push("overclaim_verdict");
  }
  return Object.freeze({ ok: blocked_by.length === 0, blocked_by: Object.freeze(blocked_by) });
}
