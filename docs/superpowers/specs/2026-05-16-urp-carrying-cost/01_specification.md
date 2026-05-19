# Phase 01 — Specification

## Scope

Specify a single preview-only module: **URP Carrying Cost Preview**. The module declares a typed envelope for self-assessed value + carrying cost on **shared-URP resources only** (skill packs, knowledge-pack manifests, model profiles, mission templates, agent-service offers). The module **forbids by construction** any application to private memory, private corpus, raw chat data, identity data, secrets, or finance data.

This is preview-only: no economic settlement, no forced transfer, no license issuance, no shared-URP publication. The module describes a proposed carrying-cost record; it does not move value, mint receipts, or settle anything.

## Why "Carrying Cost" not "Tax"

The Harberger/COST literature uses "tax." BIZRA softens to **Carrying Cost** (and tolerates `URP Carrying Cost Preview` as the formal name) because:

1. v0 has **no forced transfer**. Classical Harberger allows forced purchase at the self-assessed price; v0 explicitly rejects this. License-challenge with owner approval is the v0 mechanism.
2. The cost is a **simulation** in the preview envelope. No actual debit happens. No currency moves.
3. The word "tax" in operator-side memory canon ([[50-percent-pool-correct-framing]]) is already overloaded with the project-profit oath; using "tax" for resource carrying cost would conflate two unrelated economic concepts.
4. The Daughter Test passes more cleanly when the user reads "carrying cost" as "the cost of holding a shared resource priority slot" rather than "tax."

## Current facts (disk-verified)

- `packages/core/src/shared-urp-world-preview.js` (commit `13f32c5`) declares `status: "locked_preview_only"` and `economic_settlement: false` in its boundary. Any URP-economics work must compose with this lock, not bypass it.
- `packages/consent/src/consent-common.js` declares `MICRO_CONSENT_SHAPE`.
- `packages/consent/src/consent-hash-preview.js` declares `OPERATIONS = {read, write, execute, call}` and exact-lookup-only policy.
- `packages/verifier/src/evidence-chain-preview.js` provides chain semantics for any future receipt that records a license challenge.
- `docs/02-architecture/pat-builder-sat-validator.md` declares `GateVerdict: PERMIT | REJECT | REVIEW | SCORE_ONLY`.
- `~/.claude/.../memory/reference_50_percent_pool_correct_framing.md` (operator canon): "Private memory is sovereign. Shared resources carry responsibility." This v0 spec honors that line verbatim — private memory is forbidden.
- The Integration Foundry registry preview (commit `b400bd9`) lists `harberger_cost` as `current_status: BLOCKED` with `blocked_by: ["no URP carrying-cost schema yet", "no economic-settlement runtime in repo", "private memory must remain forever excluded"]`. **This spec closes the first blocker on that list** (it writes the schema) while keeping the other two blockers intact.

## Product objective

Give the owner of a sharable URP resource a typed envelope that records:

1. **What** the resource is (resource_id, resource_type)
2. **Who** owns it (owner_node — never a person, always a node identifier)
3. **What it's worth** to the owner (self-assessed value, in abstract priority units, not currency)
4. **What it carries** as a cost (carrying_cost_rate × value × time, simulated only)
5. **Whether others may license-challenge** (boolean, owner-controlled, default true)
6. **Whether the resource is shareable at all** (false for private types; type-enforced)
7. **What proof exists** that no raw private data is bundled (no_raw_data_proof field, required)

The module emits this record deterministically. Calling twice with the same inputs yields a deeply-equal frozen envelope with fresh references.

## Functional requirements

### F-01 · Module exports

```
packages/core/src/urp-carrying-cost-preview.js

export const URP_CARRYING_COST_PREVIEW_SCHEMA = "bizra.dema.urp_carrying_cost_preview.v0.1"
export const SHAREABLE_RESOURCE_TYPES = Object.freeze([
  "skill_pack",
  "knowledge_pack_manifest",
  "model_profile",
  "mission_template",
  "verified_proof_bundle",
  "resource_offer",
  "compute_offer",
  "agent_service_offer"
])
export const FORBIDDEN_RESOURCE_TYPES = Object.freeze([
  "private_conversation",
  "identity_data",
  "family_personal_data",
  "secrets",
  "raw_corpus",
  "unpublished_personal_memory",
  "credentials",
  "finance_data"
])
export function buildUrpCarryingCostPreview({resource_id, resource_type, owner_node, self_assessed_value, carrying_cost_rate, license_challenge_allowed, no_raw_data_proof, now})
```

### F-02 · Envelope shape (success case)

