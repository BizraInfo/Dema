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

test("isLocalUrl: only localhost passes", () => {
  assert.equal(isLocalUrl("http://127.0.0.1:11434"), true);
  assert.equal(isLocalUrl("http://localhost:8080"), true);
  assert.equal(isLocalUrl("http://10.0.0.5:11434"), false);
  assert.equal(isLocalUrl("http://evil.example.com"), false);
});
