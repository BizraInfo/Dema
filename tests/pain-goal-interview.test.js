// PAIN-GOAL-INTERVIEW-1A — pure pain/goal interview kernel tests.
// Captures the user's STATED pain, goal, urgency, and preferred help style and
// proposes (only proposes) a first mission. The honesty guard is load-bearing:
// Dema must NOT claim she understands the user from one form, that a model
// reasoned, or that anything was saved or executed. No model, task, or runtime.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  buildPainGoalInterview,
  PAIN_GOAL_INTERVIEW_SCHEMA,
} from "../packages/core/src/pain-goal-interview.js";

const MODULE_PATH = fileURLToPath(
  new URL("../packages/core/src/pain-goal-interview.js", import.meta.url),
);

// Canonical effect keys — all must be false (preview only).
const CANONICAL_EFFECT_KEYS = [
  "model_invocation_performed",
  "model_loaded",
  "prompt_executed",
  "network_used",
  "external_call_performed",
  "runtime_execution_performed",
  "tool_executed",
  "filesystem_write_performed",
  "federation_invoked",
  "receipt_mint_performed",
];

function assertDeepFrozen(value, label = "value") {
  assert.equal(Object.isFrozen(value), true, `${label} must be frozen`);
  if (!value || typeof value !== "object") return;
  for (const [k, c] of Object.entries(value)) {
    if (c && typeof c === "object") assertDeepFrozen(c, `${label}.${k}`);
  }
}

test("no answers → status empty, the interview questions, missing pain+goal", () => {
  const r = buildPainGoalInterview({});
  assert.equal(r.interview_status, "empty");
  assert.ok(r.interview_questions.length >= 5);
  assert.deepEqual([...r.missing_fields].sort(), ["desired_goal", "pain_point"]);
  assert.equal(r.first_mission_candidate, null);
});

test("pain only → partial, missing the goal", () => {
  const r = buildPainGoalInterview({ pain: "my releases keep breaking" });
  assert.equal(r.interview_status, "partial");
  assert.equal(r.pain_point, "my releases keep breaking");
  assert.ok(r.missing_fields.includes("desired_goal"));
  assert.equal(r.first_mission_candidate, null);
});

test("pain + goal → ready, with a first mission candidate (proposal only)", () => {
  const r = buildPainGoalInterview({
    pain: "releases keep breaking",
    goal: "ship a reliable release every week",
  });
  assert.equal(r.interview_status, "ready_for_first_mission_preview");
  assert.equal(r.desired_goal, "ship a reliable release every week");
  assert.ok(r.first_mission_candidate);
  assert.equal(r.first_mission_candidate.status, "PROPOSAL_ONLY");
  assert.match(r.first_mission_candidate.statement, /ship a reliable release/i);
});

test("urgency normalizes to a bounded scale; unknown/absent → normal", () => {
  assert.equal(buildPainGoalInterview({ urgency: "NOW" }).urgency_level, "now");
  assert.equal(buildPainGoalInterview({ urgency: "High" }).urgency_level, "high");
  assert.equal(buildPainGoalInterview({ urgency: "whatever" }).urgency_level, "normal");
  assert.equal(buildPainGoalInterview({}).urgency_level, "normal");
});

test("preferred_help_style normalizes to a known mode; unknown → null", () => {
  assert.equal(buildPainGoalInterview({ help_style: "Plan" }).preferred_help_style, "plan");
  assert.equal(buildPainGoalInterview({ help_style: "research" }).preferred_help_style, "research");
  assert.equal(buildPainGoalInterview({ help_style: "telepathy" }).preferred_help_style, null);
});

test("the first mission is a PROPOSAL — never executed, never task-ready", () => {
  const r = buildPainGoalInterview({ pain: "x", goal: "build a dashboard" });
  assert.equal(r.first_mission_candidate.status, "PROPOSAL_ONLY");
  assert.equal(r.first_mission_candidate.executed, false);
  assert.ok(
    r.next_safe_actions.some((a) => /confirm|refine/i.test(a)),
    "ready state offers confirm/refine, not autorun",
  );
});

test("HONESTY GUARD — does NOT claim to understand the user, run a model, or save anything", () => {
  const text = buildPainGoalInterview({ pain: "x", goal: "y" })
    .what_this_does_not_prove.join(" ");
  assert.match(text, /understand/i);
  assert.match(text, /model|reason/i);
  assert.match(text, /saved|memory|stored/i);
  // and what_this_proves must stay modest — "captured STATED", not "understands".
  const proves = buildPainGoalInterview({ pain: "x", goal: "y" }).what_this_proves.join(" ");
  assert.match(proves, /stated|captured/i);
  assert.doesNotMatch(proves, /understands the user|knows you/i);
});

test("boundary is canonical and all-false (no model/network/runtime/task/etc.)", () => {
  for (const input of [{}, { pain: "x", goal: "y" }]) {
    const r = buildPainGoalInterview(input);
    for (const key of CANONICAL_EFFECT_KEYS) {
      assert.equal(r.boundary[key], false, `boundary.${key} must be false`);
    }
  }
});

test("schema + truth_label exact; deep-frozen", () => {
  const r = buildPainGoalInterview({ pain: "x", goal: "y" });
  assert.equal(r.schema, "bizra.dema.pain_goal_interview.v0.1");
  assert.equal(r.schema, PAIN_GOAL_INTERVIEW_SCHEMA);
  assert.equal(r.truth_label, "DEMA_PAIN_GOAL_INTERVIEW_LOCAL_ONLY");
  assert.equal(r.mode, "preview_only");
  assertDeepFrozen(r, "interview");
});

test("module imports no node fs/net/http/child_process/os directly", () => {
  const source = readFileSync(MODULE_PATH, "utf8");
  assert.doesNotMatch(
    source,
    /from\s+["']node:(fs|fs\/promises|net|http|https|child_process|os)["']/,
  );
});
