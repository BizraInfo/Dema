# ADR-003: Core Truth Lives in bizra-omega

**Status:** Accepted
**Original date:** 2026-04-17
**Decision makers:** Mumu (Mohamed Beshr)

## Substrate clarification (2026-05-05)

`bizra-omega` is the **Rust workspace inside `bizra-data-lake`** (`github.com/BizraInfo/bizra-data-lake`), not a separate top-level repo. Validated 2026-05-05 by reading `bizra-data-lake/bizra-omega/Cargo.toml`: 27+ member crates organised as Platform Layer (bizra-core, bizra-hypergraph, bizra-inference, bizra-autopoiesis, bizra-federation, bizra-installer, bizra-python, bizra-api, bizra-tests, bizra-hunter, bizra-telescript, bizra-proofspace, bizra-resourcepool, bizra-cli) + Node0 Cognitive Layer (bizra-hooks, bizra-memory) + Action Bus (bizra-action) + TTRL Layer (bizra-ttrl) + Desktop Node Layer (bizra-agent, bizra-node) + Advanced Bindings (fate-binding, iceoryx-bridge) + Exact Arithmetic (bizra-sippar) + Mission Control Plane (bizra-mission) + Protocol Layer (bizra-protocol) + Cognition Substrate (bizra-cognition) + **Cognition Gateway (bizra-cognition-gateway — the read-only HTTP projection that this ADR describes the Dema Console consuming)**.

So the gateway boundary in this ADR is real, not aspirational. Today's Dema CLI consumes Node0 status via the adapter shellout in [packages/node-adapter/src/node0-adapter.js](../../packages/node-adapter/src/node0-adapter.js); the v0.2.1+ migration moves that toward the `bizra-cognition-gateway` HTTP surface.

## Context

The BIZRA system has a clear separation: the `bizra-omega` Rust workspace holds the constitutional runtime — missions, receipts, chain, trust engine, admissibility logic. Dema is the product face. The two communicate only through the cognition gateway.

If DEMA duplicates any core truth (e.g., reimplements receipt validation, invents its own trust scoring, or maintains a parallel mission registry), the system loses its constitutional guarantee.

## Decision

DEMA consumes core truth exclusively through the read-only gateway HTTP surface (today: [`packages/node-adapter/src/gateway-http-adapter.js`](../../packages/node-adapter/src/gateway-http-adapter.js), enforced GET-only, five endpoints: `/health`, `/chain`, `/poi/summary`, `/resources/list`, `/principal/status`). It never:

- Duplicates mission law or mission state machines
- Reimplements admissibility checks
- Creates receipts directly (only reads/displays them)
- Mutates chain truth outside approved gateway contracts
- Maintains a parallel trust score

DEMA may:

- Cache read-only snapshots for display performance
- Render trust state, manifests, and receipts
- Package and present derived views (e.g., current→ideal gap)
- Manage local-only state (preferences, UI state, research library)

## Consequences

- The approved contract surface is the gateway HTTP adapter at [`packages/node-adapter/src/gateway-http-adapter.js`](../../packages/node-adapter/src/gateway-http-adapter.js); any field the gateway does not expose is surfaced as `unknown[]` or carries a `_truth: "NOT_EXPOSED_BY_GATEWAY"` marker rather than a fabricated value.
- Any new core concept requires a gateway endpoint contract before Dema can consume it; until that contract exists, the field stays in `unknown[]`.
- Dema tests mock the gateway with a local `http.createServer` (see [`tests/gateway-http-adapter.test.js`](../../tests/gateway-http-adapter.test.js)), never the core internals.
- A future contract-sync mechanism (originally planned as `scripts/sync-contracts.sh`) is **PLANNED**, not yet implemented; until it exists, contract drift is caught only by the gateway's domain-mismatch finding (`composeNode0StatusFromGateway` returns `truth_label: "DEGRADED"` if `domain !== "bizra-cognition-gateway-v1"`).
- Breaking contract changes require coordination between Dema and `bizra-data-lake` (the substrate hosting `bizra-cognition-gateway`).
