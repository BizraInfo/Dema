# NODE0 CI Evidence Attestation Bridge 1A

**Truth label:** `NODE0_CI_EVIDENCE_ATTESTATION_LOCAL_ONLY`  
**Schema:** `bizra.dema.node0_ci_evidence_attestation.v0.1`  
**Slice:** NODE0-CI-EVIDENCE-ATTESTATION-BRIDGE-1A

## Purpose

Replace raw `DEMA_PROOF_*` environment variables as advisory CI truth with a structured, hashable, fail-closed attestation object that flows:

```text
CI evidence → attestation object → verifier → proof snapshot attachment → READY_LOCAL eligibility
```

## Review gate

```bash
node scripts/review/node0-ci-evidence-attestation-check.mjs
node --test tests/node0-ci-evidence-attestation.test.js
```

## Attestation supply (I/O boundary)

The audit gatherer loads attestation JSON from:

- `DEMA_CI_EVIDENCE_ATTESTATION_JSON` (inline JSON), or
- `DEMA_CI_EVIDENCE_ATTESTATION_PATH` (file path)

Core kernel remains pure (no filesystem or network).

## What this proves

- CI rail claims are structurally verifiable (commit, receipt_hash, boundary flags)
- Verified attestation merges into gathered proof ledger for honest `READY_LOCAL` promotion
- Fail-closed on missing commit, UNKNOWN sentinel, hash mismatch, boundary violations, overclaim verdicts

## What this does not prove

- Remote CI seal, public-safe publication, or economic activation
- That CI actually passed without operator/CI-exported evidence backing the attestation

Wired in `npm run check`. Killer-demo convergence uses attested rails via gathered audit when attestation is supplied.
