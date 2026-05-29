# BLOCK0-0 · Genesis Block0 Snapshot Preflight

**Status:** preflight design only; no runtime code; no key export; no public network launch; no federation; no token mint; no public market claim; no certification
**Sparse point:** After KEYCONSENT-1A pure kernel sealed (`89ad00b`) and after the receipt trust 3-tier hierarchy canon entry (2026-05-29)
**Pair-doc (future):** `BLOCK0_CLOSEOUT.md` (after BLOCK0-1A + 1B + 1C all sealed AND all 12 prerequisites from PDF §18 sealed)
**Date:** 2026-05-30 (Dubai · GST)

## 1. Current weakness

Node0 today has a verified receipt chain (`packages/receipts/src/`), Level B externally-verifiable attestations (verdict receipts, urp-choose receipts, authorship receipts), KEYCONSENT-1A consent-proof kernel sealed (`89ad00b`), Dema Realm surfaces, PAT/SAT profiles wired, URP resource ladder through Stage 4, a Genesis-local token ledger sketch, a PoI rule scaffold, and one operator-attested full-flywheel-run trace. Each artifact verifies under its own rules.

**What is missing**: there is no canonical, signed envelope that says "this is the complete origin state of a sovereign local ecosystem seed at moment T, and these are the exact proof_hashes of every sealed component." Without that envelope:

- Future Node1/Node2 instances cannot trustlessly cite their genesis state — they can cite individual receipts, but not the bounded set that defines "Node0 origin."
- A stranger auditing Dema cannot ask "what was sealed at Block0?" and get a single answer; they must reconstruct the answer from N independent receipts.
- Per PDF §21 ("Public launch blocked until: Block0 sealed, legal/economic review, security review, PoI replay verification, public docs, and no overclaims"), public-alpha is procedurally blocked. There is no proof object to point at when asked "show me the minimum-public-safe-state."
- Per PDF §22 ("If it cannot be bounded, it cannot be launched"), without Block0 the system's claim surface cannot be bounded; every artifact lives in an open set.

This is acknowledged in PDF §18:

> Block0 is not the public network launch. Block0 is the signed proof-of-origin snapshot of Node0.

BLOCK0-0 is the preflight for the slice that closes that gap.

## 2. Target

One signed manifest — **Block0** — that references, by `proof_hash`, every sealed component of Node0 and ships those components as a bundle. A stranger with the operator's external pubkey can verify:

1. The manifest was signed by the operator at a specific moment.
2. Every referenced sub-receipt resolves to a real, verifiable receipt in the shipped bundle.
3. The full-flywheel-run receipt (PDF §19) confirms one complete end-to-end pass.
4. The explicit `claim_boundary` block bounds what Block0 does NOT claim.

Mechanism (in one line): _Block0 is the master Level A provenance receipt; it does not promote its sub-receipts, it freezes the set of them that defines "Node0 origin."_

The set referenced by Block0 must include, at minimum:

