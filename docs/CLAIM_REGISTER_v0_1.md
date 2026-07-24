# Claim Register v0.1

> "The Claim Register does not make BIZRA more mature by declaration. It defines what BIZRA may honestly say, what must remain scenario-labeled, and what must not be claimed until evidence exists."

> "The purpose of this document is to prevent public-face drift before market, GTM, visual emulator, token, URP, or lighthouse-user material is published."

## 1. Purpose

This document is the canonical public-truth gate for Dema and BIZRA. It defines:

- the seven labels every public claim must carry,
- the wording allowed (and forbidden) for each public-claim area,
- the evidence path required to support each claim,
- the review process that binds claims to evidence before publication.

When any contributor, reviewer, designer, or connected LLM is about to write a sentence that may appear on a public surface (README, GTM doc, Canva, landing page, visual emulator, deck, social, lighthouse invitation, market analysis), they consult this Register **first** and only then write the sentence.

## 2. Truth Label

```text
DECLARED_CLAIM_REGISTER_v0_1
```

This label means: the taxonomy and the public claim table below are declared. They are not yet enforced by automated linter. Promotion from declared to enforced requires a future slice (named in Section 24 Deferred Work).

## 3. Scope

In scope:

- Every public-facing surface: README, GTM, Canva, landing page, lighthouse invitation, visual emulator, decks, social, market analysis, public technical narratives.
- Every claim about Dema, Node0, BIZRA, PAT-7, SAT-5, FATE/EffectCap, UKE, URP, Proof-of-Impact, dual token, Agent-as-a-Service, Islamic finance, pilot, scenario projections, founder proof.

Out of scope:

- Internal developer notes, working artifacts under `docs/superpowers/`, research-quarantine notes, ADRs (those are bound by their own canon).
- Private operator-side material that never leaves Node0.
- Quoting forbidden phrases inside this Register or other canon docs **for the purpose of labeling them forbidden** — that use is explicit, not a claim.

## 4. Operating Law

```text
Do not ask people to believe what the system cannot yet prove.
```

```text
And do not hide what is designed, measured, unknown, or forbidden.
```

A public sentence that violates either clause is a claim defect and must be revised before publication. A claim that is true but unlabeled is also a defect — silence about evidence boundary is itself a form of overclaim.

## 5. Relationship to Three-Repo Canon

`docs/THREE_REPO_PRODUCT_STACK_CANON_v0_1.md` assigns authority across the three BIZRA repositories. This Register inherits those boundaries:

- A claim sourced from **Dema** must stay inside Dema's authority (product face, local UX, consent preview, receipt reading).
- A claim that depends on **bizra-data-lake / bizra-omega** must reference the substrate evidence, not restate it as Dema's own.
- A claim attributed to **bizra-node0-genesis** must be labeled archive/R&D source, not active runtime authority.

A Dema public surface may not speak on behalf of a repo whose authority it does not hold.

## 6. Relationship to Component DNA

`docs/NODE0_DEMA_COMPLETE_COMPONENT_DNA_v0_1.md` assigns one status label per component layer (`ACTIVE`, `MVP_REQUIRED`, `PILOT_REQUIRED`, `FUTURE_FOREST`, `RESEARCH_QUARANTINE`, `DESIGNED_NOT_LIVE`). The Register binds those to public-claim labels:

| Component DNA status  | Maximum public claim label                                 |
| --------------------- | ---------------------------------------------------------- |
| `ACTIVE`              | `VERIFIED` or `MEASURED` (with evidence path)              |
| `MVP_REQUIRED`        | `DERIVED` (until shipped, then `VERIFIED`)                 |
| `PILOT_REQUIRED`      | `DESIGNED_NOT_LIVE` (until pilot evidence exists)          |
| `FUTURE_FOREST`       | `DESIGNED_NOT_LIVE` or `SCENARIO` (with assumptions named) |
| `RESEARCH_QUARANTINE` | `FORBIDDEN` on public surfaces                             |
| `DESIGNED_NOT_LIVE`   | `DESIGNED_NOT_LIVE`                                        |

A public claim that exceeds its component's maximum label is a defect.

## 7. Relationship to Delivery Spine

`docs/DELIVERY_SPINE_v0_1.md` Section 22 ("Documentation and Claim Gate") names the seven labels and the high-level forbidden list. This Register is the **authoritative expansion** of that section. When the two differ, this Register governs the wording; the Spine governs the release gate that enforces it.

The Claim Review Gate (Section 20 below) is the operational counterpart to the Spine's Section 22.

## 8. Claim Label Taxonomy

Every public claim is labeled with exactly one of:

