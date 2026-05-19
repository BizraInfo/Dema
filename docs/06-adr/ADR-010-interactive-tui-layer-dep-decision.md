# ADR-010: Interactive TUI Layer · Dep Decision for v0.2 Homebase

**Status:** Accepted (Option D · zero-dep minimal)
**Date:** 2026-05-18 (proposed) · 2026-05-18 (accepted ~18:43 GST)
**Decision makers:** Mumu (Mohamed Beshr)
**Supersedes:** none
**Related:** [ADR-001 Dema Is One Face](ADR-001-dema-is-one-face.md), [ADR-002 No Shadow State](ADR-002-no-shadow-state.md), [ADR-005 Operator Actions Require Explicit Consent](ADR-005-operator-actions-require-explicit-consent.md), [ADR-008 Runtime Activation](ADR-008-runtime-activation.md)
**Implements:** the design framework for the v0.2 interactive layer of the Homebase TUI (phase-4 v0.1b per `docs/02-architecture/homebase-tui-v0.1-pseudocode/phase_04_render_tui_pseudocode.md`). Implementation is deferred to a separate scoped GO under whichever option this ADR settles.
**Evidence:** v0.1a visible homebase shipped at commit `1d6b85a` (2026-05-18 ~18:25 GST · `packages/core/src/tui-formatter.js` formatHomebasePreview · 17 tests N=7 first-run-green · zero new deps). Phase-4 pseudocode spec at `docs/02-architecture/homebase-tui-v0.1-pseudocode/phase_04_render_tui_pseudocode.md` (committed `fbddf3e`) prescribed Ink+React; the v0.1a slice departed from that under the zero-deps doctrine (`package.json` deps + devDeps = `{}` at HEAD).

---

## Context

v0.1a ships the **visible** homebase frame: bare `dema` on TTY renders a 76-col ANSI card with header · greeting · memory3 · status · next-action · 6 affordance keyboard hints · boundary footer. The frame functions as the operator's first-contact navigational index. Subcommands like `dema receipts`, `dema mission draft`, `dema today` remain the action verbs.

v0.2 needs the **interactive** layer:

```text
Operator on TTY at bare `dema` homebase frame
        │
        ├── presses [m]  →  homebase invokes `dema mission draft`  (L2-propose · subprocess spawn)
        ├── presses [j]  →  homebase invokes `dema today`           (L1-remember · subprocess spawn)
        ├── presses [r]  →  homebase invokes `dema receipts`        (L0-observe · subprocess spawn)
        ├── presses [b]  →  homebase opens memory browser subscreen (L0-observe · stays in TUI)
        ├── presses [?]  →  homebase invokes `dema help`            (L0-observe · subprocess spawn)
        ├── presses [q]  →  homebase exits cleanly                   (no spawn)
        └── presses other → no-op (silent)
```

Plus the consent gate UI: any L1+ effect requires the operator to **type** (not paste) a canonical phrase (per ADR-005) before the dispatch fires. The consent extractor at `packages/consent/src/consent-extract.js` already validates the typed string; the v0.2 layer would render the phrase + capture keypresses + forward to the validator.

The unresolved question — and the reason this ADR exists — is **how the keypress capture + render-loop is wired**.

## Problem

Without an explicit dep decision for the interactive layer:

1. The v0.1 SPARC pseudocode bundle (phase_04 §§4.2-4.8) prescribed Ink + JSX + React. The v0.1a slice departed from that to preserve the zero-deps doctrine. v0.2 cannot inherit that ambiguity — every reviewer asking "why no Ink?" needs a canonical answer, OR every reviewer asking "why Ink now?" needs a canonical answer.

