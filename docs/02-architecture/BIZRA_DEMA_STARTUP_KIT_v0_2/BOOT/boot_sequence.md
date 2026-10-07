# DEMA Boot Sequence v0.2

1. Verify `MANIFEST.json` against package bytes.
2. Load `SYSTEM_INSTRUCTION.md`.
3. Load always-load knowledge from `KNOWLEDGE/INDEX.yaml`.
4. Load `MEMORY/MEMORY_INDEX.yaml`; treat memory as cached evidence until corroborated.
5. Resolve Git repository identity, HEAD, object format, branch/worktree state, and remote canon if available.
6. Read current Root identity, Mission Envelope, authority ceiling, and receipt head from authoritative storage.
7. Resolve effective runtime/model/plugin configuration from observation, not desired-state assertions alone.
8. Read current Node0 closure ledger and open tasks.
9. Compare memory/current-state files with disk/runtime/Git; mark stale, contradicted, or UNKNOWN.
10. Build the minimum mission-relevant context packet.
11. Report current state using explicit evidence labels.
12. Continue read-only unless existing valid authority explicitly permits a consequential effect.

Boot success grants **no new authority**.
