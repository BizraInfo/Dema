# Dema Main Baseline v0.2 — Proof Receipt

- **Date:** 2026-06-15 (GST)
- **Repository:** BizraInfo/Dema
- **Truth label:** `MEASURED` · `MAIN_DELIVERED`
- **main HEAD at issuance:** `0f33786dd539016d8e1cd22ec1d2794543d277ca`

This receipt records the verified state of `main` after the 2026-06-14/15 delivery
cycle. Every figure below was measured against `origin/main`, not asserted.

## Merged PRs (verified `merged=true`, merge SHAs)

| PR   | Merge commit | Summary                                                                                                     |
| ---- | ------------ | ----------------------------------------------------------------------------------------------------------- |
| #151 | `3b5f133`    | fix(test): de-bomb world-map CLI fixture wall-clock dependency                                              |
| #152 | `a1ebee4`    | feat(think): multi-runtime local model discovery (Ollama/LM Studio/GGUF/llmfit) + Amānah `network_used` fix |
| #153 | `12d2a56`    | test(consent): pin `assertIntentWithinBound` DoS boundary (DAG root)                                        |
| #154 | `7c5fa99`    | feat(theme): brand-token theme module + Realm TUI migration to canon palette                                |
| #155 | `014f518`    | refactor(cli): decompose dispatcher god-file (index.js 5308→1100, 63 command modules)                       |
| #156 | `ade8de3`    | test(verifier): proof-passport deep-verify adversarial negative paths (+12)                                 |
| #157 | `13942f0`    | test(receipts): authorship-key-store adversarial negative paths (+17)                                       |
| #158 | `0f33786`    | docs(superpowers): evidence-bound optimization roadmap                                                      |

## Measured deltas

- **Dispatcher decomposition:** `apps/cli/src/index.js` **5,308 → 1,100 LOC** (−4,208, ~79%).
- **Command modules extracted:** **63** files under `apps/cli/src/commands/` + 2 shared libs
  (`lib/status-identity.js`, `lib/package-version.js`). Behavior-preserving (driver smoke 43/43,
  full suite green, 0 module-load errors, `cmd_node0` intact).
- **Negative-path test depth (P0):** **+29 adversarial tests** across the DAG root + the two
  thinnest crypto kernels — consent-common (#153), proof-passport deep-verify (#156, +12),
  authorship-key-store (#157, +17). All prove fail-closed; no kernel finding.

## A+ delivery gate status (`MEASURED` on clean main)

`pre-push:seal` verdict on clean `main` = **PUSH_READY**. `delivery:check` stack:
perf A+ ✅ · coverage ✅ · release+perf-QA ✅ · MU pre-push PUSH_READY ✅ · local gates ✅ ·
covenant QA ✅. (`artifact-011` EROFS is sandbox-only, allowlisted as test 137.)

## gitleaks `scan` root cause + fix (this cycle)

The `scan` gate (gitleaks `detect --source .`, all fetched refs) failed on all 4 new PRs.
**Root cause (via CI job log, not assumption):** a single FAKE-PEM test fixture
(`-----BEGIN PRIVATE KEY-----\nFAKE\n-----END...`) in the authorship negative-path test —
gitleaks matches the PEM header regardless of body; because the scan covers all fetched refs,
that one commit poisoned every PR's scan. **Fixed at source** by amending the fixture to a
benign string (the test asserts symlink-outside-`DEMA_HOME` rejection and never reads the
body). No allowlist cruft; no fake PEM in merged history. An earlier "infra" hypothesis was
wrong and corrected by reading the actual CI log.

## Known follow-up bugs SURFACED by decomposition (`NEEDS_FIX`, not introduced)

These are **pre-existing** bugs that were faithfully relocated by #155 (verified byte-identical
to the prior inline handlers); the decomposition makes them easy to fix in isolated modules:

- `commands/mission.js` — identical ternary branches (human-readable output path is a no-op).
- `commands/dashboard.js` — Windows `start` opener needs a shell; HTML-inject if `</body>` missing.
- `commands/harness.js` — `--summary` ignored when `--json` absent.
- `argValue` helper duplicated across command modules (dedup into a lib).
- unused imports in the two new negative-path test files.

## Boundary

Read/verify only; no runtime mutation, no network beyond GitHub reads, no keys, no mint.
This receipt is a point-in-time snapshot of `main@0f33786`; it will drift as `main` advances.
