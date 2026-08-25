# WORKTREE STATE 0A · C0 local-estate census and PROD-01 reconciliation

**Captured:** `2026-08-22T23:56:00Z` (read-only evidence pass)
**Mission:** `BIZRA-SOVEREIGN-AGENT-COMPUTER-0A / C0`
**Task of record:** `TASK-075.02` · `PROD-01 — REAL-PERSISTENT-NODE0-RUNTIME-1A`
**Truth state:** `MEASURED` for the captured local state; `NOT_READY` for PROD-01 qualification.
**Authority delta:** `0`

## Scope and non-events

This census bound the current Dema checkout and the external PROD-01 package at
`/data/bizra/node0-closure/runtime/prod01-runtime-observation-2a`.

It did **not** start a runtime, send a runtime request, consume a real GO,
delete or reset any path, clean a worktree, push, merge, mint, federate, or
advance Node1/Node2. `ss -ltn 'sport = :7421'` had no listener and a
self-excluding process query found no `bizra-cognition-gateway` or
`PROD01_RUNTIME_START_1A` process.

## Dema checkout binding

| Field | Observed value |
| --- | --- |
| checkout | `/home/bizra-operating-system/Downloads/Dema` |
| branch | `main...origin/main` |
| HEAD | `9eb7f3f8287fd7e4e979a7922bcd718a8d49b0e3` |
| HEAD subject | `fix(root-canon): enforce complete six-predicate authority contract in verifier` |
| HEAD tree | `4f1d41f545f01f9f6710a8c2490617b129197194` |
| registered worktrees | `104` |
| raw `git worktree list --porcelain` SHA-256 | `3e63873f2ad77376e12d16d1d3bd04b7fe4185a060e615dae047d753e7572a36` |
| tracked diff | `AGENTS.md` only; diff SHA-256 `3e9da08f6ccfceaed7678eb5b21d0105a46a903ce1cc2a93c5f563d0906057b8` |
| untracked manifest SHA-256 before this report | `b541474e1465713b5d9491649c81d24701fc0d05cc60aa6e910dfd83664fc860` |
| pre-report untracked files | `17` |

Relevant registered roots include this checkout, `/home/bizra-operating-system/Downloads/Dema-node0-closure-1a`, `/home/bizra-operating-system/Downloads/Dema-spec-s0`, and `/data/bizra/node0-closure/root-canon-hardening-promotion-1a/dema`. The complete worktree list is represented by the digest above; it was not altered.

## Existing local-change classification

The categories below describe provenance evidence, not desirability. `UNKNOWN`
means preserved: no reset, cleanup, overwrite, or attribution upgrade is
authorized from this census.

| Paths at C0 entry | Classification | Basis / handling |
| --- | --- | --- |
| `AGENTS.md` | `PREEXISTING_USER_WORK` | The modification was present before C0 and was supplied as the active repo instruction set. Preserve. |
| `.kiro/settings/cli.json`, `.kiro/settings/lsp.json` | `KIRO_WORK` | Kiro-owned directory and Kiro CLI/LSP configuration. Preserve. |
| `.claude/.proven-config-version`, `.claude/proven-config.json`, `.claude-flow/harness-active-policy.json`, `.claude-flow/policy/state.json` | `OTHER_AGENT_WORK` | Claude/Ruflo provenance fields identify a separate agent framework. Preserve. |
| `.codex/config.toml` | `UNKNOWN` | Local Codex configuration existed before C0, but its author cannot be proven from disk. Preserve. |
| every pre-existing `backlog/**` file | `UNKNOWN` | 56 Backlog-managed files were already untracked. Their local presence and timestamps do not prove human, Kiro, or Codex authorship. Preserve; only use the Backlog CLI for task metadata. |
| `backlog/tasks/task-075.02 - PROD-01-—-REAL-PERSISTENT-NODE0-RUNTIME-1A.md` plan/notes delta | `NEW_CODEX_WORK` overlay | C0 recorded the human-directed C0 → C1 → C2 plan through `backlog task edit`; the pre-existing task body remains preserved. |
| this report | `NEW_CODEX_WORK` | Required C0 forensic state artifact. |

## DEMA boundary confirmed

`docs/DEMA_ARCHITECTURE.md`, `docs/ARCHITECTURE.md`, and ADR-001 through
ADR-005, ADR-008, and ADR-015 were read for this pass. They confirm that DEMA
remains the **face · cockpit · consent layer · bridge**. The governed Rust/Omega
substrate and future `bizra-cognition-gateway` belong outside this repository.
No Rust runtime, Wasm host, daemon, execution authority, or authority increase
was added to DEMA.

## External PROD-01 package binding

**Package root:** `/data/bizra/node0-closure/runtime/prod01-runtime-observation-2a`
**Mode / owner:** `775`, uid `1000`, gid `1000`
**Root modified:** `2026-08-22T20:20:05.517159222+04:00`

All current root entries are classified `PROD01_FORENSIC`: descriptors,
verifier, atomic-consume utility, A3 test harness, `control/`, `logs/`,
`observations/`, `receipts/`, and `.consumed/`. The existing
`.consumed/consumed-TEST-ISOLATED-719367/record.json` is preserved forensic
evidence and was not removed.

