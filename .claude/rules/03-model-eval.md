# 03 — Model eval

Before optimizing models, routers, or prompts: **benchmark first**.

## Commands

```bash
dema models discover
dema eval baseline --suite bizra-local-small --model ollama:<model-id> --json
# Inspect the exact consent plan; this preflight exits 2 and performs no inference.
# Re-run with the same --model and one --consent "<exact printed phrase>" per plan item.
dema eval compare --baseline <path> --candidate <path>
```

Kernel: `packages/core/src/model-eval-baseline.js` (pure, deterministic, content-addressed).

Gatherer: loopback-only generation, injected fetch for tests. Discovery/consent planning performs
no inference. The baseline requires exact consent for each warm-up and suite request before any
generation POST; for `bizra-local-small`, that is seven phrases per selected model. Missing,
extra, or mismatched phrases refuse before generation. `--include-external` does not bypass the
loopback-only generation guard.

## Required artifacts

baseline report · candidate report · delta · verdict · content hash · what-this-does-not-prove block.

## Does not prove

Model correctness · MoE · KV-cache · RSI · federation · council · economy · leaderboard rank.

See `docs/CURRENT_LIMITS.md` MODEL-EVAL-BASELINE-1A row.
