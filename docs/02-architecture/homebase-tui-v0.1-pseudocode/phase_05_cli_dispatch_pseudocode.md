# Phase 5 · CLI Dispatch Pseudocode

**Pseudocode-bundle file:** `phase_05_cli_dispatch_pseudocode.md`
**Maps to:** v0.1 spec §7 (non-TTY fallback) + phase_01 FR-1, FR-2, FR-3.
**Goal:** specify the smallest possible patch to `apps/cli/src/index.js` (existing file) that routes bare `dema` invocation to either the homebase TUI (TTY) or the schema-tagged JSON form (non-TTY or `--json`).

---

## 5.1 · Module identity

```text
TARGET FILE     apps/cli/src/index.js                  (existing · ~46 commands · ~780 LOC at HEAD ad0b1fb)
MUTATION SHAPE  ADD a top-level branch in the bare-invocation handler
                MUST NOT change behavior of any other subcommand
                MUST NOT introduce a new top-level command name
TEST FILE       tests/homebase-cli-dispatch.test.js
```

The cloud-author blueprint mistakenly suggests `dema tui` as a new command. **v0.1 spec §10 is explicit: the bare `dema` invocation is rerouted, not a new command added.** Phase_05 honors §10.

---

## 5.2 · Dispatch decision tree

```text
Entry: bare `dema` invocation (no subcommand args)

if (--help) → existing help path                                    (unchanged)
if (--version) → existing version path                              (unchanged)

if (--json) → emitHomebaseJson()                                    (new branch)
if (!process.stdout.isTTY) → emitHomebaseJson()                     (new branch · FR-3)
if (process.env.DEMA_NO_TUI) → emitHomebaseJson()                   (new branch · escape hatch)
if (process.env.NODE_ENV === "test") → emitHomebaseJson()           (new branch · deterministic test runs)

else → renderHomebaseTui()                                          (new branch · FR-1)
```

The first 4 branches cover non-TTY environments + manual opt-out. Only when the operator runs bare `dema` on an interactive terminal does the TUI render.

---

## 5.3 · Pseudocode patch to `apps/cli/src/index.js`

```text
// NEAR EXISTING bareInvocationHandler():

async function bareInvocationHandler(opts) {
  // EXISTING: opts.help / opts.version paths remain unchanged.

  // NEW: route to homebase TUI / JSON.
  if (opts.help || opts.version) return existingBranches(opts)

  const wantJson =
    opts.json ||
    !process.stdout.isTTY ||
    Boolean(process.env.DEMA_NO_TUI) ||
    process.env.NODE_ENV === "test"

  const gather = await import("@bizra/cli-tui/gather.js").then(m => m.gather)
  const buildHomebasePreview = await import("@bizra/core/homebase-preview.js")
                                       .then(m => m.buildHomebasePreview)

  const gathered = await gather()
  const preview  = buildHomebasePreview({ gather: gathered })

  if (wantJson) {
    process.stdout.write(JSON.stringify(preview, null, 2) + "\n")
    return 0
  }

  const { renderHomebaseTUI } = await import("@bizra/cli-tui/homebase-render.js")
  await renderHomebaseTUI(preview)
  return 0
}
```

The dynamic imports keep the cold-start path for non-bare invocations (e.g., `dema receipts`) unaffected by the new TUI dependency tree. Phase_06 TDD-39 verifies bare-`dema` cold start stays under the existing ≤ 50ms budget (memory: analyzer reports sub-50ms across 9 spine surfaces).

---

## 5.4 · Help-discovery integration

The `npm run check` integration runs `help-discovery` against the CLI surface. Bare `dema` already has a help entry. Phase_05 does not introduce a new command name, so the help-discovery check remains green without any TESTING.md / help entry edits.

**Critical:** if a future v0.2 introduces `dema tui` as an explicit subcommand alongside the bare `dema` route (per phase_07), it would require:

1. A new HELP entry (`apps/cli/src/help.js` or equivalent).
2. A new TESTING.md row.
3. A new smoke-cli-match entry.
4. A new test file in `tests/`.

v0.1 deliberately avoids all four to keep the LOC budget tight.

---

