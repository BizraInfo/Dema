# CLAUDE.md

This file is the repo-local entry point for Claude Code.

## Canonical LLM flow

Read and follow [docs/LLM_SYSTEM_FLOW.md](docs/LLM_SYSTEM_FLOW.md) before making changes.

That file is the single source for:

- Dema's safe local lifecycle,
- BIZRA/Node0 boundaries,
- non-runtime invariants,
- proof-safe language,
- verification commands,
- historical/noise classification.

## Claude-specific note

User-scope `~/CLAUDE.md` still applies. This repo file only adds Dema-specific routing.

If user-scope guidance and repo guidance overlap, use the repo-local rule for Dema behavior and the user-scope rule for execution discipline.

## Fast invariant compression

```text
Dema is the face, not the whole system.
No runtime execution in this repo.
No hidden daemon.
Exact-string consent only.
All local state stays under DEMA_HOME or ~/.dema.
Receipts are read/list here; governed runtime issues.
Node1/Node2 remain preview-only until proof gates pass.
```

## Required local checks

```bash
npm test
npm run check
npm run llm:guidance
git diff --check
```
