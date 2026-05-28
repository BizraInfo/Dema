# URP-3.1D Stage 3 Local Index Closeout — Design Spec

**Date:** 2026-05-28
**Status:** Draft — awaiting Mumu approval
**Shape:** B+ (docs + replayable real-chain demo script + `check.mjs` harness probe)
**Sparse point:** After Stage 3 write/list/verify symmetric and remote-CI verified at HEAD `b1a932f`

## 1. Purpose

Freeze the Stage 3 Local Index boundary into a replayable, drift-guarded
closeout before Stage 4 Choose opens any share / PoI / mint / federation
surface. The closeout is **not** a new runtime authority. It is a one-shot
probe that:

- proves the `write → list → verify` chain still works end-to-end against
  a freshly-built passport, every time `npm run check` runs;
- documents the boundary triplet (`LOCAL_INDEX_ONLY` · `MARKED_LOCAL_ONLY`
  · `LOCAL_VERIFIED_RESOURCE_INDEX`) and what Stage 3 explicitly does
  **not** prove;
- makes regressions in `dema urp index` / `list` / `verify` fail the
  harness loudly rather than rot silently.

The golden rule this spec encodes:

> A stage is not complete when code works. A stage is complete when its
> boundary can be replayed and drift-detected.

## 2. Evidence basis

| Slice                         | Commit    | Truth label                                                 | CI  |
| ----------------------------- | --------- | ----------------------------------------------------------- | --- |
| URP-3.0 preflight             | `af6a604` | preflight only                                              | ✅  |
| URP-3.1A pure builder         | `0c55a34` | builder package                                             | ✅  |
| URP-3.1B durable writer       | `7716558` | writer package                                              | ✅  |
| URP-3.1C write CLI            | `12debb3` | `URP_3_1C_LOCAL_INDEX_CLI_REMOTE_CI_VERIFIED`               | ✅  |
| URP-3.1C+ list / read surface | `020d36d` | `URP_3_1C_PLUS_LOCAL_INDEX_READ_SURFACE_REMOTE_CI_VERIFIED` | ✅  |
| URP-3.1C-ter verify-by-path   | `b1a932f` | `URP_3_1C_TER_LOCAL_INDEX_VERIFY_REMOTE_CI_VERIFIED`        | ✅  |

Stage 3 is currently write/list/verify symmetric. Stage 4 Choose remains
`DESIGNED_NOT_LIVE`. Stage 5 Mint remains `DESIGNED_NOT_LIVE`.

## 3. File layout (5 files)

| Path                                        | Role                                                                                                                                                                                                    | Approx size |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `scripts/urp-stage3-closeout.mjs`           | Replayable demo: real `key init → sign → proof passport → urp index → urp list → urp verify` chain under `mkdtemp` `DEMA_HOME`; emits one JSON envelope to stdout on success, JSON to stderr on failure | ~150 LOC    |
| `docs/security/URP_LOCAL_INDEX_CLOSEOUT.md` | 8-section closeout doc; pair to `URP_LOCAL_INDEX_PREFLIGHT.md`; freezes boundary triplet; states proves / does-not-prove; says "remote-CI verified and drift-guarded" (never "permanently sealed")      | ~120 lines  |
| `scripts/check.mjs`                         | +1 probe entry that runs `scripts/urp-stage3-closeout.mjs`, asserts exit 0 and `URP_STAGE_3_LOCAL_INDEX_DEMO_VERIFIED` in stdout                                                                        | +5 LOC      |
| `docs/TESTING.md`                           | +1 row for the closeout script as a harness probe                                                                                                                                                       | +1 row      |
| `docs/ARCHITECTURE.md`                      | +1 row for the script + harness probe wiring                                                                                                                                                            | +1 row      |

**Non-files** (deliberately absent):

- No new file under `packages/`
- No new file under `apps/cli/src/` (no new `dema` subcommand)
- No new file under `tests/` (the script itself is the test; per-step
  assertions are in-line)
