# Node0 + Dema + URP Flagship Definition of Done

> Node0 must close the loop alone before it opens the loop to the network.

## 1. Purpose

This document defines the Definition of Done for the first flagship Node0,
Dema, and URP proof path. It converts the Genesis Block vision into acceptance
gates that can be checked from disk, source, tests, receipts, and CI witnesses.

This is a docs-only DoD. It does not start runtime, connect a public bridge,
launch Node1, mint a token, or create reward eligibility.

## 2. Current Baseline

Remote-green baseline:

```text
HEAD: be42ab3c0be100921821dfdb28f814b3b1bf926f
Prior recovery commit: 92ae5cec25a9336a2d4b8ff2f8cd58eff72dbbc5
```

Remote witness runs on `be42ab3`:

| Rail | Run ID | Required conclusion |
| --- | ---: | --- |
| `check` | `27070525350` | success |
| `BIZRA Review Gate` | `27070525358` | success |
| `gitleaks` | `27070525343` | success |
| `CodeQL` | `27070525344` | success |

This baseline means repair mode has ended. It does not mean Genesis is sealed.

## 3. Flagship Loop

Node0 is DoD-complete only when this loop can be replayed from a clean local
state:

1. Boot local node state.
2. Load Dema as the local product face.
3. Launch or verify the Node0 5SAT local declaration under exact consent.
4. Accept a user mission as a draft.
5. Screen the mission through Covenant Gate or its successor gate.
6. Require exact micro-consent for any consequential step.
7. Execute only allowed local or proof-safe actions.
8. Write or preview receipts through the correct authority boundary.
9. Summarize state from disk.
10. Prepare outward connection only through a governed URP bridge specification.

Step 10 is specification-only until the public bridge proof gate exists.

## 4. Gate A - Node0 Identity and Local State

| Criterion | Required proof | Current posture |
| --- | --- | --- |
| Node0 is one human's local node, not a network. | `docs/NODE0_DEMA_COMPLETE_COMPONENT_DNA_v0_1.md`; `docs/CLAIM_REGISTER_v0_1.md`. | Declared and bounded. |
| Local state stays under `DEMA_HOME` or `~/.dema`. | `docs/LLM_SYSTEM_FLOW.md`; relevant CLI tests. | Active boundary. |
| No hidden daemon. | ADR-002 and README first-run non-claims. | Active boundary. |

Done when a clean-state demo shows setup/status without external dependency or
hidden process.

## 5. Gate B - Dema Face Lifecycle

| Criterion | Required proof | Current posture |
| --- | --- | --- |
| Dema can show local readiness. | `dema status`, `dema doctor`, tests covering status surfaces. | Partially active. |
| Dema can draft mission and consent previews. | CLI surfaces plus tests. | Active preview posture. |
| Dema does not claim runtime authority. | README, Architecture, Claim Register. | Active boundary. |

Done when one scripted clean-state journey exercises welcome, setup, status,
mission draft, consent draft, and receipt listing without runtime execution.

## 6. Gate C - URP 5SAT Local Declaration

| Criterion | Required proof | Current posture |
| --- | --- | --- |
| Exact-consent launch/lock path exists. | `dema urp launch-5sat --consent ...`; `packages/urp/src/five-sat-urp-launch.js`. | Local declaration active. |
| Verifier rejects wrong shape or wrong count. | `tests/five-sat-urp-launch.test.js`. | Tested. |
| Node1 remains preview-only. | `dema urp node1-5sat-preview`; Component DNA. | Held. |

Done when the 5SAT declaration is reproducible from clean `DEMA_HOME`, writes
only under the Dema boundary, and the resulting receipt/state can be listed or
verified without claiming live public URP.

## 7. Gate D - Covenant Gate Screening

| Criterion | Required proof | Current posture |
| --- | --- | --- |
| Local proposal screening is deterministic. | `packages/covenant/src/covenant-gate.js`; `tests/covenant-gate.test.js`. | Prototype. |
| Exact `GO` micro-consent is required for demo receipt. | CLI and test coverage. | Prototype. |
| No production cryptography, legal, Shariah, or fund-movement claim. | `docs/covenant-gate-v0.1.md`; Claim Register. | Bounded. |

Done when one clean fixture can be screened, refused or accepted with explicit
reasoning, consented only by exact phrase, and recorded as prototype evidence.

## 8. Gate E - Mission Execution Boundary

| Criterion | Required proof | Current posture |
| --- | --- | --- |
| Mission can be drafted before execution. | Dema mission preview surfaces. | Preview active. |
| Execution is not silently performed in Dema. | LLM flow, Architecture, ADR-005. | Active boundary. |
| Any future execution route declares capability, consent, receipt, and rollback. | ADR-006 software quality rule. | Required before shipping. |

Done when the flagship demo shows the transition from mission draft to consent
scope to proof-safe action or governed handoff, with no hidden execution.

## 9. Gate F - Receipt and Evidence Chain

| Criterion | Required proof | Current posture |
| --- | --- | --- |
| Receipts can be listed and read. | Dema receipt surfaces and docs. | Active. |
| Verification can be read-only. | ADR-006 no-mint verification. | Binding. |
| CI evidence is witness, not authority. | ADR-006; remote run IDs. | Binding. |

Done when the closed-loop demo produces or references receipts and a reviewer
can verify the chain without mutating the state being verified.

## 10. Gate G - Performance and Quality

