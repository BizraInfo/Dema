# Phase 4 · Render TUI (Ink) Pseudocode

**Pseudocode-bundle file:** `phase_04_render_tui_pseudocode.md`
**Maps to:** v0.1 spec §2, §6, §9 + phase_01 FR-1, FR-11..FR-21, FR-25 + EC-11..EC-19.
**Goal:** specify the Ink-based JSX render layer that consumes a frozen `HomebasePreview` (from phase_03) and paints it to a TTY, plus the keypress handler that routes affordances to existing CLI commands.

---

## 4.1 · Module identity

```text
TARGET PACKAGE     packages/cli-tui/                   (new package · only new package in v0.1)
PACKAGE.JSON
  - name           "@bizra/cli-tui"
  - dependencies   "ink" (peer: react)
  - private        true                                (NOT publishable; internal-only)
TARGET FILES
  src/homebase-render.jsx                              entrypoint · renderHomebaseTUI(preview)
  src/components/Header.jsx
  src/components/Greeting.jsx
  src/components/Memory3.jsx
  src/components/Status.jsx
  src/components/NextAction.jsx
  src/components/Affordances.jsx
  src/key-handler.js                                   pure logic · binds keypress → action
TEST FILES
  tests/homebase-tui.test.js                           snapshot + smoke render
```

---

## 4.2 · `renderHomebaseTUI(preview)` entrypoint

```text
import { render } from "ink"
import { Homebase } from "./homebase-render.jsx"
import { dispatchAffordance } from "./key-handler.js"

export async function renderHomebaseTUI(preview, { onExit = process.exit } = {}) {
  // EC-13 / EC-17: respect Ctrl+C cleanly
  // EC-19: handle EPIPE
  process.stdout.on("error", (err) => { if (err.code === "EPIPE") onExit(0) })

  const { waitUntilExit, rerender, unmount } = render(
    <Homebase
      preview={preview}
      onKey={(key) => dispatchAffordance(key, preview, { unmount, onExit })}
    />,
    {
      stdout: process.stdout,
      stderr: process.stderr,
      stdin:  process.stdin,
      // Honor NO_COLOR (FR-16) and TERM=dumb (FR-17)
      experimental:  false,
      patchConsole:  false
    }
  )

  await waitUntilExit()
}
```

---

## 4.3 · `<Homebase>` root component

```text
import { Box, Text, useApp, useInput } from "ink"

export function Homebase({ preview, onKey }) {
  const { exit } = useApp()
  useInput((input, key) => {
    if (key.escape) return onKey("Escape")
    if (key.ctrl && input === "c") return exit()       // EC-17
    if (input) return onKey(input)
  })

  return (
    <Box flexDirection="column" width={76}>
      <Header data={preview.header} />
      <Divider />
      <Greeting data={preview.greeting} />
      <Memory3 data={preview.memory3} />
      <Status data={preview.status} />
      <NextAction data={preview.next_action} />
      <Divider />
      <Affordances items={preview.affordances} />
      <BoundaryFooter />
    </Box>
  )
}
```

---

## 4.4 · Component pseudocode

### `<Header>`

```text
<Box>
  <Text bold>DEMA · {data.node_name} · {data.date_human_gst} · {data.time_human_gst}</Text>
</Box>
```

### `<Greeting>`

```text
<Box marginTop={1}>
  <Text>{data.text}</Text>
</Box>
```

### `<Memory3>`

```text
if (data.fallback_text) {
  return <Box marginTop={1}><Text dimColor>{data.fallback_text}</Text></Box>
}

return (
  <Box flexDirection="column" marginTop={1}>
    <Text>Three things I remember:</Text>
    {data.entries.map((e, i) => (
      <Text key={i}>  {i+1}. {e.summary ?? e.name}</Text>
    ))}
    {// EC-6 padding: render "—" for missing positions to maintain 3-row layout}
    {padTo3(data.entries.length).map((_, i) => <Text key={`pad-${i}`} dimColor>  {data.entries.length + i + 1}. —</Text>)}
  </Box>
)
```