- No new schema file (envelope schema is declared inline in the script)

## 4. Demo script flow

```text
mkdtemp("dema-urp-stage3-closeout-")   → DEMA_HOME=$tmpdir
                                       │
                                       ▼
node apps/cli/src/index.js authorship key init
  --consent "GENERATE AUTHORSHIP KEY" --json
                                       │
                                       ▼
write sentinel artifact at $tmpdir/closeout-artifact.txt
node apps/cli/src/index.js authorship sign $tmpdir/closeout-artifact.txt
  --consent "SIGN AUTHORSHIP RECEIPT" --json
                                       │
                                       ▼
node apps/cli/src/index.js proof passport --json
  → $tmpdir/passport.json
                                       │
                                       ▼
node apps/cli/src/index.js urp index --passport $tmpdir/passport.json --json
  → reads $tmpdir/urp/indexes/urp-index-<sha256>.json
                                       │
                                       ▼
node apps/cli/src/index.js urp list --json
  → assert count >= 1, all entries filename_hash_matches=true and body_hash_intact=true
                                       │
                                       ▼
node apps/cli/src/index.js urp verify <each index file> --json
  → assert all VERIFIED
                                       │
                                       ▼
rm -rf $tmpdir
                                       │
                                       ▼
emit final envelope on stdout, exit 0
(or emit failure envelope on stderr, exit 1)
```

All six steps run with the canonical isolation env: `DEMA_NO_TUI=1`,
`NODE_ENV=test`, `NO_COLOR=1`. The operator's real `~/.dema/` is never
touched. No network. No federation.

Every subprocess is wall-time bounded (default 30s, configurable via
`URP_STAGE3_CLOSEOUT_TIMEOUT_MS`).

## 5. Envelope schema

**Success envelope** (stdout, exit 0):

```json
{
  "schema": "bizra.dema.urp_stage3_closeout_demo.v0.1",
  "demo_passed": true,
  "truth_label": "URP_STAGE_3_LOCAL_INDEX_DEMO_VERIFIED",
  "steps": [
    {"name": "key_init",  "ok": true, "duration_ms": <n>, "fingerprint": "<sha256>"},
    {"name": "sign",      "ok": true, "duration_ms": <n>, "receipt_filename": "authorship-<sha256>.json"},
    {"name": "passport",  "ok": true, "duration_ms": <n>, "verdict": "VERIFIED", "receipts_count": 1},
    {"name": "index",     "ok": true, "duration_ms": <n>, "index_hash": "<sha256>"},
    {"name": "list",      "ok": true, "duration_ms": <n>, "count": 1, "corruption_detected": false},
    {"name": "verify",    "ok": true, "duration_ms": <n>, "verdict": "VERIFIED"}
  ],
  "total_duration_ms": <sum>,
  "dema_home_used": "<tmpdir-path>",
  "dema_home_cleaned": true,
  "boundary": {
    "local_only": true,
    "network_used": false,
    "share_decision_made": false,
    "poi_score_calculated": false,
    "token_minted": false,
    "federation_used": false,
    "persistent_closeout_receipt_written": false
  }
}
```

**Failure envelope** (stderr, exit 1):

```json
{
  "schema": "bizra.dema.urp_stage3_closeout_demo.v0.1",
  "demo_passed": false,
  "truth_label": "URP_STAGE_3_LOCAL_INDEX_DEMO_FAILED",
  "failed_step": "<step name>",
  "error": "<short reason>",
  "steps": [...partial...],
  "dema_home_used": "<tmpdir-path>",
  "dema_home_cleaned": true,
  "boundary": { ...same as above... }
}
```

Schema field name `persistent_closeout_receipt_written` (per Mumu's
refinement): distinguishes temporary key/sign/passport/index artifacts
under throwaway `DEMA_HOME` (which ARE created and then cleaned up)
from a persistent closeout receipt (which is NOT created — Stage 4 may
introduce that later).

