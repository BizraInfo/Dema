# Receipt: NODE0-FATE-STAGED-EFFECT-1A

Truth label: `NODE0_FATE_STAGED_EFFECT_MEASURED_REPO`

## Slice

G6 composition kernel: FATE exact-string consent gates a staged reversible effect with independent world observation and exactly-once crash recovery (effect_done_receipt_absent never re-executes)

```text
plan → build → verify → tamper-reject
```

## Proof Contract

The default gate (fresh temp scope) must pass only while:

- the kernel GO phrase and the DISTINCT operator FATE phrase both byte-match,
- the composition walks STAGED → EFFECTED → OBSERVED → COMMITTED with the
  world renamed exactly once (`effect_execution_count: 1`),
- the envelope is body-bound (execution_count inside the content hash) and a
  tampered copy fails verification,
- the boundary stays all-false.

### The law under proof: exactly-once across the crash window

A rename preserves bytes, so the stage record carries a PREDICTABLE
after-image (before digest, new name). Resume therefore classifies by
MEASURING the world:

| World state at resume | Classification | Action |
|---|---|---|
| dst == after_prediction, src absent | already effected | observe + commit; NEVER re-execute |
| src == before digest, dst absent | staged-not-effected | execute once via the gate |
| anything else | ambiguous / corrupted | RECOVERY_REQUIRED, fail closed |

Fault injection lands on journal-append #3 — AFTER the gate\u2019s own internal
receipt-log write (#2) — which is precisely the effect-done-receipt-absent
window. An adversary corrupting dst inside the observation window hits the
gate\u2019s undo-refusal law: the composition fails closed into
RECOVERY_REQUIRED with evidence preserved. No silent redo. No silent restore.

**Honesty note:** same envelope-anchor ceiling as sibling slices — no external
signature anchors the commit envelope; strength comes from delegated receipts,
the linked journal, and predictable-after-image classification.

`npm run check` runs `node0-fate-staged-effect-check.mjs` and keeps `NODE0_FATE_STAGED_EFFECT_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/node0-fate-staged-effect.test.js
node scripts/review/node0-fate-staged-effect-check.mjs --json
npm run check
```
