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

// Replace the compromised authorship key with a fresh one. Safety contract:
//  - exact consent, fail-closed
//  - refuses when no key exists (never silently inits)
//  - QUARANTINES the old key outside the active load path (keys/retired/<fp>/)
//    with BOTH files byte-verified, a marker, and a denylist registry entry
//  - verifies the NEW pair is internally consistent BEFORE touching the active key
//  - atomic-ish activation: temp files + fsync + ordered rename + dir fsync,
//    a rotation-in-progress marker, post-rename read-back verify, and rollback
//    from quarantine on any failure
//  - emits a bound rotation receipt (no private material)
// ponytail: two-file rename has a single-rename crash window (new-priv/old-pub);
// the .rotation-in-progress marker + quarantined old pair make it detectable and
// recoverable on re-run — a journaled single-file format is the upgrade path if
// that window ever matters.
export async function rotateAuthorshipKey({
  consent,
  demaHome,
  retiredAt,
  reason = "compromised_key_rotation",
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
  const stamp =
    typeof retiredAt === "string" && retiredAt
      ? retiredAt
      : new Date().toISOString();

  // 1) Quarantine the old key OUTSIDE the active load path, both files verified.
  const quarantine = await quarantineOldKey(
    paths,
    oldFingerprint,
    oldPrivatePem,
    oldPublicPem,
    stamp,
    reason,
  );
  if (quarantine.error) {
    return rotateFailClosed("quarantine_failed", quarantine.detail);
  }

  // 2) Generate NEW pair; verify self-consistency before touching active key.
  const keys = generateEd25519Keypair();
  if (!keypairMatches(keys.private_key_pem, keys.public_key_pem)) {
    return rotateFailClosed(
      "new_key_pair_invalid",
      "generated keypair failed self-verify",
    );
  }

  // 3) Atomic-ish activation.
  const tmpPriv = join(paths.dir, `.${PRIVATE_KEY_FILENAME}.tmp`);
  const tmpPub = join(paths.dir, `.${PUBLIC_KEY_FILENAME}.tmp`);
  const progressMarker = join(paths.dir, ".rotation-in-progress");
  try {
    await removeIfExists(tmpPriv);
    await removeIfExists(tmpPub);
    await writeFileSynced(
      progressMarker,
      JSON.stringify({
        old_fingerprint: oldFingerprint,
        new_fingerprint: keys.public_key_fingerprint,
        at: stamp,
      }),
      0o600,
    );
    await writeFileSynced(tmpPriv, keys.private_key_pem, 0o600);
    await writeFileSynced(tmpPub, keys.public_key_pem, 0o644);
    await rename(tmpPriv, paths.privateKey);
    await rename(tmpPub, paths.publicKey);
    await fsyncDir(paths.dir);
  } catch (error) {
    await restoreFromQuarantine(paths, quarantine.dir).catch(() => {});
    await removeIfExists(tmpPriv);
    await removeIfExists(tmpPub);
    return rotateFailClosed("replacement_failed", error?.message ?? String(error));
  }

  // 4) Post-rename read-back: active pair must BE the new pair.
  const activePriv = await readKeyFile(paths, paths.privateKey);
  const activePub = await readKeyFile(paths, paths.publicKey);
  if (
    !activePriv ||
    !activePub ||
    fingerprintPublicKeyPem(activePub) !== keys.public_key_fingerprint ||
    !keypairMatches(activePriv, activePub)
  ) {
    await restoreFromQuarantine(paths, quarantine.dir).catch(() => {});
    return rotateFailClosed(
      "post_activation_verify_failed",
      "active key does not match the new pair after rename",
    );
  }
  await removeIfExists(progressMarker);

  // 5) Bound rotation receipt (no private material).
  const receipt = {
    schema: KEY_ROTATE_RECEIPT_SCHEMA,
    old_fingerprint: oldFingerprint,
    new_fingerprint: keys.public_key_fingerprint,
    retired_at: stamp,
    reason,
    quarantine_dir: quarantine.dir,
    retired_registry_path: quarantine.registryPath,
    runtime_activation: "not_verified_no_runtime",
    revocation_state: "retired_local_denylisted",
    affected_receipt_assessment:
      "see R0B2_EXPOSURE_INTERVAL_ASSESSMENT (local signed-receipt exposure empty)",
    consent_sha256: sha256(consent),
    private_key_material_included: false,
  };
  const receiptPath = await writeRotationReceipt(
    paths,
    keys.public_key_fingerprint,
    receipt,
  );

  return Object.freeze({
    schema: KEY_ROTATE_SCHEMA,
    rotated: true,
    ...receipt,
    receipt_path: receiptPath,
    private_key_path: paths.privateKey,
    public_key_path: paths.publicKey,
    boundary: buildBoundary(true),
  });
}

async function quarantineOldKey(paths, fp, privPem, pubPem, stamp, reason) {
  const dir = join(paths.dir, "retired", fp);
  const qPriv = join(dir, PRIVATE_KEY_FILENAME);
  const qPub = join(dir, PUBLIC_KEY_FILENAME);
  const marker = join(dir, "retired.json");
  const registryPath = join(paths.dir, "retired-registry.json");
  try {
    await mkdir(dir, { recursive: true });
    await writeBackupIfAbsent(qPriv, privPem, 0o600);
    await writeBackupIfAbsent(qPub, pubPem, 0o644);
    // Verify BOTH files hold the original bytes (symlink-safe read).
    if ((await readExact(qPriv)) !== privPem) {
      throw new Error("private quarantine byte-mismatch");
    }
    if ((await readExact(qPub)) !== pubPem) {
      throw new Error("public quarantine byte-mismatch");
    }
    await writeFileSynced(
      marker,
      JSON.stringify({
        retired_fingerprint: fp,
        retired_at: stamp,
        reason,
        runtime_loadable: false,
      }),
      0o600,
    );
    await appendRetiredRegistry(registryPath, fp, stamp, reason);
    return { dir, registryPath };
  } catch (error) {
    return { error: true, detail: error?.message ?? String(error) };
  }
}

async function appendRetiredRegistry(registryPath, fp, stamp, reason) {
  let entries = [];
  const existing = await readExactIfPresent(registryPath);
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      if (Array.isArray(parsed.retired)) entries = parsed.retired;
    } catch {
      /* corrupt registry → rewrite fresh below */
    }
  }
  if (!entries.some((e) => e.fingerprint === fp)) {
    entries.push({ fingerprint: fp, retired_at: stamp, reason });
  }
  await writeFileSynced(
    registryPath,
    JSON.stringify(
      { schema: "bizra.dema.retired_key_registry.v0.1", retired: entries },
      null,
      2,
    ),
    0o600,
  );
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
    await handle.sync();
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
  return readKeyFile(paths, paths.privateKey);
}

export async function loadPublicKey(demaHome) {
  const paths = keyPaths(demaHome);
  return readKeyFile(paths, paths.publicKey);
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
