# Quality Gates (DEMA-QUALITY-DELIVERY-SPINE-1A)

Automated gates that block merge when delivery discipline regresses.

## Gate stack

| Gate               | Script                                       | What it enforces                                   |
| ------------------ | -------------------------------------------- | -------------------------------------------------- |
| UX first-look      | `scripts/review/ux-first-look-gate.mjs`      | Companion home copy; no internal jargon            |
| Delivery readiness | `scripts/review/delivery-readiness-gate.mjs` | UX + proof boundary + render-only effect class     |
| Performance budget | `scripts/review/performance-budget-gate.mjs` | First-look render, doctor gather, CLI boot budgets |

## Proof boundary

Every receipt-like surface must include:

- `what_this_proves`
- `what_this_does_not_prove`

Missing `what_this_does_not_prove` fails the delivery readiness gate.

## Security / effect boundary (default home slice)

```text
render_only: true
writes_files: false
uses_network: false
generates_keys: false
signs_receipts: false
starts_daemon: false
touches_datalake: false
touches_tokens: false
```

## Truth labels

`DESIGNED` · `IMPLEMENTED_LOCAL` · `TESTED_LOCAL` · `MAINLINE_SEALED` · `SIGNED` · `ECONOMICALLY_MEASURED` · `NOT_LIVE`

## Run locally

```bash
npm run check
# or individually:
node scripts/review/ux-first-look-gate.mjs
node scripts/review/delivery-readiness-gate.mjs
node scripts/review/performance-budget-gate.mjs
```

## Scope boundary

Rendering and quality gates only. No runtime activation, daemon, keys, signing, Block0 seal, federation, or token/PoI runtime.
