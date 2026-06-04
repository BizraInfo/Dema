# Post-Seal Release Evidence - A+ Uplift Train + Genesis Blueprint

- **Date:** 2026-06-04 (GST)
- **Canonical state:** `main @ d3a507c48df0cf800ce0f405ff2279ed89afce95`
- **Status label:** `GENESIS_BLUEPRINT_SEALED_TO_MAIN`
- **Type:** read-only release receipt draft. This document performs no seal, push, release, runtime activation, network launch, federation, or economy action.
- **Replay:** `git checkout d3a507c48df0cf800ce0f405ff2279ed89afce95 && npm run check`

## 1. Fresh Local Verification

Measured locally on 2026-06-04 after `git fetch origin`; `HEAD` and `origin/main` both resolved to `d3a507c48df0cf800ce0f405ff2279ed89afce95`.

| Gate                              |                                     Result | Evidence command / source                               |
| --------------------------------- | -----------------------------------------: | ------------------------------------------------------- | ------- | --------------------------------------------- |
| `npm run check`                   |                                     EXIT 0 | `/tmp/dema-post-seal-check-final.log`                   |
| `npm test`                        |    EXIT 0, 4047 tests / 4047 pass / 0 fail | `/tmp/dema-post-seal-npm-test-after-doc.log`            |
| Test count inside `npm run check` |            4047 tests / 4047 pass / 0 fail | `rg "^# tests                                           | ^# pass | ^# fail" /tmp/dema-post-seal-check-final.log` |
| Coverage inside `npm run check`   | 96.74 line / 87.03 branch / 97.86 function | coverage block in `/tmp/dema-post-seal-check-final.log` |
| Standalone `npm run coverage`     |                                     EXIT 0 | `/tmp/dema-post-seal-coverage.log`                      |
| Standalone coverage               | 96.74 line / 87.05 branch / 97.86 function | coverage block in `/tmp/dema-post-seal-coverage.log`    |
| Coverage gates                    |                  passed above 95 / 85 / 97 | `npm run coverage`                                      |
| `git diff --check`                |                                     EXIT 0 | local command                                           |
| Working tree before this receipt  |  clean except this untracked receipt draft | `git status --short --branch`                           |
| PERF-MEASURE-1A gate              |                  OK within sanity ceilings | `node scripts/perf-bench.mjs` inside `npm run check`    |

## 2. Current Repo Metrics

| Fact                           |                                                                                                                     Fresh measured value | Evidence                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------: | ------------------------------- |
| Source files / LOC             |                                                                                                                   228 `.js` / 60,367 LOC | `git ls-files` + line count     |
| Test files / LOC               |                                                                                                              288 `.test.js` / 74,339 LOC | `git ls-files` + line count     |
| Dependencies                   |                                                                                                                           0 prod / 0 dev | `package.json`                  |
| Lockfile                       |                                                                                                                                   absent | `package-lock.json` not present |
| `node_modules` package entries |                                                                                          0 package entries; one `.vite` cache dir exists | `ls -la node_modules`           |
| CLI dispatcher legacy switch   |                                                                                                              0 `switch(command)` matches | `apps/cli/src/index.js` scan    |
| `cmd_*` references             |                                                                                                                           126 references | `apps/cli/src/index.js` scan    |
| `Object.freeze` references     |                                                                                                                                    2,022 | tracked `.js` scan              |
| `sha256` references            |                                                                                                                                      798 | tracked `.js` scan              |
| Network surface                | local loopback only: Node0 gateway `127.0.0.1:7421`, Ollama `localhost` / `127.0.0.1:11434`, LM Studio `127.0.0.1:1234` where applicable | `THREAT_MODEL.md`, source scan  |

## 3. Merged Train And Blueprint

|   PR | Merge commit                               | Merged at UTC        | Slice                                                | Gate meaning                                                     |
| ---: | ------------------------------------------ | -------------------- | ---------------------------------------------------- | ---------------------------------------------------------------- |
| #140 | `464b799593a9b7225fab44e22b92115efe4511bc` | 2026-06-04T04:50:16Z | `pr/*` branch-class resolver + `pr-class.mjs` parity | release-train CI class fixed                                     |
| #135 | `c7549f2c74af7466ff9d56d7c6406b89308a3952` | 2026-06-04T13:53:05Z | CLI god-switch to `COMMAND_TABLE`                    | dispatcher debt closed                                           |
| #136 | `86655e064c0b309f76a9b4ffc3bf0c0559fc2d80` | 2026-06-04T13:53:10Z | PERF-MEASURE-1A + CI perf sanity gate                | performance measurement added                                    |
| #137 | `2d2c816c46b2abb01ff44f90401f6e10a5a265a6` | 2026-06-04T13:53:15Z | Track 3 behavioral lifecycle-chain harness           | behavioral-test thinness reduced                                 |
| #139 | `93a734623ba278bfdd39ff9c6c88117683043676` | 2026-06-04T13:53:20Z | OBS-1A local event log + reader                      | observability baseline added                                     |
| #138 | `860969defd6dd9016d72c00a5c6042f3a9173475` | 2026-06-04T13:53:24Z | SPARC audit + SBOM + threat model                    | audit/security docs improved                                     |
| #141 | `d3a507c48df0cf800ce0f405ff2279ed89afce95` | 2026-06-04T14:33:14Z | Genesis composition blueprint preview                | DevOps / CI-CD / performance-QA blueprint surface sealed to main |

