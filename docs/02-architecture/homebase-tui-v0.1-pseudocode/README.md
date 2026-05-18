# Homebase TUI v0.1 · SPEC-PSEUDOCODE bundle

**Status:** Proposed · pseudocode-only · pre-implementation.
**Authored:** 2026-05-18 GST · **Branch:** `season-gap2-summary-flag` · **HEAD:** `ad0b1fb`.
**Origin:** SPARC Specification Writer phase, downstream of [`homebase-tui-v0.1.md`](../homebase-tui-v0.1.md).

This bundle decomposes the v0.1 contract into modular pseudocode + TDD anchors so an implementation GO can land in a single bounded slice.

---

## Phase index

| File | Scope | Audience | Lines (target) |
|---|---|---|---|
| [phase_01_requirements.md](phase_01_requirements.md) | Functional requirements · edge cases · constraints · V/D/A/U bound facts | reviewer · spec author | ~250 |
| [phase_02_data_gather_pseudocode.md](phase_02_data_gather_pseudocode.md) | `gather()` — read-only disk + builder inputs | implementer | ~200 |
| [phase_03_build_homebase_preview_pseudocode.md](phase_03_build_homebase_preview_pseudocode.md) | `buildHomebasePreview()` — pure builder · deep-frozen | implementer | ~300 |
| [phase_04_render_tui_pseudocode.md](phase_04_render_tui_pseudocode.md) | Ink-based JSX render + key handling | implementer | ~250 |
| [phase_05_cli_dispatch_pseudocode.md](phase_05_cli_dispatch_pseudocode.md) | Bare `dema` dispatch · TTY · `--json` | implementer | ~150 |
| [phase_06_tdd_anchors.md](phase_06_tdd_anchors.md) | 25+ tests · 10-invariant binding · adversarial | implementer · reviewer | ~300 |
| [phase_07_v0_2_expansion_map.md](phase_07_v0_2_expansion_map.md) | 5-screen control-room evolution gated as v0.2 / v0.3 | spec author · reviewer | ~200 |

Total: ~1,650 lines across 7 files. Each module independently testable. No hard-coded secrets or config values. No new producers introduced.

---

## Reading order

1. **Reviewer first pass (~10 min):** README → phase_01 → phase_07
   → understand the contract + the v0.2 horizon without diving into pseudocode.
2. **Implementer first pass (~30 min):** README → phase_01 → phase_03 → phase_06
   → contract + builder + tests; the surface that must hold under verification.
3. **Full pass (~60 min):** README → phase_01 → phase_02 → phase_03 → phase_04 → phase_05 → phase_06 → phase_07.

---

## Scope discipline (binding across all phases)

| In scope (v0.1) | Out of scope (v0.1) |
|---|---|
| Read-only first-contact screen | LLM chat box in homebase |
| 6 components from existing builders | New CLI commands |
| Canonical 16-key boundary in JSON form | New schema-producers |
| 5+ single-key affordances to existing commands | Federated Node1 mockup |
| TTY render + non-TTY JSON fallback | Settings panel |
| 25+ tests (15 base + 10 adversarial) | Gamification / streaks |
| ≤ ~400 LOC delta + Ink dependency | Mouse handling |

Every "out of scope" item maps to a constitutional anchor or a deferred ADR slice. None of the v0.2 expansion items in phase_07 require a v0.1 scope expansion to land.

---

## Test-count correction (binding for phase_06)

The cloud-author payload that triggered this SPEC quoted `1164/1164` tests. Verified at HEAD `ad0b1fb` via `npm test` on 2026-05-18 10:48 GST: **`1165 pass / 0 fail / 2.05s duration`**. Commit `4c85d46` (consent adversarial hardening) added one additional test the payload did not see. Phase 6 TDD anchors are bound to the 1165 baseline.

---

## Cross-references

- v0.1 contract: [`docs/02-architecture/homebase-tui-v0.1.md`](../homebase-tui-v0.1.md)
- Autonomy levels referenced by affordances: [`docs/02-architecture/dema-autonomy-envelope.md`](../dema-autonomy-envelope.md)
- Consent gate per affordance: [`docs/06-adr/ADR-005-operator-actions-require-explicit-consent.md`](../../06-adr/ADR-005-operator-actions-require-explicit-consent.md)
- Reasoning discipline: [`docs/02-architecture/key-maker-epistemic-conduct-v0.1.md`](../key-maker-epistemic-conduct-v0.1.md)
- ADR-008 runtime context (PAT × 7 + SAT × 5): [`docs/06-adr/ADR-008-runtime-activation.md`](../../06-adr/ADR-008-runtime-activation.md)

---

## Provenance

- Authored by: Specification Writer agent (SPARC mode) operating in Auto-Mode under `/A`.
- Trigger: cloud-authored blueprint titled "GO tui-homebase-v0.1" pasted as command arguments.
- Discipline checks applied before authoring:
  1. Verified existing `homebase-tui-v0.1.md` (400 lines · committed in `a2a986f`) — would have been overwritten if author skipped this step.
  2. Verified test count discrepancy (1164 vs 1165) and bound phase_06 to the higher number.
  3. Verified every CLI command named in pseudocode against `node apps/cli/src/index.js --help`.
  4. Bound every V/D/A/U claim in phase_01 to a disk-readable artifact.
- No mints, no commits, no runtime execution required to produce this bundle.

**End of README.**
