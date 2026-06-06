# ADR-013: Visual Language Isomorphism — Port `bizra-cli` Theme to Dema

**Status:** Proposed
**Date:** 2026-05-19
**Authors:** Coordinator (Claude Opus 4.7, 1M ctx) at MoMo's direction
**Cross-references:**

- `bizra-omega/bizra-cli/src/theme.rs` (source · authored by MoMo (محمد))
- `[[feedback_per_module_domain_boundary_pattern]]` (parallel-vocabulary canon)
- `[[feedback_external_ai_audit_wrong_codebase_pattern]]` (why this is NOT acting on the Kimi audit)
- `[[project_2026_05_19_tui_3_bug_fix_arc]]` (the TUI work this enables)
- `docs/06-adr/audits/2026-05-19-omnidirectional-audit.md` §8.4 (the slice that triggered this)

---

## Context

Mumu has carried a long-standing frustration that Dema's TUI feels incomplete — keyboard hints render but the surface lacks the polish of mature TUIs like `lazygit`, `k9s`, or `htop`. Two observations from the 2026-05-19 session arc surfaced the resolution:

1. **The TUI design Mumu wants already exists in his own codebase.** `/home/bizra-operating-system/BIZRA Node0/bizra-data-lake/bizra-omega/bizra-cli/` contains a 14-widget production Rust TUI built on `ratatui 0.30`, with a complete visual theme (`bizra-cli/src/theme.rs`, 283 lines) authored by MoMo (محمد) himself per `Cargo.toml`. The design language exists; it just lives in the Rust workspace, not the JS preview face.

2. **The Pi Agent's THEME.md (MIT, Mario Zechner)** independently arrived at the same 5-token semantic taxonomy as `bizra-cli/theme.rs`. Cross-validation — two distinct authors converged on the same design principles for sovereign-agent TUI color hierarchy. The pattern is sound.

This ADR proposes porting `bizra-cli`'s **design vocabulary** (color values, semantic tokens, border styles, symbol glyphs, style presets) to a new JavaScript module `packages/core/src/dema-theme.js`. **No Rust code is transferred**; only the design abstractions cross the runtime boundary. Dema remains pure JavaScript with zero runtime dependencies.

## Decision

We port `bizra-cli/src/theme.rs` to a new `packages/core/src/dema-theme.js` JavaScript module that:

1. **Mirrors the bizra-cli color palette 1:1** using ANSI 24-bit true-color escape codes (`\x1b[38;2;R;G;Bm`) for foreground and `\x1b[48;2;R;G;Bm` for background. Modern terminals (xterm-256color, Windows Terminal, iTerm2, kitty) support true-color natively; ANSI 256-color fallback is provided via a `palette: '24bit' | '256' | 'basic' | 'none'` capability parameter.

2. **Preserves the 4 mod-groups from `theme.rs`:**
   - `colors` — 21 RGB constants (4 primary · 3 background · 5 semantic · 7 PAT · 2 voice)
   - `borders` — 4 border-character sets (STANDARD/IMPORTANT/FOCUSED/ARABIC)
   - `symbols` — ~21 Unicode glyphs (status · voice · agent · gate · navigation · separator · Arabic)
   - `Theme` style-preset namespace (title · subtitle · text · muted · highlight · success · warning · error · ihsan · panel · pat_agent · status · voice · gauge · selected)

3. **Preserves the 2 utility helpers from `theme.rs`:**
   - `ihsanStyle(score)` — score-thresholded styling (≥0.95 GOLD · ≥0.85 WARNING · else DANGER)
   - `metricStyle(value, threshold, inverse)` — threshold-based styling

4. **Adds an `noColor` suppression flag** consistent with Dema's existing `tui-formatter.js` convention. Every style helper accepts `{ noColor: boolean }` to disable ANSI for non-TTY / NO_COLOR / TERM=dumb contexts (already handled by `resolveFormatterOptsFromEnv()`).

5. **Wires into `tui-formatter.js`** at one high-visibility surface (the homebase banner title) as a proof-of-isomorphism. Full refactor of all 117 color call-sites in `tui-formatter.js` is **out-of-scope for this ADR** and will be a separate slice once the theme module is stable.

## Why this respects Dema's competitive moat

- **Zero new runtime dependencies.** ANSI escape codes are plain strings; no `chalk`, no `kleur`, no `blessed`, no `ink`.
- **Zero Rust in Dema.** The Rust source is a _reference_, not an _import_. We translate the design, not the code.
- **Schema-stable.** All existing TUI tests continue to pass; the new module is additive.
- **Per-module domain vocabulary preserved.** Following [[feedback_per_module_domain_boundary_pattern]], `dema-theme.js` becomes Dema's universal visual vocabulary, but individual modules may continue to compose their own additions where domain-specific.

