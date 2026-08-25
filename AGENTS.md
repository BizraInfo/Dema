# AGENTS.md

This file is the repo-local entry point for Codex-style agents.

## Canonical LLM flow

Read and follow [docs/LLM_SYSTEM_FLOW.md](docs/LLM_SYSTEM_FLOW.md) before making changes.

## Invariants

```text
Dema is the face, not the whole system.
No runtime execution in this repo.
No hidden daemon.
Exact-string consent only.
All local state stays under DEMA_HOME or ~/.dema.
Receipts are read/list here; governed runtime issues.
Node1/Node2 remain preview-only until proof gates pass.
```
## Repo

- Single `package.json`; no workspaces/turborepo/nx.
- `apps/cli/` — entry (`bin/dema`).
- `packages/core/`, `packages/node-adapter/`, `packages/receipts/`, `packages/dema-ui/`.
- `tests/*.test.js` at root, Node built-in runner.
- `scripts/` — CI wrappers, review gates, proof producers.

## Checks

```bash
npm test
npm run check
npm run llm:guidance
git diff --check
```

`npm test` / `npm run check` wrap `scripts/ci/run-with-classifier.mjs`; preserves true exit code, failing logs under `/tmp/bizra-classifier-log-*/run.log`.

Single-file runs: `node --test tests/<surface>.test.js`.

### Known failures

None on `main` as of `b233539` (merge of `slice/node0-evidence-honest-suite-1a`): full suite green on machines with real `~/.dema/node0/` artifacts. Historical pre-merge failures (`NCG-01`/`NCG-02` ledger counts; preview-receipt-signing loader param mismatch) are resolved by that merge — if you see either on an older checkout, update to >= `b233539` instead of patching locally.

## Ladder

```bash
node --test tests/<surface>.test.js
npm test
npm run check
npm run llm:guidance
git diff --check
```

`npm run llm:guidance` enforces root agent files point back to [docs/LLM_SYSTEM_FLOW.md](docs/LLM_SYSTEM_FLOW.md).

## Completion

Finish truthfully:

```text
done and verified
done with known remaining risk
blocked by explicit halt gate
blocked by failing check
```

Do not claim completion if tests, docs links, or guidance checks fail.

<!-- BACKLOG.MD GUIDELINES START -->
<!-- backlog.md-instructions-version: 1.48.0 -->
<CRITICAL_INSTRUCTION>
## Backlog.md Workflow
This project uses Backlog.md. Run `backlog instructions overview` before any task action. Use `backlog <command> --help` for options. Do not edit Backlog files directly.
</CRITICAL_INSTRUCTION>
<!-- BACKLOG.MD GUIDELINES END -->