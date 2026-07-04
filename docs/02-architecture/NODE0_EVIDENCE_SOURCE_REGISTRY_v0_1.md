# NODE0-EVIDENCE-SOURCE-REGISTRY-1A

Truth label: `NODE0_EVIDENCE_SOURCE_REGISTRY_MEASURED_REPO`

## Purpose

Register local, GitHub, Drive, Claude export, public-domain, receipt, design, and economy-simulation evidence sources before indexing, dedup, impact review, or mint decisions.

## Input Contract

```js
runNode0EvidenceSourceRegistry({ consent, input })
```

Exact consent:

```text
GO: register Node0 evidence source registry locally
```

## Output Contract

```text
schema
truth_label
ok
content_hash
registry_id
source_count
counts_by_type
impact_candidate_count
mint_allowed_count (0)
policy.no_content_read (true)
policy.no_live_mint (true)
boundary.execution_allowed (false)
blocked_by[]
```

## Verification

```js
verifyNode0EvidenceSourceRegistry(payload)
```

Body-bound re-derivation. Stale-hash tampering is rejected, and semantic policy checks reject invalid source promotion such as economy simulations entering the impact queue.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No content read, Drive download, GitHub write, web scrape in runtime, delete, reorg, impact claim, network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Source Families

```text
local_path
github_repo
google_drive
claude_export
public_domain
proof_receipt
design_asset
economy_simulation
```

Registration does not mean ingestion. It only creates the typed map Dema uses before later index, dedup, review, and receipt slices.

## Files

```text
packages/core/src/node0-evidence-source-registry.js
tests/node0-evidence-source-registry.test.js
scripts/review/node0-evidence-source-registry-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/NODE0_EVIDENCE_SOURCE_REGISTRY_1A.md
docs/02-architecture/NODE0_EVIDENCE_SOURCE_REGISTRY_v0_1.md
```

## Commands

```bash
node --test tests/node0-evidence-source-registry.test.js
node scripts/review/node0-evidence-source-registry-check.mjs --json
npm test
npm run check
```
