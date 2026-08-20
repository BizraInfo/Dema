---
name: run-dema
description: Run, launch, smoke-test, or drive the `dema` CLI (@bizra/dema-root, bin/dema). Use when asked to run dema, start dema, verify the CLI works from a clean checkout, or smoke-test dema commands. Not a web/GUI app — no screenshots.
---

# Run the `dema` CLI

`dema` (`@bizra/dema-root`) is a **one-shot, local-first CLI** — no server, no
window, no daemon. It is consent-bound and receipt-aware; all local state lives
under `DEMA_HOME` (default `~/.dema`). The agent path is a smoke driver that
runs a read-only subset of the command surface under a throwaway `DEMA_HOME`
and asserts exit codes + output markers.

Paths below are relative to the repo root (`/home/bizra-operating-system/Downloads/Dema`).

## Prerequisites

Node.js only — zero runtime dependencies (`zero-dep-gate` enforces this). No
`apt-get`, no build step.

```bash
node --version   # any recent LTS; the repo runs on the system node
```

## Run (agent path) — the driver

```bash
node .claude/skills/run-dema/driver.mjs
```

Expected output (verified this container):

```
PASS  dema help
PASS  dema help preview
PASS  dema welcome
PASS  dema readiness
PASS  dema state
PASS  dema peak-self-loop --json
PASS  dema season status --json
PASS  dema season resume --json
PASS  peak-self-loop --json: mode=preview_only + boundary all-false

OK — 9 checks, 0 failure(s). DEMA_HOME=<tmpdir>/dema-smoke-XXXXXX
```

Exit 0 = all green; exit 1 = a command regressed (the FAIL line names which,
its exit code, and any missing output marker). The driver sets its own
throwaway `DEMA_HOME`, so it never writes to your real `~/.dema`.

## Run (human path)

One-shot commands; each prints and exits. Useful for eyeballing a surface:

```bash
node bin/dema help            # topic-grouped command list
node bin/dema help --all      # full flat command list
node bin/dema welcome
node bin/dema peak-self-loop --json | head
```

There is no `dema start` and no long-running process — the CLI is not a server.

## Test

Zero-dep repo — invoke tests with the system `node` directly, **not**
`npm test` (see the exit-216 gotcha below).

```bash
# focused — run the file(s) your change touches (fast, sub-second):
node --test tests/absence-steward-queue-schema.test.js

# full suite (~9,300 tests, several minutes — log it, don't stream it):
node --test --test-reporter=tap tests/*.test.js > "$TMPDIR/dema-full-test.tap" 2>&1; echo "FULL_SUITE_EXIT=$?" >> "$TMPDIR/dema-full-test.tap"
grep -E '^# (tests|suites|pass|fail|cancelled|skipped)|FULL_SUITE_EXIT' "$TMPDIR/dema-full-test.tap" | tail -8
```

Capture the exit code **separately from the tail/grep** as above — the shell's
overall exit is the last command's, and a green `tail` masks a red suite.

Verified this session: 9,304 / 9,313 pass on a mid-slice dirty tree inside a
write-restricted sandbox. The 9 reds were environment/repo-state-coupled, not
CLI regressions — e.g. `artifact-011-ceremony-preflight` must `mkdtemp` under
`$HOME` (EROFS in the sandbox), and the llm-guidance / proof-room / Stop-hook
tests assert against current repo and docs state. Only a clean tree outside the
sandbox is an honest baseline for "suite green".

## Gotchas (battle scars from this session)

- **Consent-gated commands refuse without an EXACT string.** Commands like
  `dema urp launch-5sat --consent "…"`, `dema node0 mumu consent`,
  `dema authorship sign` require a precise consent phrase (ADR-005 exact-string
  consent). The driver deliberately omits all of them — never drive them with a
  guessed phrase; a wrong string is a refusal, not a bug.
- **State goes under `DEMA_HOME`/`~/.dema`.** Run smoke checks with a throwaway
  `DEMA_HOME` (the driver does `mkdtemp`) or you'll write receipts into your
  real home.
- **The Node0-index slice may be mid-verification.** `dema node0-index --root`
  is intentionally excluded from the smoke set — it's an in-flight surface, not
  a stable read-only one.
- **This repo has no served web app.** The `*.html` files
  (`docs/demo/bizra-doxology-gate-proof-cockpit.html`,
  `docs/tui/dema-homebase-dashboard-v0.1.html`, `vercel/index.html`) are static
  artifacts — open them directly in a browser; they are **not** part of `dema`
  and there is no dev server for them.
- **Bash sandbox may block the run.** In a sandboxed shell these read-only calls
  can fail with `bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted`
  — a sandbox-init failure, not a `dema` fault. Re-run outside the sandbox.
- **`npm run <anything>` may die with exit 216 before the child starts.** On the
  operator machine, `node_modules` is a deliberate self-referencing symlink
  (`node_modules -> …/Dema/node_modules`), which ELOOPs npm's script runner.
  Every npm script is a thin `node …` wrapper — read the command out of
  `package.json` `scripts` and run that `node` line directly. The repo is
  zero-dep, so direct `node` invocation always works.
- **`awk` is absent on the operator machine** (exit 127). Post-process TAP logs
  with `grep`/`sed`/`tail` instead.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted` | Sandbox networking init failed. These are read-only CLI calls — re-run with the sandbox disabled. |
| Any `npm run …` exits 216 with no child output | ELOOP from the self-referencing `node_modules` symlink. Run the script's `node …` command from `package.json` directly. |
| A `FAIL` line for a command that used to pass | Run that exact `node bin/dema <argv>` by hand to see the real stderr; the driver only reports exit code + marker. |
| Receipts appearing in `~/.dema` after a run | You ran `dema` directly without `DEMA_HOME` set; the driver isolates state, ad-hoc commands do not. |

## Scope

This skill **is tracked and committed** (`git ls-files` lists both files;
landed in `f4ba066`). It is agent tooling for driving the CLI — it is not part
of the `dema` command surface and no CI gate invokes it.
