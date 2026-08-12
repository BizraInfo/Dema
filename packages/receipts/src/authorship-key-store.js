import { constants } from "node:fs";
import {
  mkdir,
  lstat,
  realpath,
  open,
  rename,
  unlink,
  readdir,
} from "node:fs/promises";
import { join, dirname, basename, relative, isAbsolute, sep } from "node:path";
import { homedir } from "node:os";
import { createPublicKey, createPrivateKey } from "node:crypto";
import {
  generateEd25519Keypair,
  fingerprintPublicKeyPem,
  keypairMatches,
  sha256,
} from "./authorship-signature.js";
// stableStringify only — consent-common imports nothing from receipts, so no cycle.
import { stableStringify } from "../../consent/src/consent-common.js";

export const KEY_INIT_CONSENT_PHRASE = "GENERATE AUTHORSHIP KEY";
export const KEY_INIT_SCHEMA = "bizra.dema.authorship_key_init.v0.1";
export const KEY_MIGRATE_CONSENT_PHRASE = "MIGRATE AUTHORSHIP KEY";
export const KEY_MIGRATE_SCHEMA = "bizra.dema.authorship_key_migrate.v0.1";
export const KEY_ROTATE_CONSENT_PHRASE = "ROTATE AUTHORSHIP KEY";
export const KEY_ROTATE_SCHEMA = "bizra.dema.authorship_key_rotate.v0.1";
export const KEY_ROTATE_RECEIPT_SCHEMA =
  "bizra.dema.authorship_key_rotate_receipt.v0.1";
export const KEY_ROTATE_JOURNAL_SCHEMA =
  "bizra.dema.authorship_rotation_journal.v0.1";
export const KEY_ROTATE_RESUME_CONSENT_PHRASE = "RESUME AUTHORSHIP ROTATION";
export const KEY_ROTATE_RESUME_SCHEMA =
  "bizra.dema.authorship_rotation_resume.v0.1";
export const RETIRED_REGISTRY_SCHEMA = "bizra.dema.retired_key_registry.v0.1";
export const ACTIVE_POINTER_SCHEMA = "bizra.dema.authorship_active_key.v0.1";
export const GENERATION_METADATA_SCHEMA =
  "bizra.dema.authorship_key_generation.v0.1";
export const AUTHORSHIP_TRUST_SNAPSHOT_SCHEMA =
  "bizra.dema.authorship_trust_snapshot.v0.1";

const PRIVATE_KEY_FILENAME = "node0-ed25519.pem";
const PUBLIC_KEY_FILENAME = "node0-ed25519.pub.pem";
const ACTIVE_POINTER_FILENAME = "active-key.json";
const GENERATIONS_DIRNAME = "generations";
const RETIRED_REGISTRY_FILENAME = "retired-registry.json";
const TRANSACTIONS_DIRNAME = "transactions";
const IDENTITY_LEASE_FILENAME = "identity-transition.lock";
const REQUIRED_KEY_ALGORITHM = "ed25519";
const SHA256_HEX = /^[0-9a-f]{64}$/;
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

function resolveHome(demaHome) {
  return typeof demaHome === "string" && demaHome.length > 0
    ? demaHome
    : process.env.DEMA_HOME || join(homedir(), ".dema");
}

function keysDir(demaHome) {
  return join(resolveHome(demaHome), "keys");
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
    transactionsDir: join(dir, TRANSACTIONS_DIRNAME),
    identityLease: join(dir, TRANSACTIONS_DIRNAME, IDENTITY_LEASE_FILENAME),
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
  const priv = createPrivateKey(privateKeyPem);
  const pub = createPublicKey(priv);
  const der = pub.export({ type: "spki", format: "der" });
  return {
    pem: pub.export({ type: "spki", format: "pem" }),
    der,
    fingerprint: sha256(der.toString("hex")),
    algorithm: priv.asymmetricKeyType,
  };
}

export function isSpkiPublicKeyPem(value) {
  return (
    typeof value === "string" &&
    /^-----BEGIN PUBLIC KEY-----\r?\n/.test(value) &&
    /\r?\n-----END PUBLIC KEY-----\r?\n?$/.test(value) &&
    !value.includes("PRIVATE KEY")
  );
}

// Finding #2 (review P1): pair consistency alone is not identity — an RSA or
// P-256 pair is internally consistent yet unusable on the Ed25519 signing
// path. Require BOTH keys to be Ed25519 before any authority write. Returns
// { ok, fingerprint } | { ok:false, error:"unsupported_key_algorithm" } |
// { ok:false } (mismatched pair).
function pairConsistency(privateKeyPem, publicKeyPem) {
  try {
    if (!isSpkiPublicKeyPem(publicKeyPem)) {
      return { ok: false, error: "public_key_invalid" };
    }
    const derived = derivePublicFromPrivate(privateKeyPem);
    const storedPub = createPublicKey(publicKeyPem);
    if (
      derived.algorithm !== REQUIRED_KEY_ALGORITHM ||
      storedPub.asymmetricKeyType !== REQUIRED_KEY_ALGORITHM
    ) {
      return { ok: false, error: "unsupported_key_algorithm" };
    }
    const storedDer = storedPub.export({ type: "spki", format: "der" });
    if (!derived.der.equals(storedDer)) return { ok: false };
    return { ok: true, fingerprint: derived.fingerprint };
  } catch {
    return { ok: false };
  }
}

// ── Transition lease (Finding #1, review P1) ───────────────────────────────
// Atomic visibility (one rename) is NOT transactional exclusivity: two
// initializers sharing one staged pointer path can interleave and return a
// success whose fingerprint is not the one actually activated. An exclusive
// O_EXCL lease admits exactly ONE transition owner; a concurrent caller does
// zero mutation. A lease whose holder PID is dead is stale → RECOVERY_REQUIRED
// (never auto-deleted by wall-clock — staleness is proven by process liveness,
// not elapsed time).
function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM = exists but not ours (alive); ESRCH = no such process (dead).
    return e?.code === "EPERM";
  }
}

// { acquired:true, release } | { acquired:false, reason } — reason is
// "identity_transition_in_progress" (live holder) or "recovery_required"
// (dead holder; lease preserved for operator adjudication).
async function acquireIdentityLease(ap, { pid = process.pid } = {}) {
  await mkdir(ap.transactionsDir, { recursive: true });
  let handle;
  try {
    handle = await open(
      ap.identityLease,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | NO_FOLLOW,
      0o600,
    );
    await handle.writeFile(JSON.stringify({ pid, acquired_at_epoch_ns: null }), "utf8");
    await handle.sync().catch(() => {});
    await handle.close();
    return {
      acquired: true,
      async release() {
        await unlink(ap.identityLease).catch(() => {});
      },
    };
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    // Someone holds it. Alive → in-progress; dead → recovery_required.
    const raw = await readFileNoFollow(ap.identityLease);
    let holderPid = null;
    try {
      holderPid = JSON.parse(raw ?? "{}").pid ?? null;
    } catch {
      holderPid = null;
    }
    const alive = pidAlive(holderPid);
    return {
      acquired: false,
      reason: alive ? "identity_transition_in_progress" : "recovery_required",
    };
  }
}

