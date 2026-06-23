// PROVIDER-AWARE-MODEL-CATALOG-1A — PURE model-catalog kernel.
//
// Annotates + validates a (provider, model) pairing across the three local
// providers' naming conventions — LM Studio (`publisher/model`), llama.cpp
// (GGUF basename / alias), Ollama legacy (`family:tag`). It surfaces, honestly,
// WHY a name is or is not accepted, which the bare router verdict cannot explain.
//
// Boundaries (the operator's GO): NO subprocess, NO llmfit execution, NO network,
// NO model invocation. Fixed, local, deterministic.
//
// The provider ROUTER stays authoritative: the catalog calls
// buildLocalLlmProviderRoute to obtain the AUTHORITATIVE model_allowed verdict
// and REPORTS it (router_model_allowed). The catalog never overrides the gate —
// it only adds provider-aware parsing + annotation on top.

import { buildLocalLlmProviderRoute } from "./local-llm-provider-router.js";
import { buildPreviewBoundary } from "./preview-boundary.js";

export const MODEL_CATALOG_ENTRY_SCHEMA = "bizra.dema.model_catalog_entry.v0.1";

const TRUTH_LABEL = "DEMA_MODEL_CATALOG_LOCAL_ONLY";

const WHAT_THIS_PROVES = Object.freeze([
  "A (provider, model) pairing can be parsed and validated against each local provider's naming convention, locally and deterministically, with no subprocess, no network, and no model call.",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "That the model is installed, downloaded, or reachable in the provider — nothing is scanned or probed; that is the router/live-gate's job at call time.",
  "A new allow-list decision — the router stays authoritative; this catalog reports the router's model_allowed verdict and annotates it, it does not change what is permitted.",
  "That the parsed family/quant is exact — name parsing is a best-effort heuristic over free-form model identifiers.",
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

// Best-effort parse of a free-form model identifier into its parts. Heuristic,
// labelled as such — never asserted as exact.
function parseModelName(raw) {
  const s = typeof raw === "string" ? raw.trim() : "";
  const is_gguf = /\.gguf$/i.test(s);
  let rest = s.replace(/\.gguf$/i, "");

  let publisher = null;
  // Strip at the LAST slash, matching the router's whitelist token exactly
  // (the router normalizes via the part after the last "/"). This guarantees
  // parsed.family is the SAME unit the router gates on — so the refusal reason
  // can never cite a different token than the one actually checked.
  const slash = rest.lastIndexOf("/");
  if (slash >= 0) {
    publisher = rest.slice(0, slash);
    rest = rest.slice(slash + 1);
  }

  // Ollama-style tag: family:tag
  let tag = null;
  const colon = rest.indexOf(":");
  if (colon >= 0) {
    tag = rest.slice(colon + 1);
    rest = rest.slice(0, colon);
  }

  // Quant marker (q4_k_m, q8_0, …) anywhere in the tag or the remaining id.
  const quantMatch = `${tag ?? ""} ${rest}`.match(/q\d+(?:_[a-z0-9]+)*/i);
  const quant = quantMatch ? quantMatch[0] : null;

  // Family = the router's gate token (model id after publisher strip, before the
  // tag). Deliberately NOT a friendlier short form: citing a token the router
  // does NOT gate on would let the refusal reason name an allow-listed family
  // and assert a false "why" (a ZANN defect this catalog exists to avoid).
  const family = rest;

  return Object.freeze({ publisher, family, tag, quant, is_gguf });
}

function classifyShape(parsed) {
  if (parsed.is_gguf) return "llamacpp_gguf";
  if (parsed.publisher) return "lmstudio_publisher_model";
  if (parsed.tag) return "ollama_family_tag";
  return "bare_id";
}

// Is this name shape the one the provider's API conventionally uses? Advisory.
function shapeTypicalForProvider(provider, parsed, raw) {
  const hasSlash = raw.includes("/");
  switch (provider) {
    case "ollama":
      // Ollama uses family[:tag], never publisher/model, never a .gguf basename.
      return !hasSlash && !parsed.is_gguf;
    case "lmstudio":
      // LM Studio API ids are publisher/model or a bare id — not the Ollama
      // :tag form, and the loaded id is not a .gguf basename.
      return !parsed.is_gguf && parsed.tag === null;
    case "llamacpp":
      // llama.cpp loads by a GGUF basename or a bare alias.
      return parsed.is_gguf || (!hasSlash && parsed.tag === null);
    default:
      return false;
  }
}

export function buildModelCatalogEntry({ provider = null, model = "" } = {}) {
  const modelSafe = typeof model === "string" ? model.trim() : "";
  const parsed = parseModelName(modelSafe);
  const name_shape = classifyShape(parsed);

  // AUTHORITATIVE verdict comes from the router — reported, never overridden.
  const route = buildLocalLlmProviderRoute({ provider, model: modelSafe });
  const provider_known = route.router_status === "preview_ready";
  const router_model_allowed = route.model_allowed === true;
  const shape_typical = provider_known
    ? shapeTypicalForProvider(route.selected_provider, parsed, modelSafe)
    : false;

  const annotations = [];
  let compatibility;
  if (!provider_known) {
    compatibility = "unknown_provider";
    annotations.push(
      `Unknown provider '${route.requested_provider}' — known providers: ${route.known_providers.join(", ")}.`,
    );
  } else if (!router_model_allowed) {
    compatibility = "family_not_in_allowlist";
    annotations.push(
      `The router refuses '${modelSafe}': it is in neither the ${route.selected_provider} exact-id allow-list nor the (Ollama-derived) family allow-list (family '${parsed.family}'). The router stays authoritative.`,
    );
  } else if (!shape_typical) {
    compatibility = "allowed_atypical_shape";
    annotations.push(
      `Allowed by the router, but the name shape (${name_shape}) is not the ${route.selected_provider} convention — double-check the identifier the provider expects.`,
    );
  } else {
    compatibility = "compatible";
    annotations.push(
      route.model_allow_reason === "exact_id"
        ? `'${modelSafe}' parses as a typical ${route.selected_provider} identifier and matches the ${route.selected_provider} exact-id allow-list.`
        : `'${modelSafe}' parses as a typical ${route.selected_provider} identifier and its family is allow-listed.`,
    );
  }
  if (parsed.is_gguf) {
    annotations.push("GGUF file name detected — family/quant inferred best-effort from the filename.");
  }

  return deepFreeze({
    schema: MODEL_CATALOG_ENTRY_SCHEMA,
    truth_label: TRUTH_LABEL,
    mode: "annotation_only",
    provider: provider_known ? route.selected_provider : null,
    requested_provider: route.requested_provider ?? (provider_known ? route.selected_provider : null),
    provider_known,
    provider_is_legacy: route.provider_is_legacy === true,
    endpoint_family: route.endpoint_family ?? null,
    model: modelSafe,
    name_shape,
    parsed,
    shape_typical_for_provider: shape_typical,
    router_model_allowed,
    compatibility,
    annotations: Object.freeze(annotations),
    next_safe_actions: Object.freeze([
      "fix_provider_or_model_name",
      "use_an_allow_listed_family",
      "proceed_via_router (authoritative)",
    ]),
    boundary: buildPreviewBoundary(),
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
  });
}
