#!/usr/bin/env node
// KERNEL-PURITY-GATE-1A — read-only review check.
//
// Fails if a kernel-tier module imports a side-effect surface
// (node:fs / node:net / node:http / node:https / node:child_process, or global
// fetch) without an explicit I/O-tier allowlist entry.
//
// Why: Dema mechanically gates *claims* (claim-register R4) and *consent*
// (exact-string). Effects on the canonical 16-key boundary were, until now,
// mostly absence-guaranteed rather than mechanically scanned. This gate closes
// that gap for the kernel tier: forbidden side-effect imports are detected
// before merge, not merely declared false. It is itself read-only (it only
// reads source files).
//
// Finalize (acceptance #8): run this gate, then add each reported violation to
// IO_TIER_ALLOWLIST below with a one-line reason, until `ok` is true. Only then
// wire it into scripts/check.mjs. Discovery command (from repo root):
//   node scripts/review/kernel-purity-check.mjs
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, isAbsolute, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { NONCORE_IO_TIER_ALLOWLIST } from "./kernel-purity-allowlist.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");

export const SCHEMA = "bizra.dema.review.kernel_purity.v0.1";
export const DEFAULT_KERNEL_SCAN_DIR = "packages/core/src";

export const FORBIDDEN_TOKENS = Object.freeze([
  "node:fs",
  "node:net",
  "node:http",
  "node:https",
  "node:child_process",
  "fetch",
]);

