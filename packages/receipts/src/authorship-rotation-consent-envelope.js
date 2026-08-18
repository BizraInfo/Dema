/**
 * Authorship-rotation consent envelope — the producer side of the gate that
 * `rotateAuthorshipKey` already enforces.
 *
 * `validateConsentEnvelope` in authorship-key-store.js refuses any rotation that
 * arrives without a nonce-bearing envelope, and checks `operation`,
 * `authority_delta`, `dema_home_hash`, `expires_at` and `issued_at` when they are
 * present. Until now nothing outside the test suite could build one, so the CLI
 * could only report the refusal. This module builds one.
 *
 * PURE: no filesystem, no network, no key material. The caller supplies the
 * clock (`issuedAtIso`) so the result is deterministic and testable. Generating
 * the successor keypair is `rotateAuthorshipKey`'s job and stays there — this
 * module never touches a key.
 *
 * The envelope authorises exactly one rotation of exactly one home:
 *  - `nonce` is single-use; rotateAuthorshipKey refuses a replay
 *    (`consent_nonce_replayed`) against its own nonce ledger.
 *  - `dema_home_hash` binds it to one DEMA_HOME, so an envelope minted for one
 *    home cannot authorise a rotation of another.
 *  - `expires_at` bounds it in time.
 *
 * Deliberately NOT reusing claimConsentNonce (consent-nonce-claim.js): that lives
 * in the BIZRA:CORRIDOR_WRITE:v1 nonce domain, and rotation keeps its own ledger.
 * One nonce namespace per surface — a cross-surface lookup is only meaningful
 * inside a single namespace.
 */

import { randomBytes } from "node:crypto";
import { sha256 } from "./authorship-signature.js";

export const ROTATION_CONSENT_ENVELOPE_SCHEMA =
  "bizra.dema.authorship_rotation_consent_envelope.v0.1";

/** Must equal the value validateConsentEnvelope checks for. */
export const ROTATION_ENVELOPE_OPERATION = "authorship_key_rotation";

/** Five minutes: long enough to paste a command, short enough to not linger. */
export const ROTATION_ENVELOPE_DEFAULT_TTL_MS = 300_000;

export const ROTATION_NONCE_BYTES = 32;

/** A fresh single-use nonce. 256 bits of CSPRNG, lowercase hex. */
export function generateRotationNonce() {
  return randomBytes(ROTATION_NONCE_BYTES).toString("hex");
}

/**
 * Build the envelope. Fails closed on missing or nonsensical input rather than
 * emitting something the validator would silently accept.
 *
 * `demaHome` MUST be the exact string the caller will pass to
 * rotateAuthorshipKey — the validator hashes its own `demaHome` argument, not a
 * resolved path, so the two must agree character for character.
 */
export function buildRotationConsentEnvelope({
  nonce,
  demaHome,
  issuedAtIso,
  ttlMs = ROTATION_ENVELOPE_DEFAULT_TTL_MS,
  ceremonyId,
  reason,
} = {}) {
  if (typeof nonce !== "string" || nonce.length === 0) {
    throw new TypeError("a non-empty nonce is required");
  }
  if (typeof demaHome !== "string" || demaHome.length === 0) {
    throw new TypeError("a non-empty demaHome is required");
  }
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new TypeError("ttlMs must be a positive finite number");
  }
  const issued =
    typeof issuedAtIso === "string" && issuedAtIso
      ? issuedAtIso
      : new Date().toISOString();
  const issuedMs = Date.parse(issued);
  if (!Number.isFinite(issuedMs)) {
    throw new TypeError(`issuedAtIso is not a parseable date: ${issued}`);
  }

  return Object.freeze({
    schema: ROTATION_CONSENT_ENVELOPE_SCHEMA,
    operation: ROTATION_ENVELOPE_OPERATION,
    nonce,
    // Never widened by this envelope. The validator refuses a nonzero value.
    authority_delta: 0,
    // The home is bound by hash only; the raw path is not carried.
    dema_home_hash: sha256(demaHome),
    issued_at: new Date(issuedMs).toISOString(),
    expires_at: new Date(issuedMs + ttlMs).toISOString(),
    ...(ceremonyId ? { ceremony_id: ceremonyId } : {}),
    ...(reason ? { reason } : {}),
  });
}
