// NODE0-REVERSIBLE-EXECUTE-GATE-1A — THE HINGE.
//
// The first surface in this repo that performs a REAL, reversible filesystem
// mutation. #301 deliberately previewed-only; this kernel executes the one
// governed action #301 described — a low-risk rename — under hard containment:
//
//   • Consent: an EXACT GO phrase, byte-matched, fail-closed.
//   • Sandbox: every path is confined to a caller-supplied sandbox root by
//     INODE, not by string. Source and target are basename-only; the runner
//     lstat-rejects symlinks and realpath-confines every path it touches
//     (source, target, backup dir, backup file, receipt log) before any read or
//     write. No escape, no traversal, no symlink-follow, no delete, no secret
//     access, no network.
//   • Reversible: a backup is written (exclusive, no-clobber) BEFORE the rename;
//     an undo manifest is sealed; undo is executable and PROVES restoration by
//     comparing the restored bytes against the independent on-disk BACKUP (not
//     the receipt's self-declared hash).
//   • Receipt: before/after hashes, backup, undo, consent hash, timestamp — sealed
//     and appended to an on-disk append-only log. verifyExecuteReceipt re-derives
//     the content hash, validates consent + the full boundary, and (fs-aware)
//     requires the receipt to be present in the sealed log.
//
// PURITY: imports NO side-effect surface. All filesystem access goes through an
// INJECTED `fs` adapter (node:fs at the CLI; a real temp-dir fs in tests). DI-pure
// → kernel-purity passes without an allowlist entry. Only node:crypto is imported.
//
// THREAT MODEL / RESIDUAL (honest): content_hash is INTEGRITY, not authenticity —
// it is recomputable by anyone. Authenticity here is bound by (a) fs-aware
// verify's sealed-log presence check and (b) undo's independent backup anchor. A
// caller who controls the receipt object AND the sandbox disk could still forge;
// closing that fully requires Ed25519 receipt signing, which needs an operator
// key (a §1 action) and is deferred to a later slice. TOCTOU on the sandbox dir
// between lstat and write is out of scope for the single-operator local model.

import { createHash } from "node:crypto";

export const NODE0_REVERSIBLE_EXECUTE_GATE_SCHEMA =
  "bizra.node0.reversible_execute_gate.v0.1";
export const NODE0_REVERSIBLE_EXECUTE_RECEIPT_SCHEMA =
  "bizra.node0.reversible_execute_receipt.v0.1";
export const NODE0_REVERSIBLE_EXECUTE_TRUTH_LABEL =
  "NODE0_REVERSIBLE_EXECUTE_SANDBOX_MEASURED";
export const NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE =
  "rename_preview_to_governed_action_candidate";
export const NODE0_REVERSIBLE_EXECUTE_GO_PHRASE =
  "GO: execute governed reversible rename in sandbox";

export const NODE0_REVERSIBLE_EXECUTE_BLOCK_REASONS = Object.freeze([
  "consent_phrase_mismatch",
  "unsupported_action_type",
  "unsafe_source_name",
  "unsafe_target_name",
  "sandbox_root_missing",
  "source_missing",
  "source_not_a_file",
  "unsafe_symlink_source",
  "target_exists",
  "sandbox_escape_blocked",
  "backup_dir_unsafe",
  "backup_write_failed",
  "post_move_identity_mismatch",
  "backup_identity_mismatch",
]);

const SAFE_NAME = /^[A-Za-z0-9._-]+$/;
const BACKUP_DIR = ".node0-backups";
const RECEIPT_LOG = ".node0-receipts.ndjson";
const RESERVED_NAMES = new Set([BACKUP_DIR, RECEIPT_LOG]);

// The artifacts this gate writes into the sandbox root besides the rename itself.
// Exported so a preview can DISCLOSE them to the human before consent instead of
// promising "directory otherwise untouched" and then creating them — the CR-01
// defect measured on Mission-001 Run-1 Attempt-1. Names only; no behaviour here.
export const NODE0_REVERSIBLE_EXECUTE_CONTROL_PLANE = Object.freeze({
  backup_dir: BACKUP_DIR,
  receipt_log: RECEIPT_LOG,
  backup_suffix: ".bak",
});

