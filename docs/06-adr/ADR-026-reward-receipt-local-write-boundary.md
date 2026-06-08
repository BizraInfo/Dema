# ADR-026: Reward Receipt Local Write Boundary

**Status:** Proposed / Boundary Spec / No Implementation

**Date:** 2026-06-08

**Decision Makers:** Mumu (via GO consent), Professor Synapse (analysis + dual-repo synthesis), Grok (authoring per blueprint)

**Supersedes:** None (builds directly on G24R closure: reward receipt mock local prototype + delivery-check integration passed local A+ gates, pre-push:seal 104/104, push (mu 104/104), and four remote rails (gitleaks 27122964718, CodeQL 27122964643, check 27122964663, BIZRA Review Gate 27122964653) on exact SHA 934bfea298f84922082ca82a1d677b0086b45e31. G23 mock + G24 delivery integration now wired.)

**Related:** ADR-019 (MVP boundary), ADR-020 (proposal flow), ADR-021 (mock scoring boundary), ADR-022 (real scoring boundary), ADR-023 (real scoring minimal solvable spec), ADR-024 (reward eligibility boundary), ADR-025 (reward receipt boundary), ELITE_FULL_STACK_BLUEPRINT, Claims Ledger, Delivery Spine, Node0 full DNA (Dema face + Data Lake body), PAT-7/SAT-5/URP, FATE Gate, dual-repo Node0 model.

**Implements:** G25_REWARD_RECEIPT_LOCAL_WRITE_BOUNDARY_LOCAL_GREEN (this boundary spec only; no implementation).

## Context

G24R closed: the reward receipt mock local prototype (scripts/reward-receipt-mock.mjs + tests/reward-receipt-mock.test.js + delivery-check integration) + boundary scaffold passed local gates (llm:guidance PASS, git diff --check clean, node --test 8/8 + 7/7, npm run check via known B-bucket classifier, pre-push:seal PUSH_READY 104/104, delivery:check with explicit "ADR-025 reward receipt mock integrated: PASS") and four remote rails on the G23 head, followed by the G24 delivery-check integration commit (58b9022) achieving four-rail success (gitleaks re-run success after known transient, CodeQL success, check success, BIZRA Review Gate success).

In the dual-repo Node0 model (Dema = constitutional face/control layer; Data Lake = deep computational body with Rust/Python/agent/federation/crypto layers, PAT-7, SAT-5, FATE Gate, five-layer governed stack, and O(1)→full inference cognitive cascade), the receipt layer is the embryo of the full economy. Dema's proof ladder (G0–G50) is the control plane that sequences safe activation of each DNA subsystem.

This ADR defines the *local write boundary* for persisting reward receipt review objects (the output of the G23 mock or future equivalent) inside Node0. It does not implement any writer. It only specifies the rules, consent, anti-gaming, and non-activation constraints so that a future controlled local writer prototype can be built safely.

The technical report (Impact Bonding Curve Launchpad analysis) and Data Lake README reinforce that BIZRA Node0 must eventually contain the full closed loop (scoring, eligibility, receipt, ledger, token accounting mock, contract verifier mock, marketplace proof-object mock, Node1 handshake mock, public URP bridge mock/testnet, Shariah evidence package), but every dangerous or economic subsystem must first exist in Genesis/Test mode (LOCAL_ONLY, [PROTOTYPE][DESIGNED_NOT_LIVE], proof-gated, read/list only from outside the boundary) before any public activation.

## Purpose

Define the minimum safe rules under which Node0 may later *locally persist* a reward receipt review artifact (content-addressed file under DEMA_HOME or equivalent local store) so that subsequent Node0 subsystems (ledger, integrity proofs, accounting mocks, etc.) have a trusted private source of truth — without ever performing minting, publishing, bridging, economic authorization, or public activation.

## Definition

A local reward receipt write is a private, content-addressed, consent-gated, integrity-verified filesystem persistence of a receipt *review object* (or its expectation placeholder) inside the operator's Node0 home. It is not a minted receipt, not a transferable asset, not a public document, not an on-chain or federated record, and not an authorization or claim.

Local write is the private Node0 memory step that precedes (and is a prerequisite for) any future ledger or economic layer. It remains fully inside the "still blocked" envelope until additional proof gates, external review, and explicit future G-rings close.

