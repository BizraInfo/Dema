import test from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import {
  APPROVAL_SCHEMA,
  highestLevel,
  levelLabel,
  requestApproval
} from "../packages/core/src/approval-gate.js";

const execFileAsync = promisify(execFile);
const cliPath = new URL("../apps/cli/src/index.js", import.meta.url).pathname;

function inputFrom(text) {
  // Simulate operator typing `text\n`. Empty string = immediate EOF.
  const stream = Readable.from(text === "" ? [] : [`${text}\n`]);
  return stream;
}

function captureOutput() {
  const chunks = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(chunk.toString());
      cb();
    }
  });
  return {
    stream,
    get text() {
      return chunks.join("");
    }
  };
}

// ─── highestLevel / levelLabel ─────────────────────────────────────────

test("highestLevel parses single and slash-joined level strings", () => {
  assert.equal(highestLevel("L0"), 0);
  assert.equal(highestLevel("L1"), 1);
  assert.equal(highestLevel("L0/L1"), 1);
  assert.equal(highestLevel("L2"), 2);
  assert.equal(highestLevel("L3"), 3);
  assert.equal(highestLevel("L0/L3"), 3);
  assert.equal(highestLevel("L5"), 5);
  assert.equal(highestLevel(""), 0);
  assert.equal(highestLevel(undefined), 0);
});

test("levelLabel formats numeric levels", () => {
  assert.equal(levelLabel(0), "L0");
  assert.equal(levelLabel(3), "L3");
});

// ─── L0/L1/L2 — auto-approve, no prompt ────────────────────────────────

test("L0 auto-approves without reading input or writing prompt", async () => {
  const out = captureOutput();
  const result = await requestApproval({
    autonomyLevel: "L0",
    action: "status",
    output: out.stream
  });
  assert.equal(result.schema, APPROVAL_SCHEMA);
  assert.equal(result.approved, true);
  assert.equal(result.mode, "auto");
  assert.equal(out.text, "", "L0 must not write any prompt");
});

test("L1 and L2 also auto-approve without prompting", async () => {
  for (const lvl of ["L1", "L2"]) {
    const out = captureOutput();
    const result = await requestApproval({ autonomyLevel: lvl, action: "x", output: out.stream });
    assert.equal(result.approved, true);
    assert.equal(out.text, "", `${lvl} must not prompt`);
  }
});

// ─── L3 — interactive y/N ──────────────────────────────────────────────

test("L3 approves on y / yes / proceed (case-insensitive)", async () => {
  for (const answer of ["y", "Y", "yes", "YES", "Yes", "proceed", "PROCEED"]) {
    const out = captureOutput();
    const result = await requestApproval({
      autonomyLevel: "L3",
      action: "test",
      input: inputFrom(answer),
      output: out.stream
    });
    assert.equal(result.approved, true, `expected approve on '${answer}'`);
    assert.equal(result.mode, "interactive");
    assert.match(out.text, /Approve test/);
  }
});

test("L3 default-denies on silence/EOF", async () => {
  const out = captureOutput();
  const result = await requestApproval({
    autonomyLevel: "L3",
    action: "test",
    input: inputFrom(""), // immediate EOF
    output: out.stream
  });
  assert.equal(result.approved, false);
  assert.equal(result.mode, "interactive");
  assert.match(result.refused_reason, /no affirmative response/);
});

test("L3 default-denies on n / no / blank / arbitrary text", async () => {
  for (const answer of ["n", "no", "N", "NO", "", " ", "maybe", "absolutely"]) {
    const out = captureOutput();
    const result = await requestApproval({
      autonomyLevel: "L3",
      action: "test",
      input: inputFrom(answer),
      output: out.stream
    });
    assert.equal(result.approved, false, `expected deny on '${answer}'`);
  }
});

test("L3 prompt includes scope when provided", async () => {
  const out = captureOutput();
  await requestApproval({
    autonomyLevel: "L3",
    action: "task X",
    scope: "reversible-local",
    input: inputFrom("y"),
    output: out.stream
  });
  assert.match(out.text, /scope: reversible-local/);
});

