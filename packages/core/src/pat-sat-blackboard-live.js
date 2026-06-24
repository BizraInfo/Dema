// PAT-SAT-BLACKBOARD-LIVE-1A — pure composition of the deterministic dry-run
// board with ONE live local-model suggestion produced by invokeDemaTalkLive.
//
// "Live" here means: a real local model produced exactly ONE PAT `propose`
// suggestion, behind exact-string consent, suggestion-only. It is NOT autonomous
// PAT/SAT coordination: no self-driving loop, no identity bound, no key signed,
// no receipt/token/PoI minted, no daemon started, no federation. A model DID run,
// so model_invocation MAY be true (honest) — but the 10 forbidden runtime-emission
// boundary keys (ADR-018 §C3) MUST stay false, and verify enforces that.
//
// This kernel is PURE: the caller (CLI) performs the model call via the sanctioned
// invokeDemaTalkLive path and passes its result in. Zero I/O here.

import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { buildRuntimeEmissionBoundary } from "./preview-boundary.js";

export const PAT_SAT_BLACKBOARD_LIVE_SCHEMA =
  "bizra.dema.pat_sat_blackboard_live.v0.1";

// The boundary keys that MUST remain false even on the live path — a live
// suggestion is NOT task execution, mint, federation, or filesystem mutation.
export const LIVE_BLACKBOARD_FORBIDDEN_TRUE_KEYS = Object.freeze([
  "filesystem_write_performed",
  "external_call_performed",
  "raw_corpus_scan_performed",
  "raw_data_included",
  "tool_executed",
  "chain_advance_performed",
  "receipt_mint_performed",
  "federation_invoked",
  "node_connection_performed",
  "public_network_used",
]);

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

/** Deterministic PAT `propose`-seat prompt from the {pain,goal} seed. Pure. */
export function buildLiveBlackboardProposePrompt({ pain = null, goal = null } = {}) {
  const p = typeof pain === "string" && pain.trim() ? pain.trim() : "(unstated)";
  const g = typeof goal === "string" && goal.trim() ? goal.trim() : "(unstated)";
  return (
    "You are the PAT 'propose' seat on a Dema dry-run blackboard. " +
    `Pain: ${p}. Goal: ${g}. ` +
    "Propose ONE concrete next step as a suggestion only. " +
    "You are not executing anything and your answer is advisory, not authoritative."
  );
}

/**
 * Compose the dry-run board (deterministic scaffold) with ONE live model
 * suggestion (an invokeDemaTalkLive result) into an honest envelope.
 */
export function composeLiveBlackboard({ dryRun = null, liveResult = null } = {}) {
  const status =
    liveResult && typeof liveResult.invocation_status === "string"
      ? liveResult.invocation_status
      : "absent";
  const completed = status === "completed";
  const truth_label = completed
    ? "PAT_SAT_BLACKBOARD_LIVE_SUGGESTION_ONLY"
    : `PAT_SAT_BLACKBOARD_LIVE_${status.toUpperCase()}`;

  // Authoritative boundary = the live call's runtime-emission boundary (model_*
  // may be true); fall back to an all-false emission boundary if no call.
  const boundary =
    liveResult && liveResult.boundary && typeof liveResult.boundary === "object"
      ? { ...liveResult.boundary }
      : buildRuntimeEmissionBoundary({});

  // Explicit autonomy attestation — always false. This is the line between a
  // single consent-gated suggestion and forbidden autonomous coordination.
  const autonomy = {
    autonomous_loop_executed: false,
    agents_self_directed: false,
    multi_step_executed: false,
  };

  const live_propose = {
    source: "live_model_suggestion",
    invocation_status: status,
    provider: liveResult?.provider ?? null,
    model: liveResult?.model ?? null,
    verdict_role: "suggestion",
    suggestion_preview: liveResult?.response_text_preview ?? null,
    required_consent: liveResult?.required_consent ?? null,
    consent_verified: liveResult?.consent_phrase_verified === true,
    error_reason: liveResult?.error_reason ?? null,
  };

  const what_this_does_not_prove = [
    "this is NOT autonomous PAT/SAT coordination — exactly ONE live suggestion was produced; the loop did not self-drive",
    "the model suggestion is NOT an authority and was NOT executed",
    "the rest of the board is the deterministic dry-run scaffold, not live output",
    "no identity bound, no key signed, no receipt/token/PoI minted, no daemon started, no federation",
  ];

  const envelopeWithoutHash = {
    schema: PAT_SAT_BLACKBOARD_LIVE_SCHEMA,
    truth_label,
    seed: dryRun?.seed ?? { pain: null, goal: null },
    dry_run_board: dryRun?.board ?? [],
    dry_run_final_state: dryRun?.final_state ?? null,
    live_propose,
    autonomy,
    boundary,
    what_this_does_not_prove,
  };

  const live_hash = sha256(stableStringify(envelopeWithoutHash));
  return deepFreeze({ ...envelopeWithoutHash, live_hash });
}

/**
 * Verify integrity + invariants. The model output is non-deterministic so it is
 * NOT re-derived; instead the hash binds the whole body (body-bound — tampering
 * the suggestion, boundary, or autonomy breaks it), and the forbidden boundary
 * keys + autonomy attestation + suggestion role are enforced explicitly.
 */
export function verifyLiveBlackboard(report) {
  const blocked_by = [];
  if (!report || typeof report !== "object") {
    return { ok: false, blocked_by: ["report_not_object"] };
  }

  const b = report.boundary;
  if (!b || typeof b !== "object") {
    blocked_by.push("boundary_missing");
  } else {
    for (const k of LIVE_BLACKBOARD_FORBIDDEN_TRUE_KEYS) {
      if (b[k] !== false) blocked_by.push(`forbidden_boundary_true:${k}`);
    }
  }

  const a = report.autonomy;
  if (!a || typeof a !== "object" || Object.values(a).some((v) => v !== false)) {
    blocked_by.push("autonomy_not_all_false");
  }

  if (report.live_propose?.verdict_role !== "suggestion") {
    blocked_by.push("verdict_role_not_suggestion");
  }

  // Body-bound integrity: the hash must re-derive from the report's own body.
  const { live_hash: reportHash, ...body } = report;
  if (reportHash !== sha256(stableStringify(body))) {
    blocked_by.push("live_hash_mismatch");
  }

  return { ok: blocked_by.length === 0, blocked_by };
}
