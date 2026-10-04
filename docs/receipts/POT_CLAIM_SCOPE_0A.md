# Receipt: POT-CLAIM-SCOPE-0A

Truth label: `POT_CLAIM_SCOPE_MEASURED_REPO`

## Slice evidence

This is a source-and-test evidence record for a pure four-scope structural
evaluator:

```text
plan → evaluate → content-address → re-derive → tamper control
```

The static review fixture proves only that a supplied `COMPONENT` descriptor
can pass the fixed structural rules. It is not a current release attestation,
live mission receipt, provider observation, or economic measurement.

## Checked properties

- exact wrapper phrase is required but never consumed as authority;
- scope requirements are fixed for `COMPONENT`, `ROUTE`, `MISSION`, and
  `RESPONSIBILITY`;
- `UNKNOWN` holds and a permitted `NOT_APPLICABLE` remains distinct;
- causal-binding mismatch, contradiction, stale required evidence, and scope
  escalation do not promote;
- content-hash alteration, label alteration, and incomplete boundary
  alteration are rejected;
- the payload boundary is exactly all false and `authority_delta` is zero.

The content hash is an integrity check over the constructed body, not a
signature or independent truth anchor. A forged whole body with a recomputed
hash cannot be detected without an external identity/evidence system, which is
outside this slice.

## Boundaries

No runtime starts. No provider/model is invoked. No environment, native config,
or secret is read. No filesystem estate scan, receipt minting, consent
consumption, fallback activation, network activity, daemon, token, wallet, or
authority change occurs.

## Commands

```bash
node --test tests/pot-claim-scope.test.js
node scripts/review/pot-claim-scope-check.mjs --json
npm test
npm run check
npm run llm:guidance
git diff --check
```
