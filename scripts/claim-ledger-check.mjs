#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const SCHEMA = "bizra.dema.claim_ledger_check.v0.1";

export const LABELS = [
  "MEASURED",
  "CITED",
  "DECLARED",
  "PLANNED",
  "REMOVE_OR_HARDEN",
];

// The repo's own maturity vocabulary (docs/CLAIM_REGISTER_v0.1 ladder + the
// DESIGNED_NOT_LIVE / DERIVED / SCENARIO evidence states). A claim carrying one
// of these in a FORMATTED form (**X** / [X] / `X`) already declares its
// proof-state, so it is honestly labeled and must not be flagged as an
// overclaim. Bare prose words (e.g. "designed to…") are NOT labels — the
// formatting requirement in hasLabel() keeps that distinction. `UNKNOWN` is
// deliberately excluded: it asserts no proof state, so it should not suppress.
export const MATURITY_LABELS = [
  "DESIGNED",
  "DESIGNED_NOT_LIVE",
  "MECHANISM_VERIFIED_SYNTHETIC",
  "REAL_OPERATOR_VERIFIED",
  "PUBLIC_MAIN_SYNCED",
  "PRODUCTION_ACTIVE",
  "DERIVED",
  "SCENARIO",
];

export const RISK_PATTERNS = [
  {
    kind: "benchmark",
    // Two shapes: (A) a number + an unambiguous performance unit (req/s, ms,
    // F1, Nx / N-fold improvement — `[-\s]{0,2}` tolerates the "10-fold" hyphen);
    // and (B) a percentage ONLY in measurement context (95% accuracy, 99.9%
    // uptime). Bare `%` is intentionally NOT a unit so posture/constitutional
    // percentages (100% local-first, 2.5% Zakat, 50% pool) do not flag —
    // "99.94% F1" still trips via the F1 noun in (B). Bounded — ReDoS-safe.
    pattern:
      /\b\d+(?:,\d{3})*(?:\.\d+)?[-\s]{0,2}(?:requests\/second|req\/s|milliseconds?|ms|F1-score|F1|x\s+improvement|fold\s+improvement)(?=\s|$|[^\w%])|\b\d+(?:\.\d+)?\s*%\s*(?:accuracy|precision|recall|f1(?:-score)?|score|uptime|improvement|reduction|faster|throughput|coverage|latency)\b/i,
    reason: "numeric benchmark claims require measured or cited evidence",
  },
  {
    kind: "first_or_only",
    // Tightened to exclusivity *phrasing* so BIZRA's own safety vocabulary
    // (local-first, metadata-only, preview-only, read-only) is not flagged as
    // an overclaim, while real "world's first / the only X / first … in
    // existence / first-of-its-kind / truly unique" claims still trip. Note
    // `unique` is caught only in its overclaim phrasing (truly/completely/…
    // unique) — bare "unique" is reserved technical vocab (unique hash, unique
    // identifier) and must NOT flag. Alternation of bounded literals — ReDoS-safe.
    pattern:
      /\b(?:world['’]?s\s+first|first[-\s]ever|first\s+formally[-\s]verified|definitive|unprecedented|first[-\s]of[-\s]its[-\s]kind|one[-\s]of[-\s]a[-\s]kind|(?:truly|completely|wholly|entirely|utterly)\s+unique|the\s+only\s+\w|first\b[^.\n]{0,60}\bin\s+existence\b)/i,
    reason: "first-ever or exclusivity claims require hard evidence",
  },
  {
    kind: "formal_verification",
    pattern:
      /\b(formally verified|formal safety proof|Z3|SMT|necessary and sufficient)\b/i,
    reason:
      "formal-methods claims require proof artifacts or declared-theory framing",
  },
  {
    kind: "cryptographic",
    pattern:
      /\b(post-quantum|Ed25519|ML-KEM|Dilithium|cryptographic receipt|signed receipt|hash-committed)\b/i,
    reason:
      "cryptographic claims require implementation evidence or planned status",
  },
  {
    kind: "economic",
    // Scoped to economic *phrasing* so generic/ML/incidental vocab (auth token,
    // reward function, next-token prediction, token discipline, Linux Mint) is
    // NOT flagged, while real IMP/token-economy/minted-reward claims still trip.
    // The only quantifier is the bounded [^.\n]{0,20} mint→unit gap — ReDoS-safe.
    pattern:
      /\b(?:IMP\b|tokenomics|economic\s+value|cash\s+value|mint(?:s|ed|ing)?\b[^.\n]{0,20}\b(?:tokens?|rewards?|coins?)\b|(?:utility|governance|staking)\s+tokens?\b|tokens?\s+(?:economy|economics|supply|issuance|rewards?|holders?)\b|(?:IMP|token|staking)\s+rewards?\b|rewards?\s+(?:are\s+|is\s+|get\s+)?(?:minted|issued|accrue|distributed|staked)\b)/i,
    reason: "economic claims require verified impact and governance evidence",
  },
  {
    kind: "deployment",
    pattern:
      /\b(production-ready|deployable|autonomous deployment|public network live|URP\s+network\s+live)\b/i,
    reason: "deployment claims require operational evidence",
  },
];

// A prose claim may cite its provenance in the machine-readable register via
// [claim:<ID>] (e.g. [claim:C-TOKEN-ECONOMY]). The citation points the claim at
// a knowledge object that carries its proof-state, so structurally it is a
// provenance label and hasLabel() credits it. Integrity is enforced separately:
// scripts/claims/claim-corpus-gate.mjs verifies every cited id resolves to a
// real register entry (no provenance without a knowledge object).
const CLAIM_CITATION = /\[claim:([A-Za-z0-9_-]+)\]/g;

export function extractClaimCitations(text) {
  return [...String(text).matchAll(CLAIM_CITATION)].map((m) => m[1]);
}

function hasClaimCitation(text) {
  return /\[claim:[A-Za-z0-9_-]+\]/.test(text);
}

function hasLabel(text) {
  if (hasClaimCitation(text)) return true;
  return [...LABELS, ...MATURITY_LABELS].some((label) => {
    const bracketed = `[${label}]`;
    const markdown = `**${label}**`;
    const code = `\`${label}\``;
    return (
      text.includes(bracketed) || text.includes(markdown) || text.includes(code)
    );
  });
}

function isStandaloneLabel(text) {
  let normalized = text.trim();
  for (const label of LABELS) {
    normalized = normalized
      .replaceAll(`[${label}]`, "")
      .replaceAll(`**${label}**`, "")
      .replaceAll(`\`${label}\``, "");
  }
  return normalized.replace(/[:—-]/g, "").trim() === "";
}

function previousNonEmptyLine(lines, index) {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const line = lines[cursor].trim();
    if (line) return line;
  }
  return "";
}

function lineIsCodeFence(line) {
  return line.trim().startsWith("```");
}

// Inline-code spans (`like-this`) are identifiers, command names, field names,
// or terms being *referenced* — not prose claims. A risk word that appears ONLY
// inside a code span is a reference, not an assertion (e.g. a style guide line
// "Do not use `production-ready`", or a forbidden-terms list). Strip code spans
// before matching so those don't flag; the original line is still used for
// labels and for the reported `text`. A risk word in surrounding prose still
// matches. Tradeoff: a claim whose subject sits only in code (`token economy`
// is live) is not flagged — rare, and the ratchet baseline review catches it.
function stripInlineCode(line) {
  return line.replace(/`[^`]*`/g, " ");
}

export function auditMarkdown({ file, body }) {
  const lines = body.split(/\r?\n/);
  const findings = [];
  let inFence = false;

  lines.forEach((line, index) => {
    if (lineIsCodeFence(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence || !line.trim()) return;

    const prior = previousNonEmptyLine(lines, index);
    if (hasLabel(line) || (hasLabel(prior) && isStandaloneLabel(prior))) return;

    const probe = stripInlineCode(line);
    for (const risk of RISK_PATTERNS) {
      if (!risk.pattern.test(probe)) continue;
      findings.push({
        file,
        line: index + 1,
        kind: risk.kind,
        reason: risk.reason,
        text: line.trim(),
      });
    }
  });

  return {
    file,
    ok: findings.length === 0,
    findings,
  };
}

async function auditFile(file) {
  const body = await readFile(file, "utf8");
  return auditMarkdown({ file, body });
}

function usage() {
  return [
    "Usage: node scripts/claim-ledger-check.mjs [--json] FILE.md [FILE.md...]",
    "",
    "Flags risky research-paper claims that lack one of:",
    LABELS.map((label) => `  [${label}]`).join("\n"),
  ].join("\n");
}

async function main(argv = process.argv.slice(2)) {
  const json = argv.includes("--json");
  const files = argv.filter((arg) => arg !== "--json");

  if (files.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    console.log(usage());
    return 0;
  }

  const fileReports = await Promise.all(files.map(auditFile));
  const findings = fileReports.flatMap((report) => report.findings);
  const report = {
    schema: SCHEMA,
    ok: findings.length === 0,
    scanned_files: files,
    labels: LABELS,
    risk_patterns: RISK_PATTERNS.map(({ kind, reason }) => ({ kind, reason })),
    findings,
  };

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else if (report.ok) {
    console.log(
      `Claim ledger check passed: ${files.length} file(s), 0 findings.`,
    );
  } else {
    console.log(`Claim ledger check failed: ${findings.length} finding(s).`);
    for (const finding of findings) {
      console.log(
        `${finding.file}:${finding.line} ${finding.kind} — ${finding.reason}`,
      );
      console.log(`  ${finding.text}`);
    }
  }

  return report.ok ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(error.message);
      process.exitCode = 1;
    },
  );
}
