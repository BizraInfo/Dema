import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildEffectCap,
  buildToolRegistry,
  invokeWithEffectCap,
  EFFECT_CAP_CANONICAL_EFFECTS,
  EFFECT_CAP_ALWAYS_BLOCKED_EFFECTS,
  EFFECT_CAP_SCHEMA_NAME,
  EFFECT_CAP_REGISTRY_SCHEMA_NAME,
  EFFECT_CAP_INVOCATION_SCHEMA_NAME
} from "../packages/core/src/effect-cap.js";
import { isCanonicalBoundary } from "../packages/core/src/preview-boundary.js";

function validCap() {
  return buildEffectCap({
    name: "test_tool",
    description: "for test",
    allowed_effects: ["read_local_file", "stat_file_metadata"],
    consent_scope_template: "GO: invoke test_tool"
  });
}

function tinyOkInvoke() {
  return async (_args) => ({ schema: "test.result.v0.1", ok: true });
}

// =========================================================================
// EFFECT-CAP DESCRIPTOR TESTS (6)
// =========================================================================

test("EffectCap emits canonical schema + truth label + descriptor mode", () => {
  const cap = validCap();
  assert.equal(cap.schema, EFFECT_CAP_SCHEMA_NAME);
  assert.equal(cap.schema, "bizra.dema.effect_cap.v0.1");
  assert.equal(cap.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(cap.mode, "descriptor");
});

test("EffectCap is deep-frozen at all sub-views", () => {
  const cap = validCap();
  assert.ok(Object.isFrozen(cap));
  assert.ok(Object.isFrozen(cap.allowed_effects));
  assert.ok(Object.isFrozen(cap.blocked_effects));
  assert.ok(Object.isFrozen(cap.boundary));
  assert.ok(Object.isFrozen(cap.canonical_effects_vocabulary));
  assert.ok(Object.isFrozen(cap.always_blocked_effects));
});

test("EffectCap boundary is canonical 16-key", () => {
  const cap = validCap();
  assert.ok(isCanonicalBoundary(cap.boundary));
});

test("EffectCap always blocks the 8 ALWAYS_BLOCKED effects · no exceptions", () => {
  const cap = validCap();
  for (const e of EFFECT_CAP_ALWAYS_BLOCKED_EFFECTS) {
    assert.ok(cap.blocked_effects.includes(e),
      `every cap must block '${e}' (got blocked_effects = ${JSON.stringify([...cap.blocked_effects])})`);
  }
});

test("EffectCap conflict resolution · effect in BOTH allowed and blocked → blocked wins", () => {
  const cap = buildEffectCap({
    name: "conflict_test",
    allowed_effects: ["read_local_file", "execute_arbitrary_shell"], // shell is always-blocked
    consent_scope_template: "GO: conflict_test"
  });
  // execute_arbitrary_shell is in ALWAYS_BLOCKED so it must NOT appear in allowed_effects
  assert.equal(cap.allowed_effects.includes("execute_arbitrary_shell"), false);
  assert.equal(cap.blocked_effects.includes("execute_arbitrary_shell"), true);
});

test("EffectCap valid=false when missing required fields", () => {
  const noName = buildEffectCap({ consent_scope_template: "GO: x" });
  const noConsent = buildEffectCap({ name: "x" });
  const noGoToken = buildEffectCap({ name: "x", consent_scope_template: "just a phrase no token" });
  assert.equal(noName.valid, false);
  assert.equal(noConsent.valid, false);
  assert.equal(noGoToken.valid, false);
});

// =========================================================================
// EFFECT-CAP ADVERSARIAL INPUT TESTS (5)
// =========================================================================

test("Adversarial · non-string name coerced to empty · valid=false", () => {
  const cap = buildEffectCap({ name: { malicious: true }, consent_scope_template: "GO: x" });
  assert.equal(cap.name, "");
  assert.equal(cap.valid, false);
});

test("Adversarial · non-canonical effect names dropped from allowed_effects", () => {
  const cap = buildEffectCap({
    name: "test",
    allowed_effects: ["read_local_file", "totally_made_up_effect", "another_fake"],
    consent_scope_template: "GO: test"
  });
  assert.deepEqual([...cap.allowed_effects], ["read_local_file"]);
});

test("Adversarial · function/symbol in allowed_effects array filtered", () => {
  const cap = buildEffectCap({
    name: "test",
    allowed_effects: ["read_local_file", () => "malicious", Symbol("evil"), 42],
    consent_scope_template: "GO: test"
  });
  assert.deepEqual([...cap.allowed_effects], ["read_local_file"]);
});

test("Adversarial · duplicate allowed_effects deduped", () => {
  const cap = buildEffectCap({
    name: "test",
    allowed_effects: ["read_local_file", "read_local_file", "stat_file_metadata", "read_local_file"],
    consent_scope_template: "GO: test"
  });
  assert.equal(cap.allowed_effects.length, 2);
});

test("Adversarial · audit_trail_required defaults to TRUE · cannot be silently disabled", () => {
  const cap1 = buildEffectCap({ name: "t", consent_scope_template: "GO: t" });
  const cap2 = buildEffectCap({ name: "t", consent_scope_template: "GO: t", audit_trail_required: "no" });
  const cap3 = buildEffectCap({ name: "t", consent_scope_template: "GO: t", audit_trail_required: null });
  assert.equal(cap1.audit_trail_required, true);
  assert.equal(cap2.audit_trail_required, true);
  assert.equal(cap3.audit_trail_required, true);
});

// =========================================================================
// TOOL REGISTRY TESTS (5)
// =========================================================================

test("ToolRegistry emits canonical schema + truth label", () => {
  const reg = buildToolRegistry({
    tools: { test_tool: { cap: validCap(), invoke: tinyOkInvoke() } }
  });
  assert.equal(reg.schema, EFFECT_CAP_REGISTRY_SCHEMA_NAME);
  assert.equal(reg.tool_count, 1);
  assert.deepEqual([...reg.tool_names], ["test_tool"]);
  assert.ok(isCanonicalBoundary(reg.boundary));
});

test("ToolRegistry rejects entries with missing cap", () => {
  const reg = buildToolRegistry({
    tools: { bad: { invoke: tinyOkInvoke() } }
  });
  assert.equal(reg.tool_count, 0);
  assert.equal(reg.invalid_entries.length, 1);
  assert.equal(reg.invalid_entries[0].reason, "missing_cap");
});

test("ToolRegistry rejects entries with missing invoke function", () => {
  const reg = buildToolRegistry({
    tools: { bad: { cap: validCap() } }
  });
  assert.equal(reg.tool_count, 0);
  assert.equal(reg.invalid_entries[0].reason, "missing_invoke_function");
});

test("ToolRegistry rejects entries with name mismatch between key and cap.name", () => {
  const reg = buildToolRegistry({
    tools: { actual_key: { cap: validCap(), invoke: tinyOkInvoke() } } // cap.name = "test_tool"
  });
  assert.equal(reg.tool_count, 0);
  assert.equal(reg.invalid_entries[0].reason, "cap_name_mismatch");
});

test("ToolRegistry rejects entries with invalid cap", () => {
  const invalidCap = buildEffectCap({ name: "", consent_scope_template: "" });
  const reg = buildToolRegistry({
    tools: { x: { cap: invalidCap, invoke: tinyOkInvoke() } }
  });
  assert.equal(reg.tool_count, 0);
  assert.equal(reg.invalid_entries[0].reason, "cap_invalid");
});

// =========================================================================
// INVOCATION GATE TESTS (8)
// =========================================================================

test("Invoke with wrong tool name refuses · tool_not_registered", async () => {
  const reg = buildToolRegistry({ tools: { test_tool: { cap: validCap(), invoke: tinyOkInvoke() } } });
  const r = await invokeWithEffectCap({ registry: reg, toolName: "nonexistent" });
  assert.equal(r.invocation_status, "refused");
  assert.match(r.error_reason, /tool_not_registered/);
});

test("Invoke without consent phrase refuses · consent_phrase_mismatch", async () => {
  const reg = buildToolRegistry({ tools: { test_tool: { cap: validCap(), invoke: tinyOkInvoke() } } });
  const r = await invokeWithEffectCap({ registry: reg, toolName: "test_tool", consentPhrase: "" });
  assert.equal(r.invocation_status, "refused");
  assert.match(r.error_reason, /consent_phrase_mismatch/);
  assert.equal(r.consent_phrase_verified, false);
});

test("Invoke with WRONG consent phrase refuses (no fuzzy match)", async () => {
  const reg = buildToolRegistry({ tools: { test_tool: { cap: validCap(), invoke: tinyOkInvoke() } } });
  const r = await invokeWithEffectCap({
    registry: reg,
    toolName: "test_tool",
    consentPhrase: "GO: invoke test tool" // missing the underscore
  });
  assert.equal(r.invocation_status, "refused");
  assert.match(r.error_reason, /consent_phrase_mismatch/);
});

test("Invoke with exact consent phrase succeeds · completed status", async () => {
  const reg = buildToolRegistry({ tools: { test_tool: { cap: validCap(), invoke: tinyOkInvoke() } } });
  const r = await invokeWithEffectCap({
    registry: reg,
    toolName: "test_tool",
    args: {},
    consentPhrase: "GO: invoke test_tool"
  });
  assert.equal(r.invocation_status, "completed");
  assert.equal(r.error_reason, null);
  assert.equal(r.consent_phrase_verified, true);
  assert.equal(r.cap_name, "test_tool");
  assert.equal(r.result_summary.has_schema, true);
  assert.equal(r.result_summary.schema, "test.result.v0.1");
  assert.equal(r.audit_trail_required, true);
  assert.equal(r.receipt_shape_ready, true);
});

test("Invoke with tool that throws · errored status with tool_threw error_reason", async () => {
  const throwingTool = {
    cap: validCap(),
    invoke: async () => { throw new Error("boom"); }
  };
  const reg = buildToolRegistry({ tools: { test_tool: throwingTool } });
  const r = await invokeWithEffectCap({
    registry: reg,
    toolName: "test_tool",
    args: {},
    consentPhrase: "GO: invoke test_tool"
  });
  assert.equal(r.invocation_status, "errored");
  assert.match(r.error_reason, /tool_threw/);
  assert.match(r.error_reason, /boom/);
  assert.equal(r.consent_phrase_verified, true);
  assert.equal(r.receipt_shape_ready, false);
});

test("Invoke refuses on missing registry", async () => {
  const r = await invokeWithEffectCap({ registry: null, toolName: "any" });
  assert.equal(r.invocation_status, "refused");
  assert.match(r.error_reason, /registry_invalid/);
});

test("Adversarial · non-string toolName coerced to empty · tool_not_registered", async () => {
  const reg = buildToolRegistry({ tools: { test_tool: { cap: validCap(), invoke: tinyOkInvoke() } } });
  const r = await invokeWithEffectCap({
    registry: reg,
    toolName: { malicious: "obj" },
    consentPhrase: "GO: invoke test_tool"
  });
  assert.equal(r.invocation_status, "refused");
  assert.match(r.error_reason, /tool_not_registered/);
});

test("Adversarial · non-object args coerced safely · invocation still proceeds with empty args", async () => {
  let receivedArgs = null;
  const captureTool = {
    cap: validCap(),
    invoke: async (args) => { receivedArgs = args; return { ok: true }; }
  };
  const reg = buildToolRegistry({ tools: { test_tool: captureTool } });
  await invokeWithEffectCap({
    registry: reg,
    toolName: "test_tool",
    args: "not-an-object",
    consentPhrase: "GO: invoke test_tool"
  });
  assert.deepEqual(receivedArgs, {});
});

// =========================================================================
// INVOCATION EVENT SCHEMA TESTS (3)
// =========================================================================

test("Invocation event emits canonical schema + truth_label appropriately", async () => {
  const reg = buildToolRegistry({ tools: { test_tool: { cap: validCap(), invoke: tinyOkInvoke() } } });
  const successEvent = await invokeWithEffectCap({
    registry: reg,
    toolName: "test_tool",
    args: {},
    consentPhrase: "GO: invoke test_tool"
  });
  const refusalEvent = await invokeWithEffectCap({
    registry: reg,
    toolName: "test_tool",
    consentPhrase: "wrong"
  });
  assert.equal(successEvent.schema, EFFECT_CAP_INVOCATION_SCHEMA_NAME);
  assert.equal(successEvent.truth_label, "MEASURED");
  assert.equal(refusalEvent.schema, EFFECT_CAP_INVOCATION_SCHEMA_NAME);
  assert.equal(refusalEvent.truth_label, "INVOCATION_REFUSED");
});

test("Invocation event is deep-frozen · cannot be tampered post-build", async () => {
  const reg = buildToolRegistry({ tools: { test_tool: { cap: validCap(), invoke: tinyOkInvoke() } } });
  const event = await invokeWithEffectCap({
    registry: reg,
    toolName: "test_tool",
    args: {},
    consentPhrase: "GO: invoke test_tool"
  });
  assert.ok(Object.isFrozen(event));
  assert.ok(Object.isFrozen(event.result_summary));
});

test("Invocation event includes duration_ms · receipt-shape-ready flag · audit_trail_required", async () => {
  const reg = buildToolRegistry({ tools: { test_tool: { cap: validCap(), invoke: tinyOkInvoke() } } });
  const event = await invokeWithEffectCap({
    registry: reg,
    toolName: "test_tool",
    args: {},
    consentPhrase: "GO: invoke test_tool"
  });
  assert.equal(typeof event.duration_ms, "number");
  assert.ok(event.duration_ms >= 0);
  assert.equal(event.receipt_shape_ready, true);
  assert.equal(event.audit_trail_required, true);
});

// =========================================================================
// EXPORTS + CONSTANTS (3)
// =========================================================================

test("Canonical effects vocabulary is non-empty + frozen", () => {
  assert.ok(Array.isArray(EFFECT_CAP_CANONICAL_EFFECTS));
  assert.ok(Object.isFrozen(EFFECT_CAP_CANONICAL_EFFECTS));
  assert.ok(EFFECT_CAP_CANONICAL_EFFECTS.length >= 5);
  assert.ok(EFFECT_CAP_CANONICAL_EFFECTS.includes("invoke_local_llm"));
});

test("Always-blocked effects list is non-empty + includes high-risk effects", () => {
  assert.ok(EFFECT_CAP_ALWAYS_BLOCKED_EFFECTS.includes("execute_arbitrary_shell"));
  assert.ok(EFFECT_CAP_ALWAYS_BLOCKED_EFFECTS.includes("call_public_network"));
  assert.ok(EFFECT_CAP_ALWAYS_BLOCKED_EFFECTS.includes("advance_chain"));
  assert.ok(EFFECT_CAP_ALWAYS_BLOCKED_EFFECTS.includes("mint_canonical_receipt"));
  assert.ok(EFFECT_CAP_ALWAYS_BLOCKED_EFFECTS.includes("invoke_federation"));
});

test("Schema constants match the canonical bizra.dema.* convention", () => {
  assert.match(EFFECT_CAP_SCHEMA_NAME, /^bizra\.dema\.[a-z0-9_]+\.v\d+\.\d+$/);
  assert.match(EFFECT_CAP_REGISTRY_SCHEMA_NAME, /^bizra\.dema\.[a-z0-9_]+\.v\d+\.\d+$/);
  assert.match(EFFECT_CAP_INVOCATION_SCHEMA_NAME, /^bizra\.dema\.[a-z0-9_]+\.v\d+\.\d+$/);
});
