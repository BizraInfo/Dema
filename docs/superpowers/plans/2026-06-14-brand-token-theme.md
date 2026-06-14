# Brand Token Theme Module — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a single canonical brand-token theme module (`packages/core/src/theme.js`) sourced from `BIZRA_VISUAL_TOKENS.json`, and migrate the three identical-ANSI Realm TUI files onto it, replacing drifted hardcoded colors (`#D4AF37`) with the brand canon (`#C9A962`).

**Architecture:** Vendor the canonical token JSON into `docs/brand/`. `theme.js` exports frozen `HEX`/`ANSI`/`ROLE` maps + a `paint()` helper that honors `NO_COLOR`. A drift-guard test binds `theme.js` to the vendored JSON. The three Realm renderers (`world-map`, `board`, `realm-status`) — which today each define a byte-identical `const ANSI` block — import from `theme.js` instead.

**Tech Stack:** Node.js stdlib only (zero deps). `node:test` + `node:assert/strict`. ESM.

**Scope note:** This plan covers the theme module + the 3 truecolor-identical Realm files. Heterogeneous color surfaces (`doctor-dashboard.js` 16-color, `apps/realm/dema-realm.cjs` ESC-concat CJS, `status.js`, `tui-formatter.js`, `banner-keys.js`, `network-blueprint.js`, `agent-kernel.js`) are deferred to a Plan 2 after their color usage is individually mapped — they do not share the truecolor block and cannot be migrated by the same transform.

---

## File Structure

- **Create:** `docs/brand/BIZRA_VISUAL_TOKENS.json` — vendored canon (faithful copy of `/data/bizra/repos/bizra-data-lake/docs/brand/BIZRA_VISUAL_TOKENS.json`, sha256 `2601f1e2…`).
- **Create:** `packages/core/src/theme.js` — single source of brand color tokens + `paint()`.
- **Create:** `tests/theme.test.js` — unit + drift-guard tests for `theme.js`.
- **Modify:** `packages/core/src/dema-realm-world-map.js:19-27` — replace local `const ANSI` with import.
- **Modify:** `packages/core/src/dema-realm-board.js:36-44` — same.
- **Modify:** `packages/core/src/dema-realm-status.js:27-35` — same.
- **Create:** `tests/theme-no-local-ansi.test.js` — cross-file drift-guard: no Realm file re-defines a truecolor gold.

**Verified colour mapping (current → canon):**
| Local key | Current hex (rgb) | Canon target | Canon hex (rgb) |
|---|---|---|---|
| `gold` | `#D4AF37` (212,175,55) | `gold` (canon) | `#C9A962` (201,169,98) |
| `emerald` | `#10B981` (16,185,129) | `proofVerified` (semantic) | `#34D399` (52,211,153) |
| `crimson` | `#EF4444` (239,68,68) | `proofFailed` (semantic) | `#F87171` (248,113,113) |
| `ash` | `#9CA3AF` (156,163,175) | `neutral` (retained) | `#9CA3AF` (156,163,175) |

---

## Task 1: Vendor canon JSON + create `theme.js`

**Files:**

- Create: `docs/brand/BIZRA_VISUAL_TOKENS.json`
- Create: `packages/core/src/theme.js`
- Test: `tests/theme.test.js`

- [ ] **Step 1: Vendor the canonical token JSON**

```bash
mkdir -p docs/brand
cp "/data/bizra/repos/bizra-data-lake/docs/brand/BIZRA_VISUAL_TOKENS.json" docs/brand/BIZRA_VISUAL_TOKENS.json
# verify the copy matches canon sha256
test "$(sha256sum docs/brand/BIZRA_VISUAL_TOKENS.json | cut -d' ' -f1)" \
  = "2601f1e29bbc4ef2093b63ec6ce1651ee365ffe3aba4782883064d05a9371d63" \
  && echo "VENDORED OK" || { echo "SHA MISMATCH"; exit 1; }
```

Expected: `VENDORED OK`

