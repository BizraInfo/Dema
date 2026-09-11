# L2 Chained Micro-Loop 1A

**Slice:** `L2-CHAINED-MICRO-LOOP-1A`  
**Truth posture:** `IMPLEMENTED_CANDIDATE_NOT_YET_QUALIFIED`  
**Parent law:** ADR-049 — Earned-Autonomy Micro-Loop  
**Authority delta:** `0`

## Purpose

L2 is the next rung after the shipped L1 closed cycle. It composes multiple L1 micro-acts under one human-issued, attenuated capability-lease chain. It does not add a daemon, scheduler, executor, model judge, receipt spine, or competing authority mechanism.

```text
HUMAN-ISSUED GENESIS LEASE
        |
        v
attenuated derived lease
        |
        v
v0.2 authorityVerdict: capability + scope + expiry + blast + machine state
        |
        v
hard system chain ceiling (narrows only; caller cannot widen)
        |
        v
L1 act 1 -> judge-free verify -> seal receipt
        |
        v
re-verify authority + receipt chain
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

## Authority convergence

L1 predates the stronger Dema capability-lease attenuation contract and still accepts a small mechanical lease shape (`lease_id`, `scope_root`, `expires_at`, `budget_acts`). L2 does **not** accept that shape as authority.

Before any L1 call, L2 requires the modern v0.2 authority path:

```text
attenuated lease chain
    -> verifyLeaseChain() re-derives no-widening law
    -> authorityVerdict(... contract: v0.2 ...)
    -> ALLOW only
    -> one-act mechanical projection into L1
```

The mechanical projection exists only to drive the older L1 primitive after authority is already verified. It uses the verified leaf's chain hash, scope, and expiry and fixes `budget_acts: 1`. It therefore cannot outlive, outscope, or broaden the authority it projects.

A legacy/simple L1 lease supplied directly to L2 is refused as `modern_authority_required`.

## Chain-size ceiling is safety, not authority

The current lease contract bounds capability, scope, expiry, and blast radius. It does not carry an act-count field. L2 therefore does **not** invent a caller-controlled `budget_acts` authority dimension and does not overload blast radius to mean repetition count.

Instead, `L2_MAX_ACTS` is a fixed system safety ceiling. It can only narrow throughput. A caller may request fewer acts; no caller may raise the ceiling. Any future human-configurable act budget belongs in a separately versioned authority-contract slice rather than being smuggled into this conductor.

## Invariants

1. **Modern authority required.** A re-derived attenuated lease chain must reach `ALLOW` before any L1 state or mutation exists.
2. **Complete mediation.** Authority is re-rendered before every act; an earlier ALLOW never authorizes the next act by inertia.
3. **Hard chain ceiling.** More than `L2_MAX_ACTS` refuses before mutation, independent of caller preference.
4. **Same actuator.** Every effect is executed by the shipped `runL1Cycle`; L2 owns no executor.
5. **Same proof spine.** Every act extends the existing L1 receipt chain; L2 creates no second ledger.
6. **Judge-free verification only.** L1's verification-admission law remains load-bearing; L2 cannot override a self-certification refusal.
7. **Current authority, not stale preflight.** Expiry or machine-readiness changes at a later step halt at the verified prefix.
8. **Chain integrity between acts.** `verifyChain()` must remain valid after each committed act before the next act may begin.
9. **Authority monotonicity.** Parent result, child result, and every collected receipt must carry `authority_delta: 0`.
10. **Fail closed.** Empty/malformed act lists, duplicate act ids, forged/widened lease chains, invalid receipt history, scope/expiry failures, or modern-authority absence refuse unsafe continuation.

## Acceptance contract

The red-first test slice covers:

- two successful acts under one modern attenuated authority chain;
- a caller-unwidenable hard chain ceiling;
- act-two failure preserving act one while preventing act three;
- malformed/empty chains;
- self-certification refusal propagated from L1;
- expired modern authority refusing before act one;
- extension of existing L1 history instead of creation of a parallel receipt spine;
- legacy/simple L1 lease refusal at the L2 boundary;
- forged wider child lease refusal by re-derived attenuation law;
- authority monotonicity across result and receipts.

## Explicit nonclaims

This slice does **not** prove or activate:

- a resident/autonomous daemon;
- unattended scheduling;
- crash-safe L2 coordinator recovery between distinct L1 acts;
- a human-configurable act-count field in the authority contract;
- L3 attunement or authority widening;
- self-promoting skills/reflexes;
- model-based quality judgment;
- network, URP, federation, token, wallet, PoI, or economic settlement;
- Node0 closure;
- production readiness.

Each L1 child remains crash/recovery hardened on its own. L2 coordinator crash recovery is deliberately named as a later proof obligation rather than inferred from L1.

The candidate is not `MEASURED` merely because files exist. Exact-head tests and repository gates must execute before any truth promotion.

## Standing on giants

This slice applies established systems ideas without outsourcing BIZRA's synthesis to them:

- **Hoare:** preconditions/postconditions around each committed act;
- **Lamport:** monotonic history and failure-aware state transitions;
- **Saltzer & Schroeder:** least privilege and complete mediation at each act boundary;
- **Deming:** act -> verify -> decide feedback rather than open-loop execution;
- **Bitcoin-style append-only audit:** sealed history is extended, not silently rewritten;
- **Maturana/Varela:** recursive self-maintenance is admitted only where the system preserves its own constitutive constraints.

The BIZRA synthesis is the binding: one sovereign authority chain, many ultra-small independently verifiable commits, and no authority gained from success, failure, repetition, or model confidence.
