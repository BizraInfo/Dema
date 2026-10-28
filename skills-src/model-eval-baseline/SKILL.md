---
name: model-eval-baseline
description: Run Dema local model eval baseline (discover, baseline, compare) with boundaries and no external calls by default.
---

# Model eval baseline

**PREVIEW / LOCAL_ONLY** — deterministic scoring over frozen suite; does not prove model correctness.

## Preconditions

- Localhost model endpoint reachable (default Ollama `http://localhost:11434`) OR injected fetch in tests.
- Discovery and consent planning do not run inference.
- Every warm-up and suite request requires its own exact consent phrase before any inference starts.

## Procedure

```bash
dema models discover
# Select a discovered model to print the exact per-request consent plan (no inference):
dema eval baseline --suite bizra-local-small --model ollama:<model-id> --json
# Re-run with the same --model and one --consent "<exact printed phrase>" per plan item.
# after a candidate change:
dema eval compare --baseline <baseline.json> --candidate <candidate.json>
```

JSON:

```bash
dema models discover --json
dema eval baseline --suite bizra-local-small --model ollama:<model-id> --json
dema eval compare --baseline <path> --candidate <path> --json
```

The model-selection/consent-plan invocation exits with status 2 and performs no inference. The
`bizra-local-small` plan contains seven exact phrases per selected model (one warm-up plus six
suite tasks). Copy every phrase exactly into a repeated `--consent` flag to authorize the run;
missing, extra, or mismatched phrases refuse before any generation request. Keep providers on
loopback; `--include-external` does not relax the gatherer's loopback-only generation guard.

## Kernel (read before changing behavior)

- `packages/core/src/model-eval-baseline.js`
- `apps/cli/src/commands/eval-baseline-gatherer.js`
- Tests: `tests/model-eval-baseline.test.js`, `tests/model-eval-baseline-cli.test.js`

## Boundaries (state in every report)

Does **not** prove: MoE, KV-cache, RSI, federation, council, economy, leaderboard rank.

## Required output fields

`content_hash` · `verdict` · `what_this_does_not_prove` (from kernel report)

## Rule reference

`.claude/rules/03-model-eval.md`
