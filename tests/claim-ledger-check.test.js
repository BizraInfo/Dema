import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  auditMarkdown,
  LABELS,
  RISK_PATTERNS
} from "../scripts/claim-ledger-check.mjs";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../scripts/claim-ledger-check.mjs", import.meta.url));

test("auditMarkdown passes truth-labeled measured and cited claims", () => {
  const report = auditMarkdown({
    file: "paper.md",
    body: [
      "# Paper",
      "[CITED] Prior work reports 99.94% F1 on a hadith-chain dataset.",
      "[MEASURED] Local test command completed in 12 ms on commit abc123.",
      "[PLANNED] Post-quantum receipts are future work."
    ].join("\n")
  });

  assert.equal(report.ok, true);
  assert.deepEqual(report.findings, []);
});

test("auditMarkdown flags risky unlabeled benchmark and first-ever claims", () => {
  const report = auditMarkdown({
    file: "paper.md",
    body: [
      "# Paper",
      "BIZRA Node0 achieves 523,793 requests/second with 0.089 milliseconds latency.",
      "This is the first formally verified Sovereign Digital Organism."
    ].join("\n")
  });

  assert.equal(report.ok, false);
  assert.equal(report.findings.length, 3);
  assert.deepEqual(
    report.findings.map((finding) => finding.kind),
    ["benchmark", "first_or_only", "formal_verification"]
  );
});

test("auditMarkdown flags unlabeled percentage benchmark claims", () => {
  const report = auditMarkdown({
    file: "paper.md",
    body: "The classifier reaches 99.94% F1-score on the benchmark."
  });

  assert.equal(report.ok, false);
  assert.deepEqual(
    report.findings.map((finding) => finding.kind),
    ["benchmark"]
  );
});

test("auditMarkdown allows a label on the previous non-empty line", () => {
  const report = auditMarkdown({
    file: "paper.md",
    body: [
      "[DECLARED]",
      "We define the 7-3-6-9 discipline as a proposed verification framework.",
      "",
      "[PLANNED]",
      "ML-KEM and Dilithium receipts are future implementation work."
    ].join("\n")
  });

  assert.equal(report.ok, true);
});

test("auditMarkdown does not let a labeled claim label the next claim", () => {
  const report = auditMarkdown({
    file: "paper.md",
    body: [
      "[CITED] Prior work reports 99.94% F1.",
      "BIZRA mints IMP rewards from PAT self-certification."
    ].join("\n")
  });

  assert.equal(report.ok, false);
  assert.deepEqual(
    report.findings.map((finding) => finding.kind),
    ["economic"]
  );
});

test("claim-ledger-check CLI emits schema-tagged JSON and exits nonzero on findings", async () => {
  const dir = await mkdtemp(join(tmpdir(), "dema-claims-"));
  const path = join(dir, "paper.md");
  await writeFile(path, "BIZRA achieves 523,793 req/s and mints IMP rewards.\n", "utf8");

  await assert.rejects(
    async () => execFileAsync("node", [cliPath, "--json", path]),
    (error) => {
      const report = JSON.parse(error.stdout);
      assert.equal(report.schema, "bizra.dema.claim_ledger_check.v0.1");
      assert.equal(report.ok, false);
      assert.equal(report.scanned_files.length, 1);
      assert.equal(report.findings.length, 2);
      return true;
    }
  );
});

test("claim-ledger-check CLI exits zero when risky claims are labeled", async () => {
  const dir = await mkdtemp(join(tmpdir(), "dema-claims-"));
  const path = join(dir, "paper.md");
  await writeFile(path, "[DECLARED] IMP authorization is a proposed governance rule.\n", "utf8");

  const { stdout } = await execFileAsync("node", [cliPath, "--json", path]);
  const report = JSON.parse(stdout);

  assert.equal(report.ok, true);
  assert.equal(report.findings.length, 0);
});

test("claim-ledger-check exposes stable labels and risk pattern metadata", () => {
  assert.deepEqual(LABELS, ["MEASURED", "CITED", "DECLARED", "PLANNED", "REMOVE_OR_HARDEN"]);
  assert.ok(RISK_PATTERNS.some((pattern) => pattern.kind === "benchmark"));
  assert.ok(RISK_PATTERNS.some((pattern) => pattern.kind === "economic"));
});
