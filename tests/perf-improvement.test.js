// PERF-1B · Performance Regression Guard Slice tests
//
// Covers the 6 testable DOD criteria from PERF_0_PREFLIGHT.md §10:
//   1. Happy path: baseline + new_metrics with 1 improved + 1 regressed + 12
//      unchanged → verified, interpretation correct.
//   2. Tampered interpretation (claim "improved" when rule says
//      "regressed") → verdict_rederivation_mismatch.
//   3. Tampered delta (wrong subtraction) → delta_mismatch.
//   4. baseline_proof_hash references different baseline than supplied →
//      baseline_proof_hash_mismatch.
//   5. consent_scope.action_type ≠ "CLAIM_OPTIMIZATION" →
//      consent_scope_mismatch.
//   6. No PRIVATE KEY material in envelope.
//
// Pure kernel — caller supplies baselineProofHash + newMetrics +
// interpretationRuleId + satReviewReceiptHash + consentProof. No CLI,
// no integration, no measurement.
//
// Schema reference: docs/security/PERF_0_PREFLIGHT.md §3.2.
// Verification flow reference: docs/security/PERF_0_PREFLIGHT.md §5 steps 3–8
// (steps trimmed to the subset PERF-1B implements; cross-bundle SAT review
// signature + host_fingerprint mismatch + same-key invariant are
// out-of-scope for THIS slice per task constraints).

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildImprovement,
  verifyImprovement,
  buildSatReviewReceipt,
  SAT_REVIEW_RECEIPT_SCHEMA,
  PERF_IMPROVEMENT_SCHEMA,
  PERF_IMPROVEMENT_ACTION_TYPE,
  INTERPRETATION_RULE_V01,
} from "../packages/perf/src/perf-improvement.js";
import { generateEd25519Keypair } from "../packages/receipts/src/authorship-signature.js";
import {
  buildBaseline,
  REQUIRED_METRICS,
  PERF_BASELINE_ACTION_TYPE,
} from "../packages/perf/src/perf-baseline.js";
import { buildConsentProof } from "../packages/receipts/src/consent-proof.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
  loadPublicKey,
} from "../packages/receipts/src/authorship-key-store.js";
import {
  sha256,
  stableStringify,
} from "../packages/consent/src/consent-common.js";

const FIXED_BASELINE_CREATED = "2026-05-30T08:00:00.000Z";
const FIXED_IMPROVEMENT_CREATED = "2026-05-30T09:00:00.000Z";
const FIXED_CONSENT_CREATED = "2026-05-30T08:59:00.000Z";
const FIXED_CONSENT_EXPIRES = "2026-05-30T09:10:00.000Z";
const FIXED_NONCE_A = "feedface".repeat(8); // 64 hex chars
const FIXED_NONCE_B = "deadbeef".repeat(8);
const FIXED_NONCE_C = "cafebabe".repeat(8);
const FIXED_SAT_REVIEW_HASH = "9".repeat(64);

const BASELINE_METRICS = Object.freeze({
  dema_boot_latency_ms: 120.0,
  mission_selection_latency_ms: 14.0,
  consent_proof_build_latency_ms: 9.0,
  consent_proof_verify_latency_ms: 6.0,
  receipt_write_latency_ms: 3.0,
  verification_latency_ms: 22.0,
  test_check_runtime_ms: 54000,
  memory_rss_mb: 88.0,
  cpu_utilization_pct: 12.0,
  gpu_utilization_pct: 0,
  disk_usage_mb: 412.0,
  token_settlement_time_ms: 0,
  poi_scoring_time_ms: 0,
  regression_count: 0,
});

// dema_boot_latency_ms drops by 10% → "improved" (lower-is-better latency).
// mission_selection_latency_ms grows by 10% → "regressed".
// All other 12 metrics unchanged.
const NEW_METRICS = Object.freeze({
  ...BASELINE_METRICS,
  dema_boot_latency_ms: 108.0, // -10%
  mission_selection_latency_ms: 15.4, // +10%
});

const MEASUREMENT_CONTEXT = Object.freeze({
  host_fingerprint: "a".repeat(64),
  node_version: "v22.4.0",
  run_count: 5,
  env_hash: "b".repeat(64),
});

async function freshHome() {
  return await mkdtemp(join(tmpdir(), "dema-perf-improvement-test-"));
}

