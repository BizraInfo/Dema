# Receipt: NODE0-URP-GENESIS-ROOT-ACTIVATION-PREVIEW-1A

Truth label: `NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_MEASURED_REPO`.

## Slice

The first implementation of the reserved `BIZRA_URP_GENESIS_PREVIEW` slot
(`reward-eligibility-contract-preview.js:54`). A preview-only kernel that **composes and validates a
Node0 URP Genesis Root descriptor** — the local registry of what Node0 declares it owns, permits, and
shares — and attaches a **signature-backed receipt-chain-head anchor**.

```text
compose → validate (fail-closed) → sign receipt root (node0-signed-chain-head) → content-hash → local_preview_active
```

## Honesty (§0 — grounded in CURRENT_LIMITS.md / THIRD_FACT_CURRENT_STATE_DELTA.md)

The 7 BIZRA components are isolated preview kernels, **not** a wired state machine; FATE is not
runtime-enforced/non-bypassable; there is no live PoI ledger and no SQLite. **This slice activates
nothing.** It produces an inert, content-addressed descriptor that sits **below** the ladder's gated
`activate` rung (`node0-activation-ladder.js:88-95`). `local_preview_active` = the descriptor is
composed, internally valid, and carries a signed receipt-chain-head anchor — **not** a live runtime.

## Descriptor (13 fields)

`node0_identity · bizra_project_identity · operator_identity · machine_resource_profile ·
compute_resource_policy · data_resource_policy · consent_scope_profile · signed_receipt_anchor_ref ·
builder_space_pointer · activation_status · boundary_flags · what_this_proves · what_this_does_not_prove`.

## Proof contract (32 focused tests + review gate)

- valid input → `local_preview_active`; each missing required field → its specific
  `blocked_pending_health/consent/resource_policy/data_policy`.
- each of the 11 domain flags true → `rejected_overclaim` (`live_urp`, `public_identity_genesis`,
  `mint_allowed`, `wallet_enabled`, `settlement_enabled`, `payment_enabled`, `federation_enabled`,
  `remote_execution_enabled`, `public_market_enabled`, `model_invocation_enabled`, `daemon_enabled`).
- public-market / simulated-impact-as-verified / resource-cost-as-value wording → `rejected_overclaim`.
- `authority_delta>0`, `grants_action:true`, unknown/live activation status → reject.
- content hash stable; naive field tamper → `content_hash_mismatch`; **receipt-root anchor tamper →
  rejected by signature** (via `node0-signed-chain-head`).

## Reuse (composition, not reinvention)

`node0-signed-chain-head.js` (receipt-root signer; keys injected/ephemeral) · `node0-proof-chain-link.js`
· `generateEd25519Keypair` (gate/test only) · the resource/consent/boundary shapes modeled in
`node0-multi-device-urp-resource-manifest-preview.js`, `node0-nodespace-boundary-preview.js`, `urp-local.js`.

## What this proves

That a Node0 URP Genesis Root descriptor can be deterministically composed, fail-closed validated, and
bound to a signed receipt-chain-head — reaching `local_preview_active` only under all safe conditions.

## What this does NOT prove

No live URP, mint, wallet, settlement, payment, federation, remote execution, daemon, model, or network;
binds no live Node0 identity. The anchor is signature-backed; other descriptor fields are content-addressed
only. `local_preview_active` is a descriptor state, not a live runtime.

## Commands

```bash
node --test tests/node0-urp-genesis-root-activation-preview.test.js
node scripts/review/node0-urp-genesis-root-activation-preview-check.mjs --json
npm run check
```
