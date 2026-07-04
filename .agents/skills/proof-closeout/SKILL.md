---
name: proof-closeout
description: Close a Dema slice with required proof commands, boundary statement, and honest gaps. Use before ending any implementation task or PR.
---

# Proof closeout

Run at the end of every implementation slice. **Report-only** — does not mutate runtime.

## Steps

1. `git status --short` — surface unrelated dirty files; do not absorb silently.
2. Run focused tests for touched modules first.
3. Run repo gates:

```bash
npm test
npm run check
npm run llm:guidance
git diff --check
```

4. If docs claimed `MEASURED`, confirm `docs/CURRENT_LIMITS.md` matches disk.
5. Emit closeout block:

```text
What changed
What proof ran (exact commands + pass/fail)
What did not happen (keys, mint, daemon, external, federation, etc.)
What remains blocked
Next safe action (one command or slice id)
```

## Boundaries

- Do not claim green if `npm test` or `npm run check` failed — report exact `not ok` lines.
- Do not promote DESIGNED_NOT_LIVE to live in closeout prose.
- Hook audit (optional): `.Codex/hooks/logs/posttool-proof-log.jsonl`

## References

- `.Codex/bus/proof-bus.policy.json`
- `docs/DEMA_AGENT_HARNESS_AND_SKILL_DNA_v0_1.md` (harness law — target, not all live)
