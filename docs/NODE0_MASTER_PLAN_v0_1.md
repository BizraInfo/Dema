# BIZRA Node0 / Dema — Master Plan v0.1 (→ Block0 Seal)

**Status:** `DECLARED` (plan). Not a runtime, not a receipt, not a launch claim.
**Horizon:** complete Node0 and seal **Block0** — the signed proof-of-origin
snapshot. Stops at the node boundary. **No federation, no public economy, no
network** — those remain forbidden-until-proven.
**Created:** 2026-05-31.
**Companions:** [`NODE0_MASTER_CRAFTSMANSHIP_CHECKLIST.md`](NODE0_MASTER_CRAFTSMANSHIP_CHECKLIST.md)
(the scorecard) · [`02-architecture/NODE0_OSTREE_TAD_v0_1.md`](02-architecture/NODE0_OSTREE_TAD_v0_1.md)
(the immutability/manifest substrate) · [`02-architecture/SAT_ROLE_BOUNDARY.md`](02-architecture/SAT_ROLE_BOUNDARY.md)
(the constitutional guard contract).

This plan converts the checklist scorecard into an **ordered, exit-gated build
sequence**. Every phase names its exit gate, its truth label, and what it must NOT
claim. It does not replace running tests or CI; it sequences them.

---

## 0. North Star

```text
one complete node · one sovereign user · one Dema · twelve agents · one task
· one proof · one reward · one learning · one improvement · one next mission
```

Node0 is complete when **one task** runs the full §19 17-step flywheel end-to-end,
replay-verifiable, with no boundary violation — and that sealed state becomes
Block0.

---

## 1. Current truth (disk-anchored, 2026-05-31)

What is already `MEASURED_LOCAL`:

| Spine                                        | Evidence                                                                 | State                                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Proof spine (content-addressed signed chain) | `canonical-receipt.js`, `canonical-ledger.js`                            | `MEASURED_LOCAL`; not yet bound to the flywheel                                              |
| §19 step 6→11 flywheel                       | `flywheel-one-task/settlement/ledger/xp-proposal/sat-validation/xp-mint` | `MEASURED_LOCAL`; chain runs to consented XP mint                                            |
| Dual-token ledger + replay                   | `dual-token-ledger.js`, `*-replay.js`                                    | `MEASURED_LOCAL`                                                                             |
| PoI deterministic rule                       | `rule-consent-replay-verification.v0.1.js`                               | `PARTIAL`                                                                                    |
| SAT-5 guard layer                            | `flywheel-sat-validation.js` (1 of 5 gates) + `SAT_ROLE_BOUNDARY.md`     | 1 gate `MEASURED_LOCAL`; 4 `DESIGNED_NOT_LIVE`                                               |
| Block0 manifest generator                    | `block0-manifest.js` (BLOCK0-1A)                                         | `PARTIAL`; no verifier/persist/CLI                                                           |
| Assumption gate                              | `assumption-boundary-validator.js`                                       | `MEASURED_LOCAL` validator; enforcement on a real mutation path pending (ASSUMPTION-GATE-1C) |

The honest gap, unchanged in shape but smaller than a week ago:

```text
The organs exist. The organism is not complete until one replayable chain runs
action → proof → reward → XP → learning → improvement → next mission, sealed
into Block0.
```

---

## 2. The build sequence (ordered, exit-gated)

Each phase is a set of micro-slices. **Slice discipline (non-negotiable):** TDD
(RED→GREEN), fail-closed, deterministic, content-addressed, receipt-ready, zero new
dependencies, one concern per slice. **Mutation/commit/seal steps are halt-gated —
operator GO required.**

### Phase A — Bind the flywheel to the proof spine — **DONE (`MEASURED_LOCAL`)**

