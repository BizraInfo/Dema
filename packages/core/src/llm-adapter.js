// C1 · Local LLM Adapter — first runtime component per ADR-008.
//
// Bridges Dema from preview-only-substrate to runtime-capable. Calls
// LOCAL LLMs (Ollama HTTP API at localhost) under canonical doctrine:
// schema-tagged · canonical boundary preserved on preview · consent-
// gated · receipt-emitting · adversarial-input-filtered.
//
// Two surfaces:
//   1. buildLLMInvocationPreview() · canonical 16-key boundary all false
//      Describes what an invocation WOULD do · zero side effects.
//   2. invokeLocalLLM() · the actual HTTP call · requires exact-string
//      consent phrase per ADR-005 · localhost-bound · model-whitelisted.
//      Returns a result envelope with effects_observed (NOT a preview-
//      shape boundary · this is a different schema family per ADR-008).
//
// Operating law applied:
//   - Localhost-bound by default · public_network_used pinned false
//   - Consent phrase exact-string · per ADR-005
//   - Model whitelist enforced · caller cannot smuggle non-whitelisted name
//   - Connection refused / timeout / invalid response → schema-tagged error
//   - All invocations emit a result with truth_label MEASURED
//   - All previews emit canonical boundary all-false
//
// Per ADR-008 §C1: this is the first runtime component.
// Per Key Maker canon: every claim binds to V/D/A/U state.

import { buildPreviewBoundary } from "./preview-boundary.js";

const DEFAULT_OLLAMA_BASE = "http://localhost:11434";
const DEFAULT_TIMEOUT_MS = 60000;
const MAX_PROMPT_LENGTH = 100000; // 100K chars · adversarial-safe cap
const MAX_MODEL_NAME_LENGTH = 200;

// Canonical model whitelist — only these can be invoked. Caller cannot
// override. Extend this list via deliberate ADR amendment, never via input.
const ALLOWED_MODEL_FAMILIES = Object.freeze([
  "llama", "llama2", "llama3", "llama3.1", "llama3.2", "llama3.3",
  "mistral", "mixtral", "qwen", "qwen2", "qwen2.5", "qwen3",
  "gemma", "gemma2", "gemma3",
  "phi", "phi3", "phi4",
  "deepseek", "deepseek-r1", "deepseek-v2", "deepseek-v3",
  "nomic-embed-text", "mxbai-embed-large"
]);

const REQUIRED_BLOCKED_EFFECTS_PREVIEW = Object.freeze([
  "runtime_execution_outside_localhost",
  "public_network_use",
  "non_whitelisted_model_invocation",
  "consent_phrase_inference_or_fuzzy_match",
  "raw_corpus_scan",
  "chain_advance",
  "receipt_mint_outside_gateway"
]);

function isAllowedModelName(name) {
  if (typeof name !== "string") return false;
  if (name.length === 0 || name.length > MAX_MODEL_NAME_LENGTH) return false;
  // Model name shape: family[:tag] · e.g. "llama3.1:8b" · "qwen2.5:7b-instruct"
  // The FAMILY is everything before the first colon. The tag is allowed any
  // alphanumeric + dash + dot.
  const match = name.match(/^([a-z][a-z0-9._-]*)(:[a-zA-Z0-9._-]+)?$/);
  if (!match) return false;
  const family = match[1];
  return ALLOWED_MODEL_FAMILIES.includes(family);
}

function safeString(v, fallback = "") {
  if (typeof v !== "string") return fallback;
  return v.length > MAX_PROMPT_LENGTH ? v.slice(0, MAX_PROMPT_LENGTH) : v;
}

function consentPhraseFor(modelName) {
  // The exact-string consent phrase pattern. Caller MUST type this verbatim.
  // No fuzzy match. No prefix match. No case-insensitive match.
  return `GO: invoke local LLM at ${modelName}`;
}

