// SOVEREIGN-VOICE-TURN-PREVIEW-1A
//
// Pure preview-only voice-turn receipt. It binds caller-supplied transcript text to an already
// measured Materialization Pulse E2E result and a deterministic spoken-response plan.
//
// Core law: The mouth may speak only what the Pulse has bounded. Voice is expression, not authority.
//
// Pure kernel: node:crypto only. No fs, network, model, microphone, STT, TTS, audio, clock, random,
// wallet, mint, federation, or real-world action.

import { createHash } from "node:crypto";

export const SOVEREIGN_VOICE_TURN_PREVIEW_SCHEMA =
  "bizra.dema.sovereign_voice_turn_preview.v0.1";
export const SOVEREIGN_VOICE_TURN_PREVIEW_TRUTH_LABEL =
  "SOVEREIGN_VOICE_TURN_PREVIEW_MEASURED_REPO";
export const SOVEREIGN_VOICE_TURN_PREVIEW_GO_PHRASE =
  "GO: bind sovereign voice turn preview";

const PULSE_E2E_SCHEMA = "bizra.dema.node0_materialization_pulse_e2e_preview.v0.1";
const TRANSCRIPT_SOURCES = Object.freeze([
  "caller_supplied_text",
  "local_transcript_file",
  "test_fixture",
]);
const BOUNDARY_KEYS = Object.freeze([
  "filesystem_write_performed",
  "network_used",
  "runtime_execution_performed",
  "model_loaded",
  "model_invocation_performed",
  "prompt_executed",
  "external_call_performed",
  "raw_corpus_scan_performed",
  "raw_data_included",
  "tool_executed",
  "chain_advance_performed",
  "receipt_mint_performed",
  "federation_invoked",
  "node_connection_performed",
  "public_network_used",
  "consent_collected",
  "content_read",
]);

