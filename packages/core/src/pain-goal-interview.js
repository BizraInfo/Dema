// PAIN-GOAL-INTERVIEW-1A — PURE pain/goal interview kernel.
//
// Dema asks the human what matters before she uses a model. This kernel takes
// the user's STATED answers and structures them — pain, goal, urgency, help
// style — and, only when pain AND goal are present, PROPOSES a first mission.
// It invokes no model, runs no task, activates no runtime, and writes nothing.
//
// Honesty guard (the load-bearing constraint): one short form is not
// comprehension. Dema may say she CAPTURED what the user STATED — never that she
// "understands the user", that a model reasoned, or that anything was saved.
// Claiming otherwise would be the emotional-overreach zann this slice must avoid.

import { buildPreviewBoundary } from "./preview-boundary.js";

export const PAIN_GOAL_INTERVIEW_SCHEMA = "bizra.dema.pain_goal_interview.v0.1";

const TRUTH_LABEL = "DEMA_PAIN_GOAL_INTERVIEW_LOCAL_ONLY";

const INTERVIEW_QUESTIONS = Object.freeze([
  "What hurts right now?",
  "What are you trying to build or change?",
  "What would make today successful?",
  "How urgent is this — low, normal, high, or now?",
  "How do you want me to help — explain, plan, organize, code, research, reflect, or execute later (with your consent)?",
]);

const URGENCY_LEVELS = Object.freeze(new Set(["low", "normal", "high", "now"]));
const HELP_STYLES = Object.freeze(
  new Set(["explain", "plan", "organize", "code", "research", "reflect", "execute_later"]),
);

const WHAT_THIS_PROVES = Object.freeze([
  "Dema captured the user's STATED pain, goal, urgency, and preferred help style — locally, in memory only.",
  "A first mission can be PROPOSED from the stated goal, for the user to confirm or refine.",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "Dema understands the user fully — this is one stated form, not comprehension.",
  "Any model reasoned about, interpreted, or diagnosed the answers.",
  "Anything was saved to memory or stored on disk (1A writes nothing).",
  "The proposed mission was executed, or is ready to run.",
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function nonEmpty(v) {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

function normalizeUrgency(v) {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return URGENCY_LEVELS.has(s) ? s : "normal";
}

function normalizeHelpStyle(v) {
  const s = typeof v === "string" ? v.trim().toLowerCase().replace(/[ -]/g, "_") : "";
  return HELP_STYLES.has(s) ? s : null;
}

export function buildPainGoalInterview({
  pain = null,
  goal = null,
  urgency = null,
  help_style = null,
} = {}) {
  const painPoint = nonEmpty(pain);
  const desiredGoal = nonEmpty(goal);
  const urgencyLevel = normalizeUrgency(urgency);
  const preferredHelpStyle = normalizeHelpStyle(help_style);

  const missing_fields = [];
  if (!painPoint) missing_fields.push("pain_point");
  if (!desiredGoal) missing_fields.push("desired_goal");

  let interview_status;
  if (!painPoint && !desiredGoal) interview_status = "empty";
  else if (painPoint && desiredGoal) interview_status = "ready_for_first_mission_preview";
  else interview_status = "partial";

  const ready = interview_status === "ready_for_first_mission_preview";

  const first_mission_candidate = ready
    ? Object.freeze({
        statement: `A first step toward: ${desiredGoal}`,
        status: "PROPOSAL_ONLY",
        executed: false,
        derived_from: "desired_goal",
        preferred_help_style: preferredHelpStyle,
      })
    : null;

  const next_safe_actions = ready
    ? Object.freeze(["confirm_first_mission_proposal", "refine_answers", "skip"])
    : interview_status === "partial"
      ? Object.freeze(["complete_missing_fields"])
      : Object.freeze(["answer_interview_questions"]);

  return deepFreeze({
    schema: PAIN_GOAL_INTERVIEW_SCHEMA,
    truth_label: TRUTH_LABEL,
    mode: "preview_only",
    interview_status,
    interview_questions: INTERVIEW_QUESTIONS,
    pain_point: painPoint,
    desired_goal: desiredGoal,
    urgency_level: urgencyLevel,
    preferred_help_style: preferredHelpStyle,
    missing_fields: Object.freeze(missing_fields),
    first_mission_candidate,
    next_safe_actions,
    boundary: buildPreviewBoundary(),
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
  });
}
