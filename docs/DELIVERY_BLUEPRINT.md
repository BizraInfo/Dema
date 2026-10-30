# Dema Delivery Blueprint

## Status

Truth label: `DECLARED_DELIVERY_BLUEPRINT_V0_1`.

This blueprint defines the professional delivery system for Dema: management
discipline, DevOps posture, CI/CD quality gates, performance-quality assurance,
release readiness, rollback, traceability, and operating boundaries.

It is intentionally blueprint-only at this stage. It does not deploy services,
publish artifacts, access secrets, modify CI workflows, start runtime, mint
receipts, activate federation, or authorize Step 7.

## Operating law

```text
No claim without proof.
No action without consent.
No memory without boundary.
No monetization without verified benefit.
No release without reversible evidence and explicit gates.
```

Dema remains the local product face. Governed runtime, receipt issuance,
federation, and external commitments remain outside this repository unless a
separate hard-gated operation explicitly authorizes them.

## Management Body of Knowledge alignment

| Domain                    | Dema delivery control                                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Integration management    | A single release-readiness report joins scope, risk, QA, CI/CD, docs, dependencies, installer posture, and rollback posture. |
| Scope management          | Each PR carries one invariant or one product surface; mixed bundles are split before commit.                                 |
| Schedule management       | Roadmaps use evidence-based phase gates instead of treating dates or activity as completion.                                   |
| Cost management           | Track CI, storage, compute, and any approved model-call budget; compare measured cost with accepted user benefit.              |
| Quality management        | Focused and aggregate tests, negative controls, security review, UX checks, performance regression gates, and diff hygiene.     |
| Resource management       | Record local compute, memory, storage, and model constraints; an unavailable resource is an infrastructure finding, not a code failure. |
| Communications management | Reports are schema-tagged and distinguish preview, declared, measured, blocked, and certified evidence.                      |
| Risk management           | Risks are emitted as explicit codes with owner-ready remediation, never hidden in prose.                                     |
| Procurement management    | Third-party tools, actions, and dependencies must be pinned, justified, and replaceable.                                     |
| Stakeholder management    | Operator consent, reviewer evidence, and user-facing safety language stay separate and auditable.                            |

## Node0 lifecycle delivery map (proposed overlay)

This is a project-management overlay for the phase names used in current Node0
planning, not a replacement capability lifecycle. The canon in
`docs/canon/BIZRA_LIFECYCLE_SEED_TO_POOL.md` remains Collect → Verify → Index →
Choose → Mint; its current status table marks Index, Choose, and Mint
`DESIGNED_NOT_LIVE`. The `NODE0_DEMA_COMPLETE_COMPONENT_DNA_v0_1.md` status labels
also remain binding. This overlay promotes nothing. The Delivery Spine remains
authoritative for Dema release gates; phase exit requires the evidence below,
not completion of paperwork alone.

| Phase | Management focus | Build / QA evidence required before the phase can claim an exit |
| --- | --- | --- |
| Seed / Covenant | Human purpose, accountable owner, scope, claim class, acceptance and cost ceiling. | Versioned intent and acceptance criteria; founder-level decisions remain human. A spec or prototype is not a shipped capability. |
| Estate & Spine | Asset ownership, source lineage, preservation risk, dependencies and work-in-progress limits. | Current repository/worktree identities, dirty-state inventory, exact source bindings, baseline gate and explicit unknowns. No cleanup of unclassified work. |
| Identity Birth | Identity ownership, privacy, threat model, recovery and key custody. | Reviewed identity flow and refusal cases; credential ceremony is separately protected. A fixture or hash does not establish a born identity. |
| Ledger & Mission | Single mission pointer, status transitions, correction/revocation, replay and audit trail. | Transition and negative-control tests, durable state/readback, provenance-bound receipt. A test receipt does not establish a live effect. |
| Memory Constitution | Purpose, consent, retention, provenance, correction and forgetting. | Retrieval and retention cases, sensitive-data boundaries, and observable user controls. Indexing alone is not permission to remember or use data. |
| Homebase / Human Bond | First-use journey, accessibility, Arabic/RTL, privacy, support and human choice. | Tested consent/no-action flows plus human UX review for dignity and language. Discovery is not permission. |
| Presence | Operations, reliability budgets, incident response, backups, restore and rollback. | Evidence from the intended environment: health checks, restore/restart behavior, rollback rehearsal and an explicitly scoped soak. Local tests alone do not qualify production. |
| Mission Lifecycle | Backlog ownership, one bounded sprint contract, review, acceptance and handoff. | Source-bound plan, red-first focused tests, independent review, exact-head CI evidence and human acceptance. Runtime effects remain behind the governed authorization path. |
| Forest / GTM | Customer discovery, service/support model, privacy, supply chain and economic assumptions. | Bounded pilot observations, substantiated public claims, cost/benefit evidence and support ownership. No economy or federation claim without its own proof. |

