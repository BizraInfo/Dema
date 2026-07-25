import { constants } from "node:fs";
import { mkdir, lstat, realpath, open, rename, unlink } from "node:fs/promises";
import { join, dirname, relative, isAbsolute, sep } from "node:path";
import { homedir } from "node:os";
import {
  generateEd25519Keypair,
  fingerprintPublicKeyPem,
  keypairMatches,
  sha256,
} from "./authorship-signature.js";

export const KEY_INIT_CONSENT_PHRASE = "GENERATE AUTHORSHIP KEY";
export const KEY_INIT_SCHEMA = "bizra.dema.authorship_key_init.v0.1";
export const KEY_ROTATE_CONSENT_PHRASE = "ROTATE AUTHORSHIP KEY";
export const KEY_ROTATE_SCHEMA = "bizra.dema.authorship_key_rotate.v0.1";
export const KEY_ROTATE_RECEIPT_SCHEMA =
  "bizra.dema.authorship_key_rotate_receipt.v0.1";
export const KEY_ROTATE_JOURNAL_SCHEMA =
  "bizra.dema.authorship_rotation_journal.v0.1";
export const RETIRED_REGISTRY_SCHEMA = "bizra.dema.retired_key_registry.v0.1";

const PRIVATE_KEY_FILENAME = "node0-ed25519.pem";
const PUBLIC_KEY_FILENAME = "node0-ed25519.pub.pem";
const NO_FOLLOW = constants.O_NOFOLLOW ?? 0;

class UnsafeKeyPathError extends Error {
  constructor(path) {
    super(`Unsafe key path refused: ${path}`);
    this.name = "UnsafeKeyPathError";
    this.path = path;
  }
}

class KeyAlreadyExistsError extends Error {
  constructor(path) {
    super(`Key already exists: ${path}`);
    this.name = "KeyAlreadyExistsError";
    this.path = path;
  }
}

function keysDir(demaHome) {
  const home =
    typeof demaHome === "string" && demaHome.length > 0
      ? demaHome
      : process.env.DEMA_HOME || join(homedir(), ".dema");
  return join(home, "keys");
}

export function keyPaths(demaHome) {
  const dir = keysDir(demaHome);
  return {
    dir,
    privateKey: join(dir, PRIVATE_KEY_FILENAME),
    publicKey: join(dir, PUBLIC_KEY_FILENAME),
  };
}

async function keyExists(path) {
  const info = await lstatIfExists(path);
  return Boolean(info && !info.isSymbolicLink());
}

