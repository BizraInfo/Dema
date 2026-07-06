# Receipt: DEMA-ISNAD-MODERN-TUI-DESIGN-CANON-1A

Truth label: `DESIGN_CANON_DOCS_ONLY` — a written design constitution enforced by a review gate.
**DOCS-ONLY · NO RUNTIME.**

## Slice

Canonizes Dema's TUI/GUI design language as **Isnād Modern**: a proof-first, bilingual,
zero-external-request, geometric interface doctrine. The screen is a proof object; beauty follows
provenance. Governs the future First Light GUI and Homebase TUI slices; implements neither.

## Artifacts

- `docs/design/DEMA_ISNAD_MODERN_DESIGN_SYSTEM_v0_1.md` — the seven laws + color/typography/
  evidence-chip/geometry/motion/accessibility doctrine.
- `docs/design/DEMA_TUI_HOMEBASE_BLUEPRINT_v0_1.md` — cockpit layout + slash-command / prompt-library /
  prompt-chain / input-context / receipt-rail / mission / Proof-Room UX contracts.
- `scripts/review/dema-isnad-modern-design-canon-check.mjs` — the enforcing gate.
- `tests/dema-isnad-modern-design-canon.test.js` — binds the gate to the docs.

## Proof Contract

The gate (`assessDesignCanon`) passes only while the design-system doc carries all eight doctrine
markers verbatim (ZERO-EXTERNAL-REQUEST · GOLD ONLY WHERE PROOF EXISTS · EVERY NUMBER WEARS AN
EVIDENCE CHIP · ARABIC IS FIRST-CLASS · CONSENT IS NEVER MYSTERIOUS · ERRORS ARE NEVER MYSTERIOUS ·
PROOF STATUS IS NEVER HIDDEN · DOCS-ONLY · NO RUNTIME), the blueprint specifies all seven cockpit UX
contracts, and no canon doc makes an affirmative implementation / live-runtime / mint / URP /
federation claim. Any missing marker/section or any forbidden claim fails the gate closed.

`npm run check` runs `dema-isnad-modern-design-canon-check.mjs`.

## What this proves

Dema has an **enforceable visual constitution** — a fixed, gate-checked doctrine the future interface
slices must conform to. The design is falsifiable in prose before a pixel exists.

## What this does NOT prove

It implements nothing. **No live runtime, no GUI/TUI implementation, no mint, no URP, no federation.**
It does not render, measure, or certify any built interface. It is **not** added to the capability
truth registry (registry stays 36) because a design doctrine is not a measured code capability — a
registry row would be a category overclaim. Conformance of a real UI needs its own implementation
slice with its own tests.

## Commands

```bash
node scripts/review/dema-isnad-modern-design-canon-check.mjs --json
node --test tests/dema-isnad-modern-design-canon.test.js
npm run check
```
