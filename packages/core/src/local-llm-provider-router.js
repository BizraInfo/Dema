// LOCAL-LLM-PROVIDER-ROUTER-1A — PURE local-LLM provider router (preview only).
//
// Corrects Dema's local-LLM default AWAY from Ollama. Dema is provider-neutral:
// LM Studio is the DEFAULT (OpenAI-compatible localhost), llama.cpp the FALLBACK,
// Ollama an OPTIONAL LEGACY provider only. This kernel selects a provider from a
// fixed registry and previews what an invocation WOULD target — base URL, the
// exact provider+model consent phrase, the localhost verdict, the whitelist
// verdict, the prompt bound. It makes NO model call and NO network call.
//
// Guardrails (load-bearing):
//   - NO auto-detect, NO silent fallback. An unknown provider FAILS CLOSED — it
//     never silently becomes lmstudio. Only an ABSENT provider uses the default.
//   - localhost-only: every registry base_url is localhost-pinned, and the user
//     cannot inject a base_url (only `provider` selects from the fixed registry).
//   - The model whitelist still applies — reused from the hardened llm-adapter
//     (reuse over reinvention, so this can never drift from the live gate).
//
// Provisioning note (not a provider): `llmfit` (installed) is a hardware-fit
// advisor + GGUF downloader + llama.cpp launcher, NOT an OpenAI chat endpoint —
// it belongs to a future hardware-aware-whitelist slice, not this registry.

import { buildPreviewBoundary } from "./preview-boundary.js";
import {
  LLM_ADAPTER_MAX_PROMPT_LENGTH,
  llmAdapterIsAllowedModelName,
  llmAdapterIsLocalhostBaseUrl,
} from "./llm-adapter.js";

export const LOCAL_LLM_PROVIDER_ROUTER_SCHEMA =
  "bizra.dema.local_llm_provider_router.v0.1";

const TRUTH_LABEL = "LOCAL_LLM_PROVIDER_ROUTER_PREVIEW_ONLY";

export const DEFAULT_LOCAL_LLM_PROVIDER = "lmstudio";

// Fixed provider registry. Adding a provider is a DELIBERATE edit here, never
// inferred from input and never auto-detected from a running port.
export const LOCAL_LLM_PROVIDER_REGISTRY = Object.freeze({
  lmstudio: Object.freeze({
    base_url: "http://localhost:1234/v1",
    endpoint_family: "openai_compatible",
    role: "default",
    is_default: true,
    is_legacy: false,
  }),
  llamacpp: Object.freeze({
    base_url: "http://localhost:8080/v1",
    endpoint_family: "openai_compatible",
    role: "fallback",
    is_default: false,
    is_legacy: false,
  }),
  ollama: Object.freeze({
    base_url: "http://localhost:11434",
    endpoint_family: "ollama_legacy_or_openai_compatible",
    role: "legacy_optional",
    is_default: false,
    is_legacy: true,
  }),
});

const KNOWN_PROVIDERS = Object.freeze(Object.keys(LOCAL_LLM_PROVIDER_REGISTRY));

