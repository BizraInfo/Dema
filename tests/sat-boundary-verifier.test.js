import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildSATBoundaryVerifierPreview,
  buildSATBoundaryVerifierSummary,
  buildSATBoundaryVerifierEffectCap,
  verifyArtifactBoundary,
  SAT_BOUNDARY_VERIFIER_PERSONA,
} from "../packages/core/src/sat-boundary-verifier.js";
import {
  isCanonicalBoundary,
  buildPreviewBoundary,
  PREVIEW_BOUNDARY_CANONICAL_KEYS,
} from "../packages/core/src/preview-boundary.js";
import { buildNode0StatePreview } from "../packages/core/src/state.js";

test("SAT-1 canonical schema · persona sat_number=1", () => {
  const p = buildSATBoundaryVerifierPreview();
  assert.equal(p.schema, "bizra.dema.sat_boundary_verifier.v0.1");
  assert.equal(p.persona.sat_number, 1);
  assert.equal(p.persona.role_name, "boundary_verifier");
});

test("SAT-1 boundary canonical + deep frozen", () => {
  const p = buildSATBoundaryVerifierPreview();
  assert.ok(isCanonicalBoundary(p.boundary));
  assert.ok(Object.isFrozen(p));
});

test("SAT-1 refusals: never modify · never waive · never approve non-canonical", () => {
  const p = buildSATBoundaryVerifierPreview();
  assert.ok(p.persona.primary_refusals.includes("modify_verified_artifact"));
  assert.ok(p.persona.primary_refusals.includes("waive_boundary_requirement"));
  assert.ok(
    p.persona.primary_refusals.includes("approve_non_canonical_output"),
  );
});

test("SAT-1 EffectCap valid + blocks modify/waive/approve", () => {
  const cap = buildSATBoundaryVerifierEffectCap();
  assert.equal(cap.valid, true);
  assert.ok(cap.blocked_effects.includes("modify_verified_artifact"));
  assert.ok(cap.blocked_effects.includes("waive_boundary_requirement"));
});

test("SAT-1 declares all expected boundary keys", () => {
  const p = buildSATBoundaryVerifierPreview();
  assert.equal(
    p.expected_boundary_key_count,
    PREVIEW_BOUNDARY_CANONICAL_KEYS.length,
  );
  assert.ok(p.expected_boundary_keys.includes("filesystem_write_performed"));
  assert.ok(p.expected_boundary_keys.includes("model_invocation_performed"));
  assert.ok(p.expected_boundary_keys.includes("content_read"));
});

test("verifyArtifactBoundary · canonical artifact (from real builder) → verified", () => {
  const state = buildNode0StatePreview();
  const v = verifyArtifactBoundary({ artifact: state });
  assert.equal(v.schema, "bizra.dema.boundary_verification_verdict.v0.1");
  assert.equal(v.verdict, "verified");
  assert.equal(v.passed, true);
  assert.equal(v.shape_check_passed, true);
  assert.equal(v.frozen_check_passed, true);
});

test("verifyArtifactBoundary · missing artifact → structurally_invalid", () => {
  const v = verifyArtifactBoundary({ artifact: null });
  assert.equal(v.verdict, "structurally_invalid");
  assert.equal(v.passed, false);
  assert.ok(v.violations.includes("artifact_not_an_object"));
});

test("verifyArtifactBoundary · missing boundary field → structurally_invalid", () => {
  const v = verifyArtifactBoundary({
    artifact: { schema: "x.v0.1", data: "nope" },
  });
  assert.equal(v.verdict, "structurally_invalid");
  assert.ok(v.violations.includes("missing_boundary_field"));
});

test("verifyArtifactBoundary · boundary with truthy key → violated · names specific key", () => {
  const corrupted = {
    schema: "x.v0.1",
    boundary: { ...buildPreviewBoundary(), runtime_execution_performed: true },
  };
  // Note: spread breaks the freeze · so frozen_check_passed will be false too
  const v = verifyArtifactBoundary({ artifact: corrupted });
  assert.equal(v.verdict, "violated");
  assert.equal(v.passed, false);
  assert.ok(v.violations.some((vio) => vio.includes("truthy_keys")));
  assert.ok(
    v.violations.some((vio) => vio.includes("runtime_execution_performed")),
  );
});

test("verifyArtifactBoundary · missing keys → violated · names them", () => {
  const partial = {
    schema: "x.v0.1",
    boundary: { filesystem_write_performed: false }, // only 1 of 16
  };
  const v = verifyArtifactBoundary({ artifact: partial });
  assert.equal(v.verdict, "violated");
  assert.ok(v.violations.some((vio) => vio.includes("missing_keys")));
});

test("verifyArtifactBoundary · extra unknown keys → violated · names them", () => {
  const withExtra = {
    schema: "x.v0.1",
    boundary: { ...buildPreviewBoundary(), evil_extra_key: false },
  };
  const v = verifyArtifactBoundary({ artifact: withExtra });
  assert.equal(v.verdict, "violated");
  assert.ok(
    v.violations.some(
      (vio) => vio.includes("extra_keys") && vio.includes("evil_extra_key"),
    ),
  );
});

test("verifyArtifactBoundary · shape OK but not frozen → verified_shape_only", () => {
  // Use a non-frozen object that has correct shape (JSON-roundtrip simulation)
  const jsonRoundtrip = JSON.parse(
    JSON.stringify({
      schema: "x.v0.1",
      boundary: buildPreviewBoundary(),
    }),
  );
  const v = verifyArtifactBoundary({ artifact: jsonRoundtrip });
  assert.equal(v.verdict, "verified_shape_only");
  assert.equal(v.passed, true);
  assert.equal(v.shape_check_passed, true);
  assert.equal(v.frozen_check_passed, false);
});

test("verifyArtifactBoundary · returns frozen verdict envelope", () => {
  const v = verifyArtifactBoundary({ artifact: buildNode0StatePreview() });
  assert.ok(Object.isFrozen(v));
  assert.ok(Object.isFrozen(v.violations));
  assert.ok(isCanonicalBoundary(v.boundary));
});

test("verifyArtifactBoundary · truth_label MEASURED on pass · VERIFICATION_FAILED on fail", () => {
  const ok = verifyArtifactBoundary({ artifact: buildNode0StatePreview() });
  const fail = verifyArtifactBoundary({ artifact: null });
  assert.equal(ok.truth_label, "MEASURED");
  assert.equal(fail.truth_label, "VERIFICATION_FAILED");
});

test("Summary + exports", () => {
  const s = buildSATBoundaryVerifierSummary();
  assert.equal(s.schema, "bizra.dema.sat_boundary_verifier_summary.v0.1");
  assert.equal(s.sat_number, 1);
  assert.ok(JSON.stringify(s, null, 2).split("\n").length <= 40);
  assert.ok(Object.isFrozen(SAT_BOUNDARY_VERIFIER_PERSONA));
});
