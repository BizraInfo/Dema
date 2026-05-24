# ADR Index

> **Purpose:** Navigable list of every Architecture Decision Record in this folder. Each row points to the canonical ADR file with its current status, date of acceptance, and one-line decision summary. Used by cold reviewers to locate the relevant decision in <60 seconds without scanning the directory.
>
> **Format:** Lightweight ADR records (`# ADR-NNN: Title` · `**Status:**` · `**Date:**` · `## Context` / `## Decision` / `## Consequences` sections, with the older records lighter on the consequences section). Status values: `Accepted` · `Proposed` · `Parking lot` · `Superseded`.
>
> **Last refreshed:** 2026-05-24 GST against `main @ d14b267`.

---

## Active records

| # | Title | Status | Accepted | One-line decision |
|---:|---|---|---|---|
| [001](ADR-001-dema-is-one-face.md) | DEMA Is the One Face | Accepted | 2026-04-17 | Dema is the sole product-facing surface; specialist BIZRA systems do not bind to users directly. |
| [002](ADR-002-no-shadow-state.md) | No Shadow State | Accepted | 2026-04-17 | All state visible to the operator; nothing held invisibly behind the CLI. |
| [003](ADR-003-core-truth-lives-in-bizra-omega.md) | Core Truth Lives in bizra-omega | Accepted | 2026-04-17 (substrate clarification 2026-05-05) | Authoritative engine state lives in the Rust workspace inside `bizra-data-lake`; Dema reads via the cognition gateway. |
| [004](ADR-004-local-first-memory.md) | Local-First Memory | Accepted | 2026-04-17 | Memory is on-disk and operator-inspectable, not opaque cloud embeddings. |
| [005](ADR-005-operator-actions-require-explicit-consent.md) | Operator Actions Require Explicit Consent | Accepted | 2026-04-17 | Exact-string consent canon binds every operator-visible side-effect. |
| [006](ADR-006-continuous-assurance-and-no-mint-verification.md) | Continuous Assurance and No-Mint Verification | Accepted | 2026-05-12 | `dema-assure verify` is state-read-only; minting is bifurcated from verification. |
| [007](ADR-007-multi-session-chain-policy.md) | Multi-Session Chain Policy | Accepted | 2026-05-16 (proposed 2026-05-12) | Receipt chain is filesystem-scoped; concurrent producers permitted with N+2 split-commit resolution. |
| [008](ADR-008-runtime-activation.md) | Full Runtime Activation · Master Craftsmanship Build | Accepted | 2026-05-18 | 12-component runtime activation slice; defines the boundary between Dema-as-face and Node0-as-runtime. |
| [009](ADR-009-poi-proof-of-impact-design.md) | Proof-of-Impact (POI) Design | Accepted | 2026-05-19 (typed-GO `GO accept ADR-009 and ADR-014`) | Pre-implementation specification; scaffold-only ship; truth-label `ADR_009_AND_ADR_014_ACCEPTED_FOR_PRIVATE_WITNESS_GTM`. |
| [010](ADR-010-interactive-tui-layer-dep-decision.md) | Interactive TUI Layer · Dep Decision | Accepted | 2026-05-18 | Zero-dep ANSI homebase chosen (Option D); no `blessed` / `ink` dependency introduced. |
| [011](ADR-011-onboarding-consciousness-layer.md) | Onboarding Consciousness Layer | Accepted | 2026-05-19 | First-run flow as consent-and-language ceremony; v0.2 adds returning-user language load, second-language capture, Genesis Preview Card. |
| [012](ADR-012-cli-naming-convention.md) | CLI Naming Convention | Accepted | 2026-05-19 | Stable subcommand naming rules across the dispatch surface (closes Dema UX upgrade arc Task #12 of 12). |
| [013](ADR-013-visual-language-isomorphism-bizra-cli-to-dema.md) | Visual Language Isomorphism — Port `bizra-cli` Theme to Dema | Accepted | 2026-05-19 | Dema inherits the `bizra-cli` visual language; ANSI bridge layer canonized. |
| [014](ADR-014-three-runtime-architecture-canonization.md) | Three-Runtime Architecture Canonization | Accepted | 2026-05-19 (typed-GO `GO accept ADR-009 and ADR-014`) | Python · Rust · JS runtime split canonized; cross-runtime bridge contract anchored. |
| [015](ADR-015-llm-suggestion-verifier-authority.md) | LLM is Suggestion · Verifier is Authority | Accepted | 2026-05-19 (typed-GO `GO accept ADR-015`) | Verdict gates HOLD-by-default; classifier diagnostic only, never authoritative. |
| [016](ADR-016-eval-layer2-scaffold-only.md) | Layer 2 (LLM-as-judge) Ships as Scaffold-Only | Accepted | 2026-05-23 (typed-GO `GO save planner output as docs/06-adr/ADR-016-eval-layer2-scaffold-only.md`) | Remote LLM is never invoked from runtime; Layer 2 stays scaffold. |
| [017](ADR-017-youtube-channel-hypergraph-scaffold-only.md) | YouTube Channel Hypergraph Miner v0.1 | Parking lot | 2026-05-23 (execution explicitly deferred per operator pivot to ADR-018) | Planner-output scaffold preserved; not flagship critical path. |
| [018](ADR-018-model-broker-promotion-path.md) | Model Broker Promotion Path — localhost-only · Ollama v0.1 | Accepted | 2026-05-23 (typed-GO `a + c in parallel`) | Localhost-only model broker via Ollama selected as the load-bearing next slice. |

**Tally:** 17 Accepted · 1 Parking lot · 0 Proposed · 0 Superseded · **18 total**

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
- **Authorship:** "Decision makers" (older convention) or "Authorized by" / "Authors" (newer convention). Operator (Mumu) is the sole accept-authority across all 18 records.

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
