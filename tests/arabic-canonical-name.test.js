// ARABIC-NAME-GUARD — BIZRA is البذرة (the seed), with ذال.
//
// Operator correction 2026-07-28: a bilingual investor document authored in
// this session spelled the name with zaay instead of thaal, three times. That is not a
// typo with cosmetic cost — البذرة means "the seed", which is the founding
// metaphor of the whole system (seed-pattern invariant, خزينة البذرة, the
// Third Fact lineage). The zaay spelling is a different word and carries none of it. The
// correct form was already canon in packages/core/src/canon-glossary.js
// ("BIZRA (البذرة, the seed)"), so the new document contradicted the tree.
//
// Machine-authored Arabic is user-space output (LLM as CPU): it does not get
// to define the brand's own name. This gate is the kernel refusing it. The
// operator is a native speaker and the authority here; this test encodes his
// correction so the same error cannot re-enter through any future document,
// component, or string file.

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const execFileAsync = promisify(execFile);
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// The misspelling: baa + optional diacritic + zaay + raa + taa marbuta.
// Built from code points on purpose — writing the wrong form literally here
// would make this guard flag its own source the moment it became tracked
// (measured: it did exactly that on first commit).
const WRONG_NAME = new RegExp("\u0628[\u064B-\u0652]*\u0632\u0631\u0629", "u");

async function trackedTextFiles() {
  const { stdout } = await execFileAsync(
    "git",
    ["ls-files", "-z", "*.md", "*.js", "*.mjs", "*.ts", "*.tsx", "*.json"],
    { cwd: REPO_ROOT, maxBuffer: 32 * 1024 * 1024 },
  );
  return stdout.split("\0").filter(Boolean);
}

test("no tracked file spells BIZRA with zaay — the name is البذرة (the seed)", async () => {
  const files = await trackedTextFiles();
  assert.ok(files.length > 0, "expected tracked files to scan");

  const offenders = [];
  for (const file of files) {
    let source;
    try {
      source = await readFile(join(REPO_ROOT, file), "utf8");
    } catch {
      continue; // unreadable or removed between listing and read
    }
    // Cheap ASCII-only bail before running the regex on large files.
    if (!/[؀-ۿ]/u.test(source)) continue;
    const lines = source.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      if (WRONG_NAME.test(lines[i])) {
        offenders.push(`${file}:${i + 1}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `BIZRA must be written البذرة (thaal), never with zaay, at:\n  ${offenders.join("\n  ")}`,
  );
});

test("the canonical spelling is present in the glossary, so the guard has a referent", async () => {
  const glossary = await readFile(
    join(REPO_ROOT, "packages/core/src/canon-glossary.js"),
    "utf8",
  );
  assert.match(
    glossary,
    /البذرة/u,
    "canon glossary must carry the correct Arabic name",
  );
});

// ARABIC-LIGATURE-GUARD — the lam-alef (لإ) ligature must never decompose backwards.
//
// Measured 2026-07-31: the canon tagline reached docs/gtm/ — and an open PR —
// with the tagline's second word opening U+0627 U+0625 U+0644 … where canon
// opens U+0627 U+0644 U+0625 …. The lam and the hamza-carrying alef are
// transposed: the signature of a lam-alef presentation form (ﻹ) converted
// back to base characters in the wrong order, which is what PDF text
// extraction does — and the root canon lives in docs/root-canon/source/*.pdf.
// The result is not a word.
//
// It reached the PR because Layer-1 audits claim discipline and leakage, not
// orthography, and reported PUBLIC_SAFE. Nothing else was looking. The line it
// broke is the tagline — the most quoted sentence the project has.
//
// The tell that pins the mechanism: `كل إنسان` on the adjacent canon line is
// correct, because the space prevents the ligature from forming. Only the لإ
// word corrupted.
//
// Pattern: a bare alef immediately followed by a hamza-carrying alef. Two
// consecutive alef forms do not occur inside a word in Arabic orthography, so
// this cannot fire on valid text — measured across 2,199 tracked files: 2
// hits, both the real defect, zero false positives. Built from code points for
// the same reason the name guard above is: writing the broken form literally
// would make this file flag its own source.
const BROKEN_LAM_ALEF = new RegExp("ا[آأإ]", "u");

test("no tracked file carries a backwards lam-alef ligature", async () => {
  const files = await trackedTextFiles();
  assert.ok(files.length > 0, "expected tracked files to scan");

  const offenders = [];
  for (const file of files) {
    let source;
    try {
      source = await readFile(join(REPO_ROOT, file), "utf8");
    } catch {
      continue; // unreadable or removed between listing and read
    }
    if (!/[؀-ۿ]/u.test(source)) continue;
    const lines = source.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      if (BROKEN_LAM_ALEF.test(lines[i])) {
        offenders.push(`${file}:${i + 1}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    // The broken sequence is named by code point, never rendered. Writing it
    // literally here is what made this guard fail on its own assertion message
    // — the file is tracked, so the scan reads this line too.
    `backwards lam-alef ligature — an alef immediately followed by a hamza-alef (U+0627 then U+0625/U+0623/U+0622) — at:\n  ${offenders.join("\n  ")}\nRestore the lam before the hamza-alef: the word must open U+0627 U+0644 U+0625, as in الإنسانية.`,
  );
});
