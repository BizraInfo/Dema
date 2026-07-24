# Receipt: DEMA-RECOVERY-MISSION-ENGINE-1A

Truth label: `DEMA_RECOVERY_MISSION_ENGINE_MEASURED_REPO`

## Slice

Deterministic human-gated Recovery Mission state machine: declare -> reconstruct -> candidates -> human revival -> use -> verify -> seal; every transition guarded, no auto-selection, worker output is evidence not authority. Events are an **injected** event history (an array passed by the caller) — durable storage is NOT implemented and restart recovery is NOT proved by this slice.

```text
plan → reduce (replay) → build → verify → tamper-reject
```

## Proof Contract

The default gate must pass only while:

- the exact GO phrase matches byte-for-byte,
- the injected event history replays deterministically (same events -> same content hash),
- every event binds to the chain: integer contiguous seq, `prev_event` == prior `event_id`, `event_id` re-derives over canonical bytes, non-canonical event content halts as `event_not_canonicalizable` (never an escaping exception), unknown kinds are rejected,
- `MISSION_DECLARED` is the mission's first event only; every later kind requires its precondition state (`reconstruct_requires_declared_state`, `await_human_requires_candidates_ready_state`, `human_revival_requires_awaiting_human_state`, `worker_result_requires_in_use_mission_state`, `verifier_verdict_requires_verifying_state`),
- `RECONSTRUCTED` requires a non-empty `consent_id` and rejects orphan candidates (`candidate_source_lineage_empty`) and more than 7 candidates (`candidates_exceed_cap`),
- `AWAITING_HUMAN` can only be exited by `HUMAN_REVIVAL` naming a surfaced candidate — no auto-selection path exists; a mismatched choice is rejected as `revival_asset_not_a_candidate`,
- `WORKER_RESULT` is evidence only — it can only reach `VERIFYING`, never `SEALED`, by itself,
- `VERIFIER_VERDICT` seals only on `PASS` from an independent verifier (`verifier_is_generator` rejected) attesting the actually-chosen asset (`asset_not_used_in_mission` rejected); `FAIL` moves the mission to `STOPPED` with cause `verify_failed`,
- `STOP` moves any non-terminal mission to `STOPPED`, narrating one of the four declared causes; `SEALED` and `STOPPED` are terminal — any further event is rejected as `mission_already_terminal`,
- field mutation without a matching hash update is rejected by body re-derivation,
- forged-and-rehashed payloads are rejected on every declared semantic invariant: schema, truth label, `canonicalization_algorithm`, `hash_algorithm`, `text_encoding`, boundary shape, `replay.ok` true with null `mission_state` (`mission_state_inconsistent`), `replay.ok` false with non-null `mission_state` (`mission_state_present_for_failed_replay`), `current_state`/`chronology`/`seal_receipt` projections that disagree with `mission_state`,
- the boundary stays all-false (no execution authority).

**Known limit (declared, not hidden):** internal semantic invariants are checked; independent authenticity is NOT proved. An attacker controlling every semantically permitted field and recomputing the hash still requires an external signature or anchor to detect — that anchor is a later slice. This is the same limit `NODE0-REALM-STATE-KERNEL-1A` declares; do not read the forged-and-rehash tests as proof of launder-resistance beyond internal consistency.

`npm run check` runs `dema-recovery-mission-engine-check.mjs` and keeps `DEMA_RECOVERY_MISSION_ENGINE_1A` at `MEASURED_REPO`.

## Evidence

- Focused test: 34/34 (`node --test tests/dema-recovery-mission-engine.test.js`).
- Slice gate `--json`: `ok: true`, all-false boundary, content hash emitted, `current_state: "SEALED"`.
- `kernel-purity-check`: 0 violations. `canonical-json-v1-check`: PASS. `no-overclaim`: clean.

## Commands

```bash
node --test tests/dema-recovery-mission-engine.test.js
node scripts/review/dema-recovery-mission-engine-check.mjs --json
npm run check
```
