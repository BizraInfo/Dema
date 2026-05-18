import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  buildAnalogicalNotes,
  extractIntentShape
} from "../packages/consent/src/consent-extract.js";
import {
  buildConsentPlanPreview,
  formatConsentPlanPreview
} from "../packages/consent/src/consent-planner.js";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));

function decisionCodes(plan) {
  return plan.policy_preview.decisions.map((decision) => decision.code);
}

function assertNoFalseNoEffectDecision(plan) {
  if (plan.actuator_classes.length > 0) {
    assert.ok(
      !decisionCodes(plan).includes("no_effecting_actuator_detected"),
      `${plan.actuator_classes.join(",")} must not report no effecting actuator`
    );
  }
}

test("intent extraction excludes unsafe home-relative file references from permissions", () => {
  const shape = extractIntentShape(
    "Fix ../secrets/auth.py and /tmp/root.js and ~/private/key.py then run pytest"
  );

  assert.deepEqual(shape.unsafe_file_references, [
    "../secrets/auth.py",
    "/tmp/root.js",
    "~/private/key.py"
  ]);

  assert.ok(shape.permissions.every((permission) => (
    permission.resource_id !== "file:../secrets/auth.py" &&
    permission.resource_id !== "file:/tmp/root.js" &&
    permission.resource_id !== "file:~/private/key.py"
  )));

  assert.ok(shape.permissions.some((p) => p.resource_id === "command:pytest"));
  assert.equal(shape.risk_level, "high");
});

test("unsafe file references produce a high-severity consent note", () => {
  const shape = extractIntentShape("Review ~/private/key.py");
  const notes = buildAnalogicalNotes(
    "Review ~/private/key.py",
    shape.permissions,
    shape.unsafe_file_references
  );

  assert.ok(notes.some((note) => (
    note.code === "unsafe_file_reference" &&
    note.severity === "high"
  )));
});

test("buildConsentPlanPreview maps intent to a deterministic preview boundary", () => {
  const now = new Date("2026-05-15T00:00:00.000Z");
  const first = buildConsentPlanPreview({ intent: "Fix auth.py and run pytest", now });
  const second = buildConsentPlanPreview({ intent: "Fix auth.py and run pytest", now });

  assert.equal(first.schema, "bizra.dema.consent_plan_preview.v0.1");
  assert.equal(first.mode, "PREVIEW_ONLY");
  assert.equal(first.boundary.execution_enabled, false);
  assert.equal(first.boundary.capability_minted, false);
  assert.equal(first.micro_consent.status, "draft_only");
  assert.equal(first.commitment_hash, second.commitment_hash);
  assert.deepEqual(
    first.permissions.map((p) => `${p.resource_id}:${p.action}`),
    ["file:auth.py:read", "file:auth.py:write", "command:pytest:execute"]
  );
});

test("buildConsentPlanPreview exposes actuator classes and policy decisions", () => {
  const plan = buildConsentPlanPreview({
    intent: "Fix auth.py, run npm test, then audit Downloads and send to Slack",
    now: new Date("2026-05-15T00:00:00.000Z")
  });

  assert.deepEqual(plan.actuator_classes, [
    "bash",
    "filesystem_mutation",
    "external_call"
  ]);
  assert.deepEqual(
    plan.policy_preview.decisions.map((decision) => `${decision.verdict}:${decision.code}`),
    [
      "requires_governed_runtime_handoff:bash_like_actuator",
      "requires_exact_consent:filesystem_mutation_requires_exact_consent",
      "requires_human_review:audit_external_delivery"
    ]
  );
  assert.equal(plan.effect_capability.minted, false);
  assert.match(plan.effect_capability.reason, /governed runtime/);
});

test("policy preview covers every detected actuator class without false no-effect decisions", () => {
  const cases = [
    {
      intent: "Fix auth.py",
      actuator: "filesystem_mutation",
      code: "filesystem_mutation_requires_exact_consent",
      verdict: "requires_exact_consent"
    },
    {
      intent: "Send a summary to Slack",
      actuator: "external_call",
      code: "external_call_requires_review",
      verdict: "requires_human_review"
    },
    {
      intent: "Use the desktop GUI to click the approve button",
      actuator: "gui",
      code: "gui_actuator_requires_runtime_handoff",
      verdict: "requires_governed_runtime_handoff"
    },
    {
      intent: "Move a mobile agent across hosts",
      actuator: "mobile_agent",
      code: "mobile_agent_blocked_until_node_handoff_gates",
      verdict: "deny"
    }
  ];

  for (const item of cases) {
    const plan = buildConsentPlanPreview({
      intent: item.intent,
      now: new Date("2026-05-15T00:00:00.000Z")
    });
    const decision = plan.policy_preview.decisions.find((candidate) => candidate.code === item.code);

    assert.ok(plan.actuator_classes.includes(item.actuator));
    assert.equal(decision?.verdict, item.verdict);
    assertNoFalseNoEffectDecision(plan);
    assert.equal(plan.micro_compliance.policy_covers_detected_actuators, true);
  }
});

