// PERF-1A · Performance Baseline Snapshot Kernel
//
// Pure kernel: turns caller-supplied metrics + measurement_context +
// a KEYCONSENT-1A consent_proof into a signed, hash-addressed
// `bizra.dema.perf_baseline.v0.1` envelope. No measurement performed
// here (metrics are caller-supplied per preflight §9 DOD). No CLI.
// No filesystem writes. No network.
//
// Reuses (no duplication):
// - signPayload, verifyPayload      packages/receipts/src/authorship-signature.js
// - loadActiveKeyPair   packages/receipts/src/authorship-key-store.js
// - sha256, stableStringify         packages/consent/src/consent-common.js
// - consent_proof verification      packages/receipts/src/consent-proof.js
//
// Spec reference: docs/security/PERF_0_PREFLIGHT.md §3.1 (envelope shape),
// §5 steps 1–2 (verifier flow), §9 (PERF-1A DOD).
//
// SCOPE (this slice):
// - buildBaseline / verifyBaseline only.
// - No prev_hash chain validation (PERF-1B).
// - No CLI surface (PERF-1C).
// - No improvement receipt or comparison logic (PERF-1B/1D).
// - Caller supplies metrics; the kernel does NOT sample, fingerprint
//   host, or read process metrics.

import { createPublicKey } from "node:crypto";
import {
  signPayload,
  verifyPayload,
} from "../../receipts/src/authorship-signature.js";
import {
  loadActiveKeyPair,
} from "../../receipts/src/authorship-key-store.js";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { verifyConsentProof } from "../../receipts/src/consent-proof.js";

export const PERF_BASELINE_SCHEMA = "bizra.dema.perf_baseline.v0.1";

// KEYCONSENT-1A action_type required on the consent proof bound to a
// baseline mint. Cross-action consent reuse → consent_scope_mismatch.
export const PERF_BASELINE_ACTION_TYPE = "CAPTURE_PERF_BASELINE";

// PDF §14 mandatory metric set (14 metrics). Any baseline missing
// any one of these is REJECTED at write time per preflight §9 DOD.
export const REQUIRED_METRICS = Object.freeze([
  "dema_boot_latency_ms",
  "mission_selection_latency_ms",
  "consent_proof_build_latency_ms",
  "consent_proof_verify_latency_ms",
  "receipt_write_latency_ms",
  "verification_latency_ms",
  "test_check_runtime_ms",
  "memory_rss_mb",
  "cpu_utilization_pct",
  "gpu_utilization_pct",
  "disk_usage_mb",
  "token_settlement_time_ms",
  "poi_scoring_time_ms",
  "regression_count",
]);

const REQUIRED_CONTEXT_FIELDS = Object.freeze([
  "host_fingerprint",
  "node_version",
  "run_count",
  "env_hash",
]);

