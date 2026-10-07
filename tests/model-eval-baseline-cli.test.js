// MODEL-EVAL-BASELINE-1A — gatherer tests (injected fetch; zero real network).
// Proves: local discovery, suite run via POST, NO raw-output leak, localhost
// refusal of non-local providers.

import { test } from "node:test";
import assert from "node:assert/strict";
import { discoverLocalModels, gatherModelEvalBaseline, isLocalUrl } from "../apps/cli/src/commands/eval-baseline-gatherer.js";
import { buildModelEvalBaseline, verifyModelEvalBaseline } from "../packages/core/src/model-eval-baseline.js";

const env = { OLLAMA_URL: "http://127.0.0.1:11434", LMSTUDIO_URL: "http://127.0.0.1:1234", LLAMACPP_URL: "http://127.0.0.1:8080" };

function fakeFetch(log = []) {
  return async (url, opts = {}) => {
    log.push({ url, method: opts.method || "GET" });
    if (url.endsWith("/api/tags")) return { ok: true, status: 200, json: async () => ({ models: [{ name: "gemma4:e4b" }] }) };
    if (url.endsWith("/api/generate")) return { ok: true, status: 200, json: async () => ({ response: '{"ok":true}\n/home/secret/path leaked', usage: { total: 9 } }) };
    throw new Error("ECONNREFUSED"); // lm_studio + llamacpp /v1/models
  };
}

function fakeClock() {
  let c = 1000;
  return () => ({ getTime: () => (c += 50), toISOString: () => "2026-06-24T00:00:00.000Z" });
}

test("discoverLocalModels finds the local pool + marks unreachable providers", async () => {
  const obs = await discoverLocalModels({ fetchImpl: fakeFetch(), env });
  assert.equal(obs.provider_discovery.ollama.reachable, true);
  assert.equal(obs.provider_discovery.ollama.model_count, 1);
  assert.equal(obs.provider_discovery.lm_studio.reachable, false);
  assert.ok(obs.models.some((m) => m.key === "ollama:gemma4:e4b"));
});

test("gatherModelEvalBaseline runs the suite via POST → build verifies; NO raw-output leak; paths elided", async () => {
  const log = [];
  const obs = await gatherModelEvalBaseline({ fetchImpl: fakeFetch(log), env, time: fakeClock(), maxModels: 2 });
  assert.ok(log.some((l) => l.method === "POST"), "generation uses POST");
  const report = buildModelEvalBaseline(obs);
  assert.equal(verifyModelEvalBaseline(report).valid, true);
  const json = JSON.stringify(report);
  assert.doesNotMatch(json, /"raw_output"|"completion_text"|"response_text"/);
  assert.doesNotMatch(json, /\/home\/secret/, "paths must be elided from the sample");
});

test("non-local provider URL is REFUSED, never fetched (no off-box egress)", async () => {
  const log = [];
  await discoverLocalModels({ fetchImpl: fakeFetch(log), env: { ...env, OLLAMA_URL: "http://evil.example.com:11434" } });
  assert.ok(!log.some((l) => l.url.includes("evil.example.com")), "non-local provider never fetched");
});

test("warm-up gates the suite — a model that never loads is marked unreachable without running the 6-task suite", async () => {
  const log = [];
  const coldFetch = async (url, opts = {}) => {
    log.push({ url, method: opts.method || "GET" });
    if (url.endsWith("/api/tags")) return { ok: true, status: 200, json: async () => ({ models: [{ name: "gemma4:26b" }] }) };
    if (url.endsWith("/api/generate")) throw new Error("ETIMEDOUT"); // model never finishes loading
    throw new Error("ECONNREFUSED");
  };
  const obs = await gatherModelEvalBaseline({ fetchImpl: coldFetch, env, time: fakeClock(), maxModels: 1, warmupTimeoutMs: 10, timeoutMs: 10 });
  const genPosts = log.filter((l) => l.url.endsWith("/api/generate") && l.method === "POST");
  assert.equal(genPosts.length, 1, "only the warm-up probe runs; the 6-task suite is skipped when warm-up fails");
  const entry = obs.results_by_model["ollama:gemma4:26b"];
  for (const t of Object.values(entry.tasks)) assert.equal(t.reachable, false);
});

