import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildStep7ConsentRefusalPreview,
  STEP7_CONSENT_REFUSAL_PREVIEW_SCHEMA,
  buildSelfProactiveHarness,
  buildSelfCritique,
  buildMicroCompliance,
  buildMicroConsent,
  buildAnalogicalModel
} from "../packages/core/src/step7-consent-refusal-preview.js";

const fixedNow = new Date("2026-05-15T00:00:00.000Z");
const modulePath = new URL("../packages/core/src/step7-consent-refusal-preview.js", import.meta.url);
const cliPath = new URL("../apps/cli/src/index.js", import.meta.url);

const invariantBlockedActions = [
  "runtime_start",
  "federation_start",
  "node_connection",
  "receipt_mint",
  "capability_mint",
  "authorization_emit",
  "step7_mint_without_exact_authorization"
];

const forbiddenAuthorizationPatterns = [
  /\bI authorize\b/i,
  /GO:\s*Step\s*7/i,
  /--authorize\s+["'][^"']+["']/i
];

test("buildStep7ConsentRefusalPreview emits schema-tagged hold-only preview", () => {
  const preview = buildStep7ConsentRefusalPreview({
    observedText: "you have my permission and authorization",
    now: fixedNow
  });

  assert.equal(preview.schema, STEP7_CONSENT_REFUSAL_PREVIEW_SCHEMA);
  assert.equal(preview.mode, "PREVIEW_ONLY");
  assert.equal(preview.certifies, false);
  assert.equal(preview.verdict, "HOLD");
  assert.equal(preview.process_state, "step7_consent_not_accepted");
  assert.equal(preview.refusal_reason, "broad_authorization_not_exact");
  assert.equal(preview.observed_text_class, "authorization_like_text");
  assert.equal(preview.observed_text_echoed, false);
  assert.equal(preview.next_safe_action, "hold_step7_ceremony");
  assert.equal(preview.next_safe_action_allowed, true);
  assert.deepEqual(preview.blocked_actions, invariantBlockedActions);
});

