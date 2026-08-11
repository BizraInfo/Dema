// NODE0-MINIMUM-SEASON-SAVE-RESUME-1A — the disk half of the season-state slice.
//
// The pure kernel (packages/core/src/node0-minimum-season-save-resume.js) owns
// every shape and hash. This module owns BYTES: publication, fsync, the
// concurrency fence and HEAD replacement. It re-derives nothing on its own — it
// asks the kernel and refuses whatever the kernel will not bless.
//
// ── WHY A SEQUENCE FENCE AND NOT A LOCK ──
// C4D already settled how this repo fences concurrent writers: publish to a
// content-or-position-addressed path with no-replace semantics and let the
// filesystem pick the winner (packages/receipts/src/mission-closure-transaction.js:25-33).
// A second ownership framework here would rebuild, one layer up, the two-authority
// defect that slice removed. So `seq/<NNNNNN>.json` IS the authority for "who owns
// sequence N": link() fails with EEXIST for the loser, and HEAD.json is a pointer
// published only by the writer that already won the fence. HEAD is therefore a
// cache of a decision made elsewhere, never the decision itself.
//
// ── WHY link() FOR OBJECTS AND rename() FOR HEAD ──
// States, receipts and fence entries are IMMUTABLE, so they use the C4D
// write-temp → fsync → link → fsync-dir publication: the canonical path only ever
// appears whole, and an existing path is never silently overwritten. HEAD is a
// MUTABLE pointer, and rename() is the only primitive that replaces one whole
// pointer with another atomically. Using link() for HEAD would make the second
// save impossible; using rename() for objects would let a torn write overwrite a
// good one. The two primitives are not interchangeable and the choice is per-role.
//
// I/O tier by design (allowlisted). All paths under DEMA_HOME. No network, no
// child process, no model invocation.

import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, readdir, link, unlink, rename, realpath } from "node:fs/promises";
import { join, sep } from "node:path";
import { homedir } from "node:os";

import {
  SEASON_STATE_SCHEMA,
  buildSeasonState,
  buildSeasonReceipt,
  buildSeasonHead,
  verifySeasonState,
  verifySeasonReceipt,
  verifySeasonHead,
  verifySeasonChainLink,
  verifyRepositoryBinding,
  projectContinuation,
} from "../../core/src/node0-minimum-season-save-resume.js";

export const SEASONS_RELDIR = "seasons";
const SEASON_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const HASH_FILE_RE = /^sha256-[0-9a-f]{64}\.json$/;
const SEQ_FILE_RE = /^\d{6}\.json$/;
const MAX_OBJECT_BYTES = 1048576;

const refuse = (reason, extra = {}) => Object.freeze({ ok: false, outcome: "REFUSED", reason, ...extra });
const empty = (extra = {}) => Object.freeze({ ok: true, outcome: "EMPTY", reason: null, ...extra });

