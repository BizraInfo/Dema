# BIZRA / Dema Glossary

**Purpose:** precise definitions for BIZRA-specific vocabulary. If a term in this codebase, an ADR, a canon doc, or an in-room walkthrough confuses a reader, the definition lives here.

**Convention:** every definition is bound to V (verified) / D (derived) / A (assumed-with-Ihsān) / U (unknown) per [Key Maker Epistemic Conduct v0.1](docs/02-architecture/key-maker-epistemic-conduct-v0.1.md). Where a term originates outside BIZRA, the source is cited.

---

## Core constitutional vocabulary

### Adl (عدل)

**Origin:** Quranic frame.
**Definition:** Justice; bounded inequality. A constitutional invariant requiring that distributions of value, attention, and resources remain within a fairness ceiling. BIZRA codifies this as a Gini ≤ 0.35 ceiling for any future economic activity.
**Status:** V (constitutional anchor · cited in reference_bizra_constitutional_anchors memory)

### Ihsān (إحسان)

**Origin:** Quranic frame · root _ḥ-s-n_ (goodness, beauty, excellence).
**Hadith:** _"To worship God as if you see Him; if you cannot see Him, know that He sees you."_ (Sahih Muslim)
**Definition in BIZRA:** disciplined constructive intent under uncertainty. Used as an epistemic floor (`IHSAN_FLOOR ≥ 0.95`) and as the qualifier for declared assumptions (`assumed-with-Ihsān`).
**Status:** V (canonized in docs/02-architecture/key-maker-epistemic-conduct-v0.1.md §2)

### IHSAN_FLOOR

**Definition:** numeric threshold for Ihsān-compliance. BIZRA artifacts must not regress below 0.95 on the Ihsān evaluation axis. Currently a doctrinal anchor; future SAT-3 implementation may surface a measurable score.
**Status:** V (named in canon · not yet computed automatically)

### Riba / Riba_Zero

**Origin:** Quranic prohibition on usury (Quran 2:275).
**Definition:** Riba is extractive value from the time-decay of money or attention. RIBA_ZERO is the constitutional invariant that BIZRA's economic mechanisms (when activated · per ADR-008 §C12 + future ADRs) MUST NOT include any time-decay-based extraction.
**Status:** V (constitutional anchor)

### ZANN_ZERO

**Origin:** _zann_ (ظن) · Arabic for "speculation passed off as certainty".
**Definition:** the prohibition on overclaim. Every BIZRA statement must bind to V/D/A/U claim-state per Key Maker §3.
**Status:** V (canonized · enforced in code via key-maker-compliance.js)

### Daughter Test

**Definition:** a single ethical heuristic — _"Would I be willing to subject my own daughter to this output?"_ — applied as a final filter on any external-facing output. If the answer is no, refuse.
**Status:** V (cited in feedback_user_audit_register memory · Founder IP Separation Spec)

### CLAIM_MUST_BIND

