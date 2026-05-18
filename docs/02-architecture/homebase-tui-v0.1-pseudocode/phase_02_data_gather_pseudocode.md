# Phase 2 · Data Gather Pseudocode

**Pseudocode-bundle file:** `phase_02_data_gather_pseudocode.md`
**Maps to:** v0.1 spec §5 (data flow) + phase_01 FR-3, FR-7, FR-8, FR-9, FR-10, EC-1 through EC-10.
**Goal:** specify the impure shim that reads disk + invokes existing builders and returns a `GatherResult` that phase_03's pure builder consumes.

---

## 2.1 · Module identity

```text
TARGET FILE  packages/core/src/homebase-gather.js   (impl placement · see §2.1.1)
SPEC TARGET  packages/cli-tui/src/gather.js          (original pseudocode target)
EXPORTS      async function gather(opts = {}) → Promise<GatherResult>
PURITY       impure (disk I/O · invokes existing builders that may read disk)
SIDE EFFECTS reads only · NEVER writes (C-5)
DEPS         node:fs · node:path · node:os · existing @bizra/core builders
TEST FILE    tests/homebase-gather.test.js
```

### 2.1.1 · Module placement deviation (binding)

Pseudocode originally specified `packages/cli-tui/src/gather.js`. That package
does not exist on disk at HEAD `ad0b1fb` (the spec-authoring HEAD) or at HEAD
`91d8b80` (phase-3 ship). The impl landed at `packages/core/src/homebase-gather.js`
to match the convention of every existing builder/preview (`state.js`,
`process-mining-preview.js`, `consent-card-preview.js`, …).

This is a known design debt. When phase-4 (TUI render) lands and creates the
`@bizra/dema-cli-tui` package, either:

  (a) `homebase-gather.js` moves there and `@bizra/dema-core` no longer
      depends on it; or
  (b) the gather adapter stays in core (read-only adapter is fine in core)
      and phase-4 imports from core via the established
      `@bizra/dema-core` export surface.

Option (b) is preferred — phase-2 has no TUI semantics; it is a read-only
disk adapter that any consumer can use. Phase-4 should treat it as a core
primitive, not a TUI-internal helper.

This note exists so phase-4 doesn't reproduce the pseudocode's stale target
path without thinking. The spec target field above is kept honest as
historical artifact; the impl path is the operative one.

---

## 2.2 · GatherResult shape

```text
GatherResult = {
  schema_version:   "bizra.dema.homebase_gather.v0.1"   // not the spine schema; internal contract
  ts:               Date                                  // rendered_at upstream
  partial:          boolean                               // true if any source failed gracefully
  warnings:         string[]                              // human-readable degradation notes
  profile:          { name: string | null, node: string | null, source_present: boolean }
  memory_recent:    Array<{ name: string, mtime_ms: number, summary: string | null }>   // length 0..3
  state:            ReturnType<buildNode0StatePreview> | null
  receipts:         { count: number, last_id: string | null, gateway_issued: number }   // shape derived
  process_mining:   ReturnType<buildProcessMiningSummary> | null
  models:           ReturnType<buildLocalModelInventoryScan> | null                     // optional · for Status.models bar
  memory_size:      { bytes: number, entries: number }                                  // from ~/.dema/ du-sh-equivalent
  env_flags:        { no_color: boolean, term_dumb: boolean, tty: boolean }
}
```

Each field carries a default safe-degraded value (null / 0 / []) so phase_03 never sees `undefined`.

---

## 2.3 · Pseudocode

```text
async function gather(opts = {}) {
  // STEP 0 · resolve roots
  const home    = process.env.DEMA_HOME || join(os.homedir(), ".dema")
  const t0      = performance.now()
  const result  = newEmptyGatherResult()
  result.ts     = new Date()

  // STEP 1 · profile (EC-1, EC-2, EC-3)
  result.profile = await tryRead(
    () => readJSON(join(home, "profile.json")),
    {
      onSuccess: (raw) => ({
        name:           pickString(raw, "name") ?? null,
        node:           pickString(raw, "node") ?? "Node0",
        source_present: true,
      }),
      onMissing: () => ({ name: null, node: "Node0", source_present: false }),
      onError:   (err) => {
        result.warnings.push(`profile.json read failed: ${err.message}`)
        result.partial = true
        return { name: null, node: "Node0", source_present: false }
      }
    }
  )

  // STEP 2 · 3 most recent memory entries (EC-4 .. EC-7)
  result.memory_recent = await tryReadMany(
    () => listMemoryFiles(join(home, "memory")),
    {
      sortBy:   "mtime_ms_desc",
      take:     3,
      mapEach:  async (f) => {
        try {
          const j = await readJSON(f.path)
          return {
            name:     basename(f.path, ".json"),
            mtime_ms: f.mtime_ms,
            summary:  pickString(j, "summary") ?? pickString(j, "title") ?? null,
          }
        } catch (err) {
          result.warnings.push(`memory entry ${f.path}: ${err.message}`)
          result.partial = true
          return null  // filtered after map
        }
      },
      filterNull: true,
      onMissing:  () => { result.warnings.push("no ~/.dema/memory directory · empty homebase"); return [] }
    }
  )

  // STEP 3 · Node0 state (existing builder)
  result.state = await tryBuilder(
    () => coreBuilders.buildNode0StatePreview({ home }),
    (err) => {
      result.warnings.push(`state preview failed: ${err.message}`)
      result.partial = true
      return null
    }
  )

  // STEP 4 · receipts (existing API · EC-10)
  result.receipts = await tryBuilder(
    () => coreBuilders.listReceipts({ home }),
    (err) => {
      result.warnings.push(`receipts list failed: ${err.message}`)
      result.partial = true
      return { count: 0, last_id: null, gateway_issued: 0 }
    },
    /* shapeAdapter */ (raw) => ({
      count:           Array.isArray(raw) ? raw.length : (raw.count ?? 0),
      last_id:         Array.isArray(raw) && raw.length ? raw[raw.length-1].id : null,
      gateway_issued:  raw.gateway_issued ?? 0,
    })
  )

  // STEP 5 · process mining (existing builder)
  result.process_mining = await tryBuilder(
    () => coreBuilders.buildProcessMiningSummary({ home }),
    (err) => {
      result.warnings.push(`process-mining failed: ${err.message}`)
      result.partial = true
      return null
    }
  )

  // STEP 6 · models inventory (optional · used for Status.models bar in v0.1+)
  if (opts.include_models !== false) {
    result.models = await tryBuilder(
      () => coreBuilders.buildLocalModelInventoryScan({ home, summary: true }),
      () => null  // silent · models surface is optional in v0.1
    )
  }

  // STEP 7 · memory size · directory walk (read-only)
  result.memory_size = await tryDirSize(
    join(home),
    {
      onError: () => ({ bytes: 0, entries: 0 })
    }
  )

  // STEP 8 · env flags
  result.env_flags = {
    no_color:  Boolean(process.env.NO_COLOR),
    term_dumb: process.env.TERM === "dumb",
    tty:       Boolean(process.stdout.isTTY),
  }

  // STEP 9 · timing budget enforcement (C-1)
  const elapsed_ms = performance.now() - t0
  if (elapsed_ms > GATHER_TIMING_BUDGET_MS) {
    result.warnings.push(`gather ${elapsed_ms.toFixed(0)}ms exceeded budget ${GATHER_TIMING_BUDGET_MS}ms`)
    // do NOT fail · this is a warning · render still proceeds
  }

  return result
}
```

