// DRS-PRESENCE-REDUCER-2A — Realm Shell presence reducer v2.
//
// Reduces IF-01-ACCEPTED RealmEvents (the DRS-REALM-CONTRACTS-1A wire law)
// into one 11-state projection snapshot plus an i18n-keyed RenderRequest view.
// This kernel never sees a raw frame as trusted: everything it derives comes
// from a transcript that must first survive the wire law's admission, sequence,
// digest-chain and evidence constraints. Unknown or refused input can only ever
// render OFFLINE/UNKNOWN — never a familiar state.
//
// Laws carried forward:
//   - Animation state = verified runtime event, never theater (DEMA-PRESENCE-1A).
//   - No stale success: lost freshness degrades ANY retained state
//     (classifyFreshness / degradedVisibleState are imported, not reimplemented).
//   - Unavailable telemetry renders as null (never zero).
//   - authority_delta == 0 on the derivation itself; boundary all-false.
//
// Pure kernel. Effects injected: time enters only as `now_ms` / frame
// `__now_ms__` markers; hashing via packages/canon canonical-json-v1.

import { CANONICAL_JSON_V1_ALGORITHM } from "../../canon/src/canonical-json-v1.js";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";

import {
  applyFrame,
  classifyFreshness,
  createProjectionSession,
  degradedVisibleState,
  REALM_EVENT_SCHEMA,
  REALM_HELLO_SCHEMA,
  REALM_RESYNC_SCHEMA,
  SEMANTIC_STATES,
} from "./drs-realm-contracts.js";

// The reducer's public ontology is the wire law's — re-exported, never duplicated.
export { SEMANTIC_STATES };

export const DRS_PRESENCE_REDUCER_SCHEMA = "bizra.dema.drs_presence_reducer.v0.1";
export const DRS_PRESENCE_REDUCER_TRUTH_LABEL = "DRS_PRESENCE_REDUCER_MEASURED_REPO";
export const DRS_PRESENCE_REDUCER_GO_PHRASE = "GO: dema realm presence reducer";

export const RENDER_REQUEST_SCHEMA = "bizra.realm.render.v0.1";

const MISSION_LABEL_MAX_SCALARS = 120;

// ICD §61 semantic-state -> skin slot table (complete over the 11 states).
export const SKIN_SEMANTIC_SLOTS = Object.freeze({
  OFFLINE: "Offline",
  IDLE: "Neutral",
  LISTENING: "Listening",
  THINKING: "CognitiveActive",
  WORKING: "WorkActive",
  NEEDS_HUMAN: "HumanAttention",
  VERIFYING: "Verification",
  REFUSED: "Refusal",
  VERIFIED_DONE: "VerifiedCompletion",
  RECOVERY: "Recovery",
  UNKNOWN: "Unknown",
});

// i18n key grammar pinned for P0: consumers resolve keys, kernels never emit prose.
export function accessibleLabelKeyFor(state) {
  return `presence.state.${state}`;
}
export function shortReasonKeyFor(reasonCode) {
  return reasonCode ? `reason.${reasonCode}` : null;
}