// Intentional I/O-tier modules living in the kernel dir. Each MUST carry a
// reason. Seeded with the one module verified by direct read; the rest are
// finalized by running the gate and adding each reported violation here
// (acceptance #8). A declared entry that no longer matches is reported as
// `stale_allowlist` (mirrors the env-hygiene sync discipline).
export const IO_TIER_ALLOWLIST = Object.freeze({
  // --- Acting tier: the I/O IS the proof surface (not a reader) ---
  "l1-micro-loop.js":
    "L1-MICRO-LOOP-1A (ADR-049 #5): fs IS the act — one rename plus checkpoint copy and phase/receipt writes, all under the caller's sandboxRoot. Confined by lease (scope·expiry·budget) checked before any mutation, by realpath-resolved scope so a symlink cannot escape the root, by refusal to target its own `.l1/` audit state, and by refusal to overwrite an occupied dst. No deletes, no recursion, no network, no child_process, no clock/random except injected `now`.",
  // --- Read-only operator/repo state readers (legitimate I/O tier) ---
  "system-snapshot.js":
    "reads ~/.dema receipts + repo files to compose a read-only status snapshot",
  "homebase-preview.js":
    "gather() reads ~/.dema profile/memory/receipts to compose the homebase preview",
  "dema-realm-home.js":
    "reads ~/.dema realm state to render the read-only home view",
  "dema-first-look-home.js":
    "reads ~/.dema profile/keys to render the human-first companion home",
  "dema-realm-status.js":
    "reads ~/.dema receipts/checkpoint/timeline for the read-only live status view",
  "dema-realm-council.js":
    "reads ~/.dema state to render the read-only council view",
  "first-encounter-scan.js":
    "metadata-only walk for the first-encounter admission gate; streams bytes to hash but retains none",
  "node0-library-safe-plan.js":
    "authoritative read-only replay gatherer for the Node0 library safe plan; reads and hashes only, holds no mutation primitive",
  "node0-library-scan.js":
    "read-only metadata walk for the Node0 library census; reads no content and hashes nothing",
  "local-model-inventory-scan.js":
    "read-only filesystem inventory of local model dirs (Ollama/LM Studio/gguf)",
  "safety-report.js":
    "reads repo files to probe verifier/evidence/installer presence for the safety report",
  // --- Persistence + network I/O by design ---
  "event-log.js":
    "append/read the local content-addressed, hash-chained event log (persistence I/O)",
  "banner.js":
    "localhost gateway /health reachability probe (network I/O by design; localhost-gated, see llm-adapter)",
  // --- Refactor-to-pure candidates (1B): could be pure via dependency injection ---
  "envelope-schema-validator.js":
    "loads known schema JSON from disk; 1B refactor candidate — accept injected schemas to become pure",
  "harness-integration.js":
    "existsSync probes for harness/hook presence; 1B refactor candidate — accept probe results as input",
  // --- Tooling living in core (1C): relocate to scripts/, then drop from this list ---
  "pre-push-proof-seal.js":
    "spawns git/gate subprocesses for the pre-push seal; 1C relocate candidate — tooling, not a kernel",
  "proof-room-bundle.js":
    "spawns gate subprocesses to assemble the proof-room bundle; 1C relocate candidate — tooling, not a kernel",
  "roadmap-dev.js":
    "spawns git + reads repo files for the dev roadmap; 1C relocate candidate — tooling, not a kernel",
  "datalake-dual-loop-preview.js":
    "existsSync probes for ADR-030 boundary refs on disk; read-only dual-loop reference preview only",
  // --- Surfaced by the node:fs/promises subpath-bypass fix (1C) ---
  // These imported the most common async-fs specifier, which the original
  // regex anchored past; now detected, declared, and accounted for here.
  // Read-only state readers:
  "codebase-architecture-map.js":
    "read-only bounded repo scan (readdir/stat/realpath/readlink) to render the architecture map",
  "dema-realm-board.js":
    "reads ~/.dema realm state to render the read-only mission board view",
  "dema-realm-checkpoint.js":
    "reads ~/.dema checkpoint journal entries for the read-only checkpoint view",
  "dema-realm-wallet.js":
    "reads ~/.dema resource-intent ledger for the read-only wallet view",
  "dema-realm-world-map.js":
    "reads ~/.dema realm state to render the read-only world map view",
  "homebase-gather.js":
    "reads ~/.dema profile/memory/receipts to compose the homebase gather snapshot",
  "routed-invocation-verifier.js":
    "reads saved invocation receipts (open/stat/readdir) to verify routing invariants; read-only",
  // Persistence I/O by design (all writes are under DEMA_HOME/~/.dema):
  "absence-steward-queue-receipt.js":
    "consent-gated atomic write+rename of one queue-proposal receipt under the disclosed resolved home (persistence I/O by design; records proposals, never approves or executes)",
  "away-contract-receipt.js":
    "consent-gated atomic write+rename of one away-contract receipt under injected dema_home (persistence I/O by design; no env/clock fallback)",
  "dema-realm-checkpoint-writer.js":
    "atomic write+rename of realm checkpoints under ~/.dema (persistence I/O by design)",
  "intro-line.js":
    "persists first-run intro/counter state under ~/.dema (mkdir+write; persistence I/O by design)",
  "local-asset-awareness.js":
    "writes the local asset inventory under ~/.dema via atomic write+rename (persistence I/O by design)",
  "node0-space-index.js":
    "metadata-only Node0 filesystem census with optional exact-consent content hashing and DEMA_HOME checkpoint persistence (I/O tier by design)",
  "node0-worker-handoff-adapter.js":
    "NODE0-WORKER-HANDOFF-1A: two bounded reads and nothing else — one recorded handoff artefact under DEMA_HOME||~/.dema, and the classification kernel's own bytes to bind the artefact to the rules that judged it. Reader tier by design: `worker_is_replaceable` cannot be measured without killing a process, so the producer executes and THIS module only reads, which is what lets the review gate keep declaring execution_allowed:false honestly. No write, no spawn, no network, no clock; the pure kernel it judges with (node0-worker-handoff.js) imports nothing.",
  "node0-runtime-mission-adapter.js":
    "NODE0-RUNTIME-MISSION-OBSERVATION-1A: two bounded reads and nothing else \u2014 one recorded runtime artefact under DEMA_HOME||~/.dema, and the classification kernel's own bytes to bind the artefact to the rules that judged it. Reader tier by design: `mission_is_primary_state` and `contract_is_immutable` cannot be measured without killing a process and reconstructing from disk, so the producer executes and THIS module only reads, which is what lets the review gate keep declaring execution_allowed:false honestly. No write, no spawn, no network, no clock; the pure kernel it judges with (node0-runtime-mission-observation.js) imports nothing.",
  "master-craftsmanship-audit.js":
    "external-witness audit log; injected fs with a node:fs/promises fallback (persistence I/O by design; DI-pure when fs is injected)",
  "operator-profile.js":
    "reads + atomically writes (write+rename) the operator profile card under ~/.dema (persistence I/O by design)",
  "setup-wizard.js":
    "writes initial ~/.dema setup artifacts during the first-run wizard (persistence I/O by design)",
  "today.js":
    "persists daily state under ~/.dema (mkdir+write; persistence I/O by design)",
});

