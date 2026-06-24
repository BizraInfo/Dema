// NODE0-ACTIVATION-CHAIN-1A — pure activation-chain composition kernel.
//
// Bundles caller-provided preview reports (ladder, optional route, mission plan,
// blackboard) into one frozen chain receipt. PREVIEW_ONLY: executes nothing,
// invokes no model, crosses no gated rung.

import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { buildPreviewBoundary } from "./preview-boundary.js";
import { verifyNode0ActivationLadder } from "./node0-activation-ladder.js";
import { verifyModelRoutingPreview } from "./model-routing-preview.js";
import { verifyPatSatBlackboardDryRun } from "./pat-sat-blackboard-dry-run.js";
import { PEAK_SELF_LOOP_PREVIEW_SCHEMA } from "./peak-self-loop-preview.js";

export const NODE0_ACTIVATION_CHAIN_SCHEMA =
  "bizra.dema.node0_activation_chain_preview.v0.1";
export const NODE0_ACTIVATION_CHAIN_TRUTH_LABEL =
  "NODE0_ACTIVATION_CHAIN_PREVIEW_LOCAL_ONLY";

const WHAT_THIS_PROVES = Object.freeze([
  "Multiple preview-only activation surfaces can be composed into one verifiable chain receipt without execution.",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "Live activation, PAT/SAT runtime, autopoietic loops, agent RL, or verified reward.",
  "Child previews were run correctly at runtime — only that their embedded envelopes verify internally.",
  "Talk was invoked — talk remains a separate exact-consent step.",
  "The gated activate rung was crossed.",
  "Peak self-loop posture implies autonomous self-modification — it is preview math only.",
]);

function selfLoopOk(report) {
  if (!report || typeof report !== "object") return false;
  if (report.schema !== PEAK_SELF_LOOP_PREVIEW_SCHEMA) return false;
  if (report.autonomous_rsi?.not_autonomous_runtime !== true) return false;
  const boundary = report.boundary;
  return boundary && Object.values(boundary).every((v) => v === false);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

function childOk(verifyFn, report) {
  if (!report) return { present: false, ok: true };
  const v = verifyFn(report);
  return { present: true, ok: v.ok === true || v.valid === true };
}

export function buildNode0ActivationChainPreview({
  ladder = null,
  routing_preview = null,
  mission_plan = null,
  blackboard = null,
  self_loop = null,
} = {}) {
  if (!ladder || typeof ladder !== "object") {
    return deepFreeze({
      schema: NODE0_ACTIVATION_CHAIN_SCHEMA,
      truth_label: NODE0_ACTIVATION_CHAIN_TRUTH_LABEL,
      rejected: true,
      reason_code: "ladder_missing",
      components: null,
      chain_status: "BLOCKED",
      boundary: { ...buildPreviewBoundary() },
    });
  }

  const ladder_verify = verifyNode0ActivationLadder(ladder);
  const routing_verify = routing_preview
    ? verifyModelRoutingPreview(routing_preview)
    : { valid: true };
  const blackboard_verify = blackboard
    ? verifyPatSatBlackboardDryRun(blackboard)
    : { ok: true };

  const components = Object.freeze({
    ladder,
    routing_preview: routing_preview ?? null,
    mission_plan: mission_plan ?? null,
    blackboard: blackboard ?? null,
    self_loop: self_loop ?? null,
  });

  const talk_hint =
    routing_preview?.talk_env_hint ??
    mission_plan?.measured_routing_context?.talk_env_hint ??
    null;

  const autopoietic_posture = self_loop
    ? Object.freeze({
        truth_label: "AUTOPOIETIC_POSTURE_PREVIEW_ONLY",
        not_autonomous_runtime: self_loop.autonomous_rsi?.not_autonomous_runtime === true,
        snr_score: self_loop.snr_framework?.score ?? null,
        snr_verdict: self_loop.snr_framework?.verdict ?? null,
        rsi_merged_verdict: self_loop.autonomous_rsi?.merged_verdict ?? null,
        hhmm_peak_phase: self_loop.hhmm?.peak_phase ?? null,
        consent_phrase: self_loop.proactive_self?.consent?.required_phrase ?? null,
      })
    : null;

  let chain_status = "PREVIEW_COMPOSED";
  const blocked_by = [];
  if (!ladder_verify.ok) blocked_by.push("ladder_invalid");
  if (routing_preview && !routing_verify.valid) blocked_by.push("routing_preview_invalid");
  if (blackboard && !blackboard_verify.ok) blocked_by.push("blackboard_invalid");
  if (self_loop && !selfLoopOk(self_loop)) blocked_by.push("self_loop_invalid");
  if (mission_plan && mission_plan.dry_run_status !== "consent_ready") {
    blocked_by.push("mission_plan_not_consent_ready");
  }
  if (blackboard && blackboard.final_state !== "QUIESCENT_CONSENT_READY") {
    blocked_by.push("blackboard_not_quiescent");
  }
  if (blocked_by.length > 0) chain_status = "BLOCKED";

  const envelopeWithoutHash = {
    schema: NODE0_ACTIVATION_CHAIN_SCHEMA,
    truth_label: NODE0_ACTIVATION_CHAIN_TRUTH_LABEL,
    rejected: false,
    chain_status,
    blocked_by: Object.freeze([...blocked_by]),
    ladder_summary: Object.freeze({ ...ladder.summary }),
    next_gated_rung: ladder.next_gated_rung ?? null,
    talk_env_hint: talk_hint,
    autopoietic_posture,
    components,
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
    boundary: { ...buildPreviewBoundary() },
  };

  const chain_hash = sha256(stableStringify(envelopeWithoutHash));
  return deepFreeze({ ...envelopeWithoutHash, chain_hash });
}

export function verifyNode0ActivationChainPreview(report) {
  const blocked_by = [];
  if (!report || typeof report !== "object") {
    return { ok: false, blocked_by: ["report_not_object"] };
  }
  if (report.rejected === true) {
    return { ok: false, blocked_by: [report.reason_code ?? "rejected"] };
  }

  const c = report.components ?? {};
  const expected = buildNode0ActivationChainPreview({
    ladder: c.ladder ?? null,
    routing_preview: c.routing_preview ?? null,
    mission_plan: c.mission_plan ?? null,
    blackboard: c.blackboard ?? null,
    self_loop: c.self_loop ?? null,
  });

  const boundary = report.boundary;
  if (!boundary || !Object.values(boundary).every((v) => v === false)) {
    blocked_by.push("boundary_not_all_false");
  }

  const { chain_hash: _rh, ...reportBody } = report;
  const { chain_hash: _eh, ...expectedBody } = expected;
  if (stableStringify(reportBody) !== stableStringify(expectedBody)) {
    blocked_by.push("chain_relaundered");
  }
  if (report.chain_hash !== expected.chain_hash) {
    blocked_by.push("chain_hash_mismatch");
  }

  const lv = childOk(verifyNode0ActivationLadder, c.ladder);
  if (lv.present && !lv.ok) blocked_by.push("ladder_child_invalid");
  if (c.routing_preview) {
    const rv = verifyModelRoutingPreview(c.routing_preview);
    if (!rv.valid) blocked_by.push("routing_child_invalid");
  }
  if (c.blackboard) {
    const bv = verifyPatSatBlackboardDryRun(c.blackboard);
    if (!bv.ok) blocked_by.push("blackboard_child_invalid");
  }
  if (c.self_loop && !selfLoopOk(c.self_loop)) {
    blocked_by.push("self_loop_child_invalid");
  }

  return { ok: blocked_by.length === 0, blocked_by };
}
