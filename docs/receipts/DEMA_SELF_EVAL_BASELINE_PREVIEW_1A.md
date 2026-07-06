# Receipt: DEMA-SELF-EVAL-BASELINE-PREVIEW-1A

Truth label: `DEMA_SELF_EVAL_BASELINE_PREVIEW_MEASURED_REPO`

## Slice

Self-eval quality baseline + compare: captures measured system-quality signals (tests, coverage, registry, monitor, gates, perf) as a content-addressed baseline and compares a candidate against it per dimension to say improved / regressed / mixed / unchanged, so system change is measured not blind; signals are injected, no tests are run here.

```text
plan → build → verify → tamper-reject
```

## Proof Contract

The default gate must pass only while:

- the exact GO phrase matches byte-for-byte,
- the canonical payload is content-addressed,
- verification re-derives from the body and rejects tamper,
- a forged body with a recomputed hash is still rejected,
- the boundary stays all-false (no execution authority).

`npm run check` runs `dema-self-eval-baseline-preview-check.mjs` and keeps `DEMA_SELF_EVAL_BASELINE_PREVIEW_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/dema-self-eval-baseline-preview.test.js
node scripts/review/dema-self-eval-baseline-preview-check.mjs --json
npm run check
```
