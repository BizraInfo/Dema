// PERF-1B · Performance Regression Guard Slice (improvement receipt)
//
// Pure kernel: turns caller-supplied `baselineProofHash`, `newMetrics`,
// `baselineMetrics`, `interpretationRuleId`, `satReviewReceiptHash`, and a
// KEYCONSENT-1A `consentProof` into a signed, hash-addressed
// `bizra.dema.perf_improvement.v0.1` envelope. The kernel deterministically
// computes `delta = new - baseline` and `interpretation` per the repo-pinned
// rule named by `interpretationRuleId`. No measurement is performed here —
// the caller supplies all metrics. No filesystem writes. No network. No CLI.
//
// NOTE on signature shape:
//   PERF_0_PREFLIGHT.md §3.2 commits delta + interpretation INTO the
//   envelope (the verifier re-derives + compares). For build-time
//   determinism, the builder therefore requires the actual baseline
//   metric values, not just the baseline_proof_hash content-address.
//   We accept `baselineMetrics` as an extra build input alongside the
//   minimum task-documented args. The verifier never needs it on the
//   options object because it has the full `baseline` envelope and
//   reads `baseline.baseline_metrics` from there.
//
// REUSES (no duplication):
// - signPayload, verifyPayload      packages/receipts/src/authorship-signature.js
// - loadPrivateKey, loadPublicKey   packages/receipts/src/authorship-key-store.js
// - sha256, stableStringify         packages/consent/src/consent-common.js
// - consent_proof verification      packages/receipts/src/consent-proof.js
// - REQUIRED_METRICS                packages/perf/src/perf-baseline.js  (canon)
//
// Spec reference:
//   docs/security/PERF_0_PREFLIGHT.md §3.2 (envelope shape)
//   docs/security/PERF_0_PREFLIGHT.md §5  steps 3–8 (verifier flow)
//   docs/security/PERF_0_PREFLIGHT.md §10 (PERF-1B DOD)
//
// SCOPE (this slice):
// - buildImprovement / verifyImprovement only.
// - No CLI surface (PERF-1C).
// - No measurement harness (PERF-1D).
// - SAT review receipt is referenced by content-hash; cross-bundle SAT
//   signature verification is future scope (PERF-1D bundle verifier).
// - Same-key invariant (baseline + improvement signed by same operator)
//   and `host_fingerprint` cross-check are noted in the preflight for
//   future verifier passes; this kernel verifies the improvement envelope
//   against an externally-supplied pubkey and binds it to a baseline by
//   `baseline_proof_hash` content-address.

import { createPublicKey } from "node:crypto";
import {
  signPayload,
  verifyPayload,
} from "../../receipts/src/authorship-signature.js";
import {
  loadPrivateKey,
  loadPublicKey,
} from "../../receipts/src/authorship-key-store.js";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { verifyConsentProof } from "../../receipts/src/consent-proof.js";
import { REQUIRED_METRICS } from "./perf-baseline.js";

export const PERF_IMPROVEMENT_SCHEMA = "bizra.dema.perf_improvement.v0.1";

// KEYCONSENT-1A action_type required on the consent proof bound to an
// improvement mint. Cross-action consent reuse → consent_scope_mismatch.
export const PERF_IMPROVEMENT_ACTION_TYPE = "CLAIM_OPTIMIZATION";

// Repo-pinned, versioned, deterministic interpretation rule id.
// Pure rule: each metric labelled "improved" if new is lower than baseline
// by ≥ 1%, "regressed" if new is higher than baseline by ≥ 1%, "unchanged"
// otherwise (i.e., |new - baseline| / |baseline| < 0.01). This is the
// lower-is-better convention used by all 14 PDF §14 metrics in the current
// set, including `regression_count` (a higher regression count is a worse
// outcome — labelled "regressed" if it grows by ≥ 1%). Higher-is-better
// metrics are NOT in the current 14-metric set; when they are added in a
// future slice, the rule will branch on a named per-metric direction
// (see HIGHER_IS_BETTER_METRICS_V01 below for the placeholder convention).
export const INTERPRETATION_RULE_V01 = "deterministic-threshold.v0.1";

const INTERPRETATION_THRESHOLD_PCT = 0.01; // ≥ 1% relative delta required to label

