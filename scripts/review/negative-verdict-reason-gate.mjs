#!/usr/bin/env node
// NEGATIVE-VERDICT-REASON-GATE-1A/1B/1C — read-only review check.
//
// Fails if a module emits a negative verdict without a machine-readable reason
// key nearby (reason / error / checks / reason_code(s) / blocked_by /
// blocked_reason / ...), unless the file is in REASON_EXEMPT_ALLOWLIST with a
// documented reason. Three negative shapes:
//   1A — `verified: false` / `sealable: false`
//   1B — string verdicts on the verdict-family key (`verdict` / `*_verdict`):
//        verdict: "FAILED" | "BLOCKED" | "HOLD" | "REJECT" | "CANNOT_PROVE"
//   1C — string verdicts on the status-family key (`status` / `*_status`, e.g.
//        current_status / preview_lifecycle_status), same negative tokens.
//        STRICT: 1C requires a SPECIFIC blocker via STATUS_REASON_KEYS — a
//        `truth_label` alone (epistemic class, not a failed precondition) does
//        NOT satisfy. 1A/1B keep the broader REASON_KEYS unchanged.
//
// Why (Minsky-Papert, giants-absorption 2026-06-21): a negative result must
// carry its scope/cause. Across the proof verifiers, reason-emission was
// convention, not mechanically enforced — a new producer could ship a bare
// negative verdict and nothing would stop it. This gate makes the dominant
// proof-verifier convention mechanical (a negative verdict MUST name why).
//
// Scope (a bound carries its scope): verdict-family + status-family keys. Still
// deferred: the `*_verdict_required` / `*_status_required` CONFIG fields (a
// required verdict is not an emitted one — the key must END in verdict/status),
// `allowed: false`, and a typed REASON_CLASS {STRUCTURALLY_PERMANENT,
// NOT_YET_DERIVABLE} enum (no such enum exists on disk yet). The `(?<![\w$])`
// boundary excludes boundary-attestation fields like `signature_verified: false`.
// 1B/1C string VALUES are blanked by sanitizeForScan, so they are matched on raw
// source + liveness-masked (a verdict inside a comment or string never flags).
//
// Finalize (acceptance): run this gate, add each real violation to
// REASON_EXEMPT_ALLOWLIST below with a one-line reason until `ok` is true, and
// ONLY THEN wire it into scripts/check.mjs. Discovery (from repo root):
//   node scripts/review/negative-verdict-reason-gate.mjs
import { readdirSync, readFileSync } from "node:fs";
import { join, isAbsolute, dirname, relative, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");

export const SCHEMA = "bizra.dema.review.negative_verdict_reason.v0.1";
export const DEFAULT_SCAN_DIR = "packages";

// A negative-verdict marker: `verified: false` / `sealable: false`, with an
// optional quoted key (`"verified": false`, `'sealable': false`). The
// (?<![\w$]) boundary is load-bearing — it excludes boundary-attestation fields
// (signature_verified / consent_verified / model_verified : false), which are
// canonical all-false attestations, not rejection verdicts. Global so matchAll
// evaluates EVERY marker on a line, not just the first.
export const VERDICT_RE =
  /(?<![\w$])(['"]?)(?:verified|sealable)\1\s*:\s*false\b/g;

// 1B — heterogeneous string verdicts. A verdict-family key (`verdict` or
// `*_verdict`, e.g. verification_verdict / mission_verdict) whose quoted value
// is one of the negative tokens below. Anchored to the verdict-family key so
// status-family lifecycle enums (status / *_status : "BLOCKED"|"HOLD") and the
// `*_verdict_required` CONFIG field are NOT swept in — those are a documented
// 1C follow-up, not rejection verdicts. The `\1` backreference pairs the key
// quotes; `\2` pairs the value quotes; global so matchAll sees every marker.
// NOTE: the string VALUE is blanked by sanitizeForScan, so this regex is run on
// the RAW source and each match is liveness-checked against the sanitized buffer
// (see scanFileContent) — a verdict inside a comment or string never flags.
export const NEGATIVE_VERDICT_VALUES = Object.freeze([
  "FAILED",
  "BLOCKED",
  "HOLD",
  "REJECT",
  "CANNOT_PROVE",
]);
export const NEGATIVE_STRING_VERDICT_RE = new RegExp(
  `(?<![\\w$])(['"]?)(?:[a-z][a-z0-9]*_)*verdict\\1\\s*:\\s*(['"])(?:${NEGATIVE_VERDICT_VALUES.join("|")})\\2`,
  "g",
);

// 1C — status-family negative states. A status-family key (`status` or
// `*_status`, e.g. current_status / preview_lifecycle_status / health_status)
// whose quoted value is one of the negative tokens. Key must END in `status`, so
// `status_required` and unrelated config fields are NOT matched (mirrors the
// `*_verdict_required` exclusion). STRICT: these require a SPECIFIC blocker via
// STATUS_REASON_KEYS (below) — `truth_label` alone (an epistemic class label,
// not a failed precondition) does NOT satisfy the gate. Matched on RAW source +
// liveness-masked, exactly like 1B.
export const STATUS_NEGATIVE_RE = new RegExp(
  `(?<![\\w$])(['"]?)(?:[a-z][a-z0-9]*_)*status\\1\\s*:\\s*(['"])(?:${NEGATIVE_VERDICT_VALUES.join("|")})\\2`,
  "g",
);

// Machine-readable reason-family keys observed across the proof producers
// (recon 2026-06-21). A verdict satisfies the gate when one appears as a real
// object key in the verdict's own object literal (see REASON_KEY_RE) — never
// merely as a word in a comment or string.
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
  // structured pass/fail evidence list — the cause of a verdict:"FAILED" lives
  // in its checks (per-check pass:false + detail), the dominant verify-producer
  // shape (witness-verify / health-snapshot / sat-placeholder). 1B.
  "checks",
  "denial",
  "why",
  "proof_gaps",
  "next_unblocked_condition",
  "next_safe_step",
]);
const REASON_ALT = REASON_KEYS.join("|");
// A reason must appear as a real object key — `reason:` / `"reason":` (explicit)
// or shorthand `, reason }` / `, reason,` — never merely as a word inside a
// comment or string value (those are blanked by sanitizeForScan before this runs).
const REASON_KEY_RE = new RegExp(
  `[{,]\\s*(?:["']?(?:${REASON_ALT})["']?\\s*:|(?:${REASON_ALT})\\s*[,}])`,
);

// 1C — STRICT cause keys for a negative STATUS-family state. Narrower and
// purpose-built: a blocked/held status must name a SPECIFIC failed precondition,
// not merely an epistemic class. `truth_label` is DELIBERATELY ABSENT — it names
// what kind of object this is (NOT_LIVE / NODE0_LOCAL_SEED), not why the status
// is blocked. Kept separate from REASON_KEYS so 1A/1B behavior is unchanged.
export const STATUS_REASON_KEYS = Object.freeze([
  "reason",
  "error",
  "reason_code",
  "reason_codes",
  "blocked_by",
  "blocked_reason",
  "hold_reason",
  "failed_precondition",
  "checks",
]);
const STATUS_REASON_ALT = STATUS_REASON_KEYS.join("|");
const STATUS_REASON_KEY_RE = new RegExp(
  `[{,]\\s*(?:["']?(?:${STATUS_REASON_ALT})["']?\\s*:|(?:${STATUS_REASON_ALT})\\s*[,}])`,
);

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
  "homebase-gather.js":
    "1B: aggregator re-emits a downstream health-snapshot {verification,mission}_verdict:'FAILED'; the per-check cause lives in the receipt it already verified via verifyHealthSnapshotReceipt(latest), and this summary layer carries checks_passing/checks_total counts (optional follow-up: thread a reason/checks field through the aggregation)",
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

// Length-preserving sanitizer: blanks comments and string VALUES (keeping quotes,
// newlines, and total length) so a `verified:false` marker, a reason word, or a
// brace cannot be smuggled inside a comment or string. A quoted KEY (a string
// immediately followed by `:`) is preserved so `"verified":`/`"reason":` still
// parse. Char indices and line numbers stay 1:1 with the raw source.
function sanitizeForScan(code) {
  const out = code.split("");
  const n = code.length;
  const blank = (a, b) => {
    for (let k = a; k < b; k++) if (out[k] !== "\n") out[k] = " ";
  };
  let i = 0;
  while (i < n) {
    const c = code[i];
    const c2 = code[i + 1];
    if (c === "/" && c2 === "/") {
      let j = i;
      while (j < n && code[j] !== "\n") j++;
      blank(i, j);
      i = j;
      continue;
    }
    if (c === "/" && c2 === "*") {
      let j = i + 2;
      while (j < n && !(code[j] === "*" && code[j + 1] === "/")) j++;
      j = Math.min(n, j + 2);
      blank(i, j);
      i = j;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < n && code[j] !== c) {
        if (code[j] === "\\") j += 2;
        else j++;
      }
      const close = Math.min(j, n);
      let k = close + 1;
      while (k < n && /\s/.test(code[k])) k++;
      if (code[k] !== ":") blank(i + 1, close); // value → blank; key → keep
      i = close + 1;
      continue;
    }
    i++;
  }
  return out.join("");
}