async function mintBaseline(home) {
  const targetHash = sha256(
    stableStringify({
      baseline_metrics: BASELINE_METRICS,
      measurement_context: MEASUREMENT_CONTEXT,
    }),
  );
  const consent = await buildConsentProof({
    phrase: "SIGN AUTHORSHIP RECEIPT",
    actionScope: {
      action_type: PERF_BASELINE_ACTION_TYPE,
      target_hash: targetHash,
    },
    demaHome: home,
    nonce: FIXED_NONCE_A,
    createdAtIso: FIXED_CONSENT_CREATED,
    expiresAtIso: FIXED_CONSENT_EXPIRES,
  });
  const b = await buildBaseline({
    baseline_metrics: BASELINE_METRICS,
    measurement_context: MEASUREMENT_CONTEXT,
    consentProof: consent.consent_proof,
    demaHome: home,
    createdAtIso: FIXED_BASELINE_CREATED,
  });
  assert.equal(b.built, true, `baseline mint failed: ${b.error || ""}`);
  return b.baseline;
}

async function mintImprovementConsent({
  home,
  baselineProofHash,
  newMetrics = NEW_METRICS,
  satReviewReceiptHash = FIXED_SAT_REVIEW_HASH,
  interpretationRuleId = INTERPRETATION_RULE_V01,
  actionType = PERF_IMPROVEMENT_ACTION_TYPE,
  nonce = FIXED_NONCE_B,
}) {
  // target_hash binds consent to the (baselineProofHash, newMetrics,
  // interpretationRuleId, satReviewReceiptHash) tuple — the same
  // metrics+context binding pattern PERF-1A used.
  const targetHash = sha256(
    stableStringify({
      baseline_proof_hash: baselineProofHash,
      new_metrics: newMetrics,
      interpretation_rule_id: interpretationRuleId,
      sat_review_receipt_hash: satReviewReceiptHash,
    }),
  );
  const c = await buildConsentProof({
    phrase: "SIGN AUTHORSHIP RECEIPT",
    actionScope: { action_type: actionType, target_hash: targetHash },
    demaHome: home,
    nonce,
    createdAtIso: FIXED_CONSENT_CREATED,
    expiresAtIso: FIXED_CONSENT_EXPIRES,
  });
  return c.consent_proof;
}

async function buildOk(overrides = {}) {
  const home = await freshHome();
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home });
  const baseline = await mintBaseline(home);
  const consentProof = await mintImprovementConsent({
    home,
    baselineProofHash: baseline.baseline_proof_hash,
  });
  const result = await buildImprovement({
    baselineProofHash: baseline.baseline_proof_hash,
    baselineMetrics: BASELINE_METRICS,
    newMetrics: NEW_METRICS,
    interpretationRuleId: INTERPRETATION_RULE_V01,
    satReviewReceiptHash: FIXED_SAT_REVIEW_HASH,
    consentProof,
    demaHome: home,
    createdAtIso: FIXED_IMPROVEMENT_CREATED,
    ...overrides,
  });
  const pubkeyPem = await loadPublicKey(home);
  return { home, result, baseline, pubkeyPem };
}

