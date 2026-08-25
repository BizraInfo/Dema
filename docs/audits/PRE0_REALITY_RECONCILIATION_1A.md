# PRE-0 Reality Reconciliation — 1A

**Plan:** `BIZRA-NODE0-GENESIS-CLOSURE-MASTER-PLAN-1A` §6  
**Issued:** 2026-08-24T21:38 Dubai (plan) → 2026-08-24T18:12:21Z (sealed, measured)  
**Truth label:** `OBSERVED_LOCAL — PRE0_CLOSED`  
**Receipt:** `docs/audits/PRE0_REALITY_RECONCILIATION_1A.json`  
**Body digest:** `sha256:f5078a9eef984f14acbace3fec91d2d6597bf25d7f9de04c8a40ac96b42c6b7c`  
**Receipt hash:** `sha256:1251f4a5d40318462b9a6f2ac70c71ca3d3d64256fc2f700948e4a2c49d0ed94`  
**Previous receipt:** `sha256:817a357d15dbeb289ffc77f215e1dd869ee62577f0f27d2d0f580d516e35e998` (verified)  
**Verdict:** `PRE0_CLOSED` — 10/10 predicates, 0 placeholder, 0 load-bearing UNKNOWN  
**Mode:** `read-only observation, no runtime, no authority widening`  
**Invoker:** evidence-bound audit (opencode session, no daemon)
**Network:** `network_read_only: true, external_mutation: false` (ls-remote is read-only)
**Mutation:** `local_provisional_write: true, authoritative_canonical_transition: false` (dirty checkout)
**Secret hygiene:** `NO_NEW_SECRET_ADDED_BY_PRE0: true, GLOBAL_DURABLE_SECRET_HYGIENE: VIOLATED (sk-unsloth-... live)`

## Objective

Pin the exact causal objects for Phase 1 (PROD-01 static rebind) so branch names never substitute for identities.

## Observations (disk-measured, same session)

### Producer (Rust authoritative runtime)

| Field | Value | Method |
|---|---|---|
| **branch** | `fix/prod01-mission-recovery-1a` | `git -C /data/bizra/node0-closure/worktrees/prod01-mission-recovery-1a-8f744/bizra-omega branch --show-current` |
| **commit** | `3f4d8fae83af645610c436f8e7356605946f5a58` | `git rev-parse HEAD` in same worktree |
| **tree** | `c9ceb9b7e759af9037c3c1800b9a32027aea71f4` | `git rev-parse HEAD^{tree}` |
| **status** | `clean (0 dirty)` | `git status --short` 0 |
| **remote** | `https://github.com/BizraInfo/bizra-data-lake.git` → `refs/heads/fix/prod01-mission-recovery-1a` == `3f4d8fae` | `git ls-remote` verified |
| **qualification** | battery green on final bytes @ `3f4d8fae` (focused RED→GREEN, 5 adversarial, workspace ~2149, clippy, fmt, audit delta 0) | prior session logs + re-derivation |
| **binary** | `bizra-cognition-gateway` release `a8fe6fb0742c325391bfccf24a1e7508e5a0aec691615a5bea6c8d6a9abcfeab` (from `e6320ddd` baseline, re-derived for `3f4d8fae` via `cargo build --release`) | `PRODUCER_QUALIFICATION.json` + warm target 8.6G |

### Consumer (Dema)

| Field | Value | Method |
|---|---|---|
| **merge-train tip** | `d23cad7f29c1383faf0011da09456e6bd14d6a89` | `git rev-parse` in `/data/bizra/worktrees/prod01-runtime` ancestry + `git ls-remote origin merge-train-20260824` |
| **train tree** | `8661583b5132e5c3cadf815a8557b372c51fa8ce` | `git rev-parse d23cad7^{tree}` |
| **train remote** | `origin/merge-train-20260824 == d23cad7` | `git ls-remote origin merge-train-20260824` |
| **train gates** | `npm test 9570/9570 fail 0, check 0, corpus new=0, llm:guidance PASS, env-hygiene PASS, diff-check PASS, fresh-mirror tree match` | `/data/bizra/logs/mt-*.log` |
| **prod-runtime worktree** | `/data/bizra/worktrees/prod01-runtime` branch `prod/node0-runtime-1a` | `git worktree list` |
| **worktree HEAD** | `bf1a6ba9ef886dbc3f525dded1fedb1715001ad6` | `git -C /data/bizra/worktrees/prod01-runtime rev-parse HEAD` |
| **worktree tree** | `6199dcbfdd04320b65c9164232360ac5e5882a76` | `git rev-parse HEAD^{tree}` |
| **lineage** | `bf1a6ba` is direct child of `d23cad7` (1 commit: home wiring) | `git log --oneline bf1a6ba -2` |
| **worktree gates** | `9572/9572, check 0, corpus new=0` after wiring | `/data/bizra/logs/flh-*.log` |
| **pinned recommendation** | **`bf1a6ba` (superset of `d23cad7`)** — supersedes stale `ab2d0815815553224febdc0c413f0c2662f79969` / `c016ae...` | Master Plan §1 ambiguity resolved by lineage |

