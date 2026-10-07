// DEMA-MASTER-REGISTRY-EFFECTIVE-CONFIG-1A — pure desired + observed resolver.
//
// This kernel resolves only caller-supplied data. It neither reads native or
// environment configuration nor invokes, probes, starts, stops, or mutates a
// provider. Native configuration may be supplied as non-authoritative evidence;
// an attempt to disagree with MR refuses rather than overriding the route.

import { CANONICAL_JSON_V1_ALGORITHM } from "../../canon/src/canonical-json-v1.js";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";

export const DEMA_MASTER_REGISTRY_EFFECTIVE_CONFIG_SCHEMA =
  "bizra.dema.master_registry_effective_config.v0.1";
export const DEMA_MASTER_REGISTRY_EFFECTIVE_CONFIG_TRUTH_LABEL =
  "DEMA_MASTER_REGISTRY_EFFECTIVE_CONFIG_MEASURED_REPO";

const DESIRED_SCHEMA = "bizra.dema.master_registry.desired.v0.1";
const OBSERVATION_SCHEMA = "bizra.dema.master_registry.observation.v0.1";
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;
const SECRET_FIELD_PATTERN = /(?:api[_-]?key|authorization|credential|password|secret|token)/i;
const SECRET_REFERENCE_PATTERN = /(?:api[_-]?key|credential|secret|token)_ref(?:erence)?$/i;

const BOUNDARY = Object.freeze({
  execution_allowed: false,
  daemon_started: false,
  network_used: false,
  token_minted: false,
  wallet_accessed: false,
  live_execution_performed: false,
  file_mutation_performed: false,
  model_invocation_performed: false,
  provider_invocation_performed: false,
  provider_state_changed: false,
  dema_runtime_activated: false,
  node0_runtime_activated: false,
  fallback_activated: false,
  consent_requested: false,
  consent_consumed: false,
  receipt_minted: false,
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value, allowed) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function nonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function deepSecretField(value, seen = new Set()) {
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return true;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => deepSecretField(item, seen));
  if (!isPlainObject(value)) return true;
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_FIELD_PATTERN.test(key) && !SECRET_REFERENCE_PATTERN.test(key)) {
      return true;
    }
    if (deepSecretField(item, seen)) return true;
  }
  return false;
}

function diagnostic(code, plane, fields = []) {
  return Object.freeze({ code, plane, fields: Object.freeze([...fields]) });
}

export function demaMasterRegistryEffectiveConfigBoundary() {
  return Object.freeze({ ...BOUNDARY });
}

function safeRequest(request) {
  if (!isPlainObject(request)) return null;
  return Object.freeze({
    role: nonEmptyString(request.role) ? request.role : null,
    locality: nonEmptyString(request.locality) ? request.locality : null,
    authority_class: nonEmptyString(request.authority_class)
      ? request.authority_class
      : null,
  });
}

function result({
  resolution_status,
  decision,
  mr_revision = null,
  request = null,
  selected_route = null,
  diagnostics = [],
}) {
  return deepFreeze({
    schema: DEMA_MASTER_REGISTRY_EFFECTIVE_CONFIG_SCHEMA,
    truth_label: DEMA_MASTER_REGISTRY_EFFECTIVE_CONFIG_TRUTH_LABEL,
    resolution_status,
    decision,
    mr_revision,
    request: safeRequest(request),
    selected_route,
    diagnostics: [...diagnostics],
    fallback: { policy: "DISABLED", activated: false },
    authority_delta: 0,
    boundary: demaMasterRegistryEffectiveConfigBoundary(),
  });
}

function refused(code, plane, request = null, fields = []) {
  return result({
    resolution_status: "REFUSED",
    decision: "REFUSE",
    request,
    diagnostics: [diagnostic(code, plane, fields)],
  });
}

function unknown(code, plane, mr_revision, request = null, fields = []) {
  return result({
    resolution_status: "UNKNOWN",
    decision: "UNKNOWN",
    mr_revision,
    request,
    diagnostics: [diagnostic(code, plane, fields)],
  });
}

function revision(value) {
  if (
    !isPlainObject(value) ||
    !hasOnlyKeys(value, ["id", "content_hash"]) ||
    !nonEmptyString(value.id) ||
    !HASH_PATTERN.test(value.content_hash)
  ) {
    return null;
  }
  return Object.freeze({ id: value.id, content_hash: value.content_hash });
}

function revisionMatches(first, second) {
  return Boolean(first && second) && first.id === second.id && first.content_hash === second.content_hash;
}

function uniqueBy(entries, key) {
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry[key])) return false;
    seen.add(entry[key]);
  }
  return true;
}

