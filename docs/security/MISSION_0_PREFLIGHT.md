# MISSION-0 · Mission Lifecycle Preflight

**Status:** preflight design only; no runtime code; no key export; no integration with existing receipts yet
**Sparse point:** after KEYCONSENT-1B verdict-attest gate (`b94c448`) and KEYCONSENT-1C CLI surfaces (local-complete in this session)
**Pair-doc (future):** `MISSION_CLOSEOUT.md` (after MISSION-1A + 1B + 1C + FLYWHEEL-1A are sealed)
**Date:** 2026-05-30 (Dubai · GST)

## 1. Current weakness

Dema has receipts and verifiers but no canonical "mission" lifecycle envelope. Intentions, blockers, action receipts, verification receipts, and closeouts are produced ad-hoc per surface:

- A PAT proposal is one artifact, written by one surface, with its own body shape.
- A SAT audit is a different artifact, written by another surface, with its own body shape.
- A KEYCONSENT proof binds to ONE action receipt's `target_hash`; it does not name the broader task it serves.
- A verdict-receipt, an authorship-receipt, and a `urp choose` receipt each commit to their own input but do not carry a shared task identifier that an external reader can use to gather "everything that was done for this one task."
- The closeout (what shipped, what is still open, what a replayer would see) lives in commit messages and operator memory, not in a signed artifact.

**The exact gap**: no single on-disk document says _"this is the task, here is its declared DoD, here are the blockers identified, here is the consent for any mutation, here are every action receipt and every verification receipt this task produced, and here is the closeout text."_ An external replayer can verify each receipt in isolation but cannot verify that **a coherent task was completed** — only that **a set of receipts exists**.

This is the gap MISSION-0 is the preflight for. It is the lifecycle-level analog of what KEYCONSENT-0 was for the per-action consent gap: a canonical envelope plus a verification flow that turns a scattered set of artifacts into a single replay-verifiable trace.

## 2. Target

One canonical lifecycle envelope per task, referencing every receipt the task produces, replay-verifiable end-to-end.

Mechanism (in one line): _the mission lifecycle envelope is itself a signed artifact whose body lists the hashes of every sub-receipt the task produced, and a stranger with the bundle, the operator's pubkey, and this repo's rule code can confirm that every cited receipt exists, is internally valid, and is bound back to the same mission._

After MISSION-1A ships, a question like _"did the operator actually finish that task on 2026-06-02 the way they said they did?"_ becomes a re-runnable check: load the lifecycle envelope, walk its referenced hashes, verify each receipt, verify each receipt's `mission_id` matches, verify the consent gates fired for any mutation, verify the closeout text is committed and frozen. Pass or REJECTED.

## 3. Lifecycle envelope schema

Proposed schema for the mission lifecycle artifact:

```text
schema:                              "bizra.dema.mission_lifecycle.v0.1"
mission_id:                          "<sha256 hex; content-address of (mission_intent || dod_declared || created_at_iso)>"
mission_intent:                      "<short human-readable statement of the task>"
dod_declared: [                      # exit criteria, frozen at mission open
  "<criterion 1>",
  "<criterion 2>",
  "..."
]
blockers_identified: [               # what could block this task, named up front
  "<blocker 1>",
  "<blocker 2>",
  "..."
]
pat_proposal_receipt_hash:           "<sha256 hex of the PAT proposal receipt body; optional>"
sat_audit_receipt_hash:              "<sha256 hex of the SAT audit receipt body; optional>"
consent_proof_hash:                  "<sha256 hex of the KEYCONSENT consent proof body; REQUIRED when mutation is performed>"
action_receipt_hashes: [             # every action receipt this mission produced
  "<sha256 hex of verdict-receipt body>",
  "<sha256 hex of authorship-receipt body>",
  "<sha256 hex of urp-choose-receipt body>",
  "..."
]
verification_receipt_hashes: [       # every verifier output this mission produced
  "<sha256 hex of verifier receipt body>",
  "..."
]
closeout_text:                       "<frozen string; what shipped, what is still open, what a replayer sees>"
lesson_candidate_hash:               "<sha256 hex of LEARN-0 lesson candidate body; optional, links forward into LEARN-0>"
next_step_proposed:                  "<short human-readable next step>"
created_at_iso:                      "<ISO-8601 UTC timestamp; mission open>"
closed_at_iso:                       "<ISO-8601 UTC timestamp; mission close>"
operator_public_key_fingerprint:     "<sha256 hex of the operator's Ed25519 pubkey, DER form>"
mission_signature_b64:               "<Ed25519 signature over stableStringify(body without _b64/lifecycle_hash fields), base64>"
lifecycle_hash:                      "<sha256 of stableStringify(body excluding mission_signature_b64 and lifecycle_hash)>"
```

