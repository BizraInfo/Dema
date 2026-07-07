// LOCAL-MODEL-PULSE-BINDING-PREVIEW-1A — Pure preview-only bridge from a local
// model invocation result into the Materialization Pulse evidence lane.
//
// This does NOT invoke a model. It binds an already-produced
// bizra.dema.llm_invocation_result.v0.1 envelope as suggestion-only evidence so
// the Pulse can carry "the mind spoke" without granting action authority.
//
// Law:
//   - LLM output is suggestion, never authority.
//   - Completed local model output is admissible only when response safety is PUBLIC_SAFE.
//   - INVOCATION_BLOCKED / INVOCATION_FAILED may be recorded as evidence of failure,
//     but cannot become public-safe claim text or action permission.
//   - Public network, external calls, mint, wallet, federation, chain advance, and
//     filesystem writes remain false.
//
// Pure kernel: no fs / network / process / clock / random. No model invocation.

import { createHash } from "node:crypto";
import { buildPreviewBoundary } from "./preview-boundary.js";

export const LOCAL_MODEL_PULSE_BINDING_PREVIEW_SCHEMA =
  "bizra.dema.local_model_pulse_binding_preview.v0.1";
export const LOCAL_MODEL_PULSE_BINDING_PREVIEW_TRUTH_LABEL =
  "LOCAL_MODEL_PULSE_BINDING_PREVIEW_MEASURED_REPO";
export const LOCAL_MODEL_PULSE_BINDING_PREVIEW_GO_PHRASE =
  "GO: bind local model suggestion into Pulse preview";

const INVOCATION_SCHEMA = "bizra.dema.llm_invocation_result.v0.1";
const HASH_RE = /^sha256:[0-9a-f]{64}$/;
const SAFE_RESPONSE_VERDICT = "PUBLIC_SAFE";

const STRICTLY_FALSE_RUNTIME_KEYS = Object.freeze([
  "public_network_used",
  "external_call_performed",
  "chain_advance_performed",
  "receipt_mint_performed",
  "federation_invoked",
  "node_connection_performed",
  "raw_corpus_scan_performed",
  "raw_data_included",
  "tool_executed",
  "filesystem_write_performed",
]);

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hashRef(value) {
  return `sha256:${sha256(stableStringify(value))}`;
}

function previewBoundaryAllFalse(boundary) {
  const canonical = buildPreviewBoundary();
  if (!isObject(boundary)) return false;
  const expected = Object.keys(canonical).sort();
  const actual = Object.keys(boundary).sort();
  if (actual.length !== expected.length) return false;
  return expected.every((k, i) => actual[i] === k && boundary[k] === false);
}

function runtimeStrictKeysSafe(boundary) {
  if (!isObject(boundary)) return false;
  return STRICTLY_FALSE_RUNTIME_KEYS.every((key) => boundary[key] === false);
}

function invocationStatusClass(invocation) {
  if (!isObject(invocation)) return "invalid";
  if (invocation.invocation_status === "completed") return "completed";
  if (invocation.invocation_status === "blocked") return "blocked";
  if (invocation.invocation_status === "failed") return "failed";
  return "invalid";
}

export function evaluateLocalModelInvocationForPulse(invocation) {
  const blocked_by = [];
  const inv = isObject(invocation) ? invocation : {};

  if (inv.schema !== INVOCATION_SCHEMA) blocked_by.push("invocation_schema_mismatch");
  if (!isObject(inv.boundary)) blocked_by.push("invocation_boundary_missing");
  else if (!runtimeStrictKeysSafe(inv.boundary)) blocked_by.push("runtime_strict_key_violation");
  if (inv.verdict_role !== "suggestion") blocked_by.push("verdict_role_not_suggestion");

  const status = invocationStatusClass(inv);
  if (status === "invalid") blocked_by.push("invocation_status_invalid");

  const responseSafe = inv.response_safety_verdict === SAFE_RESPONSE_VERDICT;
  const promptSafe = inv.prompt_safety_verdict === SAFE_RESPONSE_VERDICT;

  const suggestion_admissible =
    blocked_by.length === 0 && status === "completed" && responseSafe && promptSafe;

  const failure_recordable =
    blocked_by.length === 0 && (status === "blocked" || status === "failed");

  if (status === "completed" && !promptSafe) blocked_by.push("prompt_not_public_safe");
  if (status === "completed" && !responseSafe) blocked_by.push("response_not_public_safe");

  return Object.freeze({
    ok: suggestion_admissible || failure_recordable,
    suggestion_admissible,
    failure_recordable,
    status,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
  });
}

