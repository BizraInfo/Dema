// Routed LLM Invocation Bridge — v0.1.
//
// Thin bridge between `dema model-broker route` (PR #79-#83) and the existing
// LLM adapter (packages/core/src/llm-adapter.js). Takes a route receipt + a
// prompt + an exact invoke-consent phrase and invokes the broker-selected
// local Ollama model. Reuses ALL adapter safety gates (localhost-only,
// model whitelist, prompt length, exact consent) — does NOT duplicate them.
//
// Operating-law ordering enforced upstream by the CLI:
//   route → save route receipt → invoke local model → emit envelope
//
// This module does NOT:
//   - duplicate adapter safety logic (adapter is source of truth)
//   - call remote endpoints (adapter enforces localhost)
//   - mutate the route receipt (read-only)
//   - mint canonical chain-bound receipts (preview only)
//   - run autonomously (synchronous bridge; caller drives)
//
// Canon refs: CLAIM_REGISTER · LAW_OF_ASSUMPTION · HARNESS_AND_SKILL_DNA ·
// COMPONENT_DNA · ADR-005 (explicit consent) · ADR-008 §C1 (LLM adapter).

import { invokeLocalLLM } from "./llm-adapter.js";

export const ROUTED_LLM_INVOCATION_RESULT_SCHEMA =
  "bizra.dema.local_model_routed_invocation_result.v0.1";

// Adapter error_reason prefixes that indicate the failure occurred BEFORE the
// HTTP fetch was attempted. If error_reason starts with any of these, no
// network call was made.
const PRE_FETCH_FAILURE_PREFIXES = Object.freeze([
  "endpoint_not_localhost",
  "model_not_in_whitelist",
  "prompt_empty",
  "prompt_too_long",
  "consent_phrase_mismatch",
  "fetch_not_available",
]);

function inferNetworkUsed(adapterResult) {
  // Pre-condition gate failed before bridge called the adapter (selected_model_id null)
  // → no adapter call → no network.
  if (!adapterResult) return false;
  if (adapterResult.invocation_status === "completed") return true;
  const reason =
    typeof adapterResult.error_reason === "string"
      ? adapterResult.error_reason
      : "";
  if (reason.length === 0) return false;
  // If error_reason matches any pre-fetch failure prefix, no network was used.
  for (const prefix of PRE_FETCH_FAILURE_PREFIXES) {
    if (reason.startsWith(prefix)) return false;
  }
  // Otherwise the failure occurred during/after fetch → network was used.
  return true;
}

function buildBoundary({ adapterResult, attemptedAdapterCall }) {
  // boundary reflects what HAPPENED, not what was intended. runtime is true
  // because the bridge code itself executed. model_invocation is true only
  // when the adapter reports a completed result. network_used is inferred
  // per the rules above. The remaining flags are statically false at v0.1.
  return Object.freeze({
    runtime: true,
    model_invocation:
      attemptedAdapterCall && adapterResult?.invocation_status === "completed",
    network_used: attemptedAdapterCall && inferNetworkUsed(adapterResult),
    localhost_only: true,
    remote_provider: false,
    federation: false,
    mint: false,
    token_economy: false,
    urp_networking: false,
  });
}

// invokeRoutedLocalModel: bridge from a route receipt to a routed local
// model invocation via the existing LLM adapter.
//
// Pre-conditions enforced by this bridge:
//   - routeReceipt.selected_model_id must be a non-empty string. If null,
//     the bridge short-circuits with "no_selected_model" — adapter is NOT
//     called.
//
// Safety enforced by the adapter (this bridge passes through):
//   - localhost-only endpoint
//   - model name in allowed whitelist (family[:tag] regex)
//   - prompt length bounded
//   - exact consent-phrase match (per ADR-005)
//   - timeout via AbortController
//
// Returns a frozen envelope:
//   {
//     schema: "bizra.dema.local_model_routed_invocation_result.v0.1",
//     route_receipt: <unchanged>,
//     selected_model_id: <string | null>,
//     invocation_result: <adapter result OR null when short-circuited>,
//     boundary: { runtime, model_invocation, network_used, localhost_only,
//                 remote_provider, federation, mint, token_economy,
//                 urp_networking },
//     warnings: [...]
//   }
export async function invokeRoutedLocalModel({
  routeReceipt = null,
  prompt = "",
  invokeConsent = "",
  timeoutMs,
  fetchImpl,
} = {}) {
  const selectedModelId =
    routeReceipt &&
    typeof routeReceipt.selected_model_id === "string" &&
    routeReceipt.selected_model_id.length > 0
      ? routeReceipt.selected_model_id
      : null;

  if (selectedModelId === null) {
    return Object.freeze({
      schema: ROUTED_LLM_INVOCATION_RESULT_SCHEMA,
      route_receipt: routeReceipt,
      selected_model_id: null,
      invocation_result: null,
      boundary: buildBoundary({
        adapterResult: null,
        attemptedAdapterCall: false,
      }),
      warnings: Object.freeze([
        "no_selected_model_pre_invocation: route did not select any model; nothing to invoke",
      ]),
    });
  }

  // Adapter is the source of truth for all safety gates. Pass the params
  // through verbatim; capture the result.
  const adapterCallArgs = {
    model: selectedModelId,
    prompt,
    consentPhrase: invokeConsent,
  };
  if (typeof timeoutMs === "number" && timeoutMs > 0)
    adapterCallArgs.timeoutMs = timeoutMs;
  if (typeof fetchImpl === "function") adapterCallArgs.fetchImpl = fetchImpl;

  const adapterResult = await invokeLocalLLM(adapterCallArgs);

  const warnings = [];
  if (adapterResult?.invocation_status === "failed") {
    warnings.push(`adapter_failed: ${adapterResult.error_reason ?? "unknown"}`);
  }

  return Object.freeze({
    schema: ROUTED_LLM_INVOCATION_RESULT_SCHEMA,
    route_receipt: routeReceipt,
    selected_model_id: selectedModelId,
    invocation_result: adapterResult,
    boundary: buildBoundary({ adapterResult, attemptedAdapterCall: true }),
    warnings: Object.freeze(warnings),
  });
}