2. The zero-deps doctrine (`dependencies: {} · devDependencies: {}`) is load-bearing in the current architecture. It is referenced in:
   - Repo `CLAUDE.md` ("Dema is the face, not the whole system")
   - 4 existing zero-dep formatters in `packages/core/src/tui-formatter.js`
   - `npm run check` integration which runs the CLI directly via `node apps/cli/src/index.js` (no build step assumed)
   - Memory anchor `project_2026_05_18_unified_installer_onboarding_tui_shipped` ("tui-formatter.js · ANSI world-class · zero new deps")

   Breaking it for Ink is a one-way decision. Once `react` + `ink` + ~120 transitive deps land in `node_modules`, removing them costs a subsequent v0.3 refactor.

3. The interactive surface is broader than just keypress. Per phase_04 §§4.5-4.8 it includes: process spawn with TTY handoff · clean unmount-on-spawn · re-render after subprocess exit · consent gate prompt with anti-paste detection · subscreen routing for `[b]` memory browser · `Ctrl+C` clean exit · `Escape` semantic. Each of these has a different cost under each candidate option.

4. The Daughter Test (per `feedback_user_audit_register` memory · GLOSSARY.md) applies: would I be willing to subject my own daughter to the supply-chain consequences of adding Ink + React + their transitive deps to a sovereign-AI homebase? The answer is non-obvious. ADR-005 ethos requires that supply-chain decisions be explicit, not silent.

## Design — four candidate options

This ADR specifies the decision framework. The actual binding decision happens at the bottom of this document under "Decision · pending typed-GO".

### Option A: Ink + JSX + React (original spec)

```text
RUNTIME DEPS    +ink (peer: react · react-dom · ~120 transitive)
BUILD STEP      JSX transform required (babel/swc/esbuild OR @babel/register
                runtime transform OR Node's experimental --experimental-vm-modules)
SCOPE           ~317 LOC for phase_04 components (per spec §4.10)
TESTABILITY     ink-testing-library or snapshot testing
KEYPRESS API    useInput hook (idiomatic React)
RESILIENCE      Ink is widely used (Vercel, Cloudflare, Prisma CLIs)
                BUT subject to React major-version churn
DOCTRINE COST   Breaks zero-deps doctrine · first runtime deps in repo
                Adds JSX build pipeline · `node apps/cli/src/index.js` no
                longer "just runs"
TIME-TO-V0.2    Highest (port from pseudocode · ~3-5 days)
DAUGHTER TEST   Marginal — Ink is reputable, but 120+ transitive deps in a
                sovereign-AI cockpit makes any single transitive maintainer
                a supply-chain attack surface on Mumu's local node.
```

### Option B: Zero-dep extension (readline + inline ANSI)

```text
RUNTIME DEPS    none new
BUILD STEP      none (continues `node apps/cli/src/index.js` direct)
SCOPE           ~150-200 LOC for keypress handler + consent prompt + subscreen
                router (smaller than Ink path because we don't need
                JSX/component framework)
TESTABILITY     Pure JS · existing test patterns extend trivially
KEYPRESS API    process.stdin.setRawMode(true) + 'keypress' events via
                node:readline.emitKeypressEvents (built-in)
RESILIENCE      Built-in Node stdlib · zero supply-chain surface
DOCTRINE COST   Zero · honors existing convention · matches the 4 prior
                zero-dep formatters
TIME-TO-V0.2    Medium (~1-2 days · simpler architecture)
DAUGHTER TEST   Pass — the only code in the homebase render path is code
                Mumu can read in one sitting. Sovereign by construction.
```

### Option C: Other terminal libraries (blessed · ink-classic · cliffy)

```text
RUNTIME DEPS    +blessed (no JSX · pure JS · 1 dep · ~5MB)
                OR +ink-classic (older Ink without React)
                OR +cliffy (Deno/Bun-native · less Node-ecosystem)
BUILD STEP      Usually none
SCOPE           Variable — blessed is screen-oriented (mouse + windows · more
                than we need); ink-classic is unmaintained as of 2025;
                cliffy is Deno-first
TESTABILITY     Mixed — blessed has no first-party test lib
KEYPRESS API    Library-specific (blessed: screen.key; cliffy: prompt)
RESILIENCE      Per-library risk varies; none have Ink's adoption curve
DOCTRINE COST   Still adds a runtime dep · less heavy than Ink but
                same direction
TIME-TO-V0.2    Variable
DAUGHTER TEST   Per-library audit required · same surface concern as Ink
```

