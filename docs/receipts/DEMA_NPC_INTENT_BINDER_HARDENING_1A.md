# Receipt — DEMA-NPC-INTENT-BINDER-HARDENING-1A

**Truth label:** `NPC_INTENT_BINDER_PREVIEW_ONLY` · **Date:** 2026-07-02 · **Class:** LOCAL_PROOF_SLICE

## What shipped

- Kernel: `packages/core/src/npc-intent-binder-hardening.js` (`bindNpcIntent`, `verifyNpcIntentPacket`).
- Test: `tests/npc-intent-binder-hardening.test.js` — 13 tests (12 contract + purity source-scan).
- Review gate: `scripts/review/npc-intent-binder-hardening-check.mjs` (wired into `npm run check`).
- Architecture: `docs/02-architecture/NPC_INTENT_BINDER_v0_1.md`.

## Contract proven (red-first → green, 13/13)

Parses fenced + bare JSON; fail-closed rejection (non-JSON, malformed, missing
`action_type`/`target_path`); canonical 17-key all-false boundary on bound AND rejection
packets; deterministic `sha256` `packet_hash`; same intent → same hash; body-bound
`verifyNpcIntentPacket` catches field tampering; packet declares it does not prove
execution/safety/consent.

## Candidate-brief corrections (disk wins)

- Brief claimed a **"10-key"** boundary → real canonical is **17-key** `buildPreviewBoundary()`; slice binds the real matrix.
- Brief's code used `.strip()` (invalid JS) → not present on disk; kernel uses `.trim()`.
- Brief said to gate before "T1 Task Decomposition Engine #305" → **#305 (`node0-task-decomposition-engine.js`) is already on disk / merged**; the binder is its *upstream adjacent* slice, not a blocker to an unbuilt #305.

## What this does NOT prove

Not runtime, not execution, not safety/consent/authorization of any bound action, not
live agent orchestration, no mint. The packet is a preview artifact.

## Gates

`node --test tests/npc-intent-binder-hardening.test.js` (13/13) ·
`node scripts/review/npc-intent-binder-hardening-check.mjs` (OK) · registered in
`docs/TESTING.md` · wired into `scripts/check.mjs`.
