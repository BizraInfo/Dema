# Phase 3 · `buildHomebasePreview` Pure Builder Pseudocode

**Pseudocode-bundle file:** `phase_03_build_homebase_preview_pseudocode.md`
**Maps to:** v0.1 spec §4-§8 + phase_01 FR-4, FR-5, FR-6, FR-22, FR-23.
**Goal:** specify the pure, deterministic, deep-frozen builder that produces the canonical homebase preview from a `GatherResult`.

---

## 3.1 · Module identity

```text
TARGET FILE  packages/core/src/homebase-preview.js
EXPORTS      buildHomebasePreview({ gather }) → frozen object
PURITY       PURE · zero I/O · zero clock reads (clock passed in via gather.ts)
RETURNS      Object.freeze applied at every depth · matches schema bizra.dema.homebase_v0_1.v0.1
TEST FILE    tests/homebase-preview.test.js
SHARED       preview-boundary.js (existing) · preview-primitive-shape.js (existing)
```

Phase_03 is the surface that smoke-boundary verifies as the 10th canonical spine surface.

---

## 3.2 · Schema · `bizra.dema.homebase_v0_1.v0.1`

```jsonc
{
  "schema": "bizra.dema.homebase_v0_1.v0.1",
  "truth_label": "NODE0_LOCAL_SEED",
  "mode": "preview_only",
  "rendered_at": "<ISO 8601 UTC>",
  "partial": false,
  "warnings": [],
  "viewport": { "cols_target": 76, "rows_target": 22 },

  "header": {
    "node_name": "<string>", // from gather.profile.node · default "Node0"
    "date_human_gst": "<string>", // "Mon 18 May 2026"
    "time_human_gst": "<string>", // "03:42 GST"
    "dema_version": "<string>", // from package.json
  },

  "greeting": {
    "text": "<string>", // "Welcome back, Mumu." · or "Welcome."
    "has_name": true, // false if profile missing
    "name_source": "profile_json", // or "absent"
  },

  "memory3": {
    "entries": [
      // length 0..3 · pad with nulls only in JSON form
      { "name": "<string>", "summary": "<string|null>" },
    ],
    "fallback_text": null, // "no prior sessions" when empty
  },

  "status": {
    "ring": {
      "label": "Ring 0 verified · Ring 1 pack sealed",
      "bar": "▓▓░░░░░░░░",
      "ratio": 0.2,
    },
    "mission": { "label": "clear", "icon": "◉", "active_count": 0 },
    "gateway": {
      "label": "unreachable (by design · no runtime here)",
      "icon": "○",
      "reachable": false,
      "by_design": true,
    },
    "memory_bar": {
      "label": "24 entries · 5.8 GB",
      "bar": "▓▓▓▓▓▓▓▓▓▓",
      "ratio": 1.0,
      "bytes": 0,
      "entries": 0,
    },
  },

  "next_action": {
    "text": "choose a Lighthouse N=1 candidate (~14 min · localfirst.fm)",
    "kind": "operator_act", // operator_act | preview | journal | quit
    "source": "process_mining_preview",
    "command": null, // null when next action is operator-side
  },

  "affordances": [
    {
      "key": "m",
      "label": "Mission",
      "command": "dema mission draft",
      "boundary_level": "L2_propose",
    },
    {
      "key": "j",
      "label": "Journal",
      "command": "dema today",
      "boundary_level": "L1_remember",
    },
    {
      "key": "r",
      "label": "Receipts",
      "command": "dema receipts",
      "boundary_level": "L0_observe",
    },
    {
      "key": "b",
      "label": "Browse",
      "command": "<sub_screen:memory>",
      "boundary_level": "L0_observe",
    },
    {
      "key": "?",
      "label": "Help",
      "command": "dema help",
      "boundary_level": "L0_observe",
    },
    {
      "key": "q",
      "label": "Quit",
      "command": "<exit>",
      "boundary_level": "L0_observe",
    },
  ],

  "boundary": {
    /* canonical 16-key · all false · §8 of v0.1 spec */
  },
}
```

Total ≤ 50 keys at the top level + boundary. Fits well under any reasonable size budget.

---

## 3.3 · Builder pseudocode

```text
import { buildCanonicalBoundary } from "./preview-boundary.js"
import { freezeDeep }             from "./preview-primitive-shape.js"
import pkg                        from "../../../package.json" with { type: "json" }

const SCHEMA      = "bizra.dema.homebase_v0_1.v0.1"
const TRUTH_LABEL = "NODE0_LOCAL_SEED"
const MODE        = "preview_only"

export function buildHomebasePreview({ gather }) {
  assertGatherShape(gather)   // throws TypeError if invalid (programmer error · NOT runtime degradation)

  const header     = buildHeader(gather)
  const greeting   = buildGreeting(gather)
  const memory3    = buildMemory3(gather)
  const status     = buildStatus(gather)
  const next_act   = buildNextAction(gather)
  const affords    = buildAffordances(gather)

  const out = {
    schema:           SCHEMA,
    truth_label:      TRUTH_LABEL,
    mode:             MODE,
    rendered_at:      gather.ts.toISOString(),
    partial:          gather.partial,
    warnings:         [...gather.warnings],
    viewport:         { cols_target: 76, rows_target: 22 },
    header,
    greeting,
    memory3,
    status,
    next_action:      next_act,
    affordances:      affords,
    boundary:         buildCanonicalBoundary({ schema: SCHEMA, mode: MODE })
  }
  return freezeDeep(out)
}
```

