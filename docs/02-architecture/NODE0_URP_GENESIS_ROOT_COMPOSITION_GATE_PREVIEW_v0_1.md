# NODE0-URP-GENESIS-ROOT-COMPOSITION-GATE-PREVIEW-1A

Truth label: `NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_MEASURED_REPO`

## Purpose

The composition seam above `NODE0-URP-GENESIS-ROOT-ACTIVATION-PREVIEW-1A`. It answers exactly one
question, purely and deterministically:

> Is this Node0 URP genesis-root descriptor allowed to COMPOSE with these existing URP preview
> resources WITHOUT activating live URP, minting, settlement, federation, daemon, model invocation,
> network, or remote execution?

It sits BELOW the activation ladder's gated `activate` rung. It runs **no** resource kernel — the
resource kernels are heterogeneous (custom vs canonical boundaries; `bizra.dema` / `bizra.node0` /
`bizra.urp` schemas; most expose no verifier). The caller NORMALIZES each real preview output into
this gate's small surface contract; the gate validates the normalized surface plus the genesis-root
descriptor.

## The URP resource family it composes over

Drift-guarded to the real kernel schema constants (`KNOWN_URP_RESOURCE_SCHEMAS`):
`resource_offer` · `multi_device_manifest` · `shared_runtime_discovery` · `shared_urp_world` ·
`supply_reward_contract` · `carrying_cost` · `contribution_benefit` · `node_resource_passport`.

## Input Contract

```js
runNode0UrpGenesisRootCompositionGatePreview({ consent, input })
// input = {
//   genesis_root,          // a built NODE0-URP-GENESIS-ROOT descriptor packet (signature anchor)
//   resource_surfaces: [{ kind, schema, valid, boundary, published, settlement_mode,
//                         mint_allowed, cost_as_impact, raw_data_exchange, federation, live }],
//   declared_flags,        // composed-level flags — all must be false
//   authority_delta,       // must be 0
// }
```

Exact consent:

```text
GO: node0 urp genesis root composition gate preview
```

## Composition rules (fail-closed)

1. genesis re-verifies via `verifyNode0UrpGenesisRootActivationPreview` (signature-backed anchor);
2. genesis `activation_status` is `local_preview_active`;
3. genesis boundary + domain flags all false (enforced by rule 1's verifier);
4. each surface has a KNOWN URP schema + all-false boundary + `valid !== false`;
5. offers stay unpublished; `settlement_mode` stays `preview_only`;
6. reward/supply surfaces stay `mint_allowed:false`; no `cost_as_impact`;
7. no raw private data export (`genesis.data_resource_policy.raw_content_leaves_node0 !== true`; no surface `raw_data_exchange`);
8. owner binds to Node0 (`node0_identity.id === "node0"`) with no person-identifying leak;
9. no composed-level overclaim of live/federation/mint/wallet/settlement/daemon/network; `authority_delta` 0;
10. the verdict carries a stable `content_hash`.

## Output Contract

```text
schema · truth_label · ok · status (composition_ready_preview | composition_blocked)
content_hash · composed_surface_count · composition_ready
boundary (all-false) · mint_allowed:false · live_urp:false · federation:false · daemon:false · network:false
what_this_proves · what_this_does_not_prove · blocked_by[]
```

## Verification

```js
verifyNode0UrpGenesisRootCompositionGatePreview(payload)
```

Body-bound re-derivation over the whole verdict, PLUS re-verification of the embedded genesis-root
descriptor. Because that descriptor carries a signature-backed receipt-chain-head anchor, a
forge-and-recompute of the composition body is still rejected (re-signing needs a private key the
forger lacks). The resource surfaces are content-addressed attestations only — not launder-resistant.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/node0-urp-genesis-root-composition-gate-preview.js
tests/node0-urp-genesis-root-composition-gate-preview.test.js
scripts/review/node0-urp-genesis-root-composition-gate-preview-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_1A.md
docs/02-architecture/NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_v0_1.md
```

## Commands

```bash
node --test tests/node0-urp-genesis-root-composition-gate-preview.test.js
node scripts/review/node0-urp-genesis-root-composition-gate-preview-check.mjs --json
npm test
npm run check
```
