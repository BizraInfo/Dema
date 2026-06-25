// DEMA-LOCAL-LLM-FLEET-READINESS-1A — localhost probe gatherer (apps/cli I/O tier).
// Read-only GET probes only. No chat completion, no model load, no writes.

import { collectModelInventory } from "../../../../packages/models/src/model-inventory.js";
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
  urlFor,
} from "../../../../packages/models/src/model-common.js";

const DEFAULT_LLAMACPP_URL = "http://127.0.0.1:8080";

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

async function probeLlamacpp({
  baseUrl = process.env.DEMA_LLAMACPP_URL || DEFAULT_LLAMACPP_URL,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const root = String(baseUrl).replace(/\/$/, "");
  const endpoint = `${root}/v1`;
  if (!isLocalUrl(root)) {
    return {
      provider: "llamacpp",
      endpoint,
      reachable: false,
      error: "non-local endpoint refused",
      installed_model_ids: [],
      loaded_model_ids: [],
      load_observability: "server_singleton",
    };
  }
  const modelsResponse = await fetchJson(urlFor(endpoint, "/models"), {
    fetchImpl,
    timeoutMs,
  });
  const ids = modelsResponse.ok
    ? (modelsResponse.json?.data ?? [])
        .map((m) => m?.id)
        .filter((id) => typeof id === "string" && id.length > 0)
    : [];
  return {
    provider: "llamacpp",
    endpoint,
    reachable: modelsResponse.ok,
    error: modelsResponse.ok ? null : modelsResponse.error,
    installed_model_ids: ids,
    loaded_model_ids: ids,
    load_observability: "server_singleton",
  };
}

export async function collectLocalLlmFleetReadiness({
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  ollamaUrl = process.env.DEMA_OLLAMA_URL || DEFAULT_OLLAMA_URL,
  lmStudioUrl = process.env.DEMA_LM_STUDIO_URL || DEFAULT_LM_STUDIO_URL,
  generated_at_iso = new Date().toISOString(),
  env = process.env,
} = {}) {
  const [inventory, llamacpp_probe] = await Promise.all([
    collectModelInventory({
      ollamaUrl,
      lmStudioUrl,
      fetchImpl,
      timeoutMs,
      now: new Date(generated_at_iso),
    }),
    probeLlamacpp({ fetchImpl, timeoutMs }),
  ]);

  const report = buildLocalLlmFleetReadinessFromInventory({
    inventory,
    llamacpp_probe,
    generated_at_iso,
    env,
  });

  return Object.freeze({
    ...report,
    inventory_schema: inventory.schema,
    inventory_truth_label: inventory.truth_label,
    probe_boundary: Object.freeze({
      local_http_probe_performed: true,
      inference_invoked: false,
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