---

## 3.4 · Sub-builders

### `buildHeader`

```text
buildHeader(g) {
  const d = g.ts
  return {
    node_name:        g.profile.node ?? "Node0",
    date_human_gst:   formatGstDate(d),     // e.g., "Mon 18 May 2026"
    time_human_gst:   formatGstTime(d),     // e.g., "03:42 GST"
    dema_version:     pkg.version
  }
}
```

`formatGstDate` and `formatGstTime` are pure functions over a `Date`; no `Date.now()` calls. Phase_03 has no clock access of its own — the clock is captured by phase_02 and passed in as `gather.ts`.

### `buildGreeting`

```text
buildGreeting(g) {
  if (!g.profile.source_present || !g.profile.name) {
    return { text: "Welcome.", has_name: false, name_source: "absent" }
  }
  return {
    text:        `Welcome back, ${g.profile.name}.`,
    has_name:    true,
    name_source: "profile_json"
  }
}
```

EC-2 + FR-24 fall out of this branch.

### `buildMemory3`

```text
buildMemory3(g) {
  if (g.memory_recent.length === 0) {
    return { entries: [], fallback_text: "no prior sessions" }
  }
  const entries = g.memory_recent.slice(0, 3).map((m) => ({
    name:    m.name,
    summary: m.summary ?? null
  }))
  // EC-6 pad: in JSON form we DO NOT pad; in render form (phase_04) we pad with "—"
  return { entries, fallback_text: null }
}
```

### `buildStatus`

```text
buildStatus(g) {
  const ring_ratio = computeRingRatio(g)   // pure · derived from state + receipts
  return {
    ring:    {
      label: g.process_mining?.ring_advancement_status ?? "Ring 0 verified",
      bar:   bar10(ring_ratio),
      ratio: ring_ratio
    },
    mission: {
      label:        g.state?.mission_centered ? "active" : "clear",
      icon:         g.state?.mission_centered ? "●" : "◉",
      active_count: g.state?.active_mission_count ?? 0
    },
    gateway: {
      label:     "unreachable (by design · no runtime here)",
      icon:      "○",
      reachable: false,
      by_design: true                       // ALWAYS true in v0.1 (ADR-001)
    },
    memory_bar: {
      label:   `${g.memory_size.entries} entries · ${formatBytes(g.memory_size.bytes)}`,
      bar:     bar10(min(1, g.memory_size.entries / 24)),
      ratio:   min(1, g.memory_size.entries / 24),
      bytes:   g.memory_size.bytes,
      entries: g.memory_size.entries
    }
  }
}
```

`computeRingRatio` is a pure helper; default 0.2 (Ring 0 verified · pack sealed) until process-mining preview surfaces an advancement.

### `buildNextAction`

```text
buildNextAction(g) {
  // Priority order:
  // 1. Process-mining "next_step_observable" if present
  // 2. Status-based default: if mission active → "review mission"
  //                          else if pack sealed but no reviewer named → "choose Lighthouse N=1 candidate"
  //                          else                                         → "press ? for help"
  const observable = g.process_mining?.next_step_observable
  if (observable && typeof observable === "string") {
    return {
      text:    observable,
      kind:    classifyKind(observable),
      source:  "process_mining_preview",
      command: null
    }
  }
  return {
    text:    "press ? to see available actions",
    kind:    "preview",
    source:  "fallback",
    command: null
  }
}
```

### `buildAffordances`

Static list per v0.1 spec §6. The 6 entries match `dema` commands verified at HEAD `ad0b1fb` (see phase_01 §1.4). No new commands are introduced.

```text
const v01_AFFORDANCES = [
  { key: "m", label: "Mission",  command: "dema mission draft",  boundary_level: "L2_propose"  },
  { key: "j", label: "Journal",  command: "dema today",          boundary_level: "L1_remember" },
  { key: "r", label: "Receipts", command: "dema receipts",       boundary_level: "L0_observe"  },
  { key: "b", label: "Browse",   command: "<sub_screen:memory>", boundary_level: "L0_observe"  },
  { key: "?", label: "Help",     command: "dema help",           boundary_level: "L0_observe"  },
  { key: "q", label: "Quit",     command: "<exit>",              boundary_level: "L0_observe"  }
]

buildAffordances(g) {
  return v01_AFFORDANCES.slice()    // returned as new array · then frozen at top level
}
```

The list is NOT data-driven by `gather` in v0.1 — affordances are static. v0.2 may introduce conditional affordances (phase_07).

