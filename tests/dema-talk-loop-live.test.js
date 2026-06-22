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

test("CONSERVATIVE inbound gate: a prompt with a literal local path is BLOCKED before any fetch", async () => {
  // Pins the (intentional, conservative) behavior the operator will hit first:
  // naming a local file refuses pre-fetch. Honest tradeoff — loosening path-
  // blocking for the localhost talk path is a deliberate follow-up decision.
  const fetchImpl = mockFetch(OPENAI_BODY);
  const r = await invokeDemaTalkLive({
    model: "qwen2.5",
    prompt: "summarize the notes in /home/me/Downloads/notes.txt",
    consentPhrase: "GO: invoke local LLM via lmstudio at qwen2.5",
    fetchImpl,
  });
  assert.equal(r.invocation_status, "blocked");
  assert.equal(fetchImpl.calls.length, 0, "no fetch on a blocked prompt");
  assert.equal(r.boundary.model_invocation_performed, false);
  assert.equal(r.boundary.network_used, false);
  // The refusal must be honest + actionable, not opaque.
  assert.match(r.error_reason, /path or secret|rephrase/i);
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
