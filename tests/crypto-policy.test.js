/**
 * BIZRA-QSAFE-POLICY-GATE-1A tests
 *
 * Pure tests for the crypto policy gate. No side effects.
 * Extends 1A fail-closed reasoning to cryptographic policy.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  evaluateSignaturePolicy,
  QSAFE_REASON_CODES,
  QSAFE_POLICY_MODES,
} from "../packages/receipts/src/crypto-policy.js";

const CUTOVER = "2026-12-01T00:00:00Z";
const BEFORE = "2026-11-01T00:00:00Z";
const AFTER = "2026-12-15T00:00:00Z";

describe("BIZRA-QSAFE-POLICY-GATE-1A · crypto-policy", () => {
  it("legacy_receipt_before_cutover_passes", () => {
    const res = evaluateSignaturePolicy({
      artifactType: "canonical_receipt",
      createdAt: BEFORE,
      cutoverAt: CUTOVER,
      classicalAlg: "ed25519",
      classicalValid: true,
      pqAlg: null,
      pqValid: false,
    });
    assert.equal(res.allowed, true);
    assert.equal(res.settlementAllowed, true);
    assert.equal(res.reasonCodes.length, 0);
    assert.equal(res.requiredMode, QSAFE_POLICY_MODES.LEGACY_CLASSICAL_ALLOWED);
  });

  it("legacy_receipt_after_cutover_fails", () => {
    const res = evaluateSignaturePolicy({
      artifactType: "canonical_receipt",
      createdAt: AFTER,
      cutoverAt: CUTOVER,
      classicalAlg: "ed25519",
      classicalValid: true,
      pqAlg: null,
      pqValid: false,
    });
    assert.equal(res.allowed, false);
    assert.equal(res.settlementAllowed, false);
    assert.ok(
      res.reasonCodes.includes(QSAFE_REASON_CODES.HYBRID_SIGNATURE_REQUIRED),
    );
    assert.ok(
      res.reasonCodes.includes(QSAFE_REASON_CODES.PQ_SIGNATURE_MISSING),
    );
    assert.equal(
      res.requiredMode,
      QSAFE_POLICY_MODES.HYBRID_CLASSICAL_PQ_REQUIRED,
    );
  });

  it("hybrid_receipt_after_cutover_passes", () => {
    const res = evaluateSignaturePolicy({
      artifactType: "canonical_receipt",
      createdAt: AFTER,
      cutoverAt: CUTOVER,
      classicalAlg: "ed25519",
      classicalValid: true,
      pqAlg: "ML-DSA-65",
      pqValid: true,
      pqPublicKeyPresent: true,
      pqSecurityLevel: 3,
    });
    assert.equal(res.allowed, true);
    assert.equal(res.settlementAllowed, true);
    assert.equal(res.reasonCodes.length, 0);
    assert.equal(
      res.requiredMode,
      QSAFE_POLICY_MODES.HYBRID_CLASSICAL_PQ_REQUIRED,
    );
  });

  it("missing_pq_signature_after_cutover_fails", () => {
    const res = evaluateSignaturePolicy({
      artifactType: "canonical_receipt",
      createdAt: AFTER,
      cutoverAt: CUTOVER,
      classicalAlg: "ed25519",
      classicalValid: true,
      pqAlg: null,
      pqValid: false,
      pqPublicKeyPresent: false,
    });
    assert.equal(res.allowed, false);
    assert.ok(
      res.reasonCodes.includes(QSAFE_REASON_CODES.PQ_SIGNATURE_MISSING),
    );
  });

  it("invalid_pq_signature_after_cutover_fails", () => {
    const res = evaluateSignaturePolicy({
      artifactType: "canonical_receipt",
      createdAt: AFTER,
      cutoverAt: CUTOVER,
      classicalAlg: "ed25519",
      classicalValid: true,
      pqAlg: "ML-DSA-65",
      pqValid: false,
      pqPublicKeyPresent: true,
      pqSecurityLevel: 3,
    });
    assert.equal(res.allowed, false);
    assert.ok(
      res.reasonCodes.includes(QSAFE_REASON_CODES.PQ_SIGNATURE_INVALID),
    );
  });

  it("low_security_pq_after_cutover_fails", () => {
    const res = evaluateSignaturePolicy({
      artifactType: "canonical_receipt",
      createdAt: AFTER,
      cutoverAt: CUTOVER,
      classicalAlg: "ed25519",
      classicalValid: true,
      pqAlg: "ML-DSA-65",
      pqValid: true,
      pqPublicKeyPresent: true,
      pqSecurityLevel: 2,
    });
    assert.equal(res.allowed, false);
    assert.ok(
      res.reasonCodes.includes(QSAFE_REASON_CODES.PQ_SECURITY_LEVEL_TOO_LOW),
    );
  });

  it("checkpoint_requires_pq_signature", () => {
    const res = evaluateSignaturePolicy({
      artifactType: "checkpoint",
      createdAt: AFTER,
      cutoverAt: CUTOVER,
      classicalAlg: "ed25519",
      classicalValid: true,
      pqAlg: null,
      pqValid: false,
    });
    assert.equal(res.allowed, false);
    assert.ok(
      res.reasonCodes.includes(QSAFE_REASON_CODES.PQ_SIGNATURE_MISSING),
    );
    assert.equal(
      res.requiredMode,
      QSAFE_POLICY_MODES.PQ_ONLY_CHECKPOINT_REQUIRED,
    );
  });

  it("settlement_blocks_deprecated_crypto", () => {
    const res = evaluateSignaturePolicy({
      artifactType: "canonical_receipt",
      createdAt: AFTER,
      cutoverAt: CUTOVER,
      classicalAlg: "rsa", // deprecated
      classicalValid: true,
      pqAlg: "ML-DSA-65",
      pqValid: true,
      pqPublicKeyPresent: true,
      pqSecurityLevel: 3,
    });
    assert.equal(res.allowed, false);
    assert.equal(res.settlementAllowed, false);
    assert.ok(
      res.reasonCodes.includes(QSAFE_REASON_CODES.CRYPTO_ALGORITHM_DEPRECATED),
    );
  });

  it("downgrade_attack_detected", () => {
    // Example: after cutover, classical only with no PQ is treated as downgrade attempt
    const res = evaluateSignaturePolicy({
      artifactType: "canonical_receipt",
      createdAt: AFTER,
      cutoverAt: CUTOVER,
      classicalAlg: "ed25519",
      classicalValid: true,
      pqAlg: null,
    });
    assert.ok(
      res.reasonCodes.includes(QSAFE_REASON_CODES.HYBRID_SIGNATURE_REQUIRED),
    );
    // Additional downgrade label is added defensively in the implementation
    assert.ok(
      res.reasonCodes.includes(
        QSAFE_REASON_CODES.LEGACY_RECEIPT_AFTER_CUTOVER,
      ) || res.reasonCodes.includes(QSAFE_REASON_CODES.PQ_SIGNATURE_MISSING),
    );
  });
});
