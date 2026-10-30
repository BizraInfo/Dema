// DEMA-LOCAL-LLM-FLEET-READINESS-1A — localhost probe gatherer (apps/cli I/O tier).
// Default readiness does not call a model. --probe-completion opts in to one
// localhost llama.cpp chat completion; llama.cpp stays not-ready without it.
// LLAMACPP_KEY is sent as a bearer header on that opt-in call and never logged.
// No config write.

import { collectModelInventory } from "../../../../packages/models/src/model-inventory.js";
import { llamacppAuthorizationHeader } from "../../../../packages/core/src/dema-talk-loop-live.js";
import {
  buildLocalLlmFleetReadinessFromInventory,
  LOCAL_LLM_FLEET_READINESS_SCHEMA,
  LOCAL_LLM_FLEET_READINESS_TRUTH_LABEL,
} from "../../../../packages/core/src/local-llm-fleet-readiness.js";
import {
  DEFAULT_LM_STUDIO_URL,
  DEFAULT_OLLAMA_URL,
  DEFAULT_TIMEOUT_MS,
  isLocalUrl,
} from "../../../../packages/models/src/model-common.js";

const DEFAULT_LLAMACPP_URL = "http://127.0.0.1:8080";
const LLAMACPP_COMPLETION_TIMEOUT_MS = 20000;

async function fetchJson(url, { fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!isLocalUrl(url)) {
    return { ok: false, error: "non-local endpoint refused", json: null };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}`, json: null };
    }
    const contentType = response.headers?.get?.("content-type") ?? "";
    if (contentType && !contentType.includes("application/json")) {
      return { ok: false, error: `non-JSON response (${contentType})`, json: null };
    }
    return { ok: true, error: null, json: await response.json() };
  } catch (err) {
    return { ok: false, error: err?.message ?? String(err), json: null };
  } finally {
    clearTimeout(timer);
  }
}

async function postJson(url, body, { fetchImpl = fetch, timeoutMs = LLAMACPP_COMPLETION_TIMEOUT_MS, authorization = null } = {}) {
  if (!isLocalUrl(url)) {
    return { ok: false, error: "non-local endpoint refused", json: null };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = { "content-type": "application/json" };
  if (authorization) headers.Authorization = authorization;
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      redirect: "error",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}`, json: null };
    }
    const contentType = response.headers?.get?.("content-type") ?? "";
    if (contentType && !contentType.includes("application/json")) {
      return { ok: false, error: `non-JSON response (${contentType})`, json: null };
    }
    return { ok: true, error: null, json: await response.json() };
  } catch (err) {
    return { ok: false, error: err?.message ?? String(err), json: null };
  } finally {
    clearTimeout(timer);
  }
}

function completionContent(json) {
  const content = json?.choices?.[0]?.message?.content;
  return typeof content === "string" && content.trim().length > 0 ? content : null;
}

