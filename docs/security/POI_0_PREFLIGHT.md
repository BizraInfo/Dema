# POI-0 · Proof-of-Impact Scoring Preflight

**Status:** preflight design only; no runtime code; no key export; no integration with existing receipts yet; no public economic claim; no reward distribution.
**Sparse point:** after ECON-0 PoI economy preflight (this commit's sibling) and after KEYCONSENT-1B verdict-attest integration.
**Pair-doc (future):** `POI_CLOSEOUT.md` (after POI-1A + POI-1B are sealed).
**Date:** 2026-05-30 (Dubai · GST)

## 1. Current weakness

There is no Proof-of-Impact (PoI) scoring rule in the repo. When the operator or an agent does work that touches a receipt (signs an authorship-receipt, attests a verdict, chooses a URP entry, replays a consent proof), the **value** of that work — whether it should be rewarded, weighted, counted, or trusted — is currently **asserted**, not **derived**.

The exact gap: a stranger holding the operator's pubkey, the action bundle, and this repo's rule code cannot today re-compute "how much impact did this action represent?" from `(input + rule code)`. There is no scoring function. There is no scoring envelope. There is no hash binding from a score to the receipts it claims to summarize.

This means every current and future statement of the form "this work earned X" is presently a **claim** — not a fact a third party can replay from disk. PDF Section 22 names the law this violates:

> If it cannot be verified, it cannot reward.
> If it cannot be replayed, it cannot enter the ledger.
> If it cannot be traced to proof, it cannot become XP.

POI-0 is the preflight for the slice that closes the verifiability side of that gap. The economic-binding side is ECON-0 / ECON-1A's responsibility; POI-0 covers the scoring rule, the score envelope, and the replay path. Both must seal before anything described as "reward" can be claimed as proof-backed.

## 2. Target

Turn "useful work happened" from a **claim** into a **deterministic, re-derivable score** that a stranger with the input bundle, the operator's pubkey, and this repo's rule code can recompute byte-for-byte and verify against a signed envelope.

Mechanism (in one line): _impact is no longer an assertion; impact is a signed, scoped envelope whose `computed_score` is the bit-identical output of running a named pure scoring rule over a named input artifact, with both rule_id and input_artifact_hash bound into the envelope._

The score envelope is a witness, not a marketing surface. It says: "this rule, applied to this input, produced this score, and the operator signed that this is what they ran." A stranger re-runs the rule and gets the same number, or the envelope is rejected.

## 3. Scoring envelope schema

Proposed schema for the PoI score artifact:

```text
schema:                              "bizra.dema.poi_score.v0.1"
scoring_rule_id:                     "<exact rule identifier, e.g., 'consent_proof_replay_verification.v0.1'>"
input_artifact_hash:                 "<sha256 hex of stableStringify(canonical input array/object the rule consumes)>"
computed_score:                      <numeric, typically in [0,1]; rule-defined range>
computed_components: {
  "<named_component_1>":             <numeric contribution>,
  "<named_component_2>":             <numeric contribution>,
  ...
}
evidence_receipts: [
  "<sha256 hex of receipt body 1>",
  "<sha256 hex of receipt body 2>",
  ...
]
prev_hash:                           "<sha256 of the prior poi_score envelope in this operator's chain, or zeros for genesis>"
created_at_iso:                      "<ISO-8601 UTC timestamp; CLAIM, not verified>"
operator_public_key_fingerprint:     "<sha256 hex of the operator's Ed25519 pubkey, DER form>"
consent_proof_hash:                  "<sha256 of the consent proof body authorizing SCORE_POI on this input_artifact_hash>"
poi_signature_b64:                   "<Ed25519 signature over stableStringify(body without poi_signature_b64 and poi_score_hash), base64>"
poi_score_hash:                      "<sha256 of stableStringify(body excluding poi_signature_b64 and poi_score_hash)>"
```

The `body` for signing/hashing is the envelope **without** `poi_signature_b64` and **without** `poi_score_hash` — same separation pattern as URP-3.1A local index, URP-4.1A choose decision, the verdict-receipt body, and the KEYCONSENT-1A consent proof. The signature commits to all other fields; the hash is the content address.

Three derived properties matter:

1. **Rule binding**: `scoring_rule_id` names exactly which pure function produced the score. A stranger looks the id up in this repo, runs it on the supplied input, and must match.
2. **Input binding**: `input_artifact_hash` ties the score to one specific input. Substituting a different input → mismatch.
3. **Component-sum invariant**: the rule's specification states whether `sum(computed_components.values()) == computed_score` exactly, modulo a documented combinator. For POI-1A's `consent_proof_replay_verification.v0.1`, components are `{verified_count, attempted_count}` and the score is `verified_count / attempted_count` clamped to `[0, 1]` — so the components do not literally sum to the score, but the score is a deterministic pure function of the components.

## 4. How action receipts reference `poi_score_hash`

Existing and future action receipts that **earn impact** gain ONE new optional field:

```text
poi_score_hash:  "<sha256 of the poi_score envelope body>"
```

This is a **hash reference**, not an inclusion. The full PoI score envelope ships in the **bundle** alongside the action body (same pattern as `bundle.input` carrying the input alongside the verdict body, and `bundle.consent_proof` carrying the consent proof).

Updated bundle shape (proposed, for receipts that earn impact):

```text
{
  body:                  <action body, including poi_score_hash if scored>,
  signature_b64:         <action signature>,
  signer_public_key_pem: <action signer's pubkey; verifier still ignores this for trust>,
  input:                 <action's input, for replay>,
  consent_proof:         <the full consent proof envelope>,
  poi_score:             <the full poi_score envelope from §3, optional>
}
```

Action body commits to `poi_score_hash`; bundle ships the full envelope. The score envelope is portable: it can travel alongside the action bundle, or stand alone as a `bizra.dema.poi_score.v0.1` artifact whose audit story is self-contained.

A receipt with no `poi_score_hash` is simply unscored — explicit absence, not silent zero. Unscored work does not enter any reward path.

## 5. Verification flow

A stranger with (poi_score envelope) + (input artifact) + (this repo's rule code) + (operator's pubkey supplied SEPARATELY via `--pubkey`) + (consent proof envelope) verifies in this order:

1. **Signature over body** — verify `poi_signature_b64` over `stableStringify(body without poi_signature_b64 and poi_score_hash)` using external `--pubkey`. The embedded `operator_public_key_fingerprint` is a CLAIM; trust comes only from the externally supplied pubkey. On failure → `REJECTED:poi_signature_invalid`.
2. **Input artifact hash** — `sha256(stableStringify(supplied_input)) == body.input_artifact_hash`. On mismatch → `REJECTED:poi_input_hash_mismatch`.
3. **Rule re-run** — look up `body.scoring_rule_id` in this repo's rule registry; execute that pure function over the supplied input; assert `result.score === body.computed_score` and `deepEqual(result.components, body.computed_components)`. On mismatch → `REJECTED:poi_rule_replay_mismatch`. On unknown rule id → `REJECTED:poi_rule_id_unknown`.
4. **Evidence receipts present** — for each entry in `body.evidence_receipts`, the bundle (or the supplied evidence set) must contain a receipt whose body hashes to that value. Missing receipt → `REJECTED:poi_evidence_missing`. Wrong content → `REJECTED:poi_evidence_hash_mismatch`.
5. **Consent binding** — `sha256(stableStringify(consent_proof body excluding sig + proof_hash)) == body.consent_proof_hash`, and `consent_proof.action_scope.action_type == "SCORE_POI"`, and `consent_proof.action_scope.target_hash == body.input_artifact_hash`. On any mismatch → `REJECTED:poi_consent_mismatch`. Consent freshness + signature are checked by the existing KEYCONSENT-1A verifier; this slice does not duplicate that work.

If steps 1–5 all pass → `VERIFIED`. The score is now grounded, rule-replayed, evidence-bound, and consent-bound.

## 6. Non-goals

This slice (POI-0) and the immediately-following implementation slice (POI-1A) DO NOT:

- Make any **public economic claim** about value, price, market cap, or worth.
- Mint, issue, transfer, burn, or stake any **token**.
- Distribute, accrue, or pay out any **reward** to any party.
- Open a **marketplace**, exchange, AMM, order book, or trading surface.
- Assign any **fiat value** (USD, EUR, AED, etc.) to any score.
- Emit a public **leaderboard**, rank list, or comparative table.
- Produce a **comparative ranking** between operators, agents, or sessions.
- Pay **agent compensation** of any form (LLM credits, cycles, API budget).
- Pay **human compensation** of any form (payroll, bounty, honorarium).
- Claim **Shariah certification** of the scoring rule (separate review pathway).
- Replace any existing trust mechanism (consent, signing, verification) — PoI sits ON TOP of those gates, not in place of them.

## 7. Threat model

| Attacker                              | Capability                                                                                                                                                                                        | POI-1A status                        | Why                                                                                                                                                                                                                                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Replay attacker**                   | Holds a valid old `poi_score` envelope; submits it as evidence that NEW work earned impact.                                                                                                       | **BLOCKED**                          | `input_artifact_hash` and `consent_proof.action_scope.target_hash` both pin the score to ONE specific input. The old envelope cannot be re-used for a new input — verifier step 2 + step 5 reject.                                                                                             |
| **Input substitution attacker**       | Supplies a different input alongside a valid envelope, hoping the verifier will trust the envelope's signature and skip the input check.                                                          | **BLOCKED**                          | Verifier step 2 recomputes `sha256(stableStringify(supplied_input))` and compares to `body.input_artifact_hash`. Substituted input → mismatch → reject.                                                                                                                                        |
| **Rule-substitution attacker**        | Claims `scoring_rule_id = "consent_proof_replay_verification.v0.1"` in the envelope but actually ran a different (more generous) function locally.                                                | **BLOCKED**                          | Verifier step 3 re-runs the rule identified by `scoring_rule_id` against the supplied input and checks bit-equality of `computed_score` AND `computed_components`. Substituted rule output → mismatch → reject.                                                                                |
| **Foreign-key-signed score**          | Generates a `poi_score` envelope signed by an attacker's own key; sets `operator_public_key_fingerprint` to the operator's, hoping the verifier trusts the embedded claim.                        | **BLOCKED**                          | Verifier step 1 uses ONLY the externally-supplied `--pubkey`. The embedded fingerprint is a CLAIM. Wrong signing key → signature_invalid → reject. Same invariant as verdict-receipt REJECT-4 and KEYCONSENT-1A.                                                                               |
| **Stale-consent replayer**            | Reuses an old `SCORE_POI` consent proof against a new input.                                                                                                                                      | **BLOCKED**                          | `consent_proof.action_scope.target_hash == body.input_artifact_hash` (verifier step 5) plus the existing KEYCONSENT-1A `expires_at_iso` freshness check. Stale-consent fails on scope OR on freshness.                                                                                         |
| **Rule-version drift attacker**       | Operator signs a score under `scoring_rule_id = "consent_proof_replay_verification.v0.1"`; later, the repo's rule code at that id changes silently; verifier re-runs and gets a different number. | **BLOCKED by versioning discipline** | The rule id carries a `vX.Y` suffix. A change in rule behavior REQUIRES a new id (e.g., `v0.2`). Old envelopes continue to verify against the old rule code, which remains in the repo. Silent edits to a versioned rule are caught by the test suite and by remote CI replay of fixed inputs. |
| **Score inflation via fake evidence** | Supplies fabricated receipts in `evidence_receipts` to make `verified_count` look higher.                                                                                                         | **BLOCKED at the evidence layer**    | Each evidence receipt is itself a signed bundle that must pass its own verification (signature, consent, scope). The PoI rule only counts receipts that the underlying verifier accepts. Forging a receipt requires the operator's key — the threat collapses into the disk-access threat row. |
| **Disk-access attacker with op key**  | Has read access to `$DEMA_HOME/keys/node0-ed25519.pem`.                                                                                                                                           | **NOT BLOCKED — out of scope.**      | If the attacker has the private key, they can mint any envelope they want. PoI sits on top of consent + signing; it does not protect against a compromised key. Mitigation is operator-side (filesystem ACLs, future KEYCONSENT-2 nonce registry).                                             |
| **Cross-machine replay**              | Steals envelope from Node 1 and submits on Node 2.                                                                                                                                                | **OUT OF SCOPE this slice.**         | Bound only by scope + consent expiration. Cross-machine PoI replay protection requires a public registry (federation-class concern). Not in POI-1A.                                                                                                                                            |

## 8. Determinism boundary

A POI-1A-class scoring rule is a **pure function** of its named input. Explicit list of what such a rule **MAY** and **MUST NOT** do:

**MAY:**

- Pure arithmetic on numbers extracted from the input.
- Counting, summing, ratio, min/max, clamp, deep-equality, hash comparison.
- Boolean checks on field values present in the input (e.g., "verified == true").
- Lookups into a constant table baked into the rule module at the rule's version.
- Recursive descent over the input's already-parsed JSON structure.

**MUST NOT:**

- Call any model (LLM, classifier, embedding service, prompt-based scorer).
- Read the current time (`Date.now`, `new Date()`, `performance.now`, system clock).
- Read randomness (`Math.random`, `crypto.randomBytes` for non-derivable values).
- Open any network socket, fetch, HTTP, DNS, IPC, or peer connection.
- Read any filesystem path not already baked into the rule module's source.
- Read environment variables, process arguments, or any ambient state.
- Mutate any input, any global, or any module-scoped variable across calls.
- Throw on valid input (errors must be returned as scored components, e.g., `{verified: 0, attempted: N}`).

The discipline is identical to `packages/rules/src/rule-canonical-shape.v0.1.js` — same purity contract. A rule that violates this list is, by definition, not a POI-1A-eligible rule and cannot register a `scoring_rule_id` against this preflight.

A test in POI-1A's test set asserts the rule is deterministic by running it twice on the same input and asserting deep-equality of outputs.

## 9. DOD for POI-1A (one deterministic scoring rule slice)

Exit criteria for the IMMEDIATELY-FOLLOWING implementation slice (NOT this preflight). The v0.1 scoring rule is **`consent_proof_replay_verification.v0.1`**: input is an array of consent-proof bundles; the rule replays each via `verifyConsentProof`; the score is `count(verified) / count(attempted)` clamped to `[0, 1]`; if `attempted == 0`, the score is `0` and the rule returns `{verified_count: 0, attempted_count: 0}` (explicit zero, not divide-by-zero).

- [ ] `packages/rules/src/rule-consent-proof-replay.v0.1.js` exports two pure functions: `scoreConsentProofReplay({input})` returning `{score, components: {verified_count, attempted_count}}`; `RULE_ID === "consent_proof_replay_verification.v0.1"`. No I/O, no `Date.now`, no `Math.random`, no model calls, no network.
- [ ] `packages/receipts/src/poi-score.js` exports pure functions: `buildPoiScore({ruleId, input, evidenceReceipts, prevHash, consentProof, demaHome, createdAtIso?})` (fail-closed when rule id is unknown, input is missing, or no signing key is found; loads key, runs the rule, builds the envelope per §3, signs body, returns a frozen envelope); `verifyPoiScore({poiScore, input, pubkeyPem, consentProof, evidenceBundle?})` (performs §5 steps 1–5; returns `{verified: true, ...}` or `{verified: false, reason: "<first failing reason>"}`).
- [ ] All Ed25519 + sha256 + stableStringify + signPayload + verifyPayload primitives REUSED from existing modules (`packages/receipts/src/sha256.js`, `packages/receipts/src/stable-stringify.js`, `packages/receipts/src/ed25519.js`, KEYCONSENT-1A's `consent-proof.js`) — no duplication.
- [ ] The KEYCONSENT-1A consent proof envelope is the consent gate for scoring. `action_scope.action_type` MUST equal `"SCORE_POI"` and `action_scope.target_hash` MUST equal `input_artifact_hash`. Verifier rejects any other combination.
- [ ] Tests (`tests/poi-score.test.js`): (a) happy path — build then verify with matching external pubkey → `verified: true`, score equals hand-computed ratio; (b) determinism — two calls with the same input + injected `createdAtIso` deep-equal; (c) rule replay catch — mutate `computed_score` in the envelope → `poi_rule_replay_mismatch`; (d) input substitution — supply different input → `poi_input_hash_mismatch`; (e) foreign-key sign — verify with wrong external pubkey → `poi_signature_invalid`; (f) unknown rule id → `poi_rule_id_unknown`; (g) consent scope mismatch — consent's `target_hash` differs → `poi_consent_mismatch`; (h) consent action_type ≠ `SCORE_POI` → `poi_consent_mismatch`; (i) empty input array → `score = 0`, `components = {verified_count: 0, attempted_count: 0}`, NOT a divide-by-zero error.
- [ ] Tests run inside `tests/*.test.js`; full suite stays green; smoke 42/42 stays green.
- [ ] Does NOT yet integrate with `attestVerdict`, `signArtifact`, `urp choose`, or any existing receipt — that integration is **POI-1C** (scored-receipt embedding), gated on POI-1A + POI-1B remote-CI verified.
- [ ] Does NOT yet add any CLI surface — `dema poi score ...` is POI-1D, gated on POI-1C.
- [ ] No public economic statement appears in any test name, any test fixture, any rule comment, any commit body. The slice ships as pure verifiability, not as reward.

## 10. DOD for POI-1B (multi-rule registry, future)

Out of scope for POI-0 and POI-1A; mentioned only to anchor the trajectory and prevent design lock-in by the first rule. Exit criteria for the eventual multi-rule slice:

- [ ] `packages/rules/src/poi-rule-registry.js` exports a frozen map `{[ruleId]: ruleFunction}` populated at module load by static imports — no dynamic import, no runtime mutation.
- [ ] At least two distinct rules are registered (e.g., `consent_proof_replay_verification.v0.1` plus one more), each passing the §8 determinism boundary.
- [ ] `verifyPoiScore` resolves `scoring_rule_id` through the registry; unknown id → `poi_rule_id_unknown` (same reason as POI-1A).
- [ ] A test asserts every registered rule is deterministic by running each against a fixed fixture twice and asserting deep-equality.
- [ ] Adding a new rule is purely additive — it does not change the output of any existing rule on any existing input (regression test set replays fixed envelopes from prior slices).

POI-1B is scaffolding for a portfolio of scoring rules, not a feature in itself. It ships when the second rule actually exists.

## 11. Boundary

This preflight document is text-only. Its boundary block:

```json
{
  "runtime_code_changed": false,
  "private_key_exported": false,
  "network_used": false,
  "federation_used": false,
  "token_minted": false,
  "public_score_claimed": false,
  "leaderboard_emitted": false,
  "agent_compensation_paid": false
}
```

POI-1A, POI-1B, POI-1C, and POI-1D will each carry their own boundary blocks and tighter scope statements.

## 12. What this preflight does NOT do

- Does NOT change any existing receipt behavior, signing path, consent gate, or verifier.
- Does NOT introduce any new schema into a running envelope.
- Does NOT modify the operator's `~/.dema/` directory.
- Does NOT register any scoring rule in any runtime module.
- Does NOT emit any score, hash, or signature.
- Does NOT make a claim that PoI is now live (it is not — this is a design doc, not a shipped feature).
- Does NOT promise a specific implementation timeline for POI-1A onward.
- Does NOT make any public economic claim, any token claim, or any reward claim. PoI without ECON is verifiability only; ECON without PoI is unbacked accounting. Both must seal.
- Does NOT close the audit gap that there is no proof-backed reward; closure requires POI-1A + ECON-1A both sealed and both remote-CI verified.
- Does NOT supersede or modify the PDF Section 9 PoI Economy Checklist; this preflight is the design artifact for the `[] POI-0` line item on that checklist.

## 13. What unlocks next

After this preflight is committed and remote-CI verified, **POI-1A** (the pure scoring-rule kernel for `consent_proof_replay_verification.v0.1`) can begin. After POI-1A + POI-1B + POI-1C + POI-1D and ECON-1A are all sealed and remote-CI verified, the PoI Economy Checklist items `[] POI-0` and `[] POI-1A` close, and the canon glossary entry for "impact" can be promoted from DECLARED to MEASURED with cited test names as evidence. Only at that point may a receipt's `poi_score_hash` be cited as proof-backed; until then, every reference to "earned impact" remains a CLAIM, per PDF Section 22.
