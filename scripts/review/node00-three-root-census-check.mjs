#!/usr/bin/env node
// NODE00-THREE-ROOT-CENSUS-0B — review gate. Runs the slice proof loop against an
// in-memory metadata fixture and emits the verdict.
//
// The gate touches NO real filesystem: it drives the pure kernel through a synthetic
// metadata adapter, so the verdict is deterministic on any machine and the gate
// itself can never read, mutate or disclose anything.

import { pathToFileURL } from "node:url";

import {
  runNode00ThreeRootCensus,
  NODE00_THREE_ROOT_CENSUS_SCHEMA,
  NODE00_THREE_ROOT_CENSUS_TRUTH_LABEL,
  NODE00_THREE_ROOT_CENSUS_GO_PHRASE,
} from "../../packages/core/src/node00-three-root-census.js";

const JSON_MODE = process.argv.includes("--json");

// A metadata-only adapter over a plain in-memory tree. Exposes ONLY lstat/readdir/now
// — the same narrow contract the real fs adapter must satisfy. Nothing here can read
// content, resolve a link, or mutate.
export function makeMemoryAdapter(tree, { startMillis = 0, tickMillis = 0 } = {}) {
  let clock = startMillis;
  return {
    lstat(path) {
      const node = tree[path];
      if (!node) {
        const err = new Error("ENOENT");
        err.code = "ENOENT";
        throw err;
      }
      if (node.unreadable_stat) {
        const err = new Error("EACCES");
        err.code = "EACCES";
        throw err;
      }
      return {
        device: node.device,
        inode: node.inode,
        mode: node.mode ?? 0o755,
        size_bytes: node.size_bytes ?? 0,
        mtime_ms: node.mtime_ms ?? 0,
        type: node.type,
      };
    },
    readdir(path) {
      const node = tree[path];
      if (!node || node.type !== "directory") {
        const err = new Error("ENOTDIR");
        err.code = "ENOTDIR";
        throw err;
      }
      if (node.unreadable_dir) {
        const err = new Error("EACCES");
        err.code = "EACCES";
        throw err;
      }
      return [...(node.children ?? [])];
    },
    now() {
      clock += tickMillis;
      return clock;
    },
  };
}

// Canonical fixture: mirrors the real 0B shape — a private root that CONTAINS a
// public repo root (ownership must delegate, never double-count) plus a public root
// that is disjoint and on a different device.
export function fixtureTree() {
  return {
    "/": { type: "directory", device: 1, inode: 1, children: ["fx"] },
    "/fx": { type: "directory", device: 1, inode: 2, children: ["downloads", "lake"] },

    "/fx/downloads": { type: "directory", device: 1, inode: 10, children: ["Dema", "photo.jpg", "shortcut", "locked"] },
    "/fx/downloads/photo.jpg": { type: "file", device: 1, inode: 11, size_bytes: 2048 },
    "/fx/downloads/shortcut": { type: "symlink", device: 1, inode: 12, size_bytes: 9 },
    "/fx/downloads/locked": { type: "directory", device: 1, inode: 13, children: ["hidden.txt"], unreadable_dir: true },
    "/fx/downloads/locked/hidden.txt": { type: "file", device: 1, inode: 14, size_bytes: 1 },

    // Nested PUBLIC root inside the private root — the delegation case.
    "/fx/downloads/Dema": { type: "directory", device: 1, inode: 20, children: ["readme.md", "src"] },
    "/fx/downloads/Dema/readme.md": { type: "file", device: 1, inode: 21, size_bytes: 512 },
    "/fx/downloads/Dema/src": { type: "directory", device: 1, inode: 22, children: ["kernel.js"] },
    "/fx/downloads/Dema/src/kernel.js": { type: "file", device: 1, inode: 23, size_bytes: 1024 },

    // Disjoint PUBLIC root on its own device, containing a cross-device mount.
    "/fx/lake": { type: "directory", device: 2, inode: 30, children: ["corpus", "mnt"] },
    "/fx/lake/corpus": { type: "directory", device: 2, inode: 31, children: ["notes.md"] },
    "/fx/lake/corpus/notes.md": { type: "file", device: 2, inode: 32, size_bytes: 64 },
    "/fx/lake/mnt": { type: "directory", device: 9, inode: 40, children: ["elsewhere.bin"] },
    "/fx/lake/mnt/elsewhere.bin": { type: "file", device: 9, inode: 41, size_bytes: 8 },
  };
}

export function fixtureRoots() {
  // Declared in a deliberately non-canonical order — ordering must not change the
  // ownership result or the body hash.
  return [
    { id: "DATA_LAKE_REPO", path: "/fx/lake", visibility: "public" },
    { id: "DOWNLOADS", path: "/fx/downloads", visibility: "private" },
    { id: "DEMA_REPO", path: "/fx/downloads/Dema", visibility: "public" },
  ];
}

export function fixtureInput(overrides = {}) {
  return {
    roots: fixtureRoots(),
    adapter: makeMemoryAdapter(fixtureTree()),
    ...overrides,
  };
}

export function runNode00ThreeRootCensusCheck() {
  return runNode00ThreeRootCensus({
    consent: NODE00_THREE_ROOT_CENSUS_GO_PHRASE,
    input: fixtureInput(),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode00ThreeRootCensusCheck();

  if (JSON_MODE) {
    const { entries, warnings, payload, ...json } = result;
    console.log(
      JSON.stringify(
        { ...json, entry_count: entries.length, warning_count: warnings.length, totals: payload?.totals ?? null },
        null,
        2,
      ),
    );
  } else {
    console.log("DEMA - NODE00-THREE-ROOT-CENSUS-0B");
    console.log(`  schema: ${NODE00_THREE_ROOT_CENSUS_SCHEMA}`);
    console.log(`  truth: ${NODE00_THREE_ROOT_CENSUS_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (result.ok) {
      console.log(`  completeness: ${result.payload.completeness}`);
      console.log(`  roots: ${result.payload.totals.roots}  entries: ${result.payload.totals.entries}`);
      console.log(`  delegated_roots: ${result.payload.totals.delegated_roots}  warnings: ${result.payload.totals.warnings}`);
      console.log(`  content_hash: ${result.content_hash}`);
    } else {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
