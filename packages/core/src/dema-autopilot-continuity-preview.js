/**
 * dema-autopilot-continuity-preview.js
 *
 * PREVIEW_ONLY — encodes Dema Autopilot North-star continuity as a pure
 * decision card. Completing a slice closes that slice only; it does not close
 * an established objective. Continuity is context, never write authority.
 *
 * Truth label: PREVIEW_ONLY
 * Boundary: authority_delta=0, execution_performed=false
 */

import { buildPreviewBoundary } from "./preview-boundary.js";

export const DEMA_AUTOPILOT_CONTINUITY_PREVIEW_SCHEMA =
  "bizra.dema.autopilot_continuity_preview.v0.1";

export const DEMA_AUTOPILOT_CONTINUITY_TRUTH_LABEL = "PREVIEW_ONLY";

/**
 * @typedef {object} AutopilotContinuityInput
 * @property {boolean} [objective_established] — long-term objective already known
 * @property {boolean} [slice_just_completed] — a bounded task just finished
 * @property {boolean} [action_authorized] — current request authorizes a reversible act
 * @property {boolean} [next_step_is_protected] — next useful step needs fresh GO
 * @property {boolean} [genuine_ambiguity] — cannot safely choose the next step
 * @property {boolean} [verification_gate_failed] — a safety/verification gate failed
 */

/**
 * Evaluate North-star continuity for a generic or mid-campaign autopilot pass.
 *
 * @param {AutopilotContinuityInput} [input]
 * @returns {object} decision card (never mutates, never authorizes effects)
 */
export function evaluateAutopilotContinuity(input = {}) {
  const objectiveEstablished = input.objective_established === true;
  const sliceJustCompleted = input.slice_just_completed === true;
  const actionAuthorized = input.action_authorized === true;
  const nextStepProtected = input.next_step_is_protected === true;
  const genuineAmbiguity = input.genuine_ambiguity === true;
  const verificationGateFailed = input.verification_gate_failed === true;

  const askRestateGoal = !objectiveEstablished;
  const treatSliceAsObjectiveComplete = false;
  const resumeObjective = objectiveEstablished;
  const pauseForConsent =
    nextStepProtected || genuineAmbiguity || verificationGateFailed;
  // Continuity never grants writes. An explicit action grant still cannot
  // write while the next step is protected, a gate failed, or the situation
  // is ambiguous.
  const mayWrite =
    actionAuthorized === true &&
    nextStepProtected !== true &&
    genuineAmbiguity !== true &&
    verificationGateFailed !== true;
  const doReadOnlyRebind =
    resumeObjective && !actionAuthorized && !pauseForConsent;

  return {
    schema: DEMA_AUTOPILOT_CONTINUITY_PREVIEW_SCHEMA,
    truth_label: DEMA_AUTOPILOT_CONTINUITY_TRUTH_LABEL,
    objective_established: objectiveEstablished,
    slice_just_completed: sliceJustCompleted,
    resume_objective: resumeObjective,
    ask_restate_goal: askRestateGoal,
    treat_slice_complete_as_objective_complete: treatSliceAsObjectiveComplete,
    may_write: mayWrite,
    pause_for_consent: pauseForConsent,
    do_read_only_rebind: doReadOnlyRebind,
    notes: [
      "Completing a PR/test/artifact closes that slice only.",
      "Objective continuity is context, not authority.",
      "Pause only for protected effects, failed gates, or genuine ambiguity.",
    ],
    boundary: buildPreviewBoundary(),
  };
}
