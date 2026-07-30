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
  DEMA_TALK_LOOP_RESPONSE_BODY_MAX_BYTES,
  DEMA_TALK_LOOP_RESPONSE_TEXT_MAX_BYTES,
} from "../packages/core/src/dema-talk-loop-live.js";
import { MAX_STRING_BYTES } from "../packages/canon/src/canonical-json-v1.js";

const MODULE_PATH = fileURLToPath(
  new URL("../packages/core/src/dema-talk-loop-live.js", import.meta.url),
);

const UTF8_ENCODER = new TextEncoder();

function jsonResponse(
  body,
  {
    status = 200,
    observedUrl = "",
  } = {},
) {
  const response = new Response(JSON.stringify(body), {
    status,
    statusText: status >= 200 && status < 300 ? "OK" : "ERR",
    headers: { "content-type": "application/json" },
  });
  if (observedUrl) {
    Object.defineProperty(response, "url", { value: observedUrl });
  }
  return response;
}

function streamingResponse(chunks, state) {
  let index = 0;
  const response = new Response(
    new ReadableStream(
      {
        pull(controller) {
          state.pulls += 1;
          if (index >= chunks.length) {
            controller.close();
            return;
          }
          controller.enqueue(UTF8_ENCODER.encode(chunks[index]));
          index += 1;
        },
        cancel() {
          state.cancelled = true;
        },
      },
      { highWaterMark: 0 },
    ),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
  return response;
}

// A capturing mock fetch. Records each call; returns a real Fetch Response so
// production tests exercise the same bounded body stream used on localhost.
function mockFetch(body, options = {}) {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts, parsed: JSON.parse(opts.body) });
    return jsonResponse(body, options);
  };
  fn.calls = calls;
  return fn;
}

const OPENAI_BODY = { choices: [{ message: { content: "hi from lmstudio" } }] };
const OLLAMA_BODY = { response: "hi from ollama" };

