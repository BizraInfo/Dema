# PROD-01 C2 clean-consumer rebind check 0A

**Bounded authority:** `GO-C2-CLEAN-CONSUMER-REBIND-CHECK-0A`  
**Date:** 2026-08-23  
**Scope:** prove the historical consumer object locally, map consumer locators in the existing PROD-01 2A package, and create an isolated worktree only if the package permits path substitution without an authority-bound package change.

## Phase A — declared consumer object

| Field | Measured value | Verdict |
| --- | --- | --- |
| `LOCAL_CONSUMER_OBJECT` | `EXISTS` | `git cat-file -e ab2d0815815553224febdc0c413f0c2662f79969^{commit}` succeeded. |
| Declared commit | `ab2d0815815553224febdc0c413f0c2662f79969` | Present locally. |
| Re-derived tree | `c016ae2832bcd60381af1416782ea407752c6407` | Matches the historical declaration. |
| `DECLARED_TREE_MATCH` | `true` | `git show -s --format='%H %T'` returned the declared commit/tree pair. |

The currently active consumer location was deliberately not changed:

```text
realpath = /home/bizra-operating-system/Downloads/Dema
HEAD     = 9eb7f3f8287fd7e4e979a7922bcd718a8d49b0e3
tree     = 4f1d41f545f01f9f6710a8c2490617b129197194
clean    = false
```

## Phase B — consumer binding map

| Field / locator | Declaring artifact | Declared value / behavior | Authority significance |
| --- | --- | --- | --- |
| `objects.consumer_commit` | `PACKAGE_DESCRIPTOR.json` | `ab2d0815815553224febdc0c413f0c2662f79969` | Expected checked-out consumer object. |
| `objects.consumer_tree` | `PACKAGE_DESCRIPTOR.json` | `c016ae2832bcd60381af1416782ea407752c6407` | Expected consumer tree. |
| `objects.consumer_repo` | `PACKAGE_DESCRIPTOR.json` | `/home/bizra-operating-system/Downloads/Dema` | Exact absolute target used by the A5 verifier for `git HEAD`, `HEAD^{tree}`, and clean-worktree checks. Changing it changes the descriptor hash. |
| `dema.worktree` | `PROD01_RUNTIME_START_GATE_PACKET.json` | `/home/bizra-operating-system/Downloads/Dema` | Exact absolute consumer locator in the gate packet. The authority manifest binds the packet's SHA-256. |
| `DEMA_REPO` | `PROD01_RUNTIME_START_1A.sh` | `/home/bizra-operating-system/Downloads/Dema` | Static execution locator. The supervisor `cd`s there, imports the adapter from it, and invokes the CLI from it. The descriptor and gate packet bind this supervisor's SHA-256. |
| `EXPECTED_DEMA_HEAD` / `EXPECTED_DEMA_TREE` | `PROD01_RUNTIME_START_1A.sh` | `ab2d081...` / `c016ae...` | The supervisor compares the exact static DEMA path's checked-out object and rejects a dirty worktree. |
| Adapter module path | `PROD01_RUNTIME_START_1A.sh` | `${DEMA_REPO}/packages/node-adapter/src/gateway-http-adapter.js` | Runtime program path is derived from the static `DEMA_REPO`, not an alternate worktree or caller CWD. |
| CLI program path | `PROD01_RUNTIME_START_1A.sh` | `${DEMA_REPO}/apps/cli/src/index.js` | Runtime program path is derived from the static `DEMA_REPO`, not an alternate worktree or caller CWD. |
| Verifier consumer lookup | `verify-prod01-package.mjs` | `gitValue(objs.consumer_repo, ...)` and `gitWorktreeClean(objs.consumer_repo)` | A5 reads the descriptor's absolute path. It has no authorized override for a different consumer root. |
| Worker CWD | `verify-prod01-package.mjs` | `D.namespace.gate_root_2a` for the disposable A4 worker | Package-test CWD only; it does not substitute the consumer location. |
| DEMA environment | `PROD01_RUNTIME_START_1A.sh` | `DEMA_GATEWAY_URL`, `DEMA_NODE0_ADAPTER` | These select the observation transport; no environment variable substitutes `DEMA_REPO`. |
| Disposable A3 harness | `test-cleanup-failures.sh` | Fixed supervisor path | It does not bind an alternate DEMA consumer location. |
| A4 atomic consumer | `atomic-consume.mjs` | No DEMA consumer locator | It is unrelated to consumer-path substitution. |

