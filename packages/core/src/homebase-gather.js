import { readFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { performance } from "node:perf_hooks";

import { buildNode0StatePreview } from "./state.js";
import { buildProcessMiningSummary } from "./process-mining-preview.js";
import { buildLocalModelInventoryScan } from "./local-model-inventory-scan.js";
import { listReceipts } from "../../receipts/src/receipt-store.js";

const SCHEMA_VERSION = "bizra.dema.homebase_gather.v0.1";
const GATHER_TIMING_BUDGET_MS = 200;
const MEMORY_RECENT_LIMIT = 3;
const DIR_WALK_MAX_DEPTH = 6;

function resolveHome(opts) {
  if (opts && typeof opts.home === "string" && opts.home.length > 0) return opts.home;
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

function emptyResult(ts) {
  return {
    schema_version: SCHEMA_VERSION,
    ts,
    partial: false,
    warnings: [],
    profile: { name: null, node: "Node0", source_present: false },
    memory_recent: [],
    state: null,
    receipts: { count: 0, last_id: null, gateway_issued: 0 },
    process_mining: null,
    models: null,
    memory_size: { bytes: 0, entries: 0 },
    env_flags: {
      no_color: Boolean(process.env.NO_COLOR),
      term_dumb: process.env.TERM === "dumb",
      tty: Boolean(process.stdout && process.stdout.isTTY),
    },
  };
}

async function readJSON(path) {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}

function pickString(obj, key) {
  return typeof obj?.[key] === "string" ? obj[key] : null;
}

function pickIso639_1(obj, key) {
  const v = obj?.[key];
  if (typeof v !== "string") return null;
  if (/^[a-z]{2}$/.test(v) || v === "other") return v;
  return null;
}

async function readProfile(home, result) {
  try {
    const data = await readJSON(join(home, "profile.json"));
    // Canonical bizra.dema.profile.v0.1 schema uses `preferred_name`.
    // Fall back to `name` for non-canonical profiles or test fixtures.
    const profileName = pickString(data, "preferred_name") ?? pickString(data, "name");
    // language_code: check canonical field, then legacy `language` field
    const languageCode = pickIso639_1(data, "language_code") ?? pickIso639_1(data, "language");
    return {
      name: profileName,
      node: pickString(data, "node") ?? "Node0",
      source_present: true,
      language_code: languageCode,
    };
  } catch (err) {
    if (err && err.code === "ENOENT") {
      return { name: null, node: "Node0", source_present: false, language_code: null };
    }
    result.warnings.push(`profile.json read failed: ${err.message}`);
    result.partial = true;
    return { name: null, node: "Node0", source_present: false, language_code: null };
  }
}

async function listMemoryFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const jsonNames = entries.filter((e) => e.isFile() && e.name.endsWith(".json")).map((e) => e.name);
  const stats = await Promise.all(
    jsonNames.map(async (name) => {
      const path = join(dir, name);
      try {
        const s = await stat(path);
        return { path, name, mtime_ms: s.mtimeMs };
      } catch {
        return null;
      }
    }),
  );
  return stats.filter((s) => s != null);
}

async function readMemoryRecent(home, result) {
  let files;
  try {
    files = await listMemoryFiles(join(home, "memory"));
  } catch (err) {
    if (err && err.code === "ENOENT") {
      result.warnings.push("no ~/.dema/memory directory · empty homebase");
      return [];
    }
    result.warnings.push(`memory directory read failed: ${err.message}`);
    result.partial = true;
    return [];
  }
  files.sort((a, b) => b.mtime_ms - a.mtime_ms);
  const recent = files.slice(0, MEMORY_RECENT_LIMIT);
  const mapped = await Promise.all(
    recent.map(async (f) => {
      try {
        const j = await readJSON(f.path);
        return {
          name: basename(f.name, ".json"),
          mtime_ms: f.mtime_ms,
          summary: pickString(j, "summary") ?? pickString(j, "title") ?? null,
        };
      } catch (err) {
        result.warnings.push(`memory entry ${f.name} unreadable: ${err.message}`);
        result.partial = true;
        return null;
      }
    }),
  );
  return mapped.filter((m) => m != null);
}

async function tryBuilder(call, fallback) {
  try {
    return await call();
  } catch (err) {
    return fallback(err);
  }
}

// listReceipts swallows all errors and returns []. Probe the directory directly
// so we can distinguish "no receipts yet" (ENOENT · normal) from "couldn't read"
// (EACCES or similar · degradation worth surfacing).
async function probeReceiptsDir(home, result) {
  const dir = join(home, "receipts");
  try {
    const s = await stat(dir);
    if (!s.isDirectory()) {
      result.warnings.push("receipts path exists but is not a directory");
      result.partial = true;
    }
  } catch (err) {
    if (err && err.code === "ENOENT") return;
    result.warnings.push(`receipts directory inaccessible: ${err.message}`);
    result.partial = true;
  }
}

async function walkDirSize(root, depth = 0) {
  if (depth > DIR_WALK_MAX_DEPTH) return { bytes: 0, entries: 0 };
  let bytes = 0;
  let entries = 0;
  const items = await readdir(root, { withFileTypes: true });
  for (const item of items) {
    const path = join(root, item.name);
    try {
      if (item.isDirectory()) {
        const sub = await walkDirSize(path, depth + 1);
        bytes += sub.bytes;
        entries += sub.entries;
      } else if (item.isFile()) {
        const s = await stat(path);
        bytes += s.size;
        entries += 1;
      }
    } catch {
      /* skip race-vanish entries silently */
    }
  }
  return { bytes, entries };
}

export async function gather(opts = {}) {
  const home = resolveHome(opts);
  const t0 = performance.now();
  const result = emptyResult(new Date());

  result.profile = await readProfile(home, result);
  result.memory_recent = await readMemoryRecent(home, result);

  result.state = await tryBuilder(
    () => buildNode0StatePreview(),
    (err) => {
      result.warnings.push(`state preview failed: ${err.message}`);
      result.partial = true;
      return null;
    },
  );

  await probeReceiptsDir(home, result);
  result.receipts = await tryBuilder(
    async () => {
      const list = await listReceipts(home);
      return {
        count: list.length,
        last_id: list.length ? (list[list.length - 1].receipt_id ?? null) : null,
        gateway_issued: 0,
      };
    },
    (err) => {
      result.warnings.push(`receipts list failed: ${err.message}`);
      result.partial = true;
      return { count: 0, last_id: null, gateway_issued: 0 };
    },
  );

  result.process_mining = await tryBuilder(
    () => buildProcessMiningSummary(),
    (err) => {
      result.warnings.push(`process-mining failed: ${err.message}`);
      result.partial = true;
      return null;
    },
  );

  if (opts.include_models !== false) {
    result.models = await tryBuilder(
      () => buildLocalModelInventoryScan({ home, summary: true }),
      () => null,
    );
  }

  result.memory_size = await tryBuilder(
    () => walkDirSize(home),
    () => ({ bytes: 0, entries: 0 }),
  );

  const elapsedMs = performance.now() - t0;
  if (elapsedMs > GATHER_TIMING_BUDGET_MS) {
    result.warnings.push(
      `gather ${elapsedMs.toFixed(0)}ms exceeded budget ${GATHER_TIMING_BUDGET_MS}ms`,
    );
  }

  return result;
}

export const HOMEBASE_GATHER_SCHEMA = SCHEMA_VERSION;
