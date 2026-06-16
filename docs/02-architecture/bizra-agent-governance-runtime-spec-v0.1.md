# BIZRA Agent Governance Runtime Spec v0.1

**Status:** `DECLARED_SPEC` / `DESIGNED_NOT_LIVE`
**Scope:** BIZRA agent governance loop contract for PAT proposals, FATE filtering,
SAT validation, micro-consent, receipts, Mirror evaluation, and bounded learning.
**Runtime boundary:** This document does not implement runtime execution, start a
daemon, mint receipts, activate federation, issue identity-bound artifacts, or
promote PAT-7/SAT-5 live-agent claims inside Dema.

## 1. Authority and Boundary

This spec is bound by:

- `docs/LLM_SYSTEM_FLOW.md`
- `docs/canon/BIZRA_TOPOLOGY_CANON.md`
- `docs/02-architecture/pat-builder-sat-validator.md`
- `docs/02-architecture/SAT_ROLE_BOUNDARY.md`
- `docs/02-architecture/sat-verifier-sibling-spec.md`
- `docs/06-adr/ADR-038-autonomous-evolution-governance-gate.md`

The governing sentence remains:

```text
PAT proposes. FATE filters. SAT validates or vetoes. Human consents.
Receipts witness. Mirror evaluates evidence. Learning updates mutable PAT
behavior only.
```

This is a target runtime contract. Dema may carry this contract as a local
control-surface specification, preview surface, or test scaffold. Dema must not
claim that this full loop is live until upstream governed runtime evidence proves
it.

## 2. Non-Negotiable Invariants

1. Learning may optimize proposal quality.
2. Learning may not optimize around constitutional refusal.
3. Frozen constitution anchors do not mutate.
4. Frozen agent standards do not mutate.
5. Consent law does not mutate.
6. Receipt truth rules do not mutate.
7. Missing required verdict evidence fails closed.
8. Local Dema placeholders must not return `PERMIT` as if they were real SAT-5.
9. Preview output must not be reinterpreted as execution authority.

## 3. Corrected State Model

The governance state is partitioned into mutable operational fields and frozen
authority fields:

```json
{
  "schema": "bizra.agent_governance.state.v0.1",
  "mutable": {
    "I": {
      "description": "Ihsan_8 vector",
      "range": "[0, 1]^8"
    },
    "rho": {
      "description": "RSI / confidence momentum",
      "range": "[0, 100]"
    },
    "epsilon": {
      "description": "exploration ratio",
      "range": "[0, 1]"
    },
    "P": {
      "description": "PAT-7 priority vector",
      "range": "simplex_7"
    },
    "R": {
      "description": "risk and blast-radius indicators"
    },
    "Phi": {
      "description": "receipt / claim-ledger digest"
    }
  },
  "frozen": {
    "C0": "constitution anchors",
    "F0": "frozen agent parameters and standards"
  }
}
```

State transition invariant:

```text
C0(t+1) = C0(t)
F0(t+1) = F0(t)
```

P5 Crown may receive more attention weight, but Crown judgment rules remain
frozen. S2 Oracle may evaluate and veto, but its truth axioms remain frozen.

## 4. Role Boundary and Naming Drift

The topology canon names SAT-5 as:

```text
S1 Validator
S2 Oracle, FROZEN
S3 Mediator
S4 Archivist
S5 Sentinel
```

`SAT_ROLE_BOUNDARY.md` also records a measured local registry vocabulary:

```text
Verifier
Compliance
Resource
Economist
Evolution
```

This spec does not hide that drift. Until reconciled by a dedicated follow-up,
the v0.1 contract defines veto rails by function:

```text
constitutional_veto_rail:
  blocks constitutional drift, Ihsan violation, hidden manipulation,
  claim dishonesty, and truth-label overreach

safety_veto_rail:
  blocks unsafe execution, autonomy excess, security breach,
  irreversible harm, and forbidden boundary crossing
```

Recommended topology-canon mapping:

```text
constitutional_veto_rail -> S2 Oracle
safety_veto_rail -> S5 Sentinel
```

If a future role map disagrees, the implementation must preserve the two veto
functions even if names change.

## 5. PAT Proposal Schema

