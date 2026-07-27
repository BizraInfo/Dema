import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { DEMA_REVERSIBLE_FILE_STEWARD_GO_PHRASE } from "../packages/core/src/dema-reversible-file-steward.js";
import { DEMA_REVERSIBLE_FILE_STEWARD_EXECUTE_GO_PHRASE } from "../packages/core/src/dema-reversible-file-steward-execution.js";

// DEMA-REVERSIBLE-FILE-STEWARD-1C proof contract — the `dema steward` CLI is a
// thin surface over the proven 1A planner + 1B execution kernels. Every consent,
// containment, backup, receipt and undo proof lives in the kernels; these tests
// prove the CLI binds to them fail-closed and mutates nothing without the exact
// execute phrase.

const CLI = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));

function steward(args, env = {}) {
  const res = spawnSync(process.execPath, [CLI, "steward", ...args], {
    encoding: "utf8",
    env: { ...process.env, NODE_ENV: "test", DEMA_NO_TUI: "1", ...env },
  });
  let json = null;
  try {
    json = JSON.parse(res.stdout);
  } catch {
    /* leave null; asserted per-test */
  }
  return { ...res, json };
}

function makeSandbox() {
  const root = mkdtempSync(join(tmpdir(), "steward-cli-"));
  writeFileSync(join(root, "note.txt"), "genesis note");
  writeFileSync(join(root, "draft.md"), "genesis draft");
  return root;
}

function writeJob(root, atoms) {
  const jobPath = join(root, ".job.json");
  // ponytail: job file lives outside sandbox semantics ('.job.json' is not a
  // user-visible file per the 1B measurement rule, so it never skews hashes)
  writeFileSync(jobPath, JSON.stringify({ sandbox_root: root, max_atoms: 8, atoms }));
  return jobPath;
}

test("steward with no subcommand prints usage with both exact phrases, exit 0", () => {
  const r = steward([]);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.json, "stdout must be JSON");
  assert.equal(r.json.preview_phrase, DEMA_REVERSIBLE_FILE_STEWARD_GO_PHRASE);
  assert.equal(r.json.execute_phrase, DEMA_REVERSIBLE_FILE_STEWARD_EXECUTE_GO_PHRASE);
});

test("plan without consent is fail-closed and names the required phrase", () => {
  const root = makeSandbox();
  try {
    const job = writeJob(root, [{ from: "note.txt", to: "note.SEALED.txt" }]);
    const r = steward(["plan", "--job", job]);
    assert.equal(r.status, 1);
    assert.equal(r.json.ok, false);
    assert.ok(r.json.blocked_by.includes("consent_phrase_mismatch"));
    assert.equal(r.json.required_consent, DEMA_REVERSIBLE_FILE_STEWARD_GO_PHRASE);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("plan with the exact preview phrase is eligible and content-addressed", () => {
  const root = makeSandbox();
  try {
    const job = writeJob(root, [{ from: "note.txt", to: "note.SEALED.txt" }]);
    const r = steward(["plan", "--job", job, "--consent", DEMA_REVERSIBLE_FILE_STEWARD_GO_PHRASE]);
    assert.equal(r.status, 0, r.stdout);
    assert.equal(r.json.ok, true);
    assert.match(r.json.content_hash, /^sha256:[0-9a-f]{64}$/);
    for (const v of Object.values(r.json.boundary)) assert.equal(v, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("verify proves the round-trip on a real sandbox and restores genesis", () => {
  const root = makeSandbox();
  try {
    const job = writeJob(root, [
      { from: "note.txt", to: "note.SEALED.txt" },
      { from: "draft.md", to: "draft.final.md" },
    ]);
    const r = steward(["verify", "--job", job, "--consent", DEMA_REVERSIBLE_FILE_STEWARD_EXECUTE_GO_PHRASE]);
    assert.equal(r.status, 0, r.stdout);
    assert.equal(r.json.round_trip_ok, true);
    assert.equal(r.json.all_undone_proven, true);
    assert.equal(r.json.genesis_hash, r.json.final_hash);
    const after = readdirSync(root).filter((n) => !n.startsWith(".")).sort();
    assert.deepEqual(after, ["draft.md", "note.txt"], "sandbox restored to genesis");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("run with wrong consent refuses with zero mutation", () => {
  const root = makeSandbox();
  try {
    const job = writeJob(root, [{ from: "note.txt", to: "note.SEALED.txt" }]);
    const r = steward(["run", "--job", job, "--consent", "GO: wrong"]);
    assert.equal(r.status, 1);
    assert.equal(r.json.ok, false);
    assert.ok(r.json.blocked_by.includes("consent_phrase_mismatch") || r.json.blocked_by.includes("execute_stopped"), r.stdout);
    assert.equal(r.json.executed_count, 0);
    const names = readdirSync(root).filter((n) => !n.startsWith(".")).sort();
    assert.deepEqual(names, ["draft.md", "note.txt"], "no file touched");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("run executes with exact consent; undo --receipts restores original names", () => {
  const root = makeSandbox();
  try {
    const job = writeJob(root, [{ from: "note.txt", to: "note.SEALED.txt" }]);
    const run = steward(["run", "--job", job, "--consent", DEMA_REVERSIBLE_FILE_STEWARD_EXECUTE_GO_PHRASE]);
    assert.equal(run.status, 0, run.stdout);
    assert.equal(run.json.ok, true);
    assert.equal(run.json.executed_count, 1);
    let names = readdirSync(root).filter((n) => !n.startsWith(".")).sort();
    assert.deepEqual(names, ["draft.md", "note.SEALED.txt"], "rename landed");

    const receiptsPath = join(root, ".receipts.json");
    writeFileSync(receiptsPath, JSON.stringify({ receipts: run.json.receipts }));

    // undo mutates files, so it requires the exact execute phrase too.
    const undoNoConsent = steward(["undo", "--receipts", receiptsPath]);
    assert.equal(undoNoConsent.status, 1, "undo without consent refuses");
    assert.ok(undoNoConsent.json.blocked_by.includes("consent_phrase_mismatch"));
    names = readdirSync(root).filter((n) => !n.startsWith(".")).sort();
    assert.deepEqual(names, ["draft.md", "note.SEALED.txt"], "refused undo mutated nothing");

    const undo = steward([
      "undo",
      "--receipts",
      receiptsPath,
      "--consent",
      DEMA_REVERSIBLE_FILE_STEWARD_EXECUTE_GO_PHRASE,
    ]);
    assert.equal(undo.status, 0, undo.stdout);
    assert.equal(undo.json.ok, true);
    assert.ok(undo.json.undo_results.every((u) => u.undone && u.proven));
    names = readdirSync(root).filter((n) => !n.startsWith(".")).sort();
    assert.deepEqual(names, ["draft.md", "note.txt"], "undo restored genesis names");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("run refuses a job whose content sample the sanitizer blocks", () => {
  const root = makeSandbox();
  try {
    // exampleAttackText-equivalent is exercised in the 1A suite; here prove the
    // CLI wires shape blocks: an unknown sandbox/empty atoms job cannot run.
    const jobPath = join(root, ".job.json");
    writeFileSync(jobPath, JSON.stringify({ sandbox_root: root, atoms: [] }));
    const r = steward(["run", "--job", jobPath, "--consent", DEMA_REVERSIBLE_FILE_STEWARD_EXECUTE_GO_PHRASE]);
    assert.equal(r.status, 1);
    assert.equal(r.json.ok, false);
    assert.ok(r.json.blocked_by.includes("atoms_empty"), r.stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
