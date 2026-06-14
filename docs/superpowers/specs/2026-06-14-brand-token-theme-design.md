# Brand Token Theme Module — Design Spec

- **Date:** 2026-06-14
- **Status:** Design approved (brainstorming) → ready for writing-plans
- **Scope:** A (token module) + B (wire existing TUI files). Cockpit views, Arabic/RTL, SVG motifs are separate future spec cycles.

## Problem

The Dema TUI renders ANSI truecolor across ~10 files, but **each file hardcodes its own `const ANSI` block, and they drift from the brand canon**:

| Token | Product TUI (e.g. `dema-realm-world-map.js:23`) | Brand canon                | Status   |
| ----- | ----------------------------------------------- | -------------------------- | -------- |
| gold  | `#D4AF37`                                       | `#C9A962`                  | ❌ drift |
| green | `#10B981` (emerald)                             | `#34D399` (proof-verified) | ❌ drift |

The canonical brand tokens live in `BIZRA_VISUAL_TOKENS.json` (v0.2, sha256 `2601f1e2…`, **8 byte-identical mirrors** under `/data/bizra/.../docs/brand/`) but are **absent from the Dema repo** and **unused by the product** (`grep` for `#C9A962/#0A1628/#2DD4BF` in `packages/`/`apps/` returns nothing).

## Goal

A single source-of-truth theme module that every TUI file consumes, eliminating per-file drift and aligning the product to the brand canon.

## Non-goals (YAGNI)

- Typography / spacing tokens — terminals have no font control.
- Brand strings / taglines — later cycle.
- 256-color or non-truecolor downgrade — match the existing truecolor + `NO_COLOR` pattern.
- Cockpit views, Arabic/RTL primitives, SVG motifs — separate spec cycles.

## Architecture

1. **Vendor** `docs/brand/BIZRA_VISUAL_TOKENS.json` into the repo (faithful copy of canon sha `2601f1e2…`). Auditable source of record.
2. New **`packages/core/src/theme.js`** — the single module every TUI file imports. After migration, no file keeps its own `const ANSI` block.

## Module API — `packages/core/src/theme.js`

- **`HEX`** (frozen): canon brand colors + a clearly-separated non-canon `semantic` group.
  - **Canon** (from JSON v0.2): `gold #C9A962`, `navy #0A1628`, `originBlack #050B14`, `white #FFFFFF`, `ivory #F6F2E9`, `teal #2CB7A7`.
  - **NON-CANON semantic** (from `bizra_brand_identity_v0_2.html`, labeled in code as a TUI extension pending canon ratification): `proofVerified #34D399`, `proofPending #FBBF24`, `proofFailed #F87171`.
- **`ANSI`** (frozen): truecolor foreground codes (`\x1b[38;2;r;g;b m`) + styles (`reset`, `bold`, `dim`) built from `HEX`.
- **`ROLE`** (frozen): semantic map — `statusOk→proofVerified`, `statusWarn→proofPending`, `statusErr→proofFailed`, `accent→teal`, `brand→gold`.
- **`paint(text, code, useColor = supportsColor())`**: returns styled text; returns plain text when `useColor` is false or `NO_COLOR` is set. Matches the existing `color()` contract in `dema-realm-world-map.js`.
- **`supportsColor()`**: false if `process.env.NO_COLOR` is set or output is not a TTY; otherwise true.

## Terminal color behavior

- Truecolor `\x1b[38;2;r;g;b m` — matches existing usage.
- Respect `NO_COLOR` (https://no-color.org).
- `useColor` boolean threads through, as renderers already do.

## Migration plan (B) — incremental TDD, one file per commit

Target files (exact set confirmed at plan time): `dema-realm-world-map.js`, `status.js`, `dema-realm-board.js`, `doctor-dashboard.js`, `tui-formatter.js`, `banner-keys.js`, `network-blueprint.js`, `agent-kernel.js`, `dema-realm-status.js`, `apps/realm/dema-realm.cjs`.

Per file:

1. **RED** — update the file's tests to expect canon ANSI codes (e.g. gold `#C9A962`).
2. **GREEN** — replace local `const ANSI` with `import { ANSI, ROLE, paint } from ".../theme.js"`; map old names to semantic roles.
3. Run suite; commit.

This **intentionally changes visible output colors to canon** (e.g. gold `#D4AF37`→`#C9A962`) — a deliberate, user-visible change, not a no-op.

## Testing

- **`theme.js` unit:** ANSI builders emit correct truecolor; `paint()` returns plain text under `NO_COLOR`/`useColor=false`; `ROLE` entries resolve to expected codes.
- **Drift-guard test:** assert `HEX` canon values equal the vendored `docs/brand/BIZRA_VISUAL_TOKENS.json` (theme cannot silently drift from source). The non-canon `semantic` group is asserted against its documented hexes.
- Each migrated file's existing tests updated to canon colors; full suite green per commit.

## Units & isolation

- `theme.js`: one purpose (color tokens + ANSI). Pure except reading `process.env.NO_COLOR`/TTY. Testable in isolation.
- Consumers depend only on the stable API (`ANSI`/`ROLE`/`paint`), never internals.

## Risks & mitigations

- **Visible color change may surprise** → it is the explicit goal; tests assert canon values.
- **Files may use colors outside canon+semantic** (e.g. `ash`/dim grays) → add a documented third `neutral` group rather than smuggling new brand colors.
- **Escape-sequence snapshot churn across many files** → incremental per-file migration keeps each diff bounded and reviewable.

## Provenance

- Canon: `BIZRA_VISUAL_TOKENS.json` v0.2, sha256 `2601f1e29bbc4ef2093b63ec6ce1651ee365ffe3aba4782883064d05a9371d63`, 8 identical mirrors under `/data/bizra/.../docs/brand/`.
- Vendored copy is a faithful copy; the drift-guard test binds the module to it.

## Success criteria

- One `theme.js`; **zero** per-file `const ANSI` blocks remain (`grep` clean).
- Drift-guard test passes (theme == vendored JSON).
- Full suite green.
- `world-map` et al. render canon gold `#C9A962`, not `#D4AF37`.
