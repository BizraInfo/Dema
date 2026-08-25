# Decision Graph Memory

truth_status: SCHEMA_AND_SEED

Each decision node should contain:

```yaml
decision_id:
date_or_version:
mission_id:
problem:
alternatives: []
chosen_path:
rationale:
evidence_refs: []
implementation_refs: []
outcome_refs: []
contradicts: []
supersedes: []
superseded_by: []
current_status: UNKNOWN
last_verified_at:
```

## Seed decisions

- Use deterministic SAT acceptance law rather than an LLM judge when the contract is machine-checkable.
- Treat reachability-only listener evidence as UNKNOWN for `remote_write` until write-authority correlation exists.
- Verify aggregate gates on exact candidate bytes, not on a dirty source worktree.
- Keep capability providers replaceable while anchoring constitutional authority.