| Label               | Meaning                                                                                                             | Allowed pairing                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `VERIFIED`          | Verified by repeatable mechanism with an evidence artifact reachable from the repo (path, hash, or git SHA).        | Confident factual language.                                                  |
| `MEASURED`          | Measured under recorded conditions with a reproducible command. Includes hardware/context and SHA.                  | Numeric / quantitative language.                                             |
| `DERIVED`           | Logically follows from a `VERIFIED` or `MEASURED` claim. The derivation chain is made explicit alongside the claim. | Cautious factual language tied to its premise.                               |
| `SCENARIO`          | Hypothetical, simulated, or scenario-based output. Not a measurement. Assumptions must be named.                    | Scenario / projection language: "if N nodes participate at X uptime, then…". |
| `DESIGNED_NOT_LIVE` | Spec or design exists. No runtime. Must not be presented as live or imminent.                                       | Design language: "designed", "specified", "planned", "not yet live".         |
| `UNKNOWN`           | Honest absence of evidence. Must not be paired with confident language.                                             | "Not yet measured", "we don't know yet", "evidence pending".                 |
| `FORBIDDEN`         | A claim that may not be made anywhere on public surfaces under any wording.                                         | None. Forbidden is forbidden.                                                |

A label is **mandatory** for every public claim. Unlabeled claims are treated as `UNKNOWN` and removed before publication.

`SOURCE_PENDING` is an acceptable temporary marker meaning "evidence path being assembled" — equivalent to `UNKNOWN` for release purposes, with the additional requirement that a follow-up slice opens to find or build the evidence.

## 9. Public Claim Table

Load-bearing surface. Every public surface authors must satisfy this table before shipping.

