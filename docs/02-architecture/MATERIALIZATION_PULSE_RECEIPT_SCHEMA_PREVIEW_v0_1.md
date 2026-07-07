# MATERIALIZATION-PULSE-RECEIPT-SCHEMA-PREVIEW-1A

Truth label: `MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_MEASURED_REPO`

## Purpose

The **"missing middle"** of the dual-membrane Materialization Pulse: the canonical, atomic transaction
receipt that binds the input-side membrane (corpus-sanitizer verdict) and the output-side membrane
(claim-gate verdict) — together with niyyah, plan, FATE, and execution — into one content-addressed
envelope. A pulse cannot be sealed unless **both** membranes were consulted.

```text
niyyah → input_safety(sanitizer) → plan → FATE → execution → claim_binding(claim-gate) → boundary → does_not_prove → content_hash
```

It ASSEMBLES and VERIFIES the envelope; it runs no pulse and re-runs no sub-gate.

## Receipt body (`bizra.materialization_pulse_receipt.v0.1`)

```text
pulse_id · mission_id · prev_pulse(hash|null) · pulse_status(sealed|aborted)
niyyah{hash, truth_label}
input_safety{sanitizer_receipt(hash), verdict(ALLOWED|QUARANTINED|BLOCKED)}
plan{plan_root(hash), rejected_branch_count}
fate{verdict(PERMIT|PERMIT_WITH_CONFIRMATION|REVIEW|REJECT), authority_delta:0, grants_action:false, mint_allowed:false}
execution{mode(preview|local_readonly|reversible_local|external_gated), exec_merkle(hash|null)}
claim_binding{claim_gate_receipt(hash), rejected_count, unknown_count} · claims_public_safe
boundary(6-key all-false) · does_not_prove[live_urp,federation,mint,wallet,economic_settlement]
```

## Consistency rules (operator's §8)

```text
sealed pulse MUST reference both sanitizer + claim gate
sealed pulse over a BLOCKED sanitizer verdict → illegal (aborted-only)
claims_public_safe:true → only if claim_binding.rejected_count == 0
fate.mint_allowed / authority_delta≠0 / any boundary flip → rejected
does_not_prove MUST include live_urp / mint / federation
```

## Input / Output Contract

```js
runMaterializationPulseReceiptSchemaPreview({ consent, input })  // input = { pulse: {...parts...} }
```
Exact consent: `GO: materialization pulse receipt schema preview`. Output: `schema · truth_label · ok ·
status · content_hash · receipt_ok · receipt_blocked_by · pulse_status · receipt · boundary(all-false) ·
mint_allowed:false · authority_delta:0 · blocked_by[]`.

## Verification

```js
verifyMaterializationPulseReceiptSchemaPreview(payload)
```
Body-bound re-derivation PLUS re-derivation of the receipt evaluation — a forged `receipt_ok` is rejected.

## What this does NOT prove

It runs no pulse and re-runs no sub-gate. `sanitizer_receipt` / `claim_gate_receipt` / `plan_root` /
`exec_merkle` are injected **hashes** it binds, not payloads it re-verifies — it proves the envelope is
well-formed and internally consistent, not that the referenced sub-receipts are valid. No execution,
live URP, mint, wallet, federation, network, or model.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/materialization-pulse-receipt-schema-preview.js
tests/materialization-pulse-receipt-schema-preview.test.js
scripts/review/materialization-pulse-receipt-schema-preview-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_1A.md
docs/02-architecture/MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_v0_1.md
```

## Commands

```bash
node --test tests/materialization-pulse-receipt-schema-preview.test.js
node scripts/review/materialization-pulse-receipt-schema-preview-check.mjs --json
npm test
npm run check
```
