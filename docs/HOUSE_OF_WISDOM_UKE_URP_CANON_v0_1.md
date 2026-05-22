# BIZRA House of Wisdom · UKE · URP Canon v0.1

Status: Working Canon
Date: 2026-05-21
Scope: Constitutional definition of the BIZRA House of Wisdom Layer — UKE as the SAT-governed knowledge cortex inside the URP, with the 8-tier promotion ladder and the system-recursive META_CANON.
Change class: Documentation only · no code · no runtime integration · no ingestion · no model invocation · no URP write · no chain-bound mint · no token/economy claim

## 1. Purpose

This canon defines the BIZRA **House of Wisdom Layer** — the constitutional architecture for shared, verified knowledge in the BIZRA ecosystem.

Before this canon, the architecture had three open questions:

```text
1. Where does shared knowledge live?
2. Who has authority to promote a claim into shared knowledge?
3. How does private discovery become public canon without violating sovereignty?
```

The House of Wisdom canon answers all three:

```text
1. Shared knowledge lives in the UKE knowledge cortex, inside the URP.
2. SAT-5 governs promotion · PAT-7 proposes · Dema displays · the human consents.
3. The 8-tier promotion ladder turns a private RAW_CLAIM into shared META_CANON
   only after explicit, evidenced, consented, SAT-verified passage through every tier.
```

The operating law for this canon is:

```text
PAT may bring seeds.
SAT tests the seed.
UKE remembers the verified seed.
URP becomes the soil.
Dema shows the human what is true, pending, quarantined, or refused.
EvidenceChain proves the path.
The human stays sovereign.
```

## 2. Canonical Definitions

These six terms are now constitutionally locked. Any future doc, code, GTM material, or external claim must use them as defined here. Drift requires an explicit ADR amendment.

### 2.1 UKE — Universal Knowledge Engine / House of Wisdom Cortex

```text
UKE is the SAT-governed House of Wisdom knowledge cortex inside BIZRA URP.
```

UKE is NOT a Dema helper. UKE is NOT a chatbot. UKE is NOT a vector store. UKE is the **persistent, verified, shared knowledge layer** that PAT proposes into, SAT governs, URP shares, Dema displays, and EvidenceChain proves.

Status: **PLANNED** — UKE has no runtime implementation in this repo. The orchestrator substrate that will eventually feed it (`packages/core/src/multi-agent-orchestrator.js`) is SHIPPED as of PR #90. UKE itself is a freeze-point successor item.

### 2.2 URP — Universal Resource Pool

```text
URP is the shared soil where verified knowledge, reusable skills, proofs,
and governed resources live.
```

URP is the **soil**, not a database, not a federation protocol, not a token system. UKE lives inside URP as the knowledge cortex; other URP layers (compute, reusable skills, proof artifacts) sit alongside.

Status: **DISCOVERY_ONLY + PLANNED** — Dema now has a local manifest template and SAT-governed write-boundary discovery slice (`packages/core/src/urp-shared-runtime-discovery.js` + `npm run urp:discovery`). It performs no persist, no network publish, no UKE auto-ingest, no PAT private export, no federation, and no chain-bound mint. The shared URP runtime itself remains freeze-point item #3 and is not connected.

### 2.3 SAT-5 — System Audit Triad (5 verifiers)

```text
SAT is the governance and verification authority.
SAT controls promotion, quarantine, canon acceptance, and URP knowledge hygiene.
SAT does NOT own the human's private local memory.
```

SAT-5 already exists as 5 preview-grade verifier modules:

- `packages/core/src/sat-boundary-verifier.js` (SAT-1)
- `packages/core/src/sat-consent-auditor.js` (SAT-2)
- `packages/core/src/sat-doctrine-compliance.js` (SAT-3)
- `packages/core/src/sat-receipt-chain-verifier.js` (SAT-4)
- `packages/core/src/sat-identity-verifier.js` (SAT-5)

Status: **SHIPPED (preview substrate)** — exposed to operators as of PR #90 via `dema orchestrator verify`. The connection from SAT verdicts to UKE governance is PLANNED.

### 2.4 PAT-7 — Personal Agent Templates (7 proposers)

```text
PAT is the discovery and proposal layer.
PAT may generate candidate insights but cannot directly promote private memory
into UKE / URP.
```

PAT-7 already exists as 7 preview-grade proposer modules:

