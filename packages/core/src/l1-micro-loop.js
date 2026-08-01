// L1-MICRO-LOOP-1A — the first closed cycle (ADR-049 Action #5, Option C rung L1).
//
// WHY THIS EXISTS
//
// Everything downstream of PROPOSE has, until now, been a human typing a
// phrase. This kernel is the smallest loop that closes without one: a single
// sandbox-scoped file rename that checkpoints, acts, self-verifies by hash
// equality, seals a hash-chained receipt, and decides to stop — with no
// human between PROPOSE and SEAL, inside an authority envelope (lease) the
// human issued beforehand.
//
// DESIGN LAWS
//
//   1. One act, one proof, one receipt. The verifiable unit of committed
//      change is a single reversible rename. Nothing chains at L1.
//   2. Every phase persists BEFORE it proceeds (cycle.json, atomic
//      write-then-rename). Kill the process at any phase: resume() either
//      rolls forward through judge-free verification or rolls back from the
//      checkpoint. No phase trusts memory.
//   3. VERIFY is judge-free and admitted: the verifier (hash_equality with
//      exact expected hashes, independent certifier) must pass the
//      verification-admission kernel v0.2 BEFORE checkpoint. A cycle whose
//      check would need judgment never starts mutating.
//   4. Fail closed, authority delta zero. Lease violations (scope, expiry,
//      budget) refuse before mutation. Every failure path rolls back and
//      reports authority_delta: 0 — a failure can never widen scope.
//   5. No deletes, ever. Rollback is the inverse rename; checkpoints are
//      copies; superseded state is kept, not destroyed. This also makes the
//      kernel safe on delete-forbidden mounts.
//
// SCOPE — deliberately narrow. Sandbox-relative paths only. No daemon, no
// scheduling, no chaining (that is L2, behind its own slice), no network,
// no model invocation. The proposer here is a typed intent, not an LLM.

import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join, resolve, sep } from "node:path";

import { evaluateVerificationAdmission } from "./verification-admission.js";
import {
  assertAnchorOutside,
  buildAnchorRecord,
  verifyAgainstAnchor,
  verifyAnchorLog,
} from "./chain-anchor.js";

export const L1_SCHEMA = "bizra.dema.l1_micro_loop.v0.1";
export const L1_TRUTH_LABEL = "L1_SANDBOX_SINGLE_ACT";

export const PHASES = Object.freeze([
  "PROPOSED",
  "ADMITTED",
  "CHECKPOINTED",
  "ACTED",
  "VERIFIED",
  "SEALED",
  "DECIDED",
]);

const GENESIS_HEAD = "l1-genesis";

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function stable(obj) {
  return JSON.stringify(obj, Object.keys(flatten(obj)).sort());
}

function flatten(obj, out = {}) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    out[k] = true;
    if (v && typeof v === "object") flatten(v, out);
  }
  return out;
}

/** Atomic-enough persistence on rename-capable mounts: write tmp, rename. */
function persist(path, obj) {
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2));
  renameSync(tmp, path);
}

/**
 * Resolve a path through symlinks. `dst` normally does not exist yet, so
 * resolve the nearest existing ancestor and re-attach the unborn tail.
 * Returns null when nothing on the path resolves (caller fails closed).
 */
function realpathish(p) {
  let cur = resolve(p);
  const tail = [];
  for (;;) {
    try {
      const real = realpathSync(cur);
      return tail.length ? join(real, ...tail) : real;
    } catch {
      const parent = dirname(cur);
      if (parent === cur) return null;
      tail.unshift(basename(cur));
      cur = parent;
    }
  }
}

/**
 * True when `candidate` lies inside `root` AFTER symlink resolution.
 * Lexical resolve() alone is a scope-escape hole: a symlink inside the
 * sandbox pointing out of it reads as in-scope, so an act can write past
 * the lease boundary. Fails closed on unresolvable paths.
 */
