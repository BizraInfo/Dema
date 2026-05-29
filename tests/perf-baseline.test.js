// PERF-1A · Performance Baseline Snapshot Kernel tests
//
// Covers all 8 DOD criteria from PERF_0_PREFLIGHT.md §9 plus structural
// guards. Pure kernel — caller supplies metrics + measurement_context +
// consentProof. No CLI, no integration, no actual sampling, no host
// fingerprinting inside the kernel.
//
// Schema reference: docs/security/PERF_0_PREFLIGHT.md §3.1.
// Verification flow reference: docs/security/PERF_0_PREFLIGHT.md §5 steps 1–2.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildBaseline,
  verifyBaseline,
  PERF_BASELINE_SCHEMA,
  PERF_BASELINE_ACTION_TYPE,
  REQUIRED_METRICS,
} from "../packages/perf/src/perf-baseline.js";
import { buildConsentProof } from "../packages/receipts/src/consent-proof.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import { generateEd25519Keypair } from "../packages/receipts/src/authorship-signature.js";
import {
  sha256,
  stableStringify,
} from "../packages/consent/src/consent-common.js";

const VALID_PHRASE = "CAPTURE PERF BASELINE";
const FIXED_CREATED = "2026-05-30T08:00:00.000Z";
const FIXED_NONCE = "feedface".repeat(8); // 32 bytes = 64 hex chars
const FIXED_CONSENT_CREATED = "2026-05-30T07:59:00.000Z";
const FIXED_CONSENT_EXPIRES = "2026-05-30T08:10:00.000Z";

const VALID_METRICS = Object.freeze({
  dema_boot_latency_ms: 120.5,
  mission_selection_latency_ms: 14.2,
  consent_proof_build_latency_ms: 9.1,
  consent_proof_verify_latency_ms: 6.7,
  receipt_write_latency_ms: 3.4,
  verification_latency_ms: 22.8,
  test_check_runtime_ms: 54058,
  memory_rss_mb: 88.1,
  cpu_utilization_pct: 12.5,
  gpu_utilization_pct: 0,
  disk_usage_mb: 412.6,
  token_settlement_time_ms: 0,
  poi_scoring_time_ms: 0,
  regression_count: 0,
});

const VALID_CONTEXT = Object.freeze({
  host_fingerprint: "a".repeat(64),
  node_version: "v22.4.0",
  run_count: 5,
  env_hash: "b".repeat(64),
});

async function freshHome() {
  return await mkdtemp(join(tmpdir(), "dema-perf-baseline-test-"));
}

async function makeConsent({
  home,
  targetHash,
  actionType = PERF_BASELINE_ACTION_TYPE,
}) {
  const cp = await buildConsentProof({
    phrase: "SIGN AUTHORSHIP RECEIPT",
    actionScope: { action_type: actionType, target_hash: targetHash },
    demaHome: home,
    nonce: FIXED_NONCE,
    createdAtIso: FIXED_CONSENT_CREATED,
    expiresAtIso: FIXED_CONSENT_EXPIRES,
  });
  return cp;
}

// Pre-derived metrics_context_hash used to bind the consent scope.
// The kernel binds consent_proof.action_scope.target_hash to
// sha256(stableStringify({baseline_metrics, measurement_context})).
function deriveTargetHash(metrics = VALID_METRICS, context = VALID_CONTEXT) {
  return sha256(
    stableStringify({
      baseline_metrics: metrics,
      measurement_context: context,
    }),
  );
}

async function buildOk(overrides = {}) {
  const home = await freshHome();
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home });
  const targetHash = deriveTargetHash(
    overrides.baseline_metrics || VALID_METRICS,
    overrides.measurement_context || VALID_CONTEXT,
  );
  const consent = await makeConsent({ home, targetHash });
  const result = await buildBaseline({
    baseline_metrics: VALID_METRICS,
    measurement_context: VALID_CONTEXT,
    consentProof: consent.consent_proof,
    demaHome: home,
    createdAtIso: FIXED_CREATED,
    ...overrides,
  });
  return { home, result, consent };
}

