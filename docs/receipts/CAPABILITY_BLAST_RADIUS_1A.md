# Receipt: CAPABILITY-BLAST-RADIUS-1A

Truth label: `CAPABILITY_BLAST_RADIUS_MEASURED_REPO`

## Slice

Deterministic blast-radius classifier: derives blast_radius (low|medium|high) and reversibility from declared action mutation flags — never from prose — so graduated consent can name what an action touches before it runs. No execution, no network, no mutation.

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

`npm run check` runs `capability-blast-radius-check.mjs` and keeps `CAPABILITY_BLAST_RADIUS_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/capability-blast-radius.test.js
node scripts/review/capability-blast-radius-check.mjs --json
npm run check
```
