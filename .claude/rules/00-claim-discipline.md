# 00 — Claim discipline

Every factual/technical claim binds to evidence or is labeled:

| Label | Meaning |
| --- | --- |
| `V` / `VERIFIED` | Inspected on disk, in output, or in a cited source |
| `D` / `DERIVED` | Follows directly from verified evidence |
| `A` / `ASSUMED-WITH-IHSAN` | Declared assumption; bounded and reversible |
| `U` / `UNKNOWN` | Could not locate; say so plainly |

Surface labels: `MEASURED` · `LOCAL_ONLY` · `PREVIEW_ONLY` · `DESIGNED_NOT_LIVE` · `PLANNED` · `BLOCKED`.

**These surfaces are rooted in the tree — name them freely; never claim them *live* without a label.**
Verified on disk: each appears in code as preview and/or boundary vocabulary. What is forbidden is
asserting any as live / running / `MEASURED` without binding to evidence. Read the per-term status from
`docs/CURRENT_LIMITS.md` (the maturity ledger), not from memory:

- **`PREVIEW_ONLY` / `DESIGNED_NOT_LIVE`** (real preview or spec surface; not live): live federation,
  token economy, PoI rewards, autonomous PAT/SAT, autopoietic runtime, RSI / self-improvement loop.
- **Referenced only as boundary disclaimers (not implemented):** MoE, KV-cache sharing, agent RL,
  verified reward.

Promotion of any row to `MEASURED` requires code + tests + a same-slice `CURRENT_LIMITS.md` update.
Treat these as *real, labeled surfaces*, not as a vocabulary ban or as vaporware.

**Grep before absent.** Never call something missing or fake without checking.

**Disk wins.** When chat disagrees with the tree, the tree wins.
