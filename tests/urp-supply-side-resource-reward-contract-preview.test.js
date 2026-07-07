import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateSupplyReward,
  applyUrpSupplyRewardContract,
  planUrpSupplyRewardPreview,
  buildUrpSupplyRewardPreviewPayload,
  verifyUrpSupplyRewardPreview,
  runUrpSupplyRewardPreview,
  REWARD_STATUSES,
  URP_SUPPLY_REWARD_PREVIEW_GO_PHRASE,
  URP_SUPPLY_REWARD_PREVIEW_SCHEMA,
} from "../packages/core/src/urp-supply-side-resource-reward-contract-preview.js";
import { runUrpSupplyRewardPreviewCheck } from "../scripts/review/urp-supply-side-resource-reward-contract-preview-check.mjs";

const VALID = {
  resource_class: "compute",
  offered_capacity: 8,
  consent_scope: "node0:self",
  availability_window: "2026-07-07/2026-07-08",
  measured_uptime: 0.99,
  served_units: 42,
  quality_score: 0.95,
  failure_count: 0,
  policy_violation_count: 0,
};
const ev = (o) => applyUrpSupplyRewardContract(o);

test("verified supply permits a base reward preview without an impact claim", () => {
  const r = ev(VALID);
  assert.equal(r.status, "reward_preview_allowed");
  assert.equal(r.reward_types.verified_supply_reward, true);
  assert.equal(r.reward_types.optional_impact_dividend, false);
  assert.equal(r.mint_allowed, false);
});

test("verified availability and usage each permit their reward preview", () => {
  const r = ev(VALID);
  assert.equal(r.reward_types.verified_availability_reward, true);
  assert.equal(r.reward_types.verified_usage_reward, true);
});

test("impact dividend blocks without verified outcome, clears with it", () => {
  const blocked = ev({ ...VALID, claimed_impact: true });
  assert.equal(blocked.status, "blocked_pending_sat_audit");
  assert.ok(blocked.blocked_by.includes("impact_dividend_without_verified_outcome"));
  assert.equal(blocked.reward_types.optional_impact_dividend, false);
  const cleared = ev({ ...VALID, claimed_impact: true, verified_impact_evidence_refs: ["docs/outcome.md"] });
  assert.equal(cleared.status, "reward_preview_allowed");
  assert.equal(cleared.reward_types.optional_impact_dividend, true);
});

test("cost labeled as impact is rejected", () => {
  const r = ev({ ...VALID, cost_as_impact: true });
  assert.equal(r.status, "rejected_overclaim");
  assert.ok(r.blocked_by.includes("cost_labeled_as_impact"));
});

test("supply reward mislabeled as impact is rejected", () => {
  const r = ev({ ...VALID, supply_reward_label: "impact" });
  assert.equal(r.status, "rejected_overclaim");
  assert.ok(r.blocked_by.includes("supply_reward_mislabeled_impact"));
});

test("missing consent blocks", () => {
  const r = ev({ ...VALID, consent_scope: undefined });
  assert.equal(r.status, "blocked_pending_consent");
});

test("missing measurement blocks", () => {
  assert.equal(ev({ ...VALID, measured_uptime: undefined }).status, "blocked_pending_measurement");
  assert.equal(ev({ ...VALID, served_units: undefined }).status, "blocked_pending_measurement");
});

test("a high-value offer requires a SAT audit ref before it clears", () => {
  const needsAudit = ev({ ...VALID, offered_capacity: 5000 });
  assert.equal(needsAudit.status, "blocked_pending_sat_audit");
  assert.ok(needsAudit.blocked_by.includes("sat_audit_required"));
  assert.equal(ev({ ...VALID, offered_capacity: 5000, sat_audit_ref: "sat-audit-001" }).status, "reward_preview_allowed");
});

test("a policy violation is rejected", () => {
  const r = ev({ ...VALID, policy_violation_count: 1 });
  assert.equal(r.status, "rejected_policy_violation");
});

