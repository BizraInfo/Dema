# Dema Homebase TUI v0.1

**Status:** Proposed · spec-only · pre-implementation. Specifies the Phase-1 first-contact surface for Dema: an identity-first terminal homebase that opens when an end user runs `dema` with no arguments on a TTY.

**Bound by** [CLAUDE.md](../../CLAUDE.md), [ADR-001](../06-adr/ADR-001-dema-is-one-face.md), [ADR-002](../06-adr/ADR-002-no-shadow-state.md), [ADR-005](../06-adr/ADR-005-operator-actions-require-explicit-consent.md), [Dema Autonomy Envelope](dema-autonomy-envelope.md), [Node0 + DEMA Goal v0.2](node0-dema-goal-v0.2.md), and [Key Maker Epistemic Conduct v0.1](key-maker-epistemic-conduct-v0.1.md).

**Authored:** 2026-05-18 GST · **Supersedes:** none.

---

## 1. Why this exists (and why now)

Dema currently has ~39 CLI commands, 7 schema-tagged preview spine surfaces, 5.8 GB of real local state, and 24 persisted memory entries. The active-kernel banner (the current `dema` bare invocation) is functional but reads as a developer-onboarding flow. A first-time user must type `dema help`, learn the command surface, and read documentation before the system feels like theirs.

This document specifies the **first-contact replacement** for that banner: a single screen, rendered to terminal, that performs four jobs in five seconds:

```text
1. Identity      Says the operator's name aloud (literally · from profile).
2. Continuity    Surfaces 3 things the system remembers from prior sessions.
3. Status        Shows the truth of where Node0 is (ring · gateway · memory).
4. Next safe act Names one action observable from current state · single keypress.
```

The hook is not capability. The hook is **recognition**. No other AI tool can open with the operator's name unless it has copied them. Dema can — because it has 24 memory entries + 3 receipts + a profile on disk. The hook is structural, not stylistic.

### Why now

The Lighthouse Pack v1.0 is sealed and Ring-1 send-ready. Before any external reviewer touches Dema, the first-contact screen must reflect what the system actually is: identity-first, memory-aware, refusal-disciplined. Reviewer-experience time-to-comprehension is a measurable variable at Ring 1. A polished homebase screen reduces that time materially.

### Inheritance

This spec inherits from [Key Maker Epistemic Conduct v0.1](key-maker-epistemic-conduct-v0.1.md): the Mirror key (§7) governs how the homebase reflects state without prescribing action; the Boundary Marker key governs the explicit "by design" annotations on absences.

---

## 2. The hook in one screen