## 6. Harness probe design

`scripts/check.mjs` registers probes as `[bin, argsArray]` tuples in
the exported `commands` array and runs them via `execFileSync` with
`stdio: "inherit"`. A non-zero exit code throws and fails the check;
stdout content is **not** inspected by `check.mjs`. The closeout
script therefore owns the truth-label assertion (it emits
`URP_STAGE_3_LOCAL_INDEX_DEMO_VERIFIED` in its envelope and exits 0
only when every step passed).

Exact one-line addition to `commands`:

```js
// Stage 3 Local Index closeout drift-guard probe
["node", ["scripts/urp-stage3-closeout.mjs"]],
```

Insert near the end of the array, alongside the other
`scripts/<probe>.mjs` entries (after `harness-gate.mjs` at line 118).

The probe lives inside `scripts/check.mjs` ONLY. It is NOT promoted to
a `dema` subcommand (no new CLI surface). It is NOT registered in the
smoke matrix — `driver.mjs` covers the underlying URP CLI through 3
rows (`urp-index-missing-passport`, `urp-list-empty-json`,
`urp-verify-missing-path`). The closeout's role is end-to-end
integration; the smoke matrix's role is surface presence.

Adding the probe to `check.mjs` may trigger
`scripts/review/integration-check.mjs`'s `smoke_commands_documented`
audit. If integration-check flags anything, the spec fix is to update
`docs/TESTING.md` / `docs/ARCHITECTURE.md` to match — NOT to suppress
the probe.

## 7. Closeout doc outline (`docs/security/URP_LOCAL_INDEX_CLOSEOUT.md`)

Eight sections, mirroring the depth of `URP_LOCAL_INDEX_PREFLIGHT.md`:

1. **What this is** — pair-doc to PREFLIGHT; closes the loop opened by URP-3.0.
2. **Stage 3 boundary triplet** — `LOCAL_INDEX_ONLY` · `MARKED_LOCAL_ONLY` · `LOCAL_VERIFIED_RESOURCE_INDEX`. Each field's contract spelled out.
3. **3-command operator replay** — exact `dema urp index --passport <passport.json> --json` → `dema urp list --json` → `dema urp verify <index.json> --json` chain. Each command's expected envelope shape and exit code.
4. **What Stage 3 proves** — write+list+verify symmetric · content-addressed (filename = SHA-256 of stable body) · tamper-detected (12-layer verify gate) · read-only enumeration · no operator's real `~/.dema/` touched in the demo path.
5. **What Stage 3 does NOT prove** — no share, no PoI, no reward, no mint, no token, no federation, no network, no economic claim, no operator visibility decision.
6. **Drift guard** — `scripts/urp-stage3-closeout.mjs` runs in `npm run check`; if any sub-CLI regresses, the harness goes RED. Operator can replay manually at any time via `node scripts/urp-stage3-closeout.mjs`.
7. **Status** — "Stage 3 closeout is remote-CI verified and drift-guarded." NEVER "permanently sealed" (per Mumu's discipline: future drift detection is the closeout's job, so the wording must not foreclose the possibility of drift).
8. **What unlocks next** — Stage 4 Choose preflight is unblocked once this slice is remote-CI verified. Listed Stage 4 prerequisites (consent surface design, share-decision schema, public/private classification) remain UNDONE.

## 8. Verification gates (pre-commit)

| Gate                                              | Expected                                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `node scripts/urp-stage3-closeout.mjs`            | exit 0, JSON envelope, `URP_STAGE_3_LOCAL_INDEX_DEMO_VERIFIED`                                   |
| `npm test`                                        | 3223+ PASS (no test count change — closeout is a script + doc + probe; no new `tests/*.test.js`) |
| `npm run check`                                   | verdict CLEAN with new probe wired in                                                            |
| `node scripts/review/integration-check.mjs`       | ok=true (TESTING.md + ARCHITECTURE.md updated to match)                                          |
| `node scripts/review/actuator-check.mjs`          | findings=[] (no `exec(` / `eval(` literal-substring traps)                                       |
| `node .claude/skills/run-dema/driver.mjs --smoke` | 33/33 PASS (smoke matrix unchanged)                                                              |
| `git diff --check`                                | CLEAN                                                                                            |
| pre-push μ-layer gate                             | PASS                                                                                             |