// Placeholder for future higher-is-better metrics. The current 14-metric
// set is fully lower-is-better — this set is empty by design. When a
// future PERF slice adds a metric where higher is better (e.g.,
// `useful_tokens_per_minute`), it MUST be listed here AND the rule id
// MUST be bumped to v0.2; never reinterpret v0.1.
const HIGHER_IS_BETTER_METRICS_V01 = Object.freeze([]);

const REQUIRED_ENVELOPE_FIELDS = Object.freeze([
  "schema",
  "improvement_id",
  "baseline_proof_hash",
  "new_metrics",
  "delta",
  "interpretation",
  "interpretation_rule_id",
  "sat_review_receipt_hash",
  "consent_proof_hash",
  "prev_hash",
  "created_at_iso",
  "operator_public_key_fingerprint",
  "improvement_signature_b64",
  "improvement_proof_hash",
]);

function fingerprintFromPem(pubkeyPem) {
  const pk = createPublicKey(pubkeyPem);
  const der = pk.export({ type: "spki", format: "der" });
  return sha256(der.toString("hex"));
}

function fail(error) {
  return Object.freeze({ built: false, error });
}

function isPlainObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function isSha256Hex(s) {
  return typeof s === "string" && /^[a-f0-9]{64}$/.test(s);
}

function validateMetricsShape(metrics, errPrefix = "metric") {
  if (!isPlainObject(metrics)) {
    return { ok: false, error: `${errPrefix}s_required` };
  }
  for (const name of REQUIRED_METRICS) {
    if (metrics[name] === undefined || metrics[name] === null) {
      return { ok: false, error: `${errPrefix}_${name}_required` };
    }
    const v = metrics[name];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      return { ok: false, error: `${errPrefix}_${name}_not_a_number` };
    }
  }
  return { ok: true };
}

function freezeMetrics(metrics) {
  const out = {};
  for (const name of REQUIRED_METRICS) {
    out[name] = metrics[name];
  }
  return Object.freeze(out);
}

function computeDelta(newMetrics, baselineMetrics) {
  const out = {};
  for (const name of REQUIRED_METRICS) {
    out[name] = newMetrics[name] - baselineMetrics[name];
  }
  return Object.freeze(out);
}

// Pure rule. (delta_object, baseline_object) -> {metric: label}.
// No clock, no random, no I/O. Re-runnable by a stranger with this code.
function applyInterpretationRuleV01(delta, baselineMetrics) {
  const out = {};
  for (const name of REQUIRED_METRICS) {
    const base = baselineMetrics[name];
    const d = delta[name];
    let pctMagnitude;
    if (base === 0) {
      // Avoid divide-by-zero. With base = 0, any nonzero delta crosses
      // the relative threshold; treat the sign of delta as direction.
      pctMagnitude = d === 0 ? 0 : Infinity;
    } else {
      pctMagnitude = Math.abs(d) / Math.abs(base);
    }

    const higherIsBetter = HIGHER_IS_BETTER_METRICS_V01.includes(name);

    if (pctMagnitude < INTERPRETATION_THRESHOLD_PCT) {
      out[name] = "unchanged";
    } else if (d < 0) {
      out[name] = higherIsBetter ? "regressed" : "improved";
    } else {
      // d > 0 (d === 0 already caught by pctMagnitude < threshold).
      out[name] = higherIsBetter ? "improved" : "regressed";
    }
  }
  return Object.freeze(out);
}

function deriveInterpretation(ruleId, delta, baselineMetrics) {
  if (ruleId === INTERPRETATION_RULE_V01) {
    return applyInterpretationRuleV01(delta, baselineMetrics);
  }
  return null;
}

