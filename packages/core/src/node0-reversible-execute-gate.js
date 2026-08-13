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

  const eligible = blocked_by.length === 0;
  return Object.freeze({
    schema: NODE0_REVERSIBLE_EXECUTE_GATE_SCHEMA,
    truth_label: NODE0_REVERSIBLE_EXECUTE_TRUTH_LABEL,
    action_type: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
    sandbox_root: typeof sandboxRoot === "string" ? sandboxRoot : null,
    from: isSafeName(fileName) ? fileName : null,
    to: isSafeName(newName) ? newName : null,
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

  // Backup BEFORE the action — exclusive create, never clobber.
  const backupPath = `${backupDir}/${plan.from}.${sha256Hex(beforeBytes).slice(0, 12)}.bak`;
  if (!pathInsideRoot(fs, realRoot, backupPath)) {
    return blockedReceipt(plan, ["backup_dir_unsafe"]);
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
    if (backup_hash !== before_hash || after_hash !== before_hash) {
      throw new Error("reversible_invariant_failed");
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
  } catch {
    if (renamed) {
      try {
        fs.renameSync(toPath, fromPath);
      } catch {
        /* best-effort rollback */
      }
    }
    return blockedReceipt(plan, ["execute_failed"]);
  }
}

/**
 * Reverse a sealed execute receipt and PROVE restoration against the INDEPENDENT
 * on-disk backup (not the receipt's self-declared before_hash). Refuses unless the
 * receipt passes verifyExecuteReceipt first.
 */
export function undoReversibleRename({ receipt, fs } = {}) {
  if (!receipt || receipt.executed !== true) {
    return { undone: false, proven: false, reason: "not_an_executed_receipt" };
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
    return { undone: true, proven, restored_hash };
  } catch {
    return { undone: false, proven: false, reason: "undo_execution_failed" };
  }
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