test("actuator classification covers unsafe paths, spend, GUI, and mobile-agent hints", () => {
  const plan = buildConsentPlanPreview({
    intent: "Use the desktop GUI to move a mobile agent across hosts, spend 5 credits, and edit ~/private/key.py",
    now: new Date("2026-05-15T00:00:00.000Z")
  });

  assert.deepEqual(plan.actuator_classes, [
    "gui",
    "mobile_agent",
    "spend"
  ]);
  assert.equal(plan.mission_draft.risk_level, "high");
  assert.ok(plan.unsafe_file_references.includes("~/private/key.py"));
  assert.ok(plan.policy_preview.decisions.some((decision) => (
    decision.verdict === "deny" &&
    decision.code === "unsafe_file_reference"
  )));
  assert.ok(plan.policy_preview.decisions.some((decision) => (
    decision.verdict === "deny" &&
    decision.code === "economic_channel_closed"
  )));
  assertNoFalseNoEffectDecision(plan);
});

test("consent plan exposes self-proactive, critique, micro-compliance, micro-consent, and analogical harnesses", () => {
  const plan = buildConsentPlanPreview({
    intent: "Fix auth.py",
    now: new Date("2026-05-15T00:00:00.000Z")
  });

  assert.equal(plan.self_proactive_harness.mode, "DETERMINISTIC_CONSENT_POLICY_PREVIEW");
  assert.match(plan.self_proactive_harness.mode, /^DETERMINISTIC_/);
  assert.equal(plan.self_proactive_harness.recommended_micro_action, "draft_exact_micro_consent_scope");
  assert.equal(
    plan.self_proactive_harness.gates.find((gate) => gate.gate === "policy_covers_detected_actuators").pass,
    true
  );
  assert.equal(plan.self_critique.confidence, "bounded_preview");
  assert.equal(plan.self_critique.weakest_link, "lexical_intent_classifier");
  assert.equal(plan.micro_compliance.preview_only, true);
  assert.equal(plan.micro_compliance.no_runtime, true);
  assert.equal(plan.micro_compliance.no_capability_mint, true);
  assert.equal(plan.micro_compliance.no_policy_contradiction, true);
  assert.equal(plan.micro_consent.preview_scope, "consent_plan_preview_only");
  assert.equal(plan.micro_consent.exact_consent_required, true);
  assert.equal(plan.micro_consent.exact_string_required_for_gated_actions, true);
  assert.equal(plan.micro_consent.consent_observed_in_preview, false);
  assert.equal(plan.micro_consent.approval_recorded, false);
  assert.equal(plan.micro_consent.broad_consent_allowed, false);
  assert.equal(plan.analogical_model.model, "permission_slip_not_key");
});

test("formatConsentPlanPreview renders permissions and preview boundary", () => {
  const output = formatConsentPlanPreview(buildConsentPlanPreview({
    intent: "Fix auth.py and run pytest",
    now: new Date("2026-05-15T00:00:00.000Z")
  }));

  assert.match(output, /DEMA Consent Plan Preview/);
  assert.match(output, /file:auth\.py\s+read/);
  assert.match(output, /command:pytest\s+execute/);
  assert.match(output, /Actuator classes:/);
  assert.match(output, /bash/);
  assert.match(output, /filesystem_mutation/);
  assert.match(output, /requires_governed_runtime_handoff: bash_like_actuator/);
  assert.match(output, /Self-proactive harness:/);
  assert.match(output, /Micro-compliance:/);
  assert.match(output, /Self-critique:/);
  assert.match(output, /Analogical model:/);
  assert.match(output, /Boundary: preview-only; no approval; no capability minted; no execution\./);
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
  assert.match(stdout, /Boundary: preview-only; no approval; no capability minted; no execution\./);
});

test("dema consent plan --json emits the schema-tagged preview", async () => {
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
  assert.ok(plan.actuator_classes.includes("external_call"));
  assertNoFalseNoEffectDecision(plan);
  assert.ok(plan.policy_preview.decisions.some((decision) => (
    decision.verdict === "requires_human_review" &&
    decision.code === "audit_external_delivery"
  )));
  assert.equal(plan.effect_capability.minted, false);
  assert.equal(plan.micro_compliance.policy_covers_detected_actuators, true);
});
