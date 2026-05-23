import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildLLMInvocationPreview,
  buildLLMInvocationSummary,
  invokeLocalLLM,
  LLM_ADAPTER_ALLOWED_MODEL_FAMILIES,
  LLM_ADAPTER_DEFAULT_BASE,
  LLM_ADAPTER_MAX_PROMPT_LENGTH,
  LLM_ADAPTER_REQUIRED_BLOCKED_EFFECTS_PREVIEW,
  llmAdapterConsentPhraseFor,
  __resetInvocationFreshness
} from "../packages/core/src/llm-adapter.js";

import { beforeEach } from "node:test";

// ADR-018 §S6 monotonic per-invocation consent freshness — each
// successful gate-pass marks the (modelName, consentPhrase) pair used
// for this process. Tests share a process; reset between cases so each
// test runs against a fresh seen-set.
beforeEach(() => {
  __resetInvocationFreshness();
});
import {
  isCanonicalBoundary,
  PREVIEW_BOUNDARY_CANONICAL_KEYS
} from "../packages/core/src/preview-boundary.js";

// =========================================================================
// PREVIEW SURFACE TESTS (5)
// =========================================================================

test("Preview emits canonical schema + truth label + preview_only mode", () => {
  const p = buildLLMInvocationPreview({ model: "llama3.1:8b", prompt: "hello" });
  assert.equal(p.schema, "bizra.dema.llm_invocation_preview.v0.1");
  assert.equal(p.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(p.mode, "preview_only");
  assert.equal(p.invocation_status, "not_invoked_preview_only");
});

test("Preview boundary is canonical 16-key all-false frozen object", () => {
  const p = buildLLMInvocationPreview({ model: "llama3.1:8b", prompt: "hello" });
  assert.ok(isCanonicalBoundary(p.boundary));
  for (const key of PREVIEW_BOUNDARY_CANONICAL_KEYS) {
    assert.equal(p.boundary[key], false);
  }
});

test("Preview is deep-frozen at top level + blocked_effects + boundary", () => {
  const p = buildLLMInvocationPreview({ model: "llama3.1:8b", prompt: "hello" });
  assert.ok(Object.isFrozen(p));
  assert.ok(Object.isFrozen(p.blocked_effects));
  assert.ok(Object.isFrozen(p.boundary));
});

test("Preview surfaces consent_required phrase with model name embedded", () => {
  const p = buildLLMInvocationPreview({ model: "llama3.1:8b", prompt: "hi" });
  assert.equal(p.consent_required, "GO: invoke local LLM at llama3.1:8b");
});

test("Preview truncates ultra-long prompts to MAX_PROMPT_LENGTH", () => {
  const huge = "A".repeat(LLM_ADAPTER_MAX_PROMPT_LENGTH + 5000);
  const p = buildLLMInvocationPreview({ model: "llama3.1:8b", prompt: huge });
  assert.equal(p.prompt_length_chars, LLM_ADAPTER_MAX_PROMPT_LENGTH);
  assert.equal(p.prompt_truncated, true);
});

// =========================================================================
// ADVERSARIAL INPUT FILTERING TESTS (5)
// =========================================================================

test("Adversarial: non-localhost ollamaBaseUrl falls back to default in preview", () => {
  const p = buildLLMInvocationPreview({
    model: "llama3.1:8b",
    prompt: "hi",
    ollamaBaseUrl: "http://evil.example.com:11434"
  });
  assert.equal(p.target_endpoint, LLM_ADAPTER_DEFAULT_BASE);
  assert.equal(p.target_is_localhost, true);
});

test("Adversarial: non-whitelisted model is marked model_allowed_in_whitelist=false in preview", () => {
  const p = buildLLMInvocationPreview({
    model: "evil-model:99b",
    prompt: "hi"
  });
  assert.equal(p.model_allowed_in_whitelist, false);
});

test("Adversarial: non-string model coerced to empty string", () => {
  const p = buildLLMInvocationPreview({ model: { malicious: true }, prompt: "hi" });
  assert.equal(p.requested_model, "");
  assert.equal(p.model_allowed_in_whitelist, false);
});

test("Adversarial: non-string prompt coerced to empty string", () => {
  const p = buildLLMInvocationPreview({ model: "llama3.1:8b", prompt: () => "malicious" });
  assert.equal(p.prompt_length_chars, 0);
});

test("Adversarial: out-of-range timeoutMs reverts to default", () => {
  const tooHigh = buildLLMInvocationPreview({ model: "llama3.1:8b", prompt: "hi", timeoutMs: 99999999 });
  const negative = buildLLMInvocationPreview({ model: "llama3.1:8b", prompt: "hi", timeoutMs: -100 });
  const string = buildLLMInvocationPreview({ model: "llama3.1:8b", prompt: "hi", timeoutMs: "evil" });
  assert.equal(tooHigh.timeout_ms, 60000);
  assert.equal(negative.timeout_ms, 60000);
  assert.equal(string.timeout_ms, 60000);
});

// =========================================================================
// INVOCATION CONSENT-GATE TESTS (4)
// =========================================================================

test("Invoke without consent phrase fails with consent_phrase_mismatch", async () => {
  const r = await invokeLocalLLM({
    model: "llama3.1:8b",
    prompt: "hi",
    consentPhrase: ""
  });
  assert.equal(r.invocation_status, "failed");
  assert.match(r.error_reason, /consent_phrase_mismatch/);
  assert.equal(r.effects_observed.model_invocation_performed, false);
  assert.equal(r.effects_observed.prompt_executed, false);
});

test("Invoke with WRONG consent phrase fails (no fuzzy match)", async () => {
  const r = await invokeLocalLLM({
    model: "llama3.1:8b",
    prompt: "hi",
    consentPhrase: "GO: invoke local llm at llama3.1:8b" // lowercase 'llm' · should fail
  });
  assert.equal(r.invocation_status, "failed");
  assert.match(r.error_reason, /consent_phrase_mismatch/);
});

test("Invoke with non-localhost endpoint refused before any other gate", async () => {
  const r = await invokeLocalLLM({
    model: "llama3.1:8b",
    prompt: "hi",
    consentPhrase: "GO: invoke local LLM at llama3.1:8b",
    ollamaBaseUrl: "http://evil.example.com:11434"
  });
  assert.equal(r.invocation_status, "failed");
  assert.match(r.error_reason, /endpoint_not_localhost/);
});

test("Invoke with non-whitelisted model refused", async () => {
  const r = await invokeLocalLLM({
    model: "evil-model:1.0",
    prompt: "hi",
    consentPhrase: "GO: invoke local LLM at evil-model:1.0"
  });
  assert.equal(r.invocation_status, "failed");
  assert.match(r.error_reason, /model_not_in_whitelist/);
});

// =========================================================================
// INVOCATION BEHAVIOR TESTS (mocked fetchImpl · 6 scenarios)
// =========================================================================

function mockFetch(response, delayMs = 0) {
  return async (_url, _opts) => {
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    return response;
  };
}

test("Invoke succeeds with valid consent + valid model + mocked Ollama response", async () => {
  const mock = mockFetch({
    ok: true,
    status: 200,
    json: async () => ({ response: "hello there!", done: true, model: "llama3.1:8b" })
  });
  const r = await invokeLocalLLM({
    model: "llama3.1:8b",
    prompt: "hi",
    consentPhrase: "GO: invoke local LLM at llama3.1:8b",
    fetchImpl: mock
  });
  assert.equal(r.invocation_status, "completed");
  assert.equal(r.error_reason, null);
  assert.equal(r.model_invoked, "llama3.1:8b");
  assert.equal(r.response_length_chars, 12);
  assert.match(r.response_text_preview, /hello there/);
  assert.equal(r.consent_phrase_verified, true);
  assert.equal(r.effects_observed.model_invocation_performed, true);
  assert.equal(r.effects_observed.public_network_used, false);
  assert.equal(r.effects_observed.consent_collected, true);
  assert.equal(r.target_is_localhost, true);
  assert.equal(r.schema, "bizra.dema.llm_invocation_result.v0.1");
});

test("Invoke with non-200 status emits http_status error", async () => {
  const mock = mockFetch({ ok: false, status: 500, statusText: "Internal Server Error" });
  const r = await invokeLocalLLM({
    model: "llama3.1:8b",
    prompt: "hi",
    consentPhrase: "GO: invoke local LLM at llama3.1:8b",
    fetchImpl: mock
  });
  assert.equal(r.invocation_status, "failed");
  assert.match(r.error_reason, /http_status_500/);
  assert.equal(r.effects_observed.model_invocation_performed, false);
});

test("Invoke with non-JSON response emits response_not_json error", async () => {
  const mock = mockFetch({
    ok: true,
    status: 200,
    json: async () => { throw new Error("Unexpected token"); }
  });
  const r = await invokeLocalLLM({
    model: "llama3.1:8b",
    prompt: "hi",
    consentPhrase: "GO: invoke local LLM at llama3.1:8b",
    fetchImpl: mock
  });
  assert.equal(r.invocation_status, "failed");
  assert.match(r.error_reason, /response_not_json/);
});

test("Invoke with network error emits network_error", async () => {
  const errorFetch = async () => { throw new Error("ECONNREFUSED"); };
  const r = await invokeLocalLLM({
    model: "llama3.1:8b",
    prompt: "hi",
    consentPhrase: "GO: invoke local LLM at llama3.1:8b",
    fetchImpl: errorFetch
  });
  assert.equal(r.invocation_status, "failed");
  assert.match(r.error_reason, /network_error/);
});

test("Invoke with timeout aborts cleanly · emits timeout_after error", async () => {
  // Custom abort-aware mock that respects controller.signal
  const slowFetch = async (_url, opts) => {
    return new Promise((resolve, reject) => {
      const onAbort = () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      opts.signal?.addEventListener("abort", onAbort, { once: true });
      // never resolve on its own · only abort wins
    });
  };
  const r = await invokeLocalLLM({
    model: "llama3.1:8b",
    prompt: "hi",
    consentPhrase: "GO: invoke local LLM at llama3.1:8b",
    timeoutMs: 100,
    fetchImpl: slowFetch
  });
  assert.equal(r.invocation_status, "failed");
  assert.match(r.error_reason, /timeout_after_100ms/);
});

test("Invoke result text preview is capped at 500 chars + truncation marker", async () => {
  const longResponse = "B".repeat(2000);
  const mock = mockFetch({
    ok: true,
    status: 200,
    json: async () => ({ response: longResponse, done: true })
  });
  const r = await invokeLocalLLM({
    model: "llama3.1:8b",
    prompt: "hi",
    consentPhrase: "GO: invoke local LLM at llama3.1:8b",
    fetchImpl: mock
  });
  assert.equal(r.invocation_status, "completed");
  assert.equal(r.response_length_chars, 2000);
  assert.ok(r.response_text_preview.length < 600);
  assert.match(r.response_text_preview, /truncated/);
});

// =========================================================================
// SUMMARY + EXPORTS TESTS (3)
// =========================================================================

test("Summary emits suffix-tagged schema and preserves load-bearing fields", () => {
  const s = buildLLMInvocationSummary({ model: "llama3.1:8b", prompt: "hi" });
  assert.equal(s.schema, "bizra.dema.llm_invocation_summary.v0.1");
  assert.equal(s.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(s.mode, "summary");
  assert.equal(s.source_schema, "bizra.dema.llm_invocation_preview.v0.1");
  assert.equal(s.model_allowed_in_whitelist, true);
  assert.equal(s.target_is_localhost, true);
  assert.ok(isCanonicalBoundary(s.boundary));
});

test("Summary fits within line budget pretty-printed", () => {
  const s = buildLLMInvocationSummary({ model: "llama3.1:8b", prompt: "hi" });
  const lines = JSON.stringify(s, null, 2).split("\n").length;
  assert.ok(lines <= 40, `summary must be <= 40 lines, got ${lines}`);
});

test("Exported constants are present and frozen", () => {
  assert.ok(Array.isArray(LLM_ADAPTER_ALLOWED_MODEL_FAMILIES));
  assert.ok(Object.isFrozen(LLM_ADAPTER_ALLOWED_MODEL_FAMILIES));
  assert.ok(LLM_ADAPTER_ALLOWED_MODEL_FAMILIES.includes("llama3.1"));
  assert.ok(LLM_ADAPTER_ALLOWED_MODEL_FAMILIES.includes("qwen2.5"));
  assert.equal(typeof LLM_ADAPTER_DEFAULT_BASE, "string");
  assert.ok(LLM_ADAPTER_DEFAULT_BASE.startsWith("http://localhost"));
  assert.equal(typeof LLM_ADAPTER_MAX_PROMPT_LENGTH, "number");
  assert.equal(typeof llmAdapterConsentPhraseFor("llama3.1:8b"), "string");
  assert.equal(llmAdapterConsentPhraseFor("llama3.1:8b"), "GO: invoke local LLM at llama3.1:8b");
});

test("Whitelist includes operator-installed families verified via C1.5 scan", () => {
  // Each was discovered by `dema models scan` on 2026-05-18 GST · added with verification
  assert.ok(LLM_ADAPTER_ALLOWED_MODEL_FAMILIES.includes("gemma4"),
    "gemma4 family must be allowed (gemma4:26b · gemma4:26b-bizra-16k · gemma4:e4b installed)");
  assert.ok(LLM_ADAPTER_ALLOWED_MODEL_FAMILIES.includes("qwen3-coder-next"),
    "qwen3-coder-next must be allowed (79.7B coding model installed)");
  assert.ok(LLM_ADAPTER_ALLOWED_MODEL_FAMILIES.includes("whiterabbitneo-v3"),
    "whiterabbitneo-v3 must be allowed (security-focused 7.6B model installed)");
});

test("Operator-installed model name-prefixes pass isAllowedModelName check via preview", () => {
  const installed = [
    "gemma4:26b",
    "gemma4:26b-bizra-16k",
    "gemma4:e4b",
    "qwen3-coder-next:q4_K_M",
    "whiterabbitneo-v3:7b-q4_K_M",
    "deepseek-r1:7b",
    "nomic-embed-text:latest"
  ];
  for (const name of installed) {
    const p = buildLLMInvocationPreview({ model: name, prompt: "test" });
    assert.equal(p.model_allowed_in_whitelist, true,
      `'${name}' must pass whitelist check (operator has it installed via C1.5 scan)`);
  }
});

// =========================================================================
// INTEGRATION / DOCTRINE TESTS (3 · for Master Craftsmanship completeness)
// =========================================================================

test("All 10 Master Craftsmanship checks · structural verification", () => {
  // Check 1 · canon-bound: schema + truth_label + canonical boundary
  const p = buildLLMInvocationPreview({ model: "llama3.1:8b", prompt: "hi" });
  assert.match(p.schema, /^bizra\.dema\.[a-z0-9_]+\.v\d+\.\d+$/);
  assert.equal(p.truth_label, "NODE0_LOCAL_SEED");
  assert.ok(isCanonicalBoundary(p.boundary));

  // Check 3 · consent-gated: requires exact-string consent phrase
  assert.match(p.consent_required, /^GO: invoke local LLM at /);

  // Check 6 · boundary-disciplined: declared blocked_effects
  assert.ok(p.blocked_effects.length >= 7);
  assert.ok(p.blocked_effects.includes("public_network_use"));
  assert.ok(p.blocked_effects.includes("non_whitelisted_model_invocation"));
  assert.ok(p.blocked_effects.includes("consent_phrase_inference_or_fuzzy_match"));
});

test("Adversarial · empty prompt is refused with prompt_empty error", async () => {
  const r = await invokeLocalLLM({
    model: "llama3.1:8b",
    prompt: "",
    consentPhrase: "GO: invoke local LLM at llama3.1:8b"
  });
  assert.equal(r.invocation_status, "failed");
  assert.match(r.error_reason, /prompt_empty/);
});

test("Adversarial · oversized prompt is refused with prompt_too_long error", async () => {
  const huge = "X".repeat(LLM_ADAPTER_MAX_PROMPT_LENGTH + 1);
  const r = await invokeLocalLLM({
    model: "llama3.1:8b",
    prompt: huge,
    consentPhrase: "GO: invoke local LLM at llama3.1:8b"
  });
  assert.equal(r.invocation_status, "failed");
  assert.match(r.error_reason, /prompt_too_long/);
});

// =========================================================================
// ADR-018 v0.1 — runtime-emission boundary + verdict_role + Layer 1
// inbound/outbound + consent-freshness tests
// =========================================================================

import {
  isRuntimeEmissionBoundary,
  isCanonicalBoundary as isCanonicalBoundary_2,
  RUNTIME_EMISSION_PERMISSIVE_KEY_SET,
  RUNTIME_EMISSION_STRICTLY_FALSE_KEY_SET
} from "../packages/core/src/preview-boundary.js";
import { validateAgainstRegistry } from "../packages/core/src/envelope-schema-validator.js";

test("ADR-018 · result envelope boundary is runtime-emission shape · not canonical preview-boundary", async () => {
  const mock = mockFetch({
    ok: true,
    status: 200,
    json: async () => ({ response: "hi back", done: true })
  });
  const r = await invokeLocalLLM({
    model: "llama3.1:8b",
    prompt: "hi",
    consentPhrase: "GO: invoke local LLM at llama3.1:8b",
    fetchImpl: mock
  });
  assert.equal(r.invocation_status, "completed");
  // Boundary now passes runtime-emission · NOT canonical-preview
  assert.ok(isRuntimeEmissionBoundary(r.boundary));
  assert.equal(isCanonicalBoundary_2(r.boundary), false);
  // Legitimate true keys on a completed runtime emission
  for (const key of RUNTIME_EMISSION_PERMISSIVE_KEY_SET) {
    if (key === "consent_collected") continue;
    assert.equal(r.boundary[key], true, `${key} must be true on completed invocation`);
  }
  // Strictly-false keys remain false
  for (const key of RUNTIME_EMISSION_STRICTLY_FALSE_KEY_SET) {
    assert.equal(r.boundary[key], false, `${key} must remain false on runtime emission`);
  }
});

test("ADR-018 · result envelope carries verdict_role: 'suggestion' per ADR-015", async () => {
  const mock = mockFetch({
    ok: true,
    status: 200,
    json: async () => ({ response: "ok", done: true })
  });
  const r = await invokeLocalLLM({
    model: "llama3.1:8b",
    prompt: "hi",
    consentPhrase: "GO: invoke local LLM at llama3.1:8b",
    fetchImpl: mock
  });
  assert.equal(r.verdict_role, "suggestion");
});

test("ADR-018 · result envelope structurally validates against bizra.dema.llm_invocation_result.v0.1", async () => {
  const mock = mockFetch({
    ok: true,
    status: 200,
    json: async () => ({ response: "ok", done: true })
  });
  const r = await invokeLocalLLM({
    model: "llama3.1:8b",
    prompt: "a safe prompt",
    consentPhrase: "GO: invoke local LLM at llama3.1:8b",
    fetchImpl: mock
  });
  const v = validateAgainstRegistry(r);
  assert.equal(v.recognized, true);
  assert.equal(v.ok, true, `expected ok=true; errors: ${JSON.stringify(v.errors)}`);
  assert.equal(v.truth_label, "MEASURED");
});

test("ADR-018 §S5 · inbound prompt with path-leakage → INVOCATION_BLOCKED (no fetch entry)", async () => {
  // ADR-018 review fix #7: strengthen the "no fetch" assertion. Previously
  // the flag was set inside the json() callback; if fetch was called but
  // JSON parsing failed somehow, the flag would stay false. Now we mark
  // at fetch ENTRY (the fetchImpl function itself), so any call to fetch
  // — even one that never reaches the body — gets caught.
  let fetchEntered = false;
  const trackingFetch = async () => {
    fetchEntered = true;
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ response: "leaked", done: true })
    };
  };
  // Prompt contains a path that Layer 1 flags as leakage
  const r = await invokeLocalLLM({
    model: "llama3.1:8b",
    prompt: "look at /home/operator/secret.txt and tell me what is there",
    consentPhrase: "GO: invoke local LLM at llama3.1:8b",
    fetchImpl: trackingFetch
  });
  assert.equal(r.invocation_status, "blocked");
  assert.equal(r.truth_label, "INVOCATION_BLOCKED");
  assert.equal(fetchEntered, false, "fetch must NEVER be entered when inbound prompt is blocked");
  assert.ok(
    r.prompt_safety_verdict === "LEAKAGE_DETECTED" || r.prompt_safety_verdict === "LOCAL_ONLY",
    `expected LEAKAGE_DETECTED or LOCAL_ONLY, got ${r.prompt_safety_verdict}`
  );
});

