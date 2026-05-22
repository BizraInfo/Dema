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
  assert.equal(plan.boundary.network_connection_attempted, false);
  assert.equal(plan.boundary.external_posting_performed, false);
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

test("buildDiagnosticsMissionPlan exposes micro harness compliance without authorization", () => {
  const plan = buildDiagnosticsMissionPlan({ now: fixedNow });

  assert.equal(plan.proactive_harness.mode, "DETERMINISTIC_DIAGNOSTICS_POLICY_PREVIEW");
  assert.equal(plan.proactive_harness.recommended_micro_action, "narrow_diagnostics_scope_then_request_exact_consent");
  assert.equal(
    plan.proactive_harness.gates.find((gate) => gate.gate === "all_effecting_checks_require_consent").pass,
    true
  );
  assert.equal(
    plan.proactive_harness.gates.find((gate) => gate.gate === "preview_boundary_closed").pass,
    true
  );
  assert.equal(plan.micro_compliance.preview_only, true);
  assert.equal(plan.micro_compliance.no_runtime, true);
  assert.equal(plan.micro_compliance.no_capability_mint, true);
  assert.equal(plan.micro_compliance.all_effecting_checks_require_consent, true);
  assert.equal(plan.micro_compliance.no_policy_contradiction, true);
  assert.equal(plan.micro_consent.preview_scope, "diagnostics_plan_preview_only");
  assert.equal(plan.micro_consent.status, "draft_only");
  assert.equal(plan.micro_consent.exact_consent_required_for_effecting_checks, true);
  assert.equal(plan.micro_consent.consent_observed_in_preview, false);
  assert.equal(plan.micro_consent.approval_recorded, false);
  assert.equal(plan.micro_consent.broad_consent_allowed, false);
  assert.equal(plan.self_critique.confidence, "bounded_preview");
  assert.equal(plan.self_critique.open_risk_count, plan.self_critique.gaps.length);
});

test("formatDiagnosticsMissionPlan renders phases, critique, proof, and boundary", () => {
  const output = formatDiagnosticsMissionPlan(buildDiagnosticsMissionPlan({ now: fixedNow }));

  assert.match(output, /DEMA Diagnostics Mission Plan/);
  assert.match(output, /UNDERSTAND -> PLAN -> ACT -> VERIFY -> SETTLE/);
  assert.match(output, /npm run check/);
  assert.match(output, /Self-proactive harness/);
  assert.match(output, /Micro-compliance/);
  assert.match(output, /Micro-consent/);
  assert.match(output, /Self-critique/);
  assert.match(output, /Proof-of-Truth Convergence/);
  assert.match(output, /Boundary: preview-only; no execution; no mutation; no receipt minted/);
  assert.match(output, /no network; no external posting/);
});

test("dema diagnostics plan prints a human-readable preview", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "diagnostics", "plan"]);

  assert.match(stdout, /DEMA Diagnostics Mission Plan/);
  assert.match(stdout, /npm test/);
  assert.match(stdout, /node scripts\/node0-self-check\.mjs --verify/);
  assert.match(stdout, /Boundary: preview-only; no execution; no mutation; no receipt minted/);
  assert.match(stdout, /no network; no external posting/);
});

test("dema diagnostics plan --json emits the schema-tagged plan", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "diagnostics", "plan", "--json"]);
  const plan = JSON.parse(stdout);

  assert.equal(plan.schema, "bizra.dema.diagnostics_mission_plan.v0.1");
  assert.equal(plan.mode, "PREVIEW_ONLY");
  assert.equal(plan.boundary.execution_enabled, false);
  assert.ok(plan.checks.some((check) => check.command === "npm run check"));
  assert.equal(plan.micro_compliance.all_effecting_checks_require_consent, true);
  assert.equal(plan.micro_consent.action_authorized_by_preview, false);
});

test("dema diagnostics rejects unknown subcommands", async () => {
  await assert.rejects(
    execFileAsync("node", [cliPath, "diagnostics", "run"]),
    /Unknown diagnostics command/
  );
});
