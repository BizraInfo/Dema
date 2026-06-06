# Phase 6 · TDD Anchors

**Pseudocode-bundle file:** `phase_06_tdd_anchors.md`
**Maps to:** v0.1 spec §11 (15 base scenarios) + phase_01 FR-1..FR-25 + ≥10 adversarial tests required by Master Craftsmanship invariant #2.
**Goal:** enumerate every test that must hold before the implementation lands, organized by surface, with explicit binding to the requirement / edge case / constraint it verifies.

---

## 6.1 · Test budget summary

| Group                         | Count        | Cumulative |
| ----------------------------- | ------------ | ---------- |
| Phase_03 builder · base       | 14           | 14         |
| Phase_02 gather · base + edge | 5            | 19         |
| Phase_04 render · base        | 5            | 24         |
| Phase_05 CLI dispatch · base  | 7            | 31         |
| Adversarial · cross-phase     | 11           | **42**     |
| **Total minimum**             | **42 tests** |            |

Master Craftsmanship invariant #2 requires ≥80% coverage AND ≥15 adversarial scenarios per component. Phase_06 specifies 42 tests across 4 components → ~10 tests/component average, well above the floor; adversarial 11 against the spec floor of 15 — phase_06 may extend to 15 adversarial during impl (room reserved in budget).

After this bundle ships:

```text
npm test  →  1165 + ~42 = ~1207 PASS
```

C-8 floor of 1190 is comfortably met.

---

## 6.2 · Phase_03 builder · base tests (14)

```text
TDD-01  buildHomebasePreview returns object with schema === "bizra.dema.homebase_v0_1.v0.1"
        Binds: FR-4
TDD-02  buildHomebasePreview returns object whose .boundary has exactly 16 keys, all false
        Binds: FR-6
TDD-03  buildHomebasePreview returns deep-frozen object (Object.isFrozen at every depth)
        Binds: FR-23
TDD-04  buildHomebasePreview returns same JSON-stringified output for identical input twice
        Binds: FR-22
TDD-05  buildHomebasePreview returns truth_label === "NODE0_LOCAL_SEED"
        Binds: FR-5
TDD-06  buildHomebasePreview returns mode === "preview_only"
        Binds: v0.1 spec §8
TDD-07  buildHomebasePreview output contains "rendered_at" parseable by new Date()
        Binds: phase_03 §3.2 schema
TDD-08  buildHomebasePreview output viewport has cols_target: 76 and rows_target: 22
        Binds: v0.1 spec §2
TDD-09  with profile missing, greeting.text === "Welcome." and greeting.has_name === false
        Binds: EC-1, FR-24
TDD-10  with profile.name === "Mumu", greeting.text === "Welcome back, Mumu."
        Binds: FR-7
TDD-11  with memory_recent empty, memory3.fallback_text === "no prior sessions"
        Binds: EC-4, FR-25
TDD-12  status.gateway.reachable === false AND status.gateway.by_design === true
        Binds: v0.1 spec §14, ADR-001
TDD-13  next_action.text falls back to "press ? to see available actions" when process_mining absent
        Binds: phase_03 §3.4
TDD-14  affordances has exactly 6 entries: keys m, j, r, b, ?, q
        Binds: FR-11, v0.1 spec §6
```

---

## 6.3 · Phase_02 gather · base + edge (5)

```text
TDD-15  gather() resolves with valid GatherResult when ~/.dema/ does not exist
        Binds: EC-1, EC-4
TDD-16  gather() respects DEMA_HOME env var
        Binds: phase_02 §2.5
TDD-17  gather() with 50 memory entries returns exactly 3 in memory_recent (most recent by mtime)
        Binds: phase_01 §1.7, FR-8
TDD-18  gather() with malformed JSON in memory returns partial: true and warnings non-empty
        Binds: EC-7
TDD-19  gather() never throws · always returns · regardless of disk chaos
        Binds: phase_02 §2.6 (covers EC-1..EC-10 collectively)
```

---

## 6.4 · Phase_04 render · base (5)

```text
TDD-20  renderHomebaseTUI under NO_COLOR=1 emits stdout with zero ANSI escapes
        Binds: FR-16, EC-13
TDD-21  renderHomebaseTUI under TERM=dumb emits plain-text output (no Ink fancy chars)
        Binds: FR-17, EC-13
TDD-22  renderHomebaseTUI emits output fitting in 76×22 (every line ≤ 76 chars, ≤ 22 lines until BoundaryFooter)
        Binds: FR-18, EC-11, EC-12
TDD-23  renderHomebaseTUI does NOT write to ~/.dema/ during render (verified by fs spy)
        Binds: FR-19, phase_04 §4.9 TDD-35 [renumbered consistently here]
TDD-24  renderHomebaseTUI does NOT invoke network during render (verified by http spy)
        Binds: FR-20
```

---

## 6.5 · Phase_05 CLI dispatch · base (7)

```text
TDD-25  `dema --json` emits JSON parseable as HomebasePreview
        Binds: FR-2, phase_05 §5.5
TDD-26  `dema` with stdout redirected (non-TTY) emits same JSON as --json
        Binds: FR-3
TDD-27  `dema` with NODE_ENV=test emits JSON (no TUI)
        Binds: phase_05 §5.2
TDD-28  `dema` with DEMA_NO_TUI=1 emits JSON (no TUI)
        Binds: phase_05 §5.2
TDD-29  `dema --version` cold start ≤ 50ms after this patch (no regression)
        Binds: phase_05 §5.6, C-1
TDD-30  `dema | head -1` returns 0 without hanging (EPIPE handled)
        Binds: EC-19
TDD-31  `npm run smoke-boundary` reports commands_checked: 10 (was 9) · all_canonical: true
        Binds: C-10, phase_05 §5.7
```

