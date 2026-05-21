import { test } from "node:test";
import assert from "node:assert/strict";

import {
  verifyRoutedInvocationEnvelope,
  ROUTED_INVOCATION_VERIFICATION_SCHEMA,
  INVARIANT_NAMES
} from "../packages/core/src/routed-invocation-verifier.js";

// =============================================================================
// Envelope factory helpers
// =============================================================================

function baseRouteReceipt({ selectedModelId = "llama3.1:8b" } = {}) {
  return {
    schema: "bizra.dema.local_model_route_receipt.v0.1",
    timestamp: "2026-05-21T13:00:00.000Z",
    task_kind: "synthesis",
    required_role: null,
    local_only: true,
    selected_model_id: selectedModelId,
    selected_model_role: selectedModelId === null ? null : "dema_face",
    selected_model_locality: selectedModelId === null ? null : "local",
    reason: selectedModelId === null ? "no_acceptable_candidate" : "matched_preferred_role_dema_face",
    rejected_candidates: [],
    canon_refs: [],
    warnings: [],
    boundary: {}
  };
}

function makeCompletedEnvelope() {
  return {
    schema: "bizra.dema.local_model_routed_invocation_result.v0.1",
    route_receipt: baseRouteReceipt(),
    selected_model_id: "llama3.1:8b",
    invocation_result: {
      schema: "bizra.dema.llm_invocation_result.v0.1",
      invocation_status: "completed",
      error_reason: null,
      model_invoked: "llama3.1:8b",
      prompt_length_chars: 5,
      response_length_chars: 11,
      response_text_preview: "hello world",
      response_raw_keys: ["response", "model", "done"],
      duration_ms: 42,
      target_endpoint: "http://localhost:11434",
      target_is_localhost: true,
      consent_phrase_verified: true,
      effects_observed: {},
      blocked_effects: []
    },
    boundary: {
      runtime: true,
      model_invocation: true,
      network_used: true,
      localhost_only: true,
      remote_provider: false,
      federation: false,
      mint: false,
      token_economy: false,
      urp_networking: false
    },
    warnings: []
  };
}

function makeFailedConsentMismatchEnvelope() {
  const env = makeCompletedEnvelope();
  env.invocation_result = {
    schema: "bizra.dema.llm_invocation_result.v0.1",
    invocation_status: "failed",
    error_reason: "consent_phrase_mismatch · required exact string: 'GO: invoke local LLM at llama3.1:8b' · invocation refused",
    model_invoked: "llama3.1:8b",
    prompt_length_chars: 5,
    response_length_chars: 0,
    response_text_preview: null,
    response_raw_keys: [],
    duration_ms: 0,
    target_endpoint: "http://localhost:11434",
    target_is_localhost: true,
    consent_phrase_verified: false,
    effects_observed: {},
    blocked_effects: []
  };
  env.boundary.model_invocation = false;
  env.boundary.network_used = false;
  return env;
}

function makeNullSelectionEnvelope() {
  return {
    schema: "bizra.dema.local_model_routed_invocation_result.v0.1",
    route_receipt: baseRouteReceipt({ selectedModelId: null }),
    selected_model_id: null,
    invocation_result: null,
    boundary: {
      runtime: true,
      model_invocation: false,
      network_used: false,
      localhost_only: true,
      remote_provider: false,
      federation: false,
      mint: false,
      token_economy: false,
      urp_networking: false
    },
    warnings: ["no_selected_model_pre_invocation"]
  };
}

// =============================================================================
// Tests
// =============================================================================

test("compliant successful envelope → verdict=compliant + next_step=review_response", () => {
  const v = verifyRoutedInvocationEnvelope(makeCompletedEnvelope());
  assert.equal(v.schema, ROUTED_INVOCATION_VERIFICATION_SCHEMA);
  assert.equal(v.verdict, "compliant");
  assert.equal(v.invariants_satisfied_count, v.invariants_total_count);
  assert.equal(v.invocation_status_summary, "completed");
  assert.equal(v.next_step, "review_response_in_saved_envelope");
  assert.equal(v.evidence_quality, "high");
});

