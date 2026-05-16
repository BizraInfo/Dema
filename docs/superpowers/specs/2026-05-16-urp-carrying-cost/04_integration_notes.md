# Phase 04 — Integration Notes

## SNR extraction

Signal:

- **Type-enforced refusal of private data.** The single most important signal in this spec is that the module REFUSES BY CONSTRUCTION to attach a carrying-cost record to any of 8 private resource types. This is what makes Harberger/COST safe in v0.1.
- **Self-assessed value in abstract priority units, not currency.** No monetary mapping; no settlement; no transfer.
- **License-challenge, not forced purchase.** Classical Harberger's most aggressive mechanism (forced transfer at self-assessed price) is explicitly off in v0.1.
- **`no_raw_data_proof` as a required string field.** Forces the owner to articulate, in human-readable text, why the resource contains no raw private data before the envelope validates.

Noise:

- Time-decay simulation (`rate × value × time`) belongs to a later spec.
- Cross-node settlement, license issuance, currency mapping all explicitly out of scope.
- Any "tax" language; the operator-side memory canon already overloads "tax" with the 50%-pool project-profit oath.
- Owner identity (the spec uses `owner_node`, never a person identifier — privacy by construction).

## HHMM mapping

Use these phase states for any future runtime that consumes the envelope:

```text
OBSERVE:
  read the carrying-cost record; understand resource_id, owner, self_assessed_value, rate

CLASSIFY:
  verify resource_type ∈ SHAREABLE_RESOURCE_TYPES; reject if FORBIDDEN_RESOURCE_TYPES

CONSTRAIN:
  enforce forced_transfer=false, raw_data_shared=false, settlement="preview_only"

HANDOFF:
  if another node wants to license-challenge the resource, prepare a typed request envelope
  (this handoff is OUT of v0.1 scope; the envelope just declares challenge_allowed=true)

VERIFY:
  before any future settlement runtime touches the envelope, verify boundary still all-false
  AND that no_raw_data_proof string is present and ≥ some minimum length

ALLOW:
  v0.1 NEVER allows. All settlement / license issuance / transfer require their own ADR + typed-GO.
```

Illegal transitions:

- `OBSERVE → ALLOW` skipping CLASSIFY (would risk applying carrying-cost to a forbidden type)
- `CLASSIFY → ALLOW` while `resource_type ∈ FORBIDDEN_RESOURCE_TYPES`
- `VERIFY → ALLOW` while any boundary flag is `true`
- `HANDOFF → ALLOW` while `forced_transfer` is `true` (requires a v1 ADR; never auto-true in v0.1)

## Risk decomposition

| Risk | Mitigation in spec |
|---|---|
| Module applied to private memory | `FORBIDDEN_RESOURCE_TYPES` allowlist + type-enforcement before any other validation; 8 explicit forbidden types covering the named operator-side private categories |
| Forced transfer slips into v0.1 | `forced_transfer: false` is a constant in the envelope; the user cannot override it through the builder API |
| Owner identity leaks | `owner_node` is a node identifier (e.g., "node0"), not a person; spec explicitly forbids using a person identifier |
| `no_raw_data_proof` rendered missing | Required string field; empty string fails validation; the field is the operator's articulated proof that this resource contains no raw private data |
| `carrying_cost_rate` set to 0 or ≥ 1 | Validation: open interval `(0, 1)`; rate=0 means "no cost" (defeats the purpose); rate≥1 means "cost > value" (nonsensical) |
| `self_assessed_value === 0` | Rejected as `invalid_value`; zero-value resources don't carry cost and shouldn't be in this layer |
| Confusing "tax" / "rent" language | Spec § 1 explicitly names "Carrying Cost" and explains why; no "tax" word appears in the module source |
| Bypass via private data smuggled in `no_raw_data_proof` text | Module is data-emitting only; the no-raw-data-proof string is not parsed for content; a future linter could check for forbidden-substring patterns (separate spec) |

## Boundary integration

The new module's 9-key BOUNDARY adds 3 new flags to `scripts/review/boundary-invariant-check.mjs` `AUTHORITY_FLAGS` allowlist:

```
forced_transfer_executed
private_memory_accessed
license_issued
```

The other 6 keys already exist in the allowlist:

```
runtime, federation, mint, economic_settlement, raw_data_exchange, shared_urp_published
```

After this addition the allowlist size becomes ≥ 54 flags.

## How this spec relates to the Integration Foundry registry

The `external-pattern-registry-preview` at `b400bd9` lists `harberger_cost` with:

```
current_status: "BLOCKED"
blocked_by: [
  "no URP carrying-cost schema yet",
  "no economic-settlement runtime in repo",
  "private memory must remain forever excluded"
]
```

This spec **closes the first blocker** (it writes the schema). It does NOT remove the other two blockers — those remain explicit halt-gates in the registry. The registry's `current_status` stays `BLOCKED`.

To update the registry after this spec lands, a future commit could:

1. Replace `"no URP carrying-cost schema yet"` with the realized schema name `"bizra.dema.urp_carrying_cost_preview.v0.1"` as a positive citation
2. Keep `"no economic-settlement runtime in repo"` and `"private memory must remain forever excluded"` in the blocked_by list
3. Keep `current_status: "BLOCKED"` until the other two blockers are also addressed by their own ADRs

This is **out of scope for the spec itself**; it's a future synchronization commit between two registries.

## Out-of-tree dependencies

This spec does NOT require:

- `~/.dema/` write
- Any network reachability
- A live `bizra-cognition-gateway`
- Any token / currency / blockchain layer
- A loaded local model
- Any operator-side memory canon read at runtime

## Carry-forward to other sibling specs

The pattern this spec establishes for **type-enforced refusal of private data** is reusable across the remaining sibling specs:

| Sibling spec | Type-enforcement target |
|---|---|
| `mcp-capability-descriptor-preview` | MCP tools that declare `write/execute/call` effects must require SAT REVIEW or REJECT |
| `a2a-message-envelope-preview` | A2A messages cannot transfer authority; envelope must declare `authority_transfer: false` invariant |
| `skill-manifest-preview` | Skills must declare `effects_denied` explicitly; skills with `effects_denied` empty fail validation |
| `urp-resource-offer-preview` | Resource offers cannot include `raw_corpus`, `secrets`, etc. (same FORBIDDEN_RESOURCE_TYPES list) |

The `FORBIDDEN_RESOURCE_TYPES` allowlist defined here may be lifted to a shared `packages/core/src/_shared/private-data-types.js` constant in a later refactor (separate spec).

## Acceptance signal

The spec is "well-integrated" when:

1. `node scripts/review/boundary-invariant-check.mjs` returns `ok=true` with `modules_scanned ≥ 26` (was 25 at commit `6c30b3f`)
2. `docs/TESTING.md` registers `tests/urp-carrying-cost-preview.test.js`
3. All 7 gates green
4. The external-pattern-registry's `harberger_cost` entry's `blocked_by` list is **unchanged** (we only close 1 of its 3 blockers; the registry stays honest about the other two)
5. No test calls `buildUrpCarryingCostPreview` with any of the 8 forbidden resource types and gets `valid: true`

## Operating law

```
Private memory is sovereign.
Shared resources carry responsibility.
No hoarding without cost.
No extraction without contribution.
No forced transfer in v0.1.
The schema closes one blocker; two remain.
```
