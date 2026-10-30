// DEMA-GEMMA-AUTH-ROUNDTRIP-1A — focused red test.
// Mock fetch only. The sentinel is a fixture, never a real key, and must not
// appear in any result object.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { invokeDemaTalkLive } from "../packages/core/src/dema-talk-loop-live.js";
import { buildLocalLlmProviderRoute } from "../packages/core/src/local-llm-provider-router.js";
import { buildLocalLlmFleetReadiness } from "../packages/core/src/local-llm-fleet-readiness.js";
import { collectLocalLlmFleetReadiness } from "../apps/cli/src/commands/fleet-readiness-gatherer.js";

const SENTINEL = "gemma-roundtrip-probe";

function mockFetch(body, { ok = true, status = 200 } = {}) {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts });
    return {
      ok,
      status,
      statusText: ok ? "OK" : "ERR",
      headers: { get: () => "application/json" },
      json: async () => body,
    };
  };
  fn.calls = calls;
  return fn;
}

function llamacppConsent() {
  return buildLocalLlmProviderRoute({
    provider: "llamacpp",
    model: "gemma4-12b",
    prompt: "ping",
  }).consent_phrase;
}

test("llamacpp live call sends Authorization Bearer from LLAMACPP_KEY and omits the key from the result", async () => {
  const fetchImpl = mockFetch({
    choices: [{ message: { content: "pong" } }],
  });
  const r = await invokeDemaTalkLive({
    provider: "llamacpp",
    model: "gemma4-12b",
    prompt: "ping",
    consentPhrase: llamacppConsent(),
    fetchImpl,
    env: { LLAMACPP_KEY: SENTINEL },
  });
  assert.equal(r.invocation_status, "completed");
  assert.equal(fetchImpl.calls.length, 1);
  assert.equal(
    fetchImpl.calls[0].opts.headers.Authorization,
    `Bearer ${SENTINEL}`,
  );
  assert.equal(JSON.stringify(r).includes(SENTINEL), false);
  assert.match(String(fetchImpl.calls[0].url), /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//);
});

test("llamacpp live call without a key sends no Authorization header", async () => {
  const fetchImpl = mockFetch({
    choices: [{ message: { content: "pong" } }],
  });
  await invokeDemaTalkLive({
    provider: "llamacpp",
    model: "gemma4-12b",
    prompt: "ping",
    consentPhrase: llamacppConsent(),
    fetchImpl,
    env: {},
  });
  assert.equal(fetchImpl.calls.length, 1);
  assert.equal(fetchImpl.calls[0].opts.headers.Authorization, undefined);
});

test("LLAMACPP_KEY is not attached to lmstudio", async () => {
  const fetchImpl = mockFetch({
    choices: [{ message: { content: "pong" } }],
  });
  const route = buildLocalLlmProviderRoute({
    provider: "lmstudio",
    model: "qwen2.5",
    prompt: "ping",
  });
  await invokeDemaTalkLive({
    provider: "lmstudio",
    model: "qwen2.5",
    prompt: "ping",
    consentPhrase: route.consent_phrase,
    fetchImpl,
    env: { LLAMACPP_KEY: SENTINEL },
  });
  assert.equal(fetchImpl.calls[0].opts.headers.Authorization, undefined);
  assert.equal(JSON.stringify(fetchImpl.calls[0].opts).includes(SENTINEL), false);
});

test("llamacpp models-list ids without completion_proven are not ready", () => {
  const r = buildLocalLlmFleetReadiness({
    provider_probes: {
      llamacpp: {
        provider: "llamacpp",
        endpoint: "http://127.0.0.1:8080/v1",
        reachable: true,
        error: null,
        installed_model_ids: ["gemma4-12b"],
        loaded_model_ids: ["gemma4-12b"],
        load_observability: "models_list_only",
      },
    },
    env: {
      DEMA_TALK_PROVIDER: "llamacpp",
      DEMA_TALK_MODEL: "gemma4-12b",
    },
  });
  assert.notEqual(r.preferred_canon_qa.route.live_talk_status, "ready");
  assert.equal(
    r.preferred_canon_qa.route.blocking_reason,
    "llamacpp_completion_not_proven",
  );
  assert.equal(JSON.stringify(r).includes(SENTINEL), false);
});

test("a LLAMACPP_KEY containing a newline is not sent", async () => {
  const fetchImpl = mockFetch({
    choices: [{ message: { content: "pong" } }],
  });
  await invokeDemaTalkLive({
    provider: "llamacpp",
    model: "gemma4-12b",
    prompt: "ping",
    consentPhrase: llamacppConsent(),
    fetchImpl,
    env: { LLAMACPP_KEY: "abc\nbad" },
  });
  assert.equal(fetchImpl.calls[0].opts.headers.Authorization, undefined);
  assert.equal(JSON.stringify(fetchImpl.calls[0].opts).includes("abc"), false);
});

function readinessFetch({ completionStatus, content }) {
  const calls = [];
  const fn = async (url, opts = {}) => {
    const u = String(url);
    calls.push({ url: u, method: opts.method ?? "GET", opts });
    if (u.endsWith("/v1/models")) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({ data: [{ id: "gemma4-12b" }] }),
      };
    }
    if (u.endsWith("/v1/chat/completions")) {
      const ok = completionStatus === 200;
      return {
        ok,
        status: completionStatus,
        statusText: ok ? "OK" : "ERR",
        headers: { get: () => "application/json" },
        json: async () => ({ choices: [{ message: { content } }] }),
      };
    }
    return {
      ok: false,
      status: 503,
      headers: { get: () => "application/json" },
      json: async () => ({}),
    };
  };
  fn.calls = calls;
  return fn;
}