| File | Actual SHA-256 |
| --- | --- |
| `PACKAGE_DESCRIPTOR.json` | `1fe1b57be8f6234bf4f988e4aca0ddeadb752e749426a014a1b030314fb35af8` |
| `PROD01_RUNTIME_START_AUTHORITY_MANIFEST.json` | `fb6c551b87c5f4ad6eee21a0022a5b15358cbfabfaae515c43b28e1d542b8196` |
| `PROD01_RUNTIME_START_GATE_PACKET.json` | `50349bfff4a49ff1f584987af3adb2b81b8d94de63bcf7fa3ca0187f8624595d` |
| `atomic-consume.mjs` | `23fcd7b480f65d6a8c3452bb2d34d3fdf6d095602c54bbaece5ba0ff09de8376` |
| `test-cleanup-failures.sh` | `68dd975ca69a2603e8c00261068c07bdda83ce69d624ca915d3b737d43631687` |
| `verify-prod01-package.mjs` | `7f60fbae1d9884556db74cd5fdb43f0395125fff061ffe4e23674efc2b1eb8a8` |

The separately referenced supervisor is
`/data/bizra/node0-closure/runtime/prod01-runtime-start-1a/PROD01_RUNTIME_START_1A.sh`:
SHA-256 `ef2e5dde108c0888e54d8e93dd65d4a538ce184078a23c5904cfbc4ed16f75ea`.

## C0 findings for the frozen A1–A6 contract

### A2 — namespace isolation: `NOT_READY`

- `verify-prod01-package.mjs` imports and uses `statSync` for link identity.
  `statSync` follows a symlink, so `isSymbolicLink()` cannot establish that the
  declared path itself is not a symlink. Replace it with `lstatSync` and retain
  canonical `realpath` checks.
- The verifier checks existence of a few subdirectories but has no declared
  expected-entry set and therefore cannot reject an unexpected path or symlink
  substitution.
- The descriptor declares `receipts/`, while the referenced supervisor writes
  to `${GATE_ROOT}/receipt-store`. The verifier does not detect that
  undeclared namespace divergence.

### A3 — actual supervisor cleanup: `NOT_READY`

- The A3 harness starts the producer binary and a generated trap harness; it
  does **not** execute the referenced `PROD01_RUNTIME_START_1A.sh` supervisor.
- The supervisor only terminates `BOUND_PID`; it does not prove termination of
  the captured process group or session descendants.
- The harness falls back to treating a PID as PGID/SID if `/proc` resolution
  fails. That is inferred topology, not the required measured topology.
- C1 must run the actual supervisor only in disposable test mode, capture
  supervisor PID, producer PID, actual PGID, and actual SID before the signal,
  then prove bound process group/session emptiness and port `7421` release.

### A4 — atomic single use: `NOT_READY`

- The current claim uses `mkdirSync`, but its object is
  `.consumed/consumed-<sanitized-id>`, not the required exact terminal object
  `consumed/<authorization-id>`.
- Sanitization can collapse distinct authorization identifiers to the same path.
  C1 must validate an exact identifier rather than silently rewrite it.
- The consumption record only stores ID, time, PID, PPID, and state. It lacks
  required bindings: `package_digest`, `scope_digest`, `effect_class`,
  `issued_at`, `expires_at`, and `execution_count = 1`.
- The current disposable test calls `rmSync` before, between, and after claims.
  A new unique disposable authorization must make the eight-process race
  (`winners = 1`, `losers = 7`) without a losing claimant deleting any winner
  state.
- The referenced supervisor does not currently invoke the terminal claim, so
  the utility test alone does not prove an execution boundary consumes it.

### A5 — final actual package identity: `NOT_READY`

- The descriptor says `generated_at = 2026-08-22T20:11:00Z`; verifier,
  cleanup harness, and atomic consumer were modified later. Their bytes are
  not included in the current declared artifact set.
- The manifest binds packet, descriptor, and supervisor hashes, but not the
  verifier or A2/A3/A4 implementation bytes. A final acyclic identity must be
  recomputed only after C1 files stop changing.
- The descriptor/supervisor expect DEMA commit
  `ab2d0815815553224febdc0c413f0c2662f79969`; C0 observes current HEAD
  `9eb7f3f8287fd7e4e979a7922bcd718a8d49b0e3` and a dirty current worktree.
  Rebinding that authority to this checkout is not authorized by C0 and must
  not be hidden with reset/clean operations.

### A6 — semantic qualification: `NOT_RUN`

The package verifier is intentionally not run during C0 because its A3/A4
paths execute the test harnesses. Its pass/fail state remains unknown until
the repaired package is stable and C2 explicitly runs qualification.

## Current phase and next transition

```text
C0                         COMPLETE
C1 A2/A3/A4 repair         AUTHORIZED BY CURRENT HUMAN DIRECTIVE
C2 A1–A6 qualification     AFTER C1 STABILIZES
runtime start               NOT AUTHORIZED
real GO consumption         FALSE
READY_FOR_HUMAN_GO          FALSE
AUTHORITY_BARRIER           CLOSED
authority_delta             0
```

The next safe action is C1 only: repair the identified A2/A3/A4 mechanisms in
the external PROD-01 package with disposable tests. C2 must stop honestly if
the final package identity still disagrees with the declared DEMA or producer
objects. A successful C2 qualification will not authorize a runtime start.