---

## 3.5 · `assertGatherShape`

```text
assertGatherShape(g) {
  if (!g || typeof g !== "object")                            throw new TypeError("gather missing")
  if (!(g.ts instanceof Date) || isNaN(g.ts.getTime()))       throw new TypeError("gather.ts not a valid Date")
  if (!g.profile || typeof g.profile !== "object")            throw new TypeError("gather.profile missing")
  if (!Array.isArray(g.memory_recent))                        throw new TypeError("gather.memory_recent must be Array")
  if (!Array.isArray(g.warnings))                             throw new TypeError("gather.warnings must be Array")
  if (typeof g.partial !== "boolean")                         throw new TypeError("gather.partial must be boolean")
  if (!g.env_flags || typeof g.env_flags !== "object")        throw new TypeError("gather.env_flags missing")
  // (Optional fields like state/process_mining/models may be null · do not check positively)
}
```

This protects against EC-8 cascading into a malformed preview. Phase_06 has dedicated tests for each branch.

---

## 3.6 · Determinism guarantees

The builder must satisfy (FR-22):

```text
∀ g₁, g₂ : deepEqual(g₁, g₂) ⇒ deepEqual(buildHomebasePreview({gather: g₁}), buildHomebasePreview({gather: g₂}))
```

Concretely:

1. No `Date.now()` inside phase_03 (clock is in `gather.ts`).
2. No `Math.random()` anywhere.
3. No `process.env.*` reads inside phase_03 (env is in `gather.env_flags`).
4. No mutation of `gather` (defensive copy `[...gather.warnings]`).
5. No file system access.

Phase_06 TDD-05 verifies this by calling the builder twice with the same gather and comparing JSON.stringify outputs byte-for-byte.

---

## 3.7 · Deep-freeze guarantee

`freezeDeep` is the existing helper at `packages/core/src/preview-primitive-shape.js`. It is the shared shape-frozen primitive used by all 9 current spine surfaces, so reusing it ensures phase_06 TDD-06 holds without new code.

```text
freezeDeep(obj) {
  for (const key of Object.getOwnPropertyNames(obj)) {
    const val = obj[key]
    if (val !== null && typeof val === "object") freezeDeep(val)
  }
  return Object.freeze(obj)
}
```

(Existing implementation may differ slightly; phase_03 must use the existing helper verbatim.)

---

## 3.8 · Canonical boundary integration

```text
buildCanonicalBoundary({ schema, mode }) → 16-key object with every value === false
```

The existing helper at `packages/core/src/preview-boundary.js` already provides this. Phase_03 imports it and passes it the schema/mode for cross-tagging.

Phase_06 TDD-02 verifies the 16-key structure matches the canon at `preview-boundary.js`.

---

## 3.9 · Output to phase_04 and phase_05

```text
OUTPUT  HomebasePreview frozen object
USED BY phase_04 (TUI render · destructures into Ink JSX) + phase_05 (JSON emit)
```

Phase_04 and phase_05 NEVER call `buildHomebasePreview` directly without first calling `gather()`. The lifecycle is always `gather → build → render-or-emit`.

---

## 3.10 · Test handles (phase_06 hook)

The following TDD anchors in phase_06 hit this module directly:

```text
TDD-01  schema · truth_label · mode all match constants
TDD-02  boundary has exactly 16 keys · all false
TDD-03  output deep-frozen at all depths (Object.isFrozen)
TDD-04  determinism: buildHomebasePreview(g) byte-equal across runs
TDD-05  determinism continued: side-effecting twice doesn't drift
TDD-06  freezeDeep recursion verified on nested status object
TDD-09  missing profile yields "Welcome." + has_name: false
TDD-10  profile with name yields "Welcome back, <name>."
TDD-11  empty memory_recent yields fallback_text "no prior sessions"
TDD-12  status.gateway always reachable: false · by_design: true
TDD-13  next_action falls back to "press ? to see available actions"
TDD-14  affordances list has exactly 6 entries with valid commands
TDD-18  every affordance command exists in the CLI surface
```

Plus adversarial:

```text
TDD-A01  malformed gather (missing ts) throws TypeError synchronously
TDD-A02  prototype pollution attempt (gather.__proto__.evil = 1) doesn't leak into output
TDD-A03  gather with frozen inputs still produces a frozen output (no mutation attempts)
TDD-A04  enormously long profile name (10k chars) doesn't break greeting (truncate or render-as-is per FR-18 viewport check)
TDD-A05  unicode RTL profile name produces correct claim-state marker · v0.2 may defer bidi rendering
```

---

## 3.11 · Performance budget

```text
buildHomebasePreview() cold:  ≤ 5 ms wall clock for realistic gather (24 memory entries · full state)
buildHomebasePreview() hot:   ≤ 1 ms after V8 warm
```

Most of the 250ms total budget (C-1) belongs to `gather` (disk I/O); the builder is a small fraction.

**End of phase_03.**
