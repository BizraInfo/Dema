// DEMA-GEMMA-AUTH-MERGE-VERIFY-1C: injected fetch and test-only credentials.
import test from "node:test";
import assert from "node:assert/strict";
import { invokeDemaTalkLive } from "../packages/core/src/dema-talk-loop-live.js";
import { buildLocalLlmProviderRoute } from "../packages/core/src/local-llm-provider-router.js";
import { resolveLocalLlmBase } from "../packages/models/src/model-common.js";

const CONFIG = {
  llamacpp: ["DEMA_LLAMACPP_URL", "LLAMACPP_KEY", "http://localhost:8080/v1"],
  lmstudio: ["DEMA_LM_STUDIO_URL", "LMSTUDIO_KEY", "http://localhost:1234/v1"],
  ollama: ["DEMA_OLLAMA_URL", null, "http://localhost:11434"],
};
const KEY = "route-refusal-test-only-key";
const consent = (provider) => `GO: invoke local LLM via ${provider} at qwen2.5`;

async function invoke(provider, override, extra = {}, envExtras = {}) {
  let credentialReads = 0;
  let endpointReads = 0;
  const calls = [];
  const [endpointName, credentialName] = CONFIG[provider];
  const env = { ...envExtras };
  Object.defineProperty(env, endpointName, {
    get() { endpointReads++; return override; },
  });
  for (const name of ["LLAMACPP_KEY", "LMSTUDIO_KEY"]) {
    Object.defineProperty(env, name, {
      get() {
        assert.equal(name, credentialName, "only the selected provider credential may be read");
        credentialReads++;
        return KEY;
      },
    });
  }
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => provider === "ollama"
      ? { response: "synthetic reply" }
      : { choices: [{ message: { content: "synthetic reply" } }] } };
  };
  const result = await invokeDemaTalkLive({ provider, model: "qwen2.5", prompt: "hello",
    consentPhrase: consent(provider), env, fetchImpl, ...extra });
  return { result, calls, credentialReads, endpointReads, env };
}

for (const provider of Object.keys(CONFIG)) {
  for (const [kind, override] of [
    ["remote", "http://outside.invalid:8080"],
    ["remote with private URL fields", "http://test-user:test-password@outside.invalid:8080?private=test-token"],
    ["malformed", "not a URL"],
    ["wrong protocol", "https://localhost:8080"],
    ["host masquerade", "http://localhost.outside.invalid:8080"],
    ["userinfo masquerade", "http://localhost@outside.invalid:8080"],
  ]) {
    test(`${provider}: invalid effective ${kind} override refuses before credentials and fetch`, async () => {
      const observed = await invoke(provider, override);
      assert.equal(observed.credentialReads, 0, "refusal precedes credential access");
      assert.equal(observed.calls.length, 0, "no fallback or off-host dispatch");
      assert.equal(observed.result.invocation_status, "refused");
      assert.equal(observed.result.error_reason, "invalid_endpoint_override · invocation refused");
      assert.equal(observed.result.target_endpoint, null);
      assert.equal(observed.result.boundary.network_used, false);
      assert.equal(observed.result.boundary.model_invocation_performed, false);
      const diagnostic = JSON.stringify(observed.result);
      for (const value of [override, KEY, "test-user", "test-password", "test-token"])
        assert.ok(!diagnostic.includes(value), "rejected configuration stays out of diagnostics");
      const preview = buildLocalLlmProviderRoute({ provider, model: "qwen2.5", env: observed.env });
      assert.equal(preview.provider_base_url, CONFIG[provider][2], "discovery retains its fallback");
      assert.equal(preview.target_is_localhost, true);
    });
  }

  for (const override of ["http://127.0.0.1:18080", "http://localhost:18081", "http://[::1]:18082"]) {
    test(`${provider}: valid selected loopback route and credential positive control ${override}`, async () => {
      const observed = await invoke(provider, override);
      assert.equal(observed.result.invocation_status, "completed");
      assert.equal(observed.calls.length, 1);
      assert.equal(observed.endpointReads, 1, "selected endpoint is read once");
      assert.equal(observed.credentialReads, CONFIG[provider][1] ? 1 : 0,
        "positive control proves getter instrumentation and selected-key handling");
      const base = override + (provider === "ollama" ? "" : "/v1");
      assert.equal(observed.result.target_endpoint, base);
      assert.equal(observed.calls[0].url, base + (provider === "ollama" ? "/api/generate" : "/chat/completions"));
      assert.equal(observed.calls[0].options.headers.Authorization,
        CONFIG[provider][1] ? `Bearer ${KEY}` : undefined);
      assert.equal(observed.calls[0].options.redirect, "error");
      assert.ok(!JSON.stringify(observed.result).includes(KEY));
    });
  }

  for (const override of [undefined, "", "   "]) {
    test(`${provider}: absent or intentionally empty override keeps the documented default ${JSON.stringify(override)}`, async () => {
      const observed = await invoke(provider, override);
      assert.equal(observed.result.invocation_status, "completed");
      assert.equal(observed.result.target_endpoint, CONFIG[provider][2]);
      assert.equal(observed.calls.length, 1);
    });
  }

  test(`${provider}: invalid unrelated provider override has no effect`, async () => {
    const unrelated = Object.entries(CONFIG).filter(([name]) => name !== provider)
      .map(([, config]) => [config[0], "http://outside.invalid:8080"]);
    const observed = await invoke(provider, "http://127.0.0.1:18080", {}, Object.fromEntries(unrelated));
    assert.equal(observed.result.invocation_status, "completed");
    assert.equal(observed.calls.length, 1);
    assert.equal(new URL(observed.calls[0].url).port, "18080");
  });

  test(`${provider}: exact consent and model gates precede credential access`, async () => {
    for (const extra of [{ consentPhrase: "" }, { consentPhrase: "wrong" }, { model: "gpt-4" }]) {
      const observed = await invoke(provider, undefined, extra);
      assert.equal(observed.result.invocation_status, "refused");
      assert.equal(observed.credentialReads, 0);
      assert.equal(observed.calls.length, 0);
    }
  });
}

test("unknown provider refuses before endpoint and credential access", async () => {
  const env = new Proxy({}, { get() { assert.fail("unknown provider must not inspect configuration"); } });
  const result = await invokeDemaTalkLive({ provider: "unknown", model: "qwen2.5", prompt: "hello", env,
    fetchImpl: async () => assert.fail("unknown provider must not fetch") });
  assert.equal(result.invocation_status, "refused");
});

test("discovery shared resolver preserves explicit precedence and permissive fallback", () => {
  assert.equal(resolveLocalLlmBase({ explicit: "http://127.0.0.1:18080", envValue: "http://outside.invalid" }),
    "http://127.0.0.1:18080");
  assert.equal(resolveLocalLlmBase({ envValue: "not a URL", fallback: "http://localhost:8080" }),
    "http://localhost:8080");
});
