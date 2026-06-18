// BIZRA-ADK-AGENT-CONTRACT-1A · agent contract schema and lifecycle vocabulary.

import {
  AGENT_CONTRACT_SCHEMA,
  AGENT_SCOPES,
  PRIVACY_CLASSES,
} from "./agent-scope.js";
import { normalizeEffectPolicy } from "./effect-policy.js";
import { buildPreviewBoundary } from "../../core/src/preview-boundary.js";

export const ADK_AGENT_LIFECYCLE = Object.freeze([
  "DECLARE",
  "BIND_SCOPE",
  "LOAD_CONTEXT",
  "INFER_LOOP_STATE",
  "PLAN",
  "REQUEST_CONSENT_IF_NEEDED",
  "EXECUTE_IF_ALLOWED",
  "VERIFY",
  "RECEIPT",
  "LEARN",
  "STOP",
]);

export const REQUIRED_GUARDRAIL_FIELDS = Object.freeze([
  "truth_label",
  "scope",
  "serves",
  "allowed_effects",
  "forbidden_effects",
  "privacy_class",
  "consent_policy",
  "proof_policy",
  "receipt_policy",
  "what_this_proves",
  "what_this_does_not_prove",
  "stop_by_default",
]);

const REQUIRED_IDENTITY_FIELDS = Object.freeze(["agent_id"]);

function safeString(v) {
  return typeof v === "string" ? v.trim() : "";
}

function safeBool(v, fallback = false) {
  return typeof v === "boolean" ? v : fallback;
}

/**
 * Build a normalized ADK agent contract envelope (validation separate).
 * @param {object} input
 */
export function buildAgentContract(input = {}) {
  const agent_id = safeString(input.agent_id);
  const scope = safeString(input.scope);
  const effects = normalizeEffectPolicy({
    allowed_effects: input.allowed_effects,
    forbidden_effects: input.forbidden_effects,
  });

  const contract = Object.freeze({
    schema: AGENT_CONTRACT_SCHEMA,
    truth_label: safeString(input.truth_label) || "ADK_AGENT_CONTRACT_PREVIEW",
    mode: "define_only",
    agent_id,
    agent_role: safeString(input.agent_role) || null,
    serves: safeString(input.serves),
    scope: scope || null,
    privacy_class: safeString(input.privacy_class) || null,
    allowed_effects: effects.allowed_effects,
    forbidden_effects: effects.forbidden_effects,
    consent_required_for: normalizeConsentList(input.consent_required_for),
    consent_policy: safeString(input.consent_policy),
    proof_policy: safeString(input.proof_policy),
    receipt_policy: safeString(input.receipt_policy),
    proof_required: safeBool(input.proof_required, true),
    what_this_proves: safeString(input.what_this_proves),
    what_this_does_not_prove: safeString(input.what_this_does_not_prove),
    stop_by_default: safeBool(input.stop_by_default, true),
    lifecycle: ADK_AGENT_LIFECYCLE,
    boundary: buildPreviewBoundary(),
  });

  return contract;
}

function normalizeConsentList(value) {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(
    value.filter((v) => typeof v === "string" && v.length > 0),
  );
}

export function contractFromJson(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { contract: null, error: "invalid_contract_shape" };
  }
  return { contract: buildAgentContract(raw), error: null };
}

export function missingGuardrailFields(contract) {
  if (!contract || typeof contract !== "object") {
    return [...REQUIRED_GUARDRAIL_FIELDS, ...REQUIRED_IDENTITY_FIELDS];
  }
  const missing = [];
  for (const field of REQUIRED_IDENTITY_FIELDS) {
    if (!safeString(contract[field])) missing.push(field);
  }
  for (const field of REQUIRED_GUARDRAIL_FIELDS) {
    if (field === "allowed_effects" || field === "forbidden_effects") {
      if (!Array.isArray(contract[field])) missing.push(field);
      continue;
    }
    if (field === "stop_by_default") {
      if (contract.stop_by_default !== true) missing.push(field);
      continue;
    }
    if (!safeString(contract[field])) missing.push(field);
  }
  return missing;
}
