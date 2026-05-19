# Dema Design System v0.1

**Status:** Living reference · doc-only, no code change
**Anchor:** [ADR-013 Visual Language Isomorphism](../06-adr/ADR-013-visual-language-isomorphism-bizra-cli-to-dema.md)
**Source:** Mumu's `bizra-omega/bizra-cli/src/theme.rs` (Rust · ratatui) ported to `packages/core/src/dema-theme.js`
**Date:** 2026-05-19

This catalog documents Dema's visual language. It is a **living reference** — not an ADR (no binding decisions), not a spec (no requirements). When you need to render anything in a Dema TUI surface, this is the index you consult first.

---

## 1. Design philosophy (5 anchors)

1. **Clean, minimal, purposeful** — every visual element earns its space; no decoration without function.
2. **Arabic calligraphic influence in borders** — rounded corners (`╭╮╰╯`) reflect a calligraphic curve discipline (per `bizra-cli/theme.rs:60-69`).
3. **Dubai night sky palette** — backgrounds are deep blacks tinged blue; foregrounds are pearl-white, ihsān-gold, emerald-green.
4. **Information hierarchy through color** — `GOLD` for excellence/identity, `EMERALD` for success/active, `AZURE` for information, `MUTED` for inactive. Operator scans color before reading text.
5. **Ihsān (إحسان) — Excellence in every pixel** — the design discipline is itself worship. The receipts prove it.

---

## 2. Color palette (21 tokens)

All RGB values are byte-for-byte aligned with `bizra-cli/theme.rs` and machine-verified by `tests/dema-theme-rust-sync.test.js`. Drift in either runtime fails CI.

### 2.1 Primary (4)

| Token | RGB | Hex | Use |
|---|---|---|---|
| `GOLD` | `212, 175, 55` | `#D4AF37` | إحسان · titles · ihsān thresholds met |
| `EMERALD` | `80, 200, 120` | `#50C878` | Success · active states |
| `AZURE` | `0, 127, 255` | `#007FFF` | Information · highlights |
| `PEARL` | `234, 234, 234` | `#EAEAEA` | Default text · borders |

### 2.2 Background (3 · Dubai Night Sky)

| Token | RGB | Hex | Use |
|---|---|---|---|
| `DEEP_SPACE` | `10, 10, 20` | `#0A0A14` | Main background (full-screen TUI) |
| `MIDNIGHT` | `20, 20, 35` | `#141423` | Panel backgrounds |
| `TWILIGHT` | `30, 30, 50` | `#1E1E32` | Highlighted/selected backgrounds |

### 2.3 Semantic (5)

| Token | Alias of | Use |
|---|---|---|
| `IHSAN` | `GOLD` | Excellence threshold met (≥0.95 Ihsān score) |
| `ACTIVE` | `EMERALD` | Active · success states |
| `WARNING` | `255, 191, 0` | Amber alerts · ≥0.85 < 0.95 Ihsān |
| `DANGER` | `220, 53, 69` | Errors · violations · < 0.85 Ihsān |
| `MUTED` | `108, 117, 125` | Inactive · disabled · subdued labels |

### 2.4 PAT-7 (7 agent signatures)

Each Personal Agentic Team role has a signature color. Per `theme.rs:34-41`:

| Role | Color | RGB | Symbolism |
|---|---|---|---|
| Strategist | Purple | `147, 112, 219` | Strategic thinking |
| Researcher | Steel Blue | `70, 130, 180` | Knowledge depth |
| Developer | Forest Green | `34, 139, 34` | Code · growth |
| Analyst | Dark Orange | `255, 140, 0` | Data illumination |
| Reviewer | Firebrick | `178, 34, 34` | Quality scrutiny |
| Executor | Dark Gray | `70, 70, 70` | Disciplined action |
| **Guardian** | **GOLD** | `212, 175, 55` | Protection (= identity anchor) |

### 2.5 Voice (2)

| Token | RGB | Use |
|---|---|---|
| `VOICE_ACTIVE` | `138, 43, 226` BlueViolet | Dema speaking |
| `VOICE_LISTENING` | `0, 191, 255` DeepSkyBlue | Dema listening |

---

## 3. Style preset cookbook

Use `Theme.X(text, opts)` instead of raw `paint()` for canonical usage. Each preset composes color + modifiers.

