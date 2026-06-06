// Operating canon (per docs/02-architecture/dema-mobile-qr-consent-v0.md):
//   The phone shows a phrase.
//   The operator types the phrase.
//   The laptop verifies.
//   The phone never holds, sends, or executes anything authoritative.

import { sha256, stableStringify } from "./consent-common.js";

export const MOBILE_QR_CHALLENGE_PREVIEW_SCHEMA =
  "bizra.dema.mobile_qr_challenge_preview.v0.1";

const DEFAULT_EXPIRES_IN_SECONDS = 90;
const PHRASE_DIGITS = 6;

const BOUNDARY = Object.freeze({
  runtime: false,
  federation: false,
  mint: false,
  network_used: false,
  secret_persisted_on_phone: false,
  phone_authority_granted: false,
  socket_opened: false,
  hook_executed: false,
});

const consumedChallengeIds = new Set();

function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function deriveChallengeId(canonicalPayload) {
  return `chal-${sha256(canonicalPayload).slice(0, 32)}`;
}

function derivePhrase(canonicalPayload) {
  const digest = sha256(canonicalPayload + ":phrase");
  const numeric = parseInt(digest.slice(0, 12), 16).toString();
  return numeric.slice(-PHRASE_DIGITS).padStart(PHRASE_DIGITS, "0");
}

function phraseFingerprint(phrase) {
  return `sha256:${sha256(phrase)}`;
}

export function buildMobileQrChallengePreview({
  mission_id,
  action,
  purpose,
  now = new Date(),
  expires_in_seconds = DEFAULT_EXPIRES_IN_SECONDS,
} = {}) {
  if (!nonEmptyString(mission_id)) {
    return failChallenge(
      "invalid_mission_id",
      "mission_id must be a non-empty string",
    );
  }
  if (!nonEmptyString(action)) {
    return failChallenge("invalid_action", "action must be a non-empty string");
  }
  if (!nonEmptyString(purpose)) {
    return failChallenge(
      "invalid_purpose",
      "purpose must be a non-empty string",
    );
  }
  if (!isValidDate(now)) {
    return failChallenge("invalid_now", "now must be a valid Date");
  }
  if (!Number.isFinite(expires_in_seconds) || expires_in_seconds <= 0) {
    return failChallenge(
      "invalid_expires_in_seconds",
      "expires_in_seconds must be a positive finite number",
    );
  }

  const expires_at = new Date(
    now.getTime() + expires_in_seconds * 1000,
  ).toISOString();
  const canonicalPayload = stableStringify({
    mission_id,
    action,
    purpose,
    expires_at,
  });
  const challenge_id = deriveChallengeId(canonicalPayload);
  const phrase = derivePhrase(canonicalPayload);

  return deepFreeze(
    clone({
      schema: MOBILE_QR_CHALLENGE_PREVIEW_SCHEMA,
      mode: "PREVIEW_ONLY",
      truth_label: "DECLARED",
      valid: true,
      challenge_id,
      mission_id,
      action,
      purpose,
      generated_at: now.toISOString(),
      expires_at,
      phrase,
      phrase_fingerprint: phraseFingerprint(phrase),
      boundary: BOUNDARY,
      note: "Display this on the laptop AND on the phone (via QR or text viewer). Operator types the phrase back on the laptop to confirm.",
    }),
  );
}

function failChallenge(code, detail) {
  return deepFreeze(
    clone({
      schema: MOBILE_QR_CHALLENGE_PREVIEW_SCHEMA,
      mode: "PREVIEW_ONLY",
      truth_label: "DECLARED",
      valid: false,
      challenge_id: null,
      denial: { code, detail },
      boundary: BOUNDARY,
    }),
  );
}

function verificationResult({
  ok,
  reason,
  detail = "",
  challenge_id = null,
  recorded_at = null,
}) {
  return deepFreeze(
    clone({
      schema: MOBILE_QR_CHALLENGE_PREVIEW_SCHEMA,
      mode: "PREVIEW_ONLY",
      truth_label: "DECLARED",
      ok,
      reason,
      detail,
      challenge_id,
      recorded_at,
      not_an_authorization: !ok,
      boundary: BOUNDARY,
    }),
  );
}

export function verifyMobileQrChallengePreview(
  challenge,
  typed_phrase,
  { now = new Date() } = {},
) {
  if (!challenge || typeof challenge !== "object" || challenge.valid !== true) {
    return verificationResult({
      ok: false,
      reason: "invalid_challenge",
      detail: "challenge must be a valid build result",
    });
  }
  if (!isValidDate(now)) {
    return verificationResult({
      ok: false,
      reason: "invalid_now",
      detail: "now must be a valid Date",
      challenge_id: challenge.challenge_id,
    });
  }
  if (!nonEmptyString(typed_phrase)) {
    return verificationResult({
      ok: false,
      reason: "missing_phrase",
      detail: "typed_phrase must be a non-empty string",
      challenge_id: challenge.challenge_id,
    });
  }

  const expiresMs = Date.parse(challenge.expires_at);
  if (!Number.isFinite(expiresMs) || now.getTime() >= expiresMs) {
    return verificationResult({
      ok: false,
      reason: "expired",
      detail: "challenge has expired",
      challenge_id: challenge.challenge_id,
    });
  }

  if (consumedChallengeIds.has(challenge.challenge_id)) {
    return verificationResult({
      ok: false,
      reason: "replay",
      detail: "challenge_id was already consumed",
      challenge_id: challenge.challenge_id,
    });
  }

  if (typed_phrase !== challenge.phrase) {
    return verificationResult({
      ok: false,
      reason: "phrase_mismatch",
      detail: "typed phrase does not match challenge phrase",
      challenge_id: challenge.challenge_id,
    });
  }

  consumedChallengeIds.add(challenge.challenge_id);
  return verificationResult({
    ok: true,
    reason: "verified",
    detail: "Phrase matches; challenge consumed in-memory.",
    challenge_id: challenge.challenge_id,
    recorded_at: now.toISOString(),
  });
}

export function resetConsumedChallengesForTestsOnly() {
  consumedChallengeIds.clear();
}
