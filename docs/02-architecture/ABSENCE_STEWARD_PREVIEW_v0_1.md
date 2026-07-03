# Absence Steward Preview v0.1

**Truth label:** `ABSENCE_STEWARD_PREVIEW_DESIGNED_NOT_LIVE`
**Status:** Design spec · not implemented · not active · no runtime exists
**Date:** 2026-07-04
**Slice:** ABSENCE-STEWARD-PREVIEW-1A (docs only)
**Parents:** [ADR-043](../06-adr/ADR-043-pattern-first-nodespace-away-contract-quest-kernel.md) · [`AWAY_CONTRACT_SPEC_v0_1.md`](AWAY_CONTRACT_SPEC_v0_1.md) · [`docs/receipts/AWAY_CONTRACT_1A.md`](../receipts/AWAY_CONTRACT_1A.md)

---

## 1 · Non-claims (read first)

This document is a design. It is **not**:

```text
not live · not a daemon · not unattended execution · not model invocation
not network · not mobile notification · not wallet · not mint
not public URP · not `dema away start` (which does not exist)
```

Nothing in this spec runs. Nothing in this spec authorizes running.

## 2 · Definition

Absence Steward Preview is the design for a **future local mode** in which Dema
may hold a bounded, receipted Away Contract, maintain local state about it, and
**prepare next actions for human review** while the human is absent. Preparing
is composing proposals and receipts — never executing them.

## 3 · Authority model

- The human remains the sole authority, in presence and absence.
- The Away Contract bounds the mission; nothing outside it is legal.
- Dema may operate only inside declared permissions (deny-by-default).
- Live execution of anything requires future proof gates that do not exist yet.
- Every state transition must be receiptable.
- Model output, if ever permitted, is proposal — never authority.

## 4 · State machine preview (states only — no code exists)

```text
NOT_CONFIGURED → CONTRACT_DRAFTED → CONTRACT_VERIFIED → RECEIPT_RECORDED
→ PREVIEW_READY ⇄ PAUSED → RETURN_REVIEW_REQUIRED → (archive)
any state → EXPIRED (expiry reached) · any state → REFUSED (boundary hit)
```

| State | Meaning |
| --- | --- |
| `NOT_CONFIGURED` | No receipted contract exists |
| `CONTRACT_DRAFTED` | `dema away draft` produced a body |
| `CONTRACT_VERIFIED` | `dema away verify` bound the body |
| `RECEIPT_RECORDED` | `dema away receipt` recorded exact consent |
| `PREVIEW_READY` | A receipted contract could be stewarded — readiness only |
| `PAUSED` | A stop condition fired; waiting |
| `RETURN_REVIEW_REQUIRED` | Human is back; review before anything else |
| `EXPIRED` | Contract window ended; only review remains |
| `REFUSED` | A boundary was hit; refusal receipted |

## 5 · Forbidden states (can never exist)

```text
RUNNING_UNBOUNDED · SILENT_DAEMON · AUTO_CONSENT
MODEL_AUTHORITY · NETWORK_FREE · WALLET_ACTIVE
```

A design or PR that introduces any of these is a doctrine violation under
ADR-043 §9 and the Law of Assumption's hypothesis boundary.

## 6 · Transition table (legal transitions only)

