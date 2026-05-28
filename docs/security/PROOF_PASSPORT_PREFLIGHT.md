# H19 Proof Passport Preflight

Security and design preflight for portable proof. This document must
pass before any passport generation code ships.

## 1. Context

H18 delivered a local authorship proof spine:

```
key init → sign → discover → verify → closeout
```

All stages are remote-CI-verified through commit `ce18c4c`. The proof
spine is local-only: receipts live under `DEMA_HOME/receipts/`, keys
under `DEMA_HOME/keys/`, and no data leaves the operator's machine.

A Proof Passport changes the trust boundary: it packages local proof
into a **portable artifact** that can be shared, displayed, or verified
by a third party. This creates new risk surfaces.

## 2. Passport Schema Candidate

```json
{
  "schema": "bizra.dema.proof_passport.v0.1",
  "generated_at": "<ISO8601>",
  "mode": "LOCAL_EXPORT",
  "subject": {
    "node": "Node0",
    "public_key_fingerprint": "<sha256 hex>"
  },
  "receipts": [
    {
      "type": "authorship",
      "receipt_filename": "authorship-<hash>.json",
      "artifact_path": "<path>",
      "artifact_sha256": "<hex>",
      "signature_algorithm": "ed25519",
      "verdict": "VERIFIED",
      "truth_label": "VERIFIED_LOCAL_AUTHORSHIP_RECEIPT"
    }
  ],
  "aggregate": {
    "total_receipts": 1,
    "verified_count": 1,
    "failed_count": 0,
    "verdict": "ALL_VERIFIED"
  },
  "passport_hash": "<sha256 of canonical passport body>",
  "boundary": {
    "network_used": false,
    "federation_used": false,
    "token_minted": false,
    "identity_claimed_external": false,
    "legal_identity_asserted": false,
    "production_claimed": false,
    "receipt_content_included": false,
    "private_key_included": false
  },
  "truth_label": "LOCAL_PROOF_PASSPORT_EXPORTED"
}
```

## 3. Required Fields

| Field                          | Required | Source                                         |
| ------------------------------ | -------- | ---------------------------------------------- |
| schema                         | yes      | hardcoded constant                             |
| generated_at                   | yes      | `new Date().toISOString()`                     |
| mode                           | yes      | `LOCAL_EXPORT` (only mode in v0.1)             |
| subject.node                   | yes      | `Node0`                                        |
| subject.public_key_fingerprint | yes      | from loaded public key                         |
| receipts[]                     | yes      | from receipt scan + verify                     |
| aggregate.total_receipts       | yes      | computed                                       |
| aggregate.verified_count       | yes      | computed                                       |
| aggregate.verdict              | yes      | `ALL_VERIFIED` or `PARTIAL` or `NONE_VERIFIED` |
| passport_hash                  | yes      | sha256 of `stableStringify(body)`              |
| boundary                       | yes      | all false for v0.1                             |
| truth_label                    | yes      | derived from aggregate verdict                 |

## 4. Forbidden Claims

A Proof Passport v0.1 must NOT contain or imply:

- Private key material (PEM, raw bytes, or fingerprint of private key)
- Raw artifact content or preview
- Legal identity assertion ("this person is...")
- Production readiness claim
- Economic value or token balance
- Federation membership
- Network verification (only local verification)
- Timestamp authority (local clock only, not NTP-attested)
- Receipt content beyond metadata (no full receipt JSON embedding)

## 5. Canonicalization Strategy

Use `stableStringify` from `packages/consent/src/consent-common.js`.

Rationale: 47 call sites already use this function for receipt hashing
and signing. It sorts keys recursively and produces deterministic JSON.
For ASCII-key schemas (all Dema schemas), this is functionally
equivalent to RFC 8785 JCS.

The `passport_hash` field is computed as:

```
sha256(stableStringify(passport_body_without_passport_hash))
```

This allows independent recomputation by anyone with the passport JSON.

## 6. Hash and Signature Relationship

The passport itself is NOT signed in v0.1. Rationale:

- Each receipt inside the passport IS individually signed with Ed25519
- The passport is a **summary envelope**, not a new trust anchor
- Signing the passport would create a second layer of authority
- v0.1 keeps the trust primitive simple: verify each receipt

Future v0.2 may add passport-level Ed25519 signature if cross-node
verification requires it.

The `passport_hash` provides integrity detection (tamper-evident)
but not non-repudiation. That is correct for v0.1.

## 7. Verification Dependencies

A third party verifying a Proof Passport v0.1 needs:

1. The passport JSON file
2. The individual receipt JSON files (or trust the passport's summary)
3. The public key PEM (embedded in each receipt's `signature.public_key_pem`)

They do NOT need:

- Access to the operator's machine
- The private key
- Network connectivity
- BIZRA runtime

## 8. Truth Labels

| Aggregate state        | Truth label                          |
| ---------------------- | ------------------------------------ |
| All receipts verified  | `LOCAL_PROOF_PASSPORT_ALL_VERIFIED`  |
| Some receipts verified | `LOCAL_PROOF_PASSPORT_PARTIAL`       |
| No receipts verified   | `LOCAL_PROOF_PASSPORT_NONE_VERIFIED` |
| No receipts found      | `LOCAL_PROOF_PASSPORT_EMPTY`         |

## 9. Threat Model

| #   | Threat                                           | Severity | Mitigation                                                            |
| --- | ------------------------------------------------ | -------- | --------------------------------------------------------------------- |
| T1  | Passport forwarded as production credential      | High     | `production_claimed: false` + truth label says LOCAL                  |
| T2  | Private key leaked in passport                   | High     | Forbidden field. Test: no `BEGIN PRIVATE KEY` in output               |
| T3  | Artifact content leaked                          | Medium   | `receipt_content_included: false`. Only metadata                      |
| T4  | Passport hash recomputation fails cross-platform | Medium   | Use `stableStringify` (deterministic). Test with round-trip           |
| T5  | Stale passport presented as current              | Low      | `generated_at` timestamp. No expiry enforcement in v0.1               |
| T6  | Passport used as identity document               | High     | `legal_identity_asserted: false` + `identity_claimed_external: false` |
| T7  | Receipt tampering after passport generation      | Low      | Each receipt has its own Ed25519 signature. Verifier catches          |

## 10. H19.1 Acceptance Criteria

All must pass before H19.1 can be considered complete:

- [ ] Passport JSON matches schema in section 2
- [ ] `stableStringify` produces deterministic `passport_hash`
- [ ] `passport_hash` round-trips (recompute from passport body = same hash)
- [ ] No private key material in passport output
- [ ] No raw artifact content in passport
- [ ] No receipt found → empty passport with correct truth label
- [ ] One verified receipt → ALL_VERIFIED passport
- [ ] Tampered receipt → PARTIAL or NONE_VERIFIED passport
- [ ] Boundary all-false confirmed
- [ ] CLI: `dema proof passport [--json]`
- [ ] Human and JSON output formats
- [ ] `npm test`, `npm run check`, smoke, harness remain green
- [ ] No new CodeQL alerts introduced

## 11. Boundary

```json
{
  "h19_0_boundary": {
    "passport_generated": false,
    "code_written": false,
    "receipt_accessed": false,
    "key_loaded": false,
    "network_used": false,
    "federation_used": false,
    "token_minted": false,
    "document_written": true,
    "risk_classified": true
  }
}
```