This is the canonical first-contact view at version 0.1. It is a mockup; the implementation must hit every element with the data sources named in §6.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  DEMA · Node0 · Mon 18 May 2026 · 03:42 GST                              │
│  ────────────────────────────────────────────────────────────────────    │
│                                                                          │
│  Welcome back, Mumu.                                                     │
│                                                                          │
│  Yesterday you worked on:  Lighthouse Pack v1.0                          │
│  Three things I remember:                                                │
│    1. Pack sealed at /tmp/.../lighthouse-pack/ (10 files · 160K)         │
│    2. 16 commits held from origin (CI dispatch incident · external)      │
│    3. 1 reviewer · not yet named                                         │
│                                                                          │
│  Right now:                                                              │
│    Node0  ▓▓░░░░░░░░  Ring 0 verified · Ring 1 pack sealed               │
│    Mission center  ◉  clear                                              │
│    Gateway  ○  unreachable (by design · no runtime here)                 │
│    Memory  ▓▓▓▓▓▓▓▓▓▓  24 entries · 5.8 GB                               │
│                                                                          │
│  Next safe action:                                                       │
│    → choose a Lighthouse N=1 candidate (~14 min · localfirst.fm)         │
│                                                                          │
│  ────────────────────────────────────────────────────────────────────    │
│  [m] Mission   [j] Journal   [r] Receipts   [b] Browse   [?] Help        │
│                                                                          │
│  Boundary: no action without explicit consent.                           │
└──────────────────────────────────────────────────────────────────────────┘
```

Width: 76 columns. Height: 22 lines. Fits any standard terminal (80×24 minimum target).

---

## 3. The hook ladder · three timescales

The single screen must produce three distinct felt-experiences at three timescales:

### 5-second hook · *"this thing knows me"*

The user opens Dema and within five seconds sees their own name + three concrete facts from prior sessions. The Greeting + Memory3 components carry this.

**Test:** a stranger should be able to verify "Dema knows the operator's name and recent context" without typing anything beyond `dema`.

### 30-second hook · *"this thing refuses on purpose"*

The user notices the gateway line: `Gateway ○ unreachable (by design · no runtime here)`. The Boundary Marker key from Key Maker §7 is active. The user feels the system telling them what it will NOT do, without apology.

**Test:** a stranger should be able to identify at least one "by design" absence on the homebase screen and articulate why it is correct.

### 5-minute hook · *"this thing has receipts"*

The user presses `[r]`, sees the receipt wall. Real artifacts with real hashes. The user feels: this is a ledger of MY work, not a chatbot that talks.

**Test:** a stranger should be able to navigate from homebase → receipts → one specific receipt detail in under 60 seconds, all keyboard.

---

## 4. Component breakdown

The screen decomposes into six components. Each is independently testable.

| # | Component | Responsibility | Data source | Required? |
|---|---|---|---|---|
| 1 | **Header** | Date, time GST, node name, dema version | `Date.now()` · OS timezone · profile.node · package.json | yes |
| 2 | **Greeting** | "Welcome back, <name>." | `~/.dema/profile.json` `name` field | yes |
| 3 | **Memory3** | 3 facts from prior sessions | `~/.dema/memory/` recent entries · process-mining preview | yes |
| 4 | **Status** | Ring · mission · gateway · memory bars | state preview + receipts list + memory index | yes |
| 5 | **NextAction** | One observable next move | derived from state + process-mining preview | yes |
| 6 | **Affordances** | 4-5 single-key bindings | static for v0.1 | yes |

Optional v0.1+:
- **Boundary footer** "no action without explicit consent" — always rendered, always last line.
- **Refresh hint** — small icon if data is older than 60 seconds.

### Components NOT in v0.1

- Chat box on top of an LLM (anti-pattern: makes Dema read as ChatGPT-with-steps)
- Streaks / levels / gamification (anti-Ihsān per Key Maker §11)
- Federated Node1 mockup (Ring not yet earned)
- Settings panel (out of scope for first-contact)

---

## 5. Data flow

Each component pulls from existing schema-tagged sources. **No new producers are introduced by this spec.** The TUI is a consumer of existing state.

```
┌─────────────────────┐
│  ~/.dema/profile     │──▶ Greeting.name
│       .json          │──▶ Header.node
└─────────────────────┘

┌─────────────────────┐
│  ~/.dema/memory/    │──▶ Memory3 (list 3 most recent · pick by mtime)
│       *.json         │
└─────────────────────┘

┌─────────────────────┐
│  buildNode0State    │──▶ Status.ring        (truth_label-aware)
│  Preview()           │──▶ Status.mission     (mission_centered field)
└─────────────────────┘

┌─────────────────────┐
│  listReceipts()      │──▶ Status.gateway   (gateway_issued count + truth_label)
│  (existing API)      │
└─────────────────────┘

┌─────────────────────┐
│  buildProcess       │──▶ NextAction.text   (next_step_observable from miner)
│  MiningSummary()     │──▶ Status.ring     (ring_advancement_status)
└─────────────────────┘

