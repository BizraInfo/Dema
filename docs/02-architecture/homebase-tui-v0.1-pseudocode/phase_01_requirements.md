# Phase 1 · Requirements · Edge Cases · Constraints

**Pseudocode-bundle file:** `phase_01_requirements.md`
**Maps to:** v0.1 spec §1-§4, §11 (test scenarios).
**Goal:** turn the v0.1 narrative spec into an explicit, testable contract.

---

## 1.1 · Functional requirements (FR)

Each requirement has an ID, a verifiable predicate, and the v0.1 spec section it derives from.

| ID | Requirement | Verified by |
|---|---|---|
| FR-1 | Bare `dema` on a TTY renders the homebase TUI to stdout | phase_06 TDD-04 + TTY snapshot |
| FR-2 | Bare `dema` with `--json` emits a JSON object · no UI | phase_06 TDD-07 |
| FR-3 | Bare `dema` with stdout redirected (non-TTY) emits the same JSON · no UI | phase_06 TDD-08 |
| FR-4 | The JSON form is schema-tagged `bizra.dema.homebase_v0_1.v0.1` | phase_06 TDD-01 |
| FR-5 | The JSON form carries `truth_label: "NODE0_LOCAL_SEED"` | phase_06 TDD-01 |
| FR-6 | The JSON form carries the canonical 16-key boundary · all `false` | phase_06 TDD-02 |
| FR-7 | The TUI displays the operator's profile name in the greeting line | phase_06 TDD-10 |
| FR-8 | The TUI surfaces 3 prior-session facts derived from `~/.dema/memory/` | phase_06 TDD-11 |
| FR-9 | The TUI shows Node0 ring status, mission status, gateway status, memory bar | phase_06 TDD-12 |
| FR-10 | The TUI names exactly one "next safe action" derived from process-mining preview | phase_06 TDD-13 |
| FR-11 | The TUI offers ≥ 5 single-key affordances · each maps to an existing CLI surface | phase_06 TDD-14 |
| FR-12 | Pressing `q` exits cleanly with status 0 · no side effects | phase_06 TDD-15 |
| FR-13 | Pressing `Esc` returns to the parent surface · or exits if at root | phase_06 TDD-16 |
| FR-14 | Any affordance triggering L3+ effects requires typed-GO before firing | phase_06 TDD-17, ADR-005 |
| FR-15 | All decorative glyphs (`▓░◉○`) have JSON-form alt-text equivalents | phase_06 TDD-18 |
| FR-16 | The TUI under `NO_COLOR=1` emits no ANSI escapes | phase_06 TDD-19 |
| FR-17 | The TUI under `TERM=dumb` falls back to plain-text rendering | phase_06 TDD-20 |
| FR-18 | The output fits inside 80×24 · no horizontal scroll · no line wrap | phase_06 TDD-21 |
| FR-19 | Rendering the TUI never writes to `~/.dema/` or any path outside stdout | phase_06 TDD-22 |
| FR-20 | Rendering the TUI never invokes the network · model · or external process | phase_06 TDD-23 |
| FR-21 | The TUI is keyboard-only · no mouse handler is bound | phase_06 TDD-24 |
| FR-22 | The builder `buildHomebasePreview(input)` is deterministic given identical inputs | phase_06 TDD-05 |
| FR-23 | The builder output is deep-frozen at all levels | phase_06 TDD-06 |
| FR-24 | The builder accepts a missing profile and returns `"Welcome."` (no crash) | phase_06 TDD-09 |
| FR-25 | The builder accepts 0 memory entries and renders `"no prior sessions"` | phase_06 TDD-25 |

---

## 1.2 · Edge cases (EC)

