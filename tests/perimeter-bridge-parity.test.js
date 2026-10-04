import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveLocalLlmBase,
  DEFAULT_OLLAMA_URL,
  DEFAULT_LM_STUDIO_URL,
  DEFAULT_LLAMACPP_URL,
} from "../packages/models/src/model-common.js";
import { buildLLMInvocationPreview } from "../packages/core/src/llm-adapter.js";
import { buildLocalLlmProviderRoute } from "../packages/core/src/local-llm-provider-router.js";

test("resolveLocalLlmBase honors explicit > env > fallback for all three ADR-042 bridges", () => {
  const ollama = resolveLocalLlmBase({
    explicit: "http://127.0.0.1:11435",
    envValue: "http://127.0.0.1:11999",
    fallback: DEFAULT_OLLAMA_URL,
  });
  assert.equal(ollama, "http://127.0.0.1:11435");

  const lm = resolveLocalLlmBase({
    envValue: "http://127.0.0.1:1235",
    fallback: DEFAULT_LM_STUDIO_URL,
  });
  assert.equal(lm, "http://127.0.0.1:1235");

  const llama = resolveLocalLlmBase({
    envValue: "http://127.0.0.1:8081",
    fallback: DEFAULT_LLAMACPP_URL,
  });
  assert.equal(llama, "http://127.0.0.1:8081");
});

test("discover/invoke parity: DEMA_OLLAMA_URL non-default loopback is the shared target", () => {
  const prev = process.env.DEMA_OLLAMA_URL;
  process.env.DEMA_OLLAMA_URL = "http://127.0.0.1:11499";
  try {
    const discovered = resolveLocalLlmBase({
      envValue: process.env.DEMA_OLLAMA_URL,
      fallback: DEFAULT_OLLAMA_URL,
    });
    const preview = buildLLMInvocationPreview({
      model: "llama3.2",
      prompt: "ping",
    });
    assert.equal(discovered, "http://127.0.0.1:11499");
    assert.equal(preview.target_endpoint, discovered);
  } finally {
    if (prev === undefined) delete process.env.DEMA_OLLAMA_URL;
    else process.env.DEMA_OLLAMA_URL = prev;
  }
});

test("provider router resolves DEMA_LM_STUDIO_URL and DEMA_LLAMACPP_URL via shared kernel", () => {
  const prevLm = process.env.DEMA_LM_STUDIO_URL;
  const prevLlama = process.env.DEMA_LLAMACPP_URL;
  process.env.DEMA_LM_STUDIO_URL = "http://127.0.0.1:1239";
  process.env.DEMA_LLAMACPP_URL = "http://127.0.0.1:8089";
  try {
    const lm = buildLocalLlmProviderRoute({
      provider: "lmstudio",
      model: "qwen/qwen3.5-9b",
    });
    assert.match(lm.provider_base_url, /127\.0\.0\.1:1239/);

    const llama = buildLocalLlmProviderRoute({
      provider: "llamacpp",
      model: "local-gguf",
    });
    assert.match(llama.provider_base_url, /127\.0\.0\.1:8089/);
  } finally {
    if (prevLm === undefined) delete process.env.DEMA_LM_STUDIO_URL;
    else process.env.DEMA_LM_STUDIO_URL = prevLm;
    if (prevLlama === undefined) delete process.env.DEMA_LLAMACPP_URL;
    else process.env.DEMA_LLAMACPP_URL = prevLlama;
  }
});
