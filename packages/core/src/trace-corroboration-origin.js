// TRACE-CORROBORATION-ORIGIN-1A
//
// Pure verifier for external corroboration origin.
// It verifies a caller-supplied Ed25519 receipt against an explicit trust set,
// exact replay-subject hash, challenge nonce, and origin separation constraints.
//
// This module mints no authority and performs no network, fs, clock, wallet,
// token, daemon, or runtime effects.

import {
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";

export const TRACE_CORROBORATION_ORIGIN_SCHEMA =
  "bizra.dema.trace_corroboration_origin.v0.1";

const HEX64_RE = /^[0-9a-f]{64}$/;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v) ?? "null").join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .flatMap((key) => {
        const serialized = stableStringify(value[key]);
        return serialized === undefined
          ? []
          : [`${JSON.stringify(key)}:${serialized}`];
      });
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

export function canonicalTraceCorroborationOriginPayload(corroboration = {}) {
  const payload = {
    schema: text(corroboration.schema),
    verifier_id: text(corroboration.verifier_id),
    verifier_key_id: text(corroboration.verifier_key_id),
    replay_performed: corroboration.replay_performed === true,
    replay_subject_hash: text(corroboration.replay_subject_hash),
    independent_replay_hash: text(corroboration.independent_replay_hash),
    challenge_nonce: text(corroboration.challenge_nonce),
  };
  return stableStringify(payload);
}

function findTrustedVerifier(trustedVerifiers, verifierId, verifierKeyId) {
  if (!Array.isArray(trustedVerifiers)) return null;
  return (
    trustedVerifiers.find(
      (candidate) =>
        candidate &&
        typeof candidate === "object" &&
        text(candidate.verifier_id) === verifierId &&
        text(candidate.verifier_key_id) === verifierKeyId &&
        candidate.status === "ACTIVE" &&
        text(candidate.public_key_pem),
    ) ?? null
  );
}

export function verifyTraceCorroborationOrigin({
  corroboration,
  expected_subject_hash,
  trusted_verifiers = [],
  proposer_origin = "",
  executor_origin = "",
  expected_challenge = "",
} = {}) {
  const blocked = [];
  const receipt =
    corroboration &&
    typeof corroboration === "object" &&
    !Array.isArray(corroboration)
      ? corroboration
      : {};

  if (receipt.schema !== TRACE_CORROBORATION_ORIGIN_SCHEMA) {
    blocked.push("corroboration_origin_invalid_schema");
  }

  const verifierId = text(receipt.verifier_id);
  const verifierKeyId = text(receipt.verifier_key_id);
  if (!verifierId) blocked.push("corroboration_origin_verifier_id_missing");
  if (!verifierKeyId) blocked.push("corroboration_origin_verifier_key_id_missing");

  const proposerOrigin = text(proposer_origin);
  const executorOrigin = text(executor_origin);
  if (verifierId && proposerOrigin && verifierId === proposerOrigin) {
    blocked.push("corroboration_origin_same_as_proposer");
  }
  if (verifierId && executorOrigin && verifierId === executorOrigin) {
    blocked.push("corroboration_origin_same_as_executor");
  }

  const trusted = findTrustedVerifier(
    trusted_verifiers,
    verifierId,
    verifierKeyId,
  );
  if (!trusted) {
    blocked.push("corroboration_origin_unknown_verifier");
  }

  if (receipt.replay_performed !== true) {
    blocked.push("corroboration_origin_replay_not_performed");
  }

  const replaySubjectHash = text(receipt.replay_subject_hash);
  const expectedSubjectHash = text(expected_subject_hash);
  if (!HEX64_RE.test(replaySubjectHash)) {
    blocked.push("corroboration_origin_subject_hash_invalid");
  } else if (!HEX64_RE.test(expectedSubjectHash)) {
    blocked.push("corroboration_origin_expected_subject_invalid");
  } else if (replaySubjectHash !== expectedSubjectHash) {
    blocked.push("corroboration_origin_subject_mismatch");
  }

  const replayHash = text(receipt.independent_replay_hash);
  if (!HEX64_RE.test(replayHash)) {
    blocked.push("corroboration_origin_replay_hash_invalid");
  }

  const challenge = text(receipt.challenge_nonce);
  const expectedChallenge = text(expected_challenge);
  if (!challenge) {
    blocked.push("corroboration_origin_challenge_missing");
  } else if (!expectedChallenge || challenge !== expectedChallenge) {
    blocked.push("corroboration_origin_challenge_mismatch");
  }

  const signatureB64 = text(receipt.signature_b64);
  if (!signatureB64) {
    blocked.push("corroboration_origin_signature_missing");
  } else if (trusted) {
    try {
      const key = createPublicKey(trusted.public_key_pem);
      const signature = Buffer.from(signatureB64, "base64");
      const message = Buffer.from(
        canonicalTraceCorroborationOriginPayload(receipt),
        "utf8",
      );
      if (!verifySignature(null, message, key, signature)) {
        blocked.push("corroboration_origin_signature_invalid");
      }
    } catch {
      blocked.push("corroboration_origin_signature_invalid");
    }
  }

  const ok = blocked.length === 0;
  return deepFreeze({
    ok,
    blocked_by: Object.freeze([...blocked]),
    verifier_id: verifierId || null,
    verifier_key_id: verifierKeyId || null,
    verification_mode: "ed25519_origin_receipt",
    normalized_corroboration: ok
      ? Object.freeze({
          replay_performed: true,
          independent: true,
          independent_replay_hash: replayHash,
          replay_subject_hash: replaySubjectHash,
        })
      : null,
  });
}
