/**
 * BIZRA-QSAFE-POLICY-GATE-1A
 *
 * Pure, dependency-free crypto policy gate for post-quantum hardening.
 * Classifies proof artifacts against a cutover date and required hybrid/PQ rules.
 *
 * Extends the 1A fail-closed doctrine:
 *   bad genesis → reject
 *   bad signature → reject
 *   quarantined → no settlement
 *   obsolete crypto policy → no settlement
 *
 * This is the "policy gate" growth ring. No PQC libraries are added.
 * Ed25519 flows remain unchanged for pre-cutover / legacy.
 *
 * Living system framing: adding a controlled, testable layer that lets the
 * organism evolve its DNA (crypto) without breaking existing proof spine.
 */

export const QSAFE_REASON_CODES = Object.freeze({
  CRYPTO_ALGORITHM_UNDECLARED: "CRYPTO_ALGORITHM_UNDECLARED",
  CRYPTO_ALGORITHM_DEPRECATED: "CRYPTO_ALGORITHM_DEPRECATED",
  HYBRID_SIGNATURE_REQUIRED: "HYBRID_SIGNATURE_REQUIRED",
  PQ_SIGNATURE_MISSING: "PQ_SIGNATURE_MISSING",
  PQ_SIGNATURE_INVALID: "PQ_SIGNATURE_INVALID",
  PQ_PUBLIC_KEY_MISSING: "PQ_PUBLIC_KEY_MISSING",
  PQ_KEY_EXPIRED: "PQ_KEY_EXPIRED",
  PQ_SECURITY_LEVEL_TOO_LOW: "PQ_SECURITY_LEVEL_TOO_LOW",
  HASH_ALGORITHM_DEPRECATED: "HASH_ALGORITHM_DEPRECATED",
  DOWNGRADE_ATTACK_DETECTED: "DOWNGRADE_ATTACK_DETECTED",
  LEGACY_RECEIPT_AFTER_CUTOVER: "LEGACY_RECEIPT_AFTER_CUTOVER",
  SETTLEMENT_BLOCKED_BY_CRYPTO_POLICY: "SETTLEMENT_BLOCKED_BY_CRYPTO_POLICY",
});

export const QSAFE_POLICY_MODES = Object.freeze({
  LEGACY_CLASSICAL_ALLOWED: "LEGACY_CLASSICAL_ALLOWED",
  HYBRID_CLASSICAL_PQ_REQUIRED: "HYBRID_CLASSICAL_PQ_REQUIRED",
  PQ_ONLY_CHECKPOINT_REQUIRED: "PQ_ONLY_CHECKPOINT_REQUIRED",
});

/**
 * Evaluate whether a proof artifact (receipt, ledger entry, checkpoint, etc.)
 * satisfies the current post-quantum policy.
 *
 * @param {Object} input
 * @param {string} input.artifactType - "canonical_receipt" | "ledger_entry" | "checkpoint" | ...
 * @param {string} input.createdAt - ISO timestamp of the artifact
 * @param {string} input.cutoverAt - ISO timestamp after which hybrid/PQ is required for live artifacts
 * @param {string} [input.classicalAlg] - e.g. "ed25519"
 * @param {boolean} [input.classicalValid]
 * @param {string} [input.pqAlg] - e.g. "ML-DSA-65"
 * @param {boolean} [input.pqValid]
 * @param {boolean} [input.pqPublicKeyPresent]
 * @param {number} [input.pqSecurityLevel]
 * @returns {{allowed: boolean, settlementAllowed: boolean, reasonCodes: string[], requiredMode: string}}
 */
export function evaluateSignaturePolicy({
  artifactType,
  createdAt,
  cutoverAt,
  classicalAlg,
  classicalValid,
  pqAlg,
  pqValid,
  pqPublicKeyPresent,
  pqSecurityLevel,
} = {}) {
  const reasons = [];

  if (!classicalAlg && !pqAlg) {
    reasons.push(QSAFE_REASON_CODES.CRYPTO_ALGORITHM_UNDECLARED);
  }

  const afterCutover =
    Boolean(createdAt && cutoverAt) &&
    Date.parse(createdAt) >= Date.parse(cutoverAt);

  if (afterCutover && artifactType !== "checkpoint") {
    const hasValidHybrid =
      classicalAlg === "ed25519" &&
      classicalValid === true &&
      pqAlg &&
      pqPublicKeyPresent === true &&
      pqValid === true &&
      Number(pqSecurityLevel ?? 0) >= 3;

    if (!hasValidHybrid) {
      reasons.push(QSAFE_REASON_CODES.HYBRID_SIGNATURE_REQUIRED);

      if (classicalAlg !== "ed25519" || classicalValid !== true) {
        reasons.push(QSAFE_REASON_CODES.CRYPTO_ALGORITHM_DEPRECATED);
      }

      if (!pqAlg) {
        reasons.push(QSAFE_REASON_CODES.PQ_SIGNATURE_MISSING);
      } else {
        if (pqPublicKeyPresent !== true) {
          reasons.push(QSAFE_REASON_CODES.PQ_PUBLIC_KEY_MISSING);
        }
        if (pqValid !== true) {
          reasons.push(QSAFE_REASON_CODES.PQ_SIGNATURE_INVALID);
        }
        if (Number(pqSecurityLevel ?? 0) < 3) {
          reasons.push(QSAFE_REASON_CODES.PQ_SECURITY_LEVEL_TOO_LOW);
        }
      }
    }
  }

  if (artifactType === "checkpoint" && !pqAlg) {
    reasons.push(QSAFE_REASON_CODES.PQ_SIGNATURE_MISSING);
  }

  // For legacy after cutover that somehow didn't hit the hybrid push (defensive)
  if (afterCutover && artifactType !== "checkpoint" && classicalAlg && !pqAlg) {
    if (!reasons.includes(QSAFE_REASON_CODES.LEGACY_RECEIPT_AFTER_CUTOVER)) {
      reasons.push(QSAFE_REASON_CODES.LEGACY_RECEIPT_AFTER_CUTOVER);
    }
  }

  const allowed = reasons.length === 0;
  const settlementAllowed = allowed; // for now; future may separate

  return Object.freeze({
    allowed,
    settlementAllowed,
    reasonCodes: Object.freeze(reasons),
    requiredMode:
      artifactType === "checkpoint"
        ? QSAFE_POLICY_MODES.PQ_ONLY_CHECKPOINT_REQUIRED
        : afterCutover
          ? QSAFE_POLICY_MODES.HYBRID_CLASSICAL_PQ_REQUIRED
          : QSAFE_POLICY_MODES.LEGACY_CLASSICAL_ALLOWED,
  });
}
