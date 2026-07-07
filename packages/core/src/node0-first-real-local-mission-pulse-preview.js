// NODE0-FIRST-REAL-LOCAL-MISSION-PULSE-PREVIEW-1A — Pure preview-only Node0 mission pulse: connects one
// caller-supplied mission packet through consent, resource-composition reference, action preview,
// verification, receipt preview, world-state delta preview, and a DEMA truth report — all
// boundary-false, activates nothing.
//
// This is the FIRST control-plane bridge from "composed architecture" toward "living loop". It proves
// the eight-stage pulse (PERCEIVE → CONSENT → RESOURCE_SELECT → ACTION_PREVIEW → VERIFY → RECEIPT →
// WORLD_STATE_UPDATE_PREVIEW → DEMA_REPORT) can be connected deterministically over CALLER-SUPPLIED
// packets. It reads no filesystem, invokes no model, runs no daemon: the "action preview" is a
// caller-supplied candidate extraction whose SHAPE and boundary the kernel validates — it claims no
// semantic intelligence.
//
// Resource selection binds to the merged composition gate: the mission's composition_ref is a full
// NODE0-URP-GENESIS-ROOT-COMPOSITION-GATE-PREVIEW verdict, re-verified here — which transitively
// re-verifies the embedded genesis-root signature anchor, so a forge-and-recompute of the pulse body
// that tampers the composition/genesis chain is still rejected.
//
// Pure kernel: no fs / network / process / clock / random. createHash is a deterministic digest.

import { createHash } from "node:crypto";
import {
  verifyNode0UrpGenesisRootCompositionGatePreview,
  NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_SCHEMA,
} from "./node0-urp-genesis-root-composition-gate-preview.js";

export const NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_SCHEMA = "bizra.dema.node0_first_real_local_mission_pulse_preview.v0.1";
export const NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_TRUTH_LABEL = "NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_MEASURED_REPO";
export const NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_GO_PHRASE = "GO: node0 first real local mission pulse preview";

// The eight deterministic pulse stages. Every one is a PREVIEW; none executes.
export const PULSE_STAGES = Object.freeze([
  "PERCEIVE",
  "CONSENT",
  "RESOURCE_SELECT",
  "ACTION_PREVIEW",
  "VERIFY",
  "RECEIPT",
  "WORLD_STATE_UPDATE_PREVIEW",
  "DEMA_REPORT",
]);

// A caller may not assert any of these true — doing so claims a live capability the pulse refuses.
const FORBIDDEN_DECLARED_FLAGS = Object.freeze([
  "live_urp",
  "mint_allowed",
  "wallet_accessed",
  "settlement",
  "payment",
  "federation",
  "daemon_started",
  "network_used",
  "model_invocation_performed",
  "file_mutation_performed",
  "remote_execution",
]);

// Overclaim wording tripwires scanned over the candidate extraction's text.
const OVERCLAIM_WORDING = Object.freeze([
  { code: "live_urp_wording", re: /live urp|urp is live|urp activated|activate(?:d)? (?:the )?urp/i },
  { code: "mint_wording", re: /mint(?:ing|ed)?\b|token minted|reward minted/i },
  { code: "federation_wording", re: /federation is live|federated live|live federation/i },
  { code: "daemon_wording", re: /daemon (?:started|running|active)/i },
  { code: "cost_as_value_wording", re: /cost (?:is|equals|=) value|cost.*is.*impact/i },
]);

const CONTENT_HASH_RE = /^sha256:[0-9a-f]{64}$/;

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function nonEmptyString(v) {
  return typeof v === "string" && v.trim() !== "";
}

// All-false boundary invariant. Keys mirror the capability-truth-registry row boundary.
export function node0FirstRealLocalMissionPulsePreviewBoundary() {
  return Object.freeze({
    execution_allowed: false,
    daemon_started: false,
    network_used: false,
    token_minted: false,
    wallet_accessed: false,
    live_execution_performed: false,
    file_mutation_performed: false,
    model_invocation_performed: false,
  });
}

function boundaryAllFalse(b) {
  const keys = Object.keys(node0FirstRealLocalMissionPulsePreviewBoundary());
  return (
    !!b &&
    typeof b === "object" &&
    !Array.isArray(b) &&
    Object.keys(b).length === keys.length &&
    keys.every((k) => b[k] === false)
  );
}

