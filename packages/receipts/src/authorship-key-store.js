import { constants } from "node:fs";
import { mkdir, lstat, realpath, open, rename, unlink, readdir } from "node:fs/promises";
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
const TRANSACTIONS_DIRNAME = "transactions";
const IDENTITY_LEASE_FILENAME = "identity-transition.lock";
const REQUIRED_KEY_ALGORITHM = "ed25519";
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

// Finding #2 (review P1): pair consistency alone is not identity — an RSA or
// P-256 pair is internally consistent yet unusable on the Ed25519 signing
// path. Require BOTH keys to be Ed25519 before any authority write. Returns
// { ok, fingerprint } | { ok:false, error:"unsupported_key_algorithm" } |
// { ok:false } (mismatched pair).
function pairConsistency(privateKeyPem, publicKeyPem) {
  try {
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

// ── Committed-transition recovery (IDENTITY-COMMITTED-TRANSITION-RECOVERY-1D) ──
// After a committed transition fails canonical verification, the pointer is
// left on disk. Without recovery, the next init sees a pointer and returns
// key_already_exists FOREVER over an identity the loader rejects — a root-of-
// trust availability strand. classifyActivePointer decides how a present-but-
// unusable pointer may be recovered; genesis strands (no prior identity) are
// quarantinable, everything else fails closed to explicit human recovery.
//
// States: "valid" | "absent" | "genesis_invalid" | "prior_invalid" |
// "untracked_invalid".
async function classifyActivePointer(demaHome) {
  const ap = activeKeyPaths(demaHome);
  const info = await lstatIfExists(ap.activePointer);
  if (!info || info.isSymbolicLink() || !info.isFile()) {
    // A symlink/non-regular pointer is never a trustworthy record.
    return { state: info ? "untracked_invalid" : "absent" };
  }
  const load = await loadActiveKeyPair(demaHome);
  if (load.ok) return { state: "valid", fingerprint: load.fingerprint };

  // Present but the canonical loader rejects it. Read the pointer's own record
  // to decide recoverability. A genesis pointer (previous_generation === null)
  // means no prior verified identity is at risk — safe to quarantine.
  const pointer = await readActivePointer(ap);
  if (pointer.error) return { state: "untracked_invalid", loader_error: load.error };
  if (pointer.doc.previous_generation === null) {
    return {
      state: "genesis_invalid",
      raw: pointer.raw,
      fingerprint: pointer.doc.generation_fingerprint,
      loader_error: load.error,
    };
  }
  return { state: "prior_invalid", loader_error: load.error };
}

// P1-1 (Greptile): an established identity that was actually USED (its
// fingerprint bound into ANY signed artifact) must never be silently replaced
// by recovery — that would orphan those artifacts under the old fingerprint.
// Artifacts live under $DEMA_HOME/receipts in several shapes: authorship-*.json,
// verdict-*.json, canonical-ledger.ndjson, and future kinds. So scan EVERY
// regular file under receipts for the fingerprint, not just authorship-*
// (re-review finding: canonical-ledger/verdict artifacts escaped the narrow
// filter). Any read hazard is treated as bound (fail closed).
async function anyReceiptBindsFingerprint(demaHome, fingerprint) {
  if (!fingerprint) return true; // unknown fingerprint → cannot prove unused
  const home =
    typeof demaHome === "string" && demaHome.length > 0
      ? demaHome
      : process.env.DEMA_HOME || join(homedir(), ".dema");
  const receiptsDir = join(home, "receipts");
  const dirInfo = await lstatIfExists(receiptsDir);
  if (!dirInfo) return false; // no receipts dir → nothing was ever signed
  if (dirInfo.isSymbolicLink() || !dirInfo.isDirectory()) return true; // hazard
  let entries;
  try {
    entries = await readdir(receiptsDir, { withFileTypes: true });
  } catch {
    return true; // unreadable → fail closed
  }
  for (const entry of entries) {
    // A subdirectory of receipts could hold artifacts too — cannot prove
    // unused without descending, so fail closed on any non-file entry.
    if (!entry.isFile()) return true;
    const raw = await readFileNoFollow(join(receiptsDir, entry.name));
    if (raw === null) return true; // present-but-unreadable → fail closed
    // The fingerprint appearing anywhere in a signed artifact means the
    // identity was used — authorship/verdict/canonical-ledger alike.
    if (raw.includes(fingerprint)) return true;
  }
  return false;
}

// P1-2 + 628 (Greptile): quarantine the pointer to a SIBLING file directly in
// the keys dir — NOT a `keys/transactions` subdir. A separate subdir is a
// substitution vector: another process can swap it for a symlink between a
// realpath check and the rename, moving the pointer outside DEMA_HOME (a
// check-then-rename TOCTOU). With source (`active-key.json`) and destination
// (`quarantine-active-key-<hash>.json`) sharing the SAME parent, a single
// kernel path resolution moves the pointer to a fixed sibling — no traversable
// intermediate dir to substitute, and no differential escape. keysDir must be
// a real (non-symlink) directory. Returns { ok, dest } | { ok:false, reason }.
// The failed generation dir is left in place (also evidence).
async function quarantineActivePointer(demaHome, raw) {
  const ap = activeKeyPaths(demaHome);
  const info = await lstatIfExists(ap.dir);
  if (!info || info.isSymbolicLink() || !info.isDirectory()) {
    return { ok: false, reason: "unsafe_quarantine_dir" };
  }
  const stamp = sha256(raw ?? "").slice(0, 16);
  const dest = join(ap.dir, `quarantine-active-key-${stamp}.json`);
  try {
    await rename(ap.activePointer, dest);
  } catch {
    // e.g. EXDEV cross-device rename — recovery incomplete; do not claim it.
    return { ok: false, reason: "quarantine_move_failed" };
  }
  return { ok: true, dest };
}

// Shared genesis-strand recovery decision for init AND migrate. Only an UNUSED
// genesis identity (no bound receipts) whose pointer can be safely quarantined
// is auto-recovered; anything else fails closed for human adjudication.
// Returns { recovered:true, quarantine_path } | { recovered:false, reason }.
async function attemptGenesisRecovery(demaHome, cls) {
  if (await anyReceiptBindsFingerprint(demaHome, cls.fingerprint)) {
    return { recovered: false, reason: "established_identity_recovery_required" };
  }
  const q = await quarantineActivePointer(demaHome, cls.raw);
  if (!q.ok) return { recovered: false, reason: q.reason };
  return { recovered: true, quarantine_path: q.dest };
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

  // Read the legacy pair up front (read-only, no mutation) and verify it is a
  // usable Ed25519 pair BEFORE taking the lease.
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

  // Finding #1 + re-review New-2: acquire the exclusive lease FIRST, then
  // classify/recover the active pointer UNDER it. Doing the pointer recovery
  // pre-lease let a concurrent init establish an identity in the gap that
  // migrate would then overwrite. All pointer mutation is now single-owner.
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
    // P1-3: an existing pointer is not a blanket "already_migrated" — classify
    // under the lease. valid → done; genesis-invalid → quarantine (if unused +
    // safe) and re-migrate from the still-present legacy pair; else fail closed.
    const preCls = await classifyActivePointer(demaHome);
    if (preCls.state === "valid") {
      return Object.freeze({
        schema: KEY_MIGRATE_SCHEMA,
        migrated: false,
        error: "already_migrated",
        verified_existing_identity: true,
        boundary: buildBoundary(false),
      });
    }
    if (preCls.state === "prior_invalid" || preCls.state === "untracked_invalid") {
      return Object.freeze({
        schema: KEY_MIGRATE_SCHEMA,
        migrated: false,
        error: "recovery_required",
        reason:
          preCls.state === "prior_invalid"
            ? "prior_identity_recovery_required"
            : "untracked_invalid_active_pointer",
        loader_error: preCls.loader_error,
        boundary: buildBoundary(false),
      });
    }
    if (preCls.state === "genesis_invalid") {
      const rec = await attemptGenesisRecovery(demaHome, preCls);
      if (!rec.recovered) {
        return Object.freeze({
          schema: KEY_MIGRATE_SCHEMA,
          migrated: false,
          error: "recovery_required",
          reason: rec.reason,
          loader_error: preCls.loader_error,
          boundary: buildBoundary(false),
        });
      }
    }

    await mkdir(ap.generationsDir, { recursive: true });
    const expected = {
      public_key_fingerprint: pair.fingerprint,
      private_key_pem: privateKeyPem,
      public_key_pem: publicKeyPem,
    };
    const cls = await classifyGeneration(ap, pair.fingerprint, expected);
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
      public_key_fingerprint: pair.fingerprint,
      private_key_pem: privateKeyPem,
      public_key_pem: publicKeyPem,
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
      fingerprint: pair.fingerprint,
      now,
      previous: null,
    });

    // Finding B (1C): a transition is complete only when the canonical
    // post-transition loader ACCEPTS the result. Verify before claiming
    // success — presence of files is not convergence.
    const verified = await loadActiveKeyPair(demaHome);
    if (
      !verified.ok ||
      verified.fingerprint !== pair.fingerprint ||
      verified.generation_path !== generationPath
    ) {
      // P1-3: quarantine the just-committed pointer so a retry (migrate, which
      // re-reads the still-present legacy pair) can recover instead of stranding
      // behind a committed-but-unusable pointer. This generation is fresh (no
      // receipt binds it yet), so quarantine is safe.
      const pointerRaw = await readFileNoFollow(ap.activePointer);
      const q = pointerRaw !== null
        ? await quarantineActivePointer(demaHome, pointerRaw)
        : { ok: false };
      return Object.freeze({
        schema: KEY_MIGRATE_SCHEMA,
        migrated: false,
        error: "recovery_required",
        transition_state: "pointer_committed_verification_failed",
        recovered_from: q.ok ? "genesis_pointer_quarantined" : null,
        quarantine_path: q.ok ? q.dest : null,
        generation_path: generationPath,
        loader_error: verified.ok ? "fingerprint_or_path_mismatch" : verified.error,
        boundary: buildBoundary(true),
      });
    }

    return Object.freeze({
      schema: KEY_MIGRATE_SCHEMA,
      migrated: true,
      fingerprint: pair.fingerprint,
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
  const unsafePath = await prepareKeyDirectory(paths);
  if (unsafePath) return unsafeKeyPathResult(unsafePath);

  // Finding #2 (ADR-047): initialization may ESTABLISH the first active
  // generation; it must never REPLACE an existing one. `force` bypasses only
  // the legacy flat-file existence check — an active pointer is the root of
  // trust and can be changed ONLY by a governed rotation transaction
  // (AUTHORSHIP-ROTATION-TRANSACTION-1B), never by re-init. This first check
  // is an early-out; the authoritative one runs UNDER the lease below.
  // 1D: an existing pointer is no longer a blanket key_already_exists. Classify
  // it — a VALID pointer is an existing identity (refuse, read-only); an
  // INVALID one must route to recovery, never strand. The early check is
  // read-only; any mutation (quarantine) happens under the lease below.
  const early = await classifyActivePointer(demaHome);
  if (early.state === "valid") {
    return keyAlreadyExistsResult(paths, { verified_existing_identity: true });
  }
  if (early.state === "absent" && !force && (await existingKeyPath(paths))) {
    return keyAlreadyExistsResult(paths);
  }

  // Finding #1: acquire the exclusive transition lease, then RE-CLASSIFY the
  // pointer under it — closes the check-then-act race, and any recovery
  // mutation is single-owner. The loser mutates nothing.
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
    const cls = await classifyActivePointer(demaHome);
    if (cls.state === "valid") {
      return keyAlreadyExistsResult(paths, { verified_existing_identity: true });
    }
    if (cls.state === "genesis_invalid") {
      // Safe automatic recovery ONLY for an UNUSED genesis identity (P1-1): if
      // any receipt binds its fingerprint, it is an established identity and
      // must NOT be silently replaced — fail closed for adjudication.
      const rec = await attemptGenesisRecovery(demaHome, cls);
      if (!rec.recovered) {
        return Object.freeze({
          schema: KEY_INIT_SCHEMA,
          initialized: false,
          error: "recovery_required",
          reason: rec.reason,
          loader_error: cls.loader_error,
          boundary: buildBoundary(false),
        });
      }
      return Object.freeze({
        schema: KEY_INIT_SCHEMA,
        initialized: false,
        error: "recovery_required",
        transition_state: "recovered_to_no_active_identity",
        recovered_from: "genesis_pointer_quarantined",
        quarantine_path: rec.quarantine_path,
        loader_error: cls.loader_error,
        boundary: buildBoundary(true),
      });
    }
    if (cls.state === "prior_invalid" || cls.state === "untracked_invalid") {
      // A prior identity or an unreadable pointer record — do NOT auto-quarantine
      // (a verified prior identity may be recoverable only from its recorded
      // pointer). Fail closed, preserve all evidence, require adjudication.
      return Object.freeze({
        schema: KEY_INIT_SCHEMA,
        initialized: false,
        error: "recovery_required",
        reason:
          cls.state === "prior_invalid"
            ? "prior_identity_recovery_required"
            : "untracked_invalid_active_pointer",
        loader_error: cls.loader_error,
        boundary: buildBoundary(false),
      });
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
    // 1D: if that verification fails, the just-committed genesis pointer would
    // otherwise strand every retry — quarantine it immediately so recovery is
    // automatic (this init was genesis, previous:null, so nothing is at risk).
    const verified = await loadActiveKeyPair(demaHome);
    if (
      !verified.ok ||
      verified.fingerprint !== keys.public_key_fingerprint ||
      verified.generation_path !== generationPath
    ) {
      // The generation we just wrote is fresh (never used) so quarantining its
      // pointer is always safe here — no receipt can bind it yet.
      const pointerRaw = await readFileNoFollow(ap.activePointer);
      const q = pointerRaw !== null
        ? await quarantineActivePointer(demaHome, pointerRaw)
        : { ok: false };
      return Object.freeze({
        schema: KEY_INIT_SCHEMA,
        initialized: false,
        error: "recovery_required",
        transition_state: "pointer_committed_verification_failed",
        recovered_from: q.ok ? "genesis_pointer_quarantined" : null,
        quarantine_path: q.ok ? q.dest : null,
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
