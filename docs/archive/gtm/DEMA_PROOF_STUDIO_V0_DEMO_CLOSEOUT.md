# Dema Proof Studio v0 — Demo Closeout

Claim-disciplined closeout for the H19 Proof Passport stack at commit
`4a592bf`. This document defines what the demo proves, what it does
NOT prove, and the GTM-safe positioning boundary.

## 1. Verified Command Sequence

Reproducible end-to-end, on any operator machine with Node.js 22+:

```bash
# 1. Generate Ed25519 keypair (one-time, consent-gated)
dema authorship key init --consent "GENERATE AUTHORSHIP KEY"

# 2. Sign a local artifact (consent-gated, content-addressed receipt)
dema authorship sign README.md --consent "SIGN AUTHORSHIP RECEIPT"

# 3. Generate portable proof passport
dema proof passport --json > passport.json

# 4. Verify the passport envelope only
dema proof passport verify passport.json --json

# 5. Verify the passport AND re-verify every referenced receipt
dema proof passport verify passport.json --deep --json
```

Expected deep result:

```
verdict:             VERIFIED
verification_scope:  PASSPORT_ENVELOPE_AND_RECEIPTS
truth_label:         LOCAL_PROOF_PASSPORT_DEEP_VERIFIED
```

## 2. Verified Truth Labels

| Stage                        | Truth label                              |
| ---------------------------- | ---------------------------------------- |
| Local authorship receipt     | `VERIFIED_LOCAL_AUTHORSHIP_RECEIPT`      |
| Passport envelope verified   | `LOCAL_PROOF_PASSPORT_ENVELOPE_VERIFIED` |
| Passport + receipts verified | `LOCAL_PROOF_PASSPORT_DEEP_VERIFIED`     |
| Remote CI seal               | `H19_3_1_REMOTE_CI_VERIFIED`             |

Failure labels mirror these with `_FAILED` / `EMPTY` suffixes.

## 3. What This Demo Proves

| Claim                                                                                                           | Status |
| --------------------------------------------------------------------------------------------------------------- | ------ |
| A local artifact has a content-addressed authorship receipt                                                     | YES    |
| The receipt is signed by Node0's Ed25519 keypair                                                                | YES    |
| The Proof Passport envelope (schema + hash + boundary + aggregate) validates                                    | YES    |
| Each referenced authorship receipt file re-verifies against its Ed25519 signature                               | YES    |
| Passport-declared metadata matches receipt-actual metadata (artifact_sha256, fingerprint, verdict, truth_label) | YES    |
| The verifier rejects path traversal (`../`) and nested filenames                                                | YES    |
| Tampered artifacts, receipts, or passport bodies fail closed                                                    | YES    |
| Remote CI (gitleaks, CodeQL, check, BIZRA Review Gate) is green at the stated commit                            | YES    |
| The entire loop runs read-only with no network, federation, or mutation beyond consent-gated writes             | YES    |

## 4. What This Demo Does NOT Prove

These claims are **explicitly out of scope** for v0 and would be
violations of Ihsān if asserted.

| Claim NOT made                                             |
| ---------------------------------------------------------- |
| Legal identity of the operator                             |
| Production-grade security certification                    |
| Federation between nodes                                   |
| Network consensus or distributed ledger                    |
| Token reward eligibility                                   |
| Proof-of-Impact economics                                  |
| Trust by external third parties without their own verifier |
| Time authority beyond the local clock                      |
| Compliance with any regulatory standard                    |

The truth label is intentionally `LOCAL_PROOF_PASSPORT_DEEP_VERIFIED` —
the `LOCAL_` prefix is load-bearing.

## 5. Definition of Done — Dema Proof Studio v0

- [x] Authorship: key init, sign, latest, closeout, demo, verify
- [x] Passport: generate, stable hash, envelope verify, deep verify
- [x] CLI surface for every operation
- [x] All 23 commits remote-CI green
- [x] 3161/3161 tests pass
- [x] Smoke 26/26 pass
- [x] μ-layer 104/104 pass
- [x] No private key material in any output
- [x] No raw artifact content in any receipt or passport
- [x] Path traversal rejected in deep verifier
- [x] Truth labels prefixed with `LOCAL_` to prevent overclaim
- [x] Documentation matches code (drift fixed in `361db49`)

## 6. GTM-Safe Positioning

```
"AI that proves the work it helps you do."
```

Acceptable variants:

- "Local-first sovereign authorship for AI-assisted work."
- "Sign your artifacts. Verify the receipts. Carry the proof."
- "Proof Passport: portable evidence of locally signed work."

NOT acceptable:

- "Verified identity"
- "Certified production"
- "Token-backed proof"
- "Federated trust"
- "Audit-grade legal evidence"

## 7. Next Stage

```
H20 — Agent Profile Schema Preflight
```

Scope (preflight only, no code):

- PAT-7 and SAT-5 profile schemas
- Skill registry shape
- Memory binding format
- DOD per agent
- Log envelope per agent
- Connection to existing receipt/passport spine

Only after H20.0 preflight ships and remote-seals should H20.1
implementation begin.

## 8. Boundary

```json
{
  "h19_3_2_boundary": {
    "code_changed": false,
    "runtime_behavior_changed": false,
    "token_claim_made": false,
    "federation_claim_made": false,
    "legal_identity_claim_made": false,
    "security_certification_claim_made": false,
    "production_claim_made": false,
    "document_written": true,
    "claim_ledger_aligned": true
  }
}
```
