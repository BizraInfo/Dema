# Dema Documentation Index

This index is the clean map for the repo. It separates current user-facing docs, architecture decisions, proof material, quality gates, and historical references so readers do not have to guess which file is authoritative.

## Fast reading paths

| Reader               | Start here                                                 | Then read                                                                                                                                                                                                          |
| -------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Normal user          | [USER_LIFECYCLE.md](USER_LIFECYCLE.md)                     | [FIRST_RUN_WIZARD.md](FIRST_RUN_WIZARD.md), [RECEIPTS.md](RECEIPTS.md)                                                                                                                                             |
| Developer            | [ARCHITECTURE.md](ARCHITECTURE.md)                         | [ENGINEERING_DISCIPLINE.md](ENGINEERING_DISCIPLINE.md), [DELIVERY_BLUEPRINT.md](DELIVERY_BLUEPRINT.md)                                                                                                             |
| LLM / agent          | [LLM_SYSTEM_FLOW.md](LLM_SYSTEM_FLOW.md)                   | [ARCHITECTURE.md](ARCHITECTURE.md), [TESTING.md](TESTING.md)                                                                                                                                                       |
| Security reviewer    | [SECURITY.md](../SECURITY.md)                              | [06-adr/ADR-005-operator-actions-require-explicit-consent.md](06-adr/ADR-005-operator-actions-require-explicit-consent.md), [02-architecture/dema-autonomy-envelope.md](02-architecture/dema-autonomy-envelope.md) |
| Product/GTM reviewer | [PRODUCT.md](PRODUCT.md)                                   | [GTM.md](GTM.md), [LIGHTHOUSE.md](LIGHTHOUSE.md), [ROADMAP.md](ROADMAP.md)                                                                                                                                         |
| Proof auditor        | [../proof-of-priority/PIN.md](../proof-of-priority/PIN.md) | [PRIORITY_ANCHOR.md](PRIORITY_ANCHOR.md), [../SPROUT_PIN.md](../SPROUT_PIN.md)                                                                                                                                     |

## Current public front doors

- [BIZRA_NODE0_DEMA_GOAL_SCRIPT_v0_1.md](BIZRA_NODE0_DEMA_GOAL_SCRIPT_v0_1.md) — north-star goal for BIZRA Node0 + DEMA. Operating law, A+ quality definition, mission lifecycle, flagship test. Companion to CURRENT_LIMITS and PRODUCT.
- [genesis/BIZRA_GENESIS_BLOCK_v0.1.md](genesis/BIZRA_GENESIS_BLOCK_v0.1.md) — Genesis Block proof contract for BIZRA Node0: seed-before-forest, remote-green baseline, Node0/Dema/URP/5SAT/Covenant/Proof-before-Mint boundaries, and non-claims before Node1.
- [NODE0_DEMA_URP_FLAGSHIP_DOD.md](NODE0_DEMA_URP_FLAGSHIP_DOD.md) — Definition of Done for the Node0 + Dema + URP flagship loop: clean-state replay gates, 5SAT local declaration, Covenant prototype, receipt proof, public bridge spec, Node1 handshake hold, and economy quarantine.
- [claims/CLAIMS_LEDGER_IMPACT_LAUNCHPAD_v0.1.md](claims/CLAIMS_LEDGER_IMPACT_LAUNCHPAD_v0.1.md) — docs-only claims ledger for Impact Launchpad language: source chain, seed claim rows, Proof-of-Truth gates, SNR filter, non-claims, and promotion rules before any PoI, token, reward, marketplace, or public economic claim.
- [NODE0_MASTER_CRAFTSMANSHIP_CHECKLIST.md](NODE0_MASTER_CRAFTSMANSHIP_CHECKLIST.md) — evidence-bound Genesis Node completion scorecard: master flywheel acceptance test, domain scorecard, forbidden overclaims, and next implementation spearpoint.
- [NODE0_MASTER_PLAN_v0_1.md](NODE0_MASTER_PLAN_v0_1.md) — ordered, exit-gated build sequence to Block0 seal (Phases A→E + SEAL), disk-anchored current truth, critical path, non-goals, halt gates.
- [02-architecture/NODE0_OSTREE_TAD_v0_1.md](02-architecture/NODE0_OSTREE_TAD_v0_1.md) — OSTree-model technical architecture: maps the content-addressed signed receipt chain / Block0 to OSTree (object store, commit, fsck, deployment), then proposes the stdlib composition manifest before any libostree adoption.
- [../README.md](../README.md) — product landing page, 5-command first run, command reference, diagrams.
- [PRODUCT.md](PRODUCT.md) — public product page (what Dema is, what it isn't, who it's for, how to verify).
- [CURRENT_LIMITS.md](CURRENT_LIMITS.md) — honest map of what is MEASURED, DESIGNED_NOT_LIVE, PLANNED, and LOCAL_ONLY. Read this before quoting Dema in a slide.
- [USER_LIFECYCLE.md](USER_LIFECYCLE.md) — nontechnical end-to-end local journey.
- [FIRST_RUN_WIZARD.md](FIRST_RUN_WIZARD.md) — in-product first-run screen spec.
- [ECOSYSTEM.md](ECOSYSTEM.md) — Dema's place inside BIZRA, Node0, and future nodes.
- [RECEIPTS.md](RECEIPTS.md) — local receipt viewer model and ARTIFACT-011 boundary.

