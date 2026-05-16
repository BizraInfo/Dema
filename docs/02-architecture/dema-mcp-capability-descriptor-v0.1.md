# Dema MCP Capability Descriptor v0.1

**Status:** DECLARED design (preview-only spec; no implementation, no MCP server invocation).
**Date:** 2026-05-16
**Scope:** Specify a preview-only module that records a typed descriptor for an external MCP (Model Context Protocol) tool. The descriptor declares what the tool *could* do; it does not grant authority, invoke the tool, or open any network channel. Sibling of `urp-carrying-cost-preview` in the Integration Foundry family.

## Current facts

- The Integration Foundry registry preview at commit `b400bd9` lists `mcp` with `bizra_binding.primitive: "consent_hash_table_preview"` and `current_status: "PLANNED"` with `blocked_by: ["no mcp server invocation surface exists in Dema repo", "ADR for MCP descriptor ingestion is unwritten"]`. This spec closes the second blocker.
- `packages/consent/src/consent-hash-preview.js` declares `OPERATIONS = {read, write, execute, call}` and `RESOURCE_TYPES = {file, path, command, service}`.
- `docs/02-architecture/pat-builder-sat-validator.md` declares `GateVerdict: PERMIT | REJECT | REVIEW | SCORE_ONLY`.
- Public MCP spec: Anthropic, 2024. Documented safety risks (per arxiv.org/abs/2504.03767): malicious code execution, remote access control, credential theft if tool access is not constrained.

## Product objective

For each external MCP tool the operator might want to reference, emit a typed descriptor envelope that answers, before any future invocation:

1. **Source** — `"mcp"` (this is the BIZRA tag for the giant)
2. **Tool ID** — the MCP tool identifier (string, opaque)
3. **Declared effects** — subset of `OPERATIONS` that the tool *would* perform if invoked
4. **Denied effects** — subset of `OPERATIONS` that are explicitly refused
5. **Resource scope** — which `RESOURCE_TYPES` the tool touches
6. **Required consent field** — which `MICRO_CONSENT_SHAPE` entry must be filled before any future invocation
7. **Required SAT verdict** — `GateVerdict` outcome that unblocks invocation
8. **Invocable now?** — always `false` in v0.1 (descriptor records possibility; invocation is a separate halt-gated runtime)

## Functional requirements

### F-01 · Module exports
```
packages/consent/src/mcp-capability-descriptor-preview.js

export const MCP_CAPABILITY_DESCRIPTOR_PREVIEW_SCHEMA =
  "bizra.dema.mcp_capability_descriptor_preview.v0.1"
export function buildMcpCapabilityDescriptorPreview({
  tool_id, declared_effects, denied_effects, resource_type,
  consent_field_required, sat_verdict_required, now
})
```

### F-02 · Envelope shape (success)
```
{
  schema:                  "bizra.dema.mcp_capability_descriptor_preview.v0.1",
  mode:                    "PREVIEW_ONLY",
  truth_label:             "DECLARED",
  valid:                   true,
  source:                  "mcp",
  tool_id:                 <string>,
  declared_effects:        <array subset of OPERATIONS>,
  denied_effects:          <array subset of OPERATIONS>,
  resource_type:           <one of RESOURCE_TYPES>,
  consent_field_required:  <one of MICRO_CONSENT_SHAPE>,
  sat_verdict_required:    <one of GateVerdict>,
  invocable_now:           false,                              -- invariant
  generated_at:            <ISO>,
  boundary: { ... 8 authority flags all false ... }
}
```

### F-03 · Boundary invariants
```
runtime:                  false
federation:               false
mint:                     false
mcp_server_invoked:       false  (already in AUTHORITY_FLAGS)
network_used:             false
credential_persisted:     false  (NEW flag, add to allowlist)
authority_imported:       false
remote_access_granted:    false  (NEW flag, add to allowlist)
```

### F-04 · Validation
- `declared_effects` ∩ `denied_effects` must be empty (no field appears in both)
- Every entry of `declared_effects` and `denied_effects` must be in `OPERATIONS`
- `resource_type` must be in `RESOURCE_TYPES`
- `consent_field_required` must be in `MICRO_CONSENT_SHAPE` or `null`
- `sat_verdict_required` must be in `GateVerdict`
- `tool_id` must be a non-empty string

### F-05 · v0.1 invariants
- `invocable_now` always `false`
- `declared_effects` cannot include `execute` or `call` without `sat_verdict_required === "REVIEW"` (defensive)
- The module imports zero `fs / net / http / child_process`

### F-06 · Determinism + purity
Same inputs → deeply-equal frozen output with fresh references.

## Out of scope
- MCP server invocation, handshake, tool execution
- Persistent storage of descriptors
- CLI verb (`dema mcp descriptor ...` is not proposed for v0.1)
- Network-side fetching of tool metadata
- Credential management

## Acceptance criteria
1. New file at `packages/consent/src/mcp-capability-descriptor-preview.js`
2. New test file with ≥ 12 TDD anchors
3. `AUTHORITY_FLAGS` extended by 2 new flags (`credential_persisted`, `remote_access_granted`)
4. `docs/TESTING.md` registers the new test
5. All 7 gates green; `boundary-invariant-check` `modules_scanned ≥ 26`

## References
- `packages/consent/src/consent-hash-preview.js` — `OPERATIONS`, `RESOURCE_TYPES`
- `packages/consent/src/consent-common.js` — `MICRO_CONSENT_SHAPE`
- `docs/02-architecture/pat-builder-sat-validator.md` — `GateVerdict`
- `packages/core/src/external-pattern-registry-preview.js` — `mcp` entry this spec serves
- `docs/superpowers/specs/2026-05-16-urp-carrying-cost/` — first sibling, template followed here

## Operating law
```
MCP describes capability.
The descriptor records what could happen.
The descriptor does not grant authority.
The descriptor does not invoke the tool.
```
