# APR-NODE0-ROUTE-REFINERY-PREVIEW-1A

**Slice:** Preview-only refinery over AASR route previews.  
**Truth label:** `APR_NODE0_ROUTE_REFINERY_PREVIEW_ONLY`

## What Shipped

| Module | Role |
| --- | --- |
| `packages/core/src/apr-node0-route-refinery-preview.js` | Pure APR route-refinery preview builder and verifier |
| `scripts/review/apr-node0-route-refinery-preview-check.mjs` | Hermetic review gate |
| `tests/apr-node0-route-refinery-preview.test.js` | Acceptance proof |
| `docs/02-architecture/APR_NODE0_ROUTE_REFINERY_PREVIEW_v0_1.md` | Architecture contract |

## Refinement Block Atom

The chained refinement block preview contains:

```text
previous_state_hash
input_route_id
route_quality_score
proof_ok
consent_ok
risk_ok
overclaim_ok
safe_next_action_recommendation
boundaries
block_preview_hash
```

The block hash is deterministic SHA-256 over the preview subset object. It is
not a runtime receipt and does not imply that refinement or route state was
written.

## Commands

```bash
node --test tests/apr-node0-route-refinery-preview.test.js
node scripts/review/apr-node0-route-refinery-preview-check.mjs --json
```

## Boundaries

- No route execution
- No scan
- No file mutation
- No content read
- No OCR
- No embeddings
- No network
- No URP write
- No token mint
- No wallet
- No transfer
- No daemon
- No model invocation
- No autonomous action
- Preview only

## Replay Meaning

A passing replay means APR can critique an AASR route preview, compute proof /
consent / risk / overclaim gaps, recommend preview-safe route adjustments, and
hash a refinement block without executing any route.

It does not prove live APR, RSI, model reasoning, federation, reward, economic
settlement, or runtime autonomy.