The `body` for signing/hashing is the envelope **without** `mission_signature_b64` and **without** `lifecycle_hash` — same separation pattern as KEYCONSENT-0's consent proof, the verdict-receipt body, URP-3.1A local index, URP-4.1A choose decision. Signature commits to all other fields; hash is the content address.

Three derived properties matter:

1. **Identity binding**: `mission_signature_b64` was producible only by the operator's private key at the time of mission close. A stranger cannot mint a valid one even with full knowledge of every sub-receipt.
2. **Coherence binding**: every hash in `action_receipt_hashes` and `verification_receipt_hashes` must resolve to a real receipt in the bundle, and each such receipt must back-reference this `mission_id`. A receipt whose `mission_id` does not match cannot be silently rolled in.
3. **DoD binding**: `dod_declared` is frozen at mission open; `closeout_text` is frozen at mission close. The pair is the audit surface — an external reader can compare what was promised to what was claimed delivered.

## 4. How sub-receipts reference the mission

The existing action receipts (verdict-receipt body, urp-choose-receipt body, authorship-receipt body) and verification receipts gain ONE new field:

```text
mission_id:  "<sha256 hex of the mission_lifecycle body's mission_id>"
```

This is a **hash reference**, not an inclusion. The full lifecycle envelope ships in the **bundle** alongside the sub-receipts. The lifecycle envelope's `action_receipt_hashes` / `verification_receipt_hashes` are the canonical index — they enumerate every sub-receipt the mission produced, by content address.

Updated bundle shape (proposed):

```text
{
  lifecycle:              <mission lifecycle envelope from §3>,
  lifecycle_signature_b64: <lifecycle signature>,
  signer_public_key_pem:   <signer's pubkey; verifier still ignores this for trust>,
  receipts: [
    {body: <action body, including mission_id>, signature_b64: ..., input: ...},
    {body: <verification body, including mission_id>, signature_b64: ..., input: ...},
    ...
  ],
  consent_proof:           <full KEYCONSENT consent proof envelope; present when mutation occurred>
}
```

Each sub-receipt commits to `mission_id`; the lifecycle envelope's hash arrays enumerate every sub-receipt by content address; the bundle ships all of them together. Cleanly mirrors the consent-proof / consent_proof_hash relationship KEYCONSENT-0 established at the per-action layer.

## 5. Verification flow

A stranger with (bundle) + (operator's pubkey, supplied SEPARATELY via `--pubkey`) + (this repo's rule code) verifies in this order:

1. **Lifecycle signature** — verify `lifecycle_signature_b64` over `stableStringify(lifecycle body)` using external `--pubkey` (same Level B mechanism as verdict-receipt and consent-proof). On failure → `REJECTED:lifecycle_signature_invalid`.
2. **Lifecycle structural validity** — `lifecycle.schema == "bizra.dema.mission_lifecycle.v0.1"`, all required fields present, `dod_declared` non-empty.
3. **Every referenced sub-receipt resolves** — for each hash in `action_receipt_hashes` and `verification_receipt_hashes`, find a receipt in `bundle.receipts` whose body hashes to exactly that value. On any miss → `REJECTED:phantom_receipt_referenced`.
4. **Every sub-receipt back-references this mission** — for every receipt in `bundle.receipts`, `receipt.body.mission_id == lifecycle.mission_id`. On mismatch → `REJECTED:foreign_receipt_in_bundle`.
5. **Consent proof when mutation occurred** — if any sub-receipt is a mutation receipt (verdict-attest, authorship-sign, urp-choose), `lifecycle.consent_proof_hash` must be present, must resolve to `bundle.consent_proof`, and that consent proof must verify (per KEYCONSENT-0 §5) with `action_type == "EXECUTE_MISSION"` and `target_hash` equal to a value derived from `lifecycle.mission_id`. On any failure → `REJECTED:mission_consent_invalid`.
6. **DoD presence** — `dod_declared` array length ≥ 1 (fail-closed when missing). On empty → `REJECTED:dod_missing`.
7. **Closeout presence** — `closeout_text` non-empty. On empty → `REJECTED:closeout_missing`.