## Product and market docs

- [PRODUCT.md](PRODUCT.md) — concise product strategy.
- [GTM.md](GTM.md) — first offer, audience, forbidden claims, Node1/Node2 boundary.
- [gtm/BIZRA_90_Day_GTM_v0_1.md](gtm/BIZRA_90_Day_GTM_v0_1.md) — strategic 90-day GTM plan with v0.1.8 current-state drift closure (HEAD `004e887`, `2443/2443` tests), GTM readiness gate, URP discovery gate, Proof Room Bundle gate (`npm run proof:room`), open operator gate reporting, phase-status reporting, private Phase 1 evidence metadata scanning, and a Phase 1 success-criteria ledger.
- [gtm/BIZRA_OPEN_SOURCE_ENGAGEMENT_AND_BUSINESS_MODEL_v0_1.md](gtm/BIZRA_OPEN_SOURCE_ENGAGEMENT_AND_BUSINESS_MODEL_v0_1.md) — claim-governed summary of open-source engagement thesis and commercial assurance lane (source PDF on operator disk; not a runtime contract).
- [gtm/BIZRA_GTM_PHASE1_OPERATOR_PACKET_v0_1.md](gtm/BIZRA_GTM_PHASE1_OPERATOR_PACKET_v0_1.md) — docs-only Phase-1 Ring-1 send checklist, private send receipt shape, feedback record boundary, and exact next consent phrases.
- [ROADMAP.md](ROADMAP.md) — product roadmap.
- [LIGHTHOUSE.md](LIGHTHOUSE.md) — private lighthouse operator lane.
- [founder-field-notes/inroom-walkthrough-v0.2.md](founder-field-notes/inroom-walkthrough-v0.2.md) — Current working artifact for Ring-1 adversarial in-room review.
- [DEMA_CONSTITUTION.md](DEMA_CONSTITUTION.md) — product constitution.
- [00-product-thesis/dema-one-face.md](00-product-thesis/dema-one-face.md) — Dema as the one face.
- [00-product-thesis/mission-centric-thesis.md](00-product-thesis/mission-centric-thesis.md) — mission-centric thesis.
- [00-product-thesis/no-shadow-state-law.md](00-product-thesis/no-shadow-state-law.md) — no hidden state doctrine.
- [00-product-thesis/market-positioning.md](00-product-thesis/market-positioning.md) — market positioning.

## Architecture docs

