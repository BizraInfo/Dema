# ADR Index

> **Purpose:** Navigable list of every Architecture Decision Record in this folder. Each row points to the canonical ADR file with its current status, date of acceptance, and one-line decision summary. Used by cold reviewers to locate the relevant decision in <60 seconds without scanning the directory.
>
> **Format:** Lightweight ADR records (`# ADR-NNN: Title` · `**Status:**` · `**Date:**` · `## Context` / `## Decision` / `## Consequences` sections, with the older records lighter on the consequences section). Status values: `Accepted` · `Proposed` · `Parking lot` · `Superseded`.
>
> **Last refreshed:** 2026-06-25 GST against `main @ d38f7c7` (added ADR-040 + ADR-041; ADR-039 noted intentionally absent/discarded).
>
> **2026-06-24 addendum (not a full re-review):** the five framework kernels
> shipped in #233–#238 (HHMM, hash-table-knowledge-index, self-awareness,
> self-loop-OODA, diffusion-reasoner) do **not** yet have dedicated ADRs. Their
> decision records currently live in each kernel's source-header boundary block,
> in `docs/TESTING.md`, and in `docs/CURRENT_LIMITS.md` (Framework-kernels
> section). A full index re-review against `main @ 4e4b086` — and ADR-039+ for
> these kernels if warranted — remains a separate pass. This note exists so a
> cold reviewer is not misled into thinking the index already covers them.

---

## Active records

