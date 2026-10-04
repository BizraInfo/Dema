# G0 Private Witness Bundle — assembly index

Truth label: `DECLARED_DRAFT` pack index · not a public launch.

Assembled for ICP-0 private send **only after operator GO**.

## Contents (paths in this repo)

1. [docs/BIZRA_THIRD_PARTY_EVALUATION_PACK_v0_1.md](../BIZRA_THIRD_PARTY_EVALUATION_PACK_v0_1.md)
2. [docs/CURRENT_LIMITS.md](../CURRENT_LIMITS.md) — honesty ledger
3. [docs/CLAIM_REGISTER_v0_1.md](../CLAIM_REGISTER_v0_1.md)
4. [docs/gtm/NODE0_EVALUATOR_DEMO_SCRIPT.md](NODE0_EVALUATOR_DEMO_SCRIPT.md)
5. [docs/gtm/TASK029_PRE_CEREMONY_HALT.md](TASK029_PRE_CEREMONY_HALT.md)
6. [docs/GTM.md](../GTM.md) — first offer boundary

## Local proof commands (evaluator SHA)

```bash
npm test
npm run check
npm run gtm:readiness
npm run claim:check
npm run eval:layer1
npm run proof:export -- --json
node bin/dema demo node0-value-loop
```

## Send gate

Do **not** email or publish this pack until the operator names 1–3 evaluators and types GO.
After send: record Phase-1 evidence metadata under `$DEMA_HOME` via `npm run gtm:readiness`
(no private feedback content in the repo).

## Hold G1

Public technical launch stays locked until verified mission turn + live PAT loop + TASK-029.
