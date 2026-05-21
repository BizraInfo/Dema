import { test } from "node:test";
import assert from "node:assert/strict";

import {
  invokeRoutedLocalModel,
  ROUTED_LLM_INVOCATION_RESULT_SCHEMA
} from "../packages/core/src/routed-llm-invocation.js";

// Mock route receipt builders -------------------------------------------------

function routeReceiptWithSelectedModel(modelId = "llama3.1:8b") {
  return Object.freeze({
    schema: "bizra.dema.local_model_route_receipt.v0.1",
    timestamp: "2026-05-21T13:00:00.000Z",
    task_kind: "synthesis",
    required_role: null,
    local_only: true,
    max_size_class: null,
    allow_unknown: false,
    selected_model_id: modelId,
    selected_model_role: "dema_face",
    selected_model_locality: "local",
    reason: "matched_preferred_role_dema_face",
    rejected_candidates: [],
    canon_refs: [
      "CLAIM_REGISTER_v0_1.md",
      "BIZRA_AGENT_DNA_LAW_OF_ASSUMPTION_v0_1.md",
      "DEMA_AGENT_HARNESS_AND_SKILL_DNA_v0_1.md",
      "NODE0_DEMA_COMPLETE_COMPONENT_DNA_v0_1.md"
    ],
    warnings: [],
    boundary: Object.freeze({
      runtime: false,
      model_invocation: false,
      network_used: false,
      federation: false,
      mint: false,
      token_economy: false,
      urp_networking: false,
      prompt_invocation_allowed: false
    })
  });
}

function routeReceiptWithNoSelection() {
  return Object.freeze({
    schema: "bizra.dema.local_model_route_receipt.v0.1",
    timestamp: "2026-05-21T13:00:00.000Z",
    task_kind: "synthesis",
    selected_model_id: null,
    selected_model_role: null,
    selected_model_locality: null,
    reason: "no_acceptable_candidate",
    rejected_candidates: [],
    canon_refs: [],
    warnings: [],
    boundary: {}
  });
}

// Mock fetch: returns a successful Ollama /api/generate JSON response.
function mockFetchSuccess(responseText = "hello world") {
  return async () => ({
    ok: true,
    status: 200,
    headers: { get: (h) => (h.toLowerCase() === "content-type" ? "application/json" : null) },
    json: async () => ({ response: responseText, model: "ignored", done: true })
  });
}

// Mock fetch: hangs until aborted (simulates timeout).
function mockFetchTimeout() {
  return (_url, opts) => new Promise((_resolve, reject) => {
    if (opts?.signal) {
      opts.signal.addEventListener("abort", () => {
        const err = new Error("aborted");
        err.name = "AbortError";
        reject(err);
      });
    }
  });
}

// === TESTS ===================================================================

test("successful routed invocation: whitelisted model + valid consent + mocked localhost → completed envelope", async () => {
  const route = routeReceiptWithSelectedModel("llama3.1:8b");
  const envelope = await invokeRoutedLocalModel({
    routeReceipt: route,
    prompt: "hello",
    invokeConsent: "GO: invoke local LLM at llama3.1:8b",
    fetchImpl: mockFetchSuccess("hello world")
  });
  assert.equal(envelope.schema, ROUTED_LLM_INVOCATION_RESULT_SCHEMA);
  assert.equal(envelope.selected_model_id, "llama3.1:8b");
  assert.equal(envelope.invocation_result.invocation_status, "completed");
  assert.equal(envelope.invocation_result.model_invoked, "llama3.1:8b");
  assert.match(envelope.invocation_result.response_text_preview ?? "", /hello world/);
  assert.equal(envelope.boundary.runtime, true);
  assert.equal(envelope.boundary.model_invocation, true);
  assert.equal(envelope.boundary.network_used, true);
  assert.equal(envelope.boundary.localhost_only, true);
  assert.equal(envelope.boundary.remote_provider, false);
  assert.equal(envelope.boundary.federation, false);
  assert.equal(envelope.boundary.mint, false);
  assert.equal(envelope.boundary.token_economy, false);
  assert.equal(envelope.boundary.urp_networking, false);
});

test("envelope includes original route receipt and selected_model_id unchanged", async () => {
  const route = routeReceiptWithSelectedModel("qwen2.5:7b");
  const envelope = await invokeRoutedLocalModel({
    routeReceipt: route,
    prompt: "ping",
    invokeConsent: "GO: invoke local LLM at qwen2.5:7b",
    fetchImpl: mockFetchSuccess("pong")
  });
  assert.deepEqual(envelope.route_receipt, route);
  assert.equal(envelope.selected_model_id, "qwen2.5:7b");
});

