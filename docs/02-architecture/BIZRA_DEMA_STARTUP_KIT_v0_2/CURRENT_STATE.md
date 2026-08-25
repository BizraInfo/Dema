# Node0 Current State — 2026-08-25

## Epistemic boundary

This file intentionally separates remote GitHub canon, local-agent claims, measured host observations, and design recommendations.

## Remote canon — VERIFIED_REMOTE

- Repository: `BizraInfo/Dema`
- Remote `main`: `b233539993ac394b66f28b9e392d187b1c3ec901`
- Remote main tree: `a19ab43f958a99c8a78bfb40da59e1fe020ff6d7`
- The remote startup package v0.1 remains `PROPOSED_DESIGN_SPECIFICATION`, authority delta 0.

## Local canonicalization candidate — SOURCE_BOUND / READY_FOR_COMMIT_GO

Local-agent closeout reports:

- base commit: `b233539993ac394b66f28b9e392d187b1c3ec901`
- candidate identifier: `8479c822a3a7f54ece75fa5903397fb167501023`
- drift: PASS after full gates
- scope: 44 expected paths; no unexpected paths
- focused suites: PASS
- aggregate gates: PASS in a fresh clone of the exact candidate bytes
- TASK-080.01 red scaffold explicitly excluded without weakening `npm test`
- status: NOT_CANONICAL until an exact local commit is made and verified

### Candidate identity warning

The local closeout labeled `8479...` as `sha256`, but it contains **40 hex characters**. A SHA-256 digest must contain 64 hex characters. Because the closeout also proposes comparing it with `HEAD^{tree}`, this value is more likely a Git tree object ID in a SHA-1 repository.

Before commit, run:

```bash
git rev-parse --show-object-format
```

Then record the value under the correct field:

- `git_tree_oid` for the Git tree object ID;
- a separate 64-hex `candidate_tree_sha256` only if a canonical tree serialization is independently SHA-256 hashed.

Do **not** call a 40-hex Git object ID `sha256`.

## Local Node0 closure observation — MEASURED_LOCAL / NOT_CANONICAL

Current local-agent evidence reports:

- `9 SATISFIED`
- `0 VIOLATED`
- `1 UNKNOWN`
- `remote_write = UNKNOWN`
- reason: reachability exists but write-authority correlation is not established
- `NODE0_CLOSED = false`

The remote-write correction preserves the law:

`ExternalReachability != ExternalWriteAuthority`

Listener exposure without a correlated write route settles nothing; UNKNOWN keeps Node0 OPEN.

## Production ladder

| Slice | Backlog state | Evidence state | Remaining closure work |
|---|---|---|---|
| PROD-00 / TASK-075.01 | Done | controlled baseline proven | preserve as baseline |
| PROD-01 / TASK-075.02 | In Progress | first heartbeat, real PID/port/kill-restart evidence exists | reconcile all task ACs, runtime identity/persistence non-vacuity, close task honestly |
| PROD-02 / TASK-075.03 | To Do | G2 DEMA truth-binding proof exists | finish typed execution transport and reconcile task ACs |
| PROD-03 / TASK-075.04 | To Do | local model path live by direct probe | broker-mediated invocation, provider loss/recovery, full task AC closure |
| PROD-04 / TASK-075.05 | Done | live model conduction proven | freeze; do not widen authority |
| PROD-05 / TASK-075.06 | Done | real PAT proposal + deterministic independent SAT; LLM judge negative control | freeze; do not multiply PAT/SAT until needed |
| PROD-06 / TASK-075.07 | To Do | local staged-effect primitives/candidate exist | full FATE + exact consent + nonce + real reversible effect + independent postcondition + SAT + trusted receipt + exactly-once crash recovery |
| PROD-07 / TASK-075.08 | To Do | not yet run | adversarial campaign + local URP observation + 72h soak + production seal |

## Data estate

Historical measured baseline (2026-07-13) for `/data/bizra`: ~1.57M files and ~783 GB of file bytes, with a large cloud archive share. Treat these numbers as a prior measured census, not as a current count. A fresh inventory is required before any organization claim.

Current file-steward capability already includes metadata-only organization preview and sandbox-scoped reversible rename/undo primitives. Full-estate destructive cleanup is neither needed nor authorized.

## Current highest-priority sequence

1. Canonicalize the already-qualified G6 candidate on exact bytes.
2. Verify the local commit tree exactly; stop before push.
3. Start a new slice for Startup Kit v0.2 + memory + data stewardship skill.
4. Finish PROD-01/02/03 acceptance reconciliation.
5. Execute PROD-06 as the minimum real effect closed loop.
6. Resolve `remote_write` through correlation evidence or host remediation, then reobserve.
7. Run PROD-07 adversarial + 72h campaign.
8. Seal `NODE0_DEMA_PRODUCTION_ACTIVE` only if every closure condition is empirically true.
