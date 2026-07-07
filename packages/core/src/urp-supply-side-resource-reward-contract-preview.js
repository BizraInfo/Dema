// URP-SUPPLY-SIDE-RESOURCE-REWARD-CONTRACT-PREVIEW-1A — the public-market law, encoded as a PREVIEW.
//
// Market law (PREVIEW_ONLY / DESIGNED_NOT_LIVE):
//   A resource provider earns base value from VERIFIED supply, availability, and service.
//   The provider is NOT responsible for proving humanitarian impact.
//   URP allocates; SAT audits allocation, usage, reward, and any claimed impact.
//   The impact dividend is EXTRA and requires a verified outcome — it is not the provider's base burden.
//
// This kernel computes which reward types an offer is ELIGIBLE for as a preview — it mints nothing,
// settles nothing, pays no one, moves no wallet, activates no live URP, federates nothing, invokes no
// model, and touches no network. Cost measured is not impact; supply reward is not an impact claim.
// Boundary all-false · authority_delta 0 · grants_action false · mint_allowed false.

import { createHash } from "node:crypto";

export const URP_SUPPLY_REWARD_PREVIEW_SCHEMA = "bizra.urp.supply_side_resource_reward_contract_preview.v0.1";
export const URP_SUPPLY_REWARD_PREVIEW_TRUTH_LABEL = "URP_SUPPLY_REWARD_CONTRACT_PREVIEW_ONLY";
export const URP_SUPPLY_REWARD_PREVIEW_GO_PHRASE = "GO: urp supply side resource reward contract preview";

export const RESOURCE_CLASSES = Object.freeze([
  "compute", "memory", "storage", "model", "tool", "data", "artifact", "human_attention",
]);

export const REWARD_STATUSES = Object.freeze([
  "reward_preview_allowed",
  "blocked_pending_measurement",
  "blocked_pending_consent",
  "blocked_pending_sat_audit",
  "rejected_overclaim",
  "rejected_policy_violation",
]);

// Abstract preview threshold: above it, a reward preview needs a SAT audit reference before it clears.
const HIGH_VALUE_CAPACITY = 1000;

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function urpSupplyRewardPreviewBoundary() {
  return Object.freeze({
    execution_allowed: false,
    daemon_started: false,
    network_used: false,
    token_minted: false,
    wallet_accessed: false,
    live_execution_performed: false,
    file_mutation_performed: false,
    model_invocation_performed: false,
  });
}

// Evaluate one resource offer into a reward-eligibility PREVIEW.
export function evaluateSupplyReward(offer) {
  const o = offer && typeof offer === "object" ? offer : {};
  const rejected_by = [];
  const blocked_by = [];

  const consent = typeof o.consent_scope === "string" && o.consent_scope.length > 0;
  const validClass = RESOURCE_CLASSES.includes(o.resource_class);
  const capacity = typeof o.offered_capacity === "number" ? o.offered_capacity : null;
  const uptime = typeof o.measured_uptime === "number" ? o.measured_uptime : null;
  const served = typeof o.served_units === "number" ? o.served_units : null;
  const violations = typeof o.policy_violation_count === "number" ? o.policy_violation_count : 0;
  const satAuditRef = typeof o.sat_audit_ref === "string" && o.sat_audit_ref.length > 0;
  const impactClaimed =
    o.claimed_impact === true ||
    (typeof o.claimed_impact === "number" && o.claimed_impact > 0) ||
    (typeof o.claimed_impact === "string" && o.claimed_impact.trim().length > 0);
  const impactVerified = Array.isArray(o.verified_impact_evidence_refs) && o.verified_impact_evidence_refs.length > 0;

  // Hard rejections — the offer overclaims or violates policy.
  if (violations > 0) rejected_by.push("policy_violation");
  if (o.self_mint === true) rejected_by.push("self_mint_claim");
  if (o.live_urp === true) rejected_by.push("live_urp_claim");
  if (o.wallet_payment === true) rejected_by.push("wallet_payment_claim");
  if (o.federation === true) rejected_by.push("federation_claim");
  if (typeof o.authority_delta === "number" && o.authority_delta > 0) rejected_by.push("authority_increase");
  if (o.cost_as_impact === true) rejected_by.push("cost_labeled_as_impact");
  if (o.supply_reward_label === "impact") rejected_by.push("supply_reward_mislabeled_impact");

  // Blocks — something must be measured / consented / audited first.
  if (!consent) blocked_by.push("missing_consent");
  if (!validClass) blocked_by.push("missing_or_invalid_resource_class");
  if (capacity == null || uptime == null || served == null) blocked_by.push("missing_measurement");
  if (capacity != null && capacity >= HIGH_VALUE_CAPACITY && !satAuditRef) blocked_by.push("sat_audit_required");
  if (impactClaimed && !impactVerified) blocked_by.push("impact_dividend_without_verified_outcome");

  // Status precedence.
  let status;
  if (rejected_by.includes("policy_violation")) status = "rejected_policy_violation";
  else if (rejected_by.length > 0) status = "rejected_overclaim";
  else if (blocked_by.includes("missing_consent")) status = "blocked_pending_consent";
  else if (blocked_by.includes("missing_measurement") || blocked_by.includes("missing_or_invalid_resource_class")) {
    status = "blocked_pending_measurement";
  } else if (blocked_by.includes("sat_audit_required") || blocked_by.includes("impact_dividend_without_verified_outcome")) {
    status = "blocked_pending_sat_audit";
  } else status = "reward_preview_allowed";

  const allowed = status === "reward_preview_allowed";

  return Object.freeze({
    resource_class: validClass ? o.resource_class : null,
    // Reward TYPES the offer is eligible for as a preview — not amounts, not payouts, not mints.
    reward_types: Object.freeze({
      verified_supply_reward: allowed && capacity != null,
      verified_availability_reward: allowed && uptime != null,
      verified_usage_reward: allowed && served != null,
      optional_impact_dividend: allowed && impactVerified, // extra, only with a verified outcome
    }),
    status,
    rejected_by: Object.freeze(rejected_by),
    blocked_by: Object.freeze([...rejected_by, ...blocked_by]),
  });
}