export function planLocalModelPulseBindingPreview({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== LOCAL_MODEL_PULSE_BINDING_PREVIEW_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  if (!isObject(input)) blocked_by.push("input_not_object");
  else {
    if (!isObject(input.invocation_result)) blocked_by.push("invocation_result_missing");
    if (typeof input.mission_id !== "string" || input.mission_id.length === 0) {
      blocked_by.push("mission_id_missing");
    }
    if (!(input.pulse_receipt_ref === null || HASH_RE.test(input.pulse_receipt_ref))) {
      blocked_by.push("pulse_receipt_ref_malformed");
    }
  }
  return Object.freeze({
    schema: LOCAL_MODEL_PULSE_BINDING_PREVIEW_SCHEMA,
    truth_label: LOCAL_MODEL_PULSE_BINDING_PREVIEW_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

export function buildLocalModelPulseBindingPreviewPayload(input = {}) {
  const invocation = isObject(input.invocation_result) ? input.invocation_result : {};
  const evaluation = evaluateLocalModelInvocationForPulse(invocation);
  const responsePreview =
    typeof invocation.response_text_preview === "string" ? invocation.response_text_preview : null;

  const body = {
    schema: LOCAL_MODEL_PULSE_BINDING_PREVIEW_SCHEMA,
    truth_label: LOCAL_MODEL_PULSE_BINDING_PREVIEW_TRUTH_LABEL,
    mode: "preview_only",
    mission_id: typeof input.mission_id === "string" ? input.mission_id : null,
    pulse_receipt_ref: input.pulse_receipt_ref ?? null,
    source_invocation_ref: hashRef(invocation),
    source_schema: invocation.schema ?? null,
    source_truth_label: invocation.truth_label ?? null,
    invocation_status: invocation.invocation_status ?? null,
    model_invoked: invocation.model_invoked ?? null,
    verdict_role: "suggestion",
    suggestion_admissible: evaluation.suggestion_admissible,
    failure_recordable: evaluation.failure_recordable,
    public_claim_safe: false,
    action_allowed: false,
    authority_delta: 0,
    grants_action: false,
    mint_allowed: false,
    wallet_used: false,
    federation_live: false,
    prompt_safety_verdict: invocation.prompt_safety_verdict ?? null,
    response_safety_verdict: invocation.response_safety_verdict ?? null,
    response_preview_ref: responsePreview === null ? null : hashRef(responsePreview),
    response_text_preview: responsePreview,
    evaluation_blocked_by: evaluation.blocked_by,
    boundary: buildPreviewBoundary(),
    what_this_proves:
      "A local-model invocation result envelope was bound into the Pulse evidence lane as suggestion-only preview data, without granting action authority.",
    what_this_does_not_prove:
      "It does not invoke a model, verify semantic truth, authorize execution, make a public claim, mint, use a wallet, federate, or prove live URP.",
  };
  return Object.freeze({ ...body, content_hash: hashRef(body) });
}

export function verifyLocalModelPulseBindingPreview(payload) {
  if (!isObject(payload)) return Object.freeze({ ok: false, blocked_by: Object.freeze(["payload_not_object"]) });
  const blocked_by = [];
  const { content_hash, ...body } = payload;
  if (content_hash !== hashRef(body)) blocked_by.push("content_hash_mismatch");
  if (payload.schema !== LOCAL_MODEL_PULSE_BINDING_PREVIEW_SCHEMA) blocked_by.push("schema_mismatch");
  if (payload.truth_label !== LOCAL_MODEL_PULSE_BINDING_PREVIEW_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");
  if (payload.mode !== "preview_only") blocked_by.push("mode_not_preview_only");
  if (typeof payload.mission_id !== "string" || payload.mission_id.length === 0) blocked_by.push("mission_id_missing");
  if (!(payload.pulse_receipt_ref === null || HASH_RE.test(payload.pulse_receipt_ref))) blocked_by.push("pulse_receipt_ref_malformed");
  if (!HASH_RE.test(payload.source_invocation_ref)) blocked_by.push("source_invocation_ref_malformed");
  if (payload.source_schema !== INVOCATION_SCHEMA) blocked_by.push("source_schema_mismatch");
  if (payload.verdict_role !== "suggestion") blocked_by.push("verdict_role_not_suggestion");
  if (payload.public_claim_safe !== false) blocked_by.push("public_claim_safe_true");
  if (payload.action_allowed !== false) blocked_by.push("action_allowed_true");
  if (payload.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
  if (payload.grants_action !== false) blocked_by.push("grants_action_true");
  if (payload.mint_allowed !== false) blocked_by.push("mint_allowed_true");
  if (payload.wallet_used !== false) blocked_by.push("wallet_used_true");
  if (payload.federation_live !== false) blocked_by.push("federation_live_true");
  if (!previewBoundaryAllFalse(payload.boundary)) blocked_by.push("boundary_not_all_false");
  if (payload.suggestion_admissible === true && payload.failure_recordable === true) {
    blocked_by.push("admissible_and_failure_both_true");
  }
  if (payload.suggestion_admissible !== true && payload.failure_recordable !== true) {
    blocked_by.push("neither_admissible_nor_recordable");
  }
  if (payload.suggestion_admissible === true) {
    if (payload.invocation_status !== "completed") blocked_by.push("admissible_status_not_completed");
    if (payload.prompt_safety_verdict !== SAFE_RESPONSE_VERDICT) blocked_by.push("admissible_prompt_not_public_safe");
    if (payload.response_safety_verdict !== SAFE_RESPONSE_VERDICT) blocked_by.push("admissible_response_not_public_safe");
  }
  if (!Array.isArray(payload.evaluation_blocked_by)) blocked_by.push("evaluation_blocked_by_not_array");
  else if (payload.suggestion_admissible === true && payload.evaluation_blocked_by.length !== 0) {
    blocked_by.push("admissible_with_blocks");
  }
  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: LOCAL_MODEL_PULSE_BINDING_PREVIEW_SCHEMA,
    truth_label: LOCAL_MODEL_PULSE_BINDING_PREVIEW_TRUTH_LABEL,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
    content_hash: typeof content_hash === "string" ? content_hash : null,
  });
}

export function runLocalModelPulseBindingPreview({ consent, input } = {}) {
  const boundary = buildPreviewBoundary();
  const refuse = (codes) =>
    Object.freeze({
      ok: false,
      schema: LOCAL_MODEL_PULSE_BINDING_PREVIEW_SCHEMA,
      truth_label: LOCAL_MODEL_PULSE_BINDING_PREVIEW_TRUTH_LABEL,
      status: "blocked",
      blocked_by: Object.freeze([...codes]),
      authority_delta: 0,
      boundary,
    });

  const plan = planLocalModelPulseBindingPreview({ consent, input });
  if (!plan.eligible) return refuse(plan.blocked_by);

  const payload = buildLocalModelPulseBindingPreviewPayload(input);
  const verified = verifyLocalModelPulseBindingPreview(payload);
  if (!verified.ok) return refuse(verified.blocked_by);

  const tamperedHash = verifyLocalModelPulseBindingPreview({ ...payload, content_hash: `sha256:${"0".repeat(64)}` });
  const forgedAuthorityBody = { ...payload, authority_delta: 1 };
  const { content_hash: _drop1, ...withoutHash1 } = forgedAuthorityBody;
  const forgedAuthority = verifyLocalModelPulseBindingPreview({ ...withoutHash1, content_hash: hashRef(withoutHash1) });
  const forgedClaimBody = { ...payload, public_claim_safe: true };
  const { content_hash: _drop2, ...withoutHash2 } = forgedClaimBody;
  const forgedClaim = verifyLocalModelPulseBindingPreview({ ...withoutHash2, content_hash: hashRef(withoutHash2) });
  if (tamperedHash.ok || forgedAuthority.ok || forgedClaim.ok) return refuse(["tamper_probe_not_rejected"]);

  return Object.freeze({
    ok: true,
    schema: LOCAL_MODEL_PULSE_BINDING_PREVIEW_SCHEMA,
    truth_label: LOCAL_MODEL_PULSE_BINDING_PREVIEW_TRUTH_LABEL,
    status: "local_model_suggestion_bound",
    suggestion_admissible: payload.suggestion_admissible,
    failure_recordable: payload.failure_recordable,
    content_hash: payload.content_hash,
    source_invocation_ref: payload.source_invocation_ref,
    action_allowed: false,
    authority_delta: 0,
    grants_action: false,
    mint_allowed: false,
    wallet_used: false,
    federation_live: false,
    boundary: payload.boundary,
    blocked_by: Object.freeze([]),
  });
}

export function exampleCompletedInvocationResult() {
  const boundary = {
    runtime_execution_performed: true,
    model_loaded: true,
    model_invocation_performed: true,
    prompt_executed: true,
    network_used: true,
    consent_collected: true,
    content_read: false,
    public_network_used: false,
    external_call_performed: false,
    chain_advance_performed: false,
    receipt_mint_performed: false,
    federation_invoked: false,
    node_connection_performed: false,
    raw_corpus_scan_performed: false,
    raw_data_included: false,
    tool_executed: false,
    filesystem_write_performed: false,
  };
  return Object.freeze({
    schema: INVOCATION_SCHEMA,
    truth_label: "MEASURED",
    invocation_status: "completed",
    model_invoked: "llama3.2:3b",
    response_text_preview: "Candidate answer only; verifier remains authority.",
    prompt_safety_verdict: "PUBLIC_SAFE",
    response_safety_verdict: "PUBLIC_SAFE",
    verdict_role: "suggestion",
    boundary: Object.freeze(boundary),
  });
}

export function exampleBlockedInvocationResult() {
  return Object.freeze({
    ...exampleCompletedInvocationResult(),
    truth_label: "INVOCATION_BLOCKED",
    invocation_status: "blocked",
    response_text_preview: null,
    prompt_safety_verdict: "FORBIDDEN_LIVE_CLAIM",
    response_safety_verdict: null,
  });
}
