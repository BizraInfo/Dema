#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const REVIEW_INFRA_PREFIXES = [".github/workflows/", "scripts/review/"];
const REVIEW_TEST_PREFIXES = ["tests/"];

// Whole-body JSON-true / literal-phrase overclaim patterns (rare, key-anchored).
// These scan the entire changed-file body, unchanged since the gate's origin.
const OVERCLAIM_PATTERNS = [
  [/"public_network"\s*:\s*true/, "public network enabled"],
  [/"node1_handshake"\s*:\s*true/, "Node1 handshake enabled"],
  [/"token_value_claim"\s*:\s*true/, "token value claim"],
  [/"real_token_value"\s*:\s*true/, "real token value claim"],
  [/"cash_value_claim"\s*:\s*true/, "cash value claim"],
  [/"federation_claim"\s*:\s*true/, "federation claim"],
  [/"sat_permit_claimed"\s*:\s*true/, "SAT permit claim"],
  [/"token_or_reward_claimed"\s*:\s*true/, "token or reward claim"],
  [/"verdict_authority"\s*:\s*"permit"/i, "SAT permit authority"],
  [/\bURP network live\b/i, "URP network live claim"],
  [/\bNode1 federation\b/i, "Node1 federation claim"],
  [/\breal SAT permit\b/i, "real SAT permit claim"],
  [/\bpublic Proof-of-Impact rewards\b/i, "public PoI rewards claim"],
  [/\bautonomous supervisor\b/i, "autonomous supervisor claim"],
];

// --- Bombast tiers (NO-OVERCLAIM-BOMBAST-1A) ---------------------------------
// Scanned per ADDED diff line only (not whole-body) so the gate scores only
// what an author NEWLY wrote — touching a file that already contains a kernel
// name never reds. Identifier safety is by regex lookaround (?<![\w-]) /
// (?![\w-]): any hyphen/underscore-adjacent token (diffusion-reasoner,
// peak_phase) is non-matching by construction — no fragile pre-strip pipeline.
// A line is exempt if it carries a same-line negation, a same-line truth-label,
// or (Tier A) the matched superlative is a quoted comma-lexicon literal.
//
// TIER A — hard-fail (exit 1): pure-marketing superlatives with ZERO legitimate
// standalone identifier use in this tree; a human author has no honest reason to
// newly add them as bare prose. peak/ultimate only when standalone AND modifying
// a capability noun (so peak-self-loop / peak_phase pass).
export const HARD_FAIL_BOMBAST = [
  [
    /\b(?:world[- ]class|best[- ]in[- ]class|cutting[- ]edge|state[- ]of[- ]the[- ]art|best ever|game[- ]chang(?:er|ing)|industry[- ]leading)\b/i,
    "pure-marketing superlative",
  ],
  [/\brevolutionary\b/i, "pure-marketing superlative (revolutionary)"],
  [
    /(?<![\w-])(?:peak|ultimate)(?![\w-])\s+(?:reasoning|intelligence|performance|engine|reasoner|capabilit(?:y|ies)|system|ai|model|accuracy|quality|solution|cognition|autonomy)\b/i,
    "peak/ultimate modifying a capability noun",
  ],
];

// TIER B — report-only (exit 0, prints REVIEW lines): capability/cognition words
// with heavy honest identifier + negation use on disk (diffusion-reasoner,
// autonomous_loop_started:false, 'NOT autonomous'). Surfaced for the reviewer,
// never blocked — blocking these would cry wolf, which an honesty gate must not.
export const REPORT_BOMBAST = [
  [
    /(?<![\w-])(?:reasoner|reasoning engine|intelligence|cognition|sentien\w*|conscious\w*|fully autonomous|autonomous)(?![\w-])/i,
    "capability/cognition word asserted",
  ],
];

