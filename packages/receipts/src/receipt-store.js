import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";
import { homedir, tmpdir } from "node:os";

const DEFAULT_MAX_FILES = 500;
const DEFAULT_MAX_JSON_BYTES = 1024 * 1024;

// v0.1.1 (2026-05-20): F-3 fix · DEMA_HOME path-containment guard.
// State Boundary Matrix v0.1 #7 classifies DEMA_HOME as Constitutional. Prior
// version accepted process.env.DEMA_HOME into receipt path joining without
// containment check · a crafted `..` value would escape the receipts root.
// This guard enforces the matrix's classification at the source level (the
// canonical pattern ADR-015 calls for: deterministic verifier · not LLM memory).
//
// Allowed roots: user homedir() OR tmpdir() · the latter enables the existing
// withReceiptFixture test pattern (mkdtempSync writes under /tmp). Both are
// OS-managed paths · path traversal to /etc, /root, /var, etc. is rejected.
function safeReceiptsRoot(root) {
  const resolvedRoot = resolve(root);
  const resolvedHome = resolve(homedir());
  const resolvedTmp = resolve(tmpdir());
  const underHome = resolvedRoot === resolvedHome || resolvedRoot.startsWith(resolvedHome + sep);
  const underTmp = resolvedRoot === resolvedTmp || resolvedRoot.startsWith(resolvedTmp + sep);
  if (!underHome && !underTmp) {
    throw new Error(
      `Receipts root must be under homedir() or tmpdir() · refused: ${root} (resolved: ${resolvedRoot})`
    );
  }
  return resolvedRoot;
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

async function collectReceiptFiles(dir, files, { maxFiles, prefix = "" }) {
  if (files.length >= maxFiles) return;

  const entries = await readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (files.length >= maxFiles) return;
    const relativePath = prefix ? join(prefix, entry.name) : entry.name;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectReceiptFiles(path, files, { maxFiles, prefix: relativePath });
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
  let receiptsRoot;
  try {
    receiptsRoot = join(safeReceiptsRoot(root), "receipts");
  } catch {
    // F-3: path-containment failure · return empty (matches existing fail-soft)
    return [];
  }
  const limits = normalizeListOptions(options);
  if (limits.maxFiles === 0 || limits.limit === 0) return [];

  try {
    const files = [];
    await collectReceiptFiles(receiptsRoot, files, limits);
    const page = files.slice(limits.offset, limits.offset + limits.limit);
    return Promise.all(page.map((file) => receiptSummary(join(receiptsRoot, file), limits)));
  } catch {
    return [];
  }
}

export async function readReceipt(
  selector,
  root = process.env.DEMA_HOME || join(homedir(), ".dema"),
  options = {}
) {
  // F-3: containment guard · throws on traversal · readReceipt already throws
  // on other errors so propagating is the right semantic here.
  safeReceiptsRoot(root);
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