async function withEmptyDownloads(run) {
  const downloadsRoot = await mkdtemp(join(tmpdir(), "dema-gemma-auth-"));
  try {
    return await run(downloadsRoot);
  } finally {
    await rm(downloadsRoot, { recursive: true, force: true });
  }
}

async function collectProbe(fetchImpl, { probeCompletion = false } = {}) {
  return withEmptyDownloads((downloadsRoot) =>
    collectLocalLlmFleetReadiness({
      fetchImpl,
      timeoutMs: 50,
      downloadsRoot,
      tcpBindings: [],
      probeCompletion,
      generated_at_iso: "2026-10-10T00:00:00.000Z",
      ollamaUrl: "http://127.0.0.1:9",
      lmStudioUrl: "http://127.0.0.1:9",
      env: {
        LLAMACPP_KEY: SENTINEL,
        DEMA_TALK_PROVIDER: "llamacpp",
        DEMA_TALK_MODEL: "gemma4-12b",
        DEMA_LLAMACPP_URL: "http://127.0.0.1:8080",
      },
    }),
  );
}

function completionCall(fetchImpl) {
  return fetchImpl.calls.find((call) => call.url.endsWith("/v1/chat/completions"));
}

test("default readiness does not call the model when the models list answers", async () => {
  const fetchImpl = readinessFetch({ completionStatus: 200, content: "pong" });
  const report = await collectProbe(fetchImpl);
  assert.equal(completionCall(fetchImpl), undefined);
  assert.equal(report.probe_boundary.inference_invoked, false);
  assert.equal(report.probe_boundary.llamacpp_completion_proven, false);
  assert.equal(report.preferred_canon_qa.route.live_talk_status, "blocked");
  assert.equal(
    report.preferred_canon_qa.route.blocking_reason,
    "llamacpp_completion_not_proven",
  );
  assert.equal(JSON.stringify(report).includes(SENTINEL), false);
});

test("llama.cpp readiness is not ready when the opted-in completion is refused", async () => {
  const fetchImpl = readinessFetch({ completionStatus: 401, content: "" });
  const report = await collectProbe(fetchImpl, { probeCompletion: true });
  const call = completionCall(fetchImpl);
  assert.ok(call, "one chat completion was attempted");
  assert.equal(call.opts.headers.Authorization, `Bearer ${SENTINEL}`);
  assert.equal(call.url, "http://127.0.0.1:8080/v1/chat/completions");
  assert.equal(report.preferred_canon_qa.route.live_talk_status, "blocked");
  assert.equal(
    report.preferred_canon_qa.route.blocking_reason,
    "llamacpp_completion_not_proven",
  );
  assert.equal(report.probe_boundary.inference_invoked, true);
  assert.equal(report.probe_boundary.llamacpp_completion_proven, false);
  assert.equal(JSON.stringify(report).includes(SENTINEL), false);
});

test("llama.cpp readiness is ready only after an opted-in completion", async () => {
  const fetchImpl = readinessFetch({ completionStatus: 200, content: "pong" });
  const report = await collectProbe(fetchImpl, { probeCompletion: true });
  const call = completionCall(fetchImpl);
  assert.equal(
    fetchImpl.calls.filter((item) => item.url.endsWith("/v1/chat/completions")).length,
    1,
  );
  assert.equal(call.opts.headers.Authorization, `Bearer ${SENTINEL}`);
  assert.equal(report.preferred_canon_qa.route.live_talk_status, "ready");
  assert.equal(report.probe_boundary.llamacpp_completion_proven, true);
  assert.equal(JSON.stringify(report).includes(SENTINEL), false);
  assert.equal(JSON.stringify(report).includes("pong"), false);
});
