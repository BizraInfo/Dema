import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildConsentCardPreview,
  CONSENT_CARD_REQUIRED_BLOCKED_EFFECTS,
  CONSENT_CARD_DECISION_OPTIONS
} from "../packages/core/src/consent-card-preview.js";

const REQUIRED_BOUNDARY_FALSE_KEYS = [
  "filesystem_write_performed",
  "network_used",
  "runtime_execution_performed",
  "model_loaded",
  "model_invocation_performed",
  "prompt_executed",
  "external_call_performed",
  "raw_corpus_scan_performed",
  "raw_data_included",
  "tool_executed",
  "chain_advance_performed",
  "receipt_mint_performed",
  "federation_invoked",
  "node_connection_performed",
  "public_network_used",
  "consent_collected"
];

function assertExhaustiveFalseBoundary(boundary) {
  for (const key of REQUIRED_BOUNDARY_FALSE_KEYS) {
    assert.equal(boundary[key], false, `boundary.${key} must be false`);
  }
}

test("ConsentCard emits canonical schema + truth label + preview-only mode", () => {
  const card = buildConsentCardPreview();
  assert.equal(card.schema, "bizra.dema.consent_card_preview.v0.1");
  assert.equal(card.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(card.mode, "preview_only");
  assert.equal(card.mission_center, "user_mission");
  assert.equal(card.canonical_mint, false);
  assert.equal(card.human_consent_required, true);
});

test("ConsentCard default allowed_effects is ['draft_preview']", () => {
  const card = buildConsentCardPreview();
  assert.deepEqual([...card.allowed_effects], ["draft_preview"]);
});

test("ConsentCard required blocked_effects always present, even with empty additional", () => {
  const card = buildConsentCardPreview({ additionalBlockedEffects: [] });
  for (const effect of CONSENT_CARD_REQUIRED_BLOCKED_EFFECTS) {
    assert.ok(
      card.blocked_effects.includes(effect),
      `blocked_effects must contain required ${effect}`
    );
  }
});

test("ConsentCard merges additional blocked_effects without losing required ones", () => {
  const card = buildConsentCardPreview({
    additionalBlockedEffects: ["custom_extra_block", "another_block"]
  });
  for (const effect of CONSENT_CARD_REQUIRED_BLOCKED_EFFECTS) {
    assert.ok(card.blocked_effects.includes(effect));
  }
  assert.ok(card.blocked_effects.includes("custom_extra_block"));
  assert.ok(card.blocked_effects.includes("another_block"));
});

test("ConsentCard ADVERSARIAL: caller cannot smuggle runtime_execution into allowed_effects", () => {
  const card = buildConsentCardPreview({
    allowedEffects: ["draft_preview", "runtime_execution", "canonical_minting", "federation_invocation"]
  });
  assert.ok(card.allowed_effects.includes("draft_preview"));
  assert.equal(card.allowed_effects.includes("runtime_execution"), false,
    "runtime_execution MUST be filtered out of allowed_effects");
  assert.equal(card.allowed_effects.includes("canonical_minting"), false);
  assert.equal(card.allowed_effects.includes("federation_invocation"), false);
});

test("ConsentCard ADVERSARIAL: empty allowedEffects falls back to draft_preview", () => {
  const card1 = buildConsentCardPreview({ allowedEffects: [] });
  assert.deepEqual([...card1.allowed_effects], ["draft_preview"]);
  const card2 = buildConsentCardPreview({ allowedEffects: ["runtime_execution"] }); // only-blocked
  assert.deepEqual([...card2.allowed_effects], ["draft_preview"]);
});

test("ConsentCard ADVERSARIAL: allowedEffects accepting non-array silently defaults", () => {
  const card = buildConsentCardPreview({ allowedEffects: "draft_preview" });
  assert.deepEqual([...card.allowed_effects], ["draft_preview"]);
});

test("ConsentCard ADVERSARIAL: non-string items in allowedEffects are filtered", () => {
  const card = buildConsentCardPreview({
    allowedEffects: ["draft_preview", 42, null, undefined, { hack: true }, "another_safe"]
  });
  assert.deepEqual([...card.allowed_effects], ["draft_preview", "another_safe"]);
});

test("ConsentCard ADVERSARIAL: duplicates in allowedEffects deduplicated", () => {
  const card = buildConsentCardPreview({
    allowedEffects: ["draft_preview", "draft_preview", "draft_preview"]
  });
  assert.deepEqual([...card.allowed_effects], ["draft_preview"]);
});

test("ConsentCard SAT verdict defaults to status=policy_preview", () => {
  const card = buildConsentCardPreview();
  assert.equal(card.sat_verdict.status, "policy_preview");
  assert.match(card.sat_verdict.authority, /policy_preview_until_shared_urp/);
});

test("ConsentCard SAT verdict status always policy_preview, even if caller injects PERMIT", () => {
  const card = buildConsentCardPreview({
    satVerdict: { status: "PERMIT", reason: "trying to escalate" }
  });
  assert.equal(card.sat_verdict.status, "policy_preview",
    "SAT verdict status MUST be pinned to policy_preview in preview-only card");
});

test("ConsentCard mission view is selective (no raw intent body)", () => {
  const card = buildConsentCardPreview({
    mission: {
      missionId: "m-001",
      status: "draft_preview",
      center: "user_mission",
      intent: "SENSITIVE_INTENT_BODY_THAT_SHOULD_NOT_LEAK",
      raw_payload: "EVEN_RAWER_SHOULD_NOT_LEAK"
    }
  });
  assert.equal(card.mission.missionId, "m-001");
  assert.equal(card.mission.center, "user_mission");
  assert.equal("intent" in card.mission, false, "card.mission must not carry raw intent");
  assert.equal("raw_payload" in card.mission, false, "card.mission must not carry raw payload");
});

test("ConsentCard PAT proposal: string proposal is truncated at 240 chars", () => {
  const longSummary = "x".repeat(500);
  const card = buildConsentCardPreview({ patProposal: longSummary });
  assert.equal(card.pat_proposal.provided, true);
  assert.ok(card.pat_proposal.summary.length <= 240);
  assert.ok(card.pat_proposal.summary.endsWith("..."));
});

test("ConsentCard PAT proposal: object proposal exposes step_count and summary only", () => {
  const card = buildConsentCardPreview({
    patProposal: {
      summary: "short summary",
      steps: ["a", "b", "c"],
      raw_internal_state: "SHOULD_NOT_LEAK",
      reasoning: "ALSO_NOT_LEAK"
    }
  });
  assert.equal(card.pat_proposal.summary, "short summary");
  assert.equal(card.pat_proposal.step_count, 3);
  assert.equal("raw_internal_state" in card.pat_proposal, false);
  assert.equal("reasoning" in card.pat_proposal, false);
  assert.equal("steps" in card.pat_proposal, false);
});

test("ConsentCard PAT proposal: null/undefined yield provided=false", () => {
  const card1 = buildConsentCardPreview({ patProposal: null });
  assert.equal(card1.pat_proposal.provided, false);
  const card2 = buildConsentCardPreview({ patProposal: undefined });
  assert.equal(card2.pat_proposal.provided, false);
});

test("ConsentCard required_consent is exact-string per ADR-005", () => {
  const card = buildConsentCardPreview();
  assert.equal(card.required_consent.required, true);
  assert.equal(card.required_consent.phrase, null, "phrase is not minted in preview");
  assert.equal(card.required_consent.match_rule, "exact_string");
});

test("ConsentCard receipt_preview is not_minted", () => {
  const card = buildConsentCardPreview();
  assert.equal(card.receipt_preview.status, "not_minted");
  assert.equal(card.receipt_preview.schema, null);
});

test("ConsentCard decision_options exact list", () => {
  const card = buildConsentCardPreview();
  assert.deepEqual([...card.decision_options], [
    "approve_c2_draft_only",
    "narrow_scope",
    "decline"
  ]);
  assert.equal(CONSENT_CARD_DECISION_OPTIONS.length, 3);
});

test("ConsentCard boundary is exhaustively false and frozen", () => {
  const card = buildConsentCardPreview();
  assertExhaustiveFalseBoundary(card.boundary);
  assert.equal(Object.isFrozen(card.boundary), true);
});

test("ConsentCard is deeply frozen (top + all sub-views)", () => {
  const card = buildConsentCardPreview({
    mission: { missionId: "m-001" },
    patProposal: { summary: "test", steps: [1, 2] },
    satVerdict: { reason: "test reason" },
    additionalBlockedEffects: ["extra"]
  });
  assert.equal(Object.isFrozen(card), true);
  assert.equal(Object.isFrozen(card.mission), true);
  assert.equal(Object.isFrozen(card.pat_proposal), true);
  assert.equal(Object.isFrozen(card.sat_verdict), true);
  assert.equal(Object.isFrozen(card.allowed_effects), true);
  assert.equal(Object.isFrozen(card.blocked_effects), true);
  assert.equal(Object.isFrozen(card.required_consent), true);
  assert.equal(Object.isFrozen(card.receipt_preview), true);
  assert.equal(Object.isFrozen(card.decision_options), true);
});

test("ConsentCard canonical_mint and federation are PINNED FALSE regardless of caller", () => {
  // Caller cannot inject these as truthy via any input path
  const card = buildConsentCardPreview({
    mission: { missionId: "m", canonical_mint: true, federation: true },
    patProposal: { summary: "x", canonical_mint: true },
    satVerdict: { status: "PERMIT", canonical_mint: true, federation: true }
  });
  assert.equal(card.canonical_mint, false);
  assert.equal(card.boundary.receipt_mint_performed, false);
  assert.equal(card.boundary.federation_invoked, false);
});
