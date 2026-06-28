# AASR-NODE0-STATE-ROUTER-PREVIEW-1A

**Slice:** Preview-only router over File Steward and Node0 resource previews.  
**Truth label:** `AASR_NODE0_STATE_ROUTER_PREVIEW_ONLY`

## What Shipped

| Module | Role |
| --- | --- |
| `packages/core/src/aasr-node0-state-router-preview.js` | Pure AASR preview builder and verifier |
| `scripts/review/aasr-node0-state-router-preview-check.mjs` | Hermetic review gate |
| `tests/aasr-node0-state-router-preview.test.js` | Acceptance proof |
| `docs/02-architecture/AASR_NODE0_STATE_ROUTER_PREVIEW_v0_1.md` | Architecture contract |

## State Block Atom

The chained state block preview contains:

```text
previous_state_hash
normalized_claim
artifact_type
file_action_id
resource_schema
snr_decision
consent_collected
compliance_ok
boundaries
block_preview_hash
```

The block hash is deterministic SHA-256 over the preview subset object. It is
not a runtime receipt and does not imply that state was written.

## Commands

```bash
node --test tests/aasr-node0-state-router-preview.test.js
node scripts/review/aasr-node0-state-router-preview-check.mjs --json
```

## Boundaries

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

A passing replay means AASR can normalize a claim, route preview artifacts,
compute deterministic SNR/compliance/consent state, and produce a state-block
hash preview without executing the routed state.

It does not prove live APR, RSI, model reasoning, federation, reward, economic
settlement, or runtime autonomy.