const WHAT_THIS_PROVES = Object.freeze([
  "A local-LLM request can be routed to a NAMED provider (LM Studio default · llama.cpp fallback · Ollama legacy) and previewed as an honest consent ceremony — base URL, exact provider+model phrase, localhost + whitelist verdicts — with no call made.",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "No model was called and no network request was made (this is preview only).",
  "The selected provider is running or reachable — this kernel does NOT auto-detect or probe any port.",
  // The load-bearing honesty line (critic catch): the previewed consent phrase
  // and the provider-aware allow-list describe the PROPOSED 1B contract, not a
  // gate that exists today. The live adapter (Ollama-only) uses a different,
  // provider-LESS phrase and applies the family allow-list to the raw name. Do
  // NOT present this phrase as the settled live phrase until 1B lands.
  "That the live consent gate enforces this exact phrase, or that this model is allowed by the live gate, YET. The provider-qualified phrase and the provider-aware allow-list (which normalizes LM Studio publisher/model names) are the PROPOSED contract for the live call, DEMA-TALK-LOOP-1B. Today's adapter is Ollama-only and uses a different, provider-less phrase — nothing here is enforced until 1B lands.",
  "The model name is installed in the selected provider.",
  "Any file was written, receipt minted, runtime activated, token computed, or federation invoked.",
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

// Normalize a provider-namespaced model name to the bare family-ish token the
// (Ollama-derived) whitelist understands: strip an optional `publisher/` prefix
// (LM Studio shape). Conservative + honest — it never invents an allow; a name
// the family list does not cover stays disallowed.
function whitelistTokenFor(model) {
  const s = typeof model === "string" ? model.trim() : "";
  const lastSlash = s.lastIndexOf("/");
  return lastSlash >= 0 ? s.slice(lastSlash + 1) : s;
}

export function buildLocalLlmProviderRoute({
  provider = null,
  model = "",
  prompt = "",
} = {}) {
  const modelSafe = typeof model === "string" ? model.trim() : "";
  const promptStr = typeof prompt === "string" ? prompt : "";
  const promptTooLong = promptStr.length > LLM_ADAPTER_MAX_PROMPT_LENGTH;

  // Provider resolution. ABSENT → default lmstudio. PRESENT-BUT-UNKNOWN → fail
  // closed (never silently default). KNOWN → use it.
  const requested = provider == null ? "" : String(provider).trim().toLowerCase();
  const defaulted = requested === "";
  const key = defaulted ? DEFAULT_LOCAL_LLM_PROVIDER : requested;
  const entry = Object.prototype.hasOwnProperty.call(
    LOCAL_LLM_PROVIDER_REGISTRY,
    key,
  )
    ? LOCAL_LLM_PROVIDER_REGISTRY[key]
    : null;

  if (!entry) {
    // Unknown provider — refuse. NO silent fallback to the default.
    return deepFreeze({
      schema: LOCAL_LLM_PROVIDER_ROUTER_SCHEMA,
      truth_label: TRUTH_LABEL,
      mode: "preview_only",
      router_status: "unknown_provider_refused",
      error: "unknown_provider",
      requested_provider: requested,
      selected_provider: null,
      provider_base_url: null,
      provider_is_default: false,
      provider_is_legacy: false,
      provider_role: null,
      endpoint_family: null,
      model: modelSafe,
      model_allowed: false,
      consent_phrase: null,
      consent_phrase_status: null,
      target_is_localhost: false,
      prompt_too_long: promptTooLong,
      known_providers: KNOWN_PROVIDERS,
      next_safe_actions: Object.freeze([
        `choose_a_known_provider (${KNOWN_PROVIDERS.join(" · ")})`,
        "default_is_lmstudio",
        "skip",
      ]),
      boundary: buildPreviewBoundary(),
      what_this_proves: WHAT_THIS_PROVES,
      what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
    });
  }

  const modelAllowed =
    modelSafe.length > 0 && llmAdapterIsAllowedModelName(whitelistTokenFor(modelSafe));
  const consentModel = modelSafe.length > 0 ? modelSafe : "<model>";

  return deepFreeze({
    schema: LOCAL_LLM_PROVIDER_ROUTER_SCHEMA,
    truth_label: TRUTH_LABEL,
    mode: "preview_only",
    router_status: "preview_ready",
    error: null,
    requested_provider: defaulted ? null : key,
    selected_provider: key,
    provider_base_url: entry.base_url,
    provider_is_default: entry.is_default === true,
    provider_is_legacy: entry.is_legacy === true,
    provider_role: entry.role,
    endpoint_family: entry.endpoint_family,
    model: modelSafe,
    model_allowed: modelAllowed,
    consent_phrase: `GO: invoke local LLM via ${key} at ${consentModel}`,
    // The previewed phrase is the PROPOSED 1B contract — the live gate (which
    // today is Ollama-only and provider-less) does not enforce it yet.
    consent_phrase_status: "proposed_for_1b_not_yet_enforced",
    target_is_localhost: llmAdapterIsLocalhostBaseUrl(entry.base_url),
    prompt_too_long: promptTooLong,
    known_providers: KNOWN_PROVIDERS,
    next_safe_actions: Object.freeze([
      "grant_exact_consent_to_invoke_live_call_ships_in_1b",
      "choose_a_different_provider_or_model",
      "skip",
    ]),
    boundary: buildPreviewBoundary(),
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
  });
}
