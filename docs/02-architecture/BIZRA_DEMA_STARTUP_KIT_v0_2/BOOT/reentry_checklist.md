# Session Re-entry Checklist

Use at every local-agent restart.

- [ ] Read `CURRENT_STATE.md` but re-derive current Git/runtime/disk facts.
- [ ] Inspect current Mission and last authoritative receipt.
- [ ] Inspect local worktree drift before editing.
- [ ] Identify any `READY_FOR_*_GO` object and its exact identity.
- [ ] Verify whether that GO has already been consumed.
- [ ] Read open DEMA/Node0 tasks and dependency order.
- [ ] Identify stale memory records and update only after evidence.
- [ ] Preserve unresolved contradictions.
- [ ] Choose one minimum provable spearpoint.
- [ ] State stop conditions before execution.
- [ ] Close with a receipt and exact next authority transition.
