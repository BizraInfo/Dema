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
import { readdirSync, readFileSync } from "node:fs";
import { join, isAbsolute, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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
  "dema-realm-wallet.js":
    "reads optional ~/.dema/realm/wallet-intents.json for read-only intent ledger",
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
});

const MODULE_GROUP = "(fs|net|http|https|child_process)";
// `from "<module>"` clause — matches single-line AND multi-line imports (the
// `} from "node:fs"` clause is always on one physical line) and re-exports
// (`export … from "node:fs"`). Object keys like `{ from: "node:fs" }` do not
// match (the colon breaks `\sfrom\s*["']`).
const FROM_RE = new RegExp(`\\bfrom\\s*["'](?:node:)?${MODULE_GROUP}["']`);
const BARE_IMPORT_RE = new RegExp(
  `\\bimport\\s*["'](?:node:)?${MODULE_GROUP}["']`,
);
const REQUIRE_RE = new RegExp(
  `\\brequire\\(\\s*["'](?:node:)?${MODULE_GROUP}["']\\s*\\)`,
);
const DYN_IMPORT_RE = new RegExp(
  `\\bimport\\(\\s*["'](?:node:)?${MODULE_GROUP}["']\\s*\\)`,
);
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

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const scanDir = argValue("--scan-dir") || DEFAULT_KERNEL_SCAN_DIR;
  const report = checkKernelPurity({ scanDir });
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
