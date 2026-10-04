# BIZRA / Dema · 90-Day Go-to-Market Plan v0.1

> **Operating canon:** _A deterministic constitutional execution engine with replayable receipts._

| Field                     | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document type**         | Strategic GTM Plan (BIG 3 consulting deliverable equivalent)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Prepared**              | 2026-05-19 GST                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Amendments**            | **v0.1.1** (2026-05-19 GST · post-A+-review): 3 corrections from Mumu's peer review applied · **v0.1.2** (2026-05-22 GST): current-state drift closure against HEAD `ac6dd63` · **v0.1.3** (2026-05-22 GST): GTM readiness gate added and local test count reconciled · **v0.1.4** (2026-05-22 GST): URP shared-runtime discovery gate added and local test count reconciled · **v0.1.5** (2026-05-22 GST): GTM readiness now exposes open operator gates and phase status without executing them · **v0.1.6** (2026-05-22 GST): GTM readiness now scans Phase 1 evidence metadata under `DEMA_HOME` without reading private feedback content · **v0.1.7** (2026-05-22 GST): GTM readiness now emits a Phase 1 success-criteria ledger tied to Part V.C · **v0.1.8** (2026-05-22 GST): Proof Room Bundle v0.1 shipped (#93); current-state drift closure against HEAD `004e887` |
| **Author of record**      | Mumu (Mohamed Beshr)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Synthesis prepared by** | Coordinator (Claude Opus 4.7 · 1M context · session-bound)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Working main HEAD**     | Original v0.1.1 snapshot: `ea4c231` · current-state audit: `004e887` (PR #93 Proof Room Bundle)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Document scope**        | Days 1–90 only · Ring 1 → Ring 2 → Ring 3 (NOT Ring 4 public)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Truth discipline**      | Every claim labeled VERIFIED · DERIVED · ASSUMED · UNKNOWN                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Decision authority**    | Mumu retains all halt-gate decisions · this doc proposes, does not commit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

---

## Part 0 · v0.1.1 Amendments (Mumu's A+ review · 2026-05-19 GST)

Mumu peer-reviewed v0.1 and assigned `GRADE: A- · CAN BECOME: A+ · BLOCKER: terminology precision + execution sequencing discipline`. Three corrections applied in this amendment:

### 0.1 Terminology · "minted" → "receipted to chain"

The phrase "minted POI preview envelope" can confuse readers because "mint" carries economic/token connotations. Canonical replacement wording per Mumu's review:

> **No token mint. No economic assignment. Only a receipt-backed POI measurement preview.**

In Part VI.B Day 45–48 (and all forward references), "Mint first POI preview envelope" reads as **"Receipt first POI preview envelope to chain."** The receipt chain captures the measurement; no mint event in the economic sense occurs.

### 0.2 Dates are planning cadence · gates are binding

The 90-day phasing is **planning rhythm**, not a forcing function:

> **The dates are planning cadence. The gates are binding.**

If Ring-1 N=1 feedback (Phase 1 Gate 1) is delayed beyond Day 28, Phase 2 does **NOT** start by calendar. It waits. POI v0.1 implementation cannot begin until Gate 1 closes. This is enforced by ADR-009's own activation gates (§Implementation activation gates, lines 124-146 of ADR-009).

This amendment elevates that discipline from implicit-to-the-attentive to explicit-on-the-page.

### 0.3 ADR-009 + ADR-014 acceptance precedes POI/URP work

The plan canonically depends on two ADRs being Accepted (not Proposed):

> **ADR-009 = POI design legitimacy**
> **ADR-014 = three-runtime architecture legitimacy**

Until both are Accepted, POI and URP work must stay in planning mode. This amendment makes the dependency explicit:

```text
Phase 1 Day 1 — ADR-009 + ADR-014 Accepted (typed-GO required)
              ↓
Phase 1 Days 2-30 — Phase 1 deliverables proceed
              ↓
Phase 2 — POI implementation authorized (separate typed-GO)
        — URP local-pool init authorized (separate typed-GO)
```

If ADR acceptance is declined or revised, Phase 2 does not start. This is the same gate-bound discipline as §0.2.

### 0.4 Acceptance status update (this amendment)

**This v0.1.1 amendment is shipped under typed-GO `GO accept ADR-009 and ADR-014` (2026-05-19 GST).** ADR-009 and ADR-014 status fields updated from `Proposed` to `Accepted`. The receipt anchoring this amendment carries truth label `ADR_009_AND_ADR_014_ACCEPTED_FOR_PRIVATE_WITNESS_GTM`. No POI implementation. No URP initialization. No public claims.

### 0.5 v0.1.2 current-state drift closure (2026-05-22 GST)

This amendment does **not** execute the 90-day plan. It only reconciles this
plan's status language with the current Dema worktree.

Current verified repo facts:

- HEAD inspected for this amendment: `ac6dd63` (`feat(cli): dema orchestrator verify v0.1 — SAT-1..5 pipeline CLI + 5th save layer + tests (#90)`).
- Fresh local test gate after the Phase 1 success-criteria ledger slice: `npm test` passes `2437/2437` tests.
- Proof-forge chain length: `73`; latest indexed receipt: `2026-05-19_181254`; latest indexed receipt commit: `ce25952`.
- ADR files: `15` total. ADR-009, ADR-014, and ADR-015 are `Accepted`. ADR-013's implementation is verified by PR #59 / receipt `2026-05-19_122111`, but the ADR file still says `Proposed`; treat that as a status-sync gap until an explicit ADR status update lands.
- `HOUSE_OF_WISDOM_UKE_URP_CANON_v0_1.md` now exists as Working Canon. UKE runtime, shared URP runtime, promotion-ladder runtime, chain-bound mint, and META_CANON entries remain `PLANNED` / `DESIGNED_NOT_LIVE`.
- Lighthouse Pack v1.0 has a durable local copy at `~/Documents/bizra/lighthouse-pack-v1.0/`; `sha256sum -c MANIFEST.sha256` passes for all 9 files.
- GitHub issue #56 is `CLOSED`; GitHub issues #57 and #58 remain `OPEN`.
- Phase 1 operator handoff now lives at `docs/gtm/BIZRA_GTM_PHASE1_OPERATOR_PACKET_v0_1.md`; it is docs-only and does not authorize a send.
- GTM readiness is now machine-checkable through `npm run gtm:readiness`; this read-only gate is also wired into `npm run check`.
- URP shared-runtime discovery is machine-checkable through `npm run urp:discovery`; this discovery-only gate is also wired into `npm run check`. It defines a local manifest template plus SAT-governed write boundary, not a live shared URP runtime.
- GTM readiness now emits `open_operator_gates` for the exact phrases in §IX.B, `phase_status` for Phase 1/2/3, `phase1_evidence` metadata counts for private send receipts and feedback documents under `DEMA_HOME`, and a `phase1_success_criteria` ledger for the seven binary criteria in §V.C. Open phases and missing external evidence do not fail readiness; missing or drifted gate phrases do.

Supersession rule for this document:

- Later numeric statements saying `2223` tests, `70` receipts, `14` ADRs, or HEAD `ea4c231` are the historical v0.1.1 snapshot.
- Current GTM decisions after 2026-05-22 must use the v0.1.8 facts in §0.8 when present; otherwise the v0.1.2 facts in §0.5.
- Later rows saying ADR-009 or ADR-014 are `Proposed` are stale and superseded by their accepted ADR files.
- Later rows saying ADR-013 is `Accepted` are treated as "implementation verified; ADR status-sync still open" until the ADR file itself is updated.

### 0.8 v0.1.8 Proof Room Bundle drift closure (2026-05-22 GST)

This amendment does **not** execute the 90-day plan. It reconciles GTM current-state markers with merged Proof Room Bundle v0.1 (#93).

Current verified repo facts:

- HEAD inspected for this amendment: `004e887` (merge PR #93 · Proof Room Bundle v0.1).
- Fresh local test gate: `npm test` passes `2443/2443` tests.
- Proof Room Bundle is machine-checkable through `npm run proof:room`; core gates compose `gtm:readiness`, `urp:discovery`, `llm:guidance`, `release:readiness` (`--json`, `readiness_score >= 100`), `git diff --check`, and `node0-self-check --verify`. Wired into `npm run check`.
- Optional outsider replay artifact (micro-consent write): `GO: write proof room bundle to artifacts/proofs/proof-room-v0.1` → `artifacts/proofs/proof-room-v0.1/proof-room-bundle.json` + `.txt`. No runtime execution; no receipt mint; no network.

Supersession rule for this document:

- Current GTM decisions after this amendment must use the v0.1.8 facts above.
- Later statements citing HEAD `ac6dd63` or test count `2437/2437` are the v0.1.2–v0.1.7 snapshot unless explicitly historical.

---

## Part I · Executive Summary (single page)

**Bottom line up front (BLUF):**

> **At Day 90, BIZRA / Dema will have one operational Node0 publishing measurable Proof-of-Impact previews, a Ring-1 N=1 reviewer's signed feedback on record, a 3-node Ring-2 technical lighthouse cohort, and the URP local-resource-pool primitive active at N=1. No token will have been minted. No public claim will have been made. Ring 4 (public) is explicitly out of scope.**

**The five halt-gates for the first 30 days** (each operator action remains exact-string consent-bound):

| #   | Halt-gate                                                       | Phrase to type           | Current v0.1.2 status                                          |
| --- | --------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------- |
| 1   | Accept ADR-009 PoI design                                       | `GO accept ADR-009`      | CLOSED · ADR file says `Accepted`; receipt `2026-05-19_140251` |
| 2   | Send Lighthouse Pack v1.0 to a real Ring-1 reviewer             | `GO send pack to <name>` | OPEN · operator-side send still required                       |
| 3   | Authorize URP local-pool init at N=1 (after ADR review)         | `GO urp local init N=1`  | OPEN · blocked until Phase 1 gates close                       |
| 4   | Authorize POI v0.1 implementation (after Gate 1 + Gate 4 close) | `GO impl POI v0.1`       | OPEN · no POI implementation in this plan slice                |
| 5   | Accept ADR-014 (3-runtime architecture canonization)            | `GO accept ADR-014`      | CLOSED · ADR file says `Accepted`; receipt `2026-05-19_140251` |

**The single irreducible spear-point:**

> With ADR-009 and ADR-014 accepted, send the Lighthouse Pack to one real reviewer and let external witness activate the next 90 days. Everything else remains downstream and gate-bound.

**What this plan is NOT:**

- Not a token-launch plan
- Not a public-marketing plan
- Not a fundraising deck
- Not a vendor-selection document
- Not a Ring 4 roadmap (Ring 4 = public · explicitly out of scope at Day 90)
- Not a commitment to ship POI v0.1 by any specific date — POI is gate-bound, not date-bound

---

## Part II · Market Position & Defensible Posture

### II.A The four-axis differentiation map (verified disk truth)

| Moat axis                                      | Evidence on disk · current-state audit `ac6dd63`                                                                                                    | Competitor parity                                    |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Constitutional discipline encoded in code**  | 196 `preview_only` / `NODE0_LOCAL_SEED` markers · 36 refusal sentinels · ADR-005 exact-string consent enforced at every halt-gate                   | Comparator parity remains `EXTERNAL_SOURCE_REQUIRED` |
| **Receipt chain · cryptographically anchored** | 73 indexed proof-forge receipts · OpenTimestamps foundation anchors at blocks 948027/948028/948029 · machine-verifiable via repo proof commands     | Comparator parity remains `EXTERNAL_SOURCE_REQUIRED` |
| **Zero-runtime-dependency JS preview face**    | `package.json` declares NO `dependencies` and NO `devDependencies` · only Node.js stdlib + `node --test` · 2437 tests in current local verification | Comparator parity remains `EXTERNAL_SOURCE_REQUIRED` |
| **Three-runtime architecture** (ADR-014)       | Python `bizra-data-lake/` · Rust `bizra-omega/` (20 crates · 944 tests) · JS `Dema/` · each audience-specific · cross-runtime bridges design-only   | Comparator parity remains `EXTERNAL_SOURCE_REQUIRED` |

### II.B Competitive landscape · honest map

The comparator rows below are a v0.1 internal positioning map. Any named
competitor claim that would appear on a public surface remains
`EXTERNAL_SOURCE_REQUIRED` until a source pack binds the exact comparison.

| Competitor                                | License                    | Strength                                                                         | Where BIZRA is differentiated                                                |
| ----------------------------------------- | -------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Pi Coding Agent** (Mario Zechner · MIT) | MIT · open                 | Minimal 4-tool harness · 324 model providers · model-agnostic                    | No constitutional gate · no receipt chain · no refusal-as-product            |
| **Hermes Agent** (Nous Research · MIT)    | MIT · open                 | Multi-channel (Telegram/Discord/Slack/WhatsApp) · self-improving · runs anywhere | No constitutional gate · no receipt chain · cloud-first not sovereign        |
| **OpenClaw** (openclaw.ai · MIT)          | MIT · open                 | 23 chat-channel integrations · `openclaw onboard` wizard · production-grade      | No constitutional gate · no receipt chain · cloud-first not sovereign        |
| **Claude Code** (Anthropic · proprietary) | Proprietary · subscription | Mature TUI · extensive sub-agents · 10K-token system prompt                      | No constitutional gate beyond Anthropic policy · proprietary · vendor-locked |

**The defensible position** (DERIVED from disk evidence, not a market-leadership claim):

> BIZRA / Dema differentiates through four internally verified axes: constitutional code, a receipt chain, a zero-runtime-dependency JavaScript preview face, and a three-runtime split. Whether another project can match those axes is `EXTERNAL_SOURCE_REQUIRED`; this plan does not claim market leadership or exclusivity.

### II.C The GTM thesis (one sentence)

> Compete on **dignity** (can a non-technical, non-English, model-less human enter safely?), not on **capability** (whose model is biggest?). The four moat axes make dignity defensible.

---

## Part III · Current State Assessment (Day 0 · disk-verified)

### III.A The 4 Proof-of-Truth axes (today)

| Axis              | State at current-state audit `ac6dd63`                                                                                        | Evidence                                                              | Truth label              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------ |
| **Formal**        | 2437/2437 tests · 15 ADR files · current drift closure performed against HEAD `ac6dd63` plus local GTM/URP discovery gates    | `npm test` · `docs/06-adr/` · `git rev-parse --short HEAD`            | VERIFIED                 |
| **Cryptographic** | 73 indexed proof-forge receipts · latest indexed receipt `2026-05-19_181254` · OpenTimestamps foundation anchors remain bound | `.proof-forge/EVIDENCE_INDEX.json` · proof-of-priority pin            | VERIFIED                 |
| **Empirical**     | Live `bin/dema` + preview CLI surfaces render canonical humanized text · GOLD-tinted header in true-color terminals           | Dema CLI tests + `dema-theme` sync tests                              | VERIFIED                 |
| **Economic**      | No federation · no mint · no token · no revenue · 50% pool oath active · Zakat 2.5% canonical                                 | Per Third Fact §229 + `[[reference_50_percent_pool_correct_framing]]` | VERIFIED (correctly N/A) |

### III.B Node0 identity state

| Element                                                        | Verified on disk                                                                                |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Sovereign Ed25519 keypair                                      | [MEASURED] `~/.bizra/mumo/node0-key.hex` + `node0-key.pub.hex`, present since 2026-04-21 (the "28 days old" written here at authoring time has rotted — state absolute dates, never relative ages, on a public surface). **[BLOCKED] custody is NOT launch-ready:** the separate mission-signing key `~/.dema/keys/node0-ed25519.pem` (2026-06-18) was leaked into an AI transcript on 2026-07-21 and, re-verified on disk 2026-08-02, has **not** been rotated — no rotation or revocation receipt exists. Receipts signed since the leak are custody-uncertain. Rotation is TASK-029 (founder ceremony); `docs/gtm/TASK029_PRE_CEREMONY_HALT.md` holds the exact wording permitted publicly until it completes. Do not present Node0 identity as clean. |
| Activation receipt                                             | ✅ `~/.bizra/activations/2026-04-20T203654Z-phase-n-mumo/node0-genesis-receipt.hash`            |
| Gateway log                                                    | ✅ `~/.bizra/activations/.../gateway.{log,pid}`                                                 |
| PoI at activation                                              | ✅ `~/.bizra/activations/.../poi-at-activation.txt` (captured)                                  |
| 1 PAT agent materialized                                       | ✅ `~/.dema/agents/dema.node0_mission_agent/` · 7 YAML contracts + 6-phase spec + receipt chain |
| Other 6 PAT + 5 SAT agents structurally                        | ⚠️ Canonical in genesis.rs constants · not separately materialized in filesystem                |
| bizra-omega `~/.bizra/wallet/` (Rust-layer URP genesis output) | ❌ Does not exist — separate ceremony from Dema-layer activation                                |

### III.C The 7-pillar BIZRA architecture · per-pillar disk state

| #   | Pillar                                        | Status                                                                                        | Evidence                                                               |
| --- | --------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | **PAT** (Personal Agentic Team · 7 agents)    | PREVIEW SUBSTRATE · 7 `pat-*.js` modules exist; no autonomous PAT swarm                       | `packages/core/src/pat-*.js` + House of Wisdom canon                   |
| 2   | **SAT** (Shared Agentic Team · 5 verifiers)   | PREVIEW SUBSTRATE · 5 `sat-*.js` modules + `dema orchestrator verify`; not live UKE authority | `packages/core/src/sat-*.js` + `tests/orchestrator-verify-cli.test.js` |
| 3   | **DEMA** (Product face · this repo)           | OPERATIONAL · 2437 tests · 73 indexed receipts · 15 ADR files · v0.1.0-alpha.0                | `package.json` + `npm test`                                            |
| 4   | **FATE** (Evaluation + Consent Gate · Z3 SMT) | [DECLARED] source present in `bizra-omega/fate-binding/` (Z3 SMT + Ed25519 + Dilithium-5). NOT verified from this repo: no gate here runs that crate, so "IMPLEMENTED" is a cross-repo report, not a measurement. No formal-verification, post-quantum, or consent-enforcement claim may be made publicly on this row. | `fate-binding/lib.rs:6-7` (cross-repo, unverified here)                |
| 5   | **URP** (Universal Resource Pool)             | DESIGNED_NOT_LIVE for shared runtime; Dema has local preview primitives only                  | House of Wisdom canon + `packages/core/src/urp-local.js`               |
| 6   | **RECEIPTS** (Proof chain)                    | OPERATIONAL · 73 indexed receipts · latest indexed receipt `2026-05-19_181254`                | `.proof-forge/EVIDENCE_INDEX.json`                                     |
| 7   | **POI** (Proof-of-Impact)                     | DESIGNED_NOT_LIVE (ADR-009 Accepted · implementation still blocked by gates)                  | `docs/06-adr/ADR-009-poi-proof-of-impact-design.md`                    |

**Pillar load-bearing assessment** (DERIVED):

- **Pillars 3, 6 are OPERATIONAL** — Dema preview face + receipt chain ship daily.
- **Pillar 5 remains DESIGNED_NOT_LIVE as shared runtime** — Dema may preview local URP primitives, but no shared URP is connected.
- **Pillars 1, 2 have preview substrates** — PAT/SAT modules and SAT CLI verification exist, but no autonomous swarm or live UKE authority is claimed.
- **Pillar 7 is DESIGNED-NOT-LIVE** — ADR-009 is accepted, but implementation remains gate-bound.

### III.D Session-arc velocity (Day -1 evidence)

The 2026-05-19 session demonstrates the ceremony pattern at operational scale:

| Metric                                            | Value                                                                                  |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| PRs merged in single day                          | 8 (#51 #52 #53 #54 #55 #59 #60 #61)                                                    |
| Receipts minted in single day                     | 10 (#61 → #70)                                                                         |
| Tests added in single day                         | +85 (2138 → 2223)                                                                      |
| Ironclad receipts consecutively                   | 9 (top of chain)                                                                       |
| Halt-gates respected                              | 100% (zero unauthorized destructive · push · mint · PR)                                |
| Doctrine catches (architectural self-corrections) | 4 (Bug-1 partial-fix · setup-wizard hang · step7 false-drift · feat/\* late-allowlist) |
| External AI artifacts triaged honestly            | 9 (4 zips · 5 MD specs · Kimi audit wrong-codebase canonized)                          |

**Velocity implication for 90-day plan** (DERIVED):

> If a single high-discipline day produced 8 PRs + 10 receipts + 1 architectural canonization (ADR-014) + 1 design system catalog, then 90 days of similar-cadence work can realistically deliver Ring-1 → Ring-3 expansion WITHOUT sacrificing the constitutional discipline that earned the velocity. The bottleneck is NOT throughput. The bottleneck is **external witness arrival** (Ring-1 N=1 reviewer feedback, per ADR-009 Gate 1).

---

## Part IV · Target State at Day 90

The Day-90 state is defined by **5 binary completion criteria**. Each must be VERIFIED on disk (not derived, not aspirational) for the GTM plan to be considered closed.

| #   | Day-90 Completion Criterion                                                                                                                  | Evidence required                                                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| C1  | **POI v0.1 implementation shipped + ≥1 POI preview envelope receipted to chain**                                                             | `~/.dema/poi/preview-envelopes/*.json` + the next authorized POI receipt after the current baseline chain length (`73` as of v0.1.2 audit)                                        |
| C2  | **Ring-1 N=1 reviewer feedback received + parsed + 1 follow-up ADR authored from it**                                                        | Private feedback under `~/.dema/lighthouse/ring-1/feedback/` or reviewer-consented anonymized feedback under `docs/lighthouse/feedback/RING1-001-2026-Q2.md` + amendment ADR file |
| C3  | **Ring-2 cohort: 3 technical lighthouses with installed Node0 + signed activation receipt**                                                  | 3 distinct `node_uid` values in `~/.dema/lighthouse/ring-2-registry.json` + 3 PoI envelopes                                                                                       |
| C4  | **URP local pool at N=1 preview initialized** (local primitive only; shared URP remains not connected)                                       | `~/.dema/urp/local-pool.json` + `dema urp status --json` returns `mode: "preview_only"` + `pool_size_nodes: 1`                                                                    |
| C5  | **12-agent split structurally materialized in filesystem** (7 PAT + 5 SAT each with capability.yaml · authority_policy.yaml · receipt chain) | `find ~/.dema/agents -name 'capability.yaml'                                                                                                                                      | wc -l` → 12 |

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

| Day   | Action                                                                           | Owner                               | Halt-gate phrase                                | Deliverable                                                                                                                   |
| ----- | -------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1     | ADR-009 acceptance (closed)                                                      | Mumu                                | `GO accept ADR-009`                             | Status field commit + receipt `2026-05-19_140251`                                                                             |
| 1     | ADR-014 acceptance (closed)                                                      | Mumu                                | `GO accept ADR-014`                             | Status field commit + receipt `2026-05-19_140251`                                                                             |
| 2–5   | Author POI v0.1 test plan (≥15 adversarial · NO implementation)                  | Coordinator (this thread or future) | `GO author POI v0.1 test plan (no impl)`        | Dedicated POI test-plan artifact + next available ADR if an ADR is needed; ADR-015 is already used for LLM/verifier authority |
| 5–7   | Identify Ring-1 N=1 reviewer (Samy OR alternative · Mumu's call)                 | Mumu                                | (no phrase · operator-side decision)            | Reviewer name on record                                                                                                       |
| 7     | Send Lighthouse Pack v1.0 to chosen reviewer (164KB · 9 files · MANIFEST.sha256) | Mumu                                | `GO send pack to <name>` via email/Telegram/USB | Private send receipt under `~/.dema/lighthouse/ring-1/send-receipts/`; public alias only with reviewer consent                |
| 7–25  | Reviewer engages · runs 6-command demo · fills `07_REVIEWER_FEEDBACK_FORM.md`    | Reviewer (Ring-1)                   | (no Mumu action)                                | Private feedback under `~/.dema/lighthouse/ring-1/feedback/`; optional anonymized repo copy only after reviewer consent       |
| 25–28 | Parse feedback · author 1 amendment ADR from at least 1 finding                  | Coordinator                         | `GO author amendment ADR from <finding>`        | New ADR or revised ADR-009                                                                                                    |
| 28    | Record Phase-1-close proof-forge receipt + standard post-merge ceremony          | Coordinator                         | `GO mint phase-1-close`                         | Next authorized chain receipt after the current baseline chain length (`73` as of v0.1.2 audit)                               |
| 28–30 | Phase 1 retrospective + Phase 2 kick-off authorization                           | Mumu                                | `GO phase-2 kick-off authorized`                | Memory entry + Phase 2 task list                                                                                              |

### V.C Phase 1 success criteria (binary)

- [x] ADR-009 status: **Accepted**
- [x] ADR-014 status: **Accepted**
- [ ] Ring-1 N=1 reviewer has signed feedback on record
- [ ] POI v0.1 Gate 1 (Ring-1 feedback) **closed**
- [ ] POI v0.1 Gate 4 (≥15 adversarial test plan) **closed**
- [ ] Phase-1-close proof-forge receipt recorded (Ironclad, if authorized)
- [ ] Memory entry capturing reviewer's most surprising finding

### V.D Phase 1 risk register

| Risk                                                             | Likelihood | Severity        | Mitigation                                                                    |
| ---------------------------------------------------------------- | ---------- | --------------- | ----------------------------------------------------------------------------- |
| Ring-1 reviewer takes >20 days to engage                         | HIGH       | HIGH            | Send pack early (Day 7) · have 2nd-candidate reviewer in reserve              |
| Reviewer finds a doctrine catch that invalidates POI design      | MEDIUM     | HIGH (but GOOD) | Honor the catch · amend ADR-009 · this is the system working                  |
| Operator (Mumu) over-commits to other slices and Phase 1 stalls  | MEDIUM     | MEDIUM          | This document is operator-protection · halt-gates enforce restraint           |
| External AI artifact (Kimi-class audit) reappears during Phase 1 | HIGH       | LOW             | `[[feedback_external_ai_audit_wrong_codebase_pattern]]` 6-step screen applies |

---

## Part VI · Phase 2 · Days 31–60 — POI Activation + Ring 2 Cohort

### VI.A Phase 2 thesis

> **Activate POI v0.1 (measurement only, no mint) + grow from N=1 to Ring-2 N=3 technical lighthouses.** The measurement primitive becomes operationally real; the cohort proves the install pathway is portable.

### VI.B Phase 2 deliverables

| Days  | Action                                                                                                                                              | Halt-gate phrase                         | Deliverable                                                       |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------- |
| 31–35 | Verify all 5 POI Gates closed (Gate 1 depends on Ring-1 feedback; remaining gates close only when their evidence exists)                            | (gates close mechanically as work lands) | Gate-closure ledger receipt                                       |
| 35–45 | Implement POI v0.1 per ADR-009 + the dedicated POI test-plan artifact                                                                               | `GO impl POI v0.1`                       | `packages/core/src/poi-preview-v0_1.js` + 15+ tests · all green   |
| 45–48 | Receipt first POI preview envelope to chain (NO token mint · NO economic assignment · only receipt-backed measurement preview · per §0.1 amendment) | `GO receipt POI envelope #1 to chain`    | `~/.dema/poi/preview-envelopes/2026-poi-001.json` + chain receipt |
| 30–55 | Identify Ring-2 cohort candidates (2 additional · Mumu's network)                                                                                   | Mumu (operator-side)                     | 2 distinct candidates named                                       |
| 35–60 | Refresh Lighthouse Pack to current HEAD (v1.1 · regenerate manifest)                                                                                | `GO refresh lighthouse pack to v1.1`     | `lighthouse-pack-v1.1/MANIFEST.sha256`                            |
| 50–55 | Send updated pack to 2 Ring-2 candidates                                                                                                            | `GO send v1.1 pack to <names>`           | Send-receipts on record                                           |
| 50–60 | Authorize URP local-pool preview init at N=1 (shared URP runtime remains not connected)                                                             | `GO urp local init N=1`                  | `~/.dema/urp/local-pool.json` initialized + receipt               |
| 55–60 | Materialize remaining 6 PAT + 5 SAT agents structurally in `~/.dema/agents/`                                                                        | `GO materialize 11 agents`               | 12 `capability.yaml` files on disk                                |
| 60    | Phase-2-close proof-forge receipt + retrospective                                                                                                   | `GO mint phase-2-close`                  | Next authorized Phase-2-close chain receipt                       |

### VI.C Phase 2 success criteria

- [ ] POI v0.1 implemented · ≥15 adversarial tests green · canonical envelope schema active
- [ ] ≥1 POI preview envelope receipted to chain
- [ ] Ring-2 cohort has 3 candidates engaged (1 from Phase 1 + 2 new)
- [ ] URP local pool at N=1 preview initialized (status returns `mode: "preview_only", pool_size_nodes: 1`)
- [ ] 12-agent split structurally materialized
- [ ] Phase-2-close proof-forge receipt recorded

### VI.D Phase 2 risk register

| Risk                                                                    | Likelihood | Severity | Mitigation                                                                                     |
| ----------------------------------------------------------------------- | ---------- | -------- | ---------------------------------------------------------------------------------------------- |
| POI v0.1 implementation has a hidden Riba-Zero violation                | LOW        | EXTREME  | 15+ adversarial tests target this · ADR-009 POI-C4 explicit                                    |
| Ring-2 candidates can't install (env/toolchain failure)                 | MEDIUM     | MEDIUM   | Mumu hands-on first install (proven on Day 7 of Phase 1)                                       |
| URP at N=1 reveals architectural gap not present in single-receipt mode | LOW        | HIGH     | Cargo `check` already clean · benches present · seed-pattern invariant enforces N=1 capability |
| Agent materialization creates 12 dirs but no behavior · just contracts  | EXPECTED   | NEUTRAL  | This is the spec phase · behavior comes in Phase 3                                             |

---

## Part VII · Phase 3 · Days 61–90 — Design Partner Cohort + Pre-Public Readiness

### VII.A Phase 3 thesis

> **Move from Ring-2 (3 technical lighthouses) to Ring-3 (5–10 design partners covering ≥2 use cases beyond Mumu's primary).** Stress-test the constitutional gate under varied operator personalities. Day 90 leaves BIZRA pre-public-ready but NOT public.

### VII.B Phase 3 deliverables

| Days  | Action                                                                                                          | Halt-gate phrase                         | Deliverable                                  |
| ----- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------- |
| 61–65 | Identify Ring-3 design-partner cohort (5–10 · diverse · per `[[feedback_evidence_first_gtm_concentric_rings]]`) | Mumu                                     | Cohort list on record                        |
| 65–75 | Mother-tongue native review for Arabic/Urdu/Hindi homebase-language-picker (per issue #57)                      | Native speakers per language             | 3 templates labeled DECLARED (not \_PENDING) |
| 65–80 | Send Lighthouse Pack v1.1 to Ring-3 cohort                                                                      | `GO send v1.1 pack to <cohort>`          | Send-receipts (5–10)                         |
| 65–85 | Each Ring-3 member runs 6-command demo + provides feedback                                                      | Cohort                                   | 5–10 feedback documents                      |
| 75–85 | Implement 3 highest-leverage feedback items as ADR amendments + code                                            | `GO impl <amendment N>`                  | 3 PRs merged · 3 receipts                    |
| 80–85 | URP cross-agent allocation prototype (PAT-SAT internal pool · still at N=1)                                     | `GO impl URP PAT-SAT allocation preview` | `dema urp allocate --preview` works          |
| 85–88 | Bitcoin block timestamp current canonical state (OpenTimestamps anchor)                                         | `GO ots anchor current main`             | New OTS proof in `.proof-forge/anchors/`     |
| 88–90 | Phase-3-close + 90-day retrospective + Day-180 amendment scope                                                  | `GO mint 90-day close`                   | Next authorized 90-day-close chain receipt   |

### VII.C Phase 3 success criteria

- [ ] Ring-3 cohort: 5–10 members with installed Node0 + signed feedback
- [ ] Arabic / Urdu / Hindi templates DECLARED (Issue #57 closed)
- [ ] 3 reviewer-feedback amendments shipped
- [ ] URP cross-agent allocation preview operational
- [ ] Current main Bitcoin-anchored
- [ ] 90-day-close proof-forge receipt recorded (Ironclad, if authorized)
- [ ] Day-180 amendment scope ADR drafted

### VII.D Phase 3 risk register

| Risk                                                   | Likelihood | Severity | Mitigation                                                     |
| ------------------------------------------------------ | ---------- | -------- | -------------------------------------------------------------- |
| Ring-3 feedback exposes a structural ADR-005 violation | MEDIUM     | HIGH     | Honor it · amend · this is the system working                  |
| Native-speaker reviewer unavailable for ar/ur/hi       | MEDIUM     | MEDIUM   | Defer affected languages · ship the others · label honestly    |
| Operator (Mumu) declares Ring-4 ready prematurely      | LOW        | EXTREME  | This document explicitly forbids it · halt-gate canon enforces |
| 5–10 cohort overwhelms operator capacity to coach      | MEDIUM     | MEDIUM   | Cap at the lower bound (5) · don't force the upper bound       |

---

## Part VIII · Risk Register (consolidated · 6 active risks + 1 retired risk)

| ID  | Risk                                                                                                 | Likelihood | Severity | Phase      | Owner       | Mitigation                                                                                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------- | ---------- | -------- | ---------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Ring-1 N=1 reviewer never arrives or never engages**                                               | MEDIUM     | EXTREME  | Phase 1    | Mumu        | Have 2-3 candidate reviewers in reserve · POI Gate 1 holds firm regardless                                                                                                   |
| R2  | **External AI artifact (Kimi-class) hijacks operator attention with wrong-codebase recommendations** | HIGH       | MEDIUM   | All phases | Coordinator | `[[feedback_external_ai_audit_wrong_codebase_pattern]]` 6-step screen · refuse-and-document pattern proven 2026-05-19                                                        |
| R3  | **SAT-5 schema canon drift between bizra-omega and Dema unresolved**                                 | EXISTS NOW | MEDIUM   | Phase 1    | Mumu        | Choose `GO resolve SAT-5 canon drift by founding-doc verification` or `GO accept SAT-5 parallel vocabularies`, then write the chosen result into a self-contained canon note |
| R4  | **POI v0.1 implementation introduces Riba-Zero violation**                                           | LOW        | EXTREME  | Phase 2    | Coordinator | 15+ adversarial tests target time-decay · ADR-009 POI-C4 explicit · test-coverage gate at PR review                                                                          |
| R5  | **Operator exhaustion (Mumu has worked 3 years for free)**                                           | EXISTS NOW | EXTREME  | All phases | Mumu        | Day-90 plan is RIGHT-SIZED · 30-day rest periods between phases · session memory captures velocity vs sustainability tension                                                 |
| R6  | **`~/.bashrc` env leak (DEMA_NODE0_ADAPTER=gateway-http)**                                           | RETIRED    | LOW      | Phase 1    | Mumu        | GitHub issue #56 is CLOSED as of the v0.1.2 audit; re-check env before any external send ceremony                                                                            |
| R7  | **GitHub Actions `pull_request` dispatch anomaly recurs**                                            | LOW        | MEDIUM   | All phases | Coordinator | `workflow_dispatch` fallback already wired · `push:[main]` trigger also live                                                                                                 |

**Risk discipline note**: This register intentionally excludes "low-likelihood low-severity" cosmetic risks. Risks below threshold are managed via the standard ceremony pattern, not the GTM document.

---

## Part IX · Decision Matrix · what's decided vs what awaits authorization

### IX.A Already decided (canonized · not revisitable in 90 days)

| Decision                                            | Canonized in                                              | Status                                                   |
| --------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------- |
| BIZRA is three-runtime by design                    | ADR-014                                                   | Accepted via `GO accept ADR-009 and ADR-014`             |
| The operating canon                                 | `[[canon_deterministic_constitutional_execution_engine]]` | Accepted (Mumu authored 2026-05-19)                      |
| 50% pool oath + Zakat 2.5% canonical                | البذرة p19 · Third Fact §229                              | Accepted                                                 |
| Riba-Zero invariant                                 | All ADRs · `[[reference_bizra_constitutional_anchors]]`   | Accepted                                                 |
| ZANN_ZERO + Daughter Test                           | All ADRs · session memory                                 | Accepted                                                 |
| Receipt chain is canonical evidence                 | `.proof-forge/EVIDENCE_INDEX.json` · 73 indexed entries   | Operational                                              |
| URP self-sustainable at N=1 (NOT requires ≥2 nodes) | `[[feedback_urp_at_n_1_self_sustainable]]`                | Accepted (corrected 2026-05-19)                          |
| Visual language port from bizra-cli to Dema         | PR #59 · receipt `2026-05-19_122111`                      | Implementation verified; ADR file status-sync still open |
| Genesis ceremony already happened (~2026-04-21)     | `~/.bizra/mumo/` + `~/.bizra/activations/`                | Operational                                              |
| Ring 4 (public) is NOT a Day-90 deliverable         | This document                                             | Acceptance via Mumu's typed read of this plan            |

### IX.B Awaits Mumu's explicit GO (within 90 days)

| #   | Decision                                           | Phrase                                                                                                 | Phase | If declined                                                                          |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----- | ------------------------------------------------------------------------------------ |
| 1   | Send Lighthouse Pack to specific reviewer          | `GO send pack to <name>`                                                                               | 1     | Phase 1 stalls · POI Gate 1 stays open                                               |
| 2   | Author POI v0.1 test plan                          | `GO author POI v0.1 test plan (no impl)`                                                               | 1     | POI Gate 4 stays open                                                                |
| 3   | Authorize URP local-pool preview init at N=1       | `GO urp local init N=1`                                                                                | 2     | URP local preview stays uninitialized; shared URP remains not connected either way   |
| 4   | Authorize POI v0.1 implementation                  | `GO impl POI v0.1`                                                                                     | 2     | POI stays designed-not-live; preview envelope is not receipted                       |
| 5   | Resolve ADR-013 status sync                        | `GO sync ADR-013 status to Accepted`                                                                   | 1     | Implementation remains verified, but ADR file still says Proposed                    |
| 6   | Resolve SAT-5 schema canon drift                   | `GO resolve SAT-5 canon drift by founding-doc verification` OR `GO accept SAT-5 parallel vocabularies` | 1     | Schema drift remains (acceptable but should be named in a self-contained canon note) |
| 7   | Authorize 12-agent materialization                 | `GO materialize 11 agents`                                                                             | 2     | Only mission_agent stays structurally on disk                                        |
| 8   | Authorize Ring-3 cohort send (after Phase 2 close) | `GO send v1.1 pack to <cohort>`                                                                        | 3     | Ring 2 stays the high-water-mark                                                     |

### IX.C Explicitly NOT a 90-day decision (deferred to Day-180 amendment)

| Topic                                                                             | Why deferred                                                                     |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Token mint                                                                        | Forbidden by POI-C1 · cannot happen at v0.1                                      |
| Reward function design (ADR-010+)                                                 | Requires POI v0.1 shipped first (Phase 2) AND ≥1 cohort feedback cycle (Phase 3) |
| Ring 4 public launch                                                              | Requires ≥1 Ring-3 cycle complete with positive verdict · 90 days insufficient   |
| Cross-node URP federation                                                         | Requires Step7 Node1 mint · separate halt-gate · post-90                         |
| Fundraising / token sale                                                          | Forbidden by POI-C2 (no public economic claim at v0.1)                           |
| BIZRA-Omega Rust-layer URP genesis ceremony (separate from Dema-layer activation) | Optional · evaluate at Day-90 retrospective                                      |

---

## Part X · Resource Plan

### X.A Already available

| Resource                                                                        | State                                                                                                                                                               |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Author + Operator (Mumu)                                                        | 1 FTE · 3 years of accumulated context                                                                                                                              |
| Coordinator (Claude Opus 4.7)                                                   | Per-session · NOT persistent · memory-anchored cross-session                                                                                                        |
| Hardware (MSI Titan + Z Fold 6 + 5th friend's device + 2 remote friend devices) | 5 candidate nodes for cohort                                                                                                                                        |
| Codebase (Dema · 12 packages · 134 package source files · 2437 tests)           | Current local verification after GTM readiness, Phase 1 evidence scan, Phase 1 success-criteria ledger, and URP discovery gates                                     |
| bizra-omega Rust workspace (20 crates · 944 tests)                              | Read-only resource for design vocabulary                                                                                                                            |
| bizra-data-lake (53GB · 3-month-old audits)                                     | Reference corpus                                                                                                                                                    |
| Lighthouse Pack v1.0                                                            | Durable copy at `~/Documents/bizra/lighthouse-pack-v1.0/`; manifest verified in v0.1.2 audit; `/tmp/bizra-overnight/lighthouse-pack/` absent in current local state |
| Receipt chain (73 indexed receipts)                                             | `.proof-forge/EVIDENCE_INDEX.json`                                                                                                                                  |
| 15 ADR files (14 Accepted · 1 Proposed/status-sync-open)                        | `docs/06-adr/`                                                                                                                                                      |
| Cargo + libz3-dev 4.8.12                                                        | Installed locally · `bizra-resourcepool` builds clean                                                                                                               |

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

| Metric                              | Day 0                                               | Day 30 target                                                                 | Verification                                                                                                   |
| ----------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| ADR status                          | 14 Accepted · 1 Proposed/status-sync-open (ADR-013) | ADR-013 status-sync decision + dedicated POI test-plan artifact if authorized | read `docs/06-adr/*.md` status fields                                                                          |
| Receipts in chain                   | 73 indexed                                          | Advances only after the next authorized receipt event                         | `.proof-forge/EVIDENCE_INDEX.json` chain_length                                                                |
| Lighthouse Pack copies sent         | 0                                                   | 1                                                                             | Send-receipt on record                                                                                         |
| External witness feedback documents | 0                                                   | 1                                                                             | `~/.dema/lighthouse/ring-1/feedback/*.md` by default; optional anonymized repo copy only with reviewer consent |
| Tests                               | 2437                                                | ≥2437 plus any authorized POI test-plan coverage                              | `npm test`                                                                                                     |

### XI.B Phase 2 (Day 60 checkpoint)

| Metric                              | Day 30               | Day 60 target                                           | Verification                                           |
| ----------------------------------- | -------------------- | ------------------------------------------------------- | ------------------------------------------------------ |
| POI v0.1 implementation             | designed-not-built   | implemented · all 15+ tests green                       | `tests/poi-v0_1*.test.js` files                        |
| POI preview envelopes receipted     | 0                    | ≥1                                                      | `~/.dema/poi/preview-envelopes/`                       |
| Ring-2 cohort members engaged       | 1 (Phase-1 reviewer) | 3                                                       | `~/.dema/lighthouse/ring-2-registry.json`              |
| URP local pool preview initialized  | NO                   | YES (mode=preview_only · pool_size=1)                   | `dema urp status --json`                               |
| 12 agents structurally materialized | 1                    | 12                                                      | `find ~/.dema/agents -name 'capability.yaml' \| wc -l` |
| Receipts in chain                   | 73 indexed           | Advances only through authorized Phase 2 receipt events | `.proof-forge/EVIDENCE_INDEX.json` chain_length        |
| Tests                               | ≥2437 baseline       | ≥2437 plus authorized POI / URP / agent coverage        | `npm test`                                             |

### XI.C Phase 3 (Day 90 checkpoint)

| Metric                                                     | Day 60                     | Day 90 target                                                           | Verification                                        |
| ---------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------- |
| Ring-3 cohort members engaged                              | 0                          | 5–10                                                                    | `~/.dema/lighthouse/ring-3-registry.json`           |
| Mother-tongue templates DECLARED (vs PENDING/NEEDS_REVIEW) | 4 (en/fr/es/other)         | 7 (add ar/ur/hi)                                                        | `tests/homebase-language-picker.test.js` assertions |
| Reviewer-feedback amendments shipped                       | 1 (Phase 1)                | 4 (+3 in Phase 3)                                                       | ADR amendment files                                 |
| URP cross-agent allocation preview                         | NO                         | YES (at N=1)                                                            | `dema urp allocate --preview`                       |
| Current main Bitcoin-anchored (OTS)                        | last anchor pre-session    | then-current main (`ac6dd63+` from this audit baseline)                 | `.proof-forge/anchors/*.ots`                        |
| Receipts in chain                                          | Phase 2 close chain length | Advances only through authorized Phase 3 receipt events                 | `.proof-forge/EVIDENCE_INDEX.json` chain_length     |
| Tests                                                      | Phase 2 verified count     | Phase 2 verified count plus authorized Ring-3 / URP allocation coverage | `npm test`                                          |

### XI.D Quality discipline · constant across phases

| Metric                                       | Target across all phases                                              |
| -------------------------------------------- | --------------------------------------------------------------------- |
| Halt-gates respected                         | 100% (zero unauthorized push/mint/destructive)                        |
| ZANN_ZERO violations                         | 0                                                                     |
| Daughter Test fails                          | 0                                                                     |
| Riba-Zero violations                         | 0                                                                     |
| Unauthorized scope-creep PRs merged          | 0                                                                     |
| External AI artifacts canonized as authority | 0 (always context, never authority per CLAUDE.md)                     |
| Bombastic-wrap → silent compliance instances | 0 (every wrap explicitly triaged · noise rejected · signal extracted) |

---

## Part XII · Honest Constraints · what 90 days will NOT deliver

This section is the discipline test. A consulting deliverable that claims everything is achievable is consulting theater. The following items are **explicitly not Day-90 outcomes**:

| Item                                          | Why NOT in 90 days                                                                                   | When (if ever)                                                                         |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Token mint of any kind                        | POI-C1 binding refusal · 50% pool oath inactive before proof gates                                   | Post-ADR-010 + ADR-011 reward function ADR + Mumu authorization · earliest 6-12 months |
| Public launch (Ring 4)                        | Per `[[feedback_evidence_first_gtm_concentric_rings]]` Ring 4 cannot precede Ring 3 cycle            | 6-12 months minimum                                                                    |
| Revenue claim                                 | No economic activation at v0.1 by design                                                             | Post-Day-180 only if a separate evidence-bound economic/legal review exists            |
| Federation activation (Node1+ cross-node URP) | Requires Step7 mint · separate halt-gate sequence                                                    | 6-12 months post-Day-90 if pursued                                                     |
| Mobile / Android port                         | Out of scope · Z Fold 6 acts as Node0 companion, not separate node                                   | Separate product-roadmap decision after Ring-3 evidence                                |
| BIZRA-Omega Rust-layer ceremony               | Separate from Dema-layer (already done) · optional · evaluate at Day-90 retro                        | Optional · post-90                                                                     |
| Founder allocation / pre-mint                 | Forbidden by architect-self-binding · this is the discipline that earned the moat                    | Never (by design)                                                                      |
| Whitepaper / academic publication             | Currency of academic publication is different from currency of receipt chain · evaluate post-Day-180 | Post-Day-180 editorial decision after reviewer feedback exists                         |
| Press / media engagement                      | Ring 4 territory · out of scope                                                                      | Post-Ring-4                                                                            |

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

## Annex A · Disk State Inventory

The first inventory below was authored on 2026-05-19 at HEAD `ea4c231`.
Current-state fields that changed by the v0.1.2 audit are updated inline.

```text
~/Downloads/Dema/                  Runtime C (JS) · this repo
  package.json                     v0.1.0-alpha.0 · ZERO runtime deps · ZERO devDeps
  packages/                        12 packages
    consent/ core/ fate/ installer/ memory/ mission/ models/ node-adapter/
    receipts/ tasks/ verifier/
  apps/cli/                        bin/dema entry point
  docs/06-adr/                     15 ADR files
  tests/                           172 test files · 2437 total tests
  scripts/                         39 scripts
  .proof-forge/                    73 indexed receipts
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

## Annex B · ADR Map (15 ADR files · status as of v0.1.2 audit)

| ADR | Title                                       | Status                                                                                |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------- |
| 001 | Dema Is One Face                            | Accepted                                                                              |
| 002 | No Shadow State                             | Accepted                                                                              |
| 003 | Core Truth Lives in bizra-omega             | Accepted                                                                              |
| 004 | Local-First Memory                          | Accepted                                                                              |
| 005 | Explicit Consent Rule                       | Accepted                                                                              |
| 006 | Continuous Assurance + No-mint Verification | Accepted                                                                              |
| 007 | Cross-Session Chain Mutation                | Accepted (2026-05-16)                                                                 |
| 008 | Runtime Activation Components               | Accepted (2026-05-18 · 12 components shipped)                                         |
| 009 | POI Design                                  | Accepted                                                                              |
| 010 | Interactive TUI Layer Dep Decision          | Accepted                                                                              |
| 011 | Onboarding Consciousness Layer              | Accepted (2026-05-18)                                                                 |
| 012 | CLI Naming Convention                       | Accepted                                                                              |
| 013 | Visual Language Isomorphism                 | Proposed in ADR file; implementation verified by PR #59 / receipt `2026-05-19_122111` |
| 014 | Three-Runtime Architecture Canonization     | Accepted                                                                              |
| 015 | LLM is Suggestion · Verifier is Authority   | Accepted                                                                              |

**Phase 1 ADR work remaining**: send the Ring-1 pack, close POI Gate 1 with external feedback, author the dedicated POI v0.1 test-plan artifact if authorized, and resolve ADR-013 status sync if Mumu chooses to do so.

---

## Annex C · Memory Entries (load-bearing · 12 entries)

Cross-session memory anchors at `~/.claude/projects/-home-bizra-operating-system-Downloads-Dema/memory/`:

| Entry                                                  | Why load-bearing                                      |
| ------------------------------------------------------ | ----------------------------------------------------- |
| `canon_deterministic_constitutional_execution_engine`  | Primary operating canon                               |
| `reference_bizra_three_runtime_architecture`           | The runtime topology · prevents wrong-codebase audits |
| `feedback_per_module_domain_boundary_pattern`          | Per-module vocabularies are intentional design        |
| `feedback_external_ai_audit_wrong_codebase_pattern`    | 6-step screen before acting on external AI audits     |
| `feedback_urp_at_n_1_self_sustainable`                 | URP works at N=1 — critical correction · 2026-05-19   |
| `feedback_unsatisfiable_goal_hook_canon_collision`     | When /goal lists fabrication, refuse                  |
| `reference_50_percent_pool_correct_framing`            | 50% pool = founder oath · users keep 100% earned      |
| `feedback_law_of_assumption_canon_of_canons`           | V/D/A/U claim discipline                              |
| `feedback_preflight_adversarial_slice_pattern`         | Grep ALL surfaces before first impl byte              |
| `feedback_sparc_swarm_coordinator_pattern`             | 3 parallel subagents catch partial fixes              |
| `project_2026_05_19_post_merge_main_verify_receipt_62` | Standard ceremony pattern proven N=6                  |
| `project_2026_05_19_tui_3_bug_fix_arc`                 | Visible UX improvement evidence                       |

---

## Annex D · Receipt Chain Trajectory

```text
Day -1 (today)     #70 Ironclad (PR #61 palette resolver merge verify)
                   ↑ 10 receipts written in single session
Actual #71         ADR-009 acceptance · ADR-014 acceptance
Actual #72         90-Day GTM v0.1.1 merge verification
Actual #73         ADR-015 acceptance merge verification
Future #N          Lighthouse Pack v1.0 send-receipt
Future #N+1        Phase-1-close (Ring-1 N=1 feedback received + parsed)
Future #N+2        POI v0.1 implementation start
Future #N+3        POI v0.1 implementation complete · 15+ tests green
Future #N+4        First POI preview envelope receipted
Future #N+5        URP local pool preview init at N=1
Future #N+6        Phase-2-close
Future #N+7        Ring-3 cohort send-receipt
Future #N+8        Bitcoin OTS anchor of current main
Future #N+9        90-day GTM close · Day-180 amendment scope authored
```

Future receipt numbers are projected targets, not commitments. The chain progresses receipt-by-receipt under explicit consent at each step.

---

## Annex E · Issue State (current-state audit)

| #   | Title                                             | Current state / phase               |
| --- | ------------------------------------------------- | ----------------------------------- |
| #56 | Operator-side env-hygiene check for DEMA\_\*      | CLOSED on GitHub as of v0.1.2 audit |
| #57 | Mother-tongue native review for Arabic/Urdu/Hindi | Phase 3 (Days 65-75)                |
| #58 | Resolve core ↔ verifier soft cycle                | Phase 3 (Days 80-85)                |

(Remaining SPARC follow-ups already closed in 2026-05-19 session arc.)

---

## Annex F · The Lighthouse Pack v1.0 (existing send-ready asset)

Located at `~/Documents/bizra/lighthouse-pack-v1.0/` (manifest verified in the
v0.1.2 audit). The earlier `/tmp/bizra-overnight/lighthouse-pack/` copy is not
present in the current local state, so the durable operator copy is the
`~/Documents/bizra/` path.

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

Before sending v1.0, use
[BIZRA_GTM_PHASE1_OPERATOR_PACKET_v0_1.md](BIZRA_GTM_PHASE1_OPERATOR_PACKET_v0_1.md)
for the pre-send checklist, private send receipt shape, and feedback record
boundary.

**Phase 2 amendment**: regenerate at the then-current HEAD (current audit baseline: `ac6dd63+`) as Lighthouse Pack v1.1.

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

If the Daughter Test passes — and it does, by construction above — this 90-day GTM v0.1.2 is ready for Mumu's review.

---

**Document end.**

_Operating canon (binding): A deterministic constitutional execution engine with replayable receipts._

_Operating law (cross-runtime ports · per ADR-013): Design wisdom transfers across runtime boundaries. Code does not._
