# BIZRA Node0 to URP Ecosystem Transition (v0.2)

**Created:** 2026-04-25 (GST) — Dubai
**Updated:** 2026-04-26 (GST) — Dubai; v0.2 corrective patch aligning with Topology Canon (frozen 2026-03-25), Master Stack, and Origin Kernel
**Scope:** Architecture transition note. Docs-only. Records the canonical phase progression from single-node Node0 sovereign runtime to a decentralized distributed agentic ecosystem.
**Status lock:** WAIT preserved. No runtime, core, source, CI, dependency, website, or Claim Registry changes.
**Audience:** Internal canon reference. Not a public roadmap. Not a commitment of dates.

## Dema-local boundary note

This file is an internal BIZRA ecosystem transition reference carried inside the Dema documentation tree. It does not change Dema's repo-local contract:

- Dema remains the local product face, not the whole BIZRA system.
- This repository does not execute runtime work, start federation, mint receipts, or implement SAT-5.
- Paths under `bizra-omega/`, `core/`, `dema-console/`, `sovereign_state/`, and related upstream surfaces are BIZRA ecosystem evidence references, not paths this Dema repo must contain.
- When this note conflicts with `README.md`, `docs/LLM_SYSTEM_FLOW.md`, `docs/ARCHITECTURE.md`, or binding ADRs for Dema behavior, the Dema-local boundary wins for work in this repository.

## Authority chain

Read upward when conflict appears:

- `docs/canon/BIZRA_ORIGIN_KERNEL.md` § raw Arabic source utterance — three invariants govern: §4.1 humility, §4.2 symmetric charity, §4.3 Law of Assumption + Ihsan.
- [BIZRA Topology Canon](../canon/BIZRA_TOPOLOGY_CANON.md), frozen 2026-03-25, signed Mohamed Beshr / BIZRA Foundation — "if any document contradicts it, this file wins."
- BIZRA Master Stack: `docs/{bizra-trust-compiler-thesis,dema-cli-manifesto-v1,why-dema-wins,ftap-function-registry-rfc-seed}.md`.
- This document is downstream of all of the above.

## 1. Purpose

Node0 is a bootstrap, not a destination.

Before BIZRA can credibly describe itself as a decentralized agentic ecosystem, one Node must prove it can stand alone: execute missions, sign receipts, replay its own state, hold its constitutional gates, and recover from restart entirely on a single machine, with no external dependency.

This document records how the architecture moves from that proven single-node baseline through the shared Universal Resource Pool (URP), the SAT-5 system agentic team that lives inside the URP, federated cognition, and opt-in autopoiesis. It states explicitly what is measured, what is planned, and what is directional only.

Canonical sentence per Topology Canon:

> Each human node mints PAT-7 locally on their device and SAT-5 into one shared Universal Resource Pool. PAT serves the human. SAT serves the system. The membrane sits between them.

Category positioning per Master Stack `docs/why-dema-wins.md`:

> Generative AI produces text. Agentic AI takes action. Verificative AI does what neither can: proves every action was lawful, receipted, and replayable before accepting it as done.

The Trust Compiler path is:

```text
Intent -> Mission -> Claim -> Admissibility -> Execution -> Receipt -> Canonicalization -> Replay
```

The five constitutional invariants gate every chain mutation:

```text
ZANN_ZERO
CLAIM_MUST_BIND
RIBA_ZERO
NO_SHADOW_STATE
IHSAN_FLOOR >= 0.95
```

## 2. Phase 0 — Single-node sovereign runtime

**Truth label:** CANDIDATE_CANONICAL per Topology Canon Cycle 1, 2026-04-14, hash `7b555875abdbe61527ff81b3184299de6cdb2171d0c998164c318a015f71db9c`, 21/21 tests, 12/12 checks. Promotion to CANONICAL requires three of five promotion gates still pending: CI green, push to `origin/main`, external review.

### What exists today

