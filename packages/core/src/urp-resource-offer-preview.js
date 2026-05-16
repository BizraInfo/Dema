// URP Resource Offer Preview (v0.1).
//
// Operating canon (per docs/02-architecture/dema-urp-resource-offer-v0.1.md):
//   The offer declares the resource.
//   The offer is not the publication.
//   Private memory is never offered.
//   Write, execute, and call are denied by default.
//   Settlement stays at preview_only.
//
// This module emits a typed PREVIEW-ONLY envelope that records a typed offer
// of a SHAREABLE URP resource. It reuses SHAREABLE_RESOURCE_TYPES and
// FORBIDDEN_RESOURCE_TYPES from urp-carrying-cost-preview (single source of
// truth). It REFUSES BY CONSTRUCTION any FORBIDDEN private resource type,
// any effect-overlap with the denial set, any denial set missing write +
// execute + call, any consent field outside MICRO_CONSENT_SHAPE, any SAT
// verdict outside GateVerdict, any no_raw_data_proof under 30 chars, any
// carrying_cost_reference not matching /^chal-[0-9a-f]{32}$/, and any
// owner_node containing person-identifier characters (`@` or `:`).
//
// Preview-only: no I/O, no publication, no ownership transfer, no settlement,
// no shared-URP write. Pure data emitter.

import {
  SHAREABLE_RESOURCE_TYPES,
  FORBIDDEN_RESOURCE_TYPES
} from "./urp-carrying-cost-preview.js";

export const URP_RESOURCE_OFFER_PREVIEW_SCHEMA = "bizra.dema.urp_resource_offer_preview.v0.1";

const OPERATIONS = Object.freeze(["read", "write", "execute", "call"]);

const MICRO_CONSENT_SHAPE = Object.freeze([
  "mission_id",
  "agent_id",
  "resource_id",
  "action",
  "purpose",
  "expires_at",
  "commitment_hash"
]);

const GATE_VERDICTS = Object.freeze(["PERMIT", "REJECT", "REVIEW", "SCORE_ONLY"]);

const REQUIRED_DENIALS = Object.freeze(["write", "execute", "call"]);

const CARRYING_COST_REF_RE = /^chal-[0-9a-f]{32}$/;

const BOUNDARY = Object.freeze({
  runtime: false,
  federation: false,
  mint: false,
  shared_urp_publish: false,
  economic_settlement: false,
  raw_data_exchange: false,
  offer_published: false,
  ownership_transferred: false
});

const NOTE = "Offer declares the resource. Publication is out of scope. Write/execute/call denied. Private types refused by construction.";

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