If steps 1–7 all pass → `VERIFIED`. The mission is now grounded **AND** lifecycle-bound. A stranger can confirm a coherent task was performed, not just that loose receipts exist.

## 6. Non-goals

This slice (MISSION-0) and the immediately-following implementation slices (MISSION-1A through 1C and FLYWHEEL-1A) DO NOT:

- Make a PoI (Proof-of-Improvement) claim — that is POI-0 / POI-1A.
- Extract learning from the mission — that is LEARN-0.
- Mint tokens, distribute rewards, or make any economic claim.
- Compensate an agent (human or LLM) for performing the mission.
- Publish a public mission catalog or registry.
- Open a marketplace, bidding system, or task auction.
- Promise an SLA, latency bound, or completion guarantee.
- Accept or process payment of any kind.
- Frame a human operator as an employee, contractor, or worker under contract.
- Make a public commitment that the operator will execute any specific future mission.

## 7. Threat model

| Attacker                                   | Capability                                                                                                                             | MISSION-1A status                                              | Why                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phantom-mission attacker**               | Constructs a lifecycle envelope with a `mission_id` and arrays of `action_receipt_hashes` that do not correspond to any real receipt.  | **BLOCKED**                                                    | Step 3 (Every referenced sub-receipt resolves) walks each hash and fails on the first miss → `phantom_receipt_referenced`. The bundle must produce the actual receipt bodies for each hash.                                                                                                                                                        |
| **Receipt-laundering attacker**            | Takes real receipts from past mission A and re-bundles them under a fabricated mission B with a new lifecycle envelope.                | **BLOCKED**                                                    | Step 4 (sub-receipts back-reference this mission) requires every sub-receipt's `body.mission_id` to equal `lifecycle.mission_id`. Past receipts carry the old mission_id and fail → `foreign_receipt_in_bundle`.                                                                                                                                   |
| **Foreign-key signer**                     | Signs the lifecycle envelope with a key not belonging to the operator; supplies real-looking signatures and claims to be the operator. | **BLOCKED**                                                    | The verifier IGNORES `bundle.signer_public_key_pem`; it uses ONLY the externally-supplied `--pubkey`. Step 1 fails → `lifecycle_signature_invalid`. Same invariant as verdict-receipt REJECT-4 and KEYCONSENT-0 step 3.                                                                                                                            |
| **Consent-replay across missions**         | Reuses a valid KEYCONSENT consent proof from mission A to authorize mutations claimed under mission B's lifecycle.                     | **BLOCKED**                                                    | Step 5 requires the consent proof's `target_hash` to derive from `lifecycle.mission_id`. A consent issued against mission A's id cannot satisfy mission B's check → `mission_consent_invalid`.                                                                                                                                                     |
| **Closeout-overclaim attacker**            | Writes a glowing `closeout_text` that asserts the DoD was met but ships sub-receipts that do not actually evidence the DoD criteria.   | **PARTIALLY BLOCKED — surface-level only.**                    | Steps 6 and 7 force `dod_declared` and `closeout_text` to exist, and the verifier exposes both for a human auditor to compare. MISSION-1A does NOT machine-evaluate whether the closeout text actually maps onto the DoD items; that is downstream (LEARN-0 and POI-1A territory). The audit surface is created; the audit judgment remains human. |
| **Disk-access attacker with operator key** | Has read access to `$DEMA_HOME/keys/node0-ed25519.pem`.                                                                                | **NOT BLOCKED — out of scope.** Same boundary as KEYCONSENT-0. | If the attacker has the private key, no software-only lifecycle scheme stops them from signing a fabricated mission. Mitigation is operator-side (filesystem ACLs, OS keychain migration in a later slice).                                                                                                                                        |

## 8. Replay protection

Three layers, increasing in cost:

1. **Scope binding** (cheap, fundamental): every consent proof carried by a mutation-bearing mission carries `action_scope.target_hash` derived from `mission_id`. Re-using a consent proof against a different mission fails immediately at step 5. **In MISSION-1A.**
2. **Per-phase expiration** (cheap, time-bounded): consent proofs continue to carry `expires_at_iso` per KEYCONSENT-0 §3. A mission's mutation phase has a bounded validity window; an expired consent rejects regardless of mission_id match. **In MISSION-1A (reused from KEYCONSENT-1A).**
3. **Phase-specific single-use nonces** (more cost): per-phase consent nonces recorded in a registry, refusing re-use across mission phases. **DEFERRED to MISSION-2**, gated on KEYCONSENT-2's nonce registry shipping first.

