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

export const RISK_PATTERNS = [
  {
    kind: "benchmark",
    pattern:
      /\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:requests\/second|req\/s|milliseconds?|ms|%|F1-score|F1|x improvement|fold improvement)(?=\s|$|[^\w%])/i,
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

function hasLabel(text) {
  return LABELS.some((label) => {
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

    for (const risk of RISK_PATTERNS) {
      if (!risk.pattern.test(line)) continue;
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
