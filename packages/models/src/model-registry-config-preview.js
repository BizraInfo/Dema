// Local Model Registry Config Preview — v0.1.
//
// Pure-JS companion to packages/models/src/model-broker-preview.js.
//
// The broker consumes a registry array; this module produces that array.
// The default sample registry contains six honest placeholder entries
// (one per architect-named role), each labeled status=source_pending and
// locality=unknown so that a broker built from the sample alone routes
// nothing in default mode. The operator's real local-model configuration
// stays outside the repo (under ~/.dema/models/ in a future v0.2 slice)
// per ADR-004 (local-first memory) and the architect-locked law
// feedback_no_invented_evidence_source — no real model names enter the
// repo until evidence or operator-local binding exists.
//
// This module:
//   - exports a frozen DEFAULT_SAMPLE_REGISTRY (6 source_pending placeholders)
//   - exports buildRegistryFromConfig({ entries }) → frozen registry array
//   - exports mergeRegistries(sample, operator) with operator-wins precedence
//   - exports validateRegistryEntry(entry) → boolean
//   - re-exports broker constants/helpers for convenience
//
// This module does NOT:
//   - read any file
//   - make any network call
//   - load any model
//   - invoke any model
//   - start any process
//   - mutate the receipt store
//
// Canon refs:
//   - CLAIM_REGISTER_v0_1.md
//   - BIZRA_AGENT_DNA_LAW_OF_ASSUMPTION_v0_1.md
//   - DEMA_AGENT_HARNESS_AND_SKILL_DNA_v0_1.md
//   - NODE0_DEMA_COMPLETE_COMPONENT_DNA_v0_1.md

import {
  BROKER_ROLES,
  BROKER_SIZE_CLASSES,
  sanitizeRegistryEntry
} from "./model-broker-preview.js";

export { BROKER_ROLES, BROKER_SIZE_CLASSES, sanitizeRegistryEntry };

export const LOCAL_MODEL_REGISTRY_CONFIG_SCHEMA =
  "bizra.dema.local_model_registry_config_preview.v0.1";

// Six placeholder entries, one per architect-named role. Each placeholder
// declares status=source_pending and locality=unknown so the broker's
// safety rules reject it from default routing. The operator must supply
// real config (via a future v0.2 file-loading slice with explicit
// consent) for routing to succeed.
//
// max_concurrency=0 is chosen for placeholders to mark them as
// "not-yet-configured" — the broker's sanitizeRegistryEntry accepts
// 0 (the validator requires >= 0), but a value of 0 means no concurrent
// invocations are permitted, which is the honest default for an
// undeclared model. The operator overrides this with their own number
// when they declare a real model.
function placeholderEntry(role) {
  return Object.freeze({
    id: `operator-${role.replace(/_/g, "-")}-placeholder`,
    provider: "unknown",
    model_name: `operator-${role.replace(/_/g, "-")}-placeholder`,
    role,
    size_class: "unknown",
    locality: "unknown",
    allowed_tasks: Object.freeze([]),
    max_concurrency: 0,
    context_limit: null,
    status: "source_pending"
  });
}

const PLACEHOLDER_ROLES = Object.freeze([
  "dema_face",
  "pat_worker",
  "sat_validator",
  "router",
  "classifier",
  "consent_detector"
]);

export const DEFAULT_SAMPLE_REGISTRY = Object.freeze(
  PLACEHOLDER_ROLES.map((role) => placeholderEntry(role))
);

// Minimum required fields for a registry entry — used by validateRegistryEntry
// before deferring to the broker's sanitizer for full shape enforcement.
const REQUIRED_REGISTRY_FIELDS = Object.freeze([
  "id",
  "role",
  "size_class",
  "locality",
  "status"
]);

