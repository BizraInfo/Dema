// ADR-011 Phase-1 Compliance Tests
//
// Covers T-1 through T-9 from the ADR test surface plus the v0.2 schema-shape
// tests and adversarial inputs. All tests are against the pure builder
// (buildNodeOnboardingExtension) and against the composed lifecycle builder
// (buildOnboardingLifecyclePreview) to verify integration.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildNodeOnboardingExtension,
  EXTENSION_SCHEMA_VERSION
} from "../packages/core/src/node-onboarding-extension.js";

import { buildOnboardingLifecyclePreview } from "../packages/core/src/onboarding-lifecycle.js";
import { PREVIEW_BOUNDARY_CANONICAL_KEYS } from "../packages/core/src/preview-boundary.js";

// ─── T-1: node_topology block ────────────────────────────────────────────────

test("T-1a: node_topology block is present in default (Node0) extension output", () => {
  const ext = buildNodeOnboardingExtension();
  assert.ok("node_topology" in ext, "node_topology block must be present");
  assert.equal(ext.node_topology.current_ordinal, 0);
  assert.equal(ext.node_topology.candidate_ordinal, null);
  assert.equal(ext.node_topology.paired_receipt_required, false);
  assert.equal(ext.node_topology.paired_receipt_id, null);
});

test("T-1b: node_topology block is present in composed onboarding-lifecycle output", () => {
  const r = buildOnboardingLifecyclePreview();
  assert.ok("node_topology" in r, "composed preview must include node_topology");
  assert.equal(r.node_topology.current_ordinal, 0);
  assert.equal(r.node_topology.candidate_ordinal, null);
});

test("T-1c: node_topology.candidate_ordinal reflects provided input when valid", () => {
  const ext = buildNodeOnboardingExtension({ candidate_ordinal: 1 });
  assert.equal(ext.node_topology.candidate_ordinal, 1);
  assert.equal(ext.node_topology.paired_receipt_required, true);
});

// ─── T-2: model_readiness defaults ──────────────────────────────────────────

test("T-2: model_readiness defaults to MODEL_UNKNOWN · never MODEL_REQUIRED", () => {
  const ext = buildNodeOnboardingExtension();
  assert.equal(ext.model_readiness.status, "MODEL_UNKNOWN");
  // MODEL_REQUIRED is not even a valid enum member — verify it cannot appear
  assert.notEqual(ext.model_readiness.status, "MODEL_REQUIRED");
  assert.equal(ext.model_readiness.scan_performed, false);
  assert.equal(ext.model_readiness.model_invocation_allowed, false);
  assert.equal(ext.model_readiness.fallback_path, "continue_model_less_onboarding");
});

test("T-2b: model_status valid enum values are accepted", () => {
  for (const status of [
    "MODEL_LESS_DECLARED",
    "MODEL_INVENTORY_PENDING_CONSENT",
    "MODEL_INVENTORY_DECLARED",
    "MODEL_AVAILABLE"
  ]) {
    const ext = buildNodeOnboardingExtension({ model_status: status });
    assert.equal(ext.model_readiness.status, status, `${status} must be accepted`);
  }
});

test("T-2c: unknown model_status coerced to MODEL_UNKNOWN", () => {
  const ext = buildNodeOnboardingExtension({ model_status: "MODEL_REQUIRED" });
  assert.equal(ext.model_readiness.status, "MODEL_UNKNOWN");
});

// ─── T-3: local_models_required structurally false ──────────────────────────

test("T-3: model_readiness.local_models_required is structurally false · injection refused", () => {
  // Attempt to inject true via input (must be ignored)
  const ext = buildNodeOnboardingExtension({ local_models_required: true });
  assert.equal(ext.model_readiness.local_models_required, false,
    "local_models_required must remain false regardless of input");

  // Attempt to mutate the frozen output
  assert.throws(() => {
    "use strict";
    ext.model_readiness.local_models_required = true;
  }, "mutation of frozen model_readiness must throw in strict mode");
});

// ─── T-4: blocked_effects.federation structurally true ──────────────────────

test("T-4: blocked_effects.federation is structurally true · cannot be flipped", () => {
  const ext = buildNodeOnboardingExtension({ federation: false });
  assert.equal(ext.blocked_effects.federation, true,
    "federation must remain true regardless of input");

  // Mutation attempt must fail
  assert.throws(() => {
    "use strict";
    ext.blocked_effects.federation = false;
  }, "mutation of frozen blocked_effects.federation must throw");
});

// ─── T-5: model_scan_without_consent structurally true ──────────────────────

