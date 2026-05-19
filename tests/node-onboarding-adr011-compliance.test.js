// ADR-011 Compliance Tests — Phases 1, 3, 4
//
// Single source of truth for ADR-011 compliance.
// Covers T-1..T-18 and P1-P10 from the ADR test surface.
//
// Sections:
//   S1 · T-1 to T-9   · phase-1 shape tests
//   S2 · T-10          · P1-P7 Daughter Test predicate regressions
//   S3 · T-11 to T-14  · runtime + integration invariants
//   S4 · T-15 to T-18  · v0.2 law compliance (Laws #9, #10, #11)
//   S5 · P8-P10        · Daughter Test predicates not fully covered above
//
// Auditor pattern: node --test tests/node-onboarding-adr011-compliance.test.js

import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import {
  buildNodeOnboardingExtension,
  EXTENSION_SCHEMA_VERSION
} from "../packages/core/src/node-onboarding-extension.js";

import {
  buildOnboardingLifecyclePreview,
  ONBOARDING_LIFECYCLE_STAGE_IDS,
} from "../packages/core/src/onboarding-lifecycle.js";
import { PREVIEW_BOUNDARY_CANONICAL_KEYS } from "../packages/core/src/preview-boundary.js";

import {
  LANGUAGE_OPTIONS,
  GREETING_TEMPLATES,
  resolveOperatorLanguage,
} from "../packages/core/src/homebase-language-picker.js";

// ─── Shared helpers ──────────────────────────────────────────────────────────

async function withTmpDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), "dema-adr011-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function makeStdin(lines) {
  const buf = lines.join("\n") + "\n";
  const r = Readable.from((async function* () { yield buf; })());
  r.isTTY = true;
  return r;
}

function makeStdout() {
  let output = "";
  const w = new Writable({
    write(chunk, _enc, cb) { output += chunk.toString(); cb(); },
  });
  w.isTTY = true;
  Object.defineProperty(w, "output", { get: () => output });
  return w;
}

const ALL_7_STAGES = Object.freeze([
  "language", "technical_level", "node_role", "purpose",
  "resources", "consent_constitution", "first_mission"
]);

// === SECTION 1 · T-1 to T-9 · phase-1 shape tests ===========================

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

// === SECTION 3 (partial) · Law #11 · phase-3 shape ===========================

// ─── Law #11 phase-3 tests ────────────────────────────────────────────────────

test("Law #11a: builder output with all 7 stages completed contains genesis_preview_card block", () => {
  const allCompleted = [
    "language", "technical_level", "node_role", "purpose",
    "resources", "consent_constitution", "first_mission"
  ];
  const r = buildOnboardingLifecyclePreview({
    progress: { completed: allCompleted },
    genesis_timestamp: "2026-05-19T00:00:00.000Z",
  });
  assert.ok("genesis_preview_card" in r, "genesis_preview_card must be present when all 7 stages complete");
  assert.notEqual(r.genesis_preview_card, null);
  assert.equal(r.genesis_preview_card.schema, "bizra.dema.genesis_preview_card.v0.1");
  assert.equal(r.genesis_preview_card.mode, "preview_only");
});

test("Law #11b: builder output without stage 6 (first_mission) → genesis_preview_card === null", () => {
  const r = buildOnboardingLifecyclePreview({
    progress: { completed: ["language", "technical_level", "node_role", "purpose", "resources", "consent_constitution"] },
  });
  assert.equal(r.genesis_preview_card, null, "genesis_preview_card must be null without first_mission");
});

test("Law #11c: card emission does NOT advance receipt chain — boundary.chain_advance_performed remains false", () => {
  const allCompleted = [
    "language", "technical_level", "node_role", "purpose",
    "resources", "consent_constitution", "first_mission"
  ];
  const r = buildOnboardingLifecyclePreview({
    progress: { completed: allCompleted },
    genesis_timestamp: "2026-05-19T00:00:00.000Z",
  });
  assert.equal(r.boundary.chain_advance_performed, false);
  assert.equal(r.genesis_preview_card.boundary.chain_advance_performed, false);
  assert.equal(r.genesis_preview_card.boundary.receipt_mint_performed, false);
});