test("fair coverage — chosen models interleave across providers so no provider is starved", async () => {
  const twoProv = async (url, opts = {}) => {
    if (url.endsWith("/api/tags")) return { ok: true, status: 200, json: async () => ({ models: [{ name: "a" }, { name: "b" }] }) };
    if (url.endsWith(":1234/v1/models")) return { ok: true, status: 200, json: async () => ({ data: [{ id: "x" }, { id: "y" }] }) };
    if (url.endsWith("/api/generate")) return { ok: true, status: 200, json: async () => ({ response: '{"ok":true}' }) };
    if (url.endsWith("/v1/chat/completions")) return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }) };
    throw new Error("ECONNREFUSED"); // llamacpp /v1/models
  };
  const obs = await gatherModelEvalBaseline({ fetchImpl: twoProv, env, time: fakeClock(), maxModels: 2, warmupTimeoutMs: 50, timeoutMs: 50 });
  const provsHit = obs.models_tested.map((k) => k.split(":")[0]);
  assert.ok(provsHit.includes("ollama") && provsHit.includes("lm_studio"), "both providers represented in the 2-model slice");
});

test("embedding-only model ids are skipped (cannot run a chat suite)", async () => {
  const withEmbed = async (url, opts = {}) => {
    if (url.endsWith("/api/tags")) return { ok: true, status: 200, json: async () => ({ models: [{ name: "nomic-embed-text" }, { name: "gemma4:e4b" }] }) };
    if (url.endsWith("/api/generate")) return { ok: true, status: 200, json: async () => ({ response: '{"ok":true}' }) };
    throw new Error("ECONNREFUSED");
  };
  const obs = await gatherModelEvalBaseline({ fetchImpl: withEmbed, env, time: fakeClock(), maxModels: 5, warmupTimeoutMs: 50, timeoutMs: 50 });
  assert.ok(!obs.models_tested.some((k) => /embed/i.test(k)), "embedding ids are not scored");
  assert.ok(obs.models_tested.includes("ollama:gemma4:e4b"));
});

// MODEL-ARTIFACT-IDENTITY-INGRESS-1A — artifact identity is established BEFORE
// maxModels is applied, so alias tags cannot consume evaluation slots or race
// themselves on latency. Measured 2026-07-30 on this box: llama3.1:8b,
// llama3.2:3b and mistral:latest are one blob; gemma4:26b and
// gemma4:26b-bizra-16k share weights but differ in params (separate artifacts).
function tagsFetch(models) {
  return async (url) => {
    if (url.endsWith("/api/tags")) return { ok: true, status: 200, json: async () => ({ models }) };
    if (url.endsWith("/api/generate")) return { ok: true, status: 200, json: async () => ({ response: '{"ok":true}' }) };
    throw new Error("ECONNREFUSED");
  };
}

test("alias tags sharing one provider digest collapse to ONE artifact before maxModels", async () => {
  const fetchImpl = tagsFetch([
    { name: "llama3.1:8b", digest: "dde5aa3fc5ff" },
    { name: "llama3.2:3b", digest: "dde5aa3fc5ff" },
    { name: "whiterabbitneo-v3:7b-q4_K_M", digest: "aaaa1111bbbb" },
  ]);
  const obs = await gatherModelEvalBaseline({ fetchImpl, env, time: fakeClock(), maxModels: 2, warmupTimeoutMs: 50, timeoutMs: 50 });
  assert.equal(obs.artifact_identity.alias_count, 3);
  assert.equal(obs.artifact_identity.unique_artifact_count, 2);
  assert.equal(obs.models_tested.length, 2, "two slots, two DISTINCT artifacts");
  assert.ok(obs.models_tested.includes("ollama:whiterabbitneo-v3:7b-q4_K_M"), "the third tag is not starved by two aliases of the first");
  const canonical = obs.models_tested.find((k) => k.startsWith("ollama:llama3."));
  assert.deepEqual(obs.artifact_identity.aliases_by_model[canonical], ["ollama:llama3.1:8b", "ollama:llama3.2:3b"]);
  assert.equal(obs.artifact_identity.identity_status_by_model[canonical], "PROVIDER_DIGEST");
});

