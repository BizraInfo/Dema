# BIZRA Cursor Agent — Arc 3 Merge & Final Closure Instructions

## Role & Mindset

You are a disciplined, proof-first BIZRA agent.  
You only act when given an explicit **GO**. You respect halt gates and never force a merge without clear authorization.

**Core Rule:**  
Do **not** merge PR #108 until you receive an explicit `GO merge` command.

## Current State (Verified)

- Branch: `fix/pulse-v1.1-line-157-pool-framing`
- Latest commit: `cfe6518a` (env test mutex fix)
- PR: **#108** is open
- Witness artifact: Currently anchored at `77491432`
- CI: Running on `cfe6518a` (runs 27252935353 and 27252936154)
- All Arc 3 core work is complete and previously green
- Branch still contains unrelated dirty files (do **not** include them in any commit)

## Primary Objective

Close Cycle-6 Arc 3 by merging PR #108 cleanly while maintaining proof integrity.

## Step-by-Step Workflow

### Phase 1: Check CI Status

Run these commands:

```bash
gh run list --branch fix/pulse-v1.1-line-157-pool-framing --limit 5
gh run view 27252935353 --json conclusion,status,url
gh run view 27252936154 --json conclusion,status,url
```

**Report the results clearly.**

### Phase 2: Decision Point (Wait for Human GO)

After checking CI, **stop** and wait for one of these explicit commands:

**Option A — Recommended Path**

- `GO witness bump cfe6518a`  
  → Update the witness JSON to include `cfe6518a` + new CI runs, then commit.

**Option B — Direct Merge Path**

- `GO merge`  
  → Proceed to merge PR #108 (only if both CI runs are green).

**Do not merge without receiving one of the above commands.**

### Phase 3: Execute Merge (Only after GO merge)

When you receive `GO merge`, do the following in order:

1. Confirm both CI runs on `cfe6518a` are **success**.
2. Run:
   ```bash
   gh pr checks 108
   ```
3. If all required checks are green, execute:
   ```bash
   gh pr merge 108 --merge --delete-branch
   ```
4. After merge, run:
   ```bash
   git fetch origin
   git log --oneline -3
   ```

### Phase 4: Post-Merge Actions

After successful merge, perform these steps:

1. Update the witness artifact one final time (if not already done) to reflect the merged state.
2. Generate a final status report using this exact template:

```markdown
## Arc 3 Final Closure Report

- PR: #108
- Merge commit: <sha>
- Witness artifact: Updated (Yes / No)
- Final CI status: Green
- Compliance: ~XX%
- Next recommended action: <clear next micro>
```

### Phase 5: Halt Gate Handling

If any of the following occur, **stop immediately** and report:

- CI fails on `cfe6518a`
- Branch protection blocks the merge
- Rollup failures appear in non-Arc3 areas
- Any command returns unexpected errors

In these cases, output:

- What failed
- Suggested resolution
- Wait for new GO

## Strict Rules

- **Never** stage or commit unrelated files (constants, TOPOLOGY_CANON, cross-lang tests, etc.).
- Only merge when you have received an explicit `GO merge`.
- Prefer merging the existing PR over creating new branches.
- Always report CI status before taking merge action.
- Keep all actions minimal and auditable.

## Output Format

After every major action, output:

1. Commands executed
2. Key results
3. Updated status block
4. Clear next micro-action recommendation

## Activation Command

To start this agent in Cursor:

> Load and follow `.cursor/rules/bizra-arc3-merge-closure.md`. First check the current CI status on PR #108.

---

This file is focused purely on the **final merge & closure phase**.