test("placeholder / non-whitelisted selected_model_id fails closed through adapter whitelist gate", async () => {
  // operator-test-dema-face does NOT match the family[:tag] whitelist regex.
  const route = routeReceiptWithSelectedModel("operator-test-dema-face-placeholder");
  const envelope = await invokeRoutedLocalModel({
    routeReceipt: route,
    prompt: "x",
    invokeConsent: "GO: invoke local LLM at operator-test-dema-face-placeholder",
    fetchImpl: mockFetchSuccess()
  });
  assert.equal(envelope.invocation_result.invocation_status, "failed");
  assert.match(envelope.invocation_result.error_reason ?? "", /model_not_in_whitelist/);
  // Pre-fetch failure → no network used.
  assert.equal(envelope.boundary.network_used, false);
  assert.equal(envelope.boundary.model_invocation, false);
});

test("empty prompt fails closed at adapter gate (no network used)", async () => {
  const route = routeReceiptWithSelectedModel("llama3.1:8b");
  const envelope = await invokeRoutedLocalModel({
    routeReceipt: route,
    prompt: "",
    invokeConsent: "GO: invoke local LLM at llama3.1:8b",
    fetchImpl: mockFetchSuccess()
  });
  assert.equal(envelope.invocation_result.invocation_status, "failed");
  assert.match(envelope.invocation_result.error_reason ?? "", /prompt_empty/);
  assert.equal(envelope.boundary.network_used, false);
  assert.equal(envelope.boundary.model_invocation, false);
});

test("prompt too long fails closed at adapter gate (no network used)", async () => {
  const route = routeReceiptWithSelectedModel("llama3.1:8b");
  const tooLong = "x".repeat(100001); // exceeds adapter's MAX_PROMPT_LENGTH
  const envelope = await invokeRoutedLocalModel({
    routeReceipt: route,
    prompt: tooLong,
    invokeConsent: "GO: invoke local LLM at llama3.1:8b",
    fetchImpl: mockFetchSuccess()
  });
  assert.equal(envelope.invocation_result.invocation_status, "failed");
  assert.match(envelope.invocation_result.error_reason ?? "", /prompt_too_long/);
  assert.equal(envelope.boundary.network_used, false);
});

test("consent phrase mismatch fails closed at adapter gate (no network used)", async () => {
  const route = routeReceiptWithSelectedModel("llama3.1:8b");
  const envelope = await invokeRoutedLocalModel({
    routeReceipt: route,
    prompt: "hello",
    invokeConsent: "wrong phrase",
    fetchImpl: mockFetchSuccess()
  });
  assert.equal(envelope.invocation_result.invocation_status, "failed");
  assert.match(envelope.invocation_result.error_reason ?? "", /consent_phrase_mismatch/);
  assert.equal(envelope.boundary.network_used, false);
});

test("timeout path: aborted fetch → failed envelope, network_used=true (fetch was attempted)", async () => {
  const route = routeReceiptWithSelectedModel("llama3.1:8b");
  const envelope = await invokeRoutedLocalModel({
    routeReceipt: route,
    prompt: "hello",
    invokeConsent: "GO: invoke local LLM at llama3.1:8b",
    timeoutMs: 1, // 1 ms — guaranteed timeout
    fetchImpl: mockFetchTimeout()
  });
  assert.equal(envelope.invocation_result.invocation_status, "failed");
  // The fetch was attempted (network was used), even though it timed out.
  assert.equal(envelope.boundary.network_used, true);
  // Model was NOT invoked (response never returned).
  assert.equal(envelope.boundary.model_invocation, false);
});

test("no selected_model_id (placeholder default registry routes nothing) short-circuits before adapter", async () => {
  const route = routeReceiptWithNoSelection();
  const envelope = await invokeRoutedLocalModel({
    routeReceipt: route,
    prompt: "hello",
    invokeConsent: "GO: invoke local LLM at anything",
    fetchImpl: mockFetchSuccess()
  });
  assert.equal(envelope.selected_model_id, null);
  // adapter was NOT called → invocation_result is null
  assert.equal(envelope.invocation_result, null);
  assert.equal(envelope.boundary.network_used, false);
  assert.equal(envelope.boundary.model_invocation, false);
  assert.ok(envelope.warnings.some((w) => w.startsWith("no_selected_model_pre_invocation")));
});

test("envelope is deep-frozen + 9-key boundary structure preserved across all paths", async () => {
  const route = routeReceiptWithSelectedModel("llama3.1:8b");
  const envelope = await invokeRoutedLocalModel({
    routeReceipt: route,
    prompt: "hello",
    invokeConsent: "GO: invoke local LLM at llama3.1:8b",
    fetchImpl: mockFetchSuccess("ok")
  });
  assert.ok(Object.isFrozen(envelope));
  assert.ok(Object.isFrozen(envelope.boundary));
  assert.ok(Object.isFrozen(envelope.warnings));
  const boundaryKeys = Object.keys(envelope.boundary).sort();
  assert.deepEqual(boundaryKeys, [
    "federation",
    "localhost_only",
    "mint",
    "model_invocation",
    "network_used",
    "remote_provider",
    "runtime",
    "token_economy",
    "urp_networking"
  ]);
});
