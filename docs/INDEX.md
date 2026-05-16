# Dema Documentation Index

This index is the clean map for the repo. It separates current user-facing docs, architecture decisions, proof material, quality gates, and historical references so readers do not have to guess which file is authoritative.

## Fast reading paths

| Reader | Start here | Then read |
|---|---|---|
| Normal user | [USER_LIFECYCLE.md](USER_LIFECYCLE.md) | [FIRST_RUN_WIZARD.md](FIRST_RUN_WIZARD.md), [RECEIPTS.md](RECEIPTS.md) |
| Developer | [ARCHITECTURE.md](ARCHITECTURE.md) | [ENGINEERING_DISCIPLINE.md](ENGINEERING_DISCIPLINE.md), [DELIVERY_BLUEPRINT.md](DELIVERY_BLUEPRINT.md) |
| LLM / agent | [LLM_SYSTEM_FLOW.md](LLM_SYSTEM_FLOW.md) | [ARCHITECTURE.md](ARCHITECTURE.md), [TESTING.md](TESTING.md) |
| Security reviewer | [SECURITY.md](../SECURITY.md) | [06-adr/ADR-005-operator-actions-require-explicit-consent.md](06-adr/ADR-005-operator-actions-require-explicit-consent.md), [02-architecture/dema-autonomy-envelope.md](02-architecture/dema-autonomy-envelope.md) |
| Product/GTM reviewer | [PRODUCT.md](PRODUCT.md) | [GTM.md](GTM.md), [LIGHTHOUSE.md](LIGHTHOUSE.md), [ROADMAP.md](ROADMAP.md) |
| Proof auditor | [../proof-of-priority/PIN.md](../proof-of-priority/PIN.md) | [PRIORITY_ANCHOR.md](PRIORITY_ANCHOR.md), [../SPROUT_PIN.md](../SPROUT_PIN.md) |

## Current public front doors

- [../README.md](../README.md) — product landing page, onboarding, command reference, diagrams.
- [USER_LIFECYCLE.md](USER_LIFECYCLE.md) — nontechnical end-to-end local journey.
- [FIRST_RUN_WIZARD.md](FIRST_RUN_WIZARD.md) — in-product first-run screen spec.
- [ECOSYSTEM.md](ECOSYSTEM.md) — Dema's place inside BIZRA, Node0, and future nodes.
- [RECEIPTS.md](RECEIPTS.md) — local receipt viewer model and ARTIFACT-011 boundary.

## Product and market docs

- [PRODUCT.md](PRODUCT.md) — concise product strategy.
- [GTM.md](GTM.md) — first offer, audience, forbidden claims, Node1/Node2 boundary.
- [ROADMAP.md](ROADMAP.md) — product roadmap.
- [LIGHTHOUSE.md](LIGHTHOUSE.md) — private lighthouse operator lane.
- [DEMA_CONSTITUTION.md](DEMA_CONSTITUTION.md) — product constitution.
- [00-product-thesis/dema-one-face.md](00-product-thesis/dema-one-face.md) — Dema as the one face.
- [00-product-thesis/mission-centric-thesis.md](00-product-thesis/mission-centric-thesis.md) — mission-centric thesis.
- [00-product-thesis/no-shadow-state-law.md](00-product-thesis/no-shadow-state-law.md) — no hidden state doctrine.
- [00-product-thesis/market-positioning.md](00-product-thesis/market-positioning.md) — market positioning.

## Architecture docs

