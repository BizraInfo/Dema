# BIZRA Three-Repo Product Stack Canon v0.1

Status: Working Canon
Date: 2026-05-20
Scope: Dema product face, bizra-data-lake governed runtime/proof core, bizra-node0-genesis archived R&D source
Change class: Documentation only

## 1. Purpose

This document prevents repo-identity drift across the BIZRA product stack.

It defines which repository is authoritative for product experience, governed runtime/proof logic, and historical Node0 prototype knowledge. It also establishes the delivery-management language needed for future DevOps, CI/CD, performance-quality assurance, and release governance without prematurely expanding scope.

The operating law for this canon is:

```text
Dema is the door.
bizra-data-lake is the engine.
bizra-node0-genesis is the archive.
Do not merge their identities.
Define their contract.
Ship through the smallest proof-bearing slice.
```

## 2. Repository Authority Table

| Repository | Canon role | Authority | Not authority for | Current product posture |
|---|---|---|---|---|
| `BizraInfo/Dema` | Product face / operator UX / consent surface | Onboarding, Homebase UX, CLI/TUI journey, setup, status, consent planning, receipt browsing, user-facing wording | Governed runtime execution, token economics, federation, core proof engine | Active product surface |
| `BizraInfo/bizra-data-lake` | Governed runtime / proof core / sovereign substrate | Constitutional thresholds, FATE/SAT/PAT proof logic, runtime/proof spine, receipts, core data/proof substrate | First-run product UX, public onboarding copy, archived prototype experiments | Active core/runtime source of truth |
| `BizraInfo/bizra-node0-genesis` | Archived Node0 R&D/prototype source | Historical patterns, earlier experiments, migration candidates, lessons learned | Current product face, current production runtime authority, public entry point | Archived/reference only |

## 3. Product Boundary

Dema is the only public entry point for the first user journey.

Dema may:

```text
- introduce BIZRA
- onboard the operator
- show local status
- detect local readiness
- preview missions
- explain consent requirements
- show blocked actions
- read/list available receipts
- hand off to governed runtime paths
```

Dema must not claim that it directly performs governed runtime execution if that execution belongs to `bizra-data-lake` or another governed runtime path.

## 4. Runtime Boundary

`bizra-data-lake` is authoritative for governed runtime and proof-core claims.

`bizra-omega` is the Rust runtime/proof workspace inside `bizra-data-lake`; references to Data Lake runtime/proof authority include that workspace unless a document explicitly narrows the scope.

Runtime/proof claims must point to evidence in `bizra-data-lake`, such as:

```text
- constitutional thresholds
- FATE/SAT/PAT proof surfaces
- proof-engine receipts
- runtime gates
- CI/security gates
- canonical metrics
- API exposure policy
- cryptographic or empirical proof artifacts
```

If a claim cannot be traced to code, tests, receipts, or canonical metrics, it must be labeled as design intent, roadmap, or hypothesis.

## 5. Archive Boundary

`bizra-node0-genesis` is a historical R&D and prototype archive.

It may be used for:

```text
- pattern mining
- migration candidates
- prototype comparison
- historical continuity
- lessons learned
- anti-pattern detection
```

It must not be described as the current product runtime, current user-facing product, or current production authority unless a specific component is migrated into an active repo through a reviewed PR.

## 6. Execution Boundary

BIZRA execution language must distinguish five surfaces:

| Surface | Meaning | Allowed wording |
|---|---|---|
| Product preview | User-facing proposal/explanation | Dema previews/plans/explains |
| Consent gate | Human authorization layer | Dema requests exact consent where required |
| Governed runtime | Actual bounded action executor | Governed runtime executes under proof controls |
| Receipt/proof | Evidence output | Receipts prove what happened |
| Archive | Historical source | Node0 Genesis records prior exploration |

Forbidden collapse:

```text
Dema executed the runtime mission.
Node0 Genesis is the current production node.
Data Lake is the onboarding product.
Archived prototype code is production proof.
```

Correct form:

```text
Dema prepared the bounded mission preview and consent surface.
The governed runtime executed the authorized action.
The proof/receipt layer recorded the result.
```

## 7. Consent Boundary

Consent is a product and runtime invariant.

Dema owns the human-facing consent experience. The governed runtime owns enforcement and proof of authorized execution.

Minimum consent UX requirements:

```text
- intent summary
- action class
- affected local paths/resources
- execution boundary
- reversible vs irreversible classification
- exact consent phrase where required
- proof/receipt destination
- refusal/modify option
```

No product copy may imply that consent is optional for mutation, public sharing, token/economic actions, federation, external network effects, or irreversible state changes.

## 8. Receipt Boundary

Receipts are the trust surface.

Dema may show and explain receipts. `bizra-data-lake` or the governed runtime/proof layer is authoritative for receipt generation and proof semantics.

Receipt statements must distinguish:

```text
- previewed
- executed
- receipted
- verified
- replayable
- independently reproduced
```

Do not use `verified`, `ironclad`, `production-ready`, `network-ready`, or `economic-final` unless the claim is backed by specific evidence.

## 9. Management Body of Knowledge Mapping

BIZRA delivery work must be managed as a professional product program, not a stream of isolated features.