test("T-5: blocked_effects.model_scan_without_consent is structurally true", () => {
  const ext = buildNodeOnboardingExtension({ model_scan_without_consent: false });
  assert.equal(ext.blocked_effects.model_scan_without_consent, true);

  assert.throws(() => {
    "use strict";
    ext.blocked_effects.model_scan_without_consent = false;
  });
});

// ─── T-6: auto_advance_to_node_n_plus_1 structurally true ───────────────────

test("T-6: blocked_effects.auto_advance_to_node_n_plus_1 is structurally true", () => {
  const ext = buildNodeOnboardingExtension({ auto_advance_to_node_n_plus_1: false });
  assert.equal(ext.blocked_effects.auto_advance_to_node_n_plus_1, true);
});

// Also assert remaining blocked_effects entries are all true
test("T-6b: all 8 blocked_effects entries are structurally true", () => {
  const ext = buildNodeOnboardingExtension();
  const keys = [
    "federation",
    "raw_data_sharing",
    "public_broadcast",
    "economic_activation",
    "poi_scoring",
    "model_scan_without_consent",
    "model_invocation",
    "auto_advance_to_node_n_plus_1"
  ];
  for (const key of keys) {
    assert.equal(ext.blocked_effects[key], true, `blocked_effects.${key} must be true`);
  }
  assert.equal(Object.keys(ext.blocked_effects).length, 8,
    "blocked_effects must have exactly 8 entries");
});

// ─── T-7: language_state.language_set defaults false ────────────────────────

test("T-7: language_state.language_code defaults null when not provided", () => {
  const ext = buildNodeOnboardingExtension();
  assert.equal(ext.language_state.language_code, null);
  assert.equal(ext.language_state.language_set, false);
  assert.equal(ext.language_state.consent_phrases_will_render_in, null);
});

test("T-7b: valid language_code is accepted and language_set becomes true", () => {
  const ext = buildNodeOnboardingExtension({ language_code: "ar" });
  assert.equal(ext.language_state.language_code, "ar");
  assert.equal(ext.language_state.language_set, true);
  assert.equal(ext.language_state.consent_phrases_will_render_in, "ar");
});

// ─── T-8: candidate_ordinal >= 1 requires paired_receipt_required ────────────

test("T-8a: candidate_ordinal 1 → paired_receipt_required true + paired_receipt_id slot present", () => {
  const ext = buildNodeOnboardingExtension({ candidate_ordinal: 1 });
  assert.equal(ext.node_topology.paired_receipt_required, true);
  // Slot exists (null is OK at builder level; disk lookup is phase-2)
  assert.ok("paired_receipt_id" in ext.node_topology,
    "paired_receipt_id slot must be present in node_topology");
  assert.equal(ext.node_topology.paired_receipt_id, null);
});

test("T-8b: candidate_ordinal 2 → paired_receipt_required true", () => {
  const ext = buildNodeOnboardingExtension({ candidate_ordinal: 2 });
  assert.equal(ext.node_topology.paired_receipt_required, true);
});

test("T-8c: paired_receipt_id propagates when provided", () => {
  const ext = buildNodeOnboardingExtension({
    candidate_ordinal: 1,
    paired_receipt_id: "abc123receipt"
  });
  assert.equal(ext.node_topology.paired_receipt_id, "abc123receipt");
});

// ─── T-9: ordinal 3 and 4 are refused ───────────────────────────────────────

test("T-9a: candidate_ordinal 3 is refused — coerced to null", () => {
  const ext = buildNodeOnboardingExtension({ candidate_ordinal: 3 });
  assert.equal(ext.node_topology.candidate_ordinal, null,
    "ordinal 3 must be coerced to null per forbidden_topology_phrases");
  // paired_receipt_required follows the coercion
  assert.equal(ext.node_topology.paired_receipt_required, false);
});

test("T-9b: candidate_ordinal 4 is refused — coerced to null", () => {
  const ext = buildNodeOnboardingExtension({ candidate_ordinal: 4 });
  assert.equal(ext.node_topology.candidate_ordinal, null,
    "ordinal 4 must be coerced to null per forbidden_topology_phrases");
});

test("T-9c: candidate_ordinal 2 is NOT refused (only 3 and 4 are forbidden)", () => {
  const ext = buildNodeOnboardingExtension({ candidate_ordinal: 2 });
  assert.equal(ext.node_topology.candidate_ordinal, 2);
});

// ─── Schema v0.2 field tests ─────────────────────────────────────────────────

test("v0.2: language_state.secondary_language_code defaults null", () => {
  const ext = buildNodeOnboardingExtension();
  assert.ok("secondary_language_code" in ext.language_state);
  assert.equal(ext.language_state.secondary_language_code, null);
});

