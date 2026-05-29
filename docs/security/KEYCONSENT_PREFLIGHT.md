# KEYCONSENT-0 · Consent-to-Key Binding Preflight

**Status:** preflight design only; no runtime code; no key export; no integration with existing consent gates yet
**Sparse point:** After `9390e22` (DOC-VERIFY-0 architecture documentation)
**Pair-doc (future):** `KEYCONSENT_CLOSEOUT.md` (after KEYCONSENT-1A pure-kernel slice ships)
**Date:** 2026-05-29 (Dubai · GST)

## 1. Current weakness

The fail-closed consent gate that protects authorship-signing (`packages/receipts/src/authorship-key-store.js:43`, `packages/receipts/src/authorship-sign-command.js:35`, `packages/urp/src/choose-decision.js:148`, and now `packages/receipts/src/verdict-attest.js`) is an exact-string `===` comparison against a hardcoded phrase (`"GENERATE AUTHORSHIP KEY"`, `"SIGN AUTHORSHIP RECEIPT"`, `"MARK URP ENTRY SHAREABLE"`, etc.).

**The exact threat**: anyone who knows the canonical phrase AND has access to the operator's signing key on disk (`$DEMA_HOME/keys/node0-ed25519.pem`) can attest. The phrase is a typed **shibboleth** — possession of the phrase, not possession of the operator's key-presence, is what the gate checks. Once the phrase is known, the consent's authority dissolves; the only remaining protection is filesystem access control on the private key file.

This is acknowledged explicitly in the 2026-05-29 verdict-receipt commit body (`ac60b44`):

> No consent-to-key binding yet. The "SIGN AUTHORSHIP RECEIPT" phrase is still a typed shibboleth; anyone who knows it AND has the operator's signing key can attest.

KEYCONSENT-0 is the preflight for the slice that closes that gap.

## 2. Target

Turn consent from typed phrase into **cryptographic proof-of-presence**. The operator's act of consenting becomes a signed, scoped, time-bounded artifact that an external verifier can confirm came from the operator's key — not just from someone who knows a string.

Mechanism (in one line): _the consent phrase is no longer the proof; the consent phrase plus a fresh nonce signed by the operator's Ed25519 key is the proof._

## 3. Consent proof envelope

Proposed schema for the consent proof artifact:

```text
schema:                              "bizra.dema.consent_proof.v0.1"
consent_phrase:                      "<exact canonical phrase>"
action_scope: {
  action_type:                       "<e.g., SIGN_AUTHORSHIP_RECEIPT, MINT_VERDICT_RECEIPT, MARK_URP_SHAREABLE>",
  target_hash:                       "<sha256 hex of the specific input/artifact this consent authorizes>",
  rule_id:                           "<optional: e.g., canonical-shape.v0.1>"
}
nonce:                               "<32 bytes hex; freshly generated per consent>"
created_at_iso:                      "<ISO-8601 UTC timestamp>"
expires_at_iso:                      "<ISO-8601 UTC timestamp; default: created_at + 5 minutes>"
operator_public_key_fingerprint:     "<sha256 hex of the operator's Ed25519 pubkey, DER form>"
consent_signature_b64:               "<Ed25519 signature over stableStringify(body without _b64/proof_hash fields), base64>"
consent_proof_hash:                  "<sha256 of stableStringify(body excluding consent_signature_b64 and consent_proof_hash)>"
```

The `body` for signing/hashing is the envelope **without** `consent_signature_b64` and **without** `consent_proof_hash` — same separation pattern as URP-3.1A local index, URP-4.1A choose decision, and the verdict-receipt body (re-derivable; the signature commits to all other fields, the hash is the content address).

Two derived properties matter:

1. **Identity binding**: the `consent_signature_b64` was producible only by someone holding the operator's private key at the time of signing. A stranger cannot mint a valid one even with full knowledge of the phrase.
2. **Scope binding**: the `action_scope.target_hash` ties this consent to a specific input/artifact. A consent issued for `target_hash=A` cannot authorize an action against `target_hash=B`.

## 4. How action receipts reference `consent_proof_hash`

The existing action receipts (verdict-receipt body, urp-choose-receipt body, authorship-receipt body) gain ONE new field:

```text
consent_proof_hash:  "<sha256 of the consent proof body>"
```

