# Receipt: NODE0-MODEL-SWAP-INVARIANCE-1A

Truth label: `NODE0_MODEL_SWAP_INVARIANCE_MEASURED_REPO`

## Slice

Pure kernel proving a mission-task verdict is invariant to which model produced the output: the system contract decides ACCEPT/REJECT, model identity never launders a failing output nor changes a passing one.

```text
plan → build → verify → tamper-reject
```

## Proof Contract

The default gate must pass only while:

- the exact GO phrase matches byte-for-byte,
- the canonical payload is content-addressed,
- verification re-derives from the body and rejects tamper,
- a forged body with a recomputed hash is still rejected,
- the attestation carries an actual swap — at least two distinct `model_id`s, no duplicates,
- a malformed, mistyped or unknown acceptance-contract field is refused, never skipped,
- the acceptance contract is admissible — well-formed AND imposing at least one
  effective predicate, decided by the single `validateAcceptanceContract()` that
  both `plan` and `evaluateAgainstContract` consume,
- the boundary stays all-false (no execution authority).

## What this proves, and what it does not

Two guarantees of different strength live in this kernel. Do not read the stronger
for the weaker:

| Path | Establishes |
|---|---|
| BUILD — `run()` over real injected candidates | The contract is actually executed and the invariants constructively recomputed. Verdict-invariance, measured. |
| VERIFY — a *transported* attestation | Row-derived attestation consistency only: no output hash carries two verdicts, summary counts match the rows, at least two distinct models are present. |

`verify()` cannot confirm that each output truly satisfied the contract, that
`failed_requirements` reflects a real evaluation, or that the builder honestly ran
`evaluateAgainstContract` — the payload carries `contract_hash` and candidate rows,
never the contract predicates or the raw outputs. Closing that gap needs the
canonical contract plus outputs in the envelope, or output commitments bound to an
independently trusted evaluator receipt. Neither is built.

`npm run check` runs `node0-model-swap-invariance-check.mjs` and keeps `NODE0_MODEL_SWAP_INVARIANCE_1A` at `MEASURED_REPO`.

## Hotfix note — PROOF-CONTRACT-HOTFIX-1A

The fourth bullet above ("a forged body with a recomputed hash is still rejected") was
asserted by this receipt from the slice's first landing and was **not true of the code**.
On `c64fedb`, `verifyNode0ModelSwapInvariance` read the `invariants` booleans straight off
the payload, so a body whose own candidate rows contradicted its claim verified `ok: true`
once rehashed. Two sibling vacuity paths existed alongside it: a one-model (or duplicate-
`model_id`) attestation satisfied every invariant trivially, and a mistyped contract field
silently disabled its own check. All three were reproduced before being fixed, and each is
now pinned by a test (T9–T17). Recorded here because a receipt claiming a property the
kernel lacked is the exact failure this repo treats as unacceptable — the claim outran the
code, and the gate could not see it.

## Commands

```bash
node --test tests/node0-model-swap-invariance.test.js
node scripts/review/node0-model-swap-invariance-check.mjs --json
npm run check
```