| From | To | Required artifact | Required consent | Allowed side effect | Receipt | On failure |
| --- | --- | --- | --- | --- | --- | --- |
| NOT_CONFIGURED | CONTRACT_DRAFTED | intent JSON | none (draft is read-only) | none | none | fail closed, exit 1 |
| CONTRACT_DRAFTED | CONTRACT_VERIFIED | contract + validation files | none (verify is read-only) | none | none | REFUSED |
| CONTRACT_VERIFIED | RECEIPT_RECORDED | verify verdict | exact phrase `GO: write away-contract receipt <id> <hash12>` | one receipt file under disclosed home | required | reject before mkdir |
| RECEIPT_RECORDED | PREVIEW_READY | receipted contract | none (readiness is a read-only report) | none | readiness report (future) | REFUSED |
| PREVIEW_READY | PAUSED | stop-condition observation | none | none | pause receipt (future) | REFUSED |
| PAUSED | PREVIEW_READY | operator answer | operator signal | none | resume receipt (future) | stays PAUSED |
| PREVIEW_READY / PAUSED | RETURN_REVIEW_REQUIRED | human return | none | none | return-review receipt (future) | REFUSED |
| any | EXPIRED | `expires_at` ≤ act-time | none | none | expiry receipt (future) | — |
| any | REFUSED | boundary violation detected | none | none | refusal receipt (future) | — |

No transition executes work. Every "future" receipt shape requires its own
slice, tests, and gates before existing.

## 7 · Preview-only CLI concept (future)

A future command `dema away preview` may inspect a receipted contract and
report readiness (`PREVIEW_READY` or the blocking reason). It must not start
work, must not loop, must not schedule, and must exit after reporting.

**`dema away start` remains nonexistent.** Its unknown-subcommand refusal is a
tested behavior and stays that way until a separate spec-only slice
(`ABSENCE-STEWARD-START-SPEC-ONLY-1A`) is written, gated, and consented.

## 8 · Human return contract

On return, Dema must show — before anything else is offered:

```text
contract id + hash · what was allowed · what was refused
what expired · what needs review · no hidden actions (provably: receipts only)
```

## 9 · Model policy

In preview v0.1: **no model invocation, period.** Future model participation
requires all of: explicit `model_policy: "allowed"` in the receipted contract ·
local-first routing (ADR-018 gates) · a receipt per invocation · human review
of every proposal · and a separate proof gate promoting the surface.

## 10 · Mobile policy

In preview v0.1: **no mobile notification implementation.** Mobile is a future
escalation surface (spec'd levels LEVEL_0–LEVEL_4 in the Away Contract spec §9)
and is never an authority channel — a notification can carry a question, never
an approval.

## 11 · Security posture

```text
no keys held by or exposed to any model · no wallet access
no network by default · no public URP · no token / no mint
no unsupervised mutation — every write is consent-gated and receipted
```

## 12 · Relationship to the Away Contract ladder

The Away Contract ladder (AWAY_CONTRACT_1A, capability #20) is the
**prerequisite** and is unchanged by this spec. Absence Steward Preview
consumes **receipted contracts only** as design input. The ladder's boundaries
(never-grantable actions, exact consent, body-bound verification, disclosed
receipt home) are inherited, not renegotiated.

## 13 · Future slices

```text
ABSENCE-STEWARD-PREVIEW-CHECK-1A        deterministic readiness gate (read-only)
AWAY-CONTRACT-READINESS-CLI-1A          dema away preview (report only)
ABSENCE-STEWARD-LOCAL-QUEUE-DESIGN-1A   proposal queue design (no execution)
ABSENCE-STEWARD-RETURN-REVIEW-DESIGN-1A return-review receipt design
ABSENCE-STEWARD-START-SPEC-ONLY-1A      start semantics, spec only
```

All remain `DESIGNED_NOT_LIVE` until separately promoted with code, tests,
gates, and a same-slice `CURRENT_LIMITS.md` update.

## 14 · Exit criteria — what must exist before ANY live mode

```text
preview gate green · readiness CLI shipped · return-review receipt shipped
stop/expiry gate shipped · local-only model policy gate shipped
explicit operator consent per activation · no default daemon anywhere
fail-closed tests for every path · CURRENT_LIMITS promoted honestly
capability registry entry only after measured proof
```

Until every line above is true, "Dema works while you rest" remains a design
sentence, and Dema must say so when asked.

## 15 · Canon sentence

> The steward earns absence the same way it earned presence: one receipt at a
> time, never past the boundary, never without the human's word.