┌─────────────────────┐
│  du -sh ~/.dema/    │──▶ Status.memory     (size · entry count)
└─────────────────────┘
```

**All inputs are READ-ONLY.** The homebase never writes. Writes happen only when the user presses a key that triggers a separate command (e.g., `[j]` → `dema today` → L1 Remember).

---

## 6. Affordance keymap (v0.1)

Single-key affordances rendered in the bottom strip. Each maps to an existing CLI command. **No new commands are introduced by this spec.**

| Key | Label | Triggers | Boundary |
|---|---|---|---|
| `m` | Mission | `dema mission draft` (preview) | L2 Propose |
| `j` | Journal | `dema today` (write today.json) | L1 Remember |
| `r` | Receipts | `dema receipts` (read-only list) | L0 Observe |
| `b` | Browse | open a sub-screen showing memory entries | L0 Observe |
| `?` | Help | `dema help` (full command list) | L0 Observe |
| `q` | Quit | exit cleanly | L0 |
| `Esc` | Back | parent screen or quit if at root | L0 |

**All affordances respect [ADR-005](../06-adr/ADR-005-operator-actions-require-explicit-consent.md):** any action above L3 requires an explicit consent phrase typed into the terminal. The TUI displays the consent phrase as plain text and waits for it to be typed character-by-character. No fuzzy match. No auto-paste from clipboard.

---

## 7. Non-TTY fallback

When `dema` runs without a TTY (CI · piped output · `--json` flag · `--no-tty` flag), the homebase TUI is bypassed. The existing banner-emitter behavior is preserved.

```text
TTY detected  + interactive             → render homebase TUI (Ink)
TTY detected  + --json                  → emit homebase JSON (no UI)
No TTY        OR redirected stdout      → emit homebase JSON (no UI)
```

The JSON form is the same data the TUI renders, schema-tagged as `bizra.dema.homebase_v0_1.v0.1`. This guarantees:
- CI scripts can parse homebase state without ANSI escapes
- The TUI and JSON form share one data source (no drift)
- The smoke-boundary canary can verify the homebase JSON has a canonical boundary object

---

## 8. Boundary discipline

The homebase TUI inherits the canonical 16-key boundary from [preview-boundary.js](../../packages/core/src/preview-boundary.js). When the homebase emits JSON (--json or non-TTY), the output includes a `boundary` field with all 16 keys pinned `false`.

```jsonc
{
  "schema": "bizra.dema.homebase_v0_1.v0.1",
  "truth_label": "NODE0_LOCAL_SEED",
  "mode": "preview_only",
  "rendered_at": "2026-05-18T03:42:00.000Z",
  // ... component data ...
  "boundary": {
    "filesystem_write_performed": false,
    "network_used": false,
    "runtime_execution_performed": false,
    "model_loaded": false,
    "model_invocation_performed": false,
    "prompt_executed": false,
    "external_call_performed": false,
    "raw_corpus_scan_performed": false,
    "raw_data_included": false,
    "tool_executed": false,
    "chain_advance_performed": false,
    "receipt_mint_performed": false,
    "federation_invoked": false,
    "node_connection_performed": false,
    "public_network_used": false,
    "consent_collected": false
  }
}
```

**Critically:** rendering the TUI itself does NOT flip any boundary key. The TUI reads state; it does not advance chain, mint receipts, invoke models, or call networks. The boundary stays canonical regardless of how many times the homebase is rendered.

---

## 9. Accessibility

The TUI must be operable under:

| Constraint | Requirement |
|---|---|
| 80×24 terminal | All content visible without scroll |
| Monochrome terminal | No information conveyed by color alone; bars/icons carry semantics |
| Screen reader | All decorative chars (`▓` `░` `◉` `○`) have alt-text JSON equivalents |
| Keyboard-only | No mouse needed for any v0.1 affordance |
| `NO_COLOR` env var honored | ANSI escapes suppressed when set |
| `TERM=dumb` | Falls back to plain-text rendering |
| Right-to-left scripts in name field | Bidi-aware rendering (deferred to v0.2 if costly) |

---

## 10. Implementation plan (deferred · separate scoped GO)

When implementation is authorized, the following surface is anticipated:

```text
packages/core/src/homebase-preview.js
  → exports buildHomebasePreview({ profile, memoryRecent, state, receipts, processMining })
  → returns frozen object matching bizra.dema.homebase_v0_1.v0.1
  → no I/O · pure function from inputs
  → testable deterministically

packages/cli-tui/                                              (new package)
  package.json (depends on ink)
  src/homebase-render.jsx                                     (the TUI)
  src/components/{Header,Greeting,Memory3,Status,NextAction,Affordances}.jsx
  src/gather.js                                               (reads disk · feeds buildHomebasePreview)

apps/cli/src/index.js
  - bare `dema` invocation:
      if (process.stdout.isTTY && !args.includes("--json")) {
        await renderHomebaseTUI(gather())
      } else {
        console.log(JSON.stringify(buildHomebasePreview(gather()), null, 2))
      }

tests/homebase-preview.test.js
  - asserts schema-tag · truth-label · canonical boundary
  - asserts deterministic given identical inputs
  - asserts all 6 components present
  - asserts adversarial inputs (missing profile · empty memory) yield safe defaults

tests/homebase-tui.test.js
  - snapshot test on JSX output for golden-fixture inputs
  - smoke-test: render and exit cleanly under timeout
