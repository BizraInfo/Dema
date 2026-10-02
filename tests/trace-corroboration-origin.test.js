import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";

import { buildPeakSelfLoopPreview } from "../packages/core/src/peak-self-loop-preview.js";
import {
  TRACE_CORROBORATION_ORIGIN_SCHEMA,
  canonicalTraceCorroborationOriginPayload,
  verifyTraceCorroborationOrigin,
} from "../packages/core/src/trace-corroboration-origin.js";
import { computeTraceDiagnosticReplaySubjectHashV2 } from "../packages/core/src/dema-trace-diagnostic-contract.js";

const SUBJECT = "a".repeat(64);
const REPLAY = "b".repeat(64);
const CHALLENGE = "trace-origin-challenge-001";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const PUBLIC_KEY_PEM = publicKey.export({ type: "spki", format: "pem" });

const TRUSTED = Object.freeze([
  Object.freeze({
    verifier_id: "sat.external.trace-v1",
    verifier_key_id: "sat.external.trace-v1:key-1",
    public_key_pem: PUBLIC_KEY_PEM,
    status: "ACTIVE",
  }),
]);

function signedReceipt(overrides = {}) {
  const receipt = {
    schema: TRACE_CORROBORATION_ORIGIN_SCHEMA,
    verifier_id: "sat.external.trace-v1",
    verifier_key_id: "sat.external.trace-v1:key-1",
    replay_performed: true,
    replay_subject_hash: SUBJECT,
    independent_replay_hash: REPLAY,
    challenge_nonce: CHALLENGE,
    ...overrides,
  };
  const signature = sign(
    null,
    Buffer.from(canonicalTraceCorroborationOriginPayload(receipt), "utf8"),
    privateKey,
  ).toString("base64");
  return { ...receipt, signature_b64: signature };
}

function verify(receipt, overrides = {}) {
  return verifyTraceCorroborationOrigin({
    corroboration: receipt,
    expected_subject_hash: SUBJECT,
    trusted_verifiers: TRUSTED,
    proposer_origin: "pat.local.proposer",
    executor_origin: "node0.local.executor",
    expected_challenge: CHALLENGE,
    ...overrides,
  });
}

test("TCO-01: same-origin verifier cannot satisfy independent corroboration", () => {
  const receipt = signedReceipt({ verifier_id: "pat.local.proposer" });
  const out = verify(receipt, {
    trusted_verifiers: [
      {
        verifier_id: "pat.local.proposer",
        verifier_key_id: receipt.verifier_key_id,
        public_key_pem: PUBLIC_KEY_PEM,
        status: "ACTIVE",
      },
    ],
  });
  assert.equal(out.ok, false);
  assert.ok(out.blocked_by.includes("corroboration_origin_same_as_proposer"));
  assert.equal(out.normalized_corroboration, null);
});

test("TCO-02: unknown verifier remains inadmissible", () => {
  const receipt = signedReceipt({ verifier_id: "unknown.verifier" });
  const out = verify(receipt);
  assert.equal(out.ok, false);
  assert.ok(out.blocked_by.includes("corroboration_origin_unknown_verifier"));
});

test("TCO-03: exact subject and replay challenge are mandatory", () => {
  const wrongSubject = verify(signedReceipt({ replay_subject_hash: "c".repeat(64) }));
  assert.equal(wrongSubject.ok, false);
  assert.ok(wrongSubject.blocked_by.includes("corroboration_origin_subject_mismatch"));

  const wrongChallenge = verify(signedReceipt({ challenge_nonce: "stale-challenge" }));
  assert.equal(wrongChallenge.ok, false);
  assert.ok(wrongChallenge.blocked_by.includes("corroboration_origin_challenge_mismatch"));
});

test("TCO-04: valid signed external-origin receipt normalizes to v0.2 corroboration", () => {
  const out = verify(signedReceipt());
  assert.equal(out.ok, true);
  assert.deepEqual(out.blocked_by, []);
  assert.deepEqual(out.normalized_corroboration, {
    replay_performed: true,
    independent: true,
    independent_replay_hash: REPLAY,
    replay_subject_hash: SUBJECT,
  });
  assert.equal(out.verification_mode, "ed25519_origin_receipt");
});

const BOUND = (i) => ({
  id: `origin-moat-${i}`,
  type: "gate_passed",
  weight: 1,
  truth_label: "MEASURED",
  source_ref: `receipts/origin-moat-${i}.json`,
  source_sha256: String(i).repeat(64).slice(0, 64),
});

test("TCO-05: peak moat rejects caller boolean but accepts signed external origin", () => {
  const nine = Array.from({ length: 9 }, (_, i) => BOUND(i));
  const baseline = buildPeakSelfLoopPreview({ signal_events: nine, noise_events: [] });
  const subjectHash = computeTraceDiagnosticReplaySubjectHashV2(
    baseline.trace_diagnostic_moat.trace_set,
    baseline.trace_diagnostic_moat.hypothesis_graph,
    baseline.trace_diagnostic_moat.insight_candidate,
  );

  const rawAssertion = buildPeakSelfLoopPreview({
    signal_events: nine,
    noise_events: [],
    trace_corroboration: {
      replay_performed: true,
      independent: true,
      independent_replay_hash: REPLAY,
      replay_subject_hash: subjectHash,
    },
  });
  assert.equal(rawAssertion.trace_diagnostic_moat.promotion_status, "REMAIN_TRACE");

  const receipt = signedReceipt({ replay_subject_hash: subjectHash });
  const signed = buildPeakSelfLoopPreview({
    signal_events: nine,
    noise_events: [],
    trace_corroboration: receipt,
    trace_corroboration_context: {
      trusted_verifiers: TRUSTED,
      proposer_origin: "pat.local.proposer",
      executor_origin: "node0.local.executor",
      expected_challenge: CHALLENGE,
    },
  });
  assert.equal(signed.trace_diagnostic_moat.origin_verification.ok, true);
  assert.equal(signed.trace_diagnostic_moat.promotion_status, "INSIGHT_AUTHORIZED");
});
