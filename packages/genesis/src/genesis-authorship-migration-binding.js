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
  pairConsistency,
  KEY_MIGRATE_CONSENT_PHRASE,
} from "../../receipts/src/authorship-key-store.js";
import { fingerprintPublicKeyPem } from "../../receipts/src/authorship-signature.js";
import { claimConsentNonce } from "../../receipts/src/consent-nonce-claim.js";

// v0.2: the preview now seals the independently observed TARGET ESTATE
// (canonical realpath + device + inode of the governed home). An older v0.1
// preview remains parseable history but can never authorize this executor —
// NEW_STRONGER_GENESIS_PROFILE CANNOT_EXECUTE_OLD_WEAKER_PREVIEW.
export const AUTHORSHIP_MIGRATION_PREVIEW_SCHEMA =
  "bizra.dema.genesis_authorship_migration_preview.v0.2";
export const AUTHORSHIP_MIGRATION_RESULT_SCHEMA =
  "bizra.dema.genesis_authorship_migration_result.v0.1";
export const AUTHORSHIP_MIGRATION_CONSENT_SCHEMA =
  "bizra.dema.genesis_authorship_migration_consent.v0.1";
export const AUTHORSHIP_MIGRATION_OPERATION = "MIGRATE_AUTHORSHIP_KEY";

/**
 * The one repository-identity derivation, used by BOTH the sealing side and
 * the executing side, so the comparison is exact-string over independently
 * measured commit + tree values — never a caller-composed display string.
 * CALLER_SUPPLIED_REPOSITORY != EXECUTING_REPOSITORY_IDENTITY.
 */
export function repositoryIdentityFromBinding(binding) {
  const commit = binding?.commit;
  const tree = binding?.tree;
  if (!/^[0-9a-f]{40}$/.test(commit ?? "") || !/^[0-9a-f]{40}$/.test(tree ?? "")) {
    return null;
  }
  return `git:${commit}:${tree}`;
}

// Domain-separated so this digest can never collide with any other sha256 in
// the system. The hash covers the identity-bearing fields in FIXED order —
// deliberately not a generic canonical-JSON consumer (that surface is
// adoption-frozen and this preview needs exactly eight known fields).
const PREVIEW_HASH_DOMAIN = "BIZRA:GENESIS_AUTHORSHIP_MIGRATION_PREVIEW:v1\0";

const isStr = (v) => typeof v === "string" && v.length > 0;
const sha256 = (s) => createHash("sha256").update(s).digest("hex");

/** The target-estate triple must be three non-empty strings — the exact
 *  frozen shape captureDirectoryIdentity produces. Anything else is not
 *  evidence. DIRECTORY_IDENTITY != NODE_IDENTITY: this names a directory
 *  object on this host, never the sovereign's node. */
function isTargetEstate(t) {
  return !!t && typeof t === "object" && !Array.isArray(t)
    && isStr(t.realpath) && isStr(t.dev) && isStr(t.ino);
}