This is a **hash reference**, not an inclusion. The full consent proof envelope ships in the **bundle** alongside the action body (same pattern as `bundle.input` carrying the input alongside the verdict body in this slice's `bizra.dema.verdict_receipt.v0.1`).

Updated bundle shape (proposed):

```text
{
  body:                  <action body, including consent_proof_hash>,
  signature_b64:         <action signature>,
  signer_public_key_pem: <action signer's pubkey; verifier still ignores this for trust>,
  input:                 <action's input, for replay>,
  consent_proof:         <the full consent proof envelope from §3>
}
```

Action body commits to `consent_proof_hash`; bundle ships the consent proof alongside. Cleanly mirrors the input/input_hash relationship the verdict-receipt slice already established.

## 5. Verification flow

A stranger with (bundle) + (operator's pubkey, supplied SEPARATELY via `--pubkey`) + (this repo's rule code) verifies in this order:

1. **Action signature** — verify `body.signature_b64` over `stableStringify(body)` using external `--pubkey` (the existing Level B mechanism). On failure → `REJECTED:signature_invalid`.
2. **Consent proof structural validity** — `consent_proof.schema == "bizra.dema.consent_proof.v0.1"`, all required fields present.
3. **Consent signature** — verify `consent_proof.consent_signature_b64` over `stableStringify(consent_proof body without signature_b64 and proof_hash)` using THE SAME external `--pubkey` (the consent and the action must come from the same key — that's the binding). On failure → `REJECTED:consent_signature_invalid`.
4. **Consent → action binding** — `sha256(stableStringify(consent_proof body excluding sig + proof_hash)) == body.consent_proof_hash`. Action receipt commits to consent. On mismatch → `REJECTED:consent_proof_hash_mismatch`.
5. **Scope match** — `consent_proof.action_scope.target_hash == body.input_hash` (or the equivalent target for non-verdict receipts). On mismatch → `REJECTED:consent_scope_mismatch`.
6. **Freshness** — `now() <= consent_proof.expires_at_iso`. Verifier uses its own clock; the receipt's `created_at_iso` is a CLAIM, not a verified fact. On expiry → `REJECTED:consent_expired`.
7. **Nonce uniqueness** — OPTIONAL this slice; deferred to KEYCONSENT-2 (a single-use nonce registry at `$DEMA_HOME/consent/used-nonces.json`). Without it, replay protection is bound only by scope + expiration.

If steps 1–6 all pass → `VERIFIED`. The verdict is now grounded **AND** consent-bound.

## 6. Non-goals

This slice (KEYCONSENT-0) and the immediately-following implementation slice (KEYCONSENT-1A) DO NOT:

- Add biometric authentication (no fingerprint, no FaceID, no voice).
- Integrate password managers or OS keychains.
- Integrate hardware wallets (no Ledger, no Trezor, no YubiKey, no HSM).
- Open federation, peer transport, or cross-node consent exchange.
- Mint tokens, distribute rewards, or make economic claims.
- Build a general consent-policy engine or rule registry.
- Re-design the operator's existing Ed25519 key store (`authorship-key-store.js`).
- Provide hardware proof-of-presence (no TPM attestation, no secure enclave attestation).
- Replace the phrase entirely — the phrase remains as an INTENT MARKER on the consent body so an external auditor can read the human-meaningful scope.

## 7. Threat model

| Attacker                                   | Capability                                                                                                                                  | KEYCONSENT-1A status                                                                                                                                                                | Why                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phrase-only attacker**                   | Knows `"SIGN AUTHORSHIP RECEIPT"` (and other canonical phrases); does NOT have the operator's private key.                                  | **BLOCKED**                                                                                                                                                                         | Cannot produce a valid `consent_signature_b64` over the consent body. The phrase alone is insufficient.                                                                                                                                                                                                                                                           |
| **Stolen-receipt replayer**                | Stole a valid `{body, consent_proof, signature_b64, ...}` bundle from disk or wire. Wants to re-use it for a different action.              | **BLOCKED with proper scope**                                                                                                                                                       | `action_scope.target_hash` binds the consent to ONE specific input/artifact. Re-using the consent for a different target → `consent_scope_mismatch`.                                                                                                                                                                                                              |
| **Embedded-key liar**                      | Modifies `bundle.signer_public_key_pem` to claim a different signer; supplies real-looking signatures from a key the stranger doesn't have. | **BLOCKED**                                                                                                                                                                         | The verifier IGNORES `bundle.signer_public_key_pem`; it uses ONLY the externally-supplied `--pubkey`. Same invariant as verdict-receipt REJECT-4.                                                                                                                                                                                                                 |
| **Stale-consent replayer**                 | Stole a valid bundle and tries to reuse it later.                                                                                           | **BLOCKED with proper time bound**                                                                                                                                                  | `expires_at_iso` + verifier-side `now()` check rejects expired consents. KEYCONSENT-2 (out of scope this slice) adds single-use nonce registry for the case where time bounds are too loose.                                                                                                                                                                      |
| **Disk-access attacker with operator key** | Has read access to `$DEMA_HOME/keys/node0-ed25519.pem`.                                                                                     | **NOT BLOCKED — out of scope.**                                                                                                                                                     | If the attacker has the private key, no software-only consent scheme stops them from signing whatever they want. The KEYCONSENT layer raises the bar from "phrase knowledge" to "key possession AT THE MOMENT OF CONSENT," but does not protect against a compromised key. Mitigation is operator-side (filesystem ACLs, OS keychain migration in a later slice). |
| **Replay across machines**                 | Steals consent proof from Node 1 and uses against Node 2.                                                                                   | **NOT BLOCKED — out of scope.** Bound only by scope + expiration this slice. Cross-machine replay protection requires a public nonce registry, which is a federation-class concern. |

## 8. Replay protection

Three layers, increasing in cost:

1. **Scope binding** (cheap, fundamental): every consent proof carries `action_scope.target_hash`. The verifier checks this against the action's actual target. Re-using a consent for a different target fails immediately. **In KEYCONSENT-1A.**
2. **Expiration** (cheap, time-bounded): `expires_at_iso` is set at consent creation (default: created_at + 5 minutes; configurable per action_type). Verifier uses its own clock. **In KEYCONSENT-1A.**
3. **Single-use nonce registry** (more cost, optional): `$DEMA_HOME/consent/used-nonces.json` records consumed nonces; the consent gate refuses to re-accept a nonce. **DEFERRED to KEYCONSENT-2.** Required for production use cases where consent windows must be larger than a few minutes but single-use semantics are required.

The default posture for KEYCONSENT-1A is layers 1 + 2 only. Layer 3 is a separate slice.

## 9. DOD for KEYCONSENT-1A (pure consent proof kernel)

Exit criteria for the IMMEDIATELY-FOLLOWING implementation slice (NOT this preflight):

- [ ] `packages/receipts/src/consent-proof.js` exports pure functions: - `buildConsentProof({phrase, actionScope, demaHome, nonce?, createdAtIso?, expiresAtIso?})` — fail-closed when phrase is empty, action_scope is missing or malformed, or no signing key is found; otherwise loads the key, generates a fresh nonce if not supplied, signs the body, returns a frozen envelope per §3. - `verifyConsentProof({consentProof, pubkeyPem, expectedActionScope?, now?})` — performs §5 steps 2-6 (structural, signature, scope match, freshness). Returns either `{verified: true, ...}` or `{verified: false, reason: "<first failing reason>"}`.
- [ ] All Ed25519 + sha256 + stableStringify primitives REUSED from existing modules — no duplication.
- [ ] Tests (`tests/consent-proof.test.js`): - happy path: build then verify with matching external pubkey → `verified: true`. - wrong phrase: `consent_required`. - no signing key: `no_authorship_key`. - tampered consent body: `consent_signature_invalid`. - wrong external pubkey: `consent_signature_invalid`. - scope mismatch (expected_action_scope differs from envelope): `consent_scope_mismatch`. - expired consent: `consent_expired` (with injected `now()`). - deterministic when nonce + createdAtIso are injected: two calls deep-equal.
- [ ] Tests run inside `tests/*.test.js`; full suite stays green; smoke 42/42 stays green.
- [ ] Does NOT yet integrate with `attestVerdict`, `signArtifact`, or `urp choose` — that integration is **KEYCONSENT-1B**, a follow-up slice gated on KEYCONSENT-1A remote-CI-verified.
- [ ] Does NOT yet enforce single-use nonce — that is **KEYCONSENT-2**, gated on KEYCONSENT-1A + 1B remote-CI-verified.
- [ ] No new CLI surface this slice — `dema consent prove ...` and similar are KEYCONSENT-1C.

## 10. Boundary

This preflight document is text-only. Its boundary block:

```json
{
  "runtime_code_changed": false,
  "private_key_exported": false,
  "network_used": false,
  "federation_used": false,
  "token_minted": false,
  "economic_claim_made": false,
  "new_authentication_system_live": false
}
```

KEYCONSENT-1A, 1B, 1C, and 2 will each carry their own boundary blocks and tighter scope statements.

## 11. What this preflight does NOT do

- Does NOT change any existing consent gate behavior.
- Does NOT introduce any new schema into a running envelope.
- Does NOT modify the operator's `~/.dema/` directory.
- Does NOT make a security claim that consent is now key-bound (it is not, yet — this is a design doc, not a shipped feature).
- Does NOT promise a specific implementation timeline for KEYCONSENT-1A onward.
- Does NOT close the audit finding that flagged the typed-shibboleth weakness; that closure requires KEYCONSENT-1A through 1C shipped and remote-CI-verified.

## 12. Proof-of-truth convergence (this preflight)

| Lens          | Status                                                                                                                |
| ------------- | --------------------------------------------------------------------------------------------------------------------- |
| Formal        | DESIGNED — schema, envelope shape, verification flow, threat table all named.                                         |
| Cryptographic | DESIGNED_NOT_LIVE — primitives identified (Ed25519 + sha256 + stableStringify, all already in repo); no new code yet. |
| Empirical     | NOT YET — no tests because no kernel; KEYCONSENT-1A DOD lists the test set.                                           |
| Economic      | EXPLICITLY OUT OF SCOPE — no token, no PoI, no mint, no reward, no economic claim.                                    |

## 13. What unlocks next

After this preflight is committed and remote-CI verified, KEYCONSENT-1A (the pure consent-proof kernel) can begin. After 1A + 1B + 1C + 2 are all sealed and remote-CI verified, the typed-shibboleth weakness identified in the 2026-05-29 trust audit and in the `ac60b44` self-critique is closed, and the canon glossary entry for "consent" can be promoted from DECLARED to MEASURED with cited test names as evidence.