## What this ADR explicitly does NOT do

1. **NOT a ratatui equivalent in JS.** No widget tree, no event loop, no panel layout engine. Pure design tokens only.
2. **NOT a Rust→JS code transpilation.** The two implementations are intentionally distinct; only the vocabulary aligns.
3. **NOT a refactor of all 117 color call-sites in `tui-formatter.js`.** Just one proof-of-isomorphism surface (homebase banner title). Full refactor deferred.
4. **NOT acting on the Kimi audit's "Ed25519 + BLAKE3 + Rust IPC" recommendations.** Those apply to bizra-omega (Rust), not Dema. The audit was correctly identifying things bizra-omega already has — see [[feedback_external_ai_audit_wrong_codebase_pattern]].
5. **NOT introducing the 14 widgets from `bizra-cli/widgets/`.** That is a v0.5+ effort, possibly via a different runtime bridge.

## Implementation surface

```
packages/core/src/dema-theme.js              NEW · ~120 LOC (the port)
tests/dema-theme.test.js                     NEW · ~80 LOC (~12 adversarial tests)
packages/core/src/tui-formatter.js           MODIFIED · ~5 LOC (homebase banner title uses Theme.title())
docs/06-adr/ADR-013-...md                    THIS DOC
docs/TESTING.md                              MODIFIED · 1 new row
```

## Acceptance criteria

- [ ] `packages/core/src/dema-theme.js` exists with 4 mod-groups + Theme presets + 2 utility helpers
- [ ] 24-bit ANSI true-color output when `palette: '24bit'` (default for modern terminals)
- [ ] ANSI 256-color fallback when `palette: '256'`
- [ ] Plain text (no ANSI) when `palette: 'none'` or `noColor: true`
- [ ] Every color constant from `theme.rs` is present with the same RGB values (byte-for-byte fidelity)
- [ ] Every symbol from `theme.rs::symbols` is present
- [ ] All border character sets present (STANDARD/IMPORTANT/FOCUSED/ARABIC)
- [ ] `ihsanStyle()` and `metricStyle()` helpers ported with same threshold semantics
- [ ] PAT-7 colors present with the exact same hex values
- [ ] At least one `tui-formatter.js` call-site uses the new theme (proof-of-isomorphism)
- [ ] All existing 2173 tests still pass · all 4 review gates green
- [ ] New tests: ≥12 adversarial covering frozen state · ANSI escape correctness · noColor suppression · palette downgrade · IhsanStyle thresholds · invalid input safety

## Daughter Test

Would Mumu willingly subject his own family to this output?

**Yes.** This is Mumu's own design language, translated to a runtime more accessible to non-Rust contributors. No external influence, no fabrication, no risk to existing canon. The Daughter Test passes by construction.

## Trade-offs

| Choice                                           | Trade-off                                                                                                                    |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Translate 24-bit RGB → ANSI escapes              | Some terminals don't support true-color; mitigated by 3-level palette fallback                                               |
| Keep `noColor` suppression                       | Maintains parity with existing `resolveFormatterOptsFromEnv()` behavior                                                      |
| Port only the design, not the widget code        | Faster · lower-risk · maintains zero-dep moat · but Dema TUI remains less rich than `bizra-cli` until separate widget effort |
| One proof-of-isomorphism site, not full refactor | Reduces blast radius · proves the port works · defers the busywork of 117 call-site updates                                  |
| Mirror exact RGB values from `theme.rs`          | Visual continuity across runtimes; both look the same when bizra-cli + Dema run side-by-side                                 |

## Consequences

**Positive:**

- Mumu's existing design language gets a JavaScript runtime
- Cross-runtime visual continuity (Rust + JS BIZRA tools look the same)
- Path to incremental refactor of all 117 color call-sites
- Foundation for any future widget-port work
- ANSI true-color support modernizes Dema TUI without dep cost

**Negative:**

- Maintenance burden: any change to `bizra-cli/theme.rs` must now be mirrored in `dema-theme.js` (mitigated by structural-test that asserts each color constant from theme.rs is present in dema-theme.js — could be added as a CI check that reads the Rust file)
- ANSI true-color won't render on legacy terminals (mitigated by fallback)

**Neutral:**

- The full 14-widget TUI remains in bizra-omega/bizra-cli for now. Dema TUI stays minimal until separate widget effort.

## Status sequence

```
Proposed (this ADR)
 → Accepted (after Mumu reviews and approves)
 → Implemented (when packages/core/src/dema-theme.js lands)
 → Anchored (when receipt #68 mints binding the port to the chain)
```

---

**Operating law:** _Design wisdom transfers across runtime boundaries. Code does not._