Proposed responsibility map: the First Architect retains covenant, identity,
release and external-effect decisions; Dema organizes intent, work status and
evidence; builders propose bounded changes; Guard enforces declared stops; and
independent verification remains a distinct role. This is an operating design,
not a claim that PAT, SAT or production FATE is currently active.

## DevOps value stream

```text
intent
-> scoped invariant
-> local implementation or spec
-> targeted validation
-> full local gate
-> release-readiness audit
-> human review
-> explicit publish/deploy gate, if applicable
```

The default value stream ends at local verification. Publishing, deployment,
identity issuance, public timestamps, federation, and economic actions are
hard-stop events that require separate typed authorization.

## CI/CD maturity model

| Level | Name       | Dema posture                                                                                               |
| ----- | ---------- | ---------------------------------------------------------------------------------------------------------- |
| 0     | Ad hoc     | Not acceptable. No untracked release decisions.                                                            |
| 1     | Scripted   | Local `npm test` and smoke commands exist.                                                                 |
| 2     | Repeatable | `npm run check` provides a repeatable local gate.                                                          |
| 3     | Defined    | Release-readiness audit, review classes, canon checks, and proof-safe docs gates are declared.             |
| 4     | Managed    | Coverage thresholds, pinned actions, risk-code reporting, and release decision records become mandatory.   |
| 5     | Optimizing | Performance budgets, rollback rehearsals, SLO dashboards, and post-release learning loops become measured. |

Dema targets Level 4 before any public release and Level 5 before broad
distribution.

The target is not a status claim. Source presence does not establish remote
workflow success, configured branch protection, production SLOs, rollback
rehearsals, or a continuously observed improvement loop. Current maturity must
be assessed from exact-head evidence and the intended deployment environment.

## Local gate stack

Run the narrowest relevant check first, then the full local gate:

```bash
node --test tests/<surface>.test.js
npm test
npm run check
npm run llm:guidance
npm run release:readiness
git diff --check
```

`npm run release:readiness` is a read-only audit. It may report blockers, but it
must not deploy, publish, access secrets, modify CI, or mutate runtime state.
When workflow files are already modified and the operator has explicitly
authorized those CI changes, record that authorization in the audit with:

```bash
npm run release:readiness -- --ci-workflow-changes-authorized
```

The flag does not edit workflows or imply publication approval. It only prevents
the current workflow worktree changes from being classified as an unresolved
hard-stop gate in that local report.

## Delivery Automation: delivery-check.mjs

`scripts/delivery-check.mjs` is an existing local composite gate. Its presence
and workflow wiring are source-observed; a pass for a particular commit still
requires a fresh command result.

It runs a bounded subset of the delivery checks:

- [CITED] Calls `npm run perf` with the repository's A+ ceilings: verification latency at 1 ms and CLI boot at 150 ms locally / 275 ms in CI. These are local/CI regression thresholds, not customer SLOs (`scripts/perf-bench.mjs`, `packages/perf/src/perf-ceilings.js`).
- Inspects whether coverage reporting and thresholds are configured; it does not run the full `npm run coverage` suite itself. The CI workflows run their own test and coverage commands.
- Runs release-readiness, `llm:guidance`, diff hygiene, and consent/covenant fixtures. It reports the pre-push seal as a separate operator gate and never invokes it; the secret scanner used by that gate may fetch a pinned binary when its cache is missing.
- Emits a local report. It does not deploy, observe production, rehearse an actual rollback, or close the post-release learning loop.

`delivery:check` complements `npm test`, `npm run coverage`, the relevant package
gates, and exact-head remote CI; it is not a substitute for them. It is a
project-level composite check, not evidence of an external maturity standard.

Run with `npm run delivery:check`. The script fails on its configured local
checks and A+ thresholds; it does not run the full test/coverage suites or the
separate pre-push seal itself.

In CI, `check.yml` invokes it on Node 22.x. This is workflow configuration; a
remote pass for the current commit must be verified from GitHub evidence.

## Proof-of-truth control plane (NODE0-PROOF-OF-TRUTH-CONTROL-PLANE-1A)

[MEASURED] Local-only release proof ledger that joins scattered quality rails into one canonical JSON object:

```text
tests + coverage + perf + delivery:check + CodeQL + gitleaks + claim discipline
→ proof ledger (bizra.dema.node0_proof_of_truth_control_plane.v0.1)
→ release_verdict (BLOCKED | READY_LOCAL in 1B)
→ receipt_hash + next_action
```

Commands:

- `npm run proof:truth` — audit gatherer (`--hermetic` for fixture-only snapshot)
- `npm run proof:truth:check` — hermetic fail-closed gate (also wired in `npm run check` after killer-demo compose + CLI + proof-convergence gates)

1B cap: verifier rejects `READY_REMOTE` and `PUBLIC_SAFE`; economic rail stays `BLOCKED_UNLESS_MEASURED`; no token mint, wallet, URP publication, Node1 activation, or autonomous runtime claim.

Killer-demo stack (compose → CLI → proof convergence) provides the operator-facing demo ladder under `dema demo node0-value-loop` and `dema demo node0-value-loop convergence`.

## CI evidence attestation bridge (NODE0-CI-EVIDENCE-ATTESTATION-BRIDGE-1A)

[MEASURED] Structured, hashable attestation replaces raw `DEMA_PROOF_*` env vars as advisory CI truth:

```text
CI export / operator attestation JSON
→ verify (commit + receipt_hash + boundary + rails)
→ merge into gathered proof ledger
→ proof snapshot attachment → READY_LOCAL eligibility (local-only)
```

Supply attestation to the audit gatherer via `DEMA_CI_EVIDENCE_ATTESTATION_JSON` or `DEMA_CI_EVIDENCE_ATTESTATION_PATH`. Review gate: `node scripts/review/node0-ci-evidence-attestation-check.mjs` (wired in `npm run check`).

## CI evidence attestation export (NODE0-CI-EVIDENCE-ATTESTATION-EXPORT-1B)

[MEASURED] GitHub Actions Node 22 check job exports verified attestation JSON:

```bash
npm run proof:attest:ci
```

Artifact: `node0-ci-evidence-attestation.json` (uploaded from `.github/workflows/check.yml`). Default rails: `ci_matrix=PASS`, `codeql`/`gitleaks=UNKNOWN` unless `NODE0_CI_EVIDENCE_RAIL_*` overrides. Receipt: `docs/receipts/NODE0_CI_EVIDENCE_ATTESTATION_EXPORT_1B.md`.

## CI rail aggregation (NODE0-CI-RAIL-AGGREGATION-1C)

[MEASURED] After `check` completes, `.github/workflows/node0-ci-rail-aggregation.yml` maps check + CodeQL + gitleaks conclusions into one verified attestation:

```bash
npm run proof:attest:ci:aggregate
```

Artifact: `node0-ci-evidence-attestation-aggregated.json`. All rails `PASS` only when all three workflows succeeded for the same commit. Receipt: `docs/receipts/NODE0_CI_RAIL_AGGREGATION_1C.md`.

Still blocked: `READY_REMOTE`, `PUBLIC_SAFE`, token mint, wallet, URP, Node0 activation.

This checkout contains the local proof-ledger and attestation code. It does not
establish a successful remote run, complete release readiness, or Node0
activation. The aggregation workflow covers only `check`, CodeQL and gitleaks;
it omits BIZRA Review Gate and Dema UI.

## CI pipeline blueprint

The target CI pipeline is:

```text
checkout pinned action
-> setup Node pinned action
-> install with audit/fund disabled for deterministic CI install noise
-> npm test
-> npm run coverage
-> npm run check
-> npm run llm:guidance
-> npm run release:readiness -- --json
-> artifact summary with risk codes
```

World-class CI requirements:

1. actions pinned to immutable commit SHAs;
2. Node matrix covering active LTS and current release;
3. no secrets in logs, fixtures, or generated summaries;
4. no deploy step in pull-request validation;
5. risk-code output preserved as review evidence;
6. workflow changes reviewed as their own atomic slice.

## CD boundary

No continuous deployment is configured by this blueprint.

Future CD must be explicit, modular, and reversible:

| Target                  | Minimum gate before use                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| Installer artifact      | Hash manifest, dry-run, uninstall check, rollback note.                                                 |
| Website or docs publish | Proof-safe language review and release decision record.                                                 |
| Runtime service         | Managed secrets, health checks, rollback plan, observability, and SAT/governed-runtime boundary review. |
| Identity-bound artifact | Typed in-the-moment GO and receipt with external cross-reference.                                       |
| Federation or mesh      | Proof gates, consent ceiling, no raw private data, manual review.                                       |