function freezeDeep(value) {
  if (!value || typeof value !== "object") return value;
  for (const child of Object.values(value)) freezeDeep(child);
  if (!Object.isFrozen(value)) Object.freeze(value);
  return value;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hashText(value) {
  return `sha256:${sha256(String(value))}`;
}

function hashBody(body) {
  return `sha256:${sha256(stableStringify(body))}`;
}

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function looksLikeSha(value) {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
}

export function sovereignVoiceTurnPreviewBoundary() {
  return freezeDeep(Object.fromEntries(BOUNDARY_KEYS.map((key) => [key, false])));
}

function boundaryAllFalse(boundary) {
  if (!isObject(boundary)) return false;
  const actual = Object.keys(boundary).sort();
  const expected = [...BOUNDARY_KEYS].sort();
  if (actual.length !== expected.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (actual[i] !== expected[i]) return false;
    if (boundary[expected[i]] !== false) return false;
  }
  return true;
}

function pulseBlockedReasons(pulseResult) {
  const blocked = [];
  if (!isObject(pulseResult)) return ["pulse_result_required"];
  if (pulseResult.schema !== PULSE_E2E_SCHEMA) blocked.push("pulse_result_schema_mismatch");
  if (pulseResult.ok !== true) blocked.push("pulse_result_not_ok");
  if (!["sealed", "aborted"].includes(pulseResult.pulse_status)) {
    blocked.push("pulse_status_invalid");
  }
  if (!looksLikeSha(pulseResult.content_hash)) blocked.push("pulse_result_hash_missing");
  return blocked;
}

function sealedResponseRefusalOnly(text) {
  const lower = String(text).toLowerCase();
  const hasRefusal = /\b(refusal|refused|blocked|aborted|cannot|can't|denied|not allowed)\b/.test(lower);
  const hasSealedStatus = /\b(sealed|bounded|preview|ready|passed|complete|completed)\b/.test(lower);
  return hasRefusal && !hasSealedStatus;
}

function abortedResponseIsBounded(text) {
  const lower = String(text).toLowerCase();
  return /\b(refusal|refused|blocked|aborted|cannot|halted|stopped|not allowed)\b/.test(lower);
}

function abortedResponseClaimsCompletion(text) {
  const lower = String(text).toLowerCase();
  if (/\b(completed|sealed|succeeded|successfully|carried out)\b/.test(lower)) return true;
  if (/\bexecuted\b/.test(lower) && !/\b(no|not)\b[^.]{0,40}\bexecuted\b/.test(lower)) return true;
  return false;
}

export function planSovereignVoiceTurnPreview({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== SOVEREIGN_VOICE_TURN_PREVIEW_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  if (!isObject(input)) {
    blocked_by.push("input_required");
  } else {
    if (!isNonEmptyString(input.transcript_text)) blocked_by.push("transcript_text_required");
    if (!TRANSCRIPT_SOURCES.includes(input.transcript_source)) {
      blocked_by.push("transcript_source_invalid");
    }
    blocked_by.push(...pulseBlockedReasons(input.pulse_result));
  }
  return freezeDeep({
    schema: SOVEREIGN_VOICE_TURN_PREVIEW_SCHEMA,
    truth_label: SOVEREIGN_VOICE_TURN_PREVIEW_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by,
  });
}

export function buildSovereignVoiceTurnPreviewPayload(input = {}) {
  const pulse = isObject(input.pulse_result) ? input.pulse_result : {};
  const transcript = typeof input.transcript_text === "string" ? input.transcript_text : "";
  const spoken = typeof input.spoken_response_text === "string" ? input.spoken_response_text : "";
  const body = {
    schema: SOVEREIGN_VOICE_TURN_PREVIEW_SCHEMA,
    truth_label: SOVEREIGN_VOICE_TURN_PREVIEW_TRUTH_LABEL,
    mode: "preview_only",
    session_id: typeof input.session_id === "string" ? input.session_id : null,
    turn_id: typeof input.turn_id === "string" ? input.turn_id : null,
    transcript_hash: hashText(transcript),
    transcript_source: input.transcript_source ?? null,
    pulse_result_hash: looksLikeSha(pulse.content_hash) ? pulse.content_hash : hashBody(pulse),
    pulse_status: pulse.pulse_status ?? null,
    reached_station: Number.isInteger(pulse.reached_station) ? pulse.reached_station : null,
    station_count: Number.isInteger(pulse.station_count) ? pulse.station_count : null,
    claims_public_safe: pulse.claims_public_safe === true,
    spoken_response_text: spoken,
    spoken_response_hash: hashText(spoken),
    voice_profile: isObject(input.voice_profile)
      ? input.voice_profile
      : { id: "dema-sovereign-preview", mode: "planned_only" },
    tts_engine_plan: isObject(input.tts_engine_plan)
      ? input.tts_engine_plan
      : { engine: "planned_only", invocation: false, audio_output: false },
    tts_invoked: false,
    audio_generated: false,
    audio_played: false,
    microphone_used: false,
    stt_invoked: false,
    model_invocation_performed: false,
    network_used: false,
    action_allowed: false,
    authority_delta: 0,
    grants_action: false,
    mint_allowed: false,
    wallet_used: false,
    federation_live: false,
    boundary: sovereignVoiceTurnPreviewBoundary(),
    what_this_proves: [
      "Caller-supplied transcript text was content-bound to a Materialization Pulse E2E preview result.",
      "The spoken-response text is a deterministic plan constrained by the pulse status.",
      "The voice turn grants no action, authority, mint, wallet, federation, model, network, microphone, STT, TTS, or audio effect.",
    ],
    what_this_does_not_prove: [
      "This is not live voice recognition, live speech synthesis, generated audio, audio playback, model output, or real-world action.",
      "A sealed voice turn means expression is bounded by the preview Pulse; it is not permission to execute.",
    ],
  };
  return freezeDeep({ ...body, content_hash: hashBody(body) });
}

export function verifySovereignVoiceTurnPreview(payload) {
  if (!isObject(payload)) {
    return freezeDeep({ ok: false, blocked_by: ["payload_not_object"] });
  }
  const blocked_by = [];
  const { content_hash, ...body } = payload;
  if (content_hash !== hashBody(body)) blocked_by.push("content_hash_mismatch");
  if (payload.schema !== SOVEREIGN_VOICE_TURN_PREVIEW_SCHEMA) blocked_by.push("schema_mismatch");
  if (payload.truth_label !== SOVEREIGN_VOICE_TURN_PREVIEW_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");
  if (payload.mode !== "preview_only") blocked_by.push("mode_not_preview_only");
  if (!isNonEmptyString(payload.session_id)) blocked_by.push("session_id_required");
  if (!isNonEmptyString(payload.turn_id)) blocked_by.push("turn_id_required");
  if (!looksLikeSha(payload.transcript_hash)) blocked_by.push("transcript_hash_required");
  if (!looksLikeSha(payload.pulse_result_hash)) blocked_by.push("pulse_result_hash_required");
  if (!["sealed", "aborted"].includes(payload.pulse_status)) blocked_by.push("pulse_status_invalid");
  if (!isNonEmptyString(payload.spoken_response_text)) blocked_by.push("spoken_response_text_required");
  if (!looksLikeSha(payload.spoken_response_hash)) blocked_by.push("spoken_response_hash_required");

  for (const [field, code] of [
    ["tts_invoked", "tts_invoked_true"],
    ["audio_generated", "audio_generated_true"],
    ["audio_played", "audio_played_true"],
    ["microphone_used", "microphone_used_true"],
    ["stt_invoked", "stt_invoked_true"],
    ["model_invocation_performed", "model_invocation_performed_true"],
    ["network_used", "network_used_true"],
    ["action_allowed", "action_allowed_true"],
    ["grants_action", "grants_action_true"],
    ["mint_allowed", "mint_allowed_true"],
    ["wallet_used", "wallet_used_true"],
    ["federation_live", "federation_live_true"],
  ]) {
    if (payload[field] !== false) blocked_by.push(code);
  }
  if (payload.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
  if (!boundaryAllFalse(payload.boundary)) blocked_by.push("boundary_not_all_false");
  if (payload.pulse_status === "sealed" && sealedResponseRefusalOnly(payload.spoken_response_text)) {
    blocked_by.push("sealed_response_refusal_only");
  }
  if (payload.pulse_status === "aborted") {
    if (!abortedResponseIsBounded(payload.spoken_response_text)) {
      blocked_by.push("aborted_response_not_refusal");
    }
    if (abortedResponseClaimsCompletion(payload.spoken_response_text)) {
      blocked_by.push("aborted_response_claims_completion");
    }
  }
  return freezeDeep({
    ok: blocked_by.length === 0,
    schema: SOVEREIGN_VOICE_TURN_PREVIEW_SCHEMA,
    truth_label: SOVEREIGN_VOICE_TURN_PREVIEW_TRUTH_LABEL,
    pulse_status: payload.pulse_status,
    blocked_by: [...new Set(blocked_by)],
  });
}

export function runSovereignVoiceTurnPreview({ consent, input } = {}) {
  const plan = planSovereignVoiceTurnPreview({ consent, input });
  if (!plan.eligible) {
    return freezeDeep({
      ok: false,
      schema: SOVEREIGN_VOICE_TURN_PREVIEW_SCHEMA,
      truth_label: SOVEREIGN_VOICE_TURN_PREVIEW_TRUTH_LABEL,
      status: "blocked_pending_consent_or_input",
      boundary: sovereignVoiceTurnPreviewBoundary(),
      authority_delta: 0,
      mint_allowed: false,
      blocked_by: plan.blocked_by,
    });
  }
  const payload = buildSovereignVoiceTurnPreviewPayload(input);
  const verified = verifySovereignVoiceTurnPreview(payload);
  return freezeDeep({
    ok: verified.ok,
    status: verified.ok ? "voice_turn_preview_complete" : "voice_turn_preview_broken",
    ...payload,
    blocked_by: verified.blocked_by,
  });
}