export function buildLLMInvocationPreview({
  model = "",
  prompt = "",
  ollamaBaseUrl = DEFAULT_OLLAMA_BASE,
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  const modelSafe = typeof model === "string" ? model : "";
  const promptSafe = safeString(prompt, "");
  const baseUrl = typeof ollamaBaseUrl === "string" ? ollamaBaseUrl : DEFAULT_OLLAMA_BASE;
  const timeoutSafe = typeof timeoutMs === "number" && timeoutMs > 0 && timeoutMs <= 600000
    ? timeoutMs
    : DEFAULT_TIMEOUT_MS;

  const modelAllowed = isAllowedModelName(modelSafe);
  const urlSafe = baseUrl.startsWith("http://localhost") || baseUrl.startsWith("http://127.0.0.1")
    ? baseUrl
    : DEFAULT_OLLAMA_BASE;

  return Object.freeze({
    schema: "bizra.dema.llm_invocation_preview.v0.1",
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    invocation_status: "not_invoked_preview_only",
    requested_model: modelSafe,
    model_allowed_in_whitelist: modelAllowed,
    prompt_length_chars: promptSafe.length,
    prompt_truncated: typeof prompt === "string" && prompt.length > MAX_PROMPT_LENGTH,
    target_endpoint: urlSafe,
    target_is_localhost: true,
    timeout_ms: timeoutSafe,
    consent_required: consentPhraseFor(modelSafe || "<MODEL>"),
    blocked_effects: REQUIRED_BLOCKED_EFFECTS_PREVIEW,
    boundary: buildPreviewBoundary()
  });
}

export function buildLLMInvocationSummary(options = {}) {
  const full = buildLLMInvocationPreview(options);
  return Object.freeze({
    schema: "bizra.dema.llm_invocation_summary.v0.1",
    truth_label: full.truth_label,
    mode: "summary",
    source_schema: full.schema,
    requested_model: full.requested_model,
    model_allowed_in_whitelist: full.model_allowed_in_whitelist,
    prompt_length_chars: full.prompt_length_chars,
    target_is_localhost: full.target_is_localhost,
    consent_required: full.consent_required,
    boundary: full.boundary
  });
}

// Result envelope after actual invocation. NOT a preview · different schema.
// boundary preserves canonical structure but reflects what HAPPENED.
function buildInvocationResult({
  modelName,
  promptSubmitted,
  responseText,
  responseRaw,
  durationMs,
  endpoint,
  consentPhraseVerified,
  errorReason = null
}) {
  const effectsObserved = Object.freeze({
    network_used: true,
    public_network_used: false,
    model_loaded: !errorReason,
    model_invocation_performed: !errorReason,
    prompt_executed: !errorReason,
    consent_collected: consentPhraseVerified === true,
    filesystem_write_performed: false,
    runtime_execution_performed: !errorReason,
    external_call_performed: false,
    raw_corpus_scan_performed: false,
    raw_data_included: false,
    tool_executed: false,
    chain_advance_performed: false,
    receipt_mint_performed: false,
    federation_invoked: false,
    node_connection_performed: false
  });

  return Object.freeze({
    schema: "bizra.dema.llm_invocation_result.v0.1",
    truth_label: errorReason ? "INVOCATION_FAILED" : "MEASURED",
    mode: "invocation_result",
    invocation_status: errorReason ? "failed" : "completed",
    error_reason: errorReason,
    model_invoked: modelName,
    prompt_length_chars: typeof promptSubmitted === "string" ? promptSubmitted.length : 0,
    response_length_chars: typeof responseText === "string" ? responseText.length : 0,
    response_text_preview: typeof responseText === "string"
      ? responseText.slice(0, 500) + (responseText.length > 500 ? " […truncated]" : "")
      : null,
    response_raw_keys: responseRaw && typeof responseRaw === "object"
      ? Object.freeze(Object.keys(responseRaw).slice(0, 50))
      : Object.freeze([]),
    duration_ms: typeof durationMs === "number" ? durationMs : null,
    target_endpoint: endpoint,
    target_is_localhost: typeof endpoint === "string" &&
      (endpoint.startsWith("http://localhost") || endpoint.startsWith("http://127.0.0.1")),
    consent_phrase_verified: consentPhraseVerified === true,
    effects_observed: effectsObserved,
    blocked_effects: REQUIRED_BLOCKED_EFFECTS_PREVIEW
  });
}

// The actual invocation function. Public for programmatic use; bound by
// consent-gate, model-whitelist, localhost-only, timeout.
//
// Returns a result envelope on success OR a result envelope with
// invocation_status=failed and error_reason populated on failure.
//
// IMPORTANT: this function may make a real HTTP call to localhost. Side
// effects: network call to localhost:11434, no filesystem write, no
// receipts minted from here (receipt emission is a separate caller step).
export async function invokeLocalLLM({
  model = "",
  prompt = "",
  consentPhrase = "",
  ollamaBaseUrl = DEFAULT_OLLAMA_BASE,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = undefined // optional · for testing
} = {}) {
  const modelSafe = typeof model === "string" ? model : "";
  const promptSafe = typeof prompt === "string" ? prompt : "";
  const consentSafe = typeof consentPhrase === "string" ? consentPhrase : "";
  const baseUrl = typeof ollamaBaseUrl === "string" ? ollamaBaseUrl : DEFAULT_OLLAMA_BASE;
  const timeoutSafe = typeof timeoutMs === "number" && timeoutMs > 0 && timeoutMs <= 600000
    ? timeoutMs
    : DEFAULT_TIMEOUT_MS;

  // Gate 1: localhost-bound
  if (!(baseUrl.startsWith("http://localhost") || baseUrl.startsWith("http://127.0.0.1"))) {
    return buildInvocationResult({
      modelName: modelSafe,
      promptSubmitted: promptSafe,
      responseText: null,
      responseRaw: null,
      durationMs: 0,
      endpoint: baseUrl,
      consentPhraseVerified: false,
      errorReason: "endpoint_not_localhost · invocation refused"
    });
  }

  // Gate 2: model in whitelist
  if (!isAllowedModelName(modelSafe)) {
    return buildInvocationResult({
      modelName: modelSafe,
      promptSubmitted: promptSafe,
      responseText: null,
      responseRaw: null,
      durationMs: 0,
      endpoint: baseUrl,
      consentPhraseVerified: false,
      errorReason: `model_not_in_whitelist · '${modelSafe}' · invocation refused`
    });
  }

  // Gate 3: prompt within bounds
  if (promptSafe.length === 0) {
    return buildInvocationResult({
      modelName: modelSafe,
      promptSubmitted: promptSafe,
      responseText: null,
      responseRaw: null,
      durationMs: 0,
      endpoint: baseUrl,
      consentPhraseVerified: false,
      errorReason: "prompt_empty · invocation refused"
    });
  }
  if (promptSafe.length > MAX_PROMPT_LENGTH) {
    return buildInvocationResult({
      modelName: modelSafe,
      promptSubmitted: promptSafe,
      responseText: null,
      responseRaw: null,
      durationMs: 0,
      endpoint: baseUrl,
      consentPhraseVerified: false,
      errorReason: `prompt_too_long · ${promptSafe.length} > ${MAX_PROMPT_LENGTH} · invocation refused`
    });
  }

  // Gate 4: consent phrase exact match · per ADR-005
  const requiredPhrase = consentPhraseFor(modelSafe);
  if (consentSafe !== requiredPhrase) {
    return buildInvocationResult({
      modelName: modelSafe,
      promptSubmitted: promptSafe,
      responseText: null,
      responseRaw: null,
      durationMs: 0,
      endpoint: baseUrl,
      consentPhraseVerified: false,
      errorReason: `consent_phrase_mismatch · required exact string: '${requiredPhrase}' · invocation refused`
    });
  }

  // All gates passed · proceed to invocation
  const fetcher = fetchImpl || globalThis.fetch;
  if (typeof fetcher !== "function") {
    return buildInvocationResult({
      modelName: modelSafe,
      promptSubmitted: promptSafe,
      responseText: null,
      responseRaw: null,
      durationMs: 0,
      endpoint: baseUrl,
      consentPhraseVerified: true,
      errorReason: "fetch_not_available · runtime missing fetch primitive"
    });
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutSafe);

  try {
    const response = await fetcher(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: modelSafe,
        prompt: promptSafe,
        stream: false
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutHandle);

    if (!response.ok) {
      return buildInvocationResult({
        modelName: modelSafe,
        promptSubmitted: promptSafe,
        responseText: null,
        responseRaw: null,
        durationMs: Date.now() - startedAt,
        endpoint: baseUrl,
        consentPhraseVerified: true,
        errorReason: `http_status_${response.status} · ${response.statusText || "unknown"}`
      });
    }

    let body;
    try {
      body = await response.json();
    } catch (parseErr) {
      return buildInvocationResult({
        modelName: modelSafe,
        promptSubmitted: promptSafe,
        responseText: null,
        responseRaw: null,
        durationMs: Date.now() - startedAt,
        endpoint: baseUrl,
        consentPhraseVerified: true,
        errorReason: `response_not_json · ${String(parseErr).slice(0, 200)}`
      });
    }

    return buildInvocationResult({
      modelName: modelSafe,
      promptSubmitted: promptSafe,
      responseText: typeof body?.response === "string" ? body.response : null,
      responseRaw: body,
      durationMs: Date.now() - startedAt,
      endpoint: baseUrl,
      consentPhraseVerified: true,
      errorReason: null
    });
  } catch (err) {
    clearTimeout(timeoutHandle);
    const errorClass = err?.name === "AbortError"
      ? `timeout_after_${timeoutSafe}ms`
      : `network_error · ${String(err).slice(0, 200)}`;
    return buildInvocationResult({
      modelName: modelSafe,
      promptSubmitted: promptSafe,
      responseText: null,
      responseRaw: null,
      durationMs: Date.now() - startedAt,
      endpoint: baseUrl,
      consentPhraseVerified: true,
      errorReason: errorClass
    });
  }
}

export const LLM_ADAPTER_ALLOWED_MODEL_FAMILIES = ALLOWED_MODEL_FAMILIES;
export const LLM_ADAPTER_DEFAULT_BASE = DEFAULT_OLLAMA_BASE;
export const LLM_ADAPTER_MAX_PROMPT_LENGTH = MAX_PROMPT_LENGTH;
export const LLM_ADAPTER_REQUIRED_BLOCKED_EFFECTS_PREVIEW = REQUIRED_BLOCKED_EFFECTS_PREVIEW;
export { consentPhraseFor as llmAdapterConsentPhraseFor };
