# Receipt: DRS-PRESENCE-REDUCER-2A

Truth label: `DRS_PRESENCE_REDUCER_MEASURED_REPO`

## Slice

Realm Shell presence reducer v2: reduce IF-01-accepted RealmEvents into an 11-state projection snapshot and i18n-keyed RenderRequest with no-stale-success freshness

```text
plan → build → verify → tamper-reject
```

## Proof Contract

The default gate must pass only while:

- the exact GO phrase matches byte-for-byte,
- the golden G-02 transcript reduces to `render_request.semantic_state: VERIFIED_DONE`
  with its evidence refs carried and freshness Fresh,
- the canonical payload is content-addressed and verification re-derives from the body,
- a tampered copy fails the (unconditional) tamper probe,
- the boundary stays all-false (no execution authority).

**Honesty note:** same envelope-anchor ceiling as every slice of this shape —
no external signature anchors the payload, so a forged body with a recomputed
hash is not rejected here. The strength of this slice is INHERITED: it renders
only what the wire law already admitted. A transcript that fails any
admission/sequence/digest/evidence constraint can only ever reduce to
UNKNOWN/OFFLINE with named blocks.

### Derivation laws pinned

- Ontology imported from DRS-REALM-CONTRACTS-1A (`SEMANTIC_STATES` re-export);
  skin-slot table 1:1 over 11 states; i18n grammar `presence.state.*` / `reason.*`.
- VERIFIED_DONE renders only with ≥1 evidence ref; WORKING only with mission
  binding — mirrored as render-level blocks.
- Unavailable telemetry → null (never zero); out-of-range percents refused;
  labels newline-stripped and capped at 120 Unicode scalars.
- Caller spelling: `admitted` canonical; `admission` accepted.
- Time enters only as injected `now_ms` / frame `__now_ms__` markers.

`npm run check` runs `drs-presence-reducer-check.mjs` and keeps `DRS_PRESENCE_REDUCER_2A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/drs-presence-reducer.test.js
node scripts/review/drs-presence-reducer-check.mjs --json
npm run check
```