function validateResourceType(resource_type) {
  if (FORBIDDEN_RESOURCE_TYPES.includes(resource_type)) {
    return {
      ok: false,
      code: "forbidden_resource_type",
      detail: `${resource_type} is private; offers refuse it by construction`
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

function validateOwnerNode(owner_node) {
  if (!isNonEmptyString(owner_node)) {
    return {
      ok: false,
      code: "invalid_owner_node",
      detail: "owner_node must be a non-empty string"
    };
  }
  if (owner_node.includes("@") || owner_node.includes(":")) {
    return {
      ok: false,
      code: "invalid_owner_node",
      detail: "owner_node must not contain '@' or ':' (person-identifier heuristic)"
    };
  }
  return { ok: true };
}

function validateEffects(declared_effects, denied_effects) {
  if (!Array.isArray(declared_effects) || !Array.isArray(denied_effects)) {
    return {
      ok: false,
      code: "invalid_effect",
      detail: "declared_effects and denied_effects must be arrays"
    };
  }
  for (const effect of declared_effects) {
    if (!OPERATIONS.includes(effect)) {
      return {
        ok: false,
        code: "invalid_effect",
        detail: `declared_effects entry '${effect}' is not in OPERATIONS`
      };
    }
  }
  for (const effect of denied_effects) {
    if (!OPERATIONS.includes(effect)) {
      return {
        ok: false,
        code: "invalid_effect",
        detail: `denied_effects entry '${effect}' is not in OPERATIONS`
      };
    }
  }
  const deniedSet = new Set(denied_effects);
  for (const effect of declared_effects) {
    if (deniedSet.has(effect)) {
      return {
        ok: false,
        code: "effect_overlap",
        detail: `effect '${effect}' is both declared and denied`
      };
    }
  }
  for (const required of REQUIRED_DENIALS) {
    if (!deniedSet.has(required)) {
      return {
        ok: false,
        code: "denied_effects_incomplete",
        detail: `denied_effects must include '${required}' in v0.1`
      };
    }
  }
  return { ok: true };
}

function validateConsentField(consent_field_required) {
  if (!MICRO_CONSENT_SHAPE.includes(consent_field_required)) {
    return {
      ok: false,
      code: "invalid_consent_field",
      detail: `consent_field_required '${consent_field_required}' is not in MICRO_CONSENT_SHAPE`
    };
  }
  return { ok: true };
}

function validateSatVerdict(sat_verdict_required) {
  if (!GATE_VERDICTS.includes(sat_verdict_required)) {
    return {
      ok: false,
      code: "invalid_sat_verdict",
      detail: `sat_verdict_required '${sat_verdict_required}' is not in GateVerdict`
    };
  }
  return { ok: true };
}

function validateNoRawDataProof(no_raw_data_proof) {
  if (!isNonEmptyString(no_raw_data_proof) || no_raw_data_proof.trim().length < 30) {
    return {
      ok: false,
      code: "no_raw_data_proof_too_short",
      detail: "no_raw_data_proof must be a non-empty string of at least 30 characters"
    };
  }
  return { ok: true };
}

function validateCarryingCostReference(carrying_cost_reference) {
  if (carrying_cost_reference === null || carrying_cost_reference === undefined) {
    return { ok: true, normalized: null };
  }
  if (typeof carrying_cost_reference !== "string" || !CARRYING_COST_REF_RE.test(carrying_cost_reference)) {
    return {
      ok: false,
      code: "invalid_carrying_cost_reference",
      detail: "carrying_cost_reference must be null or match /^chal-[0-9a-f]{32}$/"
    };
  }
  return { ok: true, normalized: carrying_cost_reference };
}

function validateResourceId(resource_id) {
  if (!isNonEmptyString(resource_id)) {
    return {
      ok: false,
      code: "missing_field",
      detail: "resource_id must be a non-empty string"
    };
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
    schema: URP_RESOURCE_OFFER_PREVIEW_SCHEMA,
    mode: "PREVIEW_ONLY",
    truth_label: "DECLARED",
    valid: true,
    resource_id: payload.resource_id,
    resource_type: payload.resource_type,
    owner_node: payload.owner_node,
    declared_effects: payload.declared_effects,
    denied_effects: payload.denied_effects,
    consent_field_required: payload.consent_field_required,
    sat_verdict_required: payload.sat_verdict_required,
    settlement: "preview_only",
    no_raw_data_proof: payload.no_raw_data_proof,
    carrying_cost_reference: payload.carrying_cost_reference,
    published: false,
    generated_at: payload.generated_at,
    boundary: BOUNDARY,
    note: NOTE
  }));
}

function buildFailureEnvelope(code, detail) {
  return deepFreeze(clone({
    schema: URP_RESOURCE_OFFER_PREVIEW_SCHEMA,
    mode: "PREVIEW_ONLY",
    truth_label: "DECLARED",
    valid: false,
    denial: { code, detail },
    settlement: "preview_only",
    published: false,
    boundary: BOUNDARY
  }));
}

export function buildUrpResourceOfferPreview({
  resource_id,
  resource_type,
  owner_node,
  declared_effects,
  denied_effects,
  consent_field_required,
  sat_verdict_required,
  no_raw_data_proof,
  carrying_cost_reference = null,
  now = new Date()
} = {}) {
  // Order: type → owner → effects → consent field → SAT verdict → proof →
  // carrying cost ref → resource_id → now. Each check returns ok:false with a
  // discriminated denial.code so callers can branch on the exact failure.
  const resourceTypeCheck = validateResourceType(resource_type);
  if (!resourceTypeCheck.ok) return buildFailureEnvelope(resourceTypeCheck.code, resourceTypeCheck.detail);

  const ownerCheck = validateOwnerNode(owner_node);
  if (!ownerCheck.ok) return buildFailureEnvelope(ownerCheck.code, ownerCheck.detail);

  const effectsCheck = validateEffects(declared_effects, denied_effects);
  if (!effectsCheck.ok) return buildFailureEnvelope(effectsCheck.code, effectsCheck.detail);

  const consentCheck = validateConsentField(consent_field_required);
  if (!consentCheck.ok) return buildFailureEnvelope(consentCheck.code, consentCheck.detail);

  const verdictCheck = validateSatVerdict(sat_verdict_required);
  if (!verdictCheck.ok) return buildFailureEnvelope(verdictCheck.code, verdictCheck.detail);

  const proofCheck = validateNoRawDataProof(no_raw_data_proof);
  if (!proofCheck.ok) return buildFailureEnvelope(proofCheck.code, proofCheck.detail);

  const carryingCostCheck = validateCarryingCostReference(carrying_cost_reference);
  if (!carryingCostCheck.ok) return buildFailureEnvelope(carryingCostCheck.code, carryingCostCheck.detail);

  const idCheck = validateResourceId(resource_id);
  if (!idCheck.ok) return buildFailureEnvelope(idCheck.code, idCheck.detail);

  const nowCheck = validateNow(now);
  if (!nowCheck.ok) return buildFailureEnvelope(nowCheck.code, nowCheck.detail);

  return buildSuccessEnvelope({
    resource_id,
    resource_type,
    owner_node,
    declared_effects: [...declared_effects],
    denied_effects: [...denied_effects],
    consent_field_required,
    sat_verdict_required,
    no_raw_data_proof,
    carrying_cost_reference: carryingCostCheck.normalized,
    generated_at: now.toISOString()
  });
}
