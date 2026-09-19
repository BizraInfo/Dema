# BIZRA Unified Experience Architecture 1A

Truth label: `IMPLEMENTED_CANDIDATE_NOT_REPO_QUALIFIED`

## Decision

Merge the simulation and Dema at the **experience-model boundary**, not by copying a second runtime into the repository.

```text
/        Dema mission front door — consent and mission authority
/realm   Operational spatial projection — local realm experience
/world   Source-bound BIZRA world projection — constitution and architecture
```

## Authority law

- Dema core owns operational state.
- Mission contracts own progression.
- FATE owns effect permission.
- Receipt packages own evidence.
- `/world` owns presentation only.
- Models remain replaceable workers.
- The human remains the sovereign authority.

## Why the 43-section simulation is not copied verbatim

The archive mixes high-value design material with presentation claims, deployment files, mutable PID/database state and browser-executed demonstration code. Copying it wholesale would create a second claim surface and increase proof debt.

The unified route therefore distills the simulation into:

1. three product surfaces;
2. six authority planes;
3. one explicit source manifest;
4. one list of open gates;
5. zero runtime effects.

## Source boundary

- Simulation archive SHA-256: `d526126c4a7dee216b5c1d2f20c994fb7a6fb9c326fcf5fdb210d00bc43c7ebd`
- Simulation workspace HEAD: `3f5664ec4398236c08e2a4117d504a09bd05952a`
- Presentation checkpoint commit: `bf7e5de74137c9bab49bd27edbff045eb065e76e`
- Dema base: `53e636c81e2677756bc3b6b3178cb651c17ceb02`

Excluded: `.git`, `.env`, SQLite database, PID files, Caddy configuration, deployment scripts, upload/tool-result logs, Prisma scaffolding and `new Function` browser execution.

## Promotion gates

1. Exact-branch root `npm test` and `npm run check`.
2. `packages/dema-ui` typecheck, lint and build.
3. Browser verification for `/`, `/realm` and `/world`, including 375px viewport.
4. No public claim above the evidence carried by `CURRENT_LIMITS.md`.
5. Runtime cards may bind only to read-only receipt projections.