export async function buildImprovement({
  baselineProofHash,
  baselineMetrics,
  newMetrics,
  interpretationRuleId,
  satReviewReceiptHash,
  consentProof,
  demaHome,
  createdAtIso,
}) {
  // (1) Structural input validation — fail-closed before any I/O.
  if (!isSha256Hex(baselineProofHash)) {
    return fail("baseline_proof_hash_invalid");
  }
  const mcheckNew = validateMetricsShape(newMetrics, "metric");
  if (!mcheckNew.ok) {
    return fail(mcheckNew.error);
  }
  if (
    typeof interpretationRuleId !== "string" ||
    interpretationRuleId.length === 0
  ) {
    return fail("interpretation_rule_id_required");
  }
  if (interpretationRuleId !== INTERPRETATION_RULE_V01) {
    return fail("interpretation_rule_unknown");
  }
  if (!isSha256Hex(satReviewReceiptHash)) {
    return fail("sat_review_receipt_hash_invalid");
  }
  // baselineMetrics is required for deterministic delta/interpretation
  // build. Schema §3.2 commits both fields INTO the envelope.
  const mcheckBase = validateMetricsShape(baselineMetrics, "baseline_metric");
  if (!mcheckBase.ok) {
    return fail(mcheckBase.error);
  }

  // (2) Consent proof presence.
  if (!consentProof || typeof consentProof !== "object") {
    return fail("consent_proof_required");
  }

  // (3) Load signing key — fail-closed if no key on disk regardless of
  //     consent shape.
  const privateKeyPem = await loadPrivateKey(demaHome);
  if (!privateKeyPem) {
    return fail("no_authorship_key");
  }
  const publicKeyPem = await loadPublicKey(demaHome);

  // (4) Bind consent to the (baseline_proof_hash, new_metrics,
  //     interpretation_rule_id, sat_review_receipt_hash) tuple.
  //     Frozen canonical shapes so order does not change the binding.
  const frozenNew = freezeMetrics(newMetrics);
  const frozenBase = freezeMetrics(baselineMetrics);
  const targetHash = sha256(
    stableStringify({
      baseline_proof_hash: baselineProofHash,
      new_metrics: frozenNew,
      interpretation_rule_id: interpretationRuleId,
      sat_review_receipt_hash: satReviewReceiptHash,
    }),
  );

  // (5) Verify consent proof against operator's pubkey + bound action
  //     scope. Reuses KEYCONSENT-1A verifier; surface canonical reason
  //     directly (e.g. consent_scope_mismatch, consent_signature_invalid).
  const cv = verifyConsentProof({
    consentProof,
    pubkeyPem: publicKeyPem,
    expectedActionScope: {
      action_type: PERF_IMPROVEMENT_ACTION_TYPE,
      target_hash: targetHash,
    },
    // Check consent freshness as of the act's own timestamp (deterministic),
    // not the verifier's wall clock (→ flaky). Matches block0.
    now: createdAtIso || new Date().toISOString(),
  });
  if (!cv.verified) {
    return fail(cv.reason);
  }

  // (6) Build delta and interpretation deterministically from rule id.
  const delta = computeDelta(frozenNew, frozenBase);
  const interpretation = deriveInterpretation(
    interpretationRuleId,
    delta,
    frozenBase,
  );
  if (interpretation === null) {
    return fail("interpretation_rule_unknown");
  }

  // (7) Compose envelope.
  const createdIso = createdAtIso || new Date().toISOString();
  const improvementId = sha256(
    stableStringify({
      baseline_proof_hash: baselineProofHash,
      new_metrics: frozenNew,
      interpretation_rule_id: interpretationRuleId,
      sat_review_receipt_hash: satReviewReceiptHash,
      consent_proof_hash: consentProof.consent_proof_hash,
      created_at_iso: createdIso,
    }),
  );

  const fingerprint = fingerprintFromPem(publicKeyPem);

  // Stable body — basis for both signature and improvement_proof_hash.
  // Excludes improvement_signature_b64 and improvement_proof_hash by
  // construction. Field order is canonical.
  const stableBody = Object.freeze({
    schema: PERF_IMPROVEMENT_SCHEMA,
    improvement_id: improvementId,
    baseline_proof_hash: baselineProofHash,
    new_metrics: frozenNew,
    delta,
    interpretation,
    interpretation_rule_id: interpretationRuleId,
    sat_review_receipt_hash: satReviewReceiptHash,
    consent_proof_hash: consentProof.consent_proof_hash,
    prev_hash: null, // chain hook present but unused this slice (future).
    created_at_iso: createdIso,
    operator_public_key_fingerprint: fingerprint,
  });

  const signature = signPayload(stableBody, privateKeyPem);
  const improvementProofHash = sha256(stableStringify(stableBody));

  const improvement = Object.freeze({
    ...stableBody,
    improvement_signature_b64: signature,
    improvement_proof_hash: improvementProofHash,
  });

  return Object.freeze({
    built: true,
    improvement,
    signer_public_key_pem: publicKeyPem,
  });
}

function reject(reason) {
  return Object.freeze({
    verified: false,
    rejected: true,
    reason,
  });
}

