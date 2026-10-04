# Receipt: L1 × CHAIN-ANCHOR — the loop now carries an expectation it cannot reach

Truth label: `L1_ANCHORED_NOT_ACTIVATED` — `LOCAL_ONLY`, sandbox-scoped.
Date: 2026-07-31 · Operator GO recorded in session `ef25a5e8`.

**Still not activation.** `RETRACTION-20260731T173800-L1-defects` stands.
This records one thing: the last open L1 audit-trail gap is closed at the
loop level, and the close is proven by execution.

## The gap that was open

`.l1/last_seal_head` (E5) is an **in-band** witness — it lives inside the
directory it testifies about. E5 catches deleting the chain alone. Deleting
the chain *and* the marker left `verifyChain` reporting a clean
`{valid: true, entries: 0, genesis: true}`, and the loop would keep sealing
on top of erased history. Measured before building:

```text
chain-only delete  -> {"valid":false,"why":"chain_absent_with_history"}   E5 holds
BOTH deleted       -> {"valid":true,"entries":0,"genesis":true}           false GREEN
```

No guard inside `.l1/` can close this. The missing element is an expectation
held outside everything the act can name.

## What landed

`runL1Cycle` / `resumeL1Cycle` accept `anchorDir`. When supplied:

| Point | Behaviour |
|---|---|
| before any mutation | `anchorGate` compares the observed chain against the last anchor |
| after SEAL | the sealed head is appended to a hash-linked anchor log outside the scope |
| before a resume completes | the same gate runs again |

Refusals, all fail-closed with `authority_delta: 0` and zero mutation:
`anchor_erased` · `anchor_truncated` · `anchor_forked` · `anchor_log_forged` ·
`anchor_inside_scope`.

Two ordering decisions worth naming:

1. **Anchor after the chain, never before.** A crash mid-seal leaves the
   anchor *behind* the chain — read as `EXTENDED` and safe. Anchoring first
   would leave it *ahead*, which reads as erasure and would brick the next
   cycle on its own crash.
2. **Growth is proven, not assumed.** The gate passes `head_history` from the
   chain, so `EXTENDED` means the anchored head was found at its position —
   not merely that the chain got longer.

## Evidence

```text
node --test tests/l1-micro-loop.test.js        25/25   (was 21/21)
red-first: pre-wire kernel, L1-17..L1-20        4 pass / 4 fail  → the tests bite
restored, sha256 237cadd5e7b37d25              identical, 25/25
node --test tests/chain-anchor.test.js         11/11
node --test tests/verification-admission.test.js 15/15
node scripts/review/kernel-purity-check.mjs    OK · 451 scanned · 0 violations
node --test tests/kernel-purity-check.test.js  26/26
```

L1-18 is the close, asserted end to end: run a real cycle under an anchor,
delete both `chain.jsonl` and `last_seal_head`, assert `verifyChain` **still
reports valid** — then assert run *and* resume refuse `anchor_erased` with the
source file untouched.

## Not claimed

- **Not L1 activation.** The retraction holds until the operator re-certifies.
- **Anchoring is per-call.** A cycle run without `anchorDir` carries the
  original gap. Making it mandatory needs a caller that always supplies one.
- **Anchor durability is the caller's.** This wires the comparison; it does
  not make the anchor store survive disk loss.
- Not L2, no daemon, no network, no model invocation.
