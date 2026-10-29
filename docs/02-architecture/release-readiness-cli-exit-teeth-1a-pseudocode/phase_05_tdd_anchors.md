# Phase 5 · TDD Anchors

**Pseudocode-bundle file:** `phase_05_tdd_anchors.md`  
**Goal:** red → green anchors for `RELEASE-READINESS-CLI-EXIT-TEETH-1A`  
**Optional later:** Cartographer intake anchors (DESIGNED_NOT_LIVE)

## Primary target tests

```text
tests/release-readiness.test.js
```

Regression companions (must stay green, unchanged contract):

```text
tests/delivery-check.test.js
```

Focused command:

```bash
node --test tests/release-readiness.test.js tests/delivery-check.test.js
```

## Exit policy + CLI anchors

| Anchor | Test ID | Assertion |
| --- | --- | --- |
| TDD-EXIT-01 | EXIT-01 | Main path invokes evaluate (observable via exit or exported helper used by main) |
| TDD-EXIT-02 | EXIT-02 | `exitCodeFromEvaluation({ ok: true, ... }) === 0` |
| TDD-EXIT-03 | EXIT-03 | `exitCodeFromEvaluation({ ok: false, reasons: [...] }) === 1` |
| TDD-EXIT-04 | EXIT-04 | Human mode still prints formatted report when evaluation fails |
| TDD-EXIT-05 | EXIT-05 | `--json` + fail: stdout parses via `extractReportJson`; process status `1` |
| TDD-EXIT-06 | EXIT-06 | Helper exported from `scripts/release-readiness.mjs` |
| TDD-EXIT-07 | EXIT-07 | `exitCodeFromEvaluation(null)` and `{}` and `{ ok: "yes" }` → `1` |
| TDD-EXIT-08 | EXIT-08 | Unavailable-worktree build (existing fixture) ⇒ `evaluate.ok === false` **and** CLI exit `1` |
| TDD-EXIT-09 | EXIT-09 | `tests/delivery-check.test.js` pass count unchanged / no assertion edits required |
| TDD-EXIT-10 | EXIT-10 | Doc string or CURRENT_LIMITS note: exit code is the shell gate (optional docs micro) |

## Suggested red-first cases (sketch)

```text
test("exitCodeFromEvaluation fails closed on malformed evaluation")
  assert.equal(exitCodeFromEvaluation(null), 1)
  assert.equal(exitCodeFromEvaluation({}), 1)
  assert.equal(exitCodeFromEvaluation({ ok: true }), 0)

test("release-readiness CLI exits 1 when worktree status unavailable")
  # Reuse / mirror the existing unavailable-git fixture directory
  # execFile node scriptPath --json  with cwd or env pointing at fixture
  # expect: rejected with status 1 OR catch err.code === 1
  # stdout|err still contains extractable report JSON with
  #   risk code ci.workflow_worktree_status_unavailable
```

**Note:** `execFileAsync` throws on non-zero; tests must catch and assert
`error.code === 1` while reading `error.stdout`.

## Cartographer intake anchors (DEFERRED — no implement without GO)

Target (future):

```text
tests/cartographer-claim-stamp-intake-preview.test.js
```

| Anchor | Test ID | Assertion |
| --- | --- | --- |
| TDD-CGI-01 | CGI-01 | Missing intakeRoot → BLOCKED |
| TDD-CGI-02 | CGI-02 | Empty dir → missing all three files → BLOCKED |
| TDD-CGI-03 | CGI-03 | Three valid fixtures → REPARSE_GREEN + counts |
| TDD-CGI-04 | CGI-04 | Corrupt JSONL → PARSE_FAILED |
| TDD-CGI-05 | CGI-05 | boundary flags all false / authority_delta 0 |
| TDD-CGI-06 | CGI-06 | expectedCounts mismatch → ok false (no silent PDF number mint) |

## Implementation sequence (when GO)

1. Export `exitCodeFromEvaluation` + unit tests EXIT-02/03/06/07 (**red then green**).
2. Wire CLI main (`process.exitCode`) + EXIT-05/08.
3. Re-run focused 37+ suite (expect +N new tests).
4. Do **not** start Cartographer intake unless separate GO.
5. Commit only with explicit operator GO (this bundle docs vs code hunks separable).

## Proof ceiling

| Proven after green | Still UNKNOWN |
| --- | --- |
| Direct CLI exit mirrors evaluate in hermetic fixtures | npm script wrappers that `\|\| true` |
| Score teeth + exit teeth agree on unavailable git | Live CI runner behavior |
| delivery-check untouched | Public site metric stamps |

## Self-critique traps (do not launder)

1. Documenting exit policy without a failing test that previously exited 0.
2. Calling Cartographer “verified locally” because the PDF exists.
3. Bundling PEAK-ZERO-SPIN / SCORE-TEETH / CLI-EXIT into one opaque commit without GO scopes.
