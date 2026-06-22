# Delivery Operating System (DELIVERY-OPERATING-SYSTEM-1A)

**Status:** `DEMA_DELIVERY_OPERATING_SYSTEM_LOCAL_ONLY` · `mode: policy_only` · `maturity_stage: node0_delivery_control_plane`

A pure, machine-readable control plane that formalizes Dema's existing quality
machinery into one governed policy. It **describes** the delivery gates; it does
**not** run them. `current_status` is `UNKNOWN` for every gate unless a caller
supplies measured results.

- Kernel: `packages/core/src/delivery-operating-system.js` (pure — no fs, net, subprocess, or model call)
- CLI: `apps/cli/src/commands/delivery.js`
- Tests: `tests/delivery-operating-system.test.js`, `tests/delivery-operating-system-cli.test.js`
- Schema: `bizra.dema.delivery_operating_system.v0.1`

## CLI

```bash
dema delivery policy [--json]   # machine-readable gate manifest
dema delivery status [--json]   # annotate the policy with which gate commands are wired in package.json
```

The `status` subcommand reads `package.json` and passes the `scripts` object to
the pure kernel as data; the kernel itself performs no disk access. It marks each
gate `script_wired` (npm script present), `ci_enforced` (gate runs in CI, e.g. the
secret-scan), and reports `failing_blockers` / `release_ready` from any supplied
measured state.

## Gate manifest

Every gate binds to a real command on disk — npm scripts in `package.json` or the
CI secret-scan (`.github/workflows/gitleaks.yml`). No invented commands.

| Gate | Command | Category | Rail | Blocks release |
| --- | --- | --- | --- | --- |
| tests | `npm test` | tests | formal | yes |
| static-check | `npm run check` | static_check | formal | yes |
| coverage | `npm run coverage` | coverage | formal | yes |
| claims | `npm run claim:check` | claims | cryptographic_evidence | yes |
| proof-seal | `npm run pre-push:seal` | proof_seal | cryptographic_evidence | yes |
| operator-prep | `npm run layer-a5:prep` | operator_prep | cryptographic_evidence | warning-only |
| security | `gitleaks detect --source . --no-banner --verbose --exit-code 1 --redact` (CI) | security | empirical | yes |
| env-hygiene | `npm run env-hygiene` | env_hygiene | empirical | yes |
| artifact-safety | `npm run eval:layer1` | artifact_safety | empirical | yes |
| release-readiness | `npm run release:readiness` | release_readiness | empirical | yes |
| delivery-readiness | `npm run delivery:readiness-gate` | delivery_readiness | empirical | warning-only |
| performance | `npm run delivery:perf-gate` | performance | empirical | warning-only |

## Proof-of-Truth rails

- **formal** — deterministic checks (tests, static analysis, coverage).
- **cryptographic_evidence** — hash-bound / content-addressed evidence (claim ledger, pre-push seal, operator prep).
- **empirical** — measured scans and budgets (secret-scan, env hygiene, artifact safety, readiness, performance).
- **economic_designed_not_live** — PoI scoring, reward emission, token minting are **DESIGNED, not live**. No economic gate runs.

## Boundary

The kernel emits the canonical 16-key all-false preview boundary
(`buildPreviewBoundary`). It performs no runtime execution, no network, no model
invocation, no filesystem write, no federation, no token mint, and no PoI scoring.

## What this proves / does not prove

- **Proves:** the delivery process is formalized — every gate binds to a real command, maps to one rail, and declares whether it blocks release.
- **Does not prove:** that any gate passed (status is `UNKNOWN` unless measured), release readiness by itself, or any active CI/CD automation. It runs no task, deployment, or economic rail.