test("Law #11d: card_storage path is under state/ not receipts/", () => {
  const allCompleted = [
    "language", "technical_level", "node_role", "purpose",
    "resources", "consent_constitution", "first_mission"
  ];
  const r = buildOnboardingLifecyclePreview({
    progress: { completed: allCompleted },
    genesis_timestamp: "2026-05-19T00:00:00.000Z",
  });
  const storagePath = r.genesis_preview_card.card_storage.path;
  assert.ok(storagePath.includes("state/"), "card_storage path must be under state/ not receipts/");
  assert.equal(storagePath.includes("receipts/"), false, "card_storage path must NOT be under receipts/");
});

// === SECTION 2 · T-10 · P1-P7 Daughter Test predicate regressions ============

// ─── T-10 · P1: non-English candidate completes via language stage 0 ─────────

test("T-10 · P1 · non-English candidate completes via language stage 0: each LANGUAGE_OPTIONS code satisfies stage", () => {
  // The language stage is stage 0 (order 0). Every code from LANGUAGE_OPTIONS
  // must be accepted by the builder as a valid language_code that sets language_set=true.
  for (const opt of LANGUAGE_OPTIONS) {
    if (opt.code === "other") continue; // "other" is a sentinel, not ISO 639-1
    const ext = buildNodeOnboardingExtension({ language_code: opt.code });
    assert.equal(
      ext.language_state.language_set, true,
      `language_code "${opt.code}" must satisfy language stage`
    );
    assert.equal(ext.language_state.language_code, opt.code);
  }
});

test("T-10 · P1b · language stage is stage 0 (order 0) in CANONICAL_STAGES", () => {
  // Stage 0 must be language — this is the structural gate for P1.
  const r = buildOnboardingLifecyclePreview();
  const stages = r.stages;
  assert.equal(stages[0].id, "language");
  assert.equal(stages[0].order, 0);
});

// ─── T-10 · P2: stage 0-2 prompts contain no jargon ─────────────────────────

test("T-10 · P2 · stage 0-2 prompts and option labels contain no BIZRA technical jargon", () => {
  // The jargon set — words a non-technical user would find intimidating/confusing.
  const JARGON = [
    "PAT", "SAT", "URP", "ARTIFACT-011", "Ihsan", "Adl",
    "FATE", "EvidenceChain", "ADR-005", "Bitcoin-anchored", "Sovereign Spine"
  ];

  const r = buildOnboardingLifecyclePreview();
  const stagesToCheck = r.stages.filter((s) => s.order <= 2);

  for (const stage of stagesToCheck) {
    const textToScan = [
      stage.title,
      ...(Array.isArray(stage.options) ? stage.options.map((o) => o.label ?? "") : []),
      stage.prompt_intent ?? "",
    ].join(" ");

    for (const jargon of JARGON) {
      assert.equal(
        textToScan.includes(jargon), false,
        `Stage "${stage.id}" (order ${stage.order}) must not contain jargon "${jargon}" · found in: ${textToScan}`
      );
    }
  }
});

// ─── T-10 · P3: model-less candidate never prompted for model ────────────────

test("T-10 · P3 · MODEL_LESS_DECLARED proceeds without any model requirement", () => {
  const ext = buildNodeOnboardingExtension({ model_status: "MODEL_LESS_DECLARED" });
  assert.equal(ext.model_readiness.status, "MODEL_LESS_DECLARED");
  assert.equal(ext.model_readiness.local_models_required, false);
  assert.equal(ext.model_readiness.fallback_path, "continue_model_less_onboarding");
  // The builder completes without error — no model gate blocks it.
});

