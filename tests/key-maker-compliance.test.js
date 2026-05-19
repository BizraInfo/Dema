import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildKeyMakerCompliancePreview,
  buildKeyMakerComplianceSummary,
  KEY_MAKER_CANONICAL_KEY_TYPES,
  KEY_MAKER_INVARIANT_NAMES
} from "../packages/core/src/key-maker-compliance.js";
import {
  isCanonicalBoundary,
  PREVIEW_BOUNDARY_CANONICAL_KEYS
} from "../packages/core/src/preview-boundary.js";

test("KeyMakerCompliance emits canonical schema + truth label + epistemic_conduct_check mode", () => {
  const e = buildKeyMakerCompliancePreview();
  assert.equal(e.schema, "bizra.dema.key_maker_compliance.v0.1");
  assert.equal(e.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(e.mode, "epistemic_conduct_check");
});

test("KeyMakerCompliance boundary is the canonical 16-key frozen object", () => {
  const e = buildKeyMakerCompliancePreview();
  assert.ok(isCanonicalBoundary(e.boundary), "boundary must be canonical");
  for (const key of PREVIEW_BOUNDARY_CANONICAL_KEYS) {
    assert.equal(e.boundary[key], false, `boundary.${key} must be false`);
  }
});

test("KeyMakerCompliance is deep-frozen at all sub-views", () => {
  const e = buildKeyMakerCompliancePreview({
    door: "test",
    known: ["a"],
    uncertain: ["b"],
    assumed_with_ihsan: ["c"],
    unknown: ["d"],
    key_types: ["mirror", "boundary_marker"]
  });
  assert.ok(Object.isFrozen(e));
  assert.ok(Object.isFrozen(e.certainty));
  assert.ok(Object.isFrozen(e.certainty.known));
  assert.ok(Object.isFrozen(e.certainty.uncertain));
  assert.ok(Object.isFrozen(e.certainty.assumed_with_ihsan));
  assert.ok(Object.isFrozen(e.certainty.unknown));
  assert.ok(Object.isFrozen(e.opposing_view_search));
  assert.ok(Object.isFrozen(e.micro_consent));
  assert.ok(Object.isFrozen(e.invariant_compliance));
  assert.ok(Object.isFrozen(e.boundary));
  assert.ok(Object.isFrozen(e.key_types));
});

test("KeyMakerCompliance default-empty envelope is trivially compliant", () => {
  // No claims → no decomposition required → all invariants N/A → compliant
  const e = buildKeyMakerCompliancePreview();
  assert.equal(e.invariant_compliance.overall_compliant, true);
  assert.equal(e.invariant_compliance.assumption_declaration, true);
  assert.equal(e.invariant_compliance.certainty_mapping, true);
  assert.equal(e.invariant_compliance.constructive_reading, true);
  assert.equal(e.invariant_compliance.opposing_view_search, true);
  assert.equal(e.invariant_compliance.boundary_marker, true);
});

test("Invariant 5 fails when uncertain claims present but no boundary_marker", () => {
  const e = buildKeyMakerCompliancePreview({
    uncertain: ["this might be wrong"],
    boundary_marker: ""
  });
  assert.equal(e.invariant_compliance.boundary_marker, false);
  assert.equal(e.invariant_compliance.overall_compliant, false);
  assert.ok(e.invariant_compliance.failed_invariants.includes("boundary_marker"));
});

test("Invariant 5 passes when uncertain claims paired with boundary_marker", () => {
  const e = buildKeyMakerCompliancePreview({
    uncertain: ["this might be wrong"],
    boundary_marker: "Evidence ends here; judgment begins."
  });
  assert.equal(e.invariant_compliance.boundary_marker, true);
  assert.equal(e.invariant_compliance.overall_compliant, true);
});

test("Invariant 5 fails when assumed_with_ihsan present but no boundary_marker", () => {
  const e = buildKeyMakerCompliancePreview({
    assumed_with_ihsan: ["I assume the operator means X"],
    boundary_marker: ""
  });
  assert.equal(e.invariant_compliance.boundary_marker, false);
  assert.equal(e.invariant_compliance.overall_compliant, false);
});

test("Invariant 3 fails when constructive_reading_applied=false", () => {
  const e = buildKeyMakerCompliancePreview({
    constructive_reading_applied: false
  });
  assert.equal(e.invariant_compliance.constructive_reading, false);
  assert.equal(e.invariant_compliance.overall_compliant, false);
});

test("Invariant 4 N/A (compliant) when no opposing view examined", () => {
  const e = buildKeyMakerCompliancePreview({
    opposing_view_examined: null
  });
  assert.equal(e.invariant_compliance.opposing_view_search, true);
});

test("Invariant 4 fails when opposing view examined but no truth found and no honest null flag", () => {
  const e = buildKeyMakerCompliancePreview({
    opposing_view_examined: "the position I'm critiquing",
    opposing_view_truth_found: null,
    searched_and_found_no_articulable_truth: false
  });
  assert.equal(e.invariant_compliance.opposing_view_search, false);
  assert.equal(e.invariant_compliance.overall_compliant, false);
});

test("Invariant 4 passes when opposing view examined with truth found", () => {
  const e = buildKeyMakerCompliancePreview({
    opposing_view_examined: "the position I'm critiquing",
    opposing_view_truth_found: "It does contain the observation that...",
    boundary_marker: "n/a"
  });
  assert.equal(e.invariant_compliance.opposing_view_search, true);
});

test("Invariant 4 passes when opposing view examined with honest-null declaration", () => {
  const e = buildKeyMakerCompliancePreview({
    opposing_view_examined: "the position I'm critiquing",
    opposing_view_truth_found: null,
    searched_and_found_no_articulable_truth: true,
    boundary_marker: "n/a"
  });
  assert.equal(e.invariant_compliance.opposing_view_search, true);
});

test("key_types filter rejects non-canonical entries and dedupes", () => {
  const e = buildKeyMakerCompliancePreview({
    key_types: ["mirror", "INVALID", "mirror", "lens", "fake-key", "silence"]
  });
  assert.deepEqual([...e.key_types], ["mirror", "lens", "silence"]);
});

test("key_types accepts all 8 canonical types", () => {
  const e = buildKeyMakerCompliancePreview({
    key_types: [...KEY_MAKER_CANONICAL_KEY_TYPES]
  });
  assert.equal(e.key_types.length, 8);
});

test("Adversarial inputs (functions/symbols/objects in arrays) are silently filtered", () => {
  const e = buildKeyMakerCompliancePreview({
    known: ["valid", () => "malicious", { bad: true }, Symbol("x"), 42, "another valid"],
    uncertain: [null, undefined, "", "valid uncertain"],
    assumed_with_ihsan: ["valid assumption"],
    boundary_marker: "marked"
  });
  assert.deepEqual([...e.certainty.known], ["valid", "another valid"]);
  assert.deepEqual([...e.certainty.uncertain], ["valid uncertain"]);
  assert.deepEqual([...e.certainty.assumed_with_ihsan], ["valid assumption"]);
});

test("Adversarial micro_consent.mutation_authorized cannot be overridden to true", () => {
  // The schema mandates mutation_authorized=false. Even if caller tries to
  // inject true via a parameter, the builder must pin it false.
  const e = buildKeyMakerCompliancePreview({
    // No path exposed in API to set mutation_authorized; verify the pin
  });
  assert.equal(e.micro_consent.mutation_authorized, false);
  assert.equal(e.micro_consent.requires_typed_go, true);
});

test("KeyMakerCompliance is deterministic given identical input", () => {
  const a = buildKeyMakerCompliancePreview({
    door: "test door",
    known: ["fact A"],
    uncertain: ["maybe B"],
    boundary_marker: "marker"
  });
  const b = buildKeyMakerCompliancePreview({
    door: "test door",
    known: ["fact A"],
    uncertain: ["maybe B"],
    boundary_marker: "marker"
  });
  assert.deepEqual(a, b);
});

test("Summary variant emits suffix-tagged schema and preserves overall_compliant", () => {
  const s = buildKeyMakerComplianceSummary({
    uncertain: ["x"],
    boundary_marker: "marked"
  });
  assert.equal(s.schema, "bizra.dema.key_maker_compliance_summary.v0.1");
  assert.equal(s.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(s.mode, "summary");
  assert.equal(s.source_schema, "bizra.dema.key_maker_compliance.v0.1");
  assert.equal(s.overall_compliant, true);
  assert.equal(s.certainty_counts.uncertain, 1);
  assert.equal(s.boundary_marker_present, true);
});

test("Summary boundary is the canonical 16-key frozen object", () => {
  const s = buildKeyMakerComplianceSummary();
  assert.ok(isCanonicalBoundary(s.boundary));
});

test("Summary fits within line budget pretty-printed", () => {
  const s = buildKeyMakerComplianceSummary();
  const lines = JSON.stringify(s, null, 2).split("\n").length;
  assert.ok(lines <= 40, `summary must be <= 40 lines, got ${lines}`);
});

test("All 5 invariants reachable as named entries in compliance object", () => {
  const e = buildKeyMakerCompliancePreview();
  for (const inv of KEY_MAKER_INVARIANT_NAMES) {
    assert.ok(inv in e.invariant_compliance, `compliance must include ${inv}`);
  }
});

test("Composite scenario: full V/D/A/U envelope with opposing-view + boundary passes all 5", () => {
  // The canonical 'good' envelope · all 5 invariants satisfied
  const e = buildKeyMakerCompliancePreview({
    door: "decide whether to ship feature X",
    known: ["the test suite passes", "the boundary is canonical"],
    uncertain: ["whether reviewers will find a regression"],
    assumed_with_ihsan: ["the operator wants this shipped if safe"],
    unknown: ["whether downstream consumers depend on the old shape"],
    key_types: ["mirror", "boundary_marker", "lantern"],
    opposing_view_examined: "the view that we should delay shipping",
    opposing_view_truth_found: "delay buys time for reviewer feedback",
    boundary_marker: "Evidence supports shipping; judgment about reviewer reaction does not.",
    constructive_reading_applied: true
  });
  assert.equal(e.invariant_compliance.overall_compliant, true);
  assert.deepEqual([...e.invariant_compliance.failed_invariants], []);
});
