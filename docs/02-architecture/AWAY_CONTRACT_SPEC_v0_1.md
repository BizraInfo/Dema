# Dema Away Contract Specification v0.1

**Truth label:** `AWAY_CONTRACT_DESIGNED_NOT_LIVE`
**Status:** Design spec · not implemented · not active
**Date:** 2026-07-03
**Slice:** AWAY-CONTRACT-SPEC-1A (docs only)
**Parent decision:** [ADR-043](../06-adr/ADR-043-pattern-first-nodespace-away-contract-quest-kernel.md)

---

## 1 · Problem

Users should not have to babysit agents. A trusted steward should be able to continue
bounded tasks while the human sleeps, rests, travels, or simply lives. Today that
continuation is either forbidden (everything halts when the operator leaves) or dishonest
(agents improvise beyond what was agreed). The system must **protect absence without
stealing authority**: the operator's rest must not cost them sovereignty.

## 2 · Principle

```text
Autonomy is allowed only when declared.
Unbounded autonomy is forbidden.
Everything outside the contract blocks and waits.
```

## 3 · Relation to ADR-043

ADR-043 adopted pattern-first architecture: authoritative zero-dependency kernel, LLM at
the edge, patterns over dependencies. This spec defines the first concrete Away Contract
grammar under that decision. It does **not** implement Cedar, EIP-712, Temporal, Wasm,
Tauri, or A2A — those remain reference models per ADR-043 §6–§9.

## 4 · Lifecycle

| State | Meaning | Allowed transitions | Forbidden transitions |
| --- | --- | --- | --- |
| `DRAFT` | Contract text exists; no authority | `REVIEWED`, `ARCHIVED` | any active/working state |
| `REVIEWED` | Operator has read the exact scope | `CONSENTED`, `DRAFT`, `ARCHIVED` | `ACTIVE` (consent missing) |
| `CONSENTED` | Exact-string consent recorded, hash-bound to contract body | `ACTIVE`, `REVOKED`, `EXPIRED` | skipping to `COMPLETED` |
| `ACTIVE` | Window open; no task currently running | `WORKING`, `PAUSED`, `ESCALATED`, `EXPIRED`, `REVOKED` | silent re-scope |
| `WORKING` | A bounded task inside `mission_scope` is executing | `ACTIVE`, `PAUSED`, `ESCALATED`, `COMPLETED`, `FAILED`, `EXPIRED`, `REVOKED` | acting outside scope (must block → `ESCALATED` or `PAUSED`) |
| `PAUSED` | Steward stopped at a boundary and waits | `ACTIVE`, `ESCALATED`, `EXPIRED`, `REVOKED` | resuming past the boundary unaided |
| `ESCALATED` | A stop condition or consent need fired; operator signal requested | `ACTIVE` (after operator answer), `REVOKED`, `EXPIRED`, `FAILED` | self-approving the escalation |
| `COMPLETED` | All in-scope work finished before expiry | `RECEIPTED` | reopening work under the same contract |
| `EXPIRED` | `time_window_or_expiry` reached | `RECEIPTED` | any further action |
| `REVOKED` | Operator withdrew authority mid-window | `RECEIPTED` | any further action |
| `FAILED` | A gate or stop condition ended the work unrecoverably | `RECEIPTED` | retrying without a new contract |
| `RECEIPTED` | Return receipt written and hash-bound | `ARCHIVED` | mutation of the receipt |
| `ARCHIVED` | Immutable record | — (terminal) | resurrection |

Every terminal path passes through `RECEIPTED`: no Away Contract ends without a receipt.

## 5 · Contract fields

| Field | Meaning |
| --- | --- |
| `operator_id` | The human sovereign granting the window |
| `node_id` | The node (machine) on which the contract runs |
| `mission_scope` | Exact bounded description of allowed work |
| `allowed_actions` | Explicit action-class allowlist (§6) |
| `forbidden_actions` | Explicit denials that override everything else |
| `data_scope` | Which paths/data may be read or written |
| `model_policy` | Whether/which local model calls are permitted |
| `tool_policy` | Which commands/tools are permitted |
| `commit_policy` | Whether local commits are permitted, and where |
| `push_policy` | Whether push is permitted (default: never) |
| `network_policy` | Whether any network egress is permitted (default: none) |
| `mobile_escalation_policy` | Which urgency levels (§9) may reach the operator's device |
| `risk_ceiling` | Maximum risk class; work above it blocks |
| `time_window_or_expiry` | Hard end of authority |
| `stop_conditions` | Conditions that force `PAUSED`/`ESCALATED` (§8) |
| `receipt_required` | Always true; the return receipt shape (§10) |
| `review_required_on_return` | What the operator must review before the next contract |

## 6 · Action policy

Action classes, each individually grantable:

```text
READ_ONLY · DOCS_ONLY · LOCAL_EDIT · TEST_ONLY · COMMIT_ALLOWED
PUSH_ALLOWED · MODEL_ALLOWED · NETWORK_ALLOWED
MOBILE_ESCALATION_ALLOWED · IRREVERSIBLE_ACTION
```

**Default: deny unless explicitly allowed.** An action class absent from
`allowed_actions` is denied. `forbidden_actions` wins over `allowed_actions` on conflict.
`IRREVERSIBLE_ACTION` may never be granted by an Away Contract alone — it always
requires a live, per-act, exact-string consent from the operator.