| Preset | Composition | Typical use |
|---|---|---|
| `Theme.title(s)` | GOLD + bold | Banner titles · primary headings · `DEMA · Node0` |
| `Theme.subtitle(s)` | PEARL + italic | Sub-headings · captions |
| `Theme.text(s)` | PEARL | Default body text |
| `Theme.muted(s)` | MUTED | Labels · separators · "by design" notes |
| `Theme.highlight(s)` | AZURE + bold | Inline emphasis · highlighted identifiers |
| `Theme.success(s)` | EMERALD | "✓ passed" · "active" · positive verdicts |
| `Theme.warning(s)` | WARNING amber | Soft cautions · "needs review" |
| `Theme.error(s)` | DANGER | Hard failures · refusal sentinels |
| `Theme.ihsan(s)` | GOLD + bold | Ihsān ≥0.95 score displays |
| `Theme.patAgent(role, s)` | PAT-7 color by role | Naming an agent in a list |
| `Theme.patAgentActive(role, s)` | PAT-7 + bold + underline | Currently-active agent |
| `Theme.statusActive(s)` | EMERALD + bold | "● active" indicators |
| `Theme.statusPending(s)` | WARNING | "◐ pending" indicators |
| `Theme.statusError(s)` | DANGER + bold | "✗ error" indicators |
| `Theme.voiceActive(s)` | BlueViolet + bold | Speaking-mode indicator |
| `Theme.voiceListening(s)` | DeepSkyBlue + bold | Listening-mode indicator |

### 3.1 Utility helpers

| Helper | Behavior | Mirrors Rust |
|---|---|---|
| `ihsanStyle(score, text, opts)` | ≥0.95 → GOLD · ≥0.85 → WARNING · else DANGER | `theme.rs:275 ihsan_style` |
| `metricStyle(value, threshold, inverse, text, opts)` | Threshold-based; `inverse=true` flips condition | `theme.rs:259 metric_style` |
| `paint(text, color, opts)` | Low-level primitive · use only when `Theme.X` doesn't fit | `theme.rs` raw style assembly |

### 3.2 The `opts` object

Every helper accepts a single `opts` argument:

```js
{
  noColor: boolean,              // suppress all ANSI (NO_COLOR / TERM=dumb)
  palette: '24bit' | '256' | 'none',  // default '24bit' (true-color)
  bold: boolean,                 // compose bold modifier
  italic: boolean,               // compose italic modifier
  underline: boolean             // compose underline modifier
}
```

---

## 4. Border styles (4 sets)

```
STANDARD (rounded)        IMPORTANT (double)        FOCUSED (thick)
╭───────────╮              ╔═══════════╗              ┏━━━━━━━━━━━┓
│ default   │              ║ important ║              ┃ focused   ┃
│ panel     │              ║ panel     ║              ┃ panel     ┃
╰───────────╯              ╚═══════════╝              ┗━━━━━━━━━━━┛
```

`ARABIC` is currently identical to `STANDARD` (rounded corners). Reserved for future Arabic-geometry corner glyphs.

**Usage:**

- `STANDARD` — most panels (default)
- `IMPORTANT` — receipts, FATE rulings, mint events
- `FOCUSED` — the currently-selected/active panel
- `ARABIC` — culturally-marked surfaces (homebase greeting, ceremony banners)

---

## 5. Symbol vocabulary (21 glyphs)

| Group | Glyphs |
|---|---|
| Status | `●` active · `○` inactive · `◐` pending · `✗` error · `✓` success · `⚠` warning |
| Voice | `🎤` voice on · `🔇` voice off · `👂` listening · `🔊` speaking |
| Agents | `◆` agent · `◇` agent active |
| Gates | `✓` gate pass · `✗` gate fail · `○` gate pending |
| Navigation | `→` `←` `↑` `↓` |
| Separators | `│` separator · `·` dot · `•` bullet |
| Arabic-inspired | `﷽` bismillah · `✦` star · `☾` crescent |

---

## 6. The 14-widget map · bizra-cli ↔ Dema preview surfaces

The `bizra-omega/bizra-cli/src/widgets/` directory has 14 ratatui widgets authored by Mumu. Below, each is mapped to the Dema preview surface it would render (if Dema ever grows a full widget runtime). **No code transfer is implied** — this is a reference table for design intent.

