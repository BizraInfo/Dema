# Absence Steward Return Review v0.1

**Truth label:** `ABSENCE_STEWARD_RETURN_REVIEW_DESIGNED_NOT_LIVE`
**Status:** Design spec · not implemented · not active · no runtime exists
**Date:** 2026-07-04
**Slice:** ABSENCE-STEWARD-RETURN-REVIEW-DESIGN-1A (docs only)
**Parents:** [`ABSENCE_STEWARD_PREVIEW_v0_1.md`](ABSENCE_STEWARD_PREVIEW_v0_1.md) · [ADR-043](../06-adr/ADR-043-pattern-first-nodespace-away-contract-quest-kernel.md) · [`docs/receipts/ABSENCE_STEWARD_READINESS_1A.md`](../receipts/ABSENCE_STEWARD_READINESS_1A.md)

---

## 1 · Non-claims (read first)

This document is a design. It is **not**:

```text
not live · not runtime · not a daemon · not a scheduler · not a queue
not task execution · not model invocation · not network · not wallet
not mint · not public URP · not `dema away start` (does not exist)
not proof that any work occurred
```

## 2 · Purpose

Return Review is the future human-facing review ceremony after a bounded
absence period. Before any queue or work design is allowed, the system must be
able to answer these questions honestly:

```text
What contract was active?      What was allowed?        What was refused?
What expired?                  What changed?            What requires my decision?
What receipts exist?           What did Dema NOT do?
```

## 3 · Authority model

- The human returns as the authority; the review exists to serve their return.
- Dema **reports, never self-approves**.
- Every claim must cite a receipt or say `NO_RECEIPT`.
- No hidden actions — a claim without a receipt pointer is a doctrine violation.
- No summary without raw receipt pointers behind it.
- No model-generated claim may ever be treated as proof.

## 4 · Required review fields (future report shape)

```text
schema · truth_label · operator_id · node_id · contract_id · contract_hash
absence_window · readiness_state_before_absence · readiness_state_after_absence
allowed_actions_declared · forbidden_actions_declared · refused_events
expired_items · pending_human_decisions · receipts_seen · receipts_missing
anomalies · model_invocations · network_events · wallet_events · token_events
boundary · final_verdict
```

## 5 · Boundary object

Every future return-review report must carry, and in v0.1 every key must be
**false**:

```text
steward_started · daemon_started · scheduler_started · task_executed
model_invoked · network_used · wallet_used · token_minted
public_urp_touched · auto_consent
```

## 6 · Verdicts

```text
NO_ABSENCE_RECORDED                 no contract/window to review
READY_BUT_NOT_STARTED               paper was in order; nothing ran (nothing can run)
EXPIRED_BEFORE_START                the window closed with no steward runtime in existence
RETURN_REVIEW_REQUIRED              review pending; nothing else may proceed
REVIEW_BLOCKED                      missing contract, hot boundary, or unexplained event
REVIEW_COMPLETE_NO_ACTIONS          review done; zero actions to account for
REVIEW_COMPLETE_WITH_PENDING_DECISIONS  review done; decisions await the human
```

`WORK_COMPLETE` is deliberately **not defined**. Work completion belongs to
future queue/execution slices that may not be designed until this review path
is real (§10).

## 7 · Required refusal language

- No receipts → **`NO_RECEIPT — cannot claim.`**
- No runtime → **`NOT_LIVE — no steward runtime exists.`**
- Asked *"what did you do while I was away?"* before runtime exists →
  **"Nothing executed. I can only report readiness and receipts."**

## 8 · Relationship to readiness

Readiness (`ABSENCE_STEWARD_READINESS_1A`, measured) says whether the paper is
in order. Return Review says what can be honestly reported after an absence
window. **Neither executes work. Neither starts stewardship.**

## 9 · Relationship to the future local queue

A local queue must **not** be designed or implemented until Return Review
exists (spec → check → kernel → CLI). Reason, verbatim founder law:

> A system that can queue work before it can report back cleanly is not safe
> enough.

## 10 · Receipt strategy

Future Return Review must be receipt-backed — candidate shape
`ABSENCE_STEWARD_RETURN_REVIEW_RECEIPT_v0_1` — but **this slice implements no
receipt**. The shape earns existence through its own red-first slice.

## 11 · Human UX

The first line of any future return review, always:

> "Nothing is hidden. Every claim below is either receipt-backed or marked
> NO_RECEIPT."

## 12 · Failure behavior

| Condition | Result |
| --- | --- |
| missing contract | `REVIEW_BLOCKED` |
| missing receipt for a claim | `NO_RECEIPT` on that claim |
| expired contract | `EXPIRED_BEFORE_START` |
| any boundary flag true | `REVIEW_BLOCKED` |
| model/network/wallet/token event without allowed policy | `REVIEW_BLOCKED` |

## 13 · Future slices

```text
ABSENCE-STEWARD-RETURN-REVIEW-CHECK-1A    deterministic review gate
ABSENCE-STEWARD-RETURN-REVIEW-KERNEL-1A   pure derivation kernel
ABSENCE-STEWARD-RETURN-REVIEW-CLI-1A      report-only CLI
ABSENCE-STEWARD-LOCAL-QUEUE-DESIGN-1A     only after all of the above
```

## 14 · Exit criteria before queue design

```text
return-review spec exists (this file) · check gate exists · kernel exists
CLI exists · no hidden-action claims possible · every output cites receipts
or NO_RECEIPT · CURRENT_LIMITS marks return review truthfully
dema away start still nonexistent
```

## 15 · Canon sentence

> The steward's first duty on the human's return is not to show what it did —
> it is to prove what it did not do.
