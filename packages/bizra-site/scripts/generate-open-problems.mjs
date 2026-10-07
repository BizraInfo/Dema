#!/usr/bin/env node
// Generates the Open Problems board from docs/CURRENT_LIMITS.md — the repo's own
// honesty ledger. The board is DERIVED, never authored: a problem appears here
// because a row in the ledger is not MEASURED, and it disappears the moment
// someone proves it. Nobody can add a quest by writing marketing copy.
//
// Run: node scripts/generate-open-problems.mjs   (from packages/bizra-site)

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const LEDGER = resolve(HERE, "..", "..", "..", "docs", "CURRENT_LIMITS.md");
const OUT = resolve(HERE, "..", "src", "lib", "open-problems.json");

// Unsolved statuses, ordered hardest-first. MEASURED is deliberately absent:
// a solved row is not a quest.
const UNSOLVED = [
  ["BLOCKED", "blocked", "Something concrete stands in the way. Name it and it moves."],
  ["DESIGNED_NOT_LIVE", "designed", "The design exists. Nothing runs it yet."],
  ["PREVIEW_ONLY", "preview", "A surface exists and is honest about performing nothing."],
  ["PLANNED", "planned", "Declared intent. No implementation."],
];

const UNSOLVED_SET = new Set(UNSOLVED.map(([token]) => token));
const SOLVED_SET = new Set(["MEASURED", "LOCAL_ONLY", "MEASURED_LOCAL"]);

function cells(line) {
  return line
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim());
}

// Status is read ONLY from an explicit leading status marker on the surface
// cell (authoritative) or, if absent, on the evidence cell:
//   [STATUS] …   or   **STATUS** …
// Never from prose elsewhere in the row — historical "was BLOCKED" / enum
// VALUE "REVIEW_BLOCKED" text must not publish a solved capability as an open
// door.
const BRACKET_MARKER = /^\[([A-Z_]+)\]\s*/;
const BOLD_MARKER = /^\*\*([A-Z_]+)\*\*\s*/;
const LEADING_MARKER = /^(\[([A-Z_]+)\]|\*\*([A-Z_]+)\*\*)\s*/;

function leadingStatus(cell) {
  const raw = String(cell || "");
  const bracket = raw.match(BRACKET_MARKER);
  if (bracket) return bracket[1];
  const bold = raw.match(BOLD_MARKER);
  if (bold) return bold[1];
  return null;
}

function statusOf(surfaceCell, evidenceCell) {
  return leadingStatus(surfaceCell) ?? leadingStatus(evidenceCell);
}

const md = await readFile(LEDGER, "utf8");
const rows = md.split("\n").filter((l) => l.trimStart().startsWith("|"));

const problems = [];
const seen = new Set();

for (const line of rows) {
  const c = cells(line);
  if (c.length < 2) continue;
  if (/^-+$/.test(c[0]) || c[0] === "Surface") continue;

  const status = statusOf(c[0], c[1]);
  if (!status || SOLVED_SET.has(status) || !UNSOLVED_SET.has(status)) continue;

  const hit = UNSOLVED.find(([token]) => token === status);
  if (!hit) continue;

  const surface = c[0]
    .replace(LEADING_MARKER, "")
    .replace(/`/g, "")
    .trim();
  if (!surface || seen.has(surface)) continue;
  seen.add(surface);

  // Keep the complete evidence string in the inventory. UI may truncate for
  // display; the generator must not discard ledger proof text.
  const evidence = (c[1] || "")
    .replace(LEADING_MARKER, "")
    .replace(/`/g, "")
    .trim();

  problems.push({
    surface,
    status,
    kind: hit[1],
    meaning: hit[2],
    evidence,
  });
}

const byKind = Object.fromEntries(
  UNSOLVED.map(([token, kind]) => [
    kind,
    problems.filter((p) => p.status === token).length,
  ]),
);

const payload = {
  schema: "bizra.site.open_problems.v0_1",
  source: "docs/CURRENT_LIMITS.md",
  generated_from_ledger_rows: rows.length,
  total_open: problems.length,
  by_kind: byKind,
  problems,
};

await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(
  `open-problems: ${problems.length} open · ${JSON.stringify(byKind)} → src/lib/open-problems.json`,
);
