# 06 — Tests and gates

## Before claiming a slice complete

```bash
npm test
npm run check
npm run llm:guidance
git diff --check
```

Run focused tests first when they exist. Report exact failing gate — never "almost green."

## Implementation shape

```text
pure kernel → read-only gatherer → CLI wrapper → tests (red first)
```

Kernel purity gate: `scripts/review/kernel-purity-check.mjs`

No-overclaim gate: `scripts/review/no-overclaim.mjs`

## One slice discipline

`git status --short` before editing. One branch = one proof story. Surface unrelated dirty files.
