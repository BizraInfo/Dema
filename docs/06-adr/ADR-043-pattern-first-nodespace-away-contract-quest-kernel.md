# ADR-043: Pattern-First Architecture for Node-Space, Away Contracts, and Quest Kernel

**Status:** Accepted

**Date:** 2026-07-03

**Decision makers:** Mumu (Mohamed Beshr)

**Slice:** ARCHITECTURE-ABSENCE-QUEST-NODESPACE-ADR-1A (docs only · no runtime change)

## Context

An external deep-research survey (2026-07-03, operator-supplied; its citations are
DECLARED, not independently verified here) examined game-engine replication, MMORPG
scaling, durable workflow engines, authorization systems, typed-signing standards, and
computer-use-agent evaluations. Its central finding converges with what this repo already
implements: **durable state must live in a deterministic, authoritative kernel; LLMs plan
and explain at the edge; agents remain bounded; every consequential act leaves a
verifiable receipt.** The same survey's agent-evaluation evidence (long-horizon
computer-use success rates far below professional reliability) argues against unattended
free-form autonomy today.

The repo screen of that survey (same date) concluded: **adopt the patterns, refuse the
dependency gravity.** Dema's proven strengths — zero runtime dependencies, pure kernels,
exact-string consent, fail-closed refusal, hash-chained receipts — must not be traded for
external stacks before separate proof gates.

This ADR records that direction as decision architecture. It changes no runtime behavior.

## Related decisions

- [ADR-001](ADR-001-dema-is-one-face.md) — Dema is the one product-facing surface
- [ADR-005](ADR-005-operator-actions-require-explicit-consent.md) — exact-string consent
- [ADR-018](ADR-018-model-broker-promotion-path.md) — localhost-only model invocation gates
- [ADR-042](ADR-042-operator-bridge-threat-model.md) — operator bridge trust boundary
- [`docs/canon/LAW_OF_ASSUMPTION.md`](../canon/LAW_OF_ASSUMPTION.md) — hypothesis boundary; V/D/A/U
- [`docs/CURRENT_LIMITS.md`](../CURRENT_LIMITS.md) — maturity ledger (unchanged by this ADR)

## Decision

### 1 · Kernel authority

The LLM is a planner, explainer, and negotiator at the edge — **never the source of
truth**. The deterministic kernel owns state, permissions, receipts, gates, timers, and
every irreversible-action boundary. Inventory, money, resource ownership, identity, and
activation state must never live only inside model memory or conversation context.

### 2 · Node-Space UX direction

BIZRA does not open as a chat. It opens as a **human node space**: a rendering of the
human node, devices, PAT-7, SAT-5, missions, resources, corpus, receipts, URP state, and
consent gates. GUI hosts (Tauri, Godot, Electron) are future host *options* evaluated by
their own ADRs; none is a current dependency. The existing CLI/TUI remains the shipped
surface.

### 3 · Away Contract grammar (PLANNED)

Away work — Dema acting while the operator is absent — is allowed only inside an explicit
bounded consent artifact. The contract grammar requires at minimum:

```text
operator · mission_scope · allowed_actions · forbidden_actions · expiry
risk_ceiling · data_scope · model_policy · commit_policy · push_policy
mobile_escalation_policy · stop_conditions · receipt_required
```

No hidden autonomy. No action outside the contract. Anything outside scope **blocks and
waits** (deny-by-default). This is grammar adoption only; no Away Contract engine exists
on disk today.

### 4 · Quest/Mission kernel (PLANNED)

Missions grow into durable, quest-like state machines with explicit states:

```text
DRAFT → OFFERED → ACCEPTED → PLANNED → EXECUTING
→ WAITING_FOR_WORLD | WAITING_FOR_CONSENT | ESCALATED
→ COMPLETED → VERIFIED | FAILED | EXPIRED → ARCHIVED
```

The implementation pattern is local, event-sourced, and receipt-backed — **not** Temporal
adoption. Temporal is a reference model for durable-history/deterministic-replay
semantics only.

### 5 · Bounded workers (the Telescript successor)

A modern "mobile agent" is a **capability-scoped worker**, not arbitrary roaming code.
Wasm/WASI/Spin are future reference patterns. Dema first expresses capability envelopes
as JSON manifests/receipts; execution remains host-governed and fail-closed.

### 6 · Authorization pattern

Cedar and Zanzibar are **reference models** for authorization grammar (explicit
principal/action/resource/context, allow/deny, contextual conditions). Dema does not
import the Cedar runtime. A Cedar-shaped policy preview may be defined later, labeled
`PREVIEW_ONLY`. Current enforcement remains: exact-string consent (`packages/fate`), FATE
gates, env hygiene, and the local review verifiers.

### 7 · Typed consent and receipts

EIP-712 (typed structured signing with domain separation) and W3C Verifiable Credentials
are **reference models**. Dema does not import Ethereum tooling. Typed-intent-shaped JSON
may be defined later, labeled `PREVIEW_ONLY`. The existing Ed25519 receipt signing and
sha256 hash-chain mechanisms remain authoritative until new proofs land.

### 8 · Reward/XP principle

Agent XP and rewards attach only to **verified receipts** (file hashes, state
transitions, test passes, human approvals, policy compliance, cryptographic
acknowledgements). No subjective reward. No token mint for unverified work. XP is
internal capability growth unless and until the PoI reward law is implemented behind its
own proof gates.

### 9 · Dependency refusal (current ring)

Explicitly refused as live dependencies for Node0's current ring:

| Refused now | Adopted instead |
| --- | --- |
| Temporal server | local event-sourced/receipt-backed pattern |
| Cedar runtime | Cedar-shaped grammar, exact-string consent enforcement |
| Ethereum signing stack (EIP-712 tooling, state channels) | typed-intent JSON shape · existing Ed25519/sha256 rails |
| Tauri/Electron/Godot implementation | Node-Space direction as spec only |
| Wasm/WASI execution | capability-envelope JSON manifests |
| A2A federation | Node0-local surfaces; federation stays PREVIEW_ONLY |

Reason: pattern adoption is safe now; dependency adoption requires its own ADR, tests,
threat model, and a same-slice `CURRENT_LIMITS.md` update.

## Non-claims

This ADR does **not**:

- implement Node-Space UI, Away Contracts, the Quest kernel, Wasm workers, or
  Cedar/EIP-712/VC surfaces;
- activate BIZRA or any node;
- mint, reward, or settle anything;
- prove unattended autonomy (the cited agent evaluations argue it is not yet
  trustworthy);
- change `docs/CURRENT_LIMITS.md` rows (nothing here is promoted to `MEASURED`).

## Consequences

- Future slices have a bound path: Away Contract spec → Quest kernel spec → Node-Space
  spec → pure kernels → host adapters — each behind its own tests and gates.
- Any PR that introduces one of the refused dependencies without a superseding ADR is a
  doctrine violation and should be blocked in review.
- The zero-dependency kernel remains the moat; external stacks must earn their way in
  with proofs, not promises.
