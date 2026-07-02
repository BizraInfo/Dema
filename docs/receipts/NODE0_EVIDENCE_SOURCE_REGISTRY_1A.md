# Receipt: NODE0-EVIDENCE-SOURCE-REGISTRY-1A

Truth label: `NODE0_EVIDENCE_SOURCE_REGISTRY_MEASURED_REPO`

## Slice

Register local, GitHub, Drive, Claude export, public-domain, receipt, design, and economy-simulation evidence sources before indexing, dedup, impact review, or mint decisions.

```text
plan → build → verify → tamper-reject
```

## Proof Contract

The default gate must pass only while:

- the exact GO phrase matches byte-for-byte,
- the canonical registry payload is content-addressed,
- verification re-derives from the body and rejects stale-hash tamper,
- all eight supported source families are classified by source type, privacy, truth label, dedup policy, and promotion gate,
- every registered source has `mint_allowed: false`,
- economy-simulation sources are blocked from the impact queue,
- the boundary stays all-false (no execution authority).

`npm run check` runs `node0-evidence-source-registry-check.mjs` and keeps `NODE0_EVIDENCE_SOURCE_REGISTRY_1A` at `MEASURED_REPO` only for local registration, not source ingestion or impact verification.

## Commands

```bash
node --test tests/node0-evidence-source-registry.test.js
node scripts/review/node0-evidence-source-registry-check.mjs --json
npm run check
```