export function resolveDemaHome(demaHome) {
  if (typeof demaHome === "string" && demaHome.length > 0) return demaHome;
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

const seasonDir = (home, id) => join(home, SEASONS_RELDIR, id);
const statesDir = (home, id) => join(seasonDir(home, id), "states");
const receiptsDir = (home, id) => join(seasonDir(home, id), "receipts");
const seqDir = (home, id) => join(seasonDir(home, id), "seq");
const headPath = (home, id) => join(seasonDir(home, id), "HEAD.json");
const objectName = (taggedHash) => `${taggedHash.replace(":", "-")}.json`;
const seqName = (n) => `${String(n).padStart(6, "0")}.json`;

/** fsync a path; a directory handle is how a link itself is made durable. */
async function fsyncPath(path) {
  const fh = await open(path, "r");
  try {
    await fh.sync();
  } finally {
    await fh.close();
  }
}

/**
 * Atomically replace a mutable pointer: write a private temp, fsync it, rename
 * over the target, fsync the directory. rename() is atomic on POSIX, so a reader
 * sees either the whole old pointer or the whole new one — never a torn file.
 */
async function replaceFileAtomic(dir, finalPath, bytes) {
  const temp = join(dir, `.tmp-${randomUUID()}`);
  const fh = await open(temp, "wx", 0o600);
  try {
    await fh.writeFile(bytes);
    await fh.sync();
  } finally {
    await fh.close();
  }
  await rename(temp, finalPath);
  await fsyncPath(dir);
}

export const DEFAULT_STORE_OPS = Object.freeze({
  linkFile: link,
  unlinkTemp: unlink,
  fsyncDir: fsyncPath,
  replaceFileAtomic,
});

/** Publish immutable bytes with no-replace semantics (C4D publication shape). */
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
    return { published: false, reason: `temp_write_failed:${err?.code ?? "unknown"}` };
  }
  let result;
  try {
    await ops.linkFile(temp, finalPath);
    await ops.fsyncDir(dir);
    result = { published: true, already: false };
  } catch (err) {
    if (err?.code === "EEXIST") {
      result = { published: false, already: true, reason: "already_published" };
    } else {
      result = { published: false, already: false, reason: `publication_unavailable:${err?.code ?? "unknown"}` };
    }
  }
  try {
    await ops.unlinkTemp(temp);
  } catch {
    /* temp cleanup is best-effort; an orphan temp is never authoritative */
  }
  return result;
}

/** Read one JSON object under a size cap. Absence and corruption are distinct. */
async function readJson(path) {
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch (err) {
    if (err?.code === "ENOENT") return { found: false };
    return { found: false, error: `read_failed:${err?.code ?? "unknown"}` };
  }
  if (Buffer.byteLength(text, "utf8") > MAX_OBJECT_BYTES) return { found: true, error: "object_too_large" };
  try {
    return { found: true, value: JSON.parse(text) };
  } catch {
    return { found: true, error: "object_not_json" };
  }
}

/**
 * Confirm a path stays inside the declared DEMA_HOME after symlink resolution.
 * Containment is checked on the REAL path: a symlinked season directory would
 * otherwise read and write outside the boundary the operator declared.
 */
async function withinHome(home, path) {
  try {
    const realHome = await realpath(home);
    const realTarget = await realpath(path);
    return realTarget === realHome || realTarget.startsWith(realHome + sep);
  } catch {
    return true; // not yet created — creation happens under home by construction
  }
}

/**
 * Load the authoritative HEAD and everything it points at, verifying each hop.
 * Fails closed on anything it cannot fully prove. Returns EMPTY (not a refusal)
 * when no season has been established — absence of a first save is a legitimate
 * state, and refusing it would block the very first lawful use.
 */
