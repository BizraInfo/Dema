# Receipt: DEMA-MISSION-CORRIDOR-0A

Truth label: `PREVIEW_ONLY`

## Slice

Persistent mission control plane — "the mission remembers itself." Immutable
content-addressed Mission Contract + append-only hash-chained journal under
`$DEMA_HOME/missions/<id>/`; state, lease, repair budget and the exact resume
point are pure derivations from disk alone, surviving terminal/session loss.

```text
contract (sealed) → journal (append-only, hash-chained)
→ derive: state · lease · budget · resume point
→ stop always legal · tamper always fails closed
```

## Proof contract

The gate and tests pass only while:

- the contract is frozen, deterministic, content-addressed, and fail-closed
  (11 named blocks, incl. path-escaping `mission_id`);
- the journal opens with `CREATED`, follows the closed 11-state transition
  map, and rejects events after terminal states;
- any tampered byte breaks the chain (`event_hash_mismatch`);
- timestamps are monotonic; repair rounds never decrease;
- lease expiry and budget exhaustion derive from injected `now` (no clock)
  and always converge to `requires_human` — failure never widens authority;
- the resume point (branch / head SHA / failing gate / next command)
  reconstructs from contract+journal alone, in a fresh process;
- every CLI write demands its exact consent phrase, never clobbers, and refuses
  to extend a tampered journal (verify-before-append);
- the KERNEL/gate boundary is the canonical 17-key all-false set (deep-equal);
  CLI IO paths report an HONEST boundary — `filesystem_write_performed` /
  `consent_collected` true on consent-gated writes, `content_read` true on
  reads (founder-impact precedent; SAT finding on 4407189);
- STOPPED always implies `requires_human` — the kill switch hands control back.

## Commands

```bash
node --test tests/mission-corridor.test.js
node scripts/review/mission-corridor-check.mjs --json
dema mission corridor start [--id <id>] [...] --consent "GO: start mission corridor <id>"
dema mission corridor status <id> | resume <id> | stop <id> --consent "GO: stop mission corridor <id>"
npm test && npm run check
```

## What this proves

A long mission's intent, boundaries, progress, and exact resume point can
live on disk — sealed, tamper-evident, consent-gated — and be reconstructed
by a fresh process with zero chat context. This closes the context- and
observability-babysitting classes and gives execution its recovery half.

## What this does not prove

- NOT a worker: nothing executes, schedules, or runs between sessions — the
  executor remains a human-driven session reading the corridor state.
- NOT auto-merge: `checkpoint_required` is the only legal merge policy.
- NOT lease enforcement at process level — derived bookkeeping only.
- NOT canonical-json-v1 adoption (freeze respected; M5.2+ migration scope).
- NOT in the capability truth registry (row lands on promotion, when a
  corridor carries its first real campaign).
- No model, network, daemon, token, mint, PoI, federation, or live PAT/SAT.
  Boundary all-false; `authority_delta: 0`.