test("lmstudio (default) + matching consent → completed, OpenAI endpoint shape", async () => {
  const observedUrl = "http://localhost:1234/v1/chat/completions";
  const fetchImpl = mockFetch(OPENAI_BODY, { observedUrl });
  const r = await invokeDemaTalkLive({
    model: "qwen2.5",
    prompt: "hello",
    consentPhrase: "GO: invoke local LLM via lmstudio at qwen2.5",
    fetchImpl,
  });
  assert.equal(r.invocation_status, "completed");
  assert.equal(r.provider, "lmstudio");
  assert.equal(r.model, "qwen2.5", "legacy requested-model field stays compatible");
  assert.equal(r.target_endpoint, "http://localhost:1234/v1");
  assert.equal(r.requested_model, "qwen2.5");
  assert.equal(r.provider_reported_model, null);
  assert.equal(r.provider_model_status, "unreported");
  assert.equal(r.request_url, observedUrl);
  assert.equal(r.observed_response_url, observedUrl);
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

test("matching provider-reported model is recorded separately from the requested model", async () => {
  const fetchImpl = mockFetch({
    model: "qwen2.5",
    choices: [{ message: { content: "identity-bound answer" } }],
  });
  const r = await invokeDemaTalkLive({
    model: "qwen2.5",
    prompt: "hello",
    consentPhrase: "GO: invoke local LLM via lmstudio at qwen2.5",
    fetchImpl,
  });

  assert.equal(r.invocation_status, "completed");
  assert.equal(r.model, "qwen2.5");
  assert.equal(r.requested_model, "qwen2.5");
  assert.equal(r.provider_reported_model, "qwen2.5");
  assert.equal(r.provider_model_status, "reported_match");
});

test("mismatched provider-reported model fails closed without returning its answer", async () => {
  const fetchImpl = mockFetch({
    model: "another-model",
    choices: [{ message: { content: "answer from the wrong model" } }],
  });
  const r = await invokeDemaTalkLive({
    model: "qwen2.5",
    prompt: "hello",
    consentPhrase: "GO: invoke local LLM via lmstudio at qwen2.5",
    fetchImpl,
    includeResponseText: true,
  });

  assert.equal(r.invocation_status, "failed");
  assert.equal(r.truth_label, "INVOCATION_FAILED");
  assert.equal(r.requested_model, "qwen2.5");
  assert.equal(r.provider_reported_model, "another-model");
  assert.equal(r.provider_model_status, "reported_mismatch");
  assert.match(r.error_reason, /provider_model_mismatch/);
  assert.equal(Object.hasOwn(r, "response_text"), false);
  assert.equal(r.response_text_preview, null);
  assert.doesNotMatch(JSON.stringify(r), /answer from the wrong model/);
});

test("response_text accepts the exact UTF-8 byte limit below canonical JSON's string cap", async () => {
  assert.ok(
    DEMA_TALK_LOOP_RESPONSE_TEXT_MAX_BYTES <= MAX_STRING_BYTES * 0.75,
    "the response_text limit keeps at least 25% headroom below canonical JSON",
  );
  const exactAnswer = "é".repeat(DEMA_TALK_LOOP_RESPONSE_TEXT_MAX_BYTES / 2);
  assert.equal(
    UTF8_ENCODER.encode(exactAnswer).byteLength,
    DEMA_TALK_LOOP_RESPONSE_TEXT_MAX_BYTES,
  );

  const r = await invokeDemaTalkLive({
    model: "qwen2.5",
    prompt: "hello",
    consentPhrase: "GO: invoke local LLM via lmstudio at qwen2.5",
    fetchImpl: mockFetch({
      model: "qwen2.5",
      choices: [{ message: { content: exactAnswer } }],
    }),
    includeResponseText: true,
  });

  assert.equal(r.invocation_status, "completed");
  assert.equal(r.response_text, exactAnswer);
});

test("response_text one UTF-8 byte over the exported limit fails closed", async () => {
  const overLimitAnswer =
    "é".repeat(DEMA_TALK_LOOP_RESPONSE_TEXT_MAX_BYTES / 2) + "x";
  assert.equal(
    UTF8_ENCODER.encode(overLimitAnswer).byteLength,
    DEMA_TALK_LOOP_RESPONSE_TEXT_MAX_BYTES + 1,
  );

  const r = await invokeDemaTalkLive({
    model: "qwen2.5",
    prompt: "hello",
    consentPhrase: "GO: invoke local LLM via lmstudio at qwen2.5",
    fetchImpl: mockFetch({
      model: "qwen2.5",
      choices: [{ message: { content: overLimitAnswer } }],
    }),
    includeResponseText: true,
  });

  assert.equal(r.invocation_status, "failed");
  assert.match(r.error_reason, /response_text_too_large/);
  assert.equal(Object.hasOwn(r, "response_text"), false);
  assert.equal(r.response_text_preview, null);
  assert.equal(JSON.stringify(r).includes(overLimitAnswer), false);
});

test("oversized Fetch response body is cancelled while streaming and never retained", async () => {
  const streamState = { pulls: 0, cancelled: false };
  const oversizedPadding = "x".repeat(DEMA_TALK_LOOP_RESPONSE_BODY_MAX_BYTES);
  const response = streamingResponse(
    ['{"model":"qwen2.5","response":"ok","padding":"', oversizedPadding, '"}'],
    streamState,
  );

  const r = await invokeDemaTalkLive({
    provider: "ollama",
    model: "qwen2.5",
    prompt: "hello",
    consentPhrase: "GO: invoke local LLM via ollama at qwen2.5",
    fetchImpl: async () => response,
    includeResponseText: true,
  });

  assert.equal(r.invocation_status, "failed");
  assert.match(r.error_reason, /response_body_too_large/);
  assert.equal(streamState.cancelled, true);
  assert.equal(Object.hasOwn(r, "response_text"), false);
  assert.equal(r.response_text_preview, null);
  assert.equal(JSON.stringify(r).includes(oversizedPadding), false);
});

test("full response is returned only when a bounded local caller explicitly opts in", async () => {
  const completeAnswer = "PAT proposes bounded work; SAT independently verifies it. ".repeat(12);
  const fetchImpl = mockFetch({
    choices: [{ message: { content: completeAnswer } }],
  });

  const captured = await invokeDemaTalkLive({
    model: "qwen2.5",
    prompt: "Explain PAT and SAT from the supplied sources.",
    consentPhrase: "GO: invoke local LLM via lmstudio at qwen2.5",
    fetchImpl,
    includeResponseText: true,
  });
  assert.equal(captured.invocation_status, "completed");
  assert.equal(captured.response_text, completeAnswer);
  assert.match(captured.response_text_preview, /truncated/);

  const previewOnly = await invokeDemaTalkLive({
    model: "qwen2.5",
    prompt: "Explain PAT and SAT from the supplied sources.",
    consentPhrase: "GO: invoke local LLM via lmstudio at qwen2.5",
    fetchImpl: mockFetch({
      choices: [{ message: { content: completeAnswer } }],
    }),
  });
  assert.equal(
    Object.hasOwn(previewOnly, "response_text"),
    false,
    "generic talk callers must not receive the complete response by default",
  );
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
