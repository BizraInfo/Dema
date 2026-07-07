# Receipt: NODE0-URP-GENESIS-ROOT-COMPOSITION-GATE-PREVIEW-1A

Truth label: `NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_MEASURED_REPO`

## Slice

Pure preview-only gate binding a Node0 URP genesis-root descriptor to existing URP resource-family preview surfaces under all-false boundary rules; activates nothing, mints nothing.

```text
plan → build → verify → tamper-reject
```

## Proof Contract

The default gate must pass only while:

- the exact GO phrase matches byte-for-byte,
- the embedded genesis-root descriptor re-verifies via `verifyNode0UrpGenesisRootActivationPreview` and is `local_preview_active`,
- every composed surface carries a KNOWN URP preview schema (drift-guarded against the eight real resource-kernel schema constants), an all-false boundary, and stays unpublished, preview-only settlement, non-minting, non-cost-as-impact, no-raw-data, non-federation,
- no composed-level overclaim (`live_urp`/`federation`/`mint`/`wallet`/`settlement`/`daemon`/`network`) and `authority_delta` is 0,
- the canonical verdict is content-addressed,
- a forge-and-recompute of the composition body is STILL rejected because the embedded genesis anchor is signature-backed (re-signing needs a private key the forger lacks),
- the boundary stays all-false (no execution authority).

This gate runs NO resource kernel — it validates caller-normalized surface attestations. Only the
embedded genesis-root anchor is signature-backed (launder-resistant); the resource surfaces are
content-addressed attestations whose fidelity is the caller's responsibility. It is the composition
seam above `NODE0-URP-GENESIS-ROOT-ACTIVATION-PREVIEW-1A`; it does not cross the ladder's gated
`activate` rung.

## Boundary

`local_preview_active` composition verdict only. No live URP, no offer publication, no settlement,
no mint, no wallet, no federation, no daemon, no model invocation, no network, no remote execution.
`boundary` all-false · `authority_delta` 0 · `grants_action` false · `mint_allowed` false.

`npm run check` runs `node0-urp-genesis-root-composition-gate-preview-check.mjs` and keeps `NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/node0-urp-genesis-root-composition-gate-preview.test.js
node scripts/review/node0-urp-genesis-root-composition-gate-preview-check.mjs --json
npm run check
```
