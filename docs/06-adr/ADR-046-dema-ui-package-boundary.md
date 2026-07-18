# ADR-046 — Dema UI package boundary (packages/dema-ui)

Status: ACCEPTED · Date: 2026-07-18 · Truth label: `LOCAL_ONLY` (app runs locally; flows `PREVIEW_ONLY`)

## Context

The Dema kernel monorepo enforces a **zero-dependency** invariant (`scripts/review/zero-dep-gate.mjs` — 0 deps/devDeps in the **root** `package.json`). This is a load-bearing moat: pure kernels, minimal trusted computing base.

The customer-facing Dema Continuum shell is a Next.js 16 / React 19 / Tailwind app (~831 npm deps). It cannot be zero-dependency. Prior to this ADR it lived untracked under `artifacts/` with no commit identity, no reviewed diff, no rollback point.

It was qualified pre-integration (`DEMA-UI-DONOR-TRUTH-TELEMETRY-0A`, 2026-07-18): P0 kernel-identifier impersonations removed, fleet rebound to canon (7 PAT + 5 SAT + dema-alpha), telemetry made observation-only + redacted + adversarially tested, fonts self-hosted (no build egress), `tsc=0`, tests `35/35`, `next build=0`.

## Decision

The UI lives at `packages/dema-ui/` and **carries its own `package.json` + dependencies**. This does NOT break the zero-dep invariant because:

1. `zero-dep-gate.mjs` scans the **root** `package.json` only — the kernel TCB is unchanged.
2. `packages/dema-ui/node_modules/` and `.next/` are git-ignored — no deps enter the tracked tree.
3. The UI is a **separate build target** (`next build`), not part of root `npm test` (which globs `tests/*.test.js`, not the UI's `packages/dema-ui/tests/*.test.mjs`).
4. The kernel review gates (kernel-purity, no-overclaim, canonical-json, style-pillar) were verified to pass with the package present; style-pillar's universal rules (LF, no trailing whitespace) still apply and are honored.

## Boundary (binding)

- `packages/dema-ui` is `LOCAL_ONLY` **by default**; all runtime flows are `PREVIEW_ONLY`/`SIMULATION_ONLY` and say so on screen.
- It reads host telemetry through `/api/node-resources` (observation-only, fixed-argv execFile, redacted). Its `x-forwarded-for` check is best-effort defense-in-depth, **not** a hard access gate — the real controls are loopback binding + the redacted observation-only payload (no hostname/user/env/token/path). Never expose this app on `0.0.0.0` without a real auth layer.
- **External-egress carve-out (honest disclosure):** `/api/melae` sends the prompt to an external LLM (`z-ai-web-dev-sdk`). This is the ONE surface that egresses. It is **fail-closed / opt-in**: disabled unless `DEMA_MELAE_EXTERNAL_LLM=1` is set, and when disabled it discloses the egress and refuses. So "no egress" holds by default; enabling melae is an explicit operator choice that leaves the local boundary.
- It never mutates node state, mints, or executes governed runtime.
- It imports NO kernel from `packages/core|mission|fate` at present; any future kernel binding is a separate ADR.
- The zero-dep invariant remains **kernel-scoped**. Any second deps-carrying package requires its own ADR.

## What this does not decide

Deployment, a public URL, CI for the UI build, or promotion of any `PREVIEW_ONLY` flow to `MEASURED`. Those are future, separately-governed decisions.
