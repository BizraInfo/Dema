# Receipt: NODE0-METRICS-BASELINE-1A

Truth label: `NODE0_METRICS_BASELINE_MEASURED_REPO`

## Slice

Derive event-bound baseline metrics from an injected hash-chained realm event history; UNKNOWN is never zero; every metric carries its derivation evidence. Durable storage is not implemented (later slice).

```text
plan → build → verify → tamper-reject
```

## Proof Contract

The default gate must pass only while:

- the exact GO phrase matches byte-for-byte,
- the canonical payload is content-addressed,
- verification re-derives from the body and rejects tamper; UNKNOWN metrics carry value null and a named reason (never zero); corrupt history yields no metrics,
- stale-hash tamper is rejected by body re-derivation, and forged-and-rehashed payloads are rejected on every declared semantic invariant (schema, truth label, canonicalization/hash/encoding declarations, boundary shape, metrics/replay consistency both directions),
- KNOWN LIMIT (declared, not hidden): independent authenticity is NOT proved — an attacker controlling every semantically permitted field and recomputing the hash still requires an external signature or anchor to detect (later slice, same as NODE0-REALM-STATE-KERNEL-1A),
- the boundary stays all-false (no execution authority).

`npm run check` runs `node0-metrics-baseline-check.mjs` and keeps `NODE0_METRICS_BASELINE_1A` at `MEASURED_REPO`.

## Evidence (local; remote CI qualification pending)

- Focused test: 19/19 — derivation binding, UNKNOWN-never-zero, attempts denominator, corrupt-history propagation (`event_not_canonicalizable` through the shared reducer), forge-and-rehash invariant matrix, frozen replay receipt.
- Slice gate `ok:true` · registry 18/18 · kernel-purity 0 · canonical-json consumer PASS (T8 allowlisted) · no-overclaim clean.

## Commands

```bash
node --test tests/node0-metrics-baseline.test.js
node scripts/review/node0-metrics-baseline-check.mjs --json
npm run check
```
