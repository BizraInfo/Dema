# BIZRA / Dema · 90-Day Go-to-Market Plan v0.1

> **Operating canon:** *A deterministic constitutional execution engine with replayable receipts.*

| Field | Value |
|---|---|
| **Document type** | Strategic GTM Plan (BIG 3 consulting deliverable equivalent) |
| **Prepared** | 2026-05-19 GST |
| **Author of record** | Mumu (Mohamed Beshr) |
| **Synthesis prepared by** | Coordinator (Claude Opus 4.7 · 1M context · session-bound) |
| **Working main HEAD** | `ea4c231` (10 receipts minted this session · top 9 Ironclad) |
| **Document scope** | Days 1–90 only · Ring 1 → Ring 2 → Ring 3 (NOT Ring 4 public) |
| **Truth discipline** | Every claim labeled VERIFIED · DERIVED · ASSUMED · UNKNOWN |
| **Decision authority** | Mumu retains all halt-gate decisions · this doc proposes, does not commit |

---

## Part I · Executive Summary (single page)

**Bottom line up front (BLUF):**

> **At Day 90, BIZRA / Dema will have one operational Node0 publishing measurable Proof-of-Impact previews, a Ring-1 N=1 reviewer's signed feedback on record, a 3-node Ring-2 technical lighthouse cohort, and the URP local-resource-pool primitive active at N=1. No token will have been minted. No public claim will have been made. Ring 4 (public) is explicitly out of scope.**

**The five things Mumu must decide in the next 30 days** (each is a typed-GO halt-gate):

| # | Decision | Phrase to type | Blocks |
|---|---|---|---|
| 1 | Accept ADR-009 PoI design | `GO accept ADR-009` | Day 1–5 |
| 2 | Send Lighthouse Pack v1.0 to a real Ring-1 reviewer | `GO send pack to <name>` | Day 5–10 |
| 3 | Authorize URP local-pool init at N=1 (after ADR review) | `GO urp local init N=1` | Day 30–45 |
| 4 | Authorize POI v0.1 implementation (after Gate 1 + Gate 4 close) | `GO impl POI v0.1` | Day 45–60 |
| 5 | Accept ADR-014 (3-runtime architecture canonization) | `GO accept ADR-014` | Day 1–5 |

**The single irreducible spear-point:**

> Move ADR-009 from `Proposed` to `Accepted`, send the Lighthouse Pack to one real reviewer, and let external witness activate the next 90 days. Everything else is downstream.

**What this plan is NOT:**

- Not a token-launch plan
- Not a public-marketing plan
- Not a fundraising deck
- Not a vendor-selection document
- Not a Ring 4 roadmap (Ring 4 = public · explicitly out of scope at Day 90)
- Not a commitment to ship POI v0.1 by any specific date — POI is gate-bound, not date-bound

---

## Part II · Market Position & Defensible Moat

### II.A The four-axis competitive moat (verified disk truth)

| Moat axis | Evidence on disk · `ea4c231` | Competitor parity |
|---|---|---|
| **Constitutional discipline encoded in code** | 196 `preview_only` / `NODE0_LOCAL_SEED` markers · 36 refusal sentinels · ADR-005 exact-string consent enforced at every halt-gate | No identified competitor has this surface |
| **Receipt chain · cryptographically anchored** | 70 receipts at HEAD · top 9 consecutive Ironclad · OpenTimestamps Bitcoin-anchored at blocks 948027/948028/948029 · machine-verifiable via `python3 scripts/forge_evidence.py --verify` | OpenClaw + Hermes + Pi have NO receipt chain |
| **Zero-runtime-dependency JS preview face** | `package.json` declares NO `dependencies` and NO `devDependencies` · only Node.js stdlib + `node --test` · 2223 tests at HEAD | Pi has 4-tool minimal · OpenClaw + Hermes have full dep trees |
| **Three-runtime architecture** (ADR-014) | Python `bizra-data-lake/` · Rust `bizra-omega/` (20 crates · 944 tests) · JS `Dema/` · each audience-specific · cross-runtime bridges design-only | No competitor has 3-runtime audience-specific split |

### II.B Competitive landscape · honest map

| Competitor | License | Strength | Where BIZRA is differentiated |
|---|---|---|---|
| **Pi Coding Agent** (Mario Zechner · MIT) | MIT · open | Minimal 4-tool harness · 324 model providers · model-agnostic | No constitutional gate · no receipt chain · no refusal-as-product |
| **Hermes Agent** (Nous Research · MIT) | MIT · open | Multi-channel (Telegram/Discord/Slack/WhatsApp) · self-improving · runs anywhere | No constitutional gate · no receipt chain · cloud-first not sovereign |
| **OpenClaw** (openclaw.ai · MIT) | MIT · open | 23 chat-channel integrations · `openclaw onboard` wizard · production-grade | No constitutional gate · no receipt chain · cloud-first not sovereign |
| **Claude Code** (Anthropic · proprietary) | Proprietary · subscription | Mature TUI · extensive sub-agents · 10K-token system prompt | No constitutional gate beyond Anthropic policy · proprietary · vendor-locked |

**The defensible position** (DERIVED from disk evidence):

> No competitor is structurally capable of producing a deterministic constitutional execution engine with replayable receipts. The four moat axes (constitutional code · receipt chain · zero deps · three-runtime split) are not features any competitor can add without re-architecting from the founding documents up. The moat is the cumulative weight of 3 years of architect-self-binding — verifiable by Bitcoin-anchored foundation document hashes.

### II.C The GTM thesis (one sentence)

> Compete on **dignity** (can a non-technical, non-English, model-less human enter safely?), not on **capability** (whose model is biggest?). The four moat axes make dignity defensible.

---

## Part III · Current State Assessment (Day 0 · disk-verified)