async function lstatIfExists(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function isInsideOrSame(child, parent) {
  const rel = relative(parent, child);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

async function prepareKeyDirectory(paths) {
  const homeDir = dirname(paths.dir);
  await mkdir(homeDir, { recursive: true });

  const dirInfo = await lstatIfExists(paths.dir);
  if (dirInfo?.isSymbolicLink()) return paths.dir;

  await mkdir(paths.dir, { recursive: true });

  for (const keyPath of [paths.privateKey, paths.publicKey]) {
    const keyInfo = await lstatIfExists(keyPath);
    if (keyInfo?.isSymbolicLink()) return keyPath;
  }

  const homeReal = await realpath(homeDir);
  const dirReal = await realpath(paths.dir);
  if (!isInsideOrSame(dirReal, homeReal)) return paths.dir;

  return null;
}

async function existingKeyPath(paths) {
  for (const path of [paths.privateKey, paths.publicKey]) {
    if (await keyExists(path)) return path;
  }
  return null;
}

async function isSafeExistingKeyPath(paths, keyPath) {
  const dirInfo = await lstatIfExists(paths.dir);
  if (!dirInfo || dirInfo.isSymbolicLink() || !dirInfo.isDirectory()) {
    return false;
  }

  const keyInfo = await lstatIfExists(keyPath);
  if (!keyInfo || keyInfo.isSymbolicLink() || !keyInfo.isFile()) {
    return false;
  }

  const homeReal = await realpath(dirname(paths.dir));
  const dirReal = await realpath(paths.dir);
  return isInsideOrSame(dirReal, homeReal);
}

async function readKeyFile(paths, keyPath) {
  try {
    if (!(await isSafeExistingKeyPath(paths, keyPath))) return null;
    let handle;
    try {
      handle = await open(keyPath, constants.O_RDONLY | NO_FOLLOW);
      return await handle.readFile("utf8");
    } finally {
      await handle?.close();
    }
  } catch {
    return null;
  }
}

async function writeKeyFile(path, content, { mode, force }) {
  const flags =
    constants.O_WRONLY |
    constants.O_CREAT |
    NO_FOLLOW |
    (force ? constants.O_TRUNC : constants.O_EXCL);
  let handle;
  try {
    handle = await open(path, flags, mode);
    await handle.writeFile(content, "utf8");
  } catch (error) {
    if (error?.code === "ELOOP") throw new UnsafeKeyPathError(path);
    if (error?.code === "EEXIST") throw new KeyAlreadyExistsError(path);
    throw error;
  } finally {
    await handle?.close();
  }
}

export async function initAuthorshipKey({
  consent,
  demaHome,
  force = false,
} = {}) {
  if (consent !== KEY_INIT_CONSENT_PHRASE) {
    return Object.freeze({
      schema: KEY_INIT_SCHEMA,
      initialized: false,
      error: "consent_required",
      required_phrase: KEY_INIT_CONSENT_PHRASE,
      boundary: buildBoundary(false),
    });
  }

  const paths = keyPaths(demaHome);
  const unsafePath = await prepareKeyDirectory(paths);
  if (unsafePath) return unsafeKeyPathResult(unsafePath);

  if (!force && (await existingKeyPath(paths))) {
    return keyAlreadyExistsResult(paths);
  }

  const keys = generateEd25519Keypair();

  try {
    await writeKeyFile(paths.privateKey, keys.private_key_pem, {
      mode: 0o600,
      force,
    });
    await writeKeyFile(paths.publicKey, keys.public_key_pem, {
      mode: 0o644,
      force,
    });
  } catch (error) {
    if (error instanceof UnsafeKeyPathError) {
      return unsafeKeyPathResult(error.path);
    }
    if (error instanceof KeyAlreadyExistsError) {
      return keyAlreadyExistsResult(paths);
    }
    throw error;
  }

  return Object.freeze({
    schema: KEY_INIT_SCHEMA,
    initialized: true,
    public_key_fingerprint: keys.public_key_fingerprint,
    private_key_path: paths.privateKey,
    public_key_path: paths.publicKey,
    boundary: buildBoundary(true),
  });
}

function rotateFailClosed(error, detail) {
  return Object.freeze({
    schema: KEY_ROTATE_SCHEMA,
    rotated: false,
    error,
    ...(detail ? { detail } : {}),
    boundary: buildBoundary(false),
  });
}

// Replace the compromised authorship key with a fresh one. TRANSACTIONAL:
//   FREEZE -> STAGE_QUARANTINE -> CREATE+VERIFY_NEW -> ARCHIVE_GENERATION
//   -> journal PREPARED -> ACTIVATING (temp+fsync+ordered rename+dir fsync)
//   -> post-rename verify -> journal ACTIVE
//   -> COMMIT_RETIREMENT (registry denylist, fail-closed) -> RETIREMENT_COMMITTED
//   -> SEAL_RECEIPT -> COMPLETE
// Retirement is NEVER committed to the denylist before the new key is active and
// verified. Any failure before ACTIVE rolls the old key back and leaves it
// unchanged; a failure after ACTIVE but before RETIREMENT leaves the new key
// active with retirement pending (recoverable, never an ambiguous mixed pair).
// ponytail: this keeps the legacy two-file active layout (25 loader consumers +
// init test depend on keys/node0-ed25519.pem); full generation-only loader
// migration is a documented follow-up (see PR body). The generation archive +
// journal + retired-fp loader rejection give crash-detectability today.
export async function rotateAuthorshipKey({
  consent,
  demaHome,
  retiredAt,
  reason = "compromised_key_rotation",
  envelope,
} = {}) {
  if (consent !== KEY_ROTATE_CONSENT_PHRASE) {
    return Object.freeze({
      schema: KEY_ROTATE_SCHEMA,
      rotated: false,
      error: "consent_required",
      required_phrase: KEY_ROTATE_CONSENT_PHRASE,
      boundary: buildBoundary(false),
    });
  }

  // Finding #1: insufficient consent must BLOCK mutation — never annotate a
  // completed one. A nonce-bearing consent envelope is required BEFORE any
  // filesystem state is created. Phrase-only consent is refused, not labeled.
  const nowIso =
    typeof retiredAt === "string" && retiredAt
      ? retiredAt
      : new Date().toISOString();
  const envelopeError = validateConsentEnvelope(envelope, demaHome, nowIso);
  if (envelopeError) {
    return Object.freeze({
      schema: KEY_ROTATE_SCHEMA,
      rotated: false,
      error: envelopeError,
      authority_delta: 0,
      boundary: buildBoundary(false),
    });
  }

  const paths = keyPaths(demaHome);
  const unsafePath = await prepareKeyDirectory(paths);
  if (unsafePath) {
    return Object.freeze({
      schema: KEY_ROTATE_SCHEMA,
      rotated: false,
      error: "unsafe_key_path",
      key_path: unsafePath,
      boundary: buildBoundary(false),
    });
  }

  const oldPrivatePem = await readKeyFile(paths, paths.privateKey);
  const oldPublicPem = await readKeyFile(paths, paths.publicKey);
  if (!oldPrivatePem || !oldPublicPem) {
    return rotateFailClosed("no_key_to_rotate");
  }

  const oldFingerprint = fingerprintPublicKeyPem(oldPublicPem);
  const stamp = nowIso;
  const journalPath = join(paths.dir, "rotation-journal.json");

  // Fail closed UPFRONT if the retirement registry is already corrupt — never
  // proceed to activate against a registry we cannot trust (old key unchanged).
  try {
    await assertRegistryReadable(join(paths.dir, "retired-registry.json"));
  } catch (error) {
    return rotateFailClosed("retired_registry_corrupt", error?.message);
  }

  // Consent nonce replay guard (fail-closed on corrupt nonce ledger).
  if (envelope?.nonce) {
    let used;
    try {
      used = await nonceAlreadyUsed(paths, envelope.nonce);
    } catch (error) {
      return rotateFailClosed("nonce_ledger_unreadable", error?.message);
    }
    if (used) return rotateFailClosed("consent_nonce_replayed");
  }

  // PHASE A — stage quarantine of the old key (preserves it; commits NOTHING).
  const stage = await stageQuarantine(
    paths,
    oldFingerprint,
    oldPrivatePem,
    oldPublicPem,
  );
  if (stage.error) {
    return rotateFailClosed("quarantine_stage_failed", stage.detail);
  }

  // Generate + self-verify the new pair before touching the active key.
  const keys = generateEd25519Keypair();
  if (!keypairMatches(keys.private_key_pem, keys.public_key_pem)) {
    return rotateFailClosed(
      "new_key_pair_invalid",
      "generated keypair failed self-verify",
    );
  }
  const newFp = keys.public_key_fingerprint;

  // Archive the complete new generation (durable record) + journal PREPARED.
  const generationDir = join(paths.dir, "generations", newFp);
  try {
    await mkdir(generationDir, { recursive: true });
    await writeFileSynced(join(generationDir, "private.pem"), keys.private_key_pem, 0o600);
    await writeFileSynced(join(generationDir, "public.pem"), keys.public_key_pem, 0o644);
    await writeFileSynced(
      join(generationDir, "metadata.json"),
      JSON.stringify({ fingerprint: newFp, created_at: stamp, supersedes: oldFingerprint }),
      0o600,
    );
    if ((await readExact(join(generationDir, "private.pem"))) !== keys.private_key_pem) {
      throw new Error("generation private byte-mismatch");
    }
  } catch (error) {
    return rotateFailClosed("generation_archive_failed", error?.message ?? String(error));
  }
  await writeJournal(journalPath, "PREPARED", oldFingerprint, newFp, stamp);

  // PHASE B — activate: temp + fsync + ordered rename + dir fsync.
  const tmpPriv = join(paths.dir, `.${PRIVATE_KEY_FILENAME}.tmp`);
  const tmpPub = join(paths.dir, `.${PUBLIC_KEY_FILENAME}.tmp`);
  try {
    await writeJournal(journalPath, "ACTIVATING", oldFingerprint, newFp, stamp);
    await removeIfExists(tmpPriv);
    await removeIfExists(tmpPub);
    await writeFileSynced(tmpPriv, keys.private_key_pem, 0o600);
    await writeFileSynced(tmpPub, keys.public_key_pem, 0o644);
    await rename(tmpPriv, paths.privateKey);
    await rename(tmpPub, paths.publicKey);
    await fsyncDir(paths.dir);
  } catch (error) {
    await restoreFromQuarantine(paths, stage.dir).catch(() => {});
    await removeIfExists(tmpPriv);
    await removeIfExists(tmpPub);
    await writeJournal(journalPath, "ROLLED_BACK", oldFingerprint, newFp, stamp);
    return rotateFailClosed("replacement_failed", error?.message ?? String(error));
  }

  // Post-activation read-back: active pair MUST be the new pair.
  const activePriv = await readKeyFile(paths, paths.privateKey);
  const activePub = await readKeyFile(paths, paths.publicKey);
  if (
    !activePriv ||
    !activePub ||
    fingerprintPublicKeyPem(activePub) !== newFp ||
    !keypairMatches(activePriv, activePub)
  ) {
    await restoreFromQuarantine(paths, stage.dir).catch(() => {});
    await writeJournal(journalPath, "ROLLED_BACK", oldFingerprint, newFp, stamp);
    return rotateFailClosed(
      "post_activation_verify_failed",
      "active key does not match the new pair after rename",
    );
  }
  await writeJournal(journalPath, "ACTIVE", oldFingerprint, newFp, stamp);

  // PHASE C — commit retirement ONLY now (new key is active + verified).
  let retirementCommitted = true;
  try {
    await commitRetirement(stage.dir, paths, oldFingerprint, stamp, reason);
    await writeJournal(journalPath, "RETIREMENT_COMMITTED", oldFingerprint, newFp, stamp);
  } catch (error) {
    // Activation stands; retirement is pending — recoverable, not a mixed pair.
    retirementCommitted = false;
    await writeJournal(journalPath, "ACTIVE_RETIREMENT_PENDING", oldFingerprint, newFp, stamp);
    return Object.freeze({
      schema: KEY_ROTATE_SCHEMA,
      rotated: true,
      old_fingerprint: oldFingerprint,
      new_fingerprint: newFp,
      retirement_committed: false,
      transaction_state: "ACTIVE_RETIREMENT_PENDING",
      requires: "retirement_completion_rerun",
      detail: error?.message ?? String(error),
      boundary: buildBoundary(true),
    });
  }

  if (envelope?.nonce) {
    await recordUsedNonce(paths, envelope.nonce, stamp).catch(() => {});
  }

  // SEAL receipt with full consent binding (envelope + nonce, not phrase alone).
  const receipt = {
    schema: KEY_ROTATE_RECEIPT_SCHEMA,
    old_fingerprint: oldFingerprint,
    new_fingerprint: newFp,
    generation_dir: generationDir,
    retired_at: stamp,
    reason,
    quarantine_dir: stage.dir,
    retired_registry_path: join(paths.dir, "retired-registry.json"),
    journal_path: journalPath,
    runtime_activation: "not_verified_no_runtime",
    revocation_state: "retired_local_denylisted",
    affected_receipt_assessment:
      "see R0B2_EXPOSURE_INTERVAL_ASSESSMENT (local signed-receipt exposure empty)",
    consent_binding: bindConsent(consent, envelope, oldFingerprint, newFp, stamp, reason, demaHome),
    private_key_material_included: false,
  };
  const receiptPath = await writeRotationReceipt(paths, newFp, receipt);
  await writeJournal(journalPath, "COMPLETE", oldFingerprint, newFp, stamp);

  return Object.freeze({
    schema: KEY_ROTATE_SCHEMA,
    rotated: true,
    retirement_committed: retirementCommitted,
    transaction_state: "COMPLETE",
    ...receipt,
    receipt_path: receiptPath,
    private_key_path: paths.privateKey,
    public_key_path: paths.publicKey,
    boundary: buildBoundary(true),
  });
}

// Finding #1/#2 gate: a rotation requires a nonce-bearing consent envelope.
// Returns an error code (mutation must be refused) or null (may proceed).
// Runs BEFORE any filesystem state is created. Never mutates.
function validateConsentEnvelope(envelope, demaHome, nowIso) {
  if (!envelope || typeof envelope !== "object") return "consent_envelope_required";
  if (typeof envelope.nonce !== "string" || envelope.nonce.length === 0) {
    return "consent_envelope_required";
  }
  if (
    envelope.operation !== undefined &&
    envelope.operation !== "authorship_key_rotation"
  ) {
    return "consent_envelope_wrong_operation";
  }
  if (
    envelope.authority_delta !== undefined &&
    envelope.authority_delta !== 0
  ) {
    return "consent_envelope_authority_nonzero";
  }
  if (
    envelope.dema_home_hash !== undefined &&
    envelope.dema_home_hash !== sha256(String(demaHome ?? ""))
  ) {
    return "consent_envelope_dema_home_mismatch";
  }
  const nowMs = Date.parse(nowIso);
  if (envelope.expires_at !== undefined) {
    const e = Date.parse(envelope.expires_at);
    if (Number.isFinite(e) && Number.isFinite(nowMs) && e < nowMs) {
      return "consent_envelope_expired";
    }
  }
  if (envelope.issued_at !== undefined) {
    const i = Date.parse(envelope.issued_at);
    // 5-minute allowed forward clock skew.
    if (Number.isFinite(i) && Number.isFinite(nowMs) && i > nowMs + 300000) {
      return "consent_envelope_future";
    }
  }
  return null;
}

// Binds the FULL consent envelope (+ nonce), not just the reusable phrase.
function bindConsent(consent, envelope, oldFp, newFp, stamp, reason, demaHome) {
  if (!envelope || !envelope.nonce) {
    return Object.freeze({
      strength: "phrase_only_INSUFFICIENT",
      consent_phrase_sha256: sha256(consent),
      note: "no nonce-bearing consent envelope supplied; a real ceremony MUST bind one",
    });
  }
  const canonical = JSON.stringify({
    ceremony_id: envelope.ceremony_id ?? null,
    nonce: envelope.nonce,
    old_fingerprint: oldFp,
    new_fingerprint: newFp,
    dema_home_hash: sha256(String(demaHome ?? "")),
    runtime_root: envelope.runtime_root ?? null,
    operator_id_hash: envelope.operator_id_hash ?? null,
    reason,
    issued_at: envelope.issued_at ?? null,
    expiry: envelope.expiry ?? null,
    operation: "authorship_key_rotation",
    authority_delta: 0,
  });
  return Object.freeze({
    strength: "envelope_bound",
    nonce: envelope.nonce,
    envelope_sha256: sha256(canonical),
  });
}

async function writeJournal(journalPath, state, oldFp, newFp, stamp) {
  await writeFileSynced(
    journalPath,
    JSON.stringify({
      schema: KEY_ROTATE_JOURNAL_SCHEMA,
      state,
      old_fingerprint: oldFp,
      new_fingerprint: newFp,
      at: stamp,
    }),
    0o600,
  );
}

// Copies the old key into keys/retired/<fp>/ and byte-verifies BOTH files.
// Commits NO retirement record — that is commitRetirement's job, run only after
// the new key is active and verified.
async function stageQuarantine(paths, fp, privPem, pubPem) {
  const dir = join(paths.dir, "retired", fp);
  try {
    await mkdir(dir, { recursive: true });
    await writeBackupIfAbsent(join(dir, PRIVATE_KEY_FILENAME), privPem, 0o600);
    await writeBackupIfAbsent(join(dir, PUBLIC_KEY_FILENAME), pubPem, 0o644);
    if ((await readExact(join(dir, PRIVATE_KEY_FILENAME))) !== privPem) {
      throw new Error("private quarantine byte-mismatch");
    }
    if ((await readExact(join(dir, PUBLIC_KEY_FILENAME))) !== pubPem) {
      throw new Error("public quarantine byte-mismatch");
    }
    return { dir };
  } catch (error) {
    return { error: true, detail: error?.message ?? String(error) };
  }
}

// Writes the retirement marker + denylist entry. Called ONLY after activation.
async function commitRetirement(quarantineDir, paths, fp, stamp, reason) {
  await writeFileSynced(
    join(quarantineDir, "retired.json"),
    JSON.stringify({
      retired_fingerprint: fp,
      retired_at: stamp,
      reason,
      runtime_loadable: false,
    }),
    0o600,
  );
  await appendRetiredRegistry(
    join(paths.dir, "retired-registry.json"),
    fp,
    stamp,
    reason,
  );
}

// FAIL-CLOSED on corrupt registry: never silently rewrite an empty list (that
// could resurrect previously-retired fingerprints as admissible).
async function appendRetiredRegistry(registryPath, fp, stamp, reason) {
  let entries = [];
  const existing = await readExactIfPresent(registryPath);
  if (existing) {
    let parsed;
    try {
      parsed = JSON.parse(existing);
    } catch {
      throw new Error("retired registry corrupt — refusing to overwrite");
    }
    if (!Array.isArray(parsed.retired)) {
      throw new Error("retired registry malformed — refusing to overwrite");
    }
    entries = parsed.retired;
  }
  if (!entries.some((e) => e.fingerprint === fp)) {
    entries.push({ fingerprint: fp, retired_at: stamp, reason });
  }
  await writeFileSynced(
    registryPath,
    JSON.stringify({ schema: RETIRED_REGISTRY_SCHEMA, retired: entries }, null, 2),
    0o600,
  );
}

async function assertRegistryReadable(registryPath) {
  const existing = await readExactIfPresent(registryPath);
  if (!existing) return;
  let parsed;
  try {
    parsed = JSON.parse(existing);
  } catch {
    throw new Error("retired registry is not valid JSON");
  }
  if (!Array.isArray(parsed.retired)) {
    throw new Error("retired registry missing 'retired' array");
  }
}

async function nonceAlreadyUsed(paths, nonce) {
  const existing = await readExactIfPresent(join(paths.dir, "used-consent-nonces.json"));
  if (!existing) return false;
  const parsed = JSON.parse(existing); // throws on corrupt → caller fails closed
  const used = Array.isArray(parsed.nonces) ? parsed.nonces : [];
  return used.some((n) => n.nonce === nonce);
}

async function recordUsedNonce(paths, nonce, stamp) {
  const registryPath = join(paths.dir, "used-consent-nonces.json");
  let nonces = [];
  const existing = await readExactIfPresent(registryPath);
  if (existing) {
    const parsed = JSON.parse(existing);
    if (Array.isArray(parsed.nonces)) nonces = parsed.nonces;
  }
  if (!nonces.some((n) => n.nonce === nonce)) nonces.push({ nonce, at: stamp });
  await writeFileSynced(
    registryPath,
    JSON.stringify({ schema: "bizra.dema.used_consent_nonces.v0.1", nonces }, null, 2),
    0o600,
  );
}

// True (with reason) if the active key must NOT be served: its fingerprint is
// on the retired denylist, or a rotation journal is mid-flight (ACTIVATING).
async function activeKeyBlocked(paths, activePublicPem) {
  const journal = await readExactIfPresent(join(paths.dir, "rotation-journal.json"));
  if (journal) {
    try {
      const j = JSON.parse(journal);
      if (j.state === "ACTIVATING" || j.state === "PREPARED") {
        return "rotation_in_progress";
      }
    } catch {
      return "rotation_journal_corrupt";
    }
  }
  const registry = await readExactIfPresent(join(paths.dir, "retired-registry.json"));
  if (registry && activePublicPem) {
    let parsed;
    try {
      parsed = JSON.parse(registry);
    } catch {
      return "retired_registry_corrupt";
    }
    const fp = fingerprintPublicKeyPem(activePublicPem);
    if ((parsed.retired ?? []).some((e) => e.fingerprint === fp)) {
      return "active_key_retired";
    }
  }
  return null;
}

async function restoreFromQuarantine(paths, quarantineDir) {
  const qPriv = join(quarantineDir, PRIVATE_KEY_FILENAME);
  const qPub = join(quarantineDir, PUBLIC_KEY_FILENAME);
  const priv = await readExact(qPriv);
  const pub = await readExact(qPub);
  await writeFileSynced(paths.privateKey, priv, 0o600);
  await writeFileSynced(paths.publicKey, pub, 0o644);
}

async function writeRotationReceipt(paths, newFingerprint, receipt) {
  const dir = join(paths.dir, "rotation-receipts");
  await mkdir(dir, { recursive: true });
  const receiptPath = join(dir, `${newFingerprint}.json`);
  await writeFileSynced(receiptPath, JSON.stringify(receipt, null, 2), 0o600);
  return receiptPath;
}

async function writeBackupIfAbsent(path, content, mode) {
  try {
    await writeKeyFile(path, content, { mode, force: false });
  } catch (error) {
    // Already present (same old key) — the original is safe; keep it.
    if (error instanceof KeyAlreadyExistsError) return;
    throw error;
  }
}

// Symlink-safe read: refuses to follow a symlink at the target.
async function readExact(path) {
  const handle = await open(path, constants.O_RDONLY | NO_FOLLOW);
  try {
    return await handle.readFile("utf8");
  } finally {
    await handle.close();
  }
}

async function readExactIfPresent(path) {
  try {
    return await readExact(path);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function writeFileSynced(path, content, mode) {
  const handle = await open(
    path,
    constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | NO_FOLLOW,
    mode,
  );
  try {
    await handle.writeFile(content, "utf8");
    // Durability hardening — best effort. The write itself has already
    // succeeded; a filesystem that rejects fsync (some CI/tmpfs) must not fail
    // the operation, only forgo the crash-durability guarantee.
    try {
      await handle.sync();
    } catch {
      /* fsync unsupported here — data written, durability not guaranteed */
    }
  } catch (error) {
    if (error?.code === "ELOOP") throw new UnsafeKeyPathError(path);
    throw error;
  } finally {
    await handle.close();
  }
}

async function fsyncDir(dir) {
  let handle;
  try {
    handle = await open(dir, constants.O_RDONLY);
    await handle.sync();
  } catch {
    /* directory fsync unsupported on some platforms — best effort */
  } finally {
    await handle?.close();
  }
}

async function removeIfExists(path) {
  try {
    await unlink(path);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

export async function loadPrivateKey(demaHome) {
  const paths = keyPaths(demaHome);
  const priv = await readKeyFile(paths, paths.privateKey);
  if (!priv) return null;
  const pub = await readKeyFile(paths, paths.publicKey);
  if (await activeFingerprintRetired(paths, pub)) return null;
  return priv;
}

export async function loadPublicKey(demaHome) {
  const paths = keyPaths(demaHome);
  const pub = await readKeyFile(paths, paths.publicKey);
  if (!pub) return null;
  if (await activeFingerprintRetired(paths, pub)) return null;
  return pub;
}

// Minimal, NEVER-throwing security gate for the hot path: does the active key's
// fingerprint appear on the retired denylist? Absence of a registry (the normal
// case) is safe — no retirements, not blocked. A corrupt registry fails CLOSED
// (we cannot prove the active key is not retired). The heavier mid-rotation /
// journal checks stay OFF the hot path (in loadGuardedActiveKey) so a leftover
// journal never DoS-blocks the 25 signing consumers.
async function activeFingerprintRetired(paths, activePublicPem) {
  // No active public key to compare → nothing to block on here (callers handle
  // the no-key case separately). Present-but-unreadable/corrupt state fails
  // CLOSED (finding #8): we must never serve a key we cannot prove non-retired.
  if (!activePublicPem) return false;
  let raw;
  try {
    raw = await readExactIfPresent(join(paths.dir, "retired-registry.json"));
  } catch {
    return true; // registry exists but is unreadable → fail closed
  }
  if (!raw) return false; // registry absent → no retirements → safe to serve
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return true; // corrupt denylist → fail closed
  }
  let fp;
  try {
    fp = fingerprintPublicKeyPem(activePublicPem);
  } catch {
    return true; // active key can't be fingerprinted → fail closed, don't serve
  }
  return (parsed.retired ?? []).some((e) => e.fingerprint === fp);
}

// Rotation-aware loader for the IDENTITY path — opt-in, never on the hot path.
// Adds the mid-rotation / journal checks on top of the retired-fp gate.
// Returns { blocked, reason, private_key_pem, public_key_pem }. Never throws.
export async function loadGuardedActiveKey(demaHome) {
  const paths = keyPaths(demaHome);
  const priv = await readKeyFile(paths, paths.privateKey);
  const pub = await readKeyFile(paths, paths.publicKey);
  if (!priv || !pub) return { blocked: true, reason: "no_active_key" };
  let reason = null;
  try {
    reason = await activeKeyBlocked(paths, pub);
  } catch {
    reason = "guard_indeterminate";
  }
  if (reason) return { blocked: true, reason };
  return { blocked: false, private_key_pem: priv, public_key_pem: pub };
}

export async function hasAuthorshipKey(demaHome) {
  const paths = keyPaths(demaHome);
  return isSafeExistingKeyPath(paths, paths.privateKey);
}

function keyAlreadyExistsResult(paths) {
  return Object.freeze({
    schema: KEY_INIT_SCHEMA,
    initialized: false,
    error: "key_already_exists",
    private_key_path: paths.privateKey,
    boundary: buildBoundary(false),
  });
}

function unsafeKeyPathResult(path) {
  return Object.freeze({
    schema: KEY_INIT_SCHEMA,
    initialized: false,
    error: "unsafe_key_path",
    key_path: path,
    boundary: buildBoundary(false),
  });
}

function buildBoundary(wrote) {
  return Object.freeze({
    key_persisted: wrote,
    network_used: false,
    federation_used: false,
    token_minted: false,
    receipt_signed: false,
  });
}
