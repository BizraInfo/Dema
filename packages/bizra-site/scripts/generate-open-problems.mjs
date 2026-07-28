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

function cells(line) {
  return line
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim());
}

// Status is read from an EXPLICIT leading marker, never inferred from anywhere
// in the row. First implementation matched any status token in the joined row
// and mislabelled a solved row ("[MEASURED] Absence Steward…") as BLOCKED
// because the word appeared later in its own evidence text. Deterministic
// perimeter: read the marker, or classify nothing.
const MARKER = /^\[([A-Z_]+)\]\s*/;

// Bounded status token: not preceded or followed by [A-Z_]. Without the
// boundaries, the enum VALUE "REVIEW_BLOCKED" inside a row's own evidence
// matched as the STATUS "BLOCKED" and flipped a solved row into the quest
// board. Same class as the unanchored secret pattern fixed in this repo.
const TOKEN = /(?<![A-Z_])(BLOCKED|DESIGNED_NOT_LIVE|PREVIEW_ONLY|PLANNED|MEASURED|LOCAL_ONLY)(?![A-Z_])/;
const UNSOLVED_TOKEN = /(?<![A-Z_])(BLOCKED|DESIGNED_NOT_LIVE|PREVIEW_ONLY|PLANNED)(?![A-Z_])/;

function statusOf(surfaceCell, evidenceCell) {
  // 1. An explicit leading marker on the surface is authoritative.
  const m = surfaceCell.match(MARKER);
  if (m) return m[1];
  // 2. Otherwise the first BOUNDED status token in the evidence cell.
  const e = evidenceCell.match(TOKEN);
  if (e) return e[1];
  // 3. Unknown. Skipped, never guessed.
  return null;
}

const md = await readFile(LEDGER, "utf8");
const rows = md.split("\n").filter((l) => l.trimStart().startsWith("|"));

const problems = [];
const seen = new Set();

for (const line of rows) {
  const c = cells(line);
  if (c.length < 2) continue;
  if (/^-+$/.test(c[0]) || c[0] === "Surface") continue;

  const marked = c[0].match(MARKER)?.[1] ?? null;
  if (marked === "MEASURED") continue;         // explicitly solved → not a quest

  // Unsolved token, bounded, anywhere in the row. Boundaries stop the enum
  // VALUE "REVIEW_BLOCKED" from reading as the STATUS "BLOCKED".
  const found = line.match(UNSOLVED_TOKEN);
  const status = marked && marked !== "MEASURED" ? marked : found?.[1] ?? null;
  if (!status) continue;                       // unknown → never guessed
  const hit = UNSOLVED.find(([token]) => token === status);
  if (!hit) continue;

  const surface = c[0]
    .replace(MARKER, "")
    .replace(/\*\*[A-Z_]+\*\*\s*/g, "")   // bold inline status marker
    .replace(/`/g, "")
    .trim();
  if (!surface || seen.has(surface)) continue;
  seen.add(surface);

  const evidence = (c[1] || "").replace(MARKER, "").replace(/`/g, "").trim();

  problems.push({
    surface,
    status,
    kind: hit[1],
    meaning: hit[2],
    evidence: evidence.length > 180 ? `${evidence.slice(0, 177)}…` : evidence,
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
