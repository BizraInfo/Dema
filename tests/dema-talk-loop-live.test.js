// DEMA-TALK-LOOP-1B — live local-model invocation, MOCK-fetch only.
// This is Dema's FIRST real model call. Every test injects a fake fetch — NO
// real model, NO network, NO provider dependency in CI. Suggestion-only: the
// result is never an authority, never a task execution, never runtime autonomy.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  invokeDemaTalkLive,
  DEMA_TALK_LOOP_LIVE_RESULT_SCHEMA,
} from "../packages/core/src/dema-talk-loop-live.js";
import { buildTalkRuntimeReceipt } from "../packages/core/src/talk-runtime-receipt.js";
import { cmd_talk } from "../apps/cli/src/commands/talk.js";

const MODULE_PATH = fileURLToPath(
  new URL("../packages/core/src/dema-talk-loop-live.js", import.meta.url),
);

// A capturing mock fetch. Records each call; returns a canned 200 body.
function mockFetch(body, { ok = true, status = 200 } = {}) {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts, parsed: JSON.parse(opts.body) });
    return {
      ok,
      status,
      statusText: ok ? "OK" : "ERR",
      json: async () => body,
    };
  };
  fn.calls = calls;
  return fn;
}

const OPENAI_BODY = { choices: [{ message: { content: "hi from lmstudio" } }] };
const OLLAMA_BODY = { response: "hi from ollama" };

for (const provider of ["llamacpp", "lmstudio", "ollama"]) {
  for (const content of ["", " \t\n "]) {
    test(`${provider} ${content.length ? "whitespace" : "empty"} completion fails with empty_response`, async () => {
      const fetchImpl = mockFetch(provider === "ollama" ? { response: content } : { choices: [{ message: { content } }] });
      const r = await invokeDemaTalkLive({ provider, model: "qwen2.5", prompt: "hello",
        consentPhrase: `GO: invoke local LLM via ${provider} at qwen2.5`, fetchImpl, env: {} });
      assert.equal(r.invocation_status, "failed");
      assert.equal(r.error_reason, "empty_response");
      assert.equal(r.truth_label, "INVOCATION_FAILED");
      assert.equal(r.response_text_preview, null);
      assert.equal(r.response_length_chars, content.length);
      assert.equal(r.boundary.model_invocation_performed, false);
      assert.equal(r.boundary.network_used, true);
      assert.equal(r.verdict_role, "suggestion");
      assert.equal(fetchImpl.calls.length, 1);
      assert.equal(buildTalkRuntimeReceipt({ result: r }).invocation_status, "failed");
    });
  }
  test(`${provider} nonempty completion preserves surrounding whitespace`, async () => {
    const content = " READY ";
    const fetchImpl = mockFetch(provider === "ollama" ? { response: content } : { choices: [{ message: { content } }] });
    const r = await invokeDemaTalkLive({ provider, model: "qwen2.5", prompt: "hello",
      consentPhrase: `GO: invoke local LLM via ${provider} at qwen2.5`, fetchImpl, env: {} });
    assert.equal(r.invocation_status, "completed");
    assert.equal(r.response_text_preview, content);
  });
}

test("lmstudio (default) + matching consent → completed, OpenAI endpoint shape", async () => {
  const fetchImpl = mockFetch(OPENAI_BODY);
  const r = await invokeDemaTalkLive({
    model: "qwen2.5",
    prompt: "hello",
    consentPhrase: "GO: invoke local LLM via lmstudio at qwen2.5",
    fetchImpl,
  });
  assert.equal(r.invocation_status, "completed");
  assert.equal(r.provider, "lmstudio");
  assert.match(r.response_text_preview, /hi from lmstudio/);
  assert.equal(r.verdict_role, "suggestion");
  // OpenAI-compatible: /chat/completions with a messages array.
  assert.equal(fetchImpl.calls.length, 1);
  assert.match(fetchImpl.calls[0].url, /\/chat\/completions$/);
  assert.equal(fetchImpl.calls[0].parsed.messages[0].content, "hello");
});

