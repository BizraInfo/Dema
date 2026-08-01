# Receipt: AUDIT-20260731 — Dema Node0 closed-loop spearpoint (E5)

Truth posture: evidence-bound audit + one implemented inward slice.
Date: 2026-07-31. Operator: session Cursor Auto. Repo: `Downloads/Dema`.

## 1. Executive signal

L1 is **guarded, not activated**. The highest-SNR inward blocker still open after
E1–E4 was out-of-band chain erasure reading as genesis. **E5 shipped**:
`chain_absent_with_history` + `.l1/last_seal_head`; **21/21** L1 tests pass.
Activation / MEASURED remains an **operator gate**. ADR-051 stays deferred.

## 2. Evidence boundary

### Inspected (verified)

| Source | Use |
| --- | --- |
| `packages/core/src/l1-micro-loop.js` | Kernel + E5 patch |
| `tests/l1-micro-loop.test.js` | 21/21 empirical |
| `docs/receipts/L1_MICRO_LOOP_1A_BLAST_RADIUS_GUARDS.md` | Prior open gap |
| `docs/CURRENT_LIMITS.md` L1 row | Limits honesty |
| `docs/MASTER-SPEC-NODE0-2026-07-31.md` §5 | Stage status |
| `docs/06-adr/ADR-049`, `ADR-051` | Order / doctrine |
| `verification-admission.js` | Gate pattern reuse |
| `bizractl.py doctor` | Filefactory GREEN, loose=2 |
| filefactory receipts RETRACTION + ACTIVATION | Cross-repo binding |
| `kernel-purity-check.mjs`, `npm run llm:guidance` | Local gates |

### Unavailable / not run this pass

| Source | Why |
| --- | --- |
| Full `npm test` / `npm run check` | Deferred (known unrelated RED; not in E5 blast radius) |
| Clean `git` SHA bind | Prior sessions reported dead `config.worktree`; content sha256 used instead |
| Live operator re-cert of L1 MEASURED | Consent / authority |
| Conversation transcripts as authority | Narrative only; disk overrides |

## 3. Current system map (high-SNR)

| Component | Purpose | Status | Next |
| --- | --- | --- | --- |
| verification-admission v0.2 | Judge-free VERIFY gate | MEASURED (classify) | Hold |
| l1-micro-loop | First closed cycle | LOCAL_ONLY guarded E1–E5 | Operator re-cert |
| peak-self-loop preview | Compose proactive_self | Preview | No autonomy |
| homebase / URP local | Node0 face + resource vocab | Preview / local proof | No federation |
| ADR-051 two-plane federation | Companion membrane doctrine | DECLARED_DRAFT | After L1 |
| ask consent-bridge | check gate 5 | Reported RED elsewhere | Separate slice |

## 4–7. Collapsed findings (SNR-ranked)

1. **E5 false-GREEN on missing chain** — verified; **fixed this pass**.
2. **Admission ≠ containment** — doctrine lesson; E1–E4 already landed.
3. **External signed head still open** — marker inside `.l1` is raisable cost, not tamper-proof.
4. **ADR-051 wait behind L1** — correct; no implementation.
5. **Repo suite RED** — outward/orthogonal to L1 kernel consumers.

## 8. DEMA-FDE

| Item | Class | Action |
| --- | --- | --- |
| E5 chain re-anchor | INWARD | Repaired |
| External signed head | INWARD design debt / needs existing signed-head organ | Deferred |
| Full suite / check gate 5 `ask` | INWARD other slice or OUTWARD git sandbox | Deferred |
| L1 MEASURED promotion | OUTWARD (operator authority) | Halt |
| Filefactory Downloads write (earlier EROFS) | OUTWARD sandbox mount | Already applied elsewhere (doctor GREEN) |

## 9. Spearpoint (why this one)

Chosen: E5 continuity. Deferred: ADR-051 kernels (order), ask bridge (different proof story), L1 activation (operator), Cursor SDK nervus (premature).

Acceptance (all met):
1. Seal → unlink chain → verify fails `chain_absent_with_history`
2. Fresh / mid-first-cycle → genesis true
3. Empty chain with prior seal fails closed
4. run refuses before mutation
5. Label stays `L1_GUARDED_NOT_ACTIVATED`

## 10–11. Implementation + tests

Kernel: `.l1/last_seal_head`, `chainContinuityFailure`, `verifyChain` tri-state,
seal/run/resume refuse. Tests L1-17..17d. **21/21 pass.** Purity OK. Guidance PASS.

Hashes:
- `l1-micro-loop.js` `95627a65e5e63a69b8b8e06ef875c31a12cf1dcff260d57ad7d44dd893cf0129`
- `l1-micro-loop.test.js` `336eced1f14c17d17d8dc370d130b030b736c5db3be7ffb4ef59278cb1ba0c39`

## 12. Open proof gaps

- Dual-delete of chain + `last_seal_head`
- Suffix truncation
- External signed head (compose with NODE0-SIGNED-CHAIN-HEAD-1A)
- Operator L1 re-cert
- Repo-wide green

## 13. Convergence

| Claim | Rails | Level |
| --- | --- | --- |
| E5 refuses external chain delete | Empirical (21/21) | 3 tested/observed |
| Not L1 activated | Formal (retraction + labels) | 1 documented + enforced in prose |
| Tamper-proof chain | — | 0 (explicitly open) |

Ihsān: no false-GREEN promotion; consent not claimed; personal plane untouched.
