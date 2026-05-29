# ECON-0 · Proof-of-Impact Economy Preflight

**Status:** preflight design only; no runtime code; no key export; no integration with existing mutation gates yet; no public economic claim.
**Sparse point:** after the KEYCONSENT-1A pure kernel was sealed (commit `89ad00b`, remote-CI verified 2026-05-29).
**Pair-doc (future):** `ECON_CLOSEOUT.md` (after ECON-1A + POI-1A + ECON-1B are sealed).
**Date:** 2026-05-30 (Dubai · GST)

## 1. Current weakness

There is no token system in Dema today. The receipt chain (verdict receipts, URP choose receipts, authorship receipts, and — as of `89ad00b` — consent proofs) proves that local actions happened, were consented to, and were grounded against a deterministic rule. But the chain has no notion of **cost** for the resources a local action consumed (compute time, storage, tool invocation, verifier cycles) and no notion of **value** for the verified useful work the action produced (proof quality, mission completion, learning contribution, bug prevention).

**The exact gap**: an operator can run any number of consented, verified, signed actions and the system has no internal accounting for whether those actions were net-positive contributions to the operator's own mission, or net-negative resource sinks dressed up as proof. There is no replayable local ledger that an external auditor — even one given the bundle plus the operator's pubkey plus the public scoring rule code — can re-derive to confirm that a claimed Proof-of-Impact score was earned from real, scoped, deterministic verification work.

**Section 9 of the operator PDF** flags this directly:

> The token system is not decoration. It is the verified reward, cost, access, and learning-control layer.

ECON-0 is the preflight for the slice family that closes that gap — strictly local, strictly replayable, with no public economic claim of any kind.

## 2. Target

Turn local proof-work into a **verifiable, replayable, dual-token ledger** — where every Resource Token debit and every Impact Token credit ties back to a scoped, consented, deterministically-scorable action whose Proof-of-Impact score a stranger with the bundle, the operator's external pubkey, and the public scoring rule code can re-derive byte-for-byte.

Mechanism (in one line): _the PoI score is no longer a claim; the PoI score plus the consent proof plus the deterministic scoring rule code is the proof, and the dual-token ledger entry is the consequence._

## 3. Envelope schema

Two envelopes are proposed. Both follow the same body / signature / hash separation pattern as `bizra.dema.consent_proof.v0.1`, `bizra.dema.verdict_receipt.v0.1`, and `bizra.dema.urp_choose_receipt.v0.1`.

### 3.1 `bizra.dema.poi_score.v0.1` (Proof-of-Impact score)

```text
schema:                              "bizra.dema.poi_score.v0.1"
task_type:                           "consent_proof_replay_verification"   # v0.1: ONE deterministic task type, analogous to canonical-shape.v0.1
task_scope: {
  rule_id:                           "<e.g., consent-proof-replay.v0.1>",
  rule_code_hash:                    "<sha256 hex of the canonicalized public scoring rule source file(s)>",
  input_log_hash:                    "<sha256 hex of stableStringify(input verifier log)>"
}
score_inputs: {
  attempted_count:                   <integer, number of consent proofs in the verifier log>,
  verified_clean_count:              <integer, number of consent proofs that returned verified:true>,
  rejected_breakdown: {
    consent_signature_invalid:       <integer>,
    consent_scope_mismatch:          <integer>,
    consent_expired:                 <integer>,
    consent_required:                <integer>,
    no_authorship_key:               <integer>,
    other:                           <integer>
  }
}
score: {
  value:                             <rational; verified_clean_count / attempted_count when attempted_count > 0; else 0>,
  numerator:                         <integer; == verified_clean_count>,
  denominator:                       <integer; == attempted_count>,
  precision:                         "exact_rational"                       # no float drift; verifier compares fraction, not decimal
}
consent_proof_hash:                  "<sha256 of the consent proof body that authorized this scoring run>"
operator_public_key_fingerprint:     "<sha256 hex of operator Ed25519 pubkey, DER form>"
created_at_iso:                      "<ISO-8601 UTC>"
expires_at_iso:                      "<ISO-8601 UTC; default: created_at + 5 minutes; sets the window in which this score can be used to mint a ledger entry>"
score_signature_b64:                 "<Ed25519 signature over stableStringify(body excluding score_signature_b64 and score_hash), base64>"
score_hash:                          "<sha256 of stableStringify(body excluding score_signature_b64 and score_hash)>"
```

