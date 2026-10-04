# Receipt: CHAIN-ANCHOR-1A — external anchor for hash-chained receipt logs

Truth label: `CHAIN_ANCHOR_COMPARATOR_ONLY` — `LOCAL_ONLY`, pure kernel.
Date: 2026-07-31 · Author session: Cowork · Node0

**Does not activate L1.** The retraction
(`RETRACTION-20260731T173800-L1-defects`) and the label
`L1_GUARDED_NOT_ACTIVATED` both stand. This receipt records one thing: the
last open defect in the L1 audit trail now has a comparator that closes it,
and the comparator is tested.

## The defect, measured

`verifyChain` in `l1-micro-loop.js` derives the expected head from the chain
file itself, so an erased chain verifies clean. Reproduced live before
building anything:

```text
chain before external delete: {"valid":true,"entries":1,"head":"989e10dd…"}
chain after  external delete: {"valid":true,"entries":0}   ← false GREEN
```

A self-contained chain cannot detect its own deletion. No guard inside the
kernel closes this, because the missing element is an expectation held
*outside* the thing it judges.

## What landed

`packages/core/src/chain-anchor.js` (pure) + `tests/chain-anchor.test.js`.

| Verdict | Condition |
|---|---|
| `OK` | observation matches the anchor exactly |
| `EXTENDED` | chain grew **and** the anchored head is proven present in history |
| `ERASED` | anchored entries existed; observation has none |
| `TRUNCATED` | some history survives, but fewer entries than anchored |
| `FORKED` | same length different head, or growth that does not contain the anchored head |
| `NO_ANCHOR` / `MALFORMED` | cannot judge — refuses, never passes |

Three properties worth naming:

1. **Growth is not assumed innocent.** Without `head_history`, a longer chain
   is `MALFORMED` ("cannot distinguish growth from replacement"), not
   `EXTENDED`. The kernel says what it cannot prove instead of guessing.
2. **The anchor log protects itself** (`verifyAnchorLog`) — anchor records are
   hash-linked, so an edited or dropped anchor is detectable. An unlinked
   judge is as forgeable as the thing it judges.
3. **Placement is law** (`assertAnchorOutside`) — an anchor stored inside the
   leased scope is refused, because the act could rename its own judge away.
   That is the E2 defect one level up, closed by construction.

Purity: no `node:fs`, no `node:crypto`, no clock, no randomness — `hash` and
`at` are injected. Verified by test against comment-stripped source, so the
prohibition can still be written down in the header without tripping its own
check.

## Evidence

```text
node --test tests/chain-anchor.test.js            11/11 pass
red-first (erasure branch neutered)                9 pass / 2 fail  → tests bite
restored, sha256 ffd2b1e12a665eb38c0c4505…        identical, 11/11 pass
node --test tests/l1-micro-loop.test.js
        + tests/verification-admission.test.js    32/32 pass (no regression)
node scripts/review/kernel-purity-check.mjs       OK · 451 scanned · 0 violations
node --test tests/kernel-purity-check.test.js     26/26 pass
```

CA-03 is the live end-to-end case, rebound 2026-07-31 18:30 after E5 landed in
`l1-micro-loop.js`: run a real L1 cycle, erase the chain by rename and assert
**E5 now catches it** (`chain_absent_with_history`), then erase
`.l1/last_seal_head` as well and assert `verifyChain` reports a clean
`genesis:true` while the external anchor still returns `ERASED`. E5's witness
lives in the directory it testifies about, so the two-delete case is the gap an
in-band guard structurally cannot close — that is where this kernel is the only
defense. The surviving false GREEN is asserted in the test, not just described.

## Not claimed

- ~~Not wired.~~ **WIRED 2026-07-31 under operator GO.** `runL1Cycle` and
  `resumeL1Cycle` accept `anchorDir`; the gate runs before any mutation and
  again before a resume completes. Refusals: `anchor_erased` ·
  `anchor_truncated` · `anchor_forked` · `anchor_log_forged` ·
  `anchor_inside_scope`. Regressions L1-17..L1-20, red-first verified against
  the pre-wire kernel (4 pass / 4 fail before, 25/25 after). Anchoring is
  per-call — a cycle run without `anchorDir` still carries the original gap.
- **Not durable.** The anchor store's own persistence and backup are the
  caller's problem; this kernel judges, it does not keep.
- **Not L1 activation**, not a closed loop, no daemon, no network.
- `npm test` / `npm run check` not re-run here: both were exit 1 before this
  slice for unrelated reasons (31 pre-existing failures; `ask` consent-bridge
  gate). This slice adds 11 passing tests and 0 known regressions.

## Convergence

| Rail | Level |
|---|---|
| Formal | 3 — verdict vocabulary closed, laws asserted as tests |
| Cryptographic | 3 — anchor log hash-linked, tamper detected in test |
| Empirical | 3 — tested and observed, red-first proven |
| Economic | 0 — no cost or impact claim made |

`Disk wins.`