const REQUIRED_ENVELOPE_FIELDS = Object.freeze([
  "schema",
  "baseline_id",
  "baseline_metrics",
  "measurement_context",
  "prev_hash",
  "created_at_iso",
  "operator_public_key_fingerprint",
  "baseline_signature_b64",
  "baseline_proof_hash",
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

function isValidContext(ctx) {
  if (!isPlainObject(ctx)) return false;
  for (const f of REQUIRED_CONTEXT_FIELDS) {
    if (ctx[f] === undefined || ctx[f] === null) return false;
  }
  if (
    typeof ctx.host_fingerprint !== "string" ||
    ctx.host_fingerprint.length === 0
  ) {
    return false;
  }
  if (typeof ctx.node_version !== "string" || ctx.node_version.length === 0) {
    return false;
  }
  if (!Number.isFinite(ctx.run_count)) return false;
  if (typeof ctx.env_hash !== "string" || ctx.env_hash.length === 0) {
    return false;
  }
  return true;
}

function validateMetrics(metrics) {
  if (!isPlainObject(metrics)) {
    return { ok: false, error: "baseline_metrics_required" };
  }
  for (const name of REQUIRED_METRICS) {
    if (metrics[name] === undefined || metrics[name] === null) {
      return { ok: false, error: `metric_${name}_required` };
    }
    const v = metrics[name];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      return { ok: false, error: `metric_${name}_not_a_number` };
    }
  }
  return { ok: true };
}

function freezeMetrics(metrics) {
  // Reconstruct in canonical key order (REQUIRED_METRICS) so stable
  // serialization is independent of caller key insertion order.
  const out = {};
  for (const name of REQUIRED_METRICS) {
    out[name] = metrics[name];
  }
  return Object.freeze(out);
}

function freezeContext(ctx) {
  // Canonical order on context fields too.
  const out = {};
  for (const f of REQUIRED_CONTEXT_FIELDS) {
    out[f] = ctx[f];
  }
  return Object.freeze(out);
}

export async function buildBaseline({
  baseline_metrics,
  measurement_context,
  consentProof,
  demaHome,
  createdAtIso,
}) {
  // (1) Metric set validation — fail-closed before any I/O or signing.
  const mcheck = validateMetrics(baseline_metrics);
  if (!mcheck.ok) {
    return fail(mcheck.error);
  }

  // (2) Measurement context shape.
  if (!isValidContext(measurement_context)) {
    return fail("context_invalid");
  }

  // (3) Consent proof presence.
  if (!consentProof || typeof consentProof !== "object") {
    return fail("consent_proof_required");
  }

  // (4) Load signing key.
  const activePair = await loadActiveKeyPair(demaHome);
  const privateKeyPem = activePair.ok ? activePair.private_key_pem : null;
  if (!privateKeyPem) {
    return fail("no_authorship_key");
  }
  const publicKeyPem = activePair.ok ? activePair.public_key_pem : null;

  // (5) Bind consent to this specific (metrics, context) pair.
  //     target_hash = sha256(stableStringify({baseline_metrics, measurement_context}))
  //     Frozen canonical shapes so order does not change the binding.
  const frozenMetrics = freezeMetrics(baseline_metrics);
  const frozenContext = freezeContext(measurement_context);
  const targetHash = sha256(
    stableStringify({
      baseline_metrics: frozenMetrics,
      measurement_context: frozenContext,
    }),
  );

  // (6) Verify consent proof against the operator's pubkey and the
  //     bound action scope. Reuses KEYCONSENT-1A verifier; we map its
  //     reasons into PERF-domain errors.
  const cv = verifyConsentProof({
    consentProof,
    pubkeyPem: publicKeyPem,
    expectedActionScope: {
      action_type: PERF_BASELINE_ACTION_TYPE,
      target_hash: targetHash,
    },
    // Check consent freshness as of the act's own timestamp (deterministic),
    // not the verifier's wall clock (→ flaky). Matches block0.
    now: createdAtIso || new Date().toISOString(),
  });
  if (!cv.verified) {
    // Surface the canonical reason directly so callers can branch on it.
    return fail(cv.reason);
  }

  // (7) Built created_at_iso and baseline_id.
  const createdIso = createdAtIso || new Date().toISOString();
  const baselineId = sha256(
    stableStringify({
      baseline_metrics: frozenMetrics,
      measurement_context: frozenContext,
      created_at_iso: createdIso,
    }),
  );

  const fingerprint = fingerprintFromPem(publicKeyPem);

  // (8) Stable body — basis for both signature and baseline_proof_hash.
  //     Excludes baseline_signature_b64 and baseline_proof_hash by
  //     construction.
  const stableBody = Object.freeze({
    schema: PERF_BASELINE_SCHEMA,
    baseline_id: baselineId,
    baseline_metrics: frozenMetrics,
    measurement_context: frozenContext,
    prev_hash: null, // chain-walk hook present but unused (PERF-1B).
    created_at_iso: createdIso,
    operator_public_key_fingerprint: fingerprint,
  });

  const signature = signPayload(stableBody, privateKeyPem);
  const baselineProofHash = sha256(stableStringify(stableBody));

  const baseline = Object.freeze({
    ...stableBody,
    baseline_signature_b64: signature,
    baseline_proof_hash: baselineProofHash,
  });

  return Object.freeze({
    built: true,
    baseline,
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

export function verifyBaseline({ baseline, pubkeyPem }) {
  // Structural validation.
  if (!isPlainObject(baseline)) {
    return reject("baseline_missing_or_malformed");
  }
  if (baseline.schema !== PERF_BASELINE_SCHEMA) {
    return reject("baseline_schema_mismatch");
  }
  for (const f of REQUIRED_ENVELOPE_FIELDS) {
    if (baseline[f] === undefined) {
      return reject(`structural_missing_field_${f}`);
    }
    // prev_hash explicitly allowed to be null.
    if (baseline[f] === null && f !== "prev_hash") {
      return reject(`structural_missing_field_${f}`);
    }
  }
  if (
    typeof pubkeyPem !== "string" ||
    !pubkeyPem.includes("BEGIN PUBLIC KEY")
  ) {
    return reject("external_pubkey_required");
  }

  // (1) Recompute baseline_proof_hash from stable body.
  const { baseline_signature_b64, baseline_proof_hash, ...stableBody } =
    baseline;
  const recomputed = sha256(stableStringify(stableBody));
  if (recomputed !== baseline_proof_hash) {
    return reject("baseline_proof_hash_mismatch");
  }

  // (2) Verify Ed25519 signature using ONLY external pubkey.
  //     Same trust invariant as verdict-receipt REJECT-4 and
  //     KEYCONSENT-1A: the envelope's embedded
  //     operator_public_key_fingerprint is NOT used for authority.
  let sigValid;
  try {
    sigValid = verifyPayload(stableBody, baseline_signature_b64, pubkeyPem);
  } catch {
    sigValid = false;
  }
  if (!sigValid) {
    return reject("baseline_signature_invalid");
  }

  return Object.freeze({
    verified: true,
    baseline_proof_hash,
    baseline_id: baseline.baseline_id,
    operator_public_key_fingerprint: baseline.operator_public_key_fingerprint,
  });
}
