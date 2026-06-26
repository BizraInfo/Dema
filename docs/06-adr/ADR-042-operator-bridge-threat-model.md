# ADR-042: Operator Bridge Threat Model

**Status:** Accepted

**Date:** 2026-06-26

**Decision makers:** Mumu (Mohamed Beshr)

**Slice:** OPERATOR-BRIDGE-THREAT-MODEL-1A (docs · test · review gate only)

## Context

After [CONSENT-MATRIX-COVERAGE-1A](../TESTING.md) (PR #272), every CLI command has a declarative risk and consent classification. The remaining residual risk is **operator-controlled bridges**: environment variables and localhost URLs that let Dema read from, or invoke, processes the operator placed on the machine.

These bridges are intentional. They connect Dema (the face) to Node0 runtime state, the cognition gateway, local LLM daemons, and optional memory-query wrappers. They are also the highest-trust configuration surface: a mis-set bridge env var can route status reads through the wrong backend, leak shell pollution into tests, or point probes at non-local hosts.

This ADR documents the trust boundary. It does **not** change runtime behavior, Node0 activation, token/wallet/URP logic, or network defaults.

## Related decisions

- [ADR-003](ADR-003-core-truth-lives-in-bizra-omega.md) — core truth via `bizra-cognition-gateway`; long-term HTTP path vs legacy shell-out
- [ADR-005](ADR-005-operator-actions-require-explicit-consent.md) — exact-string consent for operator-visible side effects
- [ADR-018](ADR-018-model-broker-promotion-path.md) — localhost-only LLM invocation gates
- PR #272 — CLI consent matrix (`packages/core/src/cli-consent-matrix-entries.js`)

## Decision

Dema treats operator bridge configuration as **explicit, documented, high-trust input**. Each bridge env var below must remain listed in this ADR, covered by review gates, and subject to the mitigations in §Mitigations.

### Trust model (summary)

```text
Operator shell / systemd / CI env
        ↓ (untrusted until validated)
Bridge env var (this ADR)
        ↓
Dema adapter / probe (read-only or consent-gated)
        ↓
External process or localhost HTTP (operator-owned)
```

**Adapter input is untrusted.** Status JSON from `DEMA_NODE0_STATUS_COMMAND` and gateway GET responses are normalized and coerced; they never bypass consent or mint receipts by themselves.

## Bridge registry

### High trust — Node0 status bridges

| Env var | Bridge class | Primary code path | Trust note |
| --- | --- | --- | --- |
| `DEMA_NODE0_STATUS_COMMAND` | node0 legacy shellout | `packages/node-adapter/src/node0-adapter.js` | Operator sets arbitrary argv; executed via `execFile` with `shell: false`, 30s timeout. Output parsed as JSON then normalized. |
| `DEMA_NODE0_ADAPTER` | node0 adapter dispatch | `packages/node-adapter/src/node0-adapter.js` | Values such as `gateway-http` select HTTP adapter. Wrong value → wrong backend or fail-closed unavailable path. |
| `DEMA_GATEWAY_URL` | node0 gateway HTTP | `packages/node-adapter/src/gateway-http-adapter.js` | **localhost-only** GET to cognition gateway (`/health`, `/chain`, `/poi/summary`, `/resources/list`). Non-localhost URLs refused (`non-localhost_gateway_url_refused`). Default `http://127.0.0.1:7421`. |

### Medium trust — localhost LLM probe bridges

| Env var | Bridge class | Primary code path | Trust note |
| --- | --- | --- | --- |
| `DEMA_OLLAMA_URL` | localhost LLM probe | `apps/cli/src/commands/fleet-readiness-gatherer.js`, `packages/core/src/llm-adapter.js` | Probe/readiness only unless separate exact-consent invoke path. Must stay on localhost. |
| `DEMA_LM_STUDIO_URL` | localhost LLM probe | same | Default talk-loop provider route; localhost GET probes. |
| `DEMA_LLAMACPP_URL` | localhost LLM probe | same | Fallback provider route; localhost GET probes. |

### Medium trust — local memory query wrapper

| Env var | Bridge class | Primary code path | Trust note |
| --- | --- | --- | --- |
| `DEMA_AGENT_DB_QUERY_PATH` | local memory query wrapper | `dema memory query` bridge | Overrides path to operator-side query wrapper; subprocess with read-only consent envelope. Operator must trust wrapper binary. |

## Threat scenarios (STRIDE-lite)

### Spoofing / tampering

- **T1:** Operator (or compromised shell profile) sets `DEMA_NODE0_STATUS_COMMAND` to a malicious binary that emits fake “ready” JSON.
  - **Impact:** Misleading status display only; Dema does not activate Node0 from status reads alone.
  - **Mitigation:** Normalize untrusted JSON; consent matrix classifies `status` as read-only with optional bridge; activation remains exact-consent gated elsewhere.

- **T2:** `DEMA_GATEWAY_URL` pointed at a remote host mimicking gateway JSON.
  - **Impact:** Would exfiltrate probe timing/metadata if allowed.
  - **Mitigation:** `isLocalGatewayUrl()` refuses non-localhost; read-only GET; no POST from adapter.

- **T3:** LLM URLs aimed at non-local endpoints.
  - **Impact:** Unintended network use during invoke paths.
  - **Mitigation:** ADR-018 localhost-only invoke gates; fleet readiness is probe-only; consent phrases required before invocation.

### Repudiation / elevation

- **T4:** Leaked bridge env vars in CI or shared shells (see env-hygiene incident 2026-05-16 with `DEMA_NODE0_ADAPTER=gateway-http`).
  - **Mitigation:** `scripts/review/env-hygiene-check.mjs` strict mode; perf benchmarks sanitize env; tests delete bridge vars in setup.

### Denial of service

- **T5:** Slow or hanging `DEMA_NODE0_STATUS_COMMAND`.
  - **Mitigation:** 30s exec timeout; fail-closed unavailable envelope with finding string.

## Mitigations (existing, must preserve)

1. **Read-only review gate** — `scripts/review/operator-bridge-threat-model-check.mjs` fails if any registry env var is absent from this ADR.
2. **Env hygiene gate** — bridge vars listed in `KNOWN_DEMA_ENV_VARS` (`scripts/review/env-hygiene-check.mjs`).
3. **Kernel purity flag** — `node0-adapter.js` execFile documented in `kernel-purity-allowlist.js` as intentional runtime-tier bridge.
4. **CLI consent matrix** — mutating commands require strong consent; status/doctor paths document bridge-only reads.
5. **Localhost refusal** — gateway adapter rejects non-local `DEMA_GATEWAY_URL`.
6. **No hidden activation** — bridge reads do not flip Node0 activation without typed GO elsewhere.

## Explicit non-goals (this ADR)

- No new runtime execution paths
- No Node0 activation change
- No network egress policy change beyond documenting existing localhost refusal
- No token, wallet, or URP behavior change
- No automatic rotation or secret management (out of scope; see `SECURITY.md` parking lot)

## Verification

- `node scripts/review/operator-bridge-threat-model-check.mjs`
- `node --test tests/operator-bridge-threat-model.test.js`
- Wired into `npm run check` after CLI consent matrix gate

## Consequences

- Future bridge env vars require ADR-042 amendment + registry update + review gate pass.
- Architecture reviews treat operator bridges as first-class trust boundaries, not implementation details.
- Cold reviewers can locate bridge semantics in under 60 seconds via this ADR and `packages/core/src/operator-bridge-threat-model.js`.
