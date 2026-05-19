// Cross-preview shape contract for the 5 micro-primitives surfaced as named
// builders in step7-consent-refusal-preview.js (commit 3a56250). Asserts that
// every preview which emits one of self_proactive_harness, self_critique,
// micro_compliance, micro_consent, or analogical_model conforms to a shared
// structural shape. Per-preview value specialisation is intentional (each
// preview's `mode:` and `preview_scope:` are surface-specific); this test
// codifies the keys and types, not the values.
//
// Notes on real drift surfaced 2026-05-17 (recorded so a future maintainer
// does not mistake this test's looseness for an oversight):
//
// 1. Consent-value drift: only 2 of 14 emitting previews (step7 + process-
//    value-preview) set the step7-canonical micro_consent invariants
//    (exact_string_required_for_gated_actions=true, broad_consent_allowed=
//    false, consent_observed_in_preview=false). The other 12 leave them
//    undefined. Test asserts type-when-present, not value, until a separate
//    decision tightens the contract.
//
// 2. Mode-case drift: 11 emitting previews use UPPER_SNAKE mode prefixes
//    (DETERMINISTIC_REFUSAL_PREVIEW, etc.). 4 older previews use lower_snake
//    (deterministic_preview_checks, computed_preview_checks, deterministic_
//    fixture_replay). Likely parallel-producer artifact per ADR-007. Test
//    accepts both conventions; tightening to UPPER_SNAKE is a separate
//    normalisation decision.
//
// 3. Harness-shape divergence: three sub-conventions in use.
//    step7/corpus family (11 previews): { mode, recommended_micro_action,
//    gates: [{gate: string, pass: boolean}] } — testable boolean gates.
//    network-blueprint / network-fixture / process-value-fixture (3 previews):
//    { mode, checks: [string], output_boundary?: string } — advisory strings.
//    network-refusal-matrix (1 preview): { mode, checks: [{check, passed}],
//    output_boundary?: string } — testable gates with renamed keys (parallel
//    structure to step7 gates). Test accepts all three via union.
//
// 4. Critique-shape divergence: parallel to (3). step7/corpus family emits
//    self_critique as { confidence: string, limitation: string }. network/
//    process-value-fixture family emits a risk register: array of { risk:
//    string, mitigation: string }. Test accepts either.
//
// 5. Compliance-shape divergence: step7/corpus family emits micro_compliance
//    as a flat object of boolean flags ({ preview_only: true, ... }). network/
//    process-value-fixture family emits an array of control records
//    ([{ control: string, statement?: string, verified_by: string }, ...]).
//    Test accepts either.
//
// 6. Analogical-shape divergence: step7/corpus family emits
//    { model: string, mapping: string }. network/process-value-fixture family
//    emits { analogy: string, useful_because: string, not_analogous_to:
//    [string], boundary: string }. Test accepts either.
//
// SUMMARY: the 5 primitives are a TOP-LEVEL key convention only. Sub-shape
// has two parallel conventions across the population (~11 step7/corpus +
// ~4 network/process-value-fixture). The integration value of this test is
// in making both conventions visible and asserting structural correctness
// within each, NOT in forcing migration to a single convention.

import test from "node:test";
import assert from "node:assert/strict";

const fixedNow = new Date("2026-05-17T00:00:00.000Z");

const PREVIEWS = [
  ["corpus-benchmark-schema-preview.js", "buildCorpusBenchmarkSchemaPreview", {}],
  ["corpus-data-tier-classifier-preview.js", "buildCorpusDataTierClassifierPreview", {}],
  ["corpus-eval-scorecard-preview.js", "buildCorpusEvalScorecardPreview", {}],
  ["corpus-gold-label-fixture-preview.js", "buildCorpusGoldLabelFixturePreview", {}],
  ["corpus-manual-review-queue-preview.js", "buildCorpusManualReviewQueuePreview", {}],
  ["corpus-preview-index.js", "buildCorpusPreviewIndex", {}],
  ["corpus-redaction-fixture-preview.js", "buildCorpusRedactionFixturePreview", {}],
  ["corpus-scorecard-receipt-schema-preview.js", "buildCorpusScorecardReceiptSchemaPreview", {}],
  ["model-corpus-manifest-preview.js", "buildModelCorpusManifestPreview", {}],
  ["network-blueprint.js", "buildNetworkBlueprint", {}],
  ["network-fixture-preview.js", "buildOfflineNetworkFixturePreview", {}],
  ["network-refusal-matrix-preview.js", "buildNetworkRefusalMatrixPreview", {}],
  ["process-value-fixture-preview.js", "buildProcessValueFixturePackPreview", {}],
  ["process-value-preview.js", "buildTrueValuePreview", { now: fixedNow }],
  ["step7-consent-refusal-preview.js", "buildStep7ConsentRefusalPreview", { observedText: "you have my permission and authorization", now: fixedNow }]
];

