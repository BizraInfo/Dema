# Dema TUI Cockpit & Onboarding Design

**Status:** DECLARED design (preview-only, no implementation in this repo).
**Date:** 2026-05-16
**Scope:** Compose existing Dema organs into a single visible cockpit + extend the existing first-run flow with state-snapshot-driven screens. Does NOT propose new schemas, new CLI verbs, runtime execution, or implementation work.

## What this design is NOT

- Not a re-spec of `FIRST_RUN_WIZARD.md` (the canonical screen sequence stays as-is).
- Not a re-spec of `USER_LIFECYCLE.md` (the canonical user journey stays as-is).
- Not a proposal of new CLI verbs — composes the 27 verbs already in `apps/cli/src/index.js`.
- Not a proposal of new schemas — renders the 24 existing `bizra.dema.*_preview.v0.1` schemas.
- Not a TUI framework choice — Dema has zero runtime dependencies; any TUI framework decision belongs to a separate ADR.
- Not a runtime execution surface — preview-only display of state already emitted by the existing modules.

## Current UX surface (disk-verified)

### Screen specs already on disk

- `docs/FIRST_RUN_WIZARD.md` — 7-step flow: Welcome → Privacy → Profile → Model detection → Local health check → Receipt folder → First safe action.
- `docs/USER_LIFECYCLE.md` — mermaid flowchart with 10 nodes from "Open Dema" to "Choose the next safe action."

### Onboarding-bound CLI verbs already wired

- `dema active` / `dema` (empty) → `runActiveKernel({interactive})` — current default landing surface
- `dema welcome` → `formatOnboardingGuide(buildOnboardingGuide())` — onboarding text
- `dema onboard` → same `buildOnboardingGuide()` with json variant
- `dema setup` → `runSetup()` — local folder + config creation
- `dema today` → `recordTodayTick({status})` — daily tick
- `dema doctor` → readiness gate with block-reason enumeration
- Plus 21 other verbs covering consent, mission, receipts, evidence, ihsan, memory, models, network, amana, behavior, design, task, etc.

### State sources already on disk (this branch)

- `node0-homebase-state-preview` (commit `13f32c5`) — emits identity + PAT-7 + SAT-5 + local-URP-status + shared-URP-status + boundary + blocked_actions + next_safe_action
- `shared-urp-world-preview` (commit `13f32c5`) — emits locked world + 4 ghost-hold nodes + 0-length offer arrays + boundary + unlock_condition
- `process-value-preview.true_value_preview.v0.1` — emits state + risk + momentum + next_safe_action + self_proactive_harness + self_critique + step7_hold_posture
- `consent-hash-preview.consent_hash_table_preview.v0.1` — exact-lookup-only consent surface
- `evidence-chain-preview.evidence_chain_preview.v0.1` — chain semantics
- `ihsan-floor-preview.ihsan_floor_preview.v0.1` — `DEFAULT_IHSAN_FLOOR = 0.95`
- `melae-preview.melae_gate_preview.v0.1` — truth-label gate

## Design objective

A single visible cockpit (the TUI surface, when implemented) renders all current Dema state in one frame so the operator can answer four questions without typing more than one command:

1. **Where am I?** — host identity, primary device, companion device, PAT/SAT registry occupancy
2. **What is true right now?** — local URP status, shared URP status, current Node0 readiness layer (A/B/C/D), boundary flags
3. **What is allowed and what is blocked?** — blocked_actions list, next_safe_action recommendation
4. **What proof exists?** — last receipt, last evidence chain link, current Ihsan floor signal

The cockpit displays. It does not act. Every action stays gated by the existing typed-consent flows.

## Component library (renders from existing primitives)

All components are **display-only**. Each receives a frozen-object input from an existing builder and renders text. No component mutates state, calls a CLI verb, or invokes a runtime.

### Identity Card

Source: `buildNode0HomebaseStatePreview().{player, primary_device, companion_device}`
Display:

```text
┌─ Node0 Homebase ────────────────────┐
│ Player:    momo                     │
│ Primary:   MSI laptop               │
│ Companion: Z Fold 6                 │
└─────────────────────────────────────┘
```

### Party Card

Source: `buildNode0HomebaseStatePreview().{pat_registry, sat_registry, pat_count, sat_count}`
Display: roster of PAT-1..PAT-7 (intent_extractor, permission_planner, evidence_collector, consent_drafter, mission_proposer, receipt_renderer, memory_steward) and SAT-1..SAT-5 (consent_verifier, boundary_auditor, ihsan_floor_checker, evidence_chain_validator, step7_gate_keeper). One line per agent. Scope and verdict_surface inline.

