// DEMA-TALK-LOOP-1A — PURE talk-consent-preview kernel (provider-routed).
//
// Wraps the provider router + the hardened llm-adapter PREVIEW path into a
// friendly talk consent ceremony. It makes NO model call. The provider router
// (LOCAL-LLM-PROVIDER-ROUTER-1A) selects the local provider — LM Studio default,
// llama.cpp fallback, Ollama legacy-optional — and yields the base URL, the
// exact provider+model consent phrase, the localhost verdict, the whitelist
// verdict, and the prompt bound. This kernel frames them as "here is what I
// would do, here is the phrase to allow it". The LIVE invocation ships as
// DEMA-TALK-LOOP-1B under its own explicit GO.
//
// Reuse over reinvention: provider/whitelist/consent/bound logic lives once, in
// local-llm-provider-router.js (which itself reuses llm-adapter.js). Importing
// them is a sibling import (no node:fs/net token here), and neither performs a
// fetch on the preview path, so this kernel stays pure and effect-free.

import { buildLocalLlmProviderRoute } from "./local-llm-provider-router.js";
import { buildPreviewBoundary } from "./preview-boundary.js";

export const DEMA_TALK_LOOP_PREVIEW_SCHEMA = "bizra.dema.talk_loop_preview.v0.1";

const TRUTH_LABEL = "DEMA_TALK_LOOP_PREVIEW_ONLY";
const DEFAULT_MODEL = "qwen2.5";

const WHAT_THIS_PROVES = Object.freeze([
  "A local-model talk request can be routed to a named provider (LM Studio default) and previewed as an honest consent ceremony — provider, model, exact phrase, and boundary — with no call made.",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "No model was called and no response was generated (this is preview only).",
  "The selected provider is running or reachable — nothing is auto-detected or probed (that is checked at live-invocation time, via `dema talk --consent`).",
  "Any file was written or any receipt minted.",
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

// The kernel never calls anything. Use the CANONICAL 16-key preview boundary —
// it already asserts model_invocation_performed / model_loaded / prompt_executed
// / network_used / external_call_performed / runtime_execution_performed /
// tool_executed all false. Do NOT coin a parallel vocabulary.
function buildBoundary() {
  return buildPreviewBoundary();
}

function buildExplanation({ provider, model, allowed, known }) {
  if (!known) {
    return Object.freeze([
      `I do not recognize the provider "${provider}".`,
      "I will NOT silently fall back to another provider — that would be hidden behavior.",
      "Choose a known provider: lmstudio (default) · llamacpp (fallback) · ollama (legacy).",
      "Right now this is only a PREVIEW — I have not called or invoked anything.",
    ]);
  }
  return Object.freeze([
    `If you allow it, I would send your prompt to a LOCAL model (${model}) via ${provider}, running on your own machine — localhost only.`,
    "I would NOT send anything to the internet, and I would NOT follow any remote endpoint.",
    "I would NOT write any file and NOT mint any receipt.",
    "My answer would be a SUGGESTION only — never an authority, never an action you didn't ask for.",
    "I would scan your prompt and my response for safety, before and after.",
    allowed
      ? `The model ${model} is on the allow-list, so a request would be permitted once you consent.`
      : `The model ${model} is NOT on the allow-list — I would refuse to call it.`,
    "Right now this is only a PREVIEW — I have not called or invoked anything.",
  ]);
}

export function buildDemaTalkPreview({
  prompt = "",
  model = DEFAULT_MODEL,
  provider = null,
} = {}) {
  const modelName =
    typeof model === "string" && model.length > 0 ? model : DEFAULT_MODEL;

  // Route through the provider router (no network I/O) for the authoritative
  // provider, base URL, whitelist verdict, consent phrase, localhost target,
  // and prompt bound.
  const route = buildLocalLlmProviderRoute({ provider, model: modelName, prompt });
  const known = route.router_status === "preview_ready";

  return deepFreeze({
    schema: DEMA_TALK_LOOP_PREVIEW_SCHEMA,
    truth_label: TRUTH_LABEL,
    mode: "preview_only",
    provider: route.selected_provider,
    requested_provider: route.requested_provider,
    provider_is_default: route.provider_is_default,
    provider_is_legacy: route.provider_is_legacy,
    provider_role: route.provider_role,
    endpoint_family: route.endpoint_family,
    known_providers: route.known_providers,
    model: route.model,
    model_allowed_in_whitelist: route.model_allowed,
    prompt_length_chars: typeof prompt === "string" ? prompt.length : 0,
    prompt_too_long: route.prompt_too_long,
    target_endpoint: route.provider_base_url,
    target_is_localhost: route.target_is_localhost,
    consent_required: route.consent_phrase,
    consent_phrase_status: route.consent_phrase_status,
    model_invoked: false,
    explanation_lines: buildExplanation({
      provider: known ? route.selected_provider : route.requested_provider,
      model: route.model,
      allowed: route.model_allowed,
      known,
    }),
    next_safe_actions: known
      ? Object.freeze([
          "grant_exact_consent_to_talk",
          "choose_a_different_provider_or_model",
          "skip",
        ])
      : Object.freeze(["choose_a_known_provider", "skip"]),
    boundary: buildBoundary(),
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
  });
}
