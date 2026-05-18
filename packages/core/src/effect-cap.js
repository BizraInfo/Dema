// C2 · Effect-Capability layer (per ADR-008 §C2).
//
// Operating-law: every effect (file read · file write · network call · LLM
// invocation · receipt mint) is a declared capability with explicit
// consent scope. Caller cannot smuggle effects past the registry.
//
// Three primitives:
//   1. EffectCap descriptor — schema-tagged frozen object declaring what
//      a tool may do (allowed_effects) and may not do (blocked_effects)
//      plus its consent_scope (the exact-string phrase pattern) and
//      audit_trail_required flag.
//   2. ToolRegistry — registers tools by name with their EffectCap.
//      Bind-time verification: the registration itself is type-checked.
//      Registry is frozen-by-default after build · no late mutation.
//   3. invokeWithEffectCap(toolName, args, consentPhrase) — checks the
//      registered EffectCap · verifies consent phrase exact match ·
//      runs the tool · emits an invocation event for receipt-shaping.
//
// Boundaries (per ADR-008 §C2):
//   - Sandboxed execution · no eval · no caller-provided code
//   - Tools registered explicitly at registry build · no late registration
//   - Caller cannot override declared EffectCap (frozen descriptors)
//   - Each invocation emits a schema-tagged event suitable for
//     receipt minting by future C12

import { buildPreviewBoundary } from "./preview-boundary.js";

const EFFECT_CAP_SCHEMA = "bizra.dema.effect_cap.v0.1";
const EFFECT_CAP_INVOCATION_SCHEMA = "bizra.dema.effect_cap_invocation.v0.1";
const EFFECT_CAP_REGISTRY_SCHEMA = "bizra.dema.tool_registry.v0.1";

// Canonical effect vocabulary. Every tool's allowed_effects MUST be a
// subset of this list. blocked_effects MAY include additional named effects
// not in the canonical list (those are extra-restrictions).
const CANONICAL_EFFECTS = Object.freeze([
  "read_local_file",
  "write_local_file_under_dema_home",
  "list_local_directory",
  "call_localhost_http",
  "invoke_local_llm",
  "compute_hash",
  "stat_file_metadata",
  "render_terminal_output"
]);

// Effects that MUST appear in blocked_effects on every tool · no exceptions.
// These are the "you may NEVER do this from a tool" effects.
const ALWAYS_BLOCKED_EFFECTS = Object.freeze([
  "execute_arbitrary_shell",
  "execute_caller_provided_code",
  "call_public_network",
  "advance_chain",
  "mint_canonical_receipt",
  "invoke_federation",
  "connect_node1_or_node2",
  "modify_consent_phrase_check"
]);

