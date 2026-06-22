// LOCAL-TALK-RUNTIME-RECEIPT-1A — PURE runtime-receipt kernel.
//
// Turns an invokeDemaTalkLive result into a local evidence receipt: WHAT
// happened (provider, model, endpoint, status, duration, sizes, safety verdicts,
// a HASH of the consent phrase, the runtime boundary, "no task executed") —
// never the raw prompt or raw response. Privacy by construction: the kernel is
// not even given the raw prompt (it reads prompt_length_chars off the result),
// and it copies only metadata fields, never response_text_preview.
//
// Pure: node:crypto's createHash is the only effect surface (purity-allowed,
// same as artifact-safety-eval / pat-receipt-recorder). recorded_at is PASSED IN
// (caller supplies the ISO timestamp) so the receipt is deterministic and the
// kernel stays clock-free and testable.

import { createHash } from "node:crypto";

export const TALK_RUNTIME_RECEIPT_SCHEMA = "bizra.dema.talk_runtime_receipt.v0.1";

const TRUTH_LABEL = "DEMA_TALK_RUNTIME_RECEIPT_LOCAL_ONLY";

function sha256Hex(input) {
  return createHash("sha256").update(String(input)).digest("hex");
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function numOrNull(v) {
  return typeof v === "number" ? v : null;
}

// Canonical, key-sorted serialization so receipt_id is reproducible by any
// independent verifier (not tied to V8 insertion order).
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

// The model call's legitimate runtime effects — the runtime-emission PERMISSIVE
// keys only. We deliberately do NOT carry filesystem_write_performed or
// receipt_mint_performed: a PERSISTED receipt IS a write and a mint, so asserting
// them false from inside the written file would be dishonest (the very
// status-asserted-not-derived trap this project refuses).
const CALL_EFFECT_KEYS = Object.freeze([
  "model_invocation_performed",
  "model_loaded",
  "prompt_executed",
  "network_used",
  "runtime_execution_performed",
  "consent_collected",
]);

export function buildTalkRuntimeReceipt({
  result = {},
  consentPhrase = "",
  recordedAtIso = null,
} = {}) {
  const callBoundary =
    result.boundary && typeof result.boundary === "object" ? result.boundary : {};
  const invocationEffects = {};
  for (const k of CALL_EFFECT_KEYS) invocationEffects[k] = callBoundary[k] === true;

  // METADATA ONLY — explicitly enumerate the fields copied; never response text.
  const body = {
    schema: TALK_RUNTIME_RECEIPT_SCHEMA,
    truth_label: TRUTH_LABEL,
    recorded_at: typeof recordedAtIso === "string" ? recordedAtIso : null,
    provider: result.provider ?? null,
    model: result.model ?? null,
    endpoint_family: result.endpoint_family ?? null,
    invocation_status: result.invocation_status ?? null,
    duration_ms: numOrNull(result.duration_ms),
    prompt_length_chars: numOrNull(result.prompt_length_chars),
    response_length_chars: numOrNull(result.response_length_chars),
    prompt_safety_verdict: result.prompt_safety_verdict ?? null,
    response_safety_verdict: result.response_safety_verdict ?? null,
    // The consent phrase is HASHED, never stored raw.
    consent_phrase_sha256:
      typeof consentPhrase === "string" && consentPhrase.length > 0
        ? sha256Hex(consentPhrase)
        : null,
    consent_phrase_verified: result.consent_phrase_verified === true,
    verdict_role: result.verdict_role ?? null,
    // Standing guarantees about ANY talk call — honest and persistence-
    // independent: the model call is suggestion-only and never crosses these.
    no_task_executed: true,
    no_runtime_autonomy: true,
    no_token_poi_or_federation: true,
    // The model call's legitimate runtime effects (NOT this receipt's act).
    invocation_effects: invocationEffects,
    note: "Records a live talk invocation (metadata only — no raw prompt/response; consent phrase hashed). invocation_effects are the MODEL CALL's effects, suggestion-only. This receipt file is itself a filesystem write you opted into with --receipt, so it makes NO claim that no file was written.",
  };

  // Content-address the receipt by the SHA-256 of its CANONICAL (key-sorted) body.
  const receipt_id = sha256Hex(canonicalJson(body));

  return deepFreeze({ ...body, receipt_id });
}