## 5.5 · Non-TTY JSON contract

When non-TTY or `--json`:

```text
stdout:  {schema-tagged JSON · pretty-printed · 2-space indent · trailing newline}
stderr:  (silent unless errors)
exit:    0 on success · non-zero if gather threw (should never happen per phase_02 §2.6)
```

Pretty-printing is chosen for human-pipe-friendliness (e.g., `dema | less`). Phase_06 TDD-40 verifies `JSON.parse(stdout)` returns a valid HomebasePreview with all required fields.

---

## 5.6 · Backwards compatibility

| Existing behavior                            | Preserved?                                                            |
| -------------------------------------------- | --------------------------------------------------------------------- |
| `dema --help`                                | YES                                                                   |
| `dema --version`                             | YES                                                                   |
| `dema receipts` and all 45 other subcommands | YES                                                                   |
| `dema status` JSON output                    | YES                                                                   |
| Cold start for `dema receipts` ≤ 50ms        | YES (dynamic import scoped to bare-invocation branch)                 |
| Behavior under CI (no TTY)                   | CHANGED · now emits homebase JSON instead of the active-kernel banner |

The change-of-CI-behavior is intentional and audited:

- Old behavior: bare `dema` on CI emitted the active-kernel banner (text).
- New behavior: bare `dema` on CI emits schema-tagged JSON.
- Reason: phase_01 FR-3 + smoke-boundary now covers the 10th surface.

If any existing CI consumer parses the active-kernel banner text, it will need a one-line migration (use `JSON.parse(stdout)` instead of regex over banner text). The internal smoke check at `npm run check` already uses JSON paths.

---

## 5.7 · Smoke-boundary registration

The new schema `bizra.dema.homebase_v0_1.v0.1` must appear in the smoke-boundary harness:

```text
TARGET FILE  scripts/smoke-boundary.js  (existing)
MUTATION     ADD a check that invokes `node apps/cli/src/index.js --json`
             and verifies the returned JSON satisfies:
               1. schema === "bizra.dema.homebase_v0_1.v0.1"
               2. truth_label === "NODE0_LOCAL_SEED"
               3. boundary has exactly 16 keys · all false
             ADD this as the 10th surface (currently 9)
```

After this mutation:

```text
$ npm run smoke-boundary
{ commands_checked: 10, all_canonical: true, ... }
```

Phase_06 TDD-41 verifies this transition.

---

## 5.8 · LLM guidance check

`npm run llm:guidance` already verifies 7 invariants. The homebase JSON form must pass these without modification because it inherits the canonical boundary + truth_label discipline. No mutation required in this phase.

---

## 5.9 · Test handles (phase_06 hook)

```text
TDD-39  bare `dema --version` cold start ≤ 50ms (no regression from new dynamic imports)
TDD-40  bare `dema --json` emits parseable JSON matching schema
TDD-41  bare `dema` under DEMA_NO_TUI=1 emits JSON, not TUI
TDD-42  bare `dema` under NODE_ENV=test emits JSON, not TUI
TDD-43  smoke-boundary check sees 10 canonical surfaces, all green
TDD-44  bare `dema 2>&1 | head -1` does NOT hang waiting for input (EPIPE)
TDD-45  bare `dema` followed by `q` exits 0 within 1s (smoke render + dismiss)
```

---

## 5.10 · LOC budget

| Mutation site                                 | Estimated LOC delta |
| --------------------------------------------- | ------------------- |
| apps/cli/src/index.js (bareInvocationHandler) | +25                 |
| scripts/smoke-boundary.js                     | +15                 |
| **Subtotal phase_05**                         | **+40**             |

Total bundle LOC (phase_02..05): ~317 (phase_04) + ~150 (phase_02) + ~100 (phase_03 helpers) + ~40 (phase_05) = **~607**. Higher than the v0.1 spec's ~400 estimate; primarily from phase_04 Ink components. Worth flagging at impl-GO time; possible mitigations:

- Combine 4 status sub-components into one
- Defer memory-browser subscreen to v0.2 (saves ~50 LOC)
- Use Ink's `<Box>` defaults more aggressively to drop per-component wrapper LOC

**End of phase_05.**
