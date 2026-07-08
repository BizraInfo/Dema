# Receipt: NODE0-LOCAL-MISSION-ARTIFACT-EMISSION-PREVIEW-1A

Truth label: `NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_MEASURED_REPO`

## Slice

A pure emitter/serializer. Given an already-produced, already-verified
`NODE0-LOCAL-MISSION-HARNESS-PREVIEW` result, it re-verifies that result and
serializes it into THREE separate content-addressed preview artifacts —
a receipt, a not-applied world-state delta preview, and a DEMA report. It
composes the shipped harness kernel and re-implements none of its logic.

```text
plan → build (re-verify harness anchor → emit 3 artifacts) → verify → tamper-reject
```

## Proof Contract

The default gate passes only while:

- the exact GO phrase matches byte-for-byte (`GO: node0 local mission artifact emission preview`),
- the input harness result re-verifies (pulse → composition → signature-backed genesis anchor),
- exactly three artifacts are emitted (`receipt`, `world_state_delta_preview`, `dema_report`),
- each artifact is a JSON-serializable object with a stable `sha256:` content hash and `committed_live:false`,
- the run id and target relpaths derive deterministically from the input content hash (same input → identical run id + artifact hashes),
- the boundary stays all-false (no execution authority), `authority_delta` is 0, `mint_allowed` is false.

## Proven

- **Emission.** One verified harness result → three content-addressed artifacts, each independently re-derivable.
- **World-state is a preview.** The delta declares what a live append WOULD change (`applied:false`, `committed_live:false`); no live shelf exists and nothing is applied.
- **Determinism.** The run id is the first 16 hex of the input content hash; the same input yields identical run id and artifact hashes.
- **Fail-closed verify.** `verify` re-derives the emission hash AND each artifact hash and rejects: content-hash tamper, a tampered artifact hash, `committed_live:true`, `authority_delta≠0`, `mint_allowed:true`, laundering flags (`network_used` / `model_invocation_performed` / `token_minted` / `wallet_accessed` / `daemon_started` / `federation`), raw-source-content leakage into any artifact, and a forge-and-recompute where the embedded harness anchor no longer verifies.

## Not-Proven

- No file is written here. Any write lives in a CLI/adapter, consent-gated and atomic, under `DEMA_HOME`.
- No world-state is applied; nothing is recorded live.
- No model, network, daemon, wallet, mint, or federation is invoked.
- Serializing a preview is not executing a mission, carrying out the plan, or asserting the claims are true.

## Boundaries

- Pure kernel: no fs / network / process / clock / random. `now_iso` is INJECTED (defaults to null).
- All-false boundary invariant — serialization authority ≠ execution authority.

## Smoke commands

```bash
node --test tests/node0-local-mission-artifact-emission-preview.test.js
node scripts/review/node0-local-mission-artifact-emission-preview-check.mjs --json
node scripts/review/kernel-purity-check.mjs
npm run check
```