---

## 6.6 · Adversarial tests (11)

```text
ADV-01  buildHomebasePreview({gather: null}) throws TypeError synchronously
        Binds: phase_03 §3.5
ADV-02  buildHomebasePreview({gather: {ts: "not-a-date"}}) throws TypeError synchronously
        Binds: phase_03 §3.5
ADV-03  buildHomebasePreview attempts to mutate input gather → output is still independent
        (verified by checking that input.warnings is the same reference after build)
        Binds: phase_03 §3.6
ADV-04  prototype-pollution attempt: input.__proto__.evil = 1 → output does NOT include "evil"
        Binds: phase_03 §3.4, broader Master Craftsmanship invariant
ADV-05  buildHomebasePreview with profile.name === "A".repeat(10000) → greeting renders or truncates;
        output STILL deep-frozen; viewport_too_small marker set
        Binds: EC-3, FR-23, FR-18
ADV-06  buildHomebasePreview with profile.name containing emoji and CJK → render does not crash;
        bidi marker present in JSON form
        Binds: EC-3
ADV-07  gather() with permission denied on ~/.dema/profile.json (EACCES) → warning emitted,
        partial: true, no throw
        Binds: EC-2 (extended), phase_02 §2.6
ADV-08  renderHomebaseTUI: user pastes 5000-char string at affordance prompt → silent reject;
        no affordance fires
        Binds: EC-16, phase_04 §4.8
ADV-09  renderHomebaseTUI: user presses Ctrl+C during a consent prompt → clean unmount + exit 0
        Binds: EC-17, EC-18
ADV-10  CLI dispatch: bare `dema` invoked under both NODE_ENV=test AND --json
        → JSON emitted exactly once · no double output · no race
        Binds: EC-14 (TUI variant)
ADV-11  CLI dispatch: bare `dema` then immediately `dema receipts` in same shell
        → no shared mutable state · second invocation cold start unaffected
        Binds: EC-20
```

---

## 6.7 · Performance budget tests (counted under base TDD-29)

These are smoke-level assertions, not micro-benchmarks:

```text
PERF-1  gather() resolves in < 250ms on a real ~/.dema/ (5.8 GB · 24 memory entries)
PERF-2  buildHomebasePreview() returns in < 5ms cold
PERF-3  renderHomebaseTUI initial paint < 200ms after gather completes
PERF-4  bare `dema --version` cold start ≤ 50ms (existing surface · regression test)
```

---

## 6.8 · Integration check additions (3)

To keep `npm run check` green:

```text
INT-1  TESTING.md gains a row for tests/homebase-preview.test.js
INT-2  TESTING.md gains a row for tests/homebase-gather.test.js
INT-3  TESTING.md gains a row for tests/homebase-tui.test.js
       (and TESTING.md gains a row for tests/homebase-cli-dispatch.test.js
        → INT-3.5 same shape)
```

No new HELP entry needed (no new command). `npm run check` should remain green without further edits.

---

## 6.9 · Master Craftsmanship 10-invariant binding (cross-cut)

| #   | Invariant                                                       | Where in this bundle                                                                                                                |
| --- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Canon-bound (schema · truth_label · 16-key boundary)            | phase_03 §3.2                                                                                                                       |
| 2   | Test-backed (≥80% · ≥15 adversarial)                            | this file (42 tests · ≥11 adversarial · room to 15)                                                                                 |
| 3   | Consent-gated (exact-string per ADR-005)                        | phase_04 §4.5 spawnWithConsentGate                                                                                                  |
| 4   | Receipt-emitting (`receipt_shape_ready` flag)                   | NOT YET · v0.1 homebase is preview-only · no receipt emitted by the homebase itself · downstream affordance commands emit their own |
| 5   | Doctrine-coherent (Key Maker V/D/A/U)                           | phase_01 §1.4 + phase_03 doesn't add new V/D/A/U claims · downstream commands carry their own                                       |
| 6   | Boundary-disciplined (declared blocked_effects)                 | phase_05 §5.7 + phase_03 §3.8 (16-key canonical)                                                                                    |
| 7   | Adversarial-tested                                              | phase_06 §6.6                                                                                                                       |
| 8   | Verify-before-asserting                                         | phase_01 §1.4 V/D/A/U + every test has an explicit predicate                                                                        |
| 9   | Reversible (pure functions · preview-only · no I/O in builders) | phase_03 §3.6                                                                                                                       |
| 10  | Cross-referenced (links to ADR + canon)                         | phase_01 §1.6 + README                                                                                                              |

Invariant #4 is the most delicate one: the homebase TUI itself is a viewer, not an actor. It does not need to be receipt-emitting because every affordance invocation routes through an existing command that already emits its own receipt-shaped output. Phase_07 may revisit this if v0.2 adds in-TUI consent actions.

---

## 6.10 · Output to phase_07

```text
OUTPUT  42 tests with predicate-bound IDs
USED BY phase_07 expansion map (v0.2/v0.3 must add their own test IDs · MUST NOT remove any of these)
```

**End of phase_06.**
