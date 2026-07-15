# Receipt: NODE0-ROLE-MODEL-BINDING-REGISTRY-1A

Truth label: `NODE0_ROLE_MODEL_BINDING_REGISTRY_MEASURED_REPO`

## Slice

SHADOW-only fail-closed role-model binding registry: roles bind to models only through evidence-bearing capability records that satisfy an independently versioned role-and-lane acceptance policy (metric, direction, threshold, evaluation identity); stale, contradicted, superseded, over-budget, under-threshold, or independence-violating bindings are rejected or abstained; missing/inapplicable policy and design-family contradictions surface as REQUIRES_HUMAN.

```text
plan → build → verify → tamper-reject
```

## Proof Contract

The default gate must pass only while:

- the exact GO phrase matches byte-for-byte,
- the canonical payload is content-addressed,
- verification re-derives from the body and rejects tamper,
- a forged body with a recomputed hash is still rejected,
- no route binds without a satisfied acceptance policy (missing policy → REQUIRES_HUMAN; under-threshold → `capability_threshold_not_met`),
- the boundary stays all-false (no execution authority).

The proved receipt properties are exactly deterministic decision re-derivation
and receipt tamper detection. NOT proved: source-evidence authenticity — the
evidence `sha256` field is format-checked only; a syntactically valid SHA-256
does not verify the source bytes, and the caller-supplied input is not
authenticated by verification. The canonical gate fixture decides
`REQUIRES_HUMAN` because no operator-ratified acceptance policy exists yet.

`npm run check` runs `node0-role-model-binding-registry-check.mjs` and keeps `NODE0_ROLE_MODEL_BINDING_REGISTRY_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/node0-role-model-binding-registry.test.js
node scripts/review/node0-role-model-binding-registry-check.mjs --json
npm run check
```
