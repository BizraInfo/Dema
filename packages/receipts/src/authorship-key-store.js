import { constants } from "node:fs";
import { mkdir, lstat, realpath, open } from "node:fs/promises";
import { join, dirname, relative, isAbsolute, sep } from "node:path";
import { homedir } from "node:os";
import {
  generateEd25519Keypair,
  fingerprintPublicKeyPem,
} from "./authorship-signature.js";

export const KEY_INIT_CONSENT_PHRASE = "GENERATE AUTHORSHIP KEY";
export const KEY_INIT_SCHEMA = "bizra.dema.authorship_key_init.v0.1";
export const KEY_ROTATE_CONSENT_PHRASE = "ROTATE AUTHORSHIP KEY";
export const KEY_ROTATE_SCHEMA = "bizra.dema.authorship_key_rotate.v0.1";

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

export async function rotateAuthorshipKey({ consent, demaHome } = {}) {
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

  // Rotation replaces an EXISTING key. Refuse (not silently init) if none.
  const oldPrivatePem = await readKeyFile(paths, paths.privateKey);
  const oldPublicPem = await readKeyFile(paths, paths.publicKey);
  if (!oldPrivatePem || !oldPublicPem) {
    return Object.freeze({
      schema: KEY_ROTATE_SCHEMA,
      rotated: false,
      error: "no_key_to_rotate",
      boundary: buildBoundary(false),
    });
  }

  const oldFingerprint = fingerprintPublicKeyPem(oldPublicPem);

  // Back up the ORIGINAL key BEFORE any overwrite. If the backup cannot be
  // secured, fail closed — never destroy the only copy of the old key.
  const backupDir = join(paths.dir, "rotated", oldFingerprint);
  const backupPrivate = join(backupDir, PRIVATE_KEY_FILENAME);
  const backupPublic = join(backupDir, PUBLIC_KEY_FILENAME);
  try {
    await mkdir(backupDir, { recursive: true });
    await writeBackupIfAbsent(backupPrivate, oldPrivatePem, 0o600);
    await writeBackupIfAbsent(backupPublic, oldPublicPem, 0o644);
    // Verify the backup holds the original bytes before we overwrite.
    const check = await open(backupPrivate, constants.O_RDONLY | NO_FOLLOW);
    try {
      if ((await check.readFile("utf8")) !== oldPrivatePem) {
        throw new Error("backup verification mismatch");
      }
    } finally {
      await check.close();
    }
  } catch (error) {
    return Object.freeze({
      schema: KEY_ROTATE_SCHEMA,
      rotated: false,
      error: "backup_failed",
      detail: error?.message ?? String(error),
      boundary: buildBoundary(false),
    });
  }

  // Backup secured — now generate and force-write the new key.
  const keys = generateEd25519Keypair();
  await writeKeyFile(paths.privateKey, keys.private_key_pem, {
    mode: 0o600,
    force: true,
  });
  await writeKeyFile(paths.publicKey, keys.public_key_pem, {
    mode: 0o644,
    force: true,
  });

  return Object.freeze({
    schema: KEY_ROTATE_SCHEMA,
    rotated: true,
    old_fingerprint: oldFingerprint,
    new_fingerprint: keys.public_key_fingerprint,
    backup_dir: backupDir,
    private_key_path: paths.privateKey,
    public_key_path: paths.publicKey,
    boundary: buildBoundary(true),
  });
}

async function writeBackupIfAbsent(path, content, mode) {
  try {
    await writeKeyFile(path, content, { mode, force: false });
  } catch (error) {
    // Already backed up (same old key) — the original is safe; keep it.
    if (error instanceof KeyAlreadyExistsError) return;
    throw error;
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
