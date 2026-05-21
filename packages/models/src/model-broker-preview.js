// Local Model Broker Preview — v0.1.
//
// Composition layer on top of existing preview-state model routing
// (packages/models/src/model-role-router-preview.js + model-routing.js).
//
// This module:
//   - declares the BIZRA broker role taxonomy (PAT/SAT/Dema-face semantic
//     roles) — distinct from, and parallel to, the existing capability-role
//     taxonomy (coding/governance/reasoning/fast/embedding/vision)
//   - declares a size class enumeration (2B / 3B / 4B / 7B / 14B / 32B /
//     unknown)
//   - exposes routeForTask({ task_kind, required_role, local_only,
//     max_size_class, allow_unknown }) which produces a route receipt
//     conforming to schema bizra.dema.local_model_route_receipt.v0.1
//   - enforces safety rules: local_only rejects non-local; disabled is
//     never selected; unknown requires allow_unknown=true; SAT tasks
//     prefer sat_validator / claim_checker; consent tasks prefer
//     consent_detector / classifier
//
// This module does NOT:
//   - load any model into memory
//   - invoke any model
//   - start any local process
//   - issue any prompt
//   - make any network call
//   - mutate the receipt store
//   - run autonomously
//
// Canon refs:
//   - CLAIM_REGISTER_v0_1.md          (truth-label discipline)
//   - BIZRA_AGENT_DNA_LAW_OF_ASSUMPTION_v0_1.md  (think humbly)
//   - DEMA_AGENT_HARNESS_AND_SKILL_DNA_v0_1.md   (act verifiably; loop step)
//   - NODE0_DEMA_COMPLETE_COMPONENT_DNA_v0_1.md  (PAT-7 / SAT-5 layers)

export const LOCAL_MODEL_ROUTE_RECEIPT_SCHEMA = "bizra.dema.local_model_route_receipt.v0.1";

export const BROKER_ROLES = Object.freeze([
  "dema_face",
  "pat_worker",
  "sat_validator",
  "router",
  "classifier",
  "summarizer",
  "claim_checker",
  "consent_detector",
  "code_helper",
  "fallback"
]);

export const BROKER_SIZE_CLASSES = Object.freeze([
  "2B",
  "3B",
  "4B",
  "7B",
  "14B",
  "32B",
  "unknown"
]);

const SIZE_CLASS_ORDER = Object.freeze({
  "2B": 0,
  "3B": 1,
  "4B": 2,
  "7B": 3,
  "14B": 4,
  "32B": 5,
  "unknown": 6
});

export const BROKER_CANON_REFS = Object.freeze([
  "CLAIM_REGISTER_v0_1.md",
  "BIZRA_AGENT_DNA_LAW_OF_ASSUMPTION_v0_1.md",
  "DEMA_AGENT_HARNESS_AND_SKILL_DNA_v0_1.md",
  "NODE0_DEMA_COMPLETE_COMPONENT_DNA_v0_1.md"
]);

const BROKER_BOUNDARY = Object.freeze({
  runtime: false,
  model_invocation: false,
  network_used: false,
  federation: false,
  mint: false,
  token_economy: false,
  urp_networking: false,
  prompt_invocation_allowed: false
});