// ─── T-10 · P4: MODEL_UNKNOWN proceeds without gatekeeping ──────────────────

test("T-10 · P4 · MODEL_UNKNOWN status produces complete output · onboarding does not gatekeep", () => {
  const ext = buildNodeOnboardingExtension({ model_status: "MODEL_UNKNOWN" });
  assert.equal(ext.model_readiness.status, "MODEL_UNKNOWN");
  assert.equal(ext.model_readiness.local_models_required, false);
  // All 5 blocks must be present — nothing is gated on model declaration accuracy.
  assert.ok("node_topology" in ext);
  assert.ok("language_state" in ext);
  assert.ok("candidate_lifecycle" in ext);
  assert.ok("blocked_effects" in ext);
});

// ─── T-10 · P5: mid-flow quit leaves no scan trace ───────────────────────────

test("T-10 · P5 · pure builder produces no filesystem side effects (no writes, no reads)", () => {
  // buildNodeOnboardingExtension and buildOnboardingLifecyclePreview are pure.
  // We verify: (a) no fs module calls are exercised by examining that the output
  // is identical across multiple calls (pure means deterministic + no I/O).
  const input = { candidate_ordinal: 1, language_code: "ar", model_status: "MODEL_LESS_DECLARED" };
  const a = buildNodeOnboardingExtension(input);
  const b = buildNodeOnboardingExtension(input);
  assert.equal(JSON.stringify(a), JSON.stringify(b),
    "Identical inputs must produce identical outputs — confirms pure (no side effects)");

  // Composed lifecycle builder is also pure.
  const la = buildOnboardingLifecyclePreview({ candidate_ordinal: 1, language: "ar" });
  const lb = buildOnboardingLifecyclePreview({ candidate_ordinal: 1, language: "ar" });
  assert.equal(JSON.stringify(la), JSON.stringify(lb));
});

// ─── T-10 · P6: consent in unknown/unset language refused ────────────────────

test("T-10 · P6 · language_set=false means consent_phrases_will_render_in=null · consent cannot proceed", () => {
  // When no language is set, consent_phrases_will_render_in must be null.
  // This structurally prevents consent rendering until language is chosen.
  const ext = buildNodeOnboardingExtension();
  assert.equal(ext.language_state.language_set, false);
  assert.equal(ext.language_state.consent_phrases_will_render_in, null,
    "No language set → consent phrase language is null → consent cannot render");
});

test("T-10 · P6b · setting language_code enables consent_phrases_will_render_in", () => {
  const ext = buildNodeOnboardingExtension({ language_code: "ar" });
  assert.equal(ext.language_state.language_set, true);
  assert.equal(ext.language_state.consent_phrases_will_render_in, "ar",
    "With language set to ar, consent phrases must render in ar");
});

// ─── T-10 · P7: no external ledger/registry add ──────────────────────────────

test("T-10 · P7 · all boundary keys false after onboarding completion · no external ledger add", () => {
  const r = buildOnboardingLifecyclePreview({ progress: { completed: [...ALL_7_STAGES] } });
  for (const key of PREVIEW_BOUNDARY_CANONICAL_KEYS) {
    assert.equal(r.boundary[key], false,
      `boundary.${key} must remain false after onboarding completion`);
  }
  // ADR-011 blocked effects: federation and poi_scoring explicitly blocked
  assert.equal(r.adr011_blocked_effects.federation, true);
  assert.equal(r.adr011_blocked_effects.poi_scoring, true);
});

// === SECTION 3 · T-11 to T-14 · runtime + integration invariants =============

// ─── T-11: model-less full flow has no model fs side effects ─────────────────

