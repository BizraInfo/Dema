# NODE0-SSE-ENVELOPE-STREAM-1A

Truth label: `NODE0_SSE_ENVELOPE_STREAM_MEASURED_REPO`

## Purpose

Pure hash-chained SSE event-envelope stream contract: ordered, gap-detecting, tamper-evident, exactly-once terminal — the verifiable wire law for the PROD-02 persistent transport.

## The composition this characterizes

Envelope pattern + persistent connection + server-sent events is only a moat if
the bytes themselves are provable. This slice makes each property of that
composition a named, testable law instead of a hope:

| Composition element | Law | Refusal codes |
| --- | --- | --- |
| Envelope pattern | content-addressed event bodies; hash covers body minus hash field under the repo's ONE canonical byte contract | `event_N:event_hash_malformed/mismatch` |
| Persistent connection (order) | seq derived 1..n; chain binds every envelope to its predecessor; genesis binds null | `event_N:seq_gap_or_duplicate`, `event_N:chain_break` |
| Persistent connection (liveness) | heartbeats advance seq but MUST carry `{}` — no state smuggling through keepalives | `event_N:heartbeat_carries_state` |
| Server-sent events (wire) | `event:`/`id:`/`data:` frames carry the WHOLE envelope in the data line; parser refuses malformed frames and re-verifies on reconnect | `frame_N:incomplete/id_seq_mismatch/kind_mismatch/unknown_field` |
| Stream completeness | exactly one `stream_end`, always last | `terminal_missing`, `event_N:after_terminal` |

Downstream consumers (PROD-02 execution transport, PROD-04 live conduction)
inherit verifiable streams without trusting the connection that delivered them.

## Input Contract

```js
runNode0SseEnvelopeStream({ consent, input })
// input: { stream_id, frames: [{ kind, payload }] }
// kinds: state | heartbeat | error | stream_end (closed set)
```

Exact consent:

```text
GO: node0 sse envelope stream preview
```

## Output Contract

```text
schema
truth_label
ok
content_hash
boundary.execution_allowed (false)
blocked_by[]
```

## Verification

```js
verifyNode0SseEnvelopeStream(payload)
```

Body-bound re-derivation. Tampering any field breaks the bind.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/node0-sse-envelope-stream.js
tests/node0-sse-envelope-stream.test.js
scripts/review/node0-sse-envelope-stream-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/NODE0_SSE_ENVELOPE_STREAM_1A.md
docs/02-architecture/NODE0_SSE_ENVELOPE_STREAM_v0_1.md
```

## Commands

```bash
node --test tests/node0-sse-envelope-stream.test.js
node scripts/review/node0-sse-envelope-stream-check.mjs --json
npm test
npm run check
```