async function writeActivePointer(ap, pointerDoc, transitionId) {
  // Finding #1: unique per-transition staged path — never a shared
  // active-key.json.next that two transitions could clobber.
  const suffix = transitionId ? `.${transitionId}` : "";
  const staged = `${ap.activePointer}${suffix}.next`;
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

// Write-if-absent so a resumed transition (Finding #3) fills only the missing
// files and never overwrites an existing valid byte. classifyGeneration has
// already proven any present file matches the expected pair, so a lingering
// EEXIST here means a concurrent writer we should not fight — surface it.
async function writeIfAbsent(path, content, mode) {
  const info = await lstatIfExists(path);
  if (info && !info.isSymbolicLink() && info.isFile()) return;
  await writeKeyFile(path, content, { mode, force: false });
}

async function writeGeneration(ap, keys, { now, source }) {
  const generationPath = join(ap.generationsDir, keys.public_key_fingerprint);
  await mkdir(generationPath, { recursive: true });
  const metadata = {
    schema: GENERATION_METADATA_SCHEMA,
    fingerprint: keys.public_key_fingerprint,
    generation_id: keys.public_key_fingerprint,
    algorithm: REQUIRED_KEY_ALGORITHM,
    private_content_hash: sha256(keys.private_key_pem),
    public_content_hash: sha256(keys.public_key_pem),
    created_at: now,
    source,
  };
  await writeIfAbsent(join(generationPath, "private.pem"), keys.private_key_pem, 0o600);
  await writeIfAbsent(join(generationPath, "public.pem"), keys.public_key_pem, 0o644);
  await writeIfAbsent(
    join(generationPath, "metadata.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
    0o644,
  );
  return { generationPath, metadata };
}

async function activateGeneration(ap, { fingerprint, now, previous }) {
  const transitionId = sha256(`${previous ?? "genesis"}->${fingerprint}@${now}`);
  const pointerDoc = {
    schema: ACTIVE_POINTER_SCHEMA,
    generation_fingerprint: fingerprint,
    generation_path: join(GENERATIONS_DIRNAME, fingerprint),
    activated_at: now,
    previous_generation: previous ?? null,
    transition_id: transitionId,
  };
  const bytes = await writeActivePointer(ap, pointerDoc, transitionId);
  return { pointerDoc, pointerHash: sha256(bytes) };
}

// Read a generation file only if it is a REGULAR non-symlink file. Returns
// { kind: "absent" | "irregular" | "content", content }. A directory / FIFO /
// socket / symlink at a generation-file path is "irregular" (never content).
async function readRegularGenFile(path) {
  const info = await lstatIfExists(path);
  if (!info) return { kind: "absent" };
  if (info.isSymbolicLink() || !info.isFile()) return { kind: "irregular" };
  const content = await readFileNoFollow(path);
  return content === null ? { kind: "irregular" } : { kind: "content", content };
}

// Full semantic verification of a generation dir against an expected pair —
// the SAME contract loadActiveKeyPair enforces (Finding A, 1C). Presence of
// three files is NOT completeness; only parse+schema+fingerprint+algorithm+
// hashes+pair convergence is. Returns { ok:true } | { ok:false, error }.
function verifyGenerationContent({ priv, pub, metaRaw, fingerprint }) {
  if (priv === null || pub === null) return { ok: false, error: "generation_unsafe" };
  if (metaRaw === null) return { ok: false, error: "metadata_corrupt" };
  let metadata;
  try {
    metadata = JSON.parse(metaRaw);
  } catch {
    return { ok: false, error: "metadata_corrupt" };
  }
  if (
    !metadata ||
    metadata.schema !== GENERATION_METADATA_SCHEMA ||
    metadata.fingerprint !== fingerprint ||
    metadata.algorithm !== REQUIRED_KEY_ALGORITHM
  ) {
    return { ok: false, error: "metadata_corrupt" };
  }
  if (
    sha256(priv) !== metadata.private_content_hash ||
    sha256(pub) !== metadata.public_content_hash
  ) {
    return { ok: false, error: "content_hash_mismatch" };
  }
  const pair = pairConsistency(priv, pub);
  if (pair.error === "unsupported_key_algorithm") {
    return { ok: false, error: "unsupported_key_algorithm" };
  }
  if (!pair.ok || pair.fingerprint !== fingerprint) {
    return { ok: false, error: "pair_mismatch" };
  }
  return { ok: true };
}

// Finding #3 (review P1) + Finding A (1C): a generation dir may already exist
// from an interrupted transition. Classify it SEMANTICALLY so a retry resumes
// only when the content is actually valid — never on mere file presence.
// States: "absent" | "complete_verified" | "incomplete_repairable" |
// "conflict" | "recovery_required". metadataMalformed flags a present-but-bad
// metadata that repair may regenerate from the still-verified legacy pair.
async function classifyGeneration(ap, fingerprint, expected) {
  const generationPath = join(ap.generationsDir, fingerprint);
  const info = await lstatIfExists(generationPath);
  if (!info) return { state: "absent", generationPath };
  if (info.isSymbolicLink() || !info.isDirectory()) {
    return { state: "conflict", generationPath };
  }

  const privR = await readRegularGenFile(join(generationPath, "private.pem"));
  const pubR = await readRegularGenFile(join(generationPath, "public.pem"));
  const metaR = await readRegularGenFile(join(generationPath, "metadata.json"));

  // Any irregular (non-regular-file) entry at a key/metadata path is a hazard,
  // never silently repaired.
  if ([privR, pubR, metaR].some((r) => r.kind === "irregular")) {
    return { state: "recovery_required", generationPath };
  }

  const priv = privR.kind === "content" ? privR.content : null;
  const pub = pubR.kind === "content" ? pubR.content : null;
  const metaRaw = metaR.kind === "content" ? metaR.content : null;

  // A present key byte that differs from the expected legacy pair is a genuine
  // conflict — never overwrite differing key material.
  if (priv !== null && priv !== expected.private_key_pem) {
    return { state: "conflict", generationPath };
  }
  if (pub !== null && pub !== expected.public_key_pem) {
    return { state: "conflict", generationPath };
  }

  // Full verification passes → truly complete.
  const verified = verifyGenerationContent({ priv, pub, metaRaw, fingerprint });
  if (verified.ok) return { state: "complete_verified", generationPath };

  // Not verified, but present key files match the expected pair. Repairable
  // ONLY when the failure is a regenerable metadata problem (missing or
  // malformed) — key material is absent or the exact expected legacy bytes.
  const metadataMalformed = metaRaw !== null && verified.error === "metadata_corrupt";
  const metadataRegenerable =
    verified.error === "metadata_corrupt" || verified.error === "generation_unsafe";
  if (metadataRegenerable) {
    return { state: "incomplete_repairable", generationPath, metadataMalformed };
  }
  // content_hash_mismatch / pair_mismatch on present, expected-matching keys
  // means the on-disk state is internally inconsistent beyond safe repair.
  return { state: "recovery_required", generationPath };
}

// Preserve malformed metadata as recovery evidence, then atomically install
// canonical metadata (Finding A repair rule — never delete ambiguous material).
async function repairGenerationMetadata(generationPath, keys, { now, source }) {
  const metaPath = join(generationPath, "metadata.json");
  const existing = await readRegularGenFile(metaPath);
  if (existing.kind === "content") {
    await writeIfAbsent(
      join(generationPath, "metadata.json.recovery"),
      existing.content,
      0o600,
    );
  }
  const metadata = {
    schema: GENERATION_METADATA_SCHEMA,
    fingerprint: keys.public_key_fingerprint,
    generation_id: keys.public_key_fingerprint,
    algorithm: REQUIRED_KEY_ALGORITHM,
    private_content_hash: sha256(keys.private_key_pem),
    public_content_hash: sha256(keys.public_key_pem),
    created_at: now,
    source,
  };
  const bytes = `${JSON.stringify(metadata, null, 2)}\n`;
  const staged = `${metaPath}.next`;
  let handle;
  try {
    handle = await open(
      staged,
      constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | NO_FOLLOW,
      0o644,
    );
    await handle.writeFile(bytes, "utf8");
    await handle.sync().catch(() => {});
  } finally {
    await handle?.close();
  }
  await rename(staged, metaPath);
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
    return { error: "malformed_pointer", raw };
  }
  if (
    !doc ||
    doc.schema !== ACTIVE_POINTER_SCHEMA ||
    typeof doc.generation_fingerprint !== "string" ||
    !/^[0-9a-f]{64}$/.test(doc.generation_fingerprint) ||
    typeof doc.generation_path !== "string"
  ) {
    return { error: "malformed_pointer", raw };
  }
  return { doc, raw };
}

// ── Refuse-and-report recovery (IDENTITY-RECOVERY-REFUSE-AND-REPORT-1E) ────
// Founder decision: identity recovery is narrowed to REFUSE-AND-REPORT.
// Detection and diagnosis are automatic and READ-ONLY; root-of-trust recovery
// mutation requires a separate, explicitly consented C5 transaction
// (IDENTITY-EXPLICIT-RECOVERY-TRANSACTION-1F — deliberately not this slice).
// No automatic path may rename, delete, replace, restore, or repair an
// invalid active identity, and none may generate a replacement keypair.

export const RECOVERY_CLASSES = Object.freeze([
  "NO_ACTIVE_IDENTITY",
  "VALID_ACTIVE_IDENTITY",
  "INVALID_GENESIS_POINTER",
  "INVALID_PRIOR_POINTER",
  "UNTRACKED_INVALID_POINTER",
  "UNSAFE_POINTER_PATH",
  "CORRUPT_GENERATION",
  "RETIRED_GENERATION",
  "IDENTITY_TRANSITION_IN_PROGRESS",
  "RECOVERY_STATE_UNKNOWN",
]);

const LOAD_ERROR_TO_RECOVERY_CLASS = Object.freeze({
  malformed_pointer: "UNTRACKED_INVALID_POINTER",
  pointer_escape: "UNSAFE_POINTER_PATH",
  generation_unsafe: "CORRUPT_GENERATION",
  metadata_corrupt: "CORRUPT_GENERATION",
  content_hash_mismatch: "CORRUPT_GENERATION",
  pair_mismatch: "CORRUPT_GENERATION",
  unsupported_key_algorithm: "CORRUPT_GENERATION",
  retired_generation: "RETIRED_GENERATION",
  retired_registry_incomplete: "RECOVERY_STATE_UNKNOWN",
  // An unreadable registry cannot prove retired OR serviceable — UNKNOWN,
  // never a definitive class.
  retired_registry_unreadable: "RECOVERY_STATE_UNKNOWN",
  load_failed: "RECOVERY_STATE_UNKNOWN",
});

// Read-only classification of the active-pointer authority state. Uses the
// canonical loader, preserves its exact error, follows no unsafe symlink,
// and mutates nothing. Returns { class, loader_error?, fingerprint?, doc? }.
async function classifyPointerAuthority(demaHome) {
  const ap = activeKeyPaths(demaHome);
  const dirInfo = await lstatIfExists(ap.dir);
  if (!dirInfo) return { class: "NO_ACTIVE_IDENTITY" };
  if (dirInfo.isSymbolicLink() || !dirInfo.isDirectory()) {
    // An unsafe keys DIR only becomes an unsafe ACTIVE IDENTITY when a
    // pointer actually exists behind it; an empty unsafe dir stays
    // NO_ACTIVE_IDENTITY so init keeps its established unsafe_key_path
    // refusal (which is also read-only).
    const behind = await lstatIfExists(ap.activePointer);
    return behind
      ? { class: "UNSAFE_POINTER_PATH" }
      : { class: "NO_ACTIVE_IDENTITY" };
  }
  const info = await lstatIfExists(ap.activePointer);
  if (!info) return { class: "NO_ACTIVE_IDENTITY" };
  if (info.isSymbolicLink() || !info.isFile()) {
    return { class: "UNSAFE_POINTER_PATH" };
  }
  // ONE pointer snapshot drives everything below — verdict, claims, and
  // hashes all derive from this single read, so a concurrent swap can never
  // pair one snapshot's loader error with another snapshot's evidence.
  const pointer = await readActivePointer(ap);
  if (pointer.error === "no_active_pointer") {
    // lstat saw an entry that vanished before the read — state changed
    // underneath; UNKNOWN, never re-normalized.
    return { class: "RECOVERY_STATE_UNKNOWN", loader_error: pointer.error };
  }
  if (pointer.error) {
    return {
      class: "UNTRACKED_INVALID_POINTER",
      loader_error: pointer.error,
      raw: pointer.raw ?? null,
    };
  }
  const { doc, raw } = pointer;
  let load;
  try {
    load = await verifyPointerDoc(ap, doc, raw);
  } catch {
    load = pairFailure("load_failed");
  }
  if (load.ok) {
    return {
      class: "VALID_ACTIVE_IDENTITY",
      fingerprint: load.fingerprint,
      // Trusted facts come ONLY from this accepted snapshot's verification —
      // containment-verified path, recorded lineage, and pointer hash.
      generationPath: load.generation_path,
      previousGeneration: load.previous_generation,
      pointerHash: load.active_pointer_hash,
    };
  }
  const cls =
    load.error === "generation_missing"
      ? doc.previous_generation == null
        ? "INVALID_GENESIS_POINTER"
        : "INVALID_PRIOR_POINTER"
      : (LOAD_ERROR_TO_RECOVERY_CLASS[load.error] ?? "RECOVERY_STATE_UNKNOWN");
  return { class: cls, loader_error: load.error, doc, raw };
}

function initRecoveryRefusal(cls) {
  return Object.freeze({
    schema: KEY_INIT_SCHEMA,
    initialized: false,
    error: "recovery_required",
    recovery_class: cls.class,
    loader_error: cls.loader_error ?? null,
    recommended_action: "RUN_EXPLICIT_IDENTITY_RECOVERY",
    active_pointer_preserved: true,
    generation_preserved: true,
    new_identity_generated: false,
    authority_delta: 0,
    boundary: buildBoundary(false),
  });
}

function migrateRecoveryRefusal(cls) {
  return Object.freeze({
    schema: KEY_MIGRATE_SCHEMA,
    migrated: false,
    error: "recovery_required",
    recovery_class: cls.class,
    loader_error: cls.loader_error ?? null,
    recommended_action: "RUN_EXPLICIT_IDENTITY_RECOVERY",
    legacy_pair_preserved: true,
    active_pointer_preserved: true,
    authority_delta: 0,
    boundary: buildBoundary(false),
  });
}

// Read-only lease inspection — never creates, refreshes, or deletes a lease.
async function inspectTransitionLease(ap) {
  const info = await lstatIfExists(ap.identityLease);
  if (!info) return { state: "NONE" };
  if (info.isSymbolicLink() || !info.isFile()) return { state: "UNREADABLE" };
  const raw = await readFileNoFollow(ap.identityLease);
  if (raw === null) return { state: "UNREADABLE" };
  let pid = null;
  try {
    pid = JSON.parse(raw).pid ?? null;
  } catch {
    return { state: "UNREADABLE" };
  }
  return { state: pidAlive(pid) ? "HOLDER_ALIVE" : "HOLDER_DEAD" };
}

// Bounded, read-only artifact-binding scan. DETECTED means the fingerprint
// appears in a receipts file; NOT_DETECTED_BOUNDED_SCAN is explicitly NOT
// proof of non-use; any incompleteness (no fingerprint, hazard entries,
// unreadable content, over-bound directory) is UNKNOWN — never `false`.
const ARTIFACT_SCAN_BOUND = 512;
async function boundedArtifactBindingScan(demaHome, fingerprint) {
  if (!fingerprint) return "UNKNOWN";
  const receiptsDir = join(resolveHome(demaHome), "receipts");
  const dirInfo = await lstatIfExists(receiptsDir);
  if (!dirInfo) return "NOT_DETECTED_BOUNDED_SCAN";
  if (dirInfo.isSymbolicLink() || !dirInfo.isDirectory()) return "UNKNOWN";
  let entries;
  try {
    entries = await readdir(receiptsDir, { withFileTypes: true });
  } catch {
    return "UNKNOWN";
  }
  if (entries.length > ARTIFACT_SCAN_BOUND) return "UNKNOWN";
  for (const entry of entries) {
    if (!entry.isFile()) return "UNKNOWN";
    const raw = await readFileNoFollow(join(receiptsDir, entry.name));
    if (raw === null) return "UNKNOWN";
    if (raw.includes(fingerprint)) return "DETECTED";
  }
  return "NOT_DETECTED_BOUNDED_SCAN";
}

// inspectIdentityRecovery — the read-only refuse-and-report inspector. Maps a
// home to exactly one recovery class with the evidence an explicit C5
// recovery transaction would need. Returns paths, hashes, and classes only —
// never key material or receipt contents.
//
// Authority-precedence law (1E.6): a lease is LIVENESS evidence; a verified
// pointer is AUTHORITY evidence. Liveness evidence never overrides verified
// authority — a canonically valid identity always reports VALID regardless of
// lease state (the lease stays observable in transition_lease_state). Only a
// confirmed LIVE holder may classify a non-valid pointer state as an active
// transition; a dead or unreadable lease is not proof of one.
export async function inspectIdentityRecovery(demaHome) {
  const ap = activeKeyPaths(demaHome);
  const paths = keyPaths(demaHome);
  const lease = await inspectTransitionLease(ap);
  const pointerCls = await classifyPointerAuthority(demaHome);
  const pointerValid = pointerCls.class === "VALID_ACTIVE_IDENTITY";
  const liveTransition = !pointerValid && lease.state === "HOLDER_ALIVE";
  const recoveryClass = pointerValid
    ? "VALID_ACTIVE_IDENTITY"
    : liveTransition
      ? "IDENTITY_TRANSITION_IN_PROGRESS"
      : pointerCls.class;
  // Single-snapshot rule (Greptile round-4 TOCTOU): the inspector performs NO
  // pointer read of its own. Trusted facts come from the loader's accepted
  // snapshot (via the classifier); claims and claim-hashes come from the
  // classifier's one diagnostic read. A re-read here could parse replacement
  // bytes that were never validated.
  const doc = pointerCls.doc ?? null;
  const valid = pointerValid;
  // 1E.6-F: a rejected doc's generation_fingerprint is an untrusted CLAIM —
  // shape validity is not trust. It is published (and used for the artifact
  // scan) ONLY when it is the canonical loader's verified fingerprint;
  // otherwise the report carries a hash of the claim and the scan is not run.
  const claimedFingerprint =
    doc && typeof doc.generation_fingerprint === "string"
      ? doc.generation_fingerprint
      : null;
  const fingerprint = valid ? (pointerCls.fingerprint ?? null) : null;
  const fingerprintState = valid
    ? "VERIFIED"
    : claimedFingerprint !== null
      ? "UNTRUSTED_CLAIM"
      : "ABSENT";
  // 1E.1 Finding A: a pointer document the canonical loader REJECTED is
  // attacker-influencable evidence, not fact. Its raw generation_path claim is
  // never republished — the report carries only a hash of the claim and an
  // explicit trust state. The sole VERIFIED_CONTAINED source is the loader's
  // own containment-checked path.
  const claimedPath =
    doc && typeof doc.generation_path === "string" ? doc.generation_path : null;
  let generationPath = null;
  let generationPathState = "ABSENT";
  let claimedPathHash = null;
  if (valid) {
    generationPath = pointerCls.generationPath ?? null;
    generationPathState = "VERIFIED_CONTAINED";
  } else if (claimedPath !== null) {
    generationPathState = "UNTRUSTED_OR_UNCONTAINED";
    claimedPathHash = sha256(claimedPath);
  }
  let recommendedAction;
  if (valid) {
    recommendedAction = "NONE";
  } else if (liveTransition) {
    recommendedAction = "RETRY_AFTER_TRANSITION";
  } else if (
    pointerCls.class === "NO_ACTIVE_IDENTITY" &&
    lease.state === "NONE"
  ) {
    recommendedAction = "INITIALIZE_AUTHORSHIP_KEY";
  } else {
    recommendedAction = "RUN_EXPLICIT_IDENTITY_RECOVERY";
  }
  // CP5 (P0.2b crash matrix, 2026-07-29): a rotation interrupted between the
  // retirement append and the pointer commit is REPORTED here and repaired
  // nowhere. This root is read-only by contract (identity-recovery refuse-and-
  // report gate); the operator runs resumeAuthorshipRotation explicitly.
  const rotationJournal = await readRotationJournalDoc(paths);
  return Object.freeze({
    schema: "bizra.dema.identity_recovery_inspection.v0.1",
    recovery_class: recoveryClass,
    rotation_journal_state: rotationJournal.state,
    rotation_resume_state: await classifyRotationResume(ap, rotationJournal),
    active_pointer_path: ap.activePointer,
    active_pointer_hash: valid
      ? (pointerCls.pointerHash ?? null)
      : pointerCls.raw != null
        ? sha256(pointerCls.raw)
        : null,
    generation_fingerprint: fingerprint,
    generation_fingerprint_state: fingerprintState,
    pointer_claimed_generation_fingerprint_hash:
      !valid && claimedFingerprint !== null ? sha256(claimedFingerprint) : null,
    generation_path: generationPath,
    generation_path_state: generationPathState,
    pointer_claimed_generation_path_hash: claimedPathHash,
    loader_error: pointerCls.loader_error ?? null,
    // Same laundering rule as generation_path: previous_generation from a
    // loader-REJECTED doc is an attacker-influencable CLAIM — shape validity
    // is not trust. It is published only from a loader-ACCEPTED pointer (the
    // authoritative active record); otherwise the report carries only a hash
    // of the claim. Genesis-vs-prior diagnosis stays in recovery_class.
    previous_generation: valid ? (pointerCls.previousGeneration ?? null) : null,
    pointer_claimed_previous_generation_hash:
      !valid && typeof doc?.previous_generation === "string"
        ? sha256(doc.previous_generation)
        : null,
    legacy_pair_presence: await isSafeExistingKeyPath(paths, paths.privateKey),
    // The receipts scan runs ONLY against a loader-VERIFIED fingerprint — a
    // rejected claim must never produce an apparently meaningful binding
    // verdict, so every non-valid state is UNKNOWN.
    artifact_binding_state: valid
      ? await boundedArtifactBindingScan(demaHome, fingerprint)
      : "UNKNOWN",
    transition_lease_state: lease.state,
    automatic_recovery_allowed: false,
    required_consent_class: "C5",
    recommended_action: recommendedAction,
    authority_delta: 0,
  });
}

async function readRetiredFingerprints(ap) {
  const info = await lstatIfExists(ap.retiredRegistry);
  if (!info) {
    return Object.freeze({
      ok: true,
      present: false,
      fingerprints: Object.freeze([]),
    });
  }
  if (info.isSymbolicLink() || !info.isFile()) {
    return pairFailure("retired_registry_unreadable");
  }
  const raw = await readFileNoFollow(ap.retiredRegistry);
  if (raw === null) return pairFailure("retired_registry_unreadable");
  let registry;
  try {
    registry = JSON.parse(raw);
  } catch {
    return pairFailure("retired_registry_unreadable");
  }
  const retired = Array.isArray(registry?.retired) ? registry.retired : null;
  if (
    !retired ||
    retired.some(
      (entry) =>
        !entry ||
        typeof entry !== "object" ||
        Array.isArray(entry) ||
        !SHA256_HEX.test(entry.fingerprint ?? ""),
    )
  ) {
    return pairFailure("retired_registry_unreadable");
  }
  return Object.freeze({
    ok: true,
    present: true,
    fingerprints: Object.freeze([
      ...new Set(retired.map((entry) => entry.fingerprint)),
    ].sort()),
  });
}

// --- CP5: interrupted-rotation reading (no mutation reachable from here) ---

// Parse the rotation journal without ever trusting it as authority. An absent
// journal is ABSENT, unparseable bytes are CORRUPT — never "fine".
async function readRotationJournalDoc(paths) {
  const raw = await readExactIfPresent(join(paths.dir, "rotation-journal.json"));
  if (raw === null || raw === undefined) {
    return Object.freeze({ state: "ABSENT", doc: null });
  }
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch {
    return Object.freeze({ state: "CORRUPT", doc: null });
  }
  if (
    !doc ||
    typeof doc !== "object" ||
    doc.schema !== KEY_ROTATE_JOURNAL_SCHEMA ||
    typeof doc.state !== "string"
  ) {
    return Object.freeze({ state: "CORRUPT", doc: null });
  }
  return Object.freeze({ state: doc.state, doc: Object.freeze({ ...doc }) });
}

// Read-only verdict over the interrupted-rotation window. RESUMABLE_FORWARD is
// claimed ONLY when the retirement is durably committed and the pointer has not
// moved — the exact CP5 post-state. Everything else is named, never repaired.
async function classifyRotationResume(ap, journal) {
  if (journal.state === "CORRUPT") return "JOURNAL_CORRUPT";
  if (journal.state !== "ACTIVATING") return "NOT_INTERRUPTED";
  const { old_fingerprint: oldFp, new_fingerprint: newFp } = journal.doc ?? {};
  if (!SHA256_HEX.test(oldFp ?? "") || !SHA256_HEX.test(newFp ?? "")) {
    return "JOURNAL_CORRUPT";
  }
  const registry = await readRetiredFingerprints(ap);
  if (!registry.ok) return "REGISTRY_UNREADABLE";
  if (!registry.fingerprints.includes(oldFp)) return "RETIREMENT_NOT_COMMITTED";
  const raw = await readFileNoFollow(ap.activePointer);
  if (raw === null) return "POINTER_UNREADABLE";
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch {
    return "POINTER_UNREADABLE";
  }
  if (doc?.generation_fingerprint === newFp) return "ALREADY_ACTIVE";
  if (doc?.generation_fingerprint !== oldFp) return "POINTER_UNEXPECTED";
  return "RESUMABLE_FORWARD";
}

async function checkRetired(ap, fingerprint, previousGeneration = null) {
  const registry = await readRetiredFingerprints(ap);
  if (!registry.ok) return registry.error;
  if (registry.fingerprints.includes(fingerprint)) return "retired_generation";
  if (
    previousGeneration !== null &&
    (!SHA256_HEX.test(previousGeneration) ||
      !registry.fingerprints.includes(previousGeneration))
  ) {
    return "retired_registry_incomplete";
  }
  return null;
}

function pairFailure(error) {
  return Object.freeze({ ok: false, error });
}

async function resolveContainedGeneration(ap, doc) {
  const keysInfo = await lstatIfExists(ap.dir);
  const generationsInfo = await lstatIfExists(ap.generationsDir);
  if (
    !keysInfo ||
    keysInfo.isSymbolicLink() ||
    !keysInfo.isDirectory() ||
    !generationsInfo ||
    generationsInfo.isSymbolicLink() ||
    !generationsInfo.isDirectory()
  ) {
    return pairFailure("pointer_escape");
  }

  let keysReal;
  let generationsReal;
  try {
    keysReal = await realpath(ap.dir);
    generationsReal = await realpath(ap.generationsDir);
  } catch {
    return pairFailure("pointer_escape");
  }
  if (
    !isInsideOrSame(generationsReal, keysReal) ||
    generationsReal === keysReal
  ) {
    return pairFailure("pointer_escape");
  }

  const generationPath = isAbsolute(doc.generation_path)
    ? doc.generation_path
    : join(ap.dir, doc.generation_path);
  const generationInfo = await lstatIfExists(generationPath);
  if (
    !generationInfo ||
    generationInfo.isSymbolicLink() ||
    !generationInfo.isDirectory()
  ) {
    return pairFailure(
      generationInfo ? "generation_unsafe" : "generation_missing",
    );
  }

  let generationReal;
  try {
    generationReal = await realpath(generationPath);
  } catch {
    return pairFailure("pointer_escape");
  }
  if (
    !isInsideOrSame(generationReal, generationsReal) ||
    generationReal === generationsReal
  ) {
    return pairFailure("pointer_escape");
  }
  return Object.freeze({ ok: true, generationReal });
}

// Shared post-pointer verification over ONE pointer snapshot (doc + raw):
// containment, generation content, metadata, pair convergence, retirement —
// exactly the loader contract. Both loadActiveKeyPair and
// classifyPointerAuthority verify through here so a verdict can never mix
// two different pointer reads (1E.4 round-5 snapshot-coherence rule).
async function verifyPointerDoc(ap, doc, raw) {
  try {
    const resolved = await resolveContainedGeneration(ap, doc);
    if (!resolved.ok) return resolved;
    const { generationReal } = resolved;

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
      metadata.algorithm !== REQUIRED_KEY_ALGORITHM ||
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

    // Finding #2: pairConsistency also proves both keys are Ed25519 and that
    // the actual key algorithm agrees with the metadata's declared algorithm.
    const pair = pairConsistency(privateKeyPem, publicKeyPem);
    if (pair.error === "unsupported_key_algorithm") {
      return pairFailure("unsupported_key_algorithm");
    }
    if (!pair.ok || pair.fingerprint !== doc.generation_fingerprint) {
      return pairFailure("pair_mismatch");
    }

    const retired = await checkRetired(
      ap,
      pair.fingerprint,
      doc.previous_generation ?? null,
    );
    if (retired) return pairFailure(retired);

    return Object.freeze({
      ok: true,
      fingerprint: pair.fingerprint,
      generation_path: generationReal,
      // Lineage from the SAME accepted snapshot (1E.3 TOCTOU rule): consumers
      // must never re-read the pointer to learn it.
      previous_generation: doc.previous_generation ?? null,
      private_key_pem: privateKeyPem,
      public_key_pem: publicKeyPem,
      metadata_hash: sha256(metadataRaw),
      active_pointer_hash: sha256(raw),
    });
  } catch {
    return pairFailure("load_failed");
  }
}

export async function loadActiveKeyPair(demaHome) {
  try {
    const ap = activeKeyPaths(demaHome);
    const pointer = await readActivePointer(ap);
    if (pointer.error) return pairFailure(pointer.error);
    return await verifyPointerDoc(ap, pointer.doc, pointer.raw);
  } catch {
    return pairFailure("load_failed");
  }
}

// Public-only trust loader for receipt verification. This follows one active
// pointer snapshot and validates only public authority material: pointer
// containment, generation metadata, public-key bytes, canonical fingerprint,
// and the retirement registry. It never opens private.pem, so historical
// verification cannot accidentally depend on private-key readability.
async function verifyPublicPointerDoc(ap, doc) {
  try {
    const resolved = await resolveContainedGeneration(ap, doc);
    if (!resolved.ok) return resolved;
    const { generationReal } = resolved;

    const publicKeyPem = await readFileNoFollow(join(generationReal, "public.pem"));
    const metadataRaw = await readFileNoFollow(join(generationReal, "metadata.json"));
    if (publicKeyPem === null) return pairFailure("generation_unsafe");
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
      metadata.algorithm !== REQUIRED_KEY_ALGORITHM ||
      !SHA256_HEX.test(metadata.private_content_hash ?? "") ||
      !SHA256_HEX.test(metadata.public_content_hash ?? "") ||
      basename(generationReal) !== doc.generation_fingerprint
    ) {
      return pairFailure("metadata_corrupt");
    }
    if (sha256(publicKeyPem) !== metadata.public_content_hash) {
      return pairFailure("content_hash_mismatch");
    }

    if (!isSpkiPublicKeyPem(publicKeyPem)) {
      return pairFailure("public_key_invalid");
    }
    let publicKey;
    try {
      publicKey = createPublicKey(publicKeyPem);
    } catch {
      return pairFailure("public_key_invalid");
    }
    if (publicKey.asymmetricKeyType !== REQUIRED_KEY_ALGORITHM) {
      return pairFailure("unsupported_key_algorithm");
    }
    const publicDer = publicKey.export({ type: "spki", format: "der" });
    const fingerprint = sha256(publicDer.toString("hex"));
    if (fingerprint !== doc.generation_fingerprint) {
      return pairFailure("public_key_fingerprint_mismatch");
    }

    const retired = await readRetiredFingerprints(ap);
    if (!retired.ok) return retired;
    if (retired.fingerprints.includes(fingerprint)) {
      return pairFailure("retired_generation");
    }
    if (
      doc.previous_generation !== null &&
      doc.previous_generation !== undefined &&
      (!SHA256_HEX.test(doc.previous_generation) ||
        !retired.fingerprints.includes(doc.previous_generation))
    ) {
      return pairFailure("retired_registry_incomplete");
    }

    return Object.freeze({
      schema: AUTHORSHIP_TRUST_SNAPSHOT_SCHEMA,
      active_public_key_pem: publicKeyPem,
      active_fingerprint: fingerprint,
      retired_fingerprints: retired.fingerprints,
    });
  } catch {
    return pairFailure("load_failed");
  }
}

