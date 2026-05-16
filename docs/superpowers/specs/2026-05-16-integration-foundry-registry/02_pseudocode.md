# Phase 02 — Pseudocode

## Module layout

File: `packages/core/src/external-pattern-registry-preview.js`

```text
SCHEMA constant
NOTE_PRINCIPLE constant
PATTERN_RECORDS constant array (frozen)
BOUNDARY constant (frozen)
clone helper
deepFreeze helper
buildEnvelope helper
buildExternalPatternRegistryPreview exported builder
```

The file is < 200 LOC. Matches the shape of `packages/core/src/node0-homebase-state-preview.js` and `packages/core/src/shared-urp-world-preview.js` in this branch (commit `13f32c5`).

## Constants

```text
SCHEMA = "bizra.dema.external_pattern_registry_preview.v0.1"
SAFETY_PRINCIPLE = "Authority is never imported. Only patterns are."
NOTE = "Borrow pattern, reject hidden authority. Every entry remains preview-only."

OPERATING_CANON = [
  "Observe the giant.",
  "Extract the pattern.",
  "Translate into BIZRA primitive.",
  "Put behind consent + EffectCap.",
  "Record with EvidenceChain.",
  "Expose through DEMA UX.",
  "Only then allow use."
]

VALID_STATUSES = {"PLANNED", "PREVIEW", "BLOCKED"}
VALID_GATE_VERDICTS = {"PERMIT", "REJECT", "REVIEW", "SCORE_ONLY"}
VALID_MICRO_CONSENT_FIELDS = {
  "mission_id", "agent_id", "resource_id", "action",
  "purpose", "expires_at", "commitment_hash", null
}
VALID_OPERATIONS = {"read", "write", "execute", "call"}
```

`VALID_GATE_VERDICTS` mirrors the four-verdict surface declared in
`docs/02-architecture/pat-builder-sat-validator.md`. `VALID_MICRO_CONSENT_FIELDS`
mirrors `MICRO_CONSENT_SHAPE` from `packages/consent/src/consent-common.js`.
`VALID_OPERATIONS` mirrors `OPERATIONS` from
`packages/consent/src/consent-hash-preview.js`.

## Pattern records (data, not behavior)

