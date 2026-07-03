# Absence Steward Local Queue v0.1

**Truth label:** `ABSENCE_STEWARD_LOCAL_QUEUE_DESIGNED_NOT_LIVE`
**Status:** Design spec · not implemented · not active · no queue exists
**Date:** 2026-07-04
**Slice:** ABSENCE-STEWARD-LOCAL-QUEUE-DESIGN-1A (docs only)
**Parents:** [`ABSENCE_STEWARD_PREVIEW_v0_1.md`](ABSENCE_STEWARD_PREVIEW_v0_1.md) · [`ABSENCE_STEWARD_RETURN_REVIEW_v0_1.md`](ABSENCE_STEWARD_RETURN_REVIEW_v0_1.md) · [ADR-043](../06-adr/ADR-043-pattern-first-nodespace-away-contract-quest-kernel.md)
**Unlock evidence:** this design became legitimate only after readiness
(`ABSENCE_STEWARD_READINESS_1A`, capability #21) and return review
(`ABSENCE_STEWARD_RETURN_REVIEW_1A`, capability #22) were both measured —
per the return-review spec's exit criteria (§14) and the standing law:
*a system that can queue work before it can report back cleanly is not safe
enough.*

---

## 1 · Non-claims (read first)

This document is a design. It is **not**:

```text
not live · not implemented · not runtime · not a scheduler · not a daemon
not task execution · not dequeue-and-run · not model invocation · not network
not wallet · not mint · not public URP · not `dema away start` (does not exist)
not permission for anything
```

A queue item is a **proposal awaiting the human**, never work in flight.

## 2 · Definition

The Local Queue is the design for a future, local, contract-bound list of
**proposals**: things Dema *would suggest doing* inside a receipted Away
Contract's boundaries, prepared while the human is absent, and presented —
untouched and unexecuted — at return review. The queue holds intent, never
motion.

## 3 · Authority model

- Only the human approves, rejects, or executes anything — ever.
- Every queue item binds to one receipted contract by `contract_hash`; if the
  contract changes or expires, the whole queue bound to it is invalid.
- A queue item may only propose action classes present in the contract's
  `allowed_actions`, at or below its `risk_ceiling`.
- Never-grantable actions can never appear in a queue item — the same ⛔ set
  the schema validator already rejects.
- The queue cannot approve, reorder-and-hide, or consume itself.
- Effectful proposals always require live per-act exact consent at approval
  time — queue membership is not consent.

## 4 · Queue item shape (future)

```text
item_id · contract_id · contract_hash · proposed_action_class
description · prepared_inputs · risk_class · requires_live_consent (always true
for anything effectful) · created_at (declared, never clock-read) · status
item_hash (self-excluding, same discipline as every receipt)
```

## 5 · Item states (v0.1 vocabulary — no execution states exist)

```text
PROPOSED → HUMAN_APPROVED | HUMAN_REJECTED | WITHDRAWN | EXPIRED_WITH_CONTRACT
```

`EXECUTING`, `DONE`, and any work-completion state are **deliberately not in
this vocabulary** — exactly as the return-review spec withheld its completion
verdict. Execution states may only be defined by a future execution spec
behind its own proof gates.

## 6 · Forbidden behaviors (can never exist)

```text
AUTO_DEQUEUE · SELF_APPROVAL · EXECUTION_FROM_QUEUE · SILENT_REORDER
QUEUE_WITHOUT_CONTRACT · ITEM_ABOVE_RISK_CEILING · NEVER_GRANTABLE_ITEM
CONSENT_BY_MEMBERSHIP (being queued ≠ being approved)
```

## 7 · Relationship to the measured surfaces

- **Readiness (#21)** gates entry: items may only be proposed against a trio
  that derives `PREVIEW_READY`.
- **Return review (#22)** gates exit: every queue item must appear in the
  return review — approved, rejected, withdrawn, or expired — under
  `pending_human_decisions`. A queue item absent from review is a hidden
  action, which the review's first line forbids.
- The Away Contract ladder (#20) is unchanged; the queue adds no authority to
  it.

## 8 · Receipt strategy

Every queue mutation (propose, withdraw, human decision) must be receiptable
under DEMA_HOME with the established discipline: exact consent for writes,
self-excluding hashes, no overwrite, rejects before mkdir. Not implemented in
this slice.

## 9 · Future slices

```text
ABSENCE-STEWARD-QUEUE-SCHEMA-1A     item shape validator (pure, fail-closed)
ABSENCE-STEWARD-QUEUE-VERIFY-1A     body-bound item/queue verification
ABSENCE-STEWARD-QUEUE-RECEIPT-1A    consent-gated queue receipts
ABSENCE-STEWARD-QUEUE-CLI-1A        dema away queue (list/propose preview only)
RETURN-REVIEW-QUEUE-BINDING-1A      queue contents surface in dema away review
```

All remain `DESIGNED_NOT_LIVE` until separately promoted with code, tests,
gates, and a same-slice `CURRENT_LIMITS.md` update.

## 10 · Exit criteria before ANY execution design

```text
queue schema/verify/receipt/CLI measured · queue contents visible in return
review · human decision receipts measured · still no start surface
still no scheduler · still no daemon · CURRENT_LIMITS promoted honestly
```

Until every line holds, the queue — even once implemented — remains a list the
human reads, not a machine that moves.

## 11 · Canon sentence

> The queue remembers what Dema would ask; it never becomes the asking, and it
> never becomes the doing.
