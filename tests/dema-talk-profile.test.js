import test from "node:test";
import assert from "node:assert/strict";
import { buildLocalLlmFleetReadiness } from "../packages/core/src/local-llm-fleet-readiness.js";
import {
  buildDemaTalkProfilePreview,
  resolveTalkProfileFromReadiness,
  DEMA_TALK_PROFILE_SCHEMA,
  DEMA_TALK_PROFILE_TRUTH_LABEL,
  SUPPORTED_TALK_PROFILES,
} from "../packages/core/src/dema-talk-profile.js";

function frozenProbes(overrides = {}) {
  return {
    ollama: {
      provider: "ollama",
      endpoint: "http://127.0.0.1:11434",
      reachable: true,
      error: null,
      installed_model_ids: ["whiterabbitneo-v3:7b-q4_K_M"],
      loaded_model_ids: ["whiterabbitneo-v3:7b-q4_K_M"],
      load_observability: "ollama_ps",
      ...overrides.ollama,
    },
    lmstudio: {
      provider: "lmstudio",
      endpoint: "http://127.0.0.1:1234/v1",
      reachable: true,
      error: null,
      installed_model_ids: ["qwen/qwen3.5-9b"],
      loaded_model_ids: [],
      load_observability: "catalog_only",
      ...overrides.lmstudio,
    },
    llamacpp: {
      provider: "llamacpp",
      endpoint: "http://127.0.0.1:8080/v1",
      reachable: false,
      error: "ECONNREFUSED",
      installed_model_ids: [],
      loaded_model_ids: [],
      load_observability: "server_singleton",
      ...overrides.llamacpp,
    },
    disk_gguf_candidates: [],
  };
}

function readinessFixture(overrides = {}) {
  return buildLocalLlmFleetReadiness({
    provider_probes: frozenProbes(overrides),
    generated_at_iso: "2026-06-25T12:00:00.000Z",
    env: { DEMA_TALK_PROVIDER: "ollama", DEMA_TALK_MODEL: "whiterabbitneo-v3:7b-q4_K_M" },
  });
}

test("schema + truth label + deterministic JSON shape", () => {
  const readiness = readinessFixture();
  const a = buildDemaTalkProfilePreview({
    profile: "canon",
    readiness,
    prompt: "what is SAT?",
  });
  const b = buildDemaTalkProfilePreview({
    profile: "canon",
    readiness,
    prompt: "what is SAT?",
  });
  assert.equal(a.schema, DEMA_TALK_PROFILE_SCHEMA);
  assert.equal(a.truth_label, DEMA_TALK_PROFILE_TRUTH_LABEL);
  assert.deepEqual(a, b);
  assert.equal(a.model_invoked, false);
  assert.equal(a.boundary.model_invocation_performed, false);
});

test("profile canon resolves provider/model from readiness fixture", () => {
  const readiness = readinessFixture();
  const p = buildDemaTalkProfilePreview({
    profile: "canon",
    readiness,
    prompt: "what is SAT?",
  });
  assert.equal(p.ok, true);
  assert.equal(p.profile, "canon");
  assert.equal(p.resolved_provider, "ollama");
  assert.equal(p.resolved_model, "whiterabbitneo-v3:7b-q4_K_M");
  assert.equal(p.live_talk_status, "ready");
  assert.equal(
    p.consent_phrase,
    "GO: invoke local LLM via ollama at whiterabbitneo-v3:7b-q4_K_M",
  );
});

test("profile fast resolves provider/model from readiness fixture", () => {
  const readiness = readinessFixture();
  const p = buildDemaTalkProfilePreview({
    profile: "fast",
    readiness,
    prompt: "hi",
  });
  assert.equal(p.ok, true);
  assert.equal(p.profile, "fast");
  assert.equal(p.resolved_provider, "ollama");
  assert.equal(p.resolved_model, "whiterabbitneo-v3:7b-q4_K_M");
  assert.equal(p.selection_reason, "ollama_first_loaded_model");
});

test("blocked profile returns clear blocking reason", () => {
  const readiness = buildLocalLlmFleetReadiness({
    provider_probes: frozenProbes({
      ollama: {
        reachable: true,
        installed_model_ids: ["qwen2.5:7b"],
        loaded_model_ids: [],
      },
    }),
    generated_at_iso: "2026-06-25T12:00:00.000Z",
  });
  const p = buildDemaTalkProfilePreview({
    profile: "fast",
    readiness,
    prompt: "hi",
  });
  assert.equal(p.live_talk_status, "blocked");
  assert.equal(p.blocking_reason, "model_not_loaded");
  assert.ok(p.consent_phrase?.startsWith("GO: invoke local LLM via "));
});

test("consent phrase remains exact provider/model-bound", () => {
  const readiness = readinessFixture();
  const p = buildDemaTalkProfilePreview({ profile: "canon", readiness, prompt: "x" });
  assert.equal(p.consent_required, p.consent_phrase);
  assert.match(p.consent_phrase, /^GO: invoke local LLM via ollama at /);
});

test("unknown profile is rejected", () => {
  const readiness = readinessFixture();
  const p = buildDemaTalkProfilePreview({ profile: "turbo", readiness, prompt: "x" });
  assert.equal(p.ok, false);
  assert.match(p.error, /^unknown_talk_profile:/);
  assert.deepEqual(p.known_profiles, SUPPORTED_TALK_PROFILES);
});

test("resolveTalkProfileFromReadiness maps canon and fast keys", () => {
  const readiness = readinessFixture();
  const canon = resolveTalkProfileFromReadiness({ profile: "canon", readiness });
  const fast = resolveTalkProfileFromReadiness({ profile: "fast", readiness });
  assert.equal(canon.readiness_key, "preferred_canon_qa");
  assert.equal(fast.readiness_key, "preferred_fast_reply");
});

test("explicit --model/--provider override profile resolution in preview", () => {
  const readiness = readinessFixture();
  const p = buildDemaTalkProfilePreview({
    profile: "canon",
    readiness,
    prompt: "x",
    provider: "lmstudio",
    model: "gemma3",
  });
  assert.equal(p.resolved_provider, "lmstudio");
  assert.equal(p.resolved_model, "gemma3");
  assert.equal(p.profile_resolved_provider, "ollama");
});
