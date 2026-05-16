// URP Carrying Cost Preview (v0.1).
//
// Operating canon (per docs/superpowers/specs/2026-05-16-urp-carrying-cost/):
//   Private memory is sovereign.
//   Shared resources carry responsibility.
//   No hoarding without cost.
//   No extraction without contribution.
//   No forced transfer in v0.1.
//
// This module declares a typed preview envelope for a self-assessed value plus a
// simulated carrying cost on a SHAREABLE URP resource (skill packs, knowledge-pack
// manifests, model profiles, mission templates, agent-service offers, ...). It
// REFUSES BY CONSTRUCTION to attach a carrying-cost record to any private resource
// type (private conversations, identity data, family personal data, secrets, raw
// corpus, unpublished personal memory, credentials, finance data).
//
// Preview-only: no I/O, no settlement, no forced transfer, no license issuance,
// no shared-URP publication. Pure data emitter.

export const URP_CARRYING_COST_PREVIEW_SCHEMA = "bizra.dema.urp_carrying_cost_preview.v0.1";

export const SHAREABLE_RESOURCE_TYPES = Object.freeze([
  "skill_pack",
  "knowledge_pack_manifest",
  "model_profile",
  "mission_template",
  "verified_proof_bundle",
  "resource_offer",
  "compute_offer",
  "agent_service_offer"
]);

export const FORBIDDEN_RESOURCE_TYPES = Object.freeze([
  "private_conversation",
  "identity_data",
  "family_personal_data",
  "secrets",
  "raw_corpus",
  "unpublished_personal_memory",
  "credentials",
  "finance_data"
]);

const BOUNDARY = Object.freeze({
  runtime: false,
  federation: false,
  mint: false,
  economic_settlement: false,
  forced_transfer_executed: false,
  private_memory_accessed: false,
  raw_data_exchange: false,
  license_issued: false,
  shared_urp_published: false
});

const NOTE = "Owner may license-challenge. No forced transfer. No economic settlement. No private memory.";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function validateResourceType(resource_type) {
  if (FORBIDDEN_RESOURCE_TYPES.includes(resource_type)) {
    return {
      ok: false,
      code: "forbidden_resource_type",
      detail: `${resource_type} is private; this module refuses by construction`
    };
  }
  if (!SHAREABLE_RESOURCE_TYPES.includes(resource_type)) {
    return {
      ok: false,
      code: "unknown_resource_type",
      detail: `${resource_type} is not on the shareable allowlist`
    };
  }
  return { ok: true };
}

function validateNumericInputs(self_assessed_value, carrying_cost_rate) {
  if (!isFiniteNumber(self_assessed_value) || self_assessed_value <= 0) {
    return {
      ok: false,
      code: "invalid_value",
      detail: "self_assessed_value must be a positive finite number"
    };
  }
  if (!isFiniteNumber(carrying_cost_rate) || carrying_cost_rate <= 0 || carrying_cost_rate >= 1) {
    return {
      ok: false,
      code: "invalid_rate",
      detail: "carrying_cost_rate must be in the open interval (0, 1)"
    };
  }
  return { ok: true };
}

function validateRequired({ resource_id, owner_node, no_raw_data_proof }) {
  const fields = { resource_id, owner_node, no_raw_data_proof };
  for (const [name, value] of Object.entries(fields)) {
    if (!isNonEmptyString(value)) {
      return {
        ok: false,
        code: "missing_field",
        detail: `${name} must be a non-empty string`
      };
    }
  }
  return { ok: true };
}

function validateNow(now) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    return {
      ok: false,
      code: "invalid_now",
      detail: "now must be a valid Date"
    };
  }
  return { ok: true };
}

function buildSuccessEnvelope(payload) {
  return deepFreeze(clone({
    schema: URP_CARRYING_COST_PREVIEW_SCHEMA,
    mode: "PREVIEW_ONLY",
    truth_label: "DECLARED",
    valid: true,
    resource_id: payload.resource_id,
    resource_type: payload.resource_type,
    owner_node: payload.owner_node,
    self_assessed_value: payload.self_assessed_value,
    carrying_cost_rate: payload.carrying_cost_rate,
    simulated_carrying_cost: payload.simulated_carrying_cost,
    license_challenge_allowed: payload.license_challenge_allowed,
    forced_transfer: false,
    raw_data_shared: false,
    no_raw_data_proof: payload.no_raw_data_proof,
    settlement: "preview_only",
    generated_at: payload.generated_at,
    boundary: BOUNDARY,
    note: NOTE
  }));
}

function buildFailureEnvelope(code, detail) {
  return deepFreeze(clone({
    schema: URP_CARRYING_COST_PREVIEW_SCHEMA,
    mode: "PREVIEW_ONLY",
    truth_label: "DECLARED",
    valid: false,
    denial: { code, detail },
    boundary: BOUNDARY
  }));
}

export function buildUrpCarryingCostPreview({
  resource_id,
  resource_type,
  owner_node,
  self_assessed_value,
  carrying_cost_rate,
  license_challenge_allowed = true,
  no_raw_data_proof,
  now = new Date()
} = {}) {
  // Order matters: type check first, then numeric, then required strings, then date.
  const checks = [
    validateResourceType(resource_type),
    validateNumericInputs(self_assessed_value, carrying_cost_rate),
    validateRequired({ resource_id, owner_node, no_raw_data_proof }),
    validateNow(now)
  ];
  for (const check of checks) {
    if (!check.ok) {
      return buildFailureEnvelope(check.code, check.detail);
    }
  }

  return buildSuccessEnvelope({
    resource_id,
    resource_type,
    owner_node,
    self_assessed_value,
    carrying_cost_rate,
    simulated_carrying_cost: self_assessed_value * carrying_cost_rate,
    license_challenge_allowed: license_challenge_allowed === true,
    no_raw_data_proof,
    generated_at: now.toISOString()
  });
}
