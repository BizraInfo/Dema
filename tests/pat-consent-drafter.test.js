import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildPATConsentDrafterPreview,
  buildPATConsentDrafterSummary,
  buildPATConsentDrafterEffectCap,
  buildPATConsentDrafterKernel,
  draftConsentDecisionCard,
  PAT_CONSENT_DRAFTER_PERSONA,
} from "../packages/core/src/pat-consent-drafter.js";
import { isCanonicalBoundary } from "../packages/core/src/preview-boundary.js";

test("PAT-5 canonical schema · persona pat_number=5", () => {
  const p = buildPATConsentDrafterPreview();
  assert.equal(p.schema, "bizra.dema.pat_consent_drafter.v0.1");
  assert.equal(p.persona.pat_number, 5);
  assert.equal(p.persona.role_name, "consent_drafter");
});

test("PAT-5 boundary canonical · deep frozen", () => {
  const p = buildPATConsentDrafterPreview();
  assert.ok(isCanonicalBoundary(p.boundary));
  assert.ok(Object.isFrozen(p));
});

test("PAT-5 refusals: never approve · never fuzzy-match · never case-insensitive", () => {
  const p = buildPATConsentDrafterPreview();
  assert.ok(
    p.persona.primary_refusals.includes("approve_on_behalf_of_operator"),
  );
  assert.ok(p.persona.primary_refusals.includes("fuzzy_match_consent_phrase"));
  assert.ok(p.persona.primary_refusals.includes("case_insensitive_consent"));
  assert.ok(p.persona.primary_refusals.includes("auto_renew_prior_consent"));
});

test("PAT-5 EffectCap blocks approve-on-behalf · fuzzy-match · case-insensitive · auto-renew", () => {
  const cap = buildPATConsentDrafterEffectCap();
  assert.equal(cap.valid, true);
  assert.ok(cap.blocked_effects.includes("approve_on_behalf_of_operator"));
  assert.ok(cap.blocked_effects.includes("fuzzy_match_consent_phrase"));
  assert.ok(cap.blocked_effects.includes("case_insensitive_consent_check"));
  assert.ok(cap.blocked_effects.includes("auto_renew_prior_consent"));
});

test("PAT-5 kernel pre-configured", () => {
  const k = buildPATConsentDrafterKernel({ mission_intent: "draft consent" });
  assert.equal(k.agent_id, "pat-5-consent-drafter");
});

test("draftConsentDecisionCard valid output · L3 tier for local edit action", () => {
  const card = draftConsentDecisionCard({
    action_summary: "edit packages/core/file.js",
    allowed_effects: ["write_local_file_under_dema_home"],
    blocked_effects: ["push_to_remote"],
    scope_root: "packages/core/",
  });
  assert.equal(card.schema, "bizra.dema.consent_decision_card.v0.1");
  assert.equal(card.valid, true);
  assert.equal(card.highest_risk_tier, "L3");
  assert.match(card.recommended_consent_phrase, /^GO: locally execute/);
});

test("draftConsentDecisionCard L5 tier for irreversible action", () => {
  const card = draftConsentDecisionCard({
    action_summary: "push to remote main",
    allowed_effects: ["push_to_remote", "publish_artifact"],
    blocked_effects: ["force_push"],
    scope_root: "remote/main",
  });
  assert.equal(card.highest_risk_tier, "L5");
  assert.match(card.recommended_consent_phrase, /^GO: irreversibly/);
});

test("draftConsentDecisionCard L4 tier for mint/chain-advance action", () => {
  const card = draftConsentDecisionCard({
    action_summary: "mint a receipt",
    allowed_effects: ["mint_canonical_receipt", "advance_chain"],
    blocked_effects: ["force_push"],
    scope_root: "receipts/",
  });
  assert.equal(card.highest_risk_tier, "L4");
  assert.match(card.recommended_consent_phrase, /^GO: mint-or-advance/);
});

test("draftConsentDecisionCard L2/L0 for preview-only actions", () => {
  const card = draftConsentDecisionCard({
    action_summary: "generate preview",
    allowed_effects: ["draft_preview", "render_terminal_output"],
    blocked_effects: ["execute_runtime"],
    scope_root: "preview",
  });
  assert.ok(card.highest_risk_tier === "L2" || card.highest_risk_tier === "L0");
  assert.match(card.recommended_consent_phrase, /^GO: preview-only/);
});

test("draftConsentDecisionCard requires_exact_match=true · requires_typed_go=true", () => {
  const card = draftConsentDecisionCard({
    action_summary: "test",
    allowed_effects: ["render_terminal_output"],
    blocked_effects: ["execute_runtime"],
  });
  assert.equal(card.requires_exact_match, true);
  assert.equal(card.requires_typed_go, true);
});

test("draftConsentDecisionCard refuses empty action", () => {
  const card = draftConsentDecisionCard({ action_summary: "" });
  assert.equal(card.valid, false);
  assert.match(card.refusal_reason, /empty_action/);
});

test("draftConsentDecisionCard refuses empty blocked_effects", () => {
  const card = draftConsentDecisionCard({
    action_summary: "test",
    allowed_effects: ["render_terminal_output"],
    blocked_effects: [],
  });
  assert.equal(card.valid, false);
  assert.match(card.refusal_reason, /no_blocked_effects/);
});

test("Adversarial · non-string action coerced to empty · refused", () => {
  const card = draftConsentDecisionCard({
    action_summary: { malicious: true },
  });
  assert.equal(card.valid, false);
  assert.equal(card.action_summary, "");
});

test("Adversarial · non-array effects defaults to empty · refused", () => {
  const card = draftConsentDecisionCard({
    action_summary: "test",
    allowed_effects: "not-array",
  });
  assert.equal(card.valid, false);
});

test("Decision card deep-frozen + canonical boundary", () => {
  const card = draftConsentDecisionCard({
    action_summary: "test",
    allowed_effects: ["render_terminal_output"],
    blocked_effects: ["push"],
  });
  assert.ok(Object.isFrozen(card));
  assert.ok(Object.isFrozen(card.allowed_effects_classified));
  assert.ok(isCanonicalBoundary(card.boundary));
});

test("Summary fits within line budget", () => {
  const s = buildPATConsentDrafterSummary();
  const lines = JSON.stringify(s, null, 2).split("\n").length;
  assert.ok(lines <= 40);
});

test("Exports + persona frozen", () => {
  assert.ok(Object.isFrozen(PAT_CONSENT_DRAFTER_PERSONA));
  assert.equal(PAT_CONSENT_DRAFTER_PERSONA.pat_number, 5);
});