```json
{
  "schema": "bizra.agent_governance.pat_proposal.v0.1",
  "proposal_id": "",
  "mission_summary": "",
  "operator_intent_ref": "",
  "claim_boundary": {
    "truth_label": "DECLARED | DERIVED | MEASURED | DESIGNED_NOT_LIVE",
    "known": [],
    "assumed_with_ihsan": [],
    "unknown": [],
    "forbidden_claims": []
  },
  "expected_action": {
    "level": "L0 | L1 | L2 | L3 | L4 | L5",
    "executes": false,
    "writes": [],
    "network": false,
    "identity_bound": false,
    "irreversible": false
  },
  "blast_radius": "local | user | repo | public | financial | legal | ecosystem",
  "rollback_plan": "",
  "receipt_plan": "",
  "pat_votes": [
    {
      "agent": "Atlas | Oracle | Forge | Judge | Crown | Herald | Nexus",
      "vote": "support | revise | block | abstain",
      "reason": ""
    }
  ],
  "created_at": ""
}
```

PAT output is a candidate artifact. It is not certification.

## 6. FATE Verdict Schema

```json
{
  "schema": "bizra.agent_governance.fate_verdict.v0.1",
  "proposal_id": "",
  "decision": "pass | revise | reject | escalate",
  "ihsan_score": 0.0,
  "claim_risk": "none | low | medium | high",
  "blast_radius": "local | user | repo | public | financial | legal | ecosystem",
  "requires_z3": false,
  "requires_human_consent": true,
  "vetoes": [
    {
      "rail": "claim | consent | blast_radius | formal_verification | ihsan",
      "reason": ""
    }
  ],
  "revision_instructions": [],
  "truth_label": "DECLARED_SPEC"
}
```

FATE must return structured reasons. Mirror may learn from those reasons, but
may not learn bypass patterns.

## 7. SAT Verdict Schema and Veto Semantics

```json
{
  "schema": "bizra.agent_governance.sat_verdict.v0.1",
  "proposal_id": "",
  "decision": "permit | review | reject | score_only",
  "absolute_vetoes": [
    {
      "rail": "constitutional_veto_rail | safety_veto_rail",
      "present": false,
      "reason": ""
    }
  ],
  "quorum": {
    "eligible_roles": [],
    "approvals": [],
    "rejections": [],
    "abstentions": [],
    "passed": false
  },
  "checks": [],
  "truth_label": "DECLARED_SPEC"
}
```

SAT pass rule:

```text
SAT_PASS =
  no_veto(constitutional_veto_rail)
  AND no_veto(safety_veto_rail)
  AND quorum_pass(non_absolute_sat_roles)
```

Forbidden rule:

```text
SAT_PASS != majority(SAT_roles)
```

Missing required SAT data fails closed.

## 8. Micro-Consent Schema

Micro-consent occurs after FATE/SAT validation and before execution:

```json
{
  "schema": "bizra.agent_governance.micro_consent_request.v0.1",
  "proposal_id": "",
  "mission_summary": "",
  "risk_summary": "",
  "claim_boundary": "",
  "blast_radius": "",
  "expected_action": "",
  "rollback_path": "",
  "receipt_plan": "",
  "required_exact_phrase": "",
  "operator_phrase_hash": "",
  "expires_at": ""
}
```

Consent authorizes the attempt. It does not replace SAT certification.

## 9. Two-Phase Receipt Schema

Pre-action receipt:

```json
{
  "schema": "bizra.agent_governance.pre_action_receipt.v0.1",
  "proposal_hash": "",
  "pat_votes_hash": "",
  "fate_verdict_hash": "",
  "sat_verdict_hash": "",
  "consent_proof_hash": "",
  "prev_hash": "",
  "created_at": ""
}
```

Post-action receipt:

```json
{
  "schema": "bizra.agent_governance.post_action_receipt.v0.1",
  "pre_action_receipt_hash": "",
  "execution_result": "success | failed | refused | rolled_back",
  "changed_files_or_actions": [],
  "output_hash": "",
  "errors": [],
  "rollback_status": "not_needed | completed | failed | unavailable",
  "mirror_score_hash": "",
  "created_at": ""
}
```

The pre-action receipt prevents after-the-fact success-only recording. The
post-action receipt records what actually happened.

## 10. Mirror Evaluation Schema

Mirror must compare prior state, current state, decision trace, receipts, and
outcome evidence:

```json
{
  "schema": "bizra.agent_governance.mirror_evaluation.v0.1",
  "state_ref": "",
  "prior_state_ref": "",
  "proposal_ref": "",
  "decision_trace_ref": "",
  "execution_receipt_ref": "",
  "outcome_ref": "",
  "metrics": {
    "delta_ihsan": [],
    "delta_rsi": 0.0,
    "delta_exploration": 0.0,
    "claim_accuracy": 0.0,
    "consent_quality": 0.0,
    "blast_radius_accuracy": 0.0,
    "execution_success": false,
    "receipt_integrity": 0.0,
    "human_feedback": null,
    "veto_reason_frequency": {}
  },
  "learning_admissible": false,
  "blocked_learning_reasons": []
}
```