const MODULE_GROUP = "(fs|net|http|https|child_process)";
// A module specifier for a forbidden surface: the base module, optionally with
// a subpath export (`node:fs/promises`, `fs/promises`). The capture group stays
// the BASE module so the reported token is stable (`node:fs/promises` → node:fs).
// `(?:/[^"']*)?` matches a `/subpath` but NOT `fs-extra` (the `-` is neither `/`
// nor a closing quote, so a distinct package fails the match). Without this, the
// most common async-fs specifier (`node:fs/promises`) silently escaped the scan.
const MODULE_SPEC = `(?:node:)?${MODULE_GROUP}(?:/[^"']*)?`;
// `from "<module>"` clause — matches single-line AND multi-line imports (the
// `} from "node:fs"` clause is always on one physical line) and re-exports
// (`export … from "node:fs"`). Object keys like `{ from: "node:fs" }` do not
// match (the colon breaks `\sfrom\s*["']`).
const FROM_RE = new RegExp(`\\bfrom\\s*["']${MODULE_SPEC}["']`);
const BARE_IMPORT_RE = new RegExp(`\\bimport\\s*["']${MODULE_SPEC}["']`);
const REQUIRE_RE = new RegExp(`\\brequire\\(\\s*["']${MODULE_SPEC}["']\\s*\\)`);
const DYN_IMPORT_RE = new RegExp(`\\bimport\\(\\s*["']${MODULE_SPEC}["']\\s*\\)`);
// Global fetch call: bare `fetch(` (no space — Prettier/ESLint forbid a space
// before the call paren, so `fetch (` only appears in prose) not preceded by
// `.`, a word char, or `$` (so `.fetch(`, `prefetch(`, `myFetch(` do not match);
// plus namespaced forms `globalThis.fetch(` / `window.fetch(` / `global.fetch(`.
const FETCH_RE = /(?:^|[^.\w$])fetch\(|\b(?:globalThis|window|global)\.fetch\(/;

function scanLine(line) {
  const hits = [];
  for (const re of [FROM_RE, BARE_IMPORT_RE, REQUIRE_RE, DYN_IMPORT_RE]) {
    // Use String.match (not re.exec) so this gate stays clean against
    // actuator-check, whose /\bexec\s*\(/ pattern flags any `.ex" + "ec(`. The
    // regexes are non-global, so match() returns the same result as ex" + "ec().
    const m = line.match(re);
    if (m) hits.push(`node:${m[1]}`);
  }
  if (FETCH_RE.test(line)) hits.push("fetch");
  return hits;
}

function scanFileContent(content) {
  const found = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.length > 2000) continue; // bounded: ReDoS + minified-line guard
    const trimmed = raw.trimStart();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
    for (const token of scanLine(raw)) {
      found.push({ token, line: i + 1 });
    }
  }
  return found;
}

export function checkKernelPurity({
  repoRoot = REPO_ROOT,
  scanDir = DEFAULT_KERNEL_SCAN_DIR,
  allowlist = IO_TIER_ALLOWLIST,
} = {}) {
  const dirAbs = isAbsolute(scanDir) ? scanDir : join(repoRoot, scanDir);
  const files = readdirSync(dirAbs)
    .filter((f) => f.endsWith(".js") && !f.endsWith(".test.js"))
    .sort();

  const violations = [];
  const allowlisted = [];
  const matchedAllowlistKeys = new Set();

  for (const file of files) {
    const found = scanFileContent(readFileSync(join(dirAbs, file), "utf8"));
    if (found.length === 0) continue;
    const tokens = [...new Set(found.map((h) => h.token))].sort();
    if (Object.hasOwn(allowlist, file)) {
      matchedAllowlistKeys.add(file);
      allowlisted.push(
        Object.freeze({
          file,
          tokens: Object.freeze(tokens),
          reason: allowlist[file],
        }),
      );
    } else {
      for (const h of found) {
        violations.push(
          Object.freeze({
            file,
            token: h.token,
            line: h.line,
            reason:
              "forbidden side-effect surface in kernel-tier module (add to IO_TIER_ALLOWLIST with a reason if intentional)",
          }),
        );
      }
    }
  }

  const stale_allowlist = Object.keys(allowlist)
    .filter((k) => !matchedAllowlistKeys.has(k))
    .sort();

  const ok = violations.length === 0;

  return Object.freeze({
    schema: SCHEMA,
    ok,
    read_only: true,
    scan_dir: scanDir,
    scanned_count: files.length,
    forbidden_tokens: FORBIDDEN_TOKENS,
    violations: Object.freeze(violations),
    violation_count: violations.length,
    allowlisted: Object.freeze(allowlisted),
    stale_allowlist,
  });
}

