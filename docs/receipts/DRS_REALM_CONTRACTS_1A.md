# Receipt: DRS-REALM-CONTRACTS-1A

Truth label: `DRS_REALM_CONTRACTS_MEASURED_REPO`

## Slice

Realm Shell IF-01 wire law: hello/resync/event schemas, source admission, sequence+digest chain, state evidence constraints, TTL freshness

```text
plan → build → verify → tamper-reject
```

## Proof Contract

The default gate must pass only while:

- the exact GO phrase matches byte-for-byte,
- the golden G-02 transcript (HELLO → snapshot IDLE → THINKING → WORKING → VERIFYING(SAT_ACTIVE) → VERIFIED_DONE with evidence ref) walks the FSM cleanly to `visible_state: VERIFIED_DONE`,
- the canonical payload is content-addressed and verification re-derives from the body,
- a deliberately tampered copy fails the tamper probe,
- the boundary stays all-false (no execution authority).

**Honesty note:** like every slice of this shape, the payload envelope has NO
independent external anchor — a forged body WITH a recomputed hash is not
rejected by this gate alone. Launder-resistance requires a signature or an
externally measured state hash and stays out of scope here. The WIRE-law
digest chain inside the transcript is stronger: each event body must re-derive
its own carried digest (`DIGEST_MISMATCH`), which is what G-05 proves.

### Wire law pinned by this slice

- Admission: exact `authority_delta == 0` (missing refuses; no default shim),
  SO_PEERCRED uid/pid binding, component/revision/contracts_digest match,
  fail-closed executable-digest hook (`SOURCE_IDENTITY_UNKNOWN` over silent
  downgrade).
- FSM: no incremental event before the resync snapshot
  (`PROTOCOL_PHASE_VIOLATION`, documented §91 extension); any close degrades
  visible state to UNKNOWN and demands a fresh HELLO+snapshot.
- Sequence table (ICD §28 order): duplicate+same digest idempotent-ignore;
  duplicate+different digest `DUPLICATE_CONTRADICTION`; lower
  `SEQUENCE_ROLLBACK`; beyond expected `SEQUENCE_GAP`; chain check runs AFTER
  duplicate classification so a byte-identical replay of the last event is
  never misread as a broken chain.
- State constraints: WORKING needs mission binding; NEEDS_HUMAN needs attention
  count or reason code; VERIFYING needs a `SAT_*` code; REFUSED needs a valid
  policy code; VERIFIED_DONE needs mission binding AND ≥1 evidence ref;
  RECOVERY needs a recovery-class code.
- Freshness: Fresh ≤1000ms ≤ Aging ≤2500ms ≤ Stale; disconnected → OFFLINE;
  stale → UNKNOWN; no retained success survives lost freshness.

`npm run check` runs `drs-realm-contracts-check.mjs` and keeps `DRS_REALM_CONTRACTS_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/drs-realm-contracts.test.js
node scripts/review/drs-realm-contracts-check.mjs --json
npm run check
```

## Amendment 2026-08-25 — frame decode law (C16/C17 closure)

The original receipt claimed "mirrors ICD C01–C20" but C16 (oversize
frame) and C17 (malformed UTF-8) had no mirror: the kernel admitted
pre-parsed objects and never saw the frame. The claim was overbroad.
Repaired in-repo rather than narrowed:

- `decodeRealmFrame(bytes)` pins ICD §13 (`min_frame_bytes: 1`,
  `max_frame_bytes: 32768`; oversize refused before any string
  materialization or JSON parse) and §6.1 (strict fatal UTF-8, refusing
  overlong, truncated, out-of-range and CESU-8 surrogate encodings by
  name), plus `FRAME_JSON_INVALID` for non-JSON payloads.
- Codes are stable members of `REFUSAL_REASON_CODES`.
- Rust boundary service (.04) owns the socket; this kernel owns the law
  the socket must obey.
- Focused suite: 42 → 47 tests. Precedence control proves an oversize
  garbage frame reports `FRAME_OVERSIZE`, never a later-layer code.
