import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile, cp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { buildCanonCheckReport } from "../scripts/review/canon-check.mjs";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(new URL("../scripts/review/canon-check.mjs", import.meta.url));

test("canon check passes on current docs", () => {
  const report = buildCanonCheckReport();

  assert.equal(report.schema, "bizra.dema.review.canon_check.v0.1");
  assert.equal(report.ok, true);
  assert.equal(report.canonical_sentence_present, true);
  assert.ok(report.scanned_files_count > 0);
  assert.ok(report.source_scan_roots.includes("packages"));
  assert.deepEqual(report.missing_files, []);
  assert.deepEqual(report.forbidden_topology_findings, []);
  assert.deepEqual(report.forbidden_authorization_findings, []);
  assert.equal(report.boundary.runtime_execution, false);
});

test("canon check rejects forbidden authorization phrase drift in source files", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-canon-auth-check-"));
  await mkdir(join(root, "docs", "canon"), { recursive: true });
  await mkdir(join(root, "docs", "02-architecture"), { recursive: true });
  await mkdir(join(root, "packages", "core", "src"), { recursive: true });
  await cp("docs/canon/canon_registry.json", join(root, "docs", "canon", "canon_registry.json"));
  await writeFile(
    join(root, "docs", "canon", "BIZRA_TOPOLOGY_CANON.md"),
    "Each human node mints PAT-7 locally on their device and SAT-5 into one shared Universal Resource Pool. PAT serves the human. SAT serves the system. The membrane sits between them.\n"
  );
  await writeFile(join(root, "docs", "02-architecture", "node0-urp-ecosystem-transition.md"), "# Transition\n");
  await writeFile(join(root, "docs", "02-architecture", "pat-builder-sat-validator.md"), "# PAT/SAT\n");
  await writeFile(join(root, "packages", "core", "src", "bad.js"), "export const leaked = 'I authorize';\n");

  const report = buildCanonCheckReport({ root });
  assert.equal(report.ok, false);
  assert.deepEqual(report.forbidden_authorization_findings, [
    { file: "packages/core/src/bad.js", line: 1, phrase: "I authorize" }
  ]);
});

test("canon check CLI emits schema-tagged read-only report", async () => {
  const { stdout } = await execFileAsync("node", [scriptPath]);
  const report = JSON.parse(stdout);

  assert.equal(report.ok, true);
  assert.equal(report.boundary.read_only_audit, true);
  assert.equal(report.boundary.receipt_minted, false);
});

test("canon check rejects forbidden topology drift", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-canon-check-"));
  await mkdir(join(root, "docs", "canon"), { recursive: true });
  await mkdir(join(root, "docs", "02-architecture"), { recursive: true });
  await cp("docs/canon/canon_registry.json", join(root, "docs", "canon", "canon_registry.json"));
  await writeFile(
    join(root, "docs", "canon", "BIZRA_TOPOLOGY_CANON.md"),
    "Each human node mints PAT-7 locally on their device and SAT-5 into one shared Universal Resource Pool. PAT serves the human. SAT serves the system. The membrane sits between them.\n"
  );
  await writeFile(join(root, "docs", "02-architecture", "node0-urp-ecosystem-transition.md"), "# Transition\n");
  await writeFile(join(root, "docs", "02-architecture", "pat-builder-sat-validator.md"), "# PAT/SAT\n");
  await writeFile(join(root, "docs", "bad.md"), "Each user has their own URP.\n");

  const report = buildCanonCheckReport({ root });
  assert.equal(report.ok, false);
  assert.deepEqual(report.forbidden_topology_findings, [
    { file: "docs/bad.md", line: 1, phrase: "Each user has their own URP" }
  ]);
});

test("canon check rejects forbidden topology drift in source files", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-canon-source-check-"));
  await mkdir(join(root, "docs", "canon"), { recursive: true });
  await mkdir(join(root, "docs", "02-architecture"), { recursive: true });
  await mkdir(join(root, "packages", "core", "src"), { recursive: true });
  await cp("docs/canon/canon_registry.json", join(root, "docs", "canon", "canon_registry.json"));
  await writeFile(
    join(root, "docs", "canon", "BIZRA_TOPOLOGY_CANON.md"),
    "Each human node mints PAT-7 locally on their device and SAT-5 into one shared Universal Resource Pool. PAT serves the human. SAT serves the system. The membrane sits between them.\n"
  );
  await writeFile(join(root, "docs", "02-architecture", "node0-urp-ecosystem-transition.md"), "# Transition\n");
  await writeFile(join(root, "docs", "02-architecture", "pat-builder-sat-validator.md"), "# PAT/SAT\n");
  await writeFile(join(root, "packages", "core", "src", "bad.js"), "export const drift = 'peer_alpha';\n");

  const report = buildCanonCheckReport({ root });
  assert.equal(report.ok, false);
  assert.deepEqual(report.forbidden_topology_findings, [
    { file: "packages/core/src/bad.js", line: 1, phrase: "peer_alpha" }
  ]);
});
