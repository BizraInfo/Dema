# DRS-REALM-CONTRACTS-1A

Truth label: `DRS_REALM_CONTRACTS_MEASURED_REPO`

## Purpose

Realm Shell IF-01 wire law: hello/resync/event schemas, source admission, sequence+digest chain, state evidence constraints, TTL freshness

## Input Contract

```js
runDrsRealmContracts({ consent, input })
```

Exact consent:

```text
GO: dema realm contracts wire law
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
verifyDrsRealmContracts(payload)
```

Body-bound re-derivation. Tampering any field breaks the bind.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Wire law (what this freezes from BIZRA-DRS-ICD-0A)

```text
REALM_PROTOCOL: AF_UNIX · U32_BE_LENGTH_PREFIX · UTF_8_JSON
max_frame_bytes 32768 · socket_mode 0600
heartbeat_interval_ms 1000 · default_ttl_ms 2500
SEMANTIC_STATES (11): OFFLINE IDLE LISTENING THINKING WORKING
                      NEEDS_HUMAN VERIFYING REFUSED VERIFIED_DONE RECOVERY UNKNOWN
REASON_CODES: ICD §90 registry + PROTOCOL_PHASE_VIOLATION (§91 extension)
```

Drift rulings pinned for P0 (supersede conflicting prose in the sibling docs):

1. `default_ttl_ms = 2500` with heartbeat at 1000ms — ICD/DSD majority; the
   TRD example value `2000` is an example, not the pin.
2. The RealmShell trait is the DSD shape — async `ping` / `update_presence` /
   `hide_presence` only; SDD's sync `show_presence` is dropped. IF-02/03/04
   kernels are later slices (TASK-079.04/.05).
3. `RenderRequest` carries i18n keys (`accessible_label_key`), not literals.
4. Canonicalization is CLOSED for this slice: canonical-json-v1 via
   `packages/canon` (`sha256CanonicalJsonV1`), registered in
   `CANONICAL_JSON_V1_REGISTERED_CONSUMERS`. Event digest = `sha256:<hex>`
   over canonical JSON of the event body minus `event_digest`.
5. Sequence-table precedence: duplicate classification BEFORE chain check, so
   a byte-identical replay of the last event stays idempotent.
 6. A protocol-closed session reports UNKNOWN (integrity breach), while a lost
    transport degrades to OFFLINE — freshness degradation never upgrades.
 7. Frame decode law (ICD §6.1 + §13, cases C16/C17): `decodeRealmFrame`
    refuses empty frames (`FRAME_EMPTY`), anything over 32768 bytes before any
    decode work (`FRAME_OVERSIZE`), non-UTF-8 bytes under a strict fatal
    decoder — overlong, truncated, out-of-range and CESU-8 surrogate encodings
    refuse by name (`FRAME_MALFORMED_UTF8`) — and non-JSON payloads
    (`FRAME_JSON_INVALID`). The Rust transport (.04) owns the socket; this
    kernel owns the law the socket must obey.

### IF ↔ TRD crosswalk

| ICD interface | This slice | Later slices |
|---|---|---|
| IF-01 Node0 → Presence | FULLY frozen here (schemas, admission, FSM, sequence/digest, constraints, TTL) | transport lives in the Rust service (TASK-079.04) |
| IF-02 Presence → RealmShell trait | request/response shapes named (`bizra.realm.render.v0.1`) | TASK-079.04 |
| IF-03 wrapper binding | constants only | TASK-079.05 (`HOST_BINDING_PENDING`) |
| IF-04 QML contract | semantic-state/slot table only | TASK-079.05 |
| IF-05/06/07 diagnostics/config/qualification | envelope laws reused | TASK-079.06 |

## Files

```text
packages/core/src/drs-realm-contracts.js
tests/drs-realm-contracts.test.js
scripts/review/drs-realm-contracts-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/DRS_REALM_CONTRACTS_1A.md
docs/02-architecture/DRS_REALM_CONTRACTS_v0_1.md
```

## Commands

```bash
node --test tests/drs-realm-contracts.test.js
node scripts/review/drs-realm-contracts-check.mjs --json
npm test
npm run check
```