### Option D: Hybrid — keep static frame + minimal readline keypress (RECOMMENDED)

```text
RUNTIME DEPS    none new
BUILD STEP      none
SCOPE           ~80 LOC for keypress handler + ~60 LOC for consent prompt
                + ~40 LOC for memory browser subscreen (also a static render
                + re-prompt loop) · ~180 LOC total
TESTABILITY     Pure JS · spawnable subprocess tests via DEMA_FORCE_TTY
                test-only env var
KEYPRESS API    process.stdin.setRawMode + readline.emitKeypressEvents
                (built-in · same as Option B but smaller scope)
RESILIENCE      Stdlib only · zero supply-chain surface
DOCTRINE COST   Zero · honors zero-deps doctrine + adds the minimum
                interactive surface needed for the 6 v0.1 affordances
TIME-TO-V0.2    Medium-low (~1-1.5 days)
DAUGHTER TEST   Pass — same reasoning as Option B
```

Option D differs from Option B in scope: B writes the FULL phase_04 spec at zero-dep level (including memory browser subscreen as a separate rendered screen with re-key-handling); D ships the MINIMUM interactive layer (6 single-key dispatches · 1 consent prompt · `[b]` memory browser can degrade to "spawn `dema memory list` subprocess" for v0.2 simplicity).

## Trade-off matrix

| Dimension | Option A · Ink | Option B · Full zero-dep | Option C · Other lib | Option D · Minimal zero-dep |
|---|---|---|---|---|
| Doctrine cost | High (first deps) | Zero | Medium (1 lib) | **Zero** |
| Supply-chain surface | High (~120 deps) | Zero | Medium (1 lib) | **Zero** |
| Build step required | Yes (JSX) | No | No | **No** |
| Time-to-v0.2 | 3-5 days | 1-2 days | Variable | **1-1.5 days** |
| LOC delta | ~317 | ~150-200 | Variable | **~180** |
| Match to existing pattern | No (new architecture) | Yes (extends tui-formatter convention) | No | **Yes** |
| `dema receipts` cold-start cost | Same (dynamic import) | Same | Same | **Same** |
| Subscreen complexity (memory browser) | Native Ink | Re-render loop | Library-specific | Deferred to v0.3 (subprocess spawn `dema memory list`) |
| Daughter Test posture | Marginal | Pass | Per-library | **Pass** |
| Reversibility (`git revert` cost) | Hard (deps + build) | Easy | Medium | **Easy** |
| ADR-005 consent gate fit | Native | Native | Native | **Native** |
| Riba-Zero coherence | N/A · UI layer only | N/A · UI layer only | N/A · UI layer only | **N/A · UI layer only** |

**Recommendation: Option D.**

Rationale: Option D delivers the v0.2 interactive surface at the smallest scope and matches the doctrine that the v0.1a render slice already honored. Option B is a close second (full pseudocode-spec parity at zero-dep). Option A is the spec's original target but requires a deliberate doctrine shift that no other slice in this codebase has demanded. Option C trades one supply-chain liability for a smaller one without removing the surface.

If Option D ships and v0.3 demands a richer presentation layer (rich text · animations · split-pane layouts · scrolling), reopening the dep decision at THAT moment under a fresh ADR is honest. Adding Ink prematurely costs more reversibility than postponing it costs feature lag.

## Canonical refusals (binding regardless of which option ships)

