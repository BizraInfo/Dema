import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildSATIdentityVerifierPreview,
  buildSATIdentityVerifierEffectCap,
  buildSATIdentityVerifierKernel,
  buildSATIdentityVerifierSummary,
  verifyIdentity,
  SAT_IDENTITY_VERIFIER_PERSONA,
  SAT_IDENTITY_VERIFIER_REQUIRED_FIELDS
} from "../packages/core/src/sat-identity-verifier.js";
import { isCanonicalBoundary } from "../packages/core/src/preview-boundary.js";

test("SAT-5 canonical schema · sat_number=5", () => {
  const p = buildSATIdentityVerifierPreview();
  assert.equal(p.schema, "bizra.dema.sat_identity_verifier.v0.1");
  assert.equal(p.persona.sat_number, 5);
  assert.equal(p.persona.role_name, "identity_verifier");
});

test("SAT-5 boundary canonical · refusals never-modify never-infer-from-absent", () => {
  const p = buildSATIdentityVerifierPreview();
  assert.ok(isCanonicalBoundary(p.boundary));
  assert.ok(p.persona.primary_refusals.includes("modify_profile"));
  assert.ok(p.persona.primary_refusals.includes("infer_identity_from_absent_profile"));
  assert.ok(p.persona.primary_refusals.includes("waive_identity_check"));
});

test("SAT-5 EffectCap valid + blocks modify-profile", () => {
  const cap = buildSATIdentityVerifierEffectCap();
  assert.equal(cap.valid, true);
  assert.ok(cap.blocked_effects.includes("modify_profile"));
  assert.ok(cap.blocked_effects.includes("waive_identity_check"));
});

test("SAT-5 declares 2 required profile fields (name · node)", () => {
  assert.equal(SAT_IDENTITY_VERIFIER_REQUIRED_FIELDS.length, 2);
  assert.ok(SAT_IDENTITY_VERIFIER_REQUIRED_FIELDS.includes("name"));
  assert.ok(SAT_IDENTITY_VERIFIER_REQUIRED_FIELDS.includes("node"));
});

test("verifyIdentity · null profile → profile_absent", () => {
  const v = verifyIdentity({ profile: null });
  assert.equal(v.verdict, "profile_absent");
  assert.equal(v.passed, false);
  assert.ok(v.violations.includes("profile_missing_or_invalid"));
});

test("verifyIdentity · valid profile no snapshot → identity_verified", () => {
  const v = verifyIdentity({
    profile: { name: "Mumu", node: "Node0" }
  });
  assert.equal(v.verdict, "identity_verified");
  assert.equal(v.passed, true);
  assert.equal(v.profile_name, "Mumu");
  assert.equal(v.profile_node, "Node0");
});

test("verifyIdentity · missing required field → identity_violation", () => {
  const v = verifyIdentity({
    profile: { name: "Mumu" } // missing node
  });
  assert.equal(v.passed, false);
  assert.ok(v.violations.some((vio) => vio.includes("missing_or_empty_field") && vio.includes("node")));
});

test("verifyIdentity · empty required field → identity_violation", () => {
  const v = verifyIdentity({
    profile: { name: "Mumu", node: "" }
  });
  assert.equal(v.passed, false);
});

test("verifyIdentity · continuity check with matching snapshot → continuity_held=true", () => {
  const v = verifyIdentity({
    profile: { name: "Mumu", node: "Node0" },
    previous_snapshot: { name: "Mumu", node: "Node0" }
  });
  assert.equal(v.passed, true);
  assert.equal(v.continuity_check.continuity_held, true);
  assert.equal(v.continuity_check.drifted_fields.length, 0);
});

test("verifyIdentity · continuity drift detected → identity_violation with named fields", () => {
  const v = verifyIdentity({
    profile: { name: "Different", node: "Node0" },
    previous_snapshot: { name: "Mumu", node: "Node0" }
  });
  assert.equal(v.passed, false);
  assert.equal(v.continuity_check.continuity_held, false);
  assert.deepEqual([...v.continuity_check.drifted_fields], ["name"]);
  assert.ok(v.violations.some((vio) => vio.includes("silent_identity_drift")));
});

test("verifyIdentity · no snapshot → continuity_held=null (not asked)", () => {
  const v = verifyIdentity({
    profile: { name: "Mumu", node: "Node0" }
  });
  assert.equal(v.continuity_check.previous_snapshot_present, false);
  assert.equal(v.continuity_check.continuity_held, null);
});

test("Verdict truth_label MEASURED on pass · IDENTITY_VIOLATION on fail", () => {
  const ok = verifyIdentity({ profile: { name: "x", node: "Node0" } });
  const fail = verifyIdentity({ profile: null });
  assert.equal(ok.truth_label, "MEASURED");
  assert.equal(fail.truth_label, "IDENTITY_VIOLATION");
});

test("Verdict deep-frozen + canonical boundary", () => {
  const v = verifyIdentity({ profile: { name: "x", node: "Node0" } });
  assert.ok(Object.isFrozen(v));
  assert.ok(Object.isFrozen(v.violations));
  assert.ok(isCanonicalBoundary(v.boundary));
});

test("Summary + kernel · all canonical", () => {
  const s = buildSATIdentityVerifierSummary();
  const k = buildSATIdentityVerifierKernel();
  assert.equal(k.agent_id, "sat-5-identity-verifier");
  assert.ok(JSON.stringify(s, null, 2).split("\n").length <= 40);
  assert.ok(Object.isFrozen(SAT_IDENTITY_VERIFIER_PERSONA));
});