export function verifyImprovement({ improvement, baseline, pubkeyPem, now }) {
  // ── Structural validation ────────────────────────────────────────
  if (!isPlainObject(improvement)) {
    return reject("improvement_missing_or_malformed");
  }
  if (improvement.schema !== PERF_IMPROVEMENT_SCHEMA) {
    return reject("improvement_schema_mismatch");
  }
  for (const f of REQUIRED_ENVELOPE_FIELDS) {
    if (improvement[f] === undefined) {
      return reject(`structural_missing_field_${f}`);
    }
    if (improvement[f] === null && f !== "prev_hash") {
      return reject(`structural_missing_field_${f}`);
    }
  }
  if (!isPlainObject(baseline)) {
    return reject("baseline_missing_or_malformed");
  }
  if (
    typeof pubkeyPem !== "string" ||
    !pubkeyPem.includes("BEGIN PUBLIC KEY")
  ) {
    return reject("external_pubkey_required");
  }

  // ── (1) Recompute improvement_proof_hash from stable body ────────
  const { improvement_signature_b64, improvement_proof_hash, ...stableBody } =
    improvement;
  const recomputed = sha256(stableStringify(stableBody));
  if (recomputed !== improvement_proof_hash) {
    return reject("improvement_proof_hash_mismatch");
  }

  // ── (2) Verify Ed25519 signature using ONLY external pubkey ──────
  // Same trust invariant as verdict-receipt REJECT-4 / KEYCONSENT-1A /
  // PERF-1A: the envelope's embedded operator_public_key_fingerprint
  // is NOT used for authority.
  let sigValid;
  try {
    sigValid = verifyPayload(stableBody, improvement_signature_b64, pubkeyPem);
  } catch {
    sigValid = false;
  }
  if (!sigValid) {
    return reject("improvement_signature_invalid");
  }

  // ── (3) Baseline binding (preflight §5 step 4) ───────────────────
  if (typeof baseline.baseline_proof_hash !== "string") {
    return reject("baseline_missing_or_malformed");
  }
  if (improvement.baseline_proof_hash !== baseline.baseline_proof_hash) {
    return reject("baseline_proof_hash_mismatch");
  }
  if (!isPlainObject(baseline.baseline_metrics)) {
    return reject("baseline_missing_or_malformed");
  }

  // ── (4) Delta recompute (preflight §5 step 5) ────────────────────
  // For every metric in the canonical 14-set, operator-supplied delta
  // MUST equal new_metrics[m] − baseline.baseline_metrics[m].
  for (const name of REQUIRED_METRICS) {
    const bv = baseline.baseline_metrics[name];
    const nv = improvement.new_metrics[name];
    const expected = nv - bv;
    const claimed = improvement.delta[name];
    if (typeof claimed !== "number" || !Number.isFinite(claimed)) {
      return reject("delta_mismatch");
    }
    if (claimed !== expected) {
      return reject("delta_mismatch");
    }
  }

  // ── (5) Interpretation rule lookup + re-derivation (§5 step 6) ───
  if (improvement.interpretation_rule_id !== INTERPRETATION_RULE_V01) {
    return reject("interpretation_rule_unknown");
  }
  const expectedInterp = deriveInterpretation(
    improvement.interpretation_rule_id,
    improvement.delta,
    baseline.baseline_metrics,
  );
  if (expectedInterp === null) {
    return reject("interpretation_rule_unknown");
  }
  for (const name of REQUIRED_METRICS) {
    if (improvement.interpretation[name] !== expectedInterp[name]) {
      return reject("verdict_rederivation_mismatch");
    }
  }

  // ── (6) Consent scope binding (preflight §5 step 8) ──────────────
  // The receipt commits to consent_proof_hash. The deep cross-bundle
  // consent-signature verification is PERF-1D bundle-verifier scope.
  // Here we assert the receipt's consent_proof_hash field is a valid
  // sha256 hex (build path guarantees this by construction; a malformed
  // hash here means the receipt has been tampered post-mint).
  if (!isSha256Hex(improvement.consent_proof_hash)) {
    return reject("consent_scope_mismatch");
  }

  return Object.freeze({
    verified: true,
    improvement_proof_hash,
    improvement_id: improvement.improvement_id,
    baseline_proof_hash: improvement.baseline_proof_hash,
    interpretation_rule_id: improvement.interpretation_rule_id,
    operator_public_key_fingerprint:
      improvement.operator_public_key_fingerprint,
  });
}