// Scan only the AFFIRMATIVE fields (claim, task). The `boundary` field is definitionally the
// "what this does NOT do" statement — it names the forbidden capabilities as negations
// ("No live URP, no mint, ...") and must not be flagged as an overclaim.
function scanOverclaim(candidate) {
  const text = [candidate?.claim, candidate?.task]
    .filter((s) => typeof s === "string")
    .join(" \n ");
  const hits = [];
  for (const o of OVERCLAIM_WORDING) if (o.re.test(text)) hits.push(`overclaim:${o.code}`);
  return hits;
}

// The deterministic eight-stage pulse evaluation. Fail-closed: collects a blocked_by list and the
// per-stage pass map. Never executes; only validates caller-supplied packets.
export function evaluatePulse(input) {
  const blocked_by = [];
  const stage = {};

  // PERCEIVE
  const mission = input?.mission;
  const perceive_ok = !!mission && typeof mission === "object" && nonEmptyString(mission.mission_id) && nonEmptyString(mission.sovereign_intent);
  if (!mission || typeof mission !== "object") blocked_by.push("missing_mission");
  else if (!perceive_ok) blocked_by.push("mission_malformed");
  stage.PERCEIVE = perceive_ok;

  // CONSENT
  const consent = input?.consent;
  let consent_ok = false;
  if (!consent || typeof consent !== "object") {
    blocked_by.push("missing_consent");
  } else {
    if (consent.operator_is_sole_authority !== true) blocked_by.push("consent_not_sole_authority");
    if (consent.allows_live_mutation === true) blocked_by.push("consent_allows_live_mutation");
    consent_ok = consent.operator_is_sole_authority === true && consent.allows_live_mutation !== true;
  }
  stage.CONSENT = consent_ok;

  // input packet content-addressing + data-boundary
  const packet = input?.input_packet;
  if (!packet || typeof packet !== "object") {
    blocked_by.push("missing_input_packet");
  } else {
    if (!CONTENT_HASH_RE.test(packet.content_hash || "")) blocked_by.push("missing_input_content_hash");
    if (packet.raw_content_leaves_node0 === true) blocked_by.push("raw_content_leaves_node0");
  }

  // RESOURCE_SELECT — the composition_ref must be a valid, ready composition verdict.
  const ref = input?.composition_ref;
  let resource_ok = false;
  if (!ref || typeof ref !== "object") {
    blocked_by.push("missing_composition_ref");
  } else if (ref.schema !== NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_SCHEMA) {
    blocked_by.push("composition_ref_schema_mismatch");
  } else {
    const cv = verifyNode0UrpGenesisRootCompositionGatePreview(ref);
    if (!cv.ok) blocked_by.push("composition_ref_invalid");
    if (ref.composition_ready !== true) blocked_by.push("composition_not_ready");
    resource_ok = cv.ok && ref.composition_ready === true;
  }
  stage.RESOURCE_SELECT = resource_ok;

  // ACTION_PREVIEW — a caller-supplied candidate extraction; validate SHAPE only, no semantics.
  const cand = input?.candidate_extraction;
  let action_ok = false;
  if (!cand || typeof cand !== "object") {
    blocked_by.push("missing_candidate_extraction");
  } else {
    if (!nonEmptyString(cand.claim)) blocked_by.push("candidate_missing_claim");
    if (!nonEmptyString(cand.task)) blocked_by.push("candidate_missing_task");
    if (!nonEmptyString(cand.boundary)) blocked_by.push("candidate_missing_boundary");
    for (const o of scanOverclaim(cand)) blocked_by.push(o);
    action_ok =
      nonEmptyString(cand.claim) &&
      nonEmptyString(cand.task) &&
      nonEmptyString(cand.boundary) &&
      scanOverclaim(cand).length === 0;
  }
  stage.ACTION_PREVIEW = action_ok;

  // Composed-level overclaim / authority guards.
  const declared = input?.declared_flags;
  if (declared && typeof declared === "object") {
    for (const f of FORBIDDEN_DECLARED_FLAGS) if (declared[f] === true) blocked_by.push(`declared_${f}`);
  }
  if (typeof input?.authority_delta === "number" && input.authority_delta > 0) blocked_by.push("authority_delta_nonzero");
  if (input?.request_live_commit === true) blocked_by.push("request_live_commit");

  // VERIFY stage passes when every prior stage passed and nothing is blocked.
  stage.VERIFY = blocked_by.length === 0;
  // RECEIPT / WORLD_STATE_UPDATE_PREVIEW / DEMA_REPORT are always produced (below) as previews.
  stage.RECEIPT = blocked_by.length === 0;
  stage.WORLD_STATE_UPDATE_PREVIEW = blocked_by.length === 0;
  stage.DEMA_REPORT = true;

  return Object.freeze({
    blocked_by: Object.freeze([...new Set(blocked_by)]),
    stage_results: Object.freeze(PULSE_STAGES.map((name) => Object.freeze({ stage: name, ok: stage[name] === true }))),
    pulse_ready: blocked_by.length === 0,
  });
}

