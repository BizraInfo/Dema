---
name: dema-slice-scaffold
description: Scaffold a new Dema/Node0 proof slice — the pure kernel, mirrored red-first test, review gate, receipt + architecture docs, and all four wiring points (scripts/check.mjs, docs/TESTING.md, docs/CURRENT_LIMITS.md, dema-capability-truth-registry.js incl. the count bump). Use this whenever you start a new NODE0-*-1A / DEMA-*-1A capability slice, add a "1A" kernel, or say things like "scaffold a slice", "new pre-action spine capability", "start the X-1A slice", "stub out a kernel + review gate", or "wire a new slice into the registry" — even if the slice id or the word "scaffold" is not stated explicitly. It generates a deliberately RED slice (kernel bodies throw, the test encodes the proof contract) so you build to green under TDD; it does not implement the slice logic and does not run the gates.
---

# Dema slice scaffold

Generate a complete, convention-faithful **red-first** Dema proof slice and wire it
into every place a slice must be registered, so you can go straight to building the
kernel logic against a failing test instead of hand-copying nine files and tripping
the registry count-bump trap.

**Scaffold-only and report-only on the gates.** The script writes files and edits
wiring, then stops. It deliberately leaves the slice RED — the kernel's
slice-specific `verify`/`run` bodies throw `not_implemented` and the mirrored test
encodes the proof contract. You turn it green under TDD before any commit. Do not
weaken the test to match an empty kernel; that inverts the discipline.

## When this applies

Starting a new bounded proof slice in this repo: a new `packages/core/src/<kebab>.js`
kernel with a review gate and a capability-registry row. The repo's slice shape is
fixed (see `references/slice-anatomy.md`) and the wiring is error-prone by hand —
especially the registry capability-count, which is hard-coded as digits in two test
assertions plus number-words in prose. This skill makes that mechanical and exact.

If the request is to *implement logic* in an existing kernel, or to do a CLI command
(ADR-012: no new kebab CLI names — space-subcommands only), this skill does not apply.

## Usage

Run the bundled generator from the repo root. Minimum is an id and a one-line intent:

```bash
node .claude/skills/dema-slice-scaffold/scripts/scaffold_slice.mjs \
  --id NODE0-FOO-BAR-1A \
  --intent "One-line capability summary (becomes the registry/doc summary)."
```

Useful flags:

- `--go-phrase "GO: ..."` — exact consent phrase (default derived from the id).
- `--truth-label NODE0_FOO_BAR_MEASURED_REPO` — truth label (default derived).
- `--no-arch` — skip the `docs/02-architecture/*` doc (and drop it from the
  registry evidence so the registry check stays green).
- `--repo <root>` — target repo root (default: cwd).
- `--dry-run` — print the plan (files + wiring) without writing anything. **Always
  dry-run first** to confirm every wiring anchor is found.
- `--force` — overwrite existing target files (wiring stays idempotent regardless).
- `--json` — machine-readable report.

### What it writes (5 files)

| File | Role |
| --- | --- |
| `packages/core/src/<kebab>.js` | pure kernel: schema/label/GO consts, all-false `boundary()`, fail-closed `plan*` (real), content-addressed `build*Payload` (real), `verify*`/`run*` **throw `not_implemented`** |
| `tests/<kebab>.test.js` | mirrored test encoding the proof contract — RED until you build the bodies |
| `scripts/review/<kebab>-check.mjs` | review gate: `run*Check()` + `--json` + exit-1-on-fail |
| `docs/receipts/<CAPID>.md` | receipt: truth label, slice, proof contract, commands |
| `docs/02-architecture/<PREFIX>_v0_1.md` | architecture doc (omit with `--no-arch`) |

### What it wires (4 edits, all idempotent)

1. `scripts/check.mjs` — adds the review-gate command line.
2. `docs/TESTING.md` — adds the test-table row and the review command line.
3. `docs/CURRENT_LIMITS.md` — adds the capability row (marked red-first; promote to
   `[MEASURED]` only once green).
4. `packages/core/src/dema-capability-truth-registry.js` — adds the capability row,
   appends the id to `REQUIRED_CAPABILITY_IDS`, bumps the count prose, **and** bumps
   the hard-coded `capability_count` / `measured_repo_count` digits in
   `tests/dema-capability-truth-registry.test.js`. The count bump fires only when the
   row is newly added, so re-runs do not over-count.

   Note: if the registry's count sentence has been migrated to a computed
   `${...length}` expression, there is no number-word to bump and the report says
   `count prose is computed — no bump needed`. That is informational, not a failure.