Field-by-field rationale:

- `schema` — version-locked; any change to scoring math or field layout requires bumping to `v0.2`.
- `task_type` — for v0.1, exactly one value: `consent_proof_replay_verification`. Future task types are deliberately gated behind their own preflights; ECON-0 does not enumerate them.
- `task_scope.rule_id` — human-readable rule identifier (e.g., `consent-proof-replay.v0.1`).
- `task_scope.rule_code_hash` — sha256 of the canonicalized public source file(s) that implement the scoring function. This is what makes the score **Level B grounded**: the verifier reads the same code, hashes it, and refuses if the hash doesn't match.
- `task_scope.input_log_hash` — sha256 of the verifier log the score is derived from. The full log ships in the bundle alongside.
- `score_inputs` — fully expanded counts. Not just a final number; the verifier must be able to re-derive `score.value` from these counts.
- `score.value` / `numerator` / `denominator` — stored as an exact rational. No `0.857142…` rounding ambiguity. Verifier compares `numerator * other.denominator == other.numerator * denominator`.
- `consent_proof_hash` — binds this score to the consent that authorized the scoring run. Same pattern as the action receipts under KEYCONSENT-1B.
- `operator_public_key_fingerprint` — informational; verifier still ignores this and uses the externally-supplied `--pubkey`.
- `created_at_iso` / `expires_at_iso` — freshness window for ledger-entry minting.
- `score_signature_b64` — Ed25519 signature by the operator's key over the body.
- `score_hash` — content address of the score body.

The `body` for signing/hashing is the envelope **without** `score_signature_b64` and **without** `score_hash` — same convention as KEYCONSENT-1A, URP-3.1A, URP-4.1A.

### 3.2 `bizra.dema.dual_token_ledger_entry.v0.1` (local-only ledger entry)

```text
schema:                              "bizra.dema.dual_token_ledger_entry.v0.1"
entry_id:                            "<uuid v4 or sha256 of body; chosen at mint time>"
ledger_scope: {
  realm:                             "local-only",                          # FROZEN in v0.1; no other value accepted
  operator_public_key_fingerprint:   "<sha256 hex of operator pubkey>"
}
action_receipt_hash:                 "<sha256 of the action receipt body this entry settles>"
consent_proof_hash:                  "<sha256 of the consent proof for that action>"
poi_score_hash:                      "<sha256 of the poi_score body that justifies the Impact Token credit>"
resource_token: {
  delta:                             <negative integer or zero; debit for compute / storage / tool / verifier / agent service / bandwidth>,
  components: {
    compute_units:                   <integer>,
    storage_units:                   <integer>,
    tool_invocations:                <integer>,
    verifier_cycles:                 <integer>,
    agent_service_units:             <integer>,
    bandwidth_units:                 <integer>,
    plugin_units:                    <integer>,
    local_infra_units:               <integer>
  },
  measurement_rule_id:               "<e.g., resource-measure.v0.1>",
  measurement_rule_code_hash:        "<sha256 hex of the public resource-measurement code>"
}
impact_token: {
  delta:                             <non-negative integer or zero; credit for verified useful work>,
  derivation: {
    poi_score_value_numerator:       <integer; copied from poi_score.score.numerator>,
    poi_score_value_denominator:     <integer; copied from poi_score.score.denominator>,
    impact_multiplier_id:            "<e.g., impact-multiplier.v0.1>",
    impact_multiplier_code_hash:     "<sha256 hex of the public multiplier code>"
  },
  components: {
    verified_useful_work_units:      <integer>,
    proof_quality_units:             <integer>,
    mission_completion_units:        <integer>,
    learning_contribution_units:     <integer>,
    knowledge_contribution_units:    <integer>,
    bug_prevention_units:            <integer>,
    optimization_units:              <integer>,
    agent_improvement_units:         <integer>
  }
}
prior_entry_hash:                    "<sha256 hex of the previous ledger entry body, or '0'*64 for genesis>"
created_at_iso:                      "<ISO-8601 UTC>"
entry_signature_b64:                 "<Ed25519 signature over stableStringify(body excluding entry_signature_b64 and entry_hash), base64>"
entry_hash:                          "<sha256 of stableStringify(body excluding entry_signature_b64 and entry_hash)>"
```

Field-by-field rationale:

- `ledger_scope.realm` — hardcoded to `"local-only"` in v0.1. Any verifier reading an entry with a different realm value MUST reject. This is the structural lock against accidental scope drift toward public settlement.
- `action_receipt_hash` — every entry settles exactly one action receipt; no entry without a prior action.
- `consent_proof_hash` — the consent that authorized that action; ECON-1A refuses to mint without it.
- `poi_score_hash` — the score envelope that justifies the `impact_token.delta`. No score, no credit.
- `resource_token.delta` — always `≤ 0`. Resource Tokens are debited, never credited from nothing.
- `impact_token.delta` — always `≥ 0`. Impact Tokens are credited, never spent (in v0.1; spending semantics are deliberately deferred).
- `resource_token.components` / `impact_token.components` — the operator-PDF Section 9 enumeration, captured structurally so the audit ladder can later promote individual components to MEASURED.
- `impact_token.derivation` — the score → impact mapping is a separate public rule (`impact-multiplier.v0.1`) with its own code hash. The verifier re-runs the multiplier deterministically.
- `prior_entry_hash` — every entry chains backward, identical to the proof-passport chain pattern. Genesis entry uses 64 zeros.
- `entry_signature_b64` / `entry_hash` — same body / signature / hash separation as every other envelope.

The body for signing/hashing is the envelope **without** `entry_signature_b64` and **without** `entry_hash`.

## 4. How action receipts reference the PoI score

The existing action receipts (verdict-receipt body, urp-choose-receipt body, authorship-receipt body) gain ONE new optional field — populated only when the action carried a measurable Proof-of-Impact contribution:

```text
poi_score_hash:  "<sha256 of the poi_score body; or absent if no PoI was claimed>"
```

This is a **hash reference**, not an inclusion. The full PoI score envelope ships in the **bundle** alongside the action body and the consent proof.

Updated bundle shape (proposed, extending the KEYCONSENT-1A bundle):

```text
{
  body:                  <action body, including consent_proof_hash and optionally poi_score_hash>,
  signature_b64:         <action signature>,
  signer_public_key_pem: <action signer's pubkey; verifier still ignores this for trust>,
  input:                 <action's input, for replay>,
  consent_proof:         <the full consent proof envelope from KEYCONSENT-1A §3>,
  poi_score:             <the full PoI score envelope from §3.1; OPTIONAL; required iff body.poi_score_hash present>,
  poi_input_log:         <the full verifier log whose hash == poi_score.task_scope.input_log_hash; OPTIONAL; required iff poi_score present>
}
```

Action body commits to `poi_score_hash`; bundle ships the score envelope and its input log alongside. Cleanly mirrors the input/input_hash and consent_proof/consent_proof_hash relationships already established.

## 5. Verification flow

A stranger with (bundle) + (operator's pubkey, supplied SEPARATELY via `--pubkey`) + (this repo's PoI rule code) verifies in this order:

1. **Action signature** — verify `body.signature_b64` over `stableStringify(body)` using external `--pubkey`. On failure → `REJECTED:signature_invalid`.
2. **Consent proof verified** — run the KEYCONSENT-1A `verifyConsentProof` flow against `bundle.consent_proof` with the same external `--pubkey`. On failure → `REJECTED:consent_*` (per KEYCONSENT-1A).
3. **PoI score structural validity** — `bundle.poi_score.schema == "bizra.dema.poi_score.v0.1"`, all required fields present, `task_type == "consent_proof_replay_verification"` (v0.1 lock). On failure → `REJECTED:poi_schema_invalid`.
4. **PoI score signature** — verify `bundle.poi_score.score_signature_b64` over `stableStringify(poi_score body excluding signature_b64 and score_hash)` using THE SAME external `--pubkey`. On failure → `REJECTED:poi_signature_invalid`.
5. **Score → action binding** — `sha256(stableStringify(poi_score body excluding sig + hash)) == body.poi_score_hash`. On mismatch → `REJECTED:poi_score_hash_mismatch`.
6. **Consent → score binding** — `bundle.poi_score.consent_proof_hash == sha256(stableStringify(bundle.consent_proof body excluding sig + proof_hash))`. The same consent that authorized the action authorized the scoring run. On mismatch → `REJECTED:poi_consent_mismatch`.
7. **Rule code hash match** — verifier reads the repo's public scoring rule source file(s), canonicalizes, sha256s. Must equal `bundle.poi_score.task_scope.rule_code_hash`. On mismatch → `REJECTED:poi_rule_code_drift`.
8. **Input log hash match** — `sha256(stableStringify(bundle.poi_input_log)) == bundle.poi_score.task_scope.input_log_hash`. On mismatch → `REJECTED:poi_input_log_mismatch`.
9. **Score re-derivation** — verifier runs the deterministic scoring function (from §3.1 `task_type` semantics) against `bundle.poi_input_log`, produces `(numerator, denominator)` and the `rejected_breakdown` counts. Must deep-equal `poi_score.score_inputs.*` and `poi_score.score.numerator` / `poi_score.score.denominator`. On mismatch → `REJECTED:poi_score_not_reproducible`.
10. **Freshness** — `now() <= poi_score.expires_at_iso`. On expiry → `REJECTED:poi_score_expired`.
11. **Nonce uniqueness** — OPTIONAL this slice; deferred to **ECON-2** (single-use nonce registry at `$DEMA_HOME/economy/used-score-nonces.json`). Without it, replay protection is bound only by scope + expiration.

