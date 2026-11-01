import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import {
  DEMA_AUTOPILOT_CONTINUITY_PREVIEW_SCHEMA,
  DEMA_AUTOPILOT_CONTINUITY_TRUTH_LABEL,
  evaluateAutopilotContinuity,
} from "../packages/core/src/dema-autopilot-continuity-preview.js";
import { isCanonicalBoundary } from "../packages/core/src/preview-boundary.js";
import { loadRegistry } from "../packages/core/src/skill-registry.js";
import { validateSkillContract } from "../packages/core/src/skill-contract.js";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SKILL_MD = join(ROOT, "skills-src/dema-autopilot/SKILL.md");
const EVALS = join(ROOT, "skills-src/dema-autopilot/evals/evals.json");
const io = { readFileSync, existsSync, root: ROOT };

test("continuity preview: PR-complete does not close objective", () => {
  const card = evaluateAutopilotContinuity({
    objective_established: true,
    slice_just_completed: true,
    action_authorized: false,
    next_step_is_protected: false,
    genuine_ambiguity: false,
  });

  assert.equal(card.schema, DEMA_AUTOPILOT_CONTINUITY_PREVIEW_SCHEMA);
  assert.equal(card.truth_label, DEMA_AUTOPILOT_CONTINUITY_TRUTH_LABEL);
  assert.equal(card.resume_objective, true);
  assert.equal(card.ask_restate_goal, false);
  assert.equal(card.treat_slice_complete_as_objective_complete, false);
  assert.equal(card.may_write, false);
  assert.equal(card.do_read_only_rebind, true);
  assert.equal(card.pause_for_consent, false);
  assert.equal(isCanonicalBoundary(card.boundary), true);
});

test("continuity preview: explicit grant may_write when unprotected and unambiguous", () => {
  const card = evaluateAutopilotContinuity({
    objective_established: true,
    slice_just_completed: false,
    action_authorized: true,
    next_step_is_protected: false,
    genuine_ambiguity: false,
    verification_gate_failed: false,
  });
  assert.equal(card.may_write, true);
  assert.equal(card.pause_for_consent, false);
  assert.equal(card.do_read_only_rebind, false);
  assert.equal(isCanonicalBoundary(card.boundary), true);
});

test("continuity preview: continuity alone never authorizes writes", () => {
  const card = evaluateAutopilotContinuity({
    objective_established: true,
    slice_just_completed: false,
    action_authorized: false,
    next_step_is_protected: false,
  });
  assert.equal(card.may_write, false);
  assert.equal(card.resume_objective, true);
});

test("continuity preview: protected next step pauses for consent", () => {
  const card = evaluateAutopilotContinuity({
    objective_established: true,
    action_authorized: true,
    next_step_is_protected: true,
  });
  assert.equal(card.pause_for_consent, true);
  assert.equal(card.may_write, false);
});

test("continuity preview: genuine ambiguity never allows may_write", () => {
  const card = evaluateAutopilotContinuity({
    objective_established: true,
    action_authorized: true,
    next_step_is_protected: false,
    genuine_ambiguity: true,
  });
  assert.equal(card.pause_for_consent, true);
  assert.equal(card.may_write, false);
  assert.equal(card.do_read_only_rebind, false);
});

test("continuity preview: failed verification gate stops writes", () => {
  const card = evaluateAutopilotContinuity({
    objective_established: true,
    action_authorized: true,
    next_step_is_protected: false,
    genuine_ambiguity: false,
    verification_gate_failed: true,
  });
  assert.equal(card.pause_for_consent, true);
  assert.equal(card.may_write, false);
  assert.equal(card.do_read_only_rebind, false);
});

test("continuity preview: modified boundary fails isCanonicalBoundary", () => {
  const card = evaluateAutopilotContinuity({
    objective_established: true,
    action_authorized: true,
    next_step_is_protected: false,
    genuine_ambiguity: false,
  });
  assert.equal(isCanonicalBoundary(card.boundary), true);
  assert.equal(
    isCanonicalBoundary({
      ...card.boundary,
      filesystem_write_performed: true,
    }),
    false,
  );
});

test("continuity preview: missing objective may ask to restate", () => {
  const card = evaluateAutopilotContinuity({
    objective_established: false,
    action_authorized: false,
  });
  assert.equal(card.ask_restate_goal, true);
  assert.equal(card.resume_objective, false);
});

test("versioned skill source contains North-star continuity clauses", () => {
  const body = readFileSync(SKILL_MD, "utf8");
  assert.match(body, /## North-star continuity/);
  assert.match(body, /closes that slice only/);
  assert.match(body, /Do not ask the user to restate/);
  assert.match(body, /Objective continuity is context, not authority/);
  assert.match(body, /evaluateAutopilotContinuity/);
});

test("autopilot evals cover continuity-after-merge and write non-authorization", () => {
  const evals = JSON.parse(readFileSync(EVALS, "utf8"));
  assert.equal(evals.skill_name, "dema-autopilot");
  const names = evals.evals.map((e) => e.name);
  assert.ok(names.includes("continuity-after-pr-merge"));
  assert.ok(names.includes("continuity-does-not-authorize-writes"));
});

test("registry loads dema-autopilot with a valid contract", () => {
  const result = loadRegistry(io);
  assert.equal(result.ok, true);
  const skill = result.skills.find((s) => s.skill_id === "dema-autopilot");
  assert.ok(skill, "dema-autopilot missing from registry");
  const validation = validateSkillContract(skill.contract);
  assert.equal(validation.ok, true, validation.errors.join("; "));
  assert.equal(skill.contract.capability_family, "dema-local-mission");
});
