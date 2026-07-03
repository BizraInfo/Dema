# Receipt: ABSENCE-STEWARD-READINESS-1A

Truth label: `ABSENCE_STEWARD_READINESS_MEASURED_NOT_LIVE`

## Slice

Absence Steward readiness reporting (spec
`docs/02-architecture/ABSENCE_STEWARD_PREVIEW_v0_1.md` · ADR-043): a pure
derivation kernel plus the `dema away preview` report-only CLI over the Away
Contract trio (contract + validation_result + receipt).

```text
trio → NOT_CONFIGURED / CONTRACT_VERIFIED / PREVIEW_READY / EXPIRED / REFUSED
```

Readiness is a report, never a grant. `PREVIEW_READY` authorizes nothing.
`dema away start` does not exist.

## Proof Contract

The review gate must pass only while:

- the kernel exports the expected schema + truth label,
- a missing contract derives `NOT_CONFIGURED` and a verified unreceipted pair
  derives `CONTRACT_VERIFIED` — both with `steward_started:false`,
- a laundered contract derives `REFUSED` with named blocked codes,
- two clocks stay separate: body-binding is judged as of the receipt's
  hash-protected `created_at` (the self-excluding recompute gate must pass
  before `created_at` is trusted), expiry at injected now,
- the `away` CLI does not dispatch a `start` subcommand,
- `docs/CURRENT_LIMITS.md` still says absence stewardship is not live.

`npm run check` runs `absence-steward-readiness-check.mjs` and keeps
`ABSENCE_STEWARD_READINESS_1A` at `MEASURED_REPO` (repo-measured kernels;
runtime stays `PREVIEW_ONLY`).

## Commands

```bash
node --test tests/absence-steward-readiness.test.js tests/away-contract-cli-preview.test.js
node scripts/review/absence-steward-readiness-check.mjs --json
npm run check
```

## Non-claims

No live absence stewardship · no steward runtime · no daemon · no scheduler ·
no unattended execution · no model invocation · no network · no mint · no
wallet · no `dema away start` (does not exist). Readiness reporting is not
stewardship — it only tells the human, honestly, whether the paper is in order.