**Definition:** every claim emitted by BIZRA must bind to a verifiable artifact (file path · SHA · Bitcoin block · memory anchor). Unbound claims are doctrine violations.
**Status:** V (canonized · enforced via Key Maker invariant #5 boundary_marker)

---

## Architecture vocabulary

### BIZRA

**Definition:** the wider sovereign-AI ecosystem. Per the Third Fact (BIZRA_Third_Fact_v0_1_FINAL.pdf) BIZRA encompasses 7 pillars: PAT · SAT · DEMA · FATE · URP · RECEIPTS · POI.
**Status:** V (Bitcoin-anchored at blocks 948027/948028/948029 via OpenTimestamps)

### Dema

**Definition:** the LOCAL product face of BIZRA Node0. One of the 7 BIZRA pillars. This repository implements Dema. Per [ADR-001](docs/06-adr/ADR-001-dema-is-one-face.md), Dema is "the one face" — the human-facing CLI and (future) TUI.
**Status:** V (this repository)

### Node0

**Definition:** the operator's local sovereign AI node. Per [Node0 + DEMA Goal v0.2](docs/02-architecture/node0-dema-goal-v0.2.md), Node0 is "MoMo's local seed → local active → private 5-node proof mesh". Currently at NODE0_LOCAL_SEED truth label.
**Status:** V (operator's machine · ~5.8 GB local state in ~/.dema/)

### Node1, Node2, ... Node4

**Definition:** trusted friend-operator nodes in the planned Private 5-Node Pilot. Per the field notes, the operator has 2 friends present (potential Node1 + Node2) and 2 more in mind. **Currently UNCONNECTED.** Federation is `false` across all canonical boundary outputs.
**Status:** U (planned · not implemented · gated by Phase 3 readiness)

### PAT (Private Agents · 7 total)

**Origin:** Third Fact pillar.
**Definition:** 7 agents serving the operator's private mission. Per [ADR-008](docs/06-adr/ADR-008-runtime-activation.md) §C4:

- PAT-1 Mission Scribe — intent capture · proposal drafting
- PAT-2 Research Companion — corpus query · bounded web fetch
- PAT-3 Code Apprentice — read/write within declared boundary
- PAT-4 Memory Curator — `~/.dema/memory/` classification
- PAT-5 Consent Drafter — drafts consent phrases · NEVER approves
- PAT-6 Receipt Recorder — shapes receipt candidates
- PAT-7 Reflection Witness — daily summary · pattern detection
  **Status:** V (implemented at `packages/core/src/pat-*.js`)

### SAT (System Agents · 5 total)

**Origin:** Third Fact pillar.
**Definition:** 5 agents serving the system (verification · enforcement · audit). Per ADR-008 §C5:

- SAT-1 Boundary Verifier — canonical 16-key check
- SAT-2 Consent Auditor — ADR-005 compliance check
- SAT-3 Doctrine Compliance — Key Maker invariant check
- SAT-4 Receipt Chain Verifier — chain integrity check
- SAT-5 Identity Verifier — operator identity persistence check
  **Status:** V (implemented at `packages/core/src/sat-*.js`)

### DEMA (capital · the pillar)

**Definition:** distinct from "Dema" (the local product face). Per Third Fact, "DEMA" is the ecosystem-level pillar (governance · cross-node coordination). The lowercase "Dema" in this repository is the operator-facing face of DEMA on a single Node0.
**Status:** V (terminology distinction · per reference_bizra_third_fact_manifest memory)

### URP (Universal Resource Pool)

**Definition:** the shared resource substrate of BIZRA. Per [ADR-008](docs/06-adr/ADR-008-runtime-activation.md) §C7, URP local has 5 categories: hardware · data_corpus · knowledge_base · experience_history · skill_library. Federation is `false` at Node0 stage.
**Status:** V (implemented at `packages/core/src/urp-local.js`)

### FATE

**Origin:** Third Fact pillar.
**Definition:** the constitutional boundary gate. The mechanism by which Node0 declares what it will and will NOT do, before being asked. Currently surfaced as the canonical 16-key `boundary` object in every spine emission.
**Status:** V (canonical boundary in `packages/core/src/preview-boundary.js`)

### POI (Proof of Impact)

**Definition:** Third Fact's economic activation mechanism. Verified useful impact → receipt → impact score → reward eligibility. **No POI activity currently · Phase 4 work · gated by Ring-2+ design partner readiness.**
**Status:** U (Phase 4 · not yet implemented)

---

## Discipline vocabulary

### Key Maker

**Definition:** the epistemic conduct layer. Per [Key Maker Epistemic Conduct v0.1](docs/02-architecture/key-maker-epistemic-conduct-v0.1.md), Key Maker is the discipline for reasoning under uncertainty. Includes 5 invariants: Assumption Declaration · Certainty Mapping · Constructive Reading · Opposing-View Search · Boundary Marker.
**Status:** V (canonized as code at `packages/core/src/key-maker-compliance.js`)

### V/D/A/U (claim-state labels)

**Definition:** the four legitimate states for any claim per Key Maker §3:

- **V** Verified — backed by evidence reachable on disk or chain
- **D** Derived — follows logically from V claims
- **A** Assumed-with-Ihsān — assumption declared with bounded constructive intent
- **U** Unknown — named ignorance · not concealed
  A claim outside these four categories must not be made.
  **Status:** V (enforced via key-maker-compliance.js + sat-doctrine-compliance.js)

### Master Craftsmanship

**Origin:** [ADR-008](docs/06-adr/ADR-008-runtime-activation.md).
**Definition:** the 10 quality invariants every ADR-008 runtime component must satisfy. See [HANDOVER.md §4](HANDOVER.md) for the full list. The 10 invariant IDs: `canon_bound` · `test_backed` · `consent_gated` · `receipt_emitting` · `doctrine_coherent` · `boundary_disciplined` · `adversarial_tested` · `verify_before_asserting` · `reversible` · `cross_referenced`.
**Status:** V (binding · 1896 tests verify it across 12 ADR-008 components + ADR-011 4-phase implementation arc + master-craftsmanship audit module)

### Master Craftsmanship Audit

**Origin:** Commit `3d8522e` (2026-05-19) · `packages/core/src/master-craftsmanship-audit.js`.
**Definition:** the EXTERNAL-WITNESS audit surface. Where the existing `craftsmanship-witness` builder SELF-asserts compliance for its own module, `master-craftsmanship audit` reads ANY artifact file path + maps it against the 10 master-craftsmanship invariants via evidence-anchored heuristic probes. Emits `bizra.dema.master_craftsmanship_audit.v0.1`. Default audit subject is `tests/node-onboarding-adr011-compliance.test.js` (the ADR-011 phase-4 compliance suite). Verdict: COMPLIANT (10/10) · PARTIAL (N/10) · NON-COMPLIANT. Exits 1 on non-compliant or missing artifact. Per [ADR-012 §Amendments 2026-05-19](docs/06-adr/ADR-012-cli-naming-convention.md), the kebab `master-craftsmanship` token is the 13th legacy allowlist entry.
**Status:** V (canonical first verdict: ADR-011 compliance suite COMPLIANT 10/10 · receipt #54 IRONCLAD)

### Concentric Rings (Ring 0 → Ring 4)

**Origin:** [feedback_evidence_first_gtm_concentric_rings](memory anchor) · framework Mumu derived from Linux/Bitcoin/Git propagation patterns.
**Definition:** evidence-first GTM model. Real paradigm shifts propagate through rings of increasing skepticism:

- **Ring 0** — Founder verifies (current state for BIZRA at 2026-05-18)
- **Ring 1** — Single technical lighthouse reviewer (next gate)
- **Ring 2** — 5-10 daily users (cohort proof)
- **Ring 3** — Design partner cohort
- **Ring 4** — Public record
  **Rule:** Never claim a ring not earned · never skip a ring.
  **Status:** V (canonized in operator memory · referenced throughout the field notes)

### EffectCap (Effect Capability)

**Definition:** per [ADR-008 §C2](docs/06-adr/ADR-008-runtime-activation.md), a declared capability descriptor that names what effects a tool may produce (`allowed_effects`) and what it MUST NOT do (`blocked_effects` · 8 always-blocked: shell · caller-code · public-network · chain-advance · mint · federation · node1/2 connect · modify-consent-check).
**Status:** V (implemented at `packages/core/src/effect-cap.js`)

### Canonical 16-key boundary

**Definition:** the safety vocabulary that EVERY spine command emits in its `boundary` field. 16 keys · all pinned `false` · the canonical preview state. Defined in `packages/core/src/preview-boundary.js`.
**Status:** V (verified by SAT-1 Boundary Verifier · 9/9 spine surfaces canonical)

### Exact-string consent

**Origin:** [ADR-005](docs/06-adr/ADR-005-operator-actions-require-explicit-consent.md).
**Definition:** operator authorization requires the operator to TYPE an exact string verbatim (no fuzzy match · no case-insensitive · no prefix match · no implicit). Format: `GO: <specific scope>`.
**Status:** V (enforced via sat-consent-auditor.js + per-component consent gates)

### NODE0_LOCAL_SEED

**Definition:** the truth label that every Dema preview surface emits. Means: "this is locally-verified state on Mumu's machine; not federated; not chain-bound; not externally attested." Highest accuracy-per-claim local truth label.
**Status:** V (canonical · 119 schemas use it)

### MEASURED

**Definition:** truth label one tier above NODE0_LOCAL_SEED. Means: "this state was verified through an actual measurement command (e.g., npm test result · ots stamp confirmation)." Used in Proof Forge verification reports.
**Status:** V (used in invocation results · receipt verification)

### Refusal-as-product

**Origin:** [feedback_refusal_as_product_proven](memory anchor).
**Definition:** what BIZRA refuses is part of the product, not a defect. Refusals are documented as load-bearing features. Every PAT/SAT declares its `primary_refusals` array.
**Status:** V (N=2 proof anchored in memory · pattern visible across all 12 ADR-008 components)

---

## Evidence vocabulary

### Proof Forge

**Definition:** the local evidence kernel. Per the `/proof-forge` skill, produces sha256-chained receipts with verification reports. Located at `.proof-forge/` (gitignored locally).
**Status:** V (55 receipts on chain · last is IRONCLAD #55 · `forge_evidence.py --verify` reports `ok: true`)

### IRONCLAD

**Definition:** Proof Forge confidence level 5 of 5. Requires ≥3 verification commands all-passed. Example: receipt #17 (ADR-008) has 4 commands; receipt #55 (master-craftsmanship polish) has 13. Two outliers exist as `Logged` (#46, #47 from 2026-05-19) due to verification-script grep typos — the work itself was clean, the verification commands targeted strings that didn't match output. Honest chain history preserved as-is.
**Status:** V (latest IRONCLAD at receipt #55 · evidence_hash `e76eb0bd48af78b8f0e70ce4a902884800b2c78089d9f943d91b3d76a2e39276`)

### Strong / Solid / Attested / Logged

**Definition:** Proof Forge confidence tiers below IRONCLAD. See [`scripts/forge_evidence.py`](scripts/forge_evidence.py) `confidence_label()` for exact thresholds.
**Status:** V

### OpenTimestamps (OTS)

**Origin:** Peter Todd · open protocol.
**Definition:** the mechanism Dema uses to anchor sha256 hashes to the Bitcoin blockchain. Submits hash to 4 calendar servers which aggregate and write to Bitcoin. After confirmation, anyone can verify "this hash existed at this UTC time" against the public chain.
**Status:** V (3 founding PDFs CONFIRMED at blocks 948027/948028/948029 · PROOF_SUMMARY.md.ots PENDING)

### Receipt

**Two distinct meanings · context-sensitive:**

1. **Proof Forge receipt** — local evidence file at `.proof-forge/receipts/`. Chain position + content hash + previous_hash linking.
2. **Canonical Bizra receipt** — minted by the governed gateway (upstream of this repo · per ADR-001). Chain-bound · OTS-attestable.
   ADR-008 §C12 (`receipt-mint-integration.js`) bridges Proof Forge candidates to canonical receipts when all 7 gates pass.
   **Status:** V

### Anchor (verb · "to anchor")

**Definition:** to bind a piece of data to a cryptographic proof (sha256 + OTS to Bitcoin). Anchoring is reversible only by cryptographic break, which has never happened to Bitcoin's hash function.
**Status:** V

---

## ADR-011 onboarding consciousness vocabulary

Vocabulary introduced by [ADR-011 Onboarding Consciousness Layer](docs/06-adr/ADR-011-onboarding-consciousness-layer.md) (Accepted 2026-05-19). The ADR ships 11 binding laws governing how any human enters BIZRA as a sovereign node. The implementation arc is complete across 4 phases (`6303dc9` → `4125a42`). Receipt #53 anchors the end-to-end compliance suite.

### Genesis Preview Card

**Origin:** ADR-011 Law #11 (Genesis Preview before mint) · commits `d2db755` + `e955520`.
**Definition:** a preview-only artifact representing what an onboarding receipt WOULD look like if the candidate typed the mint consent phrase. Schema: `bizra.dema.genesis_preview_card.v0.1`. Contains candidate identity + a deterministic `receipt_id_preview` (sha256 of canonical payload, EXCLUDING timestamp so the hash is stable across renders) + `blocked_until_typed_GO` list + `card_storage` block + canonical 16-key boundary all-false. Card stored under `~/.dema/state/genesis-preview-<timestamp>.json` (NOT under `~/.dema/receipts/`). The actual receipt mint requires a separate typed-GO that **quotes the card's `receipt_id_preview` hash** — preventing mint-without-preview. Surface: `dema onboard --preview-card [--json]`.
**Status:** V (live · verified deterministic across consecutive renders at the binary surface · receipt #51 + #52)

### Returning-user language load (ADR-011 Law #9)

**Origin:** ADR-011 v0.2 amendment 2026-05-19 · commit `59f399c`.
**Definition:** if `~/.dema/profile.json::language_code` is set, the language stage of onboarding loads silently from disk and does NOT re-prompt. Re-prompting an established operator for their own language is a structural error — it implies amnesia. Only first-run candidates (profile.json absent OR language_code null) see the language picker. Escape hatch: `dema onboard --reset-language` explicitly re-asks. Enforced at code level by `resolveOperatorLanguage()` in `packages/core/src/homebase-language-picker.js`; `language_state.language_source` flips to `"profile_load"` on silent-load path.
**Status:** V (live · proven at binary surface: profile with language_code "ar" → silent load · NO prompt rendered)

### Second language as fallback dignity (ADR-011 Law #10)

**Origin:** ADR-011 v0.2 amendment 2026-05-19 · commit `59f399c`.
**Definition:** after the primary language is set during first-run onboarding, the candidate is OPTIONALLY asked for a secondary language. Default answer is "skip" via a single press of Enter. NEVER required · NEVER auto-detected from keyboard/locale · NEVER inferred from typing patterns. Enables fallback display when a primary-language string is missing AND bilingual consent phrase rendering (the candidate may read the consent phrase in their stronger-comprehension language). Recorded at `language_state.secondary_language_code`.
**Status:** V (live · 7 language options: ar/en/fr/es/ur/hi/other · GREETING_TEMPLATES marked DECLARED for en/fr/es/other · DECLARED_NEEDS_NATIVE_REVIEW for ar · PLACEHOLDER_PENDING_NATIVE_AUTHOR for ur/hi)

### receipt_id_preview

**Origin:** ADR-011 Law #11 implementation.
**Definition:** the sha256 hex hash embedded in a Genesis Preview Card's `would_mint_if_consented` block. Deterministic: same candidate identity + same onboarding state → same hash, regardless of when the card was rendered. Excludes timestamp from the hash payload by design (fix `e955520`). Acts as the binding token between a preview the candidate SAW and a future mint typed-GO that QUOTES it. A mint typed-GO that does not literally contain the expected receipt_id_preview hex is refused by `refuseMintWithoutQuotedHash()` validator.
**Status:** V (live · 4 consent phrase templates (en/ar/fr/es) embed the hash literally · refusal validator covered by tests)

---

## Operator-discipline vocabulary

### Halt-gate

**Origin:** [CLAUDE.md](CLAUDE.md) operator discipline.
**Definition:** an action that requires typed-GO confirmation before proceeding. Categories: destructive operations (rm -rf · git reset --hard) · hard-to-reverse operations (force-push · key generation) · external actions (Slack post · GitHub comment) · public-impact actions (commit to shared repo).
**Status:** V (canon · enforced operationally by Claude Code policy)

### Typed-GO

**Definition:** an explicit, in-the-moment, in-the-current-turn typed authorization phrase. **Re-paste of prior consent does NOT count.** **Inferred from colloquial language does NOT count.** Operator must actively re-type the consent string for each new scope.
**Status:** V (per ADR-005)

### Doctrine catch

**Origin:** [project_doctrine_catches_author](memory anchor).
**Definition:** when BIZRA's own doctrine catches its author in real-time and forces a course correction. As of 2026-05-18, this has happened N=16+ times during the build. **Each catch is operational signature** — proof the doctrine is real, not theatrical.
**Status:** V (16+ instances documented in memory)

### Operator-time

**Origin:** [feedback_sleep_cycle_inversion](memory anchor).
**Definition:** Mumu's wake cycle is INVERTED from Dubai clock-time. "Good afternoon" can mean start-of-day. Claude must never infer time-of-day from clock alone.
**Status:** V (operational rule · enforced by /A discipline)

---

## Cross-reference

| Concept type           | Primary anchor                                                           |
| ---------------------- | ------------------------------------------------------------------------ |
| Quranic constitutional | [docs/canon/BIZRA_TOPOLOGY_CANON.md](docs/canon/BIZRA_TOPOLOGY_CANON.md) |
| ADR-grade decisions    | [docs/06-adr/](docs/06-adr/)                                             |
| Architecture           | [docs/02-architecture/](docs/02-architecture/)                           |
| Operator memory        | `~/.claude/projects/-home-bizra-operating-system-Downloads-Dema/memory/` |
| Proof Forge            | `.proof-forge/` + [PROOF_SUMMARY.md](PROOF_SUMMARY.md)                   |
| Founder narrative      | [docs/founder-field-notes/v0.1.md](docs/founder-field-notes/v0.1.md)     |

---

**End of glossary.** If a term in the codebase confuses you and is not defined here, that is a documentation gap worth filing.
