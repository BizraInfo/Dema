---
name: self-loop-engineering
description: Run Dema's deterministic self-loop preview stack (OODA, HHMM, hash-table, diffusion, RSI preview) — PREVIEW ONLY, not live autopoietic runtime or agent RL.
---

# Self-loop engineering (preview stack)

**Truth label:** `PREVIEW_ONLY` — deterministic validators and operator checklists.
**Not:** consciousness, neural HHMM, neural diffusion, live autopoietic loop, agent RL, verified reward.

## When to use

After a slice, before closeout — rank next steps and surface blind spots without claiming live autonomy.

## Procedure

### 1. Peak self-loop preview (bundled SNR + convergence axes)

```bash
dema peak-self-loop --json
```

Kernel: `packages/core/src/peak-self-loop-preview.js`

### 2. Diffusion denoising (lexicon-based, not neural)

```bash
dema diffusion refine --drafts-file <path> --evidence <anchors> --json
dema diffusion verify <report.json> --json
```

### 3. Proof-of-truth axes (preview metadata)

Formal · Cryptographic · Empirical · Economic — scored in `llm-capacity-insight-preview.js`
when using capacity insight flows. Do not promote to live economic proof.

### 4. RSI proposal preview (holds forbidden live-loop terms)

Before proposing "improvements": read `packages/core/src/rsi-proposal-preview.js` —
rejects autopoietic/live-loop/token terms in preview proposals.

### 5. Self-awareness blind-spot ledger

Build capabilities with evidence anchors → `packages/core/src/self-awareness-report.js`
Classify: `EVIDENCED` | `BLIND_SPOT` | `NOT_KNOWN`. `claims_consciousness: false`.

### 6. OODA bounded review

`packages/core/src/self-loop-ooda.js` — ACT phase **must not execute** (`executed: false`).

### 7. Persist the loop's output so it survives the process

A self-loop that ranks a next action and then exits has produced nothing durable —
the ranking dies with the process, and the next session re-derives it from scratch
or, worse, redoes work the loop had already ruled out. Since
NODE0-MINIMUM-SEASON-SAVE-RESUME-1A the loop has somewhere to put its result:

```bash
dema season save --season <id> --mission <MISSION-ID> --phase <PHASE> \
  --next <THE_ONE_ACTION_THIS_LOOP_SELECTED> \
  --repo-commit <sha40> --repo-tree <sha40> \
  --step "<what this loop confirmed complete>" \
  --must-not-repeat "<what the blind-spot ledger ruled out>" \
  --pending-consent none
dema season status --json     # verify what was actually written
```

Mapping, so the loop's own vocabulary lands in the right field:

| Self-loop output | Season field |
| --- | --- |
| the ONE ranked next step (§1, §6 ACT) | `next_safe_action` — one bounded action, not a plan |
| `BLIND_SPOT` / ruled-out paths (§5) | `must_not_repeat` — preserved byte-exact |
| `EVIDENCED` capabilities (§5) | `completed_steps` — duplicates are refused, not deduped |
| anything awaiting the operator | `pending_consent` — resume returns it still pending |

This changes nothing about the boundary: `season save` writes only under
`DEMA_HOME`, executes no step, and grants no consent. Persisting a *proposal* is
not authority to act on it — resume hard-codes `consent_granted: false`.

Do **not** put RSI/autopoietic prose into `next_safe_action`; §4's forbidden-term
check applies to what you persist, and the field's own contract rejects anything
that is not one bounded `UPPER_SNAKE` action.

## Boundaries (state in output)

```text
No runtime execution · no model invocation · no network · no self-modification
No agent RL · no verified reward · no live PAT/SAT autonomy
```

## Closeout

Chain into `.claude/skills/proof-closeout` after self-critique, then persist the
result (§7) — an unpersisted loop leaves the next process with nothing.

## References

- `docs/CURRENT_LIMITS.md` — Framework kernels table
- `.claude/rules/00-claim-discipline.md`
- `packages/core/src/node0-minimum-season-save-resume.js` — the state contract §7 writes to
- `docs/02-architecture/NODE0_MINIMUM_SEASON_SAVE_RESUME_v0_1.md`