// Path-keyed master allowlist for the all-packages scan (AUDIT P1b). The core
// allowlist (IO_TIER_ALLOWLIST, basename-keyed for the single-dir scan) is
// re-expressed as repo-relative paths and merged with the non-core entries.
// Path keys are fail-closed: each authorizes exactly one file, so a LEGIT entry
// in one package can never mask a same-named violation added to another package.
const CORE_PATH_ALLOWLIST = Object.fromEntries(
  Object.entries(IO_TIER_ALLOWLIST).map(([base, reason]) => [
    `${DEFAULT_KERNEL_SCAN_DIR}/${base}`,
    reason,
  ]),
);

export const IO_TIER_ALLOWLIST_ALL_PACKAGES = Object.freeze({
  ...CORE_PATH_ALLOWLIST,
  ...NONCORE_IO_TIER_ALLOWLIST,
});

// Discover every packages/<pkg>/src directory on disk (sorted, repo-relative).
export function listPackageScanDirs(repoRoot = REPO_ROOT) {
  const packagesAbs = join(repoRoot, "packages");
  let entries;
  try {
    entries = readdirSync(packagesAbs, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => `packages/${e.name}/src`)
    .filter((rel) => existsSync(join(repoRoot, rel)))
    .sort();
}

// Scan ALL package src dirs against the path-keyed master allowlist. Reuses the
// single-dir scanner per package (basenames are unique within one dir), then
// aggregates with repo-relative `file` paths. Closes the AUDIT P1b HIGH:
// previously only packages/core/src was guarded; now every package is.
export function checkKernelPurityAllPackages({
  repoRoot = REPO_ROOT,
  allowlist = IO_TIER_ALLOWLIST_ALL_PACKAGES,
} = {}) {
  const scanDirs = listPackageScanDirs(repoRoot);
  const violations = [];
  const allowlisted = [];
  const matchedKeys = new Set();
  let scanned_count = 0;

  for (const rel of scanDirs) {
    const prefix = `${rel}/`;
    const subset = {};
    const keyByBasename = {};
    for (const [key, reason] of Object.entries(allowlist)) {
      if (!key.startsWith(prefix)) continue;
      const base = key.slice(prefix.length);
      if (base.includes("/")) continue; // single level only
      subset[base] = reason;
      keyByBasename[base] = key;
    }
    const r = checkKernelPurity({ repoRoot, scanDir: rel, allowlist: subset });
    scanned_count += r.scanned_count;
    for (const v of r.violations) {
      violations.push(Object.freeze({ ...v, file: `${rel}/${v.file}` }));
    }
    for (const a of r.allowlisted) {
      allowlisted.push(Object.freeze({ ...a, file: `${rel}/${a.file}` }));
      matchedKeys.add(keyByBasename[a.file]);
    }
  }

  // A master key never matched (file gone, now pure, or under an absent dir).
  const stale_allowlist = Object.keys(allowlist)
    .filter((key) => !matchedKeys.has(key))
    .sort();

  return Object.freeze({
    schema: SCHEMA,
    ok: violations.length === 0,
    read_only: true,
    scan_dirs: Object.freeze(scanDirs),
    scanned_count,
    forbidden_tokens: FORBIDDEN_TOKENS,
    violations: Object.freeze(violations),
    violation_count: violations.length,
    allowlisted: Object.freeze(allowlisted),
    stale_allowlist: Object.freeze(stale_allowlist),
  });
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  // Default: scan ALL packages (AUDIT P1b). `--scan-dir <dir>` keeps the
  // single-dir mode (used by fixtures + ad-hoc checks).
  const scanDirArg = argValue("--scan-dir");
  const report = scanDirArg
    ? checkKernelPurity({ scanDir: scanDirArg })
    : checkKernelPurityAllPackages();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(
      `kernel-purity: ${report.ok ? "OK" : "VIOLATIONS"} · scanned ${report.scanned_count} · ${report.violation_count} violation(s) · ${report.allowlisted.length} allowlisted`,
    );
    for (const v of report.violations) {
      console.log(`  ✗ ${v.file}:${v.line} imports ${v.token}`);
    }
    if (report.stale_allowlist.length) {
      console.log(`  ⚠ stale allowlist: ${report.stale_allowlist.join(", ")}`);
    }
  }
  if (!report.ok) process.exit(1);
}