| Component | Ecosystem location | Role |
|---|---|---|
| Sovereign runtime | `core/sovereign/`, `bizra-omega/bizra-node` | Mission orchestration on one machine. |
| DEMA = P7 of PAT-7 | `dema-console/`, `bizra-omega/target/release/dema`, `bizra-omega/bizra-cognition-gateway/src/bin/dema.rs` | Single surface the human talks to. |
| PAT-7, Personal Agentic Team | `bizra-omega/bizra-core/src/topology_canon.rs` | Seven agents on the human's hardware: P1 Planner, P2 Researcher, P3 Coder, P4 Evaluator, P5 Ethicist, P6 Publisher, P7 DEMA/Nexus. |
| SAT-5, System Agentic Team | Minted into the URP at activation | Five agents in the shared URP: S1 Validator, S2 Oracle, S3 Mediator, S4 Archivist, S5 Sentinel. |
| Mission kernel, Trust Compiler | `bizra-omega/bizra-mission` | Fourteen-state lifecycle, signed receipts. |
| Five-gate admissibility chain | `bizra-omega/fate-binding/`, `core/proof_engine/fate_gate.py` | Enforces ZANN_ZERO, CLAIM_MUST_BIND, RIBA_ZERO, NO_SHADOW_STATE, IHSAN_FLOOR >= 0.95. |
| Receipt protocol | `bizra-omega/bizra-core/src/canonical_receipt.rs` plus Python mirror | BLAKE3-chained, Ed25519-signed; cross-language parity proven. |
| Replay verifier | Spearpoint replay path | Re-derives state from receipt chain. |
| Identity / genesis seal | `bizra-omega/bizra-core/src/genesis_seal.rs` | Deterministic root of trust. |
| The Membrane | Between every local node and the shared URP | Fail-closed crossing discipline. |

### What this proves

- One node can execute missions, sign each visible effect, chain signatures, and re-derive state from the chain alone.
- Constitutional invariants are enforced by code, not by promise.
- Restart recovery, replay, and lifecycle gates are testable on a single machine.
- DEMA/P7 functions as the operator's visible surface; the rest of PAT and all SAT remain behind the membrane.

### Closure gates in flight

| PR | Lane | Status |
|---|---|---|
| #49 | Row 4 replay, canonical spearpoint replay | MEASURED — 38/38 tests green; awaiting merge. |
| #50 | Mission receipt full-payload Ed25519 signature | MEASURED — 4 tests green; awaiting merge. |
| #51 | Python 3.12 baseline restored across 874 tests | MEASURED — full pass; awaiting merge; unblocks #49 and #50. |
| #52 | Credential purge, CVE-class | MEASURED — 8 files; awaiting merge. |
| #53 | Genesis Manifest v0.1 | MEASURED — chain hash recorded; side-track. |
| #54 | Public-claim discipline recert v0.1 | MEASURED — claim register published. |
| #55 | This architecture transition note | MEASURED — v0.2 corrective patch. |
| #56 | Queue Closure Receipt 2026-04-25 | MEASURED — STOP_DUE_TO_RED_CHECKS recorded. |
| #57 | CI pip-audit allowlist update for CVE-2026-3219 | MEASURED — single-line workflow change. |

Phase 0 closes when:

1. The PR queue drains: CI green, all measured artifacts on `origin/main`.
2. The 11-gate Node0 lifecycle reports `lifecycle_ready: true` from a clean run on a fresh machine.
3. Topology Canon's outstanding promotion gates close: CI green, push complete, external review attestation.

## 3. Phase 1 — URP awakens

**Truth label:** PLANNED.

The URP is not a network the first Node joins. The URP is a shared organism that wakes up the moment the first human activates:

```text
Node0 activation
-> system mints PAT-7 locally on the human device
-> system mints SAT-5 into the shared URP
-> URP wakes with five employees plus whatever resources Node0 contributes
```

Each subsequent node adds five more SAT agents into the same shared URP, plus contributed compute, memory, storage, and bandwidth.

There is one URP: not per-node, not per-user, not middleware. It is one shared living organism for the BIZRA ecosystem.

### What lives inside the URP