### `<Status>`

```text
<Box flexDirection="column" marginTop={1}>
  <Text>Right now:</Text>
  <StatusRow label="Node0"     bar={data.ring.bar}       suffix={data.ring.label} />
  <StatusRow label="Mission"   icon={data.mission.icon}  suffix={data.mission.label} />
  <StatusRow label="Gateway"   icon={data.gateway.icon}  suffix={data.gateway.label} />
  <StatusRow label="Memory"    bar={data.memory_bar.bar} suffix={data.memory_bar.label} />
</Box>
```

Where `<StatusRow>` is a small helper that handles the icon-or-bar branch.

### `<NextAction>`

```text
<Box marginTop={1} flexDirection="column">
  <Text>Next safe action:</Text>
  <Text>  → {data.text}</Text>
</Box>
```

### `<Affordances>`

```text
<Box>
  {items.map((a) => (
    <Text key={a.key}> [{a.key}] {a.label}  </Text>
  ))}
</Box>
```

### `<BoundaryFooter>`

```text
<Box marginTop={1}>
  <Text dimColor>Boundary: no action without explicit consent.</Text>
</Box>
```

### `<Divider>`

```text
<Box><Text dimColor>{"─".repeat(76)}</Text></Box>
```

---

## 4.5 · `dispatchAffordance` pure logic

```text
TARGET FILE  packages/cli-tui/src/key-handler.js
EXPORTS      dispatchAffordance(key, preview, ctx) → void
PURITY       impure · spawns child processes for affordances; clean exit paths

const DISPATCH_TABLE = {
  "m": "preview:dema_mission_draft",
  "j": "operator_act:dema_today",
  "r": "preview:dema_receipts",
  "b": "subscreen:memory_browse",
  "?": "preview:dema_help",
  "q": "exit:0",
  "Escape": "exit:0"
}

export function dispatchAffordance(key, preview, { unmount, onExit }) {
  const target = DISPATCH_TABLE[key]
  if (!target) return                       // EC-15: silent no-op for unbound keys

  if (target === "exit:0") { unmount(); return onExit(0) }
  if (target.startsWith("subscreen:")) return openSubscreen(target, preview, { unmount, onExit })
  if (target.startsWith("preview:"))  return spawnReadOnlyCommand(target.replace("preview:", ""), { unmount, onExit })
  if (target.startsWith("operator_act:")) return spawnWithConsentGate(target.replace("operator_act:", ""), { unmount, onExit })
}
```

### `spawnReadOnlyCommand`

```text
function spawnReadOnlyCommand(slug, { unmount, onExit }) {
  // Translates: "dema_mission_draft" → ["mission", "draft"] OR "dema_help" → ["--help"]
  const argv = slugToArgv(slug)
  unmount()                                   // release the TTY back to the spawned process
  const child = spawn("node", ["apps/cli/src/index.js", ...argv], { stdio: "inherit" })
  child.on("exit", (code) => onExit(code ?? 0))
}
```

### `spawnWithConsentGate`

```text
function spawnWithConsentGate(slug, { unmount, onExit }) {
  // FR-14: any L1+ effect requires typed-GO before firing.
  // The TUI itself displays the consent phrase as plain text and waits for
  // it to be typed character-by-character (NOT pasted) on a separate line.
  const phrase = lookupConsentPhrase(slug)    // e.g., "GO: record today journal"
  promptConsent(phrase).then((approved) => {
    if (!approved) { unmount(); return onExit(0) }    // user cancelled · clean exit
    const argv = slugToArgv(slug)
    unmount()
    const child = spawn("node", ["apps/cli/src/index.js", ...argv], { stdio: "inherit" })
    child.on("exit", (code) => onExit(code ?? 0))
  })
}
```

`promptConsent` is a pseudo-helper backed by Ink input that:

1. Renders the consent phrase verbatim.
2. Waits for the user to type the phrase character-by-character.
3. Rejects clipboard paste (detected by suspicious-timing heuristic: > 50 chars within 100ms of last input).
4. Returns `true` only if `typed === phrase` byte-equal.

