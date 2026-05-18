import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildPATCodeApprenticePreview,
  buildPATCodeApprenticeSummary,
  buildPATCodeApprenticeEffectCap,
  buildPATCodeApprenticeKernel,
  draftCodeChangePlan,
  PAT_CODE_APPRENTICE_SCHEMA_NAME,
  PAT_CODE_APPRENTICE_CHANGE_PLAN_SCHEMA_NAME,
  PAT_CODE_APPRENTICE_PERSONA
} from "../packages/core/src/pat-code-apprentice.js";
import { isCanonicalBoundary } from "../packages/core/src/preview-boundary.js";

test("PAT-3 preview emits canonical schema + truth label", () => {
  const p = buildPATCodeApprenticePreview();
  assert.equal(p.schema, "bizra.dema.pat_code_apprentice.v0.1");
  assert.equal(p.truth_label, "NODE0_LOCAL_SEED");
});

test("PAT-3 boundary canonical · all sub-views frozen", () => {
  const p = buildPATCodeApprenticePreview();
  assert.ok(isCanonicalBoundary(p.boundary));
  assert.ok(Object.isFrozen(p));
  assert.ok(Object.isFrozen(p.persona));
});

test("PAT-3 persona: pat_number=3 · role=code_apprentice", () => {
  const p = buildPATCodeApprenticePreview();
  assert.equal(p.persona.pat_number, 3);
  assert.equal(p.persona.pat_id, "pat-3-code-apprentice");
  assert.equal(p.persona.role_name, "code_apprentice");
});

test("PAT-3 refusals include never-push · never-bypass-hook · never-modify-CI", () => {
  const p = buildPATCodeApprenticePreview();
  assert.ok(p.persona.primary_refusals.includes("push_to_remote"));
  assert.ok(p.persona.primary_refusals.includes("bypass_pre_commit_hooks"));
  assert.ok(p.persona.primary_refusals.includes("modify_ci_workflows_yml"));
  assert.ok(p.persona.primary_refusals.includes("force_push"));
});

test("PAT-3 EffectCap valid with code-apprentice consent template", () => {
  const cap = buildPATCodeApprenticeEffectCap();
  assert.equal(cap.valid, true);
  assert.equal(cap.name, "pat_code_apprentice");
});

test("PAT-3 EffectCap blocks push/force-push/CI-edit specifically", () => {
  const cap = buildPATCodeApprenticeEffectCap();
  assert.ok(cap.blocked_effects.includes("push_to_remote"));
  assert.ok(cap.blocked_effects.includes("force_push"));
  assert.ok(cap.blocked_effects.includes("modify_ci_workflows"));
  assert.ok(cap.blocked_effects.includes("bypass_pre_commit_hook"));
});

test("PAT-3 kernel pre-configured correctly", () => {
  const k = buildPATCodeApprenticeKernel({ mission_intent: "edit feature" });
  assert.equal(k.agent_id, "pat-3-code-apprentice");
  assert.equal(k.mission_intent, "edit feature");
});

test("draftCodeChangePlan emits valid plan with allowed paths", () => {
  const plan = draftCodeChangePlan({
    change_intent: "add a new test file",
    paths_to_edit: ["packages/core/src/new.js"],
    change_type: "create",
    declared_scope_root: "packages/core/src/"
  });
  assert.equal(plan.schema, "bizra.dema.code_change_plan.v0.1");
  assert.equal(plan.valid, true);
  assert.equal(plan.refusal_reason, null);
  assert.equal(plan.path_analysis[0].allowed_for_change, true);
});

test("draftCodeChangePlan refuses path in .github/workflows/", () => {
  const plan = draftCodeChangePlan({
    change_intent: "modify CI",
    paths_to_edit: [".github/workflows/check.yml"],
    declared_scope_root: ".github/"
  });
  assert.equal(plan.valid, false);
  assert.match(plan.refusal_reason, /forbidden_path/);
});

test("draftCodeChangePlan refuses path matching credentials/secrets/.env", () => {
  const plan1 = draftCodeChangePlan({
    change_intent: "modify env",
    paths_to_edit: [".env"],
    declared_scope_root: "."
  });
  const plan2 = draftCodeChangePlan({
    change_intent: "modify",
    paths_to_edit: ["packages/secrets/api.js"],
    declared_scope_root: "packages/"
  });
  assert.equal(plan1.valid, false);
  assert.equal(plan2.valid, false);
});

test("draftCodeChangePlan refuses path outside declared scope root", () => {
  const plan = draftCodeChangePlan({
    change_intent: "edit outside scope",
    paths_to_edit: ["packages/other/file.js"],
    declared_scope_root: "packages/core/"
  });
  assert.equal(plan.valid, false);
  assert.match(plan.refusal_reason, /outside_declared_scope/);
});

test("draftCodeChangePlan refuses missing declared_scope_root", () => {
  const plan = draftCodeChangePlan({
    change_intent: "edit something",
    paths_to_edit: ["packages/core/src/x.js"]
  });
  assert.equal(plan.valid, false);
  assert.match(plan.refusal_reason, /missing_declared_scope_root/);
});

test("Adversarial · non-string paths filtered", () => {
  const plan = draftCodeChangePlan({
    change_intent: "test",
    paths_to_edit: ["valid.js", () => "evil", Symbol("x"), 42],
    declared_scope_root: "."
  });
  assert.equal(plan.path_analysis.length, 1);
  assert.equal(plan.path_analysis[0].path, "valid.js");
});

test("Adversarial · change_type defaults to 'edit' for unknown types", () => {
  const plan = draftCodeChangePlan({
    change_intent: "test",
    paths_to_edit: ["x.js"],
    change_type: "malicious",
    declared_scope_root: "."
  });
  assert.equal(plan.change_type, "edit");
});

test("Plan output is deep-frozen", () => {
  const plan = draftCodeChangePlan({
    change_intent: "test",
    paths_to_edit: ["x.js"],
    declared_scope_root: "."
  });
  assert.ok(Object.isFrozen(plan));
  assert.ok(Object.isFrozen(plan.path_analysis));
  assert.ok(isCanonicalBoundary(plan.boundary));
});

test("Summary fits within line budget", () => {
  const s = buildPATCodeApprenticeSummary();
  const lines = JSON.stringify(s, null, 2).split("\n").length;
  assert.ok(lines <= 40);
});

test("Exports + persona frozen", () => {
  assert.equal(typeof PAT_CODE_APPRENTICE_SCHEMA_NAME, "string");
  assert.equal(typeof PAT_CODE_APPRENTICE_CHANGE_PLAN_SCHEMA_NAME, "string");
  assert.ok(Object.isFrozen(PAT_CODE_APPRENTICE_PERSONA));
  assert.equal(PAT_CODE_APPRENTICE_PERSONA.pat_number, 3);
});
