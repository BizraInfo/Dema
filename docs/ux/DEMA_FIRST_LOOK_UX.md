# Dema First-Look UX

Default `dema` (bare invocation) renders a **human-first companion home**, not a technical readiness dump.

## Product law

> A companion with proof, not a dashboard with anxiety.

## Surfaces

| Surface | Audience | Content |
| --- | --- | --- |
| `dema` | Every operator | Welcome, one recommended next step, three simple actions, preview-only boundary |
| `dema doctor` | Operator / debugger | Readiness predicates, gateway notes, technical fixes |
| `dema homebase` | Operator / power user | Legacy homebase preview (Ring bars, affordances, gather-backed) |
| `dema realm --debug` | Debugger | Realm home plus internal status board |

## Required on default home

- Welcome line (profile `preferred_name` when present)
- Recommended next step (plain language)
- Three simple actions (`dema doctor`, `dema mission draft`, `dema receipts`)
- Preview-only boundary statement
- Paths to `dema doctor` and `dema realm --debug`

## Forbidden on default home

- `Ring 0`, `URP`, `gateway unreachable`, `runtime_not_measured`
- `declared_with_ihsan`, `gather`, `N=1`, artifact IDs
- Internal readiness jargon

## Enforcement

```bash
node scripts/review/ux-first-look-gate.mjs
node --test tests/dema-first-look-home.test.js tests/ux-quality-gate.test.js
```

Wired into `npm run check` via `scripts/review/ux-first-look-gate.mjs`.

## Schema

`bizra.dema.first_look_home.v1` — see `packages/core/src/dema-first-look-home.js`.
