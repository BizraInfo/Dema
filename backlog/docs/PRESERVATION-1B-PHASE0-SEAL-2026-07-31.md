# NODE0-PRESERVATION-1B — Phase 0 seal (2026-07-31)

**Purpose:** Keep CP5, R2, and the two-nonce defect in backlog files — not only in agent transcripts or preservation reports.

| Finding | Canonical backlog home | Status on disk 2026-07-31 |
| --- | --- | --- |
| CP5 crash-law (retired_generation stranded) | `backlog/tasks/task-029` + `docs/gtm/TASK029_PRE_CEREMONY_HALT.md` | Sealed into task-029 notes + AC #5 |
| R2 `expected_old_fingerprint` never validated | `backlog/tasks/task-029` | Sealed into task-029 notes + AC #6 |
| Two-nonce lost-update / shared-JSON RMW | `backlog/tasks/task-017` | Present in task-017 notes (Done) |

**Re-seal reason:** The 2026-07-29 preservation report claimed CP5/R2 were present in `task-029`, but the task file on disk only contained the key-leak ceremony description. This file + task-029 edit close that gap.

**Do not:** generate keys, open `~/.dema/keys/*` contents, rotate, or run ceremony from an agent session.