// ── deterministic content addressing ────────────────────────────────────────
function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item) ?? "null").join(",")}]`;
  }
  if (value && typeof value === "object") {
    const parts = Object.keys(value)
      .sort()
      .flatMap((key) => {
        const serialized = stableStringify(value[key]);
        return serialized === undefined ? [] : [`${JSON.stringify(key)}:${serialized}`];
      });
    return `{${parts.join(",")}}`;
  }
  return JSON.stringify(value);
}
function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
function contentHash(payload) {
  return `sha256:${sha256Hex(stableStringify(payload))}`;
}

// Re-derive a receipt's content hash over its body (excluding content_hash,
// state_hash, and the non-sealed receipt_log_path). content_hash binds the
// declared receipt fields; state_hash binds the independently measured sandbox
// file state after execute.
export function recomputeReceiptContentHash(receipt) {
  if (!receipt || typeof receipt !== "object") return null;
  const { content_hash, state_hash, receipt_log_path, ...body } = receipt;
  return contentHash(body);
}

export function measureSandboxState(fs, realRoot, activeName) {
  const filePath = joinInside(realRoot, activeName);
  if (!filePath) return null;
  try {
    const bytes = readRegularFile(fs, filePath);
    return Object.freeze({
      sandbox_root: realRoot,
      active_name: activeName,
      file_sha256: sha256Hex(bytes),
    });
  } catch {
    return null;
  }
}

export function recomputeReceiptStateHash(receipt) {
  if (!receipt || typeof receipt !== "object" || !receipt.measured_state) return null;
  return contentHash(receipt.measured_state);
}

function isSafeName(name) {
  return (
    typeof name === "string" &&
    name.length > 0 &&
    name !== "." &&
    name !== ".." &&
    !name.includes("/") &&
    !name.includes("\\") &&
    !RESERVED_NAMES.has(name) &&
    !name.startsWith(".node0-") &&
    SAFE_NAME.test(name)
  );
}

const EXPECTED_CONSENT_HASH = `sha256:${sha256Hex(NODE0_REVERSIBLE_EXECUTE_GO_PHRASE)}`;

// ── pure plan / decision (no fs) ────────────────────────────────────────────
/**
 * Decide whether a sandboxed reversible rename is eligible. Pure & fail-closed:
 * blocked_by is built from POSITIVE checks, so the default verdict is rejected.
 * (Inode-level guards — symlinks, realpath containment — are enforced by the
 * effectful runner, since they require the fs.)
 */
export function planReversibleRename({
  sandboxRoot,
  fileName,
  newName,
  goPhrase,
  actionType,
  // CR-03. Backup identity was `<from>.<content-hash-12>.bak`, so the same bytes
  // in the same file were the same backup no matter which authorized action
  // produced them. Since undo never removes a backup, a re-apply hit the `wx`
  // exclusive create and refused — making §5.9's "undo MUST be executable and
  // tested" impossible to satisfy on the atom actually being landed.
  //
  // The repair is IDENTITY, not exclusivity. `wx` is doing real security work; it
  // is what stops a backup being silently clobbered. Scoping the identity by the
  // authorized action and its phase lets a capsule apply → undo → re-apply while
  // every backup remains create-once. Omitted → legacy path shape, byte-identical.
  actionId,
  phase,
  // EFFECT-TIME PRECONDITION. A sealed observation is a fact about a past
  // moment, not a lease over future reality. Measured: after a valid p4 was
  // sealed, an external write changed the governed file and the final apply
  // renamed THAT content, sealing a receipt for bytes nobody consented to —
  // existence and type were re-derived at effect time, content was not.
  //
  //     PAST TRUTH != CURRENT PRECONDITION
  //
  // When supplied, the actuator compares it to the bytes it is about to move,
  // inside the same call that moves them, so the check cannot be stale.
  // Omitted → legacy behaviour, byte-identical for every existing caller.
  expectedBeforeHash,
} = {}) {
  const blocked_by = [];
  if (goPhrase !== NODE0_REVERSIBLE_EXECUTE_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  if (actionType !== NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE) {
    blocked_by.push("unsupported_action_type");
  }
  if (!isSafeName(fileName)) blocked_by.push("unsafe_source_name");
  if (!isSafeName(newName)) blocked_by.push("unsafe_target_name");
  if (typeof sandboxRoot !== "string" || sandboxRoot.length === 0) {
    blocked_by.push("sandbox_root_missing");
  }

  // Scoping is opt-in, but a MALFORMED scope is never silently ignored — that
  // would downgrade a scoped caller to the legacy identity without saying so.
  if (actionId !== undefined && !isSafeName(actionId)) blocked_by.push("unsafe_action_id");
  if (phase !== undefined && !isSafeName(phase)) blocked_by.push("unsafe_phase");
  if (phase !== undefined && actionId === undefined) blocked_by.push("phase_without_action_id");
  if (expectedBeforeHash !== undefined && !/^sha256:[0-9a-f]{64}$/.test(expectedBeforeHash)) {
    blocked_by.push("unsafe_expected_before_hash");
  }

  const eligible = blocked_by.length === 0;
  return Object.freeze({
    schema: NODE0_REVERSIBLE_EXECUTE_GATE_SCHEMA,
    truth_label: NODE0_REVERSIBLE_EXECUTE_TRUTH_LABEL,
    action_type: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
    sandbox_root: typeof sandboxRoot === "string" ? sandboxRoot : null,
    from: isSafeName(fileName) ? fileName : null,
    to: isSafeName(newName) ? newName : null,
    action_id: actionId !== undefined && isSafeName(actionId) ? actionId : null,
    phase: phase !== undefined && isSafeName(phase) ? phase : null,
    expected_before_hash:
      typeof expectedBeforeHash === "string" && /^sha256:[0-9a-f]{64}$/.test(expectedBeforeHash)
        ? expectedBeforeHash
        : null,
    consent_ok: !blocked_by.includes("consent_phrase_mismatch"),
    eligible,
    blocked_by: Object.freeze(blocked_by),
  });
}

// The boundary is attached only to receipts that passed every containment gate
// (the runner fails closed before any read/write otherwise), so for an executed
// receipt these constants ARE the observed reality, not an unchecked claim.
function buildBoundary({ fileRenamed, backupWritten }) {
  return Object.freeze({
    sandbox_only: true,
    network_used: false,
    delete_performed: false,
    secrets_accessed: false,
    path_traversal_blocked: true,
    sandbox_escape_blocked: true,
    reversible: true,
    file_renamed: fileRenamed === true,
    backup_written: backupWritten === true,
    undo_available: true,
  });
}

function blockedReceipt(plan, extraBlocks = []) {
  const blocked_by = [...new Set([...(plan.blocked_by || []), ...extraBlocks])];
  return Object.freeze({
    schema: NODE0_REVERSIBLE_EXECUTE_RECEIPT_SCHEMA,
    truth_label: NODE0_REVERSIBLE_EXECUTE_TRUTH_LABEL,
    executed: false,
    action_type: plan.action_type,
    sandbox_root: plan.sandbox_root,
    from: plan.from,
    to: plan.to,
    blocked_by: Object.freeze(blocked_by),
    boundary: buildBoundary({ fileRenamed: false, backupWritten: false }),
  });
}

// A basename joined onto the canonical sandbox root cannot escape when the name
// passes isSafeName (blocks `..`, slashes, and reserved control paths).
function joinInside(realRoot, name) {
  if (!isSafeName(name)) return null;
  const candidate = `${realRoot}/${name}`;
  return candidate.startsWith(`${realRoot}/`) ? candidate : null;
}

function fsHasSafeRead(fs) {
  return (
    fs &&
    typeof fs.openSync === "function" &&
    typeof fs.fstatSync === "function" &&
    typeof fs.readSync === "function" &&
    typeof fs.closeSync === "function"
  );
}

function readRegularFile(fs, path) {
  if (!fsHasSafeRead(fs)) {
    throw new Error("fs_adapter_missing_safe_read");
  }
  const O_RDONLY = fs.constants?.O_RDONLY ?? 0;
  const O_NOFOLLOW = fs.constants?.O_NOFOLLOW ?? 0;
  const fd = fs.openSync(path, O_RDONLY | O_NOFOLLOW);
  try {
    const st = fs.fstatSync(fd);
    if (!st.isFile()) throw new Error("unsafe_path");
    const buf = Buffer.alloc(st.size);
    let offset = 0;
    while (offset < st.size) {
      const n = fs.readSync(fd, buf, offset, st.size - offset, null);
      if (n <= 0) break;
      offset += n;
    }
    return buf;
  } finally {
    fs.closeSync(fd);
  }
}

function pathInsideRoot(fs, realRoot, absPath) {
  if (typeof absPath !== "string" || !absPath.startsWith(`${realRoot}/`)) {
    return false;
  }
  try {
    const resolved = fs.realpathSync(absPath);
    return resolved.startsWith(`${realRoot}/`) || resolved === realRoot;
  } catch {
    // Path may not exist yet (exclusive backup create) — string prefix under
    // canonical realRoot is sufficient once realRoot itself is resolved.
    return absPath.startsWith(`${realRoot}/`);
  }
}

function resolveReceiptLogPath(realRoot) {
  const candidate = `${realRoot}/${RECEIPT_LOG}`;
  return candidate.startsWith(`${realRoot}/`) ? candidate : null;
}

function ensureRegularReceiptLog(fs, logPath) {
  try {
    const lst = fs.lstatSync(logPath);
    if (lst.isSymbolicLink() || !lst.isFile()) return false;
  } catch {
    /* absent → append will create a regular file */
  }
  return true;
}

function receiptContentHashInSealedLog(logText, contentHashValue) {
  for (const line of String(logText).split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry?.content_hash === contentHashValue) return true;
    } catch {
      /* malformed line — ignore */
    }
  }
  return false;
}

// ── effectful runner (injected fs) ──────────────────────────────────────────
/**
 * Execute the planned rename against the injected fs. Inode-contained, no-clobber,
 * reversible, sealed. No mutation occurs unless the plan is eligible AND every
 * disk-level guard holds (non-symlink source, real in-sandbox backup dir, etc.).
 */
export function executeReversibleRename({ plan, fs, now = null } = {}) {
  if (!plan || plan.eligible !== true) {
    return blockedReceipt(plan || { blocked_by: ["plan_missing"] });
  }
  if (
    !fs ||
    !fsHasSafeRead(fs) ||
    typeof fs.renameSync !== "function" ||
    typeof fs.lstatSync !== "function" ||
    typeof fs.realpathSync !== "function"
  ) {
    return blockedReceipt(plan, ["fs_adapter_missing"]);
  }

  let realRoot;
  try {
    realRoot = fs.realpathSync(plan.sandbox_root);
  } catch {
    return blockedReceipt(plan, ["sandbox_root_missing"]);
  }

  const fromPath = joinInside(realRoot, plan.from);
  const toPath = joinInside(realRoot, plan.to);
  if (!fromPath || !toPath) return blockedReceipt(plan, ["sandbox_escape_blocked"]);

  // Source: must exist, be a NON-symlink regular file (lstat, never stat).
  let lst;
  try {
    lst = fs.lstatSync(fromPath);
  } catch {
    return blockedReceipt(plan, ["source_missing"]);
  }
  if (lst.isSymbolicLink()) return blockedReceipt(plan, ["unsafe_symlink_source"]);
  if (!lst.isFile()) return blockedReceipt(plan, ["source_not_a_file"]);

  // Target: must not exist (lstat catches a dangling/symlink target too → no clobber).
  try {
    fs.lstatSync(toPath);
    return blockedReceipt(plan, ["target_exists"]);
  } catch {
    /* absent → good */
  }

  // Backup dir: must be a real in-sandbox directory, never a symlink.
  const backupDir = `${realRoot}/${BACKUP_DIR}`;
  try {
    const bst = fs.lstatSync(backupDir);
    if (bst.isSymbolicLink() || !bst.isDirectory()) {
      return blockedReceipt(plan, ["backup_dir_unsafe"]);
    }
  } catch {
    /* absent → create below */
  }
  try {
    fs.mkdirSync(backupDir, { recursive: true });
    if (fs.realpathSync(backupDir) !== backupDir) {
      return blockedReceipt(plan, ["backup_dir_unsafe"]);
    }
  } catch {
    return blockedReceipt(plan, ["backup_dir_unsafe"]);
  }

  // Read the verified non-symlink source; measure the real before-hash.
  let beforeBytes;
  try {
    beforeBytes = readRegularFile(fs, fromPath);
  } catch {
    return blockedReceipt(plan, ["source_not_a_file"]);
  }
  const before_hash = `sha256:${sha256Hex(beforeBytes)}`;
  // The world may have drifted since the phase became eligible. Refuse rather
  // than move whatever happens to be there now.
  if (plan.expected_before_hash && plan.expected_before_hash !== before_hash) {
    return blockedReceipt(plan, ["before_hash_drifted"]);
  }

  // Backup BEFORE the action — exclusive create, never clobber.
  //
  // CR-03: the identity is action- and phase-scoped when the caller supplies one,
  // so two authorized actions over the same bytes are two backups rather than one
  // collision. `wx` is unchanged — exclusivity is what makes a backup trustworthy,
  // and the Attempt-1 collision was a weak identity wearing exclusivity's failure.
  const backupLeaf = `${plan.from}.${sha256Hex(beforeBytes).slice(0, 12)}.bak`;
  const scopedDir = plan.action_id
    ? `${backupDir}/${plan.action_id}${plan.phase ? `/${plan.phase}` : ""}`
    : backupDir;
  const backupPath = `${scopedDir}/${backupLeaf}`;
  if (!pathInsideRoot(fs, realRoot, scopedDir) || !pathInsideRoot(fs, realRoot, backupPath)) {
    return blockedReceipt(plan, ["backup_dir_unsafe"]);
  }
  if (scopedDir !== backupDir) {
    try {
      fs.mkdirSync(scopedDir, { recursive: true });
    } catch {
      return blockedReceipt(plan, ["backup_dir_unsafe"]);
    }
  }
  try {
    fs.writeFileSync(backupPath, beforeBytes, { flag: "wx" });
  } catch {
    return blockedReceipt(plan, ["backup_write_failed"]);
  }
  let backup_hash;
  try {
    backup_hash = `sha256:${sha256Hex(readRegularFile(fs, backupPath))}`;
  } catch {
    return blockedReceipt(plan, ["backup_write_failed"]);
  }

  const logPath = resolveReceiptLogPath(realRoot);
  if (!logPath || !ensureRegularReceiptLog(fs, logPath)) {
    return blockedReceipt(plan, ["receipt_log_unsafe"]);
  }

  // The action — rollback rename if sealing fails after mutation.
  let renamed = false;
  try {
    fs.renameSync(fromPath, toPath);
    renamed = true;
    const after_hash = `sha256:${sha256Hex(readRegularFile(fs, toPath))}`;

    // POST-MOVE IDENTITY. `renameSync` moves a PATHNAME, and the verified read
    // happened earlier — so between them the source pathname can be repointed at
    // other content. Measured with a deterministic interleaving through the
    // injected fs: with this comparison removed, attacker bytes land at the
    // target and carry an authoritative success receipt (`executed: true`).
    //
    //     VERIFIED OBJECT != MOVED OBJECT
    //
    // The comparison already existed to police the reversible invariant, and it
    // happens to close this too — but an unnamed safeguard is one refactor from
    // deletion, so the reason is now distinct and the attack has a test.
    if (after_hash !== before_hash) {
      throw new Error("post_move_identity_mismatch");
    }
    if (backup_hash !== before_hash) {
      throw new Error("backup_identity_mismatch");
    }

    const measured_state = measureSandboxState(fs, realRoot, plan.to);
    if (!measured_state) {
      throw new Error("state_measurement_failed");
    }
    const state_hash = contentHash(measured_state);

    const undo_manifest = Object.freeze({
      steps: Object.freeze([
        Object.freeze({ op: "rename", from: plan.to, to: plan.from }),
      ]),
      expected_restored_hash: before_hash,
    });

    const body = {
      schema: NODE0_REVERSIBLE_EXECUTE_RECEIPT_SCHEMA,
      truth_label: NODE0_REVERSIBLE_EXECUTE_TRUTH_LABEL,
      executed: true,
      action_type: plan.action_type,
      sandbox_root: plan.sandbox_root,
      from: plan.from,
      to: plan.to,
      // CR-03: the receipt names the authorized action and phase that produced it,
      // so an undo can be required to name the exact action it reverses instead of
      // reversing whatever receipt it is handed.
      action_id: plan.action_id ?? null,
      phase: plan.phase ?? null,
      before_hash,
      after_hash,
      measured_state,
      backup: Object.freeze({ path: backupPath, hash: backup_hash }),
      undo: undo_manifest,
      consent: Object.freeze({ go_phrase_hash: EXPECTED_CONSENT_HASH, mode: "exact_execute" }),
      executed_at: now,
      blocked_by: Object.freeze([]),
      boundary: buildBoundary({ fileRenamed: true, backupWritten: true }),
    };
    const receipt = {
      ...body,
      state_hash,
      content_hash: contentHash(body),
    };

    fs.appendFileSync(logPath, `${JSON.stringify(receipt)}\n`);
    return Object.freeze({ ...receipt, receipt_log_path: logPath });
  } catch (err) {
    if (renamed) {
      try {
        fs.renameSync(toPath, fromPath);
      } catch {
        /* best-effort rollback */
      }
    }
    // A security-relevant refusal must not read like a disk error. Anything
    // else stays "execute_failed" so an unexpected fault is never dressed up as
    // a known, handled condition.
    const known = err?.message === "post_move_identity_mismatch" || err?.message === "backup_identity_mismatch";
    return blockedReceipt(plan, [known ? err.message : "execute_failed"]);
  }
}

/**
 * Reverse a sealed execute receipt and PROVE restoration against the INDEPENDENT
 * on-disk backup (not the receipt's self-declared before_hash). Refuses unless the
 * receipt passes verifyExecuteReceipt first.
 */
export function undoReversibleRename({ receipt, fs, actionId } = {}) {
  if (!receipt || receipt.executed !== true) {
    return { undone: false, proven: false, reason: "not_an_executed_receipt" };
  }
  // CR-03: an undo must name the exact action it reverses. This is CROSS-ACTION
  // BINDING PROTECTION, NOT AUTHORIZATION — action_id is recorded in the receipt,
  // so a receipt holder can read it. It stops an undo being pointed at the wrong
  // action; it is not a credential. Real undo authority comes from the capsule.
  // A legacy receipt (action_id null) keeps the previous behaviour so already-
  // sealed receipts stay undoable.
  if (receipt.action_id != null && actionId !== receipt.action_id) {
    return { undone: false, proven: false, reason: "undo_action_mismatch" };
  }
  if (
    !fs ||
    !fsHasSafeRead(fs) ||
    typeof fs.renameSync !== "function" ||
    typeof fs.lstatSync !== "function" ||
    typeof fs.realpathSync !== "function"
  ) {
    return { undone: false, proven: false, reason: "fs_adapter_missing" };
  }
  // Bind to receipt integrity/invariants and sealed-log presence before touching disk.
  const v = verifyExecuteReceipt(receipt, { fs });
  if (!v.ok) return { undone: false, proven: false, reason: `receipt_invalid:${v.reason}` };

  let realRoot;
  try {
    realRoot = fs.realpathSync(receipt.sandbox_root);
  } catch {
    return { undone: false, proven: false, reason: "sandbox_root_missing" };
  }
  const fromPath = joinInside(realRoot, receipt.to); // current name
  const toPath = joinInside(realRoot, receipt.from); // original name
  if (!fromPath || !toPath) {
    return { undone: false, proven: false, reason: "sandbox_escape_blocked" };
  }
  if (
    !receipt.backup ||
    typeof receipt.backup.path !== "string" ||
    !pathInsideRoot(fs, realRoot, receipt.backup.path)
  ) {
    return { undone: false, proven: false, reason: "unsafe_backup_path" };
  }
  // Current must be a non-symlink regular file; original must be absent.
  let lst;
  try {
    lst = fs.lstatSync(fromPath);
  } catch {
    return { undone: false, proven: false, reason: "undo_preconditions_failed" };
  }
  if (lst.isSymbolicLink() || !lst.isFile()) {
    return { undone: false, proven: false, reason: "unsafe_current_file" };
  }
  try {
    fs.lstatSync(toPath);
    return { undone: false, proven: false, reason: "undo_preconditions_failed" };
  } catch {
    /* absent → good */
  }

  // INDEPENDENT ground truth: the backup bytes written at execute time.
  let backupBytes;
  try {
    backupBytes = readRegularFile(fs, receipt.backup.path);
  } catch {
    return { undone: false, proven: false, reason: "backup_unreadable" };
  }
  if (`sha256:${sha256Hex(backupBytes)}` !== receipt.backup.hash) {
    return { undone: false, proven: false, reason: "backup_hash_mismatch" };
  }

  let currentBytes;
  try {
    currentBytes = readRegularFile(fs, fromPath);
  } catch {
    return { undone: false, proven: false, reason: "unsafe_current_file" };
  }
  if (!Buffer.isBuffer(currentBytes) || !currentBytes.equals(backupBytes)) {
    return { undone: false, proven: false, reason: "current_bytes_diverged" };
  }

  // Reverse the rename, then PROVE by comparing the restored bytes to the backup.
  try {
    fs.renameSync(fromPath, toPath);
    const restoredBytes = readRegularFile(fs, toPath);
    const restored_hash = `sha256:${sha256Hex(restoredBytes)}`;
    const proven =
      Buffer.isBuffer(restoredBytes) &&
      Buffer.isBuffer(backupBytes) &&
      restoredBytes.equals(backupBytes) &&
      restored_hash === receipt.backup.hash;

    // CAPSULE-PHASE-CAUSAL-PROVENANCE-1A. Until now this returned a plain object
    // and sealed nothing, so no artifact existed to prove the undo TRANSITION
    // ran — which is why a downstream verifier had to infer it from the restored
    // world, and a restored world is producible by anything. The undo now seals
    // its own log-anchored receipt naming the apply it reverses.
    const sealed = sealUndoReceipt({
      fs,
      realRoot,
      of: receipt,
      restored_hash,
      proven,
      // DIAGNOSTIC ONLY, and inherited from the apply so the pair reads together.
      // No expiry, ordering, freshness or validity decision may read it: that
      // would make a caller-supplied field into causal time. Ordering is carried
      // by of_receipt_hash and by position in the append-only log.
      now: typeof receipt.now === "string" ? receipt.now : null,
    });
    // RECEIPT_OBJECT_EXISTS != RECEIPT_WAS_SEALED. The append can fail, and a
    // receipt-shaped object in hand is not provenance. The capsule already
    // requires log membership, but a consumer must not have to know that to be
    // safe, so the outcome is named here rather than inferred from a truthy field.
    return {
      undone: true,
      proven,
      restored_hash,
      receipt: sealed.receipt,
      receipt_sealed: sealed.sealed,
    };
  } catch {
    return { undone: false, proven: false, reason: "undo_execution_failed" };
  }
}

export const NODE0_REVERSIBLE_UNDO_RECEIPT_SCHEMA =
  "bizra.node0.node0_reversible_undo_receipt.v0.1";
// v0.2, and the version bump is the point. v0.1 encoded each name as
// `hash | null`; v0.2 encodes `{state, hash?, reason?}`. Same ID with different
// wire meaning would be SCHEMA NAME != SCHEMA CONTRACT — the same disease as
// every other representation defect this line of work has closed. A v0.1
// artifact now fails the schema check outright, and there is deliberately NO
// compatibility shim: normalising a legacy bare `null` into ABSENT would
// reintroduce the exact vulnerability through the back door.
export const NODE0_REVERSIBLE_OBSERVATION_SCHEMA =
  "bizra.node0.node0_reversible_state_observation.v0.2";
export const NODE0_REVERSIBLE_OBSERVATION_SCHEMA_LEGACY_V0_1 =
  "bizra.node0.node0_reversible_state_observation.v0.1";

// OBSERVATION-ABSENCE-SEMANTICS-1A. An observation used to write `null` from a
// bare catch, so a genuine absence, an O_NOFOLLOW refusal, a directory and an
// io error were one value — and the phase predicates read `null` as "absent".
// Planting a symlink where a file must be gone therefore satisfied the
// predicate: blindness masquerading as absence. These four states keep the
// refusal and its meaning separate.
//
//   UNKNOWN != FALSE   ·   UNREADABLE != ABSENT   ·   UNSAFE != ABSENT
export const OBSERVED_PRESENT = "PRESENT";
export const OBSERVED_ABSENT = "ABSENT";
export const OBSERVED_UNSAFE = "UNSAFE";
export const OBSERVED_UNREADABLE = "UNREADABLE";

/**
 * Observe ONE pathname and say which of the four realities it is.
 *
 * `lstat` first, so a symlink is identified as a symlink rather than inferred
 * from a read failure — the refusal is deliberate, and naming it is what stops a
 * downstream predicate from reading it as nothing-is-there.
 */
function observeOne(fs, path) {
  let lst;
  try {
    lst = fs.lstatSync(path);
  } catch (err) {
    // ENOENT is the ONLY error that means absent. Anything else is a failure to
    // observe, which is not evidence about what is there.
    return err && err.code === "ENOENT"
      ? Object.freeze({ state: OBSERVED_ABSENT })
      : Object.freeze({ state: OBSERVED_UNREADABLE, reason: err?.code ?? "lstat_failed" });
  }
  if (lst.isSymbolicLink()) return Object.freeze({ state: OBSERVED_UNSAFE, reason: "symlink" });
  if (!lst.isFile()) return Object.freeze({ state: OBSERVED_UNSAFE, reason: "non_regular" });
  try {
    return Object.freeze({ state: OBSERVED_PRESENT, hash: `sha256:${sha256Hex(readRegularFile(fs, path))}` });
  } catch (err) {
    return Object.freeze({ state: OBSERVED_UNREADABLE, reason: err?.code ?? "read_failed" });
  }
}

/** Seal the undo transition into the same append-only log the apply is sealed in. */
function sealUndoReceipt({ fs, realRoot, of, restored_hash, proven, now }) {
  const body = {
    schema: NODE0_REVERSIBLE_UNDO_RECEIPT_SCHEMA,
    action_id: of.action_id ?? null,
    phase: of.phase ?? null,
    // The apply this undo reverses, bound by that receipt's own content hash.
    of_receipt_hash: of.content_hash,
    of_from: of.from,
    of_to: of.to,
    restored_hash,
    proven,
    now: now ?? null,
  };
  const receipt = Object.freeze({ ...body, content_hash: contentHash(body) });
  const logPath = resolveReceiptLogPath(realRoot);
  if (!logPath || !ensureRegularReceiptLog(fs, logPath)) return { receipt, sealed: false };
  try {
    fs.appendFileSync(logPath, `${JSON.stringify(receipt)}\n`);
  } catch {
    // An unwritable log must not undo the undo — the restoration already
    // happened and the caller still holds the receipt. But it is NOT sealed,
    // and saying so is the whole point: unsealed provenance is no provenance.
    return { receipt, sealed: false };
  }
  return { receipt, sealed: true };
}

/**
 * Seal an OBSERVATION of the sandbox into the same log.
 *
 * A multi-step capsule's intermediate states are gone by the time the next phase
 * is authorized, so an observation must be recorded WHEN MADE — re-reading the
 * disk later answers a different question, and reaching for a later receipt as a
 * substitute credits post-hoc inference as authority.
 *
 * Reads through `readRegularFile`, the same O_NOFOLLOW regular-file reader the
 * actuator uses: a verifier must never have a weaker path policy than the thing
 * it judges. An unreadable or non-regular name observes as `null` — absent, never
 * a hash borrowed from wherever a symlink pointed.
 */
export function sealStateObservation({ sandboxRoot, actionId, phase, names, fs, now = null } = {}) {
  if (!fs || !fsHasSafeRead(fs) || typeof fs.realpathSync !== "function") {
    return { sealed: false, reason: "fs_adapter_missing" };
  }
  if (!isSafeName(actionId) || !isSafeName(phase) || !Array.isArray(names)) {
    return { sealed: false, reason: "unsafe_observation_scope" };
  }
  let realRoot;
  try {
    realRoot = fs.realpathSync(sandboxRoot);
  } catch {
    return { sealed: false, reason: "sandbox_root_missing" };
  }

  const observed = {};
  for (const name of names) {
    if (!isSafeName(name)) return { sealed: false, reason: "unsafe_observed_name" };
    const path = joinInside(realRoot, name);
    if (!pathInsideRoot(fs, realRoot, path)) return { sealed: false, reason: "sandbox_escape_blocked" };
    observed[name] = observeOne(fs, path);
  }

  const body = {
    schema: NODE0_REVERSIBLE_OBSERVATION_SCHEMA,
    action_id: actionId,
    phase,
    observed,
    now,
  };
  const observation = Object.freeze({ ...body, content_hash: contentHash(body) });
  const logPath = resolveReceiptLogPath(realRoot);
  if (logPath && ensureRegularReceiptLog(fs, logPath)) {
    try {
      fs.appendFileSync(logPath, `${JSON.stringify(observation)}\n`);
    } catch {
      return { sealed: false, reason: "observation_log_unwritable", observation };
    }
  }
  return { sealed: true, observation };
}

/**
 * Re-validate a sealed receipt: content-hash integrity, content-preservation,
 * canonical consent hash, the FULL boundary invariant, and — when an fs adapter is
 * supplied — presence in the sealed on-disk append-only log (authenticity bind).
 */
export function verifyExecuteReceipt(receipt, { fs } = {}) {
  if (!receipt || typeof receipt !== "object") {
    return { ok: false, reason: "receipt_not_object" };
  }
  if (receipt.schema !== NODE0_REVERSIBLE_EXECUTE_RECEIPT_SCHEMA) {
    return { ok: false, reason: "schema_mismatch" };
  }
  const { content_hash, state_hash, receipt_log_path, ...body } = receipt;
  if (contentHash(body) !== content_hash) {
    return { ok: false, reason: "content_hash_mismatch", expected: contentHash(body) };
  }
  if (
    receipt.executed === true &&
    (!receipt.measured_state ||
      recomputeReceiptStateHash(receipt) !== state_hash)
  ) {
    return { ok: false, reason: "state_hash_mismatch" };
  }
  if (receipt.executed === true && receipt.before_hash !== receipt.after_hash) {
    return { ok: false, reason: "content_not_preserved_by_rename" };
  }
  if (
    receipt.executed === true &&
    (!receipt.consent || receipt.consent.go_phrase_hash !== EXPECTED_CONSENT_HASH)
  ) {
    return { ok: false, reason: "consent_hash_invalid" };
  }
  const b = receipt.boundary;
  if (
    !b ||
    b.sandbox_only !== true ||
    b.network_used !== false ||
    b.delete_performed !== false ||
    b.secrets_accessed !== false ||
    b.path_traversal_blocked !== true ||
    b.sandbox_escape_blocked !== true ||
    b.reversible !== true ||
    b.undo_available !== true
  ) {
    return { ok: false, reason: "boundary_invariant_violated" };
  }
  if (receipt.executed === true && (b.file_renamed !== true || b.backup_written !== true)) {
    return { ok: false, reason: "executed_effects_missing" };
  }
  // Authenticity bind: the receipt must appear in the sealed on-disk log.
  if (fs && receipt.executed === true) {
    try {
      const realRoot = fs.realpathSync(receipt.sandbox_root);
      const remeasured = measureSandboxState(fs, realRoot, receipt.to);
      if (!remeasured || contentHash(remeasured) !== receipt.state_hash) {
        return { ok: false, reason: "state_not_anchored_to_disk" };
      }
      const logPath = resolveReceiptLogPath(realRoot);
      if (!logPath || !ensureRegularReceiptLog(fs, logPath)) {
        return { ok: false, reason: "receipt_log_unsafe" };
      }
      const log = readRegularFile(fs, logPath).toString("utf8");
      if (!receiptContentHashInSealedLog(log, content_hash)) {
        return { ok: false, reason: "not_in_sealed_log" };
      }
    } catch {
      return { ok: false, reason: "sealed_log_unverifiable" };
    }
  }
  return { ok: true };
}

export const NODE0_REVERSIBLE_EXECUTE_GATE_PROBE = "node0-loop-probe.txt";
export const NODE0_REVERSIBLE_EXECUTE_GATE_TARGET =
  "node0-governed-action-candidate.txt";

export function defaultNode0ReversibleExecuteGateFixture() {
  return Object.freeze({
    fileName: NODE0_REVERSIBLE_EXECUTE_GATE_PROBE,
    newName: NODE0_REVERSIBLE_EXECUTE_GATE_TARGET,
    goPhrase: NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
    actionType: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
  });
}

export function runNode0ReversibleExecuteGate({
  fs,
  sandboxRoot,
  fixture = defaultNode0ReversibleExecuteGateFixture(),
  now = "2026-06-28T18:00:00.000Z",
} = {}) {
  const blocked_by = [];
  if (
    !fs ||
    !fsHasSafeRead(fs) ||
    typeof fs.renameSync !== "function" ||
    typeof fs.lstatSync !== "function" ||
    typeof fs.realpathSync !== "function"
  ) {
    blocked_by.push("fs_adapter_missing");
  }
  const plan = planReversibleRename({
    sandboxRoot,
    fileName: fixture.fileName,
    newName: fixture.newName,
    goPhrase: fixture.goPhrase,
    actionType: fixture.actionType,
  });
  if (!plan.eligible) {
    blocked_by.push(...plan.blocked_by);
  }
  let receipt = null;
  let undo = null;
  if (blocked_by.length === 0) {
    receipt = executeReversibleRename({ plan, fs, now });
    if (receipt.executed !== true) {
      blocked_by.push(...(receipt.blocked_by || []));
    } else {
      const verified = verifyExecuteReceipt(receipt, { fs });
      if (!verified.ok) blocked_by.push(`receipt:${verified.reason}`);
      undo = undoReversibleRename({ receipt, fs });
      if (!undo.proven) {
        blocked_by.push(`undo_not_proven:${undo.reason ?? "unknown"}`);
      }
    }
  }
  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: NODE0_REVERSIBLE_EXECUTE_GATE_SCHEMA,
    truth_label: NODE0_REVERSIBLE_EXECUTE_TRUTH_LABEL,
    action_type: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
    sandbox_root: sandboxRoot ?? null,
    undo_proven: undo?.proven === true,
    content_hash: receipt?.content_hash ?? null,
    state_hash: receipt?.state_hash ?? null,
    blocked_by: Object.freeze(blocked_by),
    receipt,
    undo,
  });
}
