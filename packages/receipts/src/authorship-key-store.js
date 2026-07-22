import { constants } from "node:fs";
import { mkdir, lstat, realpath, open, rename } from "node:fs/promises";
import { join, dirname, basename, relative, isAbsolute, sep } from "node:path";
import { homedir } from "node:os";
import { createPublicKey, createPrivateKey } from "node:crypto";
import { generateEd25519Keypair, sha256 } from "./authorship-signature.js";

export const KEY_INIT_CONSENT_PHRASE = "GENERATE AUTHORSHIP KEY";
export const KEY_INIT_SCHEMA = "bizra.dema.authorship_key_init.v0.1";
export const KEY_MIGRATE_CONSENT_PHRASE = "MIGRATE AUTHORSHIP KEY";
export const KEY_MIGRATE_SCHEMA = "bizra.dema.authorship_key_migrate.v0.1";
export const ACTIVE_POINTER_SCHEMA = "bizra.dema.authorship_active_key.v0.1";
export const GENERATION_METADATA_SCHEMA =
  "bizra.dema.authorship_key_generation.v0.1";

const PRIVATE_KEY_FILENAME = "node0-ed25519.pem";
const PUBLIC_KEY_FILENAME = "node0-ed25519.pub.pem";
const ACTIVE_POINTER_FILENAME = "active-key.json";
const GENERATIONS_DIRNAME = "generations";
const RETIRED_REGISTRY_FILENAME = "retired-registry.json";
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

export function activeKeyPaths(demaHome) {
  const dir = keysDir(demaHome);
  return {
    dir,
    activePointer: join(dir, ACTIVE_POINTER_FILENAME),
    generationsDir: join(dir, GENERATIONS_DIRNAME),
    retiredRegistry: join(dir, RETIRED_REGISTRY_FILENAME),
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

// ---------------------------------------------------------------------------
// Generation store (IDENTITY-PAIR-COHERENCE-1A)
//
// keys/active-key.json is the sole canonical selector. Generation directories
// under keys/generations/<fingerprint>/ are immutable after creation. A
// signing consumer obtains its identity through loadActiveKeyPair() — one
// call, one snapshot, one generation. Activation is a single atomic rename of
// the pointer; private/public sequential activation is structurally
// impossible because the pair lives inside one immutable directory.
// ---------------------------------------------------------------------------

async function readFileNoFollow(path) {
  const info = await lstatIfExists(path);
  if (!info || info.isSymbolicLink() || !info.isFile()) return null;
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | NO_FOLLOW);
    return await handle.readFile("utf8");
  } catch {
    return null;
  } finally {
    await handle?.close();
  }
}

function derivePublicFromPrivate(privateKeyPem) {
  const pub = createPublicKey(createPrivateKey(privateKeyPem));
  const der = pub.export({ type: "spki", format: "der" });
  return {
    pem: pub.export({ type: "spki", format: "pem" }),
    der,
    fingerprint: sha256(der.toString("hex")),
  };
}

// { ok, fingerprint } — the pair is one identity iff the public key derived
// from the private key is byte-identical (DER) to the stored public key.
function pairConsistency(privateKeyPem, publicKeyPem) {
  try {
    const derived = derivePublicFromPrivate(privateKeyPem);
    const storedDer = createPublicKey(publicKeyPem).export({
      type: "spki",
      format: "der",
    });
    if (!derived.der.equals(storedDer)) return { ok: false };
    return { ok: true, fingerprint: derived.fingerprint };
  } catch {
    return { ok: false };
  }
}

