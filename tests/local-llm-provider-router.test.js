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
  PROVIDER_EXACT_ID_ALLOWLIST,
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
  // publisher/model normalization now applies ONLY to providers WITHOUT an
  // exact-id world (masquerade fix, w5mc6928b): the default (lmstudio) refuses a
  // publisher-prefixed non-exact id, so the strip path is exercised on ollama.
  assert.equal(
    buildLocalLlmProviderRoute({ provider: "ollama", model: "publisher/qwen2.5" })
      .model_allowed,
    true,
  );
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

// --- LM-STUDIO-EXACT-ID-ALLOWLIST-1A (Design 3) ---
// A per-provider frozen EXACT-id allow-list, consulted before the (Ollama-derived)
// family check, so real LM Studio ids (publisher/model with dashes) are permitted
// without family normalization (which the design rejected as masquerade-prone).

test("lmstudio exact ids are allowed via the exact-id path (default provider)", () => {
  for (const id of [
    "google/gemma-4-12b",
    "google/gemma-4-e4b",
    "zai-org/glm-4.6v-flash",
    "qwen/qwen3.5-9b",
    "qwen3.6-35b-a3b-uncensored-hauhaucs-aggressive",
  ]) {
    const r = buildLocalLlmProviderRoute({ provider: "lmstudio", model: id });
    assert.equal(r.model_allowed, true, `${id} should be allowed`);
    assert.equal(r.model_allow_reason, "exact_id");
  }
});

test("an lmstudio id with NO provider defaults to lmstudio and is allowed", () => {
  const r = buildLocalLlmProviderRoute({ model: "google/gemma-4-12b" });
  assert.equal(r.model_allowed, true);
  assert.equal(r.model_allow_reason, "exact_id");
});

test("exact-id match is exact — a near-miss id is NOT allowed (no masquerade)", () => {
  // wrong case / wrong publisher / partial — none normalize into an allow
  for (const id of [
    "google/gemma-4-12B",
    "evil/gemma-4-12b",
    "gemma-4-12b",
    "google/gemma-4-12b-extra",
  ]) {
    const r = buildLocalLlmProviderRoute({ provider: "lmstudio", model: id });
    assert.equal(r.model_allowed, false, `${id} must not be allowed`);
  }
});

test("the LM Studio embedding model is intentionally excluded from the chat allow-list", () => {
  const r = buildLocalLlmProviderRoute({
    provider: "lmstudio",
    model: "text-embedding-nomic-embed-text-v1.5",
  });
  assert.equal(r.model_allowed, false);
});

test("prototype keys cannot masquerade as allow-list entries", () => {
  for (const id of ["__proto__", "hasOwnProperty", "constructor", "toString"]) {
    const r = buildLocalLlmProviderRoute({ provider: "lmstudio", model: id });
    assert.equal(r.model_allowed, false, `${id} must not be allowed`);
  }
});

test("the judged id equals the dispatched id (trim consistency — no judge/dispatch drift)", () => {
  const r = buildLocalLlmProviderRoute({
    provider: "lmstudio",
    model: "  google/gemma-4-12b  ",
  });
  assert.equal(r.model_allowed, true);
  assert.equal(r.model, "google/gemma-4-12b"); // dispatched value == judged value
});

test("the family path still allows Ollama-family models (regression)", () => {
  assert.equal(
    buildLocalLlmProviderRoute({ model: "qwen2.5" }).model_allow_reason,
    "family",
  );
  assert.equal(buildLocalLlmProviderRoute({ model: "gpt-4" }).model_allowed, false);
});

test("PROVIDER_EXACT_ID_ALLOWLIST is exported and deeply frozen", () => {
  assert.ok(Object.isFrozen(PROVIDER_EXACT_ID_ALLOWLIST));
  assert.ok(Object.isFrozen(PROVIDER_EXACT_ID_ALLOWLIST.lmstudio));
  assert.equal(PROVIDER_EXACT_ID_ALLOWLIST.lmstudio["google/gemma-4-12b"], true);
});

// Verify-and-regrade (w5mc6928b) CONFIRMED finding: a provider WITH an exact-id
// world (lmstudio) must NOT publisher-strip in the legacy family fallback, or
// `evil/<family>` masquerades into an allowed family.
test("publisher-prefixed masquerade is REFUSED for a provider with an exact-id list", () => {
  for (const model of [
    "evil/llama",
    "attacker/gemma4",
    "../gemma4",
    "publisher/qwen2.5",
  ]) {
    const r = buildLocalLlmProviderRoute({ provider: "lmstudio", model });
    assert.equal(r.model_allowed, false, `${model} must be refused (masquerade)`);
  }
});

test("bare family tokens still resolve via family for an exact-id provider (no publisher to strip)", () => {
  const r = buildLocalLlmProviderRoute({ provider: "lmstudio", model: "qwen2.5" });
  assert.equal(r.model_allowed, true);
  assert.equal(r.model_allow_reason, "family");
});

test("a provider WITHOUT an exact-id list (ollama) keeps the publisher-stripping family fallback", () => {
  const r = buildLocalLlmProviderRoute({ provider: "ollama", model: "publisher/qwen2.5" });
  assert.equal(r.model_allowed, true);
  assert.equal(r.model_allow_reason, "family");
});

// --- LLAMACPP-EXACT-ID-ALLOWLIST-1A ---
// The always-on llama.cpp service (systemd llama-gemma4-12b, 127.0.0.1:8080)
// serves exactly one chat id, verified against /v1/models on 2026-08-19:
// `gemma4-12b`. Registering it flips llamacpp into its OWN exact-id world
// (masquerade fix, w5mc6928b): the publisher-strip family fallback turns OFF
// for llamacpp — a stronger artifact buys stronger checking, never weaker.

test("llamacpp exact id gemma4-12b is allowed via the exact-id path", () => {
  const r = buildLocalLlmProviderRoute({ provider: "llamacpp", model: "gemma4-12b" });
  assert.equal(r.model_allowed, true);
  assert.equal(r.model_allow_reason, "exact_id");
  assert.equal(r.consent_phrase, "GO: invoke local LLM via llamacpp at gemma4-12b");
});

test("llamacpp is now an exact-id world — publisher-prefixed names no longer strip-match", () => {
  // BEFORE this slice `unsloth/gemma4` passed via publisher-strip → family.
  // Declaring an exact id closes that masquerade door for llamacpp too.
  const r = buildLocalLlmProviderRoute({ provider: "llamacpp", model: "unsloth/gemma4" });
  assert.equal(r.model_allowed, false);
  assert.equal(r.model_allow_reason, null);
});

test("llamacpp bare family tokens still pass (family fallback intact for bare ids)", () => {
  for (const id of ["gemma4", "qwen2.5", "llama3.1:8b"]) {
    const r = buildLocalLlmProviderRoute({ provider: "llamacpp", model: id });
    assert.equal(r.model_allowed, true, `${id} should still be family-allowed`);
    assert.equal(r.model_allow_reason, "family");
  }
});

test("ollama keeps the publisher-strip fallback — unaffected by llamacpp's exact-id world", () => {
  const r = buildLocalLlmProviderRoute({ provider: "ollama", model: "publisher/qwen2.5" });
  assert.equal(r.model_allowed, true);
  assert.equal(r.model_allow_reason, "family");
});