describe("perf-improvement · buildImprovement happy path + envelope shape", () => {
  it("DOD-1 happy: 1 improved + 1 regressed + 12 unchanged → built:true, frozen envelope", async () => {
    const { home, result, baseline } = await buildOk();
    try {
      assert.equal(result.built, true);
      const imp = result.improvement;
      assert.equal(imp.schema, PERF_IMPROVEMENT_SCHEMA);
      assert.ok(
        typeof imp.improvement_id === "string" && imp.improvement_id.length > 0,
      );
      assert.equal(imp.baseline_proof_hash, baseline.baseline_proof_hash);
      assert.deepEqual(imp.new_metrics, NEW_METRICS);
      assert.equal(imp.interpretation_rule_id, INTERPRETATION_RULE_V01);
      assert.equal(imp.sat_review_receipt_hash, FIXED_SAT_REVIEW_HASH);
      assert.equal(imp.prev_hash, null);
      assert.equal(imp.created_at_iso, FIXED_IMPROVEMENT_CREATED);
      assert.ok(/^[a-f0-9]{64}$/.test(imp.operator_public_key_fingerprint));
      assert.ok(
        typeof imp.improvement_signature_b64 === "string" &&
          imp.improvement_signature_b64.length > 0,
      );
      assert.ok(/^[a-f0-9]{64}$/.test(imp.improvement_proof_hash));
      assert.ok(/^[a-f0-9]{64}$/.test(imp.consent_proof_hash));

      // Delta = new - baseline per metric.
      assert.equal(
        imp.delta.dema_boot_latency_ms,
        NEW_METRICS.dema_boot_latency_ms -
          BASELINE_METRICS.dema_boot_latency_ms,
      );
      assert.equal(
        imp.delta.mission_selection_latency_ms,
        NEW_METRICS.mission_selection_latency_ms -
          BASELINE_METRICS.mission_selection_latency_ms,
      );
      // Unchanged metrics — delta exactly 0.
      assert.equal(imp.delta.disk_usage_mb, 0);
      assert.equal(imp.delta.cpu_utilization_pct, 0);
      assert.equal(imp.delta.regression_count, 0);

      // Interpretation: improved / regressed / unchanged labels.
      assert.equal(imp.interpretation.dema_boot_latency_ms, "improved");
      assert.equal(
        imp.interpretation.mission_selection_latency_ms,
        "regressed",
      );
      assert.equal(imp.interpretation.disk_usage_mb, "unchanged");
      assert.equal(imp.interpretation.gpu_utilization_pct, "unchanged");
      assert.equal(imp.interpretation.regression_count, "unchanged");

      assert.ok(Object.isFrozen(imp));
      assert.ok(Object.isFrozen(imp.delta));
      assert.ok(Object.isFrozen(imp.interpretation));
      assert.ok(Object.isFrozen(imp.new_metrics));
      assert.ok(Object.isFrozen(result));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-6 envelope contains NO private key material", async () => {
    const { home, result } = await buildOk();
    try {
      assert.equal(result.built, true);
      const envStr = JSON.stringify(result);
      assert.ok(!envStr.includes("BEGIN PRIVATE KEY"));
      assert.ok(!envStr.includes("PRIVATE KEY"));
      assert.equal(result.improvement.private_key, undefined);
      assert.equal(result.improvement.private_key_pem, undefined);
      assert.equal(result.improvement.private_key_loaded, undefined);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("improvement_proof_hash recomputes from body excluding signature_b64 + proof_hash", async () => {
    const { home, result } = await buildOk();
    try {
      const imp = result.improvement;
      const {
        improvement_signature_b64: _s,
        improvement_proof_hash: _h,
        ...body
      } = imp;
      const recomputed = sha256(stableStringify(body));
      assert.equal(recomputed, imp.improvement_proof_hash);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("determinism: identical inputs (same consent, hashes, created_at) → deep-equal envelopes", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const baseline = await mintBaseline(home);
      const consent = await mintImprovementConsent({
        home,
        baselineProofHash: baseline.baseline_proof_hash,
      });
      const a = await buildImprovement({
        baselineProofHash: baseline.baseline_proof_hash,
        baselineMetrics: BASELINE_METRICS,
        newMetrics: NEW_METRICS,
        interpretationRuleId: INTERPRETATION_RULE_V01,
        satReviewReceiptHash: FIXED_SAT_REVIEW_HASH,
        consentProof: consent,
        demaHome: home,
        createdAtIso: FIXED_IMPROVEMENT_CREATED,
      });
      const b = await buildImprovement({
        baselineProofHash: baseline.baseline_proof_hash,
        baselineMetrics: BASELINE_METRICS,
        newMetrics: NEW_METRICS,
        interpretationRuleId: INTERPRETATION_RULE_V01,
        satReviewReceiptHash: FIXED_SAT_REVIEW_HASH,
        consentProof: consent,
        demaHome: home,
        createdAtIso: FIXED_IMPROVEMENT_CREATED,
      });
      assert.deepEqual(a, b);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: missing consentProof → built:false, error consent_proof_required", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const baseline = await mintBaseline(home);
      const r = await buildImprovement({
        baselineProofHash: baseline.baseline_proof_hash,
        baselineMetrics: BASELINE_METRICS,
        newMetrics: NEW_METRICS,
        interpretationRuleId: INTERPRETATION_RULE_V01,
        satReviewReceiptHash: FIXED_SAT_REVIEW_HASH,
        demaHome: home,
        createdAtIso: FIXED_IMPROVEMENT_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "consent_proof_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-5 fail-closed: consent_proof with wrong action_type → consent_scope_mismatch", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const baseline = await mintBaseline(home);
      const wrongScopeConsent = await mintImprovementConsent({
        home,
        baselineProofHash: baseline.baseline_proof_hash,
        actionType: "SOMETHING_ELSE",
        nonce: FIXED_NONCE_C,
      });
      const r = await buildImprovement({
        baselineProofHash: baseline.baseline_proof_hash,
        baselineMetrics: BASELINE_METRICS,
        newMetrics: NEW_METRICS,
        interpretationRuleId: INTERPRETATION_RULE_V01,
        satReviewReceiptHash: FIXED_SAT_REVIEW_HASH,
        consentProof: wrongScopeConsent,
        demaHome: home,
        createdAtIso: FIXED_IMPROVEMENT_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "consent_scope_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: missing any §14 metric in new_metrics → metric_<name>_required", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const baseline = await mintBaseline(home);
      const partial = { ...NEW_METRICS };
      delete partial.memory_rss_mb;
      const consent = await mintImprovementConsent({
        home,
        baselineProofHash: baseline.baseline_proof_hash,
        newMetrics: partial,
      });
      const r = await buildImprovement({
        baselineProofHash: baseline.baseline_proof_hash,
        baselineMetrics: BASELINE_METRICS,
        newMetrics: partial,
        interpretationRuleId: INTERPRETATION_RULE_V01,
        satReviewReceiptHash: FIXED_SAT_REVIEW_HASH,
        consentProof: consent,
        demaHome: home,
        createdAtIso: FIXED_IMPROVEMENT_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "metric_memory_rss_mb_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: no signing key on disk → no_authorship_key", async () => {
    const home = await freshHome();
    try {
      // No initAuthorshipKey. Build a synthetic consent — kernel must
      // bail before it ever consults it.
      const fakeConsent = {
        consent_proof_hash: "x".repeat(64),
        action_scope: {
          action_type: PERF_IMPROVEMENT_ACTION_TYPE,
          target_hash: "y".repeat(64),
        },
      };
      const r = await buildImprovement({
        baselineProofHash: "0".repeat(64),
        baselineMetrics: BASELINE_METRICS,
        newMetrics: NEW_METRICS,
        interpretationRuleId: INTERPRETATION_RULE_V01,
        satReviewReceiptHash: FIXED_SAT_REVIEW_HASH,
        consentProof: fakeConsent,
        demaHome: home,
        createdAtIso: FIXED_IMPROVEMENT_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "no_authorship_key");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: unknown interpretation_rule_id → interpretation_rule_unknown", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const baseline = await mintBaseline(home);
      const consent = await mintImprovementConsent({
        home,
        baselineProofHash: baseline.baseline_proof_hash,
        interpretationRuleId: "not-a-real-rule.v9",
      });
      const r = await buildImprovement({
        baselineProofHash: baseline.baseline_proof_hash,
        baselineMetrics: BASELINE_METRICS,
        newMetrics: NEW_METRICS,
        interpretationRuleId: "not-a-real-rule.v9",
        satReviewReceiptHash: FIXED_SAT_REVIEW_HASH,
        consentProof: consent,
        demaHome: home,
        createdAtIso: FIXED_IMPROVEMENT_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "interpretation_rule_unknown");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("INTERPRETATION_RULE_V01 has the expected canonical id", () => {
    assert.equal(INTERPRETATION_RULE_V01, "deterministic-threshold.v0.1");
  });

  it("interpretation labels: ≥1% lower → improved, ≥1% higher → regressed, within ±1% → unchanged", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const baseline = await mintBaseline(home);
      // Just-under-1% delta on dema_boot → unchanged
      const tinyDelta = {
        ...BASELINE_METRICS,
        dema_boot_latency_ms: BASELINE_METRICS.dema_boot_latency_ms * 0.995,
      };
      const consent = await mintImprovementConsent({
        home,
        baselineProofHash: baseline.baseline_proof_hash,
        newMetrics: tinyDelta,
      });
      const r = await buildImprovement({
        baselineProofHash: baseline.baseline_proof_hash,
        baselineMetrics: BASELINE_METRICS,
        newMetrics: tinyDelta,
        interpretationRuleId: INTERPRETATION_RULE_V01,
        satReviewReceiptHash: FIXED_SAT_REVIEW_HASH,
        consentProof: consent,
        demaHome: home,
        createdAtIso: FIXED_IMPROVEMENT_CREATED,
      });
      assert.equal(r.built, true);
      assert.equal(
        r.improvement.interpretation.dema_boot_latency_ms,
        "unchanged",
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("perf-improvement · verifyImprovement (DOD verify path)", () => {
  it("DOD-1 happy: verifies with matching pubkey + matching baseline → verified:true", async () => {
    const { home, result, baseline, pubkeyPem } = await buildOk();
    try {
      const v = verifyImprovement({
        improvement: result.improvement,
        baseline,
        pubkeyPem,
      });
      assert.equal(v.verified, true);
      assert.equal(
        v.improvement_proof_hash,
        result.improvement.improvement_proof_hash,
      );
      assert.equal(v.baseline_proof_hash, baseline.baseline_proof_hash);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-2 tampered interpretation (label flipped to 'improved' when rule says 'regressed') → verdict_rederivation_mismatch", async () => {
    // Mirrors verdict-receipt REJECT-2: an attacker re-signs with a fresh
    // foreign key after tampering, then presents that foreign key. Hash +
    // signature both pass — but the rule disagrees with the operator's
    // claim, so verdict_rederivation_mismatch surfaces.
    const { home, result, baseline } = await buildOk();
    try {
      const { generateEd25519Keypair, signPayload } =
        await import("../packages/receipts/src/authorship-signature.js");
      const foreign = generateEd25519Keypair();
      const {
        improvement_signature_b64: _s,
        improvement_proof_hash: _h,
        ...body
      } = result.improvement;
      const tamperedBody = {
        ...body,
        interpretation: Object.freeze({
          ...body.interpretation,
          mission_selection_latency_ms: "improved", // rule says regressed
        }),
      };
      const reHash = sha256(stableStringify(tamperedBody));
      const reSig = signPayload(tamperedBody, foreign.private_key_pem);
      const tampered = {
        ...tamperedBody,
        improvement_signature_b64: reSig,
        improvement_proof_hash: reHash,
      };
      const v = verifyImprovement({
        improvement: tampered,
        baseline,
        pubkeyPem: foreign.public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "verdict_rederivation_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-3 tampered delta (wrong subtraction) → delta_mismatch", async () => {
    // Same re-sign pattern as DOD-2: hash + signature pass, but the
    // verifier's per-metric (new - baseline) recompute disagrees with
    // the operator-claimed delta, so delta_mismatch surfaces.
    const { home, result, baseline } = await buildOk();
    try {
      const { generateEd25519Keypair, signPayload } =
        await import("../packages/receipts/src/authorship-signature.js");
      const foreign = generateEd25519Keypair();
      const {
        improvement_signature_b64: _s,
        improvement_proof_hash: _h,
        ...body
      } = result.improvement;
      const tamperedBody = {
        ...body,
        delta: Object.freeze({
          ...body.delta,
          dema_boot_latency_ms: 999, // not (new - baseline)
        }),
      };
      const reHash = sha256(stableStringify(tamperedBody));
      const reSig = signPayload(tamperedBody, foreign.private_key_pem);
      const tampered = {
        ...tamperedBody,
        improvement_signature_b64: reSig,
        improvement_proof_hash: reHash,
      };
      const v = verifyImprovement({
        improvement: tampered,
        baseline,
        pubkeyPem: foreign.public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "delta_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-4 baseline_proof_hash references different baseline than supplied → baseline_proof_hash_mismatch", async () => {
    const { home, result, pubkeyPem } = await buildOk();
    try {
      // Build a SECOND, different baseline to pass to verify.
      const otherHome = await freshHome();
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: otherHome,
      });
      const differentMetrics = {
        ...BASELINE_METRICS,
        dema_boot_latency_ms: 200.0,
      };
      const targetHash = sha256(
        stableStringify({
          baseline_metrics: differentMetrics,
          measurement_context: MEASUREMENT_CONTEXT,
        }),
      );
      const consent = await buildConsentProof({
        phrase: "SIGN AUTHORSHIP RECEIPT",
        actionScope: {
          action_type: PERF_BASELINE_ACTION_TYPE,
          target_hash: targetHash,
        },
        demaHome: otherHome,
        nonce: FIXED_NONCE_A,
        createdAtIso: FIXED_CONSENT_CREATED,
        expiresAtIso: FIXED_CONSENT_EXPIRES,
      });
      const otherBaselineResult = await buildBaseline({
        baseline_metrics: differentMetrics,
        measurement_context: MEASUREMENT_CONTEXT,
        consentProof: consent.consent_proof,
        demaHome: otherHome,
        createdAtIso: FIXED_BASELINE_CREATED,
      });
      const otherBaseline = otherBaselineResult.baseline;

      const v = verifyImprovement({
        improvement: result.improvement,
        baseline: otherBaseline,
        pubkeyPem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "baseline_proof_hash_mismatch");
      await rm(otherHome, { recursive: true, force: true });
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-5 consent_scope_mismatch surfaces at verify (rebuild-from-tamper rejected at build)", async () => {
    // PERF-1B's build-time consent check already blocks this; verify
    // additionally re-derives consent_proof_hash content-address against
    // the body's binding. We mirror the verdict-receipt REJECT pattern.
    const { home, result, baseline, pubkeyPem } = await buildOk();
    try {
      // Tamper consent_proof_hash in the body — verifier recomputes body
      // → improvement_proof_hash → mismatch.
      const tampered = {
        ...result.improvement,
        consent_proof_hash: "0".repeat(64),
      };
      const v = verifyImprovement({
        improvement: tampered,
        baseline,
        pubkeyPem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "improvement_proof_hash_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("wrong external pubkey → improvement_signature_invalid", async () => {
    const { home, result, baseline } = await buildOk();
    try {
      // Generate a fresh, foreign keypair just for this assertion.
      const { generateEd25519Keypair } =
        await import("../packages/receipts/src/authorship-signature.js");
      const foreign = generateEd25519Keypair();
      const v = verifyImprovement({
        improvement: result.improvement,
        baseline,
        pubkeyPem: foreign.public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "improvement_signature_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("structural: missing pubkeyPem → external_pubkey_required", async () => {
    const { home, result, baseline } = await buildOk();
    try {
      const v = verifyImprovement({
        improvement: result.improvement,
        baseline,
        pubkeyPem: "",
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "external_pubkey_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("structural: wrong schema → improvement_schema_mismatch", async () => {
    const { home, result, baseline, pubkeyPem } = await buildOk();
    try {
      const broken = { ...result.improvement, schema: "not.real.v0.1" };
      const v = verifyImprovement({
        improvement: broken,
        baseline,
        pubkeyPem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "improvement_schema_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("structural: malformed improvement → improvement_missing_or_malformed", async () => {
    const v = verifyImprovement({
      improvement: null,
      baseline: {},
      pubkeyPem: "x",
    });
    assert.equal(v.verified, false);
    assert.equal(v.reason, "improvement_missing_or_malformed");
  });

  it("structural: malformed baseline → baseline_missing_or_malformed", async () => {
    const { home, result, pubkeyPem } = await buildOk();
    try {
      const v = verifyImprovement({
        improvement: result.improvement,
        baseline: null,
        pubkeyPem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "baseline_missing_or_malformed");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("REQUIRED_METRICS is the same 14-metric set PERF-1A uses (no drift)", () => {
    assert.equal(REQUIRED_METRICS.length, 14);
  });
});

// PERF_0_PREFLIGHT §5 step 7 — SAT-review signature verification (SAT-STEP7-1A).
// Preview SAT model: the SAT review attests to the MEASURED INPUTS
// (baseline_proof_hash + new_metrics), fixed before review — avoiding the circular
// dependency that attesting to improvement_proof_hash would create with
// sat_review_receipt_hash. Operator==reviewer (self-review) is an acknowledged
// out-of-scope social attack per the preflight threat table.
describe("perf-improvement · PERF_0 step 7 SAT-review signature verification", () => {
  async function buildWithSat({ verdict = "pass", reviewNewMetrics = NEW_METRICS } = {}) {
    const home = await freshHome();
    await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home });
    const baseline = await mintBaseline(home);
    const sat = generateEd25519Keypair();
    const review = buildSatReviewReceipt({
      baselineProofHash: baseline.baseline_proof_hash,
      newMetrics: reviewNewMetrics,
      verdict,
      satPrivateKeyPem: sat.private_key_pem,
    });
    const consentProof = await mintImprovementConsent({
      home,
      baselineProofHash: baseline.baseline_proof_hash,
      satReviewReceiptHash: review.sat_review_receipt_hash,
    });
    const built = await buildImprovement({
      baselineProofHash: baseline.baseline_proof_hash,
      baselineMetrics: BASELINE_METRICS,
      newMetrics: NEW_METRICS,
      interpretationRuleId: INTERPRETATION_RULE_V01,
      satReviewReceiptHash: review.sat_review_receipt_hash,
      consentProof,
      demaHome: home,
      createdAtIso: FIXED_IMPROVEMENT_CREATED,
    });
    assert.equal(built.built, true, `improvement build failed: ${built.error || ""}`);
    const pubkeyPem = await loadPublicKey(home);
    return { home, improvement: built.improvement, baseline, pubkeyPem, sat, review };
  }

  it("buildSatReviewReceipt: schema-tagged, signed, content-addressed body hash", () => {
    const sat = generateEd25519Keypair();
    const r = buildSatReviewReceipt({
      baselineProofHash: "a".repeat(64),
      newMetrics: NEW_METRICS,
      verdict: "pass",
      satPrivateKeyPem: sat.private_key_pem,
    });
    assert.equal(r.receipt.schema, SAT_REVIEW_RECEIPT_SCHEMA);
    assert.match(r.sat_review_receipt_hash, /^[a-f0-9]{64}$/);
    assert.equal(typeof r.receipt.sat_review_signature_b64, "string");
    assert.equal(Object.isFrozen(r.receipt), true);
    // no private key material leaks into the receipt
    assert.equal(JSON.stringify(r.receipt).includes("PRIVATE KEY"), false);
  });

  it("backward-compatible: no SAT supplied → verified true, sat_review_verified false (no claim)", async () => {
    const { home, improvement, baseline, pubkeyPem } = await buildWithSat();
    try {
      const v = verifyImprovement({ improvement, baseline, pubkeyPem });
      assert.equal(v.verified, true);
      assert.equal(v.sat_review_verified, false);
      assert.equal(v.sat_review_status, "NOT_SUPPLIED");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("valid SAT review signed by the reviewer key → sat_review_verified true", async () => {
    const { home, improvement, baseline, pubkeyPem, sat, review } = await buildWithSat();
    try {
      const v = verifyImprovement({
        improvement,
        baseline,
        pubkeyPem,
        satReview: review.receipt,
        satPubkeyPem: sat.public_key_pem,
      });
      assert.equal(v.verified, true);
      assert.equal(v.sat_review_verified, true);
      assert.equal(v.sat_review_status, "VERIFIED");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("forged SAT review (wrong reviewer key) → reject sat_review_invalid", async () => {
    const { home, improvement, baseline, pubkeyPem, review } = await buildWithSat();
    const attacker = generateEd25519Keypair();
    try {
      const v = verifyImprovement({
        improvement,
        baseline,
        pubkeyPem,
        satReview: review.receipt,
        satPubkeyPem: attacker.public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "sat_review_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("REVIEW MISATTRIBUTION: a validly-signed SAT review of OTHER metrics, bound by hash, still rejects (sat_review_does_not_attest_this_improvement)", async () => {
    // Threat: a real, reviewer-signed SAT review that attests to metrics A is
    // attached to an improvement claiming metrics B. The improvement honestly
    // commits to this review's hash, so hash-binding passes AND the signature is
    // valid — only the attests-inputs guard catches the metric mismatch. (This is
    // NOT the out-of-scope operator-self-review; it is reusing a legitimate review
    // for the wrong measured inputs.)
    const tweaked = Object.freeze({ ...NEW_METRICS, memory_rss_mb: 999.0 });
    const { home, improvement, baseline, pubkeyPem, sat, review } = await buildWithSat({
      reviewNewMetrics: tweaked,
    });
    try {
      const v = verifyImprovement({
        improvement,
        baseline,
        pubkeyPem,
        satReview: review.receipt,
        satPubkeyPem: sat.public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "sat_review_does_not_attest_this_improvement");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("SAT review supplied without a SAT pubkey → reject sat_pubkey_required", async () => {
    const { home, improvement, baseline, pubkeyPem, review } = await buildWithSat();
    try {
      const v = verifyImprovement({ improvement, baseline, pubkeyPem, satReview: review.receipt });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "sat_pubkey_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("non-pass SAT verdict → reject sat_review_verdict_not_pass (not silently approved)", async () => {
    const { home, improvement, baseline, pubkeyPem, sat, review } = await buildWithSat({ verdict: "fail" });
    try {
      const v = verifyImprovement({
        improvement,
        baseline,
        pubkeyPem,
        satReview: review.receipt,
        satPubkeyPem: sat.public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "sat_review_verdict_not_pass");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
