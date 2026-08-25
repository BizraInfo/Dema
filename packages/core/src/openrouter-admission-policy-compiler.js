// OPENROUTER-ADMISSION-POLICY-COMPILER-1A — pure external-route admission.
//
// This kernel compiles supplied configuration into a non-executable OpenRouter
// request plan. It never reads a key, sends a prompt, invokes a provider, or
// asks for or consumes consent. A future governed runtime must separately bind
// the plan to exact human consent and a real, observed external invocation.

import { CANONICAL_JSON_V1_ALGORITHM } from "../../canon/src/canonical-json-v1.js";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";

export const OPENROUTER_ADMISSION_POLICY_COMPILER_SCHEMA =
  "bizra.dema.openrouter_admission_policy_compiler.v0.1";
export const OPENROUTER_ADMISSION_POLICY_COMPILER_TRUTH_LABEL =
  "OPENROUTER_ADMISSION_POLICY_COMPILER_MEASURED_REPO";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;
const MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*(?::[a-z0-9._-]+)?$/i;
const REFERENCE_PATTERN = /^native_auth\/openrouter$/;
const SECRET_FIELD_PATTERN = /(?:api[_-]?key|authorization|credential|password|secret|token)/i;
const SECRET_REFERENCE_PATTERN = /(?:credential|secret|token)_ref(?:erence)?$/i;

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
  credit_action_performed: false,
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

function uniqueStrings(values) {
  return Array.isArray(values) && values.length > 0 && values.every(nonEmptyString) && new Set(values).size === values.length;
}

function hasRawSecret(value, seen = new Set()) {
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return true;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => hasRawSecret(item, seen));
  if (!isPlainObject(value)) return true;
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_FIELD_PATTERN.test(key) && !SECRET_REFERENCE_PATTERN.test(key)) return true;
    if (hasRawSecret(item, seen)) return true;
  }
  return false;
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

function diagnostic(code, plane, fields = []) {
  return Object.freeze({ code, plane, fields: Object.freeze([...fields]) });
}

export function openrouterAdmissionPolicyCompilerBoundary() {
  return Object.freeze({ ...BOUNDARY });
}

function result({ compilation_status, decision, mr_revision = null, plan = null, diagnostics = [] }) {
  return deepFreeze({
    schema: OPENROUTER_ADMISSION_POLICY_COMPILER_SCHEMA,
    truth_label: OPENROUTER_ADMISSION_POLICY_COMPILER_TRUTH_LABEL,
    compilation_status,
    decision,
    processing_classification: "EXTERNAL_PROCESSING",
    mr_revision,
    consent: { required: true, status: "NOT_REQUESTED" },
    plan,
    diagnostics: [...diagnostics],
    authority_delta: 0,
    boundary: openrouterAdmissionPolicyCompilerBoundary(),
  });
}

function refused(code, plane, mrRevision = null, fields = []) {
  return result({
    compilation_status: "REFUSED",
    decision: "REFUSE",
    mr_revision: mrRevision,
    diagnostics: [diagnostic(code, plane, fields)],
  });
}

function validateInput(input) {
  if (!isPlainObject(input)) return { code: "INPUT_INVALID", plane: "input" };
  if (hasRawSecret(input)) return { code: "RAW_SECRET_REFUSED", plane: "input" };
  if (!hasOnlyKeys(input, ["mr_revision", "route", "policy"])) {
    return { code: "INPUT_INVALID", plane: "input" };
  }
  const mrRevision = revision(input.mr_revision);
  if (!mrRevision) return { code: "MR_REVISION_INVALID", plane: "mr_revision" };

  const route = input.route;
  if (
    !isPlainObject(route) ||
    !hasOnlyKeys(route, ["binding_id", "model_id", "locality", "authority_class", "purpose"]) ||
    !nonEmptyString(route.binding_id) ||
    !nonEmptyString(route.model_id) ||
    route.locality !== "EXTERNAL" ||
    route.authority_class !== "PROPOSAL_ONLY" ||
    !["EXPERIMENTAL_EVALUATION", "EXTERNAL_SPECIALIST"].includes(route.purpose)
  ) {
    return { code: "EXTERNAL_ROUTE_INVALID", plane: "route", mrRevision };
  }
  if (route.model_id === "openrouter/free") {
    return { code: "RANDOM_FREE_ROUTER_REFUSED", plane: "route", mrRevision, fields: ["model_id"] };
  }
  if (!MODEL_ID_PATTERN.test(route.model_id)) {
    return { code: "MODEL_ID_INVALID", plane: "route", mrRevision, fields: ["model_id"] };
  }
  if (route.model_id.endsWith(":free") && route.purpose !== "EXPERIMENTAL_EVALUATION") {
    return { code: "FREE_VARIANT_EVALUATION_ONLY", plane: "route", mrRevision, fields: ["purpose"] };
  }

  const policy = input.policy;
  if (
    !isPlainObject(policy) ||
    !hasOnlyKeys(policy, [
      "provider_id",
      "credential_ref",
      "underlying_provider_allowlist",
      "fallback",
      "data_collection",
      "zero_data_retention",
      "router_metadata",
    ])
  ) {
    return { code: "POLICY_INVALID", plane: "policy", mrRevision };
  }
  if (policy.provider_id !== "openrouter") {
    return { code: "PROVIDER_REFUSED", plane: "policy", mrRevision, fields: ["provider_id"] };
  }
  if (!REFERENCE_PATTERN.test(policy.credential_ref || "")) {
    return { code: "CREDENTIAL_REFERENCE_INVALID", plane: "policy", mrRevision, fields: ["credential_ref"] };
  }
  if (!uniqueStrings(policy.underlying_provider_allowlist)) {
    return { code: "PROVIDER_ALLOWLIST_INVALID", plane: "policy", mrRevision, fields: ["underlying_provider_allowlist"] };
  }
  if (policy.fallback !== "DISABLED") {
    return { code: "FALLBACK_NOT_DISABLED", plane: "policy", mrRevision, fields: ["fallback"] };
  }
  if (policy.data_collection !== "DENY") {
    return { code: "DATA_COLLECTION_NOT_DENIED", plane: "policy", mrRevision, fields: ["data_collection"] };
  }
  if (policy.zero_data_retention !== "REQUIRED") {
    return { code: "ZDR_NOT_REQUIRED", plane: "policy", mrRevision, fields: ["zero_data_retention"] };
  }
  if (policy.router_metadata !== "REQUIRED") {
    return { code: "ROUTER_METADATA_NOT_REQUIRED", plane: "policy", mrRevision, fields: ["router_metadata"] };
  }
  return { mrRevision, route, policy };
}