function assertHarnessShape(obj, src) {
  assert.equal(typeof obj.mode, "string", `${src}.self_proactive_harness.mode must be string`);
  assert.match(obj.mode, /^(DETERMINISTIC|COMPUTED|deterministic|computed)_/, `${src}.self_proactive_harness.mode must begin with a deterministic/computed prefix (see mode-case drift note)`);

  const hasStep7Shape = "recommended_micro_action" in obj && Array.isArray(obj.gates);
  const hasNetworkShape = Array.isArray(obj.checks);
  assert.ok(hasStep7Shape || hasNetworkShape,
    `${src}.self_proactive_harness must have either {recommended_micro_action, gates[]} (step7/corpus family) or {checks[]} (network/process-value-fixture family) — see harness-shape divergence note`);

  if (hasStep7Shape) {
    assert.equal(typeof obj.recommended_micro_action, "string", `${src}.recommended_micro_action must be string`);
    for (const g of obj.gates) {
      assert.equal(typeof g.gate, "string", `${src} gate.gate must be string`);
      assert.equal(typeof g.pass, "boolean", `${src} gate.pass must be boolean`);
    }
  }

  if (hasNetworkShape) {
    for (const c of obj.checks) {
      if (typeof c === "string") {
        // network-blueprint / network-fixture / process-value-fixture: advisory string
      } else if (c && typeof c === "object") {
        // network-refusal-matrix: testable gate { check, passed } (parallel to step7 gates but renamed)
        assert.equal(typeof c.check, "string", `${src} check.check must be string`);
        assert.equal(typeof c.passed, "boolean", `${src} check.passed must be boolean`);
      } else {
        assert.fail(`${src} check item must be string or {check, passed} object`);
      }
    }
    if ("output_boundary" in obj) {
      assert.equal(typeof obj.output_boundary, "string", `${src}.output_boundary must be string when present`);
    }
  }
}

function assertCritiqueShape(obj, src) {
  if (Array.isArray(obj)) {
    // network/process-value-fixture family: risk register
    for (const item of obj) {
      assert.equal(typeof item.risk, "string", `${src}.self_critique[].risk must be string`);
      assert.equal(typeof item.mitigation, "string", `${src}.self_critique[].mitigation must be string`);
    }
  } else {
    // step7/corpus family: single critique object
    assert.equal(typeof obj.confidence, "string", `${src}.self_critique.confidence must be string`);
    assert.equal(typeof obj.limitation, "string", `${src}.self_critique.limitation must be string`);
  }
}

function assertComplianceShape(obj, src) {
  if (Array.isArray(obj)) {
    // network/process-value-fixture family: control records
    for (const item of obj) {
      assert.equal(typeof item.control, "string", `${src}.micro_compliance[].control must be string`);
      assert.equal(typeof item.verified_by, "string", `${src}.micro_compliance[].verified_by must be string`);
    }
  } else {
    // step7/corpus family: flat boolean flags
    assert.equal(typeof obj, "object", `${src}.micro_compliance must be object`);
    assert.notEqual(obj, null, `${src}.micro_compliance must not be null`);
    for (const [k, v] of Object.entries(obj)) {
      assert.equal(typeof v, "boolean", `${src}.micro_compliance.${k} must be boolean (got ${typeof v})`);
    }
  }
}

function assertConsentShape(obj, src) {
  // Both families share preview_scope as a string. Other keys diverge in name
  // and presence; assert types only when keys are present (see consent-value
  // drift note).
  assert.equal(typeof obj.preview_scope, "string", `${src}.micro_consent.preview_scope must be string`);
  const booleanKeysWhenPresent = [
    "exact_string_required_for_gated_actions", "broad_consent_allowed",
    "consent_observed_in_preview", "action_authorized_by_preview",
    "reusable_authorization_created",
    "future_step7_mint_requires_fresh_current_operator_turn",
    "current_preview_requires_operator_authorization",
    "phrase_emitted", "approval_recorded",
    "future_live_probe_requires_fresh_current_operator_turn",
    "future_mint_or_node_action_requires_fresh_current_operator_turn"
  ];
  for (const key of booleanKeysWhenPresent) {
    if (key in obj) {
      assert.equal(typeof obj[key], "boolean", `${src}.micro_consent.${key} must be boolean when present`);
    }
  }
  if ("consent_property_model" in obj) {
    assert.equal(typeof obj.consent_property_model, "string", `${src}.micro_consent.consent_property_model must be string when present`);
  }
}

