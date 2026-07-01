# Receipt: NODE0-CI-VENDOR-AVAILABILITY-1A

Truth label: `NODE0_CI_VENDOR_AVAILABILITY_LOCAL_ONLY`

## Slice

Merge FDE `github_actions_billing_lock` classification into proof:truth workflows
so empirical rail keeps `READY_LOCAL` when local gates pass and vendor CI is locked.

## Operator lane

```bash
DEMA_LOCAL_PROOF_LANE=GITHUB_ACTIONS_BILLING_LOCK npm run proof:truth
# or
npm run proof:truth:local-lane
```

## Proof

```bash
node --test tests/node0-ci-vendor-availability.test.js
node scripts/review/node0-ci-vendor-availability-check.mjs
npm test
npm run check
```

## Boundaries

Local classification only. Does not unlock GitHub billing or authorize remote merge.
