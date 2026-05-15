import {
  SCHEMA as CONSENT_PLAN_SCHEMA,
  sha256,
  stableStringify
} from "./consent-common.js";
import { buildConsentPlanPreview } from "./consent-planner.js";

export const CONSENT_HASH_TABLE_PREVIEW_SCHEMA = "bizra.dema.consent_hash_table_preview.v0.1";
export const CONSENT_HASH_LOOKUP_PREVIEW_SCHEMA = "bizra.dema.consent_hash_lookup_preview.v0.1";
export const CONSENT_HASH_VERIFICATION_PREVIEW_SCHEMA = "bizra.dema.consent_hash_table_verification_preview.v0.1";

const MODE = "PREVIEW_ONLY";
const TRUTH_LABEL = "DECLARED";
const RESOURCE_TYPES = new Set(["file", "path", "command", "service"]);
const OPERATIONS = new Set(["read", "write", "execute", "call"]);

const POLICY = {
  exact_lookup_only: true,
  revocation_precedes_allow: true,
  expires_at_required: true,
  secrets_in_commitment_payload: false
};

const BOUNDARY = {
  scope: "read-only-preview",
  approval_recorded: false,
  runtime_execution: false,
  execution_enabled: false,
  mutation_performed: false,
  filesystem_write_performed: false,
  capability_minted: false,
  receipt_minted: false,
  network_connection_attempted: false,
  federation_initiated: false,
  step7_mint_performed: false,
  external_posting_performed: false
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function digest(value) {
  return `sha256:${sha256(stableStringify(value))}`;
}

function denial(code, detail, index = null) {
  return { code, detail, index };
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function stripUndefined(value) {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (!isObject(value)) return value;

  const next = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) next[key] = stripUndefined(item);
  }
  return next;
}