## 4. Remote CI Evidence

Remote PR state was read with `gh pr view` and `gh pr checks` on 2026-06-04.

Core gates observed green across the train and blueprint:

- `test (20.x)`
- `test (22.x)`
- `proof-quality`
- `Analyze (JavaScript)` / CodeQL
- `scan`
- Socket Security project report
- Socket Security pull request alerts

Review-bot nuance:

- #136: CodeRabbit `pass` / review approved.
- #137, #140, #141: CodeRabbit `pass` / review skipped.
- #135, #138, #139: CodeRabbit reported `fail` with reason `Insufficient review credits`; core CI and security gates passed. Treat this as vendor-capacity/advisory evidence, not a code/security failure.

## 5. What Is Live

- Local-first Dema proof kernel and CLI face.
- `COMMAND_TABLE` dispatch with own-property-safe lookup.
- Consent discipline and exact-string mutation boundaries.
- Receipt / ledger / verifier spine.
- PERF-MEASURE-1A measurement layer and CI sanity gate.
- Track 3 behavioral lifecycle-chain tests.
- OBS-1A local, content-addressed, hash-chained event log and read-only integrity reader.
- SPARC audit, SBOM, threat model, and Genesis Composition Blueprint preview.

## 6. What Is Not Live Or Not Claimed

- Block0 genesis seal is not performed by this receipt.
- Public network is not live.
- Federation is not live.
- Public token/economy is not live.
- SAT runtime isolation and URP runtime custody are not fully proven live.
- Signed release artifacts are not yet formalized.
- Disaster recovery / restore runbook: **now complete** — sealed 2026-06-04 by OPS-READINESS-1A (PR #142, squash `8a5621a`). See the §9 update.

## 7. Quality Grade

**A+ / 96-97 for the local-first sovereign proof-kernel engineering baseline.**

Rationale:

- The prior A-minus deductions are now closed on main: dispatcher debt, unmeasured performance, behavioral-test thinness, weak observability, and audit/SBOM/threat-model gaps.
- Fresh local verification passed: `npm run check` EXIT 0, 4047 / 4047 tests, coverage above gates, `git diff --check` clean.
- Remote core CI gates passed across the release train and blueprint.
- The grade is scope-bound: it does not claim a public decentralized production network, live federation, public economy, or completed Block0 genesis seal.

## 8. Next Decision Gate

Recommended next gate:

```text
BLOCK0-GENESIS-SEAL-PREFLIGHT
```

Prerequisite maturity work that remains useful before or alongside that gate:

1. ~~`RECOVERY.md` backup / restore / re-verify runbook.~~ **DONE 2026-06-04** — OPS-READINESS-1A sealed (PR #142, squash `8a5621a`); see §9.
2. Signed-release policy for public artifacts.
3. Runtime-isolation proof track for SAT / URP custody.
4. Long-run performance trend receipts building on PERF-MEASURE-1A.

## 9. Update — 2026-06-04: Residual-Risk #1 Closed (OPS-READINESS-1A)

Recorded after this receipt's `d3a507c` baseline. Main has since advanced to
`8a5621a`. The §1 local-verification numbers above remain anchored to `d3a507c`
and were **not** re-measured for `8a5621a`; the seal evidence below is remote CI
plus a focused recovery-test run.

| Fact                                          | Value                                                 | Evidence                                                                                                                  |
| --------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| PR                                            | #142                                                  | `gh pr view 142`                                                                                                          |
| Merge                                         | squash `8a5621a`                                      | `main` d3a507c → 8a5621a                                                                                                  |
| Slice                                         | OPS-READINESS-1A verifiable recovery kernel + runbook | `docs/RECOVERY.md`, `packages/installer/src/dema-recovery.js`, `scripts/dema-recovery.mjs`, `tests/dema-recovery.test.js` |
| Recovery tests                                | 7 / 7 pass                                            | `node --test tests/dema-recovery.test.js`                                                                                 |
| Recovery roundtrip                            | backup → verify = VERIFIED / root_hash MATCH          | `scripts/dema-recovery.mjs`                                                                                               |
| Remote CI (head `3ab45b1` = squashed content) | 8 / 8 gates green                                     | `api.github.com/repos/BizraInfo/Dema/commits/3ab45b1/check-runs`                                                          |
| CodeQL                                        | success — no new alerts                               | code-scanning on PR #142                                                                                                  |
| Merge state                                   | MERGEABLE / CLEAN                                     | `gh pr view 142 --json mergeable,mergeStateStatus`                                                                        |

Green gates: `test (20.x)`, `test (22.x)`, `proof-quality`,
`Analyze (JavaScript)` / CodeQL, `scan`, Socket Security (PR + Project),
CodeRabbit (review completed).

A HIGH CodeQL `js/file-system-race` (TOCTOU) was caught on the first push and
fixed before merge by removing all path stat-then-use from the recovery walk
(dirent-based classification + fd-only reads). This closes residual-risk item
§6 / §8-#1 (disaster-recovery runbook).

Remaining §8 work before `BLOCK0-GENESIS-SEAL-PREFLIGHT`: signed-release policy,
SAT / URP runtime-isolation proof, and long-run performance trend receipts.

---

This receipt records measured local and remote facts for `d3a507c48df0cf800ce0f405ff2279ed89afce95`, with the §9 update recording the subsequent `8a5621a` seal. It performs no mutation beyond this documentation artifact, opens no public network, and makes no public economy or federation claim.
