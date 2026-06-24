// CLOSED-DUAL-LOOP-DRY-RUN-1A — PURE dry-run loop kernel.
//
// Connects the captured pain/goal (via the interview kernel) into a DRY-RUN
// closed loop: PAT proposes -> SAT verifies -> Dema presents a consent-ready
// plan. NOTHING executes. No model, no task, no runtime, no write.
//
// Honesty crux (load-bearing): the PAT/SAT loops are DESIGNED_NOT_LIVE — they
// are deterministic SCAFFOLDS, not running agents and not model reasoning. The
// produced plan is a proposal that requires a SEPARATE, later, exact execution
// consent (the bounded task runner) to ever run. Claiming the loop "thought" or
// "reasoned" would be the zann this slice must refuse.

import { buildPainGoalInterview } from "./pain-goal-interview.js";
import { buildPreviewBoundary } from "./preview-boundary.js";

export const CLOSED_DUAL_LOOP_DRY_RUN_SCHEMA =
  "bizra.dema.closed_dual_loop_dry_run.v0.1";

const TRUTH_LABEL = "CLOSED_DUAL_LOOP_DRY_RUN_LOCAL_ONLY";

// The exact phrase that WOULD be required to ever execute — surfaced now, but
// execution itself is a separate later slice (BOUNDED-TASK-RUNNER). Naming it
// here makes the gate visible without crossing it.
const EXECUTION_CONSENT_PHRASE = "GO: execute this plan";

// Phase vocabularies mirror agent-dual-loop-preview.js for consistency.
const PAT_LOOP_PHASES = Object.freeze(["discover", "draft", "propose", "self_critique"]);
const SAT_LOOP_PHASES = Object.freeze(["verify", "gate", "refuse_or_permit_preview", "critique"]);

const WHAT_THIS_PROVES = Object.freeze([
  "A captured mission can be run through a DRY-RUN PAT-propose -> SAT-verify loop into a consent-ready plan, locally, with no model and no execution.",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "A live model or agent reasoned — the PAT/SAT loops are DESIGNED_NOT_LIVE scaffolds, not running code.",
  "The plan was executed, or any task ran — execution needs a SEPARATE exact consent (a later slice).",
  "PAT/SAT runtime is active.",
  "Any reward, PoI, token, or federation.",
  "Optional measured_routing_context activates talk or routing — it only surfaces a prior eval-route preview for operator reference.",
]);

const MEASURED_ROUTING_CONTEXT_TRUTH_LABEL = "MEASURED_ROUTING_CONTEXT_PREVIEW_ONLY";