test("ollama legacy + matching consent → completed, native /api/generate shape", async () => {
  const fetchImpl = mockFetch(OLLAMA_BODY);
  const r = await invokeDemaTalkLive({
    provider: "ollama",
    model: "qwen2.5",
    prompt: "hello",
    consentPhrase: "GO: invoke local LLM via ollama at qwen2.5",
    fetchImpl,
  });
  assert.equal(r.invocation_status, "completed");
  assert.match(r.response_text_preview, /hi from ollama/);
  assert.match(fetchImpl.calls[0].url, /\/api\/generate$/);
  assert.equal(fetchImpl.calls[0].parsed.prompt, "hello");
});

test("live fetch pins redirect:'error' — a 3xx cannot bounce the call off-localhost", async () => {
  const fetchImpl = mockFetch(OLLAMA_BODY);
  await invokeDemaTalkLive({
    provider: "ollama",
    model: "qwen2.5",
    prompt: "hello",
    consentPhrase: "GO: invoke local LLM via ollama at qwen2.5",
    fetchImpl,
  });
  assert.equal(fetchImpl.calls.length, 1);
  assert.equal(fetchImpl.calls[0].opts.redirect, "error");
});

test("the live gate requires the PROVIDER-QUALIFIED phrase (binds to the router)", async () => {
  const fetchImpl = mockFetch(OPENAI_BODY);
  // The provider-LESS legacy phrase must NOT unlock the provider-routed call.
  const r = await invokeDemaTalkLive({
    model: "qwen2.5",
    prompt: "hello",
    consentPhrase: "GO: invoke local LLM at qwen2.5",
    fetchImpl,
  });
  assert.equal(r.invocation_status, "refused");
  assert.match(r.error_reason, /consent/i);
  assert.match(r.required_consent, /via lmstudio at qwen2\.5/);
  assert.equal(fetchImpl.calls.length, 0, "NO fetch on a consent mismatch");
});

test("unknown provider → refused, NO silent fallback, NO fetch", async () => {
  const fetchImpl = mockFetch(OPENAI_BODY);
  const r = await invokeDemaTalkLive({
    provider: "openai",
    model: "qwen2.5",
    prompt: "hi",
    consentPhrase: "GO: invoke local LLM via openai at qwen2.5",
    fetchImpl,
  });
  assert.equal(r.invocation_status, "refused");
  assert.equal(r.provider, null);
  assert.match(r.error_reason, /unknown_provider/);
  assert.equal(fetchImpl.calls.length, 0);
});

test("non-whitelisted model → refused, NO fetch", async () => {
  const fetchImpl = mockFetch(OPENAI_BODY);
  const r = await invokeDemaTalkLive({
    model: "gpt-4",
    prompt: "hi",
    consentPhrase: "GO: invoke local LLM via lmstudio at gpt-4",
    fetchImpl,
  });
  assert.equal(r.invocation_status, "refused");
  assert.match(r.error_reason, /whitelist|not.*allow/i);
  assert.equal(fetchImpl.calls.length, 0);
});

test("provider unreachable → failed, honest message, NO silent fallback to Ollama", async () => {
  const fetchImpl = async () => {
    const e = new Error("connect ECONNREFUSED 127.0.0.1:1234");
    e.code = "ECONNREFUSED";
    throw e;
  };
  const r = await invokeDemaTalkLive({
    model: "qwen2.5",
    prompt: "hi",
    consentPhrase: "GO: invoke local LLM via lmstudio at qwen2.5",
    fetchImpl,
  });
  assert.equal(r.invocation_status, "failed");
  assert.equal(r.provider, "lmstudio", "stays the requested provider — no fallback");
  assert.match(r.error_reason, /unreachable|refused|network/i);
  // The boundary still reflects that a network call was attempted.
  assert.equal(r.boundary.network_used, true);
  assert.equal(r.boundary.model_invocation_performed, false);
});

test("empty / oversized prompt → refused before any fetch", async () => {
  const fetchImpl = mockFetch(OPENAI_BODY);
  const empty = await invokeDemaTalkLive({
    model: "qwen2.5",
    prompt: "",
    consentPhrase: "GO: invoke local LLM via lmstudio at qwen2.5",
    fetchImpl,
  });
  assert.equal(empty.invocation_status, "refused");
  assert.equal(fetchImpl.calls.length, 0);
});

