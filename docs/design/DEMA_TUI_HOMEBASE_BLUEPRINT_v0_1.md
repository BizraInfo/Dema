# DEMA · Homebase TUI — Blueprint v0.1 (Isnād Modern)

Truth label: `DESIGN_CANON_DOCS_ONLY`. **DOCS-ONLY · NO RUNTIME.** This is a *blueprint* for a future
cockpit; it builds no TUI. Governed by [DEMA_ISNAD_MODERN_DESIGN_SYSTEM_v0_1.md](./DEMA_ISNAD_MODERN_DESIGN_SYSTEM_v0_1.md).

> First Light GUI is the **door** (human entry, language, consent, emotional trust).
> Homebase TUI is the **cockpit** (command, context, receipts, mission control).
> Both speak **Isnād Modern**.

Every panel below obeys the seven laws: **GOLD ONLY WHERE PROOF EXISTS**, **EVERY NUMBER WEARS AN
EVIDENCE CHIP**, **ARABIC IS FIRST-CLASS**, **CONSENT IS NEVER MYSTERIOUS**, **ERRORS ARE NEVER
MYSTERIOUS**, **PROOF STATUS IS NEVER HIDDEN**, **ZERO-EXTERNAL-REQUEST**.

---

## Layout doctrine

A three-zone cockpit, RTL/LTR symmetric:

```
┌───────────────┬───────────────────────────┬───────────────┐
│  Mission      │      Work surface         │  Receipt rail │
│  cockpit      │  (context + command)      │  (proof)      │
│  (left/start) │                           │  (right/end)  │
└───────────────┴───────────────────────────┴───────────────┘
      status bar: node identity · language · proof status (never hidden)
```

Zones swap start/end under RTL. Nothing overlaps a consent or error surface — those always get their
own unobstructed region.

## Dynamic slash-command UX

- Context-aware commands: `/mission` `/chain` `/file` `/receipt` `/audit` `/prompt`. The available set
  **changes with the current task/state** — a command that cannot run is shown `BLOCKED` with the
  reason, not hidden.
- Each command previews its **consent scope** before running; value-bearing commands require the exact
  typed GO phrase (**CONSENT IS NEVER MYSTERIOUS**).
- Command results arrive as chipped data, never naked output.

## Prompt library UX

- Saved prompts with categories, versions, and **evidence/authority tags** (which class of output a
  prompt is trusted to produce).
- Each prompt shows its provenance chip; a prompt is never presented as more authoritative than its
  tag.

## Prompt-chain UX

- A visual sequence of steps; each step carries a state: `pending` / `running` / `done` / `BLOCKED`.
- Chains can be replayed or saved; a replay re-derives, it does not fabricate.
- A blocked step halts the chain visibly and names what unblocks it (**ERRORS ARE NEVER MYSTERIOUS**).

## File / input-context UX

- Files attached to the current prompt show: `metadata-only` vs `content-indexed`, a hash/fingerprint,
  and consent state — nothing is read beyond the declared scope.
- Default is **metadata-only**; content indexing is an explicit, scoped, consented act.

## Receipt rail UX

- A running rail of proof previews. Each entry states **what it proves** and **what it does not
  prove**, with its content hash.
- Nothing on the rail claims to mint, to grant authority, or to be signed unless it verifiably is.
  A reused verified answer shows `reuse ≠ authority`.

## Mission cockpit UX

- Current mission, active context, exactly one **safe next action**, and a typed **consent gate**.
- Drain/orbit/stale-proof indicators are chipped; the cockpit derives status from state, never asserts
  it.

## Proof Room UX

- The memory palace: sealed proofs, their isnād, and re-derivation commands. Browsable, never
  editable-in-place; a proof is opened to be re-verified, not altered.

---

## Accessibility & reduced-motion

Inherits §7 of the design system: WCAG AA contrast, full keyboard, RTL/LTR parity, screen-reader
labels on every chip/gate, `prefers-reduced-motion` honored (truth-events degrade to instant legible
state changes).

## What this blueprint proves

That the cockpit's information architecture is **specified against the seven laws** — every panel has a
defined proof/consent/error contract, so a future implementation slice has a falsifiable target.

## What this blueprint does NOT prove

**No live runtime, no GUI/TUI implementation, no mint, no URP, no federation.** No cockpit is built;
no panel is measured. Building any panel requires its own preview slice with tests and gates.