### What it does NOT wire — a new `dema <command>`

The scaffold wires the **kernel** slice. A slice that also adds a CLI command has
**six** further wiring points, none of them scaffolded. Miss one and the focused
suite still passes — three of them fail only under full `npm test`, so they arrive
late and read as unrelated breakage (measured 2026-08-05 on `68b8efd`):

1. `apps/cli/src/index.js` — import + `COMMAND_TABLE` entry.
2. `apps/cli/src/index.js` — `REGISTERED_COMMANDS_LIST` (the suggester).
3. `apps/cli/src/index.js` — help text. The help extractor parses it.
4. `packages/core/src/cli-consent-matrix-entries.js` — one `row(...)`, else
   `cli-consent-matrix-check.mjs` fails *missing matrix row*.
5. `tests/cli-command-table.test.js` — `COMMAND_SURFACE`, else *orphan handlers
   not in surface*.
6. `docs/ARCHITECTURE.md` — one table row per help command, else
   `integration-check.mjs` fails `help_commands_in_architecture_map`. The expected
   string is the help line truncated at the first `<placeholder>` — e.g.
   `dema season save --season`, not `dema season save`.

Plus: a review gate added ahead of the isolated TAP command shifts **three**
positional snapshots in `tests/check-exit-integrity-adversarial.test.js`
(`commands.length`, `indexOf(isolated)`, and the `commands[N]` coverage pin).
Those are deliberate exact snapshots, not a bug.

Check point 6 without running the whole suite:

```bash
node -e 'import("./scripts/review/integration-check.mjs").then(async m=>{
  const r=await m.buildIntegrationCheckReport();
  console.log("ok:",r.ok); for(const c of r.checks) if(!c.ok) console.log(c);})'
```

Also remember the CLI exit contract: the dispatcher turns a refusal into exit 1
via a `{refused:true}` sentinel. Returning a number from a command handler is
silently discarded.

## Workflow

1. **Dry-run first.** Confirm the report shows every wiring edit as `✓ inserted`
   (not `anchor not found`). If an anchor is missing, the host repo has drifted from
   the expected shape — read `references/slice-anatomy.md` and fix the anchor or wire
   that file by hand; do not force a half-wired slice.
2. **Run for real.** Re-run without `--dry-run`.
3. **Confirm RED.** `node --test tests/<kebab>.test.js` — expect the `plan`/payload
   tests to pass and the `verify`/`run`/gate tests to fail with `not_implemented`.
   That red surface is your build target.
4. **Build to green.** Implement `verify*` and `run*` (and reshape `build*Payload`)
   in the kernel, replacing each `/* TODO */` fixture in the test with real input.
   Keep the kernel pure (effects injected and documented) and the boundary all-false.
   See `references/slice-anatomy.md` for the canonical patterns and the invariants
   the gates enforce.
5. **Fill the prose.** Replace the `TODO(<ID>)` in the registry row's
   `what_this_proves` with a precise, non-overclaiming statement, and finish the
   receipt/architecture docs.
6. **Close out.** Only after the focused test, `npm test`, and `npm run check` pass,
   promote the `CURRENT_LIMITS.md` row to `[MEASURED]` and run the `proof-closeout`
   skill. The same slice carries code + tests + the `CURRENT_LIMITS` update, which is
   what the no-overclaim discipline requires.

## Boundaries

- Scaffold-only: writes files and wiring, then stops. It does not implement slice
  logic, does not run `npm test` / `npm run check`, and makes no runtime, network,
  daemon, key, or commit action.
- The generated slice is RED on purpose. A green scaffold would mean the test does
  not bind to real behavior.
- `[MEASURED]` in the generated `CURRENT_LIMITS`/registry rows is a claim-in-waiting.
  It is only honest once the focused test and `npm run check` pass — do not commit a
  red slice with a `[MEASURED]` row.
- Verify the wiring landed: after a real run, `node --check` the edited registry
  source and test, and skim `git diff scripts/check.mjs`. Disk wins over the report.

## Reference

- `references/slice-anatomy.md` — the canonical nine-part slice shape, naming
  transforms, the wiring map, the kernel-purity / no-overclaim invariants the gates
  enforce, and how to fill the red stubs.