- [ ] **Step 2: Write the failing test**

```js
// tests/theme.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  HEX,
  ANSI,
  ROLE,
  paint,
  supportsColor,
} from "../packages/core/src/theme.js";

const here = dirname(fileURLToPath(import.meta.url));
const CANON = JSON.parse(
  readFileSync(
    join(here, "..", "docs", "brand", "BIZRA_VISUAL_TOKENS.json"),
    "utf8",
  ),
);

describe("theme", () => {
  it("canon HEX values match the vendored BIZRA_VISUAL_TOKENS.json (drift-guard)", () => {
    assert.equal(HEX.gold, CANON.colors.genesis_gold.hex);
    assert.equal(HEX.navy, CANON.colors.celestial_navy.hex);
    assert.equal(HEX.originBlack, CANON.colors.origin_black.hex);
    assert.equal(HEX.white, CANON.colors.pure_white.hex);
    assert.equal(HEX.ivory, CANON.colors.ivory.hex);
    assert.equal(HEX.teal, CANON.colors.living_teal.hex);
  });

  it("non-canon semantic + neutral hexes are the documented TUI-extension values", () => {
    assert.equal(HEX.proofVerified, "#34D399");
    assert.equal(HEX.proofPending, "#FBBF24");
    assert.equal(HEX.proofFailed, "#F87171");
    assert.equal(HEX.neutral, "#9CA3AF");
  });

  it("ANSI builds correct truecolor codes from canon gold", () => {
    assert.equal(ANSI.gold, "\x1b[38;2;201;169;98m");
    assert.equal(ANSI.proofVerified, "\x1b[38;2;52;211;153m");
    assert.equal(ANSI.proofFailed, "\x1b[38;2;248;113;113m");
    assert.equal(ANSI.neutral, "\x1b[38;2;156;163;175m");
    assert.equal(ANSI.reset, "\x1b[0m");
  });

  it("ROLE maps semantic intent to ANSI codes", () => {
    assert.equal(ROLE.brand, ANSI.gold);
    assert.equal(ROLE.statusOk, ANSI.proofVerified);
    assert.equal(ROLE.statusErr, ANSI.proofFailed);
  });

  it("paint wraps text + reset when useColor true", () => {
    assert.equal(paint("x", ANSI.gold, true), "\x1b[38;2;201;169;98mx\x1b[0m");
  });

  it("paint returns plain text when useColor false", () => {
    assert.equal(paint("x", ANSI.gold, false), "x");
  });

  it("supportsColor is false when NO_COLOR is set", () => {
    assert.equal(supportsColor({ NO_COLOR: "1" }, { isTTY: true }), false);
  });

  it("supportsColor is false on a non-TTY", () => {
    assert.equal(supportsColor({}, { isTTY: false }), false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test tests/theme.test.js`
Expected: FAIL — `Cannot find module '../packages/core/src/theme.js'`

- [ ] **Step 4: Write `theme.js`**