async function probeLlamacpp({
  baseUrl,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  completionTimeoutMs = LLAMACPP_COMPLETION_TIMEOUT_MS,
  env = process.env,
  probeCompletion = false,
} = {}) {
  const configured =
    (typeof baseUrl === "string" && baseUrl.trim()) ||
    (typeof env?.DEMA_LLAMACPP_URL === "string" && env.DEMA_LLAMACPP_URL.trim()) ||
    DEFAULT_LLAMACPP_URL;
  const root = String(configured).replace(/\/$/, "");
  const endpoint = `${root}/v1`;
  const refused = {
    provider: "llamacpp",
    endpoint,
    reachable: false,
    error: "non-local endpoint refused",
    installed_model_ids: [],
    loaded_model_ids: [],
    completion_proven: false,
    completion_attempted: false,
    load_observability: "models_list_only",
  };
  if (!isLocalUrl(root)) return refused;

  // Absolute "/models" against a /v1 base resolves to /models, not /v1/models.
  const modelsResponse = await fetchJson(`${endpoint}/models`, {
    fetchImpl,
    timeoutMs,
  });
  const ids = modelsResponse.ok
    ? (modelsResponse.json?.data ?? [])
        .map((m) => m?.id)
        .filter((id) => typeof id === "string" && id.length > 0)
    : [];
  const preferred =
    typeof env?.DEMA_TALK_MODEL === "string" ? env.DEMA_TALK_MODEL.trim() : "";
  const model = ids.includes(preferred) ? preferred : ids[0];
  let completion_proven = false;
  let completion_attempted = false;
  let completion_error = null;
  if (
    probeCompletion === true &&
    modelsResponse.ok &&
    typeof model === "string" &&
    model.length > 0
  ) {
    completion_attempted = true;
    const completion = await postJson(`${endpoint}/chat/completions`, {
      model,
      messages: [{ role: "user", content: "ready" }],
      max_tokens: 1,
      stream: false,
    }, {
      fetchImpl,
      timeoutMs: completionTimeoutMs,
      authorization: llamacppAuthorizationHeader(env),
    });
    completion_proven = completion.ok && completionContent(completion.json) !== null;
    completion_error = completion_proven ? null : completion.error ?? "completion_not_proven";
  }
  return {
    provider: "llamacpp",
    endpoint,
    reachable: modelsResponse.ok,
    error: modelsResponse.ok ? completion_error : modelsResponse.error,
    installed_model_ids: ids,
    loaded_model_ids: completion_proven ? [model] : [],
    completion_proven,
    completion_attempted,
    load_observability: completion_proven ? "chat_completion" : "models_list_only",
  };
}

function claimsAfterProbe(report, completionAttempted) {
  if (!completionAttempted) return report.what_this_does_not_prove;
  const rest = report.what_this_does_not_prove.filter(
    (line) => !line.startsWith("No model was invoked"),
  );
  return Object.freeze([
    "The llama.cpp lane sent one localhost chat completion to decide ready. That reply is not canon, not a receipt, and not authority.",
    ...rest,
  ]);
}

export async function collectLocalLlmFleetReadiness({
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  ollamaUrl = process.env.DEMA_OLLAMA_URL || DEFAULT_OLLAMA_URL,
  lmStudioUrl = process.env.DEMA_LM_STUDIO_URL || DEFAULT_LM_STUDIO_URL,
  generated_at_iso = new Date().toISOString(),
  env = process.env,
  downloadsRoot,
  tcpBindings,
  probeCompletion = false,
} = {}) {
  const [inventory, llamacpp_probe] = await Promise.all([
    collectModelInventory({
      ollamaUrl,
      lmStudioUrl,
      fetchImpl,
      timeoutMs,
      now: new Date(generated_at_iso),
      ...(downloadsRoot ? { downloadsRoot } : {}),
      ...(tcpBindings ? { tcpBindings } : {}),
    }),
    probeLlamacpp({ fetchImpl, timeoutMs, env, probeCompletion }),
  ]);

  const report = buildLocalLlmFleetReadinessFromInventory({
    inventory,
    llamacpp_probe,
    generated_at_iso,
    env,
  });
  const completionAttempted = llamacpp_probe?.completion_attempted === true;

  return Object.freeze({
    ...report,
    what_this_does_not_prove: claimsAfterProbe(report, completionAttempted),
    inventory_schema: inventory.schema,
    inventory_truth_label: inventory.truth_label,
    probe_boundary: Object.freeze({
      local_http_probe_performed: true,
      inference_invoked: completionAttempted,
      llamacpp_completion_proven: llamacpp_probe?.completion_proven === true,
      model_load_performed: false,
      config_write_performed: false,
      mutation_performed: false,
    }),
  });
}

export {
  LOCAL_LLM_FLEET_READINESS_SCHEMA,
  LOCAL_LLM_FLEET_READINESS_TRUTH_LABEL,
};
