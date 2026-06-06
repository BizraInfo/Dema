# Dema URP Resource Offer v0.1

**Status:** DECLARED design (preview-only spec; no implementation, no publication).
**Date:** 2026-05-16
**Scope:** Specify a preview-only module that records a typed offer of a shareable URP resource. The offer declares what is on offer, what effects the receiver may have, what is denied, and what consent is required — without publishing the resource to the shared URP or transferring ownership. Composes with `urp-carrying-cost-preview` for the same set of shareable types. Sibling spec in the Integration Foundry family.

## Current facts

- `docs/superpowers/specs/2026-05-16-urp-carrying-cost/01_specification.md` (commit `07ffbef`) declares 8 `SHAREABLE_RESOURCE_TYPES` and 8 `FORBIDDEN_RESOURCE_TYPES`. This spec reuses both.
- `packages/core/src/shared-urp-world-preview.js` (commit `13f32c5`) declares the locked-world surface with `shared_urp_publish: false` in its boundary.
- `packages/consent/src/consent-hash-preview.js` declares `OPERATIONS`.
- `packages/core/src/external-pattern-registry-preview.js` — `harberger_cost` entry references shared-URP resources as the only legitimate scope.

## Product objective

For each shareable URP resource the operator might offer, emit a typed envelope that records:

1. **Resource ID** — opaque string identifier
2. **Resource type** — one of the 8 `SHAREABLE_RESOURCE_TYPES` (private types refused by construction)
3. **Owner node** — node identifier (never a person)
4. **Declared effects** — subset of `OPERATIONS` the receiver may have
5. **Denied effects** — explicit refusals (defaults to `[write, execute, call]` if not specified)
6. **Required consent field** — `MICRO_CONSENT_SHAPE` field a receiver must fill
7. **Required SAT verdict** — `GateVerdict` outcome
8. **Settlement** — always `"preview_only"` in v0.1
9. **No-raw-data proof** — operator-articulated string (≥ 30 chars) explaining no private data is bundled
10. **Carrying cost reference** — optional link to a paired `urp-carrying-cost-preview` envelope
11. **Published** — always `false` in v0.1

## Functional requirements

### F-01 · Module exports

```
packages/core/src/urp-resource-offer-preview.js

export const URP_RESOURCE_OFFER_PREVIEW_SCHEMA =
  "bizra.dema.urp_resource_offer_preview.v0.1"
// Reuse the same allowlists as urp-carrying-cost-preview
import { SHAREABLE_RESOURCE_TYPES, FORBIDDEN_RESOURCE_TYPES }
  from "./urp-carrying-cost-preview.js"
export function buildUrpResourceOfferPreview({
  resource_id, resource_type, owner_node,
  declared_effects, denied_effects,
  consent_field_required, sat_verdict_required,
  no_raw_data_proof, carrying_cost_reference, now
})
```

### F-02 · Envelope shape (success)

```
{
  schema:                   "bizra.dema.urp_resource_offer_preview.v0.1",
  mode:                     "PREVIEW_ONLY",
  truth_label:              "DECLARED",
  valid:                    true,
  resource_id:              <string>,
  resource_type:            <one of SHAREABLE_RESOURCE_TYPES>,
  owner_node:               <string>,
  declared_effects:         <array subset of OPERATIONS>,
  denied_effects:           <array subset of OPERATIONS>,
  consent_field_required:   <one of MICRO_CONSENT_SHAPE>,
  sat_verdict_required:     <one of GateVerdict>,
  settlement:               "preview_only",                     -- invariant
  no_raw_data_proof:        <string, ≥ 30 chars>,
  carrying_cost_reference:  <string or null>,
  published:                false,                              -- invariant
  generated_at:             <ISO>,
  boundary: { ... 8 authority flags all false ... }
}
```

### F-03 · Boundary invariants

```
runtime:                   false
federation:                false
mint:                      false
shared_urp_publish:        false  (already in AUTHORITY_FLAGS)
economic_settlement:       false
raw_data_exchange:         false
offer_published:           false  (NEW flag, add to allowlist)
ownership_transferred:     false  (NEW flag, add to allowlist)
```

### F-04 · Validation

- `resource_type` MUST be in `SHAREABLE_RESOURCE_TYPES`; explicit error if in `FORBIDDEN_RESOURCE_TYPES`
- `declared_effects` ∩ `denied_effects` empty
- All effect entries in `OPERATIONS`
- `denied_effects` MUST include `write`, `execute`, `call` (v0.1 invariant for offers; receiver-side activation is out of scope)
- `consent_field_required` in `MICRO_CONSENT_SHAPE`
- `sat_verdict_required` in `GateVerdict`
- `no_raw_data_proof` ≥ 30 chars non-empty
- `carrying_cost_reference` either `null` OR matches `/^chal-[0-9a-f]{32}$/` OR matches a sibling-envelope identifier format
- `owner_node` non-empty (never a person identifier; validation rejects strings that contain `@` or `:` characters as a heuristic against person-identifier leakage)

### F-05 · v0.1 invariants

- `settlement` always `"preview_only"`
- `published` always `false`
- `denied_effects` always includes write + execute + call
- Module imports `SHAREABLE_RESOURCE_TYPES` + `FORBIDDEN_RESOURCE_TYPES` from `urp-carrying-cost-preview` (single source of truth)

### F-06 · Determinism + purity

Same inputs → deeply-equal frozen output with fresh references.

## Out of scope

- Publication to a shared URP surface (separate ADR + halt-gate)
- Receiver-side acceptance flow
- Cross-node transport
- Settlement / payment / SEED accounting
- Ownership transfer
- CLI verb
- Cryptographic signing

## Acceptance criteria

1. New file at `packages/core/src/urp-resource-offer-preview.js`
2. New test file with ≥ 14 TDD anchors
3. `AUTHORITY_FLAGS` extended by 2 new flags (`offer_published`, `ownership_transferred`)
4. `docs/TESTING.md` registers the new test
5. All 7 gates green; `boundary-invariant-check` `modules_scanned ≥ 29`
6. Cross-spec test: a paired urp-carrying-cost-preview + urp-resource-offer-preview envelope on the same resource_id is consistent (out of scope for this spec's tests but recommended for a v0.2 integration)

## References

- `docs/superpowers/specs/2026-05-16-urp-carrying-cost/01_specification.md` — paired spec; shares `SHAREABLE_RESOURCE_TYPES` + `FORBIDDEN_RESOURCE_TYPES`
- `packages/core/src/shared-urp-world-preview.js` — locked-world surface this spec composes with
- `packages/consent/src/consent-hash-preview.js` — `OPERATIONS`
- `packages/core/src/external-pattern-registry-preview.js` — `harberger_cost` entry references shared-URP resources

## Operating law

```
The offer declares the resource.
The offer is not the publication.
Private memory is never offered.
Write, execute, and call are denied by default.
Settlement stays at preview_only.
```
