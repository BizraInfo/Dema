import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  buildReleaseReadinessReport,
  findActionRefs,
  findNodeMatrix,
  formatReleaseReadinessReport,
  isPinnedActionRef
} from "../scripts/release-readiness.mjs";

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const scriptPath = fileURLToPath(new URL("../scripts/release-readiness.mjs", import.meta.url));

test("buildReleaseReadinessReport emits schema-tagged read-only DevOps posture", async () => {
  const report = await buildReleaseReadinessReport({ root: repoRoot, now: "2026-05-14T00:00:00.000Z" });

  assert.equal(report.schema, "bizra.dema.release_readiness.v0.1");
  assert.equal(report.mode, "READ_ONLY_AUDIT");
  assert.equal(report.gate_ok, true);
  assert.equal(report.boundary.read_only, true);
  assert.equal(report.boundary.deployment_performed, false);
  assert.equal(report.boundary.secrets_accessed, false);
});

test("release readiness enforces first-party proof and zero-runtime-dependency invariants", async () => {
  const report = await buildReleaseReadinessReport({ root: repoRoot, now: "2026-05-14T00:00:00.000Z" });

  assert.equal(report.dependency_posture.runtime_dependencies, 0);
  assert.equal(report.dependency_posture.zero_runtime_dependencies, true);
  assert.equal(report.ci_cd.bizra_review_gate, true);
  assert.deepEqual(report.ci_cd.node_matrix, ["20.x", "22.x"]);
  assert.equal(report.quality_assurance.self_check_enforced, true);
  assert.equal(report.risks.some((risk) => risk.severity === "fail"), false);
});

test("release readiness reports advisory CI hardening risks without failing the gate", async () => {
  const report = await buildReleaseReadinessReport({ root: repoRoot, now: "2026-05-14T00:00:00.000Z" });

  assert.ok(report.risks.some((risk) => risk.code === "ci.actions_not_sha_pinned" && risk.severity === "review"));
  assert.ok(report.risks.some((risk) => risk.code === "qa.coverage_threshold_missing" && risk.severity === "improvement"));
  assert.equal(report.gate_ok, true);
});

test("workflow parsers detect action refs and inline or block Node matrices", () => {
  const inline = "uses: actions/checkout@v4\nnode-version: [20.x, 22.x]\n";
  const block = "node-version:\n  - 20.x\n  - 22.x\n";

  assert.deepEqual(findActionRefs(inline), ["actions/checkout@v4"]);
  assert.equal(isPinnedActionRef("actions/checkout@v4"), false);
  assert.equal(isPinnedActionRef("actions/checkout@0123456789abcdef0123456789abcdef01234567"), true);
  assert.deepEqual(findNodeMatrix(inline), ["20.x", "22.x"]);
  assert.deepEqual(findNodeMatrix(block), ["20.x", "22.x"]);
});

test("formatReleaseReadinessReport renders management, CI/CD, QA, and boundary sections", async () => {
  const report = await buildReleaseReadinessReport({ root: repoRoot, now: "2026-05-14T00:00:00.000Z" });
  const text = formatReleaseReadinessReport(report);

  assert.match(text, /Management BoK:/);
  assert.match(text, /CI\/CD:/);
  assert.match(text, /Quality assurance:/);
  assert.match(text, /Boundary: read-only audit/);
});

test("release-readiness script supports --json", async () => {
  const { stdout } = await execFileAsync("node", [scriptPath, "--json"], { cwd: repoRoot });
  const report = JSON.parse(stdout);

  assert.equal(report.schema, "bizra.dema.release_readiness.v0.1");
  assert.equal(report.gate_ok, true);
});
