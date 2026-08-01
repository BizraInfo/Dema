# Receipt: L1-MICRO-LOOP-1A — chain continuity (E5)

Truth label: `L1_GUARDED_NOT_ACTIVATED` — `LOCAL_ONLY`, sandbox-scoped.

Binds to: `RETRACTION-20260731T173800-L1-defects` (still stands).
Supersedes nothing about activation. Closes the open gap named in
`L1_MICRO_LOOP_1A_BLAST_RADIUS_GUARDS.md` § "externally deleted chain".

## Defect

After a successful seal, an out-of-band `unlink` of `.l1/chain.jsonl` made
`verifyChain` return `{ valid: true, entries: 0 }`. `readChainHead` fell back
to `GENESIS_HEAD`, so a later seal would re-anchor history. The in-band path
was already blocked by `act_targets_audit_state` (E2); the out-of-band path
was not.

## Guard

| Mechanism | Behavior |
| --- | --- |
| `.l1/last_seal_head` | Written **after** each successful chain append |
| `verifyChain` | Missing/empty chain + prior seal → `why: chain_absent_with_history`, `genesis: false` |
| `runL1Cycle` / `resumeL1Cycle` / `sealReceipt` | Same continuity check **before** mutation or seal |
| Mid-first-cycle | Backup/cycle without `last_seal_head` → still `genesis: true` (no false-RED) |

## Proof (this host)

```text
node --test tests/l1-micro-loop.test.js
# tests 21 / pass 21 / fail 0

sha256 packages/core/src/l1-micro-loop.js
95627a65e5e63a69b8b8e06ef875c31a12cf1dcff260d57ad7d44dd893cf0129

sha256 tests/l1-micro-loop.test.js
336eced1f14c17d17d8dc370d130b030b736c5db3be7ffb4ef59278cb1ba0c39

node scripts/review/kernel-purity-check.mjs  # OK
npm run llm:guidance                         # PASS
```

Regressions: L1-17, L1-17b, L1-17c, L1-17d.

## What this does not prove

- Not L1 activation / not `MEASURED`.
- Not an external tamper-proof anchor — deleting `chain.jsonl` **and**
  `last_seal_head` still looks like genesis.
- Not resistance to suffix truncation of chain lines.
- Not green `npm test` / `npm run check` for the whole repo.
