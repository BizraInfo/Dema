// DEMA-TALK-LOOP-1B — LIVE local-model invocation.
//
// Dema's FIRST real model call. It speaks to a LOCAL provider (LM Studio default,
// llama.cpp fallback, Ollama legacy) on localhost, behind the exact provider+
// model consent phrase, and returns the model's answer as a SUGGESTION — never
// an authority, never a task execution, never runtime autonomy, never a token /
// PoI / federation.
//
// Single source of truth: provider resolution, base URL, endpoint family,
// localhost verdict, whitelist verdict, and the consent phrase ALL come from the
// provider router (LOCAL-LLM-PROVIDER-ROUTER-1A), which itself derives the phrase
// from llm-adapter's consentPhraseFor. So the phrase the router PREVIEWS is the
// exact phrase this gate ENFORCES — the drift #210 surfaced is closed here.
//
// CI safety: the network call goes through an injectable `fetchImpl`. Every test
// injects a fake fetch — no real model, no network in CI. The `fetcher` alias
// (fetchImpl || globalThis.fetch) is the sanctioned local-invocation pattern
// (see llm-adapter.js), so this runtime module needs no kernel-purity allowlist
// entry: it imports no node:net/http/fs and makes no bare `fetch(` call.

import { buildLocalLlmProviderRoute } from "./local-llm-provider-router.js";
import { buildRuntimeEmissionBoundary } from "./preview-boundary.js";
import { evaluateArtifactSafety } from "./artifact-safety-eval.js";
import { LLM_ADAPTER_MAX_PROMPT_LENGTH } from "./llm-adapter.js";

export const DEMA_TALK_LOOP_LIVE_RESULT_SCHEMA =
  "bizra.dema.talk_loop_live_result.v0.1";

const DEFAULT_TIMEOUT_MS = 60000;
const RESPONSE_PREVIEW_CHARS = 500;

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "That the model's answer is correct, or an authority — it is a SUGGESTION only, never an action you did not ask for.",
  "That any task was executed, any file written, any runtime activated, or any receipt / token / PoI / federation produced — this is a single local model call, nothing more.",
  "That Dema gained autonomy — the call ran only because you typed the exact consent phrase for this provider + model.",
]);

function buildResult({
  status,
  truthLabel,
  provider = null,
  model = "",
  endpoint = null,
  endpointFamily = null,
  requiredConsent = null,
  consentVerified = false,
  errorReason = null,
  responseText = null,
  durationMs = null,
  fetchAttempted = false,
  completed = false,
  promptSafetyVerdict = null,
  responseSafetyVerdict = null,
  responseTextPreviewOverride = undefined,
}) {
  // Per ADR-018 §C3: a runtime emission uses the sibling boundary vocabulary —
  // 6 keys MAY be true (network/model_loaded/model_invocation/prompt_executed/
  // runtime_execution/consent_collected); 10 keys MUST stay false (tool_executed,
  // filesystem_write, federation, receipt_mint, public_network, external_call,
  // chain_advance, node_connection, raw_corpus_scan, raw_data).
  const boundary = buildRuntimeEmissionBoundary({
    network_used: fetchAttempted,
    prompt_executed: fetchAttempted,
    runtime_execution_performed: fetchAttempted,
    model_loaded: completed,
    model_invocation_performed: completed,
    consent_collected: consentVerified === true,
  });

  let responseTextPreview;
  if (responseTextPreviewOverride !== undefined) {
    responseTextPreview = responseTextPreviewOverride;
  } else if (typeof responseText === "string") {
    responseTextPreview =
      responseText.slice(0, RESPONSE_PREVIEW_CHARS) +
      (responseText.length > RESPONSE_PREVIEW_CHARS ? " […truncated]" : "");
  } else {
    responseTextPreview = null;
  }

  return Object.freeze({
    schema: DEMA_TALK_LOOP_LIVE_RESULT_SCHEMA,
    truth_label: truthLabel,
    mode: "invocation_result",
    invocation_status: status,
    provider,
    model,
    target_endpoint: endpoint,
    endpoint_family: endpointFamily,
    required_consent: requiredConsent,
    consent_phrase_verified: consentVerified === true,
    error_reason: errorReason,
    response_text_preview: responseTextPreview,
    response_length_chars:
      typeof responseText === "string" ? responseText.length : 0,
    duration_ms: typeof durationMs === "number" ? durationMs : null,
    // Per ADR-015: a model output is NEVER an authority signal.
    verdict_role: "suggestion",
    prompt_safety_verdict: promptSafetyVerdict,
    response_safety_verdict: responseSafetyVerdict,
    boundary,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
  });
}