## Performance-quality assurance

The checkout implements local and CI regression checks. The measured targets
below are not production service-level objectives; current customer latency,
availability, capacity, error-rate, and recovery evidence is not established by
these source files.

| Mechanism | Source-observed configuration | Evidence boundary |
| --- | --- | --- |
| Root tests and coverage | `check.yml` runs `npm test` on Node 20.x and 22.x; Node 22.x runs `npm run check`, which includes the configured coverage gate. The coverage script targets 95% lines, 84% branches, and 95% functions. | Configuration exists; current remote conclusions and exact-head results were not checked in this review. |
| Performance A+ gate | [CITED] `npm run perf` and `delivery:check` use inclusive numeric ceilings of 1 ms for verification and 150 ms locally / 275 ms in CI for CLI boot. The composite gate reports PASS only when the benchmark command exits successfully, its summary is OK, and both parsed measurements satisfy those ceilings. The benchmark uses a small sample and reports boot p50 (`scripts/perf-bench.mjs`, `scripts/delivery-check.mjs`, `tests/delivery-check.test.js`). | These are regression-budget checks, not p95/p99 service SLOs or a production baseline. |
| Additional performance budget gate | `scripts/review/performance-budget-gate.mjs` checks first-look render, doctor gather, CLI boot, and process RSS against local/CI thresholds. | A bounded local/CI check; not a sustained load, leak, or user-experience study. |
| Dema UI | `dema-ui.yml` separately runs package tests, typecheck, lint, production build, and dependency audit. | Does not by itself establish accessibility, human usefulness, or production behavior. |
| Rollback and operations | The release process names rollback evidence as a prerequisite. | A failing CI gate blocks a candidate; it does not roll back a deployed service. A production rollback rehearsal, SLO dashboard, restore test, and soak remain unverified here. |

Level 5 (Optimizing) remains a target. The current source shows useful local/CI
gates, but does not prove production SLOs, a rehearsed deployment rollback, or a
continuously measured post-release learning loop. Treat a performance breach as
a release-candidate blocker, not as evidence that a live deployment was
automatically rolled back.

For the substrate (`bizra-data-lake`), use that repository's own test and
benchmark receipts; this Dema blueprint does not inherit or restate them.

## Security and supply-chain controls

Required controls before release:

- no hard-coded credentials or tokens;
- secrets only through managed secret layers or environment injection;
- dependency additions require written justification;
- GitHub Actions pinned to immutable SHAs;
- workflow permissions minimized;
- generated artifacts either ignored or explicitly reviewed;
- review scripts fail closed on unsafe shell, topology drift, or unsupported proof claims.

## Observability and evidence

Local observability uses evidence artifacts, not hidden telemetry:

| Signal            | Boundary                                            |
| ----------------- | --------------------------------------------------- |
| CLI output        | Human-readable and schema-tagged where applicable.  |
| Readiness reports | Local read-only audit; no secrets and no deploy.    |
| Receipts          | Read/list in Dema; issued by governed runtime.      |
| Proof summaries   | Local evidence unless explicitly published.         |
| CI summaries      | Risk codes and gate outcomes only; no private data. |

## Rollout and rollback

| Area           | Rollout control                                              | Rollback control                                                          |
| -------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Source code    | Atomic local commit, review class, gate evidence.            | Revert commit before publish.                                             |
| Installer      | Dry-run, check, hash manifest, exact-consent uninstall path. | Pull unpublished candidate or publish corrective release.                 |
| Local state    | `DEMA_HOME` / `~/.dema` only, schema-tagged writes.          | Remove or migrate state with explicit operator scope.                     |
| Receipts       | Append-only, truth-labeled, hash-linked.                     | Do not rewrite; issue corrective receipt if governed runtime supports it. |
| Public release | Typed GO, release decision record, external artifact hashes. | Revoke distribution channel and publish correction.                       |

## Release-readiness decision rule

A release candidate is not ready unless:

1. local gates pass from a clean checkout;
2. release-readiness audit has no unaccepted blockers;
3. workflow, dependency, installer, docs, and rollback risks are either resolved
   or recorded in a release decision;
4. no runtime, federation, identity, or economy claim is implied by Dema docs;
5. all public-facing language remains proof-safe.

## Non-goals

This blueprint does not authorize:

- CI workflow modification;
- deployment or publication;
- runtime execution;
- secret access;
- Step 7 minting;
- federation or Node1/Node2 activation;
- economic or governance action;
- public readiness claims.

Those remain separate hard-gated operations.
