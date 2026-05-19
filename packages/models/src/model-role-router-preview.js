// Operating canon (per docs/02-architecture/dema-model-role-router-v0.1.md):
//   The router declares roles and effects.
//   The router does not invoke models.
//   The router does not import authority.
//   Every role denies write, execute, and call in v0.1.

import { buildRoutingRecommendations } from "./model-routing.js";

export const MODEL_ROLE_ROUTER_PREVIEW_SCHEMA = "bizra.dema.model_role_router_preview.v0.1";

const ROLE_BINDINGS = Object.freeze({
  coding: Object.freeze({
    effects_declared: Object.freeze(["read"]),
    effects_denied: Object.freeze(["write", "execute", "call"]),
    consent_field_required: "action",
    sat_verdict_required: "REVIEW"
  }),
  governance: Object.freeze({
    effects_declared: Object.freeze(["read"]),
    effects_denied: Object.freeze(["write", "execute", "call"]),
    consent_field_required: "purpose",
    sat_verdict_required: "REVIEW"
  }),
  reasoning: Object.freeze({
    effects_declared: Object.freeze(["read"]),
    effects_denied: Object.freeze(["write", "execute", "call"]),
    consent_field_required: "purpose",
    sat_verdict_required: "REVIEW"
  }),
  fast: Object.freeze({
    effects_declared: Object.freeze(["read"]),
    effects_denied: Object.freeze(["write", "execute", "call"]),
    consent_field_required: null,
    sat_verdict_required: "SCORE_ONLY"
  }),
  embedding: Object.freeze({
    effects_declared: Object.freeze(["read"]),
    effects_denied: Object.freeze(["write", "execute", "call"]),
    consent_field_required: "resource_id",
    sat_verdict_required: "REVIEW"
  }),
  vision: Object.freeze({
    effects_declared: Object.freeze(["read"]),
    effects_denied: Object.freeze(["write", "execute", "call"]),
    consent_field_required: "resource_id",
    sat_verdict_required: "REVIEW"
  })
});

const ROLE_NAMES = Object.freeze(Object.keys(ROLE_BINDINGS));

const BOUNDARY = Object.freeze({
  runtime: false,
  federation: false,
  mint: false,
  prompt_invoked: false,
  model_started: false,
  network_used: false,
  authority_imported: false,
  hook_executed: false,
  contract_executed: false
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function buildRoleRecord(role, recommendation) {
  const binding = ROLE_BINDINGS[role];
  return {
    role,
    recommendation,
    effects_declared: binding.effects_declared,
    effects_denied: binding.effects_denied,
    consent_field_required: binding.consent_field_required,
    sat_verdict_required: binding.sat_verdict_required,
    local_only: true,
    prompt_invocation_allowed: false
  };
}

export function buildModelRoleRouterPreview(providers) {
  const recommendations = providers
    ? buildRoutingRecommendations(providers)
    : Object.fromEntries(ROLE_NAMES.map((role) => [role, null]));

  const roles = {};
  for (const role of ROLE_NAMES) {
    roles[role] = buildRoleRecord(role, recommendations[role] ?? null);
  }

  return deepFreeze(clone({
    schema: MODEL_ROLE_ROUTER_PREVIEW_SCHEMA,
    mode: "PREVIEW_ONLY",
    truth_label: "DECLARED",
    roles,
    role_count: ROLE_NAMES.length,
    role_names: ROLE_NAMES,
    boundary: BOUNDARY,
    note: "Role router only. Does not invoke models. Does not start runtime. Does not mint."
  }));
}