- [ARCHITECTURE.md](ARCHITECTURE.md) — current component and command map.
- [INSTALLER_ARCHITECTURE.md](INSTALLER_ARCHITECTURE.md) — installer levels and release rules.
- [NODE0_ACTIVATION_ROADMAP.md](NODE0_ACTIVATION_ROADMAP.md) — staged Node0 activation roadmap.
- [NODE0_GENESIS_READINESS_2026_05_16.md](NODE0_GENESIS_READINESS_2026_05_16.md) — Working artifact. 2026-05-16 state snapshot mapping current Node0 readiness against the genesis-to-production ladder; complements `NODE0_ACTIVATION_ROADMAP.md` (stage progression) and `DELIVERY_BLUEPRINT.md` (process discipline).
- [ARTIFACT_011_PREP.md](ARTIFACT_011_PREP.md) — first bounded diagnostic preparation boundary.
- [02-architecture/repo-charter.md](02-architecture/repo-charter.md) — repo charter.
- [02-architecture/boundary-core-vs-face.md](02-architecture/boundary-core-vs-face.md) — core-vs-face boundary.
- [02-architecture/behavioral-modulation-preview.md](02-architecture/behavioral-modulation-preview.md) — current preview model for consent-bound, no-mint behavioral modulation.
- [02-architecture/dema-autonomy-envelope.md](02-architecture/dema-autonomy-envelope.md) — autonomy levels and consent.
- [02-architecture/dema-tui-onboarding-design.md](02-architecture/dema-tui-onboarding-design.md) — Working artifact. TUI cockpit + onboarding design composing existing organs (homebase, shared-urp, consent, evidence, ihsan, mission) into one display-only surface; does not propose new schemas or CLI verbs, complements `FIRST_RUN_WIZARD.md` (screen sequence) and `USER_LIFECYCLE.md` (user journey).
- [02-architecture/dema-ux-proof-harness.md](02-architecture/dema-ux-proof-harness.md) — Working artifact. UX uniqueness scorecard with 12 character criteria + 5-round design review ritual + 7-minute acceptance test + one-sentence competitor-copy discriminator; complements technical gates by adding the BIZRA-native-character review that prevents generic-agent-dashboard drift.
- [02-architecture/dema-model-role-router-v0.1.md](02-architecture/dema-model-role-router-v0.1.md) — Working artifact. Additive layer on top of `packages/models/src/model-routing.js`; maps the existing 6 roles (coding · governance · reasoning · fast · embedding · vision) to per-role effects boundary + consent field + GateVerdict; v0.1 denies write/execute/call across all roles; no prompt invocation, no model start.
- [02-architecture/dema-mobile-qr-consent-v0.md](02-architecture/dema-mobile-qr-consent-v0.md) — Working artifact. Z Fold 6 companion-device manual-echo consent protocol; phone displays phrase, operator types it on laptop, laptop verifies; phone holds no secret, has no socket, has no authority; v1 secure-channel pairing requires a separate ADR.
- [02-architecture/gateway-http-adapter.md](02-architecture/gateway-http-adapter.md) — gateway adapter target.
- [02-architecture/pat-builder-sat-validator.md](02-architecture/pat-builder-sat-validator.md) — PAT/SAT bridge.
- [02-architecture/sat-verifier-sibling-spec.md](02-architecture/sat-verifier-sibling-spec.md) — SAT verifier sibling spec.
- [02-architecture/node0-urp-ecosystem-transition.md](02-architecture/node0-urp-ecosystem-transition.md) — internal Node0 to shared URP transition note; docs-only, not public roadmap.

## Canon references

- [canon/BIZRA_TOPOLOGY_CANON.md](canon/BIZRA_TOPOLOGY_CANON.md) — topology authority for PAT-7, SAT-5, one shared URP, and membrane language; docs-only mirror in this repo.

## Binding ADRs

- [06-adr/ADR-001-dema-is-one-face.md](06-adr/ADR-001-dema-is-one-face.md) — Dema is one face.
- [06-adr/ADR-002-no-shadow-state.md](06-adr/ADR-002-no-shadow-state.md) — no shadow state.
- [06-adr/ADR-003-core-truth-lives-in-bizra-omega.md](06-adr/ADR-003-core-truth-lives-in-bizra-omega.md) — core truth lives in bizra-omega.
- [06-adr/ADR-004-local-first-memory.md](06-adr/ADR-004-local-first-memory.md) — local-first memory.
- [06-adr/ADR-005-operator-actions-require-explicit-consent.md](06-adr/ADR-005-operator-actions-require-explicit-consent.md) — explicit consent.
- [06-adr/ADR-006-continuous-assurance-and-no-mint-verification.md](06-adr/ADR-006-continuous-assurance-and-no-mint-verification.md) — no-mint verification.
- [06-adr/ADR-007-multi-session-chain-policy.md](06-adr/ADR-007-multi-session-chain-policy.md) — multi-session chain policy.

## Proof, evidence, and priority

- [../proof-of-priority/PIN.md](../proof-of-priority/PIN.md) — canonical proof-of-priority pin.
- [PRIORITY_ANCHOR.md](PRIORITY_ANCHOR.md) — Merkle-root algorithm and verification.
- [../proof-of-priority/manifest.json](../proof-of-priority/manifest.json) — deterministic priority manifest.
- [../SPROUT_PIN.md](../SPROUT_PIN.md) — operator-local ARTIFACT-011 / SPROUT proof pin.
- [EVIDENCE_v0.2_first_run_smoke.md](EVIDENCE_v0.2_first_run_smoke.md) — first-run smoke evidence.
- [08-quality/U1_NODE0_LOCAL_URP_PROOF_PIN.md](08-quality/U1_NODE0_LOCAL_URP_PROOF_PIN.md) — U1 proof pin.
- [../themassage.pdf](../themassage.pdf), [../bizra.pdf](../bizra.pdf), [../BIZRA_Third_Fact_v0_1_FINAL.pdf](../BIZRA_Third_Fact_v0_1_FINAL.pdf) — three founding files bound by the priority anchor.

