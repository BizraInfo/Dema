#!/usr/bin/env node
// NEGATIVE-VERDICT-REASON-GATE-1A — read-only review check.
//
// Fails if a module emits a `verified: false` or `sealable: false` verdict
// without a machine-readable reason key nearby (reason / error / reason_code(s)
// / refusal_reason / blocked_reason / poi_rule_reason / ...), unless the file is
// in REASON_EXEMPT_ALLOWLIST with a documented reason.
//
// Why (Minsky-Papert, giants-absorption 2026-06-21): a negative result must
// carry its scope/cause. Across the proof verifiers, reason-emission was
// convention, not mechanically enforced — a new producer could ship a bare
// `verified:false` and nothing would stop it. This gate makes the dominant
// proof-verifier convention mechanical (verified/sealable:false MUST name why).
//
// Scope v0.1 (a bound carries its scope): the `verified:false` / `sealable:false`
// convention only. The heterogeneous FAILED/BLOCKED/HOLD/allowed:false verdict
// shapes, and a typed REASON_CLASS {STRUCTURALLY_PERMANENT, NOT_YET_DERIVABLE}
// enum, are deferred follow-up slices (no such typed enum exists on disk yet).
// `\bverified` excludes boundary-attestation fields like `signature_verified`.
//
// Finalize (acceptance): run this gate, add each real violation to
// REASON_EXEMPT_ALLOWLIST below with a one-line reason until `ok` is true, and
// ONLY THEN wire it into scripts/check.mjs. Discovery (from repo root):
//   node scripts/review/negative-verdict-reason-gate.mjs
import { readdirSync, readFileSync } from "node:fs";
import { join, isAbsolute, dirname, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");

export const SCHEMA = "bizra.dema.review.negative_verdict_reason.v0.1";
export const DEFAULT_SCAN_DIR = "packages";

// A negative-verdict marker: `verified: false` or `sealable: false` as a real
// object key. The leading \b is load-bearing — it excludes boundary-attestation
// fields (signature_verified / consent_verified / model_verified : false), which
// are canonical all-false attestations, not rejection verdicts.
export const VERDICT_RE = /\b(?:verified|sealable)\s*:\s*false\b/;

// Machine-readable reason-family keys observed across the proof producers
// (recon 2026-06-21). A negative verdict satisfies the gate if any appears in a
// small window around the marker.
export const REASON_KEYS = Object.freeze([
  "reason",
  "reasons",
  "reason_code",
  "reason_codes",
  "refusal_reason",
  "refusal_reasons",
  "blocked_reason",
  "blocked_by",
  "poi_rule_reason",
  "error_reason",
  "error",
  "errors",
  "denial",
  "why",
  "proof_gaps",
  "next_unblocked_condition",
  "next_safe_step",
]);
const REASON_RE = new RegExp(`\\b(?:${REASON_KEYS.join("|")})\\b`);

// A verdict satisfies the gate when a reason key appears in the SAME object
// literal as the marker. The enclosing `{ ... }` is found by brace-matching (back
// to the opening brace, forward to its match), so the reason is bound to THIS
// verdict object — not bled in from an unrelated nearby statement (which a fixed
// line window does once large) nor clipped when the verdict object is big.
const MAX_SCAN_CHARS = 20000; // bound the brace walk on pathological inputs

function enclosingObjectSpan(content, markerCharIndex) {
  let depth = 0;
  let start = -1;
  const backStop = Math.max(0, markerCharIndex - MAX_SCAN_CHARS);
  for (let k = markerCharIndex; k >= backStop; k--) {
    const c = content[k];
    if (c === "}") depth++;
    else if (c === "{") {
      if (depth === 0) {
        start = k;
        break;
      }
      depth--;
    }
  }
  if (start === -1) return null;
  depth = 0;
  const fwdStop = Math.min(content.length, start + MAX_SCAN_CHARS);
  for (let k = start; k < fwdStop; k++) {
    const c = content[k];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return content.slice(start, k + 1);
    }
  }
  return null;
}

