# Dema User-Centric Memory SDLC v0.1

**Status:** `PLANNED` — architecture and delivery contract; no capability claim.
**Scope:** a local-first, model-independent memory substrate for one operator's Node0.
**Decision:** Dema remembers the operator through operator-owned records and receipts on disk. A model retrieves and reasons over those records; it never becomes the source of truth.

## 1. Outcome

After Dema is closed, restarted, or connected to a different model, it must be
able to recover the same approved operator memory, current mission continuity,
and evidence links from `DEMA_HOME`. It must show the source and truth label for
every recalled fact, and it must let the operator inspect, correct, export, or
forget local records within their authority boundary.

This is not a chat-history feature. It is the continuity layer for a living
companion: the operator remains the centre; tasks, missions, knowledge, and
receipts orbit the operator; models are replaceable readers and workers.

## 2. Scope and non-goals

### In scope

- durable local operator memory, mission continuity, research/asset references,
  learned skills, and relationship preferences;
- provenance, truth labels, consent, correction, retention, export, and
  deletion semantics;
- model-independent retrieval contracts and restart-proof acceptance tests;
- a Homebase projection that answers: **where am I, what matters now, what is
  working, and what needs my consent?**

### Explicitly out of scope for v0.1

- autonomous execution, hidden background collection, network synchronization,
  federation, public publication, token or reward claims;
- importing all chats or files by default;
- treating embeddings, summaries, or a model answer as authoritative memory;
- a general purpose game engine or social graph.

## 3. Standards profile

This project uses a lean, evidence-bound profile rather than pretending to be
certified by any standard.

| Reference | Applied role in this SDLC |
| --- | --- |
| ISO/IEC/IEEE 15288:2023 | Life-cycle framing: stakeholder need, requirements, architecture, implementation, integration, verification, validation, operation, maintenance, retirement. |
| ISO/IEC/IEEE 29148:2018 | Each requirement has an identifier, rationale, source, verification method, and acceptance criterion. The standard remained confirmed in 2024 but is now under revision; use it as the current published requirements baseline, not a permanence claim. |
| ISO/IEC 25010:2023 | Quality model: functional suitability, reliability, security, maintainability, compatibility, usability, safety, flexibility, and quality-in-use guide the non-functional requirements. |
| NIST AI RMF 1.0 + NIST AI 600-1 | Govern, Map, Measure, Manage AI-specific risks. Applied to model substitution, retrieval error, privacy, provenance, prompt injection, and human oversight. |
| NIST SP 800-218A | Secure-development practices for generative AI and dual-use foundation models. Applied to supply-chain review, threat modeling, testing, incident handling, and release evidence. |

## 4. Research grounding

The design adopts three research-informed ideas, but treats their reported
benchmarks as external research rather than a claim about Dema:

1. **Hierarchical memory:** short-lived session context, mid-term mission
   summaries, and long-term personal memory should be distinct. MemoryOS
   proposes this hierarchy; Dema uses the separation without inheriting its
   implementation.
2. **Linked, attributable memory:** A-MEM demonstrates the value of structured
   notes and meaningful links. Dema records immutable sources and explicit
   relations; any generated link is a proposal until the operator or a
   deterministic rule accepts it.
3. **Memory must be evaluated:** MemBench distinguishes effectiveness,
   efficiency, and capacity. Dema adds provenance accuracy, correction
   behavior, deletion behavior, model substitution, and restart recovery,
   because those are essential for a sovereign companion.

## 5. Architectural contract

### 5.1 Canonical local records

All operator-scoped canonical state lives under `DEMA_HOME` as required by
ADR-004. The first implementation may use schema-versioned JSON files and an
append-only event ledger; it does **not** require a graph database, vector
database, or new dependency.