export function drsPresenceReducerBoundary() {
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

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Sanitize a mission label for presentation: newlines removed, hard cap at 120
// Unicode scalar values (ICD §6.4 / §7). No other rewriting.
export function sanitizeMissionLabel(label) {
  if (typeof label !== "string") return null;
  const flat = label.replace(/[\r\n\t]+/g, " ").trim();
  if (flat.length === 0) return null;
  return Array.from(flat).slice(0, MISSION_LABEL_MAX_SCALARS).join("");
}

// ---------------------------------------------------------------------------
// Reduction pass: replay accepted frames into a projection timeline
// ---------------------------------------------------------------------------

function reduceTranscript({ transcript, admitted, admission = admitted, peer }) {
  const blocks = [];
  let session = createProjectionSession();
  let last_observed_ms = null;
  let visible_state = "OFFLINE";
  let mission = null;
  let attention_count = 0;
  let reason_codes = [];
  let evidence_refs = [];
  let resources = { cpu_percent: null, gpu_percent: null, ram_percent: null, observed_at: null };
  let last_done_refs = [];
  // Simulation propagation: ANY contributing frame marked payload.simulated or
  // snapshot-level simulated makes the whole derivation simulated (ICD §67 —
  // a simulated completion can never look like production truth).
  let simulated_any = false;

  const frames = Array.isArray(transcript) ? transcript : [];
  frames.forEach((frame, index) => {
    if (session.phase === "CLOSED") {
      blocks.push(`frame_${index}:closed_after:${session.closed_reason}`);
      return;
    }
    let enriched = frame;
    if (isPlainObject(frame) && frame.schema === REALM_HELLO_SCHEMA && (admitted ?? admission)) {
      enriched = { ...frame, __admission__: { hello: frame, peer, admitted: admitted ?? admission } };
    }
    const step = applyFrame(session, enriched);
    session = step.session;
    if (step.close) {
      blocks.push(`frame_${index}:${step.close}`);
      return;
    }
    if (!step.accepted || !isPlainObject(frame)) return;

    if (Number.isInteger(frame.__now_ms__)) last_observed_ms = frame.__now_ms__;
    if (frame.payload?.simulated === true || frame.current_snapshot?.simulated === true) {
      simulated_any = true;
    }
    if (frame.schema === REALM_RESYNC_SCHEMA) {
      const cur = frame.current_snapshot ?? {};
      if (cur.simulated === true) simulated_any = true;
      visible_state = cur.semantic_state ?? visible_state;
      attention_count = cur.attention?.count ?? attention_count;
      reason_codes = Array.isArray(cur.reason_codes) ? cur.reason_codes : [];
      evidence_refs = Array.isArray(cur.evidence_refs) ? cur.evidence_refs : [];
      if (cur.mission) mission = cur.mission;
    } else if (frame.schema === REALM_EVENT_SCHEMA) {
      if (frame.kind === "resources.sampled" || isPlainObject(frame.payload?.resources)) {
        const r = frame.payload?.resources ?? {};
        const pick = (v) =>
          typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100 ? v : null;
        resources = {
          cpu_percent: pick(r.cpu_percent),
          gpu_percent: pick(r.gpu_percent),
          ram_percent: pick(r.ram_percent),
          observed_at: typeof r.observed_at === "string" ? r.observed_at : resources.observed_at,
        };
      }
      if (isPlainObject(frame.payload?.mission)) mission = frame.payload.mission;
      if (isPlainObject(frame.payload?.attention) &&
          Number.isInteger(frame.payload.attention.count)) {
        attention_count = Math.max(attention_count, frame.payload.attention.count);
      }
      if (Array.isArray(frame.reason_codes) && frame.reason_codes.length > 0) {
        reason_codes = frame.reason_codes;
      }
      if (Array.isArray(frame.evidence_refs) && frame.evidence_refs.length > 0) {
        evidence_refs = frame.evidence_refs;
        if (frame.semantic_state === "VERIFIED_DONE") last_done_refs = frame.evidence_refs;
      }
      if (frame.semantic_state !== undefined) visible_state = frame.semantic_state;
    }
  });

  return {
    blocks,
    session,
    visible_state,
    simulated_any,
    mission,
    attention_count,
    reason_codes,
    evidence_refs,
    last_done_refs,
    resources,
    last_observed_ms,
  };
}

// ---------------------------------------------------------------------------
// RenderRequest derivation (IF-02 view; i18n keys, no prose, no secrets)
// ---------------------------------------------------------------------------

export function deriveRenderRequest({ transcript, admitted, admission, peer, now_ms } = {}) {
  // Callers may use either `admitted` (canonical) or `admission`.
  admitted = admitted ?? admission;
  const red = reduceTranscript({ transcript, admitted, peer });
  const age_ms =
    now_ms !== undefined && Number.isFinite(now_ms)
      ? now_ms - (red.last_observed_ms ?? now_ms)
      : 0;
  const freshness = classifyFreshness({
    connected: red.session.freshness_connected,
    age_ms,
  });
  const simulated = red.simulated_any === true;
  const final_state = red.session.phase === "CLOSED"
    ? red.session.visible_state // integrity breach keeps its close-time UNKNOWN
    : degradedVisibleState(red.visible_state, freshness);

  const blocked_by = [...red.blocks];
  if (!SEMANTIC_STATES.includes(final_state)) {
    blocked_by.push("derived_state_outside_ontology");
  }

  const primary_reason = red.reason_codes[0] ?? null;
  const render_request = Object.freeze({
    schema: RENDER_REQUEST_SCHEMA,
    correlation_id: `drs-reducer-${red.session.last_sequence ?? 0}`,
    semantic_state: final_state,
    accessible_label_key: accessibleLabelKeyFor(final_state),
    short_reason_key: shortReasonKeyFor(primary_reason),
    mission_label: sanitizeMissionLabel(red.mission?.label),
    mission_phase: red.mission?.phase ?? null,
    attention_count: final_state === "NEEDS_HUMAN" ? Math.max(1, red.attention_count) : red.attention_count,
    resources: Object.freeze({ ...red.resources }),
    freshness,
    simulated,
    skin_slot: SKIN_SEMANTIC_SLOTS[final_state] ?? "Unknown",
    evidence_refs: final_state === "VERIFIED_DONE"
      ? Object.freeze([...(red.last_done_refs.length > 0 ? red.last_done_refs : red.evidence_refs)])
      : Object.freeze([]),
  });

  // State-specific render invariants (mirror of the wire-law constraints):
  if (final_state === "VERIFIED_DONE" && render_request.evidence_refs.length < 1) {
    blocked_by.push("render_done_without_evidence");
  }
  if (final_state === "WORKING" && !render_request.mission_label && !red.mission?.mission_id) {
    blocked_by.push("render_working_without_mission");
  }

  return Object.freeze({
    ok: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
    render_request,
    walk: Object.freeze({
      final_phase: red.session.phase,
      duplicates_ignored: red.session.duplicates_ignored,
      closed_reason: red.session.closed_reason,
      freshness,
    }),
  });
}

// ---------------------------------------------------------------------------
// Universal slice contract (consent gate, content addressing, verification)
// ---------------------------------------------------------------------------

function validateInputShape(input) {
  const blocked_by = [];
  if (input.transcript !== undefined && !Array.isArray(input.transcript)) {
    blocked_by.push("input_transcript_not_array");
  }
  if (input.admitted !== undefined && !isPlainObject(input.admitted)) {
    blocked_by.push("input_admitted_not_object");
  }
  if (input.peer !== undefined && !isPlainObject(input.peer)) {
    blocked_by.push("input_peer_not_object");
  }
  if (
    input.now_ms !== undefined &&
    (!Number.isFinite(input.now_ms) || input.now_ms < 0)
  ) {
    blocked_by.push("input_now_ms_invalid");
  }
  return blocked_by;
}

export function planDrsPresenceReducer({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== DRS_PRESENCE_REDUCER_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    blocked_by.push("input_not_object");
  } else {
    blocked_by.push(...validateInputShape(input));
  }
  return Object.freeze({
    schema: DRS_PRESENCE_REDUCER_SCHEMA,
    truth_label: DRS_PRESENCE_REDUCER_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

export function buildDrsPresenceReducerPayload(input) {
  const derivation = deriveRenderRequest(input);
  const body = {
    schema: DRS_PRESENCE_REDUCER_SCHEMA,
    truth_label: DRS_PRESENCE_REDUCER_TRUTH_LABEL,
    canonicalization_algorithm: CANONICAL_JSON_V1_ALGORITHM,
    hash_algorithm: "sha256",
    text_encoding: "utf-8",
    input: { ...input, now_ms: input.now_ms ?? null },
    render_request: derivation.render_request,
    ok: derivation.ok,
    blocked_by: derivation.blocked_by,
    boundary: drsPresenceReducerBoundary(),
  };
  const content_hash = sha256CanonicalJsonV1(body);
  return Object.freeze({ ...body, content_hash });
}

export function verifyDrsPresenceReducer(payload) {
  if (!isPlainObject(payload)) {
    return Object.freeze({ ok: false, reason: "payload_not_object" });
  }
  const { content_hash, ...body } = payload;
  if (sha256CanonicalJsonV1(body) !== content_hash) {
    return Object.freeze({ ok: false, reason: "content_hash_mismatch" });
  }
  if (body.schema !== DRS_PRESENCE_REDUCER_SCHEMA) {
    return Object.freeze({ ok: false, reason: "schema_mismatch" });
  }
  if (body.truth_label !== DRS_PRESENCE_REDUCER_TRUTH_LABEL) {
    return Object.freeze({ ok: false, reason: "truth_label_mismatch" });
  }
  const expected = drsPresenceReducerBoundary();
  for (const [key, value] of Object.entries(expected)) {
    if (body.boundary?.[key] !== value) {
      return Object.freeze({ ok: false, reason: `boundary_violation:${key}` });
    }
  }
  if (body.render_request?.schema !== RENDER_REQUEST_SCHEMA) {
    return Object.freeze({ ok: false, reason: "render_schema_mismatch" });
  }
  return Object.freeze({ ok: true, reason: null });
}

export function runDrsPresenceReducer({ consent, input } = {}) {
  const plan = planDrsPresenceReducer({ consent, input });
  if (!plan.eligible) {
    return Object.freeze({
      ok: false,
      schema: DRS_PRESENCE_REDUCER_SCHEMA,
      truth_label: DRS_PRESENCE_REDUCER_TRUTH_LABEL,
      boundary: drsPresenceReducerBoundary(),
      blocked_by: plan.blocked_by,
    });
  }

  const blocked_by = [];
  const payload = buildDrsPresenceReducerPayload(input);
  if (payload.ok === false) blocked_by.push(...payload.blocked_by);

  const verified = verifyDrsPresenceReducer(payload);
  if (!verified.ok) blocked_by.push(`verify_failed:${verified.reason}`);

  // Internal negative control: a tampered copy MUST fail verification. The
  // mutation is unconditional so the probe cannot degenerate into a no-op on
  // an already-clean payload.
  const tampered = { ...payload, truth_label: "TAMPER_PROBE" };
  if (verifyDrsPresenceReducer(tampered).ok) {
    blocked_by.push("tamper_probe_passed");
  }

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: DRS_PRESENCE_REDUCER_SCHEMA,
    truth_label: DRS_PRESENCE_REDUCER_TRUTH_LABEL,
    content_hash: payload.content_hash,
    render_request: payload.render_request,
    boundary: drsPresenceReducerBoundary(),
    blocked_by: Object.freeze(blocked_by),
  });
}
