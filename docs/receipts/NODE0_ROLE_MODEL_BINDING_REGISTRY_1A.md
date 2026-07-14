# Receipt: NODE0-ROLE-MODEL-BINDING-REGISTRY-1A

Truth label: `NODE0_ROLE_MODEL_BINDING_REGISTRY_MEASURED_REPO`

## Slice

SHADOW-only fail-closed role-model binding registry: roles bind to models only through evidence-bearing capability records; stale, contradicted, superseded, over-budget, or independence-violating bindings are rejected or abstained; design-family contradictions surface as REQUIRES_HUMAN.

```text
plan → build → verify → tamper-reject
```

## Proof Contract

The default gate must pass only while:

- the exact GO phrase matches byte-for-byte,
- the canonical payload is content-addressed,
- verification re-derives from the body and rejects tamper,
- a forged body with a recomputed hash is still rejected,
- the boundary stays all-false (no execution authority).

`npm run check` runs `node0-role-model-binding-registry-check.mjs` and keeps `NODE0_ROLE_MODEL_BINDING_REGISTRY_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/node0-role-model-binding-registry.test.js
node scripts/review/node0-role-model-binding-registry-check.mjs --json
npm run check
```
