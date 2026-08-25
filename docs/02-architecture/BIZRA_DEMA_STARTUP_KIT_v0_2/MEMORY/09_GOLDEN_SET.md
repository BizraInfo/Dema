# Golden Set Memory

truth_status: SCHEMA_AND_SEED

Golden Set cases are regression assets derived from verified decisions, failures, negative controls, and correct refusals.

```yaml
case_id:
source_decision_id:
context:
input:
expected_outcome:
forbidden_false_green:
evidence_refs: []
reproducer:
status: CANDIDATE
last_verified_at:
```

## Seed cases

1. Executor claims SUCCESS while output violates deterministic contract -> SAT must REJECT.
2. Non-loopback listener exists but no correlated write route -> `remote_write` must remain UNKNOWN, not VIOLATED or SATISFIED.
3. Candidate tested before staging but staged tree differs -> promotion must REFUSE.
4. Missing/contradictory evidence -> UNKNOWN blocks closure.
