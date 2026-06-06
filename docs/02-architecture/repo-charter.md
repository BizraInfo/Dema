# DEMA Repo Charter

## Purpose

This repository contains the complete product-facing surface of BIZRA. Every user interaction with the BIZRA system flows through DEMA — whether via the web dashboard, the CLI, or the desktop application.

## Ownership

| Area                                        | Owner             |
| ------------------------------------------- | ----------------- |
| Product surface, UX, packaging              | DEMA (this repo)  |
| Constitutional runtime, chain, trust engine | `bizra-omega`     |
| Knowledge substrate, data lake              | `bizra-data-lake` |

## Principles

1. **One face** — DEMA is the only user-facing repo. No other repo ships UI.
2. **No shadow state** — Every persisted state has a visible surface.
3. **Core truth is consumed, not created** — DEMA reads from the gateway; it never invents constitutional truth.
4. **Local-first memory** — User memory lives on the user's machine in human-readable format.
5. **Explicit consent for actions** — Browser and computer operators require per-action approval.
6. **Citation-first research** — Every research answer carries source citations.
7. **Receipt-first actions** — Every completed action produces a verifiable receipt.

## Monorepo conventions

- **`apps/`** — Deployable applications (web, cli, desktop)
- **`packages/`** — Shared libraries (schemas, sdk, design-system, mcp, prompts)
- **`integrations/`** — External system bridges (gateway, auth, telemetry)
- **`docs/`** — Product, UX, architecture, security, ops documentation
- **`e2e/`** — Cross-app end-to-end tests
- **`scripts/`** — Dev tooling and CI helpers

## Build system

- **Package manager:** pnpm with workspaces
- **Task runner:** Turborepo
- **Lint/Format:** Biome
- **TypeScript:** strict mode, project references
- **Test:** Vitest (unit/integration), Playwright (e2e)

## Naming conventions

- Package names: `@dema/<name>` (e.g., `@dema/schemas`, `@dema/sdk`)
- App names: `@dema/web`, `@dema/cli`, `@dema/desktop`
- File naming: kebab-case for files, PascalCase for React components
- Branch naming: `feat/<scope>`, `fix/<scope>`, `docs/<scope>`

## Gateway contract rule

DEMA may only access core BIZRA data through contracts defined in `packages/sdk/`. Adding a new core concept requires:

1. Contract type added to `packages/schemas/`
2. SDK method added to `packages/sdk/`
3. Gateway endpoint confirmed in `bizra-omega`
4. `scripts/sync-contracts.sh` updated and passing