- `packages/core/src/pat-mission-scribe.js` (PAT-1)
- `packages/core/src/pat-research-companion.js` (PAT-2)
- `packages/core/src/pat-code-apprentice.js` (PAT-3)
- `packages/core/src/pat-memory-curator.js` (PAT-4)
- `packages/core/src/pat-consent-drafter.js` (PAT-5)
- `packages/core/src/pat-receipt-recorder.js` (PAT-6)
- `packages/core/src/pat-reflection-witness.js` (PAT-7)

Status: **SHIPPED (preview substrate)** — PAT-6 has a real `shapeReceiptCandidate()` builder; the others are persona/effect-cap definitions. CLI execution surface for PATs is deferred to v0.2.

### 2.5 Dema — Human-facing Interface

```text
Dema is the human-facing interface.
Dema may show verified, pending, quarantined, or refused knowledge,
but must not silently promote claims.
```

Dema is the **face**, not the engine. Dema renders each tier of the promotion ladder distinctly so the human always knows whether a claim is verified, pending, refused, or shared-canon.

Status: **SHIPPED** — Dema CLI is the live operator surface. The display rules for tier-by-tier rendering of UKE state are PLANNED (will arrive when UKE has implementation).

### 2.6 EvidenceChain — Provenance Spine

```text
EvidenceChain is the provenance spine proving who contributed, what changed,
why it was accepted, who verified it, and what receipts exist.
```

EvidenceChain spans every tier of the promotion ladder. Its first 5 receipts already exist as the live save canon:

- `route-<sha256>.json` (PR #83)
- `invocation-<sha256>.json` (PR #85)
- `verification-<sha256>.json` (PR #87)
- `codebase-map-<sha256>.json` (PR #89)
- `pipeline-<sha256>.json` (PR #90)

Status: **WIRED_PARTIAL** — the receipt-spine substrate is live (5 layers). Cross-tier linkage (RAW_CLAIM through META_CANON) is PLANNED.

## 3. The 8-Tier Promotion Ladder

A claim moves from private discovery to shared canon by passing through eight explicit, evidenced, consented tiers. **No claim may skip a tier.**

```text
RAW_CLAIM
    ▼
LOCAL_CANDIDATE
    ▼
PAT_PROPOSED
    ▼
SAT_QUARANTINED
    ▼
SAT_VERIFIED
    ▼
HOUSE_OF_WISDOM_ACCEPTED
    ▼
URP_SHAREABLE
    ▼
META_CANON
```

### 3.1 Tier definitions

| Tier | Definition | Authority | Receipt expected |
|---|---|---|---|
| **RAW_CLAIM** | Any unstructured assertion: an LLM output, an operator note, an external citation, a heuristic | none (input only) | none |
| **LOCAL_CANDIDATE** | A RAW_CLAIM that has been structured into a schema-tagged artifact in the operator's local environment | operator | local-only · not yet seen by SAT |
| **PAT_PROPOSED** | A LOCAL_CANDIDATE that PAT has shaped into a candidate envelope (e.g. PAT-6 `shapeReceiptCandidate()`) ready for SAT examination | PAT | `bizra.dema.receipt_candidate.v0.1` |
| **SAT_QUARANTINED** | A PAT_PROPOSED candidate currently under SAT-1..5 examination · not yet verified · not yet refused | SAT | per-SAT verdict envelopes (boundary, consent, doctrine, chain, identity) |
| **SAT_VERIFIED** | A candidate that has passed ALL applicable SAT-1..5 verdicts with `passed=true` and `overall_verdict="pipeline_verified"` | SAT | `bizra.dema.orchestrator_verification_pipeline.v0.1` with `passed=true` (PR #90 save layer) |
| **HOUSE_OF_WISDOM_ACCEPTED** | A SAT_VERIFIED claim that has been accepted into UKE as shared verified knowledge · the human has consented to its inclusion · EvidenceChain acceptance entry written | SAT + operator consent | UKE acceptance receipt (PLANNED) |
| **URP_SHAREABLE** | A HOUSE_OF_WISDOM_ACCEPTED claim that has additionally been cleared for URP sharing (anonymization rules applied, public-disclosure boundaries satisfied) | SAT + operator consent | URP-share receipt (PLANNED) |
| **META_CANON** | A claim that is **about the canon system itself** — see §4 | SAT + founder-grade consent + ADR amendment | META_CANON receipt (PLANNED) |

### 3.2 Refusal at each tier

Failure at any tier returns the claim to the previous tier (or earlier) along with a SAT verdict explaining the violation. Refusal is a first-class outcome, not an error. Refusal envelopes are saved with the same atomic-write canon as success envelopes — both are auditable.

## 4. META_CANON Semantics

**META_CANON is system-recursive canon.** It contains the rules that govern how knowledge becomes canon.

### 4.1 What lives in META_CANON

```text
- promotion rules (the 8-tier ladder itself)
- quarantine rules
- SAT-5 authority boundaries
- PAT-7 contribution boundary
- URP sharing boundaries
- human consent requirements
- privacy limits
- evidence requirements
- refusal rules
- canonical truth-label taxonomy (CLAIM_REGISTER)
- ADR amendment protocol
- founder-grade-only protections
```

In short: **META_CANON describes how the House of Wisdom works**, not what it knows.

### 4.2 Why META_CANON exists as a tier

Without META_CANON, the promotion rules themselves would have no canonical home. Three alternatives were considered and rejected:

| Alternative | Why rejected |
|---|---|
| **A. META_CANON = founder-only bedrock** | Makes the rules opaque and personalistic. Mumu's death or absence would freeze the system. Bad for sovereignty propagation. |
| **B. META_CANON = system-recursive** | **CHOSEN.** Rules about the canon system itself are themselves canonical, and themselves must pass SAT verification + founder-grade consent + ADR amendment to change. The rules have rules. |
| **C. drop the tier** | The 7-tier ladder ending at URP_SHAREABLE leaves promotion rules implicit and tribal. Bad for external auditability. |

### 4.3 Constraints on META_CANON entries

Entry into META_CANON requires:

```text
1. SAT-1..5 pipeline PASS
2. Founder-grade typed GO (the strongest consent class)
3. Explicit ADR amendment naming the proposed META_CANON delta
4. EvidenceChain receipt
5. Public-readable rationale (no hidden META_CANON)
```

Once in META_CANON, an entry may only be amended by another META_CANON-class change. **META_CANON edits itself, with the same discipline it requires of every other tier.**

### 4.4 What is NOT META_CANON

```text
- specific knowledge claims about the world  (those are HOUSE_OF_WISDOM_ACCEPTED)
- product roadmap items                      (those are project-status / GTM docs)
- code structure                             (that is architecture)
- aspirational statements                    (those are CANDIDATE)
- founder personal notes                     (those are private LOCAL_CANDIDATE)
```

## 5. SAT Governance Authority

SAT-5 is the **only** layer with authority to promote a claim between tiers. PAT cannot self-promote. UKE cannot self-promote. Dema cannot promote. The human can withhold consent (always), but the human cannot bypass SAT.

### 5.1 SAT controls

```text
- SAT controls promotion between tiers.
- SAT controls quarantine.
- SAT controls shared-canon acceptance.
- SAT controls URP knowledge hygiene.
- SAT controls META_CANON amendments (with founder-grade consent gate).
```

### 5.2 SAT does NOT control

```text
- SAT does not own the human's private local memory.
- SAT does not generate claims (PAT does).
- SAT does not render claims to the human (Dema does).
- SAT does not host shared knowledge (URP/UKE does).
- SAT does not perform chain-bound mints (C12 does, gated by SAT pass).
```

### 5.3 SAT pipeline invocation

As of PR #90, the SAT-1..5 pipeline is operator-invocable via:

```bash
dema orchestrator verify --invocation-file <abs-path> | --latest
                         [--pretty]
                         [--save-pipeline-result --save-pipeline-consent "..."]
```

This is the first operator surface where SAT moved from file-only preview substrate to an operator-invocable preview verifier surface. It is not live UKE authority. The connection from SAT_VERIFIED to HOUSE_OF_WISDOM_ACCEPTED is PLANNED (requires UKE implementation).

## 6. PAT Contribution Boundary

### 6.1 PAT may

```text
- generate candidate insights
- shape RAW_CLAIM into LOCAL_CANDIDATE
- propose LOCAL_CANDIDATE into PAT_PROPOSED via shapeReceiptCandidate() etc.
- submit PAT_PROPOSED artifacts to the SAT pipeline for examination
```

### 6.2 PAT may NOT

```text
- promote its own proposals (PAT cannot move PAT_PROPOSED → SAT_VERIFIED itself)
- bypass SAT examination
- dump private operator memory into URP
- share PAT_PROPOSED candidates externally before SAT pass
- generate META_CANON entries (META_CANON requires SAT pass + founder-grade consent)
```

### 6.3 The PAT privacy contract

```text
Private PAT memory must never be dumped into URP.
```

Only these may enter UKE / URP:

```text
- user-consented knowledge
- redacted patterns
- verified public knowledge
- reusable skills
- proof receipts
- anonymized process insights
- SAT-approved canonical claims
```

Everything else stays local. The human's private memory is sovereign and may never leak through PAT into shared infrastructure.

## 7. Dema Display / Query Boundary

### 7.1 Dema may

```text
- show verified knowledge from UKE (when UKE is implemented)
- show pending claims with their tier
- show quarantined claims with the SAT violation
- show refused claims with the refusal reason
- allow the human to inspect any receipt in EvidenceChain
- relay typed GO consent to SAT / C12
```

### 7.2 Dema may NOT

```text
- silently promote claims between tiers
- display PAT_PROPOSED as if it were SAT_VERIFIED
- display SAT_VERIFIED as if it were HOUSE_OF_WISDOM_ACCEPTED
- render canon claims with their tier removed
- enable "background" knowledge promotion without operator awareness
```

Dema is the **truth-stratifying interface**. Every claim Dema renders carries its tier visibly.

## 8. URP Sharing Boundary

URP is shared infrastructure. By construction, anything that enters URP becomes visible to other nodes (when URP shared runtime is implemented per freeze-point #3).

### 8.1 Required gates before URP_SHAREABLE

```text
1. HOUSE_OF_WISDOM_ACCEPTED status (which itself requires SAT_VERIFIED)
2. Anonymization rules applied (no identifying private content)
3. Public-disclosure boundaries satisfied (CLAIM_REGISTER compliant)
4. Operator-typed GO with sharing scope
5. EvidenceChain receipt of the share decision
```

### 8.2 URP refusal classes

```text
- private memory                  → refused (cannot enter)
- unverified claims               → refused (must pass SAT)
- token/economy claims            → refused (per claim-register)
- federation activation claims    → refused (per ADR-008)
- founder-only meta canon         → refused (META_CANON has its own gate)
```

## 9. Consent and Privacy Rules

### 9.1 The human consent gate is always required

No tier transition above LOCAL_CANDIDATE may complete without explicit operator consent. Consent is exact-string typed (per ADR-005) and recorded in EvidenceChain.

### 9.2 Consent phrasing per tier

```text
PAT_PROPOSED:               "GO: propose <candidate-hash> for SAT examination"
SAT_VERIFIED:               (implicit · SAT runs deterministically; no human typed)
HOUSE_OF_WISDOM_ACCEPTED:   "GO: accept <candidate-hash> into UKE House of Wisdom"
URP_SHAREABLE:              "GO: share <candidate-hash> into URP soil"
META_CANON:                 "GO: amend META_CANON · <delta-summary> · founder-grade"
```

(Exact phrases will be locked when the corresponding tier gains a runtime implementation. This section is the **shape**, not the live grammar.)

### 9.3 Privacy invariants

```text
- private memory stays under $DEMA_HOME / ~/.dema/   (LOCAL ONLY)
- secret-pattern files (.env*, *.pem, id_rsa*) are never read by any tier
- PAT memory curation operates on operator-local data only
- redaction rules apply before any URP_SHAREABLE transition
- no automatic ingestion of operator data into shared knowledge ever
```

## 10. Forbidden Claims

The following claims are **always false** for the foreseeable future and must be flagged by SAT-3 doctrine-compliance:

```text
- "UKE is live"                              (PLANNED)
- "URP shared runtime is connected"          (freeze-point #3, PENDING)
- "BIZRA has minted a canonical receipt"     (freeze-point #4, halt-gate)
- "Federation is operational"                (per ADR-008, not active)
- "PAT-7 swarm is autonomously running"      (PATs are preview substrate)
- "House of Wisdom has accepted X"           (no UKE implementation yet)
- "META_CANON includes X"                    (META_CANON is structurally
                                              defined here; entries are not live)
- "Token economy is live"                    (forbidden per CLAIM_REGISTER)
- "BIZRA is an AGI"                          (forbidden per CLAIM_REGISTER)
```

These are doctrine violations whether stated externally (GTM/Canva/investor) or internally (memory/notes/scripts).

## 11. Operating Law (Compressed)

```text
PAT may bring seeds.
SAT tests the seed.
UKE remembers the verified seed.
URP becomes the soil.
Dema shows the human what is true, pending, quarantined, or refused.
EvidenceChain proves the path.
The human stays sovereign.
META_CANON describes the rules of the system itself.
```

## 12. Relation to Other Canon

This canon sits in the BIZRA constitutional read order between component DNA and the agent-DNA Law of Assumption:

- **Upstream** (must be read first):
  - [Three-Repo Product Stack Canon](THREE_REPO_PRODUCT_STACK_CANON_v0_1.md) — defines which repo holds which authority
  - [Node0 + Dema Complete Component DNA](NODE0_DEMA_COMPLETE_COMPONENT_DNA_v0_1.md) — defines which component is active vs MVP-required vs pilot vs future-forest
  - [BIZRA Root Source of Truth](BIZRA_ROOT_SOURCE_OF_TRUTH_v0_1.md) — defines the moral and origin spine

- **Sibling** (referenced extensively):
  - [CLAIM_REGISTER v0.1](CLAIM_REGISTER_v0_1.md) — truth-label taxonomy + forbidden claims (this canon specializes the UKE/URP rows with 9 House-of-Wisdom forbidden claim examples)
  - [ADR-008 runtime activation](06-adr/ADR-008-runtime-activation.md) — §C5 (SAT-1..5) · §C6 (multi-agent orchestrator) · §C12 (chain-bound mint, halt-gated)
  - [BIZRA Agent DNA Law of Assumption](BIZRA_AGENT_DNA_LAW_OF_ASSUMPTION_v0_1.md) — the agent uncertainty-handling protocol that all PAT/SAT agents follow

- **Downstream** (gated by this canon):
  - `UKE_RUNTIME_INTEGRATION_v0_1` — PLANNED · the first code slice that gives UKE a runtime
  - `URP_SHARED_RUNTIME_DISCOVERY_v0_1` — DISCOVERY_ONLY · manifest template + SAT-governed write boundary · no persist/network/federation
  - `URP_SHARED_RUNTIME_v0_1` — PLANNED · freeze-point item #3
  - `CHAIN_BOUND_MINT_v0_1` — PLANNED · freeze-point item #4, halt-gated by ADR-008 §C12

## 13. Status Labels Across the Layer

Honest summary of what currently exists vs. what is PLANNED:

| Component | Status | Where |
|---|---|---|
| Dema CLI | **SHIPPED** | `apps/cli/src/index.js` · current local test gate: 2443/2443 pass |
| PAT-1..7 substrate | **SHIPPED** (preview) | `packages/core/src/pat-*.js` · CLI execution PLANNED |
| SAT-1..5 substrate | **SHIPPED** (preview) | `packages/core/src/sat-*.js` |
| SAT-1..5 operator CLI | **SHIPPED** (preview verifier surface) | `dema orchestrator verify` (PR #90) |
| Multi-agent orchestrator | **SHIPPED** | `packages/core/src/multi-agent-orchestrator.js` |
| C12 mint-request validator | **SHIPPED** (preview) | `packages/core/src/receipt-mint-integration.js` · actual mint PLANNED |
| EvidenceChain (5 receipt layers) | **SHIPPED** | route + invocation + verification + codebase-map + pipeline |
| UKE knowledge cortex | **PLANNED** | not yet implemented |
| URP shared runtime | **DISCOVERY_ONLY + PLANNED** | `packages/core/src/urp-shared-runtime-discovery.js` + `npm run urp:discovery`; shared runtime remains not connected |
| Chain-bound mint | **PLANNED** | freeze-point item #4 · halt-gated |
| Promotion ladder runtime | **PLANNED** | depends on UKE implementation |
| META_CANON entries | **PLANNED** | tier defined here; entries are not live |

## 14. Refusal-Becomes-Rule Anchor

This canon was written **after** PR #90 made SAT operator-invocable. The sequence matters: the rules of the House of Wisdom were authored only once SAT itself could be exercised. The canon does not run ahead of the substrate. The substrate does not run ahead of consent. Consent does not run ahead of evidence.

Or compressed:

```text
Build the substrate.
Make it operator-invocable.
Then write its rules.
Then propose new substrate against those rules.
```

This is the BIZRA construction discipline — and it is itself a META_CANON entry candidate.

---

**End of v0.1 canon. Amendments require ADR amendment + SAT-1..5 pass + founder-grade typed GO + EvidenceChain receipt.**
