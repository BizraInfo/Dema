# BIZRA-QSAFE-INVENTORY-1A — Dema Crypto Surface Inventory

**Date:** 2026-06-05 (Dubai)
**Scope:** Dema (product face) only. Substrate (data-lake) inventoried separately under prior 1A.
**Command used:** Adapted grep for Ed25519 | X25519 | ECDSA | RSA | ECDH | sign | verify | signature | public_key | private_key | sha256 | blake3 | TLS | JWT | JWS across packages/ tests/ scripts/ bin/ apps/ docs/
**Raw output:** qsafe-crypto-inventory.txt (6467 lines, 578 unique files — noisy due to common words "sign"/"verify"/"signature"/"sha256")

**Truth label:** DECLARED_INVENTORY (no implementation claims, no PQC code added, no cutover dates, quantum-resistant language used only as "post-quantum hardened / crypto-agile / harvest-now-decrypt-later resistant").

## Primary Surfaces (high-signal hits)

### 1. RECEIPT / AUTHORSHIP / PROOF SIGNATURE (Ed25519 — THE core surface)

- **packages/receipts/src/authorship-signature.js** (central):
  - Uses `node:crypto` : generateKeyPairSync("ed25519"), createPublicKey, createPrivateKey, sign, verify.
  - Exports: generateEd25519Keypair(), signPayload(), verifyPayload(), buildSignedAuthorshipReceipt().
  - Algorithm declared as "ed25519".
  - Payloads include sha256 artifact hash + stableStringify for canonical signing.
  - Used by EVERY signed receipt, proof, passport, attestation in Dema.

- Imported by (non-exhaustive):
  - packages/genesis/src/_ (node0-identity-proof.js, block0-_.js, core-flywheel-run-proof.js, urp-resource-status-proof.js, dema-realm-state-proof.js, keyconsent-integration-proof.js, node0-composition-manifest.js, block0-manifest.js, block0-manifest-verifier.js, ...)
  - packages/rules/src/rule-consent-replay-verification.v0.1.js
  - packages/receipts/src/verdict-_.js, consent-verify-command.js, proof-passport_.js, authorship-\*.js (key-store, sign-command, verify, closeout, latest, demo)
  - packages/econ/src/dual-token-ledger\*.js
  - packages/flywheel/src/\*
  - packages/agents/src/\* (agent-wallet, profile-registry, skill-ledger)
  - packages/perf/src/perf-\*.js
  - packages/core/ (various)
  - scripts/ (proof-room, release-readiness, node0-self-check, etc. that call verification)

- **packages/receipts/src/canonical-receipt.js** and **canonical-ledger.js** (from prior 1A work): build/verify guards around signed receipts; Ed25519 path via the authorship module.
- **packages/receipts/src/authorship-key-store.js**: persists Ed25519 PEMs under DEMA_HOME/keys/ (mode 0o600), consent-gated init.

**Risk:** VULNERABLE_PUBLIC_KEY (Ed25519) for all live proof events.

### 2. HASH / CONTENT-ADDRESSING / CHAIN (sha256 primary, blake3 in places)

- sha256 (stableStringify + sha256) used pervasively for:
  - artifact_sha256 in authorship payloads
  - body hashes for receipts / proofs / passports / indexes
  - public_key_fingerprint
  - file naming (content-addressed)
- blake3: used in some proof/ledger paths (e.g. seal digests in prior substrate parity, and in Dema core for certain canonicals / diffusion traces).
- In packages/receipts, packages/genesis, packages/core, scripts/proof-room-bundle.mjs, scripts/priority-anchor.mjs, etc.

**Risk:** SHA-256 is acceptable for now with length, but quantum square-root speedup applies; recommend SHA3-512 or longer for long-lived anchors.

### 3. GENESIS / BLOCK0 / IDENTITY / PROOF LAYERS

- Heavy use of Ed25519 for operator-bound proofs (node0-identity-proof, block0 manifests, flywheel attestations, URP status, etc.).
- All ultimately route through the same signPayload/verifyPayload Ed25519 from receipts/authorship-signature.js.
- Many "operator_public_key_fingerprint", "xxx_signature_b64".

### 4. RULES, VERDICTS, CONSENT REPLAY

- packages/rules/ and packages/receipts/verdict-\*: rely on Ed25519 verify over canonical bodies + sha256 input_hash.
- Consent proofs also carry signatures verified the same way.

### 5. TESTS

- tests/receipts/, tests/canonical-\*.test.js, tests/verdict-receipt.test.js, tests/genesis/, tests/urp/ etc. contain extensive Ed25519 key gen, sign, verify, fingerprint, sha256 stable body tests.
- Many fixtures with sample PEMs and signatures.

### 6. SCRIPTS / TOOLING / RELEASE

- scripts/ (llm-guidance, proof-room, release-readiness, node0-\*, priority-anchor, smoke-boundary, etc.) use or invoke the same verification paths for receipts/proofs/passports.
- Some use sha256 for manifests, baselines.

### 7. TRANSPORT / ADAPTER / EXTERNAL (low in Dema source)

- packages/node-adapter/src/node0-adapter.js, gateway-http-adapter.js: use fetch / http(s) for Node0 communication. **No custom TLS, JWT, JWS, X25519 code in Dema** — relies on Node runtime + OS certs for https.
- No RSA, ECDSA (beyond what node:crypto Ed25519 wraps), ECDH, X25519 in user code.
- No JWT/JWS libraries in package.json for auth (consent is custom phrase + Ed25519).

### 8. DOCUMENTATION / NOISE / COMMENTS

- Huge volume of "sign", "verify", "signature", "sha256" in comments, docs/, markdown examples, test descriptions.
- "Ed25519" appears in docs, ADRs, ARCHITECTURE, RECEIPTS.md, genesis proofs docs, SP6 spec, etc.
- No TLS/JWT/JWS source hits of substance (mostly docs or node internals).

## Other Observations

- **No post-quantum anything**: 0 hits for ML-KEM, ML-DSA, SLH-DSA, Kyber, Dilithium, Falcon, etc.
- **Crypto agility surface is centralized**: Almost all signing funnels through `packages/receipts/src/authorship-signature.js` + the canonical receipt/ledger from prior 1A.
- **Key storage**: Ed25519 PEMs only, under DEMA_HOME, consent-gated, never transmitted in receipts (only fingerprint + signature + public_key_pem in some bundles).
- **Hash policy**: sha256 dominant for compatibility; blake3 used for some seals/digests.
- **Future transport hybrid**: Will be in adapter layer + Node0 substrate (not Dema code).

## Recommended next (per user sequence)

BIZRA-QSAFE-POLICY-GATE-1A (add SignaturePolicyResult + reason codes like CRYPTO_ALGORITHM_DEPRECATED, HYBRID_SIGNATURE_REQUIRED, PQ_SIGNATURE_MISSING, etc. to the receipt build/verify paths, using the centralized authorship module).

**Files to watch for Phase 2+**:

- packages/receipts/src/authorship-signature.js (add hybrid support)
- packages/receipts/src/canonical-receipt.js + canonical-ledger.js (policy gate + new fields)
- packages/genesis/src/\* (identity proofs)
- All consumers of signPayload/verifyPayload

**Raw full grep (noisy):** qsafe-crypto-inventory.txt
**This classified view:** qsafe-crypto-inventory-classified.md

**Status:** INVENTORY_COMPLETE (Dema face). DECLARED. No claims of quantum-resistance implemented.