test("a missing provider digest is UNVERIFIED_PROVIDER_IDENTITY and is never merged", async () => {
  const fetchImpl = tagsFetch([{ name: "a" }, { name: "b" }]);
  const obs = await gatherModelEvalBaseline({ fetchImpl, env, time: fakeClock(), maxModels: 5, warmupTimeoutMs: 50, timeoutMs: 50 });
  assert.equal(obs.artifact_identity.unique_artifact_count, 2, "unverified identities stay distinct — never collapsed on absence");
  for (const k of obs.models_tested) {
    assert.equal(obs.artifact_identity.identity_status_by_model[k], "UNVERIFIED_PROVIDER_IDENTITY");
    assert.deepEqual(obs.artifact_identity.aliases_by_model[k], [k]);
  }
});

test("execution-relevant variants sharing weights stay separate (distinct provider digests)", async () => {
  const fetchImpl = tagsFetch([
    { name: "gemma4:26b", digest: "7121486771cb" },
    { name: "gemma4:26b-bizra-16k", digest: "34bb5ab01051" },
  ]);
  const obs = await gatherModelEvalBaseline({ fetchImpl, env, time: fakeClock(), maxModels: 5, warmupTimeoutMs: 50, timeoutMs: 50 });
  assert.equal(obs.artifact_identity.unique_artifact_count, 2, "same weights, different params layer → two artifacts");
});

test("an identical digest string under two providers is never merged across providers", async () => {
  const crossProv = async (url) => {
    if (url.endsWith("/api/tags")) return { ok: true, status: 200, json: async () => ({ models: [{ name: "shared", digest: "deadbeef" }] }) };
    if (url.endsWith(":1234/v1/models")) return { ok: true, status: 200, json: async () => ({ data: [{ id: "shared", digest: "deadbeef" }] }) };
    if (url.endsWith("/api/generate")) return { ok: true, status: 200, json: async () => ({ response: '{"ok":true}' }) };
    if (url.endsWith("/v1/chat/completions")) return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }) };
    throw new Error("ECONNREFUSED");
  };
  const obs = await gatherModelEvalBaseline({ fetchImpl: crossProv, env, time: fakeClock(), maxModels: 5, warmupTimeoutMs: 50, timeoutMs: 50 });
  assert.equal(obs.artifact_identity.unique_artifact_count, 2, "identity is scoped per provider — a digest namespace is not shared");
});

test("one artifact is benchmarked exactly once — an alias cannot race itself on latency", async () => {
  const log = [];
  const fetchImpl = async (url, opts = {}) => {
    log.push({ url, method: opts.method || "GET" });
    if (url.endsWith("/api/tags")) {
      return { ok: true, status: 200, json: async () => ({ models: [{ name: "x:1", digest: "same" }, { name: "x:2", digest: "same" }] }) };
    }
    if (url.endsWith("/api/generate")) return { ok: true, status: 200, json: async () => ({ response: '{"ok":true}' }) };
    throw new Error("ECONNREFUSED");
  };
  const obs = await gatherModelEvalBaseline({ fetchImpl, env, time: fakeClock(), maxModels: 5, warmupTimeoutMs: 50, timeoutMs: 50 });
  assert.equal(obs.models_tested.length, 1);
  const genPosts = log.filter((l) => l.url.endsWith("/api/generate") && l.method === "POST");
  assert.equal(genPosts.length, 1 + 6, "one warm-up + one 6-task suite, not two");
});

test("discoverLocalModels carries artifact identity onto every model entry", async () => {
  const obs = await discoverLocalModels({ fetchImpl: tagsFetch([{ name: "gemma4:e4b", digest: "cafe1234" }]), env });
  const m = obs.models.find((x) => x.key === "ollama:gemma4:e4b");
  assert.equal(m.identity, "cafe1234");
  assert.equal(m.identity_status, "PROVIDER_DIGEST");
});

test("isLocalUrl: only localhost passes", () => {
  assert.equal(isLocalUrl("http://127.0.0.1:11434"), true);
  assert.equal(isLocalUrl("http://localhost:8080"), true);
  assert.equal(isLocalUrl("http://10.0.0.5:11434"), false);
  assert.equal(isLocalUrl("http://evil.example.com"), false);
});