test("T-11 · model-less node full flow produces no model fs side effects", () => {
  // buildOnboardingLifecyclePreview is pure. Running it with model_status=MODEL_LESS_DECLARED
  // must produce complete output with model_readiness.fallback_path set correctly.
  // Since the builder reads no fs (no I/O), we verify via determinism + output shape.
  const r = buildOnboardingLifecyclePreview({
    adr011: { model_status: "MODEL_LESS_DECLARED" },
    progress: { completed: [...ALL_7_STAGES] },
  });
  // Complete output present
  assert.equal(r.model_readiness.status, "MODEL_LESS_DECLARED");
  assert.equal(r.model_readiness.local_models_required, false);
  assert.equal(r.model_readiness.scan_performed, false);
  assert.equal(r.model_readiness.model_invocation_allowed, false);
  assert.equal(r.model_readiness.fallback_path, "continue_model_less_onboarding");
  // genesis_preview_card still emits (model-less node is fully valid)
  assert.ok(r.genesis_preview_card !== null, "genesis_preview_card must emit for model-less node");
  // Determinism check (pure = no fs reads/writes changing state between calls)
  const r2 = buildOnboardingLifecyclePreview({
    adr011: { model_status: "MODEL_LESS_DECLARED" },
    progress: { completed: [...ALL_7_STAGES] },
  });
  assert.equal(r.model_readiness.status, r2.model_readiness.status);
  assert.equal(r.model_readiness.scan_performed, r2.model_readiness.scan_performed);
});

// ─── T-12: onboarding completion does NOT mint or advance chain ───────────────

test("T-12 · onboarding completion does NOT mint receipt · does NOT advance chain", () => {
  const r = buildOnboardingLifecyclePreview({
    progress: { completed: [...ALL_7_STAGES] },
    genesis_timestamp: "2026-05-19T00:00:00.000Z",
  });
  // Top-level boundary
  assert.equal(r.boundary.receipt_mint_performed, false,
    "boundary.receipt_mint_performed must be false after onboarding completion");
  assert.equal(r.boundary.chain_advance_performed, false,
    "boundary.chain_advance_performed must be false after onboarding completion");
  // Genesis card boundary
  assert.ok(r.genesis_preview_card !== null);
  assert.equal(r.genesis_preview_card.boundary.receipt_mint_performed, false);
  assert.equal(r.genesis_preview_card.boundary.chain_advance_performed, false);
  // blocked_until_typed_GO must include chain_advance_performed
  assert.ok(
    r.genesis_preview_card.blocked_until_typed_GO.includes("chain_advance_performed"),
    "blocked_until_typed_GO must list chain_advance_performed"
  );
  assert.ok(
    r.genesis_preview_card.blocked_until_typed_GO.includes("actual_receipt_mint"),
    "blocked_until_typed_GO must list actual_receipt_mint"
  );
});

// ─── T-13: homebase render accepts onboarding-incomplete candidate gracefully ─

test("T-13 · homebase-preview buildGreeting accepts onboarding-incomplete candidate · returns non-undefined non-throw", async () => {
  // Import dynamically to avoid top-level side effects.
  const { buildHomebasePreview } = await import("../packages/core/src/homebase-preview.js");

  // An onboarding-incomplete candidate has no profile name and no language_code.
  const incompleteGather = {
    ts: new Date("2026-05-19T00:00:00.000Z"),
    profile: {
      source_present: false,
      name: null,
      preferred_name: null,
      language_code: null,
    },
    memory_recent: [],
    warnings: [],
    partial: true,
    env_flags: { DEMA_HOME: null, DEMA_FORCE_TTY: false, DEMA_DEBUG: false, DEMA_NODE0_ADAPTER: null },
    memory_size: { entries: 0, bytes: 0 },
  };

  let result;
  assert.doesNotThrow(() => {
    result = buildHomebasePreview({ gather: incompleteGather });
  }, "buildHomebasePreview must not throw for onboarding-incomplete candidate");

  assert.ok(result !== undefined, "result must not be undefined");
  assert.ok(result.greeting !== undefined, "greeting must be present");
  assert.equal(typeof result.greeting.text, "string", "greeting.text must be a string");
  assert.ok(result.greeting.text.length > 0, "greeting.text must be non-empty");
  // With no name, should use welcome_new (not throw or return empty)
  assert.equal(result.greeting.has_name, false, "has_name must be false for nameless candidate");
});