function scanFileContent(content) {
  const code = sanitizeForScan(content); // length-preserving → 1:1 char indices
  const sLines = code.split("\n");
  const rLines = content.split("\n");
  const markers = [];
  let offset = 0;
  for (let i = 0; i < sLines.length; i++) {
    const sLine = sLines[i];
    const lineStart = offset;
    offset += sLine.length + 1; // + newline
    if (sLine.length > 2000) continue; // bounded: ReDoS + minified-line guard
    // 1A — `verified|sealable: false` survives sanitize (false is a keyword, not
    // a string value). matchAll so EVERY verdict on the line is evaluated, each
    // against its own enclosing object literal.
    for (const m of sLine.matchAll(VERDICT_RE)) {
      const span = enclosingObjectSpan(code, lineStart + m.index) ?? sLine;
      markers.push({ line: i + 1, hasReason: REASON_KEY_RE.test(span) });
    }
    // 1B — string verdicts (verdict:"FAILED"). The VALUE is blanked by sanitize,
    // so match on the RAW line, then confirm the marker is live code (not a
    // comment/string) by checking the sanitized buffer still holds the same char
    // at the marker's start — a blanked position means it was smuggled.
    for (const m of rLines[i].matchAll(NEGATIVE_STRING_VERDICT_RE)) {
      const at = lineStart + m.index;
      if (code[at] !== content[at]) continue; // blanked → comment/string value
      const span = enclosingObjectSpan(code, at) ?? sLine;
      markers.push({ line: i + 1, hasReason: REASON_KEY_RE.test(span) });
    }
    // 1C — status-family negative states (status/*_status:"BLOCKED"). Same
    // raw-match + liveness-mask as 1B, but the STRICT STATUS_REASON_KEY_RE: a
    // truth_label is NOT a blocker, so a status carrying only truth_label is bare.
    for (const m of rLines[i].matchAll(STATUS_NEGATIVE_RE)) {
      const at = lineStart + m.index;
      if (code[at] !== content[at]) continue; // blanked → comment/string value
      const span = enclosingObjectSpan(code, at) ?? sLine;
      markers.push({
        line: i + 1,
        hasReason: STATUS_REASON_KEY_RE.test(span),
        reason:
          "negative status-family state (status/*_status: BLOCKED|HOLD|FAILED|REJECT|CANNOT_PROVE) with no specific blocker key (blocked_by/blocked_reason/hold_reason/failed_precondition/reason/…) in its object — truth_label alone is NOT a blocker; add a cause key, or add to REASON_EXEMPT_ALLOWLIST",
      });
    }
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
    const base = basename(fileAbs);
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
              m.reason ??
              "negative verdict (verified/sealable:false/verdict:\"FAILED\") with no machine-readable reason key nearby — add a reason field, or add to REASON_EXEMPT_ALLOWLIST with a documented reason",
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
