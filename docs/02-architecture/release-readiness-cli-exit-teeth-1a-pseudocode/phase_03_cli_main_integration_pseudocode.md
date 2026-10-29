# Phase 3 · CLI Main Integration · Pseudocode

**Pseudocode-bundle file:** `phase_03_cli_main_integration_pseudocode.md`  
**Target:** `scripts/release-readiness.mjs` direct-run block (today ~L926–940)  
**Depends on:** Phase 2 helper; SCORE-TEETH-1A for score/evaluate parity

## Current behavior (defect)

```text
IF invoked as main THEN
  options := parseReleaseReadinessArgs(argv)
  report  := await buildReleaseReadinessReport(...)
  PRINT format|JSON(report)
  # implicit exit 0
END IF
```

## Target behavior

```text
IF invoked as main THEN
  options := parseReleaseReadinessArgs(argv)
  report  := await buildReleaseReadinessReport({
    workflowChangesAuthorized: options.workflowChangesAuthorized
  })

  evaluation := evaluateReleaseReadiness(report)
  exitCode   := exitCodeFromEvaluation(evaluation)

  IF options.json THEN
    PRINT JSON.stringify(report, null, 2)
  ELSE
    PRINT formatReleaseReadinessReport(report)
    # OPTIONAL (allowed, not required this slice):
    #   PRINT one human footer line listing evaluation.reasons when exitCode=1
    #   Must not break extractReportJson consumers (json mode stays pure JSON)
  END IF

  process.exitCode := exitCode
  # Prefer setting process.exitCode over process.exit() so stdout flush completes.
END IF
```

## Module boundaries

| Concern | Location |
| --- | --- |
| Build report | existing `buildReleaseReadinessReport` |
| Evaluate | existing `evaluateReleaseReadiness` |
| Exit map | new `exitCodeFromEvaluation` |
| Print | existing formatters |
| Process exit | CLI main only |

## Interaction with delivery-check

```text
delivery-check.mjs
  └─ already calls evaluateReleaseReadiness → own exit path
  └─ NO CHANGE this slice (FR-9)

release-readiness.mjs (CLI)
  └─ NEW: same evaluate → exitCodeFromEvaluation
```

Both surfaces must agree: blocker ⇒ non-zero. Different printers allowed.

## Failure paths

| Failure | Behavior |
| --- | --- |
| `buildReleaseReadinessReport` throws | Propagate; Node non-zero (unchanged) |
| Evaluate returns `ok:false` | Print report; `process.exitCode = 1` |
| Evaluate throws (should not) | Propagate; do not force exit 0 |

## Rollback

```bash
git checkout -- scripts/release-readiness.mjs tests/release-readiness.test.js
# if docs-only companion changed:
# git checkout -- docs/02-architecture/release-readiness-cli-exit-teeth-1a-pseudocode/
```

## Blast radius

- **In:** CLI exit semantics for direct `node scripts/release-readiness.mjs` and any npm script that invokes it without absorbing exit codes.
- **Out:** score formula, workflow parsers, delivery-check logic, public site metrics.
