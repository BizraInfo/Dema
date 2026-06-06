import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildSATDoctrineCompliancePreview,
  buildSATDoctrineComplianceEffectCap,
  buildSATDoctrineComplianceKernel,
  buildSATDoctrineComplianceSummary,
  auditArtifactDoctrine,
  SAT_DOCTRINE_COMPLIANCE_PERSONA,
} from "../packages/core/src/sat-doctrine-compliance.js";
import { isCanonicalBoundary } from "../packages/core/src/preview-boundary.js";

test("SAT-3 canonical schema + persona sat_number=3", () => {
  const p = buildSATDoctrineCompliancePreview();
  assert.equal(p.schema, "bizra.dema.sat_doctrine_compliance.v0.1");
  assert.equal(p.persona.sat_number, 3);
  assert.equal(p.persona.role_name, "doctrine_compliance");
});

test("SAT-3 audits all 5 Key Maker invariants", () => {
  const p = buildSATDoctrineCompliancePreview();
  assert.equal(p.audited_invariants.length, 5);
  for (const name of [
    "assumption_declaration",
    "certainty_mapping",
    "constructive_reading",
    "opposing_view_search",
    "boundary_marker",
  ]) {
    assert.ok(p.audited_invariants.includes(name));
  }
});

test("SAT-3 boundary canonical · refusals include waive_invariant", () => {
  const p = buildSATDoctrineCompliancePreview();
  assert.ok(isCanonicalBoundary(p.boundary));
  assert.ok(p.persona.primary_refusals.includes("waive_invariant"));
  assert.ok(
    p.persona.primary_refusals.includes("approve_non_compliant_output"),
  );
  assert.ok(
    p.persona.primary_refusals.includes("soften_failed_invariant_to_warning"),
  );
});

test("SAT-3 EffectCap valid + blocks waive/approve-non-compliant/soften", () => {
  const cap = buildSATDoctrineComplianceEffectCap();
  assert.equal(cap.valid, true);
  assert.ok(cap.blocked_effects.includes("waive_invariant"));
  assert.ok(cap.blocked_effects.includes("approve_non_compliant"));
  assert.ok(cap.blocked_effects.includes("soften_invariant_to_warning"));
});

test("auditArtifactDoctrine · empty claims envelope → trivially compliant", () => {
  const v = auditArtifactDoctrine({});
  assert.equal(v.schema, "bizra.dema.doctrine_compliance_verdict.v0.1");
  assert.equal(v.passed, true);
  assert.equal(v.verdict, "doctrine_compliant");
  assert.equal(v.compliance_score, 5);
  assert.equal(v.failed_invariants.length, 0);
});

test("auditArtifactDoctrine · uncertain claim WITHOUT boundary_marker → boundary_marker invariant fails", () => {
  const v = auditArtifactDoctrine({
    uncertain_claims: ["this might be wrong"],
    boundary_marker: "",
  });
  assert.equal(v.passed, false);
  assert.equal(v.verdict, "doctrine_violated");
  assert.ok(v.failed_invariants.includes("boundary_marker"));
  assert.equal(v.severities.boundary_marker, "high");
});

test("auditArtifactDoctrine · uncertain claim WITH boundary_marker → compliant", () => {
  const v = auditArtifactDoctrine({
    uncertain_claims: ["this might be wrong"],
    boundary_marker: "Evidence ends here · judgment begins.",
  });
  assert.equal(v.passed, true);
  assert.equal(v.compliance_score, 5);
});

test("auditArtifactDoctrine · constructive_reading=false → invariant 3 fails with high severity", () => {
  const v = auditArtifactDoctrine({
    constructive_reading_applied: false,
  });
  assert.equal(v.passed, false);
  assert.ok(v.failed_invariants.includes("constructive_reading"));
  assert.equal(v.severities.constructive_reading, "high");
});

test("auditArtifactDoctrine · opposing view examined WITHOUT truth found → opposing_view_search fails", () => {
  const v = auditArtifactDoctrine({
    opposing_view_examined: "the alternative position",
    opposing_view_truth_found: null,
  });
  assert.equal(v.passed, false);
  assert.ok(v.failed_invariants.includes("opposing_view_search"));
});

test("auditArtifactDoctrine · opposing view examined WITH truth found → compliant", () => {
  const v = auditArtifactDoctrine({
    opposing_view_examined: "alternative",
    opposing_view_truth_found: "they have a point about X",
    boundary_marker: "n/a",
  });
  assert.equal(v.passed, true);
});

test("auditArtifactDoctrine · compliance_score reflects partial pass", () => {
  // Fail TWO invariants (boundary_marker + constructive_reading)
  const v = auditArtifactDoctrine({
    uncertain_claims: ["x"],
    boundary_marker: "",
    constructive_reading_applied: false,
  });
  assert.ok(v.compliance_score <= 3);
  assert.equal(v.max_score, 5);
  assert.ok(v.failed_invariants.length >= 2);
});

test("auditArtifactDoctrine · severities classify boundary_marker + constructive_reading as high", () => {
  const v = auditArtifactDoctrine({
    uncertain_claims: ["x"],
  });
  assert.equal(v.severities.boundary_marker, "high");
});

test("auditArtifactDoctrine · truth_label MEASURED on pass · DOCTRINE_VIOLATION on fail", () => {
  const ok = auditArtifactDoctrine({});
  const fail = auditArtifactDoctrine({ uncertain_claims: ["x"] });
  assert.equal(ok.truth_label, "MEASURED");
  assert.equal(fail.truth_label, "DOCTRINE_VIOLATION");
});

test("auditArtifactDoctrine · artifact_schema propagated when provided", () => {
  const v = auditArtifactDoctrine({
    artifact: { schema: "some.schema.v0.1" },
  });
  assert.equal(v.artifact_schema, "some.schema.v0.1");
});

test("Verdict deep-frozen + canonical boundary", () => {
  const v = auditArtifactDoctrine({});
  assert.ok(Object.isFrozen(v));
  assert.ok(Object.isFrozen(v.failed_invariants));
  assert.ok(Object.isFrozen(v.severities));
  assert.ok(isCanonicalBoundary(v.boundary));
});

test("Summary + exports", () => {
  const s = buildSATDoctrineComplianceSummary();
  assert.ok(JSON.stringify(s, null, 2).split("\n").length <= 40);
  assert.ok(Object.isFrozen(SAT_DOCTRINE_COMPLIANCE_PERSONA));
});

test("SAT-3 kernel pre-configured", () => {
  const k = buildSATDoctrineComplianceKernel({ mission_intent: "audit" });
  assert.equal(k.agent_id, "sat-3-doctrine-compliance");
});
