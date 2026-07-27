# ADR-048 — Runtime execution boundary: named adapters under consent, not a blanket ban

- **Status:** Accepted (slice GENESIS-RUNTIME-SPINE-1A.0)
- **Date:** 2026-07-27
- **Amends:** the unqualified invariant "No runtime execution in this repo" as
  stated in `CLAUDE.md`, `docs/LLM_SYSTEM_FLOW.md` and
  `.claude/rules/01-dema-boundary.md`
- **Related:** ADR-001 (Dema is one face), ADR-002 (no shadow state),
  ADR-004 (local-first memory), ADR-005 (operator actions require explicit
  consent)

## Problem

Until this slice the repo's boundary line was flat and unqualified:

> No runtime execution in this repo.

`GENESIS-RUNTIME-SPINE-1A.0` makes that literally false. `npm run genesis:node0`
starts two long-lived processes, `scripts/genesis/urp0-server.mjs` calls
`createServer(...).listen(...)`, and `scripts/genesis/urp0-store.mjs` calls
`writeFileSync` / `renameSync`.

The code and the canon now disagree, and the canon is what a new agent reads
first. Leaving the contradiction in place is the worse failure: an invariant the
tree openly violates stops being an invariant and becomes decoration. The next
agent either obeys a retired rule or learns that these rules can be ignored.
Both outcomes are worse than an honest amendment.

## What the invariant was actually protecting

Re-derived from ADR-001/002/005 rather than from the sentence. The line was never
a ban on the token `listen()`. It protected four things:

1. **No hidden daemon.** Nothing runs that the operator did not start.
2. **No implicit execution.** Nothing executes as a side effect of reading,
   previewing or planning.
3. **No ambient authority.** Execution cannot exceed what was consented to, and
   cannot leave the local machine.
4. **No self-certification.** The thing that executes does not get to declare its
   own output valid.

A runtime honouring all four is not what the invariant defended against. A
runtime violating any of them is, and remains forbidden.

## Decision

The invariant is replaced by:

```text
Pure kernels remain side-effect free.

Runtime execution is allowed only in explicitly named runtime adapters or
applications, under exact consent, bounded authority, append-only evidence,
independent verification and reconstructable state.

No hidden daemon.
No implicit model invocation.
No unreceipted state transition.
```

This is a **narrowing**, not a licence. It names *where* runtime may live
(explicitly designated adapters) and attaches five conditions to it. Code outside
a named adapter is exactly as constrained as before.

### The named runtime adapters, as of this ADR

| Path | Role |
| --- | --- |
| `scripts/genesis/urp0-store.mjs` | durable journal; the only writer |
| `scripts/genesis/urp0-scan.mjs` | bounded metadata-only filesystem gatherer |
| `scripts/genesis/urp0-server.mjs` | loopback control plane |
| `scripts/genesis/urp0-runtime.mjs` | composition seam |
| `scripts/genesis-node0.mjs` | the single operator entrypoint |

Everything under `packages/*/src` — including the three genesis kernels
`urp0-kernel.js`, `urp0-mission-kernel.js`, `urp0-sat5.js` — remains pure and is
mechanically held so by `scripts/review/kernel-purity-check.mjs`, which scans
every `packages/<pkg>/src` directory for side-effect imports. That gate is **not**
relaxed by this ADR. Adding a runtime adapter does not grant its kernels any new
latitude; a `listen()` inside `packages/` still fails the gate, by design.

### How each condition is held — structurally, not by promise