export async function loadSeasonHead({ demaHome, seasonId } = {}) {
  if (typeof seasonId !== "string" || !SEASON_ID_RE.test(seasonId)) {
    return refuse("season_id_malformed");
  }
  const home = resolveDemaHome(demaHome);
  const dir = seasonDir(home, seasonId);
  if (!(await withinHome(home, dir))) return refuse("season_path_escapes_home");

  const headRead = await readJson(headPath(home, seasonId));
  if (!headRead.found) {
    if (headRead.error) return refuse("malformed_head", { detail: headRead.error });
    // No HEAD. Orphan objects may exist from a crash before publication (S6);
    // they are reported but are NOT authoritative.
    let orphans = 0;
    try {
      orphans = (await readdir(statesDir(home, seasonId))).filter((f) => HASH_FILE_RE.test(f)).length;
    } catch {
      /* no states dir at all — a clean, never-used season */
    }
    return empty({ season_id: seasonId, orphan_states: orphans });
  }
  if (headRead.error) return refuse("malformed_head", { detail: headRead.error });

  const head = headRead.value;
  const headCheck = verifySeasonHead(head);
  if (!headCheck.ok) return refuse(headCheck.reason === "unknown_schema" ? "unknown_schema" : "malformed_head");
  if (head.season_id !== seasonId) return refuse("malformed_head", { detail: "season_id_mismatch" });

  // HEAD must agree with the fence that actually decided this sequence. A HEAD
  // naming a different winner than seq/<n> means two candidates exist and
  // neither may be trusted.
  const fenceRead = await readJson(join(seqDir(home, seasonId), seqName(head.state_sequence)));
  if (fenceRead.found && !fenceRead.error) {
    if (
      fenceRead.value?.state_hash !== head.state_hash ||
      fenceRead.value?.receipt_hash !== head.receipt_hash
    ) {
      return refuse("head_candidates_conflict");
    }
  }

  const stateRead = await readJson(join(statesDir(home, seasonId), objectName(head.state_hash)));
  if (!stateRead.found) return refuse("state_missing");
  if (stateRead.error) return refuse("state_hash_mismatch", { detail: stateRead.error });
  const state = stateRead.value;
  const stateCheck = verifySeasonState(state);
  if (!stateCheck.ok) {
    const reason =
      stateCheck.reason === "unknown_schema" ? "unknown_schema"
      : stateCheck.reason === "state_contract_violated" ? "state_contract_violated"
      : "state_hash_mismatch";
    return refuse(reason, { blocked_by: stateCheck.blocked_by ?? null });
  }
  // Content addressing is only meaningful if the address is re-derived, not
  // trusted: a file may be named after a hash it does not have.
  if (state.state_hash !== head.state_hash) return refuse("state_hash_mismatch");
  if (state.state_sequence !== head.state_sequence) return refuse("malformed_head", { detail: "sequence_disagreement" });

  const receiptRead = await readJson(join(receiptsDir(home, seasonId), objectName(head.receipt_hash)));
  if (!receiptRead.found) return refuse("receipt_missing");
  if (receiptRead.error) return refuse("receipt_hash_mismatch", { detail: receiptRead.error });
  const receipt = receiptRead.value;
  const receiptCheck = verifySeasonReceipt(receipt, state);
  if (!receiptCheck.ok) {
    return refuse(receiptCheck.reason === "unknown_schema" ? "unknown_schema" : "receipt_hash_mismatch");
  }
  if (receipt.receipt_hash !== head.receipt_hash) return refuse("receipt_hash_mismatch");

  // Previous-state binding, where one is claimed.
  let previous = null;
  if (state.previous_state_hash) {
    const prevRead = await readJson(join(statesDir(home, seasonId), objectName(state.previous_state_hash)));
    if (!prevRead.found) return refuse("previous_state_link_broken", { detail: "previous_state_missing" });
    if (prevRead.error) return refuse("previous_state_link_broken");
    const prevCheck = verifySeasonState(prevRead.value);
    if (!prevCheck.ok) return refuse("previous_state_link_broken");
    if (prevRead.value.state_hash !== state.previous_state_hash) return refuse("previous_state_link_broken");
    const link = verifySeasonChainLink(state, prevRead.value);
    if (!link.ok) return refuse(link.reason);
    previous = prevRead.value;
  } else {
    const link = verifySeasonChainLink(state, null);
    if (!link.ok) return refuse(link.reason);
  }

  return Object.freeze({
    ok: true, outcome: "OK", reason: null,
    season_id: seasonId, head, state, receipt, previous,
  });
}

/**
 * SAVE LAW. Validate → read+verify HEAD → bind previous → hash → publish state →
 * fsync → publish receipt → fsync → win the sequence fence → replace HEAD
 * atomically → fsync dir → re-read and verify → return hashes.
 *
 * A failed save leaves either the previous valid HEAD or the complete new one.
 * It can never leave HEAD naming missing, partial or hash-invalid state, because
 * HEAD is written LAST and only after its referents are durable on disk.
 *
 * `hooks` exists so a test can terminate a REAL process at an exact point. It is
 * never used in production paths. Injected-fs patching would be a silent no-op
 * here — the seam has to be the module's own.
 */