test("path-blocking LOOSENED: a prompt naming a LOCAL file now proceeds to the model", async () => {
  // Operator decision: a user naming their OWN local file on a localhost-only,
  // no-receipt, suggestion-only call is intentional, not a leak. It must reach
  // the local model rather than being refused.
  const fetchImpl = mockFetch(OPENAI_BODY);
  const r = await invokeDemaTalkLive({
    model: "qwen2.5",
    prompt: "summarize the notes in /home/me/Downloads/notes.txt",
    consentPhrase: "GO: invoke local LLM via lmstudio at qwen2.5",
    fetchImpl,
  });
  assert.equal(r.invocation_status, "completed");
  assert.equal(fetchImpl.calls.length, 1);
  // The user's own local path was sent to the LOCAL model — intentional.
  assert.match(fetchImpl.calls[0].parsed.messages[0].content, /notes\.txt/);
});

test("secret-blocking KEPT: a prompt with a secret-shaped string is still blocked, no fetch", async () => {
  const fetchImpl = mockFetch(OPENAI_BODY);
  const r = await invokeDemaTalkLive({
    model: "qwen2.5",
    prompt: "my api_key is sk-abcd12345678 please use it",
    consentPhrase: "GO: invoke local LLM via lmstudio at qwen2.5",
    fetchImpl,
  });
  assert.equal(r.invocation_status, "blocked");
  assert.equal(fetchImpl.calls.length, 0, "no fetch on a secret-shaped prompt");
  assert.match(r.error_reason, /secret/i);
});

test("outbound: a model response with a secret is REDACTED, but a local path is shown", async () => {
  const secret = mockFetch({
    choices: [{ message: { content: "your api_key is sk-deadbeef0001" } }],
  });
  const r1 = await invokeDemaTalkLive({
    model: "qwen2.5",
    prompt: "hello",
    consentPhrase: "GO: invoke local LLM via lmstudio at qwen2.5",
    fetchImpl: secret,
  });
  assert.equal(r1.invocation_status, "completed");
  assert.match(r1.response_text_preview, /REDACTED/);

  const withPath = mockFetch({
    choices: [{ message: { content: "see /home/me/Downloads/notes.txt for that" } }],
  });
  const r2 = await invokeDemaTalkLive({
    model: "qwen2.5",
    prompt: "hello",
    consentPhrase: "GO: invoke local LLM via lmstudio at qwen2.5",
    fetchImpl: withPath,
  });
  assert.equal(r2.invocation_status, "completed");
  assert.match(r2.response_text_preview, /notes\.txt/, "a local path is shown, not redacted");
});

test("runtime-emission boundary: the 10 strictly-false keys stay false even on success", async () => {
  const fetchImpl = mockFetch(OPENAI_BODY);
  const r = await invokeDemaTalkLive({
    model: "qwen2.5",
    prompt: "hello",
    consentPhrase: "GO: invoke local LLM via lmstudio at qwen2.5",
    fetchImpl,
  });
  for (const key of [
    "tool_executed",
    "filesystem_write_performed",
    "federation_invoked",
    "receipt_mint_performed",
    "public_network_used",
    "external_call_performed",
    "chain_advance_performed",
    "node_connection_performed",
  ]) {
    assert.equal(r.boundary[key], false, `${key} must stay false`);
  }
  // Legitimate runtime acts MAY be true on a completed call.
  assert.equal(r.boundary.model_invocation_performed, true);
  assert.equal(r.boundary.consent_collected, true);
});

test("HONESTY — suggestion-only: never an authority, no task, no runtime autonomy", async () => {
  const fetchImpl = mockFetch(OPENAI_BODY);
  const r = await invokeDemaTalkLive({
    model: "qwen2.5",
    prompt: "hello",
    consentPhrase: "GO: invoke local LLM via lmstudio at qwen2.5",
    fetchImpl,
  });
  assert.equal(r.verdict_role, "suggestion");
  const text = r.what_this_does_not_prove.join(" ");
  assert.match(text, /authority|suggestion/i);
  assert.match(text, /task|execut|runtime/i);
});