test("v0.2: language_state.secondary_language_offered defaults false", () => {
  const ext = buildNodeOnboardingExtension();
  assert.ok("secondary_language_offered" in ext.language_state);
  assert.equal(ext.language_state.secondary_language_offered, false);
});

test("v0.2: language_state.returning_user_load defaults false", () => {
  const ext = buildNodeOnboardingExtension();
  assert.ok("returning_user_load" in ext.language_state);
  assert.equal(ext.language_state.returning_user_load, false);
});

test("v0.2: language_state.language_source defaults 'unset'", () => {
  const ext = buildNodeOnboardingExtension();
  assert.equal(ext.language_state.language_source, "unset");
});

test("v0.2: language_state.language_source accepts valid values", () => {
  for (const src of ["first_run_picker", "profile_load", "reset_explicit"]) {
    const ext = buildNodeOnboardingExtension({ language_source: src });
    assert.equal(ext.language_state.language_source, src);
  }
});

test("v0.2: candidate_lifecycle.is_first_run defaults true", () => {
  const ext = buildNodeOnboardingExtension();
  assert.ok("candidate_lifecycle" in ext);
  assert.equal(ext.candidate_lifecycle.is_first_run, true);
});

test("v0.2: candidate_lifecycle.is_returning_user defaults false", () => {
  const ext = buildNodeOnboardingExtension();
  assert.equal(ext.candidate_lifecycle.is_returning_user, false);
});

test("v0.2: candidate_lifecycle.onboarding_trigger defaults null", () => {
  const ext = buildNodeOnboardingExtension();
  assert.equal(ext.candidate_lifecycle.onboarding_trigger, null);
});

test("v0.2: candidate_lifecycle.onboarding_trigger accepts valid enum values", () => {
  for (const trigger of ["first_run", "reset_explicit", "candidate_invite"]) {
    const ext = buildNodeOnboardingExtension({ onboarding_trigger: trigger });
    assert.equal(ext.candidate_lifecycle.onboarding_trigger, trigger);
  }
});

test("v0.2: candidate_lifecycle.stage_skipped_due_to_profile defaults []", () => {
  const ext = buildNodeOnboardingExtension();
  assert.ok(Array.isArray(ext.candidate_lifecycle.stage_skipped_due_to_profile));
  assert.equal(ext.candidate_lifecycle.stage_skipped_due_to_profile.length, 0);
});

test("v0.2: secondary_language_code valid ISO 639-1 accepted", () => {
  const ext = buildNodeOnboardingExtension({ secondary_language_code: "fr" });
  assert.equal(ext.language_state.secondary_language_code, "fr");
});

test("v0.2: secondary_language_code invalid value coerced to null", () => {
  const ext = buildNodeOnboardingExtension({ secondary_language_code: "xyz" });
  assert.equal(ext.language_state.secondary_language_code, null);
});

// ─── Determinism ─────────────────────────────────────────────────────────────