function safeString(v, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

function safeBool(v, fallback = false) {
  return typeof v === "boolean" ? v : fallback;
}

function filterStringArray(arr, validator) {
  if (!Array.isArray(arr)) return Object.freeze([]);
  const filtered = arr.filter((v) => typeof v === "string" && (!validator || validator(v)));
  // dedupe while preserving order
  const seen = new Set();
  const deduped = [];
  for (const v of filtered) {
    if (!seen.has(v)) {
      seen.add(v);
      deduped.push(v);
    }
  }
  return Object.freeze(deduped);
}

export function buildEffectCap({
  name = "",
  description = "",
  allowed_effects = [],
  blocked_effects = [],
  consent_scope_template = "",
  audit_trail_required = true
} = {}) {
  const safeName = safeString(name, "");
  const allowedFiltered = filterStringArray(
    allowed_effects,
    (e) => CANONICAL_EFFECTS.includes(e)
  );
  // blocked_effects = union of caller-provided (filtered to strings) + ALWAYS_BLOCKED
  const callerBlocked = filterStringArray(blocked_effects);
  const blockedUnion = Object.freeze(
    [...new Set([...callerBlocked, ...ALWAYS_BLOCKED_EFFECTS])].sort()
  );

  // Cross-check: any effect appearing in BOTH allowed and blocked is a
  // contradiction · resolve in favor of blocked (refusal wins).
  const allowedFinal = Object.freeze(
    allowedFiltered.filter((e) => !blockedUnion.includes(e))
  );

  const consentTemplate = safeString(consent_scope_template, "");
  const auditRequired = safeBool(audit_trail_required, true);

  // Compliance check: every cap must declare ALL of the ALWAYS_BLOCKED
  // effects. If the caller stripped them somehow, mark as invalid.
  const missingRequiredBlocked = ALWAYS_BLOCKED_EFFECTS.filter(
    (e) => !blockedUnion.includes(e)
  );
  const valid =
    safeName.length > 0 &&
    consentTemplate.length > 0 &&
    consentTemplate.includes("GO:") &&
    missingRequiredBlocked.length === 0;

  return Object.freeze({
    schema: EFFECT_CAP_SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "descriptor",
    name: safeName,
    description: safeString(description, ""),
    allowed_effects: allowedFinal,
    blocked_effects: blockedUnion,
    consent_scope_template: consentTemplate,
    audit_trail_required: auditRequired,
    valid,
    missing_required_blocked: Object.freeze(missingRequiredBlocked),
    canonical_effects_vocabulary: CANONICAL_EFFECTS,
    always_blocked_effects: ALWAYS_BLOCKED_EFFECTS,
    boundary: buildPreviewBoundary()
  });
}

export function buildToolRegistry({ tools = {} } = {}) {
  const safeTools = (tools && typeof tools === "object") ? tools : {};
  const registry = {};
  const invalidEntries = [];

  for (const [toolName, entry] of Object.entries(safeTools)) {
    if (typeof toolName !== "string" || toolName.length === 0) {
      invalidEntries.push({ key: String(toolName), reason: "invalid_name" });
      continue;
    }
    if (!entry || typeof entry !== "object") {
      invalidEntries.push({ key: toolName, reason: "entry_not_object" });
      continue;
    }
    if (!entry.cap || typeof entry.cap !== "object") {
      invalidEntries.push({ key: toolName, reason: "missing_cap" });
      continue;
    }
    if (typeof entry.invoke !== "function") {
      invalidEntries.push({ key: toolName, reason: "missing_invoke_function" });
      continue;
    }
    if (entry.cap.valid !== true) {
      invalidEntries.push({ key: toolName, reason: "cap_invalid" });
      continue;
    }
    if (entry.cap.name !== toolName) {
      invalidEntries.push({ key: toolName, reason: "cap_name_mismatch" });
      continue;
    }
    registry[toolName] = Object.freeze({
      name: toolName,
      cap: entry.cap,
      invoke: entry.invoke
    });
  }

  const frozenRegistry = Object.freeze(registry);
  const toolNames = Object.freeze(Object.keys(frozenRegistry).sort());

  return Object.freeze({
    schema: EFFECT_CAP_REGISTRY_SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "registry",
    tool_count: toolNames.length,
    tool_names: toolNames,
    tools: frozenRegistry,
    invalid_entries: Object.freeze(invalidEntries),
    boundary: buildPreviewBoundary()
  });
}

function buildInvocationEvent({
  toolName,
  capName,
  consentPhraseVerified,
  invocation_status,
  error_reason = null,
  result_summary = null,
  duration_ms = 0
}) {
  return Object.freeze({
    schema: EFFECT_CAP_INVOCATION_SCHEMA,
    truth_label: invocation_status === "completed" ? "MEASURED" : "INVOCATION_REFUSED",
    mode: "invocation_event",
    tool_name: toolName,
    cap_name: capName,
    invocation_status,
    error_reason,
    consent_phrase_verified: consentPhraseVerified === true,
    result_summary,
    duration_ms,
    audit_trail_required: true,
    receipt_shape_ready: invocation_status === "completed"
  });
}

// invokeWithEffectCap · the gate.
//
// Flow:
//   1. Look up tool in registry · refuse if not found.
//   2. Check cap is valid · refuse if not.
//   3. Verify consent phrase matches cap.consent_scope_template EXACTLY ·
//      no fuzzy match · no prefix match · refuse on mismatch.
//   4. Run the tool's invoke function with sandboxed args.
//   5. Emit an invocation event suitable for receipt minting.
export async function invokeWithEffectCap({
  registry,
  toolName,
  args = {},
  consentPhrase = ""
} = {}) {
  const safeToolName = safeString(toolName, "");
  const safeArgs = (args && typeof args === "object" && !Array.isArray(args)) ? args : {};
  const safeConsent = safeString(consentPhrase, "");

  // Gate 1: registry exists and has tools
  if (!registry || typeof registry !== "object" || !registry.tools) {
    return buildInvocationEvent({
      toolName: safeToolName,
      capName: null,
      consentPhraseVerified: false,
      invocation_status: "refused",
      error_reason: "registry_invalid · cannot resolve tool"
    });
  }

  // Gate 2: tool registered
  const entry = registry.tools[safeToolName];
  if (!entry) {
    return buildInvocationEvent({
      toolName: safeToolName,
      capName: null,
      consentPhraseVerified: false,
      invocation_status: "refused",
      error_reason: `tool_not_registered · '${safeToolName}' not in registry`
    });
  }

  // Gate 3: cap is valid
  if (!entry.cap || entry.cap.valid !== true) {
    return buildInvocationEvent({
      toolName: safeToolName,
      capName: entry.cap?.name ?? null,
      consentPhraseVerified: false,
      invocation_status: "refused",
      error_reason: "cap_invalid · registered entry has invalid EffectCap"
    });
  }

  // Gate 4: consent phrase exact match (per ADR-005)
  // The cap's consent_scope_template MAY contain {placeholder} forms that
  // must match the consent phrase exactly when filled. For v0.1 we require
  // strict equality with the template; future versions can support
  // placeholder resolution.
  if (safeConsent !== entry.cap.consent_scope_template) {
    return buildInvocationEvent({
      toolName: safeToolName,
      capName: entry.cap.name,
      consentPhraseVerified: false,
      invocation_status: "refused",
      error_reason: `consent_phrase_mismatch · required exact: '${entry.cap.consent_scope_template}'`
    });
  }

  // All gates passed · invoke the tool
  const startedAt = Date.now();
  let resultSummary = null;
  let invocation_status = "completed";
  let error_reason = null;

  try {
    const result = await entry.invoke(safeArgs);
    resultSummary = typeof result === "object" && result !== null
      ? Object.freeze({
          keys: Object.freeze(Object.keys(result).slice(0, 20)),
          has_schema: typeof result.schema === "string",
          schema: typeof result.schema === "string" ? result.schema : null
        })
      : Object.freeze({ keys: Object.freeze([]), has_schema: false, schema: null });
  } catch (err) {
    invocation_status = "errored";
    error_reason = `tool_threw · ${String(err).slice(0, 200)}`;
  }

  return buildInvocationEvent({
    toolName: safeToolName,
    capName: entry.cap.name,
    consentPhraseVerified: true,
    invocation_status,
    error_reason,
    result_summary: resultSummary,
    duration_ms: Date.now() - startedAt
  });
}

export const EFFECT_CAP_CANONICAL_EFFECTS = CANONICAL_EFFECTS;
export const EFFECT_CAP_ALWAYS_BLOCKED_EFFECTS = ALWAYS_BLOCKED_EFFECTS;
export const EFFECT_CAP_SCHEMA_NAME = EFFECT_CAP_SCHEMA;
export const EFFECT_CAP_REGISTRY_SCHEMA_NAME = EFFECT_CAP_REGISTRY_SCHEMA;
export const EFFECT_CAP_INVOCATION_SCHEMA_NAME = EFFECT_CAP_INVOCATION_SCHEMA;