| ID | Edge case | Expected behavior |
|---|---|---|
| EC-1 | `~/.dema/profile.json` missing entirely | Greeting renders `"Welcome."` · no crash · FR-24 holds |
| EC-2 | `~/.dema/profile.json` exists but lacks `name` field | Greeting renders `"Welcome."` · log warning to JSON form only |
| EC-3 | `~/.dema/profile.json` `name` contains RTL script (Arabic / Hebrew) | bidi-aware rendering · v0.1 may defer to v0.2 if rendering cost is high (mark in JSON form regardless) |
| EC-4 | `~/.dema/memory/` directory missing | Memory3 surface emits `"no prior sessions"` · FR-25 holds |
| EC-5 | `~/.dema/memory/` exists but empty | Same as EC-4 |
| EC-6 | `~/.dema/memory/` contains fewer than 3 entries | Memory3 surface shows N entries · pad with `"—"` to maintain 3-line layout |
| EC-7 | `~/.dema/memory/*.json` includes a malformed JSON file | Skip that file · mark `partial: true` in JSON form metadata · render N-1 entries |
| EC-8 | Existing builder (e.g., `buildProcessMiningSummary`) throws | Capture error · emit `next_action: null` · mark `partial: true` |
| EC-9 | Disk read race · file vanishes between stat and read | Catch ENOENT · degrade gracefully to FR-24/25 paths |
| EC-10 | Receipts list is empty | Status.gateway shows `0` · NOT "unreachable" |
| EC-11 | Terminal width < 80 columns | Render but mark `viewport_too_small: true` in JSON form; UI still legible |
| EC-12 | Terminal height < 22 lines | Same as EC-11 with height marker |
| EC-13 | `NO_COLOR=1` AND `TERM=dumb` both set | Plain text · no ANSI · FR-16 ∧ FR-17 both hold |
| EC-14 | `--json` AND `--no-tty` both passed | Pre-empted by `--json` · JSON form only |
| EC-15 | Operator presses a key not bound in keymap | No-op · do not crash · do not consume input cycle |
| EC-16 | Operator pastes a long string to the terminal | No-op (TUI does not accept typed input in v0.1 · all keys are single-press affordances) |
| EC-17 | Operator presses Ctrl+C during render | Clean exit · do not leave terminal in altered state (no alt-screen poisoning) |
| EC-18 | Operator presses Ctrl+C during input loop | Same as EC-17 |
| EC-19 | Stdout pipe closes mid-render (e.g., `dema \| head`) | EPIPE handler · clean exit · status 0 or appropriate |
| EC-20 | Multiple terminal sessions open homebase concurrently | All read-only · no shared mutable state · all sessions produce same JSON form given same disk state |

---

## 1.3 · Non-functional constraints (C)

| ID | Constraint | Rationale |
|---|---|---|
| C-1 | Cold render must complete in < 250 ms wall clock (after Node startup) | Hook §3 timescales — 5-second hook must feel instant |
| C-2 | LOC delta ≤ ~400 across all new/modified files | v0.1 spec §10 estimate; controls scope |
| C-3 | Zero new runtime dependencies beyond `ink` + its peers | v0.1 spec §10; minimizes supply-chain surface |
| C-4 | Pure function `buildHomebasePreview` may not import Node `fs` or `child_process` | Determinism + testability |
| C-5 | `gather()` may read disk but never write | FR-19 |
| C-6 | The bundle must add ≥ 25 tests · zero existing test removal | Master Craftsmanship invariant #2 |
| C-7 | Every CLI command named in any pseudocode file must exist at HEAD `ad0b1fb` | Verify-before-asserting; commands invented don't ship |
| C-8 | `npm test` count must rise from current 1165 to ≥ 1190 after this bundle ships | Empirical proof of C-6 |
| C-9 | `npm run check` must remain green: help-discovery + smoke-cli-match + test-files-documented | Integration check binding |
| C-10 | `npm run smoke-boundary` must verify the new `bizra.dema.homebase_v0_1.v0.1` schema | Adds 1 to the 9 spine surfaces (becomes 10) |

---

## 1.4 · V/D/A/U bound facts at HEAD `ad0b1fb`

Per [Key Maker Epistemic Conduct v0.1](../key-maker-epistemic-conduct-v0.1.md) §3, every claim used as a planning input must declare its claim-state.

