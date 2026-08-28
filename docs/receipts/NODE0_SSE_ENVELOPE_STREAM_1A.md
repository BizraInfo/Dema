# Receipt: NODE0-SSE-ENVELOPE-STREAM-1A

Truth label: `NODE0_SSE_ENVELOPE_STREAM_MEASURED_REPO`

## Slice

Pure hash-chained SSE event-envelope stream contract: ordered, gap-detecting, tamper-evident, exactly-once terminal — the verifiable wire law for the PROD-02 persistent transport.

```text
plan → build → verify → tamper-reject
```

## Proof Contract

The default gate must pass only while:

- the exact GO phrase matches byte-for-byte,
- the canonical payload is content-addressed,
- verification re-derives from the body and rejects tamper,
- a forged body with a recomputed hash is still rejected,
- the boundary stays all-false (no execution authority).

Slice-specific laws proven by `tests/node0-sse-envelope-stream.test.js` (19 tests):

- **Order**: seqs are derived 1..n by the builder (callers cannot create gaps); the verifier refuses any gap, duplicate, or non-consecutive sequence.
- **Chain**: every envelope binds its predecessor's hash; genesis binds null. Recomputation of each `event_hash` over its body minus the hash field catches any flipped byte (`event_N:event_hash_mismatch`).
- **Completeness**: exactly one `stream_end`, always last — `terminal_missing` and `event_N:after_terminal` are distinct refusals.
- **Liveness honesty**: heartbeat payloads must be exactly `{}` — liveness advances the sequence without smuggling application state.
- **Wire round-trip**: `serializeSseFrames → parseSseFrames` preserves envelopes exactly, the parser refuses incomplete/mismatched/unknown-field frames by name, and the round-tripped stream re-verifies.

Known limit (stated in the test source too): internal consistency alone does not
defend against a forged body with a recomputed hash. Launder-resistance arrives
when this slice gains an independent anchor (signature or externally measured
stream head) — until then no such claim is made.

Moat articulation (NODE0-SSE-ENVELOPE-STREAM-MOAT-1A):
  - SSE envelope stream + 4-rail trace diagnostic moat is observable and testable
  - Each property (provenance, consistency, disambiguation, corroboration) is a
    named law instead of a hope
  - Triple-negative controls: tampered hash rejected, mutated frame rejected,
    dropped terminal rejected
  - Promotion gate: `INSIGHT_AUTHORIZED` requires all four rails pass; any
    failure yields `REMAIN_TRACE` or `BLOCKED`
  - Test: `tests/node0-sse-trace-moat-articulation.test.js` (3 subtests, all pass)

`npm run check` runs `node0-sse-envelope-stream-check.mjs` and keeps `NODE0_SSE_ENVELOPE_STREAM_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/node0-sse-envelope-stream.test.js
node scripts/review/node0-sse-envelope-stream-check.mjs --json
npm run check
```