If steps 1–10 all pass → `VERIFIED`. The action receipt is now grounded, consent-bound, **AND** score-reproducible from public rule code.

For ledger entries (separate verification entry-point invoked by `dema economy replay`):

12. **Entry signature** — verify `entry_signature_b64` over `stableStringify(entry body excluding sig + hash)` using external `--pubkey`. On failure → `REJECTED:entry_signature_invalid`.
13. **Entry → action binding** — `entry.action_receipt_hash` must equal the sha256 of the action body it claims to settle.
14. **Entry → consent binding** — `entry.consent_proof_hash` must equal the consent proof hash committed by that action.
15. **Entry → score binding** — `entry.poi_score_hash` must equal `bundle.poi_score`'s hash, AND `impact_token.derivation.poi_score_value_*` must equal `poi_score.score.*`.
16. **Resource-measurement rule code hash match** — verifier re-hashes the local resource-measurement source file(s); must equal `entry.resource_token.measurement_rule_code_hash`.
17. **Impact-multiplier rule code hash match** — verifier re-hashes the local impact-multiplier source file(s); must equal `entry.impact_token.derivation.impact_multiplier_code_hash`.
18. **Realm lock** — `entry.ledger_scope.realm == "local-only"`. Any other value → `REJECTED:realm_drift`.
19. **Chain continuity** — `entry.prior_entry_hash` must equal the sha256 of the previous entry's body (or 64 zeros for genesis).
20. **Token sign discipline** — `entry.resource_token.delta <= 0` AND `entry.impact_token.delta >= 0`. Violation → `REJECTED:token_sign_invalid`.

If steps 12–20 all pass for every entry in the chain → `LEDGER_VERIFIED`.

## 6. Non-goals

This slice (ECON-0) and the immediately-following implementation slices (ECON-1A, POI-1A, and ECON-1B) DO NOT:

- Make any **public economic claim** — these tokens have no public meaning, no public market, no public price.
- Implement **public transfer** between operators, nodes, machines, accounts, wallets, or addresses.
- Establish or imply any **exchange value** against any currency, asset, or commodity.
- Promise, express, or imply any **guaranteed reward** to anyone for anything.
- Make any **market claim** — no listing, no quote, no bid/ask, no liquidity.
- Perform a **public mint** — no on-chain operation, no minting authority published, no public supply curve.
- Open **federation** — no peer transport, no cross-node ledger exchange, no settlement network.
- Integrate **hardware-token devices** (no Ledger, Trezor, YubiKey, HSM, secure enclave).
- Convert to or from **fiat currency** in any direction.
- Enable **speculative trading**, futures, derivatives, or pre-sale of any kind.
- Constitute **commerce** — no goods, no services, no payment, no invoice, no settlement.
- Re-design KEYCONSENT-1A, the receipt envelope, or the URP local index.
- Pre-empt **POI-1B+** task types — v0.1 freezes exactly one task type and defers all others.
- Pre-empt **ECON-2** nonce registry semantics.
- Establish any **legal, regulatory, or financial position** for the token system.

## 7. Threat model

