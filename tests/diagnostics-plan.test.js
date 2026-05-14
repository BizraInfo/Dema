import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  buildDiagnosticsMissionPlan,
  formatDiagnosticsMissionPlan
} from "../packages/mission/src/diagnostics-plan.js";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));
const fixedNow = new Date("2026-05-14T06:40:00.000Z");

test("buildDiagnosticsMissionPlan emits a schema-tagged self-harness without effects", () => {
  const plan = buildDiagnosticsMissionPlan({ now: fixedNow });

  assert.equal(plan.schema, "bizra.dema.diagnostics_mission_plan.v0.1");
  assert.equal(plan.generated_at, fixedNow.toISOString());
  assert.equal(plan.mode, "PREVIEW_ONLY");
  assert.equal(plan.mission.category, "self_diagnostics");
  assert.equal(plan.mission.current_phase, "DRAFT_INTENT");
  assert.equal(plan.phase_gate.next_phase, "CONSENT_NEGOTIATION");
  assert.equal(plan.boundary.execution_enabled, false);
  assert.equal(plan.boundary.mutation_performed, false);
  assert.equal(plan.boundary.receipt_minted, false);
});

test("buildDiagnosticsMissionPlan names the proactive checks and consent requirements", () => {
  const plan = buildDiagnosticsMissionPlan({ now: fixedNow });

  assert.ok(plan.checks.some((check) => check.command === "npm test"));
  assert.ok(plan.checks.some((check) => check.command === "npm run check"));
  assert.ok(plan.checks.some((check) => check.command === "node scripts/node0-self-check.mjs --verify"));
  assert.ok(plan.consent_scope_preview.permissions.some((permission) => (
    permission.resource_id === "command:npm-run-check" &&
    permission.action === "execute" &&
    permission.requires_human_consent === true
  )));
  assert.equal(plan.consent_scope_preview.approval_recorded, false);
  assert.deepEqual(Object.keys(plan.proof_of_truth_convergence), [
    "formal",
    "cryptographic",
    "empirical",
    "economic"
  ]);
});

test("formatDiagnosticsMissionPlan renders phases, critique, proof, and boundary", () => {
  const output = formatDiagnosticsMissionPlan(buildDiagnosticsMissionPlan({ now: fixedNow }));

  assert.match(output, /DEMA Diagnostics Mission Plan/);
  assert.match(output, /UNDERSTAND -> PLAN -> ACT -> VERIFY -> SETTLE/);
  assert.match(output, /npm run check/);
  assert.match(output, /Self-critique/);
  assert.match(output, /Proof-of-Truth Convergence/);
  assert.match(output, /Boundary: preview-only; no execution; no mutation; no receipt minted/);
});

test("dema diagnostics plan prints a human-readable preview", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "diagnostics", "plan"]);

  assert.match(stdout, /DEMA Diagnostics Mission Plan/);
  assert.match(stdout, /npm test/);
  assert.match(stdout, /node scripts\/node0-self-check\.mjs --verify/);
  assert.match(stdout, /Boundary: preview-only; no execution; no mutation; no receipt minted/);
});

test("dema diagnostics plan --json emits the schema-tagged plan", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "diagnostics", "plan", "--json"]);
  const plan = JSON.parse(stdout);

  assert.equal(plan.schema, "bizra.dema.diagnostics_mission_plan.v0.1");
  assert.equal(plan.mode, "PREVIEW_ONLY");
  assert.equal(plan.boundary.execution_enabled, false);
  assert.ok(plan.checks.some((check) => check.command === "npm run check"));
});
