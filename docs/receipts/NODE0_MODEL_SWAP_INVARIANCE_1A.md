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

---

## NODE0-MODEL-SWAP-TRANSPORT-REPRODUCTION-2A

1A/1B/1C hardened the **build** side. This slice closes the **transport** side.

### What was open

`CURRENT_LIMITS.md` stated the gap plainly, and the kernel repeated it in a comment:
a transported attestation carried `contract_hash` and classified rows and nothing
else, so a receiver could establish only that the rows agreed *with each other*. It
could not confirm that any output satisfied the contract, that `failed_requirements`
came from a real evaluation, or that the builder ran `evaluateAgainstContract` at all.
The builder was trusted. The doc defended that with a bolded warning to humans —
*"do not read the stronger for the weaker"* — which is not a gate.

### What changed

The envelope may now **opt in** to carrying evidence: `transport.carry_contract` puts
the validated predicates in the body, `transport.carry_outputs` puts each judged output
in its row. Nothing is carried by default, so the 1A envelope is byte-unchanged (T45).

`verify()` returns `established` — the tier it **derived from what the body carried**,
never a tier the body asserts. There is no tier field to forge:

| tier | requires | establishes |
| --- | --- | --- |
| `rows_consistent` | rows only | the 1A/1B/1C guarantee — rows agree with each other |
| `contract_reproduced` | + `acceptance_contract` | hash-bound to `contract_hash`, admissible, **non-vacuous** |
| `verdict_reproduced` | + `candidates[].output` | each output hashes to its row, and the contract is **re-run** per row reproducing both `verdict` and `failed_requirements` |

### The rule that makes it a gate

> **Presence is an obligation.** Anything the envelope carries is re-run. Carried
> evidence that fails to reproduce sets `ok:false` — never a silent downgrade to a
> weaker tier.

Without that, the tier is a badge a builder awards itself. A forger's only remaining
move is to carry *less*, which changes the body and breaks `hash_ok`; rehashing after
stripping yields an honest *weaker* attestation, which is the system working.

### Measured

Eight tests, red first at `badb1c18` before any implementation. T45 default envelope
unchanged · T46 contract tier · T47 carried contract that does not hash to its
commitment is refused and may not report the tier it failed · T48 a zero-predicate
contract is refused **at verify time**, closing the 1B gap `CURRENT_LIMITS` had
declared uncatchable by a receiver · T49 verdict tier by re-running the contract ·
T50 a forged ACCEPT verdict is caught · T51 an invented `failed_requirements` is
caught · T52 an output that does not hash to its row is refused.

### What this does NOT prove

At **every** tier, including `verdict_reproduced`: this proves the carried outputs
reproduce the carried verdicts under a contract that hashes to `contract_hash`. It
does **not** prove those outputs came from the stated `model_id`s. Model provenance
remains unattested; the boundary stays all-false and no model is invoked. The
alternative closure — output commitments bound to an independently trusted evaluator
receipt — is still not built.

## Commands

```bash
node --test tests/node0-model-swap-invariance.test.js
node scripts/review/node0-model-swap-invariance-check.mjs --json
npm test
```