// ─── L4 — exact-phrase via FATE ────────────────────────────────────────

test("L4 approves only on exact phrase match (FATE)", async () => {
  const phrase = "GO: Node0 bounded diagnostic activation only";
  const out = captureOutput();
  const result = await requestApproval({
    autonomyLevel: "L4",
    action: "ARTIFACT-011 issuance",
    requireExactPhrase: phrase,
    input: inputFrom(phrase),
    output: out.stream
  });
  assert.equal(result.approved, true);
  assert.equal(result.mode, "exact_phrase");
});

test("L4 denies on near-match (trailing space, missing colon, etc.)", async () => {
  const phrase = "GO: Node0 bounded diagnostic activation only";
  for (const wrong of [
    `${phrase} `, // trailing space
    "go: Node0 bounded diagnostic activation only", // case
    "GO Node0 bounded diagnostic activation only", // missing colon
    "y", // typical L3 affirmative
    "" // EOF
  ]) {
    const out = captureOutput();
    const result = await requestApproval({
      autonomyLevel: "L4",
      action: "x",
      requireExactPhrase: phrase,
      input: inputFrom(wrong),
      output: out.stream
    });
    assert.equal(result.approved, false, `expected deny on '${wrong}'`);
  }
});

test("L4 refuses honestly when requireExactPhrase is missing", async () => {
  const result = await requestApproval({
    autonomyLevel: "L4",
    action: "x",
    output: captureOutput().stream
  });
  assert.equal(result.approved, false);
  assert.match(result.refused_reason, /requireExactPhrase/);
});

// ─── L5 — unconditional refusal ────────────────────────────────────────

test("L5 always refuses from the shell, regardless of input", async () => {
  for (const text of ["yes", "GO", "anything", ""]) {
    const result = await requestApproval({
      autonomyLevel: "L5",
      action: "git push --force",
      input: inputFrom(text),
      output: captureOutput().stream
    });
    assert.equal(result.approved, false);
    assert.equal(result.mode, "refused");
    assert.match(result.refused_reason, /L5 acts cannot be approved from the interactive shell/);
  }
});

// ─── unknown level / bad inputs ────────────────────────────────────────

test("unknown autonomy level throws", async () => {
  await assert.rejects(
    () => requestApproval({ autonomyLevel: "L99", action: "x" }),
    /unknown autonomyLevel/
  );
});

test("missing action throws", async () => {
  await assert.rejects(
    () => requestApproval({ autonomyLevel: "L0" }),
    /action.*required/
  );
});

// ─── CLI integration: L0/L1 task still runs without gate ──────────────

test("CLI: dema task downloads.audit.preview (L0/L1) runs without firing gate", async () => {
  const downloadsRoot = await mkdtemp(join(tmpdir(), "dema-gate-fixture-"));
  const demaRoot = await mkdtemp(join(tmpdir(), "dema-gate-home-"));
  await writeFile(join(downloadsRoot, "alpha.txt"), "hello\n");

  const { stdout } = await execFileAsync("node", [cliPath, "task", "downloads.audit.preview"], {
    env: { ...process.env, DEMA_DOWNLOADS_ROOT: downloadsRoot, DEMA_HOME: demaRoot }
  });
  // No "Refused:" or "Approve task" line — gate did not fire.
  assert.doesNotMatch(stdout, /Approve task/);
  assert.doesNotMatch(stdout, /^Refused:/m);
  assert.match(stdout, /Task:\s+downloads\.audit\.preview/);
});

// ─── envelope schema integrity ────────────────────────────────────────

test("approval envelope is schema-tagged with decided_at timestamp", async () => {
  const result = await requestApproval({
    autonomyLevel: "L0",
    action: "x"
  });
  assert.equal(result.schema, "bizra.dema.approval_verdict.v0.1");
  assert.match(result.decided_at, /^\d{4}-\d{2}-\d{2}T/);
});
