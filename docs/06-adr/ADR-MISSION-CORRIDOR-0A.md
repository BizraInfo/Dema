# ADR-MISSION-CORRIDOR-0A — persistent mission control plane

- **Status:** Accepted (control plane only)
- **Slice:** DEMA-MISSION-CORRIDOR-0A
- **Truth label:** `PREVIEW_ONLY` — no worker, no daemon, no execution
- **Problem:** long missions today live in chat context. When the session ends,
  the mission dies with it; the operator must re-explain, re-orient, and
  babysit. Five babysitting classes were identified (consent, context,
  execution, quality, observability); this slice closes **context** and
  **observability**, and gives **execution** its recovery half.

## Decision

A mission is two disk artifacts under `$DEMA_HOME/missions/<id>/`:

1. **Mission Contract** (`contract.json`) — immutable, content-addressed:
   objective, base SHA, permitted actions, `merge_policy` (only legal value in
   0A: `checkpoint_required` — no auto-merge exists), time budget, per-slice
   repair budget, mandatory stop conditions, creation time. Sealed once;
   `contract_hash` binds every journal event to it.
2. **Journal** (`journal.jsonl`) — append-only, hash-chained events over a
   closed 11-state transition map (`CREATED → PREFLIGHT → PLANNING →
   IMPLEMENTING → VERIFYING → SAT_REVIEW/REPAIRING/CI_WAIT → CHECKPOINT →
   COMPLETE`, with the kill switch `STOPPED` reachable from every non-terminal
   state and never blockable). Each event may carry branch, head SHA, failing
   gate, next command, `requires_human`, and monotonic repair-round usage.

**Status, lease expiry, budget remaining, and the exact resume point are pure
derivations** over those two artifacts with an injected `now` — never asserted,
always recomputed, tamper-evident (any changed byte breaks the chain).

> The model does not remember the mission. The mission remembers itself.

## "No hidden daemon" — the precise interpretation

The canon forbids *undisclosed, unlimited, unkillable* background processes.
It does not forbid persistent, disclosed mission **state**. Corridor 0A is
transparent persistence: disclosed files, exact-string consent on every write,
a kill switch that is always legal, and read-only derivation everywhere else.
The **executor remains a human-driven session** (Claude Code or the operator)
that reads the sealed corridor state instead of chat history. A leased worker
process is explicitly out of scope (M6-adjacent; requires its own ADR + GO).

## What the lease is (and is not)

`time_budget_hours` and `repair_budget_per_slice` are **derived bookkeeping**:
`deriveCorridorStatus` flags `lease_expired` / `repair_budget_exceeded` and
raises `requires_human`. Nothing is killed, scheduled, or enforced at the
process level — there is no process. Failure never widens authority:
every over-budget condition converges to "stop and ask the human."

## Serialization note

Uses the shared legacy `consent-common` serializer (88 importers) —
deliberately NOT `bizra.canonical-json.v1`, whose adoption freeze
(CANONICAL-JSON-V1-0A) is still in force on this base. Migration is M5.2+
scope via the compatibility registry; corridor journals created before that
migration remain verifiable under the legacy algorithm.

## Out of scope (each needs its own slice + GO)

Worker/lease process execution · auto-merge (`merge_policy` values beyond
`checkpoint_required`) · dual local-model cells · corridor-driven CI
orchestration · One Pulse GUI event feed · capability-registry row
(on promotion, when a corridor carries its first real campaign).
