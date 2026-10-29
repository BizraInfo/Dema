# Phase 2 · Exit Policy Kernel · Pseudocode

**Pseudocode-bundle file:** `phase_02_exit_policy_pseudocode.md`  
**Target module (proposed):** keep in `scripts/release-readiness.mjs` as exported pure helper  
**I/O:** none (no fs, git, env, network)

## Intent

One pure function so CLI and tests share the same teeth mapping without
duplicating `ok` checks.

## Pseudocode

```text
MODULE ExitPolicy

  CONST EXIT_OK    := 0
  CONST EXIT_BLOCK := 1

  FUNCTION exitCodeFromEvaluation(evaluation) -> integer
    # Fail closed: anything that is not a clear pass is BLOCK.
    IF evaluation is not a plain object THEN
      RETURN EXIT_BLOCK
    END IF

    IF evaluation.ok === true THEN
      RETURN EXIT_OK
    END IF

    RETURN EXIT_BLOCK
  END FUNCTION

  FUNCTION assertExitContract(evaluation, exitCode) -> boolean
    # Test/review helper only — not required at runtime.
    expected := exitCodeFromEvaluation(evaluation)
    RETURN exitCode === expected
  END FUNCTION

END MODULE
```

## Flow

```text
evaluateReleaseReadiness(report) ──► evaluation
                                        │
                                        ▼
                         exitCodeFromEvaluation(evaluation)
                                        │
                          ┌─────────────┴─────────────┐
                          ▼                           ▼
                     exitCode = 0                exitCode = 1
                     (ok === true)         (ok !== true | malformed)
```

## Invariants

| ID | Invariant |
| --- | --- |
| INV-1 | Never return codes other than `{0,1}` in this slice |
| INV-2 | Never inspect `reasons` for exit mapping — `ok` is sufficient |
| INV-3 | Never treat missing `ok` as success |
| INV-4 | Helper must remain side-effect free |

## Truth labels

| Output | Label |
| --- | --- |
| Helper itself | `IMPLEMENTED` when shipped |
| Binding to live CI runners | `UNKNOWN` until observed outside unit tests |
| Public marketing claim “release gate always fails closed” | only after CLI + delivery-check both proven |

## Non-goals

- Soft-fail exit `2` for advisories
- Mapping severity tiers to distinct exit codes
- Writing evaluation to disk
