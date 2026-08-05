# NODE0-MISSION-RUN-HEALTH-DISPATCH-FIX-1A

Truth label: `IMPLEMENTED_CANDIDATE_REMOTE_CI_PENDING`

## Purpose

Restore the documented installed CLI route:

```text
dema mission run health
```

without changing the health mission kernel, its exact consent phrase, its receipt schema, or the generic `dema mission run <file>` preview route.

## Verified defect

At base commit:

```text
4c2645562c3c80f3e10332128bc9a20f143ebaa3
```

`apps/cli/src/commands/mission.js` handles every `subcommand === "run"` as a file mission before reaching its later `run health` branch. The generic branch calls `process.exit`, so the later health route is unreachable and the literal token `health` is treated as a filename.

This was observed during `NODE0-LOCAL-SEASON-RESURRECTION-1A`, where the documented CLI route returned `file_not_found` and the shipped health kernel had to be invoked directly.

## Red-first sequence

1. Test-only commit:
   `308bbeecdbb827eaad2fb1d8b78d3d4cb4283f95`
2. Fix commit:
   `8e8082a1c5f0189b556c75a637fd518cfbb710d0`

The regression suite exercises the installed `bin/dema` process boundary and requires:

- `mission run health --dry-run --json` reaches the health snapshot path and writes nothing;
- `mission run health --json` returns the typed consent refusal, never `file_not_found`;
- exact consent writes exactly one health receipt under an isolated `DEMA_HOME`;
- `mission run <file> --json` still reaches the generic materialization preview.

## Implementation

`bin/dema` now selects the exact token sequence `mission run health` before loading the generic CLI dispatcher. It delegates all health semantics to the existing shipped kernel:

- `buildHealthSnapshot`;
- `saveHealthSnapshotReceipt`;
- `formatHealthSnapshotReceipt`.

All other commands continue to delegate to `apps/cli/src/index.js` unchanged.

## Authority and safety boundary

- no change to the health consent phrase;
- no automatic consent;
- no model or network invocation added;
- no signer, wallet, token, federation, Node1, or economic effect;
- dry-run remains read-only;
- a receipt write remains gated by the existing exact consent phrase;
- generic file-mission behavior remains available;
- no merge or readiness promotion is authorized by this receipt.

## Execution boundary

The execution environment used to author this candidate could read and write through the authorized GitHub connector, but a clean clone failed because DNS could not resolve `github.com`.

Therefore this receipt does **not** claim:

- local focused test execution;
- `npm test` success;
- `npm run check` success;
- `npm run llm:guidance` success;
- claim-corpus success;
- remote CI success;
- merge readiness.

Remote exact-head workflows are the next qualification authority.

## Explicit residual gap

This minimum slice repairs the installed/global `bin/dema` surface. A caller that bypasses the package entry point and directly invokes:

```text
node apps/cli/src/index.js mission run health
```

still reaches the order-dependent dispatcher defect. Removing that residual requires a separate internal dispatcher refactor with broader regression coverage; this candidate does not claim it.

## Promotion criteria

1. The four focused subprocess tests pass on the exact candidate head.
2. Existing health-kernel tests remain green.
3. Required repository workflows pass without exemptions.
4. Review confirms generic `mission run <file>` behavior is unchanged.
5. Review confirms no consent or authority widening.
6. Current limitations preserve the direct-entry residual honestly.

## Does not prove

- Node0 closure;
- live autonomous mission execution;
- general `must_not_repeat` enforcement;
- signed Season State;
- federation or economic readiness;
- independent reproduction;
- continuous production verification.
