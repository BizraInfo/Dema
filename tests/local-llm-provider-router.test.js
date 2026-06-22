// LOCAL-LLM-PROVIDER-ROUTER-1A — pure provider-router kernel tests.
// Corrects Dema's local-LLM default away from Ollama: LM Studio default,
// llama.cpp fallback, Ollama legacy-optional. Preview only — NO model call, NO
// network, NO auto-detect, NO silent fallback. An unknown provider FAILS CLOSED.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  buildLocalLlmProviderRoute,
  LOCAL_LLM_PROVIDER_ROUTER_SCHEMA,
  DEFAULT_LOCAL_LLM_PROVIDER,
  LOCAL_LLM_PROVIDER_REGISTRY,
} from "../packages/core/src/local-llm-provider-router.js";
import { LLM_ADAPTER_MAX_PROMPT_LENGTH } from "../packages/core/src/llm-adapter.js";

const MODULE_PATH = fileURLToPath(
  new URL("../packages/core/src/local-llm-provider-router.js", import.meta.url),
);

const CANONICAL_EFFECT_KEYS = [
  "model_invocation_performed",
  "model_loaded",
  "prompt_executed",
  "network_used",
  "external_call_performed",
  "runtime_execution_performed",
  "tool_executed",
  "filesystem_write_performed",
  "public_network_used",
];

function assertDeepFrozen(value, label = "value") {
  assert.equal(Object.isFrozen(value), true, `${label} must be frozen`);
  if (!value || typeof value !== "object") return;
  for (const [k, c] of Object.entries(value)) {
    if (c && typeof c === "object") assertDeepFrozen(c, `${label}.${k}`);
  }
}

test("no provider → LM Studio default (NOT Ollama)", () => {
  const r = buildLocalLlmProviderRoute({ model: "qwen2.5" });
  assert.equal(r.selected_provider, "lmstudio");
  assert.equal(DEFAULT_LOCAL_LLM_PROVIDER, "lmstudio");
  assert.equal(r.provider_is_default, true);
  assert.equal(r.provider_base_url, "http://localhost:1234/v1");
  assert.equal(r.endpoint_family, "openai_compatible");
});

test("explicit --provider lmstudio → lmstudio", () => {
  const r = buildLocalLlmProviderRoute({ provider: "lmstudio", model: "qwen2.5" });
  assert.equal(r.selected_provider, "lmstudio");
  assert.equal(r.provider_is_legacy, false);
});

test("explicit --provider llamacpp → llamacpp (fallback role, localhost:8080)", () => {
  const r = buildLocalLlmProviderRoute({ provider: "llamacpp", model: "qwen2.5" });
  assert.equal(r.selected_provider, "llamacpp");
  assert.equal(r.provider_base_url, "http://localhost:8080/v1");
  assert.equal(r.provider_is_default, false);
  assert.equal(r.provider_is_legacy, false);
});

test("explicit --provider ollama → allowed only as optional legacy, never default", () => {
  const r = buildLocalLlmProviderRoute({ provider: "ollama", model: "qwen2.5" });
  assert.equal(r.selected_provider, "ollama");
  assert.equal(r.provider_is_default, false);
  assert.equal(r.provider_is_legacy, true);
  assert.equal(r.provider_base_url, "http://localhost:11434");
});

test("unknown provider → FAIL CLOSED, and NO silent fallback to the default", () => {
  const r = buildLocalLlmProviderRoute({ provider: "openai", model: "qwen2.5" });
  assert.equal(r.router_status, "unknown_provider_refused");
  assert.equal(r.error, "unknown_provider");
  // The crux: it must NOT silently become lmstudio.
  assert.equal(r.selected_provider, null);
  assert.notEqual(r.selected_provider, "lmstudio");
  assert.equal(r.consent_phrase, null);
  assert.ok(r.known_providers.includes("lmstudio"));
});

test("localhost-only enforced on every known provider", () => {
  for (const provider of Object.keys(LOCAL_LLM_PROVIDER_REGISTRY)) {
    const r = buildLocalLlmProviderRoute({ provider, model: "qwen2.5" });
    assert.equal(r.target_is_localhost, true, `${provider} must be localhost`);
  }
});

