# Dema Baselines

Frozen snapshots of measurable-now engineering metrics. Each baseline binds to a specific commit SHA so future runs are comparable.

## Layers

Per [key-maker-epistemic-conduct-v0.1.md §6](../02-architecture/key-maker-epistemic-conduct-v0.1.md), Dema performance has four layers — only **L1** is captured here:

| Layer | What it measures | Measurable at Ring-0? |
|---|---|---|
| **L1 — engineering** | LOC · test count · pass rate · schema count · CLI count · gate state | YES — this folder |
| L2 — reasoning-shape | fixture + scorer against the 5 invariants | Requires fixture-set + scorer (deferred) |
| L3 — reviewer experience | time-to-falsification · form scores | Requires Ring-1 reviewer feedback |
| L4 — operator-life impact | did Dema actually help over time | NOT measurable empirically at Ring-0 |

L2/L3/L4 are intentionally out-of-scope for L1 baselines. Mixing layers would violate the certainty-mapping invariant.

## Usage

```bash
# Default · prints L1 snapshot to stdout · does not save
npm run baseline:l1

# Save snapshot to docs/baselines/dema-baseline-l1-<short_sha>.json
npm run baseline:l1 -- --save

# Include test suite run · adds pass/fail counts
npm run baseline:l1 -- --include-tests --save
```

## Output schema

```
bizra.dema.baseline_l1.v0.1
  truth_label:  NODE0_LOCAL_SEED
  mode:         snapshot
  boundary:     canonical 16-key (all false)
```

## File naming convention

```
dema-baseline-l1-<short_sha>.json     · single-commit baseline
dema-baseline-l1-<date>-tagged.json   · optional human-tagged snapshot
```

Append-only. Old baselines are never modified — they are the historical record. Comparison happens at read-time, not write-time.

## What baselines are NOT

- They are NOT release artifacts (no chain advance, no receipt mint).
- They are NOT receipts (no `prev` linkage, no chain semantics).
- They are NOT proofs of correctness (LOC count says nothing about quality).
- They are NOT promises (a high test count is necessary, not sufficient).

A baseline is one row in a continuous ledger. Trend matters more than any single row.

## Reading a baseline

```jsonc
{
  "schema": "bizra.dema.baseline_l1.v0.1",
  "git": {
    "commit_sha": "...",       // deterministic per source state
    "branch": "...",
    "working_tree_clean": true // false if uncommitted changes present
  },
  "source_state": {
    "packages_loc": 12860,            // wc -l equivalent
    "tests_files": 61,                // count of *.test.js files
    "schemas_declared_unique": 68,    // unique bizra.dema.* strings
    "cli_commands_in_help": 34        // commands listed in HELP text
  },
  "test_state": {
    "pass": 677, "fail": 0, "total": 677,
    "completed": true                  // false if --include-tests was omitted
  },
  "boundary": { /* canonical 16-key all-false */ }
}
```

## When to capture a baseline

- Before a meaningful change (the BEFORE row)
- After a meaningful change (the AFTER row)
- At sprint boundaries (the WAYPOINT row)
- After Ring-1 reviewer feedback (the FALSIFICATION-INFORMED row)

## How to compare two baselines

Use `baseline-l1-diff` (implemented 2026-05-18):

```bash
# By short SHA (auto-resolves to docs/baselines/dema-baseline-l1-<sha>.json)
npm run baseline:l1:diff -- d60767a e436b7c

# By explicit file paths
npm run baseline:l1:diff -- --files docs/baselines/old.json docs/baselines/new.json
```

Output is a schema-tagged `bizra.dema.baseline_l1_diff.v0.1` JSON with:

- per-metric numerical deltas (`{before, after, delta}` triples)
- pair metadata (sha · branch · measured_at)
- growth percentages with 0.1 precision
- a `verify_before_assert_trend` classification naming the tests-vs-packages growth asymmetry honestly

The trend is observational, not prescriptive. The operator decides what the trend means.

---

**See also:** [key-maker-epistemic-conduct-v0.1.md](../02-architecture/key-maker-epistemic-conduct-v0.1.md) · [TESTING.md](../TESTING.md) · [ENGINEERING_DISCIPLINE.md](../ENGINEERING_DISCIPLINE.md)