### World Card

Source: `buildSharedUrpWorldPreview().{status, nodes, unlock_condition}`
Display:

```text
┌─ Shared URP World ──────────────────┐
│ Status: locked_preview_only         │
│ node1: ghost_hold · unreachable     │
│ node2: ghost_hold · unreachable     │
│ node3: ghost_hold · unreachable     │
│ node4: ghost_hold · unreachable     │
│ Unlock: Node0 bounded diagnostic    │
│         must close first            │
└─────────────────────────────────────┘
```

### Boundary Card

Source: union of `homebase.boundary` + `shared_urp.boundary`
Display: every authority flag with its current `false` state, grouped by concern (runtime / federation / mint / node_connection / economic / etc.). Renders red until the corresponding gate closes (none in v0; all flags remain false).

### Mission Card

Source: `buildConsentPlanPreview({intent})` when an intent is being drafted; otherwise empty.
Display: pending mission text + extracted permissions + analogical notes + commitment hash. **Action buttons absent.** Approval requires typed consent at a separate command.

### Consent Card

Source: `buildConsentHashTablePreview({plan})`
Display: hash-table entries with `key`, `expires_at`, `revoked`, `purpose`. Shows whether each scope is `allowed: true/false` from `lookupConsentHashTablePreview(...)`. Read-only.

### Evidence Card

Source: `buildEvidenceChainPreview(...)`
Display: chain depth, last `event_hash` (truncated to 12 chars), `prev_hash` link integrity, `GENESIS_SENTINEL` if at root.

### Ihsan Card

Source: `evaluateIhsanFloorPreview({score, floor})`
Display: current score vs `DEFAULT_IHSAN_FLOOR = 0.95`, scorer ID, floor-met boolean, accepted-shape boolean.

### Next-Safe-Action Card

Source: `buildNode0HomebaseStatePreview().next_safe_action` ∪ `buildSharedUrpWorldPreview().next_safe_action` ∪ `buildTrueValuePreview(...).next_safe_action`
Display: deduplicated list of recommended next steps. Highlighted in green if all sources agree.

### Blocked-Actions Card

Source: union of `blocked_actions` across all preview modules
Display: 9-11 entries (`connect_node1`, `shared_urp_publish`, `runtime_start`, `federation_start`, `receipt_mint`, `capability_mint`, `step7_mint_without_exact_authorization`, `raw_data_exchange`, `economic_settlement`, etc.). Always visible.

## Onboarding sequence (extends FIRST_RUN_WIZARD)

The existing 7-step flow stays. The TUI design adds a state-snapshot column rendered alongside each step, so the operator sees what each step changes in real-time state.

| FIRST_RUN_WIZARD step        | TUI right-column state snapshot                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| 1. Welcome                   | empty Identity Card, empty Party Card                                                    |
| 2. Privacy mode              | Identity Card populated with player name only                                            |
| 3. Profile                   | Identity Card complete; Party Card lights up to "PAT-7 + SAT-5 declared, not yet active" |
| 4. Model detection           | Status Card updates with model surface (out of scope this branch)                        |
| 5. Local health check        | Boundary Card renders; all authority flags red-but-correctly-false                       |
| 6. Receipt folder            | Evidence Card lights up at `GENESIS_SENTINEL`                                            |
| 7. First safe action preview | Next-Safe-Action Card emits its first recommendation                                     |

After step 7, the cockpit transitions from "wizard mode" to "daily mode" (default landing for `dema active`). Daily mode renders the same cards continuously; the wizard's linear sequence is replaced by a free-navigation surface across the cards.

## State refresh model

The TUI is **pull-based**, not push-based. Each card calls its source builder when the user navigates to it or requests a refresh. Builders are deterministic and return fresh frozen objects per call — already proven by the existing test suite. No subscription, no observer, no background daemon (per [[node0-is-demas-space]] embodiment doctrine + Dema CLAUDE.md "no hidden daemon" invariant).

A single refresh keypress (e.g., `r`) re-invokes every visible card's builder. The cards display the new frozen objects; deep equality with the prior frozen object means "no change."

## Boundary invariants (every implementation must honor)