- [ARCHITECTURE.md](ARCHITECTURE.md) — current component and command map.
- [INSTALLER_ARCHITECTURE.md](INSTALLER_ARCHITECTURE.md) — installer levels and release rules.
- [NODE0_ACTIVATION_ROADMAP.md](NODE0_ACTIVATION_ROADMAP.md) — staged Node0 activation roadmap.
- [ARTIFACT_011_PREP.md](ARTIFACT_011_PREP.md) — first bounded diagnostic preparation boundary.
- [02-architecture/repo-charter.md](02-architecture/repo-charter.md) — repo charter.
- [02-architecture/boundary-core-vs-face.md](02-architecture/boundary-core-vs-face.md) — core-vs-face boundary.
- [02-architecture/behavioral-modulation-preview.md](02-architecture/behavioral-modulation-preview.md) — current preview model for consent-bound, no-mint behavioral modulation.
- [02-architecture/dema-autonomy-envelope.md](02-architecture/dema-autonomy-envelope.md) — autonomy levels and consent.
- [02-architecture/gateway-http-adapter.md](02-architecture/gateway-http-adapter.md) — gateway adapter target.
- [02-architecture/pat-builder-sat-validator.md](02-architecture/pat-builder-sat-validator.md) — PAT/SAT bridge.
- [02-architecture/SAT_ROLE_BOUNDARY.md](02-architecture/SAT_ROLE_BOUNDARY.md) — SAT constitutional guard contract: PAT proposes / SAT verifies-blocks-audits, the 5 role questions, verdict shape, and the registry-field contract (DECLARED, no runtime).
- [02-architecture/sat-verifier-sibling-spec.md](02-architecture/sat-verifier-sibling-spec.md) — SAT verifier sibling spec.
- [02-architecture/node0-urp-ecosystem-transition.md](02-architecture/node0-urp-ecosystem-transition.md) — internal Node0 to shared URP transition note; docs-only, not public roadmap.
- [security/URP_STAGE_4_CHOOSE_CLOSEOUT.md](security/URP_STAGE_4_CHOOSE_CLOSEOUT.md) — Current URP Stage 4 Choose closeout note: write/list/verify symmetry, closeout drift-guard probe, non-claims, and Stage 5 boundary.

## Canon references

