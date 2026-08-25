# Local Agent Runbook — Exact Next Operations

## Operating mode

`EVIDENCE_FIRST / FAIL_CLOSED / AUTHORITY_DELTA_0`

The agent may inspect, verify, test, generate documentation, and build read-only plans. Consequential mutation requires the exact authority already granted for that transition. Never reinterpret a prior broad GO as a future push/merge/delete/Drive-write permission.

## Run 0 — Re-entry

1. Print local time, hostname, repo path, Git HEAD, Git object format, branch, and concise status.
2. Read `CURRENT_STATE.md`, current Mission, receipt head, and task records.
3. Compare memory slots to disk/Git/runtime. Mark stale memory rather than updating reality to fit memory.
4. Report `REMOTE_CANON`, `LOCAL_COMMIT`, `WORKTREE`, `RUNTIME`, `CLOSURE_LEDGER`, and `OPEN_GATES` separately.

## Run 1 — Exact candidate commit

Hard stop if candidate drift is nonzero.

```bash
BASE=b233539993ac394b66f28b9e392d187b1c3ec901
EXPECTED_TREE=8479c822a3a7f54ece75fa5903397fb167501023

git rev-parse HEAD
git rev-parse --show-object-format
git status --porcelain=v2
```

- If HEAD != BASE: STOP unless the promotion verifier explicitly supports the new base and requalifies the candidate.
- If object format is `sha1`, EXPECTED_TREE may be a Git tree OID; rename the receipt field accordingly.
- If object format is `sha256`, a 40-hex EXPECTED_TREE is invalid; STOP and re-derive.

Run the promotion verifier v0.2. Confirm 44 expected paths and declared TASK-080 exclusions. Stage exact paths only. Then:

```bash
git diff --cached --name-status
git write-tree
```

The staged tree must equal the qualified tree. Only then commit locally. After commit:

```bash
git rev-parse HEAD^
git rev-parse HEAD
git rev-parse HEAD^{tree}
git status --porcelain=v2
```

Emit `G6-CANONICAL-COMMIT-RECEIPT.json`. Do not push.

## Run 2 — Fresh reproduction

Materialize the exact local commit into a clean worktree and run the full gate ladder. Record logs and exit codes. No green summary without raw log anchors.

## Run 3 — Startup v0.2 slice

Create a new branch from the reproduced commit. Add this package and the DEMA Data Steward skill. Verify manifests. This slice must not modify Node0 runtime behavior.

## Run 4 — Memory initialization

Populate `MEMORY/` files only from current evidence. Every load-bearing statement needs:

- `truth_status`;
- `source_refs`;
- `verified_at`;
- `verification_path`;
- contradictions/open questions.

Do not use memory files to settle closure gates.

## Run 5 — Data pilot

Choose a bounded pilot root under the operator-declared estate. Record exact path and exclusions.

Default command from installed skill:

```bash
python3 scripts/inventory_fs.py <pilot-root> --outdir <evidence-dir>
```

Metadata only. Review census first. Build File Cards and dedupe candidates. Do not hash contents until content-read scope is explicitly granted.

## Run 6 — Google Knowledge pilot

Select one bounded domain, not the full Drive. Discover source objects and record file IDs + version metadata. Materialize only selected sources when needed. Hash local copies. Create Decision Graph candidates and Golden Set candidates. Preserve duplicates and contradictions until byte/provenance evidence resolves them.

## Run 7 — Production closure

Resume TASK-075 dependency order. Do not let data-estate work become a reason to defer PROD-06.

## Every closeout

Return:

- exact code/data identity;
- actions performed;
- actions refused/not authorized;
- tests/gates and raw anchors;
- current closure counts;
- open UNKNOWN/CONTRADICTION;
- next minimum provable spearpoint;
- authority_delta.
