# MANIFEST #1 — CALIBRE-Ω0-MECHANICAL-CLOSURE-1A

Date: 2026-08-01 · Dubai · Author session: Cowork
Truth label: `OMEGA0_MECHANICAL_CLOSURE_LOCAL` — `LOCAL_ONLY`, uncommitted.

## Niyyah (Phase 1)

**WHAT** — Close Ω0-M: build the canonical Node0 route where external
anchoring is mandatory *by law*, bind a real reversible effect, and prove the
seal survives a fresh process.
**WHY** — `anchorDir` was optional per call; optional protection is not
protection. A production-shaped invocation could silently inherit the
evidence-erasure gap. The three gears (reversible corridor · anchored L1 ·
mission/consent/receipt) turned separately; the governed join did not exist.
**SUCCESS** — one consented intention → real files moved → zero loss →
undo → hash-verified restoration → re-apply → seal → fresh-process replay.

## Bayyinah (Phase 2) — pre-state, measured

```text
l1-micro-loop + chain-anchor    36/36 pass (anchor wired by peer session, per-call optional)
canonical route                 DID NOT EXIST
real corridor bound to a route  NO
anchor mandatory                NO — omitting anchorDir silently downgrades
```

## Hadd (Phase 3) — boundary

IN: canonical route module · effect-adapter interface · anchor-mandatory law ·
consent↔plan-hash binding · independent verification · Proof Card · replay.
OUT: git SHA (**outward blocker** — git unusable in this sandbox) · URP ·
federation · L2 chaining · dedupe · lesson admission · publication ·
activation · L1 retraction lifting (operator's gate).

One architectural change. `l1-micro-loop.js` was **not** edited — it was HOT
from a peer session at cycle start (`docs/SESSION-OWNERSHIP.md` §3.1).

## Amanah (Phase 4) — execution

`packages/core/src/omega0-mechanical-closure.js` + 10 tests.

Six laws, each asserted:

1. **Anchor is a precondition, not an option.** Missing → `anchor_required`,
   *before* any mutation. Inside the leased scope → `anchor_inside_scope`.
   Erased / truncated / forked / forged log → each blocks by its own name.
2. **The effect is an injected adapter.** The route governs; it does not know
   how to move a file. Replaceable actor, non-replaceable law.
3. **Consent binds an exact plan hash.** A plan that changed after consent is
   a different plan → `authority_mismatch`.
4. **Verification is computed by the route, never reported by the adapter.**
   An actor that grades itself is not verified.
5. **Every terminal state emits a card**, refusals included. A refusal
   without a receipt is an unexplained silence.
6. **`authority_delta: 0` on every path.**

Purity: the module imports **no `node:fs`**. The first draft did — the gate
caught it, and the honest fix was removing the dead import rather than
allowlisting it. A governor able to touch the world directly is a second
actor, and law 4 would become a claim about itself.

## Thamara (Phase 5) — verified reward

**Synthetic (10/10):** happy path · missing anchor blocks with world untouched
· anchor-inside-scope · erased/truncated/forked/forged each named ·
consent-hash mismatch with no mutation · lease and adapter preconditions ·
content-destroying effect caught **and rolled back** · dishonest undo caught by
hash · replay law (world tamper and card tamper both refuse).

**Real estate folder** — three genuinely messy files in
`~/Downloads/_scratch/omega0-real`:

```text
status        : SEALED
source_loss   : 0        content_hash_changes : 0
undo proven   : true     undo_success         : 100%
anchor        : enforced, outside the leased scope
seal_head     : f2bd46c6bbd348c99a0c6af86e346ae2…
```

**Fresh process (separate node invocation, seal read from disk):**

```text
replayed: true · seal_head_matches: true · world_state_matches: true
```

Final real state: `documents/BIZRA_memo.txt`, `invoice_draft.txt`,
`notes_final_1_.txt` — renamed, nothing lost, nothing deleted.

**Red-first:** neutering the `anchor_required` law drops the suite to 9/10;
restored source is byte-identical (`sha256 ad1dba59032cf7e23a00…`), 10/10.

**Gates:** kernel-purity OK · 452 scanned · 0 violations. Composed slice
**87/87** (route 10 · anchor 11 · L1 25 · admission 15 · purity 26).
Constitutional filter: no frozen anchor weakened; no authority increase;
consent required and recorded; nothing deleted.

## Iisal (Phase 6) — what is now true, and what is not

| Ω0 gate | State |
|---|---|
| **Ω0-M Mechanical** | route exists, anchor mandatory, real effect sealed, replay proven — **LOCAL, uncommitted** |
| **Ω0-H Human** | NOT STARTED — no burden baseline, no acceptance recorded |
| **Ω0-R Regenerative** | NOT STARTED — no content, signal, learning candidate |

**Not claimed:** Node0 closed · L1 activated (retraction stands) · unattended
operation · exact SHA (git unusable here — the single outward blocker) ·
`bizra-filefactory` bound as the adapter (the route's adapter interface makes
that a wiring task, not a redesign) · full `npm test` / `npm run check`
(pre-existing exit 1, unrelated).

## Retrospective (Phase 7)

**What contradicted reality?** Twice today the same shape: a check that
derived its expectation from the thing it judged. `verifyChain` trusted the
chain; the route's first draft would have let the adapter report its own
success. Law 4 exists because of that pattern, not in anticipation of it.

**Next niyyah.** Ω0-H — the human closure. It needs no code: record a burden
baseline, run one real mission, record intervention minutes, and let Mumu
accept or reject usefulness. Ω0-M without Ω0-H is a movement that keeps
perfect time in a drawer.

**Topology changed.** New node `omega0-mechanical-closure` — the first
component whose dependents are *laws* rather than functions. Edges: →
`chain-anchor` (anchor law), → injected adapter (effect), ← mission/consent.

## Convergence

| Rail | Level |
|---|---|
| Formal | 3 — six laws asserted as tests, closed refusal vocabulary |
| Cryptographic | 3 — plan/consent/before/after/seal hash-bound, replay recomputes |
| Empirical | 3 — real files, real undo, real fresh-process replay, red-first |
| Economic | 0 — no cost, revenue or impact claim |

Blocking level 4 (independently reproducible): **exact commit SHA** — outward.

`Disk wins.`