const NEGATION =
  /\b(?:not|no|never|non|without|isn'?t|aren'?t|won'?t|cannot|can'?t|n'?t|neither|nor|rather than|instead of)\b/i;
const ALLCAPS_NOT = /\bNOT\b|\bNOT_[A-Z]|_NOT_/;

// Deliberate truth-acts an author TYPES to qualify a claim. Case-sensitive on
// the caps taxonomy tokens so incidental lowercase prose ("we planned ...")
// cannot disarm a hard-fail. These exempt even Tier A.
const STRUCTURED_TRUTH_LABEL =
  /(?:DESIGNED_NOT_LIVE|NOT_LIVE|WIRED_PARTIAL|LOCAL_ONLY|PLANNED|ASPIRATIONAL|DECLARED|CANDIDATE|preview-only|preview only)/;

// Soft, incidental words that co-occur with capability prose by accident (bare
// 'preview', 'deterministic', 'metaphor', 'scaffold'). NOT a deliberate
// qualification — they only damp the REPORT-ONLY tier and must NEVER disarm a
// Tier-A hard-fail (critic finding: bare 'preview' was a one-word bypass).
const SOFT_LABEL = /(?:\bpreview\b|\bdeterministic\b|\bmetaphor\b|\bscaffold\b)/i;

// Tier-A (hard-fail) exemption: a deliberate negation or a structured truth-act.
function hardFailExempt(line) {
  return (
    NEGATION.test(line) ||
    ALLCAPS_NOT.test(line) ||
    STRUCTURED_TRUTH_LABEL.test(line)
  );
}

// Tier-B (report-only) exemption: the above plus soft incidental labels — a
// looser bar is acceptable because this tier only warns, it never blocks.
function reportExempt(line) {
  return hardFailExempt(line) || SOFT_LABEL.test(line);
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function quotedCommaLexicon(line, matchText) {
  return (
    line.includes(",") &&
    new RegExp(`["'\`]\\s*${escapeRe(matchText)}\\s*["'\`]`).test(line)
  );
}

// Pure classifier over a single added line (leading '+' already stripped).
// Returns { hardFail: string[], report: string[] }. Exported for unit tests.
export function classifyLine(line) {
  const hardFail = [];
  if (!hardFailExempt(line)) {
    for (const [re, label] of HARD_FAIL_BOMBAST) {
      const m = line.match(re);
      if (m && !quotedCommaLexicon(line, m[0])) hardFail.push(label);
    }
  }
  const report = [];
  if (!reportExempt(line)) {
    for (const [re, label] of REPORT_BOMBAST) {
      if (re.test(line)) report.push(label);
    }
  }
  return { hardFail, report };
}

function baseRef() {
  return (
    process.env.BIZRA_REVIEW_BASE ||
    (process.env.GITHUB_BASE_REF
      ? `origin/${process.env.GITHUB_BASE_REF}`
      : "origin/main")
  );
}

function changedFiles() {
  return execFileSync("git", ["diff", "--name-only", `${baseRef()}...HEAD`], {
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
}

// Added ('+') lines for one file, leading '+' stripped so column-0 anchors and
// lookbehinds operate on the real source text. Per-file failure yields [].
function addedLines(file) {
  try {
    const out = execFileSync(
      "git",
      ["diff", "--unified=0", `${baseRef()}...HEAD`, "--", file],
      { encoding: "utf8" },
    );
    return out
      .split("\n")
      .filter((l) => /^\+(?!\+)/.test(l))
      .map((l) => l.slice(1));
  } catch {
    return [];
  }
}

function safeChangedFiles() {
  // The base-ref diff is unavailable in a shallow checkout (no origin/main or
  // no merge base) — e.g. the check.yml CI job. Skip gracefully there; this
  // gate stays enforced in the full-history BIZRA review job and runs fully
  // in any full clone (local `npm run check`).
  try {
    return changedFiles();
  } catch {
    console.log(
      JSON.stringify(
        {
          schema: "bizra.dema.review.no_overclaim.v0.1",
          ok: true,
          skipped: true,
          reason: `base ref ${baseRef()} unavailable (shallow checkout / no merge base); enforced in the full-history BIZRA review job`,
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }
}

function main() {
  const scanned = [];
  const findings = [];
  const warnings = [];
  for (const file of safeChangedFiles()) {
    if (REVIEW_INFRA_PREFIXES.some((prefix) => file.startsWith(prefix))) continue;
    if (REVIEW_TEST_PREFIXES.some((prefix) => file.startsWith(prefix))) continue;
    if (!/\.(json|mjs|js|md|yml|yaml)$/.test(file)) continue;
    const body = readFileSync(file, "utf8");
    scanned.push(file);
    // Whole-body JSON-true / literal-phrase patterns.
    for (const [pattern, label] of OVERCLAIM_PATTERNS) {
      if (pattern.test(body))
        findings.push({ file, label, pattern: String(pattern) });
    }
    // Bombast tiers — added lines only.
    for (const line of addedLines(file)) {
      const { hardFail, report } = classifyLine(line);
      for (const label of hardFail)
        findings.push({ file, label, line: line.trim().slice(0, 200) });
      for (const label of report)
        warnings.push({ file, label, line: line.trim().slice(0, 200) });
    }
  }

  // Report-only tier: surface for the reviewer; never affects exit code.
  for (const w of warnings) {
    console.log(
      `REVIEW: ${w.file}:added — ${w.label} — confirm deterministic-validator + same-line truth-label — ${w.line}`,
    );
  }

  if (findings.length > 0) {
    throw new Error(
      `BIZRA no-overclaim gate failed: ${JSON.stringify(findings, null, 2)}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        schema: "bizra.dema.review.no_overclaim.v0.1",
        ok: true,
        scanned_files: scanned,
        blocked_claims: OVERCLAIM_PATTERNS.map(([, label]) => label),
        bombast_hard_fail: HARD_FAIL_BOMBAST.map(([, label]) => label),
        review_warnings: warnings,
      },
      null,
      2,
    ),
  );
}

// Run only when invoked directly (node scripts/review/no-overclaim.mjs);
// importing for tests is side-effect-free (no git shell-out on import).
if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