## 9. Definition of Done

1. `scripts/urp-stage3-closeout.mjs` exists and runs the real cryptographic chain (no mocked passport JSON).
2. `docs/security/URP_LOCAL_INDEX_CLOSEOUT.md` exists with all 8 sections, mirroring PREFLIGHT depth, using the drift-guarded wording.
3. `scripts/check.mjs` carries the new probe entry and `npm run check` exercises it.
4. `docs/TESTING.md` + `docs/ARCHITECTURE.md` carry the new row(s).
5. All 8 verification gates green pre-commit.
6. Commit: `docs(urp): add URP-3.1D local index closeout probe`.
7. Push, monitor 4 CI workflows on the resulting commit.
8. After all 4 SUCCESS: truth label `URP_3_1D_LOCAL_INDEX_CLOSEOUT_REMOTE_CI_VERIFIED`.
9. URP-3.1D row added to docs/CURRENT_LIMITS.md if status text needs refresh (decided at commit time).
10. No new `dema` subcommand. No persistent closeout receipt. No new package under `packages/`.

## 10. Explicit non-goals (locked)

| Non-goal                                                    | Why                                                                                                                                                                                                                   |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ❌ New `dema` subcommand                                    | Closeout is a one-shot script + harness probe, not an operator-facing CLI surface. Per safeguard #8.                                                                                                                  |
| ❌ Persistent closeout receipt under `$DEMA_HOME/receipts/` | Stage 3 has zero need for one; introducing it now would create premature schema lock-in. The temporary key/sign/passport/index artifacts under `mkdtemp DEMA_HOME` are explicitly distinct from a persistent receipt. |
| ❌ New schema files                                         | The demo envelope schema lives inline in the script; no `packages/.../*-closeout.js` module is introduced.                                                                                                            |
| ❌ Mock passport JSON                                       | Deep verification would reject a mock (H19.3.0 trap); the real cryptographic chain is the only valid path.                                                                                                            |
| ❌ Network / federation / PoI / mint / share                | All `false` in the boundary block. Stage 4 territory.                                                                                                                                                                 |
| ❌ Description as "permanently sealed"                      | Future code can drift; the harness probe's existence is admission of that. Wording locked to "remote-CI verified and drift-guarded".                                                                                  |
| ❌ Operator's real `~/.dema/` touched                       | `DEMA_HOME` is constitutional. The script `mkdtemp`s and `rm -rf`s.                                                                                                                                                   |
| ❌ Long-running subprocess                                  | Each step bounded by `URP_STAGE3_CLOSEOUT_TIMEOUT_MS` (default 30s).                                                                                                                                                  |
| ❌ Skipping pre-commit gates                                | All 8 must pass. Push only after green local verify.                                                                                                                                                                  |

## 11. Risk / self-review section

Risks identified and mitigations:

