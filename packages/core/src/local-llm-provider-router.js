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
  llmAdapterConsentPhraseFor,
} from "./llm-adapter.js";
import {
  resolveLocalLlmBase,
} from "../../models/src/model-common.js";

/** ADR-042 bridge env → shared resolver, preserving /v1 for OpenAI-compat providers. */
function resolveProviderBaseUrl(providerKey, registryBaseUrl) {
  const envByProvider = {
    ollama: process.env.DEMA_OLLAMA_URL,
    lmstudio: process.env.DEMA_LM_STUDIO_URL,
    llamacpp: process.env.DEMA_LLAMACPP_URL,
  };
  const envValue = envByProvider[providerKey];
  // No bridge set → keep the fixed registry URL (localhost hostnames as shipped).
  if (typeof envValue !== "string" || envValue.trim() === "") {
    return registryBaseUrl;
  }
  const resolved = resolveLocalLlmBase({
    envValue,
    fallback: registryBaseUrl,
  });
  // OpenAI-compatible routes need the /v1 suffix the registry ships with.
  if (
    providerKey !== "ollama" &&
    typeof registryBaseUrl === "string" &&
    registryBaseUrl.endsWith("/v1") &&
    !String(resolved).endsWith("/v1")
  ) {
    return `${String(resolved).replace(/\/$/, "")}/v1`;
  }
  return resolved;
}

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

// LM-STUDIO-EXACT-ID-ALLOWLIST-1A (Design 3) + masquerade fix (w5mc6928b).
// Per-provider frozen EXACT model-id allow-list, consulted BEFORE the
// (Ollama-derived) family check. Matching is exact on the full trimmed id (no
// normalization, prototype-safe). A provider that declares a non-empty exact-id
// list (LM Studio) is treated as its OWN id world: for it the legacy family
// fallback does NOT publisher-strip, so `evil/<family>` / `publisher/<family>`
// cannot masquerade into an allowed family — only an exact id or a bare allowed
// family token passes. (The original masquerade-prevention claim was FALSE while
// the strip still ran; this is what makes it true. Providers with no exact-id
// list — Ollama/llama.cpp — keep the publisher-stripping fallback.) Frozen
// literal, NOT a runtime fs/endpoint scan (injectable — deferred). LM Studio ids
// verified against /v1/models on 2026-06-23; chat-capable only (embedding
// text-embedding-nomic-embed-text-v1.5 excluded).
export const PROVIDER_EXACT_ID_ALLOWLIST = Object.freeze({
  lmstudio: Object.freeze({
    "google/gemma-4-12b": true,
    "google/gemma-4-e4b": true,
    "zai-org/glm-4.6v-flash": true,
    "qwen/qwen3.5-9b": true,
    "qwen3.6-35b-a3b-uncensored-hauhaucs-aggressive": true,
  }),
  llamacpp: Object.freeze({}),
  ollama: Object.freeze({}),
});

// Exact, prototype-safe membership: own-property + strict-true only, so keys like
// `__proto__` / `hasOwnProperty` / `toString` never resolve to an allow.
function providerExactIdAllowed(provider, model) {
  const allow = PROVIDER_EXACT_ID_ALLOWLIST[provider];
  return (
    Boolean(allow) &&
    Object.prototype.hasOwnProperty.call(allow, model) &&
    allow[model] === true
  );
}

// True when a provider declares its own exact-id world (a non-empty allow-list).
// Such a provider is exact-id-or-bare-family only — no publisher-strip fallback.
function providerHasExactIdList(provider) {
  const allow = PROVIDER_EXACT_ID_ALLOWLIST[provider];
  return Boolean(allow) && Object.keys(allow).length > 0;
}

const WHAT_THIS_PROVES = Object.freeze([
  "A local-LLM request can be routed to a NAMED provider (LM Studio default · llama.cpp fallback · Ollama legacy) and previewed as an honest consent ceremony — base URL, exact provider+model phrase, localhost + whitelist verdicts — with no call made.",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "No model was called and no network request was made (this is preview only).",
  "The selected provider is running or reachable — this kernel does NOT auto-detect or probe any port.",
  // The previewed consent phrase and provider-aware allow-list are now the SAME
  // ones the 1B live gate (invokeDemaTalkLive) enforces — drift closed. What a
  // preview still cannot prove is reachability and installation.
  "That the selected provider is installed/running or that a live call would succeed — the live gate (DEMA-TALK-LOOP-1B) checks reachability at call time; this preview does not.",
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
      model_allow_reason: null,
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

  // Design 3: the per-provider exact-id allow-list is consulted FIRST (exact,
  // no normalization), then the legacy family check. `modelSafe` is the same
  // trimmed value that is judged here and dispatched below (route.model) — no
  // judge/dispatch drift.
  const exactIdAllowed = providerExactIdAllowed(key, modelSafe);
  // Masquerade fix (w5mc6928b): a provider with its OWN exact-id world (LM
  // Studio) must NOT publisher-strip in the legacy family fallback — that strip
  // is exactly what let `evil/llama` -> `llama` masquerade into an allowed
  // family. Bare family tokens (no publisher) still match the full id; a
  // publisher-prefixed id must be an exact-id match. Providers with no exact-id
  // list (Ollama/llama.cpp) keep the publisher-stripping normalization.
  const familyToken = providerHasExactIdList(key)
    ? modelSafe
    : whitelistTokenFor(modelSafe);
  const familyAllowed =
    modelSafe.length > 0 && llmAdapterIsAllowedModelName(familyToken);
  const modelAllowed = exactIdAllowed || familyAllowed;
  const modelAllowReason = exactIdAllowed
    ? "exact_id"
    : familyAllowed
      ? "family"
      : null;
  const consentModel = modelSafe.length > 0 ? modelSafe : "<model>";
  // PERIMETER-BRIDGE-PARITY-1A: same resolveLocalLlmBase inventory/adapter use.
  const providerBaseUrl = resolveProviderBaseUrl(key, entry.base_url);

  return deepFreeze({
    schema: LOCAL_LLM_PROVIDER_ROUTER_SCHEMA,
    truth_label: TRUTH_LABEL,
    mode: "preview_only",
    router_status: "preview_ready",
    error: null,
    requested_provider: defaulted ? null : key,
    selected_provider: key,
    provider_base_url: providerBaseUrl,
    provider_is_default: entry.is_default === true,
    provider_is_legacy: entry.is_legacy === true,
    provider_role: entry.role,
    endpoint_family: entry.endpoint_family,
    model: modelSafe,
    model_allowed: modelAllowed,
    model_allow_reason: modelAllowReason,
    // Single source of truth: the SAME consentPhraseFor the 1B live gate
    // (invokeDemaTalkLive) enforces — so the previewed phrase == the gate phrase.
    consent_phrase: llmAdapterConsentPhraseFor(consentModel, key),
    consent_phrase_status: "enforced_by_live_gate",
    target_is_localhost: llmAdapterIsLocalhostBaseUrl(providerBaseUrl),
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