test("ADR-018 §S5 · outbound model response with path-leakage → response REDACTED", async () => {
  const leakyResponse = "Sure! the file is at /home/operator/secret.txt — content X";
  const mock = mockFetch({
    ok: true,
    status: 200,
    json: async () => ({ response: leakyResponse, done: true })
  });
  const r = await invokeLocalLLM({
    model: "llama3.1:8b",
    prompt: "anything safe",
    consentPhrase: "GO: invoke local LLM at llama3.1:8b",
    fetchImpl: mock
  });
  assert.equal(r.invocation_status, "completed");
  assert.notEqual(r.response_safety_verdict, "PUBLIC_SAFE");
  assert.match(r.response_text_preview, /^\[REDACTED:/);
});

test("ADR-018 §S6 · same consent phrase replayed in same process → consent_phrase_replayed_in_session", async () => {
  // Reset, then invoke twice with the same phrase.
  __resetInvocationFreshness();
  const mock1 = mockFetch({ ok: true, status: 200, json: async () => ({ response: "first", done: true }) });
  const first = await invokeLocalLLM({
    model: "llama3.1:8b",
    prompt: "hi",
    consentPhrase: "GO: invoke local LLM at llama3.1:8b",
    fetchImpl: mock1
  });
  assert.equal(first.invocation_status, "completed");
  assert.equal(first.attempt_n, 1);

  // Second call with the SAME consent phrase must be rejected.
  const mock2 = mockFetch({ ok: true, status: 200, json: async () => ({ response: "second", done: true }) });
  const second = await invokeLocalLLM({
    model: "llama3.1:8b",
    prompt: "hi",
    consentPhrase: "GO: invoke local LLM at llama3.1:8b",
    fetchImpl: mock2
  });
  assert.equal(second.invocation_status, "failed");
  assert.match(second.error_reason, /consent_phrase_replayed_in_session/);
});

test("ADR-018 §S6 · process-fresh reset allows re-invocation", async () => {
  // Use, reset, use again with same phrase.
  const mock = mockFetch({ ok: true, status: 200, json: async () => ({ response: "ok", done: true }) });
  await invokeLocalLLM({
    model: "llama3.1:8b",
    prompt: "hi",
    consentPhrase: "GO: invoke local LLM at llama3.1:8b",
    fetchImpl: mock
  });
  __resetInvocationFreshness();
  const after = await invokeLocalLLM({
    model: "llama3.1:8b",
    prompt: "hi",
    consentPhrase: "GO: invoke local LLM at llama3.1:8b",
    fetchImpl: mock
  });
  assert.equal(after.invocation_status, "completed");
  assert.equal(after.attempt_n, 1, "reset should restart the attempt counter");
});

test("ADR-018 · effects_observed alias is the same boundary object (backwards-compat one cycle)", async () => {
  const mock = mockFetch({
    ok: true,
    status: 200,
    json: async () => ({ response: "ok", done: true })
  });
  const r = await invokeLocalLLM({
    model: "llama3.1:8b",
    prompt: "hi",
    consentPhrase: "GO: invoke local LLM at llama3.1:8b",
    fetchImpl: mock
  });
  // alias preserved · same reference
  assert.equal(r.effects_observed, r.boundary);
});

// =========================================================================
// ADR-018 PR #100 review-fix tests (3 new behaviors)
// =========================================================================

test("ADR-018 review fix #4 · http_status failure preserves network_used=true (fetch was attempted)", async () => {
  const mock = mockFetch({
    ok: false,
    status: 500,
    statusText: "Internal Server Error",
    json: async () => ({})
  });
  const r = await invokeLocalLLM({
    model: "llama3.1:8b",
    prompt: "hi",
    consentPhrase: "GO: invoke local LLM at llama3.1:8b",
    fetchImpl: mock
  });
  assert.equal(r.invocation_status, "failed");
  assert.match(r.error_reason, /http_status_500/);
  // Fetch was attempted → these boundary keys must remain true even though
  // the request failed. Prior bug: they were all driven by isCompletedSuccess
  // and collapsed to false on any error.
  assert.equal(r.boundary.network_used, true, "network was used (fetch was sent)");
  assert.equal(r.boundary.prompt_executed, true, "prompt was sent over the wire");
  assert.equal(r.boundary.runtime_execution_performed, true, "runtime executed the fetch");
  // But the model itself did not complete — these stay false.
  assert.equal(r.boundary.model_loaded, false);
  assert.equal(r.boundary.model_invocation_performed, false);
});

test("ADR-018 review fix #4 · network_error failure also preserves network_used=true", async () => {
  const mock = async () => {
    throw new Error("ECONNREFUSED");
  };
  const r = await invokeLocalLLM({
    model: "llama3.1:8b",
    prompt: "hi",
    consentPhrase: "GO: invoke local LLM at llama3.1:8b",
    fetchImpl: mock
  });
  assert.equal(r.invocation_status, "failed");
  assert.match(r.error_reason, /network_error/);
  assert.equal(r.boundary.network_used, true);
  assert.equal(r.boundary.prompt_executed, true);
  assert.equal(r.boundary.runtime_execution_performed, true);
  assert.equal(r.boundary.model_loaded, false);
  assert.equal(r.boundary.model_invocation_performed, false);
});

test("ADR-018 review fix #4 · pre-fetch gate failure (consent_mismatch) keeps all runtime keys false", async () => {
  // Mismatched consent never reaches fetch · all runtime-emission keys
  // including network_used MUST be false.
  const mock = mockFetch({ ok: true, status: 200, json: async () => ({ response: "x" }) });
  const r = await invokeLocalLLM({
    model: "llama3.1:8b",
    prompt: "hi",
    consentPhrase: "wrong phrase",
    fetchImpl: mock
  });
  assert.equal(r.invocation_status, "failed");
  assert.match(r.error_reason, /consent_phrase_mismatch/);
  assert.equal(r.boundary.network_used, false);
  assert.equal(r.boundary.prompt_executed, false);
  assert.equal(r.boundary.runtime_execution_performed, false);
});

test("ADR-018 review fix #6 · 200 OK with missing response field → malformed_response_payload (failed, not completed)", async () => {
  const mock = mockFetch({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({ done: true /* no `response` field */ })
  });
  const r = await invokeLocalLLM({
    model: "llama3.1:8b",
    prompt: "hi",
    consentPhrase: "GO: invoke local LLM at llama3.1:8b",
    fetchImpl: mock
  });
  assert.equal(r.invocation_status, "failed", "missing body.response must NOT be 'completed'");
  assert.match(r.error_reason, /malformed_response_payload/);
  // fetch was attempted → network_used=true; but invocation did not complete
  assert.equal(r.boundary.network_used, true);
  assert.equal(r.boundary.model_invocation_performed, false);
});

test("ADR-018 review fix #6 · 200 OK with non-string response (number) → malformed_response_payload", async () => {
  const mock = mockFetch({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({ response: 42 /* number, not string */, done: true })
  });
  const r = await invokeLocalLLM({
    model: "llama3.1:8b",
    prompt: "hi",
    consentPhrase: "GO: invoke local LLM at llama3.1:8b",
    fetchImpl: mock
  });
  assert.equal(r.invocation_status, "failed");
  assert.match(r.error_reason, /malformed_response_payload/);
});

test("ADR-018 review fix #3 · attempt_n is monotonic across replayed calls", async () => {
  __resetInvocationFreshness();
  const mock = mockFetch({ ok: true, status: 200, json: async () => ({ response: "first", done: true }) });
  const first = await invokeLocalLLM({
    model: "llama3.1:8b",
    prompt: "hi",
    consentPhrase: "GO: invoke local LLM at llama3.1:8b",
    fetchImpl: mock
  });
  assert.equal(first.attempt_n, 1);

  const second = await invokeLocalLLM({
    model: "llama3.1:8b",
    prompt: "hi",
    consentPhrase: "GO: invoke local LLM at llama3.1:8b",
    fetchImpl: mock
  });
  // Replay rejected, but attempt_n must still increment to 2 (not stuck at 1).
  assert.equal(second.invocation_status, "failed");
  assert.match(second.error_reason, /consent_phrase_replayed_in_session/);
  assert.equal(second.attempt_n, 2, "attempt_n must be monotonic across replays");

  const third = await invokeLocalLLM({
    model: "llama3.1:8b",
    prompt: "hi",
    consentPhrase: "GO: invoke local LLM at llama3.1:8b",
    fetchImpl: mock
  });
  assert.equal(third.attempt_n, 3, "third replay must show attempt_n=3");
});