| Criterion | Required proof | Current posture |
| --- | --- | --- |
| Unit/integration tests pass. | `npm test`. | Required every slice. |
| Review and performance checks pass. | `npm run check`. | Required every slice. |
| LLM routing docs remain canonical. | `npm run llm:guidance`. | Required every slice. |
| Whitespace is clean. | `git diff --check`. | Required every slice. |
| Remote witness rails are green. | check, Review Gate, gitleaks, CodeQL. | Green at `be42ab3`. |

Done when local gates and remote witness rails are green for the commit that
contains the closed-loop proof.

## 11. Gate H - Public URP Bridge Specification

The public bridge must be specified before any live public connection exists.

Required fields:

- capability manifest,
- permission model,
- identity boundary,
- rate limits,
- external request quarantine,
- receipt shape for inbound and outbound messages,
- disconnect and revoke flow,
- no direct public control over local Node0 state.

Done when a bridge spec exists and every public-network claim remains
`DESIGNED_NOT_LIVE` until the bridge is tested with receipts.

## 12. Gate I - Node1 Handshake

Node1 is held until Node0 closes the loop.

The first Node1 handshake must follow this pattern:

```text
Node1 requests connection
-> Node0 verifies Node1 capability manifest
-> Covenant Gate screens risk
-> URP identity and contribution rules are checked
-> human approves connection by exact consent
-> receipt is written
-> limited channel opens
-> all interactions are logged
-> revoke/disconnect remains available
```

Done when this handshake is specified and tested in preview before any second
human is onboarded as Node1.

## 13. Gate J - Proof-of-Impact and Economy Quarantine

Proof-of-Impact remains designed-not-live until UKE, URP, review, and receipt
chains can verify impact.

No economic layer is DoD-complete until:

- contribution proposal flow exists,
- impact scoring rubric exists,
- anti-gaming rules exist,
- review council or equivalent authority is defined,
- reward eligibility receipt shape exists,
- legal and Shariah review boundaries are documented,
- no-premint and no-public-financial-claim posture remains intact.

Until then, public wording must stay design-level and non-financial.

## 14. Known Current Gaps

| Gap | Why it blocks Genesis seal |
| --- | --- |
| ~~Node0 closed-loop clean-state demo not yet complete.~~ **CLOSED 2026-08-02** by NODE0-CLEAN-STATE-JOURNEY-1A. | Genesis needs replayable proof, not only green CI. The harness publishes one `journey_invariant_hash` that is identical across independent clean homes, with the run-varying values reported separately and deliberately excluded -- so a stranger's reproduction can actually agree. |
| Public URP bridge not yet specified. | Network opening requires capability, quarantine, and receipt boundaries. |
| Node1 handshake not yet tested in preview. | A second node must not inherit ambiguous rules. |
| Proof-of-Impact economy not implemented. | Reward language must remain quarantined. |
| External legal/Shariah review absent. | No certification or compliance claim may ship. |

## 15. Definition of Done Summary

Node0 + Dema + URP flagship DoD is complete when:

- [x] `docs/genesis/BIZRA_GENESIS_BLOCK_v0.1.md` is present and linked. (Verified 2026-08-02: file present; linked from `docs/INDEX.md` and this DoD.)
- [x] This DoD is present and linked. (Verified 2026-08-02: linked from `docs/INDEX.md` and the genesis block.)
- [x] One clean-state Node0 demo executes the full local loop through Dema. (NODE0-CLEAN-STATE-JOURNEY-1A: `node scripts/proof/node0-clean-state-journey.mjs` drives the real `bin/dema` through welcome -> setup -> setup-check -> status -> URP 5SAT -> receipt read -> Covenant screen -> consent refusal -> receipt list, against a DEMA_HOME the harness creates and removes. 9 steps, exit 0.)
- [x] URP 5SAT declaration is reproduced and verified from clean `DEMA_HOME`. (Reproduced from two INDEPENDENT clean homes; the declared content -- active SAT set, lock, blocked manipulators, truth label -- is byte-identical, while `launch_hash` legitimately differs per home. CSJ-02/CSJ-03.)
- [x] Covenant Gate screens one proposal and records prototype evidence. (`fixtures/covenant/example-impact-proposal.json` screened; verdicts carried under the gate's own PROTOTYPE/DESIGN claim labels, `status: needs_human_consent`. The consent step is proven to REFUSE without a signing key -- CSJ-04.)
- [x] Receipts can be listed/read without mutating verification state. (The 5SAT receipt is read back from disk and `dema urp list --json` reports `file_write_performed: false`; both inside the journey, boundary all-false.)
- [ ] Public bridge spec exists before any public connection.
- [ ] Node1 handshake preview exists before Node1.
- [x] Claim Register remains consistent with every public-facing sentence. (Enforced, not asserted: the claim-corpus ratchet now covers `docs/gtm/**`, which had previously sat outside every claim gate in the tree. All 14 findings reviewed 2026-08-02; three were genuine and are labelled, including a **material correction** to the Node0 identity table, which presented custody as clean while the mission-signing key leaked on 2026-07-21 remains unrotated. `tests/claim-corpus-gate.test.js` guards the scope against regression. `docs/public/**` and `docs/market/**` join the same list if they are ever created.)
- [ ] `npm test`, `npm run check`, `npm run llm:guidance`, and `git diff --check`
      pass on the sealing commit.

## 16. Next Micro

```text
GO: PROVE NODE0 CLOSED LOOP FROM CLEAN STATE
```

Recommended first implementation slice:

```text
Create one clean-state demo script or documented command transcript that proves
Dema setup -> status -> URP 5SAT declaration -> Covenant screen -> consent
prototype -> receipt list/read without runtime, federation, or token claims.
```
