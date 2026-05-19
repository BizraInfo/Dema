// Local LLM Router Preview — `dema llm-router` first slice.
//
// Analogical model: air-traffic-control desk for model invocations. Radar
// shows which models are locally declared (inventory). Runway assignments
// declare which model would be used for which mission role (role map).
// All clearances are DENIED by default: routing_allowed = false on every
// model, on every role, at the top level. Aircraft are visible but never
// cleared for takeoff in preview.
//
// This module is declarative. It does NOT:
//   - load any model into memory
//   - start any process
//   - issue any prompt
//   - call any external service
//   - scan any raw corpus
//   - execute any tool
//   - autonomously dispatch any mission
//
// It DOES declare:
//   - which model would be assigned to each mission role (or null)
//   - the canonical role taxonomy
//   - the ABSTAIN policy as the universal fallback when routing is not
//     authorized
//   - the consent boundary (routing requires typed GO + chain advance,
//     both out of scope for this preview)
//
// Operating law applied: Model routing after evidence.

const CANONICAL_ROLES = Object.freeze([
  "mission_intent_parse",
  "pat_proposal_draft",
  "consent_phrase_generate",
  "evidence_summary",
  "abstain_or_unknown"
]);

const ALLOWED_FAMILIES = Object.freeze([
  "llama",
  "qwen",
  "mistral",
  "gpt-oss",
  "deepseek",
  "phi",
  "gemma",
  "other"
]);

import { buildPreviewBoundary } from "./preview-boundary.js";

function buildBoundary() {
  return buildPreviewBoundary();
}

function sanitizeModelEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const id = typeof entry.id === "string" && entry.id.length > 0 ? entry.id : null;
  if (id === null) return null;
  const familyRaw = typeof entry.family === "string" ? entry.family : "other";
  const family = ALLOWED_FAMILIES.includes(familyRaw) ? familyRaw : "other";
  const role = typeof entry.role === "string" && CANONICAL_ROLES.includes(entry.role)
    ? entry.role
    : "abstain_or_unknown";
  const sizeGb = typeof entry.size_gb === "number" && entry.size_gb >= 0 && entry.size_gb < 10000
    ? entry.size_gb
    : null;
  return Object.freeze({
    id,
    family,
    role,
    size_gb: sizeGb,
    status: "declared_preview_only",
    routing_allowed: false,
    invocation_status: "not_invoked_preview_only",
    source: "operator_declared"
  });
}

function sanitizeInventory(inventoryHints) {
  if (!Array.isArray(inventoryHints)) return Object.freeze([]);
  const sanitized = [];
  const seenIds = new Set();
  for (const hint of inventoryHints) {
    const entry = sanitizeModelEntry(hint);
    if (entry === null) continue;
    if (seenIds.has(entry.id)) continue;
    seenIds.add(entry.id);
    sanitized.push(entry);
  }
  return Object.freeze(sanitized);
}

function buildRoleMap(sanitizedInventory) {
  return Object.freeze(CANONICAL_ROLES.map((role) => {
    const assigned = sanitizedInventory.find((m) => m.role === role);
    return Object.freeze({
      role,
      assigned_model_id: assigned ? assigned.id : null,
      routing_allowed: false,
      invocation_status: "not_invoked_preview_only",
      fallback: "abstain"
    });
  }));
}

export function buildLocalLLMRouterPreview({
  operator = "MoMo",
  inventoryHints = []
} = {}) {
  const sanitizedInventory = sanitizeInventory(inventoryHints);
  const roleMap = buildRoleMap(sanitizedInventory);

  return Object.freeze({
    schema: "bizra.dema.local_llm_router_preview.v0.1",
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    operator,
    routing_allowed: false,
    invocation_status: "not_invoked_preview_only",
    canonical_roles: CANONICAL_ROLES,
    inventory: sanitizedInventory,
    role_map: roleMap,
    abstain_policy: Object.freeze({
      default_when_no_routing_authorized: true,
      default_when_role_unassigned: true,
      default_when_consent_not_collected: true,
      output_on_abstain: null
    }),
    consent_boundary: Object.freeze({
      routing_requires: "typed_GO_plus_chain_advance",
      typed_go_present_in_preview: false,
      chain_advance_present_in_preview: false
    }),
    next_safe_action: sanitizedInventory.length === 0
      ? "declare_local_model_inventory"
      : "review_role_assignments",
    boundary: buildBoundary()
  });
}

export const LOCAL_LLM_ROUTER_CANONICAL_ROLES = CANONICAL_ROLES;
export const LOCAL_LLM_ROUTER_ALLOWED_FAMILIES = ALLOWED_FAMILIES;
