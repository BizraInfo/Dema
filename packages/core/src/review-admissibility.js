// REVIEW-ADMISSIBILITY — a review STATUS is an execution receipt, not a verdict
// receipt (IDENTITY-POST-MERGE-CONVERGENCE-1C governance finding).
//
// A green "review ran" status must never be read as "review found nothing
// blocking." PR #412 merged on all-green checks while the reviewer's final
// report still listed blocking edge cases — the exact failure-laundering class
// DEMA-FDE-DUAL-DIAGNOSTIC guards against. This pure kernel takes a normalized
// review result and returns an explicit promotion decision. No network, no
// vendor API — the caller supplies the normalized fixture.

export const REVIEW_ADMISSIBILITY_SCHEMA =
  "bizra.dema.review_admissibility.v0.1";

const BLOCKING_SEVERITIES = new Set(["CRITICAL", "P0", "P1", "P2"]);

// result: { review_executed:bool, blocking_findings:int, highest_severity:str|null,
//           admissible:bool }
// Returns a frozen decision. MERGE_BLOCKED unless the review both executed AND
// concluded admissible with zero blocking findings. Missing/ill-typed input
// fails closed to MERGE_BLOCKED — an unproven verdict is not an admission.
export function evaluateReviewAdmissibility(result) {
  const reasons = [];

  const executed = result?.review_executed === true;
  if (!executed) reasons.push("review_not_executed");

  const findings = Number.isInteger(result?.blocking_findings)
    ? result.blocking_findings
    : null;
  if (findings === null) reasons.push("blocking_findings_unknown");
  else if (findings > 0) reasons.push("blocking_findings_present");

  const sev =
    typeof result?.highest_severity === "string"
      ? result.highest_severity.toUpperCase()
      : null;
  if (sev && BLOCKING_SEVERITIES.has(sev)) reasons.push("blocking_severity_present");

  // admissible must be an EXPLICIT true — absent/false is not an admission.
  const admissibleFlag = result?.admissible === true;
  if (!admissibleFlag) reasons.push("verdict_not_admissible");

  const decision =
    executed && findings === 0 && admissibleFlag && reasons.length === 0
      ? "MERGE_ALLOWED"
      : "MERGE_BLOCKED";

  return Object.freeze({
    schema: REVIEW_ADMISSIBILITY_SCHEMA,
    decision,
    review_executed: executed,
    blocking_findings: findings,
    highest_severity: sev,
    admissible: admissibleFlag,
    reasons: Object.freeze(reasons),
    boundary: Object.freeze({
      network_used: false,
      vendor_api_called: false,
      mutation_performed: false,
    }),
  });
}