```text
NEVER_INVOKE_ON_RENDER:
  · file_system_write_under_render_path
  · network_call_during_render
  · model_invocation_during_render
  · chain_advance_during_render
  · receipt_mint_during_render
  · spawn_unbounded_subprocess (only the 6 v0.1 affordances · whitelist)

NEVER_DISPATCH_WITHOUT_CONSENT:
  · L1+ effects require exact-string typed-GO per ADR-005
  · Pasted consent phrase MUST be detected and refused
  · Detection heuristic: > 50 chars within 100ms of last input
  · Typed-GO content forwarded to packages/consent/src/consent-extract.js
    validator · render layer does NOT implement the validator itself

NEVER_OVERRIDE_TTY_DECISION:
  · If process.stdout.isTTY === false at dispatch entry, render falls back
    to JSON (existing phase-5 behavior · ADR-008 reachability)
  · Render layer does NOT force TTY · does NOT attempt to upgrade non-TTY
    sessions

NEVER_PERSIST_OPERATOR_INPUT:
  · Keypress history NOT logged to disk or memory
  · Typed consent phrases NOT echoed back after validation
  · No telemetry · no usage_count · no streak counters
```

## What does NOT change regardless of option

Independent of which option ships, these contracts are preserved:

- **The JSON form (phase-5 dispatch)** continues to emit identical bytes for `--json` / non-TTY / `DEMA_NO_TUI` / `NODE_ENV=test`. Smoke-boundary continues to verify the 14th canonical spine surface via `dema --json`. The render layer is a presentation choice; the canonical contract lives in JSON.
- **`buildHomebasePreview()`** stays pure, frozen, deterministic. Render consumes it; render never mutates it.
- **The 6 affordances** stay [m] [j] [r] [b] [?] [q] · static keymap · operator can rely on muscle memory across v0.1a → v0.2 → v0.3 evolution.
- **ADR-005 consent gate** stays exact-string · no fuzzy · no case-insensitive · no paste.
- **The 76-col viewport** stays the rendering target. Render layer scales to wider terminals but never assumes them.

## Implementation outline (Option D · once GO is typed)

This is informative-only · the actual implementation lands under a separate scoped GO with its own commits + tests + reviewer pass.

```text
NEW MODULE:  packages/core/src/homebase-keypress.js  (~80 LOC)
  · setupKeypressHandler(opts) → {onKey, restore}
  · uses node:readline emitKeypressEvents on process.stdin
  · raw mode entered + restored on exit
  · respects CTRL+C cleanup, EPIPE, terminal resize

NEW MODULE:  packages/core/src/homebase-dispatch.js  (~60 LOC)
  · dispatchAffordance(key, preview, ctx) → "spawn" | "subscreen" | "exit"
  · 6-entry dispatch table (m/j/r/b/?/q)
  · spawn paths use child_process.spawn with stdio: 'inherit'
  · clean handoff: restore TTY · unmount homebase render · spawn

NEW MODULE:  packages/core/src/homebase-consent-prompt.js  (~60 LOC)
  · promptConsent(phrase, opts) → Promise<{approved: boolean, raw: string}>
  · renders phrase verbatim
  · captures typed input via readline
  · timing-based paste detection (>50 chars / <100ms)
  · forwards typed string to consent-extract validator

EDIT:        packages/core/src/tui-formatter.js
  · formatHomebasePreview gets an opt-in animationFrame parameter
    (not animation in the AAA-game sense · just "the dispatch table
    row that has focus") · default false · backwards compat

EDIT:        apps/cli/src/index.js
  · dispatch() TTY path: instead of `console.log(frame); return;`
    wire to: render frame + setupKeypressHandler + on-key → dispatch

NEW TESTS:   tests/homebase-keypress.test.js                (~10 tests)
             tests/homebase-dispatch.test.js                (~12 tests)
             tests/homebase-consent-prompt.test.js          (~15 tests · paste-detect ADV)
             tests/homebase-interactive-smoke.test.js       (~5 tests · DEMA_FORCE_TTY)

ESTIMATED CUMULATIVE LOC DELTA:  ~200 source + ~280 test = ~480 LOC
ESTIMATED CUMULATIVE TEST DELTA: +42 tests · 1416 → ~1458 baseline target
```