const INVARIANTS = Object.freeze({
  cost_measured_is_not_impact: true,
  supply_reward_is_not_impact_claim: true,
  impact_dividend_requires_verified_outcome: true,
  no_self_mint: true,
  no_live_urp: true,
  no_wallet: true,
  no_federation: true,
  no_authority_increase: true,
});

export function applyUrpSupplyRewardContract(input) {
  const evaluation = evaluateSupplyReward(input);
  return Object.freeze({
    schema: URP_SUPPLY_REWARD_PREVIEW_SCHEMA,
    truth_label: URP_SUPPLY_REWARD_PREVIEW_TRUTH_LABEL,
    ...evaluation,
    invariants: INVARIANTS,
    grants_action: false,
    authority_delta: 0,
    mint_allowed: false,
    boundary: urpSupplyRewardPreviewBoundary(),
  });
}

function offerBlocks(input) {
  const b = [];
  if (!input || typeof input !== "object") {
    b.push("input_not_object");
    return b;
  }
  if (!("resource_class" in input)) b.push("missing_resource_class");
  return b;
}

export function planUrpSupplyRewardPreview({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== URP_SUPPLY_REWARD_PREVIEW_GO_PHRASE) blocked_by.push("consent_phrase_mismatch");
  for (const code of offerBlocks(input)) blocked_by.push(code);
  return Object.freeze({
    schema: URP_SUPPLY_REWARD_PREVIEW_SCHEMA,
    truth_label: URP_SUPPLY_REWARD_PREVIEW_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

export function buildUrpSupplyRewardPreviewPayload(input) {
  const body = applyUrpSupplyRewardContract(input);
  const content_hash = `sha256:${sha256(stableStringify(body))}`;
  return Object.freeze({ ...body, content_hash });
}

export function verifyUrpSupplyRewardPreview(payload) {
  if (!payload || typeof payload !== "object") {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["payload_not_object"]) });
  }
  const blocked_by = [];
  const { content_hash, ...body } = payload;
  if (content_hash !== `sha256:${sha256(stableStringify(body))}`) blocked_by.push("content_hash_mismatch");
  if (payload.grants_action !== false) blocked_by.push("grants_action_true");
  if (payload.mint_allowed !== false) blocked_by.push("mint_allowed_true");
  if (payload.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
  if (!REWARD_STATUSES.includes(payload.status)) blocked_by.push("unknown_status");
  const canonicalKeys = Object.keys(urpSupplyRewardPreviewBoundary());
  const pb = payload.boundary;
  if (!pb || typeof pb !== "object" || Object.keys(pb).length !== canonicalKeys.length || canonicalKeys.some((k) => pb[k] !== false)) {
    blocked_by.push("boundary_not_all_false");
  }
  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: URP_SUPPLY_REWARD_PREVIEW_SCHEMA,
    truth_label: URP_SUPPLY_REWARD_PREVIEW_TRUTH_LABEL,
    content_hash,
    boundary: urpSupplyRewardPreviewBoundary(),
    blocked_by: Object.freeze(blocked_by),
  });
}

export function runUrpSupplyRewardPreview({ consent, input } = {}) {
  const plan = planUrpSupplyRewardPreview({ consent, input });
  if (!plan.eligible) {
    return Object.freeze({
      ok: false,
      schema: URP_SUPPLY_REWARD_PREVIEW_SCHEMA,
      truth_label: URP_SUPPLY_REWARD_PREVIEW_TRUTH_LABEL,
      boundary: urpSupplyRewardPreviewBoundary(),
      blocked_by: plan.blocked_by,
    });
  }
  const payload = buildUrpSupplyRewardPreviewPayload(input);
  const verdict = verifyUrpSupplyRewardPreview(payload);
  const tampered = { ...payload, mint_allowed: true };
  const tamperCaught = verifyUrpSupplyRewardPreview(tampered).ok === false;
  const blocked_by = [];
  if (!verdict.ok) blocked_by.push(...verdict.blocked_by);
  if (!tamperCaught) blocked_by.push("tamper_not_detected");
  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: URP_SUPPLY_REWARD_PREVIEW_SCHEMA,
    truth_label: URP_SUPPLY_REWARD_PREVIEW_TRUTH_LABEL,
    reward_status: payload.status,
    content_hash: payload.content_hash,
    mint_allowed: false,
    boundary: urpSupplyRewardPreviewBoundary(),
    blocked_by: Object.freeze(blocked_by),
  });
}