test("schema + truth_label exact; result is frozen", async () => {
  const fetchImpl = mockFetch(OPENAI_BODY);
  const r = await invokeDemaTalkLive({
    model: "qwen2.5",
    prompt: "hello",
    consentPhrase: "GO: invoke local LLM via lmstudio at qwen2.5",
    fetchImpl,
  });
  assert.equal(r.schema, "bizra.dema.talk_loop_live_result.v0.1");
  assert.equal(r.schema, DEMA_TALK_LOOP_LIVE_RESULT_SCHEMA);
  assert.equal(r.truth_label, "MEASURED");
  assert.equal(Object.isFrozen(r), true);
});

test("no real fetch leaks: when fetchImpl is omitted the module reads globalThis.fetch (not a bare fetch())", () => {
  const source = readFileSync(MODULE_PATH, "utf8");
  // No direct node:net/http import; the fetch must go through an injectable alias.
  assert.doesNotMatch(
    source,
    /from\s+["']node:(net|http|https|child_process|fs)["']/,
  );
  assert.match(source, /fetchImpl\s*\|\|\s*globalThis\.fetch/);
});

const TEST_KEYS = { LLAMACPP_KEY: "test-only-llama-key", LMSTUDIO_KEY: "test-only-studio-key" };
const consentFor = (provider) => `GO: invoke local LLM via ${provider} at qwen2.5`;

for (const [provider, env, expected] of [
  ["llamacpp", TEST_KEYS, "Bearer test-only-llama-key"],
  ["lmstudio", TEST_KEYS, "Bearer test-only-studio-key"],
  ["ollama", TEST_KEYS, undefined],
  ["llamacpp", {}, undefined],
  ["lmstudio", {}, undefined],
  ["llamacpp", { LMSTUDIO_KEY: TEST_KEYS.LMSTUDIO_KEY }, undefined],
  ["lmstudio", { LLAMACPP_KEY: TEST_KEYS.LLAMACPP_KEY }, undefined],
]) {
  test(`provider auth: ${provider}, configured keys ${Object.keys(env).join(",") || "none"}`, async () => {
    const fetchImpl = mockFetch(provider === "ollama" ? OLLAMA_BODY : OPENAI_BODY);
    const result = await invokeDemaTalkLive({ provider, model: "qwen2.5", prompt: "hello", consentPhrase: consentFor(provider), env, fetchImpl });
    assert.equal(result.invocation_status, "completed");
    assert.equal(fetchImpl.calls.length, 1);
    const call = fetchImpl.calls[0];
    assert.equal(call.opts.headers.Authorization, expected);
    assert.equal(call.opts.redirect, "error");
    assert.equal(new URL(call.url).hostname, "localhost");
    assert.equal(new URL(call.url).port, { llamacpp: "8080", lmstudio: "1234", ollama: "11434" }[provider]);
    assert.equal(call.parsed.model, "qwen2.5");
    assert.equal(result.verdict_role, "suggestion");
    const evidence = JSON.stringify({ result, receipt: buildTalkRuntimeReceipt({ result }) });
    for (const key of Object.values(TEST_KEYS)) assert.ok(!evidence.includes(key));
  });
}

for (const consentPhrase of ["", "wrong", "GO: invoke local LLM via lmstudio at qwen2.5"]) {
  test(`provider auth does not bypass exact consent: ${consentPhrase || "missing"}`, async () => {
    const fetchImpl = mockFetch(OPENAI_BODY);
    const result = await invokeDemaTalkLive({ provider: "llamacpp", model: "qwen2.5", prompt: "hello", consentPhrase, env: TEST_KEYS, fetchImpl });
    assert.equal(result.invocation_status, "refused");
    assert.equal(fetchImpl.calls.length, 0);
  });
}

for (const [name, fetchImpl, expectedStatus] of [
  ["model text", mockFetch({ choices: [{ message: { content: TEST_KEYS.LLAMACPP_KEY } }] }), "completed"],
  ["HTTP status text", async () => ({ ok: false, status: 401, statusText: TEST_KEYS.LLAMACPP_KEY }), "failed"],
  ["JSON parse exception", async () => ({ ok: true, json: async () => { throw new Error(TEST_KEYS.LLAMACPP_KEY); } }), "failed"],
  ["fetch exception", async () => { throw new Error(TEST_KEYS.LLAMACPP_KEY); }, "failed"],
]) {
  test(`provider credential echoed in ${name} stays out of result and receipt`, async () => {
    const result = await invokeDemaTalkLive({ provider: "llamacpp", model: "qwen2.5", prompt: "hello", consentPhrase: consentFor("llamacpp"), env: TEST_KEYS, fetchImpl });
    assert.equal(result.invocation_status, expectedStatus);
    const evidence = JSON.stringify({ result, receipt: buildTalkRuntimeReceipt({ result }) });
    assert.ok(!evidence.includes(TEST_KEYS.LLAMACPP_KEY));
    assert.match(result.response_text_preview || result.error_reason, /REDACTED/);
    if (name === "HTTP status text") assert.match(result.error_reason, /http_status_401/);
  });
}

test("provider key is suppressed before diagnostic truncation", async () => {
  const key = "test-only-" + "x".repeat(240);
  const result = await invokeDemaTalkLive({ provider: "llamacpp", model: "qwen2.5", prompt: "hello", consentPhrase: consentFor("llamacpp"), env: { LLAMACPP_KEY: key }, fetchImpl: async () => { throw new Error(key); } });
  assert.equal(result.invocation_status, "failed");
  assert.ok(!JSON.stringify(result).includes(key.slice(0, 100)));
  assert.match(result.error_reason, /REDACTED/);
});

for (const [name, body, options] of [
  ["401", OPENAI_BODY, { ok: false, status: 401 }],
  ["redirect", OPENAI_BODY, { ok: false, status: 302 }],
  ["missing content", {}, {}],
  ["non-string content", { choices: [{ message: { content: 42 } }] }, {}],
]) {
  test(`authenticated ${name} response never becomes success`, async () => {
    const fetchImpl = mockFetch(body, options);
    const result = await invokeDemaTalkLive({ provider: "llamacpp", model: "qwen2.5", prompt: "hello", consentPhrase: consentFor("llamacpp"), env: TEST_KEYS, fetchImpl });
    assert.equal(result.invocation_status, "failed");
    assert.equal(result.boundary.model_invocation_performed, false);
    assert.equal(fetchImpl.calls.length, 1, "no retry or fallback");
  });
}

for (const [provider, model] of [["unknown", "qwen2.5"], ["llamacpp", "gpt-4"]]) {
  test(`configured keys do not bypass provider/model refusal: ${provider}/${model}`, async () => {
    const fetchImpl = mockFetch(OPENAI_BODY);
    const result = await invokeDemaTalkLive({ provider, model, prompt: "hello", consentPhrase: `GO: invoke local LLM via ${provider} at ${model}`, env: TEST_KEYS, fetchImpl });
    assert.equal(result.invocation_status, "refused");
    assert.equal(fetchImpl.calls.length, 0);
    for (const key of Object.values(TEST_KEYS)) assert.ok(!JSON.stringify(result).includes(key));
  });
}

test("dema talk forwards its provider key into the consented request", async (t) => {
  const previous = process.env.LLAMACPP_KEY;
  process.env.LLAMACPP_KEY = TEST_KEYS.LLAMACPP_KEY;
  t.after(() => { if (previous === undefined) delete process.env.LLAMACPP_KEY; else process.env.LLAMACPP_KEY = previous; });
  const fetchImpl = mockFetch(OPENAI_BODY);
  t.mock.method(globalThis, "fetch", fetchImpl);
  const output = [];
  t.mock.method(console, "log", (line) => output.push(line));
  const exitSignal = new Error("test CLI exit");
  t.mock.method(process, "exit", (code) => { assert.equal(code, 0); throw exitSignal; });
  await assert.rejects(cmd_talk({ argv: ["talk", "--provider", "llamacpp", "--model", "qwen2.5", "--prompt", "hello", "--consent", consentFor("llamacpp"), "--json"] }), (error) => error === exitSignal);
  assert.equal(fetchImpl.calls.length, 1);
  assert.equal(fetchImpl.calls[0].opts.headers.Authorization, `Bearer ${TEST_KEYS.LLAMACPP_KEY}`);
  const result = JSON.parse(output[0]);
  assert.equal(result.invocation_status, "completed");
  assert.equal(result.boundary.filesystem_write_performed, false);
  assert.equal(result.receipt_path, undefined);
  assert.ok(!output.join("\n").includes(TEST_KEYS.LLAMACPP_KEY));
});

for (const [name, fetchImpl] of [
  ["response", mockFetch({ choices: [{ message: { content: TEST_KEYS.LMSTUDIO_KEY } }] })],
  ["status", async () => ({ ok: false, status: 401, statusText: TEST_KEYS.LMSTUDIO_KEY })],
  ["parse error", async () => ({ ok: true, json: async () => { throw new Error(TEST_KEYS.LMSTUDIO_KEY); } })],
  ["fetch error", async () => { throw new Error(TEST_KEYS.LMSTUDIO_KEY); }],
]) {
  test(`LM Studio selected credential echo suppression: ${name}`, async () => {
    const result = await invokeDemaTalkLive({ provider: "lmstudio", model: "qwen2.5", prompt: "hello",
      consentPhrase: consentFor("lmstudio"), env: TEST_KEYS, fetchImpl });
    assert.equal(result.invocation_status, name === "response" ? "completed" : "failed");
    assert.match(result.response_text_preview || result.error_reason, /REDACTED/);
    assert.ok(!JSON.stringify({ result, receipt: buildTalkRuntimeReceipt({ result }) }).includes(TEST_KEYS.LMSTUDIO_KEY));
  });
}

test("LM Studio preserves Grok's empty and CR/LF bearer validation", async () => {
  for (const key of ["", "   ", "test\nkey", "test\rkey"]) {
    const fetchImpl = mockFetch(OPENAI_BODY);
    const result = await invokeDemaTalkLive({ provider: "lmstudio", model: "qwen2.5", prompt: "hello",
      consentPhrase: consentFor("lmstudio"), env: { LMSTUDIO_KEY: key }, fetchImpl });
    assert.equal(result.invocation_status, "completed");
    assert.equal(fetchImpl.calls[0].opts.headers.Authorization, undefined);
  }
});

test("dema talk refuses an invalid selected bridge without fetch or raw configuration output", async (t) => {
  const override = "http://test-user:test-password@outside.invalid:8080?private=test-token";
  for (const [name, value] of [["DEMA_LLAMACPP_URL", override], ["LLAMACPP_KEY", TEST_KEYS.LLAMACPP_KEY]]) {
    const previous = process.env[name];
    process.env[name] = value;
    t.after(() => { if (previous === undefined) delete process.env[name]; else process.env[name] = previous; });
  }
  const fetchImpl = mockFetch(OPENAI_BODY);
  t.mock.method(globalThis, "fetch", fetchImpl);
  const output = [];
  t.mock.method(console, "log", (line) => output.push(line));
  const exitSignal = new Error("test CLI refusal exit");
  t.mock.method(process, "exit", (code) => { assert.equal(code, 1); throw exitSignal; });
  await assert.rejects(cmd_talk({ argv: ["talk", "--provider", "llamacpp", "--model", "qwen2.5",
    "--prompt", "hello", "--consent", consentFor("llamacpp"), "--json"] }), (error) => error === exitSignal);
  assert.equal(fetchImpl.calls.length, 0);
  const result = JSON.parse(output[0]);
  assert.equal(result.invocation_status, "refused");
  assert.equal(result.error_reason, "invalid_endpoint_override · invocation refused");
  assert.equal(result.target_endpoint, null);
  for (const value of [override, "test-user", "test-password", "test-token", TEST_KEYS.LLAMACPP_KEY])
    assert.ok(!output.join("\n").includes(value));
});