- [canon/BIZRA_TOPOLOGY_CANON.md](canon/BIZRA_TOPOLOGY_CANON.md) — topology authority for PAT-7, SAT-5, one shared URP, and membrane language; docs-only mirror in this repo.
- [THREE_REPO_PRODUCT_STACK_CANON_v0_1.md](THREE_REPO_PRODUCT_STACK_CANON_v0_1.md) — three-repo product stack canon: which BIZRA repo holds which authority.
- [HOUSE_OF_WISDOM_UKE_URP_CANON_v0_1.md](HOUSE_OF_WISDOM_UKE_URP_CANON_v0_1.md) — constitutional definition of UKE as the SAT-governed knowledge cortex inside the URP, the 8-tier promotion ladder (RAW_CLAIM → META_CANON), SAT/PAT/Dema/URP authority boundaries, consent and privacy rules, and 9 House-of-Wisdom forbidden claim examples.
- [NODE0_DEMA_COMPLETE_COMPONENT_DNA_v0_1.md](NODE0_DEMA_COMPLETE_COMPONENT_DNA_v0_1.md) — Defines the complete Node0 + Dema component DNA: what is active, MVP-required, pilot-required, future-forest, research-quarantined, or designed-not-live.
- [BIZRA_ROOT_SOURCE_OF_TRUTH_v0_1.md](BIZRA_ROOT_SOURCE_OF_TRUTH_v0_1.md) — Defines the origin, meaning, proof boundary, and public-facing moral spine of BIZRA from الرسالة and البذرة through Node0, Dema, URP, and the GTM path.
- [BIZRA_ORIGIN_VIDEO_001_CANON_v0_1.md](BIZRA_ORIGIN_VIDEO_001_CANON_v0_1.md) — Preserves the first known BIZRA cinematic message, transcript, meaning, timestamp-evidence status, and relationship to the 2026 First Look.
- [NODE0_FOUNDER_PROOF_AND_HUMAN_CHOICE_v0_1.md](NODE0_FOUNDER_PROOF_AND_HUMAN_CHOICE_v0_1.md) — Defines the first human proof path behind Node0: what is verified, derived, operator-attested, source-pending, and forbidden before public founder-proof claims.
- [BIZRA_2026_FIRST_LOOK_NARRATIVE_v0_1.md](BIZRA_2026_FIRST_LOOK_NARRATIVE_v0_1.md) — Defines the claim-governed 2026 First Look narrative: origin chain, scenes, public wording boundaries, visual direction, and production rules.
- [BIZRA_2026_FIRST_LOOK_PRODUCTION_BRIEF_v0_1.md](BIZRA_2026_FIRST_LOOK_PRODUCTION_BRIEF_v0_1.md) — Production-control brief between canon and media: 7 asset-family briefs (video / Canva / emulator / website / social / lighthouse invitation / founder story), scene-to-asset + claim-to-visual matrices, forbidden visuals + wording, 3 prompt packs (Canva / Video / Visual Emulator), Production Checklist, Review Gate. No Canva or video is produced by this slice.
- [BIZRA_THIRD_PARTY_EVALUATION_PACK_v0_1.md](BIZRA_THIRD_PARTY_EVALUATION_PACK_v0_1.md) — Reviewer-facing evaluation pack: executive summary · 5 truth-bucket sections · 3 evaluation maps · μ-layer + security + testing + docs posture · structural market-pattern comparison · 13-item reviewer checklist · 11 suggested reviewer questions · known limitations · risk register v0.1 · evidence request roadmap. Makes BIZRA reviewable; does not sell BIZRA.
- [BIZRA_MARKET_ANALYSIS_v0_1.md](BIZRA_MARKET_ANALYSIS_v0_1.md) — Market-comparison frame for BIZRA: what market this is/is not about · 5 market patterns BIZRA participates in (agentic AI · local-first AI · AI governance · personal OS · trust/consent/provenance) · Web3 lessons-learned (no token adoption) · 7-category comparator landscape (no feature war) · BIZRA differentiation map · non-claims · honest risks · early-user profile · adoption hypotheses · evidence needed · third-party validation roadmap. Uses `EXTERNAL_SOURCE_REQUIRED` label for every unsourced market fact; v0.2+ binds external sources.
- [BIZRA_AGENT_DNA_LAW_OF_ASSUMPTION_v0_1.md](BIZRA_AGENT_DNA_LAW_OF_ASSUMPTION_v0_1.md) — Agent DNA · Law of Assumption: how every BIZRA agent (Dema CLI · connected LLMs · future PAT-7/SAT-5) handles uncertainty, disagreement, evidence, humility, and unavoidable assumptions. Arabic + English law text · operating-law clauses · 10 agent behavior requirements · 12 forbidden behaviors · 6-field Required Output Pattern (KNOWN / INFERRED / ASSUMED-WITH-IHSAN / UNKNOWN / BOUNDARY / NEXT EVIDENCE NEEDED) · 4 worked examples · future runtime path. Doctrine only; runtime enforcement deferred to PAT-7/SAT-5.
- [DEMA_AGENT_HARNESS_AND_SKILL_DNA_v0_1.md](DEMA_AGENT_HARNESS_AND_SKILL_DNA_v0_1.md) — Agent DNA · acting layer (sibling to Law of Assumption): how Dema turns canon into executable agent behavior. Harness Law + Skill Law · 10-step Dema agent loop (intent → claim boundary → skill selection → micro-consent → tool action → trace capture → deterministic verification → receipt → self-critique → next step) · 6 runtime boundaries · must-not-miss safety rules · local/tiny-model routing · skill + harness eval requirements · 12 agent failure modes · 12 forbidden behaviors · 10-field Required Runtime Pattern · 3 worked examples. Doctrine only; runtime enforcement deferred to PAT-7/SAT-5.

