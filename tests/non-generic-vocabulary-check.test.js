import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  buildNonGenericVocabularyCheckReport,
  findGenericVocabularyViolations,
} from "../scripts/review/non-generic-vocabulary-check.mjs";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(
  new URL(
    "../scripts/review/non-generic-vocabulary-check.mjs",
    import.meta.url,
  ),
);

test("non-generic-vocabulary check passes on current user-facing surface", () => {
  const report = buildNonGenericVocabularyCheckReport();
  assert.equal(
    report.schema,
    "bizra.dema.review.non_generic_vocabulary_check.v0.1",
  );
  assert.equal(report.mode, "READ_ONLY_AUDIT");
  assert.equal(report.ok, true);
  assert.ok(
    report.files_scanned > 0,
    "must discover at least one file to scan",
  );
  assert.equal(report.files_violated, 0);
  assert.deepEqual(report.violations, []);
});

test("report is a read-only audit with all authority flags false", () => {
  const report = buildNonGenericVocabularyCheckReport();
  assert.equal(report.boundary.read_only_audit, true);
  assert.equal(report.boundary.runtime_execution, false);
  assert.equal(report.boundary.mutation_performed, false);
  assert.equal(report.boundary.receipt_minted, false);
  assert.equal(report.boundary.filesystem_write_performed, false);
  assert.equal(report.boundary.ci_modified, false);
});

test("CLI emits a schema-tagged JSON report", async () => {
  const { stdout } = await execFileAsync("node", [scriptPath]);
  const report = JSON.parse(stdout);
  assert.equal(
    report.schema,
    "bizra.dema.review.non_generic_vocabulary_check.v0.1",
  );
  assert.equal(report.ok, true);
  assert.equal(report.boundary.read_only_audit, true);
});

test("forbidden_phrases matches the UX Proof Harness criterion L verbatim", () => {
  const report = buildNonGenericVocabularyCheckReport();
  const expected = [
    "agent swarm",
    "AI employee",
    "autonomous magic",
    "growth dashboard",
    "prompt runner",
  ];
  assert.deepEqual(
    [...report.forbidden_phrases].sort(),
    expected.slice().sort(),
  );
});

test("findGenericVocabularyViolations flags an exact match", () => {
  const sample = "The growth dashboard reports daily metrics.";
  const violations = findGenericVocabularyViolations(sample, "(memory)");
  assert.equal(violations.length, 1);
  assert.equal(violations[0].phrase, "growth dashboard");
  assert.equal(violations[0].line, 1);
});

test("findGenericVocabularyViolations is case-insensitive", () => {
  const sample = "An AGENT SWARM cannot do what BIZRA does.";
  const violations = findGenericVocabularyViolations(sample, "(memory)");
  assert.equal(violations.length, 1);
  assert.equal(violations[0].phrase, "agent swarm");
});

test("findGenericVocabularyViolations finds multiple distinct phrases", () => {
  const sample = `
This is not an AI employee.
There is no autonomous magic.
The system has a prompt runner.
`.trim();
  const violations = findGenericVocabularyViolations(sample, "(memory)");
  assert.equal(violations.length, 3);
  const phrases = violations.map((v) => v.phrase).sort();
  assert.deepEqual(phrases, [
    "AI employee",
    "autonomous magic",
    "prompt runner",
  ]);
});

test("findGenericVocabularyViolations returns line numbers", () => {
  const sample = "line 1\nline 2 mentions agent swarm here\nline 3";
  const violations = findGenericVocabularyViolations(sample, "(memory)");
  assert.equal(violations.length, 1);
  assert.equal(violations[0].line, 2);
});

test("findGenericVocabularyViolations finds multiple occurrences of the same phrase", () => {
  const sample = "agent swarm appears here. agent swarm appears again.";
  const violations = findGenericVocabularyViolations(sample, "(memory)");
  assert.equal(violations.length, 2);
  assert.ok(violations.every((v) => v.phrase === "agent swarm"));
});

test("findGenericVocabularyViolations clean source produces zero violations", () => {
  const sample = `
Dema is the cockpit, not the engine.
PAT proposes; SAT validates.
Receipts prove every action.
No hidden daemon.
`.trim();
  const violations = findGenericVocabularyViolations(sample, "(memory)");
  assert.equal(violations.length, 0);
});

test("scan_paths cover the major user-facing surfaces", () => {
  const report = buildNonGenericVocabularyCheckReport();
  const expected = [
    "apps/cli/src",
    "README.md",
    "docs/USER_LIFECYCLE.md",
    "docs/FIRST_RUN_WIZARD.md",
  ];
  for (const path of expected) {
    assert.ok(
      report.scan_paths.includes(path),
      `scan_paths must include ${path}`,
    );
  }
});

test("module body imports only Node built-ins (no http/net/spawn beyond audit primitives)", async () => {
  const { readFile } = await import("node:fs/promises");
  const body = await readFile(scriptPath, "utf8");
  assert.ok(!/from ['"]node:http/.test(body), "must not import node:http");
  assert.ok(!/from ['"]node:net/.test(body), "must not import node:net");
  assert.ok(
    !/from ['"]node:child_process/.test(body),
    "must not import node:child_process",
  );
  assert.ok(!/spawn\(|execSync\(|execFile\(|spawnSync\(/.test(body));
});
