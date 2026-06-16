# BASA — BIZRA Assumption-State Architecture v0.1

**Status:** `DECLARED_SPEC` / `DESIGNED_NOT_LIVE`
**Scope:** The architecture that binds the already-canonized Law of Assumption to
Dema's one cognitive loop — how `bootstrap-state`, `assumption-state`,
`proof-convergence`, `consent`, and `receipts` are facets of a single
epistemic discipline, and how the assumption-state aggregate is computed.
**Runtime boundary:** This document does not restate the Law of Assumption (it is
canon — see Authority), does not implement a runtime, write state, invoke a model,
open a network, mint a receipt, or make any federation / Block0 / token / PoI /
Shariah / production claim. It binds future composition; it executes nothing.

## 1. Authority — the Law is already canon

BASA does NOT define or restate the Law of Assumption. The Law is canonized in:

- [docs/canon/LAW_OF_ASSUMPTION.md](../canon/LAW_OF_ASSUMPTION.md)
- [docs/BIZRA_AGENT_DNA_LAW_OF_ASSUMPTION_v0_1.md](../BIZRA_AGENT_DNA_LAW_OF_ASSUMPTION_v0_1.md)

and the per-claim gate is already implemented and tested in
`packages/receipts/src/assumption-boundary-validator.js` (the canon V/D/A/U
four-state validator). BASA is the **architecture above them**: it explains why the
existing preview kernels belong to one loop, and adds one aggregate kernel that
composes the validator — nothing more.

## 2. The cognitive loop

Dema's epistemic discipline is a single loop, each step a facet of "no claim above
its evidence":

```
bootstrap-state   →  "what state am I allowed to start in?"   (bootstrap-mode.js)
assumption-state  →  "what am I assuming, and at what state?" (this spec · V/D/A/U)
proof-convergence →  "how well-evidenced is each claim?"      (proof-convergence-preview.js)
consent           →  "did the human authorize this act?"      (fate.js exact phrase)
receipt           →  "what is the witnessed record?"          (receipts · preview vs signed)
```

Each step is **fail-closed**: ambiguity is refusal, not action. BASA names the loop;
it does not sequence it at runtime (that is a later, consent-gated concern).

## 3. The four claim-states (V/D/A/U) — referenced, not restated

The validator defines the canon states; BASA only consumes them:

- **V — Verified:** asserts certainty; requires named `evidence_refs`. Certainty without
  a pointer is unsupported certainty (ZANN) → rejected.
- **D — Derived:** requires a `derived_from` chain.
- **A — Assumed-with-Iḥsān:** requires `assumption` + `ground` + `boundary` and
  `rejectable: true`. A naked assumption is rejected.
- **U — Unknown:** the label is the deliverable; cannot mutate, cannot go public/canonical.

See `validateAssumptionBoundary` for the binding rules. BASA does not duplicate them.

## 4. The assumption-state aggregate

`buildAssumptionStatePreview({ claims })`
(`packages/core/src/assumption-state-preview.js`) validates each claim through the
existing validator and aggregates:

- `by_state`: counts of valid claims per V/D/A/U.
- `uncertainty_surface`: `A + U` — declared-but-uncertain claims.
- `valid` / `invalid` counts.
- `admissible`: `true` only if **every** claim validates (`invalid === 0`).
- `posture`:
  - **REFUSED** — any claim is naked/invalid (the whole set fails closed).
  - **GROUNDED** — all valid and no uncertainty surface (everything V/D).
  - **BOUNDED_UNCERTAINTY** — all valid but some A/U present (uncertainty is _declared
    with Iḥsān_, not hidden — admissible-but-bounded).

The invariant: the aggregate is **never admitted above what every individual claim's
boundary allows**. One unsupported certainty refuses the set. This is the Law of
Assumption rendered as a composable, fail-closed state.

## 5. Composition map (DECLARED — this kernel only aggregates)

A future runtime composes, never reinvents:

- `packages/receipts/src/assumption-boundary-validator.js` — the per-claim V/D/A/U gate.
- `packages/core/src/proof-convergence-preview.js` — the 4-rail evidence grading
  (a claim's `proof-convergence` floor and its `assumption-state` are two views of the
  same epistemic posture; a later slice may cross-reference them).
- `packages/core/src/bootstrap-mode.js` — the model-less starting state.
- `packages/fate/src/fate.js` — exact-phrase consent.
- `packages/verifier/src/evidence-receipt-preview.js` — preview vs signed receipts.

## 6. Replay and test requirements

The determinism test (`tests/assumption-state-preview.test.js`) enforces:

1. All-V/D set → `GROUNDED`, `admissible: true`, `uncertainty_surface: 0`.
2. A well-formed A claim → valid, `BOUNDED_UNCERTAINTY` (declared, not refused).
3. Fail-closed: a naked claim (e.g. V without `evidence_refs`) → `REFUSED`,
   `admissible: false`; the invalid claim is credited no state.
4. An A without its Iḥsān shape (missing ground/rejectable) → refused.
5. `by_state` counts; canonical 16-key all-false frozen boundary; determinism +
   deep freeze; empty set → admissible (nothing to refuse), `GROUNDED`.

## 7. Non-claims / boundary

BASA does not claim any of the following — each named here only as a forbidden claim,
never asserted: `live assumption runtime`, `any write`, `model invocation`, `network`,
`federation`, `Block0 seal`, `token economy`, `PoI`, `Shariah/legal readiness`,
`production readiness`. It is a `DECLARED_SPEC` architecture plus one pure aggregate
kernel, bounded by the Law of Assumption it serves.
