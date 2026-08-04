// C4D — cross-process ownership and stale-worker fencing for one mission
// closure transaction.
//
// WHY THIS EXISTS
// The transaction journal is already compare-and-append safe: two workers
// racing to append the same sequence produce exactly one durable event. That
// protects HISTORY. It does not protect the WORLD. The mechanical effect in
// corridor-closure-gatherer.js crosses the effect boundary BEFORE the loser
// discovers it lost the append race, so both processes can rename the same
// path while the journal stays perfectly truthful about only one of them.
//
// Durable event arbitration is not actuator fencing. This module fences the
// actuator: one live local process owns one transaction, holds one fencing
// token, and every mutation re-reads that token from disk immediately before
// acting.
//
// SCOPE — LOCAL SINGLE-NODE ONLY. This proves nothing about cross-host
// ownership, distributed consensus, network leases, leader election,
// federation, or a hostile root. The target is concurrent Node processes on
// one Node0 Linux host.
//
// PRIOR ART REUSED, NOT REINVENTED
// packages/receipts/src/authorship-key-store.js already established, and
// shipped at CP5, the laws this module extends:
//   - liveness, never wall-clock, decides staleness (a paused owner keeps it);
//   - EPERM means alive-but-not-ours, ESRCH means dead;
//   - an unreadable holder is UNKNOWN, never assumed dead;
//   - the read-only inspector never creates, refreshes, or deletes.
// What that lease does NOT do, and this module must, is survive PID reuse: a
// bare process.kill(pid, 0) says "alive" for a recycled PID belonging to an
// unrelated process. Ownership here binds pid + process-start identity + boot
// identity, so a reused PID reads as a DEAD predecessor rather than a live one.

import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readdir, readFile, link, unlink } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";

export const MISSION_CLOSURE_OWNERSHIP_SCHEMA =
  "bizra.dema.mission_closure_ownership_claim.v1";
export const MISSION_CLOSURE_OWNERSHIP_DOMAIN =
  "BIZRA:MISSION_CLOSURE_OWNERSHIP:v1";

export const CLAIM_KIND_ACQUIRE = "ACQUIRE";
export const CLAIM_KIND_TAKEOVER = "DEAD_OWNER_TAKEOVER";
export const CLAIM_KINDS = Object.freeze([CLAIM_KIND_ACQUIRE, CLAIM_KIND_TAKEOVER]);

export const OWNERSHIP_ACQUIRED = "ACQUIRED";
export const OWNERSHIP_HELD = "OWNERSHIP_HELD";
export const OWNERSHIP_STATUS_UNVERIFIABLE = "OWNERSHIP_STATUS_UNVERIFIABLE";
export const STALE_OWNER_FENCED = "STALE_OWNER_FENCED";
export const TRANSACTION_HASH_MISMATCH = "TRANSACTION_HASH_MISMATCH";

// The exact closed key set. A claim carrying any other key is refused — this is
// what keeps raw command lines, environment, secrets, stack traces, operator
// paths, and signing material structurally out of ownership evidence.
const CLAIM_KEYS = Object.freeze([
  "schema",
  "domain",
  "transaction_id",
  "transaction_hash",
  "owner_instance_id",
  "pid",
  "process_start_identity",
  "boot_identity_hash",
  "acquired_at_iso",
  "predecessor_claim_hash",
  "claim_kind",
  "claim_hash",
]);

const OWNERSHIP_RELDIR = join("transactions", "mission-closure");
const GEN_PREFIX = "current.gen";

function resolveHome(demaHome) {
  return demaHome ?? process.env.DEMA_HOME ?? join(homedir(), ".dema");
}

function ownershipDir(demaHome, transactionId) {
  return join(resolveHome(demaHome), OWNERSHIP_RELDIR, transactionId, "ownership");
}

function claimsDir(demaHome, transactionId) {
  return join(ownershipDir(demaHome, transactionId), "claims");
}