function validBinding(binding) {
  const allowed = [
    "id",
    "capability_class",
    "model_id",
    "admission_state",
    "qualification_state",
    "roles",
    "locality",
    "authority_class",
  ];
  return (
    isPlainObject(binding) &&
    hasOnlyKeys(binding, allowed) &&
    allowed.slice(0, 6).every((key) => nonEmptyString(binding[key]) || key === "roles") &&
    Array.isArray(binding.roles) &&
    binding.roles.length > 0 &&
    binding.roles.every(nonEmptyString) &&
    uniqueBy(binding.roles.map((role) => ({ role })), "role") &&
    ["INFERENCE_PROVIDER", "AGENT_CLIENT"].includes(binding.capability_class) &&
    ["ACTIVE", "REGISTERED", "QUALIFIED", "DISABLED", "RETIRED"].includes(binding.admission_state) &&
    ["QUALIFIED", "DISCOVERED", "PENDING", "RETIRED"].includes(binding.qualification_state) &&
    ["LOOPBACK", "LOCAL", "EXTERNAL"].includes(binding.locality) &&
    ["READ_ONLY", "PROPOSAL_ONLY"].includes(binding.authority_class)
  );
}

function validRoute(route) {
  return (
    isPlainObject(route) &&
    hasOnlyKeys(route, ["role", "primary_binding_id", "fallback"]) &&
    nonEmptyString(route.role) &&
    nonEmptyString(route.primary_binding_id) &&
    route.fallback === "DISABLED"
  );
}

function validateDesired(desired) {
  if (!isPlainObject(desired) || deepSecretField(desired)) return { code: "RAW_SECRET_REFUSED" };
  if (
    !hasOnlyKeys(desired, ["schema", "revision", "policy", "bindings", "routes"]) ||
    desired.schema !== DESIRED_SCHEMA
  ) {
    return { code: "DESIRED_INVALID" };
  }
  const desiredRevision = revision(desired.revision);
  if (!desiredRevision) return { code: "DESIRED_REVISION_INVALID" };
  if (
    !isPlainObject(desired.policy) ||
    !hasOnlyKeys(desired.policy, ["fallback", "locality"]) ||
    desired.policy.fallback !== "DISABLED" ||
    desired.policy.locality !== "LOCAL_ONLY"
  ) {
    return { code: "FALLBACK_NOT_DISABLED" };
  }
  if (!Array.isArray(desired.bindings) || desired.bindings.length === 0 || !desired.bindings.every(validBinding)) {
    return { code: "DESIRED_BINDINGS_INVALID" };
  }
  if (!uniqueBy(desired.bindings, "id")) return { code: "DESIRED_BINDING_DUPLICATE" };
  if (!Array.isArray(desired.routes) || desired.routes.length === 0 || !desired.routes.every(validRoute)) {
    return { code: "DESIRED_ROUTES_INVALID" };
  }
  if (!uniqueBy(desired.routes, "role")) return { code: "DESIRED_ROUTE_DUPLICATE" };
  return { desiredRevision };
}

function validObservationBinding(binding) {
  return (
    isPlainObject(binding) &&
    hasOnlyKeys(binding, ["binding_id", "model_id", "observation_state", "runtime_state"]) &&
    ["binding_id", "model_id", "observation_state", "runtime_state"].every((key) => nonEmptyString(binding[key])) &&
    ["VERIFIED", "UNVERIFIED"].includes(binding.observation_state) &&
    ["READY", "OFFLINE", "DEGRADED", "FAILED", "STARTING", "BUSY", "UNKNOWN"].includes(binding.runtime_state)
  );
}

function validateObserved(observed) {
  if (!isPlainObject(observed) || deepSecretField(observed)) return { code: "OBSERVATION_INVALID" };
  if (
    !hasOnlyKeys(observed, ["schema", "mr_revision", "freshness_state", "bindings"]) ||
    observed.schema !== OBSERVATION_SCHEMA
  ) {
    return { code: "OBSERVATION_INVALID" };
  }
  const observedRevision = revision(observed.mr_revision);
  if (!observedRevision) return { code: "OBSERVATION_REVISION_INVALID" };
  if (!["FRESH", "STALE", "UNKNOWN"].includes(observed.freshness_state)) {
    return { code: "OBSERVATION_INVALID" };
  }
  if (!Array.isArray(observed.bindings) || !observed.bindings.every(validObservationBinding)) {
    return { code: "OBSERVATION_INVALID" };
  }
  if (!uniqueBy(observed.bindings, "binding_id")) return { code: "OBSERVATION_BINDING_DUPLICATE" };
  return { observedRevision };
}

function validateRequest(request) {
  if (
    !isPlainObject(request) ||
    !hasOnlyKeys(request, ["role", "locality", "authority_class"]) ||
    !nonEmptyString(request.role) ||
    !["LOOPBACK", "LOCAL", "EXTERNAL"].includes(request.locality) ||
    !["READ_ONLY", "PROPOSAL_ONLY"].includes(request.authority_class)
  ) {
    return false;
  }
  return true;
}