| Risk                                                                                                                              | Mitigation                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1: Drift in `authorship key init` consent phrase** breaks demo.                                                                | Spec pins exact strings `"GENERATE AUTHORSHIP KEY"` / `"SIGN AUTHORSHIP RECEIPT"`. Already documented as gotcha in run-dema skill. If a future PR changes these phrases, the closeout will fail loudly — which is the point. |
| **R2: `actuator-check` flags literal `exec(`** if script uses `RegExp.prototype.exec` or `child_process.exec`.                    | Spec mandates `child_process.spawn` with argv array (no `shell:true`) for subprocess calls, and `String.prototype.match` for regex needs. Same trap caught in URP-3.1C+ implementation.                                      |
| **R3: Race / orphan tmpdir** on script crash.                                                                                     | Wrap the whole flow in `try { ... } finally { await rm(tmpdir, {recursive:true, force:true}); }`. Even on uncaught exception, cleanup runs.                                                                                  |
| **R4: Timing-sensitive assertions** (`expect_stdout_includes`) may flake on slower CI.                                            | Probe asserts a stable string literal, not a timing-derived value. Each subprocess has wall-time bound.                                                                                                                      |
| **R5: H19.3.0 deep-verify trap** — mock passport silently fails.                                                                  | Spec explicitly forbids mock passport JSON. Real chain only.                                                                                                                                                                 |
| **R6: Spec is "too obvious to need approval"** anti-pattern.                                                                      | The brainstorming skill HARD-GATE requires user approval before any implementation. Mumu's two prior explicit "B+" approvals + this spec self-review are the gate.                                                           |
| **R7: Future Stage 4 preflight assumes Stage 3 is "sealed".**                                                                     | Closeout doc wording deliberately says "remote-CI verified and drift-guarded" — future preflight must read it correctly.                                                                                                     |
| **R8: `docs/ARCHITECTURE.md` integration-check parser** may not register a script-only entry the same way as a CLI-surface entry. | Implementation phase: verify `integration-check.mjs` passes by re-running it after the docs edit. If it flags a missing entry, the parser shape is the source of truth (mirror what works).                                  |

Self-review pass (per brainstorming skill):

- **Placeholder scan:** No TBD / TODO / vague requirements. Every requirement has a concrete file path, exit code, or string literal.
- **Internal consistency:** Boundary block fields match between success envelope and failure envelope (§5). File layout (§3 · 5 files) matches DOD (§9 items 1–6) one-to-one. Non-goals (§10) reinforce DOD non-creation items. Section counts in §7 (doc) and §8 (gates) coincide at 8 each but are independent — no cross-dependency.
- **Scope check:** Single-implementation-plan-sized. 5 files. No decomposition needed. Smaller than 3.1C (which was 4 files) but appropriate because no new package or test file.
- **Ambiguity check:** "8-section doc" specified by exact section titles. "Real cryptographic chain" specified by 6 exact command lines. "Harness probe" specified by exact `cmd`/`expect_exit`/`expect_stdout_includes` shape. "Persistent closeout receipt" defined in §5 versus temporary tmpdir artifacts. No interpretive room.

## 12. Implementation plan handoff

Once approved by Mumu, the brainstorming skill's terminal state is to
invoke the `writing-plans` skill, which will turn this spec into a
step-by-step implementation plan. The plan will cover:

- Step 1: Write `scripts/urp-stage3-closeout.mjs` with the 6-step real chain + envelope emission.
- Step 2: Sanity-test the script standalone (exit 0, valid JSON envelope, tmpdir cleaned).
- Step 3: Write `docs/security/URP_LOCAL_INDEX_CLOSEOUT.md` with 8 sections.
- Step 4: Wire the probe into `scripts/check.mjs`.
- Step 5: Add rows to `docs/TESTING.md` + `docs/ARCHITECTURE.md`.
- Step 6: Run all 8 verification gates; fix any drift; re-run until green.
- Step 7: Commit (`docs(urp): add URP-3.1D local index closeout probe`), push, monitor 4 CI workflows.
- Step 8: On all 4 SUCCESS, record the truth label `URP_3_1D_LOCAL_INDEX_CLOSEOUT_REMOTE_CI_VERIFIED` in session ledger.

After URP-3.1D is remote-CI verified, the explicit next unblock is
**Stage 4 Choose preflight** (not Stage 4 implementation — preflight
only, mirroring the URP-3.0 pattern that opened Stage 3).

---

**End of spec.** Awaiting Mumu approval before invoking
`superpowers:writing-plans` to generate the implementation plan.
