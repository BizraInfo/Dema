// GENESIS-AUTHORSHIP-MIGRATION-CONSENT-BINDING-1A — consent to the exact
// authority target, not to an operation class.
//
// THE GAP THIS CLOSES. `MIGRATE AUTHORSHIP KEY` authorized a CLASS of act, and
// the implementation then migrated whichever coherent legacy pair sat on disk
// at execution time. For Genesis ancestry that is insufficient: the fingerprint
// the sovereign saw in the preview is the only fingerprint that may become the
// first governed generation. Required law:
//
//   PREVIEWED_FINGERPRINT == CONSENT_BOUND_FINGERPRINT
//                         == EXECUTION_TIME_DERIVED_FINGERPRINT
//
// The execution-time side is re-derived from disk under the identity lease
// inside `migrateLegacyAuthorshipKey` — evidence the caller does not control,
// so no comparison here is x == x.
//
// SEALED PREVIEW WINS. A caller-supplied fingerprint is presentation, never
// authority; the sealed preview's target is used regardless of merge order
// (same law GS-14/15 pinned for the mission consent gate).
//
// NO DOWNGRADE. This profile refuses a preview without a bound target. The
// generic phrase-only API survives for its historical callers, but the Genesis
// ceremony path can never fall back to it.
//
// ONE NONCE AUTHORITY. Replay protection is `claimConsentNonce` — the estate's
// single consent-nonce authority. A refused attempt still consumes its nonce:
// failure never widens authority, and a fresh act needs fresh consent.
//
// MIGRATION != VERIFICATION. Success proves the human authorized this exact
// fingerprint, this exact fingerprint was migrated, and the canonical loader
// accepts the result. It does not prove who created the legacy key, any
// external identity of it, Node0 closure, or Genesis root establishment.

import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

import {
  keyPaths,
  migrateLegacyAuthorshipKey,
  KEY_MIGRATE_CONSENT_PHRASE,
} from "../../receipts/src/authorship-key-store.js";
import { fingerprintPublicKeyPem } from "../../receipts/src/authorship-signature.js";
import { claimConsentNonce } from "../../receipts/src/consent-nonce-claim.js";

export const AUTHORSHIP_MIGRATION_PREVIEW_SCHEMA =
  "bizra.dema.genesis_authorship_migration_preview.v0.1";
export const AUTHORSHIP_MIGRATION_RESULT_SCHEMA =
  "bizra.dema.genesis_authorship_migration_result.v0.1";
export const AUTHORSHIP_MIGRATION_OPERATION = "MIGRATE_AUTHORSHIP_KEY";

// Domain-separated so this digest can never collide with any other sha256 in
// the system. The hash covers the identity-bearing fields in FIXED order —
// deliberately not a generic canonical-JSON consumer (that surface is
// adoption-frozen and this preview needs exactly eight known fields).
const PREVIEW_HASH_DOMAIN = "BIZRA:GENESIS_AUTHORSHIP_MIGRATION_PREVIEW:v1\0";

const isStr = (v) => typeof v === "string" && v.length > 0;
const sha256 = (s) => createHash("sha256").update(s).digest("hex");

function previewHash(f) {
  return sha256(
    PREVIEW_HASH_DOMAIN +
      [
        f.schema,
        f.operation,
        f.algorithm,
        f.expected_fingerprint,
        f.node_id,
        f.nonce,
        f.expires_at,
        f.repository,
      ].join("\n"),
  );
}

const refuse = (error, extra = {}) =>
  Object.freeze({
    schema: AUTHORSHIP_MIGRATION_RESULT_SCHEMA,
    migrated: false,
    error,
    authority_delta: 0,
    state_delta: Object.freeze({
      generation_written: false,
      pointer_committed: false,
      new_key_material: false,
    }),
    ...extra,
  });

/**
 * Read-only: build the sealed preview the sovereign will be shown and the
 * exact object later execution is bound to. Reads the legacy public key,
 * derives the candidate fingerprint, and seals identity-bearing fields under
 * a domain-separated hash. Writes nothing.
 */
