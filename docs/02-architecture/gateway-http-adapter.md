# Gateway HTTP adapter (ADR-003 implementation)

The Dema HTTP adapter consumes the live `bizra-cognition-gateway` (per [ADR-003](../06-adr/ADR-003-core-truth-lives-in-bizra-omega.md)) and composes a Dema-facing status envelope. It is the second backend for `createNode0Adapter()` — the first remains the legacy shellout to `DEMA_NODE0_STATUS_COMMAND`.

## Activation

```bash
export DEMA_NODE0_ADAPTER=gateway-http
export DEMA_GATEWAY_URL=http://127.0.0.1:7421     # default if unset
node apps/cli/src/index.js status
```

The dispatch lives in `packages/node-adapter/src/node0-adapter.js`:

- `adapterMode === "gateway-http"` → `createGatewayHttpAdapter({...})`
- otherwise → existing shellout (or `defaultStatus()` when nothing configured)

The shellout backend is unchanged. Existing tests that exercise it pass without modification.

## Endpoints consumed (read-only)

| Endpoint              | Purpose                        | Composed into                                                                       |
| --------------------- | ------------------------------ | ----------------------------------------------------------------------------------- |
| `GET /health`         | Domain identity + reachability | `gateway.{reachable, domain, health}`                                               |
| `GET /chain`          | Receipt chain head + length    | `chain.{head, length, latestTimestamp}`, `proof.latestChainHash`, `missionExecuted` |
| `GET /poi/summary`    | POI ledger summary             | `poi.{totalEntries, totalImpact, avgImpact}`                                        |
| `GET /resources/list` | Registered resources           | `resources.count`                                                                   |

The adapter NEVER calls `POST` and NEVER calls any of `/missions/*`, `/principal/activate`, `/resources/register`, `/missions/organize`. It is a pure read surface.

## Composed schema

`bizra.dema.node0_status.v0.2` — superset of the shellout adapter's `bizra.dema.status.v0.1`. Preserves the v0.1 fields that `formatStatus` and `isReadyForBoundedDiagnostic` consume (so existing CLI surface keeps working), additively extended with `gateway`, `chain`, `poi`, `resources`, `unknown`, `truth_label`, and `source`.

Example output against a healthy, empty-chain gateway:

```json
{
  "schema": "bizra.dema.node0_status.v0.2",
  "source": "gateway-http-composed",
  "truth_label": "MEASURED_PARTIAL",
  "node": "Node0",
  "human": null,
  "ready": false,
  "consoleReady": true,
  "activationGate": "EXPLICIT_GO_REQUIRED",
  "daemonStatus": "n/a-via-gateway",
  "missionExecuted": false,
  "runtimePulse": { "fired": false },
  "findings": ["Gateway live, first mission/receipt has not been issued."],
  "model": {
    "connected": false,
    "loadedModelIds": [],
    "tokenPresent": false,
    "_truth": "NOT_EXPOSED_BY_GATEWAY"
  },
  "rustBus": { "ready": true },
  "proof": {
    "latestChainHash": "0000000000000000000000000000000000000000000000000000000000000000",
    "nextArtifact": "ARTIFACT-011"
  },
  "nextAdmissibleAction": "bounded_diagnostic_activation",
  "gateway": {
    "reachable": true,
    "base_url": "http://127.0.0.1:7421",
    "domain": "bizra-cognition-gateway-v1",
    "health": "ok"
  },
  "chain": {
    "head": "0000000000000000000000000000000000000000000000000000000000000000",
    "length": 0,
    "latestTimestamp": null
  },
  "poi": { "totalEntries": 0, "totalImpact": 0, "avgImpact": 0 },
  "resources": { "count": 0 },
  "unknown": [
    "lm_studio_status_not_exposed_by_gateway",
    "pyO3_bridge_status_not_exposed_by_gateway",
    "preferred_name_not_exposed_by_gateway",
    "rust_bus_health_inferred_from_gateway_uptime"
  ]
}
```

## Honesty rules (all enforced by tests)

1. **`ready` is always `false`.** The gateway being live is necessary but not sufficient. Only the first ARTIFACT-011 issuance — driven by the governed bounded-diagnostic runtime path that lives upstream of Dema (per repo invariant #1) — flips Node0 into SPROUT readiness. The adapter cannot fabricate this flip.
2. **`truth_label`** is `MEASURED_PARTIAL` when the gateway is reachable and identifies as `bizra-cognition-gateway-v1`, otherwise `DEGRADED`.
3. **`unknown[]`** lists every conceptually load-bearing field the gateway does NOT expose. The adapter never invents values for these (no fake `lm_studio.connected`, no guessed `human`).
4. **Network failure never throws.** A connection error returns a `DEGRADED` status with one finding per failed endpoint, so `dema status` still produces an honest report when the gateway is down.
5. **`rust_bus.ready` is inferred from gateway uptime** (the gateway runs on top of the rust bus; if the gateway responds, the rust bus is up). This single inference is recorded in `unknown[]` so future readers can audit the assumption.
6. **No POSTs, ever.** The adapter is pure read. Tests assert this by recording every method/path the fake gateway sees.

## Verification

```bash
# Local-only (no network), against a fake gateway in-process:
npm test                                # 9 new tests in tests/gateway-http-adapter.test.js

# Against the real gateway (must already be running on 127.0.0.1:7421):
DEMA_NODE0_ADAPTER=gateway-http \
  node apps/cli/src/index.js status

# Both backends side by side:
node apps/cli/src/index.js status                                    # shellout (or defaultStatus)
DEMA_NODE0_ADAPTER=gateway-http node apps/cli/src/index.js status    # gateway-http
```

## Out of scope

- **Gateway uptime / process management.** Dema does not start, stop, or supervise the gateway. The gateway runs (or doesn't) under whatever process supervisor the operator configured upstream.
- **Mission submission.** `POST /mission` and friends are runtime mutations and live behind the FATE consent gate + the governed runtime path elsewhere — never from this adapter.
- **Composite Node0 health beyond what the gateway exposes.** LM Studio status, PyO3 bridge status, preferred name, etc. are explicitly `unknown`. Adding them belongs upstream (in the gateway's surface) or in a separate adapter.

## Related files

- `packages/node-adapter/src/gateway-http-adapter.js` — implementation
- `packages/node-adapter/src/node0-adapter.js` — dispatch in `createNode0Adapter()`
- `tests/gateway-http-adapter.test.js` — 9 tests (composition, ready-never-true, /health failure, domain mismatch, network failure, UNKNOWN fields, dispatch precedence, shellout fallback, purity)
- `docs/06-adr/ADR-003-core-truth-lives-in-bizra-omega.md` — binding decision this implements
- `.env.example` — declares `DEMA_NODE0_ADAPTER` and `DEMA_GATEWAY_URL`
