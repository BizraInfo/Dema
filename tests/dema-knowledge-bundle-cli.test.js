// DEMA-KNOWLEDGE-BUNDLE-READER-1A — the CLI caller: `dema canon knowledge`.
//
// End-to-end against a FIXTURE bundle in a temp dir (never the operator's real
// /data/bizra/knowledge — that path is machine-specific and a test that read it
// would go green/red with the operator's curation, not with this code).

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyKnowledgeBundleView } from "../packages/core/src/dema-knowledge-bundle-reader.js";

const CLI = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));

function makeFixtureBundle() {
  const root = mkdtempSync(join(tmpdir(), "kbr-fixture-"));
  writeFileSync(
    join(root, "index.md"),
    "---\ntype: index\ntitle: \"Fixture Bundle\"\n---\n# fixture\n",
  );
  writeFileSync(join(root, "log.md"), "# change log\n");
  mkdirSync(join(root, "canon"));
  writeFileSync(
    join(root, "canon", "index.md"),
    "---\ntype: index\ntitle: \"Canon\"\n---\nindex\n",
  );
  writeFileSync(
    join(root, "canon", "claim-discipline.md"),
    "---\ntype: doctrine\ntitle: \"Claim Discipline\"\nsource: \"repo\"\n---\nbody\n",
  );
  mkdirSync(join(root, "lessons"));
  writeFileSync(
    join(root, "lessons", "lawless.md"),
    "no frontmatter at all — violates the card law\n",
  );
  // Machinery, not knowledge: dot-directories must never be counted as card
  // folders (measured on first live run: .git and .claude appeared as folders).
  mkdirSync(join(root, ".git"));
  writeFileSync(join(root, ".git", "not-a-card.md"), "machinery\n");
  return root;
}

function runCli(args, env = {}) {
  return spawnSync("node", [CLI, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

test("KBR-CLI-01 reads a fixture bundle end-to-end; the emitted envelope re-verifies", () => {
  const root = makeFixtureBundle();
  const r = runCli(["canon", "knowledge", "--path", root, "--json"]);
  assert.equal(r.status, 0, `stderr:\n${r.stderr}\nstdout:\n${r.stdout}`);
  const view = JSON.parse(r.stdout);
  assert.equal(view.bundle_present, true);
  assert.equal(view.card_count, 3);
  assert.equal(view.log_present, true);
  assert.equal(view.law_violation_count, 1);
  assert.equal(view.law_violations[0].file, "lessons/lawless.md");
  // The same verify the command ran inside its emit path must hold out here.
  assert.deepEqual(verifyKnowledgeBundleView(view), { ok: true });
  for (const value of Object.values(view.boundary)) assert.equal(value, false);
  // Dot-directories are machinery, never card folders.
  assert.deepEqual(view.folders.map((f) => f.name), ["canon", "lessons"]);
});

test("KBR-CLI-02 human output always states the law count, and an absent bundle refuses loudly", () => {
  const root = makeFixtureBundle();
  const ok = runCli(["canon", "knowledge", "--path", root]);
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /law violations: 1/);
  assert.match(ok.stdout, /cards: 3/);

  const missing = runCli(["canon", "knowledge", "--path", join(root, "does-not-exist")]);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /no knowledge bundle/i);
});

test("KBR-CLI-03 discoverable: the canon usage text names the knowledge subcommand", () => {
  const r = runCli(["canon"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /canon knowledge/);
});