function assertAnalogicalShape(obj, src) {
  if ("model" in obj) {
    // step7/corpus family
    assert.equal(typeof obj.model, "string", `${src}.analogical_model.model must be string`);
    assert.equal(typeof obj.mapping, "string", `${src}.analogical_model.mapping must be string`);
  } else if ("analogy" in obj) {
    // network/process-value-fixture family
    assert.equal(typeof obj.analogy, "string", `${src}.analogical_model.analogy must be string`);
    assert.equal(typeof obj.useful_because, "string", `${src}.analogical_model.useful_because must be string`);
    assert.ok(Array.isArray(obj.not_analogous_to), `${src}.analogical_model.not_analogous_to must be array`);
    for (const item of obj.not_analogous_to) {
      assert.equal(typeof item, "string", `${src}.not_analogous_to[] must be string`);
    }
    assert.equal(typeof obj.boundary, "string", `${src}.analogical_model.boundary must be string`);
  } else {
    assert.fail(`${src}.analogical_model must have either {model, mapping} (step7/corpus) or {analogy, useful_because, ...} (network/process-value-fixture) — see analogical-shape divergence note`);
  }
}

for (const [mod, fn, input] of PREVIEWS) {
  test(`preview primitive shape contract: ${mod}`, async () => {
    const m = await import(`../packages/core/src/${mod}`);
    assert.equal(typeof m[fn], "function", `${mod} must export ${fn}`);
    const out = m[fn](input);
    assert.equal(typeof out, "object", `${mod}.${fn}() must return object`);

    if ("self_proactive_harness" in out) assertHarnessShape(out.self_proactive_harness, mod);
    if ("self_critique" in out) assertCritiqueShape(out.self_critique, mod);
    if ("micro_compliance" in out) assertComplianceShape(out.micro_compliance, mod);
    if ("micro_consent" in out) assertConsentShape(out.micro_consent, mod);
    if ("analogical_model" in out) assertAnalogicalShape(out.analogical_model, mod);
  });
}

test("preview primitive shape contract: consent-planner.js", async () => {
  const m = await import("../packages/consent/src/consent-planner.js");
  const out = m.buildConsentPlanPreview({
    intent: "Fix auth.py and run npm test",
    now: fixedNow
  });

  assertHarnessShape(out.self_proactive_harness, "consent-planner.js");
  assertCritiqueShape(out.self_critique, "consent-planner.js");
  assertComplianceShape(out.micro_compliance, "consent-planner.js");
  assertConsentShape(out.micro_consent, "consent-planner.js");
  assertAnalogicalShape(out.analogical_model, "consent-planner.js");
});

test("step7 named builders implement the canonical primitive shape", async () => {
  const m = await import("../packages/core/src/step7-consent-refusal-preview.js");
  assertHarnessShape(m.buildSelfProactiveHarness({ malformed: false, nextSafeAction: "hold_step7_ceremony" }), "step7-builder");
  assertCritiqueShape(m.buildSelfCritique({ malformed: false }), "step7-builder");
  assertComplianceShape(m.buildMicroCompliance({ malformed: false }), "step7-builder");
  assertConsentShape(m.buildMicroConsent(), "step7-builder");
  assertAnalogicalShape(m.buildAnalogicalModel(), "step7-builder");
});

test("step7 named builders satisfy the step7-canonical micro_consent invariants (reference)", async () => {
  // step7 is the reference implementation: it sets the three invariants the
  // value-drift NOTE flagged as missing in 12/14 other previews.
  const m = await import("../packages/core/src/step7-consent-refusal-preview.js");
  const mc = m.buildMicroConsent();
  assert.equal(mc.exact_string_required_for_gated_actions, true);
  assert.equal(mc.broad_consent_allowed, false);
  assert.equal(mc.consent_observed_in_preview, false);
  assert.equal(mc.action_authorized_by_preview, false);
  assert.equal(mc.reusable_authorization_created, false);
});
