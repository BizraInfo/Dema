# NODE0 Proof Spine v0.1

Truth label: `NODE0_PROOF_SPINE_MEASURED_REPO`

## Purpose

This document names the **measured proof spine** landed on trunk across PRs
#306–#310. It is a read-only architecture map — not a runtime, not a registry
row, not an execution surface.

The spine closes the loop from **governed sandbox action** to **one signature
over the whole receipt history**:

```text
execute (sandbox)
→ execute receipt (content_hash + state_hash)
→ Ed25519 attestation (per receipt)
→ append-only proof chain (ordered anchors)
→ signed chain head (one signature over head_hash)
```

Pre-action preview surfaces (#301–#305) route toward this spine but remain
`PREVIEW_ONLY` until promoted through their own slices.

## Measured slices (trunk)

| PR   | Slice ID                         | Trunk commit   | Role |
| ---- | -------------------------------- | -------------- | ---- |
| #306 | NODE0-REVERSIBLE-EXECUTE-GATE-1A  | `415cb49`      | First measured sandbox filesystem mutation (governed rename) with backup, sealed receipt, proven undo |
| #307 | NODE0-RECEIPT-SIGNING-ED25519-1A  | `37e2802`      | Ed25519 attestation over execute receipt hashes; signing authority ≠ execution authority |
| #308 | NODE0-PROOF-CHAIN-LINK-1A        | `ac619ae`      | Append-only hash chain binding ordered signed-receipt `content_hash` anchors |
| #309 | NODE0-SIGNED-CHAIN-HEAD-1A         | `049069b`      | Ed25519-sign verified chain `head_hash`; public-key-only verify |
| #310 | POST-309 spine count sync          | `35a2680`      | Docs-only: 6,015 tests · eleven registry spine rows |

Provenance receipt: [`docs/receipts/NODE0_SPINE_PROVENANCE_RECEIPT_1A.md`](../receipts/NODE0_SPINE_PROVENANCE_RECEIPT_1A.md).

## Capability truth registry (eleven spine rows)

At trunk HEAD after #310, `dema-capability-truth-registry.js` binds eleven
pre-action / execute spine capabilities. Execute-adjacent measured rows:

| capability_id | truth_label |
| ------------- | ----------- |
| `NODE0_REVERSIBLE_EXECUTE_GATE_1A` | `NODE0_REVERSIBLE_EXECUTE_SANDBOX_MEASURED` |
| `NODE0_RECEIPT_SIGNING_ED25519_1A` | `NODE0_SIGNED_SANDBOX_RECEIPT_ATTESTATION` |
| `NODE0_PROOF_CHAIN_LINK_1A` | `NODE0_APPEND_ONLY_SIGNED_RECEIPT_CHAIN` |
| `NODE0_SIGNED_CHAIN_HEAD_1A` | `NODE0_SIGNED_PROOF_CHAIN_HEAD` |

Preview rows (#301–#305, FDE, coverage gate, file steward) remain
`eligible_for_execution: false`.

## What this proves

- The repo contains a **complete measured chain** from sandbox execute through
  signed chain head, each slice with kernel, tests, review gate, and receipt doc.
- `npm run check` runs the spine review gates hermetically on every PR.
- Doc counts on `CURRENT_LIMITS.md` match disk after #310.

## What this does not prove

- Node0 **activation** (`dema node0 ladder` → `activate` = `GATED_OPERATOR_ONLY`).
- Operator CLI wiring for the full spine in one command (planned: #312).
- Arbitrary real-time tasks, autonomous loops, federation, Node1, token/PoI runtime.
- Persistent operator identity or receipt mint from governed runtime outside this repo.
- Runtime correctness of preview ladder rungs (`SHIPPED` = on disk, not validated live).

## Verify on disk

```bash
npm test                                    # expect # tests 6015 · # pass 6015
npm run check                               # includes spine review gates
node bin/dema node0 ladder --json           # activate rung gated
node --test tests/node0-reversible-execute-gate.test.js
node --test tests/node0-receipt-signing-ed25519.test.js
node --test tests/node0-proof-chain-link.test.js
node --test tests/node0-signed-chain-head.test.js
```

## Boundaries

```text
No daemon · no network · no federation · no token mint · no autonomy
Signing ≠ execution · sandbox execute only · doc map only
```