- 5 x N SAT agents contributed by activated nodes.
- Constitutional Spine: five-gate admissibility law plus Ihsan, Gini, Zakat invariants.
- House of Wisdom: long-form synthesized knowledge across attestations.
- Proof Engine: cross-node receipt verification and chain integrity.
- SEED Treasury: token/value-state primitives.
- Compute Pool, Storage Pool, Bandwidth Pool.
- Shared Reflex Registry: compiled patterns the network has learned.
- Receipt Log: canonical chain across admitted missions.

### Required components

| Component | Readiness | Required state |
|---|---|---|
| URP transport | Heartbeat prototype | Production substrate with discovery, peer attestation, receipt-channel ABI. |
| Identity attestation across nodes | Single-node primitives | Cross-node Ed25519 plus Dilithium verification; both ends agree on chain integrity. |
| Bootnode list / DHT | NOT BUILT | Stable bootnode addressing. |
| First second-node join ceremony | NOT BUILT | Constitutional onboarding sequence. |
| URP wake-up sequence | Partial | Node0 wakes URP locally; cross-node membership not demonstrated. |

### Closure criterion

A second human activates a Node: their device mints PAT-7 locally, five more SAT agents materialize into the same shared URP that Node0 woke, and both nodes interact only through their respective membranes and SAT-in-URP. A signed receipt produced on either node is verified by the SAT-5 layer in the URP, not by direct node-to-node trust.

## 3.5. The Membrane

The constitutional membrane sits between every local node and the shared URP. Every receipt that crosses produces a BLAKE3-chained, Ed25519-signed entry.

Four properties:

1. Fail-closed — incomplete verification rejects.
2. Axiomatic filtering — all constitutional invariants must hold.
3. Cryptographic provenance — every crossing produces a signed receipt.
4. Receipt completeness — no gaps in the provenance log.

What never crosses the membrane:

- human identity,
- raw private data,
- unverified claims,
- untagged information.

The membrane is constitutional, not just a network primitive. It preserves sovereignty by keeping data and identity local while allowing only signed, verified attestations to cross.

## 4. Phase 2 — SAT-5 fully operational and multi-node URP

**Truth label:** PLANNED.

PAT-7 runs inside each Node. SAT-5 lives inside the shared URP, not between Nodes. Phase 2 is when SAT-5 in the URP grows from five, Node0 only, to 5 x N, N contributing nodes.

SAT-5 does not run peer-to-peer. SAT-5 lives in the URP.

| Capability | Readiness | Required state |
|---|---|---|
| URP federation gossip | Scaffolded | Gossip protocol operational across SAT-in-URP layer; signed-message exchange respects membrane discipline. |
| BFT consensus inside URP | Scaffolded | SAT-5 layer in URP achieves BFT agreement on chain integrity. |
| Membrane-mediated receipt exchange | Receipt protocol exists; membrane scaffolded | Transport, replication policy, deduplication; all crossings signed and receipted. |
| Constitutional gate enforcement | Scaffolded | Five-gate admissibility runs at every membrane crossing. |
| SAT-5 wired into runtime gateway | Drift flagged | Gateway routes SAT calls to URP-resident SAT layer, not to a per-node stub. |

### Closure criterion

A network of at least five Nodes maintains chain integrity under partition, rejoin, and one-node-malicious deterministic scenarios. SAT-5 in the shared URP arbitrates disputes via S2 Oracle and S3 Mediator. No node trusts another node directly; all trust is mediated through the URP SAT layer.

## 5. Phase 3 — Federated cognition

**Truth label:** PLANNED.

Each Node continues local work through PAT-7. Raw private data never leaves a Node. What leaves the Node, after the membrane's five-gate admissibility, is signed optimization signal: gradient deltas, mission-pattern observations, and anonymized receipts of completed missions that other Nodes can opt into through their own membranes.

```text
Local mission execution (PAT-7, on private data)
-> local RL update (parameter delta only, not data)
-> receipt of "I learned X" passes Membrane
-> lands in URP Shared Reflex Registry, attested by SAT-5
-> other Nodes' PAT layers query registry via their own Membranes
-> local FATE gate validates pooled update before applying
-> each Node improves while membrane preserves sovereignty
```

### What is opt-in

- Whether to publish local learnings.
- Whether to consume any specific pooled signal.
- Whether to pool with the entire network or a chosen subset.
- Whether to retain pooled improvements across reboots.

