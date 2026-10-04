# Sprint W1 — "First Witness" · G0 GTM with One Working Node

> `DECLARED_DRAFT` sprint plan · 2026-07-30 (Dubai) · Operator GO recorded:
> **"the GO is to GTM with only one working node."**
> Posture: G0 Witness only. Node0 alone IS the product. No federation, token, PoI,
> or G1-public language anywhere in anything that ships or sends (Layer-1 enforced).
> Dates are `A` (assumed-with-Ihsān, slice-paced); the **sequence** is the commitment.

## Sprint Goal (one sentence)

**One clean main SHA that a stranger can verify — PR #440 merged, the GTM work landed
with honest rows, and the Evaluation Pack sent to 1–3 named ICP-0 witnesses from that
exact SHA.**

Success artifact: a recorded send receipt (`gtm:readiness` Phase-1) bound to a main SHA
+ at least one witness confirming receipt. Stretch success: one witness begins a rerun.

## Team & Capacity

| Actor | Available | Allocation | Notes |
| --- | --- | --- | --- |
| Mumu (operator) | ~4 touchpoints, ≤ 2h total | GO phrases, reviews, Arabic pass, witness names | The binding constraint; everything batched to respect it |
| Local agent (Cursor/Claude Code) | ~5 working days | All slices, gates, merges, staging | Halt gates per repo law remain active |
| Alpha (this channel) | Continuous | Briefs, /V verification, drift-watch | No disk authority; verification + steering |

Planned load ≈ 75% of agent capacity — buffer for carve conflicts and review churn.

## Sprint Backlog

| Pri | Item | Est | Owner | Depends on |
| --- | --- | --- | --- | --- |
| P0-1 | **Merge PR #440**; post-merge `/V` at the new main SHA (rotate suite 24/24, honesty-map row on trunk) | S | Mumu GO → agent | — |
| P0-2 | **Carve the 165-file branch** into slices, land each with red-first tests + same-slice `CURRENT_LIMITS`/`TESTING` rows + full gates at its SHA: (a) first-run README [T-046] · (b) model-path parity + llamacpp bridge + registry consent [T-044/043] · (c) Arabic i18n surface [T-045] · (d) demo story CLI+UI [T-041] · (e) GTM doc scrubs + `docs/gtm/` artifacts · (f) quarantine unrelated dirt | L | Agent | P0-1 (rebase base) |
| P0-3 | **Done-gate slice** (C7): `Done ≡ commit reachable from origin/main ∧ gates green at SHA ∧ receipt binds SHA`; wire into review flow; fixture with dangling commit must fail | M | Agent | P0-1 |
| P0-4 | **Arabic native review** — pass over `DECLARED_NEEDS_NATIVE_REVIEW` strings; label flips only on your approval | S (~20 min) | **Mumu** | P0-2c landed |
| P0-5 | **Witness send** (Ω1 recruitment): name 1–3 ICP-0 evaluators → type the GO phrase from `G0_PRIVATE_SEND_GO_CARD.md` → send bundle referencing the final main SHA → record send evidence under DEMA_HOME | S | **Mumu** (names+GO) → agent | P0-1..4; **must send from main SHA, never a working branch** |
| P1-1 | Coverage-debt disposition: raise weakest-file coverage OR re-baseline 95/84 floor with recorded rationale — never mask; until landed, every slice reports the red gate as pre-existing debt | M | Mumu decision → agent | — |
| P1-2 | **Decision B**: no-blocker review of task-029 ceremony spec (`c7682f8`) → unlock fixture-only TDD slice (pre-ceremony; no key material, no ceremony) | S review + M slice | Mumu → agent | — |
| ST-1 | Doctrine canonization mini-slice (U5): name "Build the Habitat, Not the Actor" in canon + 4 lineage rows (SGLang/RadixAttention · Melbourne LoRA 2026 · CAS planning 2026 · Voyager) | S | Agent | — |
| ST-2 | Ω0 prep only: confirm target asset (Q3 — rec: founder corpus + 202-fact index) + draft the Ω0 slice spec. **No execution, no signing** | S | Alpha drafts → Mumu confirms | — |

**Explicitly OUT of this sprint:** Decision C ceremony (T4, own consent gate) · Ω0
execution · Secret Broker · FATE consolidation · terrain bridge · anything on the
frozen list. One sprint, one story: *the first witness.*

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Carve conflicts inside the mega-branch | Slices delay | File-sets barely overlap; land in listed order; quarantine (f) first |
| Witness non-response | Sprint "succeeds" into silence | 3 names, not 1; success = send receipt + confirmed receipt; rerun is stretch |
| Operator bandwidth spike | NOW column stalls | All Mumu items batched: 2 GO phrases + 1 spec review + 1 Arabic pass ≤ 2h |
| Coverage-red confuses evaluators | Trust dent on first contact | Demo script uses targeted suites; bundle names the debt honestly (AMBER, tracked) — honesty IS the pitch |
| Send from wrong ref | Un-reproducible baseline | Hard rule in P0-5; agent verifies `merge-base` before send |

## Definition of Done (sprint)

- Every landed slice: red-first tests green at its exact SHA · same-slice honesty-map
  row · no-overclaim + Layer-1 clean · coverage gate reported honestly.
- Post-merge `/V main` recorded after P0-1 and after the last carve slice.
- Send receipt exists, bound to a main SHA; `gtm:readiness` Phase-1 recorded.
- Zero false GREEN. Zero federation/token/G1 language in anything sent.
- Backlog updated via CLI only; task states satisfy the Done-gate definition.

## Key Dates (`A` — replan at mid-sprint if slices demand)

| Day | Event |
| --- | --- |
| D1 (Thu) | P0-1 merge + carve begins (quarantine + slice a) |
| D3 (Sat) | Mid-sprint check: slices b–d landed? Done-gate in review; Decision B review slot |
| D5 (Mon) | Final main SHA · Arabic pass · witness names |
| D6 (Tue) | **Send** + evidence recording |
| D7 (Wed) | Retro: drain minutes measured, carryover honesty, W2 scoped (Ω0 spine) |

> Sprint W2 preview (not committed): FATE consolidation → lease schema → secret broker
> — the Ω0 spine, entered only if W1 exits clean.
