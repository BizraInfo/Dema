# DEMA-FDE-DUAL-DIAGNOSTIC-1A

## Purpose

`DEMA-FDE-DUAL-DIAGNOSTIC-1A` is a deterministic failure differential layer for Dema proof-control surfaces.

```text
FDE-I = inward diagnosis (code, tests, proof gates, invariants)
FDE-O = outward diagnosis (Node version, OS, paths, permissions, deployment reality)
```

FDE classifies failures. It does not patch, commit, push, merge, or execute.

## Schema Compatibility

New reports use `bizra.dema.fde_dual_diagnostic.v0.2`, which binds the 1C
authority-monotonic precedence policy. Historical v0.1 reports may be checked
only through the explicit `legacy_v0_1_integrity_only` verifier. They are not
authority-eligible and cannot open the CI vendor local-proof lane.

## Input Contract

```js
buildDemaFdeDualDiagnostic({
  failed_command,
  exit_code,
  stdout_excerpt,
  stderr_excerpt,
  changed_files,
  environment: {
    node_version,
    os,
    branch,
    ci_provider,
    runner_assigned,
    runner_id,
  },
  capability_registry_row,
})
```

## Output Contract

The envelope emits:

```text
schema
truth_label
stage
input
failure_class
symptom_summary
root_cause_hypothesis
separates_symptom_from_root_cause
inward_diagnosis
outward_diagnosis
measured_status
missing_evidence
minimal_fix_plan
regression_test_required
field_validation_required
consent_required
eligible_for_autopatch
code_implicated
operator_action_required
capability_registry_reference
lifecycle_phases
terminal_state
boundaries
what_this_proves
what_this_does_not_prove
diagnostic_hash
```

Supported `failure_class` values:

```text
implementation_defect
test_drift
doc_drift
environment_gap
dependency_gap
permission_gap
proof_gap
boundary_violation
github_actions_billing_lock
unknown
```

## Precedence and Authority Monotonicity

Classification follows this safety order:

```text
boundary_violation
-> github_actions_billing_lock (outward lens only)
-> proof_gap
-> confidence and tie rules
-> unknown
```

| Condition | Lens | Primary action posture |
| --- | --- | --- |
| Forbidden live boundary marker | Inward and outward | Stop; boundary violation dominates every environment diagnosis |
| GitHub Actions billing evidence with GitHub context | Outward only | Request billing repair; do not implicate code |
| Missing source/test/gate/receipt evidence | Inward | Repair proof; do not hide the gap |
| Code/test/schema markers | Inward | Reproduce with a focused test before proposing repair |
| Environment/permission/dependency markers | Outward | Validate the field environment before changing code |
| Insufficient evidence | Neither | Keep root cause unknown and request more evidence |

`DEMA-FDE-BOUNDARY-PRECEDENCE-1C` enforces the monotonic rule: mixed
boundary and billing evidence remains `boundary_violation`; it cannot be
downgraded to `billing_unlock`.

Boundary evidence is positive-only: explicit canonical `true` fields, positive
autopatch-authority fields, non-negated verifier `boundary_not_false` blockers,
or affirmative action phrases. Every action occurrence is inspected in bounded
clause context, so a negated first occurrence cannot consume or hide a later
positive action. Canonical all-false JSON, negated sentinels, and recognized
preposed, embedded, or postposed negations are not boundary violations.

## Review Gate Rules

1. FDE must not patch files.
2. FDE must not run network, daemon, token, wallet, or live URP.
3. FDE must classify uncertainty honestly.
4. FDE must separate symptom from root cause when classifiable.
5. FDE must separate code/proof failure from environment failure.
6. FDE must require regression tests when inward confidence is medium/high for code/test failures.
7. FDE must output `eligible_for_autopatch: false`.
8. FDE must emit `capability_registry_reference` as a capability row ID (default: `DEMA_FDE_DUAL_DIAGNOSTIC_1A`).
9. Boundary violations must dominate simultaneous environment failures, and GitHub billing lock must remain an outward-only diagnosis.

## Boundary

All boundary keys remain false, including:

```text
patch_applied
file_write_performed
network_used
daemon_started
autopatch_performed
commit_performed
push_performed
merge_performed
live_execution_performed
token_minted
wallet_accessed
live_urp_started
model_invocation_performed
```

### Boundary-violation classification floor

`boundary_violation` classification is a marker-based diagnostic floor, not a complete semantic safety guarantee. It catches listed forbidden patterns and obvious boundary language. Hard safety remains enforced by FATE, capability truth registry boundaries, review gates, and explicit consent rules. New boundary phrases must be added through tests before being treated as measured coverage.

### Proof-gap classification floor

`proof_gap` classification consumes evidence emitted by registry and review gates (for example `missing_source_file` blockers in gate JSON). FDE does not read the filesystem directly; missing-file conditions enter as excerpts from upstream proof checks, preserving kernel purity.

## Proof Commands

```bash
node --test tests/dema-fde-dual-diagnostic.test.js
node scripts/review/dema-fde-dual-diagnostic-check.mjs --json
npm test
npm run check
```

## What This Proves

Dema can emit a deterministic inward/outward diagnosis for a failed command with explicit confidence, missing evidence, and a minimal fix plan preview. Boundary stops dominate lower-authority environment repair paths.

## What This Does Not Prove

FDE does not establish ground-truth root cause, verify input provenance, auto-remediate failures, or replace operator consent for any mutation or runtime action.