| Claim area                        | Allowed wording                                                                                                                                                                                       | Required label                                                                                                                                                                                                                                                                                                   | Evidence path                                                                                                                                                         | Forbidden overclaim                                                                                                                                                                                                                                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Dema**                          | "Dema is the local product face of BIZRA Node0." "Dema previews safe next steps and reads receipts."                                                                                                  | `VERIFIED`                                                                                                                                                                                                                                                                                                       | This repo + `ADR-001-dema-is-one-face.md` + dema CLI surfaces                                                                                                         | Presenting Dema as the whole BIZRA system or as the runtime mutator                                                                                                                                                                                                                                                |
| **Node0**                         | "Node0 is one human's machine plus Dema, governed by exact-string consent."                                                                                                                           | `VERIFIED`                                                                                                                                                                                                                                                                                                       | This repo + `NODE0_ACTIVATION_ROADMAP.md` + Component DNA                                                                                                             | Implying Node0 is a federation, a network, or a multi-tenant service                                                                                                                                                                                                                                               |
| **Three-repo stack**              | "Three repos: Dema (product face), bizra-data-lake/omega (runtime/proof substrate), bizra-node0-genesis (archive/R&D)."                                                                               | `VERIFIED`                                                                                                                                                                                                                                                                                                       | `THREE_REPO_PRODUCT_STACK_CANON_v0_1.md`                                                                                                                              | Collapsing the three into one authority                                                                                                                                                                                                                                                                            |
| **Component DNA**                 | "Component DNA labels every Node0/Dema layer as active, MVP-required, pilot-required, future-forest, research-quarantine, or designed-not-live."                                                      | `VERIFIED`                                                                                                                                                                                                                                                                                                       | `NODE0_DEMA_COMPLETE_COMPONENT_DNA_v0_1.md`                                                                                                                           | Claiming components are live when their label says otherwise                                                                                                                                                                                                                                                       |
| **Delivery Spine**                | "Dema has a declared delivery spine that gates branch, PR, merge, release-candidate, and release."                                                                                                    | `VERIFIED`                                                                                                                                                                                                                                                                                                       | `DELIVERY_SPINE_v0_1.md`                                                                                                                                              | Claiming the spine is automated or certified (it is declared, not enforced by linter yet)                                                                                                                                                                                                                          |
| **Founder proof**                 | "Node0 was built by one human across several years of solo work, captured in this repo's commit history and inventory artifacts."                                                                     | `DERIVED`                                                                                                                                                                                                                                                                                                        | git history + founder asset inventory ladder (memory: `project_founder_asset_inventory_v0_3`)                                                                         | Inflated hour/repo/data figures without an evidence path                                                                                                                                                                                                                                                           |
| **Origin Video 001**              | "Origin Video 001 is referenced as a foundational artifact. The primary artifact is hash-bound; the 2023-08-31 creation date is derived from a filename-embedded timestamp and not yet corroborated." | `VERIFIED` (file identity: path + sha256) · `DERIVED` (date, from filename-embedded ms timestamp `1693522543490` → 2023-08-31 UTC; single witness) · `DERIVED_STRONG` (Google AI Studio production tool, from folder + filename convention) · `SOURCE_PENDING` (public release status, pristine-original status) | `BIZRA_ORIGIN_VIDEO_001_CANON_v0_1.md` §6 Artifact Identity + §22 Evidence Binding v0.2 (path + sha256 + decoded timestamp); no media binaries committed to this repo | Claiming 2023-08-31 as `VERIFIED` from filename alone; claiming Google AI Studio provenance as `VERIFIED` without corroboration; claiming any public release; using Claude upload history as evidence; presenting either Downloads-folder derivative (`_restyled.mp4` or `My Video-2.mp4`) as the primary artifact |
| **Visual Emulator**               | "The visual emulator illustrates Node0 + forest behavior as scenario, not as measurement."                                                                                                            | `DESIGNED_NOT_LIVE` or `SCENARIO`                                                                                                                                                                                                                                                                                | Component DNA Section 18; future `BIZRA_VISUAL_EMULATOR_SPEC_v0_1.md`                                                                                                 | Presenting emulator output as measured live network behavior                                                                                                                                                                                                                                                       |
| **PAT-7**                         | "PAT-7 is the seven-Personal-Agent proposal layer; preview modules exist, but PAT may discover and propose only, never finalize."                                                                     | `DESIGNED_NOT_LIVE`                                                                                                                                                                                                                                                                                              | Component DNA Section 9 + House of Wisdom Canon Sections 2.4 and 6                                                                                                    | Claiming an autonomous PAT swarm, PAT promotion authority, or PAT actions without SAT/receipt cover                                                                                                                                                                                                                |
| **SAT-5**                         | "SAT-5 is the five-Sovereign-Agent governance layer; preview verifier modules exist, but SAT is not a live UKE/URP authority."                                                                        | `DESIGNED_NOT_LIVE`                                                                                                                                                                                                                                                                                              | Component DNA Section 10 + House of Wisdom Canon Sections 2.3 and 5                                                                                                   | Naming SAT as live shared-canon authority before UKE/URP runtime ships                                                                                                                                                                                                                                             |
| **UKE House of Wisdom**           | "UKE is the designed SAT-governed House of Wisdom knowledge cortex inside URP; no UKE runtime exists in this repo."                                                                                   | `DESIGNED_NOT_LIVE`                                                                                                                                                                                                                                                                                              | Component DNA Section 13 + House of Wisdom Canon Sections 2.1 and 13                                                                                                  | Claiming UKE is live, has accepted claims, or stores shared knowledge today                                                                                                                                                                                                                                        |
| **URP Soil**                      | "URP is the designed shared substrate; the House of Wisdom canon defines UKE inside URP, but shared URP runtime is not connected."                                                                    | `DESIGNED_NOT_LIVE`                                                                                                                                                                                                                                                                                              | Component DNA Section 14 + topology canon + House of Wisdom Canon Sections 2.2 and 8                                                                                  | Claiming a live public URP, connected shared runtime, or URP marketplace                                                                                                                                                                                                                                           |
| **House of Wisdom / META_CANON**  | "The House of Wisdom canon defines an 8-tier promotion ladder ending in META_CANON; no runtime promotion ladder or META_CANON entries are live."                                                      | `DESIGNED_NOT_LIVE`                                                                                                                                                                                                                                                                                              | House of Wisdom Canon Sections 3 and 4                                                                                                                                | Claiming "House of Wisdom accepted X" or "META_CANON includes X" as a live fact                                                                                                                                                                                                                                    |
| **Proof-of-Impact**               | "Proof-of-Impact is the designed outcome-bound reward signal; depends on UKE + URP runtime."                                                                                                          | `DESIGNED_NOT_LIVE`                                                                                                                                                                                                                                                                                              | Component DNA Section 15                                                                                                                                              | Implying PoI rewards are live or guaranteed                                                                                                                                                                                                                                                                        |
| **Dual token economy**            | "BZR-C capacity token and BZR-I impact token are designed concepts; local outputs are simulation-only previews; no live economic layer."                                                              | `DESIGNED_NOT_LIVE` (research-quarantine for value language)                                                                                                                                                                                                                                                     | `docs/02-architecture/DUAL_TOKEN_POI_ECONOMY_v0_1.md` + Component DNA Section 16 (RESEARCH_QUARANTINE)                                                                 | Any token value, market, yield, rebate, guaranteed reward, wallet, sale, or live mint claim                                                                                                                                                                                                                        |
| **Agent-as-a-Service**            | "AaaS is the designed URP capability; no live marketplace."                                                                                                                                           | `DESIGNED_NOT_LIVE`                                                                                                                                                                                                                                                                                              | Component DNA Section 14                                                                                                                                              | Claiming a live marketplace, listings, or service catalog                                                                                                                                                                                                                                                          |
| **Islamic finance**               | "BIZRA's design uses Islamic finance principles as design constraints (no riba, fairness/ʿadl, sovereignty)."                                                                                         | `DESIGNED_NOT_LIVE` for compliance status                                                                                                                                                                                                                                                                        | Constitutional anchors in canon                                                                                                                                       | Sharia certification, halal investment status, religious compliance certification                                                                                                                                                                                                                                  |
| **5-node pilot**                  | "A 5-node pilot is planned and not yet executed; outcomes will be measured by receipts."                                                                                                              | `DESIGNED_NOT_LIVE`                                                                                                                                                                                                                                                                                              | Future `FIVE_NODE_PILOT_PROTOCOL_v0_1.md`                                                                                                                             | Implying the pilot has run or that any number has been measured                                                                                                                                                                                                                                                    |
| **1M / 100M / 1B node scenarios** | "If N nodes participate at assumed uptime U and sharing rate S, then …"                                                                                                                               | `SCENARIO` (assumptions named inline)                                                                                                                                                                                                                                                                            | None as measurement; assumptions documented in scenario context                                                                                                       | Presenting scenario numbers as production-scale measurement                                                                                                                                                                                                                                                        |
| **Canva / public-face assets**    | Whatever appears in a Canva asset must already be present in this Register with an allowed label.                                                                                                     | (label of the underlying claim)                                                                                                                                                                                                                                                                                  | Each asset cites the Register entry it relies on                                                                                                                      | Marketing copy that outruns the underlying claim's label                                                                                                                                                                                                                                                           |
| **GitHub proof path**             | "Doctrine, gates, receipts, and proof artifacts are publicly readable in the Dema repository."                                                                                                        | `VERIFIED`                                                                                                                                                                                                                                                                                                       | `github.com/BizraInfo/Dema` + `proof-of-priority/`                                                                                                                    | Implying receipts on GitHub are mints by Dema (they are not; governed runtime mints)                                                                                                                                                                                                                               |

