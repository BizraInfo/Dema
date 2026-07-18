# Receipt: NODE0-REALM-STATE-KERNEL-1A

Truth label: `NODE0_REALM_STATE_KERNEL_MEASURED_REPO`

## Slice

Reconstruct Node0 realm state deterministically from an injected hash-chained event history while preserving an all-false execution boundary. Durable storage is not implemented; restart recovery is not proved by this slice.

```text
plan → reduce (replay) → build → verify → tamper-reject
```

## Proof Contract

The default gate must pass only while:

- the exact GO phrase matches byte-for-byte,
- the injected event history replays deterministically (same events → same content hash),
- every event binds to the chain: integer contiguous seq (`seq_not_integer` / `seq_not_contiguous`), `prev_event` == prior `event_id`, `event_id` re-derives over canonical bytes,
- non-canonical event content (undefined, NaN, Infinity, sparse arrays, accessors, cycles, non-plain objects) halts as `event_not_canonicalizable` — never an escaping exception,
- identity maps are null-prototype with own-key checks: `constructor` / `toString` / `__proto__` behave as ordinary identifiers and can never impersonate records,
- scope events maintain descriptive scope state: the first event initializes it, later events may only remove scopes (`authority_widening_rejected`), duplicates are rejected (`authority_scopes_duplicate`), set-equal reorderings normalize to one sorted representation, and no scope event changes the all-false execution boundary,
- asset promotion requires a recorded `PASS` verdict (`asset_promotion_without_pass_verdict`),
- events, derived state, and payload are deeply frozen — attempted mutation throws and alters neither stored values, `event_id`, `content_hash`, nor a later verification,
- field mutation without a matching hash update is rejected by body re-derivation,
- forged-and-rehashed payloads are rejected on every declared semantic invariant: schema, truth label, `canonicalization_algorithm`, `hash_algorithm`, `text_encoding`, boundary shape, `replay.ok` true with null state (`replay_state_inconsistent`), `replay.ok` false with non-null state (`realm_state_present_for_failed_replay`),
- the boundary stays all-false (no execution authority).

**Known limit (declared, not hidden):** internal semantic invariants are checked; independent authenticity is NOT proved. An attacker controlling every semantically permitted field and recomputing the hash still requires an external signature or anchor to detect — that anchor is a later slice.

`npm run check` runs `node0-realm-state-kernel-check.mjs` and keeps `NODE0_REALM_STATE_KERNEL_1A` at `MEASURED_REPO`.

## Evidence (local; remote CI qualification pending on the corrective head)

- Focused test: 25/25 (`node --test tests/node0-realm-state-kernel.test.js`).
- Adoption freeze: `tests/dema-slice-scaffold-canonical.test.js` T8 allowlist carries this kernel's canonical-json consumer registration (5/5).
- Slice gate `--json`: `ok: true`, all-false boundary, content hash emitted.
- `kernel-purity-check`: 0 violations. `canonical-json-v1-check`: PASS. `no-overclaim`: clean.

## Commands

```bash
node --test tests/node0-realm-state-kernel.test.js
node scripts/review/node0-realm-state-kernel-check.mjs --json
npm run check
```
