import { readdir, readFile, stat, realpath } from "node:fs/promises";
import { basename, join, resolve, relative, isAbsolute, sep } from "node:path";
import { homedir } from "node:os";

const DEFAULT_MAX_FILES = 500;
const DEFAULT_MAX_JSON_BYTES = 1024 * 1024;

// v0.1.2 (2026-05-20 · PR #64 review feedback): receipt root containment.
//
// State Boundary Matrix v0.1 #7 classifies DEMA_HOME as Constitutional.
// v0.1.1 (this slice's first attempt) restricted DEMA_HOME to homedir() or
// tmpdir(), which 3 reviewers flagged as too strict (operators can legitimately
// declare a project-local state root anywhere on disk). v0.1.2 corrects this:
//
//   1. safeReceiptsRoot() accepts ANY operator-declared root · pure path
//      normalization via resolve() · `..` segments collapse · no whitelist
//   2. Per-entry containment is enforced inside the receipts iteration via
//      path.relative() + realpath() · catches symlink escapes and traversal
//      attempts at FILE granularity rather than ROOT granularity
//   3. Cross-platform safe: path module's relative()/resolve() are platform-aware
//      (handles Windows case-insensitivity + separators via path.win32/posix)
function safeReceiptsRoot(root) {
  // Operator-declared root · `resolve()` collapses `..` and produces an
  // absolute path. No whitelist. Containment is enforced per-entry below.
  return resolve(root);
}

// Returns true if `candidatePath` lives inside `rootPath` after symlink
// resolution. Both args should be absolute paths. Falls back to literal-path
// comparison when realpath() can't resolve (e.g., target doesn't exist yet).
async function isContainedReceipt(rootPath, candidatePath) {
  // Cheap literal-path check first (no I/O · catches most traversal attempts)
  const litRel = relative(rootPath, candidatePath);
  if (litRel === ".." || litRel.startsWith(".." + sep) || isAbsolute(litRel)) {
    return false;
  }
  // realpath check catches symlink escapes
  try {
    const realRoot = await realpath(rootPath);
    const realCand = await realpath(candidatePath);
    const realRel = relative(realRoot, realCand);
    if (realRel === ".." || realRel.startsWith(".." + sep) || isAbsolute(realRel)) {
      return false;
    }
    return true;
  } catch {
    // realpath failed (candidate doesn't exist or root doesn't exist) ·
    // fall back to the literal-path result (already known to be contained)
    return true;
  }
}

const LIST_BOUNDARY = Object.freeze({
  store_scope: "local_read_list",
  operation_boundary: "read_list_only_no_mint",
  issuer_boundary: "governed_runtime_issues_receipts"
});

function nonNegativeInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

function normalizeListOptions({
  maxFiles = DEFAULT_MAX_FILES,
  maxJsonBytes = DEFAULT_MAX_JSON_BYTES,
  limit,
  offset = 0
} = {}) {
  const normalizedMaxFiles = nonNegativeInteger(maxFiles, DEFAULT_MAX_FILES);
  return {
    maxFiles: normalizedMaxFiles,
    maxJsonBytes: nonNegativeInteger(maxJsonBytes, DEFAULT_MAX_JSON_BYTES),
    limit: Math.min(
      nonNegativeInteger(limit, normalizedMaxFiles),
      normalizedMaxFiles
    ),
    offset: nonNegativeInteger(offset, 0)
  };
}

async function collectReceiptFiles(dir, files, { maxFiles, prefix = "", containmentRoot }) {
  if (files.length >= maxFiles) return;

  const entries = await readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (files.length >= maxFiles) return;
    const relativePath = prefix ? join(prefix, entry.name) : entry.name;
    const path = join(dir, entry.name);

    // v0.1.2: containment check · symlinks/traversal escaping the receipts
    // root are silently skipped during enumeration. This catches a symlinked
    // subdir or file that would otherwise escape via realpath resolution.
    if (containmentRoot && !(await isContainedReceipt(containmentRoot, path))) {
      continue;
    }

    if (entry.isDirectory()) {
      await collectReceiptFiles(path, files, { maxFiles, prefix: relativePath, containmentRoot });
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(relativePath);
    }
  }
}

function unreadableReceipt(path, fields = {}) {
  return {
    path,
    unreadable: true,
    ...LIST_BOUNDARY,
    ...fields
  };
}

async function receiptSummary(path, { maxJsonBytes }) {
  try {
    const fileStat = await stat(path);
    if (fileStat.size > maxJsonBytes) {
      return unreadableReceipt(path, {
        reason: "receipt_json_too_large",
        error: `Receipt JSON exceeds maxJsonBytes (${fileStat.size} > ${maxJsonBytes})`,
        size_bytes: fileStat.size,
        max_json_bytes: maxJsonBytes
      });
    }

    const data = JSON.parse(await readFile(path, "utf8"));
    return {
      path,
      ...LIST_BOUNDARY,
      receipt_id: data.receipt_id,
      artifact_id: data.artifact_id,
      action: data.action,
      truth_label: data.truth_label,
      created_at: data.created_at
    };
  } catch (err) {
    return unreadableReceipt(path, {
      reason: err instanceof SyntaxError ? "malformed_json" : "receipt_read_error",
      error: err instanceof Error ? err.message : String(err)
    });
  }
}

export async function listReceipts(
  root = process.env.DEMA_HOME || join(homedir(), ".dema"),
  options = {}
) {
  const normalizedRoot = safeReceiptsRoot(root);
  const receiptsRoot = join(normalizedRoot, "receipts");
  const limits = normalizeListOptions(options);
  if (limits.maxFiles === 0 || limits.limit === 0) return [];

  try {
    const files = [];
    // v0.1.2: pass containment root for per-entry symlink/traversal detection
    await collectReceiptFiles(receiptsRoot, files, { ...limits, containmentRoot: receiptsRoot });
    const page = files.slice(limits.offset, limits.offset + limits.limit);
    return Promise.all(page.map((file) => receiptSummary(join(receiptsRoot, file), limits)));
  } catch {
    // Fail-soft: any IO error (path doesn't exist, permission denied, etc.)
    // returns []. Boundary violations are caught BEFORE this by the
    // containment guard inside collectReceiptFiles.
    return [];
  }
}

export async function readReceipt(
  selector,
  root = process.env.DEMA_HOME || join(homedir(), ".dema"),
  options = {}
) {
  const receipts = await listReceipts(root, options);
  const pathMatches = receipts.filter((receipt) => receipt.path === selector);
  const idMatches = receipts.filter(
    (receipt) => receipt.receipt_id === selector || receipt.artifact_id === selector
  );
  const filenameMatches = receipts.filter((receipt) => basename(receipt.path) === selector);
  const matches = pathMatches.length ? pathMatches : idMatches.length ? idMatches : filenameMatches;

  if (matches.length > 1) {
    throw new Error(
      `Ambiguous receipt selector: ${selector}. Use receipt_id, artifact_id, or exact path.`
    );
  }

  if (matches.length === 0) {
    throw new Error(`Receipt not found: ${selector}`);
  }

  if (matches[0].unreadable) {
    throw new Error(`Receipt unreadable: ${selector} (${matches[0].reason ?? "unknown"})`);
  }

  return JSON.parse(await readFile(matches[0].path, "utf8"));
}
