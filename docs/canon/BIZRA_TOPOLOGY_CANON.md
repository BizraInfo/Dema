# BIZRA Topology Canon

**Frozen:** 25 March 2026
**Author:** Mohamed Beshr, BIZRA Foundation
**Rule:** No AI session, no document, no diagram may contradict this file. If a conflict exists, this file wins.

## Dema-local mirror note

This file is carried in the Dema repo as a docs-only topology authority. It governs topology language used by Dema docs and agents. It does not authorize runtime execution, federation, receipt minting, SAT-5 implementation, dependency changes, CI changes, website edits, or Claim Registry work inside this repository.

## The one sentence

Each human node mints PAT-7 locally on their device and SAT-5 into one shared Universal Resource Pool. PAT serves the human. SAT serves the system. The membrane sits between them.

## What is local per human

**PAT-7 — Personal Agentic Team**

Seven agents minted on the human's own device at first activation:

- P1 Planner
- P2 Researcher
- P3 Coder
- P4 Evaluator
- P5 Ethicist, FROZEN: ethics from axioms, not data
- P6 Publisher
- P7 DEMA / Nexus, the face: human talks to DEMA only

PAT-7 is user-loyal. Its only purpose is to serve and empower its human. PAT lives on the human's hardware, is always on, works local-first, and is the only surface the human touches. The human never interacts with the network directly.

Also local:

- human devices,
- local data lake,
- local models,
- local FAISS index,
- local receipt-chain copy,
- local reflex cache.

## What is shared for the entire ecosystem

**BIZRA Universal Resource Pool (URP) — one, singular, shared**

The URP is the system. It is not a layer, not middleware, and not per-user. It is one shared living organism for the entire BIZRA ecosystem.

Before any human joins, the URP is dormant: code with no power, no agents, no resources.

When the first human, Node0, activates:

1. System mints PAT-7 on their device, locally.
2. System mints SAT-5 into the URP, shared.
3. The URP wakes up with five employees and whatever resources Node0 contributes.

Each subsequent node adds five more SAT agents to the shared URP, plus contributed resources.

**SAT-5 — System Agentic Team, per node contribution, lives in the URP**

- S1 Validator — verifies receipts and proof integrity
- S2 Oracle, FROZEN: truth axioms, immutable
- S3 Mediator — fair dispute resolution
- S4 Archivist — archives to House of Wisdom
- S5 Sentinel — threat detection and monitoring

SAT agents follow constitutional law only. No human designs their behavior.

Also inside the URP:

- Constitutional Spine
- House of Wisdom
- Proof Engine
- SEED Treasury
- Compute Pool
- Storage Pool
- Bandwidth Pool
- Shared Reflex Registry
- Receipt Log

## The membrane

The constitutional membrane sits between every local node and the shared URP.

Four properties:

1. **Fail-closed:** incomplete verification rejects.
2. **Axiomatic filtering:** all constitutional invariants must hold.
3. **Cryptographic provenance:** every crossing produces a BLAKE3-chained, Ed25519-signed receipt.
4. **Receipt completeness:** no gaps in the provenance log.

What never crosses:

- human identity,
- raw private data,
- unverified claims,
- untagged information.

## The request flow

```text
Human
-> DEMA (P7)
-> PAT handles locally if possible
-> if help is needed: PAT -> Membrane -> SAT in URP
-> SAT manages network interaction if needed
-> SAT -> Membrane -> PAT -> DEMA -> Human
```

The human never touches the network directly.

## Common mistakes

| Wrong | Right |
|---|---|
| Each user has their own URP. | There is one URP. |
| SAT-5 lives inside each user's local node. | SAT-5 lives in the shared URP. |
| PAT connects directly to other nodes. | PAT -> Membrane -> SAT. No peer-to-peer. |
| The URP is a server that nodes are clients of. | The URP is a shared organism that grows with every node. |

## Scaling

| Nodes | Local PAT | SAT in URP | Effect |
|---:|---:|---:|---|
| 1 | 7 | 5 | System alive, flywheel starts. |
| 1,000 | 7,000 | 5,000 | Serious governance capacity. |
| 1,000,000 | 7,000,000 | 5,000,000 | Self-securing, self-evolving. |
| 8,000,000,000 | 56,000,000,000 | 40,000,000,000 | Planetary intelligence. |

## Canonicalized subsystems

| Subsystem | Status | Cycle | BLAKE3 Hash | Tests |
|---|---|---|---|---|
| Node0 Activation | CANDIDATE_CANONICAL | Cycle 1, 2026-04-14 | `7b555875abdbe61527ff81b3184299de6cdb2171d0c998164c318a015f71db9c` | 21/21 |

Status note, 2026-04-14: local re-verification passes 12/12 checks, 21/21 tests, stable BLAKE3 hash. Node0 Activation is promoted to CANDIDATE_CANONICAL pending:

1. push to remote,
2. CI green,
3. independent review of diff.

Node0 Activation encompasses: SovereignRuntime boot, PAT-7 wiring, SAT-5 wiring, DEMA Router, FATE Boundary, ProactiveScheduler, URP Service, Event Bus, Gate Chain, ConnectionPool, 12 CQRS subscribers, NervousSystem, MissionPipeline, Helix3 scheduler, Node0 Heartbeat, and FederationAmbassador.

Promotion gates from CANDIDATE to CANONICAL:

1. Deterministic re-verification: `reverify.py` 12/12, 21/21.
2. Hash integrity verified: BLAKE3 plus BLAKE2B-256 dual-hash.
3. CI workflow green on GitHub Actions.
4. `git push` to `origin/main` with all artifacts.
5. External review / human attestation.

This file is the canonical source of truth for BIZRA's topology. If any document contradicts it, this file wins.
