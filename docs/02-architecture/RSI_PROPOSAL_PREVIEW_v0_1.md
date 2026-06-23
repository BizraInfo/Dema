# RSI Proposal Preview v0.1

Status: preview-only.  
Schema: `bizra.dema.rsi_proposal_preview.v0.1`.

## Purpose

`RSI-PROPOSAL-PREVIEW-1A` turns recursive self-improvement from an aspiration into a bounded proposal surface. The kernel can score a candidate improvement from supplied evidence and produce a deterministic proposal hash. It cannot execute, mutate files, invoke a model, start a loop, call a network, sign, mint, activate reward logic, or federate.

The design follows the Node0 discipline established by the Rosetta Constitution: declare the boundary first, then propose only what evidence supports.

## What it does

- Accepts evidence anchors, a candidate improvement, target frameworks, current score snapshots, process events, and optional SNR telemetry.
- Computes process RSI by reusing `computeProcessRsi`.
- Computes signal-to-noise only when explicit caller-supplied signal/noise telemetry is present.
- Emits `snr.verdict = NOT_SUPPLIED` and `snr.score = null` when SNR telemetry is absent, so evidence anchors never masquerade as signal quality.
- Computes a proof-hardening score from evidence coverage, target-framework coverage, and candidate structure.
- Emits a recommendation: `PROPOSE`, `HOLD`, or `REJECT`.
- Emits a deterministic `proposal_hash` over the unsigned preview body.
- Separates `proposed_action` from `executed_action`.
- Rejects missing evidence, malformed candidates, and forbidden live-runtime claims.

## What it does not do

- It does not make RSI live.
- It does not modify code.
- It does not write files.
- It does not invoke a model.
- It does not call a network.
- It does not sign or generate keys.
- It does not mint, reward, settle, or activate PoI.
- It does not activate MCP, A2A, federation, or an autonomous loop.
- It does not certify production readiness or economic value.
- Its forbidden-claim scan is a conservative tripwire, not an exhaustive policy engine.

## Boundary

Every emitted preview includes an all-false boundary:

```text
runtime_execution_performed: false
file_write_performed: false
model_invocation_performed: false
network_call_performed: false
self_change_performed: false
autonomous_loop_started: false
signing_performed: false
key_generation_performed: false
mint_performed: false
token_or_reward_activated: false
poi_activation_performed: false
federation_started: false
mcp_runtime_started: false
a2a_runtime_started: false
```

## Recommendation semantics

`REJECT` means the candidate is malformed, lacks evidence, or contains a forbidden live-runtime/economic/authority claim.

`HOLD` means the candidate is structurally safe but lacks enough supplied signal telemetry, proof-hardening, or positive process RSI to recommend review.

`PROPOSE` means the candidate is safe to review. It still does not execute.

When SNR telemetry is absent, the kernel does not fabricate a score from evidence anchors. The SNR component is excluded from the readiness weighting rather than treated as zero or one.

## Proof-of-Truth posture

| Rail | Status |
|---|---|
| Formal | Preview contract and fail-closed recommendation semantics. |
| Cryptographic | Proposal hash only; no signature. |
| Empirical | Unit tests required before merge. |
| Economic | Closed / designed-not-live. |

## Ihsan alignment

- Truth-before-hype: `truth_label` is `RSI_PROPOSAL_PREVIEW_ONLY`.
- Consent-before-action: no action is executed by the preview.
- Proof-before-reward: economic rails remain closed.
- Boundaries-before-autonomy: every effect boundary is false.
- Awareness-before-assertion: missing evidence rejects rather than invents proof.
- Signal-before-score: SNR is only scored from explicit signal/noise telemetry.

## Test surface

`tests/rsi-proposal-preview.test.js` covers deterministic hashing, frozen output, honest missing-SNR behavior, missing-evidence rejection, forbidden-claim rejection, weak supplied-SNR hold behavior, malformed-candidate rejection, boundary all-false, object evidence normalization, target-framework de-duplication, proposal-hash body binding, and purity (no fs/network/process/clock/random surfaces in the kernel).