| Condition | Mechanism |
| --- | --- |
| Explicitly named adapter | The five paths above. All I/O lives in `scripts/`; the purity gate enforces the other side. |
| Exact consent | `packages/fate/src/fate.js` byte equality. The required phrase is recomputed from the mission id, the canonical root and the contract hash, so consent cannot be transplanted between missions or survive a contract edit. A near match is refused and the refusal is journaled. |
| Bounded authority | The resource offer must be a strict fraction of what the node possesses, `network:false`, `unrestricted_shell:false`, `unrestricted_filesystem:false`. The mission is metadata-only: `scripts/genesis/urp0-scan.mjs` never imports `statSync`, so "symlinks are not followed" is a property of the import graph. |
| Append-only evidence | Hash-chained journal, `event_id = sha256(canonical{seq,kind,payload,prev_event})`, atomic `tmp + fsync + rename`, `0700` dirs / `0600` files, all beneath `DEMA_HOME`. |
| Independent verification | Five deterministic verifiers re-derive their evidence from the actual execution — event ids, chain links, both state roots by replay, the phrase recomputed from the contract, the mission result recomputed from the raw observation. A forged `ADMISSIBLE` with a recomputed hash still fails, because verdicts are derived rather than stored. Missing evidence REFUSES; it never defaults to PASS. |
| Reconstructable state | The world is rebuilt from the journal alone; a restart reproduces the identical state root or the runtime refuses to start. |

### No hidden daemon

The only entrypoint is `npm run genesis:node0`, typed by the operator. No hook,
no `postinstall`, no watcher, no autostart. `Ctrl-C` terminates and leaves the
journal reconstructable.

### No implicit model invocation

This runtime invokes no model at all. The five verifiers are deterministic
functions; `autonomous_ai_agent` is `false` in every artifact they produce.

### No unreceipted state transition

Every world-state change is an event in the chain. Execution without a recorded
authorization is refused by the reducer (`execution_without_authorization`), a
judgment without execution is refused (`judgment_without_execution`), a receipt
without a judgment is refused (`receipt_without_judgment`), and Block0 cannot be
sealed without a receipt (`block0_without_receipt`).

## What remains forbidden, unchanged

- No daemon, autostart, or background execution the operator did not command.
- No bind to any address but `127.0.0.1`. No tunnel, DNS, reverse proxy or public
  deployment.
- No external provider call. No implicit model invocation.
- No execution without an exact-string phrase bound to the specific contract hash
  and root.
- No mint, treasury action, federation or Node1 admission.
- No state written outside `DEMA_HOME` / `~/.dema`.
- No side effects in `packages/*/src`.

## Consequences

**Positive.** The repo can state what it does. "Dema is a face" narrows honestly
to "Dema is a face over a governed runtime, and one bounded instance of that
runtime now lives here under consent."

**Cost.** The boundary is no longer checkable by the mere absence of `node:http`
and `node:fs` from the tree. It now depends on the tier split staying legible:
pure kernels in `packages/*/src`, all I/O in `scripts/`. The purity gate is what
keeps that honest, which makes it load-bearing rather than advisory.

**Risk accepted.** "Named adapters" is a shape that invites additions. The
mitigation is that this ADR enumerates conditions rather than granting precedent:
a future adapter must be argued against the table above, not against the fact
that one adapter was once admitted. Adding a path to that table is an ADR-level
act, not an implementation detail.

## Alternatives rejected

- **Move the runtime to another repo.** Preserves the sentence literally, but
  splits the constitutional kernels from the thing they govern — and composing
  organs that already live here was the entire point of the rung.
- **Keep the sentence and call the runtime a "preview".** This is the failure the
  repo has spent seasons removing. The loop journals events, writes receipts and
  seals a Block0 candidate. Calling that a preview is the overclaim inverted, and
  no less false.
- **Say nothing and let the code speak.** The next agent reads `CLAUDE.md` before
  it reads `scripts/genesis/`.

## Verification

```bash
npm run genesis:node0                            # the only entrypoint; loopback only
node scripts/genesis-node0.mjs verify            # replays the journal, re-derives the state root
node --test tests/genesis-runtime-spine.test.js  # 15 tests
node scripts/review/kernel-purity-check.mjs      # kernels stay pure
node scripts/llm-guidance-check.mjs              # canonical-flow invariants present
```

Evidence for the run this ADR describes:
`/data/bizra/logs/bizra-genesis-runtime-spine-1a0-20260727T035356Z/`