|                                                               # | Title                                                        | Status      | Accepted                                                                                           | One-line decision                                                                                                                       |
| --------------------------------------------------------------: | ------------------------------------------------------------ | ----------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
|                              [001](ADR-001-dema-is-one-face.md) | DEMA Is the One Face                                         | Accepted    | 2026-04-17                                                                                         | Dema is the sole product-facing surface; specialist BIZRA systems do not bind to users directly.                                        |
|                               [002](ADR-002-no-shadow-state.md) | No Shadow State                                              | Accepted    | 2026-04-17                                                                                         | All state visible to the operator; nothing held invisibly behind the CLI.                                                               |
|               [003](ADR-003-core-truth-lives-in-bizra-omega.md) | Core Truth Lives in bizra-omega                              | Accepted    | 2026-04-17 (substrate clarification 2026-05-05)                                                    | Authoritative engine state lives in the Rust workspace inside `bizra-data-lake`; Dema reads via the cognition gateway.                  |
|                            [004](ADR-004-local-first-memory.md) | Local-First Memory                                           | Accepted    | 2026-04-17                                                                                         | Memory is on-disk and operator-inspectable, not opaque cloud embeddings.                                                                |
|     [005](ADR-005-operator-actions-require-explicit-consent.md) | Operator Actions Require Explicit Consent                    | Accepted    | 2026-04-17                                                                                         | Exact-string consent canon binds every operator-visible side-effect.                                                                    |
| [006](ADR-006-continuous-assurance-and-no-mint-verification.md) | Continuous Assurance and No-Mint Verification                | Accepted    | 2026-05-12                                                                                         | `dema-assure verify` is state-read-only; minting is bifurcated from verification.                                                       |
|                    [007](ADR-007-multi-session-chain-policy.md) | Multi-Session Chain Policy                                   | Accepted    | 2026-05-16 (proposed 2026-05-12)                                                                   | Receipt chain is filesystem-scoped; concurrent producers permitted with N+2 split-commit resolution.                                    |
|                            [008](ADR-008-runtime-activation.md) | Full Runtime Activation · Master Craftsmanship Build         | Accepted    | 2026-05-18                                                                                         | 12-component runtime activation slice; defines the boundary between Dema-as-face and Node0-as-runtime.                                  |
|                    [009](ADR-009-poi-proof-of-impact-design.md) | Proof-of-Impact (POI) Design                                 | Accepted    | 2026-05-19 (typed-GO `GO accept ADR-009 and ADR-014`)                                              | Pre-implementation specification; scaffold-only ship; truth-label `ADR_009_AND_ADR_014_ACCEPTED_FOR_PRIVATE_WITNESS_GTM`.               |
|            [010](ADR-010-interactive-tui-layer-dep-decision.md) | Interactive TUI Layer · Dep Decision                         | Accepted    | 2026-05-18                                                                                         | Zero-dep ANSI homebase chosen (Option D); no `blessed` / `ink` dependency introduced.                                                   |
|                [011](ADR-011-onboarding-consciousness-layer.md) | Onboarding Consciousness Layer                               | Accepted    | 2026-05-19                                                                                         | First-run flow as consent-and-language ceremony; v0.2 adds returning-user language load, second-language capture, Genesis Preview Card. |
|                         [012](ADR-012-cli-naming-convention.md) | CLI Naming Convention                                        | Accepted    | 2026-05-19                                                                                         | Stable subcommand naming rules across the dispatch surface (closes Dema UX upgrade arc Task #12 of 12).                                 |
| [013](ADR-013-visual-language-isomorphism-bizra-cli-to-dema.md) | Visual Language Isomorphism — Port `bizra-cli` Theme to Dema | Accepted    | 2026-05-19                                                                                         | Dema inherits the `bizra-cli` visual language; ANSI bridge layer canonized.                                                             |
|       [014](ADR-014-three-runtime-architecture-canonization.md) | Three-Runtime Architecture Canonization                      | Accepted    | 2026-05-19 (typed-GO `GO accept ADR-009 and ADR-014`)                                              | Python · Rust · JS runtime split canonized; cross-runtime bridge contract anchored.                                                     |
|             [015](ADR-015-llm-suggestion-verifier-authority.md) | LLM is Suggestion · Verifier is Authority                    | Accepted    | 2026-05-19 (typed-GO `GO accept ADR-015`)                                                          | Verdict gates HOLD-by-default; classifier diagnostic only, never authoritative.                                                         |
|                     [016](ADR-016-eval-layer2-scaffold-only.md) | Layer 2 (LLM-as-judge) Ships as Scaffold-Only                | Accepted    | 2026-05-23 (typed-GO `GO save planner output as docs/06-adr/ADR-016-eval-layer2-scaffold-only.md`) | Remote LLM is never invoked from runtime; Layer 2 stays scaffold.                                                                       |
|      [017](ADR-017-youtube-channel-hypergraph-scaffold-only.md) | YouTube Channel Hypergraph Miner v0.1                        | Parking lot | 2026-05-23 (execution explicitly deferred per operator pivot to ADR-018)                           | Planner-output scaffold preserved; not flagship critical path.                                                                          |
|                   [018](ADR-018-model-broker-promotion-path.md) | Model Broker Promotion Path — localhost-only · Ollama v0.1   | Accepted    | 2026-05-23 (typed-GO `a + c in parallel`)                                                          | Localhost-only model broker via Ollama selected as the load-bearing next slice.                                                         |
|       [019](ADR-019-impact-launchpad-mvp-contract-boundary.md) | Impact Launchpad MVP Contract Boundary                       | Proposed    | Pending typed GO                                                                                    | Proposed docs-only software/governance boundary before contribution proposal flow, review-envelope shape, PoI, reward, token, marketplace, or public economic work. |
| [020](ADR-020-impact-launchpad-mvp-test-boundary.md) | Impact Launchpad MVP Test Boundary | Proposed | Pending typed GO | Docs-only test-boundary spec: required test categories, refusal paths, and gates to prove ADR-019's local consent-bound MVP before any implementation. |
| [021](ADR-021-impact-scoring-boundary.md) | Impact Scoring Boundary (Test Boundary) | Proposed | Pending typed GO | Test-boundary spec for what an impact score means/excludes (no reward/token/marketplace); test scaffold only, no scoring implementation. |
| [022](ADR-022-real-scoring-boundary.md) | Real Scoring Boundary (Test Boundary) | Proposed | Pending typed GO | Test-boundary-only spec for real scoring: allowed inputs, forbidden reward/token/marketplace outputs, anti-gaming and consent rules; no implementation. |
| [023](ADR-023-real-scoring-minimal-solvable-spec.md) | Real Scoring Minimal Solvable Spec | Proposed | Pending typed GO | Boundary spec (no implementation) for the minimal safe local real-scoring object/flow: one consent-, review-, receipt-bound, anti-gaming-checked review artifact. |
| [024](ADR-024-reward-eligibility-boundary.md) | Reward Eligibility Boundary | Proposed | Pending typed GO | Boundary spec only: reward eligibility as a future local, consent-bound, human-review-gated review-state candidate; no token/payout/mint/economic logic. |
| [025](ADR-025-reward-receipt-boundary.md) | Reward Receipt Boundary | Proposed | Pending typed GO | Boundary spec for reward-eligibility receipts as local content-addressed expectation placeholders only; no minting, writing, publishing, bridging, or authorization. |
| [026](ADR-026-reward-receipt-local-write-boundary.md) | Reward Receipt Local Write Boundary | Proposed | Pending typed GO | Boundary spec only (no writer) for future consent-gated, content-addressed, integrity-verified local-only persistence of reward-receipt review objects under DEMA_HOME. |
| [027](ADR-027-reward-receipt-local-writer-boundary.md) | Reward Receipt Local Writer Boundary | Proposed | Pending typed GO | Boundary spec only (no implementation) for a future consent-gated, path-safe, integrity-checked local writer under DEMA_HOME; no mint/publish/bridge. |
| [028](ADR-028-atomic-impact-receipt-lifecycle-boundary.md) | Atomic Impact Receipt Lifecycle Boundary | Proposed | Pending typed GO | Boundary spec only: the AIR local-first lifecycle spine with per-layer allowed/forbidden schemas; no runtime, minting, publishing, or economic activation. |
| [029](ADR-029-mission-centric-state-ecosystem-boundary.md) | Mission-Centric State Ecosystem Boundary | Proposed | Pending typed GO | Boundary spec only: mission-centric state with Mission ID as primary key, AIR as transition atom, env re-check + stale-belief invalidation; no runtime/implementation. |
| [030](ADR-030-dema-data-lake-alignment-boundary.md) | Dema / Data-Lake Alignment Boundary | Proposed | Pending typed GO | Boundary spec only: how the Dema face may later reference/align with Data Lake body artifacts as proof-gapped expectations; no runtime sync, mutation, or cross-repo write. |
| [031](ADR-031-hybrid-mission-knowledge-graph-bok-boundary.md) | Hybrid Mission Knowledge Graph + Body of Knowledge Boundary | Proposed | Pending typed GO | Boundary spec only: future hybrid mission-tree + knowledge-graph + Body-of-Knowledge learning geometry as references; no runtime, vector store, or Data Lake mutation. |
| [032](ADR-032-node0-closed-loop-digest-boundary.md) | Node0 Closed-Loop Digest Boundary | Proposed | Pending typed GO | Boundary spec only: a future local proof-summary envelope referencing the receipt-to-hybrid-knowledge chain; no digest runtime, writer, or public activation. |
| [033](ADR-033-layer-closure-contract-lcc6-boundary.md) | Layer Closure Contract LCC-6 Boundary | Proposed | Pending typed GO | Boundary spec only: LCC-6 as a mandatory six-part closure contract (boundary/schema/test-scaffold/delivery-check/claim-map/remote-witness) per proof layer; no implementation. |
| [034](ADR-034-g-ladder-layer-index-boundary.md) | G-Ladder Layer Index Boundary | Proposed | Pending typed GO | Boundary spec only: a future local-only proof-index for BIZRA proof layers, G-rings, LCC-6 status, witnesses, and blocked invariants; no runtime/writer/registry. |
| [035](ADR-035-node0-closed-loop-runtime-dry-run-boundary.md) | Node0 Closed-Loop Runtime Dry-Run Boundary | Proposed | Pending typed GO | Boundary spec only: a local, dry-run-only, replay-safe, consent-gated envelope for a future Node0 closed-loop runtime; no live runtime, no implementation. |
| [036](ADR-036-node0-local-persistence-boundary.md) | Node0 Local Persistence Boundary | Proposed | Pending typed GO | Boundary spec only: what Node0/Dema may eventually store under DEMA_HOME/~/.dema, what it must never store, and proof gates required before any writer. |
| [037](ADR-037-node0-mumu-closed-loop-v0.1.md) | Node0 Mumu Closed Loop v0.1 (Genesis Single-Node Active Network) | Proposed | Pending typed GO | Declares a local, offline, metadata-only single-node loop (`npm run node0`) with PAT/SAT, exact-consent gate, hash-chained receipts, and simulation-only PoI preview. |
| [038](ADR-038-autonomous-evolution-governance-gate.md) | Autonomous-Evolution Governance Gate (mission step 6) | Accepted | 2026-06-13 | Evolution-class capabilities (token, federation, production) are governed by existing claim-register/corpus gates; none may exceed MECHANISM_VERIFIED_SYNTHETIC. |
| [040](ADR-040-pat-sat-blackboard-dry-run-1a.md) | PAT/SAT Blackboard Dry-Run (PAT-SAT-BLACKBOARD-DRY-RUN-1A) | Accepted | 2026-06-24 | Deterministic precondition-driven shared-state board sequencing PAT (discover/draft/propose/self_critique) and SAT (verify/gate/refuse_or_permit_preview/critique) entries from a `{pain,goal}` seed; PREVIEW_ONLY, boundary all-false, body-bound verify; the activate rung stays operator-only. |
| [041](ADR-041-pat-sat-blackboard-live-1a.md) | PAT-SAT-BLACKBOARD-LIVE-1A — single-step live suggestion | Accepted | 2026-06-24 | One exact-consent-gated, localhost-only, suggestion-only local-model call for the PAT `propose` seat via `invokeDemaTalkLive`; `model_invocation_performed` may be true (honest), the 10 forbidden runtime-emission keys + autonomy stay false; not autonomous coordination. |

> **ADR-039 is intentionally absent:** it was a draft for the CLAUDE-OPERATING-LAYER work that was discarded as NOT_MERGED orphan (never committed), so the on-disk sequence skips 039. (Noted 2026-06-25.)

**Tally:** 20 Accepted · 1 Parking lot · 19 Proposed · 0 Superseded · **40 total**

---

## Subfolders

- [`audits/`](audits/) — analytical reports that surveyed the ADR set across a snapshot in time. These are **not** themselves ADRs and do not get numbered in the sequence above.
  - [`audits/2026-05-19-omnidirectional-audit.md`](audits/2026-05-19-omnidirectional-audit.md) — omnidirectional audit of the ADR-001..ADR-015 set on 2026-05-19.

---

## Conventions

- **Numbering:** ADRs are numbered sequentially. Gaps indicate withdrawn or skipped numbers (none currently).
- **Status flow:** `Proposed → Accepted` (most common) · `Proposed → Parking lot` (scaffold-only / deferred execution) · `Accepted → Superseded` (replaced by a later ADR; none currently).
- **Accepted date:** the date of operator typed-GO or merge — whichever is later. When an ADR was proposed earlier than accepted, both dates appear.
- **File shape:** every ADR file begins with `# ADR-NNN: Title` · `**Status:**` · `**Date:**` followed by `## Context` / `## Decision` / `## Consequences` sections. The older records (ADR-001..ADR-005) are lighter on the consequences section; later records are progressively more rigorous.
- **Authorship:** "Decision makers" (older convention) or "Authorized by" / "Authors" (newer convention). Operator (Mumu) is the sole accept-authority across all 19 records.

---

## Related

- [`docs/GTM_READINESS_MATRIX.md`](../GTM_READINESS_MATRIX.md) — this index closes Tier-2 row #10 (PARTIAL → COMPLETE).
- [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) — system architecture, referencing the accepted ADRs by number.
- [`docs/ROADMAP.md`](../ROADMAP.md) — parked-vs-active items map.

---

## Update protocol

Re-refresh this index when:

- A new ADR file lands in `docs/06-adr/` (add the row, bump tally).
- An ADR's status changes (Proposed → Accepted, or any Supersede event).
- An audit lands in `audits/` (link from the Subfolders section).
- A quarterly cold review reads each ADR for status drift against current code.

The refresh is mechanical and should not introduce new ADR content — only mirror the on-disk state at the time of refresh. Update the **Last refreshed** line and the `main @ <sha>` reference.