| Invariant                                                                                                         | Why                                         |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| The TUI never invokes a CLI verb that mutates state without first showing the operator a consent card.            | Per ADR-005 explicit consent.               |
| The TUI never displays a value labeled `MEASURED` unless the underlying primitive's `truth_label === "MEASURED"`. | Per existing MELAE discipline.              |
| The TUI never shows an "Approve" button that does not require the exact consent phrase per `MICRO_CONSENT_SHAPE`. | Per existing consent-hash-preview contract. |
| The TUI runs no background timer, no scheduled tick, no socket.                                                   | Per Dema CLAUDE.md "no hidden daemon".      |
| The TUI's source code (when implemented) must pass `scripts/review/boundary-invariant-check.mjs`.                 | Per the just-shipped lint (`7e24611`).      |
| The TUI reads operator memory only at user-initiated requests; it never preemptively walks `~/.dema/`.            | Per `validate-must-be-state-read-only`.     |

## Acceptance criteria (for a future TUI implementation)

These are not tests on this branch. They are the gates a future implementation must close:

1. The cockpit renders all 10 cards on a 80×24 terminal without truncation or wrapping issues.
2. Every card's source builder returns a frozen object that deep-equals on consecutive calls.
3. Every card sources from an existing on-disk schema (no new schemas).
4. The TUI source module passes the boundary-invariant lint.
5. The TUI source module imports zero packages (Dema's zero-dependency invariant).
6. Onboarding step-by-state-snapshot mapping is verifiable by a test that calls `buildOnboardingGuide()` + each builder and asserts the right shape per step.
7. The TUI's keypress handler executes nothing more dangerous than calling existing read-only builders + `process.stdout.write`.

## Out of scope (each requires its own GO)

- Mobile (Z Fold 6) UX surface — depends on the QR consent v0 spec which has not been authored
- Color theme decisions — should be operator-configurable, not baked
- TUI framework choice (e.g., blessed, ink, raw ANSI) — has dependency implications
- Voice surface — separate organ at `~/.dema/voice/`
- Screen recording surface — separate organ at `~/.dema/screen/`
- Game-state mapping (MMORPG framing) — per `progress-mirror` canon: internal-structure only, never the user-facing label
- Animations / transitions — irrelevant on TUI; explicit non-goal
- Notification system — no background process means no notifications
- Multi-window / multi-pane — single-frame for v0; future operator decision

## Open design questions (for a future ADR)

1. **Keypress vocabulary** — currently undefined. Proposed v0: `r` refresh, `q` quit, arrow keys navigate cards, `enter` open card detail, `c` initiate consent challenge, `?` help.
2. **State preservation across sessions** — should the TUI remember the last-viewed card? Where? (Probably `~/.dema/.tui_state.json` with a typed schema.)
3. **Empty-state defaults** — what does the cockpit show when `dema setup` has not been run? Probably the FIRST_RUN_WIZARD takeover.
4. **Color discipline** — proposed v0: red for blocked, green for permitted, yellow for review/pending, white for declared, gray for ghost/hold. No other colors.
5. **Accessibility** — high-contrast mode? Screen-reader-friendly fallback (plain text dump)?

## References (canonical sources, this design composes them)

- [`FIRST_RUN_WIZARD.md`](../FIRST_RUN_WIZARD.md) — 7-step screen sequence
- [`USER_LIFECYCLE.md`](../USER_LIFECYCLE.md) — user journey mermaid
- [`ARCHITECTURE.md`](../ARCHITECTURE.md) — current component map
- [`dema-autonomy-envelope.md`](dema-autonomy-envelope.md) — autonomy levels
- [`pat-builder-sat-validator.md`](pat-builder-sat-validator.md) — PAT/SAT bridge + GateVerdict
- [`behavioral-modulation-preview.md`](behavioral-modulation-preview.md) — consent-bound modulation
- [`NODE0_GENESIS_READINESS_2026_05_16.md`](../NODE0_GENESIS_READINESS_2026_05_16.md) — production-readiness state map
- [`ADR-001`](../06-adr/ADR-001-dema-is-one-face.md) — Dema is one face
- [`ADR-002`](../06-adr/ADR-002-no-shadow-state.md) — no shadow state
- [`ADR-005`](../06-adr/ADR-005-operator-actions-require-explicit-consent.md) — explicit consent
- [`ADR-007`](../06-adr/ADR-007-multi-session-chain-policy.md) — multi-session chain policy

## Operating law

```
The cockpit displays.
The cockpit does not act.
Every action stays gated by the existing typed-consent flows.
```

— per [[law-of-assumption-killer-behavior]] (declare-don't-pretend) + [[validate-must-be-state-read-only]] (display is not mint) + Dema CLAUDE.md (no hidden daemon).
