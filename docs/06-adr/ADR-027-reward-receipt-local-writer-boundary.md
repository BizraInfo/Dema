# ADR-027: Reward Receipt Local Writer Boundary

**Status:** Proposed / Boundary Spec / No Implementation

**Date:** 2026-06-08

**Decision Makers:** Mumu (via GO consent), Professor Synapse (analysis + dual-repo synthesis), Grok (authoring per blueprint)

**Supersedes:** None (builds directly on G28R closure: reward receipt local write plan mock + delivery-check integration passed local A+ gates, pre-push:seal 104/104, push (mu 104/104), and four remote rails on exact SHA 9d0d5242df8c478d92f1d930b494bbdf3ea26826. G27 plan mock + G28 delivery integration now wired.)

**Related:** ADR-019 (MVP boundary), ADR-020 (proposal flow), ADR-021 (mock scoring boundary), ADR-022 (real scoring boundary), ADR-023 (real scoring minimal solvable spec), ADR-024 (reward eligibility boundary), ADR-025 (reward receipt boundary), ADR-026 (reward receipt local write boundary), ELITE_FULL_STACK_BLUEPRINT, Claims Ledger, Delivery Spine, Node0 full DNA (Dema face + Data Lake body), PAT-7/SAT-5/URP, FATE Gate, dual-repo Node0 model.

**Implements:** G29_REWARD_RECEIPT_LOCAL_WRITER_BOUNDARY_LOCAL_GREEN (this boundary spec only; no implementation).

## Context

G28R closed: the reward receipt local write plan mock (scripts/reward-receipt-local-write-plan.mjs + tests/reward-receipt-local-write-plan.test.js + delivery-check integration) passed local gates (llm:guidance PASS, git diff --check clean, node --test 8/8 + 7/7, npm run check via known B-bucket classifier, pre-push:seal PUSH_READY 104/104, delivery:check with explicit "ADR-026 reward receipt local write plan integrated: PASS") and four remote rails (gitleaks 27126712484, CodeQL 27126712323, BIZRA Review Gate 27126712411, check 27126712315) on exact SHA 9d0d5242df8c478d92f1d930b494bbdf3ea26826.

In the dual-repo Node0 model (Dema = constitutional face/control layer; Data Lake = deep computational body with Rust/Python/agent/federation/crypto layers, PAT-7, SAT-5, FATE Gate, five-layer governed stack, and O(1)→full inference cognitive cascade), the receipt layer is the embryo of the full economy. Dema's proof ladder (G0–G50) is the control plane that sequences safe activation of each DNA subsystem.

This ADR defines the *local writer boundary* for the actual code that will consume a validated local write-plan (from G27) and perform the filesystem persistence of a reward receipt review artifact inside Node0. It does not implement any writer. It only specifies the rules, consent, anti-gaming, path safety, integrity verification, and non-activation constraints so that a future controlled local writer prototype can be built safely.

The technical report (Impact Bonding Curve Launchpad analysis) and Data Lake README reinforce that BIZRA Node0 must eventually contain the full closed loop (scoring, eligibility, receipt, ledger, token accounting mock, contract verifier mock, marketplace proof-object mock, Node1 handshake mock, public URP bridge mock/testnet, Shariah evidence package), but every dangerous or economic subsystem must first exist in Genesis/Test mode (LOCAL_ONLY, [PROTOTYPE][DESIGNED_NOT_LIVE], proof-gated, read/list only from outside the boundary) before any public activation.

## Purpose

Define the minimum safe rules under which a future local writer may take a validated reward receipt local write-plan and *execute the private persistence* (atomic content-addressed file write under DEMA_HOME with restrictive permissions and integrity verification) so that subsequent Node0 subsystems (ledger, integrity proofs, accounting mocks, etc.) have a trusted private source of truth — without ever performing minting, publishing, bridging, economic authorization, or public activation.

## Definition

The local reward receipt writer is the controlled implementation that consumes a pre-validated local write-plan object and performs the actual filesystem persistence of the receipt review artifact. The writer itself is consent-gated, path-safe, integrity-enforcing, anti-gaming-checked, and produces only local, read/list-only artifacts. It is not a public writer, not a minting service, not a publication mechanism, and not an economic activator.