function validateNativeConfig(nativeConfig) {
  if (nativeConfig === undefined) return { present: false };
  if (!isPlainObject(nativeConfig) || deepSecretField(nativeConfig)) {
    return { code: "RAW_SECRET_REFUSED" };
  }
  if (
    !hasOnlyKeys(nativeConfig, ["source", "requested_binding_id", "requested_model_id"]) ||
    !["environment", "native_config"].includes(nativeConfig.source) ||
    (nativeConfig.requested_binding_id !== undefined && !nonEmptyString(nativeConfig.requested_binding_id)) ||
    (nativeConfig.requested_model_id !== undefined && !nonEmptyString(nativeConfig.requested_model_id))
  ) {
    return { code: "NATIVE_CONFIG_INVALID" };
  }
  return { present: true };
}

function primaryDiagnostic(binding, observedBinding, request) {
  if (binding.admission_state !== "ACTIVE") return "BINDING_NOT_ACTIVE";
  if (binding.qualification_state !== "QUALIFIED") return "BINDING_NOT_QUALIFIED";
  if (!binding.roles.includes(request.role)) return "ROLE_REFUSED";
  if (binding.locality !== request.locality || binding.locality === "EXTERNAL") return "LOCALITY_REFUSED";
  if (binding.authority_class !== request.authority_class) return "AUTHORITY_REFUSED";
  if (observedBinding.model_id !== binding.model_id) return "OBSERVATION_MODEL_MISMATCH";
  if (observedBinding.observation_state !== "VERIFIED") return "OBSERVATION_NOT_VERIFIED";
  if (observedBinding.runtime_state !== "READY") return "PRIMARY_NOT_READY";
  return null;
}

// Desired MR state is authoritative. The optional native input is only an
// observable declaration: matching it changes no route; a disagreement refuses.
export function resolveDemaMasterRegistryEffectiveConfig({
  desired,
  observed,
  request,
  native_config: nativeConfig,
} = {}) {
  const desiredCheck = validateDesired(desired);
  if (desiredCheck.code) return refused(desiredCheck.code, "desired", request);
  if (!validateRequest(request)) return refused("REQUEST_INVALID", "request", request);
  const observedCheck = validateObserved(observed);
  if (observedCheck.code) return unknown(observedCheck.code, "observation", desiredCheck.desiredRevision, request);
  if (!revisionMatches(desiredCheck.desiredRevision, observedCheck.observedRevision)) {
    return unknown("OBSERVATION_REVISION_MISMATCH", "observation", desiredCheck.desiredRevision, request);
  }
  if (observed.freshness_state === "UNKNOWN") {
    return unknown("OBSERVATION_FRESHNESS_UNKNOWN", "observation", desiredCheck.desiredRevision, request);
  }
  if (observed.freshness_state === "STALE") {
    return unknown("OBSERVATION_STALE", "observation", desiredCheck.desiredRevision, request);
  }

  const nativeCheck = validateNativeConfig(nativeConfig);
  if (nativeCheck.code) return refused(nativeCheck.code, "native_config", request);

  const route = desired.routes.find((candidate) => candidate.role === request.role);
  if (!route) return refused("ROUTE_UNKNOWN", "desired", request);
  const binding = desired.bindings.find((candidate) => candidate.id === route.primary_binding_id);
  if (!binding) return refused("PRIMARY_BINDING_UNKNOWN", "desired", request);
  const observedBinding = observed.bindings.find((candidate) => candidate.binding_id === binding.id);
  if (!observedBinding) {
    return unknown("OBSERVATION_MISSING", "observation", desiredCheck.desiredRevision, request, ["binding_id"]);
  }

  const primaryFailure = primaryDiagnostic(binding, observedBinding, request);
  if (primaryFailure) return refused(primaryFailure, "resolution", request);

  if (
    nativeCheck.present &&
    ((nativeConfig.requested_binding_id !== undefined && nativeConfig.requested_binding_id !== binding.id) ||
      (nativeConfig.requested_model_id !== undefined && nativeConfig.requested_model_id !== binding.model_id))
  ) {
    return refused("CONFIG_CONFLICT", "native_config", request, ["requested_binding_id", "requested_model_id"]);
  }

  const diagnostics = nativeCheck.present
    ? [diagnostic("NATIVE_CONFIG_NON_AUTHORITATIVE", "native_config", ["source"])]
    : [];
  return result({
    resolution_status: "EFFECTIVE",
    decision: "SELECT",
    mr_revision: desiredCheck.desiredRevision,
    request,
    selected_route: {
      role: request.role,
      binding_id: binding.id,
      capability_class: binding.capability_class,
      model_id: binding.model_id,
      locality: binding.locality,
      authority_class: binding.authority_class,
    },
    diagnostics,
  });
}