export async function invokeDemaTalkLive({
  provider = null,
  model = "",
  prompt = "",
  consentPhrase = "",
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = undefined,
} = {}) {
  const modelSafe = typeof model === "string" ? model : "";
  const promptSafe = typeof prompt === "string" ? prompt : "";
  const consentSafe = typeof consentPhrase === "string" ? consentPhrase : "";
  const timeoutSafe =
    typeof timeoutMs === "number" && timeoutMs > 0 && timeoutMs <= 600000
      ? timeoutMs
      : DEFAULT_TIMEOUT_MS;

  // Resolve provider via the router — single source for base_url, endpoint
  // family, localhost verdict, whitelist verdict, and the consent phrase.
  const route = buildLocalLlmProviderRoute({
    provider,
    model: modelSafe,
    prompt: promptSafe,
  });

  // Gate 0: known provider. The router already refuses unknown providers with
  // NO silent fallback — honor that here.
  if (route.router_status !== "preview_ready") {
    return buildResult({
      status: "refused",
      truthLabel: "INVOCATION_REFUSED",
      provider: null,
      model: modelSafe,
      errorReason: `unknown_provider · '${route.requested_provider}' · invocation refused (no silent fallback)`,
    });
  }

  const base = {
    provider: route.selected_provider,
    model: modelSafe,
    endpoint: route.provider_base_url,
    endpointFamily: route.endpoint_family,
    requiredConsent: route.consent_phrase,
  };
  const refuse = (errorReason, consentVerified = false) =>
    buildResult({ ...base, status: "refused", truthLabel: "INVOCATION_REFUSED", consentVerified, errorReason });

  // Gate 1: localhost-bound
  if (!route.target_is_localhost) return refuse("endpoint_not_localhost · invocation refused");
  // Gate 2: model in whitelist (the router's normalized verdict)
  if (!route.model_allowed)
    return refuse(`model_not_in_whitelist · '${modelSafe}' · invocation refused`);
  // Gate 3: prompt within bounds
  if (promptSafe.length === 0) return refuse("prompt_empty · invocation refused");
  if (route.prompt_too_long)
    return refuse(`prompt_too_long · > ${LLM_ADAPTER_MAX_PROMPT_LENGTH} · invocation refused`);
  // Gate 4: consent phrase EXACT (provider-qualified) — the router's phrase
  if (consentSafe !== route.consent_phrase)
    return refuse(
      `consent_phrase_mismatch · required exact string: '${route.consent_phrase}' · invocation refused`,
    );

  // Gate 5: inbound prompt safety (reuse the hardened Layer-1 scan).
  //
  // CONSERVATIVE BY DESIGN for this first live crossing: a prompt that contains
  // a literal local PATH (/home/…, .ssh, .env) or a secret-shaped string is
  // refused BEFORE any call. Honest tradeoff to surface to the operator: this
  // also blocks the natural "summarize /home/me/notes.txt" prompt even though
  // the model is local + suggestion-only. Loosening path-blocking (while keeping
  // secret-blocking) for the localhost talk path is a deliberate follow-up
  // decision, NOT something to relax on the way into the first live invocation.
  const promptVerdict = evaluateArtifactSafety(promptSafe).verdict;
  if (promptVerdict !== "PUBLIC_SAFE") {
    return buildResult({
      ...base,
      status: "blocked",
      truthLabel: "INVOCATION_BLOCKED",
      consentVerified: true,
      promptSafetyVerdict: promptVerdict,
      errorReason: `inbound_prompt_safety · ${promptVerdict} · your prompt contains a literal path or secret-shaped string Dema will not send to a model (even a local one) · rephrase without the literal path/secret · blocked before any call`,
    });
  }

  // NOTE (1C deferral): the sibling invokeLocalLLM carries an in-process
  // consent-replay guard (ADR-018 §S6). This CLI path is one process per run, so
  // replay is not reachable here; programmatic in-process reuse is not guarded
  // yet. Restore the freshness guard if invokeDemaTalkLive gains a long-lived
  // in-process caller.

  const fetcher = fetchImpl || globalThis.fetch;
  if (typeof fetcher !== "function") {
    return buildResult({
      ...base,
      status: "failed",
      truthLabel: "INVOCATION_FAILED",
      consentVerified: true,
      promptSafetyVerdict: promptVerdict,
      errorReason: "fetch_not_available · runtime missing fetch primitive",
    });
  }

  // Endpoint dispatch by family. OpenAI-compatible (LM Studio / llama.cpp) →
  // /chat/completions with a messages array; Ollama legacy → native /api/generate.
  const isOpenAi = route.endpoint_family === "openai_compatible";
  const url = isOpenAi
    ? `${route.provider_base_url}/chat/completions`
    : `${route.provider_base_url}/api/generate`;
  const requestBody = isOpenAi
    ? { model: modelSafe, messages: [{ role: "user", content: promptSafe }], stream: false }
    : { model: modelSafe, prompt: promptSafe, stream: false };

  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutSafe);
  try {
    const response = await fetcher(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    clearTimeout(timeoutHandle);

    if (!response.ok) {
      return buildResult({
        ...base,
        status: "failed",
        truthLabel: "INVOCATION_FAILED",
        consentVerified: true,
        fetchAttempted: true,
        promptSafetyVerdict: promptVerdict,
        durationMs: Date.now() - startedAt,
        errorReason: `http_status_${response.status} · ${response.statusText || "unknown"}`,
      });
    }

    let body;
    try {
      body = await response.json();
    } catch (parseErr) {
      return buildResult({
        ...base,
        status: "failed",
        truthLabel: "INVOCATION_FAILED",
        consentVerified: true,
        fetchAttempted: true,
        promptSafetyVerdict: promptVerdict,
        durationMs: Date.now() - startedAt,
        errorReason: `response_not_json · ${String(parseErr).slice(0, 200)}`,
      });
    }

    const responseText = isOpenAi
      ? body?.choices?.[0]?.message?.content
      : body?.response;
    if (typeof responseText !== "string") {
      return buildResult({
        ...base,
        status: "failed",
        truthLabel: "INVOCATION_FAILED",
        consentVerified: true,
        fetchAttempted: true,
        promptSafetyVerdict: promptVerdict,
        durationMs: Date.now() - startedAt,
        errorReason: "malformed_response_payload · 200 OK but no string content",
      });
    }

    // Outbound Layer-1 scan — redact a non-public response rather than surface it.
    const responseVerdict = evaluateArtifactSafety(responseText).verdict;
    const override =
      responseVerdict !== "PUBLIC_SAFE" && responseText
        ? `[REDACTED: ${responseVerdict}]`
        : undefined;
    return buildResult({
      ...base,
      status: "completed",
      truthLabel: "MEASURED",
      consentVerified: true,
      completed: true,
      fetchAttempted: true,
      responseText,
      durationMs: Date.now() - startedAt,
      promptSafetyVerdict: promptVerdict,
      responseSafetyVerdict: responseVerdict,
      responseTextPreviewOverride: override,
    });
  } catch (err) {
    clearTimeout(timeoutHandle);
    const unreachable =
      err?.code === "ECONNREFUSED" || /ECONNREFUSED|refused/i.test(String(err));
    const errorClass =
      err?.name === "AbortError"
        ? `timeout_after_${timeoutSafe}ms`
        : unreachable
          ? `provider_unreachable · ${route.selected_provider} not reachable at ${route.provider_base_url} · start it or try --provider llamacpp (no silent fallback to another provider)`
          : `network_error · ${String(err).slice(0, 200)}`;
    return buildResult({
      ...base,
      status: "failed",
      truthLabel: "INVOCATION_FAILED",
      consentVerified: true,
      fetchAttempted: true,
      promptSafetyVerdict: promptVerdict,
      durationMs: Date.now() - startedAt,
      errorReason: errorClass,
    });
  }
}