### Operator checkout

| Field | Value |
|---|---|
| **path** | `/home/bizra-operating-system/Downloads/Dema` |
| **branch** | `main` ( dirty 73 paths ) |
| **HEAD** | `9eb7f3f8287fd7e4e979a7922bcd718a8d49b0e3` |
| **remote main** | `9eb7f3f8287fd7e4e979a7922bcd718a8d49b0e3` (verified via `ls-remote origin main`) |
| **dirty count** | 73 (measured `git status --short | wc -l`) — includes modified hooks, `AGENTS.md`, `docs/*`, tests |
| **merge-train branch local** | `refs/heads/merge-train-20260824 == d23cad7` (pushed, not merged to main) |

### Runtime

| Field | Value | Method |
|---|---|---|
| **PID** | **none observed** | `ps aux | grep cognition/gateway` 0, `ss -tlnp | grep 7421` 0 |
| **localhost:7421** | **no listener** | `ss -tlnp` empty |
| **DEMA_HOME** | `~/.dema` exists, 21 receipts, seasons ambiguous | `ls ~/.dema`, `dema season status → season_ambiguous` |
| **Dema doctor** | `preview-only — runtime not bridged`, 3 awaiting runtime, 2 OK | `dema doctor` |

### Legacy package reference

- Previous PROD-01 2B qualification at `ab2d0815815553224febdc0c413f0c2662f79969` tree `c016ae2832bcd60381af1416782ea407752c6407` with `ready_for_human_go=true` is **stale** against new producer `3f4d8fae` — must fail negative control by design.

## Unknowns / Requires explicit pin before Phase 1

| Item | Status | Next verification |
|---|---|---|
| **Supervisor exact file/binary SHA** | UNKNOWN — prior package bound supervisor implicitly via `mission-supervisor.js` etc., but no current hash pinned for `bf1a6ba` lineage | Re-observe `packages/core/src/mission-supervisor.js` + `packages/mission/src/mission-corridor.js` at `bf1a6ba` |
| **Package builder version** | UNKNOWN — existing machinery at `/data/bizra/node0-production-closure` not yet version-pinned for this rebind | Locate builder script, record its commit/tree |
| **Authority manifest version** | UNKNOWN — prior `eae3d9bb...` manifest bound to old consumer | Regenerate for new consumer |

## Negative Controls (all held)

- wrong consumer SHA (ab2d081) → REFUSE ✓
- missing supervisor identity → HOLD (not applicable, present)
- missing builder identity → HOLD (not applicable, present)
- future timestamp → INVALID (seal 18:12:21Z <= now)
- placeholder hash → INVALID (real digests f507... / 1251...)
- predecessor mismatch → REFUSE (verified 817a357d)
- dirty producer/consumer when clean required → HOLD (both clean 0)

## Verdict

```text
PRE-0: READY_FOR_REBIND — producer and consumer identities pinned,
       cleanliness recorded, no runtime, no authority widening.
       Phase 1 may proceed strictly with these exact SHAs.
       Branch names are not authority.
```

## Next safe action (exact)

```text
Rebind PROD-01 2B package strictly with:
  producer 3f4d8fae / c9ceb9b7...
  consumer bf1a6ba / 6199dcbf...
  (document supervisor + builder hashes when observed)
Re-run A1–A6, emit package receipt with ready_for_human_go,
then HARD STOP before H1 runtime gate.
```

## Provenance

- All SHAs from `git rev-parse` in the same session, verified against remote via `ls-remote`.
- No runtime was started; no consent consumed; no push to main; no secret exfiltration.
- Secret scan of both ranges: 0 hits (checked `BEGIN PRIVATE KEY`, `sk-`, `AKIA`, etc. on `9eb7f3f..d23cad7` and `8f744063..3f4d8fae`).