### III.A The 4 Proof-of-Truth axes (today)

| Axis | State at `ea4c231` | Evidence | Truth label |
|---|---|---|---|
| **Formal** | 2223/2223 tests · 4 review gates green · 14 ADRs | `npm test` · `npm run check` · `npm run llm:guidance` · `git diff --check` | VERIFIED |
| **Cryptographic** | 70 receipts · top 9 Ironclad · `push:[main]` trigger live · OpenTimestamps Bitcoin-anchored | `python3 scripts/forge_evidence.py --verify` · `.proof-forge/EVIDENCE_INDEX.json` | VERIFIED |
| **Empirical** | Live `bin/dema` + `dema state` render canonical humanized text · GOLD-tinted header in true-color terminals | Operator-side smoke (this session) | VERIFIED |
| **Economic** | No federation · no mint · no token · no revenue · 50% pool oath active · Zakat 2.5% canonical | Per Third Fact §229 + `[[reference_50_percent_pool_correct_framing]]` | VERIFIED (correctly N/A) |

### III.B Node0 identity state

| Element | Verified on disk |
|---|---|
| Sovereign Ed25519 keypair | ✅ `~/.bizra/mumo/node0-key.hex` + `node0-key.pub.hex` (since 2026-04-21 · 28 days old) |
| Activation receipt | ✅ `~/.bizra/activations/2026-04-20T203654Z-phase-n-mumo/node0-genesis-receipt.hash` |
| Gateway log | ✅ `~/.bizra/activations/.../gateway.{log,pid}` |
| PoI at activation | ✅ `~/.bizra/activations/.../poi-at-activation.txt` (captured) |
| 1 PAT agent materialized | ✅ `~/.dema/agents/dema.node0_mission_agent/` · 7 YAML contracts + 6-phase spec + receipt chain |
| Other 6 PAT + 5 SAT agents structurally | ⚠️ Canonical in genesis.rs constants · not separately materialized in filesystem |
| bizra-omega `~/.bizra/wallet/` (Rust-layer URP genesis output) | ❌ Does not exist — separate ceremony from Dema-layer activation |

### III.C The 7-pillar BIZRA architecture · per-pillar disk state

| # | Pillar | Status | Evidence |
|---|---|---|---|
| 1 | **PAT** (Personal Agentic Team · 7 agents) | DECLARED + PARTIAL (mission_agent materialized · 6 others canonical-only) | `bizra-omega/bizra-resourcepool/src/genesis.rs:21-32` |
| 2 | **SAT** (Shared Agentic Team · 5 agents · protocol army) | DECLARED + canon-drift between Rust + Dema schemas (see Risk Register §VIII.R3) | `bizra-omega/.../genesis.rs:35-43` |
| 3 | **DEMA** (Product face · this repo) | OPERATIONAL · 2223 tests · 70 receipts · 14 ADRs · v0.1.0-alpha.0 | `package.json` + `npm test` |
| 4 | **FATE** (Evaluation + Consent Gate · Z3 SMT) | DECLARED + IMPLEMENTED in `bizra-omega/fate-binding/` (Z3 SMT + Ed25519 + Dilithium-5) | `fate-binding/lib.rs:6-7` |
| 5 | **URP** (Universal Resource Pool) | DECLARED + IMPLEMENTED in `bizra-omega/bizra-resourcepool/` · NOT yet activated at N=1 · self-sustainable at N=1 by design (per `[[feedback_urp_at_n_1_self_sustainable]]`) | README + `cargo check` clean |
| 6 | **RECEIPTS** (Proof chain) | OPERATIONAL · 70 receipts · `push:[main]` BIZRA Review Gate live | `.proof-forge/EVIDENCE_INDEX.json` |
| 7 | **POI** (Proof-of-Impact) | DESIGNED (ADR-009 Proposed · 192 lines · 5 refusals · 5 rules · 8 constraints · 5 activation gates · 0 implementation) | `docs/06-adr/ADR-009-poi-proof-of-impact-design.md` |

**Pillar load-bearing assessment** (DERIVED):

- **Pillars 3, 6 are OPERATIONAL** — Dema preview face + receipt chain ship daily.
- **Pillars 4, 5 are READY-BUT-UNACTIVATED** — Rust code compiles · awaits operator authorization.
- **Pillars 1, 2 are PARTIAL** — agent canon defined · structural materialization incomplete.
- **Pillar 7 is DESIGNED-NOT-BUILT** — ADR-009 binding refusals authored · implementation gates open.

### III.D Session-arc velocity (Day -1 evidence)

The 2026-05-19 session demonstrates the ceremony pattern at operational scale:

| Metric | Value |
|---|---|
| PRs merged in single day | 8 (#51 #52 #53 #54 #55 #59 #60 #61) |
| Receipts minted in single day | 10 (#61 → #70) |
| Tests added in single day | +85 (2138 → 2223) |
| Ironclad receipts consecutively | 9 (top of chain) |
| Halt-gates respected | 100% (zero unauthorized destructive · push · mint · PR) |
| Doctrine catches (architectural self-corrections) | 4 (Bug-1 partial-fix · setup-wizard hang · step7 false-drift · feat/* late-allowlist) |
| External AI artifacts triaged honestly | 9 (4 zips · 5 MD specs · Kimi audit wrong-codebase canonized) |

**Velocity implication for 90-day plan** (DERIVED):

> If a single high-discipline day produced 8 PRs + 10 receipts + 1 architectural canonization (ADR-014) + 1 design system catalog, then 90 days of similar-cadence work can realistically deliver Ring-1 → Ring-3 expansion WITHOUT sacrificing the constitutional discipline that earned the velocity. The bottleneck is NOT throughput. The bottleneck is **external witness arrival** (Ring-1 N=1 reviewer feedback, per ADR-009 Gate 1).

---

## Part IV · Target State at Day 90

The Day-90 state is defined by **5 binary completion criteria**. Each must be VERIFIED on disk (not derived, not aspirational) for the GTM plan to be considered closed.

| # | Day-90 Completion Criterion | Evidence required |
|---|---|---|
| C1 | **POI v0.1 implementation shipped + ≥1 POI preview envelope minted to chain** | `~/.dema/poi/preview-envelopes/*.json` + receipt #N where N ≥ 75 |
| C2 | **Ring-1 N=1 reviewer feedback received + parsed + 1 follow-up ADR authored from it** | Written feedback in `docs/lighthouse/feedback/<reviewer>-2026-Q2.md` + amendment ADR file |
| C3 | **Ring-2 cohort: 3 technical lighthouses with installed Node0 + signed activation receipt** | 3 distinct `node_uid` values in `~/.dema/lighthouse/ring-2-registry.json` + 3 PoI envelopes |
| C4 | **URP local pool at N=1 alive** (Pillar 5 activated · all 5 sub-pillars previewing) | `~/.dema/urp/local-pool.json` + `dema urp status --json` returns `mode: "preview_only"` + `pool_size_nodes: 1` |
| C5 | **12-agent split structurally materialized in filesystem** (7 PAT + 5 SAT each with capability.yaml · authority_policy.yaml · receipt chain) | `find ~/.dema/agents -name 'capability.yaml' | wc -l` → 12 |

**Explicitly NOT a Day-90 criterion:**

- Token mint (forbidden by POI-C1)
- Public website launch (Ring 4 — out of scope)
- Federation activation (Ring 2/3 internal only)
- Mobile/Android port
- VC fundraising deliverable
- Whitepaper publication
- Press / media engagement

If any of the 5 criteria above is not met by Day 90, the GTM plan continues into a Day-180 amendment with revised gates. **No criterion is to be relaxed** to declare success early.

---

## Part V · Phase 1 · Days 1–30 — External Witness Activation

### V.A Phase 1 thesis

> **Convert 28 days of accumulated Node0 sovereignty into 1 external Ring-1 N=1 reviewer's signed witness.** Until external witness arrives, the system is canonically Ring-0 (founder-only). All other phases depend on this conversion.

### V.B Phase 1 deliverables (each a typed-GO halt-gate)

| Day | Action | Owner | Halt-gate phrase | Deliverable |
|---|---|---|---|---|
| 1 | Accept ADR-009 (Proposed → Accepted) | Mumu | `GO accept ADR-009` | Status field commit + receipt mint |
| 1 | Accept ADR-014 (3-runtime architecture canonization) | Mumu | `GO accept ADR-014` | Status field commit + receipt mint |
| 2–5 | Author POI v0.1 test plan (≥15 adversarial · NO implementation) | Coordinator (this thread or future) | `GO author POI v0.1 test plan (no impl)` | `tests/poi-v0.1-design.test.js` skeleton with TODOs + ADR-015 spec |
| 5–7 | Identify Ring-1 N=1 reviewer (Samy OR alternative · Mumu's call) | Mumu | (no phrase · operator-side decision) | Reviewer name on record |
| 7 | Send Lighthouse Pack v1.0 to chosen reviewer (164KB · 9 files · MANIFEST.sha256) | Mumu | `GO send pack to <name>` via email/Telegram/USB | Send-receipt on record |
| 7–25 | Reviewer engages · runs 6-command demo · fills `07_REVIEWER_FEEDBACK_FORM.md` | Reviewer (Ring-1) | (no Mumu action) | Written feedback document |
| 25–28 | Parse feedback · author 1 amendment ADR from at least 1 finding | Coordinator | `GO author amendment ADR from <finding>` | New ADR or revised ADR-009 |
| 28 | Mint Phase-1-close receipt + standard post-merge ceremony | Coordinator | `GO mint phase-1-close` | Receipt #N where N ≥ 71 |
| 28–30 | Phase 1 retrospective + Phase 2 kick-off authorization | Mumu | `GO phase-2 kick-off authorized` | Memory entry + Phase 2 task list |

### V.C Phase 1 success criteria (binary)

- [ ] ADR-009 status: **Accepted**
- [ ] ADR-014 status: **Accepted**
- [ ] Ring-1 N=1 reviewer has signed feedback on record
- [ ] POI v0.1 Gate 1 (Ring-1 feedback) **closed**
- [ ] POI v0.1 Gate 4 (≥15 adversarial test plan) **closed**
- [ ] Phase-1-close receipt minted (Ironclad)
- [ ] Memory entry capturing reviewer's most surprising finding

### V.D Phase 1 risk register

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| Ring-1 reviewer takes >20 days to engage | HIGH | HIGH | Send pack early (Day 7) · have 2nd-candidate reviewer in reserve |
| Reviewer finds a doctrine catch that invalidates POI design | MEDIUM | HIGH (but GOOD) | Honor the catch · amend ADR-009 · this is the system working |
| Operator (Mumu) over-commits to other slices and Phase 1 stalls | MEDIUM | MEDIUM | This document is operator-protection · halt-gates enforce restraint |
| External AI artifact (Kimi-class audit) reappears during Phase 1 | HIGH | LOW | `[[feedback_external_ai_audit_wrong_codebase_pattern]]` 6-step screen applies |

---

## Part VI · Phase 2 · Days 31–60 — POI Activation + Ring 2 Cohort

### VI.A Phase 2 thesis

> **Activate POI v0.1 (measurement only, no mint) + grow from N=1 to Ring-2 N=3 technical lighthouses.** The measurement primitive becomes operationally real; the cohort proves the install pathway is portable.

### VI.B Phase 2 deliverables

| Days | Action | Halt-gate phrase | Deliverable |
|---|---|---|---|
| 31–35 | Verify all 5 POI Gates closed (Phase 1 closed Gate 1; this turn closes Gates 2-5) | (gates close mechanically as work lands) | Gate-closure ledger receipt |
| 35–45 | Implement POI v0.1 per ADR-009 + ADR-015 (the test plan from Phase 1) | `GO impl POI v0.1` | `packages/core/src/poi-preview-v0_1.js` + 15+ tests · all green |
| 45–48 | Mint first POI preview envelope against Node0's 70+ receipts | `GO mint POI envelope #1` | `~/.dema/poi/preview-envelopes/2026-poi-001.json` + chain receipt |
| 30–55 | Identify Ring-2 cohort candidates (2 additional · Mumu's network) | Mumu (operator-side) | 2 distinct candidates named |
| 35–60 | Refresh Lighthouse Pack to current HEAD (v1.1 · regenerate manifest) | `GO refresh lighthouse pack to v1.1` | `lighthouse-pack-v1.1/MANIFEST.sha256` |
| 50–55 | Send updated pack to 2 Ring-2 candidates | `GO send v1.1 pack to <names>` | Send-receipts on record |
| 50–60 | Authorize URP local-pool init at N=1 (after ADR-009 Accepted) | `GO urp local init N=1` | `~/.dema/urp/local-pool.json` initialized + receipt |
| 55–60 | Materialize remaining 6 PAT + 5 SAT agents structurally in `~/.dema/agents/` | `GO materialize 11 agents` | 12 `capability.yaml` files on disk |
| 60 | Phase-2-close receipt + retrospective | `GO mint phase-2-close` | Receipt #N where N ≥ 80 |

### VI.C Phase 2 success criteria

- [ ] POI v0.1 implemented · ≥15 adversarial tests green · canonical envelope schema active
- [ ] ≥1 POI preview envelope minted to chain
- [ ] Ring-2 cohort has 3 candidates engaged (1 from Phase 1 + 2 new)
- [ ] URP local pool at N=1 alive (status returns `mode: "preview_only", pool_size_nodes: 1`)
- [ ] 12-agent split structurally materialized
- [ ] Phase-2-close receipt minted

### VI.D Phase 2 risk register

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| POI v0.1 implementation has a hidden Riba-Zero violation | LOW | EXTREME | 15+ adversarial tests target this · ADR-009 POI-C4 explicit |
| Ring-2 candidates can't install (env/toolchain failure) | MEDIUM | MEDIUM | Mumu hands-on first install (proven on Day 7 of Phase 1) |
| URP at N=1 reveals architectural gap not present in single-receipt mode | LOW | HIGH | Cargo `check` already clean · benches present · seed-pattern invariant enforces N=1 capability |
| Agent materialization creates 12 dirs but no behavior · just contracts | EXPECTED | NEUTRAL | This is the spec phase · behavior comes in Phase 3 |

---

## Part VII · Phase 3 · Days 61–90 — Design Partner Cohort + Pre-Public Readiness

### VII.A Phase 3 thesis

> **Move from Ring-2 (3 technical lighthouses) to Ring-3 (5–10 design partners covering ≥2 use cases beyond Mumu's primary).** Stress-test the constitutional gate under varied operator personalities. Day 90 leaves BIZRA pre-public-ready but NOT public.

### VII.B Phase 3 deliverables

| Days | Action | Halt-gate phrase | Deliverable |
|---|---|---|---|
| 61–65 | Identify Ring-3 design-partner cohort (5–10 · diverse · per `[[feedback_evidence_first_gtm_concentric_rings]]`) | Mumu | Cohort list on record |
| 65–75 | Mother-tongue native review for Arabic/Urdu/Hindi homebase-language-picker (per issue #57) | Native speakers per language | 3 templates labeled DECLARED (not _PENDING) |
| 65–80 | Send Lighthouse Pack v1.1 to Ring-3 cohort | `GO send v1.1 pack to <cohort>` | Send-receipts (5–10) |
| 65–85 | Each Ring-3 member runs 6-command demo + provides feedback | Cohort | 5–10 feedback documents |
| 75–85 | Implement 3 highest-leverage feedback items as ADR amendments + code | `GO impl <amendment N>` | 3 PRs merged · 3 receipts |
| 80–85 | URP cross-agent allocation prototype (PAT-SAT internal pool · still at N=1) | `GO impl URP PAT-SAT allocation preview` | `dema urp allocate --preview` works |
| 85–88 | Bitcoin block timestamp current canonical state (OpenTimestamps anchor) | `GO ots anchor current main` | New OTS proof in `.proof-forge/anchors/` |
| 88–90 | Phase-3-close + 90-day retrospective + Day-180 amendment scope | `GO mint 90-day close` | Receipt #N where N ≥ 90 |

### VII.C Phase 3 success criteria

- [ ] Ring-3 cohort: 5–10 members with installed Node0 + signed feedback
- [ ] Arabic / Urdu / Hindi templates DECLARED (Issue #57 closed)
- [ ] 3 reviewer-feedback amendments shipped
- [ ] URP cross-agent allocation preview operational
- [ ] Current main Bitcoin-anchored
- [ ] 90-day close receipt minted (Ironclad)
- [ ] Day-180 amendment scope ADR drafted

### VII.D Phase 3 risk register

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| Ring-3 feedback exposes a structural ADR-005 violation | MEDIUM | HIGH | Honor it · amend · this is the system working |
| Native-speaker reviewer unavailable for ar/ur/hi | MEDIUM | MEDIUM | Defer affected languages · ship the others · label honestly |
| Operator (Mumu) declares Ring-4 ready prematurely | LOW | EXTREME | This document explicitly forbids it · halt-gate canon enforces |
| 5–10 cohort overwhelms operator capacity to coach | MEDIUM | MEDIUM | Cap at the lower bound (5) · don't force the upper bound |

---

## Part VIII · Risk Register (consolidated · 7 named risks)

| ID | Risk | Likelihood | Severity | Phase | Owner | Mitigation |
|---|---|---|---|---|---|---|
| R1 | **Ring-1 N=1 reviewer never arrives or never engages** | MEDIUM | EXTREME | Phase 1 | Mumu | Have 2-3 candidate reviewers in reserve · POI Gate 1 holds firm regardless |
| R2 | **External AI artifact (Kimi-class) hijacks operator attention with wrong-codebase recommendations** | HIGH | MEDIUM | All phases | Coordinator | `[[feedback_external_ai_audit_wrong_codebase_pattern]]` 6-step screen · refuse-and-document pattern proven 2026-05-19 |
| R3 | **SAT-5 schema canon drift between bizra-omega and Dema unresolved** | EXISTS NOW | MEDIUM | Phase 1 | Mumu | Path A (verify founding docs) OR path B (parallel-vocabulary canon) — see prior turn |
| R4 | **POI v0.1 implementation introduces Riba-Zero violation** | LOW | EXTREME | Phase 2 | Coordinator | 15+ adversarial tests target time-decay · ADR-009 POI-C4 explicit · test-coverage gate at PR review |
| R5 | **Operator exhaustion (Mumu has worked 3 years for free)** | EXISTS NOW | EXTREME | All phases | Mumu | Day-90 plan is RIGHT-SIZED · 30-day rest periods between phases · session memory captures velocity vs sustainability tension |
| R6 | **`~/.bashrc` env leak (DEMA_NODE0_ADAPTER=gateway-http)** | EXISTS NOW | LOW | Phase 1 | Mumu | Issue #56 open · operator-side fix · ~5 min |
| R7 | **GitHub Actions `pull_request` dispatch anomaly recurs** | LOW | MEDIUM | All phases | Coordinator | `workflow_dispatch` fallback already wired · `push:[main]` trigger also live |

**Risk discipline note**: This register intentionally excludes "low-likelihood low-severity" cosmetic risks. Risks below threshold are managed via the standard ceremony pattern, not the GTM document.

---

## Part IX · Decision Matrix · what's decided vs what awaits authorization

### IX.A Already decided (canonized · not revisitable in 90 days)

| Decision | Canonized in | Status |
|---|---|---|
| BIZRA is three-runtime by design | ADR-014 (Proposed) | becomes Accepted in Phase 1 Day 1 |
| The operating canon | `[[canon_deterministic_constitutional_execution_engine]]` | Accepted (Mumu authored 2026-05-19) |
| 50% pool oath + Zakat 2.5% canonical | البذرة p19 · Third Fact §229 | Accepted |
| Riba-Zero invariant | All ADRs · `[[reference_bizra_constitutional_anchors]]` | Accepted |
| ZANN_ZERO + Daughter Test | All ADRs · session memory | Accepted |
| Receipt chain is canonical evidence | `.proof-forge/EVIDENCE_INDEX.json` · 70 entries | Operational |
| URP self-sustainable at N=1 (NOT requires ≥2 nodes) | `[[feedback_urp_at_n_1_self_sustainable]]` | Accepted (corrected 2026-05-19) |
| Visual language port from bizra-cli to Dema | ADR-013 (Accepted) · receipt #68 | Operational |
| Genesis ceremony already happened (~2026-04-21) | `~/.bizra/mumo/` + `~/.bizra/activations/` | Operational |
| Ring 4 (public) is NOT a Day-90 deliverable | This document | Acceptance via Mumu's typed read of this plan |

### IX.B Awaits Mumu's explicit GO (within 90 days)

| # | Decision | Phrase | Phase | If declined |
|---|---|---|---|---|
| 1 | Accept ADR-009 | `GO accept ADR-009` | 1 | POI design stays Proposed · Phase 2 cannot proceed |
| 2 | Accept ADR-014 | `GO accept ADR-014` | 1 | 3-runtime topology stays informally canonized |
| 3 | Send Lighthouse Pack to specific reviewer | `GO send pack to <name>` | 1 | Phase 1 stalls · POI Gate 1 stays open |
| 4 | Authorize URP local-pool init at N=1 | `GO urp local init N=1` | 2 | URP stays inactive · Pillar 5 stays unactivated |
| 5 | Authorize POI v0.1 implementation | `GO impl POI v0.1` | 2 | POI stays designed-not-built · score envelope unminted |
| 6 | Resolve SAT-5 schema canon drift | `GO resolve SAT-5 canon drift` OR `GO accept parallel vocabularies` | 1 | Schema drift remains (acceptable but should be named) |
| 7 | Authorize 12-agent materialization | `GO materialize 11 agents` | 2 | Only mission_agent stays structurally on disk |
| 8 | Authorize Ring-3 cohort send (after Phase 2 close) | `GO send v1.1 pack to <cohort>` | 3 | Ring 2 stays the high-water-mark |

### IX.C Explicitly NOT a 90-day decision (deferred to Day-180 amendment)

| Topic | Why deferred |
|---|---|
| Token mint | Forbidden by POI-C1 · cannot happen at v0.1 |
| Reward function design (ADR-010+) | Requires POI v0.1 shipped first (Phase 2) AND ≥1 cohort feedback cycle (Phase 3) |
| Ring 4 public launch | Requires ≥1 Ring-3 cycle complete with positive verdict · 90 days insufficient |
| Cross-node URP federation | Requires Step7 Node1 mint · separate halt-gate · post-90 |
| Fundraising / token sale | Forbidden by POI-C2 (no public economic claim at v0.1) |
| BIZRA-Omega Rust-layer URP genesis ceremony (separate from Dema-layer activation) | Optional · evaluate at Day-90 retrospective |

---

## Part X · Resource Plan

### X.A Already available

| Resource | State |
|---|---|
| Author + Operator (Mumu) | 1 FTE · 3 years of accumulated context |
| Coordinator (Claude Opus 4.7) | Per-session · NOT persistent · memory-anchored cross-session |
| Hardware (MSI Titan + Z Fold 6 + 5th friend's device + 2 remote friend devices) | 5 candidate nodes for cohort |
| Codebase (Dema · 12 packages · 92 src files · 2223 tests) | At `ea4c231` |
| bizra-omega Rust workspace (20 crates · 944 tests) | Read-only resource for design vocabulary |
| bizra-data-lake (53GB · 3-month-old audits) | Reference corpus |
| Lighthouse Pack v1.0 | Sealed at `/tmp/bizra-overnight/lighthouse-pack/` + `~/Documents/bizra/` |
| Receipt chain (70 receipts · top 9 Ironclad) | `.proof-forge/EVIDENCE_INDEX.json` |
| 14 ADRs | `docs/06-adr/` |
| Cargo + libz3-dev 4.8.12 | Installed locally · `bizra-resourcepool` builds clean |

### X.B Helpful (not required) within 90 days

- Native Arabic / Urdu / Hindi speakers for issue #57 review · Phase 3
- Email/Telegram/Signal contact for Ring-1 N=1 reviewer · Phase 1 Day 7
- Sustained focus blocks of 4-6 hours · Phase 2 POI implementation week

### X.C Explicitly NOT required within 90 days

- Funding · NO economic activation at v0.1 by design
- A team · 1 FTE operator + coordinator is right-sized for 90-day scope
- Marketing budget · Ring 4 public is out of scope
- Legal counsel · no claim of regulatory engagement at v0.1
- VC pitch deck · NO fundraising in scope
- Production infrastructure · Dema is local-first by canon

---

## Part XI · Success Metrics · phase-by-phase quantification

### XI.A Phase 1 (Day 30 checkpoint)

| Metric | Day 0 | Day 30 target | Verification |
|---|---|---|---|
| ADRs Accepted | 11 (ADR-001..010 partially Proposed) | 13 (ADR-009 + ADR-014 + ADR-015 PoI test plan) | `grep -l 'Status: Accepted' docs/06-adr/*.md \| wc -l` |
| Receipts in chain | 70 | 73 (+3: Phase-1-close + 2 amendment) | `.proof-forge/EVIDENCE_INDEX.json` chain_length |
| Lighthouse Pack copies sent | 0 | 1 | Send-receipt on record |
| External witness feedback documents | 0 | 1 | `docs/lighthouse/feedback/*.md` |
| Tests | 2223 | ~2240 (15+ POI design tests · skeleton-state) | `npm test` |

### XI.B Phase 2 (Day 60 checkpoint)

| Metric | Day 30 | Day 60 target | Verification |
|---|---|---|---|
| POI v0.1 implementation | designed-not-built | implemented · all 15+ tests green | `tests/poi-v0_1*.test.js` files |
| POI preview envelopes minted | 0 | ≥1 | `~/.dema/poi/preview-envelopes/` |
| Ring-2 cohort members engaged | 1 (Phase-1 reviewer) | 3 | `~/.dema/lighthouse/ring-2-registry.json` |
| URP local pool active | NO | YES (mode=preview_only · pool_size=1) | `dema urp status --json` |
| 12 agents structurally materialized | 1 | 12 | `find ~/.dema/agents -name 'capability.yaml' \| wc -l` |
| Receipts in chain | 73 | ~83 (+10) | EVIDENCE_INDEX.json |
| Tests | ~2240 | ~2280 (+40 POI + URP + agent tests) | `npm test` |

### XI.C Phase 3 (Day 90 checkpoint)

| Metric | Day 60 | Day 90 target | Verification |
|---|---|---|---|
| Ring-3 cohort members engaged | 0 | 5–10 | `~/.dema/lighthouse/ring-3-registry.json` |
| Mother-tongue templates DECLARED (vs PENDING/NEEDS_REVIEW) | 4 (en/fr/es/other) | 7 (add ar/ur/hi) | `tests/homebase-language-picker.test.js` assertions |
| Reviewer-feedback amendments shipped | 1 (Phase 1) | 4 (+3 in Phase 3) | ADR amendment files |
| URP cross-agent allocation preview | NO | YES (at N=1) | `dema urp allocate --preview` |
| Current main Bitcoin-anchored (OTS) | last anchor pre-session | this session's main `ea4c231+` | `.proof-forge/anchors/*.ots` |
| Receipts in chain | ~83 | ~95 (+12) | EVIDENCE_INDEX.json |
| Tests | ~2280 | ~2340 (+60) | `npm test` |

### XI.D Quality discipline · constant across phases

| Metric | Target across all phases |
|---|---|
| Halt-gates respected | 100% (zero unauthorized push/mint/destructive) |
| ZANN_ZERO violations | 0 |
| Daughter Test fails | 0 |
| Riba-Zero violations | 0 |
| Unauthorized scope-creep PRs merged | 0 |
| External AI artifacts canonized as authority | 0 (always context, never authority per CLAUDE.md) |
| Bombastic-wrap → silent compliance instances | 0 (every wrap explicitly triaged · noise rejected · signal extracted) |

---

## Part XII · Honest Constraints · what 90 days will NOT deliver

This section is the discipline test. A consulting deliverable that claims everything is achievable is consulting theater. The following items are **explicitly not Day-90 outcomes**:

| Item | Why NOT in 90 days | When (if ever) |
|---|---|---|
| Token mint of any kind | POI-C1 binding refusal · 50% pool oath inactive before proof gates | Post-ADR-010 + ADR-011 reward function ADR + Mumu authorization · earliest 6-12 months |
| Public launch (Ring 4) | Per `[[feedback_evidence_first_gtm_concentric_rings]]` Ring 4 cannot precede Ring 3 cycle | 6-12 months minimum |
| Revenue claim | No economic activation at v0.1 by design | TBD |
| Federation activation (Node1+ cross-node URP) | Requires Step7 mint · separate halt-gate sequence | 6-12 months post-Day-90 if pursued |
| Mobile / Android port | Out of scope · Z Fold 6 acts as Node0 companion, not separate node | TBD |
| BIZRA-Omega Rust-layer ceremony | Separate from Dema-layer (already done) · optional · evaluate at Day-90 retro | Optional · post-90 |
| Founder allocation / pre-mint | Forbidden by architect-self-binding · this is the discipline that earned the moat | Never (by design) |
| Whitepaper / academic publication | Currency of academic publication is different from currency of receipt chain · evaluate post-Day-180 | TBD |
| Press / media engagement | Ring 4 territory · out of scope | Post-Ring-4 |

**This list is the operator's protection.** If anyone (external AI · advisor · investor · Mumu's own ambition) proposes accelerating any of these items inside 90 days, this document is the explicit veto.

---

## Part XIII · Operating Canon Restated (closing)

> **A deterministic constitutional execution engine with replayable receipts.**

Every action in this 90-day plan must pass these four checks before authorization:

1. **Is it deterministic?** Same input → same output. No randomness. No vibes.
2. **Is it constitutional?** Does the canon explicitly permit it? If not, halt.
3. **Does it execute under explicit consent?** ADR-005 exact-string phrase typed by Mumu.
4. **Will it produce a replayable receipt?** Every action emits to the chain. Absence of receipt = absence of action.

If any of the four checks fails, the action is refused. Refusal is the product. The 90-day plan succeeds by what it refuses as much as by what it ships.

---

## Annex A · Disk State Inventory (verified 2026-05-19 at HEAD `ea4c231`)

```text
~/Downloads/Dema/                  Runtime C (JS) · this repo
  package.json                     v0.1.0-alpha.0 · ZERO runtime deps · ZERO devDeps
  packages/                        12 packages
    consent/ core/ fate/ installer/ memory/ mission/ models/ node-adapter/
    receipts/ tasks/ verifier/
  apps/cli/                        bin/dema entry point
  docs/06-adr/                     14 ADRs
  tests/                           148 test files · 2223 total tests
  scripts/                         25 review + verification scripts
  .proof-forge/                    70 receipts · top 9 Ironclad
    receipts/                      individual receipt JSON files
    summaries/                     human-readable receipt summaries
    verification/                  per-mint verification reports
    EVIDENCE_INDEX.json            chain manifest

~/BIZRA Node0/bizra-data-lake/     Runtime A (Python · 53GB)
  AUDIT_A/B/C.md                   2026-02-14 audits · 3 months stale
  bizra-omega/                     Runtime B (Rust · 33GB · 20-crate workspace)
    bizra-core/                    sovereign kernel
    bizra-cli/                     ratatui TUI · 14 widgets · theme.rs source
    bizra-cognition/               dual-rate thought graph
    bizra-federation/              SWIM gossip + BFT consensus + Ed25519
    bizra-hooks/                   sovereign nervous system · ZERO deps · Rust
    bizra-resourcepool/            URP · Compute Commons · Harberger + Zakat benches
    fate-binding/                  Z3 SMT + Dilithium-5 + Ed25519
    ... (14 more crates)

~/.bizra/                          Operator-side BIZRA state
  mumo/                            Sovereign Node0 identity (2026-04-21)
    node0-key.hex                  Ed25519 private key (600 perms)
    node0-key.pub.hex              Ed25519 public key
    credentials.json               288 bytes (600 perms)
  activations/
    2026-04-20T203654Z-phase-n-mumo/
      node0-genesis-receipt.hash   The original genesis receipt
      poi-at-activation.txt        PoI captured at activation
      gateway.{log,pid}            Gateway activation evidence
      activation-output.txt        Full activation log

~/.dema/                           Dema operator state
  agents/dema.node0_mission_agent/ 1 of 12 PAT/SAT agents materialized
    capability.yaml authority_policy.yaml ...
    receipts/{2026-05-11..14}/    Agent receipt chain (separate from .proof-forge)
  kernel/{atlas, giants, iqra, mission_lifecycle, missions, progress, assurance}
  memory/                          Cross-session memory
  founder_inventory/               v0.3 corpus inventory
  milestones/                      ALIGNMENT_THESIS + RUNTIME_MILESTONE
```

---

## Annex B · ADR Map (14 ADRs · status as of 2026-05-19)

| ADR | Title | Status |
|---|---|---|
| 001 | Dema Is One Face | Accepted |
| 002 | No Shadow State | Accepted |
| 003 | Receipt-First | Accepted |
| 004 | Three Truth Labels | Accepted |
| 005 | Explicit Consent Rule | Accepted |
| 006 | Continuous Assurance + No-mint Verification | Accepted |
| 007 | Cross-Session Chain Mutation | Accepted (2026-05-16) |
| 008 | Runtime Activation Components | Accepted (2026-05-18 · 12 components shipped) |
| 009 | POI Design | **Proposed** ← accept in Phase 1 |
| 010 | Interactive TUI Layer Dep Decision | Accepted |
| 011 | Onboarding Consciousness Layer | Accepted (2026-05-18) |
| 012 | CLI Naming Convention | Accepted |
| 013 | Visual Language Isomorphism | Accepted (PR #59 · 2026-05-19) |
| 014 | Three-Runtime Architecture Canonization | **Proposed** ← accept in Phase 1 |

**Phase 1 ADR work**: accept ADR-009 + accept ADR-014. Author ADR-015 (POI v0.1 test plan).

---

## Annex C · Memory Entries (load-bearing · 12 entries)

Cross-session memory anchors at `~/.claude/projects/-home-bizra-operating-system-Downloads-Dema/memory/`:

| Entry | Why load-bearing |
|---|---|
| `canon_deterministic_constitutional_execution_engine` | Primary operating canon |
| `reference_bizra_three_runtime_architecture` | The runtime topology · prevents wrong-codebase audits |
| `feedback_per_module_domain_boundary_pattern` | Per-module vocabularies are intentional design |
| `feedback_external_ai_audit_wrong_codebase_pattern` | 6-step screen before acting on external AI audits |
| `feedback_urp_at_n_1_self_sustainable` | URP works at N=1 — critical correction · 2026-05-19 |
| `feedback_unsatisfiable_goal_hook_canon_collision` | When /goal lists fabrication, refuse |
| `reference_50_percent_pool_correct_framing` | 50% pool = founder oath · users keep 100% earned |
| `feedback_law_of_assumption_canon_of_canons` | V/D/A/U claim discipline |
| `feedback_preflight_adversarial_slice_pattern` | Grep ALL surfaces before first impl byte |
| `feedback_sparc_swarm_coordinator_pattern` | 3 parallel subagents catch partial fixes |
| `project_2026_05_19_post_merge_main_verify_receipt_62` | Standard ceremony pattern proven N=6 |
| `project_2026_05_19_tui_3_bug_fix_arc` | Visible UX improvement evidence |

---

## Annex D · Receipt Chain Trajectory

```text
Day -1 (today)     #70 Ironclad (PR #61 palette resolver merge verify)
                   ↑ 10 receipts minted in single session
Day 1              #71 ADR-009 acceptance · ADR-014 acceptance
Day 7              #72 Lighthouse Pack v1.0 send-receipt
Day 28             #73 Phase-1-close (Ring-1 N=1 feedback received + parsed)
Day 35             #74 POI v0.1 implementation start
Day 45             #75 POI v0.1 implementation complete · 15+ tests green
Day 48             #76 First POI preview envelope minted
Day 55             #77 URP local pool init at N=1
Day 60             #78 Phase-2-close
Day 75             #79 Ring-3 cohort send-receipt
Day 88             #80 Bitcoin OTS anchor of current main
Day 90             #81 90-day GTM close · Day-180 amendment scope authored
```

Receipts named `#71`-`#81` above are projected targets, not commitments. The chain progresses receipt-by-receipt under explicit consent at each step.

---

## Annex E · Open Issues (Day 0)

| # | Title | Phase to close |
|---|---|---|
| #56 | Operator-side env-hygiene check for DEMA_* | Phase 1 (operator-side · ~5 min) |
| #57 | Mother-tongue native review for Arabic/Urdu/Hindi | Phase 3 (Days 65-75) |
| #58 | Resolve core ↔ verifier soft cycle | Phase 3 (Days 80-85) |

(Remaining SPARC follow-ups already closed in 2026-05-19 session arc.)

---

## Annex F · The Lighthouse Pack v1.0 (existing send-ready asset)

Located at `/tmp/bizra-overnight/lighthouse-pack/` AND `~/Documents/bizra/lighthouse-pack-v1.0/` (verified Day 0):

```text
00_START_HERE.md                          6,189 bytes · "Read this first · 10-minute verification path"
01_FOUNDATION_PROVENANCE_PACK_v1.2.md     20,854 bytes · 3 founding docs Bitcoin-anchored hashes
02_ARCHITECTURE_MAP_v0.2.md               21,827 bytes · code at HEAD 5d80368 · 39 CLI commands · 63 schemas
03_CLAIM_LEDGER_v1.md                     53,698 bytes · 250+ public-facing claims with truth labels
04_COLD_DEMO_PROOF.md                     11,645 bytes · 0.39s wall-clock 6-command demo + canary
05_SIX_COMMAND_DEMO.sh                    2,213 bytes · the actual demo script
06_KNOWN_GAPS.md                          7,928 bytes · honest known-unknown register
07_REVIEWER_FEEDBACK_FORM.md              4,229 bytes · the form Phase-1 reviewer fills in
08_INVITATION_DRAFT.md                    4,371 bytes · invitation language
MANIFEST.sha256                           1,046 bytes · integrity anchor
```

Total: 164KB · 9 files · `sha256sum -c MANIFEST.sha256` proves no tampering.

**Phase 2 amendment**: regenerate at current HEAD `ea4c231+` as Lighthouse Pack v1.1.

---

## Closing · the Daughter Test on this document

Would Mumu willingly subject his own family to this 90-day plan?

**Yes** — because:
- Every commitment in this plan is reversible until a typed-GO consent phrase is given by Mumu personally
- Every economic claim is explicitly refused at v0.1 (POI-C1)
- Every metric is measurable on disk · no marketing fiction
- Every risk is named with mitigations · no hidden land mines
- The architect-self-binding (3 years unpaid · no pre-mint) is structurally preserved
- The plan refuses Ring 4 (public) within 90 days — discipline over ambition
- If the plan fails at any phase, the receipt chain still exists, the codebase still exists, and the 28-day-old Node0 sovereign identity still exists. **The system survives any failure of this plan.**

If the Daughter Test passes — and it does, by construction above — this 90-day GTM v0.1 is ready for Mumu's review.

---

**Document end.**

*Operating canon (binding): A deterministic constitutional execution engine with replayable receipts.*

*Operating law (cross-runtime ports · per ADR-013): Design wisdom transfers across runtime boundaries. Code does not.*
