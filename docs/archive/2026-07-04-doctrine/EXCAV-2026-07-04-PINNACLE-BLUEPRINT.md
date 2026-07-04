# EXCAV-2026-07-04 · PINNACLE-BLUEPRINT
**Excavation Receipt v0.1 — first specimen of the EXCAV protocol**
**Deposited:** Saturday 2026-07-04 (GST) · **Sediment target:** `docs/archive/excavations/`

---

## 0 · Source & Evidence Boundary

| Field | Value |
|---|---|
| Artifact | "BIZRA Pinnacle Masterpiece Blueprint — Dual-Bus Sovereign OS" |
| Origin | External model session, Dubai, 2026-03-06 12:08 GST |
| Received | Inline text this session — **no byte-hash computable from here**; sha256 to be stamped when the NODE0 copy is located |
| Age at triage | ~4 months |
| Triage basis | Bound against `main` state as of 2026-07-04 (PRs #312/#314 merged, registry #23, rail attestation live) + session ledger |

Rule applied: an artifact may be excavated **exactly once**. This receipt retires the original from circulation.

---

## 1 · Triage Table

| # | Blueprint claim/proposal (Mar 6) | Disposition (Jul 4) | Evidence |
|---|---|---|---|
| 1 | §14 gem: "verifiable state transition is the product, not AI" | **ABSORBED & PROVEN** | Receipts, capability truth registry, signed chain head, CURRENT_LIMITS — all on `main`; the doctrine became the codebase |
| 2 | Action Bus as the *only* path to side effects; TeleScript permits | **ABSORBED, STRICTER** | Five-rung ladder + FATE exact-consent + `NEVER_GRANTABLE_ACTIONS`; Away Contracts = permits (MEASURED). Current system is *more* conservative: rung V has no path at all |
| 3 | Event Bus: append / verify / replay | **LARGELY ABSORBED** | Append-only receipts; steward-chain verifier re-derives per-receipt; emulator golden-seed (42) replay. Gap: no formal replay-determinism CI gate |
| 4 | Myelin IR — System-2 emits typed IR (pre/postconditions, rollback plan, proof template), never direct side effects | **STILL-GOLD, UNBUILT** | No equivalent on disk. Natural spec for the rung-IV/V era; pairs with the FDE-forwarder candidate. Sequenced behind the executor decision — not before |
| 5 | Phase-0 "Kernel Contract Pack" big-bang freeze | **SUPERSEDED BY PRACTICE** | Per-slice frozen schema IDs + registry hash achieve the freeze incrementally, with less risk than a monolithic lock |
| 6 | HDA adapters at `hda/windows/ahk/uia` | **SUPERSEDED — PLATFORM ROT** | NODE0 migrated Windows→Ubuntu 24.04 (Apr 2026). AHK is Windows-only. Executor *concept* survives (CALA doctrine); this implementation path is dead |
| 7 | 7-stage CI/CD + quality gates + auto-emitted compliance evidence | **LARGELY ABSORBED** | CodeQL, gitleaks, Socket, proof-quality, Review Gate live; Stage-6 "evidence emitted automatically" **proven 2026-07-04** by the aggregation rail's first attestation artifact |
| 8 | ISO 25010 / SOC 2 / CMMI / ISO 9001 alignment | **PLANNED-TIER, PARKED** | Activates with the first enterprise counterpart; economic pillar precedes certification theater |
| 9 | Observability: SLOs + four dashboards | **PARTIAL, QUEUED** | Cockpit artifact exists (truth-labeled); SLO formalization not started |
| 10 | Doc's own opening: "earlier uploaded files have expired — please re-upload" | **META-SIGNAL** | The identical pain existed in March. Chronic ⇒ structural: the fix is a substrate + this protocol, not more running |

---

## 2 · Convergence Finding (the meta-signal)

Three independent excavations, months apart, different models, no shared context:

- **Mar 6** — Pinnacle Blueprint: *state transition as the product; TeleScript capability gates*
- **Jul 3** — CALA document: *Telescript permits + hash-chained receipts + signed chain head*
- **Jul 4** — MMO analysis: *event-sourced truth, authoritative deterministic kernel, permits-as-netcode*

Same doctrine, three arrivals. **Recurrence across sessions is the archive's value-ranking function.** When the Owned-Knowledge substrate is built, its first mining heuristic is exactly this: concepts that independently recur are the gold; concepts that appear once are candidates; phrasing that repeats verbatim is ceremony.

---

## 3 · STILL-GOLD Register (extracted, sequenced)

1. **Myelin IR** — the compiled-plan format (typed steps, preconditions, postconditions, rollback, proof template). The missing bridge between *approved* and *executed*. Sequence: only when rung IV/V work opens. Candidate name reserved: `MYELIN-IR-SPEC-1A`.
2. **Replay-determinism CI gate** — "merge fails if golden-seed proof-chain hash diverges." Cheap, high-value, partially exists in the emulator. Candidate: `REPLAY-DETERMINISM-GATE-1A` (bizra-data-lake).
3. **Compliance-evidence-as-runtime** — extend the now-proven attestation rail toward an evidence index only when a counterpart demands it.

Everything else in the blueprint is either absorbed, superseded, or parked — no further action owed.

---

## 4 · The EXCAV Protocol v0.1 (defined by this receipt)

> **Problem:** the founder is acting as the retrieval index of his own 3-year archive — re-finding and re-sharing artifacts per session, paying drain each time.
> **Fix:** every surfacing becomes a permanent deposit.

| Step | Action | Rule |
|---|---|---|
| 1 · SURFACE | Artifact + origin metadata (date, source session, model) | Any format, any age |
| 2 · TRIAGE | Disposition table, every row evidence-bound: ABSORBED / STILL-GOLD / SUPERSEDED / NOISE / META-SIGNAL | No row without evidence; unknowns labeled U |
| 3 · DEPOSIT | Write `docs/archive/excavations/EXCAV-<date>-<slug>.md`; stamp source sha256 from the NODE0 copy | Sediment law: archive dir, never repo root |
| 4 · RETIRE | The original is never re-shared; future sessions cite the receipt | An artifact is excavated **once** |

**Lead KPI:** excavation receipts deposited per artifact surfaced = 1.0; re-uploads of dispositioned artifacts = 0.
**Structural successor:** `OWNED-KNOWLEDGE-INSPECTION-1A` (post-backup), seeded by PR #242's archive-metadata audit surface — the tool for this pain is already 80% written and sitting unmerged since June 24.

---

*Deposit #001. The running becomes banking. — sealed by the cloud lane, pending NODE0 hash stamp & commit when the WIP lane opens.*