| Attacker                                   | Capability                                                                                                                           | ECON-1A + POI-1A status                                                                                                                      | Why                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phrase-only attacker**                   | Knows the canonical scoring consent phrase; does NOT have the operator's private key.                                                | **BLOCKED**                                                                                                                                  | The ECON-1A mint gate consumes a KEYCONSENT-1A consent proof. Without the operator's Ed25519 key, no valid consent proof, so no mint. Same gate as authorship signing.                                                                                                                                   |
| **Score-replay attacker**                  | Has a previously-issued, valid PoI score; tries to use it to mint a second ledger entry against a new action.                        | **BLOCKED with scope + expiration**                                                                                                          | The ledger entry commits to `action_receipt_hash`; the mint code refuses to issue two entries with the same `action_receipt_hash`. PoI score `expires_at_iso` further bounds the reuse window. ECON-2 adds nonce registry.                                                                               |
| **Double-mint attacker**                   | Has a valid action + consent + score bundle; tries to invoke the mint twice to credit Impact Tokens twice.                           | **BLOCKED**                                                                                                                                  | The ledger refuses an entry whose `action_receipt_hash` already appears in the prior chain. Replay verifier re-walks the chain on every mint to enforce this.                                                                                                                                            |
| **Foreign-key-signed score**               | Mints a PoI score with a non-operator key (their own); supplies a bundle claiming operator origin.                                   | **BLOCKED**                                                                                                                                  | Verifier uses ONLY the externally-supplied `--pubkey`. Foreign-key signature fails step 4. Same invariant as KEYCONSENT-1A and verdict-receipt REJECT-4.                                                                                                                                                 |
| **Scope-drift attacker**                   | Modifies `entry.ledger_scope.realm` from `"local-only"` to `"public-settlement"` (or any other string) post-signing.                 | **BLOCKED**                                                                                                                                  | Body hash changes → signature fails. The realm value is part of the signed body. The verifier additionally refuses on step 18 even before signature check, as a structural lock.                                                                                                                         |
| **Expiry attacker**                        | Stores a valid PoI score and tries to mint a ledger entry against it days or weeks later.                                            | **BLOCKED with proper expires_at_iso**                                                                                                       | Verifier checks `now() > poi_score.expires_at_iso` and rejects. The default window is 5 minutes; configurable per `task_type` but always finite.                                                                                                                                                         |
| **Rule-code-drift attacker**               | Operator (intentionally or accidentally) edits the scoring rule source file between when a score was minted and when it is verified. | **BLOCKED**                                                                                                                                  | Step 7 re-hashes the rule code and compares to `task_scope.rule_code_hash`. Any edit → `REJECTED:poi_rule_code_drift`. Score must be re-minted under the new rule code with new consent.                                                                                                                 |
| **Input-log forgery attacker**             | Crafts a fake verifier log whose counts produce a high score; signs the resulting PoI envelope.                                      | **BLOCKED with grounded re-derivation**                                                                                                      | Step 9 re-runs the deterministic scoring function over the supplied input log. Counts must equal what the operator declared. But: the log itself must also be a real verifier log from KEYCONSENT-1A — log provenance is enforced by the consent-proof binding (step 6) and the rule-code hash (step 7). |
| **Disk-access attacker with operator key** | Has read access to `$DEMA_HOME/keys/node0-ed25519.pem`.                                                                              | **NOT BLOCKED — out of scope.**                                                                                                              | Same posture as KEYCONSENT-1A: software-only consent / scoring cannot defeat a compromised key. ECON-1A raises the bar to "key possession at moment of scoring," but not beyond. Mitigation is operator-side.                                                                                            |
| **Cross-machine ledger merge**             | Steals a ledger entry chain from Node A and tries to splice it into Node B's chain.                                                  | **NOT BLOCKED — out of scope.** Bound only by chain continuity + realm lock + signature. Cross-machine merge protection is federation-class. |

## 8. Replay protection

Three layers, increasing in cost:

1. **Scope binding** (cheap, fundamental): every PoI score carries `task_scope.rule_code_hash` and `task_scope.input_log_hash`; every ledger entry carries `action_receipt_hash`, `consent_proof_hash`, and `poi_score_hash`. Re-using any of these for a different target / log / action / consent / score fails immediately at the corresponding step. **In ECON-1A + POI-1A.**
2. **Expiration** (cheap, time-bounded): `poi_score.expires_at_iso` is set at score creation (default: created_at + 5 minutes; configurable per `task_type`). Verifier uses its own clock. Mint refuses to consume an expired score. **In ECON-1A + POI-1A.**
3. **Single-use nonce registry** (more cost, optional): `$DEMA_HOME/economy/used-score-nonces.json` records consumed PoI score nonces and consumed ledger entry IDs; the mint gate refuses to re-accept a nonce / entry ID. **DEFERRED to ECON-2.** Required for production use cases where score windows must be larger than a few minutes but single-use semantics are required.