The descriptor, gate packet, verifier, and supervisor are each authority-bound artifacts. The terminal authority manifest binds their actual SHA-256 values; changing any locator would require a new descriptor/packet/manifest hash DAG and a new A1–A6 qualification cycle.

## Phase C decision

```text
CASE                          = 2
verdict                       = PACKAGE_REBIND_REQUIRED
READY_FOR_HUMAN_GO            = FALSE
CLEAN_WORKTREE_CREATED        = FALSE
CLEAN_WORKTREE_PATH           = (none)
candidate path                = /data/bizra/node0-closure/worktrees/dema-prod01-2a-ab2d081
candidate path state          = ABSENT
```

The existing package cannot lawfully use a newly created worktree at a different path without changing authority-bound content. No worktree was created, no package artifact was modified, and A1–A6 were not re-run because Phase D is authorized only for CASE 1.

## Current package and non-event evidence

| Artifact / state | Measured result |
| --- | --- |
| Package descriptor SHA-256 | `1c22304d47974a690d5068d0a3d6a474129f2aad6ee63563038a87087558ee56` |
| Gate packet SHA-256 | `809f3eb29e6a411f39f4c44ced1a6deb7924b9a5a7f618ba6e117e32af3d29c7` |
| Authority manifest SHA-256 | `771101bceef819d047c05e22e0a5f5bc5b6199388752b19139702ffe33234efd` |
| Supervisor SHA-256 | `f09328e309d68a48d601ce456e2aa443021a6f5fb886123e1b94e96dd11e094d` |
| Atomic consumer SHA-256 | `cac8832066be638bbdd2add3e49d5995a2d08db13c6f602438580da97f89e8dc` |
| A3 cleanup harness SHA-256 | `9e5408b2deedb1ade7242c77162b71bf2e5379f0ca6e05987b413d74386596bf` |
| Package verifier SHA-256 | `893e63db2c470daa5e26adb94e2847c597e31d3a1897682e0e43d4107442eb54` |
| Real GO terminal object | Absent. |
| Real GO authorization record | Absent. |
| TCP port `7421` | Free. |
| `bizra-cognition-gateway` process | Absent. |

`CURRENT_DIRTY_DEMA_PRESERVED` means the pre-existing active DEMA checkout was not reset, cleaned, stashed, checked out, or otherwise changed. This audit receipt is the only new Codex work created in the DEMA tree during this bounded check; it is not a PROD-01 consumer or package artifact.

The previously reported invalid orchestration stop-hook JSON is recorded only as `ORCHESTRATOR_HOOK_DEFECT` / `TOOLING_WARNING`: it was not re-run or changed in this slice and has no effect on this package decision.

## DEMA repository gates

| Check | Result |
| --- | --- |
| `npm test` | Exit `1`: 9,512 pass / 3 fail / 9,515 tests. The classifier failed closed on `NCG-01`, `NCG-02`, and `key-store signing path blocks when the store is unavailable`. |
| `npm run check` | Exit `1`: 9,548 pass / 3 fail / 9,551 tests. It failed closed on the same three named failures. |
| `npm run llm:guidance` | PASS. |
| `git diff --check` | PASS. |

These DEMA-suite failures are recorded as known independent harness failures; they are not evidence that the externally held PROD-01 package is qualified.

## Terminal state and next authority

```text
A1_A6_MACHINE_VERDICT         = NOT_RERUN (CASE 2 halt before Phase D)
REAL_GO_CONSUMED               = FALSE
RUNTIME_STARTED                = FALSE
AUTHORITY_DELTA                = 0
C3                             = BLOCKED
NEXT_AUTHORITY_REQUIRED        = Fresh Human GO to construct a new explicitly
                                 path-bound PROD-01 package revision for a
                                 dedicated clean worktree, then rerun frozen
                                 A1–A6 and stop at READY_FOR_HUMAN_GO.
```
