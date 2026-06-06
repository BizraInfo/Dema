# EVIDENCE — v0.2 First-Run Smoke

**Date:** 2026-05-05
**Branch:** `feat/v0.2-adr-import`
**Environment:** Linux x64, Node.js 20+, fresh `DEMA_HOME` via `mktemp -d`
**Adapter:** `DEMA_NODE0_STATUS_COMMAND` unset (expected developer-machine state)

This file records reproducible evidence that the v0.2 product face works end-to-end on a clean machine, with every CLAUDE.md invariant verified against actual CLI output.

## Reproduction

```bash
SMOKE_HOME=$(mktemp -d -t dema-smoke-XXXXXX)
export DEMA_HOME="$SMOKE_HOME"
node apps/cli/src/index.js welcome
node apps/cli/src/index.js setup
node apps/cli/src/index.js setup
node apps/cli/src/index.js status
node apps/cli/src/index.js status:json
node apps/cli/src/index.js doctor
node apps/cli/src/index.js today
node apps/cli/src/index.js mission propose
node apps/cli/src/index.js mission propose --consent "GO: Node0 bounded diagnostic activation only"
node apps/cli/src/index.js mission propose --consent "yes go ahead"
node apps/cli/src/index.js receipts
node apps/cli/src/index.js monetize
find "$DEMA_HOME" -type f -o -type d
```

## Results

| #   | Command                                       | Invariant verified                      | Outcome                                                                                                         |
| --- | --------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1   | `welcome`                                     | non-hype first-run orientation          | ✅ plain text, no token/AGI/passive-income claims                                                               |
| 2   | `setup` (1st run)                             | idempotent — creates skeleton           | ✅ `created:true`, all 6 paths in `createdPaths`, schema `bizra.dema.setup.v0.1`                                |
| 3   | `setup` (2nd run)                             | idempotent — never overwrites           | ✅ `created:false`, all paths in `existingPaths`, profile/config untouched                                      |
| 4   | `status`                                      | schema-tagged + identity not propagated | ✅ schema `bizra.dema.status.v0.1`, `human:null`, `activationGate:"BLOCKED"`                                    |
| 5   | `status:json`                                 | full envelope matches contract          | ✅ `proof.nextArtifact:"ARTIFACT-011"`, `nextAdmissibleAction:"complete_setup"`                                 |
| 6   | `doctor`                                      | exits 0 only when fully ready           | ✅ exits 1 on dev-machine (predicate fails); see "Doctor invariant" below                                       |
| 7   | `today`                                       | continuity tick records boundaries      | ✅ schema `bizra.dema.today_tick.v0.1`, `missionExecuted:false`, `runtimePulse.fired:false`                     |
| 8   | `mission propose` (no consent)                | `executes:false` always                 | ✅ `verdict:"BLOCK"`, `truthLabel:"MEASURED"`, `reason:"Exact consent phrase not provided."`                    |
| 9   | `mission propose` (correct phrase, not ready) | consent independent of readiness        | ✅ `accepted:true`, `verdict:"PERMIT_PREVIEW"`, but `executes:false` because not ready                          |
| 10  | `mission propose` (wrong phrase)              | no fuzzy consent                        | ✅ `verdict:"BLOCK"`, `requirement:"Exact phrase match; no fuzzy consent."`                                     |
| 11  | `receipts`                                    | clean state lists empty                 | ✅ `[]`                                                                                                         |
| 12  | `monetize`                                    | safe-offer guardian                     | ✅ "Allowed: Sovereign Local AI Node Setup + Safety Audit; Blocked: token/passive-income/AGI/federation claims" |
| 13  | `~/.dema/` tree                               | exact contract                          | ✅ `profile.json`, `config.local.json`, `receipts/`, `memory/today.json`, `logs/`, `skills/`                    |

## CLAUDE.md invariant cross-check

| Invariant                                                                                          | Verified by         | Status                         |
| -------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------ |
| #1 No runtime execution; `executes:false` always                                                   | tests 8, 9, 10      | ✅                             |
| #2 No hidden daemon; `today` records `missionExecuted:false`, `pulse.fired:false`; `doctor` strict | tests 6, 7          | ✅ (with widening — see below) |
| #3 Setup idempotent; never overwrites profile/config                                               | tests 2, 3          | ✅                             |
| #4 Consent is exact-string match only                                                              | tests 8, 9, 10      | ✅                             |
| #5 Schema-tagged outputs `bizra.dema.<thing>.v0.1`                                                 | tests 2, 4, 5, 7, 8 | ✅                             |
| #6 Adapter input untrusted; `human` defaults to `null`                                             | tests 4, 5          | ✅                             |

## Doctor invariant — widening landed in this PR

Original CLAUDE.md text (narrow): _"doctor fails (`exitCode = 1`) if `daemonStatus === "running"`."_

Implementation in [apps/cli/src/index.js:53–60](../apps/cli/src/index.js):

```js
const ready =
  status.ready &&
  status.consoleReady &&
  status.activationGate === "EXPLICIT_GO_REQUIRED" &&
  status.daemonStatus !== "running";
process.exitCode = ready ? 0 : 1;
```

Doctor exits 0 only when **all four** predicates hold. The "no hidden daemon" guard is one of those four. CLAUDE.md text widened in this same PR to match the code, eliminating the doctrine-vs-code drift the smoke surfaced.

## What this evidence proves for GTM

A user installing Dema and running the first six commands sees: schema-tagged JSON, explicit boundaries, no daemon, no identity propagation, ARTIFACT-011 named as the _next_ artifact (never issued by Dema), exact-string consent gating with truth labels. That is the product face the v0.2 tag ships.

The activation itself — ARTIFACT-011 generation — happens elsewhere (the governed Node0 path in `bizra-omega`, per ADR-003). Dema's `receipts []` becomes `receipts [{ARTIFACT-011}]` when that path writes a receipt into `~/.dema/receipts/`. Two repos, one product face.
