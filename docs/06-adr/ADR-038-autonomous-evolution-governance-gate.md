# ADR-038 — Autonomous-Evolution Governance Gate (mission step 6)

- Status: ACCEPTED
- Date: 2026-06-13
- Scope: Dema CLI / Node0 public face

## Context

A governed mission sequence drove this work:

1. Verify external CI truth
2. Ratchet the claim corpus downward
3. Connect claims to knowledge objects
4. Extract large command surfaces safely
5. Increase reliability on critical paths
6. **Only then expand autonomous evolution** — _no evolution without governance_

Point 6 is the capstone. The governing rule is explicit: **autonomous
evolution (self-modifying behavior, autonomous deployment, federation, a live
token economy) may not be claimed or shipped live without passing a governance
chain.** This ADR records that the precondition is established and _mechanically
enforced_ — and that actual expansion of autonomy remains an operator-gated act,
not an automatic consequence of reaching this point.

## Decision

Autonomous-evolution-class capabilities are governed by the chain already built
and closed across steps 2–5, plus the pre-existing register cap:

| Gate                           | Enforces                                                                                                                                                               | Artifact                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Claim-register R4 cap          | capability-gated wording (`token`, `mint`, `reward`, `economic`, `federation`, `public_network`, `production`, `shariah`) cannot exceed `MECHANISM_VERIFIED_SYNTHETIC` | `scripts/claims/claim-register-check.mjs` (`isCapabilityGated`) |
| Corpus gate (baseline ratchet) | no NEW unlabeled claim enters the doc corpus                                                                                                                           | `scripts/claims/claim-corpus-gate.mjs`                          |
| Citation provenance            | every `[claim:ID]` resolves to a real register entry — _no provenance without a knowledge object_                                                                      | `claim-corpus-gate.mjs` (`verifyCitations`)                     |
| Claim-ledger precision         | overclaims (`first/only`, economic, benchmark, deployment, crypto) flag unless carrying a proof-state label                                                            | `scripts/claim-ledger-check.mjs`                                |
| Reliability guards             | the above fail **closed** on degraded register/baseline input                                                                                                          | `tests/claim-corpus-gate.test.js`                               |

The governance invariant for step 6 is locked against the _live_ register by
`tests/claim-register.test.js` → "evolution governance gate (mission step 6)":
no capability-gated claim may exceed `MECHANISM_VERIFIED_SYNTHETIC`.

As of this ADR the evolution-class claims sit at the floor:
`C-TOKEN-ECONOMY`, `C-FEDERATION`, `C-PRODUCTION-READY` = `DESIGNED`.

## Consequences

- Reaching point 6 means the **governance is in place**, not that autonomy is
  switched on. Promoting any evolution-class capability past
  `MECHANISM_VERIFIED_SYNTHETIC` requires `VERIFIED`/`MEASURED` evidence and is a
  deliberate, operator-gated act (a hard halt-gate: identity binding, shared-
  branch promotion, federation start).
- The loop is now closed: every later capability claim must carry a proof-state
  (step 3), every doc claim is gated (step 2), the critical gates fail closed
  (step 5), and the dispatcher decomposition (step 4) proceeds under unchanged
  behavioral invariants.
- "Status generated from state, never asserted" extends to evolution: the
  register and gates are the witness; this ADR points at them rather than
  re-asserting their state.
