import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildSATConsentAuditorPreview,
  buildSATConsentAuditorEffectCap,
  buildSATConsentAuditorSummary,
  auditAction,
  SAT_CONSENT_AUDITOR_PERSONA,
  SAT_CONSENT_AUDITOR_RISK_TIER_THRESHOLDS,
} from "../packages/core/src/sat-consent-auditor.js";
import { isCanonicalBoundary } from "../packages/core/src/preview-boundary.js";

test("SAT-2 canonical schema + persona sat_number=2", () => {
  const p = buildSATConsentAuditorPreview();
  assert.equal(p.schema, "bizra.dema.sat_consent_auditor.v0.1");
  assert.equal(p.persona.sat_number, 2);
  assert.equal(p.persona.role_name, "consent_auditor");
});

test("SAT-2 boundary canonical + deep frozen", () => {
  const p = buildSATConsentAuditorPreview();
  assert.ok(isCanonicalBoundary(p.boundary));
  assert.ok(Object.isFrozen(p));
});

test("SAT-2 refusals: never fuzzy · never case-insensitive · never waive audit", () => {
  const p = buildSATConsentAuditorPreview();
  assert.ok(p.persona.primary_refusals.includes("accept_fuzzy_consent"));
  assert.ok(
    p.persona.primary_refusals.includes("accept_case_insensitive_consent"),
  );
  assert.ok(
    p.persona.primary_refusals.includes("waive_audit_trail_requirement"),
  );
});

test("SAT-2 EffectCap blocks fuzzy/waive/approve-without-consent", () => {
  const cap = buildSATConsentAuditorEffectCap();
  assert.equal(cap.valid, true);
  assert.ok(cap.blocked_effects.includes("accept_fuzzy_consent"));
  assert.ok(cap.blocked_effects.includes("waive_audit_trail"));
  assert.ok(cap.blocked_effects.includes("approve_without_consent"));
});

test("Risk tier thresholds: L3+ require consent + audit trail", () => {
  const t = SAT_CONSENT_AUDITOR_RISK_TIER_THRESHOLDS;
  assert.equal(t.L0.requires_consent, false);
  assert.equal(t.L1.requires_consent, false);
  assert.equal(t.L2.requires_consent, false);
  assert.equal(t.L3.requires_consent, true);
  assert.equal(t.L4.requires_consent, true);
  assert.equal(t.L5.requires_consent, true);
});

test("auditAction · L3 with exact consent + audit trail → audited_ok", () => {
  const v = auditAction({
    action: {
      action_name: "edit_local_file",
      risk_tier: "L3",
      consent_phrase_required: "GO: edit foo.js",
      consent_phrase_provided: "GO: edit foo.js",
      audit_trail: { event_id: "abc", timestamp: "2026-05-18T00:00:00Z" },
    },
  });
  assert.equal(v.schema, "bizra.dema.consent_audit_verdict.v0.1");
  assert.equal(v.verdict, "audited_ok");
  assert.equal(v.passed, true);
  assert.deepEqual([...v.violations], []);
});

test("auditAction · L3 with MISMATCHED consent → audit_failed · names mismatch", () => {
  const v = auditAction({
    action: {
      action_name: "edit",
      risk_tier: "L3",
      consent_phrase_required: "GO: edit foo.js",
      consent_phrase_provided: "GO: edit foo", // missing .js
      audit_trail: { event_id: "x" },
    },
  });
  assert.equal(v.verdict, "audit_failed");
  assert.equal(v.passed, false);
  assert.ok(
    v.violations.some((vio) => vio.includes("consent_phrase_mismatch")),
  );
});

test("auditAction · L4 missing audit trail → audit_failed", () => {
  const v = auditAction({
    action: {
      action_name: "mint",
      risk_tier: "L4",
      consent_phrase_required: "GO: mint",
      consent_phrase_provided: "GO: mint",
      // no audit_trail
    },
  });
  assert.equal(v.verdict, "audit_failed");
  assert.ok(v.violations.includes("audit_trail_missing_or_invalid"));
});

test("auditAction · L0 needs neither consent nor audit", () => {
  const v = auditAction({
    action: {
      action_name: "read_file",
      risk_tier: "L0",
      // no consent · no audit · L0 doesn't need them
    },
  });
  assert.equal(v.verdict, "audited_ok");
  assert.equal(v.passed, true);
});

test("auditAction · L1/L2 needs audit trail but not consent", () => {
  const v1 = auditAction({
    action: {
      action_name: "write_today",
      risk_tier: "L1",
      audit_trail: { event_id: "x" },
    },
  });
  const v2 = auditAction({
    action: {
      action_name: "propose",
      risk_tier: "L2",
      audit_trail: { event_id: "y" },
    },
  });
  assert.equal(v1.passed, true);
  assert.equal(v2.passed, true);
});

test("auditAction · unknown risk_tier → structurally_invalid", () => {
  const v = auditAction({
    action: {
      action_name: "test",
      risk_tier: "L9_MADE_UP",
    },
  });
  assert.equal(v.verdict, "structurally_invalid");
  assert.ok(v.violations.some((vio) => vio.includes("unknown_risk_tier")));
});

test("auditAction · null action → structurally_invalid", () => {
  const v = auditAction({ action: null });
  assert.equal(v.verdict, "structurally_invalid");
  assert.ok(v.violations.includes("action_not_an_object"));
});

test("auditAction · L3 with empty consent_phrase_required → flagged", () => {
  const v = auditAction({
    action: {
      action_name: "test",
      risk_tier: "L3",
      consent_phrase_required: "",
      consent_phrase_provided: "anything",
      audit_trail: { x: 1 },
    },
  });
  assert.equal(v.passed, false);
  assert.ok(
    v.violations.includes("required_consent_phrase_missing_from_action"),
  );
});

test("Verdict deep-frozen + canonical boundary", () => {
  const v = auditAction({ action: { action_name: "x", risk_tier: "L0" } });
  assert.ok(Object.isFrozen(v));
  assert.ok(Object.isFrozen(v.violations));
  assert.ok(isCanonicalBoundary(v.boundary));
});

test("truth_label MEASURED on pass · AUDIT_FAILED on fail", () => {
  const ok = auditAction({ action: { action_name: "x", risk_tier: "L0" } });
  const fail = auditAction({ action: null });
  assert.equal(ok.truth_label, "MEASURED");
  assert.equal(fail.truth_label, "AUDIT_FAILED");
});

test("Summary + exports", () => {
  const s = buildSATConsentAuditorSummary();
  assert.ok(JSON.stringify(s, null, 2).split("\n").length <= 40);
  assert.ok(Object.isFrozen(SAT_CONSENT_AUDITOR_PERSONA));
});