## What Local Reward Receipt Write Means

- private content-addressed persistence under DEMA_HOME (or operator-controlled equivalent)
- exact-string consent required for the write action itself
- integrity hash (sha256 of canonical form) verified on write and on subsequent read
- proof-gap aware (the written object carries its proof_gaps forward)
- anti-gaming checked at write time
- human-review / additional gate aware
- read/list only from outside the write boundary
- produces a local write artifact (the file) + optional local write receipt for the write action
- stays LOCAL_ONLY and [PROTOTYPE][DESIGNED_NOT_LIVE] until later rings prove otherwise

## What Local Reward Receipt Write Does Not Mean

- no mint, publish, on-chain record, CID, or public URL
- no bridge, propagation, or sync to Node1, federation, Data Lake public layers, or URP
- no economic value, token, amount, claim, payout, APR, yield, or asset creation
- no Shariah-compliant, certified, authorized, or compliant label
- no contract interaction, automatic trigger, or marketplace signal
- no public leaderboard, investment framing, or external visibility
- no self-minting, self-authorization, or circular proof acceptance

## Allowed Inputs (to a future local writer)

- the full output shape of createMockRewardReceiptReview (or future equivalent): receipt_review_id, eligibility_review_id, score_id, contribution_id, proposal_id, claim_label, consent_status, review_status, anti_gaming_status, receipt_status, proof_gaps, receipt_expectation, created_at, prototype_posture, etc.
- exact write consent string
- local write context (DEMA_HOME path, operator fingerprint, timestamp)
- optional additional human review attestation (for future gates)

## Forbidden Inputs

- any flag or field requesting mint, publish, bridge, or public exposure
- economic fields (token_amount, economic_value, claim_amount, payout, APR, etc.)
- authorization or trigger language
- contract address / call / marketplace target
- Node1 / URP / federation target
- Shariah / certified / guaranteed / compliant assertions
- self-referential or circular impact claims without external proof_gaps

## Allowed Outputs

A local, content-addressed, integrity-protected file (example path: $DEMA_HOME/receipts/reward-receipt-<receipt_review_id>.json or equivalent stable naming) containing:

- the original review object (or its canonical form)
- write metadata: write_consent_hash, write_timestamp, writer_boundary_version, integrity_hash (sha256 of the persisted canonical JSON), file_mode (0o600), prototype_posture
- optional local write receipt envelope (schema-tagged, all-false boundary for the write action itself)

The persisted artifact must remain readable/listable only by the local operator under DEMA_HOME controls. No network, no publish, no federation.

## Allowed Local Write Decision / Status Values

- local_write_performed (file written, hash verified, consent matched, anti-gaming passed)
- write_refused_consent_mismatch
- write_refused_anti_gaming
- write_refused_proof_gaps
- write_refused_forbidden_input
- candidate_for_local_persistence_only (review object accepted for future write but write not performed in this invocation)

## Consent Rule

Exact-string consent (to be defined as REWARD_RECEIPT_LOCAL_WRITE_CONSENT or equivalent in the future writer module) is required for the write action. The string must be the literal GO command for the write boundary. No inferred, default, or broad consent. The consent is for *local private persistence only*.

## Review Boundary

The written local artifact is a private Node0 receipt *review record*. It does not constitute a minted receipt, does not authorize reward, does not create economic right, and does not become visible or actionable outside the local DEMA_HOME. Any later use (ledger append, accounting mock, contract verifier, marketplace proof object, Node1 sync, URP bridge, Shariah evidence) requires separate future boundaries, additional proof gates, exact consents, anti-gaming re-check, and human review.

## Anti-Gaming Rule

Reject (or mark write_refused_anti_gaming / rejected_for_forbidden_claim) if the review object, claim_label, proof_gaps, or write context contains:

- reward-seeking, payout, claim, or "I earned" language without external verified impact
- circular/self-referential proof (impact claimed from the same unverified object)
- unverifiable public benefit or speculative economic framing
- self-dealing, market manipulation signals, or coercive claims
- any attempt to treat the local write as public mint, asset, or authorization

The written file must carry forward all original proof_gaps and add a write-time anti_gaming_status.

## Receipt / Persistence Rule

