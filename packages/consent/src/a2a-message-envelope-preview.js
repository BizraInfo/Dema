// Operating canon (per docs/02-architecture/dema-a2a-message-envelope-v0.1.md):
//   Agents may exchange messages.
//   Agents may not exchange authority.
//   The envelope records intent.
//   The envelope does not dispatch.

export const A2A_MESSAGE_ENVELOPE_PREVIEW_SCHEMA =
  "bizra.dema.a2a_message_envelope_preview.v0.1";

export const A2A_MESSAGE_TYPES = Object.freeze([
  "verification_request",
  "status_query",
  "evidence_share",
  "consent_review_request",
]);

const ALLOWED_EFFECT_LEVELS = Object.freeze(["read"]);

function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function isStringArray(value) {
  if (!Array.isArray(value)) return false;
  for (const item of value) {
    if (typeof item !== "string") return false;
  }
  return true;
}

function isReadOnlyEffectSubset(value) {
  if (!Array.isArray(value)) return false;
  for (const item of value) {
    if (!ALLOWED_EFFECT_LEVELS.includes(item)) return false;
  }
  return true;
}

export function buildA2aMessageEnvelopePreview({
  from,
  to,
  mission_id,
  message_type,
  effect_level,
  claims,
  now,
} = {}) {
  if (!nonEmptyString(from)) {
    return failEnvelope("invalid_from", "from must be a non-empty string");
  }
  if (!nonEmptyString(to)) {
    return failEnvelope("invalid_to", "to must be a non-empty string");
  }
  if (from === to) {
    return failEnvelope(
      "self_addressed",
      "from and to must differ; agents may not send A2A messages to themselves",
    );
  }
  if (!nonEmptyString(mission_id)) {
    return failEnvelope(
      "invalid_mission_id",
      "mission_id must be a non-empty string",
    );
  }
  if (!A2A_MESSAGE_TYPES.includes(message_type)) {
    return failEnvelope(
      "invalid_message_type",
      `message_type must be one of ${A2A_MESSAGE_TYPES.join(", ")}`,
    );
  }
  if (!isReadOnlyEffectSubset(effect_level)) {
    return failEnvelope(
      "invalid_effect_level",
      'effect_level must be an array subset of ["read"] in v0.1 (write/execute/call are rejected on inter-agent messages)',
    );
  }
  if (!isStringArray(claims)) {
    return failEnvelope(
      "invalid_claims",
      "claims must be an array of strings (may be empty)",
    );
  }
  if (!isValidDate(now)) {
    return failEnvelope("invalid_now", "now must be a valid Date");
  }

  return deepFreeze(
    clone({
      schema: A2A_MESSAGE_ENVELOPE_PREVIEW_SCHEMA,
      mode: "PREVIEW_ONLY",
      truth_label: "DECLARED",
      valid: true,
      from,
      to,
      mission_id,
      message_type,
      effect_level: [...effect_level],
      claims: [...claims],
      authority_transfer: false,
      dispatched: false,
      generated_at: now.toISOString(),
      boundary: {
        runtime: false,
        federation: false,
        mint: false,
        a2a_network_call_made: false,
        network_used: false,
        authority_transferred: false,
        cross_node_handoff_executed: false,
      },
      note: "Envelope is RECORDED, not DISPATCHED. No network channel is opened, no authority is transferred.",
    }),
  );
}

function failEnvelope(code, detail) {
  return deepFreeze(
    clone({
      schema: A2A_MESSAGE_ENVELOPE_PREVIEW_SCHEMA,
      mode: "PREVIEW_ONLY",
      truth_label: "DECLARED",
      valid: false,
      denial: { code, detail },
      authority_transfer: false,
      dispatched: false,
      boundary: {
        runtime: false,
        federation: false,
        mint: false,
        a2a_network_call_made: false,
        network_used: false,
        authority_transferred: false,
        cross_node_handoff_executed: false,
      },
    }),
  );
}

// Reference the canonical allowed set so future readers see the v0.1 surface;
// this is a private constant, not part of the public API.
void ALLOWED_EFFECT_LEVELS;