export async function saveSeasonState({
  demaHome, state: input, ops = DEFAULT_STORE_OPS, hooks = {},
} = {}) {
  const home = resolveDemaHome(demaHome);
  const seasonId = input?.season_id;
  if (typeof seasonId !== "string" || !SEASON_ID_RE.test(seasonId)) return refuse("season_id_malformed");

  // 2. read and verify the current HEAD when present
  const current = await loadSeasonHead({ demaHome: home, seasonId });
  if (!current.ok) return current;
  const prevState = current.outcome === "EMPTY" ? null : current.state;

  // 3. bind the new state to the previous state hash
  const nextSequence = prevState ? prevState.state_sequence + 1 : 1;
  if (input.state_sequence !== undefined && input.state_sequence !== nextSequence) {
    return refuse(input.state_sequence <= (prevState?.state_sequence ?? 0) ? "sequence_regression" : "sequence_gap");
  }

  // 1+4. validate the contract and hash the semantic state
  const built = buildSeasonState({
    ...input,
    state_sequence: nextSequence,
    previous_state_hash: prevState ? prevState.state_hash : null,
  });
  if (!built.ok) {
    return refuse(
      built.blocked_by.includes("secret_bearing_state") ? "secret_bearing_state"
      : built.blocked_by.includes("pending_consent_shape_invalid") ? "pending_consent_shape_invalid"
      : "state_contract_violated",
      { blocked_by: built.blocked_by },
    );
  }
  const state = built.state;
  if (prevState) {
    const chain = verifySeasonChainLink(state, prevState);
    if (!chain.ok) return refuse(chain.reason);
  }

  const receipt = buildSeasonReceipt({
    season_id: state.season_id,
    state_hash: state.state_hash,
    state_sequence: state.state_sequence,
    previous_state_hash: state.previous_state_hash,
    saved_at: state.saved_at,
  });

  for (const d of [statesDir(home, seasonId), receiptsDir(home, seasonId), seqDir(home, seasonId)]) {
    await mkdir(d, { recursive: true, mode: 0o700 });
  }
  if (!(await withinHome(home, seasonDir(home, seasonId)))) return refuse("season_path_escapes_home");

  // 5+6. content-addressed state, fsynced. EEXIST is success: the address IS the
  // content, so an existing file at this path already holds these exact bytes.
  const stateBytes = JSON.stringify(state, null, 2) + "\n";
  const statePub = await publishNoReplace(
    statesDir(home, seasonId), join(statesDir(home, seasonId), objectName(state.state_hash)), stateBytes, ops,
  );
  if (!statePub.published && !statePub.already) return refuse(statePub.reason);

  // 7+8. save receipt, fsynced.
  const receiptBytes = JSON.stringify(receipt, null, 2) + "\n";
  const receiptPub = await publishNoReplace(
    receiptsDir(home, seasonId), join(receiptsDir(home, seasonId), objectName(receipt.receipt_hash)), receiptBytes, ops,
  );
  if (!receiptPub.published && !receiptPub.already) return refuse(receiptPub.reason);

  if (hooks.afterReceiptFsync) await hooks.afterReceiptFsync({ state, receipt });

  // 8b. THE FENCE. Exactly one writer may own sequence N. The loser learns it
  // lost from the filesystem, not from a lock it might have raced.
  const fenceBytes = JSON.stringify(
    { schema: SEASON_STATE_SCHEMA, season_id: seasonId, state_sequence: state.state_sequence,
      state_hash: state.state_hash, receipt_hash: receipt.receipt_hash }, null, 2,
  ) + "\n";
  const fencePub = await publishNoReplace(
    seqDir(home, seasonId), join(seqDir(home, seasonId), seqName(state.state_sequence)), fenceBytes, ops,
  );
  let idempotent = false;
  /** Set when this retry adopted the fence's existing publication. */
  let adoptedReceiptHash = null;
  if (!fencePub.published) {
    if (fencePub.already) {
      const owner = await readJson(join(seqDir(home, seasonId), seqName(state.state_sequence)));
      const sameState = !owner.error && owner.value?.state_hash === state.state_hash;
      if (!sameState) {
        return refuse("stale_head_lost_race", {
          state_sequence: state.state_sequence, winner_state_hash: owner.value?.state_hash ?? null,
        });
      }
      // SEASON-PUBLICATION-IDENTITY-1A. The same SEMANTIC STATE is not the same
      // PUBLICATION. `saved_at` is excluded from the state hash and included in
      // the receipt hash, so a retry with a fresh clock reconstructs an identical
      // state under a NEW receipt. The previous code compared `state_hash` alone
      // and then built HEAD from the CANDIDATE's receipt — publishing a HEAD that
      // named a receipt this fence does not own. Its comment claimed "these exact
      // bytes"; nothing checked them.
      //
      // Refusing here would be worse than the bug: this branch exists so a writer
      // that died between winning the fence and replacing HEAD can come back and
      // repair it, and a fresh clock on that retry is normal. Refusal would turn a
      // recoverable crash into a permanent stall.
      //
      // So the law is ADOPTION, not refusal: HEAD may only ever name the receipt
      // the fence already owns. That is safe because of the publication order —
      // state, then receipt, THEN fence — so a fence naming R proves R was durable
      // before the fence existed. The candidate's own receipt object stays on disk
      // as orphan evidence and is never authoritative.
      idempotent = true;
      if (owner.value?.receipt_hash && owner.value.receipt_hash !== receipt.receipt_hash) {
        adoptedReceiptHash = owner.value.receipt_hash;
      }
    } else {
      return refuse(fencePub.reason);
    }
  }
  if (hooks.afterFencePublish) await hooks.afterFencePublish({ state, receipt });

  // 9+10. atomically replace HEAD, then fsync the containing directory.
  // PI-05: never the candidate's receipt when the fence owns another.
  const publishedReceiptHash = adoptedReceiptHash ?? receipt.receipt_hash;
  const head = buildSeasonHead({
    season_id: seasonId, state_hash: state.state_hash,
    receipt_hash: publishedReceiptHash, state_sequence: state.state_sequence,
  });
  try {
    await ops.replaceFileAtomic(
      seasonDir(home, seasonId), headPath(home, seasonId), JSON.stringify(head, null, 2) + "\n",
    );
  } catch (err) {
    // The fence is won and the objects are durable, but HEAD still names the
    // previous state. That is a legal, recoverable outcome: the old HEAD is
    // intact and the new objects are orphans until a replay republishes them.
    return refuse(`head_publication_failed:${err?.code ?? "unknown"}`, {
      previous_head_intact: true, orphan_state_hash: state.state_hash,
    });
  }

  if (hooks.afterHeadReplace) await hooks.afterHeadReplace({ state, receipt, head });

  // 11. re-read and verify what was actually committed — from disk, not memory.
  const confirmed = await loadSeasonHead({ demaHome: home, seasonId });
  if (!confirmed.ok || confirmed.outcome !== "OK") {
    return refuse("post_save_verification_failed", { detail: confirmed.reason ?? confirmed.outcome });
  }
  if (confirmed.state.state_hash !== state.state_hash) return refuse("post_save_verification_failed");
  // Publication identity is BOTH hashes. Verifying only the state hash here was
  // the same blind spot as the retry branch, one step later.
  if (confirmed.receipt.receipt_hash !== publishedReceiptHash) {
    return refuse("post_save_verification_failed", { detail: "receipt_hash_mismatch" });
  }

  // 12. report what was ACTUALLY published. When this retry adopted the fence's
  // existing publication, the caller's candidate receipt was NOT published, and
  // saying otherwise would be the quietest possible false success.
  return Object.freeze({
    ok: true, outcome: "OK",
    reason: adoptedReceiptHash ? "adopted_existing_publication"
      : idempotent ? "already_saved_idempotently" : null,
    idempotent, adopted_existing_publication: adoptedReceiptHash !== null,
    season_id: seasonId,
    state_hash: state.state_hash, receipt_hash: publishedReceiptHash,
    candidate_receipt_hash: receipt.receipt_hash,
    state_sequence: state.state_sequence,
    state: confirmed.state, receipt: confirmed.receipt,
    state_path: join(statesDir(home, seasonId), objectName(state.state_hash)),
    receipt_path: join(receiptsDir(home, seasonId), objectName(publishedReceiptHash)),
    head_path: headPath(home, seasonId),
  });
}

