# Delivery Spine v0.1

> "The Delivery Spine does not make Dema production-scale by declaration. It defines the gates required before Dema may honestly claim higher delivery maturity."

> "The purpose of this document is to make release quality, proof boundaries, CI/CD discipline, and operator-local gates explicit before automation is added."

## 1. Purpose

This document is the canonical delivery spine for Dema as the product face of BIZRA Node0. It converts the current operator discipline into a repeatable release-quality governance structure **without adding any new automation**.

It exists so that a future contributor, reviewer, or connected LLM can:

- read one document to find every gate that bounds a Dema release,
- find one authority table that maps which surface is allowed which kind of claim,
- find one claim gate that bounds every public statement to a truth label,
- find one release receipt template that bounds every release to an auditable record,
- and find an explicit list of automation that is deliberately deferred.

This is the _spine_: load-bearing, narrow, opinionated. The companion `DELIVERY_BLUEPRINT.md` is the _body_: broader DevOps posture, MBOK alignment, CI maturity model. When the two differ on a specific gate, this spine governs.

## 2. Truth Label

```text
DECLARED_DELIVERY_SPINE_v0_1
```

This label means: the gates and authorities below are declared; they are not yet automated, not yet measured longitudinally, and not yet certified by any external standard. Promotion from declared to measured to certified requires explicit evidence, not narrative.

## 3. Scope

In scope:

- Gate ladder from local edit to release
- Authority table mapping each surface to allowed and forbidden authority
- Truth labels for every public claim
- Release receipt template
- Rollback and recovery rules
- Explicit non-goals and deferred automation

Out of scope (deferred to later slices):

- a `delivery-check.mjs` automation script
- GitHub Actions workflow edits
- runtime activation
- token/economy activation
- Node1/Node2 runtime start
- imports from `bizra-node0-genesis`
- proof or receipt mint

## 4. Operating Law

```text
A+ Dema is not the system with the most features.

A+ Dema is the system where:
  every repo has a clear authority role,
  every public claim has a proof boundary,
  every release has gates,
  every failure has recovery,
  every automation is scoped,
  every future claim is truth-labeled,
  and Node0 can be reproduced by another human.
```

This law binds every section below. A delivery decision is acceptable only if every clause of the law remains satisfied after the decision.

## 5. Relationship to Three-Repo Product Stack Canon

The Three-Repo Product Stack Canon (`docs/THREE_REPO_PRODUCT_STACK_CANON_v0_1.md`) defines which of the three BIZRA repositories holds which authority. The Delivery Spine inherits those boundaries:

- Dema (this repo) is the **product face** and is the surface this spine governs end-to-end.
- `bizra-data-lake` / `bizra-omega` is the **runtime / proof substrate** where applicable. The Delivery Spine does not authorize Dema to mint, federate, or speak on behalf of that substrate.
- `bizra-node0-genesis` is **archive / R&D source**. The Delivery Spine forbids importing live runtime behavior from that repo into Dema.

A Dema release that depends on a substrate guarantee must reference the substrate evidence, not restate it.

## 6. Relationship to Node0 + Dema Component DNA

The Node0 + Dema Component DNA document (when present at `docs/NODE0_DEMA_COMPLETE_COMPONENT_DNA_v0_1.md`) assigns a status label (`ACTIVE`, `MVP_REQUIRED`, `PILOT_REQUIRED`, `FUTURE_FOREST`, `RESEARCH_QUARANTINE`, `DESIGNED_NOT_LIVE`) to each component layer. The Delivery Spine binds those labels to release behavior:

- A release may only make user-facing claims about components labeled `ACTIVE` in the Component DNA.
- A release that touches a `PILOT_REQUIRED` component must document the pilot scope and operator approval.
- A release must not market `FUTURE_FOREST` capabilities as imminent or shipping.
- A release that references a `DESIGNED_NOT_LIVE` component must use the exact language "designed, not live" or equivalent qualifier.
- A release may not promote any `RESEARCH_QUARANTINE` component into the public surface.

When Component DNA labels change, the Claim Gate (Section 22) is re-evaluated for the affected public surfaces.

## 7. Authority Table