The default posture for ECON-1A + POI-1A is layers 1 + 2 only. Layer 3 is a separate slice.

## 9. DOD for ECON-1A (pure dual-token ledger kernel slice)

Exit criteria for the IMMEDIATELY-FOLLOWING implementation slice (NOT this preflight):

- [ ] `packages/receipts/src/dual-token-ledger.js` exports pure functions:
  - `buildLedgerEntry({actionReceiptHash, consentProof, poiScore, resourceComponents, impactComponents, priorEntryHash, demaHome, createdAtIso?})` — fail-closed when any of `actionReceiptHash`, `consentProof`, `poiScore` are missing or malformed, when `consentProof.consent_proof_hash != poiScore.consent_proof_hash`, when `resourceComponents` produces a positive `delta`, when `impactComponents` produces a negative `delta`, when `priorEntryHash` is malformed, or when no signing key is found. Otherwise loads the key, signs the body, returns a frozen envelope per §3.2.
  - `verifyLedgerEntry({entry, pubkeyPem, priorEntry?, expectedRealm?, now?})` — performs §5 steps 12–20 (signature, action binding, consent binding, score binding, resource-rule-code hash, impact-multiplier code hash, realm lock, chain continuity, sign discipline). Returns either `{verified: true, ...}` or `{verified: false, reason: "<first failing reason>"}`.
  - `replayLedgerChain({entries, pubkeyPem, expectedRealm?})` — walks the chain, calling `verifyLedgerEntry` on each entry with the previous entry as `priorEntry`. Returns `{verified: true, count}` or `{verified: false, index, reason}`.
- [ ] All Ed25519 + sha256 + stableStringify primitives REUSED from existing modules (`packages/receipts/src/sign.js`, `packages/receipts/src/verify.js`, `packages/receipts/src/sha256.js`, `packages/receipts/src/stable-stringify.js` or whatever the established import paths are at slice time) — no duplication.
- [ ] The KEYCONSENT-1A consent proof envelope is the GATE for any mint; `buildLedgerEntry` refuses without a verified consent proof whose `consent_proof_hash` matches the supplied PoI score's `consent_proof_hash`.
- [ ] Tests (`tests/dual-token-ledger.test.js`):
  - happy path: build then verify (with matching external pubkey, matching prior entry) → `verified: true`.
  - missing consent proof: `consent_required`.
  - consent / score mismatch: `consent_score_mismatch`.
  - tampered entry body: `entry_signature_invalid`.
  - wrong external pubkey: `entry_signature_invalid`.
  - realm tampered to non-`"local-only"`: `realm_drift`.
  - prior-entry-hash mismatch (chain split): `chain_discontinuity`.
  - resource delta positive: `token_sign_invalid`.
  - impact delta negative: `token_sign_invalid`.
  - replay across full chain (3 entries, 2nd tampered): `replayLedgerChain` returns `{verified: false, index: 1, reason: "..."}`.
  - deterministic when nonce + createdAtIso + componentInputs are injected: two calls deep-equal.
- [ ] Tests run inside `tests/*.test.js`; full suite stays green; smoke 42/42 stays green.
- [ ] Does NOT yet integrate with `attestVerdict`, `signArtifact`, or `urp choose` — that integration is **ECON-1B**, a follow-up slice gated on ECON-1A + POI-1A remote-CI-verified.

## 10. DOD for POI-1A (pure deterministic scoring rule slice)

Exit criteria for the IMMEDIATELY-FOLLOWING scoring slice (NOT this preflight):

