import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  buildConsentPlanPreview,
  formatConsentPlanPreview
} from "../packages/consent/src/consent-planner.js";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));

test("buildConsentPlanPreview maps a code-change intent to least-privilege permissions", () => {
  const intent = "Fix the bug in auth.py and run pytest";
  const first = buildConsentPlanPreview({ intent });
  const second = buildConsentPlanPreview({ intent });

  assert.equal(first.schema, "bizra.dema.consent_plan_preview.v0.1");
  assert.equal(first.mode, "PREVIEW_ONLY");
  assert.equal(first.boundary.inference_invoked, false);
  assert.equal(first.boundary.capability_minted, false);
  assert.equal(first.boundary.execution_enabled, false);
  assert.deepEqual(
    first.permissions.map((p) => `${p.resource_id}:${p.action}`),
    ["file:auth.py:read", "file:auth.py:write", "command:pytest:execute"]
  );
  assert.equal(first.permissions[2].requires_human_consent, true);
  assert.equal(first.commitment_hash, second.commitment_hash);
});

test("buildConsentPlanPreview flags audit intents that request external delivery", () => {
  const plan = buildConsentPlanPreview({
    intent: "Audit Downloads and send the report to Slack"
  });

  assert.ok(plan.permissions.some((p) => p.resource_id === "path:Downloads" && p.action === "read"));
  assert.ok(plan.permissions.some((p) => p.resource_id === "service:slack" && p.action === "call"));
  assert.ok(plan.analogical_notes.some((note) => note.code === "audit_with_external_call"));
  assert.equal(plan.proof_of_truth.economic.status, "closed_until_verified_impact");
});

test("formatConsentPlanPreview renders permissions, warnings, and boundary", () => {
  const output = formatConsentPlanPreview(buildConsentPlanPreview({
    intent: "Fix auth.py and run pytest"
  }));

  assert.match(output, /DEMA Consent Plan Preview/);
  assert.match(output, /file:auth\.py\s+read/);
  assert.match(output, /command:pytest\s+execute/);
  assert.match(output, /commitment_hash:/);
  assert.match(output, /Boundary: preview-only; no approval; no capability minted; no execution/);
});

test("dema consent plan prints a preview without execution", async () => {
  const { stdout } = await execFileAsync("node", [
    cliPath,
    "consent",
    "plan",
    "Fix auth.py and run pytest"
  ]);

  assert.match(stdout, /DEMA Consent Plan Preview/);
  assert.match(stdout, /file:auth\.py/);
  assert.match(stdout, /command:pytest/);
  assert.match(stdout, /Boundary: preview-only; no approval; no capability minted; no execution/);
});

test("dema consent plan --json emits schema-tagged preview", async () => {
  const { stdout } = await execFileAsync("node", [
    cliPath,
    "consent",
    "plan",
    "--json",
    "Audit Downloads and send to Slack"
  ]);
  const plan = JSON.parse(stdout);

  assert.equal(plan.schema, "bizra.dema.consent_plan_preview.v0.1");
  assert.equal(plan.mode, "PREVIEW_ONLY");
  assert.equal(plan.boundary.execution_enabled, false);
  assert.ok(plan.permissions.some((p) => p.resource_id === "service:slack"));
});