Future local writer implementation must:

- canonicalize the review object (sorted keys)
- compute and embed integrity_hash
- write atomically (tmp + rename) to a content-addressed or stable-named file under DEMA_HOME with restrictive permissions (0o600)
- verify the hash on read-back before declaring success
- never perform any side effect that looks like mint, publish, bridge, or economic activation
- produce a local write receipt (or the file itself serves as the receipt) that remains read/list only

The persistence is private Node0 memory. It is the prerequisite substrate for all later DNA (ledger, token mock, contracts, etc.) but does not activate them.

## Non-Claims (Ihsān Discipline)

This spec is:

- [PROTOTYPE]
- [DESIGNED_NOT_LIVE]
- LOCAL_ONLY / GENESIS_MODE

- No reward receipt implementation.
- No reward receipt minting or writing. (This ADR is the boundary spec only; actual writer remains blocked until future scaffold + prototype + four-rail proof.)
- No production or economic scoring.
- No reward eligibility implementation.
- No reward logic.
- No contracts.
- No token logic.
- No marketplace.
- No public economic copy.
- No Node1.
- No public URP bridge.
- No Shariah-compliant claim.

All artifacts remain local, consented, reviewed, gap-aware, anti-gaming-checked, and non-economic. No external activation, federation, or public claim is created or implied. In the dual-repo Node0 model, this is the face-layer (Dema) private persistence step; body-layer (Data Lake) or public activation requires additional rings, benchmarks, security review (SEC-001/002/003 from the technical report), and external gates.

## MBOK / DevOps / CI-CD / A+ QA Mapping

| Domain                  | Mapping |
|-------------------------|---------|
| Integration Management | Ladder continuity: G24R (mock + delivery-check) → ADR-026 local write boundary spec → future test scaffold → local writer prototype → ledger / accounting mocks → full Node0 DNA (with Data Lake body) under proof gates |
| Scope Management       | Boundary/spec only (defines safe local persistence rules; no implementation, no mint, no publish, no bridge, no economic activation) |
| Quality Management     | Allowed/forbidden inputs/outputs; integrity_hash + atomic write; proof_gaps carried forward; anti_gaming_status at write time; restrictive file perms; read/list only outside boundary |
| Risk Management        | Anti-gaming rule at write time; explicit non-claims; no economic leakage; dual-repo awareness (face vs body); technical report risks (key material, Halo2/ML-KEM, TPS/PoI benchmarks) deferred to later gates |
| Stakeholder Management | Exact consent for the write action; review boundary (local file ≠ minted receipt or reward); operator owns the private DEMA_HOME artifact; human review / additional gates for later use |
| DevOps                 | claim → ADR boundary → (future) local proof (writer) → remote 4-rail → (much later) cross-repo (Dema + Data Lake) alignment |
| CI/CD                  | Local gates (llm:guidance, diff --check, claim:check, delivery:check) then four remote rails; pre-push:seal (mu 104/104) as forcing function |
| A+ QA                  | No public performance, TPS, PoI, or economic claim without benchmark artifacts + external review. Local write must stay inside A+ ceilings for latency and integrity. Receipt is the first transferable truth object — verify before any downstream use. |

## Next Micro

GO: REWARD RECEIPT LOCAL WRITE TEST SCAFFOLD

Only after ADR-026 local proof + remote four-rail proof on this boundary commit.

---

**Updated still-blocked list (carried forward, dual-repo Node0 aware):**

No production scoring.
No economic scoring.
No reward eligibility implementation.
No reward logic.
No reward receipt implementation.
No reward receipt minting or writing.
No contracts.
No token logic.
No marketplace.
No public economic copy.
No Node1.
No public URP bridge.
No Shariah-compliant claim.

G24 delivery-check integration of the mock exists as [PROTOTYPE][DESIGNED_NOT_LIVE] LOCAL_ONLY. This ADR-026 defines the boundary for future local private persistence (the embryo substrate for ledger and later DNA). Actual local write implementation, any minting, publishing, bridging, economic activation, or public claims remain fully blocked until additional proof gates, external review (including security items from the technical report), benchmarks, and four-rail remote proof close on the relevant future rings. Node0 must contain the full BIZRA DNA, but each subsystem activates only through the proof ladder.