## Test surface · what proves the option ships correctly

Whichever option ships, these tests MUST hold:

```text
T-1   bare `dema` on TTY renders frame · waits for keypress · NOT immediate exit
T-2   pressing `q` exits cleanly with status 0
T-3   pressing `Escape` exits cleanly with status 0
T-4   pressing `m` spawns `dema mission draft` AFTER consent gate · ADR-005 binding
T-5   pressing `r` spawns `dema receipts` immediately (L0-observe · no consent needed)
T-6   pressing an unbound key (e.g., `z`) is a silent no-op
T-7   pasted long string (>50 chars in <100ms) DOES NOT fire any affordance
T-8   `Ctrl+C` at any point exits cleanly · terminal restored to non-raw mode
T-9   subprocess spawn restores TTY before child runs (stdio: inherit)
T-10  subprocess exit returns to operator's shell (does NOT re-enter homebase)
T-11  consent phrase is rendered verbatim before dispatch fires
T-12  consent phrase MUST be typed character-by-character · paste refused
T-13  EPIPE during render exits cleanly (e.g., `dema | head -1`)
T-14  process.stdout.isTTY=false at dispatch entry falls back to JSON (no render)
```

## Decision · bound 2026-05-18 ~18:43 GST · Option D

This ADR bound on receipt of the exact-string typed-GO from Mumu at HEAD
`baf0ce4` on `season-gap2-summary-flag`:

```text
GO: adopt ADR-010 Option D for v0.2 homebase interactive layer
```

**Bound option: D · Minimal zero-dep.**

The v0.2 homebase interactive layer SHALL be implemented as a zero-dep
extension under the established `tui-formatter.js` convention. The 3
new modules outlined in §"Implementation outline (Option D)" are the
target surface. Memory browser `[b]` affordance routes to a subprocess
spawn (`dema memory list` or equivalent) rather than an in-TUI subscreen
(deferred to a v0.3 ADR if the operator later requests it).

Two doctrinal corollaries bind alongside the option choice:

1. **Zero-deps doctrine remains binding for the v0.2 surface.** Adding
   any runtime dep (npm or otherwise) to support the homebase interactive
   layer requires reopening this ADR or a successor ADR. No silent dep
   addition through a side channel is permissible.

2. **Implementation under typed-GO.** This ADR adoption binds the FRAMEWORK.
   The implementation slices themselves require separate typed-GO phrases
   (per ADR-005 + the Skill Growth Law four-line rule "no skill promotion
   without receipt"). Acceptable templates:

   ```text
   GO: implement ADR-010 Option D phase-1 keypress handler
   GO: implement ADR-010 Option D phase-2 dispatch table
   GO: implement ADR-010 Option D phase-3 consent prompt
   GO: implement ADR-010 Option D · full v0.2 slice
   ```

   The first three are for staged implementation (one module at a time);
   the fourth is for a single combined slice. Either path is acceptable.

Status was `Proposed` until 2026-05-18 ~18:43 GST. Operator typed the
above adoption phrase in the conversation that produced commit `baf0ce4`
(ADR-010 authoring) followed by the acceptance commit that inscribes
this Decision History entry. Status stays Proposed.

## Companions

- `docs/02-architecture/homebase-tui-v0.1-pseudocode/phase_04_render_tui_pseudocode.md` — the original Ink+React spec this ADR re-evaluates
- `packages/core/src/tui-formatter.js` — the 5-formatter zero-dep convention (4 prior + homebase v0.1a)
- ADR-005 — exact-string consent · binds the consent-prompt design regardless of which option ships
- ADR-008 — Runtime Activation · the 12-component runtime that subprocess spawns route to

## Closing law

A v0.2 interactive layer that ships before this ADR is settled is structurally invalid. The discipline is: render first (v0.1a · done at `1d6b85a`), decide framework second (this ADR), implement third (under typed-GO). Skipping the middle step is how supply-chain liabilities slip in via side channels.

**End of ADR-010.**
