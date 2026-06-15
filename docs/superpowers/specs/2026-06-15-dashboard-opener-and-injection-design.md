# Dashboard opener + HTML-injection fix — design

**Date:** 2026-06-15
**Status:** approved (operator GO A+A, both bugs one PR)
**Scope:** `apps/cli/src/commands/dashboard.js` (surfaced as a CodeRabbit follow-up from the dispatcher decomposition, PR #155; pre-existing — faithfully relocated, not introduced).

## Bugs (both confirmed on disk)

1. **Windows opener broken (functional).** `dashboard.js` uses
   `execFile("start", [openPath])` on `win32`. `start` is a `cmd.exe` builtin,
   not an executable — `execFile` throws `ENOENT`; the dashboard never opens.
   macOS (`open`) and Linux (`xdg-open`) are correct.

2. **HTML/script injection (defense-in-depth).** The live dashboard embeds
   `<script>window.__DEMA_STATUS__=${JSON.stringify(statusPayload)};</script>`.
   `JSON.stringify` does not escape `<` / `</script>`, so a string field
   (`human`, `node`, `nextAction`) containing `</script>…` breaks out of the
   script context and executes in the auto-opened browser. Local self-identity
   data → low exploitability, but a self-opened file must never run
   field-injected script (daughter test).

## Approach (A + A — stdlib only, no new deps)

- **Opener:** `win32` → `execFile("cmd.exe", ["/c","start","",openPath])`.
  The empty `""` is the mandatory title argument so a quoted path is not parsed
  as the window title. Extract a pure `openerArgv(platform, targetPath)` →
  `{ cmd, args }` so the branch is unit-testable without spawning.
- **Injection:** extract pure `htmlSafeJson(value)` = `JSON.stringify(value)`
  with `<`→`<`, `>`→`>`, `&`→`&`, U+2028→` `, U+2029→` `.
  Output remains valid JSON (JS-parseable) but cannot break out of `<script>`.

## Files

- Create `packages/core/src/html-safe.js` — `htmlSafeJson(value)`.
- Create `apps/cli/src/lib/browser-opener.js` — `openerArgv(platform, targetPath)`.
- Modify `apps/cli/src/commands/dashboard.js` — import + use both.
- Create `tests/html-safe.test.js`, `tests/browser-opener.test.js`; register both in `docs/TESTING.md`.

## Verification

RED first (modules absent) → implement → GREEN. Then full
`node --test tests/*.test.js` + G8 classifier + driver `dashboard-json` smoke.
Behavior-preserving for the non-win32 / non-malicious path.