A new public-claim area not in this table is treated as `UNKNOWN` until added.

### 9.1 bizra.ai containment incident — 2026-07-24

The live `bizra.ai` deployment was observed publishing unsupported or unbound
claims:

- [MEASURED] Observed text included “Live Receipt Chain” and “Live Network Data.”
- [MEASURED] Observed text included pinned metrics, absolute enforcement wording, and identity-adjacent Ed25519 wording.
- [MEASURED] Observed presentation implied live economic and URP capability.
- [MEASURED] Unauthenticated API responses exposed unbound health, ethics, hardware, model, persistence, and scaffold claims.

The governing dispositions are:

| Surface | Canonical claim disposition | Current authority |
| --- | --- | --- |
| Initial `bizra.ai` pages and unauthenticated API output observed on 2026-07-24 | `UNKNOWN` where evidence was absent; `FORBIDDEN` where live economy, URP, or federation was implied | Historical release-blocking defect; not approved for reuse |
| Inspected `award-winner-design` source at `568ab0b41c32f812b8ce4d20e7f4ffdf1ebffd6e` | `VERIFIED` as a source-review anchor only | Does not prove which SHA Vercel deployed |
| Containment source on `fix/public-claim-binding-1a` | `VERIFIED` as source presence | Site PR #7 merged review head `ebb5cc42082a7348014fe50fd4b584ccbddbbdc7` as `6f7f545e6a1ac044cbb8d29a0a215e8a9f2885bf` |
| GitHub `Production – award-winner-design` deployment record | `VERIFIED` within the record's scope | GitHub deployment `5590104450` reports success at `6f7f545e6a1ac044cbb8d29a0a215e8a9f2885bf`; its environment URL is a Vercel deployment URL, not the `bizra.ai` alias |
| Corrected `bizra.ai` public surface | `MEASURED`; exact-source relationship `DERIVED` | The `2026-07-24T16:18:28.000Z` 62-surface crawl has zero known forbidden-phrase, private-200, or containment failures; a separate `2026-07-24T16:24:43.000Z` raw-body scan has zero public receipt-link or revoked-key-link matches. A live same-origin runtime asset embeds deployment identifier `dpl_C7hFkz6LZRSPK1XMHAXUYwJRJj2R`, matching the exact-commit Vercel status and deployment `5590104450`; the provider alias API was not readable, so the relationship is not promoted to `VERIFIED`. |
| New signed public Claim Receipt | `UNKNOWN` | Not issued while signer rotation is pending |

The containment boundary uses these stable claim identifiers. Their evidence
links pin the exact commit containing this incident record:

| Claim ID | Public statement boundary | Canonical label | Evidence and limit |
| --- | --- | --- | --- |
| `BIZRA-PUBLIC-001` | Dema is the local-first product face that reads local state, explains it, and previews safe next steps. | `VERIFIED` | Exact incident-record commit [`26bb57359186a3ab533dd51e3623e0c84d5078e9`](https://github.com/BizraInfo/Dema/blob/26bb57359186a3ab533dd51e3623e0c84d5078e9/docs/audits/BIZRA_AI_PUBLIC_CLAIM_CONTAINMENT_1A.md) and [Current Limits at the same commit](https://github.com/BizraInfo/Dema/blob/26bb57359186a3ab533dd51e3623e0c84d5078e9/docs/CURRENT_LIMITS.md); this does not make Dema the whole BIZRA system or a governed runtime. |
| `BIZRA-PUBLIC-002` | Federation, cross-node synchronization, shared URP runtime, token economics, and Proof-of-Impact rewards are not live. | `DESIGNED_NOT_LIVE` | Exact incident-record commit [`26bb57359186a3ab533dd51e3623e0c84d5078e9`](https://github.com/BizraInfo/Dema/blob/26bb57359186a3ab533dd51e3623e0c84d5078e9/docs/audits/BIZRA_AI_PUBLIC_CLAIM_CONTAINMENT_1A.md) and [Current Limits hard non-claims at the same commit](https://github.com/BizraInfo/Dema/blob/26bb57359186a3ab533dd51e3623e0c84d5078e9/docs/CURRENT_LIMITS.md). |
| `BIZRA-PUBLIC-003` | The currently trusted public signing identity is not asserted while signer rotation remains pending. | `UNKNOWN` | TASK-029 remains open; no new public Claim Receipt is issued by this slice. |
| `BIZRA-PUBLIC-004` | A health response is only a request-time observation of the web process. | `MEASURED` | Requires `measured_at`, scope `web_process_health_only`, and exact incident-record commit [`26bb57359186a3ab533dd51e3623e0c84d5078e9`](https://github.com/BizraInfo/Dema/blob/26bb57359186a3ab533dd51e3623e0c84d5078e9/docs/audits/BIZRA_AI_PUBLIC_CLAIM_CONTAINMENT_1A.md) in the response; it does not prove Node0, federation, persistence, or full-system health. |
| `BIZRA-PUBLIC-005` | A beta-status or successful beta-admission response is only a request-time observation of the web access gate. | `MEASURED` | Requires `measured_at`, scope `web_access_gate_only`, and exact incident-record commit [`26bb57359186a3ab533dd51e3623e0c84d5078e9`](https://github.com/BizraInfo/Dema/blob/26bb57359186a3ab533dd51e3623e0c84d5078e9/docs/audits/BIZRA_AI_PUBLIC_CLAIM_CONTAINMENT_1A.md) in the response; it does not prove node activation or runtime capability. |

The route/source/evidence inventory, exact claim dispositions, local candidate
paths, receipt boundary, and closure gates are recorded in
[`audits/BIZRA_AI_PUBLIC_CLAIM_CONTAINMENT_1A.md`](audits/BIZRA_AI_PUBLIC_CLAIM_CONTAINMENT_1A.md).

`LOCAL_ONLY` in this incident record is a distribution qualifier, not an
additional claim label. The seven-label taxonomy in Section 8 remains exact.
No local branch, test result, or documentation edit may be described as a live
public correction before the post-deploy gates pass.

## 10. Forbidden Claims

These claims are **forbidden** on every public surface (README, GTM, Canva, landing page, lighthouse invitation, visual emulator, decks, social, market analysis, public technical narrative) until proof exists. Quoting them in this Register or in other canon docs **for the purpose of labeling them forbidden** is explicit and allowed.

- Do not claim public URP is live before pilot proof.
- Do not claim token value, guaranteed rewards, or investment return.
- Do not claim Sharia certification before expert review.
- Do not claim 1M-node, 100M-node, or 1B-node performance as measured fact.
- Do not claim production federation before validated multi-node pilot.
- Do not claim UKE House of Wisdom is a live shared runtime if it is only canon/design.
- Do not claim Proof-of-Impact rewards are live if they are sandbox/design only.
- Do not claim Dema is the whole BIZRA system.
- Do not claim bizra-node0-genesis is active runtime authority.
- Do not claim private PAT memory enters URP/UKE by default.
- Do not present visual emulator projections as measured results.
- Do not claim URP shared runtime is connected before the shared-runtime proof gate.
- Do not claim BIZRA has minted a canonical receipt from Dema.
- Do not claim federation is operational before validated multi-node proof.
- Do not claim PAT-7 swarm is autonomously running.
- Do not claim House of Wisdom has accepted any specific claim before UKE implementation and acceptance receipts exist.
- Do not claim META_CANON contains specific entries beyond the structural tier defined in the House of Wisdom canon.

A surface that contains a forbidden claim is a release-blocking defect. It is not negotiable by tone or framing.

## 11. Conditional Claims

A conditional claim is a claim that becomes allowed when a named precondition is met. Each conditional claim must declare the precondition explicitly and the surface where the claim will be promoted.

| Conditional claim                                   | Becomes allowed when                                                                         | Surface                    |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------- |
| "Lighthouse pilot completed N=K external operators" | When K external operators have completed a Lighthouse session and minted receipts            | Lighthouse invitation, GTM |
| "URP live"                                          | When the first external operator has joined a live URP and a receipt chain captures the join | URP doc, GTM               |
| "5-node pilot results: X / Y / Z"                   | When the pilot has run end-to-end with receipts captured for every node                      | Pilot protocol doc, GTM    |
| "Proof-of-Impact rewarded contribution C"           | When a PoI receipt has been minted and verified against an evidence chain                    | PoI doc, GTM               |
| "Dual token issued under audited terms"             | When legal review + technical validation + Sharia review are documented and reproducible     | Token doc, GTM             |

A conditional claim phrased without its precondition is an overclaim.

## 12. Scenario Claims

```text
Scenario claims must name their assumptions. If a number depends on assumed node count,
assumed resource sharing, assumed uptime, assumed network efficiency, or assumed
participation, it must be labeled SCENARIO.
```

A scenario claim must:

- be labeled `SCENARIO`,
- name every assumption inline (no hidden parameters),
- distinguish itself from measurement in tone and visual treatment,
- never appear next to a measured number without a clear visual or textual boundary.

A scenario chart in a deck or Canva asset must include the words "scenario", "if", or "projection" in its title or caption.

## 13. Economic and Token Claims

```text
BZR-C capacity token and BZR-I impact token are designed concepts
unless and until a live, legally reviewed, technically validated economic layer exists.
```

```text
Proof-of-Impact may be discussed as designed or sandboxed, but not as a live reward
guarantee unless evidence exists.
```

Forbidden economic wording on public surfaces (until evidence exists):

- "token price"
- "token value"
- "guaranteed rewards"
- "passive income"
- "investment return"
- "yield"
- "rebate"
- "buyback"
- "burn" (as economic mechanism claim)
- "listing"
- "pre-sale"
- "airdrop" (as commitment)

Allowed: design discussion using `DESIGNED_NOT_LIVE` framing, explicitly bounded by the conditional-claim row in Section 11.

## 14. Islamic Finance Claims

```text
BIZRA may describe Islamic finance principles as design constraints. BIZRA must not claim
Sharia certification, halal investment status, or religious compliance certification before
expert review and documented approval.
```

Allowed:

- "BIZRA's design uses Islamic finance principles as design constraints."
- "BIZRA's design intends to avoid riba and to keep distribution bounded by fairness/ʿadl."
- "BIZRA's design references Quran/Hadith-anchored sovereignty."

Forbidden (until expert review + documented approval):

- "Sharia certified"
- "halal investment"
- "compliant with Islamic finance"
- "approved by [scholar/board]" (when no such approval exists)
- religious authority attribution that has not been given

## 15. URP / UKE / PoI Claims

Until pilot evidence exists and a live runtime ships, all URP, UKE, and PoI claims are bounded by `DESIGNED_NOT_LIVE`.

Allowed:

- "URP is the designed shared substrate."
- "UKE is the designed SAT-governed House of Wisdom knowledge cortex inside URP."
- "The House of Wisdom canon defines a promotion ladder; the runtime ladder is not live."
- "Proof-of-Impact is the designed outcome-bound reward signal."

Forbidden:

- "URP is live."
- "URP shared runtime is connected."
- "URP marketplace is open."
- "UKE remembers your contributions across the forest." (as live behavior)
- "UKE is live."
- "House of Wisdom has accepted X."
- "META_CANON includes X." (unless X is the structural tier definition in the canon itself)
- "PoI pays contributors." (as live)
- "PoI guarantees reward."

A diagram that shows URP/UKE/PoI **must** carry a `DESIGNED_NOT_LIVE` watermark or caption.

## 16. Node0 / Dema Claims

Allowed (per `ACTIVE` rows in Component DNA):

- "Dema previews safe next steps."
- "Dema reads receipts written by the governed runtime."
- "Node0 is one human's machine plus Dema, governed by exact-string consent."
- "All local state is under `DEMA_HOME` or `~/.dema`."
- "There is no hidden daemon."

Forbidden:

- "Dema is the whole BIZRA system."
- "Dema mints runtime receipts." (Dema reads; the governed runtime mints.)
- "Dema is federated." (single-node by definition at v0.1)
- "Node0 is a network." (Node0 is one node.)

## 17. Founder Proof Claims

Allowed bounded language, with required labels per evidence presence:

| Claim                             | Required label if evidence path in this repo is named | Required label if evidence path is not yet named                  |
| --------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------- |
| "One human / Node0 founder proof" | `VERIFIED`                                            | `DERIVED`                                                         |
| "Three years of solo work"        | `DERIVED` (from git history span)                     | `SOURCE_PENDING`                                                  |
| "15,000+ hours"                   | `DERIVED` if a documented time ledger exists          | `SOURCE_PENDING`                                                  |
| "155+ repos"                      | `DERIVED` if an inventory artifact lists ≥155         | `SOURCE_PENDING`                                                  |
| "600 GB+ R&D"                     | `DERIVED` if `du -sh` or inventory evidence is named  | `SOURCE_PENDING`                                                  |
| "5,000+ model conversations"      | `DERIVED` if an inventory artifact lists ≥5000        | `SOURCE_PENDING` (memory notes ~27044 msgs; verify before citing) |

Rule: **if an evidence path is not present in repo docs, label as `DERIVED` or `SOURCE_PENDING`, not `VERIFIED`.** The number itself is allowed; the label discipline is non-negotiable.

## 18. Visual Emulator Claims

Allowed:

- "The visual emulator illustrates Node0 + forest behavior as scenario, not as measurement."
- "The emulator output is generated from documented assumptions; assumptions are listed alongside every frame."

Forbidden:

- Presenting emulator output as measured live network behavior.
- Using emulator screenshots as proof of network state.
- Stripping the "scenario" caption when reusing an emulator frame in any other asset.

The emulator spec (future `BIZRA_VISUAL_EMULATOR_SPEC_v0_1.md`) will bind every emulator frame to a `SCENARIO` label and its assumption set.

## 19. Market and GTM Claims

Allowed:

- claims grounded in the Public Claim Table rows above, with their declared labels,
- comparative statements that cite the source they compare to,
- positioning statements that name the design constraint they reflect.

Forbidden:

- "BIZRA is the only sovereign AI infrastructure." (overclaim absent comparative evidence)
- "BIZRA solves the trust problem in AI." (vague universal claim)
- "BIZRA replaces Web2 / Web3." (positioning collapse)
- Any claim that depends on a competitor's market state without that competitor's data path cited.

The future `BIZRA_MARKET_ANALYSIS_v0_1.md` must cite sources for every comparative claim and inherit the labels of this Register.

## 20. Claim Review Gate

A claim is publishable only after this 7-step gate is satisfied:

1. **Identify the claim** — extract the exact sentence about to be published.
2. **Assign a truth label** — exactly one of the seven from Section 8.
3. **Identify the evidence path** — repo file, commit SHA, receipt hash, external citation, or `SOURCE_PENDING`.
4. **Check the forbidden overclaim list** — Section 10 + the claim-area row in Section 9.
5. **Check the Delivery Spine** — confirm the claim passes the Spine's Section 22 Claim Gate and matches the claim-area's allowed wording.
6. **If public-facing, require human/operator approval** — the operator types explicit consent that the claim may ship.
7. **If economic / religious / legal, require expert review** — no certification language ships without documented expert sign-off.

The gate is sequential. A claim that fails any step is revised or removed before publication.

## 21. Claim Receipt Template

Every claim shipped to a public surface records a Claim Receipt, drafted in this repo and handed to the governed runtime for issuance.

```yaml
claim_receipt:
  schema: bizra.dema.claim_receipt.v0.1
  claim_id: # e.g. cr-2026-05-21-001
  claim_text: # exact sentence as published
  claim_area: # one of the rows in Section 9
  truth_label: # VERIFIED | MEASURED | DERIVED | SCENARIO | DESIGNED_NOT_LIVE | UNKNOWN | FORBIDDEN | SOURCE_PENDING
  evidence_path: # repo path | commit SHA | receipt hash | external URL | SOURCE_PENDING
  reviewer: # operator or named reviewer
  risk: # low | medium | high — what happens if this claim drifts
  allowed_public_wording: # the exact wording that may be reused
  forbidden_wording: # specific phrasings ruled out for this claim
  operator_approval:
    typed_consent: "" # exact string the operator typed
    timestamp: "" # UTC ISO 8601
  notes: ""
```

A public surface without an underlying Claim Receipt for each non-trivial claim is incomplete.

## 22. Examples

### Example A — Founder hours

- Raw temptation: "BIZRA represents 15,000 hours of solo work."
- Gate check: evidence path? — no documented time ledger in this repo at v0.1.
- Outcome: label `SOURCE_PENDING`. Allowed wording: "Node0 represents several years of solo work captured in this repository's commit history" (label `DERIVED`).
- Forbidden: stating "15,000 hours" without an artifact that supports it.

### Example B — URP

- Raw temptation: "Join the BIZRA URP to share your idle compute and earn impact tokens."
- Gate check: URP status = `DESIGNED_NOT_LIVE`; token economy is `RESEARCH_QUARANTINE`.
- Outcome: forbidden as written. Allowed: "URP is the designed shared substrate; the first live join will be announced after pilot evidence."

### Example C — Scenario

- Raw temptation: "BIZRA can scale to 1M nodes."
- Gate check: scenario without assumptions named.
- Outcome: revise to: "Scenario: if 1,000,000 nodes participate at U=70% uptime and S=20% resource sharing, then …" with label `SCENARIO` and the assumption set named inline.

### Example D — Islamic finance

- Raw temptation: "BIZRA is Sharia-compliant."
- Gate check: no documented expert review on record.
- Outcome: forbidden. Allowed: "BIZRA's design uses Islamic finance principles as design constraints; compliance certification is pending expert review."

### Example E — Visual emulator

- Raw temptation: A Canva slide showing 100,000 nodes pulsing with the title "BIZRA Network."
- Gate check: emulator output without `SCENARIO` caption.
- Outcome: forbidden as titled. Allowed: same image with the title "Scenario: 100,000-node network at assumed parameters" and the assumption set listed below.

## 23. Explicit Non-Goals

This slice does **not**:

- create a claim-lint script (deferred — see Section 24),
- edit any GitHub Actions workflow,
- mint any claim receipt (the template is the artifact; issuance is governed-runtime),
- write any market-analysis content beyond the claim taxonomy (`BIZRA_MARKET_ANALYSIS_v0_1.md` is a separate future slice),
- write any public launch copy beyond the examples in Section 22,
- activate any token, URP, UKE, PoI, or federation surface,
- claim Sharia certification, halal status, or religious compliance,
- replace `DELIVERY_SPINE_v0_1.md` Section 22 (this Register expands it; both coexist).

## 24. Deferred Work

Named and deferred, not abandoned:

- **`scripts/claim-lint.mjs`** — automated scanner that walks `README.md`, `docs/public/**`, `docs/market/**`, and any future Canva-export directory, flagging:
  - sentences that look like claims but carry no label,
  - phrases on the forbidden list (Section 10 + 13 + 14 + 15 + 18 + 19),
  - claims whose label exceeds their underlying Component DNA status.
- **Claim Receipt generator** — scaffolds the Section 21 template from a changed-files set.
- **`docs/public/BIZRA_2026_FIRST_LOOK_NARRATIVE_v0_1.md`** — public narrative, written after this Register exists so every sentence carries a label.
- **`docs/public/NODE0_FOUNDER_PROOF_AND_HUMAN_CHOICE_v0_1.md`** — founder proof, sourced from inventory artifacts; labels per Section 17.
- **`docs/public/DEMA_PRODUCT_BRIEF_v0_1.md`** — Dema product brief; labels per Section 16.
- **`docs/market/BIZRA_MARKET_ANALYSIS_v0_1.md`** — market analysis with citations per Section 19.
- **`docs/market/BIZRA_GTM_MASTER_PLAN_v0_1.md`** — GTM plan with per-claim labels.
- **`docs/public/BIZRA_VISUAL_EMULATOR_SPEC_v0_1.md`** — emulator spec; binds every frame to `SCENARIO` per Section 18.
- **`docs/pilot/FIVE_NODE_PILOT_PROTOCOL_v0_1.md`** — pilot protocol.
- **`docs/economy/BIZRA_ECONOMY_TRUTH_BOUNDARY_v0_1.md`** — economy boundary doc; expansion of Section 13.

Each deferred item is a separate future slice that consults this Register before its first sentence is written.

## 25. Next Canon Slices

This Claim Register depends on and points forward to:

- `docs/THREE_REPO_PRODUCT_STACK_CANON_v0_1.md` — repo authority.
- `docs/NODE0_DEMA_COMPLETE_COMPONENT_DNA_v0_1.md` — component status labels.
- `docs/DELIVERY_SPINE_v0_1.md` — gate that enforces this Register at release time.
- `docs/HOUSE_OF_WISDOM_UKE_URP_CANON_v0_1.md` — UKE/URP promotion ladder, META_CANON, consent, and House-of-Wisdom forbidden claims.
- `docs/06-adr/ADR-001-dema-is-one-face.md` — Dema-is-one-face binding.
- `docs/06-adr/ADR-005-operator-actions-require-explicit-consent.md` — consent law.
- `docs/06-adr/ADR-006-continuous-assurance-and-no-mint-verification.md` — no-mint posture.
- `docs/RECEIPTS.md` — receipt boundary.
- `docs/LIGHTHOUSE.md` — private lighthouse operator lane.
- Future `docs/economy/BIZRA_ECONOMY_TRUTH_BOUNDARY_v0_1.md`.
- Future `docs/public/BIZRA_VISUAL_EMULATOR_SPEC_v0_1.md`.

The load-bearing surfaces of this Register are Section 9 (Public Claim Table), Section 10 (Forbidden Claims), Section 20 (Claim Review Gate), and Section 21 (Claim Receipt Template). The other sections explain them. When this Register changes, every public-face deferred slice in Section 24 is re-read for drift.