The default posture for MISSION-1A is layers 1 + 2 only. Layer 3 is a separate slice and inherits its infrastructure from KEYCONSENT-2.

## 9. DOD for MISSION-1A (pure mission lifecycle kernel)

Exit criteria for the IMMEDIATELY-FOLLOWING implementation slice (NOT this preflight):

- [ ] `packages/missions/src/mission-lifecycle.js` exports pure functions: `buildMissionLifecycle({missionIntent, dodDeclared, blockersIdentified, demaHome, createdAtIso?})` and `closeMission({lifecycleDraft, actionReceiptHashes, verificationReceiptHashes, consentProofHash, closeoutText, lessonCandidateHash, nextStepProposed, closedAtIso?})` and `verifyMissionLifecycle({lifecycleBundle, pubkeyPem, now?})`.
- [ ] **Deterministic**: when `createdAtIso`, `closedAtIso`, and ordering of receipt hash arrays are injected, two builds of the same mission produce byte-identical bodies and identical `lifecycle_hash`.
- [ ] **Fail-closed on missing DoD**: `buildMissionLifecycle` rejects when `dodDeclared` is missing, empty, or contains only empty strings. Reason string: `dod_missing`.
- [ ] **Frozen envelope**: the returned mission body is `Object.freeze`'d; mutation of any field throws.
- [ ] **Every receipt cited**: `verifyMissionLifecycle` resolves every hash in `action_receipt_hashes` and `verification_receipt_hashes` against `bundle.receipts`; a missing receipt → `phantom_receipt_referenced`.
- [ ] **Hash-chain consistency**: every `bundle.receipts[i].body.mission_id == lifecycle.mission_id`. Foreign mission_id → `foreign_receipt_in_bundle`.
- [ ] **Consent binding when mutation**: when any cited sub-receipt is of a mutation-bearing schema (verdict-receipt, authorship-receipt, urp-choose-receipt), `consent_proof_hash` is required and must verify per KEYCONSENT-0 §5 with the correct mission-derived `target_hash`. Missing or invalid → `mission_consent_invalid`.
- [ ] All Ed25519 + sha256 + stableStringify + signPayload + verifyPayload primitives REUSED from existing modules — no duplication; same primitives as KEYCONSENT-1A.
- [ ] Tests (`tests/mission-lifecycle.test.js`): build-then-verify happy path → `verified: true`; missing DoD → `dod_missing`; missing closeout → `closeout_missing`; phantom receipt hash → `phantom_receipt_referenced`; foreign mission_id in receipt → `foreign_receipt_in_bundle`; mutation without consent → `mission_consent_invalid`; tampered lifecycle body → `lifecycle_signature_invalid`; deterministic when inputs are injected: two calls deep-equal; full suite stays green; smoke stays green.

## 10. DOD for FLYWHEEL-1A (full-one-task-loop end-to-end test)

FLYWHEEL-1A is the MASTER acceptance test — the first end-to-end test that exercises an entire mission from intent to verified closeout WITHOUT leaving the local proof boundary. It is gated on MISSION-1A + LEARN-0 + HOW-1A + ECON-1A + POI-1A + AGENT-WALLET-1A + AGENT-SKILL-1A + PERF-1A all sealed and remote-CI-verified.

17 sequential steps, each independently observable on disk, each verifiable by the replay verifier:

1. **Dema restores Node0** — the operator's Node0 state is loaded from `$DEMA_HOME` (keys present, receipts directory present, prior mission cursor read).
2. **MuMu selects mission** — the autonomous orchestrator picks one mission from the local candidate pool; selection is recorded.
3. **PAT proposes** — the Proposer-Actor-Tool surface produces a `pat_proposal_receipt` with the action plan.
4. **SAT audits** — the Safety-Auditor-Tool surface produces a `sat_audit_receipt` with the audit verdict on the PAT proposal.
5. **KEYCONSENT authorizes** — the operator produces a `consent_proof` per KEYCONSENT-0 §3 with `action_type = "EXECUTE_MISSION"` and `target_hash` derived from `mission_id`.
6. **Tool/action runs** — the proposed action executes within Dema's local boundary; no network, no federation, no token, no economic effect.
7. **Receipt writes** — the action's output is written as an `action_receipt` (verdict-receipt, authorship-receipt, or urp-choose-receipt as applicable) carrying both `consent_proof_hash` and `mission_id`.
8. **Verifier re-checks** — the local verifier re-derives the action receipt's body hash, re-checks the signature, re-checks the consent binding, and writes a `verification_receipt` carrying `mission_id`.
9. **PoI scores** — POI-1A produces a Proof-of-Improvement score capturing the measured delta from this mission; the PoI receipt carries `mission_id`.
10. **Token ledger updates** — ECON-1A's local token ledger records the score-derived entry; the ledger update receipt carries `mission_id`. (Local-only; no public mint; no marketplace.)
11. **Agent XP updates** — AGENT-SKILL-1A records the agent's experience delta; the XP receipt carries `mission_id`.
12. **Teacher proposes lesson** — LEARN-0's teacher surface produces a `lesson_candidate` artifact derived from the closeout and the PoI delta; carries `mission_id`.
13. **MuMu approves** — the orchestrator approves the lesson candidate (or rejects it with a recorded reason); the approval is itself a receipt.
14. **House of Wisdom writes entry** — HOW-1A writes the approved lesson into the local lesson store; the write is receipt-bound.
15. **Performance delta records** — PERF-1A records the before/after performance metric for the mission; carries `mission_id`.
16. **Dema recommends next mission** — MuMu surfaces the proposed next mission based on the lesson + performance signal; the recommendation is recorded.
17. **Replay verifier confirms full chain** — a single command walks the lifecycle envelope and confirms every step's receipt resolves, every `mission_id` matches, every signature verifies under the externally-supplied `--pubkey`, and the closeout is bound to the DoD. Output is `VERIFIED` or the first `REJECTED:<reason>`.

When step 17 produces `VERIFIED` for a synthetic mission run end-to-end inside a hermetic test directory, FLYWHEEL-1A passes. That is the first moment Dema can say "one task moved from intention to verified closeout without leaving the local proof boundary" as a MEASURED claim, per PDF §12 DoD.

## 11. Boundary

This preflight document is text-only. Its boundary block:

```json
{
  "runtime_code_changed": false,
  "private_key_exported": false,
  "network_used": false,
  "federation_used": false,
  "token_minted": false,
  "economic_claim_made": false,
  "public_commitment_made": false,
  "agent_employed": false
}
```

MISSION-1A, 1B, 1C, and FLYWHEEL-1A will each carry their own boundary blocks and tighter scope statements.

## 12. What this preflight does NOT do

- Does NOT change any existing receipt schema in any running envelope.
- Does NOT introduce a runtime mission orchestrator.
- Does NOT modify the operator's `~/.dema/` directory.
- Does NOT make any claim that Dema has a working mission lifecycle today (it does not — this is a design doc, not a shipped feature).
- Does NOT promise a specific implementation timeline for MISSION-1A onward.
- Does NOT extract a learning artifact (LEARN-0's job).
- Does NOT compute a PoI score (POI-0 / POI-1A's job).
- Does NOT update any token ledger (ECON-1A's job).
- Does NOT employ, compensate, or contract any agent (out of scope at every layer of this slice).

## 13. What unlocks next

After this preflight is committed and remote-CI verified, MISSION-1A (the pure mission lifecycle kernel) can begin. FLYWHEEL-1A is the master end-to-end acceptance test and is gated on MISSION-1A + LEARN-0 + HOW-1A + ECON-1A + POI-1A + AGENT-WALLET-1A + AGENT-SKILL-1A + PERF-1A all sealed and remote-CI verified. When FLYWHEEL-1A passes, the PDF §12 DoD — _"one task can move from intention to verified closeout without leaving the local proof boundary"_ — graduates from DESIGNED to MEASURED, and the canon glossary entry for "mission" can be promoted with cited test names as evidence.

Provenance shape for the mission lifecycle itself is Level A (the lifecycle envelope is the canonical signed artifact for the mission); each sub-receipt it references remains Level B grounded verification independently. The combination — a Level A envelope whose hashes index a set of Level B sub-receipts — is the first time Dema produces a task-scale proof, one step above the per-action proof that KEYCONSENT-1B already grounds.

PDF §22 Final Law applies throughout: every mission is consented, every action is verified, every receipt is replayable, every claim is traced to proof, every step is approved by the operator, every score is measured, and the boundary stays bounded.
