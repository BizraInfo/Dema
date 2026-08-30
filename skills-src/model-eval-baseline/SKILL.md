---
name: model-eval-baseline
description: Run Dema local model eval baseline (discover, baseline, compare) with boundaries and no external calls by default.
---

# Model eval baseline

**PREVIEW / LOCAL_ONLY** — deterministic scoring over frozen suite; does not prove model correctness.

## Preconditions

- Localhost model endpoint reachable (default Ollama `http://localhost:11434`) OR injected fetch in tests.
- No external provider unless operator passes `--include-external` (discouraged without GO).

## Procedure

```bash
dema models discover
dema eval baseline --suite bizra-local-small
# after a candidate change:
dema eval compare --baseline <baseline.json> --candidate <candidate.json>
```

JSON:

```bash
dema models discover --json
dema eval baseline --suite bizra-local-small --json
dema eval compare --baseline <path> --candidate <path> --json
```

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
