# Receipt: DEMA-FDE-FORWARDER-DIAGNOSTIC-1A

Truth label: `DEMA_FDE_FORWARDER_DIAGNOSTIC_MEASURED_REPO`

## Slice

Route a completed FDE dual-diagnostic report to a single fail-closed forwarding destination under the Diagnostic Doxology; routing proposes, never executes.

```text
plan → build → verify → tamper-reject
```

## Proof Contract

The default gate must pass only while:

- the exact GO phrase matches byte-for-byte,
- the canonical payload is content-addressed,
- verification re-derives from the body and rejects tamper,
- a forged body with a recomputed hash is still rejected,
- the boundary stays all-false (no execution authority).

Doxology invariants the tests pin:

- all ten upstream failure classes land inside the closed six-destination
  vocabulary — no mint / execute / autopatch / deploy / merge route exists;
- `github_actions_billing_lock` forwards as `ci_unavailable_operator_action`
  with `code_implicated_forwarded: false`, and a report claiming billing lock
  plus `code_implicated: true` is rejected outright;
- `mint_blocked: true` and `connected_claim_made: false` hold on every routing;
- a vacuous (key-omitting) boundary is rejected against the canonical key set.

`npm run check` runs `dema-fde-forwarder-diagnostic-check.mjs` and keeps `DEMA_FDE_FORWARDER_DIAGNOSTIC_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/dema-fde-forwarder-diagnostic.test.js
node scripts/review/dema-fde-forwarder-diagnostic-check.mjs --json
npm run check
```