function previewHash(f) {
  // Eleven fixed fields since v0.2: the original eight plus the sealed
  // target-estate triple. The domain prefix stays v1 — the version lives in
  // the hashed schema field, never inside the domain separator.
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
        f.target_estate.realpath,
        f.target_estate.dev,
        f.target_estate.ino,
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
  // Independently observed at the boundary (captureDirectoryIdentity), never
  // caller-composed prose. node_id stays SOVEREIGN_DECLARED; this triple is
  // the OBSERVED substrate the authority will spend into.
  targetEstate,
} = {}) {
  for (const [k, v] of Object.entries({ demaHome, nodeId, nonce, expiresAt, repository, now })) {
    if (!isStr(v)) return Object.freeze({ ok: false, reason: `preview_input_missing:${k}` });
  }
  if (!isTargetEstate(targetEstate)) {
    return Object.freeze({ ok: false, reason: "preview_input_missing:target_estate" });
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
  // Preview quality: the sovereign must never be shown a fingerprint whose
  // pair cannot actually migrate. Coherence (Ed25519, private matches public)
  // is proven HERE, read-only — not discovered at execution time.
  let privatePem;
  try {
    privatePem = await readFile(paths.privateKey, "utf8");
  } catch {
    return Object.freeze({ ok: false, reason: "legacy_private_key_unreadable" });
  }
  const pair = pairConsistency(privatePem, publicPem);
  if (!pair.ok) {
    return Object.freeze({
      ok: false,
      reason: pair.error === "unsupported_key_algorithm"
        ? "unsupported_key_algorithm"
        : "legacy_pair_incoherent",
    });
  }
  let fingerprint;
  try {
    fingerprint = fingerprintPublicKeyPem(publicPem);
  } catch {
    return Object.freeze({ ok: false, reason: "legacy_key_unreadable" });
  }
  if (fingerprint !== pair.fingerprint) {
    return Object.freeze({ ok: false, reason: "fingerprint_derivation_disagreement" });
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
    target_estate: Object.freeze({
      realpath: targetEstate.realpath,
      dev: targetEstate.dev,
      ino: targetEstate.ino,
    }),
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
 * Build the sovereign consent envelope: the human's authorization artifact,
 * bound to the EXACT sealed preview by hash and nonce. CONSENT_TO_PHRASE !=
 * CONSENT_TO_PREVIEW — the phrase alone authorizes nothing on this path.
 */
export function buildAuthorshipMigrationConsentEnvelope({ preview, consent, now } = {}) {
  if (!preview || typeof preview !== "object" || !isStr(preview.preview_hash)) {
    return Object.freeze({ ok: false, reason: "preview_required" });
  }
  if (!isStr(preview.nonce) || !isStr(preview.expires_at)) {
    return Object.freeze({ ok: false, reason: "preview_malformed" });
  }
  if (!isStr(consent)) return Object.freeze({ ok: false, reason: "consent_required" });
  if (!isStr(now)) return Object.freeze({ ok: false, reason: "issued_at_required" });
  return Object.freeze({
    ok: true,
    envelope: Object.freeze({
      schema: AUTHORSHIP_MIGRATION_CONSENT_SCHEMA,
      operation: AUTHORSHIP_MIGRATION_OPERATION,
      consent,
      preview_hash: preview.preview_hash,
      nonce: preview.nonce,
      issued_at: now,
      expires_at: preview.expires_at,
      authority_delta: 0,
    }),
  });
}

/**
 * The Genesis migration profile — the ONLY production path to a legacy-key
 * migration. Envelope-first, then the sealed preview is verified, then the
 * human's consent binding is verified against the RE-DERIVED preview hash
 * (never against a field the caller could edit), then repository and subject
 * bindings, and only then is the nonce claimed and the exact-target migration
 * delegated. Refusals mutate nothing except the nonce ledger once claiming
 * has begun — a consumed nonce is the intended durable record of an attempt.
 */
export async function executeGenesisAuthorshipMigration({
  preview,
  consentEnvelope,
  demaHome,
  now,
  executingRepository,
  subjectNodeId,
  // Injected estate observer (the CLI supplies captureDirectoryIdentity over
  // the resolved DEMA_HOME). A function, not a value, so the measurement is
  // taken at the gate itself — the executor never accepts estate prose.
  observeTargetEstate,
  // Accepted and deliberately IGNORED in favor of the sealed preview's
  // target — see MC-04. Present in the signature so a confused caller's
  // value cannot silently reach the binding through any merge order.
  expectedFingerprint: _callerSupplied,
  // Legacy positional phrase — no longer sufficient; the envelope carries it.
  consent: _phraseOnly,
} = {}) {
  const env = consentEnvelope;
  if (!env || typeof env !== "object" || Array.isArray(env)) {
    return refuse("consent_envelope_required");
  }
  if (env.schema !== AUTHORSHIP_MIGRATION_CONSENT_SCHEMA) {
    return refuse("consent_envelope_malformed:schema");
  }
  if (env.operation !== AUTHORSHIP_MIGRATION_OPERATION) {
    return refuse("consent_envelope_wrong_operation");
  }
  if (env.authority_delta !== 0) {
    return refuse("consent_envelope_authority_nonzero");
  }
  for (const k of ["preview_hash", "nonce"]) {
    if (!isStr(env[k])) return refuse(`consent_envelope_malformed:${k}`);
  }
  if (env.consent !== KEY_MIGRATE_CONSENT_PHRASE) {
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
  // No downgrade: a preview that does not seal the target estate cannot
  // authorize this executor, however coherent its other fields are —
  // NEW_STRONGER_GENESIS_PROFILE CANNOT_EXECUTE_OLD_WEAKER_PREVIEW.
  if (!isTargetEstate(preview.target_estate)) {
    return refuse("target_estate_binding_required");
  }
  const derivedHash = previewHash(preview);
  if (derivedHash !== preview.preview_hash) {
    return refuse("preview_hash_mismatch");
  }
  // THE BINDING LAW, verified before the nonce claim and any mutation:
  //   HUMAN_CONSENT.preview_hash == SEALED_PREVIEW.preview_hash (re-derived)
  // The comparison side is the RE-DERIVED hash — evidence the caller cannot
  // edit into agreement — never the preview's own carried field.
  if (env.preview_hash !== derivedHash) {
    return refuse("consent_binding_mismatch");
  }
  if (env.nonce !== preview.nonce) {
    return refuse("consent_nonce_binding_mismatch");
  }
  const expiresMs = Date.parse(preview.expires_at);
  const nowMs = Date.parse(now);
  if (Number.isNaN(expiresMs) || Number.isNaN(nowMs)) {
    return refuse("preview_time_malformed");
  }
  if (nowMs >= expiresMs) {
    return refuse("preview_expired");
  }
  if (isStr(env.expires_at) && nowMs >= Date.parse(env.expires_at)) {
    return refuse("consent_envelope_expired");
  }
  if (isStr(env.issued_at) && Date.parse(env.issued_at) > nowMs + 300000) {
    return refuse("consent_envelope_future");
  }
  // Repository binding: the executing identity is derived by the boundary
  // through repositoryIdentityFromBinding, never composed from caller args.
  // Unknown is refused, not assumed — REFUSE/UNKNOWN, never silent accept.
  if (!isStr(executingRepository)) {
    return refuse("repository_binding_unverifiable");
  }
  if (executingRepository !== preview.repository) {
    return refuse("repository_binding_mismatch");
  }
  // Target-estate binding: the estate is RE-OBSERVED at execution through
  // the injected observer. The preview names the estate; it is never the
  // source that proves it — PREVIEW_CARRIED_SUBJECT !=
  // EXECUTION_OBSERVED_SUBJECT, and SELF_CONSISTENCY !=
  // INDEPENDENT_VERIFICATION. Refused before the nonce claim.
  if (typeof observeTargetEstate !== "function") {
    return refuse("target_estate_unverifiable");
  }
  let observedEstate;
  try {
    observedEstate = observeTargetEstate();
  } catch {
    return refuse("target_estate_unverifiable");
  }
  if (!isTargetEstate(observedEstate)) {
    return refuse("target_estate_unverifiable");
  }
  if (
    observedEstate.realpath !== preview.target_estate.realpath ||
    observedEstate.dev !== preview.target_estate.dev ||
    observedEstate.ino !== preview.target_estate.ino
  ) {
    return refuse("target_estate_mismatch");
  }
  // The sovereign-declared label has no independent pre-Genesis source
  // (IDENTITY IS SUPPLIED, NEVER DERIVED), so it is enforce-when-present:
  // a caller that re-asserts it is held to it; its binding authority is the
  // consent envelope, and the estate above is what execution proves. The
  // old mandatory form was fed the preview's own node_id by the CLI — x == x
  // certified nothing, and that route is closed at the CLI boundary.
  if (subjectNodeId !== undefined && subjectNodeId !== null) {
    if (!isStr(subjectNodeId)) {
      return refuse("subject_binding_unverifiable");
    }
    if (subjectNodeId !== preview.node_id) {
      return refuse("subject_binding_mismatch");
    }
  }

  const claim = await claimConsentNonce({ nonce: preview.nonce, demaHome });
  if (!claim.claimed) {
    return refuse(claim.reason);
  }

  const r = await migrateLegacyAuthorshipKey({
    consent: env.consent,
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
