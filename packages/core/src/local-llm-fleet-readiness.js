// DEMA-LOCAL-LLM-FLEET-READINESS-1A — read-only local LLM fleet readiness.
//
// Composes provider probe snapshots into a deterministic readiness report:
// which localhost providers answer, which models are installed vs loaded,
// preferred routes for canon QA vs fast reply, exact consent phrases, and
// blocking reasons. Makes NO model invocation, starts no daemon, writes no
// config, and performs no silent fallback.

import { buildPreviewBoundary } from "./preview-boundary.js";
import {
  LOCAL_LLM_PROVIDER_REGISTRY,
  buildLocalLlmProviderRoute,
} from "./local-llm-provider-router.js";
import { buildRoutingRecommendations } from "../../../packages/models/src/model-routing.js";

export const LOCAL_LLM_FLEET_READINESS_SCHEMA =
  "bizra.dema.local_llm_fleet_readiness.v0.1";
export const LOCAL_LLM_FLEET_READINESS_TRUTH_LABEL =
  "DEMA_LOCAL_LLM_FLEET_READINESS_READ_ONLY";

const CANON_QA_CANDIDATES = Object.freeze([
  { provider: "lmstudio", model: "qwen/qwen3.5-9b", reason: "canon_qa_preferred_9b" },
  { provider: "lmstudio", model: "google/gemma-4-e4b", reason: "canon_qa_gemma_e4b" },
  { provider: "lmstudio", model: "google/gemma-4-12b", reason: "canon_qa_gemma_12b" },
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "No model was invoked, loaded into VRAM, or prompted — this is a read-only readiness report.",
  "LM Studio loaded-model state is not observable without inference; a catalog match may still block live talk until the operator loads the model in LM Studio.",
  "This does not change dema talk defaults, auto-dispatch traffic, or write operator config.",
  "Reachability was probed at report time only; a provider may stop or start after this report.",
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function normalizeIdSet(ids) {
  if (!Array.isArray(ids)) return new Set();
  return new Set(ids.filter((id) => typeof id === "string" && id.length > 0));
}

function providerEntryFromRegistry(provider) {
  const entry = LOCAL_LLM_PROVIDER_REGISTRY[provider];
  if (!entry) return null;
  return Object.freeze({
    provider,
    endpoint: entry.base_url,
    endpoint_family: entry.endpoint_family,
    role: entry.role,
    is_legacy: entry.is_legacy === true,
  });
}

function assessTalkRoute({ provider, model, probe }) {
  const route = buildLocalLlmProviderRoute({ provider, model });
  const installed = normalizeIdSet(probe?.installed_model_ids);
  const loaded = normalizeIdSet(probe?.loaded_model_ids);
  const base = Object.freeze({
    provider,
    model,
    endpoint: route.provider_base_url,
    model_allowed: route.model_allowed === true,
    model_allow_reason: route.model_allow_reason,
    consent_phrase: route.consent_phrase,
    consent_phrase_status: route.consent_phrase_status,
    provider_reachable: probe?.reachable === true,
    installed_model_ids: Object.freeze([...installed].sort()),
    loaded_model_ids: Object.freeze([...loaded].sort()),
    load_observability: probe?.load_observability ?? "unknown",
  });

  if (route.router_status === "unknown_provider_refused") {
    return deepFreeze({
      ...base,
      live_talk_status: "blocked",
      blocking_reason: "unknown_provider",
    });
  }
  if (!route.model_allowed) {
    return deepFreeze({
      ...base,
      live_talk_status: "blocked",
      blocking_reason: "model_not_allowlisted",
    });
  }
  if (probe?.reachable !== true) {
    return deepFreeze({
      ...base,
      live_talk_status: "blocked",
      blocking_reason: "provider_unreachable",
      provider_error: probe?.error ?? null,
    });
  }
  if (provider === "ollama") {
    if (!installed.has(model)) {
      return deepFreeze({
        ...base,
        live_talk_status: "blocked",
        blocking_reason: "model_not_installed",
      });
    }
    if (!loaded.has(model)) {
      return deepFreeze({
        ...base,
        live_talk_status: "blocked",
        blocking_reason: "model_not_loaded",
      });
    }
    return deepFreeze({ ...base, live_talk_status: "ready", blocking_reason: null });
  }
  if (provider === "lmstudio") {
    if (!installed.has(model)) {
      return deepFreeze({
        ...base,
        live_talk_status: "blocked",
        blocking_reason: "model_not_installed",
      });
    }
    return deepFreeze({
      ...base,
      live_talk_status: "blocked",
      blocking_reason: "model_not_loaded_in_lm_studio",
      operator_note:
        "Model is in the LM Studio catalog but loaded VRAM state is not observable without inference. Load the model in LM Studio, then retry live talk.",
    });
  }
  if (provider === "llamacpp") {
    if (!installed.has(model)) {
      return deepFreeze({
        ...base,
        live_talk_status: "blocked",
        blocking_reason: "model_not_served_by_llamacpp_server",
      });
    }
    if (loaded.size > 0 && !loaded.has(model)) {
      return deepFreeze({
        ...base,
        live_talk_status: "blocked",
        blocking_reason: "model_not_loaded",
      });
    }
    return deepFreeze({ ...base, live_talk_status: "ready", blocking_reason: null });
  }
  return deepFreeze({
    ...base,
    live_talk_status: "blocked",
    blocking_reason: "provider_unsupported",
  });
}

function mapInventoryToProvidersShape(inventoryProviders) {
  const ollama = inventoryProviders?.ollama ?? {};
  const lmStudio = inventoryProviders?.lm_studio ?? {};
  const downloads = inventoryProviders?.downloads ?? {};
  return {
    ollama: {
      provider: "ollama",
      endpoint: ollama.url ?? LOCAL_LLM_PROVIDER_REGISTRY.ollama.base_url,
      reachable: ollama.reachable === true,
      error: ollama.error ?? null,
      installed_model_ids: (ollama.models ?? []).map((m) => m.id),
      loaded_model_ids: (ollama.active ?? []).map((m) => m.id),
      load_observability: "ollama_ps",
    },
    lmstudio: {
      provider: "lmstudio",
      endpoint: lmStudio.url
        ? `${String(lmStudio.url).replace(/\/$/, "")}/v1`
        : LOCAL_LLM_PROVIDER_REGISTRY.lmstudio.base_url,
      reachable: lmStudio.reachable === true,
      error: lmStudio.error ?? null,
      installed_model_ids: (lmStudio.models ?? []).map((m) => m.id),
      loaded_model_ids: [],
      load_observability: "catalog_only",
    },
    llamacpp: null,
    disk_gguf_candidates: (downloads.models ?? []).map((m) => m.id),
  };
}

function pickCanonQaRoute(probes, env = {}) {
  const envProvider =
    typeof env.DEMA_TALK_PROVIDER === "string" ? env.DEMA_TALK_PROVIDER.trim() : "";
  const envModel =
    typeof env.DEMA_TALK_MODEL === "string" ? env.DEMA_TALK_MODEL.trim() : "";
  const ordered = [];
  if (envProvider && envModel) {
    ordered.push({
      provider: envProvider.toLowerCase(),
      model: envModel,
      reason: "operator_env_defaults",
    });
  }
  for (const c of CANON_QA_CANDIDATES) ordered.push(c);
  const ollama = probes.ollama;
  if (ollama?.reachable === true) {
    for (const id of normalizeIdSet(ollama.loaded_model_ids)) {
      if (/qwen|bizra|whiterabbit|gemma/i.test(id)) {
        ordered.push({ provider: "ollama", model: id, reason: "ollama_active_canon_signal" });
      }
    }
    for (const id of normalizeIdSet(ollama.installed_model_ids)) {
      if (/qwen|bizra|whiterabbit|gemma/i.test(id)) {
        ordered.push({ provider: "ollama", model: id, reason: "ollama_installed_canon_signal" });
      }
    }
  }
  const seen = new Set();
  const assessed = [];
  for (const cand of ordered) {
    const key = `${cand.provider}::${cand.model}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const probe = probes[cand.provider];
    const route = assessTalkRoute({
      provider: cand.provider,
      model: cand.model,
      probe,
    });
    assessed.push({ cand, route });
    if (route.live_talk_status === "ready") {
      return deepFreeze({
        role: "canon_qa",
        selection_reason: cand.reason,
        route,
      });
    }
  }
  const first = assessed[0];
  if (first) {
    return deepFreeze({
      role: "canon_qa",
      selection_reason: first.cand.reason,
      route: first.route,
    });
  }
  return deepFreeze({
    role: "canon_qa",
    selection_reason: "no_candidate",
    route: assessTalkRoute({
      provider: "lmstudio",
      model: "qwen/qwen3.5-9b",
      probe: probes.lmstudio,
    }),
  });
}

function pickFastReplyRoute(probes, inventoryProviders) {
  const loadedOllama = [...normalizeIdSet(probes.ollama?.loaded_model_ids)].sort();
  if (loadedOllama.length > 0 && probes.ollama?.reachable === true) {
    return deepFreeze({
      role: "fast_reply",
      selection_reason: "ollama_first_loaded_model",
      route: assessTalkRoute({
        provider: "ollama",
        model: loadedOllama[0],
        probe: probes.ollama,
      }),
    });
  }
  const recs = buildRoutingRecommendations(inventoryProviders ?? {});
  const fast = recs?.fast?.model;
  if (typeof fast === "string" && fast.length > 0) {
    const ollamaIds = normalizeIdSet(probes.ollama?.installed_model_ids);
    const lmIds = normalizeIdSet(probes.lmstudio?.installed_model_ids);
    if (ollamaIds.has(fast)) {
      return deepFreeze({
        role: "fast_reply",
        selection_reason: recs.fast.reason ?? "routing_recommendations_fast",
        route: assessTalkRoute({
          provider: "ollama",
          model: fast,
          probe: probes.ollama,
        }),
      });
    }
    if (lmIds.has(fast)) {
      return deepFreeze({
        role: "fast_reply",
        selection_reason: recs.fast.reason ?? "routing_recommendations_fast",
        route: assessTalkRoute({
          provider: "lmstudio",
          model: fast,
          probe: probes.lmstudio,
        }),
      });
    }
  }
  return deepFreeze({
    role: "fast_reply",
    selection_reason: "no_fast_model_detected",
    route: assessTalkRoute({
      provider: "lmstudio",
      model: "qwen/qwen3.5-9b",
      probe: probes.lmstudio,
    }),
  });
}

function buildProviderReport(probe) {
  if (!probe) {
    return deepFreeze({
      provider: null,
      endpoint: null,
      reachable: false,
      error: "probe_missing",
      installed_model_ids: Object.freeze([]),
      loaded_model_ids: Object.freeze([]),
      load_observability: "unknown",
    });
  }
  return deepFreeze({
    provider: probe.provider,
    endpoint: probe.endpoint,
    reachable: probe.reachable === true,
    error: probe.error ?? null,
    installed_model_ids: Object.freeze(
      [...normalizeIdSet(probe.installed_model_ids)].sort(),
    ),
    loaded_model_ids: Object.freeze([...normalizeIdSet(probe.loaded_model_ids)].sort()),
    load_observability: probe.load_observability ?? "unknown",
  });
}

export function buildLocalLlmFleetReadiness({
  provider_probes = {},
  inventory_providers = null,
  generated_at_iso = "",
  env = {},
} = {}) {
  const probes = {
    lmstudio: provider_probes.lmstudio ?? null,
    llamacpp: provider_probes.llamacpp ?? null,
    ollama: provider_probes.ollama ?? null,
  };
  const inventoryShape =
    inventory_providers ??
    (probes.ollama || probes.lmstudio
      ? {
          ollama: {
            models: (probes.ollama?.installed_model_ids ?? []).map((id) => ({ id })),
            active: (probes.ollama?.loaded_model_ids ?? []).map((id) => ({ id })),
          },
          lm_studio: {
            models: (probes.lmstudio?.installed_model_ids ?? []).map((id) => ({
              id,
            })),
          },
          downloads: {
            models: (provider_probes.disk_gguf_candidates ?? []).map((id) => ({
              id,
            })),
          },
        }
      : {});

  const providers = Object.freeze(
    ["lmstudio", "llamacpp", "ollama"].map((name) =>
      buildProviderReport(probes[name] ?? providerEntryFromRegistry(name)),
    ),
  );

  const preferred_canon_qa = pickCanonQaRoute(probes, env);
  const preferred_fast_reply = pickFastReplyRoute(probes, inventoryShape);

  const blocking_for_live_talk = [];
  for (const pref of [preferred_canon_qa, preferred_fast_reply]) {
    if (pref.route.live_talk_status === "blocked" && pref.route.blocking_reason) {
      blocking_for_live_talk.push(
        `${pref.role}:${pref.route.blocking_reason}`,
      );
    }
  }

  return deepFreeze({
    schema: LOCAL_LLM_FLEET_READINESS_SCHEMA,
    truth_label: LOCAL_LLM_FLEET_READINESS_TRUTH_LABEL,
    generated_at_iso: typeof generated_at_iso === "string" ? generated_at_iso : "",
    providers,
    installed_disk_gguf_candidates: Object.freeze(
      [...(provider_probes.disk_gguf_candidates ?? [])].sort(),
    ),
    preferred_canon_qa,
    preferred_fast_reply,
    blocking_for_live_talk: Object.freeze([...new Set(blocking_for_live_talk)].sort()),
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
    boundary: buildPreviewBoundary(),
  });
}

export function buildLocalLlmFleetReadinessFromInventory({
  inventory,
  llamacpp_probe = null,
  generated_at_iso = "",
  env = {},
} = {}) {
  const mapped = mapInventoryToProvidersShape(inventory?.providers ?? {});
  return buildLocalLlmFleetReadiness({
    provider_probes: {
      ollama: mapped.ollama,
      lmstudio: mapped.lmstudio,
      llamacpp: llamacpp_probe,
      disk_gguf_candidates: mapped.disk_gguf_candidates,
    },
    inventory_providers: inventory?.providers ?? null,
    generated_at_iso:
      generated_at_iso ||
      (typeof inventory?.generated_at === "string" ? inventory.generated_at : ""),
    env,
  });
}
