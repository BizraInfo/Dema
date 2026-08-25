# RCA-02 Flake Classification — node0-recovery-proof JSON read race

**Issued:** 2026-08-25 · operator session (opencode)
**Classification:** `INWARD — INTERMITTENT, NOT REPRODUCED AT CURRENT BYTES`
**Task closed by this receipt:** TASK-075.20 (P1 secret-safe estate-map payload and session capture exclusion)
**Truth label:** `OBSERVED_LOCAL`
**Authority delta:** 0 (no code change, no runtime consent, no push)

## What RCA-02 is

During `npm run check`, the coverage aggregate (`scripts/check.mjs:176`
→ `npm run coverage`) intermittently reported a JSON read race against
`scripts/proof/node0-recovery-proof.mjs` artifacts. Recorded as a review
follow-up while landing TASK-075.20; it was the ONLY reason that task stayed
In Progress after all four acceptance criteria were implemented and landed.

## Where the underlying work actually stands

| Item | State | Evidence |
|---|---|---|
| estate-map secret-exclusion kernel | LANDED on main | commit `9975f06`; working-tree diff vs HEAD: empty (`git diff --stat HEAD -- packages/core/src/node0-estate-map.js tests/node0-estate-map.test.js` → no output) |
| rejected-secret regression test | LANDED | same commit; focused suite green per task notes |
| session-capture ignore | LANDED | `.gitignore` lines 65–66 (`/codex-session-*.md`) |
| reviewed capture removed | DONE | task note: moved to system trash |

## Measurement (2026-08-25, this machine, current bytes `b2335399` + session worktree)

| Probe | N | Result |
|---|---|---|
| `node scripts/proof/node0-recovery-proof.mjs --json` (plain) | 5 | exit 0 ×5, `RECOVERY_AFTER_EXIT_PROVEN` ×5 |
| Full `npm run check` (contains the coverage aggregate) | 3 | exit 0 ×3 — zero RCA-02 occurrences |
| Total observations of the exact flake surface today | 8 | 0 reproductions |

Method note: single-file coverage runs are NOT a valid probe (per-file branch
thresholds cannot hold on a subset); the valid probe is the full aggregate,
which is what was run.

## Classification and rule

```text
CLASSIFICATION: INWARD-classified intermittent harness race under
                coverage instrumentation.
NOT CLAIMED:    "fixed". No repair was attempted or needed for closure.
CLAIMED:        not reproduced in 8 bounded observations at current bytes;
                residual risk remains possible under load.
RULE:           if RCA-02 recurs, treat it as a REAL signal first
                (capture both writer paths before touching anything),
                then repair inward with an atomic-read/retry bound INSIDE
                the proof script's own artifact handling — never by
                weakening the classifier or the gate.
```

## Why the task closes now

All four acceptance criteria of TASK-075.20 are implemented, landed, and
independently verifiable at `9975f06`. Its In-Progress status existed solely
for a scoped decision on this flake; this receipt supplies that decision with
measurements attached. Keeping a P1 open on an unreproduced intermittent is
decision latency, not safety.

## Residual risk (honest)

The race may still fire under heavy parallel load. It remains fail-closed: a
firing makes `check` RED (visible), never silently GREEN. Any recurrence
supersedes this classification.