## 7 · Forbidden defaults

Forbidden unless explicitly authorized in the contract (and some — marked ⛔ — cannot be
authorized by an Away Contract at all under current canon):

```text
push · force push (⛔) · delete · move private files · export private data (⛔)
network send · model invocation · wallet action (⛔) · mint (⛔) · activation (⛔)
public URP registration (⛔) · credential access (⛔) · background daemon install (⛔)
dependency install
```

## 8 · Stop conditions

Any of the following forces `PAUSED` or `ESCALATED` — never silent continuation:

```text
unclear scope · unexpected file mutation · test failure · check failure
unknown command surface · git lock ambiguity · secret/key detection
private data boundary · model required but not authorized
network required but not authorized · push required but not authorized
operator consent required · risk score exceeds ceiling · time expiry reached
```

## 9 · Mobile escalation

Urgency levels (contract selects which are permitted):

| Level | Meaning |
| --- | --- |
| `LEVEL_0_NO_NOTIFY` | Work silently; report only in the return receipt |
| `LEVEL_1_SUMMARY_ONLY` | Batched summary at window end |
| `LEVEL_2_SOFT_NOTIFY` | Non-urgent notification; no answer required |
| `LEVEL_3_CONSENT_REQUIRED` | Work blocked; operator answer required to proceed |
| `LEVEL_4_URGENT_STOP_AND_ALERT` | Work stopped; operator alerted immediately |

Mobile is the **near-human bridge, not an authority replacement**: a notification never
substitutes for exact-string consent; it only carries the request and the answer.

## 10 · Receipt requirements

Every contract ends in a return receipt with at minimum:

```text
contract_id · contract_hash · operator_id · mission_scope
start_time · end_time · actions_attempted · actions_completed · actions_blocked
files_changed · commands_run · gates_run · commits_created
push_performed · model_invocation_performed · network_performed
stop_reason · open_questions · next_safe_action
```

Boolean attestation fields (`push_performed`, `model_invocation_performed`,
`network_performed`) are honest observations, never promises — same discipline as the
existing 16-key boundary objects.

## 11 · Policy-shaped preview

Labeled: `CEDAR_SHAPED_POLICY_PREVIEW_ONLY` · `NOT_PARSER_VERIFIED` ·
`NOT_ENFORCED_BY_CEDAR`

```text
// shape illustration only — no Cedar runtime exists in this repo
permit (
  principal == Steward::"dema",
  action in [Action::"docs_edit", Action::"test_run"],
  resource in Path::"docs/02-architecture/"
) when {
  context.contract_state == "WORKING" &&
  context.now < contract.expiry &&
  context.risk <= contract.risk_ceiling
};
forbid (principal, action, resource)
  unless { contract.allowed_actions.contains(action.class) };
```

## 12 · Typed-intent preview

Labeled: `EIP712_SHAPED_INTENT_PREVIEW_ONLY` · `OFF_CHAIN_PREVIEW_ONLY` ·
`NOT_ETHEREUM_SIGNED` · `NOT_WALLET_BOUND`

```json
{
  "domain": { "name": "DemaAwayContract", "version": "0.1", "node_id": "NODE0" },
  "primary_type": "AwayContractConsent",
  "message": {
    "contract_id": "away-2026-XX-XX-XXXX",
    "contract_hash": "sha256:<body-hash>",
    "operator_id": "<operator>",
    "expiry": "<iso8601>",
    "consent_phrase": "GO: <exact string bound to contract_hash>"
  }
}
```

Signing, if/when implemented, uses the repo's existing Ed25519 receipt rail — not a
wallet.

## 13 · XP and reward boundary

Agent XP may be proposed only from verified receipts. No subjective reward. No token
mint. No PoI reward until impact verification exists (per ADR-043 §8 and the PoI canon).

## 14 · Non-claims

This spec does **not**: implement Away Contracts · start a daemon · invoke models ·
authorize unattended work by itself · implement mobile notifications · implement Cedar ·
implement EIP-712 · implement Temporal · implement Wasm · activate BIZRA · mint ·
register public URP resources.

## 15 · Future slices

```text
AWAY-CONTRACT-SCHEMA-1A        contract JSON schema + fail-closed validator kernel
AWAY-CONTRACT-COMPILER-1A      plain-intent → contract draft (pure kernel)
AWAY-CONTRACT-VERIFY-1A        body-bound verify of contract + receipt
AWAY-CONTRACT-RECEIPT-1A       return-receipt writer under DEMA_HOME
AWAY-CONTRACT-CLI-DRAFT-1A     dema away draft (preview only)
AWAY-CONTRACT-CLI-START-PREVIEW-1A  dema away start --dry-run (no execution)
MOBILE-ESCALATION-SPEC-1A      urgency-level transport spec
QUEST-KERNEL-SPEC-1A           mission state machine spec (ADR-043 §4)
```

Spec first, schema second, compiler third. Each slice carries its own tests, gates, and
`CURRENT_LIMITS.md` row before any promotion.

## 16 · Canon sentences

> Dema may work while the human rests only inside an explicit Away Contract.
>
> The contract is not permission to improvise; it is permission to complete bounded work
> and stop at the boundary.
>
> The human remains sovereign in presence and absence.
