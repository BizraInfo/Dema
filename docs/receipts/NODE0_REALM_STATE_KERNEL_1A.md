# Receipt: NODE0-REALM-STATE-KERNEL-1A

Truth label: `NODE0_REALM_STATE_KERNEL_MEASURED_REPO`

## Slice

Reconstruct Node0 realm state deterministically from durable event history while preserving an all-false execution boundary.

```text
plan → reduce (replay) → build → verify → tamper-reject
```

## Proof Contract

The default gate must pass only while:

- the exact GO phrase matches byte-for-byte,
- the injected event history replays deterministically (same events → same content hash),
- every event binds to the chain: contiguous seq, `prev_event` == prior `event_id`, `event_id` re-derives over canonical bytes,
- authority only narrows (`authority_widening_rejected` otherwise),
- asset promotion requires a recorded `PASS` verdict (`asset_promotion_without_pass_verdict` otherwise),
- an unknown event kind, broken chain, or malformed payload halts the replay fail-closed with a named block and no partial realm state,
- the canonical payload is content-addressed and verification re-derives the hash over the whole body, rejecting stale-hash tamper,
- the boundary stays all-false (no execution authority).

**Known limit (do not overclaim):** verification is internal-consistency only. A forger who
changes a field AND recomputes the hash produces a self-consistent body this slice cannot
reject — that requires an independent anchor (signature or externally measured state hash),
which is a later slice. The focused test documents this boundary.

`npm run check` runs `node0-realm-state-kernel-check.mjs` and keeps `NODE0_REALM_STATE_KERNEL_1A` at `MEASURED_REPO`.

## Evidence (2026-07-18, worktree `feat/node0-realm-state-kernel-1a` @ base 6125469)

- Focused test: 19/19 green (`node --test tests/node0-realm-state-kernel.test.js`).
- Slice gate `--json`: `ok: true`, all-false boundary, content hash emitted.
- Registry test: 18/18 (capability count 65→66).
- `kernel-purity-check`: 0 violations. `canonical-json-v1-check`: PASS. `no-overclaim`: no warnings.

## Commands

```bash
node --test tests/node0-realm-state-kernel.test.js
node scripts/review/node0-realm-state-kernel-check.mjs --json
npm run check
```
