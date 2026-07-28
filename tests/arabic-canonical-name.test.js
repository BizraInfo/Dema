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