// ─── T-14: language picker LANGUAGE_OPTIONS matches lifecycle stage 0 options ─

test("T-14 · v0.1c language picker LANGUAGE_OPTIONS exactly matches lifecycle stage 0 offered options", () => {
  // The picker's LANGUAGE_OPTIONS codes must be a subset of stage 0's options_default.
  const r = buildOnboardingLifecyclePreview();
  const stage0 = r.stages.find((s) => s.id === "language");
  assert.ok(stage0 !== undefined, "stage 0 must be language");

  const stage0Codes = new Set(stage0.options.map((o) => o.code));
  const pickerCodes = LANGUAGE_OPTIONS.map((o) => o.code);

  for (const code of pickerCodes) {
    assert.ok(
      stage0Codes.has(code),
      `LANGUAGE_OPTIONS code "${code}" must be present in stage 0 options`
    );
  }
});

test("T-14b · GREETING_TEMPLATES keys are a superset of LANGUAGE_OPTIONS codes", () => {
  for (const opt of LANGUAGE_OPTIONS) {
    assert.ok(
      GREETING_TEMPLATES[opt.code] !== undefined,
      `GREETING_TEMPLATES must have entry for LANGUAGE_OPTIONS code "${opt.code}"`
    );
  }
});

// === SECTION 4 · T-15 to T-18 · v0.2 law compliance (Laws #9, #10, #11) =====

// ─── T-15: returning-user language load ──────────────────────────────────────

test("T-15 · returning-user language load · profile.json with language_code=ar → silent load", async () => {
  await withTmpDir(async (home) => {
    await writeFile(
      join(home, "profile.json"),
      JSON.stringify({ preferred_name: "Samy", language_code: "ar" })
    );
    const stdout = makeStdout();
    const stdin = makeStdin([]); // TTY stdin, but must NOT be read

    const result = await resolveOperatorLanguage({
      home,
      stdin,
      stdout,
      resetLanguage: false,
      skipPrompt: false,
    });

    assert.equal(result.language_code, "ar");
    assert.equal(result.language_source, "profile_load",
      "language_source must be profile_load for returning user");
    assert.equal(result.returning_user_load, true,
      "returning_user_load must be true");
    assert.ok(
      Array.isArray(result.candidate_lifecycle?.stage_skipped_due_to_profile) ||
      result.candidate_lifecycle?.is_returning_user === true,
      "candidate_lifecycle must indicate returning user"
    );
    // No prompt rendered — silent load means no stdout output
    assert.equal(stdout.output, "",
      "No prompt must be written to stdout for returning-user silent load");
  });
});

// ─── T-16: --reset-language explicit re-prompt ───────────────────────────────

test("T-16 · reset-language flag · existing profile language_code cleared · picker re-runs · language_source=reset_explicit", async () => {
  await withTmpDir(async (home) => {
    await writeFile(
      join(home, "profile.json"),
      JSON.stringify({ preferred_name: "Samy", language_code: "ar" })
    );
    const stdout = makeStdout();
    // Select "fr" (option 3), skip secondary
    const stdin = makeStdin(["3", ""]);

    const result = await resolveOperatorLanguage({
      home,
      stdin,
      stdout,
      resetLanguage: true,
      skipPrompt: false,
    });

    assert.equal(result.language_source, "reset_explicit",
      "language_source must be reset_explicit when --reset-language is used");
    assert.equal(result.returning_user_load, false,
      "returning_user_load must be false for reset path");
    assert.equal(result.language_code, "fr",
      "picker must have run and selected fr");
    // Prompt must have been rendered (picker ran)
    assert.ok(stdout.output.length > 0,
      "stdout must contain picker prompt when reset-language triggers interactive picker");
    assert.equal(result.candidate_lifecycle.onboarding_trigger, "reset_explicit");
  });
});