---

## 2.4 · Helper pseudocode

```text
async function tryRead<T>(reader, {onSuccess, onMissing, onError}) {
  try {
    const raw = await reader()
    if (raw == null) return onMissing()
    return onSuccess(raw)
  } catch (err) {
    if (err.code === "ENOENT") return onMissing()
    return onError(err)
  }
}

async function tryReadMany<TOut>(lister, {sortBy, take, mapEach, filterNull, onMissing}) {
  let files
  try {
    files = await lister()
  } catch (err) {
    if (err.code === "ENOENT") return onMissing()
    throw err
  }
  sortInPlace(files, sortBy)
  const sliced = files.slice(0, take)
  const mapped = await Promise.all(sliced.map(mapEach))
  return filterNull ? mapped.filter((x) => x != null) : mapped
}

async function tryBuilder<T>(callBuilder, fallback, shapeAdapter = identity) {
  try {
    const raw = await callBuilder()
    return shapeAdapter(raw)
  } catch (err) {
    return fallback(err)
  }
}

async function listMemoryFiles(dir) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true })
  const json    = entries.filter((e) => e.isFile() && e.name.endsWith(".json"))
  const stats   = await Promise.all(
    json.map(async (e) => {
      const p = join(dir, e.name)
      const s = await fs.promises.stat(p)
      return { path: p, mtime_ms: s.mtimeMs }
    })
  )
  return stats
}

function readJSON(path) {
  return fs.promises.readFile(path, "utf8").then(JSON.parse)
}

function pickString(obj, key) {
  return typeof obj?.[key] === "string" ? obj[key] : null
}

async function tryDirSize(root, {onError}) {
  // walk synchronously-async; track byte sum + entry count; cap depth at 6 to avoid runaway
  try {
    return await walkDir(root, { max_depth: 6 })
  } catch (err) {
    return onError(err)
  }
}
```

---

## 2.5 · Constants

```text
GATHER_TIMING_BUDGET_MS = 200      // 80% of C-1 (250ms total)
DEFAULT_DEMA_HOME       = join(os.homedir(), ".dema")
```

No secrets · no API keys · no auth tokens. The module reads only filesystem + invokes existing builders.

---

## 2.6 · Error taxonomy

| Source | Error | Behavior |
|---|---|---|
| profile.json missing | ENOENT | EC-1 path · `source_present: false` |
| profile.json malformed | SyntaxError | warning + EC-1 path |
| ~/.dema/memory missing | ENOENT | EC-4 path · empty array |
| memory entry malformed | SyntaxError | EC-7 path · `partial: true` |
| builder throws | any | EC-8 path · null + warning + `partial: true` |
| disk race vanish | ENOENT mid-flow | EC-9 path · same as missing |
| permission denied | EACCES | warning · `partial: true` · no crash |

**Never throw out of `gather()`.** Phase_03 always receives a valid `GatherResult`.

---

## 2.7 · Test handles (for phase_06)

Phase_06 tests reach this module via:

```text
TDD-26:  gather() returns GatherResult with all fields populated to defaults
         when ~/.dema/ does not exist
TDD-27:  gather() respects DEMA_HOME env var (uses it instead of ~/.dema)
TDD-28:  gather() handles 50 memory entries · only 3 most recent surface
TDD-29:  gather() never throws · always returns · regardless of input chaos
TDD-30:  gather() runtime stays under 250ms with realistic ~/.dema/ (5.8 GB)
```

These are in addition to the 25 in phase_06 base set.

---

## 2.8 · Output to phase_03

```text
OUTPUT  GatherResult
USED BY phase_03's buildHomebasePreview() · pure transformation step
```

Phase_03 receives `GatherResult` and produces the schema-tagged spine JSON. Phase_02 does no schema-tagging itself — that boundary lives in phase_03.

**End of phase_02.**