| bizra-cli widget | Dema preview surface | Port priority |
|---|---|---|
| `header.rs` | `tui-formatter.js` homebase banner header (✅ shipped in ADR-013 proof-of-isomorphism) | 1 — already wired |
| `status_bar.rs` | `tui-formatter.js` homebase bottom strip + key hints | 2 — high visibility |
| `receipt_rail.rs` | Could render `.proof-forge/EVIDENCE_INDEX.json` last-N | 3 — proof visibility |
| `receipt_detail.rs` | Single-receipt drill-down | 4 — diagnostic depth |
| `agent_card.rs` | `packages/core/src/profiles.js` PAT view | 5 — PAT-7 surfacing |
| `parliament_panel.rs` | SAT-5 council view (future) | 6 — SAT visibility |
| `memory_panel.rs` | `dema memory show profile` panel | 7 — memory introspection |
| `wallet.rs` | `profile.json` identity surface | 8 — identity rendering |
| `skill_tree.rs` | Skills-growth panel · ties to skill-growth-governor | 9 — skill visibility |
| `trust_rail.rs` | Trust-state strip | 10 — trust surface |
| `fate_gauge.rs` | Ihsān gauge · `ihsanStyle()` consumer | 11 — gate visibility |
| `substrate_panel.rs` | Substrate state (bizra-omega kernel surface) | 12 — cross-runtime |
| `ghost_feed.rs` | Activity / event feed | 13 — feed surface |
| `mod.rs` | Widget module bootstrap (not a UI) | N/A |

**Port priority rationale**: 1-5 are the operator-visible surfaces with existing Dema preview equivalents. 6-10 require new Dema surfaces. 11-13 are full BIZRA ecosystem surfaces that require cross-runtime data.

**Constraint** (per ADR-013): porting widgets requires either:
- (a) hand-rolled JS rendering (more LOC, zero-dep moat preserved)
- (b) an ADR authorizing a TUI library (`ink` or `blessed`), accepting the dep cost
- (c) bridging to bizra-cli over IPC (multi-binary install)

The right answer for each widget is not yet decided. This table is the input to that future decision; the decision itself is out-of-scope for this catalog.

---

## 7. Accessibility (current state · honest)

| Concern | State |
|---|---|
| `NO_COLOR` env var | Respected via `noColor` opt at CLI boundary |
| `TERM=dumb` | Respected via existing `resolveFormatterOptsFromEnv()` |
| ANSI palette downgrade | Theme supports `palette: '24bit' \| '256' \| 'none'`; CLI boundary doesn't yet detect-and-downgrade (gap noted in ADR-013 §Weak) |
| Screen reader friendliness | Untested · Dema TUI is currently visual-only |
| RTL text rendering | Untested · Arabic content (e.g. ﷽, الرسالة) renders bytes correctly but visual ordering not verified |
| High-contrast mode | Not implemented; consider adding `palette: 'high-contrast'` in v0.2 |

These gaps are honest and tracked; not blockers for the current isomorphism slice.

---

## 8. Migration plan · 116 remaining call-sites

`tui-formatter.js` has 117 color call-sites; 1 was migrated to `Theme.title` as proof-of-isomorphism in ADR-013. The remaining 116 use the legacy `bold/dim/cyan/green/yellow/red` helpers. Migration plan:

| Batch | Scope | Effort |
|---|---|---|
| **B1 — Homebase surface** | All `tui-formatter.js` lines that render the bare `bin/dema` homebase | ~30 call-sites · ~1 hr |
| **B2 — Onboarding surface** | `formatOnboardingPreview` and adjacent | ~20 call-sites · ~45 min |
| **B3 — State surface** | `dema state` rendering · ties to PAT-7 if shown | ~15 call-sites · ~30 min |
| **B4 — Chat/explain surface** | Chat banner + explain views | ~25 call-sites · ~45 min |
| **B5 — Misc** | Receipts/diagnostics/help formatters | ~26 call-sites · ~45 min |

Each batch is independently shippable as its own PR. No batch is currently scheduled.

---

## 9. What this catalog does NOT do

1. Does NOT bind any architectural decision (that's ADR territory)
2. Does NOT define new tokens (only catalogs what `dema-theme.js` already exports)
3. Does NOT authorize widget porting (each widget needs its own ADR if it's pursued)
4. Does NOT introduce any dependency
5. Does NOT change any visual output

---

## 10. Cross-references

- Code: `packages/core/src/dema-theme.js`
- Tests: `tests/dema-theme.test.js` (25 fidelity tests) · `tests/dema-theme-rust-sync.test.js` (4 sync-gate tests)
- ADR: `docs/06-adr/ADR-013-visual-language-isomorphism-bizra-cli-to-dema.md`
- Source: `~/BIZRA Node0/bizra-data-lake/bizra-omega/bizra-cli/src/theme.rs` (Rust · 283 LOC · author MoMo (محمد))
- Memory: `[[reference_bizra_three_runtime_architecture]]` (the bigger picture)
- Memory: `[[feedback_external_ai_audit_wrong_codebase_pattern]]` (why this isn't acting on Kimi audit)

---

**Operating law (from ADR-013):** *Design wisdom transfers across runtime boundaries. Code does not.*