## Quality, delivery, and contribution

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
- [_absorbed/README.md](_absorbed/README.md) — absorbed legacy index.
- [_absorbed/BIZRA_GENESIS_PROVENANCE_LEDGER_V0_1.md](_absorbed/BIZRA_GENESIS_PROVENANCE_LEDGER_V0_1.md) — absorbed provenance reference.
- [_absorbed/DEMA_PRODUCT_CONSTITUTION_V0_1.md](_absorbed/DEMA_PRODUCT_CONSTITUTION_V0_1.md) — absorbed constitution draft.
- [_absorbed/DEMA_PRODUCT_REPO_BOOTSTRAP_V0_1.md](_absorbed/DEMA_PRODUCT_REPO_BOOTSTRAP_V0_1.md) — absorbed bootstrap draft.
- [_absorbed/DEMA_REPO_BOOTSTRAP_V0_2_SUMMARY.md](_absorbed/DEMA_REPO_BOOTSTRAP_V0_2_SUMMARY.md) — absorbed bootstrap summary.
- [_absorbed/DEMA_SAFE_MONETIZATION_SKILL_V0_1.md](_absorbed/DEMA_SAFE_MONETIZATION_SKILL_V0_1.md) — absorbed monetization skill note.

## Superpowers specs and plans

These are working design artifacts. They are not the public onboarding path.

- [superpowers/plans/2026-05-12-adr-007-multi-session-chain-policy.md](superpowers/plans/2026-05-12-adr-007-multi-session-chain-policy.md)
- [superpowers/plans/2026-05-12-phase2-assurance-mint-lib-and-gates.md](superpowers/plans/2026-05-12-phase2-assurance-mint-lib-and-gates.md)
- [superpowers/specs/2026-05-12-node0-cicd-blueprint-design.md](superpowers/specs/2026-05-12-node0-cicd-blueprint-design.md)
- [superpowers/specs/2026-05-14-actuator-boundary-spine/01_specification.md](superpowers/specs/2026-05-14-actuator-boundary-spine/01_specification.md) — working artifact for actuator boundary spine.
- [superpowers/specs/2026-05-14-dema-broad-gtm-readiness/01_specification.md](superpowers/specs/2026-05-14-dema-broad-gtm-readiness/01_specification.md) — working artifact for broad-GTM readiness.
- [superpowers/specs/2026-05-14-effectcap-invariant/01_specification.md](superpowers/specs/2026-05-14-effectcap-invariant/01_specification.md) — working artifact for pre-runtime EffectCap invariants.
- [superpowers/specs/2026-05-15-bizra-steer-vector-v0.1/01_specification.md](superpowers/specs/2026-05-15-bizra-steer-vector-v0.1/01_specification.md) — working artifact for steer-vector boundaries.
- [superpowers/specs/2026-05-16-integration-foundry-registry/01_specification.md](superpowers/specs/2026-05-16-integration-foundry-registry/01_specification.md) — Working artifact for the external pattern registry preview (one module of a proposed Integration Foundry); maps 11 external giants → existing BIZRA primitives via `GateVerdict` + `MICRO_CONSENT_SHAPE` vocabulary. Bundle includes `02_pseudocode.md`, `03_tdd_anchors.md`, `04_integration_notes.md`.
- [superpowers/specs/2026-05-16-urp-carrying-cost/01_specification.md](superpowers/specs/2026-05-16-urp-carrying-cost/01_specification.md) — Working artifact for the URP Carrying Cost preview (Harberger/COST sibling spec); 8 shareable types vs 8 forbidden private types; type-enforced refusal of private data; license-challenge-not-forced-purchase v0.1 invariant; closes 1 of 3 blockers on the integration-foundry-registry's `harberger_cost` entry. Bundle includes `02_pseudocode.md`, `03_tdd_anchors.md`, `04_integration_notes.md`.

## Rule for future docs

When adding a new doc, link it here and mark its status:

```text
Current / Binding / Historical / Working artifact / Future target
```