// Files where a `verified:false`/`sealable:false` literal legitimately carries NO
// reason-family key — empty-set closeouts / canonical objects where a truth_label
// names a (non-rejection) condition. Keyed by basename → one-line reason.
// Finalized by running the gate (acceptance); a key that no longer matches a bare
// verdict is surfaced as `stale_allowlist`.
export const REASON_EXEMPT_ALLOWLIST = Object.freeze({
  "authorship-closeout.js":
    "empty-set closeout: with no authorship receipts on disk, verified:false reports an absence, not a rejection — truth_label NO_AUTHORSHIP_RECEIPTS names the no-data condition (optional follow-up: add reason:'no_authorship_receipts')",
});

function shouldSkipDir(name) {
  return (
    name === "node_modules" ||
    name === "dist" ||
    name === "build" ||
    name === "target" ||
    name === "coverage" ||
    name.startsWith(".")
  );
}

function collectJsFiles(rootAbs) {
  const out = [];
  function walk(dirAbs, depth) {
    if (depth > 8) return;
    let entries;
    try {
      entries = readdirSync(dirAbs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = join(dirAbs, e.name);
      if (e.isDirectory()) {
        if (!shouldSkipDir(e.name)) walk(full, depth + 1);
        continue;
      }
      if (!e.isFile()) continue;
      if (!e.name.endsWith(".js")) continue;
      if (e.name.endsWith(".test.js")) continue;
      out.push(full);
    }
  }
  walk(rootAbs, 0);
  return out.sort();
}

function scanFileContent(content) {
  const lines = content.split("\n");
  const markers = [];
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const lineStart = offset;
    offset += raw.length + 1; // + newline
    if (raw.length > 2000) continue; // bounded: ReDoS + minified-line guard
    const trimmed = raw.trimStart();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
    const m = raw.match(VERDICT_RE);
    if (!m) continue;
    // Bind the reason search to the verdict's own object literal.
    const span = enclosingObjectSpan(content, lineStart + m.index) ?? raw;
    markers.push({ line: i + 1, hasReason: REASON_RE.test(span) });
  }
  return markers;
}

export function checkNegativeVerdictReasons({
  repoRoot = REPO_ROOT,
  scanDir = DEFAULT_SCAN_DIR,
  allowlist = REASON_EXEMPT_ALLOWLIST,
} = {}) {
  const rootAbs = isAbsolute(scanDir) ? scanDir : join(repoRoot, scanDir);
  const files = collectJsFiles(rootAbs);

  const violations = [];
  const allowlisted = [];
  const matchedAllowlistKeys = new Set();
  let verdict_count = 0;

  for (const fileAbs of files) {
    const markers = scanFileContent(readFileSync(fileAbs, "utf8"));
    verdict_count += markers.length;
    const bare = markers.filter((m) => !m.hasReason);
    if (bare.length === 0) continue;
    const rel = relative(rootAbs, fileAbs).replace(/\\/g, "/");
    const base = fileAbs.slice(fileAbs.lastIndexOf("/") + 1);
    if (Object.hasOwn(allowlist, base)) {
      matchedAllowlistKeys.add(base);
      allowlisted.push(
        Object.freeze({
          file: base,
          bare_lines: Object.freeze(bare.map((m) => m.line)),
          reason: allowlist[base],
        }),
      );
    } else {
      for (const m of bare) {
        violations.push(
          Object.freeze({
            file: rel,
            line: m.line,
            reason:
              "negative verdict (verified/sealable:false) with no machine-readable reason key nearby — add a reason field, or add to REASON_EXEMPT_ALLOWLIST with a documented reason",
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
    verdict_count,
    reason_keys: REASON_KEYS,
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
  const scanDir = argValue("--scan-dir") || DEFAULT_SCAN_DIR;
  const report = checkNegativeVerdictReasons({ scanDir });
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(
      `negative-verdict-reason: ${report.ok ? "OK" : "VIOLATIONS"} · scanned ${report.scanned_count} files · ${report.verdict_count} verdicts · ${report.violation_count} bare · ${report.allowlisted.length} allowlisted`,
    );
    for (const v of report.violations) {
      console.log(`  ✗ ${v.file}:${v.line} negative verdict with no reason`);
    }
    if (report.stale_allowlist.length) {
      console.log(`  ⚠ stale allowlist: ${report.stale_allowlist.join(", ")}`);
    }
  }
  if (!report.ok) process.exit(1);
}