// ── process identity ───────────────────────────────────────────────────────
// Injectable so unit tests are deterministic and never depend on the machine's
// real /proc. The real probe is the default.

/**
 * Read this host's boot identity, hashed before it is ever persisted. A raw
 * boot_id is a stable machine correlator; the hash carries the same
 * discriminating power for our comparison without publishing the identifier.
 * @returns {string|null} null when it cannot be established — never a guess.
 */
export async function readBootIdentityHash() {
  try {
    const raw = await readFile("/proc/sys/kernel/random/boot_id", "utf8");
    const trimmed = raw.trim();
    if (!trimmed) return null;
    return "sha256:" + createHash("sha256").update(trimmed).digest("hex");
  } catch {
    return null;
  }
}

/**
 * Field 22 of /proc/<pid>/stat — the process start time in clock ticks since
 * boot. Together with pid and boot identity it names one OS process birth, so a
 * recycled pid cannot impersonate the original owner.
 *
 * Field 2 (comm) is wrapped in parentheses and may itself contain spaces AND
 * parentheses, so the only correct split is at the LAST ')'. After it, token
 * index i is field i+3, hence starttime (field 22) is index 19.
 * @returns {string|null} null when unreadable or malformed — fail closed.
 */
export async function readProcessStartIdentity(pid) {
  const stat = await readProcessStat(pid);
  return stat === null ? null : stat.starttime;
}

/**
 * Both fields we need from /proc/<pid>/stat, parsed once.
 *
 * `state` matters as much as `starttime`. A process killed with SIGKILL stays
 * in the table as a ZOMBIE until its parent reaps it — /proc/<pid>/stat still
 * exists, and its start time is unchanged, so a liveness check that reads only
 * those two would call a killed owner ALIVE and refuse the recovery that is
 * supposed to succeed. Whether that window is observed depends on how quickly
 * the parent waits, which is exactly the shape of an intermittent failure.
 * @returns {{state:string, starttime:string}|null} null when unreadable — fail closed.
 */
async function readProcessStat(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  let raw;
  try {
    raw = await readFile(`/proc/${pid}/stat`, "utf8");
  } catch {
    return null;
  }
  const close = raw.lastIndexOf(")");
  if (close < 0) return null;
  const rest = raw.slice(close + 1).trim();
  if (!rest) return null;
  const fields = rest.split(/\s+/);
  const state = fields[0];
  const starttime = fields[19];
  if (!state || starttime === undefined || !/^\d+$/.test(starttime)) return null;
  return { state, starttime };
}

/** 'Z' is a reaped-pending corpse, 'X'/'x' a dead one. Neither can hold ownership. */
const DEAD_PROCESS_STATES = Object.freeze(["Z", "X", "x"]);

/**
 * The default, real probe. Returns null if identity cannot be established, so
 * callers fail closed rather than treating an unreadable process as dead.
 */
export async function probeProcessIdentity(pid = process.pid) {
  const [stat, bootHash] = await Promise.all([readProcessStat(pid), readBootIdentityHash()]);
  if (stat === null || bootHash === null) return null;
  // process_state is carried for the liveness decision only. buildClaim picks
  // the 12 claim keys explicitly, so it can never reach persisted evidence.
  return {
    pid,
    process_start_identity: stat.starttime,
    boot_identity_hash: bootHash,
    process_state: stat.state,
  };
}

/**
 * Is the claimed owner still THE SAME live process?
 *   "ALIVE"        — same pid, same start identity, same boot
 *   "DEAD"         — pid gone, or pid reused (start identity differs), or reboot
 *   "UNVERIFIABLE" — identity could not be read; never treated as dead
 */