| Surface                           | Owner                               | Allowed authority                                                                                                          | Forbidden authority                                                                                                                         | Evidence path                                                                         |
| --------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Dema**                          | This repo                           | Product face, local UX, docs, consent preview, product-facing proof-safe language, release receipt for Dema-scoped changes | Minting governed-runtime receipts; speaking for the substrate; issuing identity-bound artifacts; activating runtime, federation, or economy | This repo's `docs/`, `tests/`, `proof-of-priority/`, `SPROUT_PIN.md`, and gate output |
| **bizra-data-lake / bizra-omega** | Substrate repo(s)                   | Runtime, proof substrate, governed-runtime receipt issuance where applicable                                               | Acting as Dema's product face; bypassing Dema's consent preview                                                                             | Substrate repo's own receipts and gate output (out of scope for this spine)           |
| **bizra-node0-genesis**           | Archive / R&D                       | Historical reference, research notes, design exploration                                                                   | Live runtime authority; direct import into Dema release; certification claims; market-facing claims                                         | Archive only; not consulted at release time                                           |
| **Operator-local μ-layer**        | Operator's machine (`~/.dema/bin/`) | Extended Node0 discipline gate beyond the clean checkout                                                                   | Acting as a clean-checkout repo requirement; gating contributors who do not have the μ-layer                                                | Operator-side gate output; not a CI requirement                                       |
| **Canva / public-face assets**    | GTM workstream                      | GTM and public-face design artifacts; declarative branding                                                                 | Proof authority; measurement claims; receipt language; certification language                                                               | Canva exports linked from GTM doc, never from proof-of-priority                       |
| **GitHub PR / CI**                | Hosting / CI environment            | Running declared gates and recording results; code review surface                                                          | Mutating runtime; minting; issuing artifacts; bypassing local gate failures                                                                 | CI logs; PR check status                                                              |

A claim that exceeds a surface's allowed authority is treated as a release-blocking defect.

## 8. Change Classes

Every change is classified before it begins. The class determines which gates apply.

| Class        | Examples                                               | Gate ceiling                                                             |
| ------------ | ------------------------------------------------------ | ------------------------------------------------------------------------ |
| `docs-only`  | Doc add/edit, link wiring                              | Local Gate Ladder (Section 9)                                            |
| `tests-only` | New tests, test refactors with no production change    | Local Gate Ladder                                                        |
| `surface`    | New CLI command or non-runtime UX                      | Local Gate Ladder + Release Candidate Gate if user-facing                |
| `boundary`   | Consent surface, adapter input parsing, receipt reader | Local Gate Ladder + Release Candidate Gate + explicit ADR cross-check    |
| `release`    | Release-readiness, installer artifacts                 | Full ladder through Release Gate (Sections 9-14)                         |
| `governance` | ADR, charter, this spine, Component DNA, canon         | Local Gate Ladder + Operator-Local Extended Gate + explicit human review |

Multiple classes in one branch are split before the branch is opened.

## 9. Local Gate Ladder

Reproducible from a clean checkout of this repository. No host-specific dependency.

```bash
npm run check
npm run llm:guidance
git diff --check
```

`npm test` is the dedicated test gate (`node --test tests/*.test.js` per `package.json`). It is **not** wrapped inside `npm run check` in the current configuration; treat it as an explicit additional local gate when the change class is `surface`, `boundary`, `release`, or `governance` and any test or production code is touched.

Recommended invocation order for a non-trivial change:

```bash
node --test tests/<narrow-surface>.test.js
npm test
npm run check
npm run llm:guidance
npm run release:readiness     # for release-class changes
git diff --check
```

`npm run release:readiness` is read-only.

## 10. Branch Gate

A branch may be created only when:

- the current working tree is clean OR the prior slice has been committed,
- the branch name encodes the slice scope (`docs/`, `feat/`, `fix/`, `chore/`, `governance/`),
- the change class is named in the first commit message or PR body,
- the slice is small enough to be reviewed in one sitting.

Branches that drift into a second class are split before further work.

## 11. PR Gate

A pull request may be opened only when:

- the Local Gate Ladder has passed locally on the branch's HEAD,
- the change class is declared in the PR description,
- the PR description states what proof boundary the change respects or moves,
- forbidden authority per the Authority Table (Section 7) is not invoked,
- truth labels for any new or changed public claim are present (Section 22),
- the diff is contained to the declared scope (no incidental edits).

CI runs the same Local Gate Ladder. A green CI is a necessary, not sufficient, condition for merge.

## 12. Merge Gate

A PR may be merged only when:

- PR Gate is satisfied,
- at least one human reviewer has approved (operator self-approval acceptable for solo operator stage, recorded in the release receipt),
- any unresolved review comment is either addressed or explicitly accepted with rationale,
- merge method is a single commit (squash) unless the slice was already structured as a clean series,
- the merge commit message preserves the change-class declaration.