test("self-mint / live-URP / wallet / federation / authority-increase claims are all rejected", () => {
  for (const [field, code] of [
    ["self_mint", "self_mint_claim"],
    ["live_urp", "live_urp_claim"],
    ["wallet_payment", "wallet_payment_claim"],
    ["federation", "federation_claim"],
  ]) {
    const r = ev({ ...VALID, [field]: true });
    assert.equal(r.status, "rejected_overclaim");
    assert.ok(r.blocked_by.includes(code), `expected ${code}`);
  }
  const authR = ev({ ...VALID, authority_delta: 1 });
  assert.equal(authR.status, "rejected_overclaim");
  assert.ok(authR.blocked_by.includes("authority_increase"));
});

test("the contract never mints, never grants authority, boundary all-false", () => {
  const r = ev(VALID);
  assert.equal(r.mint_allowed, false);
  assert.equal(r.grants_action, false);
  assert.equal(r.authority_delta, 0);
  assert.ok(Object.values(r.boundary).every((v) => v === false));
  assert.equal(r.invariants.cost_measured_is_not_impact, true);
  assert.equal(r.invariants.impact_dividend_requires_verified_outcome, true);
  assert.ok(REWARD_STATUSES.includes(r.status));
});

test("payload is content-addressed and stable; verify rejects a mint_allowed / grants_action / boundary tamper", () => {
  const p1 = buildUrpSupplyRewardPreviewPayload(VALID);
  const p2 = buildUrpSupplyRewardPreviewPayload(VALID);
  assert.equal(p1.content_hash, p2.content_hash);
  assert.match(p1.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(verifyUrpSupplyRewardPreview(p1).ok, true);
  assert.ok(verifyUrpSupplyRewardPreview({ ...p1, mint_allowed: true }).blocked_by.includes("mint_allowed_true"));
  assert.ok(verifyUrpSupplyRewardPreview({ ...p1, grants_action: true }).blocked_by.includes("grants_action_true"));
  assert.ok(verifyUrpSupplyRewardPreview({ ...p1, boundary: {} }).blocked_by.includes("boundary_not_all_false"));
  assert.equal(verifyUrpSupplyRewardPreview(null).ok, false);
});

test("Node0 genesis resource offer passes as preview-only", () => {
  const r = ev({ resource_class: "compute", offered_capacity: 16, consent_scope: "node0:genesis", measured_uptime: 1.0, served_units: 100, quality_score: 1.0, failure_count: 0, policy_violation_count: 0 });
  assert.equal(r.status, "reward_preview_allowed");
  assert.equal(r.mint_allowed, false);
  assert.equal(r.reward_types.optional_impact_dividend, false);
});

test("public node resource offer passes as preview-only", () => {
  const r = ev({ resource_class: "storage", offered_capacity: 500, consent_scope: "public:node-42", measured_uptime: 0.98, served_units: 300, quality_score: 0.9, failure_count: 1, policy_violation_count: 0 });
  assert.equal(r.status, "reward_preview_allowed");
  assert.equal(r.mint_allowed, false);
});

test("plan is fail-closed on consent and a malformed offer", () => {
  assert.ok(planUrpSupplyRewardPreview({ consent: "no", input: VALID }).blocked_by.includes("consent_phrase_mismatch"));
  assert.ok(planUrpSupplyRewardPreview({ consent: URP_SUPPLY_REWARD_PREVIEW_GO_PHRASE, input: {} }).blocked_by.includes("missing_resource_class"));
});

test("review gate closes the loop → reward_preview_allowed, mint_allowed false; orchestrator fail-closed", () => {
  const r = runUrpSupplyRewardPreviewCheck();
  assert.equal(r.ok, true, r.blocked_by?.join(", "));
  assert.equal(r.reward_status, "reward_preview_allowed");
  assert.equal(r.mint_allowed, false);
  assert.equal(r.schema, URP_SUPPLY_REWARD_PREVIEW_SCHEMA);
  const blocked = runUrpSupplyRewardPreview({ consent: "wrong", input: VALID });
  assert.equal(blocked.ok, false);
  assert.ok(blocked.blocked_by.includes("consent_phrase_mismatch"));
});

test("an invalid resource class blocks pending measurement", () => {
  assert.equal(evaluateSupplyReward({ ...VALID, resource_class: "nonsense" }).status, "blocked_pending_measurement");
});
