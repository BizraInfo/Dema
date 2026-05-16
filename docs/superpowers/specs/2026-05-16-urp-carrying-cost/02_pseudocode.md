# Phase 02 — Pseudocode

## Module layout

```
packages/core/src/urp-carrying-cost-preview.js

SCHEMA constant
SHAREABLE_RESOURCE_TYPES constant (frozen array of 8)
FORBIDDEN_RESOURCE_TYPES constant (frozen array of 8)
BOUNDARY constant (frozen, 9 keys all false)
clone helper
deepFreeze helper
validateResourceType helper
buildSuccessEnvelope helper
buildFailureEnvelope helper
buildUrpCarryingCostPreview exported builder
```

Estimated size: ~120-160 LOC.

## Constants

```text
SCHEMA = "bizra.dema.urp_carrying_cost_preview.v0.1"

SHAREABLE_RESOURCE_TYPES = [
  "skill_pack",
  "knowledge_pack_manifest",
  "model_profile",
  "mission_template",
  "verified_proof_bundle",
  "resource_offer",
  "compute_offer",
  "agent_service_offer"
]

FORBIDDEN_RESOURCE_TYPES = [
  "private_conversation",
  "identity_data",
  "family_personal_data",
  "secrets",
  "raw_corpus",
  "unpublished_personal_memory",
  "credentials",
  "finance_data"
]

BOUNDARY = {
  runtime: false,
  federation: false,
  mint: false,
  economic_settlement: false,
  forced_transfer_executed: false,
  private_memory_accessed: false,
  raw_data_exchange: false,
  license_issued: false,
  shared_urp_published: false
}
```

## Validation pseudocode

```text
function validateResourceType(resource_type):
  if FORBIDDEN_RESOURCE_TYPES includes resource_type:
    return { ok: false, code: "forbidden_resource_type",
             detail: "${resource_type} is private; this module refuses by construction" }
  if not SHAREABLE_RESOURCE_TYPES includes resource_type:
    return { ok: false, code: "unknown_resource_type",
             detail: "${resource_type} is not on the shareable allowlist" }
  return { ok: true }

function validateNumericInputs(self_assessed_value, carrying_cost_rate):
  if not isFiniteNumber(self_assessed_value) or self_assessed_value <= 0:
    return { ok: false, code: "invalid_value",
             detail: "self_assessed_value must be a positive finite number" }
  if not isFiniteNumber(carrying_cost_rate) or carrying_cost_rate <= 0 or carrying_cost_rate >= 1:
    return { ok: false, code: "invalid_rate",
             detail: "carrying_cost_rate must be in the open interval (0, 1)" }
  return { ok: true }

function validateRequired({resource_id, owner_node, no_raw_data_proof}):
  for field in [resource_id, owner_node, no_raw_data_proof]:
    if not isNonEmptyString(field):
      return { ok: false, code: "missing_field",
               detail: "field must be a non-empty string" }
  return { ok: true }

function validateNow(now):
  if not (now is Date and now is valid):
    return { ok: false, code: "invalid_now",
             detail: "now must be a valid Date" }
  return { ok: true }
```

## Builder pseudocode

```text
export function buildUrpCarryingCostPreview({
  resource_id,
  resource_type,
  owner_node,
  self_assessed_value,
  carrying_cost_rate,
  license_challenge_allowed = true,
  no_raw_data_proof,
  now = new Date()
} = {}):

  # Order matters: type check first, then numeric, then required strings, then date.
  for check in [
    validateResourceType(resource_type),
    validateNumericInputs(self_assessed_value, carrying_cost_rate),
    validateRequired({resource_id, owner_node, no_raw_data_proof}),
    validateNow(now)
  ]:
    if not check.ok:
      return buildFailureEnvelope(check.code, check.detail)

  return buildSuccessEnvelope({
    resource_id,
    resource_type,
    owner_node,
    self_assessed_value,
    carrying_cost_rate,
    simulated_carrying_cost: self_assessed_value * carrying_cost_rate,
    license_challenge_allowed: license_challenge_allowed === true,
    no_raw_data_proof,
    generated_at: now.toISOString()
  })


function buildSuccessEnvelope(payload):
  return deepFreeze(clone({
    schema: SCHEMA,
    mode: "PREVIEW_ONLY",
    truth_label: "DECLARED",
    valid: true,
    ...payload,
    forced_transfer: false,
    raw_data_shared: false,
    settlement: "preview_only",
    boundary: BOUNDARY,
    note: "Owner may license-challenge. No forced transfer. No economic settlement. No private memory."
  }))


function buildFailureEnvelope(code, detail):
  return deepFreeze(clone({
    schema: SCHEMA,
    mode: "PREVIEW_ONLY",
    truth_label: "DECLARED",
    valid: false,
    denial: { code, detail },
    boundary: BOUNDARY
  }))
```

## Edge cases (handled by validation, not branching)

- `resource_type` is missing or null → caught by `validateResourceType`
- `resource_type` is a forbidden private type → caught with explicit `forbidden_resource_type` code
- `self_assessed_value === 0` or negative → caught
- `carrying_cost_rate === 0` or ≥ 1 → caught (rate must be in open interval)
- `now` is an invalid Date → caught
- `owner_node` is empty string → caught
- `no_raw_data_proof` is empty string → caught (must be a non-empty explanation)
- `license_challenge_allowed` is not a boolean → coerced to false (defensive)

## Helpers (same as established preview-module pattern)

```text
function clone(value):
  return JSON.parse(JSON.stringify(value))

function deepFreeze(value):
  if value is null or not object or already frozen: return value
  for child of value: deepFreeze(child)
  return Object.freeze(value)

function isNonEmptyString(value):
  return typeof value === "string" and value.trim().length > 0

function isFiniteNumber(value):
  return typeof value === "number" and Number.isFinite(value)
```

## What the builder does NOT do

- No I/O (no `fs`, no `net`, no `http`, no `child_process`)
- No model invocation
- No state mutation outside the local function scope
- No emission of a receipt (separate concern; receipt would be a future commit that composes this envelope with `evidence-chain-preview`)
- No assertion that the owner_node actually exists or is reachable (the module is data, not network)
- No persistence of the envelope (caller's responsibility, if any)
- No license issuance (`license_issued` flag stays false)