export async function classifyOwnerLiveness(claim, probe) {
  const current = await probe(claim.pid);
  if (current === null) {
    // A pid that is genuinely gone reads as "no such process". Distinguish that
    // from a probe that could not answer: only the former is provably dead.
    if (!(await pidExists(claim.pid))) return "DEAD";
    return "UNVERIFIABLE";
  }
  if (current.boot_identity_hash !== claim.boot_identity_hash) return "DEAD";
  if (current.process_start_identity !== claim.process_start_identity) return "DEAD";
  // A SIGKILLed owner lingers as a zombie until its parent reaps it. It cannot
  // act on the world, so it must not hold the world's lock.
  if (DEAD_PROCESS_STATES.includes(current.process_state)) return "DEAD";
  return "ALIVE";
}

/** EPERM = exists but not ours (alive); ESRCH = no such process (dead). */
async function pidExists(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e?.code === "EPERM";
  }
}

// ── claim shape ────────────────────────────────────────────────────────────

function hasExactKeys(obj, keys) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  const actual = Object.keys(obj);
  if (actual.length !== keys.length) return false;
  return keys.every((k) => Object.prototype.hasOwnProperty.call(obj, k));
}

function isPrimitive(v) {
  return v === null || ["string", "number", "boolean"].includes(typeof v);
}

/**
 * Re-derive the claim hash from the claim's OWN fields. A verifier that trusted
 * the stored claim_hash would authenticate a forgery; the hash must be recomputed
 * over the body with claim_hash excluded.
 */
export function deriveClaimHash(claim) {
  const body = {};
  for (const k of CLAIM_KEYS) {
    if (k === "claim_hash") continue;
    body[k] = claim[k];
  }
  return sha256CanonicalJsonV1(body);
}

/** @returns {{valid:true}|{valid:false, reason:string}} */
export function validateClaimShape(claim) {
  if (!hasExactKeys(claim, CLAIM_KEYS)) return { valid: false, reason: "claim_key_set_invalid" };
  for (const k of CLAIM_KEYS) {
    if (!isPrimitive(claim[k])) return { valid: false, reason: `claim_field_not_primitive:${k}` };
  }
  if (claim.schema !== MISSION_CLOSURE_OWNERSHIP_SCHEMA) {
    return { valid: false, reason: "claim_schema_invalid" };
  }
  if (claim.domain !== MISSION_CLOSURE_OWNERSHIP_DOMAIN) {
    return { valid: false, reason: "claim_domain_invalid" };
  }
  if (!CLAIM_KINDS.includes(claim.claim_kind)) {
    return { valid: false, reason: "claim_kind_invalid" };
  }
  if (claim.claim_kind === CLAIM_KIND_ACQUIRE && claim.predecessor_claim_hash !== null) {
    return { valid: false, reason: "acquire_must_not_have_predecessor" };
  }
  if (
    claim.claim_kind === CLAIM_KIND_TAKEOVER &&
    typeof claim.predecessor_claim_hash !== "string"
  ) {
    return { valid: false, reason: "takeover_requires_predecessor" };
  }
  if (!Number.isInteger(claim.pid) || claim.pid <= 0) {
    return { valid: false, reason: "claim_pid_invalid" };
  }
  if (typeof claim.owner_instance_id !== "string" || !claim.owner_instance_id) {
    return { valid: false, reason: "claim_owner_instance_invalid" };
  }
  if (deriveClaimHash(claim) !== claim.claim_hash) {
    return { valid: false, reason: "claim_hash_mismatch" };
  }
  return { valid: true };
}

function buildClaim({
  transactionId,
  transactionHash,
  identity,
  nowIso,
  claimKind,
  predecessorClaimHash,
}) {
  const body = {
    schema: MISSION_CLOSURE_OWNERSHIP_SCHEMA,
    domain: MISSION_CLOSURE_OWNERSHIP_DOMAIN,
    transaction_id: transactionId,
    transaction_hash: transactionHash,
    owner_instance_id: randomUUID(),
    pid: identity.pid,
    process_start_identity: identity.process_start_identity,
    boot_identity_hash: identity.boot_identity_hash,
    acquired_at_iso: nowIso,
    predecessor_claim_hash: predecessorClaimHash,
    claim_kind: claimKind,
  };
  return Object.freeze({ ...body, claim_hash: sha256CanonicalJsonV1(body) });
}

