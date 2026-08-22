# L2 Chained Micro-Loop 1A

**Slice:** `L2-CHAINED-MICRO-LOOP-1A`  
**Truth posture:** `IMPLEMENTED_CANDIDATE_NOT_YET_QUALIFIED`  
**Parent law:** ADR-049 — Earned-Autonomy Micro-Loop  
**Authority delta:** `0`

## Purpose

L2 is the next rung after the shipped L1 closed cycle. It composes multiple L1 micro-acts under one human-issued, scoped, expiring act budget. It does not add a daemon, scheduler, executor, model judge, receipt spine, or authority mechanism.

```text
ONE HUMAN-ISSUED ENVELOPE
        |
        v
preflight: scope + expiry + total act budget + existing chain integrity
        |
        v
L1 act 1 -> judge-free verify -> seal receipt
        |
        v
re-verify receipt chain
        |
        v
L1 act 2 -> judge-free verify -> seal receipt
        |
       ...
        |
        v
stop clean OR halt at the verified prefix
```

## Governing semantic: verified prefix

L2 is deliberately **not** an implicit multi-act transaction.

A successful L1 act has already changed reality, passed judge-free verification, and entered the receipt chain. If act `n+1` later refuses or fails, L2 preserves the already verified prefix `1..n`, refuses all later acts, and returns `HALTED_VERIFIED_PREFIX`.

This avoids inventing rollback authority across independently sealed history. If a caller needs compensation for an earlier act, that compensation must itself be a separately authorized and verified act.

## Invariants

1. **Budget admission before mutation.** `lease.budget_acts` must cover the complete declared chain before act one begins.
2. **Same authority spine.** Every act is executed by the shipped `runL1Cycle`; L2 owns no actuator.
3. **Same proof spine.** Every act extends the existing L1 receipt chain; L2 creates no second ledger.
4. **Judge-free verification only.** L1's verification-admission law remains load-bearing; L2 cannot override a self-certification refusal.
5. **Current authority, not stale preflight.** The lease is re-presented to each L1 act with remaining budget and step time, so expiry during a chain halts rather than becoming reusable authority.
6. **Chain integrity between acts.** `verifyChain()` must remain valid after each committed act before the next act may begin.
7. **Authority monotonicity.** Parent result, child result, and every collected receipt must carry `authority_delta: 0`.
8. **Fail closed.** Empty/malformed act lists, duplicate act ids, invalid existing receipt history, scope/expiry failures, or insufficient budget refuse before unsafe continuation.

## Acceptance contract

The red-first test slice covers:

- two successful acts under one envelope;
- insufficient whole-chain budget refusing before any mutation;
- act-two failure preserving act one while preventing act three;
- malformed/empty chains;
- self-certification refusal propagated from L1;
- expired envelope refusal before act one;
- extension of an existing L1 history instead of creation of a parallel receipt spine;
- authority monotonicity across result and receipts.

## Explicit nonclaims

This slice does **not** prove or activate:

- a resident/autonomous daemon;
- unattended scheduling;
- L3 attunement or authority widening;
- self-promoting skills/reflexes;
- model-based quality judgment;
- network, URP, federation, token, wallet, PoI, or economic settlement;
- Node0 closure;
- production readiness.

The candidate is not `MEASURED` merely because files exist. Exact-head tests and repository gates must execute before any truth promotion.

## Standing on giants

This slice applies established systems ideas without outsourcing BIZRA's claim of novelty to them:

- **Hoare:** preconditions/postconditions around each committed act;
- **Lamport:** monotonic history and failure-aware state transitions;
- **Saltzer & Schroeder:** least privilege and complete mediation at each act boundary;
- **Deming:** act -> verify -> learn/decide feedback rather than open-loop execution;
- **Bitcoin-style append-only audit:** sealed history is extended, not silently rewritten;
- **Maturana/Varela:** recursive self-maintenance is admitted only where the system can preserve its own constitutive constraints.

The BIZRA synthesis is the binding: one human-issued envelope, many ultra-small independently verifiable commits, no authority gained from success or failure.
