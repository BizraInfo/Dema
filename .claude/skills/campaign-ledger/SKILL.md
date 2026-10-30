---
name: campaign-ledger
description: Build and verify a hash-chained campaign ledger (PREVIEW_ONLY) whose counters and status are derived from events. Explicit human invocation only.
allow_implicit_invocation: false
---

# Campaign ledger

**PREVIEW_ONLY · NOT ML · NOT runtime** — pure hash-chained kernel with zero I/O and no clock. Does not prove autonomous loop closure, model behavior, or external effect.

Capability: `NODE0_CAMPAIGN_LEDGER_PREVIEW_1A`.

## Invocation boundary (BIZRA invariant)

`allow_implicit_invocation: false`. This skill never runs on its own. A human
must name it with exact consent before it is used; tool availability, memory,
and prior approvals do not grant authority. There is no autonomous loop here.

## What the kernel does

- Pins the campaign contract (`campaign_id`, `goal`, `definition_of_done`, `authority_lease`) by hash.
- Hash-chains every event (`STATUS`, `MODEL_CALL`, `SERVICE_TRANSITION`, `OBSERVATION`, `RECEIPT`); each event carries `prev_hash` and a sealed `event_hash`.
- DERIVES `status`, `model_calls_used`, and `service_transitions_used` from events, so a reset counter, a widened lease, a rewritten or truncated history, or a terminal status resurrected without an amendment is rejected by `verifyCampaignLedger`.
- Keeps `authority_delta` at 0 and every `boundary` flag `false`.

## Procedure

```text
buildCampaignLedger({ campaign_id, goal, definition_of_done, authority_lease })
  → appendCampaignEvent(ledger, { kind: "STATUS" | "MODEL_CALL" | ... })
  → verifyCampaignLedger(ledger)  // { ok, reasons }
```

- `authority_lease.max_model_calls` and `authority_lease.max_service_transitions` must be non-negative integers; exceeding either budget fails `verify`.
- Every appended event must carry `authority_delta` 0; a non-zero delta is refused.
- A terminal status (`DOD_REACHED`, `WAITING_FOR_NEW_AUTHORITY`, `OUTWARD_BLOCKED`, `INWARD_BLOCKED`, `CONTRADICTION_OPEN`, `FAILED_SAFE`, `DEFERRED`) cannot be resurrected without `amendment_of`.

## Kernel (read before changing behavior)

- `packages/core/src/campaign-ledger.js`

## Boundaries (state in every report)

- A writer who rewrites the whole chain consistently is **NOT** detected; that needs an external seal this kernel does not provide.
- Does **not** prove: autonomous campaign execution, model invocation, network effect, file writes, or authority expansion. All `boundary` flags are `false` by construction.