(The full consent-extraction logic already exists at `packages/consent/src/consent-extract.js`; the TUI's role is to render the phrase and forward the typed string to that existing validator.)

---

## 4.6 · `openSubscreen`

```text
function openSubscreen(slug, preview, { unmount, onExit }) {
  if (slug === "subscreen:memory_browse") {
    // For v0.1: simple list view of ~/.dema/memory/ entries
    // For v0.2: dedicated panel per cloud-author blueprint (phase_07)
    return renderMemoryBrowser(preview, { unmount, onExit })
  }
  // Unknown subscreen: no-op (EC-15-equivalent)
}
```

The memory browser is in scope for v0.1 because [b] is in the affordance set. The v0.1 form is a simple Ink list with `[Esc]` to return. v0.2 expands to the cloud-author's 5-screen control room.

---

## 4.7 · Accessibility hooks

| Constraint     | Implementation                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| NO_COLOR       | Ink honors `NO_COLOR` env automatically; verify in TDD-19                                                           |
| TERM=dumb      | Ink falls back to plain text; verify in TDD-20                                                                      |
| 80×24 viewport | Width fixed at 76; height computed; viewport_too_small marker emitted from phase_03                                 |
| Keyboard-only  | All input via `useInput` from Ink; no mouse event handler bound                                                     |
| Screen reader  | The JSON form (phase_05) carries `alt_text` equivalents; readers consume that, not the TUI directly                 |
| Bidi RTL       | Ink does NOT bidi-render in v0.1; profile.name with RTL script is rendered LTR with a marker in JSON form; v0.2 fix |

---

## 4.8 · Refusal of input outside the affordance keymap

```text
useInput((input, key) => {
  // Ctrl+C handled separately (always exits)
  // Esc handled separately (always Escape semantic)
  // Any other modifier-key combination: ignore (e.g., Ctrl+L, Alt+...)
  if (key.ctrl || key.meta || key.shift) {
    // Allow Ctrl+C path (already above); ignore the rest
    return
  }
  // Pasted long string (EC-16): allow only single-char inputs through
  if (input && input.length > 1) {
    return                                          // silent reject
  }
  onKey(input ?? "Escape")
})
```

This satisfies EC-15 + EC-16. Phase_06 TDD-31 tests the long-paste rejection.

---

## 4.9 · Test handles (phase_06 hook)

```text
TDD-31  pasted long string (>1 char) does NOT fire any affordance
TDD-32  Ctrl+C cleanly unmounts and exits with status 0
TDD-33  pressing any key not in DISPATCH_TABLE is a no-op (silent)
TDD-34  snapshot test: render produces stable golden output for fixture input
TDD-35  the TUI never writes to ~/.dema/ during pure render (verify via fs spy)
TDD-36  the TUI never invokes network during pure render (verify via http spy)
TDD-37  spawn paths use existing CLI bin · not invented commands
TDD-38  consent gate rejects paste (>50 chars in <100ms) for L1+ affordances
```

---

## 4.10 · LOC budget

| Component           | Estimated LOC |
| ------------------- | ------------- |
| homebase-render.jsx | 70            |
| Header.jsx          | 15            |
| Greeting.jsx        | 10            |
| Memory3.jsx         | 35            |
| Status.jsx          | 50            |
| NextAction.jsx      | 12            |
| Affordances.jsx     | 12            |
| BoundaryFooter.jsx  | 8             |
| key-handler.js      | 80            |
| package.json        | 25            |
| **Total**           | **~317**      |

Under the C-2 ceiling of ~400 (which also includes phase_02 gather + phase_05 dispatch glue).

---

## 4.11 · Output to phase_05

```text
OUTPUT       renderHomebaseTUI(preview) → Promise<void>
USED BY      phase_05 CLI dispatch · `if (TTY && !--json) await renderHomebaseTUI(preview)`
```

**End of phase_04.**