test("base_url cannot be remote — a caller-supplied base_url is ignored", () => {
  // The router takes NO base_url input; it only selects from the fixed registry.
  const r = buildLocalLlmProviderRoute({
    provider: "lmstudio",
    model: "qwen2.5",
    base_url: "http://evil.example.com/v1",
    ollamaBaseUrl: "http://evil.example.com",
  });
  assert.equal(r.provider_base_url, "http://localhost:1234/v1");
  assert.equal(r.target_is_localhost, true);
});

test("consent phrase includes BOTH provider and model", () => {
  const r = buildLocalLlmProviderRoute({ provider: "llamacpp", model: "qwen2.5" });
  assert.equal(r.consent_phrase, "GO: invoke local LLM via llamacpp at qwen2.5");
  assert.match(r.consent_phrase, /llamacpp/);
  assert.match(r.consent_phrase, /qwen2\.5/);
});

test("model whitelist still applies (and tolerates publisher/model names)", () => {
  assert.equal(buildLocalLlmProviderRoute({ model: "qwen2.5" }).model_allowed, true);
  assert.equal(buildLocalLlmProviderRoute({ model: "llama3.1:8b" }).model_allowed, true);
  // publisher/model (LM Studio shape) is normalized before the family check.
  assert.equal(buildLocalLlmProviderRoute({ model: "publisher/qwen2.5" }).model_allowed, true);
  // a non-whitelisted family is refused.
  assert.equal(buildLocalLlmProviderRoute({ model: "gpt-4" }).model_allowed, false);
  assert.equal(buildLocalLlmProviderRoute({ model: "" }).model_allowed, false);
});

test("prompt bound is preserved", () => {
  assert.equal(buildLocalLlmProviderRoute({ model: "qwen2.5", prompt: "hi" }).prompt_too_long, false);
  const big = buildLocalLlmProviderRoute({
    model: "qwen2.5",
    prompt: "x".repeat(LLM_ADAPTER_MAX_PROMPT_LENGTH + 1),
  });
  assert.equal(big.prompt_too_long, true);
});

test("canonical boundary all-false on every path — no model / network / runtime", () => {
  for (const input of [{ model: "qwen2.5" }, { provider: "ollama", model: "qwen2.5" }, { provider: "nope" }]) {
    const r = buildLocalLlmProviderRoute(input);
    for (const key of CANONICAL_EFFECT_KEYS) {
      assert.equal(r.boundary[key], false, `boundary.${key} must be false`);
    }
  }
});

test("HONESTY — does not claim the provider is reachable or that anything ran", () => {
  const text = buildLocalLlmProviderRoute({ model: "qwen2.5" })
    .what_this_does_not_prove.join(" ");
  assert.match(text, /reachable|running|detect|probe/i);
  assert.match(text, /no model|preview/i);
});

test("the previewed consent phrase is the SAME one the 1B live gate enforces (drift closed)", () => {
  // After DEMA-TALK-LOOP-1B, the router's phrase is produced by the same
  // consentPhraseFor the live gate (invokeDemaTalkLive) checks — so an operator
  // can copy the previewed phrase and it will be accepted.
  const r = buildLocalLlmProviderRoute({ provider: "lmstudio", model: "qwen2.5" });
  assert.equal(r.consent_phrase_status, "enforced_by_live_gate");
  assert.equal(r.consent_phrase, "GO: invoke local LLM via lmstudio at qwen2.5");
  // The preview still cannot prove reachability/installation — that stays honest.
  const text = r.what_this_does_not_prove.join(" ");
  assert.match(text, /reachab|installed|running|succeed/i);
});

test("schema + truth_label exact; deep-frozen", () => {
  const r = buildLocalLlmProviderRoute({ model: "qwen2.5" });
  assert.equal(r.schema, "bizra.dema.local_llm_provider_router.v0.1");
  assert.equal(r.schema, LOCAL_LLM_PROVIDER_ROUTER_SCHEMA);
  assert.equal(r.truth_label, "LOCAL_LLM_PROVIDER_ROUTER_PREVIEW_ONLY");
  assert.equal(r.mode, "preview_only");
  assertDeepFrozen(r, "route");
});

test("module imports no node fs/net/http/child_process/os directly", () => {
  const source = readFileSync(MODULE_PATH, "utf8");
  assert.doesNotMatch(
    source,
    /from\s+["']node:(fs|fs\/promises|net|http|https|child_process|os)["']/,
  );
});