function parseIsoTime(value) {
  if (!nonEmptyString(value)) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

function parsePermissionResource(resourceId) {
  if (!nonEmptyString(resourceId)) {
    return { ok: false, code: "missing_resource_id", detail: "resource_id must be a non-empty string" };
  }

  const separator = resourceId.indexOf(":");
  if (separator <= 0 || separator === resourceId.length - 1) {
    return { ok: false, code: "invalid_resource_id", detail: "resource_id must use <resource_type>:<resource_id>" };
  }

  const resourceType = resourceId.slice(0, separator);
  const resourceTail = resourceId.slice(separator + 1);
  if (!RESOURCE_TYPES.has(resourceType)) {
    return { ok: false, code: "unknown_resource_type", detail: `unsupported resource_type: ${resourceType}` };
  }
  if (!nonEmptyString(resourceTail)) {
    return { ok: false, code: "missing_resource_id", detail: "resource_id must be a non-empty string" };
  }

  return { ok: true, resource_type: resourceType, resource_id: resourceTail };
}

function canonicalKey({ resource_type: resourceType, resource_id: resourceId, operation }) {
  return `${resourceType}:${resourceId}:${operation}`;
}

function parseCanonicalKey(key) {
  if (!nonEmptyString(key)) return { ok: false, code: "missing_key", detail: "key must be a non-empty string" };

  const first = key.indexOf(":");
  const last = key.lastIndexOf(":");
  if (first <= 0 || last <= first || last === key.length - 1) {
    return { ok: false, code: "invalid_key", detail: "key must use <resource_type>:<resource_id>:<operation>" };
  }

  const resourceType = key.slice(0, first);
  const resourceId = key.slice(first + 1, last);
  const operation = key.slice(last + 1);

  if (!RESOURCE_TYPES.has(resourceType)) {
    return { ok: false, code: "unknown_resource_type", detail: `unsupported resource_type: ${resourceType}` };
  }
  if (!nonEmptyString(resourceId)) {
    return { ok: false, code: "missing_resource_id", detail: "resource_id must be a non-empty string" };
  }
  if (!OPERATIONS.has(operation)) {
    return { ok: false, code: "unknown_operation", detail: `unsupported operation: ${operation}` };
  }

  return {
    ok: true,
    resource_type: resourceType,
    resource_id: resourceId,
    operation,
    key: canonicalKey({ resource_type: resourceType, resource_id: resourceId, operation })
  };
}

function normalizePermission(permission, index, expiresAt) {
  if (!isObject(permission)) {
    return { ok: false, denial: denial("invalid_permission", "permission must be an object", index) };
  }

  const resource = parsePermissionResource(permission.resource_id);
  if (!resource.ok) return { ok: false, denial: denial(resource.code, resource.detail, index) };

  if (!nonEmptyString(permission.action)) {
    return { ok: false, denial: denial("missing_operation", "action must be a non-empty string", index) };
  }
  if (!OPERATIONS.has(permission.action)) {
    return {
      ok: false,
      denial: denial("unknown_operation", `unsupported operation: ${permission.action}`, index)
    };
  }
  if (!nonEmptyString(permission.purpose)) {
    return { ok: false, denial: denial("missing_purpose", "purpose must be a non-empty string", index) };
  }
  if (parseIsoTime(expiresAt) === null) {
    return { ok: false, denial: denial("missing_expiry", "expiresAt must be a valid timestamp string", index) };
  }

  const entry = {
    key: canonicalKey({ resource_type: resource.resource_type, resource_id: resource.resource_id, operation: permission.action }),
    resource_type: resource.resource_type,
    resource_id: resource.resource_id,
    operation: permission.action,
    purpose: permission.purpose,
    expires_at: expiresAt,
    revoked: false,
    source_permission_hash: digest(stripUndefined(permission))
  };

  return { ok: true, entry };
}

function normalizeRevocation(record, index) {
  if (!isObject(record)) return { ok: false, denial: denial("invalid_revocation", "revocation must be an object", index) };

  const parsed = parseCanonicalKey(record.key);
  if (!parsed.ok) return { ok: false, denial: denial(parsed.code, parsed.detail, index) };

  if (parseIsoTime(record.revoked_at) === null) {
    return { ok: false, denial: denial("invalid_revoked_at", "revoked_at must be a valid timestamp string", index) };
  }
  if (!nonEmptyString(record.reason)) {
    return { ok: false, denial: denial("missing_revocation_reason", "reason must be a non-empty string", index) };
  }

  return {
    ok: true,
    revocation: {
      key: parsed.key,
      revoked_at: record.revoked_at,
      reason: record.reason
    }
  };
}

function sortEntries(entries) {
  return entries.toSorted((a, b) => a.key.localeCompare(b.key));
}

function sortRevocations(revocations) {
  return revocations.toSorted((a, b) => (
    a.key.localeCompare(b.key) || a.revoked_at.localeCompare(b.revoked_at)
  ));
}

function buildSource(plan) {
  return {
    plan_schema: plan?.schema ?? null,
    plan_commitment_hash: plan?.commitment_hash ?? null
  };
}

function commitmentPayload({ source, entries, revocations, policy }) {
  return {
    schema: CONSENT_HASH_TABLE_PREVIEW_SCHEMA,
    source,
    entries,
    revocations,
    policy: {
      exact_lookup_only: policy?.exact_lookup_only === true,
      revocation_precedes_allow: policy?.revocation_precedes_allow === true,
      expires_at_required: policy?.expires_at_required === true
    }
  };
}

function commitmentFor(table) {
  return digest(commitmentPayload(table));
}

function emptyTable({ plan, denials }) {
  const source = buildSource(plan);
  const table = {
    schema: CONSENT_HASH_TABLE_PREVIEW_SCHEMA,
    mode: MODE,
    truth_label: TRUTH_LABEL,
    valid: false,
    source,
    policy: clone(POLICY),
    entries: [],
    revocations: [],
    denials,
    commitment_hash: null,
    boundary: clone(BOUNDARY)
  };
  table.commitment_hash = commitmentFor(table);
  return table;
}

export function buildConsentHashTablePreview({
  intent,
  plan,
  expiresAt,
  revoked = [],
  now = new Date()
} = {}) {
  const denials = [];
  let sourcePlan = plan;

  if (!sourcePlan && nonEmptyString(intent)) sourcePlan = buildConsentPlanPreview({ intent, now });

  if (!isObject(sourcePlan)) {
    return emptyTable({ plan: null, denials: [denial("missing_plan", "buildConsentHashTablePreview requires a consent plan or non-empty intent")] });
  }
  if (sourcePlan.schema !== CONSENT_PLAN_SCHEMA) {
    denials.push(denial("invalid_plan_schema", `expected ${CONSENT_PLAN_SCHEMA}`));
  }
  if (!Array.isArray(sourcePlan.permissions)) {
    return emptyTable({ plan: sourcePlan, denials: [...denials, denial("invalid_permissions", "plan.permissions must be an array")] });
  }

  const entries = [];
  sourcePlan.permissions.forEach((permission, index) => {
    const normalized = normalizePermission(permission, index, expiresAt);
    if (normalized.ok) {
      entries.push(normalized.entry);
    } else {
      denials.push(normalized.denial);
    }
  });

  if (!Array.isArray(revoked)) {
    denials.push(denial("invalid_revocations", "revoked must be an array"));
  }
  const revocations = [];
  if (Array.isArray(revoked)) {
    revoked.forEach((record, index) => {
      const normalized = normalizeRevocation(record, index);
      if (normalized.ok) {
        revocations.push(normalized.revocation);
      } else {
        denials.push(normalized.denial);
      }
    });
  }

  const revokedKeys = new Set(revocations.map((record) => record.key));
  const sortedEntries = sortEntries(entries).map((entry) => ({
    ...entry,
    revoked: revokedKeys.has(entry.key)
  }));
  const sortedRevocations = sortRevocations(revocations);

  const table = {
    schema: CONSENT_HASH_TABLE_PREVIEW_SCHEMA,
    mode: MODE,
    truth_label: TRUTH_LABEL,
    valid: false,
    source: buildSource(sourcePlan),
    policy: clone(POLICY),
    entries: sortedEntries,
    revocations: sortedRevocations,
    denials,
    commitment_hash: null,
    boundary: clone(BOUNDARY)
  };
  table.commitment_hash = commitmentFor(table);
  table.valid = verifyConsentHashTablePreview(table).ok && denials.length === 0;
  return table;
}

export function verifyConsentHashTablePreview(table) {
  const expected = commitmentFor({
    source: table?.source ?? buildSource(null),
    entries: Array.isArray(table?.entries) ? table.entries : [],
    revocations: Array.isArray(table?.revocations) ? table.revocations : [],
    policy: table?.policy ?? POLICY
  });
  const actual = table?.commitment_hash ?? null;

  return {
    schema: CONSENT_HASH_VERIFICATION_PREVIEW_SCHEMA,
    mode: MODE,
    ok: actual === expected,
    expected_commitment_hash: expected,
    actual_commitment_hash: actual,
    boundary: clone(BOUNDARY)
  };
}

function validateLookupRequest(request) {
  if (!isObject(request)) {
    return { ok: false, reason: "invalid_request", detail: "lookup request must be an object", key: null };
  }
  if (!nonEmptyString(request.resource_type)) {
    return { ok: false, reason: "missing_resource_type", detail: "resource_type must be a non-empty string", key: null };
  }
  if (!RESOURCE_TYPES.has(request.resource_type)) {
    return {
      ok: false,
      reason: "unknown_resource_type",
      detail: `unsupported resource_type: ${request.resource_type}`,
      key: null
    };
  }
  if (!nonEmptyString(request.resource_id)) {
    return { ok: false, reason: "missing_resource_id", detail: "resource_id must be a non-empty string", key: null };
  }
  if (!nonEmptyString(request.operation)) {
    return { ok: false, reason: "missing_operation", detail: "operation must be a non-empty string", key: null };
  }
  if (!OPERATIONS.has(request.operation)) {
    return {
      ok: false,
      reason: "unknown_operation",
      detail: `unsupported operation: ${request.operation}`,
      key: canonicalKey(request)
    };
  }

  return { ok: true, key: canonicalKey(request) };
}

function lookupResult({ allowed = false, reason, detail, key = null, entry = null, integrity = null }) {
  return {
    schema: CONSENT_HASH_LOOKUP_PREVIEW_SCHEMA,
    mode: MODE,
    allowed,
    not_an_authorization: true,
    reason,
    detail,
    key,
    entry,
    integrity,
    boundary: clone(BOUNDARY)
  };
}

export function lookupConsentHashTablePreview(table, request, { now = new Date() } = {}) {
  const validated = validateLookupRequest(request);
  if (!validated.ok) {
    return lookupResult({ reason: validated.reason, detail: validated.detail, key: validated.key });
  }

  const integrity = verifyConsentHashTablePreview(table);
  if (!integrity.ok) {
    return lookupResult({
      reason: "commitment_hash_mismatch",
      detail: "ConsentHashTable preview entries do not match commitment_hash.",
      key: validated.key,
      integrity
    });
  }

  const entry = table?.entries?.find((candidate) => candidate.key === validated.key);
  if (!entry) {
    return lookupResult({ reason: "permission_not_found", detail: `No exact consent scope for ${validated.key}`, key: validated.key });
  }

  const revoked = entry.revoked === true ||
    table?.revocations?.some((record) => record.key === validated.key);
  if (revoked) {
    return lookupResult({ reason: "revoked_scope", detail: `Consent scope revoked for ${validated.key}`, key: validated.key, entry });
  }

  const expiry = parseIsoTime(entry.expires_at);
  if (expiry === null || expiry <= now.getTime()) {
    return lookupResult({ reason: "expired_scope", detail: `Consent scope expired for ${validated.key}`, key: validated.key, entry });
  }

  return lookupResult({
    allowed: true,
    reason: "exact_consent_scope_found",
    detail: "Preview lookup only. This is not an authorization and cannot execute effects.",
    key: validated.key,
    entry
  });
}

export function formatConsentHashTablePreview(table) {
  const lines = [
    "DEMA ConsentHashTable Preview",
    "",
    `Mode: ${table.mode}`,
    `Truth label: ${table.truth_label}`,
    `Valid: ${table.valid}`,
    `Commitment: ${table.commitment_hash}`,
    `Plan commitment: ${table.source.plan_commitment_hash ?? "none"}`,
    "",
    "Entries:"
  ];

  if (table.entries.length === 0) lines.push("  - none");
  for (const entry of table.entries) {
    lines.push(`  - ${entry.key} expires_at="${entry.expires_at}" revoked=${entry.revoked} purpose="${entry.purpose}"`);
  }

  lines.push("");
  lines.push("Denials:");
  if (table.denials.length === 0) lines.push("  - none");
  for (const item of table.denials) lines.push(`  - ${item.code}: ${item.detail}`);

  lines.push("");
  lines.push(
    "Boundary: preview-only; not an authorization; no approval; no runtime; no execution; no mutation; no capability mint; no receipt mint; no network; no federation; no Step 7 mint."
  );

  return lines.join("\n");
}