The writer boundary is the last pre-implementation gate before the actual writer prototype. The writer remains fully inside the "still blocked" envelope until additional proof gates, external review, and explicit future G-rings close.

## What Local Reward Receipt Writer Means

- consumes a validated local write-plan (from G27 mock or future equivalent)
- exact-string consent required for the write *action*
- atomic write (tmp + rename) to a content-addressed or stable-named file under DEMA_HOME
- restrictive permissions (0o600) on the persisted artifact
- integrity hash (sha256 of canonical form) computed before write and verified on read-back
- proof-gap aware (the written object carries its proof_gaps forward)
- anti-gaming re-checked at write time using the plan's data
- human-review / additional gate aware for sensitive cases
- produces the persisted file + a local write receipt (or metadata) for the write action
- read/list only from outside the writer boundary
- stays LOCAL_ONLY and [PROTOTYPE][DESIGNED_NOT_LIVE] until later rings prove otherwise

## What Local Reward Receipt Writer Does Not Mean

- no mint, publish, on-chain record, CID, or public URL
- no bridge, propagation, or sync to Node1, federation, Data Lake public layers, or URP
- no economic value, token, amount, claim, payout, APR, yield, or asset creation
- no Shariah-compliant, certified, authorized, or compliant label
- no contract interaction, automatic trigger, or marketplace signal
- no public leaderboard, investment framing, or external visibility
- no self-minting, self-authorization, or circular proof acceptance
- no execution without a pre-validated write-plan from the prior boundary

## Allowed Inputs (to the future local writer)

- a fully validated local write-plan object (local_write_plan_id, receipt_review_id, content_hash, proposed_path, proof_gaps, receipt_expectation, write_status, etc.)
- exact writer consent string
- DEMA_HOME context (resolved operator-controlled root path)
- optional additional human review attestation (for future gates)

## Forbidden Inputs

- any flag or field requesting mint, publish, bridge, or public exposure
- economic fields (token_amount, economic_value, claim_amount, payout, APR, etc.)
- authorization or trigger language
- contract address / call / marketplace target
- Node1 / URP / federation target
- Shariah / certified / guaranteed / compliant assertions
- unvalidated or tampered write-plan (missing plan_id, mismatched content_hash, unsafe path, empty proof_gaps, etc.)
- direct review object bypass (must come through a validated plan)

## Allowed Outputs

A private, content-addressed, integrity-protected file persisted under the operator's DEMA_HOME (example stable or content-addressed naming under receipts/ or equivalent) containing:

- the canonical receipt review object (or its expectation)
- write metadata: local_write_plan_id (from input), write_consent_hash, write_timestamp, writer_boundary_version, integrity_hash (sha256 of the persisted canonical JSON), file_mode (0o600), prototype_posture
- optional local write receipt envelope (schema-tagged, all-false boundary for the write action itself)

The persisted artifact must remain readable/listable only by the local operator under DEMA_HOME controls. No network, no publish, no federation.

## Allowed Local Writer Decision / Status Values

- local_write_performed (file written atomically, hash verified before/after, consent matched, anti-gaming passed, plan validated)
- write_refused_consent_mismatch
- write_refused_anti_gaming
- write_refused_proof_gaps
- write_refused_unsafe_path
- write_refused_invalid_plan (plan_id mismatch, content_hash mismatch, etc.)
- write_refused_forbidden_input

## Consent Rule

Exact-string consent (to be defined as REWARD_RECEIPT_LOCAL_WRITER_CONSENT or equivalent in the future writer module) is required for the write *action*. The string must be the literal GO command for the writer boundary. No inferred, default, or broad consent. The consent is for *local private persistence only*, using a pre-validated plan.

## Review Boundary

The writer is the executor of a pre-approved local write-plan. It does not decide eligibility, does not create economic rights, and does not make the artifact public or actionable outside the local DEMA_HOME. Any later use (ledger append, accounting mock, contract verifier, marketplace proof object, Node1 sync, URP bridge, Shariah evidence) requires separate future boundaries, additional proof gates, exact consents, anti-gaming re-check, and human review.

## Anti-Gaming Rule

The writer must re-validate key plan fields at execution time and reject (write_refused_anti_gaming or equivalent) if:

- the plan's claim_label, proof_gaps, or context contains reward-seeking, payout, claim, or "I earned" language without external verified impact
- circular/self-referential proof
- unverifiable public benefit or speculative economic framing
- self-dealing, market manipulation signals, or coercive claims
- any attempt to treat the local write as public mint, asset, or authorization

The written file must carry forward all original proof_gaps plus writer-time metadata.

## Persistence / Receipt Rule

Future local writer implementation must:

- validate the incoming plan against the boundary rules (id format, safe path, required fields, proof_gaps, etc.)
- canonicalize the receipt content
- compute and embed (or verify) integrity_hash
- write atomically (tmp + rename) to the proposed_path (or content-addressed equivalent) under DEMA_HOME with 0o600 permissions
- verify the hash on read-back before declaring success
- never perform any side effect that looks like mint, publish, bridge, or economic activation
- produce a local write receipt (or metadata) that remains read/list only

The persistence is private Node0 memory. It is the executable realization of the G26/G27 plan layer.

## Non-Claims (Ihsān Discipline)

This spec is:

- [PROTOTYPE]
- [DESIGNED_NOT_LIVE]
- LOCAL_ONLY / GENESIS_MODE

- No reward receipt implementation.
- No reward receipt minting or writing. (This ADR is the boundary spec for the future writer only; the actual writer implementation remains blocked until future scaffold + prototype + four-rail proof.)
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

All artifacts remain local, consented, reviewed, gap-aware, anti-gaming-checked, and non-economic. No external activation, federation, or public claim is created or implied. In the dual-repo Node0 model, this is the face-layer (Dema) writer boundary; body-layer (Data Lake) or public activation requires additional rings, benchmarks, security review (SEC-001/002/003 from the technical report), and external gates. The writer is the bridge from plan to private persistence only.

## MBOK / DevOps / CI-CD / A+ QA Mapping

| Domain                  | Mapping |
|-------------------------|---------|
| Integration Management | Ladder continuity: G28R (plan mock + delivery-check) → ADR-027 local writer boundary spec → future writer test scaffold → local writer prototype → ledger / accounting mocks → full Node0 DNA (with Data Lake body) under proof gates |
| Scope Management       | Boundary/spec only (defines safe local writer rules; no implementation, no mint, no publish, no bridge, no economic activation) |
| Quality Management     | Allowed/forbidden inputs/outputs; plan validation + re-check at write time; atomic write + 0o600 perms; integrity_hash pre/post verification; proof_gaps carried forward; read/list only outside boundary |
| Risk Management        | Anti-gaming rule at write time; explicit non-claims; no economic leakage; dual-repo awareness (face vs body); technical report risks (key material, Halo2/ML-KEM, TPS/PoI benchmarks) deferred to later gates |
| Stakeholder Management | Exact consent for the write action; review boundary (writer executes plan only; local file ≠ minted receipt or reward); operator owns the private DEMA_HOME artifact; human review / additional gates for later use |
| DevOps                 | claim → ADR boundary → (future) local proof (writer) → remote 4-rail → (much later) cross-repo (Dema + Data Lake) alignment |
| CI/CD                  | Local gates (llm:guidance, diff --check, claim:check, delivery:check) then four remote rails; pre-push:seal (mu 104/104) as forcing function |
| A+ QA                  | No public performance, TPS, PoI, or economic claim without benchmark artifacts + external review. Local writer must stay inside A+ ceilings for latency, integrity, and safety. Receipt is the first transferable truth object — verify before any downstream use. |

## Next Micro

GO: REWARD RECEIPT LOCAL WRITER TEST SCAFFOLD

Only after ADR-027 local proof + remote four-rail proof on this boundary commit.

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

G28 delivery-check integration of the plan mock exists as [PROTOTYPE][DESIGNED_NOT_LIVE] LOCAL_ONLY. This ADR-027 defines the boundary for the future local writer implementation (the executable layer that turns a validated plan into private persistence). Actual local writer implementation, any minting, publishing, bridging, economic activation, or public claims remain fully blocked until additional proof gates, external review (including security items from the technical report), benchmarks, and four-rail remote proof close on the relevant future rings. Node0 must contain the full BIZRA DNA, but each subsystem activates only through the proof ladder.