- [ ] `packages/receipts/src/poi-score.js` exports pure functions:
  - `buildPoiScore({taskType, ruleId, ruleCodeHash, inputLog, consentProof, demaHome, nonce?, createdAtIso?, expiresAtIso?})` — supports exactly one `taskType` in v0.1: `"consent_proof_replay_verification"`. Fail-closed when `taskType` is anything else, when `ruleCodeHash` does not equal the verifier-side re-hash of the public rule source, when `inputLog` is missing or malformed, when `consentProof` is missing, or when no signing key is found. Otherwise runs the deterministic scoring function, signs the body, returns a frozen envelope per §3.1.
  - `verifyPoiScore({poiScore, pubkeyPem, inputLog, ruleCodeHash, expectedConsentProofHash?, now?})` — performs §5 steps 3–10 (structural, signature, score binding, consent binding, rule code hash, input log hash, score re-derivation, freshness). Returns `{verified: true, ...}` or `{verified: false, reason: "<first failing reason>"}`.
  - `scoreConsentProofReplayVerification(inputLog)` — the deterministic scoring function. Pure. Takes a verifier log structured as an array of `{verified: bool, reason?: string}` entries (the natural output shape of KEYCONSENT-1A `verifyConsentProof`). Returns `{numerator, denominator, rejected_breakdown}`. No randomness, no clock reads, no I/O.
- [ ] All Ed25519 + sha256 + stableStringify primitives REUSED from existing modules — no duplication.
- [ ] Tests (`tests/poi-score.test.js`):
  - happy path: build then verify with matching external pubkey, matching rule code hash, matching input log → `verified: true`.
  - unsupported task type: `task_type_unsupported`.
  - rule code hash mismatch: `poi_rule_code_drift`.
  - input log hash mismatch (verifier supplied different log than the one scored): `poi_input_log_mismatch`.
  - tampered score body: `poi_signature_invalid`.
  - wrong external pubkey: `poi_signature_invalid`.
  - expected consent proof hash differs: `poi_consent_mismatch`.
  - expired score: `poi_score_expired` (with injected `now()`).
  - score-not-reproducible (operator declared `numerator: 5` but log only contains 3 verified): `poi_score_not_reproducible`.
  - deterministic when nonce + createdAtIso are injected: two calls deep-equal.
- [ ] Tests run inside `tests/*.test.js`; full suite stays green; smoke 42/42 stays green.

## 11. Boundary

This preflight document is text-only. Its boundary block:

```json
{
  "runtime_code_changed": false,
  "private_key_exported": false,
  "network_used": false,
  "federation_used": false,
  "token_minted": false,
  "public_economic_claim_made": false,
  "new_settlement_system_live": false,
  "exchange_value_claimed": false
}
```

ECON-1A, POI-1A, ECON-1B, and ECON-2 will each carry their own boundary blocks and tighter scope statements.

## 12. What this preflight does NOT do

- Does NOT change any existing receipt, consent gate, URP, or signing behavior.
- Does NOT introduce any new schema into a running envelope.
- Does NOT modify the operator's `~/.dema/` directory.
- Does NOT mint a token, credit a token, debit a token, or write a ledger entry.
- Does NOT compute, declare, sign, or publish any PoI score.
- Does NOT make a public economic claim of any kind. The dual-token model described here has no public meaning, no exchange value, no guaranteed reward, no market claim, no public mint, and no settlement realm beyond `"local-only"`.
- Does NOT bind the operator, the reader, or any third party to a financial position.
- Does NOT promise a specific implementation timeline for ECON-1A, POI-1A, ECON-1B, or ECON-2.
- Does NOT close the operator-PDF Section 9 checklist; that closure requires ECON-1A + POI-1A + ECON-1B shipped and remote-CI-verified, with the ledger-replay verifier proven green against a real local action.

## 13. What unlocks next

After this preflight is committed and remote-CI verified, **ECON-1A** (the pure dual-token ledger kernel) and **POI-1A** (the pure deterministic scoring rule for `consent_proof_replay_verification`) can begin in parallel — they have no code-level dependency on each other (POI-1A produces an envelope; ECON-1A consumes one; either can be tested independently with a fixture envelope of the other).

After ECON-1A and POI-1A are sealed and remote-CI verified, **ECON-1B** can integrate the mint gate into one real action path (provisionally: `dema urp choose`, which already carries a KEYCONSENT-1B consent proof per the URP-4 family). At that point, one verified local action can produce a PoI score and update a local-only replayable ledger without claiming public economic value — the operator-PDF Section 9 DOD.

After ECON-1A + 1B + POI-1A + ECON-2 are all sealed and remote-CI verified, the operator-PDF Section 9 checklist is closed, and the canon glossary entry for "Proof-of-Impact economy" can be promoted from DECLARED to MEASURED with cited test names as evidence — bound by Section 22's three laws:

> If it cannot be consented, it cannot mutate.
> If it cannot be verified, it cannot reward.
> If it cannot be replayed, it cannot enter the ledger.
