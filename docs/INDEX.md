# Dema Documentation Index

This index is the clean map for the repo. It separates current user-facing docs, architecture decisions, proof material, quality gates, and historical references so readers do not have to guess which file is authoritative.

## Fast reading paths

| Reader | Start here | Then read |
|---|---|---|
| Normal user | [../README.md](../README.md) | [FIRST_RUN_WIZARD.md](FIRST_RUN_WIZARD.md), [RECEIPTS.md](RECEIPTS.md) |
| Developer | [ARCHITECTURE.md](ARCHITECTURE.md) | [ENGINEERING_DISCIPLINE.md](ENGINEERING_DISCIPLINE.md), [DELIVERY_BLUEPRINT.md](DELIVERY_BLUEPRINT.md) |
| LLM / agent | [LLM_SYSTEM_FLOW.md](LLM_SYSTEM_FLOW.md) | [ARCHITECTURE.md](ARCHITECTURE.md), [TESTING.md](TESTING.md) |
| Proof auditor | [../proof-of-priority/PIN.md](../proof-of-priority/PIN.md) | [PRIORITY_ANCHOR.md](PRIORITY_ANCHOR.md), [../SPROUT_PIN.md](../SPROUT_PIN.md) |

## Current public front doors

- [../README.md](../README.md) — product landing page and command reference.
- [FIRST_RUN_WIZARD.md](FIRST_RUN_WIZARD.md) — first-run screen spec.
- [RECEIPTS.md](RECEIPTS.md) — local receipt viewer model and ARTIFACT-011 boundary.

## Architecture docs

- [ARCHITECTURE.md](ARCHITECTURE.md) — current component and command map.
- [INSTALLER_ARCHITECTURE.md](INSTALLER_ARCHITECTURE.md) — installer levels and release rules.
- [NODE0_ACTIVATION_ROADMAP.md](NODE0_ACTIVATION_ROADMAP.md) — staged Node0 activation roadmap.
- [ARTIFACT_011_PREP.md](ARTIFACT_011_PREP.md) — first bounded diagnostic preparation boundary.

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
- [08-quality/U1_NODE0_LOCAL_URP_PROOF_PIN.md](08-quality/U1_NODE0_LOCAL_URP_PROOF_PIN.md) — U1 proof pin.

## Quality, delivery, and contribution

- [DELIVERY_BLUEPRINT.md](DELIVERY_BLUEPRINT.md) — release-readiness and DevOps discipline.
- [TESTING.md](TESTING.md) — test surface and smoke-check matrix.
- [LLM_SYSTEM_FLOW.md](LLM_SYSTEM_FLOW.md) — canonical repo-local flow for connected LLMs and agents.
- [ENGINEERING_DISCIPLINE.md](ENGINEERING_DISCIPLINE.md) — engineering rules and halt gates.
- [../CONTRIBUTING.md](../CONTRIBUTING.md) — contribution checklist.
- [../SECURITY.md](../SECURITY.md) — security policy.

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
