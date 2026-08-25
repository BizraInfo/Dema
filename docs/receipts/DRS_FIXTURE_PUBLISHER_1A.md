# Receipt: DRS-FIXTURE-PUBLISHER-1A

Truth label: `DRS_FIXTURE_PUBLISHER_MEASURED_REPO`

## Slice

Realm Shell simulated-feed harness: scenario transcript builders stamped simulated:true end-to-end, proving fixtures can never render as production truth

```text
plan → build → verify → tamper-reject
```

## Proof Contract

The default gate (mission_work fixture) must pass only while:

- the exact GO phrase matches byte-for-byte,
- the fixture builds with every frame stamped `simulated: true` BEFORE signing
  (markers live inside event digests),
- the walk reaches VERIFIED_DONE with evidence refs AND renders
  `simulated: true` in the derived view — production-inadmissible by
  construction,
- verification re-derives from the body; a tampered copy fails the probe;
- a FAILED qualification can never verify into a green claim.

### Laws pinned

- Fixture component id is DISTINCT (`node0.realm_projection.fixture`);
  binding to a production component refuses at build.
- Stamp-at-signing: stamping after signing would break event digests — the
  wire law itself is the judge that consistency held.
- Propagation: DRS-PRESENCE-REDUCER-2A ORs any contributing simulated marker
  into the render view, so NO fixture can masquerade as production truth.
- integrity_breach qualifies as an EXPECTED refusal (state UNKNOWN) while
  staying fully marked.

**Honesty note:** same envelope-anchor ceiling as sibling slices — no external
signature anchors this payload. The production-inadmissibility of fixtures is
structural (marker propagation + component identity), not signature-based.

`npm run check` runs `drs-fixture-publisher-check.mjs` and keeps `DRS_FIXTURE_PUBLISHER_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/drs-fixture-publisher.test.js
node scripts/review/drs-fixture-publisher-check.mjs --json
npm run check
```