**Goal:** every flywheel action/reward receipt enters the canonical `prev_hash`
chain, so one mission is one replayable ledger (closes the "receipt chain not bound
to flywheel" gap).
**Slices:**

- **RECEIPT-CHAIN-1C** — `bindTaskReceiptsToCanonicalChain` (`canonical-task-binding.js`)
  appends one task's flywheel action receipt → IMPACT entry → SAT validation receipt
  as one canonical prev_hash chain; `verifyCanonicalLedger` replays it. **DONE** (5 tests).
- **ASSUMPTION-GATE-1C** — **ALREADY SATISFIED on disk** (verified 2026-05-31):
  `mintGuardedClaim` (`assumption-guarded-claim.js`) is the only path to the flywheel
  action write and rejects via `validateAssumptionBoundary` before writing — the
  V/D/A/U boundary is enforced on that durable mutation. Broadening enforcement to the
  ledger-append paths is optional later work, not a Phase A blocker.
  **Exit gate:** MET — one task's action→validation sequence replays as a single
  canonical chain; tampering any link fails `verifyCanonicalChain`. `MEASURED_LOCAL`.
  **Remaining for full §19:** binding steps 12–17 (lesson/perf/next-mission) lands in
  Phase C as those receipts come to exist.

### Phase B — Complete the SAT-5 constitutional gates

**Goal:** the 4 remaining SAT verdict functions, per `SAT_ROLE_BOUNDARY.md`.
**Slices:** `satVerifierCheck` · `satComplianceCheck` · `satResourceCheck` ·
`satEvolutionCheck` (the `satEconomist`-shaped gate already exists as
`flywheel-sat-validation.js`). Each: role-bounded, fail-closed, returns the §3
verdict shape, never self-rewards.
**Exit gate:** each gate rejects its forbidden input class with a structured
verdict; no gate can be bypassed by PAT or operator (anti-pattern 6). `MEASURED_LOCAL`.

### Phase C — Close the §19 flywheel (steps 12–17)

**Goal:** extend the chain past XP into learning, performance, and next mission.
**Slices:** Teacher lesson candidate → SAT review → MuMu approval → House of Wisdom
entry (HOW-1B/1C on top of `how-lesson-writer.js`) · performance delta receipt
(PERF-1C/1D) · next-safe-mission recommender · full-chain replay verifier (step 17).
**Exit gate:** the §19 17-step acceptance test passes end-to-end on one task, replay
confirms the whole chain, no boundary violation. `MEASURED_LOCAL`.

### Phase D — Complete Block0 and source its prerequisites

**Goal:** every one of the 12 Block0 prerequisite proof-hashes
(`block0-manifest.js`) points to a real sealed `MEASURED_LOCAL` artifact, and the
manifest can be verified + persisted.
**Slices:** BLOCK0-1B (manifest verifier) · BLOCK0-1C (Realm renderer) · BLOCK0-1D
(CLI) · wire each prerequisite hash (`dema_realm_state_proof_hash`,
`urp_resource_status_proof_hash`, `genesis_local_token_ledger_root_hash`,
`performance_baseline_proof_hash`, PoI rule id/version, KEYCONSENT integration, …)
to its sealed source.
**Exit gate:** a Block0 manifest whose every prerequisite resolves to a sealed
artifact, verifier returns VERIFIED, `claim_boundary` all-false. `PARTIAL → MEASURED_LOCAL`.

### Phase E — Node0 composition manifest (OSTree-model, stdlib)

**Goal:** the immutability/packaging layer from the TAD — a signed, content-
addressed declaration of node composition — without libostree.
**Slices:** NODE0-OSTREE-1A (build `bizra.dema.node0_composition_manifest.v0.1` from
the sealed Block0 + verified kernel set) + its verifier.
**Exit gate:** a stranger re-derives the manifest from { manifest + public key +
verifier }. `DESIGNED_NOT_LIVE → MEASURED_LOCAL`. (Real libostree = separate, later
GO; breaks the stdlib invariant — out of this plan's scope.)

### SEAL — Block0 genesis

**Goal:** the proof-of-origin snapshot.
**Gate (operator-only):** `SEAL_BLOCK0` exact-string, key-bound consent → signed
`bizra.dema.block0_genesis_snapshot.v0.1`. **Hard halt: needs typed operator GO and
binds identity.** No auto-mode override.
**Exit:** Block0 sealed = origin state of a complete local ecosystem seed.
Does **not** claim network, market, federation, or legal/Shariah status.

---

## 3. The acceptance test (the only "done")

Node0 is complete only when this passes with receipts, no boundary violation, no
unverified reward, no private-key leakage, no network, and replay succeeds:

```text
Dema restores Node0 → MuMu selects mission → PAT proposes → SAT-5 audits →
KEYCONSENT authorizes → action runs → receipt writes → verifier re-checks →
PoI scores → token ledger updates → agent XP updates → Teacher proposes lesson →
MuMu approves → House of Wisdom writes → performance delta records →
Dema recommends next mission → replay verifier confirms the full chain.
```

Phases A–C build this loop; Phase D seals its proof-hashes; Phase E packages it;
SEAL stamps the origin.

---

## 4. Critical path & dependencies

```text
A (spine binding + assumption enforcement)
  └─> C (flywheel closure needs the bound chain)
B (SAT-5 gates)  ──────────────────────────────┐
  └─> C (steps 12–14 need SAT review + Economist)│
C (full §19 loop) ─> D (Block0 prereqs need sealed sub-systems)
                       └─> E (composition manifest wraps sealed Block0)
                            └─> SEAL (operator GO)
```

A and B are parallelizable. C is the convergence point. D cannot complete before C
seals the proof-hashes it commits to. SEAL is last and operator-gated.

---

## 5. Non-goals (explicit, this plan)

```text
no public token economy        no guaranteed income/reward
no public federation / Node1+  no cross-node shared-URP pool (forbidden-until-proven)
no fully autonomous swarm       no general trustless verifier for the whole system
no legal / Shariah certification  no market value claim  no real libostree dependency
```

---

## 6. Halt gates (operator GO required)

```text
- any commit / push / branch seal of the uncommitted flywheel work
- SEAL_BLOCK0 (binds node identity)
- adopting any non-stdlib dependency (e.g. real libostree)
- anything touching federation / shared-URP / network
```

---

## 7. Immediate open decisions (carried from this session)

1. **Branch hygiene** — ~12 uncommitted files across two sessions on
   `feat/receipt-chain-1a`. Seal to a proper branch before Phase A deepens it.
2. **Phase A entry point** — ASSUMPTION-GATE-1C path pick (recommended:
   `canonical-ledger.js`) vs RECEIPT-CHAIN-1C first.
3. **SAT pool / OSTree adoption** — the "5 SAT per node → shared URP" directive and
   real-libostree are both federation/dependency decisions: doctrine now, build
   only after the local node is sealed.

➡️ This plan is `DECLARED`. The next executable move is **Phase A**. Nothing here
mutates state, commits, or seals without your typed GO.
