# Receipt: MATERIALIZATION-PULSE-RECEIPT-SCHEMA-PREVIEW-1A

Truth label: `MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_MEASURED_REPO`

## Slice

Pure preview-only canonical Materialization Pulse receipt envelope: assembles and content-addresses the atomic transaction receipt that binds one pulse's niyyah, input_safety (corpus-sanitizer verdict), plan, FATE verdict, execution preview, and claim_binding (public-metric claim-gate verdict) under an all-false boundary and an explicit does_not_prove list; rejects a receipt missing the sanitizer or claim-gate reference, a sealed pulse whose sanitizer verdict was BLOCKED, a public-safe claim while the claim gate REJECTED public claims, and any mint/federation/authority_delta violation; no execution, no live URP, no mint, no wallet, no federation, kernel stays pure.

```text
plan → build → verify → tamper-reject
```

## The missing middle

`#349` guards what enters; `#350` guards what leaves. This is the **transaction envelope** between
them — the atomic receipt that binds ONE Materialization Pulse:

```text
niyyah → input_safety(sanitizer) → plan → FATE → execution → claim_binding(claim-gate) → boundary → does_not_prove → content_hash
```

The two membrane verdicts (`input_safety.sanitizer_receipt` + `claim_binding.claim_gate_receipt`) are
carried as **references** inside one content-addressed receipt, so a pulse cannot be sealed unless both
membranes were consulted.

## Proof Contract (operator's §8 acceptance tests)

The gate must pass only while:

- a sealed pulse references BOTH membranes (`missing_sanitizer_reference` / `missing_claim_gate_reference`),
- a **sealed** pulse over a **BLOCKED** sanitizer verdict is rejected (`sealed_pulse_over_blocked_input`) — a BLOCKED input is legal only on an **aborted** pulse,
- `claims_public_safe:true` is rejected while the claim gate REJECTED public claims (`public_safe_with_rejected_claims`),
- `fate.mint_allowed:true`, `authority_delta ≠ 0`, and any Pulse-boundary flip (`federation_live` etc.) are rejected,
- `does_not_prove` exists and includes `live_urp` / `mint` / `federation`,
- the content hash is deterministic,
- `verify` re-derives the receipt evaluation — a forged `receipt_ok` is rejected,
- a valid preview pulse passes with an all-false boundary.

Honesty: it RUNS no pulse and re-runs NO sub-gate. `sanitizer_receipt` / `claim_gate_receipt` /
`plan_root` / `exec_merkle` are injected **hashes** it binds, not payloads it re-verifies — it proves
the envelope is well-formed and internally consistent, not that the referenced sub-receipts are valid.

## Boundary

`pulse_receipt_schema_complete` verdict only. No execution, live URP, mint, wallet, federation,
network, or model. Kernel meta-boundary all-false; Pulse boundary (6-key) all-false; `authority_delta` 0.

`npm run check` runs `materialization-pulse-receipt-schema-preview-check.mjs` and keeps `MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/materialization-pulse-receipt-schema-preview.test.js
node scripts/review/materialization-pulse-receipt-schema-preview-check.mjs --json
npm run check
```
