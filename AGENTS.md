# AGENTS.md

This file is the repo-local entry point for Codex-style agents.

## Canonical LLM flow

Read and follow [docs/LLM_SYSTEM_FLOW.md](docs/LLM_SYSTEM_FLOW.md) before making changes.

That file is the single source for:

- Dema's safe local lifecycle,
- BIZRA/Node0 boundaries,
- non-runtime invariants,
- proof-safe language,
- verification commands,
- historical/noise classification.

## Codex-specific note

User-scope `~/AGENTS.md` still applies. This repo file only adds Dema-specific routing.

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

<!-- BACKLOG.MD GUIDELINES START -->
<!-- backlog.md-instructions-version: 1.48.0 -->
<CRITICAL_INSTRUCTION>

## Backlog.md Workflow

This project uses Backlog.md for task and project management.

**For every user request in this project, run `backlog instructions overview` before answering or taking action.**

Use the overview to decide whether to search, read, create, or update Backlog tasks.

Before task lifecycle actions, read the matching detailed guide:
- `backlog instructions task-creation` before creating or splitting tasks
- `backlog instructions task-execution` before planning, changing status or assignee, adding a plan or implementation notes, or implementing task work
- `backlog instructions task-finalization` before checking acceptance criteria, writing final summaries, or moving tasks to terminal statuses

Use `backlog <command> --help` before running unfamiliar commands. Help shows options, fields, and examples.

Do not edit Backlog task, draft, document, decision, or milestone markdown files directly. Use the `backlog` CLI so metadata, relationships, and history stay consistent.

</CRITICAL_INSTRUCTION>
<!-- BACKLOG.MD GUIDELINES END -->