/** STATUS LAW. Read-only. Verifies every hop and mutates nothing. */
export async function seasonStatus({ demaHome, seasonId } = {}) {
  const loaded = await loadSeasonHead({ demaHome, seasonId });
  if (!loaded.ok) return loaded;
  if (loaded.outcome === "EMPTY") return loaded;
  const s = loaded.state;
  return Object.freeze({
    ok: true, outcome: "OK", reason: null,
    season_id: s.season_id, mission_id: s.mission_id, mission_phase: s.mission_phase,
    state_sequence: s.state_sequence, next_safe_action: s.next_safe_action,
    pending_consent_count: s.pending_consent.length,
    pending_consent_pending: s.pending_consent.length > 0,
    completed_steps: s.completed_steps, must_not_repeat: s.must_not_repeat,
    repository_commit: s.repository_commit, repository_tree: s.repository_tree,
    last_receipt_hash: s.last_receipt_hash, state_hash: s.state_hash,
    receipt_hash: loaded.receipt.receipt_hash, saved_at: s.saved_at,
    verified: true,
  });
}

/**
 * RESUME LAW. Reconstruct the continuation from stored bytes alone: no chat
 * transcript, no model memory, no world mutation, no mission step executed.
 * Pending consent is returned still pending — resume reconstructs authority's
 * ABSENCE as faithfully as it reconstructs anything else.
 */