### What is not in Phase 3

- Centralized model aggregation.
- Raw data leaving any Node.
- Forced participation in pooled cognition.
- Network-wide model ownership by any party.
- Peer-to-peer between Nodes.

| Capability | Readiness |
|---|---|
| `bizra-ttrl` on-device RL with SSO spectral norm | Scaffolded. |
| `bizra-memory` synthesis pipeline | Scaffolded for local; URP pooling layer NOT BUILT. |
| `bizra-autopoiesis` self-healing | Scaffolded. |
| Federated signal protocol via Membrane and URP Shared Reflex Registry | NOT BUILT. |

## 6. Phase 4 — Decentralized self-growing agentic ecosystem

**Truth label:** DIRECTIONAL.

The architectural intent is a network of sovereign Nodes that becomes more capable as more Nodes join, without any single Node ceding sovereignty over data, identity, or mission gates.

| Nodes | Local PAT total | SAT in shared URP total | Effect |
|---|---:|---:|---|
| 1 | 7 | 5 | System alive, flywheel starts. |
| 1,000 | 7,000 | 5,000 | Serious governance capacity. |
| 1,000,000 | 7,000,000 | 5,000,000 | Self-securing, self-evolving. |
| 8,000,000,000 | 56,000,000,000 | 40,000,000,000 | Planetary intelligence, directional only. |

### What this is not

- Not AGI.
- Not a world-first claim.
- Not finality.
- Not a token economy primer.

### Continuous progress metrics

- Number of Nodes that maintain chain integrity for at least 30 days.
- Cross-Node receipt verification pass-rate via Membrane.
- Constitutional gate enforcement rate at every crossing.
- Per-Node opt-in rate for pooled cognition signals.

These metrics become measurable when Phases 2 and 3 complete. They are unmeasurable today.

## 7. Truth labels — phase summary

| Phase | Label | Rationale |
|---|---|---|
| Phase 0 | CANDIDATE_CANONICAL | Two of five promotion gates passed; three pending: CI green, push, external review. |
| Phase 1 | PLANNED | URP heartbeat exists; production substrate does not; cross-Node URP-mediated handshake not demonstrated. |
| Phase 2 | PLANNED | Federation crate scaffolded; SAT-in-URP at multi-node scale not operational. |
| Phase 3 | PLANNED | TTRL and memory crates scaffolded; URP Shared Reflex Registry not built. |
| Phase 4 | DIRECTIONAL | Architectural intent only; depends on Phases 0-3. |

These labels follow BIZRA Genesis Manifest truth-label discipline, public-claim discipline, and Topology Canon's CANDIDATE to CANONICAL promotion ladder.

## 8. Explicit non-claims

This document does not claim:

- Production URP transport exists today.
- Cross-Node Gini computation exists today.
- Any second Node has joined the URP today.
- SAT-5 is wired into the runtime gateway at multi-node scale today.
- A public SEED-token economy is activated today.
- The network operates trustlessly today.
- The URP runs as a server.
- Any planned phase has a committed delivery date.
- This document supersedes the Topology Canon.

This document does not authorize:

- Runtime, core, source, CI, dependency, website, or Claim Registry changes.
- Merge of any open PR.
- Any change to Phase 2 or Phase 3 WAIT lock.
- Modification to Origin Kernel raw §1.
- Committing the Origin Kernel itself to runtime canon before the Canon Store Ingestion Gate exists.

## 9. Canonical sentence

Topology Canon's wording is authoritative:

> Each human node mints PAT-7 locally on their device and SAT-5 into one shared Universal Resource Pool. PAT serves the human. SAT serves the system. The membrane sits between them.

Earlier one-liners such as "Node0 proves the seed can live alone" are poetic companion phrases, not canonical sentence replacements.

## 10. Origin Kernel provenance

This document is downstream of `docs/canon/BIZRA_ORIGIN_KERNEL.md`:

- §4.1, Knowledge to humility: truth labels downgrade overclaiming into declared unknowns.
- §4.2, Symmetric epistemic charity: non-claims prevent both overclaiming for BIZRA and dismissing competing approaches.
- §4.3, Law of Assumption + Ihsan: every PLANNED label is declared uncertainty, every NOT BUILT entry refuses bare speculation, and every Required state column makes assumptions accountable.

