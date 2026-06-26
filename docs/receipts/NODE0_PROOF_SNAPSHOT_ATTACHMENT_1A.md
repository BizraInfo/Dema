# NODE0 Proof Snapshot Attachment 1A

**Truth label:** `NODE0_PROOF_SNAPSHOT_ATTACHMENT_LOCAL_ONLY`  
**Schema:** `bizra.dema.node0_proof_snapshot_attachment.v0.1`  
**Slice:** NODE0-PROOF-SNAPSHOT-ATTACHMENT-1A

## Purpose

Attach a real gathered `proof:truth` ledger snapshot into killer-demo convergence without overclaiming remote/public readiness.

## Review gate

```bash
node scripts/review/node0-proof-snapshot-attachment-check.mjs
node --test tests/node0-proof-snapshot-attachment.test.js
```

## What this proves

- Structural attachment of a proof:truth ledger (commit, receipt_hash, boundary flags)
- Honest reporting of advisory CI rails (`UNKNOWN` unless verified CI evidence attestation)
- `ready_local_eligible` only when full control-plane verify passes at `READY_LOCAL`

## What this does not prove

- Remote CI seal, public-safe publication, or economic activation
- Upgrading UNKNOWN advisory rails without operator-supplied evidence

Wired in `npm run check`. Killer-demo convergence consumes gathered snapshots via `dema demo node0-value-loop convergence --json`.