| Fact | Claim-state | Evidence |
|---|---|---|
| 9 spine surfaces currently emit canonical 16-key boundary | **V** | `npm run smoke-boundary` returns `commands_checked: 9 · all_canonical: true` at HEAD `ad0b1fb` |
| 1165 tests pass at HEAD `ad0b1fb` | **V** | `npm test` output `# pass 1165` captured 2026-05-18 10:48 GST |
| ADR-008 12 components shipped | **V** | `git log d60767a..ad0b1fb` shows all C1-C12 commits present |
| Proof-Forge chain has 17 receipts · `ok: true` | **V** | `python3 scripts/forge_evidence.py --verify` returned `receipt_count: 17 · ok: true` |
| PROOF_SUMMARY.md OTS submission has 2 of 4 calendars timestamped | **V** | `ots verify PROOF_SUMMARY.md.ots` returned "Timestamped by transaction" for alice + bob; "Pending" for catallaxy + finney |
| `~/.dema/` has 5.8 GB of state · 24 memory entries · 3 receipts | **D** | v0.1 spec §1 states this; not re-measured in this session (treating as derived from prior verification) |
| `dema profiles --summary` exists | **V** | memory anchor `project_2026_05_18_gap2_summary_flag_shipped.md` documents the flag landing in `d4eb8e8`; help truncated at 40 lines so re-verify on impl |
| `dema mission-loop --summary` exists | **V** | same anchor |
| `dema consent plan` exists | **V** | `node apps/cli/src/index.js --help` lists it at line 28 |
| `dema models scan [--summary]` exists | **V** | `node apps/cli/src/index.js --help` lists it at line 38 |
| `dema receipts` exists | **V** | `node apps/cli/src/index.js --help` lists it under Local evidence |
| `dema today` exists | **V** | `node apps/cli/src/index.js --help` lists it |
| `dema state` exists | **A** | The cloud-author named it; the help text shows `dema status` (not `state`). Treat as assumed-with-Ihsān that the `state` builder exists at `packages/core/src/state.js` (verified by `ls`) · CLI exposure may be under `dema status` |
| Operator typed-GO is required for any v0.1 affordance above L2 | **V** | ADR-005 + v0.1 spec §6 explicit |
| Push to origin remains held · branch has no upstream | **V** | `git status -sb` returned `## season-gap2-summary-flag` (no remote) at 10:48 GST |
| GLOSSARY.md + HANDOVER.md drafts exist · untracked | **V** | `git status` returned `?? GLOSSARY.md ?? HANDOVER.md`; both read this turn |

---

## 1.5 · Out of scope (binding)

The following are explicitly NOT part of v0.1 and any reviewer comment proposing them is a v0.2 candidate, not a v0.1 defect:

- **Chat box on top of an LLM in the homebase** — anti-pattern; would read as ChatGPT-with-steps.
- **Streaks / levels / gamification / "you've used Dema 5 days in a row"** — anti-Ihsān per Key Maker §11.
- **Federated Node1 mockup** — Ring not yet earned (memory: `project_lighthouse_candidate_n1.md`).
- **Settings panel** — out of scope for first-contact; settings are file edits in v0.1.
- **Multi-screen control room with persistent navigation across screens** — that is the cloud-author's v0.2 vision; phase_07 maps it.
- **Mouse handler / scroll wheel** — keyboard-only per FR-21.
- **Telemetry of any kind** — no `analytics`, no `usage_count`, no pings.
- **Live network calls (npm registry · GitHub · OTS)** — homebase is fully offline; FR-20 binding.

---

## 1.6 · Constitutional anchors active in this phase

- [ADR-001](../../06-adr/ADR-001-dema-is-one-face.md) — Dema is the face; runtime lives upstream of this repo.
- [ADR-002](../../06-adr/ADR-002-no-shadow-state.md) — no hidden daemon; the TUI is foreground-only.
- [ADR-005](../../06-adr/ADR-005-operator-actions-require-explicit-consent.md) — typed-GO required for any L3+ effect.
- Key Maker §3 — V/D/A/U bound on every claim (active in §1.4 above).
- Key Maker §7 — Mirror key: the TUI reflects state without prescribing action.
- Key Maker §7 (Boundary Marker) — every absence is annotated "by design" when intentional.

---

## 1.7 · Inputs to phase_02

Phase 02 (`data_gather_pseudocode`) consumes this requirements file via:

```text
INPUT_REQUIREMENTS:  FR-1..FR-25
INPUT_EDGE_CASES:    EC-1..EC-20
INPUT_CONSTRAINTS:   C-1..C-10
INPUT_CLAIM_STATES:  §1.4 V/D/A/U table
```

Phase 02 may not add a functional requirement without amending this file.

**End of phase_01.**