export function planNode0FirstRealLocalMissionPulsePreview({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_GO_PHRASE) blocked_by.push("consent_phrase_mismatch");
  if (!input || typeof input !== "object") {
    blocked_by.push("input_not_object");
  } else {
    if (!input.mission || typeof input.mission !== "object") blocked_by.push("missing_mission");
    if (!input.consent || typeof input.consent !== "object") blocked_by.push("missing_consent");
    if (!input.composition_ref || typeof input.composition_ref !== "object") blocked_by.push("missing_composition_ref");
  }
  return Object.freeze({
    schema: NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_SCHEMA,
    truth_label: NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Content-addressed pulse verdict. Embeds the whole composition_ref (whose embedded genesis anchor is
// the signature-backed independent anchor) and produces receipt / world-state / DEMA previews.
export function buildNode0FirstRealLocalMissionPulsePreviewPayload(input) {
  const evalr = evaluatePulse(input);
  const mission = input?.mission ?? null;
  const cand = input?.candidate_extraction ?? {};
  const ready = evalr.pulse_ready;

  const receipt_preview = Object.freeze({
    mission_id: mission?.mission_id ?? null,
    pulse_ok: ready,
    recorded_stages: evalr.stage_results,
    committed_live: false,
  });

  const world_state_delta_preview = Object.freeze({
    operation: "append_preview",
    target: "node0.world_state.missions",
    mission_id: mission?.mission_id ?? null,
    adds: Object.freeze({
      claims: ready && nonEmptyString(cand.claim) ? Object.freeze([cand.claim]) : Object.freeze([]),
      tasks: ready && nonEmptyString(cand.task) ? Object.freeze([cand.task]) : Object.freeze([]),
      boundaries: ready && nonEmptyString(cand.boundary) ? Object.freeze([cand.boundary]) : Object.freeze([]),
    }),
    committed_live: false,
  });

  const dema_report = Object.freeze({
    status: ready ? "verified_preview_pulse" : "blocked_preview_pulse",
    what_happened: ready
      ? "A supplied mission packet was validated and transformed into a receipt-backed world-state delta preview."
      : "A supplied mission packet was rejected before producing a world-state delta preview.",
    what_this_proves:
      "The Node0 control loop can connect mission, consent, resource composition, verification, receipt, and world-state — all as previews over caller-supplied packets.",
    what_this_does_not_prove:
      "No live runtime, no model intelligence, no real founder-data ingestion, no mint, no federation, no daemon, no network, no public readiness. The 'action preview' is a caller-supplied candidate whose shape is validated — not a semantic extraction by this kernel.",
    next_safe_action: ready
      ? "Build NODE0-LOCAL-MISSION-HARNESS-PREVIEW-1A (I/O harness) only after this pure kernel is merged."
      : "Repair the mission packet per blocked_by, then re-run the pulse.",
  });

  const body = {
    schema: NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_SCHEMA,
    truth_label: NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_TRUTH_LABEL,
    mission,
    consent: input?.consent ?? null,
    input_packet: input?.input_packet ?? null,
    composition_ref: input?.composition_ref ?? null,
    composition_ref_content_hash: input?.composition_ref?.content_hash ?? null,
    pulse_stages: PULSE_STAGES,
    stage_results: evalr.stage_results,
    pulse_ready: ready,
    receipt_preview,
    world_state_delta_preview,
    dema_report,
    boundary: node0FirstRealLocalMissionPulsePreviewBoundary(),
    authority_delta: 0,
    grants_action: false,
    mint_allowed: false,
    blocked_by: evalr.blocked_by,
    what_this_proves:
      "One local mission pulse connected mission → consent → composition-referenced resource selection → action preview → verification → receipt preview → world-state delta preview → DEMA report, deterministically and boundary-false, over caller-supplied packets, with the composition reference re-verified (signature-backed genesis anchor).",
    what_this_does_not_prove: dema_report.what_this_does_not_prove,
  };
  const content_hash = `sha256:${sha256(stableStringify(body))}`;
  return Object.freeze({ ...body, content_hash });
}

// Body-bound verifier + independent anchor re-verification of the embedded composition reference.
export function verifyNode0FirstRealLocalMissionPulsePreview(payload) {
  if (!payload || typeof payload !== "object") {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["packet_not_object"]) });
  }
  const blocked_by = [];
  const { content_hash, ...body } = payload;
  if (content_hash !== `sha256:${sha256(stableStringify(body))}`) blocked_by.push("content_hash_mismatch");
  if (payload.schema !== NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_SCHEMA) blocked_by.push("schema_mismatch");
  if (payload.truth_label !== NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");
  if (payload.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
  if (payload.grants_action !== false) blocked_by.push("grants_action_true");
  if (payload.mint_allowed !== false) blocked_by.push("mint_allowed_true");
  if (!boundaryAllFalse(payload.boundary)) blocked_by.push("boundary_not_all_false");
  if (!payload.receipt_preview || typeof payload.receipt_preview !== "object") blocked_by.push("receipt_preview_missing");
  const wsd = payload.world_state_delta_preview;
  if (!wsd || typeof wsd !== "object") blocked_by.push("world_state_delta_preview_missing");
  else if (wsd.committed_live !== false) blocked_by.push("world_state_committed_live");
  // Independent anchor: re-verify the embedded composition reference (→ genesis signature anchor).
  const cv = verifyNode0UrpGenesisRootCompositionGatePreview(payload.composition_ref);
  if (!cv.ok) blocked_by.push("composition_anchor_invalid");
  if (payload.composition_ref_content_hash !== (payload.composition_ref?.content_hash ?? null)) {
    blocked_by.push("composition_hash_ref_mismatch");
  }
  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_SCHEMA,
    truth_label: NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_TRUTH_LABEL,
    pulse_ready: payload.pulse_ready === true,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
  });
}

// Pure example mission input given an already-built composition verdict packet (the caller/gate builds
// it — it needs keys for the genesis signature, which the pure kernel never generates).
export function exampleMissionInput(compositionRefPayload) {
  return {
    mission: {
      mission_id: "node0-local-mission-0001",
      sovereign_intent: "Extract one claim, one task, and one boundary from this supplied founder-data packet.",
      mission_type: "founder_data_refinement_preview",
    },
    consent: {
      operator_is_sole_authority: true,
      scope: "supplied_packet_only",
      allows_world_state_preview: true,
      allows_live_mutation: false,
    },
    input_packet: {
      source_label: "founder_note_preview",
      content_hash: `sha256:${"a".repeat(64)}`,
      sensitivity: "local_private",
      raw_content_leaves_node0: false,
    },
    composition_ref: compositionRefPayload,
    candidate_extraction: {
      claim: "BIZRA becomes real when one mission produces a verified state change with a receipt.",
      task: "Build the first local mission pulse preview kernel.",
      boundary: "No live URP, no mint, no daemon, no model, no network, no federation.",
    },
    authority_delta: 0,
    request_live_commit: false,
    declared_flags: Object.freeze(Object.fromEntries(FORBIDDEN_DECLARED_FLAGS.map((f) => [f, false]))),
  };
}

// Orchestrator the review gate consumes: plan → build → verify → tamper-reject, failing closed.
export function runNode0FirstRealLocalMissionPulsePreview({ consent, input } = {}) {
  const plan = planNode0FirstRealLocalMissionPulsePreview({ consent, input });
  if (!plan.eligible) {
    return Object.freeze({
      ok: false,
      schema: NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_SCHEMA,
      truth_label: NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_TRUTH_LABEL,
      status: "blocked_pending_consent",
      pulse_ready: false,
      boundary: node0FirstRealLocalMissionPulsePreviewBoundary(),
      mint_allowed: false,
      authority_delta: 0,
      grants_action: false,
      blocked_by: plan.blocked_by,
    });
  }

  const payload = buildNode0FirstRealLocalMissionPulsePreviewPayload(input);
  const verified = verifyNode0FirstRealLocalMissionPulsePreview(payload);
  const blocked_by = [];
  if (!payload.pulse_ready) blocked_by.push(...payload.blocked_by);
  if (!verified.ok) blocked_by.push(...verified.blocked_by);

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_SCHEMA,
    truth_label: NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_TRUTH_LABEL,
    status: blocked_by.length === 0 ? "verified_preview_pulse" : "blocked_preview_pulse",
    content_hash: payload.content_hash,
    pulse_ready: payload.pulse_ready,
    stage_count: PULSE_STAGES.length,
    boundary: payload.boundary,
    mint_allowed: false,
    authority_delta: 0,
    grants_action: false,
    receipt_preview: payload.receipt_preview,
    world_state_delta_preview: payload.world_state_delta_preview,
    dema_report: payload.dema_report,
    what_this_proves: payload.what_this_proves,
    what_this_does_not_prove: payload.what_this_does_not_prove,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
  });
}