## 13. Release Candidate Gate

A release candidate is only ready when:

- merged main is green on the Local Gate Ladder,
- `npm run release:readiness` reports no unaccepted blocker,
- all `boundary` or `release` class changes since the last release reference an ADR, Component DNA row, or canon doc,
- the public claim surfaces (README, GTM, decks, landing, Canva, emulator) have been re-checked against the Claim Gate (Section 22),
- the proposed release notes use only allowed proof-safe language (per `LLM_SYSTEM_FLOW.md`).

## 14. Release Gate

A release may be cut only when:

- Release Candidate Gate is satisfied,
- the Release Receipt (Section 24) has been drafted, reviewed, and is ready to write,
- the operator has provided explicit typed authorization for the publish/tag/push action,
- the rollback plan (Section 25) is named and reachable,
- no `FUTURE_FOREST` capability is claimed as shipping in the release notes,
- no token or economy claim is made anywhere in release artifacts.

## 15. Operator-Local Extended Gate

The operator may run an extended gate from outside this repository:

```bash
~/.dema/bin/mu-test-all
```

This gate may be required by the operator for Node0 discipline, but it is **not** a clean-checkout repo requirement because it lives outside the repository. A contributor without the μ-layer installed may still pass every repo-level gate. Operator gate output is recorded in the release receipt when run, but its absence does not block contribution from non-operators.

## 16. Hard-Stop vs Soft-Stop Gates

**Hard-stop** (must pass; failure blocks the slice):

- `npm run check`
- `npm run llm:guidance`
- `git diff --check`
- `npm test` for `surface`, `boundary`, `release`, `governance` classes touching code
- Authority Table compliance
- Claim Gate compliance for any modified public-facing surface

**Soft-stop** (failure surfaces a risk note but does not block by default; the operator may promote any soft-stop to hard-stop for a given release):

- `npm run release:readiness` advisory warnings
- coverage delta vs. prior release
- diff churn outside the declared change class
- documentation freshness on referenced docs

A soft-stop promoted to hard-stop must be named in the release receipt.

## 17. CI/CD Ownership

- CI (run-on-PR validation): owned by the repository's existing workflows. This spine does not add or edit workflows.
- CD (continuous deployment): **not configured**. Any deployment is a separate hard-gated operation per `DELIVERY_BLUEPRINT.md` Section "CD boundary."
- Release tagging and publication: operator-driven, gated by Section 14.
- Receipt issuance for governed-runtime events: owned by the substrate, not by Dema or CI.

## 18. DORA Metrics

Tracked under their canonical names:

| Metric                  | Definition (per DORA)                                                                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lead time for changes   | Time from code committed to code running successfully in the target environment. For Dema's current state, target environment is "merged main passing the Local Gate Ladder." |
| Deployment frequency    | How often the team successfully releases to the target environment. For Dema, this is release-tag frequency on `main`.                                                        |
| Time to restore service | How long it takes to recover from a release-induced regression. For Dema, this is time from regression detection to corrective release.                                       |
| Change failure rate     | Percentage of releases that result in degraded service or require rollback.                                                                                                   |

These four are the canonical DORA names. Any internal Dema metric must not be presented as DORA.

## 19. BIZRA Internal Extension Metrics

Tracked beside DORA, labeled separately so reviewers cannot conflate them with DORA:

| Metric                       | Definition                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| Proof verification rate      | Fraction of release receipts whose claimed proof artifacts verify on independent re-run.      |
| Claim correction rate        | Fraction of public claims that required a post-publication correction.                        |
| Refusal-path coverage        | Fraction of forbidden-shortcut scenarios that have an exercised refusal path in tests or doc. |
| Receipt-backed release ratio | Fraction of releases that ship with a Release Receipt (Section 24) drafted and recorded.      |
| Delivery rework rate         | Fraction of PRs that require >1 round of substantial rework before merge.                     |

These are **BIZRA internal extension metrics**. They do not extend or rename DORA.

## 20. Security and Supply-Chain Controls

Current controls confirmed by repo state at the time of this spine:

- **Zero npm dependencies** — `package.json` declares no `dependencies` or `devDependencies` block. Maintaining zero dependencies is a current strength and a default constraint; any addition requires written justification per `DELIVERY_BLUEPRINT.md`.
- **Engine pin** — `engines.node = ">=20"` declared in `package.json`.
- **Env hygiene check** — `npm run env-hygiene` and `env-hygiene:strict` available as repo scripts.
- **Actuator boundary** — referenced in working-artifact specs under `docs/superpowers/specs/`; pre-runtime invariant.
- **Consent boundary** — bound by ADR-005 (operator actions require explicit consent).
- **Path containment** — local state confined to `DEMA_HOME` or `~/.dema` per ADR-004.

What is **not** claimed by this spine:

- No SLSA certification claim.
- No NIST certification claim.
- NIST SSDF and SLSA are informing references only; they do not bind Dema until an explicit conformance assessment exists.
- No supply-chain attestation beyond what local scripts verify.

## 21. Performance-Quality Assurance Boundary

This spine does not declare any benchmark number. The dedicated document is the future `docs/PERFORMANCE_QUALITY_ASSURANCE_v0_1.md` (not yet authored).

Required fields for every future performance metric, before it is reported:

- metric name
- command (exact invocation)
- hardware / context (CPU, memory, OS, Node version)
- commit SHA
- baseline (prior measurement and its commit SHA)
- target (the metric's intended bound)
- p50 / p95 / p99 where applicable
- regression threshold (when a degradation blocks merge)
- evidence artifact (path or hash of the run output)

Until that document exists, no performance number may appear in release notes, README, GTM, or Canva.

## 22. Documentation and Claim Gate

Every public claim is labeled with exactly one of:

| Label               | Meaning                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------- |
| `VERIFIED`          | Verified by repeatable mechanism with evidence artifact reachable from the repo.            |
| `MEASURED`          | Measured under recorded conditions with reproducible command and artifact.                  |
| `DERIVED`           | Logically follows from a `VERIFIED` or `MEASURED` claim, with the derivation made explicit. |
| `SCENARIO`          | Hypothetical, simulated, or scenario-based output; not a measurement.                       |
| `DESIGNED_NOT_LIVE` | Spec or design exists; no runtime; must not be presented as live.                           |
| `UNKNOWN`           | Honest absence of evidence; must not be paired with confident language.                     |
| `FORBIDDEN`         | A claim that may not be made anywhere on public surfaces.                                   |

Public GTM, Canva assets, README, landing page, emulator output, decks, and any external presentation must not claim:

- live public URP,
- live token value,
- guaranteed rewards,
- Sharia certification,
- 1M-node proof,
- production federation,

unless `VERIFIED` or `MEASURED` evidence exists. Until then these are `DESIGNED_NOT_LIVE` or `FORBIDDEN` per the underlying component's Component DNA status.

## 23. Artifact and Provenance Rules

- Release artifacts (binaries, installers, hash manifests, signed pins) are bound to a single commit SHA.
- Hash manifests reference the canonical priority anchor in `proof-of-priority/manifest.json` when applicable.
- No artifact may be republished under the same name with different content; corrections ship under a new version.
- Generated artifacts that are not part of the release surface are either gitignored or explicitly reviewed in the PR.
- External cross-references (GitHub release page, npm registry where applicable, public timestamps) record the commit SHA.

## 24. Release Receipt Template

Every Dema release records a receipt in the operator-local receipt chain. The Release Receipt is not minted by Dema; it is drafted in this repo and handed to the governed runtime for issuance per `RECEIPTS.md`.

```yaml
release_receipt:
  schema: bizra.dema.release_receipt.v0.1
  release_id: # e.g. dema-v0.4.0
  repo: # this repo
  branch: # release branch or main
  commit_sha: # full SHA at release point
  change_class: # docs-only | tests-only | surface | boundary | release | governance
  gates_run:
    - npm run check
    - npm run llm:guidance
    - git diff --check
    - npm test
    - npm run release:readiness
    - "~/.dema/bin/mu-test-all" # if operator extended gate ran
  gate_results:
    npm_run_check: # PASS | FAIL | SKIPPED, with reason if skipped
    npm_run_llm_guidance:
    git_diff_check:
    npm_test:
    npm_run_release_readiness:
    mu_test_all:
  truth_labels:
    public_claims:
      - claim: ""
        label: "" # VERIFIED | MEASURED | DERIVED | SCENARIO | DESIGNED_NOT_LIVE | UNKNOWN | FORBIDDEN
        evidence: "" # path or hash
  risks:
    - id: ""
      severity: low | medium | high
      mitigation: ""
  rollback_plan: "" # exact action that reverses the release
  artifacts:
    - name: ""
      hash: ""
      location: ""
  operator_approval:
    typed_consent: "" # the exact string the operator typed
    timestamp: "" # UTC ISO 8601
  notes: ""
```

A release without a drafted Release Receipt is incomplete.

## 25. Rollback and Recovery Rules

| Surface                     | Rollback action                                                                                    | Recovery time target |
| --------------------------- | -------------------------------------------------------------------------------------------------- | -------------------- |
| Local commit / merge        | `git revert <sha>` on `main`, new release with corrective notes                                    | Same session         |
| Installer artifact          | Pull unpublished candidate; or publish corrective release with new version                         | < 24 hours           |
| Local state under `~/.dema` | Operator-driven cleanup with explicit scope; no Dema-side automatic mutation                       | Operator-paced       |
| Public doc claim            | Doc correction PR + claim correction noted in next Release Receipt                                 | < 48 hours           |
| Receipt chain               | Append-only; corrections shipped as new receipt entries by the governed runtime, never as rewrites | Substrate-paced      |

Every release with a non-trivial blast radius names a rollback action **before** the release is cut, recorded in the Release Receipt.

## 26. Relationship to DELIVERY_BLUEPRINT.md

`docs/DELIVERY_BLUEPRINT.md` (truth label `DECLARED_DELIVERY_BLUEPRINT_V0_1`) is the broader DevOps blueprint. It covers MBOK alignment, the CI/CD maturity model, the CI pipeline blueprint, observability surfaces, and the CD boundary.

This Delivery Spine is narrower and more opinionated:

- the Blueprint **describes** the value stream; the Spine **gates** the value stream,
- the Blueprint names DevOps controls; the Spine binds those controls to release decisions,
- the Blueprint sets posture; the Spine sets refusals.

When the two differ on a specific gate, **the Spine governs** until the Blueprint is updated to match.

## 27. Explicit Non-Goals

This slice **does not**:

- create a `scripts/delivery-check.mjs` or any new script,
- edit any GitHub Actions workflow,
- activate any runtime, daemon, federation, Node1, Node2, or governed runtime,
- automate any release step,
- activate any token or economic surface,
- import from `bizra-node0-genesis`,
- mint any proof or receipt,
- replace `DELIVERY_BLUEPRINT.md` (the two coexist).

## 28. Deferred Automation

Named and deferred, not abandoned:

- `scripts/delivery-check.mjs` — single command that aggregates the Local Gate Ladder and reports a structured pass/fail.
- Release Receipt generator — a future script that scaffolds the Section 24 template from current branch state and gate output.
- Claim Gate linter — a future script that scans changed public-surface files for the forbidden claim list and the truth-label requirement.
- Authority Table linter — a future script that flags new file paths or commands that cross Authority Table boundaries.
- DORA collector — a future script that derives lead time, deployment frequency, restore time, and change failure rate from `git` and release-tag history.
- BIZRA Internal Extension Metrics collector — a future script that derives proof verification rate, claim correction rate, and the others in Section 19 from receipts and PR history.

Each deferred item is a separate future slice.

## 29. Next Canon Slices

This Delivery Spine depends on and points forward to:

- `docs/THREE_REPO_PRODUCT_STACK_CANON_v0_1.md` — repo authority canon.
- `docs/NODE0_DEMA_COMPLETE_COMPONENT_DNA_v0_1.md` (when present on the merged main) — component truth labels.
- `docs/DELIVERY_BLUEPRINT.md` — broader DevOps blueprint.
- `docs/PERFORMANCE_QUALITY_ASSURANCE_v0_1.md` (future) — performance metric authority.
- `docs/06-adr/ADR-005-operator-actions-require-explicit-consent.md` — consent law.
- `docs/06-adr/ADR-006-continuous-assurance-and-no-mint-verification.md` — no-mint verification posture.
- `docs/06-adr/ADR-007-multi-session-chain-policy.md` — multi-session chain policy.
- `docs/RECEIPTS.md` — receipt boundary.
- `docs/LIGHTHOUSE.md` — private lighthouse operator lane.

When any of these change, this spine is re-read for drift. When this spine changes, the linked canon is re-read for drift.

The load-bearing surfaces of this spine are Sections 7 (Authority Table), 16 (Hard-Stop vs Soft-Stop), 22 (Claim Gate), and 24 (Release Receipt Template). The other sections explain them.