export async function resumeSeason({ demaHome, seasonId, repositoryCommit, repositoryTree } = {}) {
  const loaded = await loadSeasonHead({ demaHome, seasonId });
  if (!loaded.ok) return loaded;
  if (loaded.outcome === "EMPTY") return loaded;

  const binding = verifyRepositoryBinding(loaded.state, { repositoryCommit, repositoryTree });
  if (!binding.ok) {
    return Object.freeze({
      ok: false, outcome: "REPOSITORY_MISMATCH", reason: binding.reason,
      expected_commit: loaded.state.repository_commit, expected_tree: loaded.state.repository_tree,
    });
  }
  return Object.freeze({
    ok: true, outcome: "OK", reason: null,
    continuation: projectContinuation(loaded.state),
    receipt_hash: loaded.receipt.receipt_hash,
    saved_at: loaded.state.saved_at,
    executed: false, mutated: false, consent_granted: false,
  });
}

/** List season ids present under DEMA_HOME. Read-only; EMPTY is not an error. */
export async function listSeasons({ demaHome } = {}) {
  const home = resolveDemaHome(demaHome);
  try {
    const entries = await readdir(join(home, SEASONS_RELDIR), { withFileTypes: true });
    return Object.freeze({
      ok: true,
      season_ids: Object.freeze(
        entries.filter((e) => e.isDirectory() && SEASON_ID_RE.test(e.name)).map((e) => e.name).sort(),
      ),
    });
  } catch {
    return Object.freeze({ ok: true, season_ids: Object.freeze([]) });
  }
}

export const _internal = Object.freeze({
  publishNoReplace, readJson, fsyncPath, seasonDir, statesDir, receiptsDir, seqDir,
  headPath, objectName, seqName, SEASON_ID_RE, HASH_FILE_RE, SEQ_FILE_RE, withinHome,
});
