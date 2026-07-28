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

import {
  buildPreviewBoundary,
  buildRuntimeEmissionBoundary,
} from "./preview-boundary.js";
import { evaluateArtifactSafety } from "./artifact-safety-eval.js";
// PERIMETER-BRIDGE-PARITY-1A: the single endpoint resolver, shared with
// packages/models model-inventory so discover and invoke can never disagree
// about where the local model lives.
import { resolveLocalLlmBase } from "../../models/src/model-common.js";

// Literal loopback IP, never the hostname "localhost": the default must not
// depend on a resolver. MEASURED 2026-07-28 — in a sandbox with no readable
// /etc/hosts, resolving "localhost" throws EAI_AGAIN, so a live Ollama on
// 127.0.0.1:11434 was unreachable and every invocation failed with
// "network_error · fetch failed". That misreports a healthy local node as a
// network fault, which is the worst failure mode for a local-first tool. On a
// normal machine localhost resolves to this address anyway, so nothing changes
// there. Callers needing ::1 or the hostname can still pass an explicit base;
// isLocalhostBaseUrl() accepts localhost, 127.0.0.1 and ::1.
const DEFAULT_OLLAMA_BASE = "http://127.0.0.1:11434";
const DEFAULT_TIMEOUT_MS = 60000;
const MAX_PROMPT_LENGTH = 100000; // 100K chars · adversarial-safe cap
const MAX_MODEL_NAME_LENGTH = 200;

// Canonical model whitelist — only these can be invoked. Caller cannot
// override. Extend this list via deliberate ADR amendment, never via input.
// Whitelist of model name-prefixes (the part before the colon in Ollama's
// user-facing name). Extended 2026-05-18 GST based on C1.5 scan findings
// of operator-installed models. Each addition was verified to exist on
// disk via `dema models scan` before being added here.
const ALLOWED_MODEL_FAMILIES = Object.freeze([
  // Canonical upstream families
  "llama",
  "llama2",
  "llama3",
  "llama3.1",
  "llama3.2",
  "llama3.3",
  "mistral",
  "mixtral",
  "qwen",
  "qwen2",
  "qwen2.5",
  "qwen3",
  "gemma",
  "gemma2",
  "gemma3",
  "gemma4",
  "phi",
  "phi3",
  "phi4",
  "deepseek",
  "deepseek-r1",
  "deepseek-v2",
  "deepseek-v3",
  "nomic-embed-text",
  "mxbai-embed-large",
  // Operator-installed (verified via C1.5 scan 2026-05-18 GST)
  "qwen3-coder-next", // qwen3-coder-next:q4_K_M (79.7B coding)
  "whiterabbitneo-v3", // whiterabbitneo-v3:7b-q4_K_M (security 7.6B)
]);