async function writeActivePointer(ap, pointerDoc) {
  const staged = `${ap.activePointer}.next`;
  const bytes = `${JSON.stringify(pointerDoc, null, 2)}\n`;
  let handle;
  try {
    handle = await open(
      staged,
      constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | NO_FOLLOW,
      0o644,
    );
    await handle.writeFile(bytes, "utf8");
    await handle.sync();
  } finally {
    await handle?.close();
    handle = undefined;
  }
  // Verify the staged bytes parse before they can become authority.
  JSON.parse(await readFileNoFollow(staged));
  await rename(staged, ap.activePointer);
  try {
    const dirHandle = await open(ap.dir, constants.O_RDONLY);
    await dirHandle.sync().catch(() => {});
    await dirHandle.close();
  } catch {
    // Directory fsync is best-effort on platforms that refuse it.
  }
  return bytes;
}

async function writeGeneration(ap, keys, { now, source }) {
  const generationPath = join(ap.generationsDir, keys.public_key_fingerprint);
  await mkdir(generationPath, { recursive: true });
  const metadata = {
    schema: GENERATION_METADATA_SCHEMA,
    fingerprint: keys.public_key_fingerprint,
    generation_id: keys.public_key_fingerprint,
    private_content_hash: sha256(keys.private_key_pem),
    public_content_hash: sha256(keys.public_key_pem),
    created_at: now,
    source,
  };
  await writeKeyFile(join(generationPath, "private.pem"), keys.private_key_pem, {
    mode: 0o600,
    force: false,
  });
  await writeKeyFile(join(generationPath, "public.pem"), keys.public_key_pem, {
    mode: 0o644,
    force: false,
  });
  await writeKeyFile(
    join(generationPath, "metadata.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
    { mode: 0o644, force: false },
  );
  return { generationPath, metadata };
}

async function activateGeneration(ap, { fingerprint, now, previous }) {
  const pointerDoc = {
    schema: ACTIVE_POINTER_SCHEMA,
    generation_fingerprint: fingerprint,
    generation_path: join(GENERATIONS_DIRNAME, fingerprint),
    activated_at: now,
    previous_generation: previous ?? null,
    transition_id: sha256(`${previous ?? "genesis"}->${fingerprint}@${now}`),
  };
  const bytes = await writeActivePointer(ap, pointerDoc);
  return { pointerDoc, pointerHash: sha256(bytes) };
}

async function readActivePointer(ap) {
  const raw = await readFileNoFollow(ap.activePointer);
  if (raw === null) {
    const info = await lstatIfExists(ap.activePointer);
    return { error: info ? "malformed_pointer" : "no_active_pointer" };
  }
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch {
    return { error: "malformed_pointer" };
  }
  if (
    !doc ||
    doc.schema !== ACTIVE_POINTER_SCHEMA ||
    typeof doc.generation_fingerprint !== "string" ||
    !/^[0-9a-f]{64}$/.test(doc.generation_fingerprint) ||
    typeof doc.generation_path !== "string"
  ) {
    return { error: "malformed_pointer" };
  }
  return { doc, raw };
}

async function checkRetired(ap, fingerprint) {
  const info = await lstatIfExists(ap.retiredRegistry);
  if (!info) return null; // absent registry: safe to serve
  const raw = await readFileNoFollow(ap.retiredRegistry);
  if (raw === null) return "retired_registry_unreadable";
  let registry;
  try {
    registry = JSON.parse(raw);
  } catch {
    return "retired_registry_unreadable";
  }
  const retired = Array.isArray(registry?.retired) ? registry.retired : null;
  if (!retired) return "retired_registry_unreadable";
  for (const entry of retired) {
    if (entry?.fingerprint === fingerprint) return "retired_generation";
  }
  return null;
}

function pairFailure(error) {
  return Object.freeze({ ok: false, error });
}

export async function loadActiveKeyPair(demaHome) {
  try {
    const ap = activeKeyPaths(demaHome);

    const pointer = await readActivePointer(ap);
    if (pointer.error) return pairFailure(pointer.error);
    const { doc, raw } = pointer;

    // Containment: the pointer may only select inside keys/generations/.
    const generationPath = isAbsolute(doc.generation_path)
      ? doc.generation_path
      : join(ap.dir, doc.generation_path);
    const genInfo = await lstatIfExists(generationPath);
    if (!genInfo || genInfo.isSymbolicLink() || !genInfo.isDirectory()) {
      return pairFailure(genInfo ? "generation_unsafe" : "generation_missing");
    }
    let generationReal;
    try {
      const generationsReal = await realpath(ap.generationsDir);
      generationReal = await realpath(generationPath);
      if (
        !isInsideOrSame(generationReal, generationsReal) ||
        generationReal === generationsReal
      ) {
        return pairFailure("pointer_escape");
      }
    } catch {
      return pairFailure("pointer_escape");
    }

    const privateKeyPem = await readFileNoFollow(join(generationReal, "private.pem"));
    const publicKeyPem = await readFileNoFollow(join(generationReal, "public.pem"));
    const metadataRaw = await readFileNoFollow(join(generationReal, "metadata.json"));
    if (privateKeyPem === null || publicKeyPem === null) {
      return pairFailure("generation_unsafe");
    }
    if (metadataRaw === null) return pairFailure("metadata_corrupt");

    let metadata;
    try {
      metadata = JSON.parse(metadataRaw);
    } catch {
      return pairFailure("metadata_corrupt");
    }
    if (
      !metadata ||
      metadata.schema !== GENERATION_METADATA_SCHEMA ||
      metadata.fingerprint !== doc.generation_fingerprint ||
      basename(generationReal) !== doc.generation_fingerprint
    ) {
      return pairFailure("metadata_corrupt");
    }

    if (
      sha256(privateKeyPem) !== metadata.private_content_hash ||
      sha256(publicKeyPem) !== metadata.public_content_hash
    ) {
      return pairFailure("content_hash_mismatch");
    }

    const pair = pairConsistency(privateKeyPem, publicKeyPem);
    if (!pair.ok || pair.fingerprint !== doc.generation_fingerprint) {
      return pairFailure("pair_mismatch");
    }

    const retired = await checkRetired(ap, pair.fingerprint);
    if (retired) return pairFailure(retired);

    return Object.freeze({
      ok: true,
      fingerprint: pair.fingerprint,
      generation_path: generationReal,
      private_key_pem: privateKeyPem,
      public_key_pem: publicKeyPem,
      metadata_hash: sha256(metadataRaw),
      active_pointer_hash: sha256(raw),
    });
  } catch {
    return pairFailure("load_failed");
  }
}

export async function migrateLegacyAuthorshipKey({
  consent,
  demaHome,
  now = new Date().toISOString(),
} = {}) {
  if (consent !== KEY_MIGRATE_CONSENT_PHRASE) {
    return Object.freeze({
      schema: KEY_MIGRATE_SCHEMA,
      migrated: false,
      error: "consent_required",
      required_phrase: KEY_MIGRATE_CONSENT_PHRASE,
      boundary: buildBoundary(false),
    });
  }

  const ap = activeKeyPaths(demaHome);
  const pointerInfo = await lstatIfExists(ap.activePointer);
  if (pointerInfo) {
    return Object.freeze({
      schema: KEY_MIGRATE_SCHEMA,
      migrated: false,
      error: "already_migrated",
      boundary: buildBoundary(false),
    });
  }

  const paths = keyPaths(demaHome);
  const privateKeyPem = await readKeyFile(paths, paths.privateKey);
  const publicKeyPem = await readKeyFile(paths, paths.publicKey);
  if (!privateKeyPem || !publicKeyPem) {
    return Object.freeze({
      schema: KEY_MIGRATE_SCHEMA,
      migrated: false,
      error: "no_legacy_key",
      boundary: buildBoundary(false),
    });
  }

  const pair = pairConsistency(privateKeyPem, publicKeyPem);
  if (!pair.ok) {
    return Object.freeze({
      schema: KEY_MIGRATE_SCHEMA,
      migrated: false,
      error: "pair_mismatch",
      boundary: buildBoundary(false),
    });
  }

  try {
    await mkdir(ap.generationsDir, { recursive: true });
    const { generationPath } = await writeGeneration(
      ap,
      {
        public_key_fingerprint: pair.fingerprint,
        private_key_pem: privateKeyPem,
        public_key_pem: publicKeyPem,
      },
      { now, source: "legacy_migration" },
    );
    await activateGeneration(ap, {
      fingerprint: pair.fingerprint,
      now,
      previous: null,
    });
    // Migration policy: legacy files are preserved in place, untouched. The
    // pointer, not file presence, is authority from this moment on.
    return Object.freeze({
      schema: KEY_MIGRATE_SCHEMA,
      migrated: true,
      fingerprint: pair.fingerprint,
      generation_path: generationPath,
      legacy_policy: "preserved_in_place",
      boundary: buildBoundary(true),
    });
  } catch (error) {
    if (error instanceof UnsafeKeyPathError || error instanceof KeyAlreadyExistsError) {
      return Object.freeze({
        schema: KEY_MIGRATE_SCHEMA,
        migrated: false,
        error: "unsafe_or_existing_generation",
        boundary: buildBoundary(false),
      });
    }
    throw error;
  }
}

export async function initAuthorshipKey({
  consent,
  demaHome,
  force = false,
  now = new Date().toISOString(),
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
  const ap = activeKeyPaths(demaHome);
  const unsafePath = await prepareKeyDirectory(paths);
  if (unsafePath) return unsafeKeyPathResult(unsafePath);

  const pointer = await readActivePointer(ap);
  const hasPointer = !pointer.error;
  if (!force && (hasPointer || (await existingKeyPath(paths)))) {
    return keyAlreadyExistsResult(paths);
  }

  const keys = generateEd25519Keypair();

  try {
    await mkdir(ap.generationsDir, { recursive: true });
    const { generationPath } = await writeGeneration(ap, keys, {
      now,
      source: "init",
    });
    await activateGeneration(ap, {
      fingerprint: keys.public_key_fingerprint,
      now,
      previous: hasPointer ? pointer.doc.generation_fingerprint : null,
    });

    return Object.freeze({
      schema: KEY_INIT_SCHEMA,
      initialized: true,
      public_key_fingerprint: keys.public_key_fingerprint,
      generation_path: generationPath,
      active_pointer_path: ap.activePointer,
      private_key_path: join(generationPath, "private.pem"),
      public_key_path: join(generationPath, "public.pem"),
      boundary: buildBoundary(true),
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
}

// Legacy single-key loaders. Pointer-aware: when a generation store exists it
// is the only authority; the legacy flat files are consulted ONLY when no
// active pointer exists at all (pre-migration homes and hand-built fixtures).
// A present-but-unloadable pointer fails closed — it never falls through to
// stale legacy material. Signing consumers must use loadActiveKeyPair();
// the identity-pair-coherence gate rejects paired use of these two.
export async function loadPrivateKey(demaHome) {
  const pair = await loadActiveKeyPair(demaHome);
  if (pair.ok) return pair.private_key_pem;
  if (pair.error !== "no_active_pointer") return null;
  const paths = keyPaths(demaHome);
  return readKeyFile(paths, paths.privateKey);
}

export async function loadPublicKey(demaHome) {
  const pair = await loadActiveKeyPair(demaHome);
  if (pair.ok) return pair.public_key_pem;
  if (pair.error !== "no_active_pointer") return null;
  const paths = keyPaths(demaHome);
  return readKeyFile(paths, paths.publicKey);
}

// Presence, not servability: a corrupt or retired generation still counts as
// "a key exists" (callers then surface the precise load error), matching the
// legacy semantics where a present-but-corrupt PEM answered true.
export async function hasAuthorshipKey(demaHome) {
  const ap = activeKeyPaths(demaHome);
  const pointerInfo = await lstatIfExists(ap.activePointer);
  if (pointerInfo && !pointerInfo.isSymbolicLink() && pointerInfo.isFile()) {
    return true;
  }
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