// ── durable publication (same law as the transaction journal) ──────────────
// Private temp → fsync → hard-link → directory fsync. link() fails if the path
// exists, which is what makes exactly one racer win. No rename, no truncate, no
// last-writer-wins.

async function fsyncPath(path) {
  const fh = await open(path, "r");
  try {
    await fh.sync();
  } finally {
    await fh.close();
  }
}

const DEFAULT_OWNERSHIP_OPS = Object.freeze({
  linkFile: link,
  unlinkTemp: unlink,
  fsyncDir: fsyncPath,
});

async function publishNoReplace(dir, finalPath, bytes, ops) {
  const temp = join(dir, `.tmp-${randomUUID()}`);
  try {
    const fh = await open(temp, "wx", 0o600);
    try {
      await fh.writeFile(bytes);
      await fh.sync();
    } finally {
      await fh.close();
    }
  } catch (err) {
    return { published: false, reason: `ownership_temp_write_failed:${err?.code ?? "unknown"}` };
  }
  try {
    await ops.linkFile(temp, finalPath);
    await ops.fsyncDir(dir).catch(() => {});
    return { published: true };
  } catch (err) {
    if (err?.code === "EEXIST") return { published: false, reason: "already_published" };
    return { published: false, reason: `ownership_publish_failed:${err?.code ?? "unknown"}` };
  } finally {
    await ops.unlinkTemp(temp).catch(() => {});
  }
}

// ── generation pointer ─────────────────────────────────────────────────────
// The current owner is the highest generation present. Takeover from generation
// N publishes current.gen<N+1> with no-replace semantics, so exactly one of any
// number of competing takers wins and every loser reads the winner. Nothing is
// ever overwritten or deleted, so the ownership history stays immutable.

async function readGenerations(dir) {
  let entries;
  try {
    entries = await readdir(dir);
  } catch (err) {
    if (err?.code === "ENOENT") return [];
    throw err;
  }
  return entries
    .filter((n) => n.startsWith(GEN_PREFIX))
    .map((n) => Number.parseInt(n.slice(GEN_PREFIX.length), 10))
    .filter((n) => Number.isInteger(n) && n >= 0)
    .sort((a, b) => a - b);
}

