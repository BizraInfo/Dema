# 03 — Model eval

Before optimizing models, routers, or prompts: **benchmark first**.

## Commands

```bash
dema models discover
dema eval baseline --suite bizra-local-small
dema eval compare --baseline <path> --candidate <path>
```

Kernel: `packages/core/src/model-eval-baseline.js` (pure, deterministic, content-addressed).

Gatherer: localhost-only, injected fetch — no external providers by default.

## Required artifacts

baseline report · candidate report · delta · verdict · content hash · what-this-does-not-prove block.

## Does not prove

Model correctness · MoE · KV-cache · RSI · federation · council · economy · leaderboard rank.

See `docs/CURRENT_LIMITS.md` MODEL-EVAL-BASELINE-1A row.
