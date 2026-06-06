# Phase 03 — Architecture

## Architectural rule

Dema remains the product face. Node0 / bizra-omega remains the runtime and
proof authority.

```text
CLI surface
  -> local preview builder
  -> exact-consent disclosure
  -> optional upstream handoff preview
  -> local receipt viewer / verifier explanation

Never:
  -> runtime execution from Dema
  -> hidden daemon
  -> local SAT PERMIT
  -> identity artifact issuance
```

## Proposed module placement

| Concern                 | Placement                      | Reason                                           |
| ----------------------- | ------------------------------ | ------------------------------------------------ |
| Installer check/dry-run | `packages/installer/`          | Existing setup ownership                         |
| Verifier explanation    | `packages/verifier/`           | Same domain as SAT placeholder                   |
| Typed errors            | `packages/core/`               | Shared across CLI and packages                   |
| Receipt schema docs     | `docs/`                        | Contract for operators/integrators               |
| Subprocess policy       | `apps/cli/` + `packages/core/` | CLI owns invocation; core can own policy helpers |

## Boundaries

### Dema-owned

- CLI command routing.
- Local setup skeleton.
- Preview builders.
- Read-only inventory and report surfaces.
- Local receipt listing and explanation.
- Human-readable product copy.

### Upstream-owned

- Runtime mission execution.
- SAT-5 verdicts.
- Gateway POST contracts.
- Canonical receipt issuance.
- Federation and identity-bound artifacts.

## Data contracts

### Error envelope

```json
{
  "schema": "bizra.dema.error.v0.1",
  "code": "STRING_ENUM",
  "message": "human-safe text",
  "hint": "optional remediation"
}
```

### Verifier explanation envelope

```json
{
  "schema": "bizra.dema.receipt_verification_explanation.v0.1",
  "receipt_id": "string|null",
  "verifier_status": "placeholder|partial|reject|upstream_required",
  "certified": false,
  "upstream_required": true,
  "checks": []
}
```

## Scaling notes

- Flat-file memory and receipts are acceptable for alpha.
- Before broad GTM, add pagination and avoid parsing every receipt for routine
  list views.
- Do not add a database solely for alpha convenience.
- Preserve `DEMA_HOME` override for tests and operator-local isolation.

## Security notes

- `execFile` is safer than shell execution but still crosses a trust boundary.
- Any environment-provided command must be treated as trusted local
  configuration, not untrusted remote input.
- Any public subprocess route must have an allowlist, timeout, and explicit
  failure mode.