async function readClaimAtGeneration(dir, gen) {
  let raw;
  try {
    raw = await readFile(join(dir, `${GEN_PREFIX}${gen}`), "utf8");
  } catch {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Read-only. Never creates, refreshes, or deletes — the CP5 inspector law.
 * @returns {{state:"NONE"}|{state:"UNREADABLE"}|{state:"PRESENT", claim, generation}}
 */
export async function inspectClosureOwnership({ demaHome, transactionId } = {}) {
  const dir = ownershipDir(demaHome, transactionId);
  const gens = await readGenerations(dir);
  if (gens.length === 0) return { state: "NONE" };
  const gen = gens[gens.length - 1];
  const claim = await readClaimAtGeneration(dir, gen);
  if (claim === null) return { state: "UNREADABLE" };
  const shape = validateClaimShape(claim);
  if (!shape.valid) return { state: "UNREADABLE", reason: shape.reason };
  return { state: "PRESENT", claim, generation: gen };
}

/**
 * Acquire ownership of one transaction, or report who holds it.
 *
 * Elapsed time never revokes a live owner: a paused-but-living process keeps
 * ownership, because otherwise it could wake after a second worker took over and
 * both would touch the world.
 */
export async function acquireClosureOwnership({
  demaHome,
  transactionId,
  transactionHash,
  identityProbe = probeProcessIdentity,
  nowIso = null,
  ops = DEFAULT_OWNERSHIP_OPS,
} = {}) {
  if (typeof transactionId !== "string" || !transactionId) {
    return { status: OWNERSHIP_STATUS_UNVERIFIABLE, reason: "transaction_id_missing", requires_human: true };
  }
  const dir = ownershipDir(demaHome, transactionId);
  await mkdir(claimsDir(demaHome, transactionId), { recursive: true });

  const identity = await identityProbe(process.pid);
  if (identity === null) {
    return {
      status: OWNERSHIP_STATUS_UNVERIFIABLE,
      reason: "self_process_identity_unreadable",
      requires_human: true,
      mutation_performed: false,
    };
  }
  const at = nowIso ?? new Date().toISOString();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const gens = await readGenerations(dir);
    const gen = gens.length ? gens[gens.length - 1] : -1;

    if (gen < 0) {
      const claim = buildClaim({
        transactionId,
        transactionHash,
        identity,
        nowIso: at,
        claimKind: CLAIM_KIND_ACQUIRE,
        predecessorClaimHash: null,
      });
      const done = await writeClaim(dir, demaHome, transactionId, 0, claim, ops);
      if (done) return { status: OWNERSHIP_ACQUIRED, claim, fencing_token: claim.claim_hash, generation: 0 };
      continue; // lost the race for generation 0 — re-read and classify
    }

    const held = await readClaimAtGeneration(dir, gen);
    if (held === null) {
      return { status: OWNERSHIP_STATUS_UNVERIFIABLE, reason: "current_owner_unreadable", requires_human: true, mutation_performed: false };
    }
    const shape = validateClaimShape(held);
    if (!shape.valid) {
      return { status: OWNERSHIP_STATUS_UNVERIFIABLE, reason: shape.reason, requires_human: true, mutation_performed: false };
    }
    if (held.transaction_id !== transactionId || held.transaction_hash !== transactionHash) {
      return { status: OWNERSHIP_STATUS_UNVERIFIABLE, reason: "claim_transaction_mismatch", requires_human: true, mutation_performed: false };
    }

    // Idempotent recovery: this very process already owns it.
    if (
      held.pid === identity.pid &&
      held.process_start_identity === identity.process_start_identity &&
      held.boot_identity_hash === identity.boot_identity_hash
    ) {
      return { status: OWNERSHIP_ACQUIRED, claim: held, fencing_token: held.claim_hash, generation: gen, recovered: true };
    }

    const liveness = await classifyOwnerLiveness(held, identityProbe);
    if (liveness === "ALIVE") {
      return { status: OWNERSHIP_HELD, current_owner_claim_hash: held.claim_hash, generation: gen, mutation_performed: false };
    }
    if (liveness === "UNVERIFIABLE") {
      return { status: OWNERSHIP_STATUS_UNVERIFIABLE, reason: "owner_liveness_unverifiable", requires_human: true, mutation_performed: false };
    }

    const claim = buildClaim({
      transactionId,
      transactionHash,
      identity,
      nowIso: at,
      claimKind: CLAIM_KIND_TAKEOVER,
      predecessorClaimHash: held.claim_hash,
    });
    const done = await writeClaim(dir, demaHome, transactionId, gen + 1, claim, ops);
    if (done) {
      return { status: OWNERSHIP_ACQUIRED, claim, fencing_token: claim.claim_hash, generation: gen + 1, took_over_from: held.claim_hash };
    }
    // Another taker won this generation — loop, re-read, and report the winner.
  }
  return { status: OWNERSHIP_STATUS_UNVERIFIABLE, reason: "ownership_contention_unresolved", requires_human: true, mutation_performed: false };
}

async function writeClaim(dir, demaHome, transactionId, gen, claim, ops) {
  const bytes = JSON.stringify(claim, null, 2);
  // Immutable evidence first, so a claim is always recoverable even if the
  // pointer publication is the half that loses the race.
  await publishNoReplace(claimsDir(demaHome, transactionId), join(claimsDir(demaHome, transactionId), `${claim.claim_hash.replace(/^sha256:/, "")}.json`), bytes, ops);
  const res = await publishNoReplace(dir, join(dir, `${GEN_PREFIX}${gen}`), bytes, ops);
  return res.published === true;
}

/**
 * THE FENCE. Every world-changing operation calls this immediately before
 * acting, and it re-reads the current owner FROM DISK — a token checked against
 * cached state proves nothing about the present.
 */
export async function validateFencingToken({
  demaHome, transactionId, fencingToken, expectedTransactionHash = null,
} = {}) {
  const current = await inspectClosureOwnership({ demaHome, transactionId });
  if (current.state === "NONE") {
    return { valid: false, status: STALE_OWNER_FENCED, reason: "no_current_owner", mutation_performed: false, event_appended: false, effect_retry_forbidden: true, requires_human: true };
  }
  if (current.state === "UNREADABLE") {
    return { valid: false, status: OWNERSHIP_STATUS_UNVERIFIABLE, reason: current.reason ?? "current_owner_unreadable", mutation_performed: false, event_appended: false, effect_retry_forbidden: true, requires_human: true };
  }
  if (current.claim.claim_hash !== fencingToken) {
    return {
      valid: false,
      status: STALE_OWNER_FENCED,
      mutation_performed: false,
      event_appended: false,
      effect_retry_forbidden: true,
      // A valid newer owner exists, so this is ordinary arbitration, not an
      // operator incident. The stale worker may OBSERVE the winner; it may never
      // replace, release, or write under it.
      requires_human: false,
      current_owner_claim_hash: current.claim.claim_hash,
    };
  }
  // The token matches the current owner — but an owner is only authoritative for
  // the exact C2 descriptor it claimed. A validly-hashed claim bound to a
  // different descriptor must never authorize this transaction's mutations.
  //
  // ponytail: defence in depth, and measured as such. acquireClosureOwnership
  // rejects a descriptor mismatch BEFORE it will hand out a token, so in the
  // current production route this branch is unreachable and a mutation removing
  // it does not turn the suite red (matrix entry B2). It stays because the
  // module is exported and the fence is the last checkpoint before a world
  // mutation — a future caller that acquires by a different path would land
  // here. C4D-BIND-06 exercises it directly. Delete only if ownership
  // acquisition ever becomes the single provable entry point.
  if (expectedTransactionHash !== null && current.claim.transaction_hash !== expectedTransactionHash) {
    return {
      valid: false,
      status: TRANSACTION_HASH_MISMATCH,
      reason: "claim_bound_to_different_descriptor",
      mutation_performed: false,
      event_appended: false,
      effect_retry_forbidden: true,
      requires_human: true,
    };
  }
  return { valid: true, claim: current.claim, generation: current.generation };
}

/** Only the exact current owner may release. A stale owner cannot release a newer claim. */
export async function releaseClosureOwnership({ demaHome, transactionId, fencingToken } = {}) {
  const fence = await validateFencingToken({ demaHome, transactionId, fencingToken });
  if (!fence.valid) return { released: false, ...fence };
  // Ownership evidence is immutable: release marks, never erases. The claims
  // directory and every generation pointer stay on disk as history.
  const dir = ownershipDir(demaHome, transactionId);
  const marker = join(dir, `released.gen${fence.generation}`);
  const res = await publishNoReplace(dir, marker, JSON.stringify({ claim_hash: fencingToken }), DEFAULT_OWNERSHIP_OPS);
  return { released: res.published === true || res.reason === "already_published", generation: fence.generation };
}

export const _internal = Object.freeze({
  CLAIM_KEYS,
  ownershipDir,
  claimsDir,
  buildClaim,
  readGenerations,
  publishNoReplace,
  pidExists,
});