## Binding ADRs

- [06-adr/ADR-001-dema-is-one-face.md](06-adr/ADR-001-dema-is-one-face.md) — Dema is one face.
- [06-adr/ADR-002-no-shadow-state.md](06-adr/ADR-002-no-shadow-state.md) — no shadow state.
- [06-adr/ADR-003-core-truth-lives-in-bizra-omega.md](06-adr/ADR-003-core-truth-lives-in-bizra-omega.md) — core truth lives in bizra-omega.
- [06-adr/ADR-004-local-first-memory.md](06-adr/ADR-004-local-first-memory.md) — local-first memory.
- [06-adr/ADR-005-operator-actions-require-explicit-consent.md](06-adr/ADR-005-operator-actions-require-explicit-consent.md) — explicit consent.
- [06-adr/ADR-006-continuous-assurance-and-no-mint-verification.md](06-adr/ADR-006-continuous-assurance-and-no-mint-verification.md) — no-mint verification.
- [06-adr/ADR-007-multi-session-chain-policy.md](06-adr/ADR-007-multi-session-chain-policy.md) — multi-session chain policy.

## Proposed ADRs and boundary drafts

- [06-adr/ADR-019-impact-launchpad-mvp-contract-boundary.md](06-adr/ADR-019-impact-launchpad-mvp-contract-boundary.md) — Proposed docs-only software/governance boundary for the Impact Launchpad MVP before proposal-flow implementation, review-envelope shape, PoI, reward, token, marketplace, or public economic work.

## Proof, evidence, and priority

- [../proof-of-priority/PIN.md](../proof-of-priority/PIN.md) — canonical proof-of-priority pin.
- [PRIORITY_ANCHOR.md](PRIORITY_ANCHOR.md) — Merkle-root algorithm and verification.
- [../proof-of-priority/manifest.json](../proof-of-priority/manifest.json) — deterministic priority manifest.
- [../SPROUT_PIN.md](../SPROUT_PIN.md) — operator-local ARTIFACT-011 / SPROUT proof pin.
- [EVIDENCE_v0.2_first_run_smoke.md](EVIDENCE_v0.2_first_run_smoke.md) — first-run smoke evidence.
- [08-quality/U1_NODE0_LOCAL_URP_PROOF_PIN.md](08-quality/U1_NODE0_LOCAL_URP_PROOF_PIN.md) — U1 proof pin.
- [08-quality/CROSS_REPO_GENESIS_PROVENANCE_2026_06_05.md](08-quality/CROSS_REPO_GENESIS_PROVENANCE_2026_06_05.md) — read-only cross-repo genesis/key/proof provenance audit (six repos); gates Node0 key ceremony.
- [../themassage.pdf](../themassage.pdf), [../bizra.pdf](../bizra.pdf), [../BIZRA_Third_Fact_v0_1_FINAL.pdf](../BIZRA_Third_Fact_v0_1_FINAL.pdf) — three founding files bound by the priority anchor.

## Quality, delivery, and contribution

- [DELIVERY_SPINE_v0_1.md](DELIVERY_SPINE_v0_1.md) — Defines Dema's canonical delivery gates, CI/CD ownership, release truth labels, quality spine, and operator-local extended gate boundaries.
- [CLAIM_REGISTER_v0_1.md](CLAIM_REGISTER_v0_1.md) — Defines public claim truth labels, forbidden overclaims, scenario boundaries, and evidence requirements before GTM/public-face material.
- [DELIVERY_BLUEPRINT.md](DELIVERY_BLUEPRINT.md) — release-readiness and DevOps discipline.
- [TESTING.md](TESTING.md) — test surface and smoke-check matrix.
- [LLM_SYSTEM_FLOW.md](LLM_SYSTEM_FLOW.md) — canonical repo-local flow for connected LLMs and agents.
- [ENGINEERING_DISCIPLINE.md](ENGINEERING_DISCIPLINE.md) — engineering rules and halt gates.
- [../CONTRIBUTING.md](../CONTRIBUTING.md) — contribution checklist.
- [../SECURITY.md](../SECURITY.md) — security policy.
- [DECISION_two_dema_split.md](DECISION_two_dema_split.md) — canonical-vs-blueprint split decision.

