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

test("isLocalUrl: only localhost passes", () => {
  assert.equal(isLocalUrl("http://127.0.0.1:11434"), true);
  assert.equal(isLocalUrl("http://localhost:8080"), true);
  assert.equal(isLocalUrl("http://10.0.0.5:11434"), false);
  assert.equal(isLocalUrl("http://evil.example.com"), false);
});
