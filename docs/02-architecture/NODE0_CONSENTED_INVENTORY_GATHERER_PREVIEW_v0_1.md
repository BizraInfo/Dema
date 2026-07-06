# NODE0-CONSENTED-INVENTORY-GATHERER-PREVIEW-1A

Truth label: `NODE0_CONSENTED_INVENTORY_GATHERER_PREVIEW_MEASURED_REPO`

## Purpose

Consent-scoped, metadata-only inventory summary kernel: derives a triage (categories, total bytes, stale/duplicate-name/sensitive-name candidates, largest) from injected file-metadata rows under a user-selected scan mode; metadata_only implemented, all five scan modes as future user options; no content read.

## Input Contract

```js
runNode0ConsentedInventoryGathererPreview({ consent, input })
```

Exact consent:

```text
GO: node0 consented inventory gather metadata only
```

## Output Contract

```text
schema
truth_label
ok
content_hash
boundary.execution_allowed (false)
blocked_by[]
```

## Verification

```js
verifyNode0ConsentedInventoryGathererPreview(payload)
```

Body-bound re-derivation. Tampering any field breaks the bind.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/node0-consented-inventory-gatherer-preview.js
tests/node0-consented-inventory-gatherer-preview.test.js
scripts/review/node0-consented-inventory-gatherer-preview-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/NODE0_CONSENTED_INVENTORY_GATHERER_PREVIEW_1A.md
docs/02-architecture/NODE0_CONSENTED_INVENTORY_GATHERER_PREVIEW_v0_1.md
```

## Commands

```bash
node --test tests/node0-consented-inventory-gatherer-preview.test.js
node scripts/review/node0-consented-inventory-gatherer-preview-check.mjs --json
npm test
npm run check
```
