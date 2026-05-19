# Known Gaps Register · Launch Pack v0.1 Binder

> **Discipline**: every gap below is NAMED honestly. If a gap is not listed here and you find one, that's a real finding for the feedback form. If a gap IS listed here, you've found the same thing the architect has already acknowledged.

| Field | Value |
|---|---|
| **Generated** | 2026-05-19 GST · current main HEAD `ea4c231` (post-PR-#61 merge) |
| **Supersedes** | Lighthouse Pack v1.0 `06_KNOWN_GAPS.md` (2026-05-18 · HEAD `5d80368`) |
| **Discipline anchor** | `[[feedback_law_of_assumption_canon_of_canons]]` — declare verified · derived · assumed-with-Ihsān · unknown |

This document categorizes gaps into 4 truth-labeled buckets:

- **❌ KNOWN-MISSING** — designed-not-built · acknowledged · on roadmap
- **⚠️ KNOWN-PARTIAL** — half-built · in progress · or scope-bounded by design
- **🔵 KNOWN-DEFERRED** — explicitly out of scope at v0.1 · by canon
- **🟢 KNOWN-LIVE** — works · listed here only because reviewers often expect to find them missing

---

## Category 1 · KNOWN-MISSING (designed-not-built)

| # | Gap | Designed in | Built? | Phase to address |
|---|---|---|---|---|
| 1 | **POI v0.1 implementation** (`packages/core/src/poi-preview-v0_1.js`) | ADR-009 (Accepted 2026-05-19) | ❌ | Phase 2 (Days 35-45 per GTM) |
| 2 | **POI v0.1 adversarial test suite** (≥15 tests · per ADR-009 Gate 4) | ADR-009 §"Gates" | ❌ | Phase 1 (Days 2-10 · pre-impl test plan) |
| 3 | **URP local pool init at N=1** (Pillar 5 activation in Dema · NOT bizra-omega Rust ceremony) | `[[feedback_urp_at_n_1_self_sustainable]]` + `bizra-resourcepool` README | ❌ | Phase 2 (Days 50-60) |
| 4 | **Reward function design** (ADR-010+ · impact-score → entitlement) | Cited in ADR-009 §"Design downstream of POI · not yet considered" | ❌ | Post-Day-90 (deferred) |
| 5 | **Federated POI aggregation** (cross-node score comparison) | Cited in ADR-009 §"Design downstream" + POI-C3 binding refusal | ❌ | Post-Day-90 (deferred) |
| 6 | **6 of 7 PAT agents structurally materialized in filesystem** | `bizra-omega/bizra-resourcepool/src/genesis.rs:21-32` | ❌ (only `mission_agent` materialized at `~/.dema/agents/`) | Phase 2 (Days 55-60) |
| 7 | **5 SAT agents structurally materialized in filesystem** | `bizra-omega/.../genesis.rs:35-43` | ❌ (canonical-only) | Phase 2 (Days 55-60) |
| 8 | **Arabic / Urdu / Hindi mother-tongue homebase-language-picker templates DECLARED status** | ADR-011 + Issue #57 | ⚠️ Arabic is `DECLARED_NEEDS_NATIVE_REVIEW` · Urdu + Hindi are `PLACEHOLDER_PENDING_NATIVE_AUTHOR` | Phase 3 (Days 65-75) |
| 9 | **Operator-side env-hygiene check for DEMA_* environment variables** (`dema doctor --env-hygiene`) | Issue #56 (operator-side · `~/.bashrc` leak workaround) | ❌ | Phase 1 (Days 1-30 · operator-side) |
| 10 | **`core ↔ verifier` soft-cycle refactor** (extract `consent-phrases.js` leaf) | Issue #58 · SPARC Analyzer 2026-05-19 finding | ❌ (works today · no Node.js crash · but layering contract violation) | Phase 3 (Days 80-85) |

---

## Category 2 · KNOWN-PARTIAL (half-built · or scope-bounded)

| # | Gap | Current state | Why partial · or scope-bounded |
|---|---|---|---|
| 1 | **ADR-013 visual language port to all 117 `tui-formatter.js` call-sites** | 1 of 117 call-sites use `Theme.title` (proof-of-isomorphism · homebase banner header) | Full refactor deferred per ADR-013 §"What this ADR explicitly does NOT do" rule 3 |
| 2 | **Lighthouse Pack v1.0 → v1.1 refresh at current HEAD** | v1.0 sealed at HEAD `5d80368` (2026-05-18) · current main is `ea4c231` (8 PRs ahead · 1014 more tests) | Refresh deferred to Phase 2 Day 35-60 per GTM Day-90 schedule |
| 3 | **SAT-5 schema canon drift** between `bizra-omega/.../genesis.rs` (Validator/Oracle/Mediator/Archivist/Sentinel) and Dema `dema ambient audit` output (SAT-Orchestrator/Policy/QualityOps/Resource/GlobalVerifier) | Both schemas in source · neither superseded · per-runtime vocabulary canon allows this | Phase 1 Day 1-5 decision: resolve OR canonize as parallel vocabularies (see GTM §IX.B Decision #6) |
| 4 | **Receipt-chain trajectory · #71 currently · projected #81 by Day 90** | Chain advances by typed-GO · not by date | Right-sized per GTM Day-90 plan |
| 5 | **Three-runtime bridges** | Only Rust↔JS bridge (ADR-013 visual language port · design-only · no runtime IPC) | Python↔JS bridge not currently needed (per ADR-014) |
| 6 | **`dema chat` REPL stand-alone usefulness** | Functional · refuses to do anything without exact-string consent · feels limited to first-time operators | By design (refusal-as-product) · feels like a feature gap until you understand the canon |
| 7 | **Bitcoin OpenTimestamps anchor for current main `ea4c231`** | Last OTS anchor was at an earlier HEAD | Phase 3 Day 88: re-anchor current canonical state |

---

## Category 3 · KNOWN-DEFERRED (explicitly out of scope at v0.1 · by canon)

| # | Item | Why deferred |
|---|---|---|
| 1 | **Token mint of any kind** | POI-C1 binding refusal · 50% pool oath inactive before proof gates · ZERO economic activation |
| 2 | **Ring 4 public launch** | Per `[[feedback_evidence_first_gtm_concentric_rings]]` Ring 4 cannot precede Ring-3 cycle · 90 days insufficient |
| 3 | **Revenue / subscription / freemium / paid features** | No economic activation at v0.1 by design |
| 4 | **Federation activation (Node1+ cross-node URP)** | Requires Step7 mint · separate halt-gate sequence · post-90 |
| 5 | **Mobile / Android port** | Z Fold 6 acts as Node0 companion (per `[[reference_owned_domains]]` + ordinal canon) · not separate runtime |
| 6 | **BIZRA-omega Rust-layer URP genesis ceremony** | Separate from Dema-layer activation (which is done since 2026-04-21) · optional · evaluate post-Day-90 |
| 7 | **Founder allocation · pre-mint · advisor allocations** | Forbidden by architect-self-binding · 3 years unpaid is the structural evidence |
| 8 | **Whitepaper · academic publication · regulatory filing** | Currency of academic publication is different from currency of receipt chain · evaluate post-Day-180 |
| 9 | **Press / media engagement · launch announcement** | Ring 4 territory · out of scope at v0.1 |
| 10 | **VC pitch deck · token sale · ICO / IDO** | POI-C2 forbids public economic claim at v0.1 |
| 11 | **CLA · advisor agreements · vesting schedules** | Premature · no economic surface to vest against |
| 12 | **Privacy policy · terms of service** | No user data collection at v0.1 · Dema is local-first · no SaaS surface |
| 13 | **GDPR / data processing agreement** | Same as #12 · no data leaves the operator's machine |
| 14 | **Bug bounty program** | Premature · single-operator ecosystem at v0.1 |
| 15 | **Discord / Telegram community** | Premature · Ring 4 territory |

---

## Category 4 · KNOWN-LIVE (works · listed here only because reviewers expect to find them missing)

| # | Capability | Where on disk | Truth label |
|---|---|---|---|
| 1 | Receipt chain (70 receipts at HEAD `ea4c231`) | `.proof-forge/EVIDENCE_INDEX.json` | VERIFIED |
| 2 | Bitcoin OpenTimestamps anchoring (for foundational docs at blocks 948027/948028/948029) | `.proof-forge/anchors/` | VERIFIED |
| 3 | 2223 tests passing (4 review gates green) | `npm test` | VERIFIED |
| 4 | Three-runtime architecture · bizra-data-lake + bizra-omega + Dema all on this machine | `~/BIZRA Node0/bizra-data-lake/` + `~/Downloads/Dema/` | VERIFIED |
| 5 | Node0 sovereign identity (active 28 days · Ed25519 keypair on disk) | `~/.bizra/mumo/node0-key.{hex,pub.hex}` | VERIFIED |
| 6 | Visual language port from Rust `bizra-cli/src/theme.rs` to JS `dema-theme.js` (byte-for-byte RGB fidelity) | `packages/core/src/dema-theme.js` + `tests/dema-theme-rust-sync.test.js` | VERIFIED |
| 7 | Palette resolver from env (`COLORTERM` / `TERM` / `NO_COLOR` / `DEMA_PALETTE`) | `packages/core/src/tui-formatter.js` `resolvePaletteFromEnv` | VERIFIED |
| 8 | `bin/dema` homebase TUI with humanized next_safe_action (no snake_case leak to operator) | `packages/core/src/next-action-humanizer.js` | VERIFIED |
| 9 | Zero runtime dependencies (npm install adds 0 packages) | `package.json` | VERIFIED |
| 10 | Refusal-as-product (36 refusal sentinels in source) | `grep -c 'refused\|REFUSED' packages/core/src/*.js` | VERIFIED |
| 11 | ADR-005 exact-string consent canon (every halt-gate enforced) | All 14 ADRs · session log shows 100% halt-gate respect | VERIFIED |
| 12 | Master Craftsmanship audit pattern | `packages/core/src/master-craftsmanship-audit.js` + ADR-008 | VERIFIED |
| 13 | 14 ADRs (13 Accepted including ADR-009 + ADR-014 just-Accepted 2026-05-19) | `docs/06-adr/` | VERIFIED |
| 14 | Cross-session memory anchors (12 load-bearing entries) | `~/.claude/projects/-home-bizra-operating-system-Downloads-Dema/memory/` | VERIFIED |

---

## How the architect makes sure not to hide gaps

The Daughter Test (`[[reference_bizra_constitutional_anchors]]`) applies to this gap register itself:

> Would Mumu willingly subject his own family to this gap register being the complete truth?

**Yes** — because:
- Every "missing" item is listed (not hidden under euphemism)
- Every "partial" item is named with the reason (by-design vs in-progress)
- Every "deferred" item is named with the canonical refusal (POI-C1, Riba-Zero, evidence-first GTM, etc.)
- Every "live" item is grep-verifiable on disk

If you (the reviewer) find a gap not listed in any of the 4 categories above, it's either:
- A real new finding (high signal · please report in `07_*.md`)
- A misreading of the canon (please report so the doc can be clarified)
- An interpretation difference between two reasonable readings (please report so an amendment ADR can be authored)

**No category should ever contain the answer "we'll add this if a customer asks."** That is the slope to fabrication.

---

## Cross-references

- GTM document: `01_BIZRA_90_Day_GTM_v0.1.1.md` §VIII Risk Register · §XII Honest Constraints
- ADR-009 POI: §"Out of scope" lines 150-159
- ADR-014 three-runtime: §"What this ADR explicitly does NOT do"
- Memory: `[[feedback_law_of_assumption_canon_of_canons]]` · `[[feedback_evidence_first_gtm_concentric_rings]]` · `[[feedback_urp_at_n_1_self_sustainable]]`

---

**Truth discipline**: All claims in this document are labeled VERIFIED · DERIVED · ASSUMED · UNKNOWN per `08_TRUTH_LABEL_PAGE.md`.
