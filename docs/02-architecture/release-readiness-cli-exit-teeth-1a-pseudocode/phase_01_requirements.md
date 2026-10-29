# Phase 1 · Requirements · Edge Cases · Constraints

**Pseudocode-bundle file:** `phase_01_requirements.md`  
**Maps to:** `RELEASE-READINESS-CLI-EXIT-TEETH-1A`  
**Companion (non-blocking):** `CARTOGRAPHER-CLAIM-STAMP-INTAKE-PREVIEW-1A` (phase 04)  
**Goal:** close the residual false-GREEN path where `node scripts/release-readiness.mjs` prints a report and always exits `0` even when `evaluateReleaseReadiness` would fail.

## Problem statement

SCORE-TEETH-1A (uncommitted as of this spec) already makes `classifyRisks` emit
`ci.workflow_worktree_status_unavailable` when git/worktree evidence is missing,
so `readiness_score` and `evaluateReleaseReadiness` agree on fail-closed.

The CLI entrypoint still:

```text
build report → print JSON|human → exit 0 always
```

Shell / CI / human operators that treat process exit as the gate can still see
GREEN while the report body and evaluate path say BLOCKED.

```text
report → evaluateReleaseReadiness → exit_code ∈ {0,1} → print (still always)
```

## Prior art (MEASURED / INFERRED)

| Item | Status | Notes |
| --- | --- | --- |
| `evaluateReleaseReadiness` | SHIPPED | Fail-closed on schema, blockers, score, worktree |
| SCORE-TEETH-1A in `classifyRisks` | IMPLEMENTED_LOCAL | Must land before or with this slice |
| `delivery-check` uses evaluate | SHIPPED | Already exit-honest for its path |
| CLI exit mirrors evaluate | DESIGNED_NOT_LIVE | This bundle |
| Cartographer JSON ledger on disk | UNKNOWN | Phase 04 intake only; no foreign-repo edits |

## Functional requirements

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-1 | After building the report, CLI calls `evaluateReleaseReadiness(report)` | TDD-EXIT-01 |
| FR-2 | Exit `0` only when `evaluation.ok === true` | TDD-EXIT-02 |
| FR-3 | Exit `1` when `evaluation.ok === false` (any reason list) | TDD-EXIT-03 |
| FR-4 | Human and `--json` modes both print the full report before exiting | TDD-EXIT-04 |
| FR-5 | `--json` stdout remains parseable via `extractReportJson` when exit is 1 | TDD-EXIT-05 |
| FR-6 | Pure helper `exitCodeFromEvaluation(evaluation)` maps `{ok:true}→0`, else `1` | TDD-EXIT-06 |
| FR-7 | Helper fail-closed: non-object / missing `ok` → exit `1` | TDD-EXIT-07 |
| FR-8 | Existing SCORE-TEETH unavailable-worktree fixture implies CLI exit `1` when invoked against that tree | TDD-EXIT-08 |
| FR-9 | No change to `delivery-check` contract in this slice | TDD-EXIT-09 |
| FR-10 | Docs note: exit code is the operator gate; score alone is not | TDD-EXIT-10 |

## Edge cases

| ID | Case | Expected |
| --- | --- | --- |
| EC-1 | Clean authorized worktree, score ≥ minScore | exit 0 |
| EC-2 | Launch blocker present | exit 1, report still printed |
| EC-3 | Score below threshold, no launch blocker | exit 1 |
| EC-4 | `workflow_status.available === false` (SCORE-TEETH) | exit 1 |
| EC-5 | Build throws before evaluate | existing throw / non-zero; do not swallow |
| EC-6 | `--json` + fail | stdout = report JSON; process exit 1 |
| EC-7 | Evaluation object malformed at helper | exit 1 (fail closed) |
| EC-8 | Future `--min-score=N` (OUT OF SCOPE) | do not invent flag this slice |

## Non-functional constraints

| ID | Constraint |
| --- | --- |
| C-1 | Single-concept blast radius: CLI exit + tiny pure helper only |
| C-2 | No daemon, network, mint, federation, or authority widening |
| C-3 | No hard-coded secrets, tokens, or env credentials in spec or code |
| C-4 | Do not rename PAT/SAT enums; naming atlas is documentation-only elsewhere |
| C-5 | Do not edit foreign BizraInfo repos or public site metrics in this slice |
| C-6 | Each implementation / spec file < 500 lines |
| C-7 | Rollback = restore CLI main block + helper + tests |
| C-8 | `authority_delta = 0` until operator GO to implement |

## Out of scope (explicit reject)

- Regenerating METRICS_CANONICAL / public 59-vs-68 campaign (other machine/repos)
- Changing `0.0.0.0` MCP bind (other repo)
- Portal placeholder hash UI wiring
- Live HHMM / RAG / singularity materialization
- Committing SCORE-TEETH or PEAK-ZERO-SPIN (needs separate GO)

## Acceptance (binary)

1. Red test: CLI with unavailable worktree fixture exits `1` while still emitting report.
2. Green after patch: same + clean tree exits `0`.
3. Focused suite `node --test tests/release-readiness.test.js tests/delivery-check.test.js` stays green.