| Record family | Purpose | Canonical authority |
| --- | --- | --- |
| Identity and preferences | operator profile, declared goals, boundaries, language and interface choices | operator-approved local record |
| Episodes | dated sessions, decisions, open loops, mission checkpoints | durable event/mission record |
| Knowledge assets | research, code, media, designs, documents, source hashes and locations | source manifest plus provenance |
| Skills and capabilities | what Node0 has proved, practiced, or merely planned | evidence-linked capability record |
| Relationship memory | what Dema may remember about how to assist the operator | operator-approved local record |
| Receipts and evidence | consent-bound records of consequential local or governed activity | receipt store; Dema reads, governed runtime issues governed receipts |

### 5.2 Derived, disposable indexes

Search indexes, embeddings, summaries, graph edges, ranks, and model-generated
tags are **derived projections**. They must carry:

- the source record identifiers and content hashes they derive from;
- generator/model and version when a model generated them;
- creation time, invalidation rule, and a `DERIVED` or `ASSUMED-WITH-IHSAN`
  truth label;
- a rebuild path that never changes canonical facts.

Deleting or rebuilding an index must never delete canonical memory.

### 5.3 Memory write law

1. Observe candidate information.
2. Classify the source as operator statement, measured observation, derived
   summary, or untrusted external material.
3. Sanitize untrusted material before it can enter a retrieval index.
4. Present a scoped memory proposal when the record is personal, sensitive, or
   semantically consequential.
5. Write a schema-tagged record under `DEMA_HOME`; preserve source and
   provenance.
6. Re-index only derived projections.
7. Make every recall display its evidence and certainty.

No silent import. No model-only fact. No memory write that creates authority for
an action.

## 6. Requirement baseline

| ID | Requirement | Verification |
| --- | --- | --- |
| MEM-R-001 | Closing and reopening Dema preserves approved canonical memory. | Restart test against a temporary `DEMA_HOME`. |
| MEM-R-002 | Replacing the LLM does not change canonical records or their identifiers. | Run the same retrieval contract with two adapters or a stub and compare canonical output. |
| MEM-R-003 | Every recalled fact shows source, truth label, and retrieval reason. | UI/API contract test and manual Homebase review. |
| MEM-R-004 | The operator can inspect, correct, export, and forget a local record; correction is an amendment, not hidden overwrite. | CRUD and provenance tests. |
| MEM-R-005 | Untrusted corpus is sanitized and never becomes an authority-bearing memory by ingestion alone. | Red-first injection and secret-redaction tests. |
| MEM-R-006 | Mission continuity restores the exact pending point from disk and never silently resumes an effect. | Kill/restart and consent-boundary test. |
| MEM-R-007 | Search remains useful without treating vector similarity as truth. | Retrieval relevance suite plus source-attribution assertions. |
| MEM-R-008 | The Homebase reads live local state only and does not invent progress. | Read-only integration test with stale/absent data cases. |

## 7. Delivery life cycle

### Phase 0 — Estate map and threat model

Inventory existing `~/.dema` memory, profiles, receipts, mission/season state,
research sources, UI designs, and every existing writer/reader. Define trust
zones and sensitive classes. Deliverable: approved map with `MEASURED`,
`DERIVED`, `UNKNOWN`, and `NOT_RUN` labels.

**Exit:** no new store is chosen until duplicate authorities and unowned data
paths are identified.

### Phase 1 — Requirements and information model

Freeze schemas, record ownership, provenance fields, retention classes,
correction/forget/export semantics, and compatibility policy. Map every
requirement to a test.

**Exit:** MEM-R-001 through MEM-R-008 are reviewable and no requirement grants
hidden runtime authority.

### Phase 2 — Minimum durable spine

Implement the smallest local record store, append-only amendment history,
source links, and deterministic index rebuild. Reuse the existing `DEMA_HOME`
and memory/season patterns before adding infrastructure.

**Exit:** a record survives restart and can be inspected, amended, exported, and
forgotten without touching an LLM.

### Phase 3 — Retrieval and model substitution

Add retrieval as a read-only projection: lexical/source lookup first, then
optional semantic retrieval. Return evidence cards, not unsupported prose.