// Task-kind → preferred-roles mapping. Tasks not matched fall through to
// the explicit required_role.
const TASK_ROLE_PREFERENCES = Object.freeze({
  synthesis: Object.freeze(["dema_face", "summarizer"]),
  planning: Object.freeze(["pat_worker", "router"]),
  research: Object.freeze(["pat_worker", "summarizer"]),
  reflection: Object.freeze(["pat_worker", "summarizer"]),
  claim_review: Object.freeze(["sat_validator", "claim_checker"]),
  claim_check: Object.freeze(["sat_validator", "claim_checker"]),
  safety_review: Object.freeze(["sat_validator", "claim_checker"]),
  consent_detect: Object.freeze(["consent_detector", "classifier"]),
  intent_classify: Object.freeze(["classifier", "router"]),
  route: Object.freeze(["router", "classifier"]),
  code_help: Object.freeze(["code_helper", "pat_worker"])
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

// Defensive sanitization of a registry entry. Any malformed entry is
// returned as null (caller filters nulls).
export function sanitizeRegistryEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const id = typeof entry.id === "string" && entry.id.length > 0 ? entry.id : null;
  if (id === null) return null;
  const provider = typeof entry.provider === "string" ? entry.provider : "unknown";
  const model_name = typeof entry.model_name === "string" ? entry.model_name : id;
  const role = typeof entry.role === "string" && BROKER_ROLES.includes(entry.role) ? entry.role : "fallback";
  const size_class = typeof entry.size_class === "string" && BROKER_SIZE_CLASSES.includes(entry.size_class) ? entry.size_class : "unknown";
  const locality = ["local", "remote", "disabled", "unknown"].includes(entry.locality) ? entry.locality : "unknown";
  const allowed_tasks = Array.isArray(entry.allowed_tasks)
    ? entry.allowed_tasks.filter((t) => typeof t === "string")
    : [];
  const max_concurrency = Number.isInteger(entry.max_concurrency) && entry.max_concurrency >= 0 ? entry.max_concurrency : 1;
  const context_limit = Number.isInteger(entry.context_limit) && entry.context_limit > 0 ? entry.context_limit : null;
  const status = ["active", "available", "disabled", "source_pending"].includes(entry.status) ? entry.status : "source_pending";
  return Object.freeze({
    id,
    provider,
    model_name,
    role,
    size_class,
    locality,
    allowed_tasks: Object.freeze(allowed_tasks),
    max_concurrency,
    context_limit,
    status
  });
}

function sanitizeRegistry(registry) {
  if (!Array.isArray(registry)) return Object.freeze([]);
  const result = [];
  for (const entry of registry) {
    const clean = sanitizeRegistryEntry(entry);
    if (clean) result.push(clean);
  }
  return Object.freeze(result);
}

function buildPreferredRoles(task_kind, required_role) {
  const taskPrefs = task_kind && TASK_ROLE_PREFERENCES[task_kind];
  const prefs = [];
  if (taskPrefs) {
    for (const role of taskPrefs) {
      if (!prefs.includes(role)) prefs.push(role);
    }
  }
  if (required_role && BROKER_ROLES.includes(required_role) && !prefs.includes(required_role)) {
    prefs.push(required_role);
  }
  // Always include fallback as a last-resort role unless caller asked for
  // a stricter scope by explicitly setting required_role.
  if (!required_role && !prefs.includes("fallback")) prefs.push("fallback");
  return prefs;
}

function sizeClassWithinMax(candidateClass, maxClass) {
  if (!maxClass) return true;
  if (!BROKER_SIZE_CLASSES.includes(candidateClass) || !BROKER_SIZE_CLASSES.includes(maxClass)) {
    return false;
  }
  // unknown is never within a finite max
  if (candidateClass === "unknown" && maxClass !== "unknown") return false;
  return SIZE_CLASS_ORDER[candidateClass] <= SIZE_CLASS_ORDER[maxClass];
}

function rejectionReason({ candidate, local_only, allow_unknown, max_size_class, preferredRoles, required_role }) {
  if (candidate.status === "disabled") return "status_disabled";
  if (candidate.status === "source_pending") return "status_source_pending";
  if (candidate.status === "unknown" && !allow_unknown) return "status_unknown_without_allow";
  if (local_only && candidate.locality !== "local") return `locality_${candidate.locality}_under_local_only`;
  if (candidate.locality === "disabled") return "locality_disabled";
  if (max_size_class && !sizeClassWithinMax(candidate.size_class, max_size_class)) {
    return `size_class_${candidate.size_class}_exceeds_max_${max_size_class}`;
  }
  if (preferredRoles.length > 0 && !preferredRoles.includes(candidate.role)) {
    return `role_${candidate.role}_not_in_preferred`;
  }
  if (required_role && candidate.role !== required_role) {
    return `role_${candidate.role}_not_required_${required_role}`;
  }
  return null;
}

function isSelectable(candidate, ctx) {
  return rejectionReason({ ...ctx, candidate }) === null;
}

function pickByPreferredRoleOrder(candidates, preferredRoles) {
  for (const role of preferredRoles) {
    const match = candidates.find((c) => c.role === role);
    if (match) return { candidate: match, reason: `matched_preferred_role_${role}` };
  }
  return null;
}

export function routeForTask(broker, opts = {}) {
  const task_kind = typeof opts.task_kind === "string" ? opts.task_kind : null;
  const required_role = typeof opts.required_role === "string" && BROKER_ROLES.includes(opts.required_role)
    ? opts.required_role
    : null;
  const local_only = opts.local_only !== false;
  const max_size_class = typeof opts.max_size_class === "string" && BROKER_SIZE_CLASSES.includes(opts.max_size_class)
    ? opts.max_size_class
    : null;
  const allow_unknown = opts.allow_unknown === true;

  const warnings = [];
  if (!task_kind && !required_role) warnings.push("no_task_kind_or_required_role");
  if (!local_only) warnings.push("local_only_disabled");
  if (allow_unknown) warnings.push("allow_unknown_enabled");

  const registry = broker && Array.isArray(broker.registry) ? broker.registry : [];
  const preferredRoles = buildPreferredRoles(task_kind, required_role);
  const ctx = { local_only, allow_unknown, max_size_class, preferredRoles, required_role };

  const rejected_candidates = [];
  const acceptable = [];
  for (const candidate of registry) {
    const reason = rejectionReason({ candidate, ...ctx });
    if (reason) {
      rejected_candidates.push({ model_id: candidate.id, reason });
    } else {
      acceptable.push(candidate);
    }
  }

  let selection = pickByPreferredRoleOrder(acceptable, preferredRoles);
  // If no preferred role matched but acceptable is non-empty and the caller
  // gave no required_role, take the first acceptable candidate.
  if (!selection && !required_role && acceptable.length > 0) {
    selection = { candidate: acceptable[0], reason: "first_acceptable_no_required_role" };
  }

  const selected_model_id = selection ? selection.candidate.id : null;
  const selected_model_role = selection ? selection.candidate.role : null;
  const selected_model_locality = selection ? selection.candidate.locality : null;
  const reason = selection ? selection.reason : "no_acceptable_candidate";

  if (!selection) warnings.push("no_selection_made");

  return deepFreeze(clone({
    schema: LOCAL_MODEL_ROUTE_RECEIPT_SCHEMA,
    timestamp: nowIso(),
    task_kind,
    required_role,
    local_only,
    max_size_class,
    allow_unknown,
    selected_model_id,
    selected_model_role,
    selected_model_locality,
    reason,
    rejected_candidates,
    canon_refs: Array.from(BROKER_CANON_REFS),
    warnings,
    boundary: { ...BROKER_BOUNDARY }
  }));
}

export function buildModelBrokerPreview({ registry, providers } = {}) {
  // v0.1: `providers` is accepted in the signature for forward compatibility
  // with the existing model-routing.js inventory format but is not consumed
  // by the broker at v0.1. v0.2 may compose buildRoutingRecommendations()
  // when registry is absent. For now, the registry is the primary input.
  const sanitized_registry = sanitizeRegistry(registry);
  return deepFreeze(clone({
    schema: "bizra.dema.local_model_broker_preview.v0.1",
    mode: "PREVIEW_ONLY",
    roles: Array.from(BROKER_ROLES),
    size_classes: Array.from(BROKER_SIZE_CLASSES),
    registry: sanitized_registry,
    providers_received: providers !== undefined,
    boundary: { ...BROKER_BOUNDARY },
    canon_refs: Array.from(BROKER_CANON_REFS)
  }));
}

// Convenience: build a broker AND immediately route a single task in one
// call. Useful for tests + future single-shot harness integration.
export function brokerRouteOnce({ registry, providers, ...routeOpts } = {}) {
  const broker = buildModelBrokerPreview({ registry, providers });
  return routeForTask(broker, routeOpts);
}
