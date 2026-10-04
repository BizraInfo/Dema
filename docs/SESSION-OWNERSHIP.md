# Multi-Session Ownership Protocol
### Preventing agent collisions on Node0 — written 2026-07-31

Three agent sessions worked this node simultaneously today (Claude Code,
Cursor Agent, Cowork). No corruption occurred, but the risk was live:
`l1-micro-loop.js` was edited by one session while another was reading it.
This file is the conflict rule. It is doctrine, not preference.

## 1. Homes — one tool, one tree

| Work | Edit only here | Never |
|---|---|---|
| Dema kernels, CLI, loop, ADRs | `~/Downloads/Dema` | estate/knowledge code |
| File factory · GenomeFS · ask index | `/data/bizra/repos/bizra-filefactory` | rebuild the tree under Downloads |
| Downloads/bizra-filefactory | leave as the 2-file shim | treat as the real project |
| `Dema/pke/` | Dema-local, optional | merge into filefactory before a GO |
| Estate buckets (`bizra-docs`, `documents`, …) | content only | promote code into them |

## 2. Capability asymmetry — know what your session can do

Sessions differ in mount rights, and this decides who runs what:

| Capability | Who has it today |
|---|---|
| Write to Downloads **root** (estate applies) | Cowork session only — others get EROFS |
| `git` commit | Host sessions only — Cowork mounts forbid delete, which breaks git's lock lifecycle |
| Delete files | **No session.** Moves and quarantine only (doctrine F-1) |
| Long/background processes | Host sessions — Cowork calls cap at 45s with no process carryover |

`D` — Route the task to the session that *can* do it, instead of the session
that noticed it. A capability claim must be probed, never assumed.

## 3. Rules

1. **One writer per file.** Before editing a shared kernel, check `mtime`.
   If another session touched it inside the last ~30 minutes, do not edit —
   report instead.
2. **Reviewers do not patch.** A session that finds a defect in another
   session's work writes findings + remediation spec. The authoring session
   (or whoever holds the operator's GO) applies them. This is the same
   proposer ≠ certifier law the loop runs on.
3. **The operator's GO names a session.** If a GO was given to session A,
   session B does not execute it, even if B is faster or better-mounted.
   B may offer the capability instead.
4. **Docs are owned by their author.** Fixing your own ADR is always safe;
   editing someone else's needs their GO.
5. **Receipts over reports.** Cross-session claims are unverified until the
   receiving session re-runs them. Every session that verifies another's
   work seals its own receipt.
6. **One authoritative receipt store per repo.** Dema evidence →
   `Dema/docs/receipts/`. Estate evidence → `bizra-filefactory/receipts/`.
   A receipt describing work in another repo must say so in its schema
   namespace, or it is a cross-repo binding defect.

## 4. What today proved

- Independent review caught four blast-radius defects one session could not
  see in its own kernel (E1 dst overwrite · E2 audit-chain erasure ·
  E3 lease-free resume · E4 symlink escape). **Adversarial review across
  sessions is the highest-value collaboration mode, not duplicated building.**
- Two sessions independently drafted the same admission kernel. The file
  guard prevented collision by luck, not by protocol. Hence this document.
- A doctrine contradiction (ADR-004 §Sync vs ADR-051) survived authoring and
  was found only by a third session reading both.

`Disk wins.` A session's memory of what it did is not evidence; the file is.
