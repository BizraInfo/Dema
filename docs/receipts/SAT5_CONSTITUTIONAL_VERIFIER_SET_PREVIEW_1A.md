# Receipt: SAT5-CONSTITUTIONAL-VERIFIER-SET-PREVIEW-1A

Truth label: `SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_MEASURED_REPO`

## Slice

Preview-only SAT-5 constitutional verifier set: five deterministic verifier passes (receipt/hash integrity, consent/FATE, impact/no-riba, security/blast-radius, governance/doctrine) that JUDGE a Node0 outcome — fail-closed admissibility, SAT judges Node0 and does not serve it, inert output with no authority, no mint, no live SAT agent.

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

`npm run check` runs `sat5-constitutional-verifier-set-preview-check.mjs` and keeps `SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/sat5-constitutional-verifier-set-preview.test.js
node scripts/review/sat5-constitutional-verifier-set-preview-check.mjs --json
npm run check
```