## Historical and reference material

These files are useful background, but they are not the first source of truth when they conflict with the README, ADRs, or current architecture docs.

- [ABSORPTION_NOTES_v1.md](ABSORPTION_NOTES_v1.md) — historical absorption notes.
- [ABSORPTION_NOTES_v2.md](ABSORPTION_NOTES_v2.md) — historical absorption notes.
- [\_absorbed/README.md](_absorbed/README.md) — absorbed legacy index.
- [\_absorbed/BIZRA_GENESIS_PROVENANCE_LEDGER_V0_1.md](_absorbed/BIZRA_GENESIS_PROVENANCE_LEDGER_V0_1.md) — absorbed provenance reference.
- [\_absorbed/DEMA_PRODUCT_CONSTITUTION_V0_1.md](_absorbed/DEMA_PRODUCT_CONSTITUTION_V0_1.md) — absorbed constitution draft.
- [\_absorbed/DEMA_PRODUCT_REPO_BOOTSTRAP_V0_1.md](_absorbed/DEMA_PRODUCT_REPO_BOOTSTRAP_V0_1.md) — absorbed bootstrap draft.
- [\_absorbed/DEMA_REPO_BOOTSTRAP_V0_2_SUMMARY.md](_absorbed/DEMA_REPO_BOOTSTRAP_V0_2_SUMMARY.md) — absorbed bootstrap summary.
- [\_absorbed/DEMA_SAFE_MONETIZATION_SKILL_V0_1.md](_absorbed/DEMA_SAFE_MONETIZATION_SKILL_V0_1.md) — absorbed monetization skill note.

## Superpowers specs and plans

These are working design artifacts. They are not the public onboarding path.

- [superpowers/plans/2026-05-12-adr-007-multi-session-chain-policy.md](superpowers/plans/2026-05-12-adr-007-multi-session-chain-policy.md)
- [superpowers/plans/2026-05-12-phase2-assurance-mint-lib-and-gates.md](superpowers/plans/2026-05-12-phase2-assurance-mint-lib-and-gates.md)
- [superpowers/plans/2026-05-22-urp-shared-runtime-discovery.md](superpowers/plans/2026-05-22-urp-shared-runtime-discovery.md) — working plan for the discovery-only URP shared-runtime manifest and SAT-governed write-boundary slice.
- [superpowers/plans/2026-05-22-proof-room-bundle.md](superpowers/plans/2026-05-22-proof-room-bundle.md) — working plan for the proof-room gate composition (`npm run proof:room`).
- [superpowers/specs/2026-05-12-node0-cicd-blueprint-design.md](superpowers/specs/2026-05-12-node0-cicd-blueprint-design.md)
- [superpowers/specs/2026-05-14-actuator-boundary-spine/01_specification.md](superpowers/specs/2026-05-14-actuator-boundary-spine/01_specification.md) — working artifact for actuator boundary spine.
- [superpowers/specs/2026-05-14-dema-broad-gtm-readiness/01_specification.md](superpowers/specs/2026-05-14-dema-broad-gtm-readiness/01_specification.md) — working artifact for broad-GTM readiness.
- [superpowers/specs/2026-05-14-effectcap-invariant/01_specification.md](superpowers/specs/2026-05-14-effectcap-invariant/01_specification.md) — working artifact for pre-runtime EffectCap invariants.
- [superpowers/specs/2026-05-15-bizra-steer-vector-v0.1/01_specification.md](superpowers/specs/2026-05-15-bizra-steer-vector-v0.1/01_specification.md) — working artifact for steer-vector boundaries.

## Rule for future docs

When adding a new doc, link it here and mark its status:

```text
Current / Binding / Historical / Working artifact / Future target
```
