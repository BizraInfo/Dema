// PROVIDER-AWARE-MODEL-CATALOG-1A — pure model-catalog kernel tests.
// Annotates + validates a (provider, model) pairing across LM Studio / llama.cpp
// / Ollama-legacy naming. NO subprocess, NO llmfit, NO network, NO model call.
// The provider ROUTER stays authoritative: the catalog REPORTS the router's
// model_allowed verdict and adds provider-aware annotation — it never overrides.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  buildModelCatalogEntry,
  MODEL_CATALOG_ENTRY_SCHEMA,
} from "../packages/core/src/model-catalog.js";
import { buildLocalLlmProviderRoute } from "../packages/core/src/local-llm-provider-router.js";

const MODULE_PATH = fileURLToPath(
  new URL("../packages/core/src/model-catalog.js", import.meta.url),
);

const CANONICAL_EFFECT_KEYS = [
  "model_invocation_performed",
  "network_used",
  "runtime_execution_performed",
  "tool_executed",
  "filesystem_write_performed",
  "external_call_performed",
];

test("ollama family:tag → ollama_family_tag shape, parsed family+tag, compatible", () => {
  const e = buildModelCatalogEntry({ provider: "ollama", model: "qwen2.5:7b" });
  assert.equal(e.provider, "ollama");
  assert.equal(e.name_shape, "ollama_family_tag");
  assert.equal(e.parsed.family, "qwen2.5");
  assert.equal(e.parsed.tag, "7b");
  assert.equal(e.compatibility, "compatible");
});

test("lmstudio publisher/model → publisher parsed; shape typical for lmstudio", () => {
  // Use a REAL allow-listed id: publisher-prefixed names no longer family-
  // masquerade for lmstudio (w5mc6928b), so compatibility comes via exact_id.
  const e = buildModelCatalogEntry({ provider: "lmstudio", model: "qwen/qwen3.5-9b" });
  assert.equal(e.name_shape, "lmstudio_publisher_model");
  assert.equal(e.parsed.publisher, "qwen");
  assert.equal(e.shape_typical_for_provider, true);
  assert.equal(e.compatibility, "compatible"); // exact-id allow-listed
});

test("the KNOWN impedance is surfaced HONESTLY, not hidden", () => {
  // qwen/qwen3-coder: a valid LM Studio shape, but family 'qwen3-coder' is not in
  // the Ollama-derived allow-list → the router refuses it. The catalog must REPORT
  // that verdict and explain WHY (annotation), not silently mark it compatible.
  const e = buildModelCatalogEntry({ provider: "lmstudio", model: "qwen/qwen3-coder" });
  assert.equal(e.router_model_allowed, false);
  assert.equal(e.compatibility, "family_not_in_allowlist");
  assert.match(e.annotations.join(" "), /allow-list|allowlist|Ollama-derived|provider-aware/i);
});

test("llama.cpp GGUF name → llamacpp_gguf shape, is_gguf, quant parsed", () => {
  const e = buildModelCatalogEntry({ provider: "llamacpp", model: "qwen2.5-7b-instruct-q4_k_m.gguf" });
  assert.equal(e.name_shape, "llamacpp_gguf");
  assert.equal(e.parsed.is_gguf, true);
  assert.match(String(e.parsed.quant), /q4_k_m/i);
});

test("unknown provider → unknown_provider, no compatibility claim", () => {
  const e = buildModelCatalogEntry({ provider: "openai", model: "gpt-4" });
  assert.equal(e.provider_known, false);
  assert.equal(e.compatibility, "unknown_provider");
});

test("ROUTER STAYS AUTHORITATIVE — catalog reports the router's exact model_allowed", () => {
  for (const [provider, model] of [
    ["ollama", "qwen2.5:7b"],
    ["lmstudio", "qwen/qwen3-coder"],
    ["llamacpp", "gpt-4"],
  ]) {
    const e = buildModelCatalogEntry({ provider, model });
    const route = buildLocalLlmProviderRoute({ provider, model });
    assert.equal(e.router_model_allowed, route.model_allowed, `${provider}/${model}`);
  }
});

test("refusal reason quotes the ROUTER'S gate token — never a false allow-listed family", () => {
  // Critic catch: a heuristic family split would say `llama-3.1-8b` → family
  // "llama" (which IS allow-listed) and print a false refusal reason. parsed.family
  // must be the exact token the router gates on, so the annotation can't lie.
  const e = buildModelCatalogEntry({ provider: "ollama", model: "llama-3.1-8b" });
  assert.equal(e.router_model_allowed, false);
  assert.equal(e.parsed.family, "llama-3.1-8b"); // NOT "llama"
  assert.equal(e.compatibility, "family_not_in_allowlist");
  const note = e.annotations.join(" ");
  assert.match(note, /llama-3\.1-8b/);
  // It must NOT claim the allow-listed family "llama" is absent.
  assert.doesNotMatch(note, /family 'llama' is not/);
});

test("publisher stripped at the LAST slash (matches the router's whitelist token)", () => {
  const e = buildModelCatalogEntry({ provider: "lmstudio", model: "org/team/qwen2.5" });
  assert.equal(e.parsed.family, "qwen2.5"); // after the LAST slash
  const route = buildLocalLlmProviderRoute({ provider: "lmstudio", model: "org/team/qwen2.5" });
  assert.equal(e.router_model_allowed, route.model_allowed);
});

test("shape mismatch is annotated: an ollama-style tag given to lmstudio", () => {
  const e = buildModelCatalogEntry({ provider: "lmstudio", model: "qwen2.5:7b" });
  // family is allow-listed so the router permits it, but the :tag shape is the
  // Ollama convention, not LM Studio's — surface that as an annotation.
  assert.equal(e.shape_typical_for_provider, false);
  assert.equal(e.compatibility, "allowed_atypical_shape");
});

test("boundary canonical all-false; NO subprocess / network / model call", () => {
  const e = buildModelCatalogEntry({ provider: "ollama", model: "qwen2.5:7b" });
  for (const key of CANONICAL_EFFECT_KEYS) {
    assert.equal(e.boundary[key], false, `boundary.${key} must be false`);
  }
  assert.equal(Object.isFrozen(e), true);
  assert.equal(e.schema, "bizra.dema.model_catalog_entry.v0.1");
  assert.equal(e.schema, MODEL_CATALOG_ENTRY_SCHEMA);
  assert.equal(e.truth_label, "DEMA_MODEL_CATALOG_LOCAL_ONLY");
});

test("module imports no fs/net/http/child_process — pure, no subprocess", () => {
  const source = readFileSync(MODULE_PATH, "utf8");
  assert.doesNotMatch(
    source,
    /from\s+["']node:(fs|fs\/promises|net|http|https|child_process|os)["']/,
  );
  // The whole point: it must NOT shell out (to llmfit or anything else). Guard
  // the actual subprocess primitives, not the documented word "llmfit".
  assert.doesNotMatch(source, /execFile|spawnSync|\bspawn\(|\bexec\(/);
});
