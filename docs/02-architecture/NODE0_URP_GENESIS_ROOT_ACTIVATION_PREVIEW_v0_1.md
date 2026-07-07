# NODE0-URP-GENESIS-ROOT-ACTIVATION-PREVIEW-1A

Truth label: `NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_MEASURED_REPO`

## Purpose

Preview-only Node0 URP Genesis Root: composes and validates a local resource-registry descriptor (identity, machine/compute/data resource policies, consent scopes, signed receipt-chain-head anchor, boundary flags) declaring what Node0 owns/permits/shares. Validates a caller-provided descriptor, activates nothing, tops at local_preview_active below the gated activate rung. Mints nothing, binds no live identity.

## Input Contract

```js
runNode0UrpGenesisRootActivationPreview({ consent, input })
```

Exact consent:

```text
GO: node0 urp genesis root activation preview
```

`input` = the 13-field descriptor inputs (identity ×3, machine/compute/data resource policies,
consent scope profile, a caller-produced `signed_chain_head` attestation, builder_space_pointer,
optional `boundary_flags` / `declared_claims`). See `exampleGenesisRootInput()`.

## Output / descriptor

```text
activation_status   one of ACTIVATION_STATUSES (local_preview_active only when fully valid)
content_hash        sha256 of the canonical descriptor body
signed_receipt_anchor_ref   { schema, head_hash, chain_content_hash, public_key_fingerprint }
boundary            all-false (8 keys) · domain_flags all-false (11 keys)
authority_delta 0 · grants_action false · mint_allowed false · blocked_by[]
```

## Status resolution (fail-closed)

`rejected_overclaim` (any domain flag true / overclaim wording / authority_delta>0 / grants_action /
unknown status) → `blocked_pending_health` (missing identity/builder-pointer/anchor) →
`blocked_pending_consent` → `blocked_pending_resource_policy` → `blocked_pending_data_policy` →
`local_preview_active`.

## Verification

```js
verifyNode0UrpGenesisRootActivationPreview(descriptor)
```

Re-derives the content hash (naive tamper → `content_hash_mismatch`), **re-verifies the receipt-root
anchor signature** via `node0-signed-chain-head` (anchor tamper → `signed_receipt_anchor_invalid`, even
if the content hash is recomputed), and deep-checks the all-false boundary + 11 domain flags +
`authority_delta:0`/`grants_action:false`/`mint_allowed:false`.

## Boundaries

- Pure kernel; **no fs/network/process/clock/random** — it validates a caller-provided signed
  attestation; the ephemeral keypair is generated in the gate/test, never in the kernel.
- **Activates nothing** — sits below the ladder's gated `activate` rung; `local_preview_active` is a
  descriptor state, not a live runtime. Binds no live Node0 identity.
- All-false boundary + all-false domain flags. Receipt-root anchor is signature-backed; other
  descriptor fields are content-addressed only.

## Files

```text
packages/core/src/node0-urp-genesis-root-activation-preview.js
tests/node0-urp-genesis-root-activation-preview.test.js
scripts/review/node0-urp-genesis-root-activation-preview-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_1A.md
docs/02-architecture/NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_v0_1.md
```

## Commands

```bash
node --test tests/node0-urp-genesis-root-activation-preview.test.js
node scripts/review/node0-urp-genesis-root-activation-preview-check.mjs --json
npm test
npm run check
```
