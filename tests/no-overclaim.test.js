// Tests for the no-overclaim review gate's bombast tiers (NO-OVERCLAIM-BOMBAST-1A).
//
// The gate at scripts/review/no-overclaim.mjs hard-fails a curated set of
// pure-marketing superlatives and report-only-warns on capability words that
// have legitimate identifier/disclaimer use. Detection is per added diff line.
// We unit-test the pure classifier (classifyLine) directly — no git shell-out —
// against the design's verified test matrix. Identifier safety is by regex
// lookaround; same-line negation / truth-label / quoted-comma-lexicon exempt.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  classifyLine,
  HARD_FAIL_BOMBAST,
  REPORT_BOMBAST,
} from "../scripts/review/no-overclaim.mjs";

const gatePath = fileURLToPath(
  new URL("../scripts/review/no-overclaim.mjs", import.meta.url),
);

function git(cwd, args) {
  // Scrub repo-redirecting variables (git exports GIT_DIR inside hooks, and
  // this suite runs under pre-push:seal): mutating commands here must never
  // resolve to the real repository. Null config files also keep operator
  // globals (commit.gpgsign, core.hooksPath) out of the disposable fixture.
  const env = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  const result = spawnSync("git", args, { cwd, encoding: "utf8", env });
  assert.equal(result.status, 0, result.stderr);
}

// Each row is an added line (leading '+' already stripped, as the gate does).
// expect "fail" => classifyLine(line).hardFail is non-empty (gate would exit 1).
// expect "pass" => classifyLine(line).hardFail is empty (gate stays green).
const MATRIX = [
  { line: "Dema is a world-class autonomous reasoning engine.", expect: "fail" },
  { line: "This delivers peak reasoning performance out of the box.", expect: "fail" },
  { line: "The ultimate intelligence engine, cutting-edge and revolutionary.", expect: "fail" },
  { line: "// PEAK-SELF-LOOP-1A · Ultra-micro proactive self-loop preview (pure compose).", expect: "pass" },
  { line: '  "revolutionary", "best ever", "world-class", "cutting-edge", "perfect",', expect: "pass" },
  { line: "// NOT autonomous runtime. NOT HHMM engine. NOT economic activation.", expect: "pass" },
  { line: "| Diffusion-reasoner (deterministic denoising-convergence, NOT a neural model) | x |", expect: "pass" },
  { line: "- Distributed intelligence network is live -> status today: DESIGNED_NOT_LIVE (preview-only)", expect: "pass" },
  { line: "The `reasoner` / `HHMM` / `diffusion` names describe the shape of a metaphor, not a live ML algorithm.", expect: "pass" },
  { line: 'These five kernels are sometimes referred to collectively as a "reasoning framework." That label oversells them.', expect: "pass" },
  { line: 'export const DIFFUSION_REASONER_SCHEMA = "bizra.dema.diffusion_reasoner.v0.1";', expect: "pass" },
  { line: "      highest_score_autonomous_engine:", expect: "pass" },
  { line: "Checks local gates (llm:guidance, diff hygiene) for world-class hygiene.", expect: "fail" },
  { line: "Dema ships an autonomous reasoner with built-in intelligence.", expect: "pass" },
];

for (const { line, expect } of MATRIX) {
  test(`classifyLine ${expect === "fail" ? "HARD-FAILS" : "passes"}: ${line.slice(0, 56)}`, () => {
    const { hardFail } = classifyLine(line);
    if (expect === "fail") {
      assert.ok(hardFail.length > 0, `expected a hard-fail label, got none for: ${line}`);
    } else {
      assert.equal(hardFail.length, 0, `expected NO hard-fail, got ${JSON.stringify(hardFail)} for: ${line}`);
    }
  });
}

test("report-only tier surfaces capability words WITHOUT blocking", () => {
  // Tier-B word, no Tier-A superlative, no identifier binding, no negation/label.
  const { hardFail, report } = classifyLine("Dema ships an autonomous reasoner with built-in intelligence.");
  assert.equal(hardFail.length, 0, "report-only words must never hard-fail");
  assert.ok(report.length > 0, "capability words should surface as a REVIEW warning");
});

test("same-line negation exempts the whole line", () => {
  assert.equal(classifyLine("This is NOT a world-class system.").hardFail.length, 0);
});

test("same-line truth-label exempts the whole line", () => {
  assert.equal(
    classifyLine("world-class throughput -> status today: DESIGNED_NOT_LIVE (preview-only)").hardFail.length,
    0,
  );
});

test("quoted-comma lexicon literal is not a claim", () => {
  assert.equal(classifyLine('  "world-class", "cutting-edge", "revolutionary",').hardFail.length, 0);
});

test("hyphen/underscore identifier binding passes (peak-self-loop, peak_phase)", () => {
  assert.equal(classifyLine("import { peak_phase } from './peak-self-loop-preview.js';").hardFail.length, 0);
});

test("bare bombast WITHOUT any label hard-fails (exemption floor)", () => {
  // Anchors the floor: if a future edit over-broadens the exemptions, this reds.
  assert.ok(classifyLine("Dema is a world-class engine.").hardFail.length > 0);
});

test("a bare soft word (preview/deterministic) does NOT exempt Tier-A bombast", () => {
  // Critic bypass: only a DELIBERATE structured truth-act exempts a hard-fail —
  // an incidental adjective like bare 'preview'/'deterministic' must not.
  assert.ok(
    classifyLine("Dema is the world-class autonomous reasoning engine — preview docs below.").hardFail.length > 0,
    "bare 'preview' must not disarm Tier-A",
  );
  assert.ok(
    classifyLine("our world-class deterministic pipeline ships today").hardFail.length > 0,
    "bare 'deterministic' must not disarm Tier-A",
  );
});

test("a deliberate structured truth-act DOES exempt Tier-A bombast", () => {
  assert.equal(
    classifyLine("world-class throughput — status: DESIGNED_NOT_LIVE").hardFail.length,
    0,
  );
});

// Stale-list guards: mirror kernel-purity's stale-allowlist guard so a future
// edit that empties a tier is caught (the tiers are load-bearing, not cosmetic).
test("bombast pattern tiers are non-empty (stale-list guard)", () => {
  assert.ok(HARD_FAIL_BOMBAST.length >= 3, "HARD_FAIL_BOMBAST must keep its curated superlatives");
  assert.ok(REPORT_BOMBAST.length >= 1, "REPORT_BOMBAST must keep its capability words");
});

test("CLI ignores deleted changed files because no current body remains to scan", (t) => {
  const repo = mkdtempSync(join(tmpdir(), "dema-no-overclaim-deletion-"));
  t.after(() => rmSync(repo, { recursive: true, force: true }));

  git(repo, ["init", "-q"]);
  git(repo, ["config", "user.email", "dema-test@example.invalid"]);
  git(repo, ["config", "user.name", "Dema Test"]);
  mkdirSync(join(repo, "docs"));
  writeFileSync(join(repo, "docs", "deleted.md"), "DESIGNED_NOT_LIVE\n");
  git(repo, ["add", "docs/deleted.md"]);
  git(repo, ["commit", "-q", "-m", "add candidate doc"]);
  rmSync(join(repo, "docs", "deleted.md"));
  git(repo, ["add", "-u"]);
  git(repo, ["commit", "-q", "-m", "delete candidate doc"]);

  const result = spawnSync(process.execPath, [gatePath], {
    cwd: repo,
    encoding: "utf8",
    env: { ...process.env, BIZRA_REVIEW_BASE: "HEAD~1" },
  });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.deepEqual(report.scanned_files, []);
});
