import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildLocalLLMRouterPreview,
  LOCAL_LLM_ROUTER_CANONICAL_ROLES,
  LOCAL_LLM_ROUTER_ALLOWED_FAMILIES
} from "../packages/core/src/local-llm-router-preview.js";

const REQUIRED_BOUNDARY_FALSE_KEYS = [
  "filesystem_write_performed",
  "network_used",
  "runtime_execution_performed",
  "model_loaded",
  "model_invocation_performed",
  "prompt_executed",
  "external_call_performed",
  "raw_corpus_scan_performed",
  "raw_data_included",
  "tool_executed",
  "chain_advance_performed",
  "receipt_mint_performed",
  "federation_invoked",
  "node_connection_performed",
  "public_network_used",
  "consent_collected"
];

function assertExhaustiveFalseBoundary(boundary) {
  for (const key of REQUIRED_BOUNDARY_FALSE_KEYS) {
    assert.equal(boundary[key], false, `boundary.${key} must be false`);
  }
}

test("LLMRouter emits canonical schema + truth label + preview_only mode", () => {
  const router = buildLocalLLMRouterPreview();
  assert.equal(router.schema, "bizra.dema.local_llm_router_preview.v0.1");
  assert.equal(router.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(router.mode, "preview_only");
});

test("LLMRouter INVARIANT: routing_allowed=false at top level (always)", () => {
  // No inputs
  assert.equal(buildLocalLLMRouterPreview().routing_allowed, false);
  // With inventory hints
  assert.equal(buildLocalLLMRouterPreview({
    inventoryHints: [{ id: "llama3-8b", family: "llama" }]
  }).routing_allowed, false);
});

test("LLMRouter INVARIANT: invocation_status=not_invoked_preview_only (always)", () => {
  for (const hints of [[], [{ id: "x", family: "llama" }]]) {
    const r = buildLocalLLMRouterPreview({ inventoryHints: hints });
    assert.equal(r.invocation_status, "not_invoked_preview_only");
  }
});

test("LLMRouter default inventory is empty + next_safe_action prompts declaration", () => {
  const router = buildLocalLLMRouterPreview();
  assert.equal(router.inventory.length, 0);
  assert.equal(router.next_safe_action, "declare_local_model_inventory");
});

test("LLMRouter role_map has exactly 5 canonical roles", () => {
  const router = buildLocalLLMRouterPreview();
  assert.equal(router.role_map.length, 5);
  assert.equal(LOCAL_LLM_ROUTER_CANONICAL_ROLES.length, 5);
  assert.deepEqual([...router.canonical_roles], [
    "mission_intent_parse",
    "pat_proposal_draft",
    "consent_phrase_generate",
    "evidence_summary",
    "abstain_or_unknown"
  ]);
});

test("LLMRouter every role in role_map has routing_allowed=false", () => {
  const router = buildLocalLLMRouterPreview({
    inventoryHints: [
      { id: "llama3-8b", family: "llama", role: "mission_intent_parse" },
      { id: "qwen-7b", family: "qwen", role: "pat_proposal_draft" }
    ]
  });
  for (const role of router.role_map) {
    assert.equal(role.routing_allowed, false, `role ${role.role} must have routing_allowed=false`);
    assert.equal(role.invocation_status, "not_invoked_preview_only");
    assert.equal(role.fallback, "abstain");
  }
});

test("LLMRouter default role_map assignments are all null", () => {
  const router = buildLocalLLMRouterPreview();
  for (const role of router.role_map) {
    assert.equal(role.assigned_model_id, null);
  }
});

test("LLMRouter role assignment from inventory hints", () => {
  const router = buildLocalLLMRouterPreview({
    inventoryHints: [
      { id: "llama3-8b", family: "llama", role: "mission_intent_parse" },
      { id: "qwen-7b", family: "qwen", role: "consent_phrase_generate" }
    ]
  });
  const intentRole = router.role_map.find((r) => r.role === "mission_intent_parse");
  const consentRole = router.role_map.find((r) => r.role === "consent_phrase_generate");
  assert.equal(intentRole.assigned_model_id, "llama3-8b");
  assert.equal(consentRole.assigned_model_id, "qwen-7b");
  // Unassigned roles remain null
  const summaryRole = router.role_map.find((r) => r.role === "evidence_summary");
  assert.equal(summaryRole.assigned_model_id, null);
});

test("LLMRouter ADVERSARIAL: caller-injected routing_allowed=true ignored per model", () => {
  const router = buildLocalLLMRouterPreview({
    inventoryHints: [
      { id: "evil-model", family: "llama", role: "mission_intent_parse",
        routing_allowed: true, status: "loaded", invocation_status: "running" }
    ]
  });
  const m = router.inventory[0];
  assert.equal(m.routing_allowed, false);
  assert.equal(m.status, "declared_preview_only");
  assert.equal(m.invocation_status, "not_invoked_preview_only");
});

test("LLMRouter ADVERSARIAL: caller's status=loaded/ready pinned to declared_preview_only", () => {
  for (const claimedStatus of ["loaded", "ready", "running", "active", "permitted"]) {
    const router = buildLocalLLMRouterPreview({
      inventoryHints: [{ id: "x", family: "llama", status: claimedStatus }]
    });
    assert.equal(router.inventory[0].status, "declared_preview_only");
  }
});

test("LLMRouter ADVERSARIAL: external URL / tool_execution / prompt_log fields stripped", () => {
  const router = buildLocalLLMRouterPreview({
    inventoryHints: [{
      id: "x",
      family: "llama",
      external_url: "https://attacker.example/llm",
      tool_execution: true,
      prompt_executed_log: ["leak"],
      raw_corpus_path: "/etc/passwd",
      api_key: "sk-leak"
    }]
  });
  const m = router.inventory[0];
  assert.equal("external_url" in m, false);
  assert.equal("tool_execution" in m, false);
  assert.equal("prompt_executed_log" in m, false);
  assert.equal("raw_corpus_path" in m, false);
  assert.equal("api_key" in m, false);
});

test("LLMRouter ADVERSARIAL: model with non-string id is filtered out", () => {
  const router = buildLocalLLMRouterPreview({
    inventoryHints: [
      { id: null, family: "llama" },
      { id: 42, family: "llama" },
      { id: "", family: "llama" },
      { id: "valid-model", family: "llama" }
    ]
  });
  assert.equal(router.inventory.length, 1);
  assert.equal(router.inventory[0].id, "valid-model");
});

test("LLMRouter ADVERSARIAL: unknown family is coerced to 'other'", () => {
  const router = buildLocalLLMRouterPreview({
    inventoryHints: [{ id: "x", family: "MAGIC_UNKNOWN_FAMILY" }]
  });
  assert.equal(router.inventory[0].family, "other");
});

test("LLMRouter ADVERSARIAL: unknown role is coerced to 'abstain_or_unknown'", () => {
  const router = buildLocalLLMRouterPreview({
    inventoryHints: [{ id: "x", family: "llama", role: "EVIL_PRIVILEGED_ROLE" }]
  });
  assert.equal(router.inventory[0].role, "abstain_or_unknown");
});

test("LLMRouter ADVERSARIAL: out-of-range size_gb sanitized to null", () => {
  const router = buildLocalLLMRouterPreview({
    inventoryHints: [
      { id: "a", family: "llama", size_gb: -5 },
      { id: "b", family: "llama", size_gb: 99999 },
      { id: "c", family: "llama", size_gb: "huge" },
      { id: "d", family: "llama", size_gb: 8.5 }
    ]
  });
  assert.equal(router.inventory.find((m) => m.id === "a").size_gb, null);
  assert.equal(router.inventory.find((m) => m.id === "b").size_gb, null);
  assert.equal(router.inventory.find((m) => m.id === "c").size_gb, null);
  assert.equal(router.inventory.find((m) => m.id === "d").size_gb, 8.5);
});

test("LLMRouter ADVERSARIAL: duplicate ids deduplicated (first wins)", () => {
  const router = buildLocalLLMRouterPreview({
    inventoryHints: [
      { id: "same-id", family: "llama", role: "mission_intent_parse" },
      { id: "same-id", family: "qwen", role: "abstain_or_unknown" }
    ]
  });
  assert.equal(router.inventory.length, 1);
  assert.equal(router.inventory[0].family, "llama");
  assert.equal(router.inventory[0].role, "mission_intent_parse");
});

test("LLMRouter abstain_policy defaults to abstain on missing routing/role/consent", () => {
  const router = buildLocalLLMRouterPreview();
  assert.equal(router.abstain_policy.default_when_no_routing_authorized, true);
  assert.equal(router.abstain_policy.default_when_role_unassigned, true);
  assert.equal(router.abstain_policy.default_when_consent_not_collected, true);
  assert.equal(router.abstain_policy.output_on_abstain, null);
});

test("LLMRouter consent_boundary declares typed_GO + chain_advance requirement", () => {
  const router = buildLocalLLMRouterPreview();
  assert.equal(router.consent_boundary.routing_requires, "typed_GO_plus_chain_advance");
  assert.equal(router.consent_boundary.typed_go_present_in_preview, false);
  assert.equal(router.consent_boundary.chain_advance_present_in_preview, false);
});

test("LLMRouter boundary is exhaustively false and frozen", () => {
  const router = buildLocalLLMRouterPreview();
  assertExhaustiveFalseBoundary(router.boundary);
  assert.equal(Object.isFrozen(router.boundary), true);
});

test("LLMRouter is deeply frozen including inventory and role_map", () => {
  const router = buildLocalLLMRouterPreview({
    inventoryHints: [{ id: "m1", family: "llama", role: "mission_intent_parse" }]
  });
  assert.equal(Object.isFrozen(router), true);
  assert.equal(Object.isFrozen(router.inventory), true);
  assert.equal(Object.isFrozen(router.inventory[0]), true);
  assert.equal(Object.isFrozen(router.role_map), true);
  assert.equal(Object.isFrozen(router.role_map[0]), true);
  assert.equal(Object.isFrozen(router.abstain_policy), true);
  assert.equal(Object.isFrozen(router.consent_boundary), true);
  assert.equal(Object.isFrozen(router.boundary), true);
});

test("LLMRouter operator override propagates", () => {
  const router = buildLocalLLMRouterPreview({ operator: "TestPilot" });
  assert.equal(router.operator, "TestPilot");
});

test("LLMRouter non-array inventoryHints handled gracefully", () => {
  const router = buildLocalLLMRouterPreview({ inventoryHints: "not an array" });
  assert.equal(router.inventory.length, 0);
});

test("LLMRouter allowed_families is the canonical 8-entry list", () => {
  assert.deepEqual([...LOCAL_LLM_ROUTER_ALLOWED_FAMILIES], [
    "llama", "qwen", "mistral", "gpt-oss", "deepseek", "phi", "gemma", "other"
  ]);
});

test("LLMRouter inventory next_safe_action shifts to review_role_assignments when models present", () => {
  const router = buildLocalLLMRouterPreview({
    inventoryHints: [{ id: "m1", family: "llama" }]
  });
  assert.equal(router.next_safe_action, "review_role_assignments");
});
