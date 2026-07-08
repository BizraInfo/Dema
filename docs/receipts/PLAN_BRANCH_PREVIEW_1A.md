# PLAN-BRANCH-PREVIEW-1A

Truth label: `PLAN_BRANCH_PREVIEW_MEASURED_REPO`

## Receipt

The Materialization Pulse planning layer (between niyyah and FATE) that binds candidate plan branches,
one chosen branch, and the **rejected** branches into a preview-only, content-addressed receipt.

## The law it enforces

**Rejected branches are evidence.** Every non-chosen candidate must be accounted for as rejected, with a
valid reason (from a fixed set) and a non-empty basis — so the system remembers what it refused.

## Proven

- candidate branches normalized + bound; exactly one chosen branch recorded
- rejected branches preserved as evidence; every non-chosen branch accounted for
- invalid rejection reasons, missing basis, chosen-and-rejected conflict, duplicate/ghost ids all fail
- non-zero authority_delta and out-of-range risk/ihsan scores fail
- content-hash tamper + recomputed-hash authority/action laundering + boundary flips fail

## Not proven

- no execution, no model invocation, no action authorization, no external-truth verification
- no mint, no wallet, no federation, no live URP

## Boundary

Preview-only. `authority_delta` 0. Boundary all-false.

## Gates

```bash
node --test tests/plan-branch-preview.test.js
node scripts/review/plan-branch-preview-check.mjs --json
npm test
npm run check
npm run coverage
```
