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
| The operator's second device is Node1. | The operator's second device is a companion of the same node. Node1 is a different human, after onboarding. |
| Node ordinals can be assigned freely. | Node ordinals are registry-assigned. No skip. No duplicate. No reassign. |

## Scaling

| Nodes | Local PAT | SAT in URP | Effect |
|---:|---:|---:|---|
| 1 | 7 | 5 | System alive, flywheel starts. |
| 1,000 | 7,000 | 5,000 | Serious governance capacity. |
| 1,000,000 | 7,000,000 | 5,000,000 | Self-securing, self-evolving. |
| 8,000,000,000 | 56,000,000,000 | 40,000,000,000 | Planetary intelligence. |

## Node ordinal law

**Amendment:** 2026-05-18 GST. Inscribes the ordinal rules that the `buildUserProfile` primitive (commit `9a8389e`) made structural. Companion to the canonical sentence; does not replace it.

The ordinal `0, 1, 2, ...` assigned to each node is identity-bearing canon, not a label.

**The rules:**

1. **Node0 is the origin.** The founder's primary device. The first activated PAT-7 in the system. There is exactly one Node0.
2. **Node1 is the first invited human.** Not the operator's second device. Not a friend's old laptop sitting unused. Node1 means a second human has completed onboarding, received an ordinal from the registry, and minted their own PAT-7 on their own hardware.
3. **NodeN is assigned, never guessed.** Ordinals are issued by the registry on successful onboarding. A device that has not completed onboarding does not have a node ordinal.
4. **No duplicate ordinals.** Once assigned, an ordinal binds to one human-identity (`node_uid` derived from operator + ordinal + device). Reassignment is forbidden.
5. **No skipped ordinals.** Assigning a higher ordinal without filling the lower ones is forbidden until canon explicitly authorizes such gaps.
6. **No hidden ordinals.** Every emitted `node_identity` block surfaces `node_ordinal`, `node_label`, and `node_uid`. Concealment is a doctrine violation.

**Device companionship (per-human, multi-device):**

A human may operate from multiple devices (laptop, phone, tablet) without minting multiple nodes. Each companion device shares the same `node_ordinal` as the primary but carries a distinct `node_uid` (because the uid hash includes `device_label`). The companion device's profile sets `companion_of: <primary_node_uid>` to bind to the parent identity.

Concretely:

- Founder's primary laptop: `node_ordinal: 0`, `node_uid: bizra_node_0_<H1>`, `companion_of: null` (primary).
- Founder's phone: `node_ordinal: 0`, `node_uid: bizra_node_0_<H2>`, `companion_of: bizra_node_0_<H1>` (companion).
- A trusted friend's laptop, after onboarding: `node_ordinal: 1`, `node_uid: bizra_node_1_<H3>`, `companion_of: null` (primary, new identity).

Both founder devices are Node0. The trusted friend is Node1. A device is never automatically a separate node.

**Implementation anchor:** `buildUserProfile` in `packages/core/src/profiles.js` (since commit `9a8389e`, 2026-05-18) accepts `node_ordinal`, `device_label`, and `companion_of` as kwargs and derives `node_uid` deterministically via SHA-256 over `operator|ordinal|device`. The `dema onboard --json` surface emits a top-level `node_identity` block. Identity (`node_uid`) is intentionally independent of presentation (`language`): a user changing their preferred language never changes their cryptographic identity.

## Seed-pattern invariant (fractality)

**Amendment:** 2026-05-18 GST. Inscribes as canon what the Third Fact (`docs/public/third-fact-v0.1.md` line 160, Bitcoin-anchored at block 948027 + 948029) already implies: BIZRA is fractal in structure. Every node carries the full system, not a subset of it.

**The invariant:**

> Every seed contains the full tree DNA. Every tree carries the full forest pattern.

Concretely:

1. **A node is a seed.** Every node carries the constitutional spine, the canonical 16-key boundary, the V/D/A/U claim discipline, the 7-pillar architecture pointer, and the receipt-shape contract. There is no "lite" node.
2. **A seed contains the tree.** Node0 alone, with no federation, already runs the discipline that the whole BIZRA ecosystem will run at planetary scale. The PAT-7 + SAT-5 + URP layout at one human is the same layout at one billion humans, only with a different SAT-count multiple.
3. **A tree contains the forest.** No node *owns* the system; each node *carries* it. Federation grows what is already present; it does not introduce missing pieces.
4. **Bitcoin-anchored.** The Third Fact PDF (block 948027 + 948029) anchors this fractality at the founding-doc level.

**Operational consequences:**

- A node leaving the network does not delete the network's capability — the seed pattern is preserved in every other node.
- A new node joining does not import the system from outside — it activates the system that was already present in its constitutional spine.
- No node is the "real" BIZRA. The system IS the relationship between nodes that each carry it.

**Implementation anchors:**

- `docs/public/third-fact-v0.1.md` lines 93, 150, 160, 309-311, 344-353 — the seed-pattern language across the manifesto.
- `packages/core/src/profiles.js` (commit `9a8389e`) — every `buildUserProfile` call emits the full PAT/SAT/URP/boundary structure regardless of `node_ordinal`. The same identity primitive at Node0 is the same at Node1.
- Founding PDFs anchored at Bitcoin block 948027 + 948029.

**Doctrinal anchor:** this invariant is companion to [Node ordinal law](#node-ordinal-law). The ordinal counts which node; the seed-pattern says what every node carries. Together they constitute the topology of BIZRA expansion.

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