- KEYCONSENT integration status (proof that consent-proof kernel is sealed and integrated where required).
- Canonical receipt ledger root hash (the Merkle/hash-chain root over all sealed receipts at T).
- Node0 identity proof (the operator's pubkey-fingerprint binding).
- Dema Realm state proof (live surfaces, glossary, schema state).
- PAT profile proof hashes (7 PAT profiles per PDF §13).
- SAT profile proof hashes (5 SAT profiles per PDF §14).
- URP resource status proof (Stage 1–4 ladder state).
- Genesis-local token ledger root hash (local-only; no public market value).
- PoI rule version + rule_id.
- One full-flywheel-run receipt hash (FLYWHEEL-1A pass per PDF §19).
- Performance baseline proof hash.
- House of Wisdom first verified lesson proof hash.
- The explicit `claim_boundary` block (§6).

## 3. Block0 envelope schema

Proposed schema for the Block0 genesis snapshot:

```text
schema:                              "bizra.dema.block0_genesis_snapshot.v0.1"
block0_id:                           "<stable id; e.g., block0-2026-05-30-<short-fingerprint>>"
genesis_node_id:                     "<Node0 identity; sha256 hex of node0 identity body>"
genesis_human_id:                    "<operator's pubkey fingerprint; sha256 hex of operator Ed25519 pubkey DER>"
keyconsent_integration_complete:     <bool>
keyconsent_truth_labels:             ["<truth-label string>", ...]   // e.g., ["MEASURED:kernel", "WIRED:integration"]
canonical_receipt_ledger_root_hash:  "<sha256 hex; root over all sealed receipts at T>"
node0_identity_proof_hash:           "<sha256 hex of the Node0 identity receipt body>"
dema_realm_state_proof_hash:         "<sha256 hex of the Dema Realm state receipt body>"
pat_profile_proof_hashes:            ["<sha256 hex>", ... x7]
sat_profile_proof_hashes:            ["<sha256 hex>", ... x5]
urp_resource_status_proof_hash:      "<sha256 hex of the URP resource-status receipt body>"
genesis_local_token_ledger_root_hash:"<sha256 hex; root over local token ledger at T>"
poi_rule_version:                    "<semver string; e.g., 0.1.0>"
poi_rule_id:                         "<rule id string>"
full_flywheel_run_receipt_hash:      "<sha256 hex of the FLYWHEEL-1A pass receipt; PDF §19>"
performance_baseline_proof_hash:     "<sha256 hex of the performance baseline receipt body>"
house_of_wisdom_first_lesson_proof_hash: "<sha256 hex of the first verified lesson receipt body>"
claim_boundary: {                                  // explicit absence-of-overclaim declarations
  "public_network_launched":         false,
  "federation_used":                 false,
  "public_market_value_claimed":     false,
  "tokens_issued_to_third_parties":  false,
  "legal_certification_claimed":     false,
  "shariah_certification_claimed":   false,
  "node1_enabled":                   false,
  "a2a_enabled":                     false,
  "telescript_public_mode":          false
}
prev_hash:                           null                       // null for the FIRST Block0; otherwise prior block0_proof_hash
created_at_iso:                      "<ISO-8601 UTC timestamp>"
operator_public_key_fingerprint:     "<sha256 hex of operator Ed25519 pubkey DER>"
block0_signature_b64:                "<Ed25519 sig over stableStringify(body w/o sig + proof_hash), base64>"
block0_proof_hash:                   "<sha256 of stableStringify(body excluding block0_signature_b64 and block0_proof_hash)>"
```

The `body` for signing/hashing is the envelope **without** `block0_signature_b64` and **without** `block0_proof_hash` — same separation pattern as URP-3.1A local index, URP-4.1A choose decision, the verdict-receipt body, and the KEYCONSENT-1A consent-proof body (re-derivable; the signature commits to all other fields, the hash is the content address).

Three derived properties matter:

1. **Origin binding**: `block0_signature_b64` was producible only by the operator at the time of signing.
2. **Set binding**: every `*_proof_hash` field commits the manifest to one specific sub-receipt. Substituting a different receipt invalidates the manifest hash.
3. **Boundary binding**: the `claim_boundary` block is signed as part of the body. Any later claim that violates a boundary field is provably an overclaim relative to Block0.

## 4. How downstream surfaces reference Block0

Every public document about Dema/Node0 — README, ARCHITECTURE.md, INDEX.md, public-launch announcements, investor decks, or any third-party citation — MUST cite `block0_proof_hash` as the canonical origin reference.

The rule is one-directional and strict:

- A surface MAY claim less than what Block0 references (it may quote a subset).
- A surface MUST NOT claim more than what Block0 references (no field outside Block0's commitments, no boundary inversion).

A public artifact that claims a property not provable from Block0's referenced sub-receipts is **automatically an overclaim** relative to Block0, regardless of intent. The verifier in §5 step (f) detects this for any artifact submitted alongside Block0.

This is the mechanism PDF §22 ("If it cannot be bounded, it cannot be launched") is operationalized by: Block0 is the bound.

## 5. Verification flow

A stranger with (Block0 bundle) + (operator's pubkey, supplied SEPARATELY via `--pubkey`) + (this repo's rule code) verifies in this order:

1. **Block0 signature** — verify `block0_signature_b64` over `stableStringify(body)` using external `--pubkey`. On failure → `REJECTED:block0_signature_invalid`.
2. **Block0 hash recomputable** — `sha256(stableStringify(body excluding signature + proof_hash)) == block0_proof_hash`. On mismatch → `REJECTED:block0_proof_hash_mismatch`.
3. **Sub-receipt resolution** — every referenced `*_proof_hash` in the Block0 body MUST resolve to a real receipt file in the shipped bundle. Block0 bundles SHIP every referenced receipt — Block0 is the seed package, not just a manifest. On any missing reference → `REJECTED:phantom_component:<field_name>`.
4. **Sub-receipt verification under its own rules** — each referenced receipt verifies under its own verification rules: `consent_proof` envelopes under KEYCONSENT verify path, verdict receipts under the verdict-receipt path, urp-choose receipts under the URP-4 path, authorship receipts under the authorship-sign path, Node0 identity under the identity path, etc. On any sub-failure → `REJECTED:component_invalid:<field_name>:<inner_reason>`.
5. **Full-flywheel-run pass** — the `full_flywheel_run_receipt_hash`'s referenced receipt contains a 17-step chain (PDF §19); each step's `prev_hash` chains to the prior step's `proof_hash`, and the terminal step's `pass` field is true. On any chain break → `REJECTED:flywheel_chain_break:<step_index>`.
6. **Claim-boundary check** — every field declared `false` in `claim_boundary` MUST be false: no referenced sub-receipt may carry a property that contradicts the boundary (e.g., if `federation_used:false`, no sub-receipt may reference a federation peer). On any contradiction → `REJECTED:boundary_violated:<field_name>`.

If steps 1–6 all pass → `VERIFIED`. Block0 is now grounded, set-bound, and boundary-bound.

**Note on receipt trust taxonomy**: Block0 verifying does NOT auto-promote any single sub-receipt. A Level 0 receipt (operator-attested only) remains Level 0 even when referenced by Block0; the Block0 envelope itself is Level A (provenance-bound). Each sub-receipt still verifies under its own rules per the receipt trust 3-tier canon (2026-05-29).

## 6. Non-goals

This slice (BLOCK0-0) and the immediately-following implementation slices (BLOCK0-1A, 1B, 1C) DO NOT:

- Constitute a public network launch. Block0 is the genesis fact, not the network event.
- Claim federation. Block0 is a single-node, single-operator artifact.
- Claim public market value. The `genesis_local_token_ledger_root_hash` references LOCAL state only.
- Issue tokens to anyone. No mint, no airdrop, no distribution.
- Certify legal or Shariah compliance. Block0 carries no certification claim; certifications are separate reviews per PDF §21.
- Enable Node1. Node1 acceptance is a separate ceremony with its own gates.
- Enable A2A (agent-to-agent). A2A remains preview-only per CLAUDE.md fast invariants.
- Enable Telescript public-mode. Telescript stays in capsule-only mode.
- Sign anything on behalf of a future operator. Block0 binds to ONE operator pubkey fingerprint.
- Replace existing sub-receipt verification rules. Each sub-receipt still verifies under its own path.

Block0 is a **SIGNED PROOF-OF-ORIGIN SNAPSHOT** — the genesis fact, not the network event.

## 7. Threat model

| Attacker                          | Capability                                                                                                                         | BLOCK0-1A+1B status                    | Why                                                                                                                                                                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phantom-component attacker**    | Crafts a Block0 envelope that references a `proof_hash` for which no receipt is shipped in the bundle.                             | **BLOCKED**                            | §5 step 3 requires every referenced `*_proof_hash` to resolve to a real receipt file in the bundle. Missing → `REJECTED:phantom_component:<field_name>`.                                                        |
| **Tampered-component attacker**   | A sub-receipt referenced by Block0 was modified after Block0 was signed.                                                           | **BLOCKED**                            | §5 step 3 + 4: the modified receipt's recomputed hash will not match the `proof_hash` Block0 committed to. Detected as either phantom or under-its-own-rules invalid.                                           |
| **Foreign-key signer**            | Modifies the bundle to claim a different operator pubkey via an embedded field; signs with their own key.                          | **BLOCKED**                            | Verifier uses ONLY the externally-supplied `--pubkey`. Embedded pubkey claims are ignored. Same invariant as verdict-receipt and KEYCONSENT-1A.                                                                 |
| **Prematurely-sealed attacker**   | Operator signs Block0 before all 12 PDF §18 components are ready; some referenced sub-receipts are stubs or unverified.            | **PARTIALLY BLOCKED — closeout-gated** | §5 step 4 catches stubs that fail their own verification. But a structurally-valid-but-semantically-incomplete sub-receipt requires the PDF §18 checklist as a CI gate before BLOCK0_CLOSEOUT.md can be issued. |
| **Claim-creep attacker**          | Writes a public artifact that cites Block0 but claims a property Block0 does not reference (e.g., "federation live since Block0"). | **BLOCKED at audit time**              | §4 rule + §5 step 6: any claim outside Block0's committed set is provably an overclaim. Detected by submitting the public artifact alongside Block0 to the verifier.                                            |
| **Replay-as-Node1 attacker**      | Takes Block0 from Node0 and presents it as Node1's genesis.                                                                        | **BLOCKED**                            | `genesis_node_id` binds Block0 to Node0's identity. Reusing the envelope for Node1 fails identity-binding checks downstream; Block0 cannot be re-signed without the original operator key.                      |
| **Disk-access attacker with key** | Has read access to `$DEMA_HOME/keys/node0-ed25519.pem`.                                                                            | **NOT BLOCKED — out of scope.**        | Same baseline as KEYCONSENT-1A: software-only consent + key-binding cannot stop key compromise. Mitigation is operator-side (filesystem ACLs, future OS keychain).                                              |
| **Boundary-violation attacker**   | Crafts a Block0 with `federation_used:false` in `claim_boundary` but ships a sub-receipt that references a federation peer.        | **BLOCKED**                            | §5 step 6: every boundary field declared false must be false across all sub-receipts. Contradiction → `REJECTED:boundary_violated:<field_name>`.                                                                |

## 8. Replay protection

Block0 is **content-addressed** via `block0_proof_hash`: identical content produces identical hash. Multiple Block0 envelopes from the same operator are valid (versioning) but each must be signed and reference its `prev_hash`:

- The FIRST Block0 carries `prev_hash: null`. There is exactly one "first-of-its-kind" Block0 per Node0.
- Subsequent Block0 envelopes (Block0-v0.2, v0.3, ...) reference the prior `block0_proof_hash` via `prev_hash`. This forms a chain analogous to the receipt chain canon.
- Cross-Node replay (Node0's Block0 presented as Node1's genesis) fails the `genesis_node_id` binding plus the operator-key binding.

Three layers, same shape as KEYCONSENT-1A:

1. **Content-addressing** (cheap, fundamental): `block0_proof_hash` is the canonical address. **In BLOCK0-1A.**
2. **Operator-key binding** (cheap, identity-bounded): `operator_public_key_fingerprint` + `block0_signature_b64` bind Block0 to ONE key at the moment of signing. **In BLOCK0-1A.**
3. **Chain binding** (cheap, history-bounded): `prev_hash` chains Block0 versions, forbidding silent rewrites of history. **In BLOCK0-1A.**

Replay defense beyond these (e.g., public timestamp anchoring) is OUT OF SCOPE for BLOCK0-0 through 1C and is a federation-class concern.

## 9. DOD for BLOCK0-1A (manifest generator slice)

Exit criteria for the IMMEDIATELY-FOLLOWING implementation slice (NOT this preflight):

- [ ] `packages/receipts/src/block0-manifest.js` exports pure functions: `buildBlock0Manifest({components, claimBoundary, demaHome, createdAtIso?, prevHash?})` — fail-closed when any required component proof_hash is missing/malformed, when `claimBoundary` is missing any required field, or when no signing key is found; otherwise loads the key, signs the body, returns a frozen envelope per §3.
- [ ] All Ed25519 + sha256 + stableStringify primitives REUSED from existing modules — no duplication; no new crypto.
- [ ] KEYCONSENT-1A consent envelope REUSED with `action_type: "SEAL_BLOCK0"` and `target_hash` = the manifest body hash. No new consent kernel.
- [ ] Block0 envelope's `body` excludes `block0_signature_b64` and `block0_proof_hash` for hashing/signing — same separation pattern as URP-3.1A, URP-4.1A, verdict-receipt, KEYCONSENT-1A.
- [ ] Tests (`tests/block0-manifest.test.js`): happy path (build with all 12 component proof_hashes + claim_boundary → frozen envelope, deterministic when `createdAtIso` injected); missing component → `block0_component_missing:<field_name>`; missing claim_boundary field → `block0_boundary_incomplete:<field_name>`; no signing key → `no_authorship_key`; consent phrase absent or wrong → `consent_required`; deterministic when nonce + createdAtIso injected: two calls deep-equal.
- [ ] Tests run inside `tests/*.test.js`; full suite stays green; smoke harness stays green.
- [ ] Does NOT yet build the verifier — that is BLOCK0-1B.
- [ ] Does NOT yet render Block0 status in the Dema Realm — that is BLOCK0-1C.
- [ ] No new CLI surface this slice — `dema block0 seal ...` is BLOCK0-1D (out of scope for the 1A/1B/1C trio).

## 10. DOD for BLOCK0-1B (manifest verifier slice)

Exit criteria for the verifier slice, gated on BLOCK0-1A sealed and remote-CI verified:

- [ ] `packages/receipts/src/block0-verify.js` exports pure functions: `verifyBlock0Manifest({block0Envelope, bundle, pubkeyPem, now?})` — performs §5 steps 1–6 against the externally-supplied pubkey. Returns either `{verified: true, ...}` or `{verified: false, reason: "<first failing reason>"}`.
- [ ] Sub-receipt verification dispatches to existing verifiers (verdict, urp-choose, authorship, consent-proof, identity) — no re-implementation; the verifier composes the existing primitives.
- [ ] Tests (`tests/block0-verify.test.js`): happy path → `verified: true`; tampered Block0 body → `block0_signature_invalid`; tampered Block0 hash → `block0_proof_hash_mismatch`; phantom component → `phantom_component:<field_name>`; invalid sub-receipt → `component_invalid:<field_name>:<reason>`; broken flywheel chain → `flywheel_chain_break:<step_index>`; boundary violation → `boundary_violated:<field_name>`.
- [ ] Tests run inside `tests/*.test.js`; full suite stays green; smoke harness stays green.
- [ ] Does NOT auto-promote any sub-receipt's trust tier — each sub-receipt's tier is preserved per the receipt trust 3-tier canon.
- [ ] Does NOT enforce semantic completeness of the PDF §18 checklist — that is a CI gate before `BLOCK0_CLOSEOUT.md`.
- [ ] Does NOT issue any new CLI surface — `dema block0 verify ...` is BLOCK0-1D.

## 11. DOD for BLOCK0-1C (Dema Realm renderer slice)

Exit criteria for the Dema Realm renderer slice, gated on BLOCK0-1A + BLOCK0-1B sealed and remote-CI verified:

- [ ] A new Dema Realm surface renders Block0 status as one of: `NOT_SEALED` (no Block0 found), `SEALED_UNVERIFIED` (Block0 present but verifier not run), `SEALED_VERIFIED` (Block0 present and verifier returns `verified: true`), `SEALED_REJECTED` (Block0 present and verifier returns a reason).
- [ ] The surface displays the Block0 `block0_proof_hash` (when present), the `created_at_iso`, and the `claim_boundary` block verbatim.
- [ ] The surface NEVER claims more than `claim_boundary` permits. Any boundary field declared `false` is rendered as a struck-through / disabled chip; no "coming soon" implication.
- [ ] Tests (`tests/realm-block0-surface.test.js`): each of the four states renders correctly with deterministic snapshot output; boundary fields render verbatim from envelope.
- [ ] Tests run inside `tests/*.test.js`; full suite stays green; smoke harness stays green.

## 12. Boundary

This preflight document is text-only. Its boundary block:

```json
{
  "runtime_code_changed": false,
  "private_key_exported": false,
  "network_used": false,
  "federation_used": false,
  "public_network_launched": false,
  "public_market_value_claimed": false,
  "legal_certification_claimed": false,
  "shariah_certification_claimed": false,
  "node1_enabled": false,
  "block0_sealed": false
}
```

BLOCK0-1A, 1B, and 1C will each carry their own boundary blocks and tighter scope statements.

## 13. What this preflight does NOT do

In addition to the §6 non-goals:

- Does NOT seal Block0. `block0_sealed: false` in §12.
- Does NOT modify any runtime code. `runtime_code_changed: false`.
- Does NOT modify the operator's `~/.dema/` directory.
- Does NOT introduce any new schema into a running envelope.
- Does NOT change any existing consent gate, receipt verification path, or trust-tier promotion rule.
- Does NOT promise a specific implementation timeline for BLOCK0-1A through 1C.
- Does NOT close the PDF §18 checklist; that closure requires all 12 prerequisites sealed AND BLOCK0-1A/1B/1C remote-CI verified, with the pair-doc `BLOCK0_CLOSEOUT.md` written.
- Does NOT make a security claim that Block0 is now sealed (it is not — this is a design doc, not a shipped feature).
- Does NOT unblock public alpha. PDF §21 requires Block0 sealed AND legal/economic review AND security review AND PoI replay verification AND public docs AND no overclaims; Block0 is one of six gates.

## 14. What unlocks next

After this preflight is committed and remote-CI verified, **BLOCK0-1A (manifest generator)** can begin.

Full Block0 SEALED requires the entire PDF §18 prerequisite list complete and CI-verified:

- [ ] KEYCONSENT integrated (KEYCONSENT-1A sealed; 1B/1C still required for full integration coverage)
- [ ] Canonical receipt ledger defined
- [ ] Node0 identity sealed
- [ ] Dema Realm state sealed
- [ ] PAT/SAT profiles sealed (7 PAT + 5 SAT)
- [ ] URP resource status sealed
- [ ] Genesis-local token ledger sealed
- [ ] PoI rule sealed
- [ ] One full flywheel run sealed (FLYWHEEL-1A; PDF §19)
- [ ] Performance baseline sealed
- [ ] House of Wisdom first verified lesson sealed
- [ ] Claim boundary sealed

After all 12 prerequisites AND BLOCK0-1A + 1B + 1C all sealed and remote-CI verified, the pair-doc `BLOCK0_CLOSEOUT.md` can be written; PDF §21 gate (1 of 6) for public alpha is closed; and the canon glossary entry for "Block0" can be promoted from DESIGNED to MEASURED with cited test names and the sealed `block0_proof_hash` as evidence.

Per PDF §22: **If it cannot be bounded, it cannot be launched.** Block0 is the bound.
