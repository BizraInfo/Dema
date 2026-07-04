# POI-TIME-COMPRESSION-1A

Truth label: `POI_TIME_COMPRESSION_CANDIDATE_LOCAL_ONLY`

## Purpose

Local-only PoI time-compression candidate receipt: declared baseline estimate vs declared actual duration under required quality gates; fail-closed, observation-aware, no mint.

## The four clocks (time law)

An old-world estimate is a **reference-class assumption**, not a truth. This slice
records it as `DECLARED_REFERENCE_CLASS_ASSUMPTION_NOT_MEASURED` and never lets it
masquerade as a measured fact. Four distinct clocks, never conflated:

| Clock | Definition | Compressible? |
| --- | --- | --- |
| **Proof-Time** | Scoped task start → all required gates passing | Yes — this is what the receipt measures |
| **Observation-Time** | Time reality must be observed before impact is stable (e.g. the 7-day Steward Test) | No — build speed cannot compress lived evidence |
| **Gate-Time** | Time consumed by tests, review, receipt, and safety checks | Part of proof-time; never skipped to inflate the ratio |
| **Calendar-Time** | Legacy external planning approximation | Recorded only as the declared baseline |

A compression ratio is therefore a **CANDIDATE** claim about proof-time only:
speed is not impact, cost is not value, and no receipt exists at all when a
required quality gate failed. `observation_required: true` marks life proof as
`PENDING_REAL_OBSERVATION` — a separate clock this receipt cannot close.

## CLI

```bash
dema poi compression record --task <id> \
  --baseline-hours <n> --baseline-source model_estimate|human_estimate|industry_baseline \
  --reference-class <class> --actual-hours <n> --operating-mode <mode> \
  --gates-required a,b --gates-passed a,b --observation-required true|false \
  [--json] [--receipt --consent "GO: poi time compression preview"]
dema poi compression show [--json]
dema poi compression verify [--json]
```

Receipts write only under `DEMA_HOME/poi/compression/receipts` (mode 0600,
atomic, byte-exact payload — the timestamp lives in the filename, never inside
the hashed body).

## Input Contract

```js
runPoiTimeCompression({ consent, input })
```

Exact consent:

```text
GO: poi time compression preview
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
verifyPoiTimeCompression(payload)
```

Body-bound re-derivation. Tampering any field breaks the bind.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/poi-time-compression.js
tests/poi-time-compression.test.js
scripts/review/poi-time-compression-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/POI_TIME_COMPRESSION_1A.md
docs/02-architecture/POI_TIME_COMPRESSION_v0_1.md
```

## Commands

```bash
node --test tests/poi-time-compression.test.js
node scripts/review/poi-time-compression-check.mjs --json
npm test
npm run check
```