// Validate the minimum-shape contract. Returns boolean (true = valid).
// Does not throw — fail-closed via boolean per existing repo convention
// (the broker's sanitizer also returns null rather than throwing).
export function validateRegistryEntry(entry) {
  if (!entry || typeof entry !== "object") return false;
  for (const field of REQUIRED_REGISTRY_FIELDS) {
    if (!(field in entry)) return false;
  }
  if (typeof entry.id !== "string" || entry.id.length === 0) return false;
  if (typeof entry.role !== "string" || !BROKER_ROLES.includes(entry.role)) return false;
  if (typeof entry.size_class !== "string" || !BROKER_SIZE_CLASSES.includes(entry.size_class)) return false;
  if (!["local", "remote", "disabled", "unknown"].includes(entry.locality)) return false;
  if (!["active", "available", "disabled", "source_pending"].includes(entry.status)) return false;
  return true;
}

function buildRegistryArray(entries) {
  if (!Array.isArray(entries)) return Object.freeze([]);
  const sanitized = [];
  for (const entry of entries) {
    // Pass through the broker's sanitizer. Malformed entries return null
    // and are dropped. Valid entries are returned frozen by the broker
    // sanitizer.
    const clean = sanitizeRegistryEntry(entry);
    if (clean !== null) sanitized.push(clean);
  }
  return Object.freeze(sanitized);
}

// Build a frozen registry array from a config input object. Accepts:
//   { entries: [...] }       — primary form
//   [...]                    — also accepted (array passed directly)
//   anything else            — returns frozen empty array
// No file I/O. No network. No side effects.
export function buildRegistryFromConfig(configInput) {
  if (Array.isArray(configInput)) return buildRegistryArray(configInput);
  if (configInput && typeof configInput === "object" && Array.isArray(configInput.entries)) {
    return buildRegistryArray(configInput.entries);
  }
  return Object.freeze([]);
}

// Merge two registries with operator-wins precedence on id conflicts.
// Returns a new frozen registry array. Does not mutate inputs.
// Either argument may be missing/null/non-array — treated as empty.
export function mergeRegistries(sampleRegistry, operatorRegistry) {
  const sample = Array.isArray(sampleRegistry) ? sampleRegistry : [];
  const operator = Array.isArray(operatorRegistry) ? operatorRegistry : [];

  // Build id → entry map starting with sample, then overwrite with operator.
  const merged = new Map();
  for (const entry of sample) {
    const clean = sanitizeRegistryEntry(entry);
    if (clean !== null) merged.set(clean.id, clean);
  }
  for (const entry of operator) {
    const clean = sanitizeRegistryEntry(entry);
    if (clean !== null) merged.set(clean.id, clean);
  }
  return Object.freeze(Array.from(merged.values()));
}

// Optional: re-export the schema in a way that callers can compose a
// config-envelope object if they want one. This module's primary
// contract is the array-returning functions above, but the schema is
// available for any caller (e.g., a future CLI) that wants to wrap the
// array in a schema-tagged envelope.
export function buildLocalModelRegistryConfigPreview(configInput) {
  const registry = buildRegistryFromConfig(configInput);
  return Object.freeze({
    schema: LOCAL_MODEL_REGISTRY_CONFIG_SCHEMA,
    mode: "PREVIEW_ONLY",
    source: "config_input",
    registry,
    placeholder_roles: Array.from(PLACEHOLDER_ROLES),
    canon_refs: Object.freeze([
      "CLAIM_REGISTER_v0_1.md",
      "BIZRA_AGENT_DNA_LAW_OF_ASSUMPTION_v0_1.md",
      "DEMA_AGENT_HARNESS_AND_SKILL_DNA_v0_1.md",
      "NODE0_DEMA_COMPLETE_COMPONENT_DNA_v0_1.md"
    ]),
    boundary: Object.freeze({
      runtime: false,
      file_io: false,
      network_used: false,
      model_invocation: false,
      federation: false,
      mint: false,
      token_economy: false,
      urp_networking: false
    })
  });
}