export async function loadAuthorshipTrustSnapshot(demaHome) {
  try {
    const ap = activeKeyPaths(demaHome);
    const pointer = await readActivePointer(ap);
    if (pointer.error) return pairFailure(pointer.error);
    return await verifyPublicPointerDoc(ap, pointer.doc);
  } catch {
    return pairFailure("load_failed");
  }
}

export async function migrateLegacyAuthorshipKey({
  consent,
  demaHome,
  now = new Date().toISOString(),
  // GENESIS-AUTHORSHIP-MIGRATION-CONSENT-BINDING-1A: when supplied, the
  // migration is bound to this EXACT public-key fingerprint. The pair is
  // re-read and re-derived UNDER the identity lease, before the first durable
  // write, and any divergence refuses with zero mutation. Omitted, the
  // historical class-consent semantics are preserved for the generic API —
  // the Genesis ceremony profile never omits it.
  expectedFingerprint,
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
  // 1E refuse-and-report: a present pointer is not a blanket "already
  // migrated". Classify it READ-ONLY — a valid identity refuses verified; an
  // invalid one refuses to explicit recovery. Migration never quarantines,
  // remigrates, or repairs over an invalid active identity.
  const early = await classifyPointerAuthority(demaHome);
  if (early.class === "VALID_ACTIVE_IDENTITY") {
    return Object.freeze({
      schema: KEY_MIGRATE_SCHEMA,
      migrated: false,
      error: "already_migrated",
      verified_existing_identity: true,
      authority_delta: 0,
      boundary: buildBoundary(false),
    });
  }
  if (early.class !== "NO_ACTIVE_IDENTITY") {
    return migrateRecoveryRefusal(early);
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
  if (pair.error === "unsupported_key_algorithm") {
    // Finding #2: refuse a non-Ed25519 legacy pair BEFORE any mutation.
    return Object.freeze({
      schema: KEY_MIGRATE_SCHEMA,
      migrated: false,
      error: "unsupported_key_algorithm",
      boundary: buildBoundary(false),
    });
  }
  if (!pair.ok) {
    return Object.freeze({
      schema: KEY_MIGRATE_SCHEMA,
      migrated: false,
      error: "pair_mismatch",
      boundary: buildBoundary(false),
    });
  }

  // Finding #1: one exclusive transition owner. Finding #3: a generation from
  // an interrupted prior migration is resumed, not fought.
  const lease = await acquireIdentityLease(ap);
  if (!lease.acquired) {
    return Object.freeze({
      schema: KEY_MIGRATE_SCHEMA,
      migrated: false,
      error: lease.reason, // identity_transition_in_progress | recovery_required
      boundary: buildBoundary(false),
    });
  }

  try {
    // Re-classify UNDER the lease: a pointer that appeared since the early
    // check belongs to a concurrent transition — refuse, never overwrite.
    const pointerCls = await classifyPointerAuthority(demaHome);
    if (pointerCls.class === "VALID_ACTIVE_IDENTITY") {
      return Object.freeze({
        schema: KEY_MIGRATE_SCHEMA,
        migrated: false,
        error: "already_migrated",
        verified_existing_identity: true,
        authority_delta: 0,
        boundary: buildBoundary(false),
      });
    }
    if (pointerCls.class !== "NO_ACTIVE_IDENTITY") {
      return migrateRecoveryRefusal(pointerCls);
    }

    // Exact-target law: PREVIEWED == CONSENT_BOUND == EXECUTION_TIME_DERIVED.
    // The comparison's execution side is re-read from disk HERE, under the
    // lease — evidence the caller does not control — so a pair swapped in
    // after preview/consent is caught, and the bytes that get written are the
    // bytes that were just verified, never the pre-lease read.
    let effPrivate = privateKeyPem;
    let effPublic = publicKeyPem;
    let effPair = pair;
    if (typeof expectedFingerprint === "string" && expectedFingerprint.length > 0) {
      const freshPrivate = await readKeyFile(paths, paths.privateKey);
      const freshPublic = await readKeyFile(paths, paths.publicKey);
      if (!freshPrivate || !freshPublic) {
        return Object.freeze({
          schema: KEY_MIGRATE_SCHEMA,
          migrated: false,
          error: "no_legacy_key",
          boundary: buildBoundary(false),
        });
      }
      const freshPair = pairConsistency(freshPrivate, freshPublic);
      if (!freshPair.ok) {
        return Object.freeze({
          schema: KEY_MIGRATE_SCHEMA,
          migrated: false,
          error: freshPair.error === "unsupported_key_algorithm"
            ? "unsupported_key_algorithm"
            : "pair_mismatch",
          boundary: buildBoundary(false),
        });
      }
      if (freshPair.fingerprint !== expectedFingerprint) {
        return Object.freeze({
          schema: KEY_MIGRATE_SCHEMA,
          migrated: false,
          error: "expected_fingerprint_mismatch",
          expected_fingerprint: expectedFingerprint,
          derived_fingerprint: freshPair.fingerprint,
          authority_delta: 0,
          boundary: buildBoundary(false),
        });
      }
      effPrivate = freshPrivate;
      effPublic = freshPublic;
      effPair = freshPair;
    }

    await mkdir(ap.generationsDir, { recursive: true });
    const expected = {
      public_key_fingerprint: effPair.fingerprint,
      private_key_pem: effPrivate,
      public_key_pem: effPublic,
    };
    const cls = await classifyGeneration(ap, effPair.fingerprint, expected);
    // Finding A (1C): only "absent" / "complete_verified" / "incomplete_
    // repairable" may proceed. "conflict" / "recovery_required" halt with the
    // evidence preserved — never a success over material we cannot verify.
    if (cls.state === "conflict" || cls.state === "recovery_required") {
      return Object.freeze({
        schema: KEY_MIGRATE_SCHEMA,
        migrated: false,
        error: "recovery_required",
        generation_path: cls.generationPath,
        boundary: buildBoundary(false),
      });
    }

    const keys = {
      public_key_fingerprint: effPair.fingerprint,
      private_key_pem: effPrivate,
      public_key_pem: effPublic,
    };
    // write-if-absent fills only missing files; a present-but-malformed
    // metadata is explicitly repaired (bad bytes preserved as recovery).
    const { generationPath } = await writeGeneration(ap, keys, {
      now,
      source: "legacy_migration",
    });
    if (cls.state === "incomplete_repairable" && cls.metadataMalformed) {
      await repairGenerationMetadata(cls.generationPath, keys, {
        now,
        source: "legacy_migration",
      });
    }
    await activateGeneration(ap, {
      fingerprint: effPair.fingerprint,
      now,
      previous: null,
    });

    // Finding B (1C): a transition is complete only when the canonical
    // post-transition loader ACCEPTS the result. Verify before claiming
    // success — presence of files is not convergence.
    const verified = await loadActiveKeyPair(demaHome);
    if (
      !verified.ok ||
      verified.fingerprint !== effPair.fingerprint ||
      verified.generation_path !== generationPath
    ) {
      // 1E: the committed pointer and generation are PRESERVED as evidence —
      // no automatic quarantine, remigration, or repair. Recovery is an
      // explicit C5 transaction.
      return Object.freeze({
        schema: KEY_MIGRATE_SCHEMA,
        migrated: false,
        error: "recovery_required",
        transition_state: "pointer_committed_verification_failed",
        recommended_action: "RUN_EXPLICIT_IDENTITY_RECOVERY",
        active_pointer_preserved: true,
        generation_preserved: true,
        authority_delta: 0,
        generation_path: generationPath,
        loader_error: verified.ok ? "fingerprint_or_path_mismatch" : verified.error,
        boundary: buildBoundary(true),
      });
    }

    return Object.freeze({
      schema: KEY_MIGRATE_SCHEMA,
      migrated: true,
      fingerprint: effPair.fingerprint,
      generation_path: generationPath,
      resumed: cls.state !== "absent",
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
  } finally {
    await lease.release();
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

  // Finding #2 (ADR-047): initialization may ESTABLISH the first active
  // generation; it must never REPLACE an existing one. `force` bypasses only
  // the legacy flat-file existence check — an active pointer is the root of
  // trust and can be changed ONLY by a governed rotation transaction, never
  // by re-init. 1E refuse-and-report: the pointer is classified READ-ONLY
  // BEFORE any directory preparation — a valid identity refuses verified, an
  // invalid or unsafe one refuses to explicit C5 recovery with ZERO mutation
  // (no keypair, no rename, no repair). This first check is an early-out; the
  // authoritative one runs UNDER the lease below.
  const early = await classifyPointerAuthority(demaHome);
  if (early.class === "VALID_ACTIVE_IDENTITY") {
    return keyAlreadyExistsResult(paths, {
      verified_existing_identity: true,
      authority_delta: 0,
    });
  }
  if (early.class !== "NO_ACTIVE_IDENTITY") {
    return initRecoveryRefusal(early);
  }

  const unsafePath = await prepareKeyDirectory(paths);
  if (unsafePath) return unsafeKeyPathResult(unsafePath);

  if (!force && (await existingKeyPath(paths))) {
    return keyAlreadyExistsResult(paths);
  }

  // Finding #1: acquire the exclusive transition lease, then RE-CHECK the
  // pointer under it — this closes the check-then-act race between two
  // concurrent initializers. The loser mutates nothing.
  const lease = await acquireIdentityLease(ap);
  if (!lease.acquired) {
    return Object.freeze({
      schema: KEY_INIT_SCHEMA,
      initialized: false,
      error: lease.reason, // identity_transition_in_progress | recovery_required
      boundary: buildBoundary(false),
    });
  }

  try {
    // Re-classify UNDER the lease — closes the check-then-act race. The
    // loser (or any invalid state that appeared) mutates nothing.
    const cls = await classifyPointerAuthority(demaHome);
    if (cls.class === "VALID_ACTIVE_IDENTITY") {
      return keyAlreadyExistsResult(paths, {
        verified_existing_identity: true,
        authority_delta: 0,
      });
    }
    if (cls.class !== "NO_ACTIVE_IDENTITY") {
      return initRecoveryRefusal(cls);
    }

    const keys = generateEd25519Keypair();
    await mkdir(ap.generationsDir, { recursive: true });
    const { generationPath } = await writeGeneration(ap, keys, {
      now,
      source: "init",
    });
    await activateGeneration(ap, {
      fingerprint: keys.public_key_fingerprint,
      now,
      previous: null,
    });

    // Finding B (1C): init, like migration, is complete only when the
    // canonical loader accepts the freshly established identity.
    const verified = await loadActiveKeyPair(demaHome);
    if (
      !verified.ok ||
      verified.fingerprint !== keys.public_key_fingerprint ||
      verified.generation_path !== generationPath
    ) {
      // 1E: the committed pointer and generation are PRESERVED as evidence —
      // no automatic quarantine or replacement. A retry re-classifies to a
      // stable recovery class and never generates a second keypair; recovery
      // itself is an explicit C5 transaction.
      return Object.freeze({
        schema: KEY_INIT_SCHEMA,
        initialized: false,
        error: "recovery_required",
        transition_state: "pointer_committed_verification_failed",
        recommended_action: "RUN_EXPLICIT_IDENTITY_RECOVERY",
        active_pointer_preserved: true,
        generation_preserved: true,
        authority_delta: 0,
        loader_error: verified.ok ? "fingerprint_or_path_mismatch" : verified.error,
        boundary: buildBoundary(true),
      });
    }

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
  } finally {
    await lease.release();
  }
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

// Finding #1/#2 gate: a rotation requires a nonce-bearing consent envelope.
// Returns an error code (mutation must be refused) or null (may proceed).
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
    if (Number.isFinite(i) && Number.isFinite(nowMs) && i > nowMs + 300000) {
      return "consent_envelope_future";
    }
  }
  return null;
}

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

async function writeRotationJournal(journalPath, state, oldFp, newFp, stamp) {
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

async function writeFileSynced(path, content, mode) {
  const handle = await open(
    path,
    constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | NO_FOLLOW,
    mode,
  );
  try {
    await handle.writeFile(content, "utf8");
    try {
      await handle.sync();
    } catch {
      /* fsync unsupported — data written */
    }
  } catch (error) {
    if (error?.code === "ELOOP") throw new UnsafeKeyPathError(path);
    throw error;
  } finally {
    await handle.close();
  }
}

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

async function nonceAlreadyUsed(paths, nonce) {
  const existing = await readExactIfPresent(
    join(paths.dir, "used-consent-nonces.json"),
  );
  if (!existing) return false;
  const parsed = JSON.parse(existing);
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
    JSON.stringify(
      { schema: "bizra.dema.used_consent_nonces.v0.1", nonces },
      null,
      2,
    ),
    0o600,
  );
}

async function writeBackupIfAbsent(path, content, mode) {
  try {
    await writeKeyFile(path, content, { mode, force: false });
  } catch (error) {
    if (error instanceof KeyAlreadyExistsError) {
      const existing = await readExact(path);
      if (existing !== content) {
        throw new Error("quarantine byte-mismatch against pre-existing file");
      }
      return;
    }
    throw error;
  }
}

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

// ── ISNAD-AUTHORITY-SUCCESSION-1A · canonical-ledger bridge ─────────────────
//
// Imported dynamically. canonical-receipt.js imports loadActiveKeyPair from this
// module, so a static import here would close a cycle. Deferring it to call time
// keeps module evaluation order irrelevant and keeps the ONE canonical ledger as
// the only proof store — no parallel succession log exists.
async function canonicalLedgerModule() {
  return import("./canonical-ledger.js");
}

const SUCCESSION_TRUTH_LABEL = "MEASURED_LOCAL";

async function appendSuccessionIntent({
  demaHome, rotationTxId, oldFingerprint, newFp, successorPublicKeyPem,
  consentBindingSha256, expectedPointerStateSha256, now,
}) {
  try {
    const { appendCanonicalReceipt } = await canonicalLedgerModule();
    const { buildSuccessionIntentBody } = await import("./authority-succession.js");
    const { CANONICAL_RECEIPT_CONSENT_PHRASE } = await import("./canonical-receipt.js");
    const r = await appendCanonicalReceipt({
      canonicalBody: buildSuccessionIntentBody({
        rotationTxId,
        predecessorFingerprint: oldFingerprint,
        successorFingerprint: newFp,
        successorPublicKeyPem,
        successorPublicKeySha256: sha256(successorPublicKeyPem),
        consentBindingSha256,
        expectedPointerStateSha256,
      }),
      truthLabel: SUCCESSION_TRUTH_LABEL,
      whatProves:
        "the authority in force authorized this exact successor for this rotation transaction, before any pointer moved",
      whatDoesNotProve:
        "it does NOT prove the successor became authoritative; only a matching commit signed by the successor does that",
      consent: CANONICAL_RECEIPT_CONSENT_PHRASE,
      demaHome,
      now,
    });
    return r.appended
      ? { ok: true, receipt_id: r.receipt.receipt_id }
      : { ok: false, reason: r.reason ?? r.error };
  } catch (error) {
    return { ok: false, reason: error?.message ?? String(error) };
  }
}

async function appendSuccessionCommit({
  demaHome, ap, rotationTxId, oldFingerprint, newFp, intentReceiptId, now,
}) {
  try {
    const { appendCanonicalReceipt } = await canonicalLedgerModule();
    const { buildSuccessionCommitBody } = await import("./authority-succession.js");
    const { CANONICAL_RECEIPT_CONSENT_PHRASE } = await import("./canonical-receipt.js");
    // Observed, not intended: the pointer and registry are re-read from disk so
    // the commit attests to the world as it actually is.
    const pointerRaw = await readExact(ap.activePointer);
    const registryRaw = await readExact(ap.retiredRegistry).catch(() => "");
    const r = await appendCanonicalReceipt({
      canonicalBody: buildSuccessionCommitBody({
        rotationTxId,
        predecessorFingerprint: oldFingerprint,
        successorFingerprint: newFp,
        intentReceiptId,
        observedPointerStateSha256: sha256(pointerRaw),
        generationFingerprint: newFp,
        retirementRelationSha256: sha256(registryRaw),
      }),
      truthLabel: SUCCESSION_TRUTH_LABEL,
      whatProves:
        "the successor holds its private key and attests that the authoritative pointer now selects it, completing exactly the succession its predecessor authorized",
      whatDoesNotProve:
        "it does not re-authorize itself; the authorization it completes was signed by the predecessor before the switch",
      consent: CANONICAL_RECEIPT_CONSENT_PHRASE,
      demaHome,
      now,
    });
    return r.appended
      ? { ok: true, receipt_id: r.receipt.receipt_id }
      : { ok: false, reason: r.reason ?? r.error };
  } catch (error) {
    return { ok: false, reason: error?.message ?? String(error) };
  }
}

/**
 * Complete a succession whose commit half never landed.
 *
 * The measured crash state: the pointer selects K_new, a K_old-signed intent is
 * in the ledger, and no commit exists. Before this, `resumeAuthorshipRotation`
 * reported `already_resolved` and wrote nothing, so the transition stayed
 * authoritative and unevidenced permanently.
 *
 * Idempotent by construction: it derives the pending successor from the chain
 * itself, so a chain with no open intent has nothing to finalize and returns
 * `already_complete` without writing a byte.
 *
 * FAILS CLOSED, and never fabricates the missing half in the other direction: if
 * the pointer has switched but no valid predecessor-signed intent exists, this
 * refuses with `requires_human`. Predecessor authorization cannot be
 * manufactured after the authority has already moved — that is the one thing
 * nothing in the system is entitled to do.
 */
export async function finalizeAuthoritySuccession({ demaHome, now } = {}) {
  const ap = activeKeyPaths(demaHome);
  const refuse = (reason) =>
    Object.freeze({ finalized: false, requires_human: true, reason, authority_delta: 0 });
  try {
    const { loadCanonicalLedger } = await canonicalLedgerModule();
    const entries = await loadCanonicalLedger({ demaHome });
    if (entries.length === 0) {
      return Object.freeze({ finalized: false, already_complete: true, reason: "no_ledger", authority_delta: 0 });
    }
    const { verifyCanonicalAuthorityChain } = await import("./canonical-receipt.js");
    const rootFp = entries[0]?.operator_public_key_fingerprint;
    const rootPem = await loadGenerationPublicKey(demaHome, rootFp);
    if (!rootPem) return refuse("root_authority_unresolvable");

    const walk = verifyCanonicalAuthorityChain({ entries, genesisPubkeyPem: rootPem });
    if (!walk.verified) return refuse(`chain_unverifiable:${walk.reason}`);
    if (!walk.pending_successor) {
      return Object.freeze({ finalized: false, already_complete: true, authority_delta: 0 });
    }

    const pending = walk.pending_successor;
    const active = await loadActiveKeyPair(demaHome);
    if (!active.ok) return refuse(`active_identity_unreadable:${active.error}`);
    // Only the key the predecessor NAMED may complete. A pointer that landed on
    // some other generation is an ambiguity, not a rotation to finish.
    if (active.fingerprint !== pending.successor_fingerprint) {
      return refuse("active_identity_is_not_the_authorized_successor");
    }

    const intentBody = entries[pending.intent_index].canonical_body;
    const commit = await appendSuccessionCommit({
      demaHome,
      ap,
      rotationTxId: intentBody.rotation_tx_id,
      oldFingerprint: intentBody.predecessor_fingerprint,
      newFp: intentBody.successor_fingerprint,
      intentReceiptId: pending.intent_receipt_id,
      now: typeof now === "string" && now ? now : new Date().toISOString(),
    });
    if (!commit.ok) return refuse(`succession_commit_unrecordable:${commit.reason}`);

    return Object.freeze({
      finalized: true,
      already_complete: false,
      rotation_tx_id: intentBody.rotation_tx_id,
      predecessor_fingerprint: intentBody.predecessor_fingerprint,
      successor_fingerprint: intentBody.successor_fingerprint,
      commit_receipt_id: commit.receipt_id,
      authority_delta: 0,
    });
  } catch (error) {
    return refuse(error?.message ?? String(error));
  }
}

async function writeRotationReceipt(paths, newFingerprint, receipt) {
  const dir = join(paths.dir, "rotation-receipts");
  await mkdir(dir, { recursive: true });
  const receiptPath = join(dir, `${newFingerprint}.json`);
  await writeFileSynced(receiptPath, JSON.stringify(receipt, null, 2), 0o600);
  return receiptPath;
}

// Ported onto main's active-pointer / generation store (#419+). Replaces the
// flat-file overwrite model from feat/authorship-key-rotate-1a: the new pair
// is installed as a generation, the old fingerprint is retired into the
// registry BEFORE the pointer moves (checkRetired requires previous ∈
// registry), and loadActiveKeyPair is the post-transition authority.
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
  const ap = activeKeyPaths(demaHome);
  const journalPath = join(paths.dir, "rotation-journal.json");

  try {
    await assertRegistryReadable(ap.retiredRegistry);
  } catch (error) {
    return rotateFailClosed("retired_registry_corrupt", error?.message);
  }

  if (envelope?.nonce) {
    let used;
    try {
      used = await nonceAlreadyUsed(paths, envelope.nonce);
    } catch (error) {
      return rotateFailClosed("nonce_ledger_unreadable", error?.message);
    }
    if (used) return rotateFailClosed("consent_nonce_replayed");
  }

  // Active-pointer model: rotate requires a loadable active generation.
  // Pre-#419 flat homes (no pointer) refuse — migrate first (see C′/D′).
  const current = await loadActiveKeyPair(demaHome);
  if (!current.ok) {
    if (current.error === "no_active_pointer") {
      return rotateFailClosed("no_key_to_rotate");
    }
    // Symlink / unsafe generation reads surface as generation_unsafe etc.
    if (
      current.error === "generation_unsafe" ||
      current.error === "pointer_escape"
    ) {
      return rotateFailClosed("no_key_to_rotate");
    }
    return rotateFailClosed("no_key_to_rotate", current.error);
  }

  const oldFingerprint = current.fingerprint;
  const oldPrivatePem = current.private_key_pem;
  const oldPublicPem = current.public_key_pem;

  const lease = await acquireIdentityLease(ap);
  if (!lease.acquired) {
    return rotateFailClosed(lease.reason);
  }

  try {
    const recheck = await loadActiveKeyPair(demaHome);
    if (!recheck.ok || recheck.fingerprint !== oldFingerprint) {
      return rotateFailClosed(
        "identity_transition_in_progress",
        "active identity changed under lease",
      );
    }

    const stage = await stageQuarantine(
      paths,
      oldFingerprint,
      oldPrivatePem,
      oldPublicPem,
    );
    if (stage.error) {
      return rotateFailClosed("quarantine_stage_failed", stage.detail);
    }

    const keys = generateEd25519Keypair();
    if (!keypairMatches(keys.private_key_pem, keys.public_key_pem)) {
      return rotateFailClosed(
        "new_key_pair_invalid",
        "generated keypair failed self-verify",
      );
    }
    const newFp = keys.public_key_fingerprint;

    let generationPath;
    try {
      await mkdir(ap.generationsDir, { recursive: true });
      ({ generationPath } = await writeGeneration(ap, keys, {
        now: nowIso,
        source: "rotate",
      }));
      if (
        (await readExact(join(generationPath, "private.pem"))) !==
        keys.private_key_pem
      ) {
        throw new Error("generation private byte-mismatch");
      }
    } catch (error) {
      return rotateFailClosed(
        "generation_archive_failed",
        error?.message ?? String(error),
      );
    }

    await writeRotationJournal(
      journalPath,
      "PREPARED",
      oldFingerprint,
      newFp,
      nowIso,
    );

    // ── ISNAD-AUTHORITY-SUCCESSION-1A · half one of two ──────────────────────
    //
    // The predecessor authorizes this exact successor, BEFORE the pointer moves
    // and therefore while the predecessor is still the authority. Appending it
    // here is what makes the pair possible at all: after the switch, K_old can
    // no longer sign anything the chain will accept.
    //
    // A refusal here aborts the rotation. An authority transition that could not
    // record its own authorization must not proceed — that is exactly the
    // measured defect (authority changed, proof trail absent) this slice exists
    // to remove, and letting it through "because the key store still works"
    // would reproduce it under a new name.
    const rotationTxId = sha256(
      stableStringify({ old: oldFingerprint, new: newFp, at: nowIso, reason }),
    );
    const intent = await appendSuccessionIntent({
      demaHome,
      rotationTxId,
      oldFingerprint,
      newFp,
      successorPublicKeyPem: keys.public_key_pem,
      consentBindingSha256: sha256(
        stableStringify({ consent, envelope: envelope ?? null, reason }),
      ),
      expectedPointerStateSha256: sha256(
        stableStringify({ generation_fingerprint: newFp, previous_generation: oldFingerprint }),
      ),
      now: nowIso,
    });
    if (!intent.ok) {
      return rotateFailClosed("succession_intent_unrecordable", intent.reason);
    }

    // Registry-first: previous_generation must already be retired before the
    // pointer commits, or loadActiveKeyPair returns retired_registry_incomplete.
    try {
      await writeRotationJournal(
        journalPath,
        "ACTIVATING",
        oldFingerprint,
        newFp,
        nowIso,
      );
      await appendRetiredRegistry(
        ap.retiredRegistry,
        oldFingerprint,
        nowIso,
        reason,
      );
      await writeFileSynced(
        join(stage.dir, "retired.json"),
        JSON.stringify({
          retired_fingerprint: oldFingerprint,
          retired_at: nowIso,
          reason,
          runtime_loadable: false,
        }),
        0o600,
      );
      await activateGeneration(ap, {
        fingerprint: newFp,
        now: nowIso,
        previous: oldFingerprint,
      });
    } catch (error) {
      await writeRotationJournal(
        journalPath,
        "ROLLED_BACK",
        oldFingerprint,
        newFp,
        nowIso,
      );
      return rotateFailClosed(
        "replacement_failed",
        error?.message ?? String(error),
      );
    }

    const verified = await loadActiveKeyPair(demaHome);
    if (
      !verified.ok ||
      verified.fingerprint !== newFp ||
      !keypairMatches(verified.private_key_pem, verified.public_key_pem)
    ) {
      await writeRotationJournal(
        journalPath,
        "ACTIVE_RETIREMENT_PENDING",
        oldFingerprint,
        newFp,
        nowIso,
      );
      return Object.freeze({
        schema: KEY_ROTATE_SCHEMA,
        rotated: true,
        old_fingerprint: oldFingerprint,
        new_fingerprint: newFp,
        retirement_committed: true,
        transaction_state: "ACTIVE_RETIREMENT_PENDING",
        requires: "post_activation_verify_rerun",
        detail: verified.ok ? "fingerprint_or_pair_mismatch" : verified.error,
        boundary: buildBoundary(true),
      });
    }

    await writeRotationJournal(
      journalPath,
      "RETIREMENT_COMMITTED",
      oldFingerprint,
      newFp,
      nowIso,
    );

    if (envelope?.nonce) {
      await recordUsedNonce(paths, envelope.nonce, nowIso).catch(() => {});
    }

    // ── ISNAD-AUTHORITY-SUCCESSION-1A · half two of two ──────────────────────
    //
    // The successor proves possession and attests completion of exactly the
    // succession its predecessor authorized. Only reachable once the pointer has
    // selected K_new, so this signature is itself the possession proof.
    //
    // A crash between the two halves leaves an authorized-but-uncommitted intent
    // — a legible state, which `finalizeAuthoritySuccession` below completes
    // from durable facts alone.
    const commit = await appendSuccessionCommit({
      demaHome,
      ap,
      rotationTxId,
      oldFingerprint,
      newFp,
      intentReceiptId: intent.receipt_id,
      now: nowIso,
    });
    if (!commit.ok) {
      return rotateFailClosed("succession_commit_unrecordable", commit.reason);
    }

    const receipt = {
      schema: KEY_ROTATE_RECEIPT_SCHEMA,
      succession_intent_receipt_id: intent.receipt_id,
      succession_commit_receipt_id: commit.receipt_id,
      rotation_tx_id: rotationTxId,
      old_fingerprint: oldFingerprint,
      new_fingerprint: newFp,
      generation_dir: generationPath,
      retired_at: nowIso,
      reason,
      quarantine_dir: stage.dir,
      retired_registry_path: ap.retiredRegistry,
      journal_path: journalPath,
      runtime_activation: "not_verified_no_runtime",
      revocation_state: "retired_local_denylisted",
      affected_receipt_assessment:
        "see R0B2_EXPOSURE_INTERVAL_ASSESSMENT (local signed-receipt exposure empty)",
      consent_binding: bindConsent(
        consent,
        envelope,
        oldFingerprint,
        newFp,
        nowIso,
        reason,
        demaHome,
      ),
      private_key_material_included: false,
    };
    const receiptPath = await writeRotationReceipt(paths, newFp, receipt);
    await writeRotationJournal(
      journalPath,
      "COMPLETE",
      oldFingerprint,
      newFp,
      nowIso,
    );

    return Object.freeze({
      schema: KEY_ROTATE_SCHEMA,
      rotated: true,
      retirement_committed: true,
      transaction_state: "COMPLETE",
      ...receipt,
      receipt_path: receiptPath,
      private_key_path: join(generationPath, "private.pem"),
      public_key_path: join(generationPath, "public.pem"),
      boundary: buildBoundary(true),
    });
  } finally {
    await lease.release();
  }
}

// CP5 closure (P0.2b crash matrix 2026-07-29; docs/gtm/TASK029_PRE_CEREMONY_HALT.md).
//
// A rotation killed between `appendRetiredRegistry` and the active-pointer
// commit leaves the old fingerprint retired while the pointer still names it:
// nothing signs (loadActiveKeyPair -> retired_generation, loadGuardedActiveKey
// -> rotation_in_progress), and nothing can move. That is a LIVENESS defect,
// not an unsafe one, so the repair is a separate consented act rather than an
// automatic one — the rejected PR #414 auto-quarantine design stays extinct and
// the read-only inspection roots keep reporting instead of repairing.
//
// Recovery rolls FORWARD, never back: the new generation's bytes were archived
// and byte-verified BEFORE the retirement was written, so the target is already
// durable. It is re-verified here through `verifyPointerDoc` — the same contract
// `loadActiveKeyPair` enforces — before the pointer is allowed to move.
export async function resumeAuthorshipRotation({
  consent,
  demaHome,
  resumedAt,
} = {}) {
  const refuse = (error, detail) =>
    Object.freeze({
      schema: KEY_ROTATE_RESUME_SCHEMA,
      resumed: false,
      error,
      ...(detail ? { detail } : {}),
      ...(error === "consent_required"
        ? { required_phrase: KEY_ROTATE_RESUME_CONSENT_PHRASE }
        : {}),
      authority_delta: 0,
      boundary: buildBoundary(false),
    });

  if (consent !== KEY_ROTATE_RESUME_CONSENT_PHRASE) return refuse("consent_required");

  const paths = keyPaths(demaHome);
  const ap = activeKeyPaths(demaHome);
  const journalPath = join(paths.dir, "rotation-journal.json");
  const nowIso =
    typeof resumedAt === "string" && resumedAt
      ? resumedAt
      : new Date().toISOString();

  const journal = await readRotationJournalDoc(paths);
  const verdict = await classifyRotationResume(ap, journal);

  // Idempotency BEFORE any write: an exact re-run of a completed resume must
  // change no durable byte.
  if (verdict === "ALREADY_ACTIVE" || verdict === "NOT_INTERRUPTED") {
    const settled = await loadActiveKeyPair(demaHome);
    if (settled.ok && settled.fingerprint === journal.doc?.new_fingerprint) {
      // ISNAD-AUTHORITY-SUCCESSION-1A. "The pointer already moved" used to end
      // here, and that was the defect: a rotation killed between the authority
      // switch and its evidence left the transition authoritative and
      // unevidenced, and this branch reported it settled while writing nothing.
      //
      // The pointer moving is not the transition completing. If the predecessor
      // authorized a successor whose commit never landed, finalize it from
      // durable facts. Idempotent — a chain with no open intent finalizes
      // nothing and writes no byte, so an exact re-run still changes nothing.
      const succession = await finalizeAuthoritySuccession({ demaHome, resumedAt: nowIso, now: nowIso });
      if (succession.requires_human === true) {
        return refuse("succession_unfinalizable", succession.reason);
      }
      return Object.freeze({
        schema: KEY_ROTATE_RESUME_SCHEMA,
        resumed: true,
        already_resolved: true,
        succession_finalized: succession.finalized === true,
        succession_commit_receipt_id: succession.commit_receipt_id ?? null,
        active_fingerprint: settled.fingerprint,
        retired_fingerprint: journal.doc?.old_fingerprint ?? null,
        transaction_state: journal.state,
        boundary: buildBoundary(false),
      });
    }
    return refuse("no_interrupted_rotation", verdict);
  }
  if (verdict !== "RESUMABLE_FORWARD") return refuse("not_resumable", verdict);

  const oldFp = journal.doc.old_fingerprint;
  const newFp = journal.doc.new_fingerprint;

  // A rotation killed mid-transition leaves its lease behind on purpose: a dead
  // holder is preserved as `recovery_required` for operator adjudication. This
  // consented call IS that adjudication, so it may take the stale lease over —
  // but a LIVE holder still refuses, and the O_EXCL re-acquire keeps two
  // concurrent resumes from both proceeding.
  let lease = await acquireIdentityLease(ap);
  if (!lease.acquired && lease.reason === "recovery_required") {
    await unlink(ap.identityLease).catch(() => {});
    lease = await acquireIdentityLease(ap);
  }
  if (!lease.acquired) return refuse("identity_lease_unavailable", lease.reason);
  try {
    // Re-verify under the lease: the world may have changed since the
    // unsynchronized read above.
    if ((await classifyRotationResume(ap, journal)) !== "RESUMABLE_FORWARD") {
      return refuse("not_resumable", "state_changed_under_lease");
    }

    const targetDoc = {
      schema: ACTIVE_POINTER_SCHEMA,
      generation_fingerprint: newFp,
      generation_path: join(GENERATIONS_DIRNAME, newFp),
      activated_at: nowIso,
      previous_generation: oldFp,
    };
    const target = await verifyPointerDoc(
      ap,
      targetDoc,
      JSON.stringify(targetDoc),
    );
    if (!target.ok) return refuse("generation_unverifiable", target.error);

    await activateGeneration(ap, {
      fingerprint: newFp,
      now: nowIso,
      previous: oldFp,
    });

    const verified = await loadActiveKeyPair(demaHome);
    if (
      !verified.ok ||
      verified.fingerprint !== newFp ||
      !keypairMatches(verified.private_key_pem, verified.public_key_pem)
    ) {
      await writeRotationJournal(
        journalPath,
        "ACTIVE_RETIREMENT_PENDING",
        oldFp,
        newFp,
        nowIso,
      );
      return refuse(
        "post_activation_verify_failed",
        verified.ok ? "fingerprint_or_pair_mismatch" : verified.error,
      );
    }

    await writeRotationJournal(journalPath, "COMPLETE", oldFp, newFp, nowIso);

    // The pointer moved on THIS path too, so the same law applies: an authority
    // that changed must carry its evidence. Finalizes the commit half the
    // interrupted ceremony never reached, and refuses rather than inventing a
    // predecessor authorization that was never signed.
    const succession = await finalizeAuthoritySuccession({ demaHome, now: nowIso });
    if (succession.requires_human === true) {
      return refuse("succession_unfinalizable", succession.reason);
    }

    // ponytail: the resume seals its OWN receipt bound to the resume phrase. It
    // cannot honestly reproduce the interrupted ceremony's consent envelope —
    // that nonce is not persisted in the journal — so it records what it can
    // witness (which rotation it finished, and that a human authorized the
    // finish) rather than forging the original binding.
    const receipt = {
      schema: KEY_ROTATE_RECEIPT_SCHEMA,
      old_fingerprint: oldFp,
      new_fingerprint: newFp,
      generation_dir: target.generation_path,
      retired_at: journal.doc.at ?? null,
      resumed_at: nowIso,
      reason: "interrupted_rotation_resumed_forward",
      retired_registry_path: ap.retiredRegistry,
      journal_path: journalPath,
      completed_by: "resume",
      runtime_activation: "not_verified_no_runtime",
      revocation_state: "retired_local_denylisted",
      consent_binding: Object.freeze({
        strength: "resume_phrase_only",
        consent_phrase_sha256: sha256(consent),
        note: "completes an interrupted rotation; the original ceremony envelope is not replayable from the journal",
      }),
      private_key_material_included: false,
    };
    const receiptPath = await writeRotationReceipt(paths, newFp, receipt);

    return Object.freeze({
      schema: KEY_ROTATE_RESUME_SCHEMA,
      resumed: true,
      already_resolved: false,
      active_fingerprint: newFp,
      retired_fingerprint: oldFp,
      transaction_state: "COMPLETE",
      receipt_path: receiptPath,
      boundary: buildBoundary(true),
    });
  } finally {
    await lease.release();
  }
}

// Heavier mid-rotation / journal checks stay OFF the hot path (loadPrivateKey /
// loadPublicKey) so a leftover journal never DoS-blocks signing consumers.
/**
 * Read one archived generation's PUBLIC key by fingerprint.
 *
 * ISNAD-AUTHORITY-SUCCESSION-1A. The chain walk resolves a successor's key from
 * the intent body, so an external verifier needs no filesystem. This exists for
 * the LOCAL side only: the appender must resolve the authority that signed the
 * chain's first entry in order to walk forward from it.
 *
 * It returns the archived bytes and nothing else. It establishes no ancestry —
 * a generation existing on this disk is not evidence that it was ever the
 * legitimate authority, which is precisely what the succession links prove.
 * Returns null when absent or unreadable; callers must fail closed on null.
 */
export async function loadGenerationPublicKey(demaHome, fingerprint) {
  if (typeof fingerprint !== "string" || !/^[0-9a-f]{16,128}$/.test(fingerprint)) {
    return null;
  }
  try {
    const ap = activeKeyPaths(demaHome);
    const pem = await readExact(join(ap.generationsDir, fingerprint, "public.pem"));
    return isSpkiPublicKeyPem(pem) ? pem : null;
  } catch {
    return null;
  }
}

export async function loadGuardedActiveKey(demaHome) {
  const paths = keyPaths(demaHome);
  const journal = await readExactIfPresent(
    join(paths.dir, "rotation-journal.json"),
  );
  if (journal) {
    try {
      const j = JSON.parse(journal);
      if (j.state === "ACTIVATING" || j.state === "PREPARED") {
        return Object.freeze({
          blocked: true,
          reason: "rotation_in_progress",
        });
      }
    } catch {
      return Object.freeze({
        blocked: true,
        reason: "rotation_journal_corrupt",
      });
    }
  }
  const pair = await loadActiveKeyPair(demaHome);
  if (!pair.ok) {
    return Object.freeze({
      blocked: true,
      reason:
        pair.error === "no_active_pointer" ? "no_active_key" : pair.error,
    });
  }
  return Object.freeze({
    blocked: false,
    private_key_pem: pair.private_key_pem,
    public_key_pem: pair.public_key_pem,
    fingerprint: pair.fingerprint,
  });
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

// Finding #3 (ADR-047): presence is NOT verification. inspectActiveIdentity
// maps a home to exactly one explicit state; VERIFIED requires a successful
// loadActiveKeyPair(). Realm/status surfaces must derive "VERIFIED" from
// state === "VERIFIED", never from mere key-file presence.
export const IDENTITY_STATES = Object.freeze([
  "ABSENT",
  "PRESENT_UNVERIFIED",
  "VERIFIED",
  "BLOCKED_CORRUPT",
  "BLOCKED_RETIRED",
  "BLOCKED_POINTER_INVALID",
]);

const LOAD_ERROR_TO_STATE = Object.freeze({
  no_active_pointer: "PRESENT_UNVERIFIED", // legacy flat files may still exist
  malformed_pointer: "BLOCKED_POINTER_INVALID",
  pointer_escape: "BLOCKED_POINTER_INVALID",
  generation_missing: "BLOCKED_POINTER_INVALID",
  generation_unsafe: "BLOCKED_CORRUPT",
  metadata_corrupt: "BLOCKED_CORRUPT",
  content_hash_mismatch: "BLOCKED_CORRUPT",
  pair_mismatch: "BLOCKED_CORRUPT",
  unsupported_key_algorithm: "BLOCKED_CORRUPT",
  retired_generation: "BLOCKED_RETIRED",
  retired_registry_unreadable: "BLOCKED_RETIRED",
  load_failed: "BLOCKED_CORRUPT",
});

// The one operator instruction each identity state implies. PRESENT_UNVERIFIED
// (Finding #4) must route to migration, never to a re-init that will refuse.
const STATE_RECOMMENDED_ACTION = Object.freeze({
  ABSENT: "INITIALIZE_AUTHORSHIP_KEY",
  PRESENT_UNVERIFIED: "MIGRATE_AUTHORSHIP_KEY",
  VERIFIED: "NONE",
  BLOCKED_CORRUPT: "RECOVER_IDENTITY",
  BLOCKED_RETIRED: "ROTATE_OR_RECOVER_IDENTITY",
  BLOCKED_POINTER_INVALID: "RECOVER_IDENTITY",
});

export async function inspectActiveIdentity(demaHome) {
  const pair = await loadActiveKeyPair(demaHome);
  if (pair.ok) {
    return Object.freeze({
      state: "VERIFIED",
      fingerprint: pair.fingerprint,
      verified: true,
      recommended_action: STATE_RECOMMENDED_ACTION.VERIFIED,
    });
  }
  if (pair.error === "no_active_pointer") {
    // No generation store. Distinguish a pre-migration legacy home (present
    // but unverified) from a truly empty one.
    const paths = keyPaths(demaHome);
    const legacyPresent = await isSafeExistingKeyPath(paths, paths.privateKey);
    const state = legacyPresent ? "PRESENT_UNVERIFIED" : "ABSENT";
    return Object.freeze({
      state,
      fingerprint: null,
      verified: false,
      reason: legacyPresent ? "legacy_flat_files_unverified" : "no_active_identity",
      recommended_action: STATE_RECOMMENDED_ACTION[state],
    });
  }
  const state = LOAD_ERROR_TO_STATE[pair.error] ?? "BLOCKED_CORRUPT";
  return Object.freeze({
    state,
    fingerprint: null,
    verified: false,
    error: pair.error,
    recommended_action: STATE_RECOMMENDED_ACTION[state],
  });
}

// Presence, not servability: a corrupt or retired generation still counts as
// "a key exists" (callers then surface the precise load error), matching the
// legacy semantics where a present-but-corrupt PEM answered true. For a
// truthful VERIFIED/UNINITIALIZED display, use inspectActiveIdentity instead.
export async function hasAuthorshipKey(demaHome) {
  const ap = activeKeyPaths(demaHome);
  const pointerInfo = await lstatIfExists(ap.activePointer);
  if (pointerInfo && !pointerInfo.isSymbolicLink() && pointerInfo.isFile()) {
    return true;
  }
  const paths = keyPaths(demaHome);
  return isSafeExistingKeyPath(paths, paths.privateKey);
}

function keyAlreadyExistsResult(paths, extra = {}) {
  return Object.freeze({
    schema: KEY_INIT_SCHEMA,
    initialized: false,
    error: "key_already_exists",
    private_key_path: paths.privateKey,
    ...extra,
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