export function compileOpenrouterAdmissionPolicy(input) {
  const validated = validateInput(input);
  if (validated.code) {
    return refused(validated.code, validated.plane, validated.mrRevision || null, validated.fields || []);
  }
  const { mrRevision, route, policy } = validated;
  return result({
    compilation_status: "ADMITTED",
    decision: "COMPILE",
    mr_revision: mrRevision,
    plan: {
      binding_id: route.binding_id,
      model_id: route.model_id,
      locality: "EXTERNAL",
      authority_class: "PROPOSAL_ONLY",
      purpose: route.purpose,
      endpoint: "https://openrouter.ai/api/v1/chat/completions",
      method: "POST",
      credential_ref: policy.credential_ref,
      request_headers: {
        "Content-Type": "application/json",
        "X-OpenRouter-Metadata": "enabled",
      },
      provider: {
        only: [...policy.underlying_provider_allowlist],
        allow_fallbacks: false,
        data_collection: "deny",
        zdr: true,
      },
    },
  });
}

export function buildOpenrouterAdmissionPolicyCompilerPayload(input) {
  const compilation = compileOpenrouterAdmissionPolicy(input);
  const body = {
    ...compilation,
    canonicalization_algorithm: CANONICAL_JSON_V1_ALGORITHM,
    hash_algorithm: "sha256",
    text_encoding: "utf-8",
  };
  return deepFreeze({ ...body, content_hash: sha256CanonicalJsonV1(body) });
}

function boundaryIsAllFalse(boundary) {
  return (
    isPlainObject(boundary) &&
    hasOnlyKeys(boundary, Object.keys(BOUNDARY)) &&
    Object.entries(BOUNDARY).every(([key, expected]) => boundary[key] === expected)
  );
}

export function verifyOpenrouterAdmissionPolicyCompiler(payload, input) {
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
    if (payload.schema !== OPENROUTER_ADMISSION_POLICY_COMPILER_SCHEMA) blocked_by.push("schema_invalid");
    if (payload.truth_label !== OPENROUTER_ADMISSION_POLICY_COMPILER_TRUTH_LABEL) blocked_by.push("truth_label_invalid");
    if (payload.processing_classification !== "EXTERNAL_PROCESSING") blocked_by.push("processing_classification_invalid");
    if (payload.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
    if (!boundaryIsAllFalse(payload.boundary)) blocked_by.push("boundary_invalid");
    if (!isPlainObject(payload.consent) || payload.consent.required !== true || payload.consent.status !== "NOT_REQUESTED") {
      blocked_by.push("consent_boundary_invalid");
    }
    if (input === undefined) {
      blocked_by.push("independent_input_required");
    } else {
      const expected = buildOpenrouterAdmissionPolicyCompilerPayload(input);
      if (expected.content_hash !== content_hash) blocked_by.push("independent_rederivation_mismatch");
    }
  }
  return deepFreeze({
    ok: blocked_by.length === 0,
    schema: OPENROUTER_ADMISSION_POLICY_COMPILER_SCHEMA,
    truth_label: OPENROUTER_ADMISSION_POLICY_COMPILER_TRUTH_LABEL,
    blocked_by,
  });
}

export function runOpenrouterAdmissionPolicyCompiler({ input } = {}) {
  const payload = buildOpenrouterAdmissionPolicyCompilerPayload(input);
  const verification = verifyOpenrouterAdmissionPolicyCompiler(payload, input);
  const { content_hash, ...body } = payload;
  const tamperedBody = { ...body, authority_delta: 1 };
  const rehashedTamper = {
    ...tamperedBody,
    content_hash: sha256CanonicalJsonV1(tamperedBody),
  };
  const tamperRejected = verifyOpenrouterAdmissionPolicyCompiler(rehashedTamper, input).ok === false;
  const admitted = payload.compilation_status === "ADMITTED" && payload.decision === "COMPILE";
  return deepFreeze({
    ...payload,
    ok: verification.ok && admitted && tamperRejected,
    blocked_by: [
      ...verification.blocked_by,
      ...(admitted ? [] : ["compilation_not_admitted"]),
      ...(tamperRejected ? [] : ["tamper_not_rejected"]),
    ],
    tamper_rejected: tamperRejected,
  });
}
