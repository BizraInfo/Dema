/**
 * DEMA-FIRST-ENCOUNTER-1A — metadata-only gatherer.
 *
 * Read-only. No network. No writes. Symlinks are never followed.
 *
 * ── An honest note about `file_hash` ────────────────────────────────────────
 * Computing a digest necessarily streams the file's bytes past the CPU. So the
 * precise claim is NOT "the bytes were never touched" — it is:
 *
 *   no file content is retained, returned, rendered, or reachable by the mission
 *   before consent; only a one-way digest crosses the boundary.
 *
 * The bytes are hashed in fixed-size chunks and dropped; nothing is buffered and
 * no chunk leaves this function. The kernel then refuses any record carrying a
 * content-shaped field, so a future edit that tried to smuggle a preview through
 * would fail the tests rather than quietly widen the boundary. UI copy must match
 * this wording exactly — "content has not been read" would be an overclaim.
 */

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readdir, realpath } from "node:fs/promises";
import { extname, join, relative } from "node:path";

import { assertMetadataOnly, isWithinRoot, normalizeInventory } from "./first-encounter-admission.js";

const HASH_CHUNK_BYTES = 64 * 1024;

async function sha256Streamed(absPath) {
  const hash = createHash("sha256");
  const stream = createReadStream(absPath, { highWaterMark: HASH_CHUNK_BYTES });
  for await (const chunk of stream) hash.update(chunk); // chunk is dropped each iteration
  return hash.digest("hex");
}

/**
 * Walks `rootRealPath` and returns metadata-only records plus a skip ledger.
 * Every candidate is realpath-resolved and clamped to the root before it is
 * opened, so a symlink pointing outside the scope is recorded and never read.
 */
export async function scanMetadataOnly(rootPath) {
  const rootRealPath = await realpath(rootPath);
  const records = [];
  const skipped = [];

  async function walk(dirAbs) {
    const entries = await readdir(dirAbs, { withFileTypes: true });
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const abs = join(dirAbs, entry.name);
      const rel = relative(rootRealPath, abs);

      if (entry.isSymbolicLink()) {
        skipped.push({ relative_path: rel, reason: "SYMLINK_NOT_FOLLOWED" });
        continue;
      }

      let resolved;
      try {
        resolved = await realpath(abs);
      } catch {
        skipped.push({ relative_path: rel, reason: "UNRESOLVABLE_PATH" });
        continue;
      }
      if (!isWithinRoot(rootRealPath, resolved)) {
        skipped.push({ relative_path: rel, reason: "OUTSIDE_DECLARED_SCOPE" });
        continue;
      }

      if (entry.isDirectory()) {
        await walk(abs);
        continue;
      }
      const stat = await lstat(abs);
      if (!stat.isFile()) {
        skipped.push({ relative_path: rel, reason: "NOT_A_REGULAR_FILE" });
        continue;
      }

      records.push(
        assertMetadataOnly({
          relative_path: rel,
          extension: extname(entry.name),
          size: stat.size,
          modified_time: new Date(stat.mtimeMs).toISOString(),
          file_hash: await sha256Streamed(abs),
        }),
      );
    }
  }

  await walk(rootRealPath);
  skipped.sort((a, b) => (a.relative_path < b.relative_path ? -1 : 1));

  return {
    root_real_path: rootRealPath,
    inventory: normalizeInventory(records),
    skipped,
    boundaries: {
      content_retained: false,
      content_returned: false,
      network_used: false,
      symlink_followed: false,
      source_mutation_performed: false,
    },
  };
}
