# DRS-FIXTURE-PUBLISHER-1A

Truth label: `DRS_FIXTURE_PUBLISHER_MEASURED_REPO`

## Purpose

Realm Shell simulated-feed harness: scenario transcript builders stamped simulated:true end-to-end, proving fixtures can never render as production truth

## Input Contract

```js
runDrsFixturePublisher({ consent, input })
```

Exact consent:

```text
GO: dema realm fixture publisher
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
verifyDrsFixturePublisher(payload)
```

Body-bound re-derivation. Tampering any field breaks the bind.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority


## Harness laws (what this freezes from ICD §67 / PRD FR-101)

```text
FIXTURE_MARKER      SIMULATED_FIXTURE (reason code rides beside the flag)
scenarios           idle · mission_work · refusal · recovery · integrity_breach
component identity  node0.realm_projection.fixture (production ids REFUSED)
stamp point         inside sign(), BEFORE digest -> markers are signed bytes
propagation         reducer ORs contributing markers into render.simulated
qualification       expected-state table per scenario; breach expects UNKNOWN
```

Drift rulings pinned for P0:

1. Simulation is STRUCTURAL (marker propagation + distinct component id), not
   signature-based — the envelope-anchor ceiling of sibling slices applies.
2. A failed qualification hashes null-normalized fields so the failure itself
   is content-addressable and can never verify green.
3. Fixtures satisfy rendering-behavior qualification only (ICD §5.2); they can
   never satisfy the real Node0 feed gate (A4).

## Files

```text
packages/core/src/drs-fixture-publisher.js
tests/drs-fixture-publisher.test.js
scripts/review/drs-fixture-publisher-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/DRS_FIXTURE_PUBLISHER_1A.md
docs/02-architecture/DRS_FIXTURE_PUBLISHER_v0_1.md
```

## Commands

```bash
node --test tests/drs-fixture-publisher.test.js
node scripts/review/drs-fixture-publisher-check.mjs --json
npm test
npm run check
```
