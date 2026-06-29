# Receipt: NODE0-SPINE-PROVENANCE-RECEIPT-1A

Truth label: `NODE0_SPINE_PROVENANCE_MEASURED_DOC_ARTIFACT`

**Slice:** T0.6 — seal the #306–#310 proof-spine chapter on trunk.  
**Schema:** `bizra.dema.node0_spine_provenance_receipt.v0.1` (declarative doc artifact)

## What this artifact is

A **measured documentation receipt** that binds the five trunk merges/commits,
test count, registry row count, and canon chain into one inspectable closeout.
It adds **no kernel**, **no CLI**, **no registry row**, and **no runtime**.

Architecture map: [`docs/02-architecture/NODE0_PROOF_SPINE_v0_1.md`](../02-architecture/NODE0_PROOF_SPINE_v0_1.md).

## Trunk provenance (verified 2026-06-29)

| PR   | Title / slice | Trunk commit (full) | Notes |
| ---- | ------------- | ------------------- | ----- |
| #306 | NODE0-REVERSIBLE-EXECUTE-GATE-1A | `415cb4925b81921181c4ea90ac5dded9ad50c7d4` | Merge commit |
| #307 | NODE0-RECEIPT-SIGNING-ED25519-1A | `37e280264c298e1853cb7717b24e94ae323a6b27` | Landed on `main` |
| #308 | NODE0-PROOF-CHAIN-LINK-1A | `ac619aef44f972a97be43e65f1e5d9da9ae76dbe` | Landed on `main` |
| #309 | NODE0-SIGNED-CHAIN-HEAD-1A | `049069bb7c59a9617a26aaf4ad567c21555be648` | Merge commit; feature head `fbbb868` |
| #310 | POST-309 spine count sync | `35a268075106c255c207decc6a317429eeb7980a` | Merge commit; feature head `c23849e` |

**Trunk HEAD after #310:** `35a268075106c255c207decc6a317429eeb7980a`

## Measured counts at trunk HEAD

| Metric | Value | Verify |
| ------ | ----- | ------ |
| Unit tests | **6,015** pass / 0 fail | `npm test` |
| Capability registry spine rows | **11** | `node --test tests/dema-capability-truth-registry.test.js` |
| Spine review gates in `npm run check` | 4 (execute · sign · chain · head) | `npm run check` |

## Canon chain (measured on trunk)

```text
intent (TADE kernel exists; preview-heavy)
→ governed sandbox execute (#306)
→ execute receipt integrity (content_hash + state_hash)
→ Ed25519 receipt attestation (#307)
→ append-only signed-receipt proof chain (#308)
→ signed proof-chain head (#309)
→ doc count sync (#310)
```

Signing authority remains **≠** execution authority at every hop.

## Per-slice evidence paths

| Slice | Kernel | Tests | Review gate | Receipt / arch doc |
| ----- | ------ | ----- | ----------- | ------------------ |
| #306 | `packages/core/src/node0-reversible-execute-gate.js` | `tests/node0-reversible-execute-gate.test.js` (15) | `scripts/review/node0-reversible-execute-gate-check.mjs` | `docs/receipts/NODE0_REVERSIBLE_EXECUTE_GATE_1A.md` |
| #307 | `packages/core/src/node0-receipt-signing-ed25519.js` | `tests/node0-receipt-signing-ed25519.test.js` (12) | `scripts/review/node0-receipt-signing-ed25519-check.mjs` | `docs/receipts/NODE0_RECEIPT_SIGNING_ED25519_1A.md` |
| #308 | `packages/core/src/node0-proof-chain-link.js` | `tests/node0-proof-chain-link.test.js` (10) | `scripts/review/node0-proof-chain-link-check.mjs` | `docs/receipts/NODE0_PROOF_CHAIN_LINK_1A.md` |
| #309 | `packages/core/src/node0-signed-chain-head.js` | `tests/node0-signed-chain-head.test.js` (12) | `scripts/review/node0-signed-chain-head-check.mjs` | `docs/receipts/NODE0_SIGNED_CHAIN_HEAD_1A.md` |
| #310 | — (docs only) | — | — | `docs/CURRENT_LIMITS.md` · `docs/TESTING.md` |

## What this proves

- The operator can point to **one receipt** listing trunk SHAs, counts, and the
  spine canon without re-deriving history from chat or memory.
- Tier-0 proof-spine chapter is **documentarily sealed** after #310 doc drift close.

## What this does not prove

- Node0 operational activation (`activate` rung remains `GATED_OPERATOR_ONLY`).
- End-to-end operator CLI for the spine (next slice: `NODE0-SPINE-RUNNER-CLI-1A`).
- ARTIFACT-012 second bounded diagnostic ceremony.
- Any new capability, registry promotion, or task-class expansion.

## Commands (re-verify)

```bash
git rev-parse main
npm test
npm run check
npm run llm:guidance
node scripts/review/node0-reversible-execute-gate-check.mjs --json
node scripts/review/node0-receipt-signing-ed25519-check.mjs --json
node scripts/review/node0-proof-chain-link-check.mjs --json
node scripts/review/node0-signed-chain-head-check.mjs --json
```

## Boundaries

```text
Doc artifact only · no runtime · no network · no keys · no mint · no daemon
No registry row · no eligible_for_execution change · no Tier 1 unlock
```

## Truth label after merge

```text
POST_309_SPINE_CONSOLIDATION = COMMITTED
NODE0_SPINE_PROVENANCE_RECEIPT_1A = MEASURED_DOC_ARTIFACT
Tier 0 proof-spine chapter = SEALED (doc)
Tier 1 = still blocked
```