test("compliant consent-mismatch failed envelope → verdict=compliant + next_step=retry_with_correct_invoke_consent", () => {
  const v = verifyRoutedInvocationEnvelope(makeFailedConsentMismatchEnvelope());
  assert.equal(v.verdict, "compliant");
  assert.equal(v.invocation_status_summary, "failed");
  assert.equal(v.next_step, "retry_with_correct_invoke_consent_for_selected_model");
  assert.ok(v.warnings.some((w) => w.startsWith("invocation_failed:")));
});

test("compliant null-selection envelope → verdict=compliant + next_step=populate_operator_registry", () => {
  const v = verifyRoutedInvocationEnvelope(makeNullSelectionEnvelope());
  assert.equal(v.verdict, "compliant");
  assert.equal(v.invocation_status_summary, "no_selection");
  assert.equal(v.next_step, "populate_operator_registry_with_active_local_models");
});

test("tampered selected_model_id (mismatch with route_receipt) → verdict=non_compliant", () => {
  const env = makeCompletedEnvelope();
  env.selected_model_id = "tampered-model:99b";
  const v = verifyRoutedInvocationEnvelope(env);
  assert.equal(v.verdict, "non_compliant");
  const failed = v.invariants.find((i) => i.name === "selected_model_id_consistent");
  assert.equal(failed.satisfied, false);
  assert.equal(v.next_step, "investigate_invariant_failures_in_verification_envelope");
});

test("tampered boundary.federation=true → verdict=non_compliant", () => {
  const env = makeCompletedEnvelope();
  env.boundary.federation = true;
  const v = verifyRoutedInvocationEnvelope(env);
  assert.equal(v.verdict, "non_compliant");
  const failed = v.invariants.find((i) => i.name === "boundary_federation_false");
  assert.equal(failed.satisfied, false);
});

test("wrong envelope schema → verdict=non_compliant", () => {
  const env = makeCompletedEnvelope();
  env.schema = "bizra.dema.something_else.v0.1";
  const v = verifyRoutedInvocationEnvelope(env);
  assert.equal(v.verdict, "non_compliant");
  const failed = v.invariants.find((i) => i.name === "envelope_schema_matches");
  assert.equal(failed.satisfied, false);
});

test("completed status with empty response_text_preview AND zero response_length_chars → verdict=non_compliant (completed_has_response fails)", () => {
  const env = makeCompletedEnvelope();
  env.invocation_result.response_length_chars = 0;
  env.invocation_result.response_text_preview = null;
  const v = verifyRoutedInvocationEnvelope(env);
  assert.equal(v.verdict, "non_compliant");
  const failed = v.invariants.find((i) => i.name === "completed_has_response");
  assert.equal(failed.satisfied, false);
});

test("verification envelope is frozen + all 17 invariant names present + correct boundary", () => {
  const v = verifyRoutedInvocationEnvelope(makeCompletedEnvelope());
  assert.ok(Object.isFrozen(v));
  assert.ok(Object.isFrozen(v.invariants));
  assert.ok(Object.isFrozen(v.boundary));
  // All 17 expected invariant names appear in the envelope.
  const namesInEnvelope = v.invariants.map((i) => i.name);
  for (const expectedName of INVARIANT_NAMES) {
    assert.ok(namesInEnvelope.includes(expectedName), `missing invariant: ${expectedName}`);
  }
  assert.equal(v.invariants_total_count, 17);
  // Verifier's own boundary.
  assert.equal(v.boundary.runtime, true);
  assert.equal(v.boundary.file_io, true);
  assert.equal(v.boundary.network_used, false);
  assert.equal(v.boundary.model_invocation, false);
  assert.equal(v.boundary.mutation, false);
  assert.equal(v.boundary.federation, false);
  assert.equal(v.boundary.mint, false);
  assert.equal(v.boundary.token_economy, false);
  assert.equal(v.boundary.urp_networking, false);
});