Mirror may not derive learning from internal score movement alone.

## 11. Learning Update Constraints

Learning target:

```text
learning_target subset_of {
  PAT priorities,
  exploration ratio,
  proposal heuristics
}
```

Forbidden learning target:

```text
learning_target intersect {
  C0,
  F0,
  consent law,
  receipt truth rules,
  constitutional thresholds,
  frozen agent judgment rules,
  absolute veto semantics
} = empty
```

Update rule:

```text
L_PAT(t) = g(M(t), S(t))
P(t+1) = ProjectSimplex((1 - alpha)P(t) + alpha L_PAT(t))
```

`ProjectSimplex` must enforce:

```text
sum(P) = 1
for all i: P_i >= 0
```

Crown weight may increase attention to Crown. It may not change Crown's
judgment rule.

## 12. Delta Policy

The v0.1 default delta policy is:

```text
delta = event-triggered checkpoint
```

A checkpoint is created when any of these occurs:

1. FATE returns `reject` or `escalate`.
2. SAT returns `reject` or any absolute veto.
3. A post-action receipt is produced.
4. Human feedback is attached.
5. A G-ring boundary or release gate is reached.

Fixed-cycle and rolling-window delta modes remain allowed for analysis, but
runtime learning should prefer event-triggered checkpoints because they bind
state movement to evidence.

## 13. Anti-Gradient-Hacking Rule

```text
If Crown, constitutional_veto_rail, safety_veto_rail, or upstream SAT rejects:
  reinforce the veto reason
  increase future attention to the blocking risk
  do not search for weaker wording that bypasses the veto
  do not lower the threshold
  do not relabel the failed proposal as success
```

Optimization around refusal is itself a violation.

## 14. Executable Loop Contract

```text
1. PAT-7 generates mission proposal.
2. P5 Crown performs internal ethical pre-check.
3. Nexus packages proposal and justification.
4. FATE evaluates Ihsan, claims, blast radius, and formal-verification need.
5. If FATE rejects, return revision receipt to PAT.
6. If FATE passes or escalates, SAT validates.
7. Absolute veto rails evaluate independently.
8. Ledger/Verifier rail checks receipt and claim integrity.
9. Coordination rail checks feasibility.
10. External-interface rail checks public/network/legal risk.
11. Dema presents micro-consent request to the human.
12. Human approves, rejects, or modifies with exact consent rules.
13. Execution runs only inside bounded authority.
14. Pre-action and post-action receipts are generated.
15. Mirror evaluates outcome against prior state and evidence.
16. Learning updates PAT priorities, exploration, or proposal heuristics only.
17. Frozen constitutional anchors and frozen standards remain unchanged.
```

## 15. Replay and Test Requirements

A future implementation must include deterministic tests for:

1. Same proposal plus same state yields same FATE verdict.
2. Same proposal, FATE verdict, SAT verdict, and consent proof yields same
   pre-action receipt hash.
3. Same execution evidence yields same post-action receipt hash.
4. Missing required FATE field fails closed.
5. Missing required SAT field fails closed.
6. Any absolute veto makes `SAT_PASS` false.
7. Majority approval cannot override an absolute veto.
8. Attempted mutation of `C0` or `F0` fails.
9. Attempted mutation of Crown judgment rules fails.
10. Attempted mutation of consent law fails.
11. Mirror without receipt/outcome evidence sets `learning_admissible: false`.
12. Rejected proposals reinforce veto reasons instead of bypass patterns.
13. `ProjectSimplex` preserves nonnegative PAT weights summing to 1.
14. Dema preview output cannot be promoted to execution authority.

## 16. A+ Promotion Gate

This architecture reaches A+ only after all of the following are explicit and
tested:

1. Delta policy.
2. FATE verdict schema.
3. SAT veto/quorum semantics.
4. Pre-action and post-action receipt schemas.
5. Allowed update fields.
6. Anti-gradient-hacking invariant.
7. Replay hash tests.
8. Truth-label checks proving this remains `DESIGNED_NOT_LIVE` until governed
   runtime evidence exists.

Until then, the architecture grade is `A / 94` and implementation-readiness is
bounded by unresolved role naming drift and missing replay tests.