function inside(root, candidate) {
  const r = realpathish(root);
  const c = realpathish(candidate);
  if (r === null || c === null) return false;
  return (c + sep).startsWith(r + sep);
}

/** Occupancy, not reachability: a dangling symlink still occupies its path. */
function occupied(path) {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

function fail(state, reason, detail) {
  return { ok: false, reason, detail: detail ?? null, state };
}

/**
 * Lease check — the GATE edge. Fail closed on scope, expiry, budget.
 * `now` is injected for determinism in tests.
 */
export function checkLease(lease, { sandboxRoot, now }) {
  if (!lease || typeof lease !== "object") return "lease_required";
  if (typeof lease.lease_id !== "string" || !lease.lease_id) {
    return "lease_required";
  }
  if (!lease.scope_root || !inside(lease.scope_root, sandboxRoot)) {
    return "lease_scope_violation";
  }
  if (typeof lease.expires_at !== "number" || now >= lease.expires_at) {
    return "lease_expired";
  }
  if (!(Number.isInteger(lease.budget_acts) && lease.budget_acts >= 1)) {
    return "lease_budget_exhausted";
  }
  return null;
}

function cyclePaths(sandboxRoot) {
  const dir = join(sandboxRoot, ".l1");
  return {
    dir,
    state: join(dir, "cycle.json"),
    backupDir: join(dir, "backup"),
    chain: join(dir, "chain.jsonl"),
    // Survives cycle.json overwrite on the next PROPOSED. Evidence that a
    // receipt was sealed into the chain — NOT an external tamper-proof
    // anchor (same actor can delete both; recorded as open).
    lastSeal: join(dir, "last_seal_head"),
  };
}

/** True iff a seal has completed at least once in this sandbox. */
function hasPriorSeal(paths) {
  return existsSync(paths.lastSeal);
}

/**
 * Missing chain after a prior seal is erasure, not genesis. Mid-first-cycle
 * crash (backup/cycle present, zero seals) must still read as genesis.
 */
function chainContinuityFailure(paths) {
  if (!existsSync(paths.chain) && hasPriorSeal(paths)) {
    return "chain_absent_with_history";
  }
  return null;
}

// ---------------------------------------------------------------------------
// EXTERNAL ANCHOR (CHAIN-ANCHOR-1A)
//
// `.l1/last_seal_head` is an IN-BAND witness: it lives inside the directory it
// testifies about, so deleting the chain AND the marker reads as a clean
// genesis. An expectation kept OUTSIDE the leased scope is the only thing that
// can tell erasure from a fresh start.
//
// Optional by parameter, mandatory once established: pass `anchorDir` and the
// loop fails closed on any mismatch before it mutates. Omit it and the known
// gap stands (recorded in CURRENT_LIMITS).
// ---------------------------------------------------------------------------

const ANCHOR_LOG = "chain-anchor.jsonl";
const ANCHOR_CHAIN_ID = "l1.chain";

function anchorLogPath(anchorDir) {
  return join(anchorDir, ANCHOR_LOG);
}

function readAnchorLog(anchorDir) {
  const p = anchorLogPath(anchorDir);
  if (!existsSync(p)) return [];
  const raw = readFileSync(p, "utf8").trim();
  return raw ? raw.split("\n").map((line) => JSON.parse(line)) : [];
}

/** Observed chain state plus the head history that proves growth, not replacement. */
function observeChain(paths) {
  const empty = { entries: 0, head: GENESIS_HEAD, head_history: [] };
  if (!existsSync(paths.chain)) return empty;
  const raw = readFileSync(paths.chain, "utf8").trim();
  if (!raw) return empty;
  const heads = raw.split("\n").map((line) => JSON.parse(line).head);
  return { entries: heads.length, head: heads[heads.length - 1], head_history: heads };
}

/**
 * The anchor gate. Runs before any mutation, and again before a resume
 * completes. Returns a refusal reason, or null when the observed chain still
 * extends the last anchored state.
 */
function anchorGate(paths, sandboxRoot, anchorDir) {
  if (!anchorDir) return null;
  const placement = assertAnchorOutside(
    realpathish(anchorDir) ?? anchorDir,
    realpathish(sandboxRoot) ?? sandboxRoot,
    sep,
  );
  if (!placement.intact) return "anchor_inside_scope";

  const records = readAnchorLog(anchorDir);
  if (!verifyAnchorLog(records, sha256).intact) return "anchor_log_forged";
  if (records.length === 0) return null; // nothing anchored yet — first cycle

  const observed = observeChain(paths);
  const verdict = verifyAgainstAnchor(records[records.length - 1], observed, {
    head_history: observed.head_history,
  });
  return verdict.intact ? null : `anchor_${verdict.verdict.toLowerCase()}`;
}

/** Record the freshly sealed head outside the scope the act can reach. */
function appendAnchor(paths, anchorDir, now) {
  if (!anchorDir) return;
  const records = readAnchorLog(anchorDir);
  const observed = observeChain(paths);
  const record = buildAnchorRecord({
    chain_id: ANCHOR_CHAIN_ID,
    entries: observed.entries,
    head: observed.head,
    previous: records.length ? records[records.length - 1] : null,
    hash: sha256,
    at: now,
  });
  mkdirSync(anchorDir, { recursive: true });
  const existing = existsSync(anchorLogPath(anchorDir))
    ? readFileSync(anchorLogPath(anchorDir), "utf8")
    : "";
  writeFileSync(anchorLogPath(anchorDir), existing + JSON.stringify(record) + "\n");
}

function readChainHead(paths) {
  if (!existsSync(paths.chain)) return GENESIS_HEAD;
  const raw = readFileSync(paths.chain, "utf8").trim();
  if (!raw) return GENESIS_HEAD;
  const lines = raw.split("\n");
  const last = JSON.parse(lines[lines.length - 1]);
  return last.head;
}

function sealReceipt(paths, state, outcome, now, anchorDir = null) {
  const broken = chainContinuityFailure(paths);
  if (broken) {
    return { refused: true, reason: broken, authority_delta: 0 };
  }
  const prev = readChainHead(paths);
  const body = {
    schema: L1_SCHEMA,
    truth_label: L1_TRUTH_LABEL,
    cycle_id: state.cycle_id,
    outcome,
    act: state.act,
    admission_hash: state.admission_hash,
    checkpoint: state.checkpoint,
    verify: state.verify ?? null,
    failure: state.failure ?? null,
    authority_delta: 0,
    sealed_at: now,
    prev_head: prev,
  };
  const head = sha256(stable(body) + prev);
  const entry = { ...body, head };
  const line = JSON.stringify(entry);
  const existing = existsSync(paths.chain)
    ? readFileSync(paths.chain, "utf8")
    : "";
  writeFileSync(paths.chain, existing + line + "\n");
  // Persist after the chain append so a crash mid-seal leaves a verifiable
  // chain without a stale "prior seal" marker that would brick resume.
  writeFileSync(paths.lastSeal, `${head}\n`);
  // Anchor AFTER the chain and marker are on disk, so a crash between them
  // leaves the anchor behind the chain (detected as EXTENDED), never ahead of
  // it (which would read as erasure and brick the next cycle).
  appendAnchor(paths, anchorDir, now);
  return entry;
}

function sealOrRefuse(paths, state, outcome, now, anchorDir = null) {
  const receipt = sealReceipt(paths, state, outcome, now, anchorDir);
  if (receipt?.refused) {
    return {
      ok: false,
      outcome: "REFUSED",
      reason: receipt.reason,
      authority_delta: 0,
      receipt: null,
    };
  }
  return { receipt };
}

function setPhase(paths, state, phase, extra = {}) {
  const next = { ...state, ...extra, phase };
  persist(paths.state, next);
  return next;
}

function judgeFreeVerify(sandboxRoot, state) {
  const srcAbs = join(sandboxRoot, state.act.src);
  const dstAbs = join(sandboxRoot, state.act.dst);
  const checks = {
    dst_exists: existsSync(dstAbs),
    src_absent: !existsSync(srcAbs),
    hash_matches: false,
  };
  if (checks.dst_exists) {
    checks.hash_matches =
      sha256File(dstAbs) === state.checkpoint.expected_post_sha256;
  }
  return { checks, passed: Object.values(checks).every(Boolean) };
}

function rollback(sandboxRoot, paths, state, reason, now, anchorDir = null) {
  const srcAbs = join(sandboxRoot, state.act.src);
  const dstAbs = join(sandboxRoot, state.act.dst);
  if (existsSync(dstAbs) && !existsSync(srcAbs)) {
    renameSync(dstAbs, srcAbs); // inverse rename — no deletes
  }
  // The inverse rename restores the PATH; only the checkpoint restores the
  // CONTENT. If the returned bytes do not hash to the pre-image (tampering),
  // reassert from backup — copy-over, never delete.
  if (state.checkpoint?.backup) {
    const srcOk =
      existsSync(srcAbs) &&
      sha256File(srcAbs) === state.checkpoint.expected_pre_sha256;
    if (!srcOk) {
      copyFileSync(join(paths.backupDir, state.checkpoint.backup), srcAbs);
    }
  }
  const restored =
    existsSync(srcAbs) &&
    sha256File(srcAbs) === state.checkpoint.expected_pre_sha256;
  let s = setPhase(paths, state, "DECIDED", {
    failure: { reason, rolled_back: true, restore_verified: restored },
  });
  const sealed = sealOrRefuse(paths, s, "FAIL_ROLLED_BACK", now, anchorDir);
  if (sealed.reason) return { ...sealed, restore_verified: restored };
  const receipt = sealed.receipt;
  s = setPhase(paths, s, "DECIDED", { seal_head: receipt.head });
  return {
    ok: false,
    outcome: "FAIL_ROLLED_BACK",
    reason,
    restore_verified: restored,
    authority_delta: 0,
    receipt,
  };
}

/**
 * Run one complete L1 cycle. `crash_after` (test hook) throws after the
 * named phase has PERSISTED — simulating a kill at every boundary.
 */
export function runL1Cycle({
  sandboxRoot,
  src,
  dst,
  lease,
  proposer = "actor:typed-intent",
  certifier = "habitat:l1-kernel",
  now = Date.now(),
  crash_after = null,
  anchorDir = null,
}) {
  const paths = cyclePaths(sandboxRoot);
  mkdirSync(paths.backupDir, { recursive: true });

  // ---- GATE (lease) — before anything persists or mutates
  const leaseFail = checkLease(lease, { sandboxRoot, now });
  if (leaseFail) return fail(null, leaseFail);
  const continuity = chainContinuityFailure(paths);
  if (continuity) return fail(null, continuity);
  // The external expectation, checked before the loop is allowed to mutate.
  const anchorFail = anchorGate(paths, sandboxRoot, anchorDir);
  if (anchorFail) return fail(null, anchorFail);
  if (!inside(sandboxRoot, join(sandboxRoot, src)) ||
      !inside(sandboxRoot, join(sandboxRoot, dst))) {
    return fail(null, "lease_scope_violation", "act escapes sandbox");
  }
  // The audit trail lives inside the leased scope, so the act must be barred
  // from reaching it — otherwise a cycle renames its own chain away, re-anchors
  // at genesis, and seals the erasure as a PASS.
  if (inside(paths.dir, join(sandboxRoot, src)) ||
      inside(paths.dir, join(sandboxRoot, dst))) {
    return fail(null, "act_targets_audit_state", ".l1 is not actable");
  }
  // A rename is only reversible into empty space: renameSync would silently
  // destroy an occupied dst, and only src is checkpointed.
  if (occupied(join(sandboxRoot, dst))) {
    return fail(null, "dst_occupied", dst);
  }
  const srcAbs = join(sandboxRoot, src);
  if (!existsSync(srcAbs)) return fail(null, "source_missing", src);

  // ---- PROPOSED
  let state = {
    schema: L1_SCHEMA,
    cycle_id: `L1-${now}-${sha256(src + dst + now).slice(0, 8)}`,
    phase: "PROPOSED",
    act: { operation: "sandbox.rename", src, dst },
    lease_id: lease.lease_id,
    proposer,
    certifier,
  };
  persist(paths.state, state);
  if (crash_after === "PROPOSED") throw new Error("simulated-kill");

  // ---- ADMITTED — verifier must pass admission BEFORE any mutation
  const preSha = sha256File(srcAbs);
  const admission = evaluateVerificationAdmission({
    proposed_act: state.act.operation,
    verifier: "hash_equality",
    proposer,
    certifier,
    bindings: { expected_pre_sha256: preSha, expected_post_sha256: preSha },
  });
  if (!admission.self_verifiable) {
    return fail(state, "admission_refused", admission.refusal_reason);
  }
  state = setPhase(paths, state, "ADMITTED", {
    admission_hash: admission.content_hash,
  });
  if (crash_after === "ADMITTED") throw new Error("simulated-kill");

  // ---- CHECKPOINTED — backup before mutation
  const backupName = `${state.cycle_id}.bak`;
  copyFileSync(srcAbs, join(paths.backupDir, backupName));
  state = setPhase(paths, state, "CHECKPOINTED", {
    checkpoint: {
      backup: backupName,
      expected_pre_sha256: preSha,
      expected_post_sha256: preSha, // rename must not change content
    },
  });
  if (crash_after === "CHECKPOINTED") throw new Error("simulated-kill");

  // ---- ACTED — the one reversible effect
  renameSync(srcAbs, join(sandboxRoot, dst));
  state = setPhase(paths, state, "ACTED");
  if (crash_after === "ACTED") throw new Error("simulated-kill");

  return completeFromActed(sandboxRoot, paths, state, now, crash_after, anchorDir);
}

function completeFromActed(
  sandboxRoot,
  paths,
  state,
  now,
  crash_after = null,
  anchorDir = null,
) {
  // ---- VERIFIED — judge-free: hashes and existence, nothing else
  const verify = judgeFreeVerify(sandboxRoot, state);
  if (!verify.passed) {
    return rollback(sandboxRoot, paths, state, "verification_failed", now, anchorDir);
  }
  state = setPhase(paths, state, "VERIFIED", { verify });
  if (crash_after === "VERIFIED") throw new Error("simulated-kill");

  // ---- SEALED — hash-chained receipt
  const sealed = sealOrRefuse(paths, state, "PASS", now, anchorDir);
  if (sealed.reason) return sealed;
  const receipt = sealed.receipt;
  state = setPhase(paths, state, "SEALED", { seal_head: receipt.head });

  // ---- DECIDED — stop clean (L1 never chains)
  state = setPhase(paths, state, "DECIDED");
  return {
    ok: true,
    outcome: "PASS",
    cycle_id: state.cycle_id,
    verify,
    authority_delta: 0,
    receipt,
    decision: "stop_clean",
  };
}

/**
 * Resume after a kill. Reads persisted phase; rolls forward only through
 * judge-free verification, otherwise rolls back. Never re-runs ACT blindly.
 *
 * Resume mutates (rollback renames, checkpoint copies), so it stands under the
 * same lease as the cycle it finishes — restorative intent does not exempt a
 * mutation from its authority envelope. The lease must also be the SAME lease:
 * a fresh envelope may not adopt another envelope's unfinished act.
 */
export function resumeL1Cycle({ sandboxRoot, lease, now = Date.now(), anchorDir = null }) {
  const paths = cyclePaths(sandboxRoot);
  if (!existsSync(paths.state)) return { ok: false, reason: "no_cycle" };
  const state = JSON.parse(readFileSync(paths.state, "utf8"));
  const leaseFail = checkLease(lease, { sandboxRoot, now });
  if (leaseFail) return { ok: false, reason: leaseFail, authority_delta: 0 };
  if (lease.lease_id !== state.lease_id) {
    return { ok: false, reason: "lease_mismatch", authority_delta: 0 };
  }
  const continuity = chainContinuityFailure(paths);
  if (continuity) {
    return { ok: false, reason: continuity, authority_delta: 0 };
  }
  const anchorFail = anchorGate(paths, sandboxRoot, anchorDir);
  if (anchorFail) return { ok: false, reason: anchorFail, authority_delta: 0 };

  switch (state.phase) {
    case "PROPOSED":
    case "ADMITTED": {
      // Nothing mutated. Abort clean with a receipt.
      const s = setPhase(paths, state, "DECIDED", {
        failure: { reason: "resumed_before_mutation", rolled_back: false },
        checkpoint: state.checkpoint ?? null,
      });
      const sealed = sealOrRefuse(paths, s, "ABORTED_CLEAN", now, anchorDir);
      if (sealed.reason) return sealed;
      return {
        ok: true,
        outcome: "ABORTED_CLEAN",
        authority_delta: 0,
        receipt: sealed.receipt,
      };
    }
    case "CHECKPOINTED": {
      // Backup exists; act may or may not have begun. Source present → clean.
      const srcAbs = join(sandboxRoot, state.act.src);
      if (existsSync(srcAbs)) {
        const s = setPhase(paths, state, "DECIDED", {
          failure: { reason: "resumed_before_act", rolled_back: false },
        });
        const sealed = sealOrRefuse(paths, s, "ABORTED_CLEAN", now, anchorDir);
        if (sealed.reason) return sealed;
        return {
          ok: true,
          outcome: "ABORTED_CLEAN",
          authority_delta: 0,
          receipt: sealed.receipt,
        };
      }
      return completeFromActed(sandboxRoot, paths, state, now, null, anchorDir);
    }
    case "ACTED":
    case "VERIFIED":
      return completeFromActed(sandboxRoot, paths, state, now, null, anchorDir);
    case "SEALED":
    case "DECIDED":
      return { ok: true, outcome: "ALREADY_COMPLETE", authority_delta: 0 };
    default:
      return { ok: false, reason: "unknown_phase", authority_delta: 0 };
  }
}

/** Verify the receipt chain end-to-end: every head derives from its body+prev. */
export function verifyChain(sandboxRoot) {
  const paths = cyclePaths(sandboxRoot);
  if (!existsSync(paths.chain)) {
    if (hasPriorSeal(paths)) {
      return {
        valid: false,
        entries: 0,
        why: "chain_absent_with_history",
        genesis: false,
      };
    }
    return { valid: true, entries: 0, genesis: true };
  }
  const raw = readFileSync(paths.chain, "utf8");
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      valid: false,
      entries: 0,
      why: hasPriorSeal(paths) ? "chain_absent_with_history" : "chain_empty",
      genesis: false,
    };
  }
  const lines = trimmed.split("\n");
  let prev = GENESIS_HEAD;
  for (let i = 0; i < lines.length; i++) {
    let parsed;
    try {
      parsed = JSON.parse(lines[i]);
    } catch {
      return {
        valid: false,
        entries: lines.length,
        broken_at: i,
        why: "chain_unparseable",
        genesis: false,
      };
    }
    const { head, ...body } = parsed;
    if (body.prev_head !== prev) {
      return {
        valid: false,
        entries: lines.length,
        broken_at: i,
        why: "prev_head_mismatch",
        genesis: false,
      };
    }
    if (sha256(stable(body) + prev) !== head) {
      return {
        valid: false,
        entries: lines.length,
        broken_at: i,
        why: "head_forged",
        genesis: false,
      };
    }
    prev = head;
  }
  return { valid: true, entries: lines.length, head: prev, genesis: false };
}