const REQUIRED_BLOCKED_EFFECTS_PREVIEW = Object.freeze([
  "runtime_execution_outside_localhost",
  "public_network_use",
  "non_whitelisted_model_invocation",
  "consent_phrase_inference_or_fuzzy_match",
  "raw_corpus_scan",
  "chain_advance",
  "receipt_mint_outside_gateway",
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

function consentPhraseFor(modelName, provider = null) {
  // The exact-string consent phrase pattern. Caller MUST type this verbatim.
  // No fuzzy match. No prefix match. No case-insensitive match.
  //
  // Back-compat: called with one arg (no provider) it returns the legacy
  // provider-LESS phrase used by the Ollama-only invokeLocalLLM and every
  // existing call site (model-broker, think-live, index.js). Called WITH a
  // provider it returns the provider-qualified phrase the provider router
  // previews and DEMA-TALK-LOOP-1B's live gate enforces — so preview == gate.
  const p =
    typeof provider === "string" && provider.trim().length > 0
      ? provider.trim().toLowerCase()
      : null;
  return p
    ? `GO: invoke local LLM via ${p} at ${modelName}`
    : `GO: invoke local LLM at ${modelName}`;
}

function isLocalhostBaseUrl(baseUrl) {
  try {
    const url = new URL(baseUrl);
    const host = url.hostname
      .replace(/^\[|\]$/g, "")
      .replace(/\.$/, "")
      .toLowerCase();
    return (
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "::1"].includes(host)
    );
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Monotonic per-invocation consent freshness · ADR-018 §S6.
//
// Each consent phrase, once successfully verified in this process, is
// recorded. Re-using the SAME phrase for a subsequent invocation in the
// SAME process is rejected with `consent_phrase_replayed_in_session`.
//
// Each `dema model-broker invoke` CLI run is its own Node process — the
// set starts empty, so first-invocation flow is unaffected. The replay
// guard catches the in-process programmatic-use risk.
//
// `__resetInvocationFreshness()` is exported for tests only.

const _seenConsentPhrases = new Set();
let _attemptCounter = 0;

function recordConsentUsage(phrase) {
  // Per ADR-018 review fix #3: attempt_n is monotonic across ALL calls,
  // including replayed ones. The replay flag distinguishes accept/reject;
  // the counter just counts attempts so successive replays surface as
  // attempts 2, 3, 4, ... instead of stuck at the prior accept's value.
  _attemptCounter += 1;
  if (_seenConsentPhrases.has(phrase)) {
    return { replayed: true, attempt_n: _attemptCounter };
  }
  _seenConsentPhrases.add(phrase);
  return { replayed: false, attempt_n: _attemptCounter };
}

export function __resetInvocationFreshness() {
  _seenConsentPhrases.clear();
  _attemptCounter = 0;
}

// ──────────────────────────────────────────────────────────────────────────
// Bidirectional Layer 1 safety scan · ADR-018 §S5.
//
// Pre-fetch: scan the prompt. If the Layer 1 verdict is not PUBLIC_SAFE,
// refuse to call the model · truth_label INVOCATION_BLOCKED.
//
// Post-fetch: scan the response_text. If the verdict is not PUBLIC_SAFE,
// emit a result envelope with response_safety_verdict = the verdict and
// replace the response_text_preview with a REDACTED placeholder.

function scanInboundPrompt(prompt) {
  const result = evaluateArtifactSafety(prompt);
  return result.verdict;
}

function scanOutboundResponse(text) {
  if (typeof text !== "string" || text.length === 0) return "PUBLIC_SAFE";
  const result = evaluateArtifactSafety(text);
  return result.verdict;
}

export function buildLLMInvocationPreview({
  model = "",
  prompt = "",
  ollamaBaseUrl = undefined,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const modelSafe = typeof model === "string" ? model : "";
  const promptSafe = safeString(prompt, "");
  const timeoutSafe =
    typeof timeoutMs === "number" && timeoutMs > 0 && timeoutMs <= 600000
      ? timeoutMs
      : DEFAULT_TIMEOUT_MS;

  const modelAllowed = isAllowedModelName(modelSafe);
  // Shared resolver: explicit --base > DEMA_OLLAMA_URL bridge > loopback
  // default, with the localhost-only boundary enforced after resolution.
  const urlSafe = resolveLocalLlmBase({
    explicit: ollamaBaseUrl,
    envValue: process.env.DEMA_OLLAMA_URL,
    fallback: DEFAULT_OLLAMA_BASE,
  });

  return Object.freeze({
    schema: "bizra.dema.llm_invocation_preview.v0.1",
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    invocation_status: "not_invoked_preview_only",
    requested_model: modelSafe,
    model_allowed_in_whitelist: modelAllowed,
    prompt_length_chars: promptSafe.length,
    prompt_truncated:
      typeof prompt === "string" && prompt.length > MAX_PROMPT_LENGTH,
    target_endpoint: urlSafe,
    target_is_localhost: true,
    timeout_ms: timeoutSafe,
    consent_required: consentPhraseFor(modelSafe || "<MODEL>"),
    blocked_effects: REQUIRED_BLOCKED_EFFECTS_PREVIEW,
    boundary: buildPreviewBoundary(),
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
    boundary: full.boundary,
  });
}

// Result envelope after actual invocation. NOT a preview · different schema.
// Per ADR-018 §C3, the boundary on a runtime emission is the sibling
// vocabulary `buildRuntimeEmissionBoundary` — 6 keys MAY be true (network,
// model_loaded, model_invocation, prompt_executed, runtime_execution,
// consent_collected); 10 keys MUST stay false (public_network, external_call,
// chain_advance, receipt_mint, federation, node_connection, raw_corpus_scan,
// raw_data, tool_executed, filesystem_write).
//
// Per ADR-018 §C5 / ADR-015, every result envelope carries verdict_role:
// "suggestion" — the model output is NEVER an authority signal.
//
// Per ADR-018 §C4, the result envelope can carry prompt_safety_verdict and
// response_safety_verdict from the bidirectional Layer 1 scan. truth_label
// becomes INVOCATION_BLOCKED when inbound scan refuses the prompt.
//
// `effects_observed` is retained as a backwards-compatibility alias for one
// release cycle so existing callers / tests continue to work; new code MUST
// read `boundary` instead.
function buildInvocationResult({
  modelName,
  promptSubmitted,
  responseText,
  responseRaw,
  durationMs,
  endpoint,
  consentPhraseVerified,
  errorReason = null,
  blocked = false,
  fetchAttempted = false,
  promptSafetyVerdict = null,
  responseSafetyVerdict = null,
  responseTextPreviewOverride = undefined,
  attemptN = null,
}) {
  const isError = errorReason !== null;
  const isCompletedSuccess = !isError && !blocked;
  // Per ADR-018 review fix #4: a fetch that started and failed mid-stream
  // still constitutes network use + a prompt sent + runtime that executed.
  // Split network/prompt/runtime (gated on fetchAttempted) from
  // model_loaded/model_invocation (gated on completed success).
  const boundary = buildRuntimeEmissionBoundary({
    network_used: fetchAttempted,
    prompt_executed: fetchAttempted,
    runtime_execution_performed: fetchAttempted,
    model_loaded: isCompletedSuccess,
    model_invocation_performed: isCompletedSuccess,
    consent_collected: consentPhraseVerified === true,
  });

  let truthLabel;
  let invocationStatus;
  if (blocked) {
    truthLabel = "INVOCATION_BLOCKED";
    invocationStatus = "blocked";
  } else if (isError) {
    truthLabel = "INVOCATION_FAILED";
    invocationStatus = "failed";
  } else {
    truthLabel = "MEASURED";
    invocationStatus = "completed";
  }

  let responseTextPreview;
  if (responseTextPreviewOverride !== undefined) {
    responseTextPreview = responseTextPreviewOverride;
  } else if (typeof responseText === "string") {
    responseTextPreview =
      responseText.slice(0, 500) +
      (responseText.length > 500 ? " […truncated]" : "");
  } else {
    responseTextPreview = null;
  }

  return Object.freeze({
    schema: "bizra.dema.llm_invocation_result.v0.1",
    truth_label: truthLabel,
    mode: "invocation_result",
    invocation_status: invocationStatus,
    error_reason: errorReason,
    model_invoked: modelName,
    prompt_length_chars:
      typeof promptSubmitted === "string" ? promptSubmitted.length : 0,
    response_length_chars:
      typeof responseText === "string" ? responseText.length : 0,
    response_text_preview: responseTextPreview,
    response_raw_keys:
      responseRaw && typeof responseRaw === "object"
        ? Object.freeze(Object.keys(responseRaw).slice(0, 50))
        : Object.freeze([]),
    duration_ms: typeof durationMs === "number" ? durationMs : null,
    target_endpoint: endpoint,
    target_is_localhost:
      typeof endpoint === "string" && isLocalhostBaseUrl(endpoint),
    consent_phrase_verified: consentPhraseVerified === true,
    verdict_role: "suggestion",
    attempt_n: typeof attemptN === "number" ? attemptN : null,
    prompt_safety_verdict: promptSafetyVerdict,
    response_safety_verdict: responseSafetyVerdict,
    boundary,
    // Backwards-compat alias retained for one cycle per ADR-018 S4.
    effects_observed: boundary,
    blocked_effects: REQUIRED_BLOCKED_EFFECTS_PREVIEW,
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
  ollamaBaseUrl = undefined,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = undefined, // optional · for testing
} = {}) {
  const modelSafe = typeof model === "string" ? model : "";
  const promptSafe = typeof prompt === "string" ? prompt : "";
  const consentSafe = typeof consentPhrase === "string" ? consentPhrase : "";
  // Parity with the preview path for AMBIENT sources (env bridge, default),
  // but an EXPLICIT endpoint is never silently rewritten here: on the invoke
  // path a caller-supplied non-loopback URL must reach Gate 1 and be REFUSED,
  // not quietly replaced with the default. Silently falling back would mask a
  // smuggling attempt as a normal local call. Preview may fall back because it
  // performs no I/O; invoke may not, because it does.
  const baseUrl =
    typeof ollamaBaseUrl === "string" && ollamaBaseUrl.trim() !== ""
      ? ollamaBaseUrl
      : resolveLocalLlmBase({
          envValue: process.env.DEMA_OLLAMA_URL,
          fallback: DEFAULT_OLLAMA_BASE,
        });
  const timeoutSafe =
    typeof timeoutMs === "number" && timeoutMs > 0 && timeoutMs <= 600000
      ? timeoutMs
      : DEFAULT_TIMEOUT_MS;

  // Gate 1: localhost-bound
  if (!isLocalhostBaseUrl(baseUrl)) {
    return buildInvocationResult({
      modelName: modelSafe,
      promptSubmitted: promptSafe,
      responseText: null,
      responseRaw: null,
      durationMs: 0,
      endpoint: baseUrl,
      consentPhraseVerified: false,
      errorReason: "endpoint_not_localhost · invocation refused",
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
      errorReason: `model_not_in_whitelist · '${modelSafe}' · invocation refused`,
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
      errorReason: "prompt_empty · invocation refused",
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
      errorReason: `prompt_too_long · ${promptSafe.length} > ${MAX_PROMPT_LENGTH} · invocation refused`,
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
      errorReason: `consent_phrase_mismatch · required exact string: '${requiredPhrase}' · invocation refused`,
    });
  }

  // Gate 5: consent freshness · ADR-018 §S6
  // Re-using the same consent phrase for a second invocation in the same
  // process is rejected. Each fresh invocation requires a fresh consent.
  // Process restart (separate CLI run) resets the seen-set.
  const freshness = recordConsentUsage(consentSafe);
  if (freshness.replayed) {
    return buildInvocationResult({
      modelName: modelSafe,
      promptSubmitted: promptSafe,
      responseText: null,
      responseRaw: null,
      durationMs: 0,
      endpoint: baseUrl,
      consentPhraseVerified: true,
      errorReason: `consent_phrase_replayed_in_session · attempt ${freshness.attempt_n} · each invocation requires fresh consent · invocation refused`,
      attemptN: freshness.attempt_n,
    });
  }

  // Gate 6: inbound prompt safety · ADR-018 §S5
  // Scan the prompt with Layer 1 BEFORE calling the model. If the prompt
  // contains a path leak, secret-shaped token, or forbidden-live claim,
  // refuse the invocation with INVOCATION_BLOCKED + the verdict.
  const promptVerdict = scanInboundPrompt(promptSafe);
  if (promptVerdict !== "PUBLIC_SAFE") {
    return buildInvocationResult({
      modelName: modelSafe,
      promptSubmitted: promptSafe,
      responseText: null,
      responseRaw: null,
      durationMs: 0,
      endpoint: baseUrl,
      consentPhraseVerified: true,
      blocked: true,
      promptSafetyVerdict: promptVerdict,
      errorReason: `inbound_prompt_safety_violation · ${promptVerdict} · invocation blocked before fetch`,
      attemptN: freshness.attempt_n,
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
      errorReason: "fetch_not_available · runtime missing fetch primitive",
      promptSafetyVerdict: promptVerdict,
      attemptN: freshness.attempt_n,
    });
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutSafe);

  try {
    const response = await fetcher(`${baseUrl}/api/generate`, {
      method: "POST",
      // Fail closed on any 3xx: a compromised localhost LLM server must not be
      // able to bounce this call off-localhost via a redirect.
      redirect: "error",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: modelSafe,
        prompt: promptSafe,
        stream: false,
      }),
      signal: controller.signal,
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
        errorReason: `http_status_${response.status} · ${response.statusText || "unknown"}`,
        fetchAttempted: true,
        promptSafetyVerdict: promptVerdict,
        attemptN: freshness.attempt_n,
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
        errorReason: `response_not_json · ${String(parseErr).slice(0, 200)}`,
        fetchAttempted: true,
        promptSafetyVerdict: promptVerdict,
        attemptN: freshness.attempt_n,
      });
    }

    // ADR-018 review fix #6: a 200 OK body without a string `response`
    // field is malformed — reject as failed instead of routing through the
    // success path with responseText=null.
    if (typeof body?.response !== "string") {
      return buildInvocationResult({
        modelName: modelSafe,
        promptSubmitted: promptSafe,
        responseText: null,
        responseRaw: body,
        durationMs: Date.now() - startedAt,
        endpoint: baseUrl,
        consentPhraseVerified: true,
        errorReason: `malformed_response_payload · 200 OK but body.response is ${typeof body?.response} not string`,
        fetchAttempted: true,
        promptSafetyVerdict: promptVerdict,
        attemptN: freshness.attempt_n,
      });
    }

    const responseText = body.response;
    // Outbound Layer 1 scan · ADR-018 §S5
    const responseVerdict = scanOutboundResponse(responseText);
    const responseTextPreviewOverride =
      responseVerdict !== "PUBLIC_SAFE" && responseText
        ? `[REDACTED: ${responseVerdict}]`
        : undefined;
    return buildInvocationResult({
      modelName: modelSafe,
      promptSubmitted: promptSafe,
      responseText,
      responseRaw: body,
      durationMs: Date.now() - startedAt,
      endpoint: baseUrl,
      consentPhraseVerified: true,
      errorReason: null,
      fetchAttempted: true,
      promptSafetyVerdict: promptVerdict,
      responseSafetyVerdict: responseVerdict,
      responseTextPreviewOverride,
      attemptN: freshness.attempt_n,
    });
  } catch (err) {
    clearTimeout(timeoutHandle);
    const errorClass =
      err?.name === "AbortError"
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
      errorReason: errorClass,
      // Per ADR-018 review fix #4: timeout / network_error means fetch
      // started and failed before completion. network was used.
      fetchAttempted: true,
      promptSafetyVerdict: promptVerdict,
      attemptN: freshness.attempt_n,
    });
  }
}

export const LLM_ADAPTER_ALLOWED_MODEL_FAMILIES = ALLOWED_MODEL_FAMILIES;
export const LLM_ADAPTER_DEFAULT_BASE = DEFAULT_OLLAMA_BASE;
export const LLM_ADAPTER_MAX_PROMPT_LENGTH = MAX_PROMPT_LENGTH;
export const LLM_ADAPTER_REQUIRED_BLOCKED_EFFECTS_PREVIEW =
  REQUIRED_BLOCKED_EFFECTS_PREVIEW;
export { consentPhraseFor as llmAdapterConsentPhraseFor };
// Reuse-over-reinvention: the provider router applies the SAME whitelist and
// localhost checks rather than duplicating (and risking drift from) them.
export { isAllowedModelName as llmAdapterIsAllowedModelName };
export { isLocalhostBaseUrl as llmAdapterIsLocalhostBaseUrl };