```text
PATTERN_RECORDS = Object.freeze([

  {
    source: "mcp",
    extracted_peak: "standardized tool/resource descriptors that declare capability without granting authority",
    bizra_binding: {
      primitive: "consent_hash_table_preview",
      on_disk_anchor: "packages/consent/src/consent-hash-preview.js"
    },
    micro_consent_field_required: "resource_id",
    sat_verdict_required: "REVIEW",
    evidence_schemas_required: [
      "bizra.dema.consent_hash_table_preview.v0.1",
      "bizra.dema.evidence_chain_preview.v0.1"
    ],
    effects_declared: ["read"],
    effects_denied: ["write", "execute", "call"],
    current_status: "PLANNED",
    blocked_by: [
      "no mcp server invocation surface exists in Dema repo",
      "ADR for MCP descriptor ingestion is unwritten"
    ]
  },

  {
    source: "a2a",
    extracted_peak: "structured envelope for agent-to-agent messages with declared scope and no authority transfer",
    bizra_binding: {
      primitive: "sat_verdict",
      on_disk_anchor: "packages/verifier/src/sat-placeholder.js"
    },
    micro_consent_field_required: "mission_id",
    sat_verdict_required: "REVIEW",
    evidence_schemas_required: ["bizra.dema.sat_verdict.v0.1"],
    effects_declared: ["read"],
    effects_denied: ["write", "execute", "call"],
    current_status: "PLANNED",
    blocked_by: [
      "no node-to-node network surface exists in Dema repo",
      "ADR-007 federation gates not yet closed"
    ]
  },

  {
    source: "autohotkey",
    extracted_peak: "local ergonomic hotkeys that surface intents without executing them",
    bizra_binding: {
      primitive: "consent_plan_preview",
      on_disk_anchor: "packages/consent/src/consent-planner.js"
    },
    micro_consent_field_required: "action",
    sat_verdict_required: "REVIEW",
    evidence_schemas_required: ["bizra.dema.consent_plan_preview.v0.1"],
    effects_declared: ["read"],
    effects_denied: ["write", "execute", "call"],
    current_status: "PLANNED",
    blocked_by: [
      "no hotkey runner surface exists",
      "shell-by-default would violate boundary-invariant"
    ]
  },

  {
    source: "hooks",
    extracted_peak: "allowlisted event triggers that emit receipts before mutating state",
    bizra_binding: {
      primitive: "evidence_chain_preview",
      on_disk_anchor: "packages/verifier/src/evidence-chain-preview.js"
    },
    micro_consent_field_required: "action",
    sat_verdict_required: "REVIEW",
    evidence_schemas_required: ["bizra.dema.evidence_chain_preview.v0.1"],
    effects_declared: ["read"],
    effects_denied: ["execute", "call"],
    current_status: "BLOCKED",
    blocked_by: [
      "no general hook runner in tree",
      "Companion Change #1 (audit-hook truncation lift) not done"
    ]
  },

  {
    source: "smart_contracts",
    extracted_peak: "deterministic local rule commitments before any on-chain settlement",
    bizra_binding: {
      primitive: "amana_contracts_preview",
      on_disk_anchor: "packages/core/src/amana-contracts-preview.js"
    },
    micro_consent_field_required: "purpose",
    sat_verdict_required: "REVIEW",
    evidence_schemas_required: ["bizra.dema.amana_contracts_preview.v0.1"],
    effects_declared: ["read"],
    effects_denied: ["write", "execute", "call"],
    current_status: "PREVIEW",
    blocked_by: []
  },

  {
    source: "telescript",
    extracted_peak: "state-with-permit travel; proof must travel with state, never arbitrary code",
    bizra_binding: {
      primitive: "shared_urp_world_preview",
      on_disk_anchor: "packages/core/src/shared-urp-world-preview.js"
    },
    micro_consent_field_required: "mission_id",
    sat_verdict_required: "REVIEW",
    evidence_schemas_required: ["bizra.dema.shared_urp_world_preview.v0.1"],
    effects_declared: ["read"],
    effects_denied: ["write", "execute", "call"],
    current_status: "PREVIEW",
    blocked_by: []
  },

  {
    source: "pi_dev_onboarding",
    extracted_peak: "fast first-run loop that surfaces proof gates without skipping any",
    bizra_binding: {
      primitive: "node0_homebase_state_preview",
      on_disk_anchor: "packages/core/src/node0-homebase-state-preview.js"
    },
    micro_consent_field_required: null,
    sat_verdict_required: "SCORE_ONLY",
    evidence_schemas_required: [],
    effects_declared: ["read"],
    effects_denied: ["write", "execute", "call"],
    current_status: "PREVIEW",
    blocked_by: []
  },

  {
    source: "openclaw_control_plane",
    extracted_peak: "visible task lifecycle with mandatory human override",
    bizra_binding: {
      primitive: "process_value_preview",
      on_disk_anchor: "packages/core/src/process-value-preview.js"
    },
    micro_consent_field_required: null,
    sat_verdict_required: "REVIEW",
    evidence_schemas_required: ["bizra.dema.true_value_preview.v0.1"],
    effects_declared: ["read"],
    effects_denied: ["write", "execute", "call"],
    current_status: "PREVIEW",
    blocked_by: []
  },

  {
    source: "hermes_messaging",
    extracted_peak: "agent envelope with origin/destination/scope, never authority transfer",
    bizra_binding: {
      primitive: "sat_verdict",
      on_disk_anchor: "packages/verifier/src/sat-placeholder.js"
    },
    micro_consent_field_required: "agent_id",
    sat_verdict_required: "REVIEW",
    evidence_schemas_required: ["bizra.dema.sat_verdict.v0.1"],
    effects_declared: ["read"],
    effects_denied: ["write", "execute", "call"],
    current_status: "PLANNED",
    blocked_by: ["envelope schema not yet authored"]
  },

  {
    source: "agent_as_a_service",
    extracted_peak: "service-shape agent surface, local service cells before any public API",
    bizra_binding: {
      primitive: "process_value_preview",
      on_disk_anchor: "packages/core/src/process-value-preview.js"
    },
    micro_consent_field_required: "mission_id",
    sat_verdict_required: "REVIEW",
    evidence_schemas_required: ["bizra.dema.true_value_preview.v0.1"],
    effects_declared: ["read"],
    effects_denied: ["write", "execute", "call"],
    current_status: "BLOCKED",
    blocked_by: ["URP pilot not yet reached", "no service-cell runtime in repo"]
  },

  {
    source: "harberger_cost",
    extracted_peak: "self-assessed anti-hoarding economics applied only to shared resources, never private memory",
    bizra_binding: {
      primitive: "shared_urp_world_preview",
      on_disk_anchor: "packages/core/src/shared-urp-world-preview.js"
    },
    micro_consent_field_required: "purpose",
    sat_verdict_required: "REJECT",
    evidence_schemas_required: ["bizra.dema.shared_urp_world_preview.v0.1"],
    effects_declared: ["read"],
    effects_denied: ["write", "execute", "call"],
    current_status: "BLOCKED",
    blocked_by: [
      "no URP carrying-cost schema yet",
      "no economic-settlement runtime in repo",
      "private memory must remain forever excluded"
    ]
  }

]);
```

11 entries. Each `on_disk_anchor` is a path that exists in this branch (`adr/007-accept`) and on `main` (`8df722d`) — verified by the test file before assertion.

## Boundary

```text
BOUNDARY = Object.freeze({
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
  contract_executed: false
});
```

Every key is an authority flag. Every value is `false`. The boundary-invariant lint (40-flag allowlist plus the 6 new flags here) must pass on this module.

## Helpers

```text
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
```

Matches the established pattern across 9+ existing preview modules. No shared helper has been extracted across the codebase yet; this module follows the local-copy convention.

## Builder pseudocode

```text
function summarize(records):
  counts = { PLANNED: 0, PREVIEW: 0, BLOCKED: 0 }
  for record in records:
    counts[record.current_status] += 1
  return counts

export function buildExternalPatternRegistryPreview():
  return deepFreeze(clone({
    schema: SCHEMA,
    mode: "PREVIEW_ONLY",
    truth_label: "DECLARED",
    note: NOTE,
    safety_principle: SAFETY_PRINCIPLE,
    operating_canon: OPERATING_CANON,
    patterns: PATTERN_RECORDS,
    pattern_count: PATTERN_RECORDS.length,
    summary: summarize(PATTERN_RECORDS),
    boundary: BOUNDARY
  }));
```

The builder takes no arguments. Two calls produce deep-equal but reference-distinct frozen objects.

## Edge cases (handled by static data, not branching)

- No record has `current_status: "LIVE"` → enforced by the constant array itself; verified by the F-05 test.
- No record's `on_disk_anchor` is missing → enforced by spec-author discipline; verified by the file-existence test at acceptance time.
- No record's `sat_verdict_required` is outside `VALID_GATE_VERDICTS` → enforced by the constant array; verified by test.
- No record's `micro_consent_field_required` is outside `VALID_MICRO_CONSENT_FIELDS` → enforced; verified by test.
- All `effects_declared` and `effects_denied` are subsets of `VALID_OPERATIONS` → enforced; verified by test.

No runtime input validation is needed because the module accepts no input.
