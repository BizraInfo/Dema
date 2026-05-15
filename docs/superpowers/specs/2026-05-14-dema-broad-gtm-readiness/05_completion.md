# Phase 05 — Completion Criteria

## Definition of done for P0 broad-GTM readiness

Dema may move from lighthouse alpha toward broader GTM only when the following
are true.

## Product proof

- First-run path is documented and matches live commands.
- `dema report safety` clearly distinguishes preview from proof.
- Receipt/verifier surfaces clearly distinguish placeholder, partial, rejected,
  and upstream-certified states.
- Monetization copy continues to block token, passive-income, AGI, and public
  federation claims.

## Engineering proof

- Installer dry-run/check paths are tested.
- Existing setup remains idempotent.
- Subprocess routes are gated or removed from public surface.
- Typed errors exist for common operator failures.
- Receipt writes that mutate local state are atomic.

## Security proof

- No hidden daemon.
- No runtime execution from Dema.
- No local SAT `PERMIT`.
- No identity-bound artifacts issued from Dema.
- No secrets committed.
- No unsigned update channel used in release instructions.

## Documentation proof

- Receipt schema docs exist and match emitted fields.
- Installer docs distinguish planned endpoints from shipped endpoints.
- Package-level docs exist for at least:
  - `core`,
  - `node-adapter`,
  - `verifier`,
  - `installer`,
  - `receipts`.

## Test proof

Minimum command gate:

```bash
npm test
npm run check
git diff --check
```

Preferred additional gates:

- doc link validation;
- coverage report;
- large local receipt/memory fixture test;
- subprocess hardening tests.

## Release decision rule

If any P0 item is incomplete, Dema remains lighthouse alpha.

If all P0 items pass and the operator confirms release scope, Dema may present a
broader GTM package while still avoiding runtime/federation/identity claims.