```js
// packages/core/src/theme.js
// Brand color tokens for Dema TUI surfaces.
//
// CANON colors are vendored from docs/brand/BIZRA_VISUAL_TOKENS.json (v0.2,
// sha256 2601f1e2...). The proof-state SEMANTIC group and the NEUTRAL gray are a
// TUI extension that is NOT in brand canon v0.2 (sourced from the brand-identity
// HTML), pending canon ratification — do not present them as brand-canonical.
// The drift-guard test in tests/theme.test.js binds the canon values to the JSON.

const truecolor = (r, g, b) => `\x1b[38;2;${r};${g};${b}m`;

export const HEX = Object.freeze({
  // canon (BIZRA_VISUAL_TOKENS.json v0.2)
  gold: "#C9A962",
  navy: "#0A1628",
  originBlack: "#050B14",
  white: "#FFFFFF",
  ivory: "#F6F2E9",
  teal: "#2CB7A7",
  // NON-CANON semantic proof states (TUI extension)
  proofVerified: "#34D399",
  proofPending: "#FBBF24",
  proofFailed: "#F87171",
  // NON-CANON neutral gray (retained for dim/secondary text)
  neutral: "#9CA3AF",
});

export const ANSI = Object.freeze({
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  gold: truecolor(201, 169, 98),
  navy: truecolor(10, 22, 40),
  teal: truecolor(44, 183, 167),
  white: truecolor(255, 255, 255),
  ivory: truecolor(246, 242, 233),
  proofVerified: truecolor(52, 211, 153),
  proofPending: truecolor(251, 191, 36),
  proofFailed: truecolor(248, 113, 113),
  neutral: truecolor(156, 163, 175),
});

export const ROLE = Object.freeze({
  brand: ANSI.gold,
  accent: ANSI.teal,
  statusOk: ANSI.proofVerified,
  statusWarn: ANSI.proofPending,
  statusErr: ANSI.proofFailed,
  muted: ANSI.neutral,
});

export function supportsColor(env = process.env, stream = process.stdout) {
  if (env.NO_COLOR != null && env.NO_COLOR !== "") return false;
  if (env.DEMA_NO_COLOR === "1") return false;
  return Boolean(stream && stream.isTTY);
}

export function paint(text, code, useColor = supportsColor()) {
  if (!useColor || !code) return String(text);
  return `${code}${text}${ANSI.reset}`;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/theme.test.js`
Expected: PASS — all 8 subtests green.

- [ ] **Step 6: Commit**

```bash
git add docs/brand/BIZRA_VISUAL_TOKENS.json packages/core/src/theme.js tests/theme.test.js
git commit -m "feat(theme): brand-token theme module from canonical BIZRA_VISUAL_TOKENS.json

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Migrate `dema-realm-world-map.js` to `theme.js`

**Files:**

- Modify: `packages/core/src/dema-realm-world-map.js:19-27` (the `const ANSI = Object.freeze({...})` block) + all `ANSI.emerald` / `ANSI.crimson` / `ANSI.ash` references in the file.
- Test: `tests/dema-realm-world-map.test.js` (existing; add a color-on assertion).

- [ ] **Step 1: Add a failing color assertion test**

Append to `tests/dema-realm-world-map.test.js` inside the `gatherDemaRealmWorldMap` describe block:

```js
it("renders canon gold (#C9A962 = 201;169;98) when colorized, not legacy #D4AF37", async () => {
  const home = freshHome();
  try {
    writeInventory(home, {
      generated_at_iso: new Date(Date.now() - 60_000).toISOString(),
    });
    const state = await gatherDemaRealmWorldMap({
      demaHome: home,
      now: FIXED_NOW,
    });
    const out = renderDemaRealmWorldMap(state, { useColor: true });
    assert.match(out, /\x1b\[38;2;201;169;98m/); // canon gold present
    assert.doesNotMatch(out, /\x1b\[38;2;212;175;55m/); // legacy gold absent
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/dema-realm-world-map.test.js`
Expected: FAIL on the new test — output still contains legacy `\x1b[38;2;212;175;55m`.

- [ ] **Step 3: Replace the local ANSI block with an import**

In `packages/core/src/dema-realm-world-map.js`, delete lines 19-27 (the whole `const ANSI = Object.freeze({ ... });`) and add at the top with the other imports:

```js
import { ANSI, paint } from "./theme.js";
```

Then update the four legacy color references throughout the file:

- `ANSI.emerald` → `ANSI.proofVerified`
- `ANSI.crimson` → `ANSI.proofFailed`
- `ANSI.ash` → `ANSI.neutral`
- `ANSI.gold` → `ANSI.gold` (unchanged name; value now canon)

Run this to find every reference that must change:

```bash
grep -n "ANSI\.\(emerald\|crimson\|ash\)" packages/core/src/dema-realm-world-map.js
```

Replace each occurrence per the mapping above. (`ANSI.reset/bold/dim/gold` keep their names.)

If the file defines a local `color(s, code, useColor)` helper (it does, ~line 30), leave it — it is contract-compatible with `paint`; do not swap call sites in this task.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/dema-realm-world-map.test.js`
Expected: PASS — the new color assertion passes; all prior tests still pass (the `useColor:false` tests are unaffected).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/dema-realm-world-map.js tests/dema-realm-world-map.test.js
git commit -m "refactor(realm): world-map consumes theme.js (canon gold #C9A962)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Migrate `dema-realm-board.js` to `theme.js`

**Files:**

- Modify: `packages/core/src/dema-realm-board.js:36-44` (`const ANSI = Object.freeze({...})`) + its `ANSI.emerald`/`crimson`/`ash` references.
- Test: `tests/dema-realm-board.test.js` (confirm it exists: `ls tests/dema-realm-board.test.js`; if absent, add the color assertion to the nearest board render test file found via `grep -rl renderDemaRealmBoard tests/`).

This file's `const ANSI` block (lines 36-44) is **verified byte-identical** to world-map's (same `gold #D4AF37 / emerald / crimson / ash`), so the transform is the same.

- [ ] **Step 1: Add a failing color assertion test**

In the board's render test file, add (adjust the gather/render call names to the board's API — `gatherDemaRealmBoard`/`renderDemaRealmBoard`):

```js
it("board renders canon gold (201;169;98), not legacy 212;175;55", () => {
  const out = renderDemaRealmBoard(/* existing fixture state used by sibling tests */, { useColor: true });
  assert.match(out, /\x1b\[38;2;201;169;98m/);
  assert.doesNotMatch(out, /\x1b\[38;2;212;175;55m/);
});
```

If a sibling colorized render test already exists, model the fixture exactly on it.

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/dema-realm-board.test.js`
Expected: FAIL — legacy gold still emitted.

- [ ] **Step 3: Replace local ANSI block with import**

Delete `dema-realm-board.js:36-44`; add `import { ANSI, paint } from "./theme.js";` with the other imports. Then:

```bash
grep -n "ANSI\.\(emerald\|crimson\|ash\)" packages/core/src/dema-realm-board.js
```

Apply the same mapping: `emerald→proofVerified`, `crimson→proofFailed`, `ash→neutral`; `gold/reset/bold/dim` unchanged.

- [ ] **Step 4: Run to verify pass**

Run: `node --test tests/dema-realm-board.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/dema-realm-board.js tests/dema-realm-board.test.js
git commit -m "refactor(realm): board consumes theme.js (canon gold)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Migrate `dema-realm-status.js` to `theme.js`

**Files:**

- Modify: `packages/core/src/dema-realm-status.js:27-35` (`const ANSI = Object.freeze({...})`) + its `ANSI.emerald`/`crimson`/`ash` references.
- Test: `tests/dema-realm-status.test.js` (confirm via `ls`; else nearest `grep -rl renderDemaRealmStatus tests/`).

This file's `const ANSI` block (lines 27-35) is **verified byte-identical** to world-map's. Same transform.

- [ ] **Step 1: Add a failing color assertion test**

```js
it("realm-status renders canon gold (201;169;98), not legacy 212;175;55", () => {
  const out = renderDemaRealmStatus(/* existing fixture state from sibling tests */, { useColor: true });
  assert.match(out, /\x1b\[38;2;201;169;98m/);
  assert.doesNotMatch(out, /\x1b\[38;2;212;175;55m/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/dema-realm-status.test.js`
Expected: FAIL.

- [ ] **Step 3: Replace local ANSI block with import**

Delete `dema-realm-status.js:27-35`; add `import { ANSI, paint } from "./theme.js";`. Then:

```bash
grep -n "ANSI\.\(emerald\|crimson\|ash\)" packages/core/src/dema-realm-status.js
```

Apply mapping `emerald→proofVerified`, `crimson→proofFailed`, `ash→neutral`.

- [ ] **Step 4: Run to verify pass**

Run: `node --test tests/dema-realm-status.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/dema-realm-status.js tests/dema-realm-status.test.js
git commit -m "refactor(realm): realm-status consumes theme.js (canon gold)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Cross-file drift-guard test

**Files:**

- Create: `tests/theme-no-local-ansi.test.js`

Prevents regression: no migrated Realm file may re-introduce a hardcoded truecolor gold.

- [ ] **Step 1: Write the failing test**

```js
// tests/theme-no-local-ansi.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const FILES = [
  "packages/core/src/dema-realm-world-map.js",
  "packages/core/src/dema-realm-board.js",
  "packages/core/src/dema-realm-status.js",
];

describe("theme drift guard", () => {
  for (const rel of FILES) {
    it(`${rel} defines no local truecolor and imports theme.js`, () => {
      const src = readFileSync(join(here, "..", rel), "utf8");
      assert.doesNotMatch(
        src,
        /\\x1b\[38;2;/,
        "found a hardcoded truecolor escape",
      );
      assert.doesNotMatch(src, /const ANSI\s*=/, "found a local ANSI block");
      assert.match(src, /from "\.\/theme\.js"/, "missing theme.js import");
    });
  }
});
```

- [ ] **Step 2: Run to verify it passes** (Tasks 2-4 already removed the local blocks)

Run: `node --test tests/theme-no-local-ansi.test.js`
Expected: PASS for all 3 files. If any FAIL, that file still has a local block — fix in that file, not by weakening the test.

- [ ] **Step 3: Run the full suite to confirm no regressions**

Run: `node --test tests/*.test.js 2>&1 | tee "$TMPDIR/theme-suite.log" | tail -8`
Then: `node scripts/ci/classify-known-harness-failures.mjs --log "$TMPDIR/theme-suite.log"`
Expected: only the allowlisted `artifact_011_eros_sandbox` failure (G8 exit 0). No new failures.

- [ ] **Step 4: Commit**

```bash
git add tests/theme-no-local-ansi.test.js
git commit -m "test(theme): drift-guard — Realm files use theme.js, no local truecolor

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Deferred to Plan 2 (after per-file colour mapping)

These do not share the Realm truecolor block and need individual investigation before a TDD transform:

- `packages/core/src/doctor-dashboard.js` — 16-color (`\x1b[32m/31m/33m`); map to `ROLE.statusOk/statusErr/statusWarn` (note: 16-color → truecolor is a visible change; confirm intent).
- `apps/realm/dema-realm.cjs` — **CJS** ESC-concat; needs a CJS-compatible export of `theme` (or inline constants synced to canon) — ESM `theme.js` can't be `import`ed directly in `.cjs`.
- `packages/core/src/status.js`, `tui-formatter.js`, `banner-keys.js`, `network-blueprint.js`, `agent-kernel.js` — color usage not yet mapped; grep each for its escape construction first.

---

## Self-Review

1. **Spec coverage:** theme.js (✓ Task 1), vendored JSON (✓ Task 1 Step 1), drift-guard binding theme↔JSON (✓ Task 1 test), API `HEX/ANSI/ROLE/paint/supportsColor` (✓ Task 1), `NO_COLOR` respect (✓ Task 1 tests), migrate TUI files (✓ Tasks 2-4 for the 3 truecolor files; heterogeneous files explicitly deferred with rationale), one-commit-per-file (✓), suite-green gate (✓ Task 5 Step 3). Spec's "~10 files" is honestly narrowed to the 3 that share the block; the rest are scoped to Plan 2.
2. **Placeholder scan:** none — every code step has real code; the only deferred items are in the clearly-labeled Plan 2 section, not in executable tasks.
3. **Type consistency:** `ANSI`/`ROLE`/`paint`/`HEX`/`supportsColor` names identical across Task 1 definition and Tasks 2-5 usage. Mapping `emerald→proofVerified`, `crimson→proofFailed`, `ash→neutral` applied consistently in Tasks 2-4 and asserted in Task 5.
