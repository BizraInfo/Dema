import { sha256, stableStringify } from "./consent-common.js";

export const CONSENT_HASH_TABLE_SCHEMA = "bizra.dema.consent_hash_table.v0.1";
export const CONSENT_HASH_TABLE_MODE = "PREVIEW_ONLY";

const RESOURCE_TYPES = new Set(["file", "path", "command", "service"]);
const OPERATIONS = new Set(["read", "write", "execute", "call"]);

function boundary() {
  return {
    approval_recorded: false,
    capability_minted: false,
    execution_enabled: false,
    mutation_performed: false,
    receipt_minted: false
  };
}

function denial(code, detail, index = null) {
  return { code, detail, index };
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function parseExpiry(value) {
  if (!nonEmptyString(value)) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

function invalid(code, detail, index = null) {
  return {
    ok: false,
    denial: denial(code, detail, index)
  };
}

function validateConsentFields(value, index, { requireExpiry, now } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      ok: false,
      denial: denial(
        requireExpiry ? "invalid_permission" : "invalid_request",
        requireExpiry ? "permission must be an object" : "lookup request must be an object",
        index
      )
    };
  }

  const {
    resource_type: resourceType,
    resource_id: resourceId,
    operation,
    purpose,
    expires_at: expiresAt
  } = value;

  if (!nonEmptyString(resourceType)) return invalid("missing_resource_type", "resource_type must be a non-empty string", index);
  if (!RESOURCE_TYPES.has(resourceType)) {
    return invalid("unknown_resource_type", `unsupported resource_type: ${resourceType}`, index);
  }
  if (!nonEmptyString(resourceId)) return invalid("missing_resource_id", "resource_id must be a non-empty string", index);
  if (!nonEmptyString(operation)) return invalid("missing_operation", "operation must be a non-empty string", index);
  if (!OPERATIONS.has(operation)) {
    return invalid("unknown_operation", `unsupported operation: ${operation}`, index);
  }
  if (!nonEmptyString(purpose)) return invalid("missing_purpose", "purpose must be a non-empty string", index);

  const fields = {
    resource_type: resourceType,
    resource_id: resourceId,
    operation,
    purpose
  };

  if (requireExpiry) {
    const expiry = parseExpiry(expiresAt);
    if (expiry === null) {
      return invalid("missing_expiry", "expires_at must be a valid timestamp string", index);
    }
    if (expiry <= now.getTime()) {
      return invalid("expired_scope", `expires_at is not after now: ${expiresAt}`, index);
    }
    fields.expires_at = expiresAt;
  }

  return {
    ok: true,
    fields
  };
}

function validatePermission(permission, index, now) {
  const validated = validateConsentFields(permission, index, { requireExpiry: true, now });
  if (!validated.ok) return validated;
  return { ok: true, permission: validated.fields };
}

export function consentKey({ resource_type: resourceType, resource_id: resourceId, operation }) {
  return `${resourceType}:${resourceId}:${operation}`;
}

function commitmentFor(entries) {
  return `sha256:${sha256(stableStringify(entries))}`;
}

export function buildConsentHashTable({ permissions = [], now = new Date() } = {}) {
  const denials = [];
  const records = Object.create(null);
  const entries = [];

  if (!Array.isArray(permissions)) {
    denials.push(denial("invalid_permissions", "permissions must be an array"));
  } else {
    permissions.forEach((permission, index) => {
      const validated = validatePermission(permission, index, now);
      if (!validated.ok) {
        denials.push(validated.denial);
        return;
      }

      const key = consentKey(validated.permission);
      const entry = { key, ...validated.permission };
      records[key] = entry;
      entries.push(entry);
    });
  }

  const sortedEntries = entries.toSorted((a, b) => a.key.localeCompare(b.key));

  return {
    schema: CONSENT_HASH_TABLE_SCHEMA,
    mode: CONSENT_HASH_TABLE_MODE,
    generated_at: now.toISOString(),
    valid: denials.length === 0,
    entries: sortedEntries,
    records,
    commitment_hash: commitmentFor(sortedEntries),
    denials,
    boundary: boundary()
  };
}

export function verifyConsentHashTable(table) {
  const entries = Array.isArray(table?.entries) ? table.entries : [];
  const expected = commitmentFor(entries);
  const actual = table?.commitment_hash;
  const ok = actual === expected;

  return {
    schema: CONSENT_HASH_TABLE_SCHEMA,
    mode: CONSENT_HASH_TABLE_MODE,
    ok,
    expected_commitment_hash: expected,
    actual_commitment_hash: actual ?? null,
    boundary: boundary()
  };
}

function validateLookupRequest(request) {
  const validated = validateConsentFields(request, null, { requireExpiry: false });
  if (!validated.ok) return validated;
  return { ok: true, request: validated.fields };
}

export function lookupConsent(table, request, { now = new Date() } = {}) {
  const validated = validateLookupRequest(request);

  if (!validated.ok) {
    return {
      schema: CONSENT_HASH_TABLE_SCHEMA,
      mode: CONSENT_HASH_TABLE_MODE,
      allowed: false,
      reason: validated.denial.code,
      detail: validated.denial.detail,
      key: null,
      boundary: boundary()
    };
  }

  const integrity = verifyConsentHashTable(table);
  if (!integrity.ok) {
    return {
      schema: CONSENT_HASH_TABLE_SCHEMA,
      mode: CONSENT_HASH_TABLE_MODE,
      allowed: false,
      reason: "commitment_hash_mismatch",
      detail: "ConsentHashTable entries do not match commitment_hash.",
      key: consentKey(validated.request),
      integrity,
      boundary: boundary()
    };
  }

  const key = consentKey(validated.request);
  const entry = table?.records?.[key] ?? table?.entries?.find((candidate) => candidate.key === key);
  if (!entry) {
    return {
      schema: CONSENT_HASH_TABLE_SCHEMA,
      mode: CONSENT_HASH_TABLE_MODE,
      allowed: false,
      reason: "permission_not_found",
      detail: `No exact consent scope for ${key}`,
      key,
      boundary: boundary()
    };
  }

  const expiry = parseExpiry(entry.expires_at);
  if (expiry === null || expiry <= now.getTime()) {
    return {
      schema: CONSENT_HASH_TABLE_SCHEMA,
      mode: CONSENT_HASH_TABLE_MODE,
      allowed: false,
      reason: "expired_scope",
      detail: `Consent scope expired for ${key}`,
      key,
      boundary: boundary()
    };
  }

  return {
    schema: CONSENT_HASH_TABLE_SCHEMA,
    mode: CONSENT_HASH_TABLE_MODE,
    allowed: true,
    reason: "exact_consent_scope_found",
    key,
    permission: entry,
    boundary: boundary()
  };
}
