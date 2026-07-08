// Example llm_invocation_result fixtures for LOCAL-MODEL-PULSE-BINDING-PREVIEW-1A.
//
// These live OUTSIDE packages/*/src/*-preview.js on purpose: they represent an EXTERNAL INPUT — a real
// completed local-model invocation, which legitimately DID load a model + use the localhost network —
// so their boundary carries authority-flag-named keys set to `true`. That is INPUT data describing what
// the adapter did, NOT the binding kernel claiming authority. The boundary-invariant-check (which walks
// preview kernels for `<authority-flag>: true`) must not see these; hence they live here.
import { INVOCATION_SOURCE_SCHEMA } from "../../packages/core/src/local-model-pulse-binding-preview.js";

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
    schema: INVOCATION_SOURCE_SCHEMA,
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