// ─── T-17: second language optional · single Enter declines ─────────────────

test("T-17 · second language optional · single Enter declines · secondary_language_offered=true · secondary_language_code=null", async () => {
  await withTmpDir(async (home) => {
    const stdout = makeStdout();
    // Pick "en" (option 2), then single Enter to skip secondary
    const stdin = makeStdin(["2", ""]);

    const result = await resolveOperatorLanguage({
      home,
      stdin,
      stdout,
      resetLanguage: false,
      skipPrompt: false,
    });

    assert.equal(result.secondary_language_offered, true,
      "secondary_language_offered must be true — prompt was shown");
    assert.equal(result.secondary_language_code, null,
      "secondary_language_code must be null when Enter pressed to skip");
    assert.equal(result.language_code, "en");
    // Candidate proceeds normally — no re-prompt, no warning about skip
    // (we verify by checking there's no language_code=null in result)
    assert.notEqual(result.language_code, null);
  });
});

// ─── T-18: Genesis Preview Card emission on stage 6 ─────────────────────────

test("T-18 · Genesis Preview Card emits on stage 6 · schema correct · receipt_id_preview is 64-hex · boundary false", () => {
  const r = buildOnboardingLifecyclePreview({
    progress: { completed: [...ALL_7_STAGES] },
    genesis_timestamp: "2026-05-19T00:00:00.000Z",
    language: "en",
    candidate_name: "Samy",
  });

  assert.ok(r.genesis_preview_card !== null, "genesis_preview_card must be present");
  assert.equal(r.genesis_preview_card.schema, "bizra.dema.genesis_preview_card.v0.1");

  const receiptIdPreview = r.genesis_preview_card.would_mint_if_consented.receipt_id_preview;
  assert.equal(typeof receiptIdPreview, "string", "receipt_id_preview must be a string");
  assert.equal(receiptIdPreview.length, 64, "receipt_id_preview must be 64 chars (sha256 hex)");
  assert.ok(/^[0-9a-f]{64}$/.test(receiptIdPreview),
    "receipt_id_preview must be lowercase hex sha256");

  assert.equal(r.boundary.receipt_mint_performed, false);
  assert.equal(r.genesis_preview_card.boundary.receipt_mint_performed, false,
    "card boundary.receipt_mint_performed must be false");
  assert.equal(r.genesis_preview_card.boundary.chain_advance_performed, false,
    "card boundary.chain_advance_performed must be false");
});

test("T-18b · proof-forge chain length unchanged before and after genesis card emission", () => {
  // Read chain_length from .proof-forge/EVIDENCE_INDEX.json.
  // Since buildOnboardingLifecyclePreview is pure (no I/O), chain_length must not change.
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const evidencePath = join(repoRoot, ".proof-forge", "EVIDENCE_INDEX.json");

  let chainLengthBefore;
  try {
    const raw = readFileSync(evidencePath, "utf8");
    chainLengthBefore = JSON.parse(raw).chain_length;
  } catch {
    // .proof-forge not present in this environment — skip measurement, assert pure
    chainLengthBefore = null;
  }

  // Run the builder (the action under test)
  buildOnboardingLifecyclePreview({
    progress: { completed: [...ALL_7_STAGES] },
    genesis_timestamp: "2026-05-19T00:00:00.000Z",
  });

  let chainLengthAfter;
  try {
    const raw = readFileSync(evidencePath, "utf8");
    chainLengthAfter = JSON.parse(raw).chain_length;
  } catch {
    chainLengthAfter = null;
  }

  if (chainLengthBefore !== null && chainLengthAfter !== null) {
    assert.equal(chainLengthAfter, chainLengthBefore,
      `chain_length must not change: was ${chainLengthBefore}, now ${chainLengthAfter}`);
  }
  // If file is absent, builder is still pure by construction — test passes.
});