**Exit:** model A, model B, and no-model mode agree on canonical memory and
surface the same provenance.

### Phase 4 — Companion Homebase

Connect the existing Dema front door and Homebase design to memory, mission,
receipts, and open loops. The Realm may visualize the same state but cannot own
a parallel game-only state.

**Exit:** the morning loop works from disk: orientation, one justified signal,
one safe next action, and one visible consent boundary.

### Phase 5 — Agent integration

PAT agents may propose memory candidates and retrieval plans. SAT agents verify
provenance, consent scope, and claim labels. Neither can silently promote a
model inference into permanent truth.

**Exit:** an adversarial test proves that a plausible but unsupported agent
memory is refused or visibly labeled uncertain.

### Phase 6 — Validation, operations, and evolution

Run restart, model-swap, corruption, deletion, provenance, privacy, latency,
and operator-usability tests. Maintain version migrations and a local recovery
runbook. Any public or multi-node step is a separate, consent-bound scope.

**Exit:** the acceptance suite and a real operator trial both pass; unresolved
risks remain visible in the Homebase and release record.

## 8. Quality gates and metrics

| Quality concern | Gate / measure |
| --- | --- |
| Continuity | restart recovery succeeds on a stored mission and memory fixture; no fresh-session fallback is mislabeled as resume |
| Provenance | 100% of surfaced factual memories point to a canonical source or are marked uncertain |
| Sovereignty | export and forget paths are tested; no canonical operator state leaves `DEMA_HOME` by default |
| Integrity | tampered canonical record or derived index/source mismatch is rejected or quarantined |
| Retrieval | measure answer support, temporal correctness, multi-hop support, p95 latency, token cost, and empty-result honesty |
| Safety | prompt-injection and secret-containing corpus fixtures never enter retrievable canonical memory unsafely |
| Usability | an operator can answer “where am I?” and inspect the evidence for the answer without a chat transcript |

## 9. Definition of done for the first living memory loop

The first loop is complete only when all of these are true:

1. The operator saves one approved memory with source and truth label.
2. Dema is closed; the process/session state is discarded.
3. Dema restarts against the same `DEMA_HOME`.
4. A different model adapter—or no model—reads the same canonical memory.
5. Homebase shows the memory's source, status, and one relevant next step.
6. The operator corrects or forgets it; the old record remains an auditable
   amendment/tombstone rather than an invisible overwrite.
7. No network use, external publication, token action, or governed effect is
   implied by this loop.

## 10. Open decisions

- Which existing local corpus roots enter Phase 0, and which remain explicitly
  excluded until each owner grants scope?
- What retention classes are required for personal, sensitive, mission, and
  research records?
- Which relationship-memory fields require explicit confirmation every time,
  versus durable opt-in?
- What local recovery and encryption posture is sufficient for Node0 before any
  external synchronization is considered?

## 11. References

- ISO/IEC/IEEE 15288:2023, *System life cycle processes* —
  https://www.iso.org/standard/81702.html
- ISO/IEC/IEEE 29148:2018, *Requirements engineering* —
  https://www.iso.org/standard/72089.html
- ISO/IEC 25010:2023, *Product quality model* —
  https://www.iso.org/standard/78176.html
- NIST AI 600-1 (2024), *Generative AI Profile* —
  https://doi.org/10.6028/NIST.AI.600-1
- NIST SP 800-218A (2024), *Secure Software Development Practices for
  Generative AI and Dual-Use Foundation Models* —
  https://doi.org/10.6028/NIST.SP.800-218A
- Kang et al. (2025), *Memory OS of AI Agent* —
  https://arxiv.org/abs/2506.06326
- Xu et al. (2025), *A-MEM: Agentic Memory for LLM Agents* —
  https://arxiv.org/abs/2502.12110
- Tan et al. (2025), *MemBench* — https://arxiv.org/abs/2506.21605
