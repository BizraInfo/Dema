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

// A returned answer must stay comfortably inside canonical JSON's per-string
// cap (65536 bytes) so a receipt built from it can never fail canonicalization
// after the fact. 32 KiB keeps 50% headroom.
export const DEMA_TALK_LOOP_RESPONSE_TEXT_MAX_BYTES = 32768;
// The raw HTTP body is capped well above the answer cap (JSON envelope, usage
// counters, provider metadata) but still far below anything that could exhaust
// memory if a local server streams without end.
export const DEMA_TALK_LOOP_RESPONSE_BODY_MAX_BYTES = 262144;

const DEFAULT_TIMEOUT_MS = 60000;
const RESPONSE_PREVIEW_CHARS = 500;

const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder("utf-8");

function utf8ByteLength(value) {
  return UTF8_ENCODER.encode(value).byteLength;
}

// Read the response body through its stream so the cap is enforced DURING
// transfer. The moment the cap is passed the buffered chunks are dropped and
// the source is cancelled, so an oversized or hostile localhost server can
// never be fully buffered — let alone retained in a result or a receipt.
async function readBoundedBody(response) {
  const stream = response.body;
  if (!stream || typeof stream.getReader !== "function") {
    const whole = await response.text();
    return utf8ByteLength(whole) > DEMA_TALK_LOOP_RESPONSE_BODY_MAX_BYTES
      ? { tooLarge: true }
      : { text: whole };
  }
  const reader = stream.getReader();
  let chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > DEMA_TALK_LOOP_RESPONSE_BODY_MAX_BYTES) {
        chunks = [];
        await reader.cancel("response_body_too_large");
        return { tooLarge: true };
      }
      chunks.push(value);
    }
  } catch (err) {
    try {
      await reader.cancel("response_stream_error");
    } catch {
      /* the stream is already torn down; the read error is what matters */
    }
    return { error: String(err).slice(0, 200) };
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: UTF8_DECODER.decode(merged) };
}

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
  includeResponseText = false,
  promptLengthChars = null,
  providerReportedModel = null,
  providerModelStatus = "unreported",
  requestUrl = null,
  observedResponseUrl = null,
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

  const responseTextFull =
    responseTextPreviewOverride !== undefined
      ? responseTextPreviewOverride
      : responseText;

  return Object.freeze({
    schema: DEMA_TALK_LOOP_LIVE_RESULT_SCHEMA,
    truth_label: truthLabel,
    mode: "invocation_result",
    invocation_status: status,
    provider,
    model,
    // `model` stays the legacy requested-model field; these three record WHICH
    // model actually answered, so a provider silently serving a different model
    // is visible instead of being laundered into the receipt.
    requested_model: model,
    provider_reported_model: providerReportedModel,
    provider_model_status: providerModelStatus,
    target_endpoint: endpoint,
    endpoint_family: endpointFamily,
    request_url: requestUrl,
    observed_response_url: observedResponseUrl,
    required_consent: requiredConsent,
    consent_phrase_verified: consentVerified === true,
    error_reason: errorReason,
    response_text_preview: responseTextPreview,
    prompt_length_chars:
      typeof promptLengthChars === "number" ? promptLengthChars : null,
    response_length_chars:
      typeof responseText === "string" ? responseText.length : 0,
    duration_ms: typeof durationMs === "number" ? durationMs : null,
    // Per ADR-015: a model output is NEVER an authority signal.
    verdict_role: "suggestion",
    prompt_safety_verdict: promptSafetyVerdict,
    response_safety_verdict: responseSafetyVerdict,
    ...(includeResponseText === true &&
    typeof responseTextFull === "string"
      ? { response_text: responseTextFull }
      : {}),
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
  includeResponseText = false,
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
      promptLengthChars: promptSafe.length,
      errorReason: `unknown_provider · '${route.requested_provider}' · invocation refused (no silent fallback)`,
    });
  }

  const base = {
    provider: route.selected_provider,
    model: modelSafe,
    endpoint: route.provider_base_url,
    endpointFamily: route.endpoint_family,
    requiredConsent: route.consent_phrase,
    promptLengthChars: promptSafe.length,
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

  // Gate 5: inbound prompt safety (Layer-1 scan), LOOSENED for the local talk
  // path per operator decision. A user naming their OWN local file (a PATH_LEAK
  // finding) on a localhost-only, no-receipt, suggestion-only call is
  // INTENTIONAL, not a leak — so PATH_LEAK findings do NOT block here. Every
  // other blocker still refuses: SECRET_LIKE (don't feed a live secret to a
  // model, even a local one), CLAIM_OVERREACH, and SCHEMA.
  const promptBlockers = evaluateArtifactSafety(promptSafe).findings.filter(
    (f) => f.severity === "BLOCKER" && f.kind !== "PATH_LEAK",
  );
  if (promptBlockers.length > 0) {
    const kinds = [...new Set(promptBlockers.map((f) => f.kind))].join("+");
    return buildResult({
      ...base,
      status: "blocked",
      truthLabel: "INVOCATION_BLOCKED",
      consentVerified: true,
      promptSafetyVerdict: kinds,
      errorReason: `inbound_prompt_safety · ${kinds} · your prompt contains a secret-shaped string or a forbidden live-claim Dema will not send to a model · rephrase without it · blocked before any call`,
    });
  }
  // A local path in the prompt was allowed through — record that honestly.
  const promptVerdict = "LOCAL_TALK_OK";

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
      // Fail closed on any 3xx: a compromised localhost LLM server must not be
      // able to bounce this call off-localhost via a redirect.
      redirect: "error",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    clearTimeout(timeoutHandle);

    const wire = {
      requestUrl: url,
      observedResponseUrl:
        typeof response.url === "string" && response.url ? response.url : null,
    };
    const failWire = (errorReason, extra = {}) =>
      buildResult({
        ...base,
        ...wire,
        ...extra,
        status: "failed",
        truthLabel: "INVOCATION_FAILED",
        consentVerified: true,
        fetchAttempted: true,
        promptSafetyVerdict: promptVerdict,
        durationMs: Date.now() - startedAt,
        errorReason,
      });

    if (!response.ok) {
      return failWire(
        `http_status_${response.status} · ${response.statusText || "unknown"}`,
      );
    }

    const bounded = await readBoundedBody(response);
    if (bounded.tooLarge) {
      return failWire(
        `response_body_too_large · > ${DEMA_TALK_LOOP_RESPONSE_BODY_MAX_BYTES} bytes · stream cancelled, body discarded`,
      );
    }
    if (bounded.error) {
      return failWire(`response_stream_error · ${bounded.error}`);
    }

    let body;
    try {
      body = JSON.parse(bounded.text);
    } catch (parseErr) {
      return failWire(`response_not_json · ${String(parseErr).slice(0, 200)}`);
    }

    // Which model actually answered? A provider that serves a different model
    // than the consented one breaks the exact provider+model consent, so the
    // answer is withheld rather than attributed to the requested model.
    const reported = typeof body?.model === "string" ? body.model.trim() : "";
    const providerReportedModel = reported || null;
    const providerModelStatus =
      providerReportedModel === null
        ? "unreported"
        : providerReportedModel === modelSafe
          ? "reported_match"
          : "reported_mismatch";
    const identity = { providerReportedModel, providerModelStatus };
    if (providerModelStatus === "reported_mismatch") {
      return failWire(
        `provider_model_mismatch · consented '${modelSafe}' · provider reported '${providerReportedModel}' · answer withheld`,
        identity,
      );
    }

    const responseText = isOpenAi
      ? body?.choices?.[0]?.message?.content
      : body?.response;
    if (typeof responseText !== "string") {
      return failWire(
        "malformed_response_payload · 200 OK but no string content",
        identity,
      );
    }
    if (utf8ByteLength(responseText) > DEMA_TALK_LOOP_RESPONSE_TEXT_MAX_BYTES) {
      return failWire(
        `response_text_too_large · > ${DEMA_TALK_LOOP_RESPONSE_TEXT_MAX_BYTES} bytes · answer withheld`,
        identity,
      );
    }

    // Outbound Layer-1 scan, same loosening as inbound: a local PATH the model
    // echoes back is shown (local, no receipt); a SECRET_LIKE / CLAIM_OVERREACH /
    // SCHEMA blocker is redacted rather than surfaced.
    const responseBlockers = evaluateArtifactSafety(responseText).findings.filter(
      (f) => f.severity === "BLOCKER" && f.kind !== "PATH_LEAK",
    );
    const responseVerdict =
      responseBlockers.length === 0
        ? "LOCAL_TALK_OK"
        : [...new Set(responseBlockers.map((f) => f.kind))].join("+");
    const override =
      responseBlockers.length > 0 && responseText
        ? `[REDACTED: ${responseVerdict}]`
        : undefined;
    return buildResult({
      ...base,
      ...wire,
      ...identity,
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
      includeResponseText,
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
      requestUrl: url,
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