```
{
  schema:                    "bizra.dema.urp_carrying_cost_preview.v0.1",
  mode:                      "PREVIEW_ONLY",
  truth_label:               "DECLARED",
  valid:                     true,
  resource_id:               <string>,
  resource_type:             <one of SHAREABLE_RESOURCE_TYPES>,
  owner_node:                <string, e.g. "node0">,
  self_assessed_value:       <positive number, abstract units>,
  carrying_cost_rate:        <number in (0, 1)>,
  simulated_carrying_cost:   <self_assessed_value * carrying_cost_rate>,
  license_challenge_allowed: <boolean>,
  forced_transfer:           false,                              -- invariant in v0.1
  raw_data_shared:           false,                              -- invariant in v0.1
  no_raw_data_proof:         <string explaining absence of raw data>,
  settlement:                "preview_only",                     -- invariant in v0.1
  generated_at:              <ISO timestamp>,
  boundary:                  { ... 9 authority flags all false ... },
  note:                      "Owner may license-challenge. No forced transfer. No economic settlement. No private memory."
}
```

### F-03 · Envelope shape (fail-closed case)

If any input is invalid (resource_type not in `SHAREABLE_RESOURCE_TYPES`, or resource_type IS in `FORBIDDEN_RESOURCE_TYPES`, or numeric inputs malformed):

```
{
  schema:    "bizra.dema.urp_carrying_cost_preview.v0.1",
  mode:      "PREVIEW_ONLY",
  truth_label: "DECLARED",
  valid:     false,
  denial:    { code, detail },
  boundary:  { ... 9 authority flags all false ... }
}
```

### F-04 · Boundary invariants

```
runtime:                  false
federation:               false
mint:                     false
economic_settlement:      false
forced_transfer_executed: false
private_memory_accessed:  false
raw_data_exchange:        false
license_issued:           false
shared_urp_published:     false
```

These 9 keys must be added to `scripts/review/boundary-invariant-check.mjs` `AUTHORITY_FLAGS` allowlist (3 are new: `forced_transfer_executed`, `private_memory_accessed`, `license_issued`; the other 6 already exist).

### F-05 · Type-enforcement against private data

The builder must call `validateResourceType(resource_type)` first. If `FORBIDDEN_RESOURCE_TYPES` contains the supplied type, the builder returns a `valid: false` envelope with `denial.code = "forbidden_resource_type"`. No code path produces a valid envelope for forbidden types.

### F-06 · v0.1 invariant numbers

- `forced_transfer` always `false`
- `raw_data_shared` always `false`
- `settlement` always `"preview_only"`
- `self_assessed_value > 0` (zero or negative rejected)
- `0 < carrying_cost_rate < 1` (rates outside this range rejected)
- `simulated_carrying_cost === self_assessed_value * carrying_cost_rate` (computed, not user-supplied)

### F-07 · Determinism + purity

- Same inputs → deeply-equal frozen output with fresh reference (matches existing preview-module contract)
- Module imports zero `fs / net / http / child_process`

## Out of scope

- Forced transfer (any v1 ADR for this would be a major decision)
- License issuance (no actual permit emitted; only a "challenge allowed" boolean)
- Inter-node communication (no envelope is sent anywhere)
- Currency / token / SEED units (the value is "abstract priority units"; no monetary mapping)
- Persistent storage of carrying-cost records
- CLI verb (`dema urp carrying-cost ...` is not proposed for v0.1)
- Time-decay simulation (rate × value × time is left to a future spec)

## Acceptance criteria

1. New file `packages/core/src/urp-carrying-cost-preview.js` compiles, exports the 4 declared symbols.
2. New file `tests/urp-carrying-cost-preview.test.js` with ≥ 14 TDD anchors per F-01..F-07.
3. `scripts/review/boundary-invariant-check.mjs` `AUTHORITY_FLAGS` allowlist extended by the 3 new flags.
4. `docs/TESTING.md` registers the new test file.
5. All 7 gates green: `npm test`, `npm run check`, `npm run llm:guidance`, `npm run release:readiness`, `git diff --check`, `canon-check`, `boundary-invariant-check`.
6. The Integration Foundry registry's `harberger_cost` entry's `blocked_by` list is unchanged (this commit closes the first blocker without removing the other two).

## References

- `packages/core/src/shared-urp-world-preview.js` — the locked-world surface this module composes with
- `packages/consent/src/consent-common.js` — vocabulary source
- `docs/02-architecture/pat-builder-sat-validator.md` — `GateVerdict`
- `docs/superpowers/specs/2026-05-16-integration-foundry-registry/04_integration_notes.md` — names this as "most useful first sibling"
- `~/.claude/.../memory/reference_50_percent_pool_correct_framing.md` — operator canon on private memory sovereignty

## Operating law

```
Private memory is sovereign.
Shared resources carry responsibility.
No hoarding without cost.
No extraction without contribution.
No forced transfer in v0.1.
```
