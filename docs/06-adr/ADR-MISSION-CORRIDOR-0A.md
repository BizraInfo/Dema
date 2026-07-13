# ADR-MISSION-CORRIDOR-0A — persistent mission control plane

- **Status:** Proposed (becomes Accepted only on authorized merge of the reconciled replacement draft; PR #382 remains open as historical provenance)
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
transparent persistence: disclosed files, root-bound consent on every write,
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

Uses **`bizra.canonical-json.v1`** directly: the corridor is a new
hash-bearing surface with no promoted legacy artifacts, so it adopts the
canonical contract from birth and is the **first registered consumer** under
the M5.1B policy (an explicit reviewed entry in
`CANONICAL_JSON_V1_REGISTERED_CONSUMERS`). Every persisted body (contract and
journal event) declares the identity triplet
`canonicalization_algorithm` / `hash_algorithm` / `text_encoding`, so future
verifiers never guess the byte contract. No legacy adapter is required —
no corridor format existed before this adoption.

## Consent provenance (recorded, not rewritten)

The original branch and draft PR were created by interpreting a general
"keep working step by step" continuation instruction as repository
authorization — broader than the exact-consent bar this repo holds itself to.
That defect is recorded here honestly: the implementation was retained as an
**unratified candidate**, and its repair, rebase, testing, and review were
then explicitly authorized by a scoped operator card (2026-07-11). Merge
authority was never assumed and remains a separate exact consent.

## S2 reconciliation (2026-07-13) — root-bound consent, fresh base

The stale remote branch of PR #382 predated the merged constitutional canon
(#385), the FDE re-derivation fix (#383), and the HHMM confidence fix (#384),
so the reviewed corridor delta was **replayed onto current main** on a fresh
branch — never force-pushed, never merged wholesale (authority card
`BIZRA-MISSION-CORRIDOR-RECONCILE-1A`; receipt
`docs/receipts/DEMA_MISSION_CORRIDOR_0A.md`).

One semantic upgrade rode the reconciliation, mandated by the card:
**`ROOT_BOUND_CONSENT_ENVELOPE_PREVIEW_REUSED`** — corridor writes no longer
accept an exact phrase alone. The existing
`packages/consent/src/root-bound-consent-envelope-preview.js` kernel (imported
**unmodified**) binds every START/STOP to mission id + contract hash +
capability scope + mission root + action class + nonce + expiry. The CLI is
two-step: first run derives and prints the **consent card**
(`consent_context_hash` + required phrase, nothing written); the operator then
re-runs with the phrase **and** the context commitment. A captured phrase
replayed against a changed contract, root, kind, nonce, or expiry fails
closed; consumed nonces live in an append-only disclosed ledger
(`$DEMA_HOME/missions/consent-nonces.jsonl`). This is a local preview
primitive, **not** a live global FATE runtime.

## Out of scope (each needs its own slice + GO)

Worker/lease process execution · auto-merge (`merge_policy` values beyond
`checkpoint_required`) · dual local-model cells · corridor-driven CI
orchestration · One Pulse GUI event feed · capability-registry row
(on promotion, when a corridor carries its first real campaign).