| Management domain | BIZRA delivery rule |
|---|---|
| Integration management | Each slice must identify the authoritative repo and downstream dependencies |
| Scope management | Use smallest solvable slice; avoid multi-doc or multi-hook expansion unless explicitly authorized |
| Schedule management | Sequence active lanes before opening new governance lanes |
| Cost/resource management | Prefer local checks and minimal new infrastructure before external automation |
| Quality management | Every public boundary requires replayable tests or proof artifacts |
| Risk management | Maintain explicit risk register for security, proof, release, and claim drift |
| Communications management | Use one source of truth for repo roles and public wording |
| Stakeholder management | Operator sovereignty, future Node1 users, contributors, and proof auditors are separate stakeholders |
| Procurement/dependency management | New dependencies require purpose, risk, fallback, and audit path |
| Delivery measurement | Track DORA-style delivery performance only in context of one repo/service at a time |

## 10. DevOps and CI/CD Canon

CI/CD must prove small, bounded state transitions.

The delivery ladder is:

```text
local gate -> branch gate -> PR gate -> merge gate -> release candidate gate -> release receipt
```

Repo-reproducible minimum local gate:

```text
npm test
npm run check
npm run llm:guidance
npm run release:readiness
git diff --check
```

Operator-local extended gate:

```text
~/.dema/bin/mu-test-all
```

The extended gate is valid operational evidence for the operator's local Node0 harness, but it is not a repo-reproducible minimum because it depends on an operator-local absolute path outside a clean checkout.

Minimum PR gate:

```text
- tests green
- review threads resolved or explicitly deferred
- proof/receipt impact stated
- product boundary unchanged or documented
- no stale public claims
- no repo-role drift
```

Minimum release candidate gate:

```text
- Dema journey tested
- governed runtime boundary documented
- receipt/proof path verified
- known risks listed
- rollback path defined
- claims bounded to evidence
```

## 11. Performance-Quality Assurance Canon

Performance-quality assurance must measure the product path, not the whole dream.

Initial PQA targets should focus on:

```text
- Dema command latency
- test suite runtime
- μ-layer orchestrator runtime
- receipt list/read latency
- release gate runtime
- memory/context cap discipline
- deterministic CLI output where expected
```

Metrics must be used to improve the system, not to create vanity claims.

Any future performance report must include:

```text
metric
hardware/context
commit SHA
command/run method
p50/p95/p99 if applicable
regression threshold
receipt/proof pointer if available
```

## 12. Standards Alignment

This canon aligns future delivery work with three external professional standards families:

```text
DORA Four Key Metrics:
  - lead time for changes
  - deployment frequency
  - time to restore service
  - change failure rate

BIZRA internal delivery extensions:
  - deployment rework rate
  - proof/receipt verification rate
  - local-governance gate pass rate

NIST SSDF:
  secure software development practices integrated into the SDLC.

SLSA:
  artifact and supply-chain security through provenance, verification,
  source/build controls, and incrementally adoptable trust levels.
```

These standards inform future Delivery Spine work. They do not automatically prove that BIZRA has achieved any specific certification level.

## 13. Forbidden Public Wording

Do not say:

```text
BIZRA is production-ready at network scale.
Dema executes all governed runtime actions directly.
Node0 Genesis is the active production node.
BIZRA has a live economic/token network.
BIZRA is independently security-audited.
BIZRA has proven one-million-node scale.
BIZRA makes centralized AI obsolete.
```

Allowed wording:

```text
BIZRA is building a local-first, consent-bound, receipt-backed agent infrastructure.
Dema is the product face and operator companion.
bizra-data-lake contains the governed runtime/proof core.
bizra-node0-genesis is an archived R&D/prototype source.
Current claims are bounded to code, tests, receipts, and canonical metrics.
```

## 14. Archive-to-Active Migration Rule

Any migration from `bizra-node0-genesis` into active repos must satisfy:

```text
1. Identify source file/pattern in archive.
2. State why active repo needs it.
3. Reduce it to smallest useful slice.
4. Add tests before or with migration.
5. Remove obsolete names/claims.
6. Document the new authority surface.
7. Avoid importing archive dependency sprawl.
```

No archive component becomes active canon merely by being historically important.

## 15. Proof-of-Truth Convergence

| Claim | Formal | Cryptographic | Empirical | Economic | Status |
|---|---|---|---|---|---|
| Dema is the product face | This canon + README wording | N/A | CLI/product tests | N/A | Active canon |
| bizra-data-lake is runtime/proof core | This canon + core docs/code | Receipts/proof paths | Core tests | Future PoI only | Active canon |
| Node0 Genesis is archive | This canon + archived repo state | N/A | Historical repo evidence | N/A | Active canon |
| Delivery Spine exists | Deferred | Deferred | Deferred | N/A | Not yet implemented |
| Full URP/token economy is live | No | No | No | No | Forbidden claim |

## 16. Immediate Next Slice After This Canon

Only after this document is reviewed should the project open the next governance slice:

```text
DELIVERY_SPINE_v0_1.md
```

That future document should define:

```text
- release gate matrix
- CI/CD gate ownership
- DORA measurement plan
- secure development controls
- performance-quality assurance thresholds
- artifact/provenance rules
- release receipt template
```

Do not bundle that future work into this canon slice.

## 17. Final Operating Law

```text
First prevent identity drift.
Then automate delivery governance.
Then measure performance.
Then expand release machinery.
```