The Kernel itself is not runtime canon and is not committed to `origin/main` in this Dema repo by this note.

## Appendix A — Ecosystem evidence map

| Phase | Crate / module | Ecosystem path | Current state |
|---|---|---|---|
| Phase 0 | `bizra-node` | `bizra-omega/bizra-node/` | Operational on single machine. |
| Phase 0 | `bizra-mission` | `bizra-omega/bizra-mission/` | Fourteen-state lifecycle, signed receipts. |
| Phase 0 | `bizra-core` | `bizra-omega/bizra-core/src/` | Five frozen root objects. |
| Phase 0 | `bizra-cognition` | `bizra-omega/bizra-cognition/src/` | Five frozen contracts. |
| Phase 0 | `bizra-cognition-gateway` | `bizra-omega/bizra-cognition-gateway/` | Axum gateway and `src/bin/dema.rs` projection. |
| Phase 0 | PAT-7 / SAT-5 topology | `bizra-omega/bizra-core/src/topology_canon.rs` | Names canonical; SAT-in-URP wiring partial. |
| Phase 0 | FATE gate | `bizra-omega/fate-binding/` | Z3 plus Dilithium post-quantum. |
| Phase 0 | Active Node0 receipt chain | `sovereign_state/bridge_receipts/` | Local chain reference. |
| Phase 0 | DEMA/P7 surface | `dema-console/` plus Rust `dema` binary | Ecosystem face reference. |
| Phase 1 | URP heartbeat | `bizra-omega/bizra-resourcepool/` | Prototype only. |
| Phase 1 | Identity attestation | `bizra-omega/bizra-core/src/genesis_seal.rs` | Single-node operational. |
| Phase 1/2 | Membrane | `bizra-omega/bizra-protocol/` | Scaffolded. |
| Phase 2 | Federation gossip | `bizra-omega/bizra-federation/` | Scaffolded. |
| Phase 3 | TTRL on-device RL | `bizra-omega/bizra-ttrl/` | Scaffolded. |
| Phase 3 | Memory synthesis | `bizra-omega/bizra-memory/` | Local layer present; URP pooling not built. |
| Phase 3 | Autopoiesis | `bizra-omega/bizra-autopoiesis/` | Scaffolded. |

## Appendix B — Memory anchors

This note preserves and reinforces:

- `reference_bizra_topology_canon_frozen_2026_03_25`
- `reference_bizra_master_stack_canon_2026_04_26`
- `reference_origin_kernel_invariant_trace`
- `reference_bizra_full_host_topology_2026_04_26`
- `feedback_audit_label_inflation_guard`
- `feedback_third_party_eval_does_not_override_canon`
- `feedback_land_the_plane`
- `project_pat_sat_canonical_topology`
- `project_node0_closure_scoreboard_2026_04_21`
- `project_node0_activation_complete_2026_04_25`

## Appendix C — v0.1 to v0.2 changelog

1. Authority chain header added.
2. DEMA = P7 identification added.
3. PAT-7 names enumerated.
4. SAT-5 names enumerated.
5. SAT-5 location corrected: SAT-5 lives inside the shared URP.
6. URP framing corrected: one shared organism wakes from dormant when the first human activates.
7. Membrane section added.
8. Phase 1 closure criterion corrected: no peer-to-peer trust.
9. Phase 3 mechanism corrected through Membrane and URP Shared Reflex Registry.
10. Phase 0 truth label corrected to CANDIDATE_CANONICAL.
11. Master Stack vocabulary added.
12. Origin Kernel provenance added.
13. Forbidden mistakes from Topology Canon honored.
14. Appendix A evidence map expanded.
15. Appendix B memory anchors updated.
16. Canonical sentence corrected.
17. Non-claims expanded.

This document is not a roadmap, not a commitment of dates, and not an external-facing piece. It is internal canon, downstream of the Topology Canon, downstream of the Master Stack, downstream of the Origin Kernel.

هذه هي البذرة. The Seed.
