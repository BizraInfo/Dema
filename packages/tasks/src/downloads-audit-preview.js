// downloads.audit.preview — first registered task in the active kernel.
//
// Scope contract (from B1 doctrine):
//   - Read-only. Inspects the target directory.
//   - No moves, deletes, renames.
//   - No network.
//   - No mutation of any file in the target.
//   - Writes ONE local receipt to ~/.dema/receipts/.
//   - Receipt carries truth_label: MEASURED + scope: read-only.
//
// What it produces:
//   - File count by extension
//   - Total bytes
//   - Top-N largest files
//   - The receipt itself, viewable via `dema receipts`

import { readdir, stat, mkdir, writeFile } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import { homedir } from "node:os";
import { createHash, randomUUID } from "node:crypto";

const TASK_ID = "downloads.audit.preview";
const SCHEMA = "bizra.dema.task_receipt.v0.1";

function defaultDownloadsRoot() {
  return process.env.DEMA_DOWNLOADS_ROOT || join(homedir(), "Downloads");
}

function defaultDemaRoot() {
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

async function safeStat(path) {
  try {
    return await stat(path);
  } catch {
    return null;
  }
}

async function scanFlat(root) {
  // Single-level scan. Avoids unbounded recursion + symlink loops.
  // For B1, a flat scan is enough to demonstrate read-only-with-receipt.
  // Recursive scan is a future task variant (downloads.audit.deep).
  const entries = [];
  let names;
  try {
    names = await readdir(root);
  } catch (err) {
    if (err.code === "ENOENT")
      return { error: `not_found:${root}`, entries: [] };
    if (err.code === "EACCES")
      return { error: `permission_denied:${root}`, entries: [] };
    throw err;
  }
  for (const name of names) {
    const path = join(root, name);
    const s = await safeStat(path);
    if (!s) continue;
    if (s.isFile()) {
      entries.push({
        name,
        ext: extname(name).toLowerCase() || "(none)",
        size: s.size,
        mtime: s.mtime.toISOString(),
      });
    } else if (s.isDirectory()) {
      entries.push({
        name,
        ext: "(dir)",
        size: 0,
        mtime: s.mtime.toISOString(),
      });
    }
  }
  return { entries };
}

function summarize(entries) {
  const byExt = {};
  let totalBytes = 0;
  for (const e of entries) {
    byExt[e.ext] = (byExt[e.ext] ?? 0) + 1;
    totalBytes += e.size;
  }
  const topLargest = entries
    .filter((e) => e.ext !== "(dir)")
    .slice()
    .sort((a, b) => b.size - a.size)
    .slice(0, 10)
    .map((e) => ({ name: e.name, size: e.size }));
  return {
    file_count: entries.filter((e) => e.ext !== "(dir)").length,
    dir_count: entries.filter((e) => e.ext === "(dir)").length,
    total_bytes: totalBytes,
    by_extension: byExt,
    top_largest: topLargest,
  };
}

function digest(payload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function runDownloadsAuditPreview({
  downloadsRoot = defaultDownloadsRoot(),
  demaRoot = defaultDemaRoot(),
  now = new Date(),
  writeReceipt = true,
} = {}) {
  const startedAt = now.toISOString();
  const scan = await scanFlat(downloadsRoot);
  const summary =
    scan.entries.length > 0 || !scan.error ? summarize(scan.entries) : null;
  const finishedAt = new Date().toISOString();

  const receipt = {
    schema: SCHEMA,
    receipt_id: `task-${TASK_ID}-${randomUUID()}`,
    task_id: TASK_ID,
    truth_label: "MEASURED",
    created_at: finishedAt,
    started_at: startedAt,
    scope: "read-only",
    target: downloadsRoot,
    rollback_required: false,
    consent_acknowledged: true,
    sat_verdict: "PARTIAL_PLACEHOLDER",
    sat_verdict_reason:
      "SAT verifier sibling not yet implemented in v0.3.0; verdict is a placeholder. Real verification arrives with v0.3.2.",
    error: scan.error ?? null,
    result: summary,
    payload_digest: null,
  };
  receipt.payload_digest = digest({
    task_id: receipt.task_id,
    target: receipt.target,
    scope: receipt.scope,
    result: receipt.result,
    error: receipt.error,
  });

  if (writeReceipt) {
    const receiptsDir = join(demaRoot, "receipts");
    await mkdir(receiptsDir, { recursive: true });
    const filename = `${receipt.receipt_id}.json`;
    const filepath = join(receiptsDir, filename);
    await writeFile(filepath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
    receipt.written_to = filepath;
  }

  return receipt;
}

export function formatTaskReceipt(receipt) {
  if (!receipt) return "(no receipt)";
  const lines = [
    `Task:           ${receipt.task_id}`,
    `Receipt id:     ${receipt.receipt_id}`,
    `Truth label:    ${receipt.truth_label}`,
    `Scope:          ${receipt.scope}`,
    `Target:         ${receipt.target}`,
    `SAT verdict:    ${receipt.sat_verdict} — ${receipt.sat_verdict_reason}`,
    `Created:        ${receipt.created_at}`,
  ];
  if (receipt.error) lines.push(`Error:          ${receipt.error}`);
  if (receipt.result) {
    lines.push("");
    lines.push("Result:");
    lines.push(`  files:        ${receipt.result.file_count}`);
    lines.push(`  directories:  ${receipt.result.dir_count}`);
    lines.push(`  total bytes:  ${receipt.result.total_bytes}`);
    const ext = Object.entries(receipt.result.by_extension)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ");
    if (ext) lines.push(`  by extension: ${ext}`);
    if (receipt.result.top_largest.length > 0) {
      lines.push(`  largest:`);
      for (const e of receipt.result.top_largest.slice(0, 5)) {
        lines.push(
          `    ${e.size.toString().padStart(12)}  ${basename(e.name)}`,
        );
      }
    }
  }
  if (receipt.written_to) {
    lines.push("");
    lines.push(`Written to:     ${receipt.written_to}`);
    lines.push(`Read with:      dema receipts ${receipt.receipt_id}`);
  }
  return lines.join("\n");
}

export const TASK_REGISTRY = {
  [TASK_ID]: {
    id: TASK_ID,
    description:
      "Read-only inspection of ~/Downloads. No moves, deletes, renames, network, or mutation. Writes one local receipt.",
    autonomy_level: "L0/L1",
    run: runDownloadsAuditPreview,
    format: formatTaskReceipt,
  },
};