```

Estimated effort: **1-2 days** for the v0.1 surface. ~200-300 LOC delta. Zero new runtime dependencies beyond `ink` and its peer deps.

---

## 11. Test plan (must hold before implementation lands)

```text
1. buildHomebasePreview() emits canonical schema + truth_label + boundary
2. buildHomebasePreview() is deep-frozen at all sub-views
3. buildHomebasePreview() is deterministic given identical inputs
4. buildHomebasePreview() handles missing profile (returns "Welcome." not crash)
5. buildHomebasePreview() handles 0 memory entries (Memory3 says "no prior sessions")
6. buildHomebasePreview() handles unreachable gateway (status shows ○ + "by design")
7. Non-TTY invocation emits valid JSON parseable by JSON.parse
8. Non-TTY invocation includes canonical 16-key boundary
9. TUI does NOT write to disk (verified by snapshotting ~/.dema/ before+after render)
10. TUI does NOT make network calls (verified by mock-rejecting all network APIs)
11. Affordance key 'q' exits with status 0
12. Affordance key 'j' triggers dema today (writes today.json) ONLY after typed consent
13. NO_COLOR env var suppresses ANSI escapes (test under env -i NO_COLOR=1)
14. TERM=dumb falls back to plain text (test under env TERM=dumb)
15. Rendered output fits in 80×24 (test by capturing stdout, asserting line widths)
```

---

## 12. What this document does NOT do

Per scope discipline:

- It does NOT introduce runtime code.
- It does NOT introduce any new CLI command (only re-routes bare `dema` invocation).
- It does NOT install any dependency (Ink dependency is deferred to implementation GO).
- It does NOT modify existing commands (`dema state`, `dema profiles`, etc., remain unchanged).
- It does NOT change the boundary discipline (16-key canonical preserved).
- It does NOT prescribe any specific component visual style beyond the ASCII mockup in §2.
- It does NOT cover Phase-2 surfaces (GUI · web · voice integration · Node1 mesh view).

It specifies the contract. Implementation is a separate scoped decision.

---

## 13. Comparison to current market UX

| Product | Opening UX | What it teaches user | Hook quality |
|---|---|---|---|
| ChatGPT | empty prompt | "I am infinite. Ask me anything." | infinite-blank · low recognition |
| Claude Code | empty terminal | "I'm a tool. Bring structure." | tool-stance · neutral |
| Cursor | code editor | "I help you code." | role-locked · high for coders only |
| Notion | blank page | "I am yours to fill." | yours-to-fill · medium |
| Obsidian | empty vault | "Your notes are local." | local-first · medium |
| Linear | empty backlog | "Move fast." | speed · medium |
| Warp | terminal that talks | "Conversational shell." | novel · medium |
| Raycast | search box | "Cmd-space, find anything." | speed · high for power users |
| **Dema v0.1** | name + 3 memories + ring + next | "I remember you. I refuse on purpose. I name what's next." | **identity + boundary + memory · unique combination** |

The Dema row is the only one in this table that combines all three of: **prior-context recall · named refusal · single-key next-move**. That combination is the differentiator.

---

## 14. Boundary discipline rendered as UX affordance

The Boundary Marker key from Key Maker §7 becomes a UX element in the homebase:

```
  Gateway  ○  unreachable (by design · no runtime here)
            ↑              ↑
            icon names     parenthetical surfaces the Boundary Marker
            absence        ("by design") · NOT failure
```

Every status absence is annotated with **"by design"** when the absence is intentional per the constitutional anchors. This converts what could feel like a defect ("gateway unreachable??") into what is actually a feature ("the runtime is governed and lives elsewhere"). The UX teaches the user the doctrine without lecturing.

---

## 15. Risks and tradeoffs

| Risk | Likelihood | Mitigation |
|---|---|---|
| TUI excludes non-technical users | HIGH for mainstream · LOW for Ring 1-2 target | Defer GUI to Phase 2; reach Ring 1-2 first |
| Ink dependency bloats bundle | LOW | Ink is ~30 KB compiled · acceptable |
| First-contact differs from CI usage | MEDIUM | --json flag preserves CI use case |
| TUI breaks under exotic terminals | MEDIUM | Test against tmux · screen · iTerm · alacritty · kitty before ship |
| User feels "watched" by 3-memories surface | LOW but real | All Memory3 entries are user's own writes · no surveillance frame |
| Affordance keys conflict with terminal multiplexer | LOW | Use letters not commonly remapped (m/j/r/b/?/q) |

---

## 16. Closing law

```text
The first screen is the first promise.
A promise that says "Welcome back, <name>" is binding only if the system
has earned the right to say it · with memory · with discipline · with
correct silence in the places where silence is correct.

Dema can say it.
Most cannot.
```

---

## Memory anchors

This spec is informed by these operator-memory entries:

- `feedback_evidence_first_gtm_concentric_rings` — first-contact UX is the Ring-1 ergonomic substrate
- `feedback_law_of_assumption_canon_of_canons` — the homebase must declare V/D/A/U claim-states implicitly via boundary discipline
- `project_first_night_dema_alone_with_node0` — the "DEMA take control" colloquial moment that triggered the operator-time discipline (the homebase must not interpret colloquial language as typed GO)
- `feedback_node0_is_demas_space` — Node0 is Dema's space; the homebase IS Dema speaking from that space

The homebase TUI is where Dema first speaks. Speak truthfully or do not speak.

---

**End of spec · v0.1**