export function buildDemaMasterRegistryEffectiveConfigPayload(input) {
  const resolution = resolveDemaMasterRegistryEffectiveConfig(input);
  const body = {
    ...resolution,
    canonicalization_algorithm: CANONICAL_JSON_V1_ALGORITHM,
    hash_algorithm: "sha256",
    text_encoding: "utf-8",
  };
  return deepFreeze({ ...body, content_hash: sha256CanonicalJsonV1(body) });
}

function boundaryIsAllFalse(boundary) {
  if (!isPlainObject(boundary) || !hasOnlyKeys(boundary, Object.keys(BOUNDARY))) return false;
  return Object.entries(BOUNDARY).every(([key, expected]) => boundary[key] === expected);
}

function validSelectedRoute(route) {
  return (
    isPlainObject(route) &&
    hasOnlyKeys(route, ["role", "binding_id", "capability_class", "model_id", "locality", "authority_class"]) &&
    ["role", "binding_id", "capability_class", "model_id", "locality", "authority_class"].every((key) => nonEmptyString(route[key])) &&
    ["INFERENCE_PROVIDER", "AGENT_CLIENT"].includes(route.capability_class) &&
    ["LOOPBACK", "LOCAL"].includes(route.locality) &&
    ["READ_ONLY", "PROPOSAL_ONLY"].includes(route.authority_class)
  );
}

export function verifyDemaMasterRegistryEffectiveConfig(payload, input) {
  const blocked_by = [];
  if (!isPlainObject(payload)) {
    blocked_by.push("payload_not_object");
  } else {
    const { content_hash, ...body } = payload;
    if (!HASH_PATTERN.test(content_hash || "")) blocked_by.push("content_hash_invalid");
    try {
      if (sha256CanonicalJsonV1(body) !== content_hash) blocked_by.push("content_hash_mismatch");
    } catch {
      blocked_by.push("content_hash_unverifiable");
    }
    if (input === undefined) {
      blocked_by.push("independent_input_required");
    } else {
      try {
        if (buildDemaMasterRegistryEffectiveConfigPayload(input).content_hash !== content_hash) {
          blocked_by.push("independent_rederivation_mismatch");
        }
      } catch {
        blocked_by.push("independent_rederivation_unverifiable");
      }
    }
    if (payload.schema !== DEMA_MASTER_REGISTRY_EFFECTIVE_CONFIG_SCHEMA) blocked_by.push("schema_mismatch");
    if (payload.truth_label !== DEMA_MASTER_REGISTRY_EFFECTIVE_CONFIG_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");
    if (!boundaryIsAllFalse(payload.boundary)) blocked_by.push("boundary_not_all_false");
    if (payload.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
    if (payload.fallback?.policy !== "DISABLED" || payload.fallback?.activated !== false) {
      blocked_by.push("fallback_not_disabled");
    }
    if (payload.resolution_status === "EFFECTIVE") {
      if (payload.decision !== "SELECT" || !validSelectedRoute(payload.selected_route)) {
        blocked_by.push("effective_route_invalid");
      }
    } else if (["REFUSED", "UNKNOWN"].includes(payload.resolution_status)) {
      if (payload.selected_route !== null || payload.decision !== (payload.resolution_status === "REFUSED" ? "REFUSE" : "UNKNOWN")) {
        blocked_by.push("non_effective_selection_invalid");
      }
    } else {
      blocked_by.push("resolution_status_invalid");
    }
    if (!Array.isArray(payload.diagnostics) || payload.diagnostics.some((item) => !isPlainObject(item) || !nonEmptyString(item.code))) {
      blocked_by.push("diagnostics_invalid");
    }
  }
  return deepFreeze({
    ok: blocked_by.length === 0,
    schema: DEMA_MASTER_REGISTRY_EFFECTIVE_CONFIG_SCHEMA,
    truth_label: DEMA_MASTER_REGISTRY_EFFECTIVE_CONFIG_TRUTH_LABEL,
    authority_delta: 0,
    boundary: demaMasterRegistryEffectiveConfigBoundary(),
    blocked_by,
  });
}

export function runDemaMasterRegistryEffectiveConfig({ input } = {}) {
  const payload = buildDemaMasterRegistryEffectiveConfigPayload(input);
  const verified = verifyDemaMasterRegistryEffectiveConfig(payload, input);
  const tampered = verifyDemaMasterRegistryEffectiveConfig(
    { ...payload, authority_delta: 1 },
    input,
  );
  const blocked_by = [...verified.blocked_by];
  if (payload.resolution_status !== "EFFECTIVE") blocked_by.push("resolution_not_effective");
  if (tampered.ok) blocked_by.push("tamper_not_rejected");
  return deepFreeze({
    ...payload,
    ok: blocked_by.length === 0,
    blocked_by,
    tamper_rejected: tampered.ok === false,
  });
}
