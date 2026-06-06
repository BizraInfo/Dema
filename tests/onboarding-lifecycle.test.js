import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildOnboardingLifecyclePreview,
  ONBOARDING_LIFECYCLE_SCHEMA,
  ONBOARDING_LIFECYCLE_STAGE_COUNT,
  ONBOARDING_LIFECYCLE_STAGE_IDS,
  ONBOARDING_LIFECYCLE_PRIMARY_REFUSALS,
} from "../packages/core/src/onboarding-lifecycle.js";

import { PREVIEW_BOUNDARY_CANONICAL_KEYS } from "../packages/core/src/preview-boundary.js";

function assertCanonicalBoundary(boundary, label) {
  for (const key of PREVIEW_BOUNDARY_CANONICAL_KEYS) {
    assert.equal(
      boundary[key],
      false,
      `${label}.boundary.${key} must be false`,
    );
  }
}

// ─── BASE TESTS (16) ────────────────────────────────────────────────────────

test("OnboardingLifecycle emits canonical schema + truth label + mode", () => {
  const r = buildOnboardingLifecyclePreview();
  assert.equal(r.schema, "bizra.dema.onboarding_lifecycle.v0.1");
  assert.equal(r.schema, ONBOARDING_LIFECYCLE_SCHEMA);
  assert.equal(r.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(r.mode, "preview_only");
});

test("OnboardingLifecycle emits canonical 16-key boundary all false", () => {
  const r = buildOnboardingLifecyclePreview();
  assertCanonicalBoundary(r.boundary, "onboarding_lifecycle");
});

test("OnboardingLifecycle returns deep-frozen output", () => {
  const r = buildOnboardingLifecyclePreview();
  assert.equal(Object.isFrozen(r), true);
  assert.equal(Object.isFrozen(r.stages), true);
  assert.equal(Object.isFrozen(r.stages[0]), true);
  assert.equal(Object.isFrozen(r.stages[0].options), true);
  assert.equal(Object.isFrozen(r.candidate), true);
  assert.equal(Object.isFrozen(r.current_stage), true);
  assert.equal(Object.isFrozen(r.operating_law), true);
  assert.equal(Object.isFrozen(r.consent), true);
  assert.equal(Object.isFrozen(r.canon_anchors), true);
});

test("OnboardingLifecycle is deterministic given identical inputs", () => {
  const a = buildOnboardingLifecyclePreview({
    candidate_name: "Samy",
    candidate_ordinal: 1,
  });
  const b = buildOnboardingLifecyclePreview({
    candidate_name: "Samy",
    candidate_ordinal: 1,
  });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("OnboardingLifecycle has exactly 7 canonical stages", () => {
  const r = buildOnboardingLifecyclePreview();
  assert.equal(r.stage_count, 7);
  assert.equal(r.stages.length, 7);
  assert.equal(ONBOARDING_LIFECYCLE_STAGE_COUNT, 7);
});

test("Stage 0 is ALWAYS language · canon-ordered", () => {
  const r = buildOnboardingLifecyclePreview();
  assert.equal(r.stages[0].id, "language");
  assert.equal(r.stages[0].order, 0);
  assert.match(r.stages[0].title, /language/i);
});

test("Stage 6 (last · order 6) is ALWAYS first_mission · canon-ordered", () => {
  const r = buildOnboardingLifecyclePreview();
  assert.equal(r.stages[6].id, "first_mission");
  assert.equal(r.stages[6].order, 6);
});

test("All 7 canonical stage IDs are present", () => {
  const r = buildOnboardingLifecyclePreview();
  const ids = r.stages.map((s) => s.id);
  assert.deepEqual(ids, [
    "language",
    "technical_level",
    "node_role",
    "purpose",
    "resources",
    "consent_constitution",
    "first_mission",
  ]);
  assert.deepEqual([...ONBOARDING_LIFECYCLE_STAGE_IDS], ids);
});

test("Default state · current_stage is language (no progress yet)", () => {
  const r = buildOnboardingLifecyclePreview();
  assert.equal(r.current_stage.id, "language");
  assert.equal(r.current_stage.order, 0);
  assert.equal(r.current_stage.allowed_to_enter, true);
  assert.equal(r.progress.completion_ratio, 0);
  assert.equal(r.progress.lifecycle_complete, false);
});

test("Candidate ordinal substituted into Node{ordinal} title", () => {
  const r = buildOnboardingLifecyclePreview({
    candidate_name: "Samy",
    candidate_ordinal: 1,
  });
  const nodeRoleStage = r.stages.find((s) => s.id === "node_role");
  assert.match(nodeRoleStage.title, /Node1/);
  // Other stages with no {ordinal} placeholder unchanged
  assert.equal(r.stages[0].title, "What language should I speak with you?");
});

test("Language stage offers Arabic + English + 5 more languages (7 total options)", () => {
  const r = buildOnboardingLifecyclePreview();
  const lang = r.stages.find((s) => s.id === "language");
  assert.equal(lang.options.length, 7);
  const codes = lang.options.map((o) => o.code);
  assert.ok(codes.includes("ar"));
  assert.ok(codes.includes("en"));
  assert.ok(codes.includes("fr"));
  assert.ok(codes.includes("es"));
  assert.ok(codes.includes("ur"));
  assert.ok(codes.includes("hi"));
  assert.ok(codes.includes("other"));
});

test("Resources stage default is 'nothing_yet' (safest default)", () => {
  const r = buildOnboardingLifecyclePreview();
  const resources = r.stages.find((s) => s.id === "resources");
  assert.equal(resources.safest_default, "nothing_yet");
  const nothing = resources.options.find((o) => o.id === "nothing_yet");
  assert.equal(nothing.default_selected, true);
  // Every other option defaults to false
  for (const opt of resources.options) {
    if (opt.id !== "nothing_yet") assert.equal(opt.default_selected, false);
  }
});

test("Consent constitution stage carries the 6-line ADR-005 acknowledgment text", () => {
  const r = buildOnboardingLifecyclePreview();
  const consent = r.stages.find((s) => s.id === "consent_constitution");
  assert.ok(Array.isArray(consent.constitution_text));
  assert.equal(consent.constitution_text.length, 6);
  // Check key ADR-005 phrases appear
  const allText = consent.constitution_text.join("\n");
  assert.match(allText, /exact consent/i);
  assert.match(allText, /character-by-character/i);
  assert.match(allText, /fuzzy match/i);
  assert.match(allText, /disengage at any time/i);
});

test("Operating law surfaces comprehension-before-consent + safest defaults", () => {
  const r = buildOnboardingLifecyclePreview();
  assert.equal(r.operating_law.comprehension_before_consent, true);
  assert.equal(r.operating_law.language_before_capability, true);
  assert.equal(r.operating_law.human_dignity_before_configuration, true);
  assert.equal(
    r.operating_law.safest_default_on_resource_consent,
    "nothing_yet",
  );
  assert.equal(
    r.operating_law.consent_form,
    "exact_string_typed_character_by_character",
  );
});

test("primary_refusals surfaces the refuse-as-product taxonomy (8 entries)", () => {
  const r = buildOnboardingLifecyclePreview();
  assert.equal(r.primary_refusals, ONBOARDING_LIFECYCLE_PRIMARY_REFUSALS);
  assert.ok(
    r.primary_refusals.includes(
      "refuse_to_advance_past_language_stage_without_language_set",
    ),
  );
  assert.ok(
    r.primary_refusals.includes(
      "refuse_to_default_to_select_all_on_resource_consent_safest_default_is_nothing_yet",
    ),
  );
  assert.equal(r.primary_refusals.length, 8);
});

test("blocked_effects includes federation, network_used, node_connection, receipt_mint", () => {
  const r = buildOnboardingLifecyclePreview();
  assert.ok(r.blocked_effects.includes("federation"));
  assert.ok(r.blocked_effects.includes("network_used"));
  assert.ok(r.blocked_effects.includes("node_connection"));
  assert.ok(r.blocked_effects.includes("receipt_mint"));
  assert.ok(r.blocked_effects.includes("auto_select_all_resources"));
});

// ─── PROGRESS / STAGE TRANSITION TESTS (5) ──────────────────────────────────

test("Progress tracking: 1 stage complete → current_stage advances", () => {
  const r = buildOnboardingLifecyclePreview({
    progress: { completed: ["language"] },
  });
  assert.equal(r.current_stage.id, "technical_level");
  assert.equal(r.current_stage.order, 1);
  assert.equal(r.progress.completion_ratio, 1 / 7);
});

test("Progress tracking: 3 stages complete → current_stage is purpose", () => {
  const r = buildOnboardingLifecyclePreview({
    progress: { completed: ["language", "technical_level", "node_role"] },
  });
  assert.equal(r.current_stage.id, "purpose");
  assert.equal(r.current_stage.order, 3);
});

test("Progress tracking: all 7 stages complete → lifecycle_complete: true", () => {
  const r = buildOnboardingLifecyclePreview({
    progress: {
      completed: [
        "language",
        "technical_level",
        "node_role",
        "purpose",
        "resources",
        "consent_constitution",
        "first_mission",
      ],
    },
  });
  assert.equal(r.current_stage.id, null);
  assert.equal(r.progress.lifecycle_complete, true);
  assert.equal(r.progress.completion_ratio, 1);
});

test("Language code 'ar' accepted and surfaced", () => {
  const r = buildOnboardingLifecyclePreview({ language: "ar" });
  assert.equal(r.language, "ar");
});

test("Technical level 3 accepted and surfaced", () => {
  const r = buildOnboardingLifecyclePreview({ technical_level: 3 });
  assert.equal(r.technical_level, 3);
});

// ─── ADVERSARIAL TESTS (12) ─────────────────────────────────────────────────

test("ADVERSARIAL: invalid language code 'xyz' coerced to null (not surfaced)", () => {
  const r = buildOnboardingLifecyclePreview({ language: "xyz" });
  assert.equal(r.language, null);
});

test("ADVERSARIAL: language as non-string (number) coerced to null", () => {
  const r = buildOnboardingLifecyclePreview({ language: 42 });
  assert.equal(r.language, null);
});

test("ADVERSARIAL: technical_level 0 (out of range) coerced to null", () => {
  const r = buildOnboardingLifecyclePreview({ technical_level: 0 });
  assert.equal(r.technical_level, null);
});

test("ADVERSARIAL: technical_level 5 (out of range) coerced to null", () => {
  const r = buildOnboardingLifecyclePreview({ technical_level: 5 });
  assert.equal(r.technical_level, null);
});

test("ADVERSARIAL: candidate_ordinal as 'foo' (non-integer) coerced to null", () => {
  const r = buildOnboardingLifecyclePreview({ candidate_ordinal: "foo" });
  assert.equal(r.candidate.ordinal, null);
  assert.equal(r.candidate.node_label, null);
});

test("ADVERSARIAL: candidate_ordinal as 1.5 (non-integer) coerced to null", () => {
  const r = buildOnboardingLifecyclePreview({ candidate_ordinal: 1.5 });
  assert.equal(r.candidate.ordinal, null);
});

test("ADVERSARIAL: candidate_ordinal as -1 (negative) coerced to null", () => {
  const r = buildOnboardingLifecyclePreview({ candidate_ordinal: -1 });
  assert.equal(r.candidate.ordinal, null);
});

test("ADVERSARIAL: progress.completed with unknown stage 'fake' still works (ignored)", () => {
  const r = buildOnboardingLifecyclePreview({
    progress: { completed: ["language", "fake"] },
  });
  // current advances to technical_level (language is complete)
  assert.equal(r.current_stage.id, "technical_level");
});

test("ADVERSARIAL: progress.completed non-array coerced to empty", () => {
  const r = buildOnboardingLifecyclePreview({
    progress: { completed: "not-an-array" },
  });
  assert.equal(
    r.current_stage.id,
    "language",
    "non-array completed → empty → current = language",
  );
});

test("ADVERSARIAL: mutation attempt on returned stages array is rejected (deep-frozen)", () => {
  const r = buildOnboardingLifecyclePreview();
  let threw = false;
  try {
    r.stages.push({ id: "evil", order: 999 });
  } catch (e) {
    threw = true;
  }
  assert.equal(
    r.stages.length,
    7,
    "stages must stay at 7 after mutation attempt",
  );
});

test("ADVERSARIAL: mutation attempt on stage options is rejected (deep-frozen)", () => {
  const r = buildOnboardingLifecyclePreview();
  const langStage = r.stages.find((s) => s.id === "language");
  try {
    langStage.options.push({ code: "evil", label: "Backdoor" });
  } catch (e) {
    // expected in strict mode
  }
  assert.equal(langStage.options.length, 7, "language options must stay at 7");
});

test("ADVERSARIAL: prototype-pollution attempt via progress input does not leak", () => {
  const polluted = { completed: ["language"] };
  Object.setPrototypeOf(polluted, { secret_field: "SHOULD_NOT_LEAK" });
  const r = buildOnboardingLifecyclePreview({ progress: polluted });
  assert.equal(r.current_stage.id, "technical_level");
  // No leakage of secret_field
  assert.equal("secret_field" in r.progress, false);
});
