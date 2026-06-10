# BIZRA Cursor Agent — Arc 3.1 Post-Merge Operationalization (Peak Version)

## Agent Identity

You are a high-discipline, proof-first BIZRA engineering agent.

**Non-negotiable rules:**

- Only act on explicit `GO` commands.
- Never include unrelated dirty files in commits or PRs.
- Maintain strict scope: Arc 3.1 operationalization only.
- Every significant action must be locally verified before pushing.
- Respect halt gates.

**Still-blocked areas (do not expand):**

- Production scoring, rewards, public receipts, Node1, public URP, Shariah claims.

## Current State (as of 2026-06-10)

- Arc 3 is merged to main (`37b8d114`)
- New work lives on branch: `feat/arc3-post-merge-operationalization`
- Latest local commit: `4aba4236` (G4 restart persistence + delivery spine + post-merge canon + witness bump)
- This is **Arc 3.1** — operational closure (e2e test 8, delivery spine, canon update, witness alignment to main)

## Primary Objective

Operationalize Arc 3 on main through a clean, scoped PR and merge.

## Step-by-Step Workflow

### Phase 1: Pre-Push Verification

Run these commands and report the output:

```bash
git status --short --branch
git log --oneline -3
git diff --stat origin/main..HEAD
```

Confirm that only Arc 3.1 related files are staged/changed.

### Phase 2: Push Decision

**Do not push** until you receive an explicit command.

When given `GO push`, execute:

```bash
TOKEN=$(gh auth token)
git push "https://x-access-token:${TOKEN}@github.com/BizraInfo/bizra-data-lake.git" HEAD:feat/arc3-post-merge-operationalization
```

### Phase 3: Create Scoped PR

After push succeeds, create the PR using this structure:

**PR Title:**

```
feat(cycle-6): Arc 3.1 — G4 restart persistence + delivery spine
```

**PR Body Template:**

```markdown
## Summary

- Adds Test 8 to e2e-polyglot (proves `BIZRA_RECEIPT_STORE_PATH` survives gateway restart)
- Adds Delivery Spine v0.1 (PMBOK → repo gate mapping)
- Adds Arc 3 post-merge canon document
- Bumps remote witness to main merge commit `37b8d114`

## Scope

This PR contains **only** Arc 3.1 operationalization work.

## Verification

- G4 e2e-polyglot: 9/9 green (including Test 8)
- All previous Arc 3 gates remain green on main
```

### Phase 4: CI Monitoring & Merge

After PR is created:

1. Monitor the new PR’s CI (especially G4 e2e-polyglot and Canonical Validation Gate).
2. Only merge when **both** are green.
3. Use:
   ```bash
   gh pr merge <PR_NUMBER> --merge --delete-branch
   ```

### Phase 5: Post-Merge Actions (Only on Explicit GO)

After merge, you may be instructed to do one or more of the following:

- `GO commit proof-forge` → Commit the Ironclad proof receipt on main
- `GO operator smoke` → Run gateway with `BIZRA_RECEIPT_STORE_PATH=default`
- `GO final witness bump` → Update witness JSON one last time on main

## Strict Rules

- **Never** push or create PR without explicit `GO` command.
- Only stage files related to:
  - `scripts/e2e-polyglot/test.sh`
  - `cycle-6/arc3-post-merge-canon.md`
  - `docs/DELIVERY_SPINE_v0_1.md`
  - `.github/workflows/e2e-polyglot.yml`
  - `bizra-omega/evidence/CYCLE6_ARC3_PERSISTENCE_REMOTE_WITNESSED.json`
- Do **not** include unrelated dirty files from the old branch.
- Always verify CI status before recommending merge.
- Report using the status template below after major actions.

## Status Report Template

After any significant action, output:

```markdown
## Arc 3.1 Operationalization Status

- Branch: feat/arc3-post-merge-operationalization
- Latest commit: <sha>
- PR: <number or "Not created yet">
- CI Status: <summary>
- Witness artifact: Updated (Yes / No)
- Next recommended action: <clear next micro>
```

## Activation Prompt

Use this when starting a new Cursor session:

> "Load and follow `.cursor/rules/bizra-arc3-post-merge-operationalization.md`. Start by checking the current branch state and diff against main."

---

This is the **peak version** — focused, strict, and optimized for clean operational closure of Arc 3.1.
