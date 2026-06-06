# Dema A2A Message Envelope v0.1

**Status:** DECLARED design (preview-only spec; no implementation, no network).
**Date:** 2026-05-16
**Scope:** Specify a preview-only module that records a typed envelope for a future agent-to-agent (A2A) message. The envelope declares scope and intent; it does not transfer authority, open a network channel, or dispatch to any peer. Sibling of `urp-carrying-cost-preview` and `mcp-capability-descriptor-preview`.

## Current facts

- Integration Foundry registry at `b400bd9` lists `a2a` with `bizra_binding.primitive: "sat_verdict"`, `current_status: "PLANNED"`, `blocked_by: ["no node-to-node network surface exists in Dema repo", "ADR-007 federation gates not yet closed"]`. This spec writes the envelope schema; both blockers remain.
- ADR-007 (Accepted at `ab757a1`) declares the multi-session chain policy; federation gates are deferred to its Option A/B/C choice.
- Public A2A spec: open protocol for AI-agent communication (agent discovery, message exchange, task coordination).

## Product objective

For any future A2A-style message, emit a typed envelope that records:

1. **From** — sending agent identifier (e.g. `"pat.architect"`)
2. **To** — receiving agent identifier (e.g. `"sat.evidence_guardian"`)
3. **Mission ID** — `MICRO_CONSENT_SHAPE.mission_id` the message is bound to
4. **Message type** — typed enum (e.g. `verification_request`, `status_query`, `evidence_share`)
5. **Effect level** — declared `effect_level` (subset of OPERATIONS, read-only in v0.1)
6. **Claims** — list of claim IDs the message references (no claim payload, just IDs)
7. **Authority transfer** — always `false` invariant
8. **Dispatched** — always `false` in v0.1 (envelope is recorded; transmission is separate)

## Functional requirements

### F-01 · Module exports

```
packages/consent/src/a2a-message-envelope-preview.js

export const A2A_MESSAGE_ENVELOPE_PREVIEW_SCHEMA =
  "bizra.dema.a2a_message_envelope_preview.v0.1"
export const A2A_MESSAGE_TYPES = Object.freeze([
  "verification_request",
  "status_query",
  "evidence_share",
  "consent_review_request"
])
export function buildA2aMessageEnvelopePreview({
  from, to, mission_id, message_type, effect_level, claims, now
})
```

### F-02 · Envelope shape (success)

```
{
  schema:               "bizra.dema.a2a_message_envelope_preview.v0.1",
  mode:                 "PREVIEW_ONLY",
  truth_label:          "DECLARED",
  valid:                true,
  from:                 <string>,
  to:                   <string>,
  mission_id:           <string>,
  message_type:         <one of A2A_MESSAGE_TYPES>,
  effect_level:         <array subset of OPERATIONS, read-only in v0.1>,
  claims:               <array of strings>,
  authority_transfer:   false,                                  -- invariant
  dispatched:           false,                                  -- invariant in v0.1
  generated_at:         <ISO>,
  boundary: { ... 7 authority flags all false ... }
}
```

### F-03 · Boundary invariants

```
runtime:                       false
federation:                    false
mint:                          false
a2a_network_call_made:         false  (already in AUTHORITY_FLAGS)
network_used:                  false
authority_transferred:         false  (NEW flag, add to allowlist)
cross_node_handoff_executed:   false  (NEW flag, add to allowlist)
```

### F-04 · Validation

- `from` and `to` must be non-empty strings; `from !== to`
- `mission_id` must be non-empty
- `message_type` must be in `A2A_MESSAGE_TYPES`
- `effect_level` must be a subset of `["read"]` in v0.1 (no write/execute/call permitted on inter-agent messages)
- `claims` must be an array of strings (may be empty)
- `now` must be a valid Date

### F-05 · v0.1 invariants

- `authority_transfer` always `false`
- `dispatched` always `false`
- `effect_level` cannot contain `write`, `execute`, or `call` (validation rejects)
- Module imports zero `fs / net / http / child_process`

### F-06 · Determinism + purity

Same inputs → deeply-equal frozen output with fresh references.

## Out of scope

- Network dispatch
- Cross-node handshake
- Persistent envelope storage
- CLI verb
- Cryptographic signing of the envelope (Phase B; would require key-management spec)

## Acceptance criteria

1. New file at `packages/consent/src/a2a-message-envelope-preview.js`
2. New test file with ≥ 12 TDD anchors
3. `AUTHORITY_FLAGS` extended by 2 new flags (`authority_transferred`, `cross_node_handoff_executed`)
4. `docs/TESTING.md` registers the new test
5. All 7 gates green; `boundary-invariant-check` `modules_scanned ≥ 27`

## References

- `packages/verifier/src/sat-placeholder.js` — `sat_verdict` primitive this envelope routes toward
- `packages/consent/src/consent-common.js` — `MICRO_CONSENT_SHAPE`
- `packages/consent/src/consent-hash-preview.js` — `OPERATIONS`
- `docs/06-adr/ADR-007-multi-session-chain-policy.md` — federation halt-gate this spec respects
- `packages/core/src/external-pattern-registry-preview.js` — `a2a` entry this spec serves

## Operating law

```
Agents may exchange messages.
Agents may not exchange authority.
The envelope records intent.
The envelope does not dispatch.
```