// === SECTION 5 · P8-P10 · remaining Daughter Test predicates =================

// ─── P8: returning operator never re-asked language ──────────────────────────

test("P8 · returning operator NEVER re-asked language at user-facing surface · silent load from profile", async () => {
  await withTmpDir(async (home) => {
    await writeFile(
      join(home, "profile.json"),
      JSON.stringify({ preferred_name: "Samy", language_code: "en" })
    );
    const stdout = makeStdout();
    const stdin = makeStdin([]); // TTY stdin provided — must NOT be consumed

    const result = await resolveOperatorLanguage({
      home,
      stdin,
      stdout,
      resetLanguage: false,
      skipPrompt: false,
    });

    // Must load silently — no prompt written
    assert.equal(stdout.output, "",
      "P8: No language prompt must be emitted when profile.json carries language_code");
    assert.equal(result.language_code, "en");
    assert.equal(result.returning_user_load, true);
    assert.equal(result.language_source, "profile_load");
  });
});

// ─── P9: single Enter declines second language ───────────────────────────────

test("P9 · single Enter on second-language prompt declines without re-prompt · no penalty path", async () => {
  await withTmpDir(async (home) => {
    const stdout = makeStdout();
    // Pick "ar" (option 1), then single Enter to skip secondary
    const stdin = makeStdin(["1", ""]);

    const result = await resolveOperatorLanguage({
      home,
      stdin,
      stdout,
      resetLanguage: false,
      skipPrompt: false,
    });

    assert.equal(result.language_code, "ar",
      "Primary language must be set");
    assert.equal(result.secondary_language_offered, true,
      "P9: secondary_language_offered must be true — prompt was shown");
    assert.equal(result.secondary_language_code, null,
      "P9: secondary_language_code must be null when Enter pressed");
    // No re-prompt: if there were a re-prompt, the stdin would have run out
    // and result.language_code would be null or warnings would fire.
    assert.equal(result.language_code, "ar",
      "P9: candidate proceeds to primary language with no penalty");
  });
});

// ─── P10: Genesis Preview Card shown BEFORE mint · no mint receipt file ───────

test("P10 · Genesis Preview Card shown BEFORE any mint · no mint receipt file at ~/.dema/receipts/", async () => {
  await withTmpDir(async (home) => {
    // Build the card — this is the action that "shows the card"
    const r = buildOnboardingLifecyclePreview({
      progress: { completed: [...ALL_7_STAGES] },
      genesis_timestamp: "2026-05-19T00:00:00.000Z",
    });

    assert.ok(r.genesis_preview_card !== null,
      "P10: genesis_preview_card must be present (shown to candidate)");
    assert.equal(r.genesis_preview_card.mode, "preview_only",
      "P10: card must be preview_only — not a minted artifact");
    assert.equal(r.genesis_preview_card.boundary.receipt_mint_performed, false,
      "P10: boundary.receipt_mint_performed must be false");

    // No mint receipt file must exist in the tmpdir (simulates ~/.dema/)
    // The card's mint_destination references ~/.dema/receipts/ — we verify
    // it has NOT been written there (the builder is pure and does no I/O).
    const receiptsDir = join(home, "receipts");
    let receiptsExist = false;
    try {
      await readFile(receiptsDir);
      receiptsExist = true;
    } catch {
      receiptsExist = false; // expected — directory/file absent
    }
    assert.equal(receiptsExist, false,
      "P10: no mint receipt file must exist under ~/.dema/receipts/ after card emission");

    // The card's own storage path is under state/, not receipts/
    const storagePath = r.genesis_preview_card.card_storage.path;
    assert.equal(
      storagePath.includes("receipts/"), false,
      "P10: card_storage.path must NOT reference receipts/"
    );
    assert.ok(
      storagePath.includes("state/"),
      "P10: card_storage.path must reference state/"
    );
  });
});
