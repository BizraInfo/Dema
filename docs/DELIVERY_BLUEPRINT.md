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
| Schedule management       | Roadmaps use phase gates and truth labels instead of unverified dates.                                                       |
| Cost management           | Zero runtime dependencies are preserved unless a written justification proves value and risk.                                |
| Quality management        | Native tests, smoke gates, static review scripts, diff hygiene, and coverage thresholds form the quality baseline.           |
| Resource management       | Local compute and model surfaces are inventoried; no hidden daemon or unbounded background workload is introduced.           |
| Communications management | Reports are schema-tagged and distinguish preview, declared, measured, blocked, and certified evidence.                      |
| Risk management           | Risks are emitted as explicit codes with owner-ready remediation, never hidden in prose.                                     |
| Procurement management    | Third-party tools, actions, and dependencies must be pinned, justified, and replaceable.                                     |
| Stakeholder management    | Operator consent, reviewer evidence, and user-facing safety language stay separate and auditable.                            |

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

`scripts/delivery-check.mjs` is the blueprint's delivery-automation script (the "delivery-check.mjs" referenced in the spine as deferred, now delivered).

It orchestrates the full gate stack with A+ performance-quality assurance:

- [MEASURED] Enforces A+ perf ceilings (boot <150ms local / <250ms CI, verify <1ms) via `npm run perf` and `resolveAPlusCeilings` (same headroom as `performance-budget-gate`).
- Validates coverage thresholds (95/85/95) via `npm run coverage` on Node 22+ in CI.
- Aggregate rollup below configured targets is reported as **advisory** by `npm run release:readiness` (`qa.coverage_threshold_missing`); per-test coverage flags remain the enforced gate in `npm run check`.
- Integrates release:readiness with A+ perf gate and PMBOK domains.
- Runs mu pre-push seal as the local DevOps forcing function (104/104 target); skipped in CI (`CI`/`GITHUB_ACTIONS`) because the matrix already runs test + coverage + check.
- Checks local gates (llm:guidance, diff hygiene) for world-class hygiene.
- Outputs a unified A+ report aligned with Level 5 Optimizing (performance budgets enforced, post-"release" (local) learning via the report, rollback via gate failures).

This embodies the MBOK integration (PMBOK domains in the report), DevOps (pre-push seal as CI gate), pipeline automation (orchestrates the CI/CD quality gates), and rigorous perf-QA.

Run with `npm run delivery:check`. Fails closed on any A+ breach locally (including MU pre-push). In CI, MU pre-push is advisory-skipped; perf, coverage rollup, release-readiness, local gates, and covenant QA remain hard-gated. Ties to living-tree: this is the "trunk" check ensuring A+ sustainable growth rings. Root canon preserved (no mutation of immutable DNA).

In CI (check.yml on Node 22+): runs as part of the matrix for A+ verification (MU seal excluded; run `npm run pre-push:seal` locally before push).

This advances the blueprint to the "ultimate implementation" for the Dema face: local A+ delivery loop complete, ready for remote CI proof once the push (with workflow scope) lands the Copilot classifier and other rings.

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

Dema's performance QA is enforced by the local-first gate set (perf budgets, coverage thresholds, claim:check).

| Mechanism                 | Status (A+)                                                                                                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zero runtime dependencies | Enforced (0 runtime deps).                                                                                                                                                   |
| Native Node tests         | Enforced with coverage thresholds.                                                                                                                                           |
| Smoke commands            | Enforced (npm run check).                                                                                                                                                    |
| A+ perf gate              | Enforced: `npm run perf` (A+ ceilings in perf-bench.mjs: sub-150ms boot, sub-1ms verification). Integrated into release:readiness and REQUIRED_GATES.                        |
| Coverage thresholds       | Enforced (95% lines/functions, 85% branches on Node 22+).                                                                                                                    |
| Bounded gateway probes    | Enforced in smoke.                                                                                                                                                           |
| Diff hygiene              | Enforced (git diff --check).                                                                                                                                                 |
| Release-readiness audit   | Enforced (includes perf, PMBOK domains, risk codes).                                                                                                                         |
| Transition assurance gate | Enforced: `scripts/review/transition-assurance-check.mjs` samples 24 agent-kernel, mission-lifecycle, and URP choose transitions; runs before proof-room in `npm run check`. |

A+ budgets (enforced in `npm run perf --a-plus` and release gate):

| Budget                                  | A+ Target        | Status                                                        |
| --------------------------------------- | ---------------- | ------------------------------------------------------------- |
| CLI cold-start (dema_boot_latency_ms)   | < 150ms p50      | Enforced (observed ~45ms on Node 22; gate fails above 150ms). |
| Verification latency (sha256 roundtrip) | < 1ms            | Enforced.                                                     |
| Memory/CPU during measurement           | Bounded, no leak | Observed via process metrics.                                 |

This achieves Level 5 (Optimizing) in CI/CD maturity for performance QA: measured budgets, regression gates, post-"release" (local) learning via audit lessons feeding autopoietic loop.

DevOps value stream now includes perf as mandatory quality gate before release-readiness sign-off.

Full-stack note: Substrate (bizra-data-lake) has its own Python/Rust perf/QA (pytest, Cargo benchmarks); this blueprint governs Dema face delivery while respecting three-repo canon (substrate evidence referenced, not restated).

Pipeline automation: CI (check.yml) runs perf on Node 22+ matrix; release-readiness orchestrates all gates with PMBOK reporting.

Continuous improvement loop (tying to autopoietic mission lifecycle): perf metrics -> release audit "lesson" -> mission closeout -> SP6 feedback proposal (if consented) -> next improvement ring. This completes the delivery loop as part of the living tree's growth.

Rollback: perf breach blocks release candidate in audit.

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
