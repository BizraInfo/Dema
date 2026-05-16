// Operating canon (per docs/02-architecture/dema-mcp-capability-descriptor-v0.1.md):
//   MCP describes capability.
//   The descriptor records what could happen.
//   The descriptor does not grant authority.
//   The descriptor does not invoke the tool.

export const MCP_CAPABILITY_DESCRIPTOR_PREVIEW_SCHEMA =
  "bizra.dema.mcp_capability_descriptor_preview.v0.1";

const VALID_OPERATIONS = new Set(["read", "write", "execute", "call"]);
const VALID_RESOURCE_TYPES = new Set(["file", "path", "command", "service"]);
const VALID_MICRO_CONSENT_FIELDS = new Set([
  "mission_id",
  "agent_id",
  "resource_id",
  "action",
  "purpose",
  "expires_at",
  "commitment_hash"
]);
const VALID_GATE_VERDICTS = new Set(["PERMIT", "REJECT", "REVIEW", "SCORE_ONLY"]);

const BOUNDARY = {
  runtime: false,
  federation: false,
  mint: false,
  mcp_server_invoked: false,
  network_used: false,
  credential_persisted: false,
  authority_imported: false,
  remote_access_granted: false
};

function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isArrayOfStringsIn(arr, allowed) {
  if (!Array.isArray(arr)) return false;
  for (const entry of arr) {
    if (typeof entry !== "string" || !allowed.has(entry)) return false;
  }
  return true;
}

function intersects(a, b) {
  const setB = new Set(b);
  for (const x of a) {
    if (setB.has(x)) return true;
  }
  return false;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function failDescriptor(code, detail, now) {
  const generated_at = isValidDate(now) ? now.toISOString() : null;
  return deepFreeze(clone({
    schema: MCP_CAPABILITY_DESCRIPTOR_PREVIEW_SCHEMA,
    mode: "PREVIEW_ONLY",
    truth_label: "DECLARED",
    valid: false,
    source: "mcp",
    invocable_now: false,
    generated_at,
    denial: { code, detail },
    boundary: BOUNDARY
  }));
}

export function buildMcpCapabilityDescriptorPreview({
  tool_id,
  declared_effects,
  denied_effects,
  resource_type,
  consent_field_required,
  sat_verdict_required,
  now = new Date()
} = {}) {
  if (!isValidDate(now)) {
    return failDescriptor("invalid_now", "now must be a valid Date", null);
  }
  if (!nonEmptyString(tool_id)) {
    return failDescriptor("invalid_tool_id", "tool_id must be a non-empty string", now);
  }
  if (!isArrayOfStringsIn(declared_effects, VALID_OPERATIONS)) {
    return failDescriptor(
      "invalid_declared_effects",
      "declared_effects must be an array of strings, each in OPERATIONS {read, write, execute, call}",
      now
    );
  }
  if (!isArrayOfStringsIn(denied_effects, VALID_OPERATIONS)) {
    return failDescriptor(
      "invalid_denied_effects",
      "denied_effects must be an array of strings, each in OPERATIONS {read, write, execute, call}",
      now
    );
  }
  if (intersects(declared_effects, denied_effects)) {
    return failDescriptor(
      "effects_overlap",
      "declared_effects and denied_effects must not share any operation",
      now
    );
  }
  if (typeof resource_type !== "string" || !VALID_RESOURCE_TYPES.has(resource_type)) {
    return failDescriptor(
      "invalid_resource_type",
      "resource_type must be one of RESOURCE_TYPES {file, path, command, service}",
      now
    );
  }
  if (consent_field_required !== null) {
    if (typeof consent_field_required !== "string" || !VALID_MICRO_CONSENT_FIELDS.has(consent_field_required)) {
      return failDescriptor(
        "invalid_consent_field_required",
        "consent_field_required must be one of MICRO_CONSENT_SHAPE or null",
        now
      );
    }
  }
  if (typeof sat_verdict_required !== "string" || !VALID_GATE_VERDICTS.has(sat_verdict_required)) {
    return failDescriptor(
      "invalid_sat_verdict_required",
      "sat_verdict_required must be one of GateVerdict {PERMIT, REJECT, REVIEW, SCORE_ONLY}",
      now
    );
  }
  if ((declared_effects.includes("execute") || declared_effects.includes("call"))
      && sat_verdict_required !== "REVIEW") {
    return failDescriptor(
      "execute_or_call_requires_review",
      "declared_effects containing 'execute' or 'call' require sat_verdict_required === 'REVIEW' in v0.1",
      now
    );
  }

  return deepFreeze(clone({
    schema: MCP_CAPABILITY_DESCRIPTOR_PREVIEW_SCHEMA,
    mode: "PREVIEW_ONLY",
    truth_label: "DECLARED",
    valid: true,
    source: "mcp",
    tool_id,
    declared_effects: [...declared_effects],
    denied_effects: [...denied_effects],
    resource_type,
    consent_field_required,
    sat_verdict_required,
    invocable_now: false,
    generated_at: now.toISOString(),
    boundary: BOUNDARY
  }));
}