describe("perf-baseline · buildBaseline (DOD happy path + envelope shape)", () => {
  it("DOD-1 happy path: returns frozen envelope with schema, baseline_id, baseline_proof_hash, signature", async () => {
    const { home, result } = await buildOk();
    try {
      assert.equal(result.built, true);
      const b = result.baseline;
      assert.equal(b.schema, PERF_BASELINE_SCHEMA);
      assert.ok(typeof b.baseline_id === "string" && b.baseline_id.length > 0);
      assert.equal(b.prev_hash, null);
      assert.equal(b.created_at_iso, FIXED_CREATED);
      assert.ok(/^[a-f0-9]{64}$/.test(b.operator_public_key_fingerprint));
      assert.ok(
        typeof b.baseline_signature_b64 === "string" &&
          b.baseline_signature_b64.length > 0,
      );
      assert.ok(/^[a-f0-9]{64}$/.test(b.baseline_proof_hash));
      assert.deepEqual(b.baseline_metrics, VALID_METRICS);
      assert.deepEqual(b.measurement_context, VALID_CONTEXT);
      assert.ok(Object.isFrozen(b));
      assert.ok(Object.isFrozen(b.baseline_metrics));
      assert.ok(Object.isFrozen(b.measurement_context));
      assert.ok(Object.isFrozen(result));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-2 determinism: identical inputs (same metrics, context, consent, created_at) → deep-equal envelopes", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const targetHash = deriveTargetHash();
      const c = await makeConsent({ home, targetHash });
      const a = await buildBaseline({
        baseline_metrics: VALID_METRICS,
        measurement_context: VALID_CONTEXT,
        consentProof: c.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      const b = await buildBaseline({
        baseline_metrics: VALID_METRICS,
        measurement_context: VALID_CONTEXT,
        consentProof: c.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.deepEqual(a, b);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-3 fail-closed: missing consentProof → built:false, error consent_proof_required", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const r = await buildBaseline({
        baseline_metrics: VALID_METRICS,
        measurement_context: VALID_CONTEXT,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "consent_proof_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-4 fail-closed: consent_proof with wrong action_type → consent_scope_mismatch", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const targetHash = deriveTargetHash();
      const c = await makeConsent({
        home,
        targetHash,
        actionType: "SOMETHING_ELSE",
      });
      const r = await buildBaseline({
        baseline_metrics: VALID_METRICS,
        measurement_context: VALID_CONTEXT,
        consentProof: c.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "consent_scope_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-5 fail-closed: missing any §14 metric → metric_<name>_required", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      // We need consent that's valid for the partial metrics — but the
      // metric check should run before scope binding. Reuse same consent
      // path; metric check fails first.
      const partial = { ...VALID_METRICS };
      delete partial.dema_boot_latency_ms;
      const targetHash = deriveTargetHash();
      const c = await makeConsent({ home, targetHash });
      const r = await buildBaseline({
        baseline_metrics: partial,
        measurement_context: VALID_CONTEXT,
        consentProof: c.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "metric_dema_boot_latency_ms_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-5 fail-closed: non-number metric value → metric_<name>_not_a_number", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const bad = { ...VALID_METRICS, memory_rss_mb: "high" };
      const targetHash = deriveTargetHash();
      const c = await makeConsent({ home, targetHash });
      const r = await buildBaseline({
        baseline_metrics: bad,
        measurement_context: VALID_CONTEXT,
        consentProof: c.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "metric_memory_rss_mb_not_a_number");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-5 every one of the 14 required metrics is enforced", async () => {
    // Exhaustive: each metric, individually deleted, raises its own error.
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      assert.equal(REQUIRED_METRICS.length, 14);
      for (const name of REQUIRED_METRICS) {
        const partial = { ...VALID_METRICS };
        delete partial[name];
        const targetHash = deriveTargetHash();
        const c = await makeConsent({ home, targetHash });
        const r = await buildBaseline({
          baseline_metrics: partial,
          measurement_context: VALID_CONTEXT,
          consentProof: c.consent_proof,
          demaHome: home,
          createdAtIso: FIXED_CREATED,
        });
        assert.equal(r.built, false, `expected fail-closed on missing ${name}`);
        assert.equal(r.error, `metric_${name}_required`);
      }
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
      assert.equal(result.baseline.private_key, undefined);
      assert.equal(result.baseline.private_key_pem, undefined);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("baseline_proof_hash recomputes from body excluding signature_b64 + proof_hash", async () => {
    const { home, result } = await buildOk();
    try {
      const b = result.baseline;
      const {
        baseline_signature_b64: _s,
        baseline_proof_hash: _h,
        ...body
      } = b;
      const recomputed = sha256(stableStringify(body));
      assert.equal(recomputed, b.baseline_proof_hash);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("baseline_id derives from sha256(stableStringify({metrics, context, created_at_iso}))", async () => {
    const { home, result } = await buildOk();
    try {
      const expected = sha256(
        stableStringify({
          baseline_metrics: VALID_METRICS,
          measurement_context: VALID_CONTEXT,
          created_at_iso: FIXED_CREATED,
        }),
      );
      assert.equal(result.baseline.baseline_id, expected);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: no signing key on disk → no_authorship_key", async () => {
    const home = await freshHome();
    try {
      // Don't init the key — but caller must still supply a consentProof.
      // Construct a synthetic consent_proof shape (will fail at signing key
      // load before scope verification).
      const fakeConsent = {
        consent_proof_hash: "x".repeat(64),
        action_scope: {
          action_type: PERF_BASELINE_ACTION_TYPE,
          target_hash: deriveTargetHash(),
        },
      };
      const r = await buildBaseline({
        baseline_metrics: VALID_METRICS,
        measurement_context: VALID_CONTEXT,
        consentProof: fakeConsent,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "no_authorship_key");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: incomplete measurement_context (missing host_fingerprint) → context_invalid", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const badCtx = { ...VALID_CONTEXT };
      delete badCtx.host_fingerprint;
      const targetHash = sha256(
        stableStringify({
          baseline_metrics: VALID_METRICS,
          measurement_context: badCtx,
        }),
      );
      const c = await makeConsent({ home, targetHash });
      const r = await buildBaseline({
        baseline_metrics: VALID_METRICS,
        measurement_context: badCtx,
        consentProof: c.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "context_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("perf-baseline · verifyBaseline (DOD verify path)", () => {
  it("DOD-7 happy: verifies with matching external pubkey → verified:true", async () => {
    const { home, result, consent } = await buildOk();
    try {
      const v = verifyBaseline({
        baseline: result.baseline,
        pubkeyPem: consent.signer_public_key_pem,
      });
      assert.equal(v.verified, true);
      assert.equal(v.baseline_proof_hash, result.baseline.baseline_proof_hash);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-8 tampered body (a metric flipped) → baseline_proof_hash_mismatch", async () => {
    const { home, result, consent } = await buildOk();
    try {
      const tampered = {
        ...result.baseline,
        baseline_metrics: {
          ...result.baseline.baseline_metrics,
          dema_boot_latency_ms: 1.0,
        },
      };
      const v = verifyBaseline({
        baseline: tampered,
        pubkeyPem: consent.signer_public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "baseline_proof_hash_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-8 tampered body re-hashed but signature unchanged → baseline_signature_invalid", async () => {
    const { home, result, consent } = await buildOk();
    try {
      const {
        baseline_signature_b64: _s,
        baseline_proof_hash: _h,
        ...body
      } = result.baseline;
      const tamperedBody = {
        ...body,
        baseline_metrics: { ...body.baseline_metrics, dema_boot_latency_ms: 1 },
      };
      const rehash = sha256(stableStringify(tamperedBody));
      const tampered = {
        ...tamperedBody,
        baseline_signature_b64: result.baseline.baseline_signature_b64,
        baseline_proof_hash: rehash,
      };
      const v = verifyBaseline({
        baseline: tampered,
        pubkeyPem: consent.signer_public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "baseline_signature_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("wrong external pubkey → baseline_signature_invalid", async () => {
    const { home, result } = await buildOk();
    try {
      const wrong = generateEd25519Keypair();
      const v = verifyBaseline({
        baseline: result.baseline,
        pubkeyPem: wrong.public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "baseline_signature_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("structural: missing pubkeyPem → external_pubkey_required", async () => {
    const { home, result } = await buildOk();
    try {
      const v = verifyBaseline({
        baseline: result.baseline,
        pubkeyPem: "",
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "external_pubkey_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("structural: wrong schema → baseline_schema_mismatch", async () => {
    const { home, result, consent } = await buildOk();
    try {
      const broken = { ...result.baseline, schema: "not.real.v0.1" };
      const v = verifyBaseline({
        baseline: broken,
        pubkeyPem: consent.signer_public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "baseline_schema_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("structural: malformed baseline → baseline_missing_or_malformed", async () => {
    const v = verifyBaseline({ baseline: null, pubkeyPem: "x" });
    assert.equal(v.verified, false);
    assert.equal(v.reason, "baseline_missing_or_malformed");
  });
});