export async function buildAuthorshipMigrationPreview({
  demaHome,
  nodeId,
  nonce,
  expiresAt,
  repository,
  now,
} = {}) {
  for (const [k, v] of Object.entries({ demaHome, nodeId, nonce, expiresAt, repository, now })) {
    if (!isStr(v)) return Object.freeze({ ok: false, reason: `preview_input_missing:${k}` });
  }
  if (Number.isNaN(Date.parse(expiresAt)) || Number.isNaN(Date.parse(now))) {
    return Object.freeze({ ok: false, reason: "preview_time_malformed" });
  }
  const paths = keyPaths(demaHome);
  let publicPem;
  let privatePresent = false;
  try {
    publicPem = await readFile(paths.publicKey, "utf8");
    await readFile(paths.privateKey, "utf8");
    privatePresent = true;
  } catch {
    return Object.freeze({
      ok: false,
      reason: privatePresent ? "legacy_private_key_unreadable" : "no_legacy_key",
    });
  }
  let fingerprint;
  try {
    fingerprint = fingerprintPublicKeyPem(publicPem);
  } catch {
    return Object.freeze({ ok: false, reason: "legacy_key_unreadable" });
  }

  const fields = {
    schema: AUTHORSHIP_MIGRATION_PREVIEW_SCHEMA,
    operation: AUTHORSHIP_MIGRATION_OPERATION,
    algorithm: "ed25519",
    expected_fingerprint: fingerprint,
    node_id: nodeId,
    nonce,
    expires_at: expiresAt,
    repository,
  };
  return Object.freeze({
    ok: true,
    preview: Object.freeze({
      ...fields,
      built_at: now,
      // Presentation, not binding — excluded from the hash on purpose so the
      // eight identity-bearing fields alone decide what was consented to.
      authority_consequence:
        "this exact fingerprint becomes the first governed authorship generation; every future receipt chains from it; authority_delta 0",
      preview_hash: previewHash(fields),
    }),
  });
}

/**
 * The Genesis migration profile. Consent-first, then the sealed preview is
 * verified (presence of the bound target, hash integrity, freshness), the
 * nonce is claimed through the one consent-nonce authority, and only then is
 * the exact-target migration delegated. Refusals mutate nothing except the
 * nonce ledger once claiming has begun — a consumed nonce is the intended
 * durable record of an attempt.
 */
export async function executeGenesisAuthorshipMigration({
  preview,
  consent,
  demaHome,
  now,
  // Accepted and deliberately IGNORED in favor of the sealed preview's
  // target — see MC-04. Present in the signature so a confused caller's
  // value cannot silently reach the binding through any merge order.
  expectedFingerprint: _callerSupplied,
} = {}) {
  if (consent !== KEY_MIGRATE_CONSENT_PHRASE) {
    return refuse("consent_required", { required_phrase: KEY_MIGRATE_CONSENT_PHRASE });
  }
  if (!preview || typeof preview !== "object" || Array.isArray(preview)) {
    return refuse("preview_required");
  }
  if (preview.schema !== AUTHORSHIP_MIGRATION_PREVIEW_SCHEMA) {
    return refuse("preview_schema_unknown");
  }
  if (preview.operation !== AUTHORSHIP_MIGRATION_OPERATION) {
    return refuse("preview_operation_mismatch");
  }
  // No downgrade: the Genesis profile requires the exact bound target.
  if (!isStr(preview.expected_fingerprint)) {
    return refuse("binding_target_missing");
  }
  for (const k of ["node_id", "nonce", "expires_at", "repository", "preview_hash"]) {
    if (!isStr(preview[k])) return refuse(`preview_malformed:${k}`);
  }
  if (previewHash(preview) !== preview.preview_hash) {
    return refuse("preview_hash_mismatch");
  }
  const expiresMs = Date.parse(preview.expires_at);
  const nowMs = Date.parse(now);
  if (Number.isNaN(expiresMs) || Number.isNaN(nowMs)) {
    return refuse("preview_time_malformed");
  }
  if (nowMs >= expiresMs) {
    return refuse("preview_expired");
  }

  const claim = await claimConsentNonce({ nonce: preview.nonce, demaHome });
  if (!claim.claimed) {
    return refuse(claim.reason);
  }

  const r = await migrateLegacyAuthorshipKey({
    consent,
    demaHome,
    now,
    expectedFingerprint: preview.expected_fingerprint,
  });
  if (!r.migrated) {
    return refuse(r.error, {
      delegate: r,
      preview_hash: preview.preview_hash,
    });
  }
  return Object.freeze({
    schema: AUTHORSHIP_MIGRATION_RESULT_SCHEMA,
    migrated: true,
    fingerprint: r.fingerprint,
    generation_path: r.generation_path,
    preview_hash: preview.preview_hash,
    authority_delta: 0,
    state_delta: Object.freeze({
      generation_written: true,
      pointer_committed: true,
      new_key_material: false,
    }),
    effect_delta: "none_outside_dema_home",
  });
}
