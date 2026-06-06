// Operating canon (per docs/superpowers/specs/2026-05-16-integration-foundry-registry/):
//   Observe the giant.
//   Extract the pattern.
//   Translate into BIZRA primitive.
//   Put behind consent + EffectCap.
//   Record with EvidenceChain.
//   Expose through DEMA UX.
//   Only then allow use.

export const EXTERNAL_PATTERN_REGISTRY_PREVIEW_SCHEMA =
  "bizra.dema.external_pattern_registry_preview.v0.1";

const SAFETY_PRINCIPLE = "Authority is never imported. Only patterns are.";
const NOTE =
  "Borrow pattern, reject hidden authority. Every entry remains preview-only.";

const OPERATING_CANON = Object.freeze([
  "Observe the giant.",
  "Extract the pattern.",
  "Translate into BIZRA primitive.",
  "Put behind consent + EffectCap.",
  "Record with EvidenceChain.",
  "Expose through DEMA UX.",
  "Only then allow use.",
]);

const PATTERN_RECORDS = Object.freeze([
  Object.freeze({
    source: "mcp",
    extracted_peak:
      "standardized tool/resource descriptors that declare capability without granting authority",
    bizra_binding: Object.freeze({
      primitive: "consent_hash_table_preview",
      on_disk_anchor: "packages/consent/src/consent-hash-preview.js",
    }),
    micro_consent_field_required: "resource_id",
    sat_verdict_required: "REVIEW",
    evidence_schemas_required: Object.freeze([
      "bizra.dema.consent_hash_table_preview.v0.1",
      "bizra.dema.evidence_chain_preview.v0.1",
    ]),
    effects_declared: Object.freeze(["read"]),
    effects_denied: Object.freeze(["write", "execute", "call"]),
    current_status: "PLANNED",
    blocked_by: Object.freeze([
      "no mcp server invocation surface exists in Dema repo",
      "ADR for MCP descriptor ingestion is unwritten",
    ]),
  }),
  Object.freeze({
    source: "a2a",
    extracted_peak:
      "structured envelope for agent-to-agent messages with declared scope and no authority transfer",
    bizra_binding: Object.freeze({
      primitive: "sat_verdict",
      on_disk_anchor: "packages/verifier/src/sat-placeholder.js",
    }),
    micro_consent_field_required: "mission_id",
    sat_verdict_required: "REVIEW",
    evidence_schemas_required: Object.freeze(["bizra.dema.sat_verdict.v0.1"]),
    effects_declared: Object.freeze(["read"]),
    effects_denied: Object.freeze(["write", "execute", "call"]),
    current_status: "PLANNED",
    blocked_by: Object.freeze([
      "no node-to-node network surface exists in Dema repo",
      "ADR-007 federation gates not yet closed",
    ]),
  }),
  Object.freeze({
    source: "autohotkey",
    extracted_peak:
      "local ergonomic hotkeys that surface intents without executing them",
    bizra_binding: Object.freeze({
      primitive: "consent_plan_preview",
      on_disk_anchor: "packages/consent/src/consent-planner.js",
    }),
    micro_consent_field_required: "action",
    sat_verdict_required: "REVIEW",
    evidence_schemas_required: Object.freeze([
      "bizra.dema.consent_plan_preview.v0.1",
    ]),
    effects_declared: Object.freeze(["read"]),
    effects_denied: Object.freeze(["write", "execute", "call"]),
    current_status: "PLANNED",
    blocked_by: Object.freeze([
      "no hotkey runner surface exists",
      "shell-by-default would violate boundary-invariant",
    ]),
  }),
  Object.freeze({
    source: "hooks",
    extracted_peak:
      "allowlisted event triggers that emit receipts before mutating state",
    bizra_binding: Object.freeze({
      primitive: "evidence_chain_preview",
      on_disk_anchor: "packages/verifier/src/evidence-chain-preview.js",
    }),
    micro_consent_field_required: "action",
    sat_verdict_required: "REVIEW",
    evidence_schemas_required: Object.freeze([
      "bizra.dema.evidence_chain_preview.v0.1",
    ]),
    effects_declared: Object.freeze(["read"]),
    effects_denied: Object.freeze(["execute", "call"]),
    current_status: "BLOCKED",
    blocked_by: Object.freeze([
      "no general hook runner in tree",
      "Companion Change #1 (audit-hook truncation lift) not done",
    ]),
  }),
  Object.freeze({
    source: "smart_contracts",
    extracted_peak:
      "deterministic local rule commitments before any on-chain settlement",
    bizra_binding: Object.freeze({
      primitive: "amana_contracts_preview",
      on_disk_anchor: "packages/core/src/amana-contracts-preview.js",
    }),
    micro_consent_field_required: "purpose",
    sat_verdict_required: "REVIEW",
    evidence_schemas_required: Object.freeze([
      "bizra.dema.amana_contracts_preview.v0.1",
    ]),
    effects_declared: Object.freeze(["read"]),
    effects_denied: Object.freeze(["write", "execute", "call"]),
    current_status: "PREVIEW",
    blocked_by: Object.freeze([]),
  }),
  Object.freeze({
    source: "telescript",
    extracted_peak:
      "state-with-permit travel; proof must travel with state, never arbitrary code",
    bizra_binding: Object.freeze({
      primitive: "shared_urp_world_preview",
      on_disk_anchor: "packages/core/src/shared-urp-world-preview.js",
    }),
    micro_consent_field_required: "mission_id",
    sat_verdict_required: "REVIEW",
    evidence_schemas_required: Object.freeze([
      "bizra.dema.shared_urp_world_preview.v0.1",
    ]),
    effects_declared: Object.freeze(["read"]),
    effects_denied: Object.freeze(["write", "execute", "call"]),
    current_status: "PREVIEW",
    blocked_by: Object.freeze([]),
  }),
  Object.freeze({
    source: "pi_dev_onboarding",
    extracted_peak:
      "fast first-run loop that surfaces proof gates without skipping any",
    bizra_binding: Object.freeze({
      primitive: "node0_homebase_state_preview",
      on_disk_anchor: "packages/core/src/node0-homebase-state-preview.js",
    }),
    micro_consent_field_required: null,
    sat_verdict_required: "SCORE_ONLY",
    evidence_schemas_required: Object.freeze([]),
    effects_declared: Object.freeze(["read"]),
    effects_denied: Object.freeze(["write", "execute", "call"]),
    current_status: "PREVIEW",
    blocked_by: Object.freeze([]),
  }),
  Object.freeze({
    source: "openclaw_control_plane",
    extracted_peak: "visible task lifecycle with mandatory human override",
    bizra_binding: Object.freeze({
      primitive: "process_value_preview",
      on_disk_anchor: "packages/core/src/process-value-preview.js",
    }),
    micro_consent_field_required: null,
    sat_verdict_required: "REVIEW",
    evidence_schemas_required: Object.freeze([
      "bizra.dema.true_value_preview.v0.1",
    ]),
    effects_declared: Object.freeze(["read"]),
    effects_denied: Object.freeze(["write", "execute", "call"]),
    current_status: "PREVIEW",
    blocked_by: Object.freeze([]),
  }),
  Object.freeze({
    source: "hermes_messaging",
    extracted_peak:
      "agent envelope with origin/destination/scope, never authority transfer",
    bizra_binding: Object.freeze({
      primitive: "sat_verdict",
      on_disk_anchor: "packages/verifier/src/sat-placeholder.js",
    }),
    micro_consent_field_required: "agent_id",
    sat_verdict_required: "REVIEW",
    evidence_schemas_required: Object.freeze(["bizra.dema.sat_verdict.v0.1"]),
    effects_declared: Object.freeze(["read"]),
    effects_denied: Object.freeze(["write", "execute", "call"]),
    current_status: "PLANNED",
    blocked_by: Object.freeze(["envelope schema not yet authored"]),
  }),
  Object.freeze({
    source: "agent_as_a_service",
    extracted_peak:
      "service-shape agent surface, local service cells before any public API",
    bizra_binding: Object.freeze({
      primitive: "process_value_preview",
      on_disk_anchor: "packages/core/src/process-value-preview.js",
    }),
    micro_consent_field_required: "mission_id",
    sat_verdict_required: "REVIEW",
    evidence_schemas_required: Object.freeze([
      "bizra.dema.true_value_preview.v0.1",
    ]),
    effects_declared: Object.freeze(["read"]),
    effects_denied: Object.freeze(["write", "execute", "call"]),
    current_status: "BLOCKED",
    blocked_by: Object.freeze([
      "URP pilot not yet reached",
      "no service-cell runtime in repo",
    ]),
  }),
  Object.freeze({
    source: "harberger_cost",
    extracted_peak:
      "self-assessed anti-hoarding economics applied only to shared resources, never private memory",
    bizra_binding: Object.freeze({
      primitive: "shared_urp_world_preview",
      on_disk_anchor: "packages/core/src/shared-urp-world-preview.js",
    }),
    micro_consent_field_required: "purpose",
    sat_verdict_required: "REJECT",
    evidence_schemas_required: Object.freeze([
      "bizra.dema.shared_urp_world_preview.v0.1",
    ]),
    effects_declared: Object.freeze(["read"]),
    effects_denied: Object.freeze(["write", "execute", "call"]),
    current_status: "BLOCKED",
    blocked_by: Object.freeze([
      "no URP carrying-cost schema yet",
      "no economic-settlement runtime in repo",
      "private memory must remain forever excluded",
    ]),
  }),
]);

const BOUNDARY = Object.freeze({
  runtime: false,
  federation: false,
  mint: false,
  node_connection: false,
  economic_settlement: false,
  raw_data_exchange: false,
  authority_imported: false,
  mcp_server_invoked: false,
  a2a_network_call_made: false,
  hook_executed: false,
  automation_run: false,
  contract_executed: false,
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function summarize(records) {
  const counts = { PLANNED: 0, PREVIEW: 0, BLOCKED: 0 };
  for (const record of records) counts[record.current_status] += 1;
  return counts;
}

export function buildExternalPatternRegistryPreview() {
  return deepFreeze(
    clone({
      schema: EXTERNAL_PATTERN_REGISTRY_PREVIEW_SCHEMA,
      mode: "PREVIEW_ONLY",
      truth_label: "DECLARED",
      note: NOTE,
      safety_principle: SAFETY_PRINCIPLE,
      operating_canon: OPERATING_CANON,
      patterns: PATTERN_RECORDS,
      pattern_count: PATTERN_RECORDS.length,
      summary: summarize(PATTERN_RECORDS),
      boundary: BOUNDARY,
    }),
  );
}