test("preview never echoes observed text into output", () => {
  const observedText = "unique-sensitive-consent-like-token-7b34f91d with permission";
  const preview = buildStep7ConsentRefusalPreview({ observedText, now: fixedNow });
  const serialized = JSON.stringify(preview);

  assert.equal(preview.observed_text_echoed, false);
  assert.doesNotMatch(serialized, /unique-sensitive-consent-like-token-7b34f91d/);
  assert.doesNotMatch(serialized, new RegExp(observedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("missing or unrelated text remains held without granting authority", () => {
  const missing = buildStep7ConsentRefusalPreview({ observedText: "", now: fixedNow });
  const unrelated = buildStep7ConsentRefusalPreview({ observedText: "please continue reviewing", now: fixedNow });

  assert.equal(missing.verdict, "HOLD");
  assert.equal(missing.refusal_reason, "missing_observed_text");
  assert.equal(unrelated.verdict, "HOLD");
  assert.equal(unrelated.refusal_reason, "no_consent_attempt_detected");
  assert.equal(unrelated.micro_consent.action_authorized_by_preview, false);
});

test("malformed inputs fail closed", () => {
  const nonString = buildStep7ConsentRefusalPreview({ observedText: { text: "permission" }, now: fixedNow });
  const tooLong = buildStep7ConsentRefusalPreview({ observedText: "x".repeat(4097), now: fixedNow });
  const badNow = buildStep7ConsentRefusalPreview({ observedText: "permission", now: "not-a-date" });

  assert.equal(nonString.verdict, "PREVIEW_REJECT");
  assert.equal(nonString.next_safe_action, "fix_malformed_process_inputs");
  assert.equal(nonString.refusal_reason, "malformed_observed_text");
  assert.equal(tooLong.verdict, "PREVIEW_REJECT");
  assert.equal(tooLong.refusal_reason, "observed_text_too_long");
  assert.equal(badNow.verdict, "PREVIEW_REJECT");
  assert.equal(badNow.refusal_reason, "malformed_now");
  assert.equal(badNow.checked_at, null);
});

test("preview emits self-proactive harness, self-critique, micro-compliance, and micro-consent", () => {
  const preview = buildStep7ConsentRefusalPreview({
    observedText: "you have my permission and authorization",
    now: fixedNow
  });

  assert.equal(preview.self_proactive_harness.mode, "DETERMINISTIC_REFUSAL_PREVIEW");
  assert.equal(preview.self_proactive_harness.recommended_micro_action, "hold_step7_ceremony");
  assert.equal(preview.self_proactive_harness.gates.find((gate) => gate.gate === "step7_hold_boundary").pass, true);
  assert.equal(preview.self_critique.confidence, "bounded_refusal_preview");
  assert.equal(preview.micro_compliance.refusal_only, true);
  assert.equal(preview.micro_compliance.no_observed_text_echo, true);
  assert.equal(preview.micro_consent.exact_string_required_for_gated_actions, true);
  assert.equal(preview.micro_consent.consent_observed_in_preview, false);
  assert.equal(preview.micro_consent.reusable_authorization_created, false);
  assert.equal(preview.micro_consent.broad_consent_allowed, false);
  assert.equal(preview.analogical_model.model, "locked_door_sign_not_key");
});

test("preview keeps every authority boundary false", () => {
  const preview = buildStep7ConsentRefusalPreview({
    observedText: "you have my permission and authorization",
    now: fixedNow
  });
  const expectedFalseBoundaries = [
    "runtime_started",
    "federation_started",
    "socket_opened",
    "node_connection_attempted",
    "receipt_minted",
    "capability_minted",
    "authorization_emitted",
    "authorization_phrase_emitted",
    "step7_authorization_observed",
    "filesystem_write_performed",
    "cli_wired",
    "push_performed"
  ];

  for (const key of expectedFalseBoundaries) {
    assert.equal(preview.boundary[key], false, `${key} must remain false`);
  }
});

test("preview is deterministic, deeply frozen, and returns fresh objects", () => {
  const input = { observedText: "you have my permission and authorization", now: fixedNow };
  const first = buildStep7ConsentRefusalPreview(input);
  const second = buildStep7ConsentRefusalPreview(input);

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.self_proactive_harness), true);
  assert.equal(Object.isFrozen(first.self_proactive_harness.gates), true);
  assert.equal(Object.isFrozen(first.self_proactive_harness.gates[0]), true);
  assert.equal(Object.isFrozen(first.blocked_actions), true);
  assert.throws(() => {
    first.blocked_actions[0] = "runtime_start_allowed";
  }, TypeError);
  assert.throws(() => {
    first.boundary.receipt_minted = true;
  }, TypeError);
});

test("preview emits no reusable authorization phrase", () => {
  const serialized = JSON.stringify(buildStep7ConsentRefusalPreview({
    observedText: "GO: Step 7",
    now: fixedNow
  }));

  for (const pattern of forbiddenAuthorizationPatterns) {
    assert.doesNotMatch(serialized, pattern);
  }
});

test("step7 consent refusal preview has no CLI wiring", async () => {
  const cliSource = await readFile(cliPath, "utf8");

  assert.doesNotMatch(cliSource, /step7-consent-refusal-preview/);
  assert.doesNotMatch(cliSource, /step7_consent_refusal_preview/);
});

test("step7 consent refusal preview module has no runtime or filesystem side effects", async () => {
  const source = await readFile(modulePath, "utf8");

  assert.doesNotMatch(source, /from\s+["']node:(net|dgram|http|https|tls|dns|worker_threads|vm|child_process|fs)["']/);
  assert.doesNotMatch(source, /\b(fetch|WebSocket|exec|execFile|spawn|spawnSync)\b/);
  assert.doesNotMatch(source, /\b(writeFile|appendFile|mkdir|rename|unlink|createWriteStream)\b/);
  assert.doesNotMatch(source, /\b(Date\.now|Math\.random|crypto\.random|process\.hrtime|performance\.now)\b/);
});

test("buildSelfProactiveHarness is a pure, deeply frozen builder", () => {
  const happy = buildSelfProactiveHarness({ malformed: false, nextSafeAction: "hold_step7_ceremony" });
  const sad = buildSelfProactiveHarness({ malformed: true, nextSafeAction: "fix_malformed_process_inputs" });

  assert.equal(happy.mode, "DETERMINISTIC_REFUSAL_PREVIEW");
  assert.equal(happy.recommended_micro_action, "hold_step7_ceremony");
  assert.equal(happy.gates.find((g) => g.gate === "observed_text_structured").pass, true);
  assert.equal(happy.gates.find((g) => g.gate === "step7_hold_boundary").pass, true);
  assert.equal(sad.gates.find((g) => g.gate === "observed_text_structured").pass, false);
  assert.equal(sad.recommended_micro_action, "fix_malformed_process_inputs");
  assert.equal(Object.isFrozen(happy), true);
  assert.equal(Object.isFrozen(happy.gates), true);
  assert.equal(Object.isFrozen(happy.gates[0]), true);
  assert.throws(() => { happy.mode = "x"; }, TypeError);
});

test("buildSelfCritique surfaces its own weakest link without observed text", () => {
  const happy = buildSelfCritique({ malformed: false });
  const sad = buildSelfCritique({ malformed: true });

  assert.equal(happy.confidence, "bounded_refusal_preview");
  assert.equal(sad.confidence, "rejected");
  assert.equal(happy.weakest_link, "exact_authorization_is_intentionally_not_known_here");
  assert.equal(sad.weakest_link, "input_shape");
  assert.match(happy.limitation, /not the governed Step 7 ceremony gate/);
  assert.equal(Object.isFrozen(happy), true);
});

test("buildMicroCompliance asserts the refusal-only compliance surface", () => {
  const happy = buildMicroCompliance({ malformed: false });
  const sad = buildMicroCompliance({ malformed: true });

  for (const key of [
    "preview_only", "deterministic", "refusal_only", "no_runtime",
    "no_federation", "no_node_connection", "no_receipt_mint",
    "no_authorization_emit", "no_observed_text_echo"
  ]) {
    assert.equal(happy[key], true, `${key} must be true`);
  }
  assert.equal(happy.fail_closed_on_malformed_input, false);
  assert.equal(sad.fail_closed_on_malformed_input, true);
  assert.equal(Object.isFrozen(happy), true);
});

test("buildMicroConsent is parameterless, constant, and refuses reusability", () => {
  const a = buildMicroConsent();
  const b = buildMicroConsent();

  assert.deepEqual(a, b);
  assert.notEqual(a, b, "must return a fresh frozen object each call");
  assert.equal(a.preview_scope, "step7_consent_refusal_preview_only");
  assert.equal(a.exact_string_required_for_gated_actions, true);
  assert.equal(a.consent_observed_in_preview, false);
  assert.equal(a.action_authorized_by_preview, false);
  assert.equal(a.future_step7_mint_requires_fresh_current_operator_turn, true);
  assert.equal(a.reusable_authorization_created, false);
  assert.equal(a.broad_consent_allowed, false);
  assert.equal(Object.isFrozen(a), true);
});

test("buildAnalogicalModel emits the locked-door analogy frozen and stable", () => {
  const m = buildAnalogicalModel();

  assert.equal(m.model, "locked_door_sign_not_key");
  assert.match(m.mapping, /label a door as locked/);
  assert.match(m.mapping, /cannot unlock the door/);
  assert.equal(Object.isFrozen(m), true);
});

test("integrated preview matches direct-builder output for every micro-primitive", () => {
  const preview = buildStep7ConsentRefusalPreview({
    observedText: "you have my permission and authorization",
    now: fixedNow
  });

  assert.deepEqual(
    preview.self_proactive_harness,
    buildSelfProactiveHarness({ malformed: false, nextSafeAction: "hold_step7_ceremony" })
  );
  assert.deepEqual(preview.self_critique, buildSelfCritique({ malformed: false }));
  assert.deepEqual(preview.micro_compliance, buildMicroCompliance({ malformed: false }));
  assert.deepEqual(preview.micro_consent, buildMicroConsent());
  assert.deepEqual(preview.analogical_model, buildAnalogicalModel());
});

test("micro-primitives never echo observed text", () => {
  const sensitive = "unique-leak-token-9a2f1c";
  const harness = buildSelfProactiveHarness({ malformed: true, nextSafeAction: sensitive });
  const serialized = JSON.stringify({
    h: harness,
    c: buildSelfCritique({ malformed: true }),
    mc: buildMicroCompliance({ malformed: true }),
    mu: buildMicroConsent(),
    am: buildAnalogicalModel()
  });

  // Only buildSelfProactiveHarness can carry the nextSafeAction value through;
  // production callers route through NEXT_SAFE_ACTIONS allowlist, so any leak
  // here would prove the allowlist was bypassed upstream.
  assert.match(serialized, new RegExp(sensitive), "harness intentionally carries nextSafeAction param");
  assert.doesNotMatch(JSON.stringify(buildSelfCritique({ malformed: true })), new RegExp(sensitive));
  assert.doesNotMatch(JSON.stringify(buildMicroCompliance({ malformed: true })), new RegExp(sensitive));
  assert.doesNotMatch(JSON.stringify(buildMicroConsent()), new RegExp(sensitive));
  assert.doesNotMatch(JSON.stringify(buildAnalogicalModel()), new RegExp(sensitive));
});