function buildMeasuredRoutingContext(routing_preview) {
  if (!routing_preview || routing_preview.rejected === true) return null;
  const hint = routing_preview.talk_env_hint;
  if (!hint || typeof hint !== "object") return null;
  return Object.freeze({
    truth_label: MEASURED_ROUTING_CONTEXT_TRUTH_LABEL,
    baseline_hash: routing_preview.baseline_hash ?? null,
    preview_hash: routing_preview.preview_hash ?? null,
    fast_responder_model: routing_preview.assignments?.fast_responder?.model ?? null,
    talk_env_hint: hint,
  });
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

// PAT's contribution: a DETERMINISTIC scaffold derived from the goal — NOT model
// reasoning. The note disclaims authorship so a reader never mistakes scaffold
// for intelligence.
function buildPatProposal(interview) {
  const goal = interview.desired_goal;
  return Object.freeze({
    status: "DESIGNED_NOT_LIVE",
    loop: PAT_LOOP_PHASES,
    proposed_steps: Object.freeze([
      `Name the smallest first slice of: ${goal}`,
      "Draft that slice and check it against Dema's boundary (no scan/model/runtime without consent)",
      "Review it with you before anything runs",
    ]),
    help_style: interview.preferred_help_style,
    note: "A deterministic scaffold, not model reasoning — no model proposed these steps (DESIGNED_NOT_LIVE).",
  });
}

// SAT's contribution: a DETERMINISTIC preview gate. Each check is DERIVED from
// the actual boundary/plan state, never asserted as a constant — a gate that
// cannot fail is not a gate. If a future edit ever let a side-effect through,
// the matching check flips false and the verdict REFUSES. The gate_verdict is
// itself derived: PERMIT only when every check reads clean. Exported so an
// adversarial test can feed it a poisoned boundary and prove it can refuse.
export function buildSatVerdict({ boundary, plan }) {
  const checks = Object.freeze([
    Object.freeze({
      check: "no model invoked",
      passed: boundary.model_invocation_performed === false,
    }),
    Object.freeze({
      check: "no task executed",
      passed: plan.executed === false,
    }),
    Object.freeze({
      check: "no runtime activated",
      passed: boundary.runtime_execution_performed === false,
    }),
    Object.freeze({
      check: "execution gated behind a separate exact consent",
      passed:
        typeof plan.execution_consent_required === "string" &&
        plan.execution_consent_required.length > 0,
    }),
  ]);
  const permitted = checks.every((c) => c.passed);
  return Object.freeze({
    status: "DESIGNED_NOT_LIVE",
    loop: SAT_LOOP_PHASES,
    gate_verdict: permitted ? "PERMIT_PLAN_PREVIEW" : "REFUSE_PLAN_PREVIEW",
    checks,
    note: "A deterministic preview gate, not a live verifier — each check is DERIVED from the boundary/plan state. It permits the PLAN preview only, never execution.",
  });
}

export function buildClosedDualLoopDryRun({
  pain = null,
  goal = null,
  urgency = null,
  help_style = null,
  routing_preview = null,
} = {}) {
  const measured_routing_context = buildMeasuredRoutingContext(routing_preview);
  const interview = buildPainGoalInterview({ pain, goal, urgency, help_style });

  if (interview.interview_status !== "ready_for_first_mission_preview") {
    return deepFreeze({
      schema: CLOSED_DUAL_LOOP_DRY_RUN_SCHEMA,
      truth_label: TRUTH_LABEL,
      mode: "preview_only",
      dry_run_status: "not_ready",
      missing_fields: interview.missing_fields,
      pat_proposal: null,
      sat_verdict: null,
      consent_ready_plan: null,
      measured_routing_context,
      next_safe_actions: Object.freeze(["complete_the_interview"]),
      boundary: buildPreviewBoundary(),
      what_this_proves: WHAT_THIS_PROVES,
      what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
    });
  }

  const pat_proposal = buildPatProposal(interview);
  const boundary = buildPreviewBoundary();

  const consent_ready_plan = Object.freeze({
    mission: interview.first_mission_candidate.statement,
    steps: pat_proposal.proposed_steps,
    help_style: interview.preferred_help_style,
    urgency: interview.urgency_level,
    executed: false,
    execution_consent_required: EXECUTION_CONSENT_PHRASE,
    note: "This plan will not run until you type the exact execution consent — a SEPARATE, later slice (the bounded task runner).",
  });

  // SAT verdict is derived from the SAME boundary/plan that ship in the result,
  // so the gate verifies the artifact the user actually sees.
  const sat_verdict = buildSatVerdict({ boundary, plan: consent_ready_plan });

  return deepFreeze({
    schema: CLOSED_DUAL_LOOP_DRY_RUN_SCHEMA,
    truth_label: TRUTH_LABEL,
    mode: "preview_only",
    dry_run_status: "consent_ready",
    missing_fields: Object.freeze([]),
    pat_proposal,
    sat_verdict,
    consent_ready_plan,
    measured_routing_context,
    next_safe_actions: Object.freeze([
      "confirm_plan_no_execution_yet",
      "refine_via_interview",
      ...(measured_routing_context?.talk_env_hint?.env
        ? ["optional_talk_smoke_with_exported_env"]
        : []),
      "skip",
    ]),
    boundary,
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
  });
}