test("Determinism: same input → byte-identical output (JSON.stringify equal)", () => {
  const input = {
    current_ordinal: 1,
    candidate_ordinal: 2,
    language_code: "ar",
    model_status: "MODEL_LESS_DECLARED",
    language_source: "profile_load",
    is_returning_user: true,
    returning_user_load: true,
    onboarding_trigger: "first_run"
  };
  const a = buildNodeOnboardingExtension(input);
  const b = buildNodeOnboardingExtension(input);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

// ─── Deep-frozen output ──────────────────────────────────────────────────────

test("Output is deep-frozen: top level", () => {
  const ext = buildNodeOnboardingExtension();
  assert.equal(Object.isFrozen(ext), true);
});

test("Output is deep-frozen: all 5 sub-blocks", () => {
  const ext = buildNodeOnboardingExtension();
  assert.equal(Object.isFrozen(ext.node_topology), true);
  assert.equal(Object.isFrozen(ext.model_readiness), true);
  assert.equal(Object.isFrozen(ext.language_state), true);
  assert.equal(Object.isFrozen(ext.candidate_lifecycle), true);
  assert.equal(Object.isFrozen(ext.blocked_effects), true);
});

test("Output is deep-frozen: assigning to nested field throws in strict mode", () => {
  const ext = buildNodeOnboardingExtension();
  assert.throws(() => {
    "use strict";
    ext.node_topology.current_ordinal = 99;
  });
  assert.throws(() => {
    "use strict";
    ext.language_state.language_code = "xx";
  });
  assert.throws(() => {
    "use strict";
    ext.candidate_lifecycle.is_first_run = false;
  });
});

// ─── Adversarial ─────────────────────────────────────────────────────────────

test("ADVERSARIAL: prototype pollution via __proto__ input does not leak", () => {
  const polluted = {};
  Object.setPrototypeOf(polluted, { secret_field: "LEAKED" });
  polluted.candidate_ordinal = 1;
  const ext = buildNodeOnboardingExtension(polluted);
  assert.equal(ext.node_topology.candidate_ordinal, 1);
  assert.equal("secret_field" in ext, false);
  assert.equal("secret_field" in ext.node_topology, false);
});

test("ADVERSARIAL: very long string for paired_receipt_id is capped at 500 chars", () => {
  const longId = "x".repeat(10000);
  const ext = buildNodeOnboardingExtension({
    candidate_ordinal: 1,
    paired_receipt_id: longId
  });
  assert.equal(ext.node_topology.paired_receipt_id.length, 500);
});

test("ADVERSARIAL: non-string language_code rejected and coerced to null", () => {
  for (const bad of [42, true, {}, [], null, undefined]) {
    const ext = buildNodeOnboardingExtension({ language_code: bad });
    assert.equal(ext.language_state.language_code, null,
      `language_code ${JSON.stringify(bad)} must coerce to null`);
  }
});

test("ADVERSARIAL: non-string secondary_language_code coerced to null", () => {
  const ext = buildNodeOnboardingExtension({ secondary_language_code: 99 });
  assert.equal(ext.language_state.secondary_language_code, null);
});

test("ADVERSARIAL: non-string values for onboarding_trigger coerced to null", () => {
  for (const bad of [42, true, {}, [], null]) {
    const ext = buildNodeOnboardingExtension({ onboarding_trigger: bad });
    assert.equal(ext.candidate_lifecycle.onboarding_trigger, null);
  }
});

test("ADVERSARIAL: non-array stage_skipped_due_to_profile coerced to []", () => {
  const ext = buildNodeOnboardingExtension({ stage_skipped_due_to_profile: "language" });
  assert.deepEqual(ext.candidate_lifecycle.stage_skipped_due_to_profile, []);
});

test("ADVERSARIAL: non-string entries in stage_skipped_due_to_profile filtered out", () => {
  const ext = buildNodeOnboardingExtension({
    stage_skipped_due_to_profile: ["language", 42, null, "technical_level"]
  });
  assert.deepEqual(
    ext.candidate_lifecycle.stage_skipped_due_to_profile,
    ["language", "technical_level"]
  );
});

// ─── Integration: 5 ADR-011 blocks in composed preview ───────────────────────

test("Integration: buildOnboardingLifecyclePreview includes all 5 ADR-011 blocks", () => {
  const r = buildOnboardingLifecyclePreview();
  assert.ok("node_topology" in r, "node_topology missing from composed preview");
  assert.ok("model_readiness" in r, "model_readiness missing from composed preview");
  assert.ok("language_state" in r, "language_state missing from composed preview");
  assert.ok("candidate_lifecycle" in r, "candidate_lifecycle missing from composed preview");
  assert.ok("adr011_blocked_effects" in r, "adr011_blocked_effects missing from composed preview");
});

test("Integration: composed preview ADR-011 blocks carry structural invariants", () => {
  const r = buildOnboardingLifecyclePreview();
  assert.equal(r.model_readiness.local_models_required, false);
  assert.equal(r.model_readiness.scan_consent_required, true);
  assert.equal(r.adr011_blocked_effects.federation, true);
  assert.equal(r.adr011_blocked_effects.auto_advance_to_node_n_plus_1, true);
});

test("Integration: existing canonical 16-key boundary still all false (additive compose cannot flip)", () => {
  const r = buildOnboardingLifecyclePreview();
  for (const key of PREVIEW_BOUNDARY_CANONICAL_KEYS) {
    assert.equal(r.boundary[key], false,
      `boundary.${key} must still be false after ADR-011 compose`);
  }
});

test("Integration: existing blocked_effects array unchanged (additive · pre-existing field preserved)", () => {
  const r = buildOnboardingLifecyclePreview();
  // The original blocked_effects is an array (pre-ADR-011 shape preserved)
  assert.ok(Array.isArray(r.blocked_effects),
    "original blocked_effects array must be preserved");
  assert.ok(r.blocked_effects.includes("federation"));
  assert.ok(r.blocked_effects.includes("receipt_mint"));
});

test("EXTENSION_SCHEMA_VERSION is the canonical string", () => {
  assert.equal(
    EXTENSION_SCHEMA_VERSION,
    "bizra.dema.onboarding_lifecycle.adr011_extension.v0.1"
  );
});
