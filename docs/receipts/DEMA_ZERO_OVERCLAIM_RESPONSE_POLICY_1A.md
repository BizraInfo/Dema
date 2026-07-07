# Receipt: DEMA-ZERO-OVERCLAIM-RESPONSE-POLICY-1A

Truth label: `DEMA_ZERO_OVERCLAIM_POLICY_MEASURED_REPO`.

## Slice

The **answer discipline** — "seal the mouth" after the critic. A deterministic policy that classifies
each claim in a response, enforces an honest label, and refuses to let an unsupported, current,
high-stakes, invented, or authority-inflating claim leave the system as if verified.

```text
PAT proposes → Critic interrogates → SAT verifies → Receipt records
                                     └── Zero-overclaim policy gates what may be SAID ──┘
```

## Per-claim classification → enforced label

| Classification | Label |
| --- | --- |
| `verified_fact` (fact + evidence) | `VERIFIED` |
| `grounded_inference` | `INFERRED` |
| `speculation` | `SPECULATIVE` |
| `unverifiable` (fact, no evidence) | `UNVERIFIED` |
| `current_requires_verification` (time-sensitive, no evidence) | `BLOCKED_PENDING_EVIDENCE` |
| `high_stakes_requires_verification` (legal/medical/financial/security, no evidence) | `BLOCKED_PENDING_EVIDENCE` |

## Hand-off status

- `cleared_to_respond` — every claim carries an honest label; nothing blocked or rejected.
- `blocked_pending_evidence` — a current or high-stakes claim needs verification first.
- `rejected_overclaim` — an invented source, an inference/speculation presented as VERIFIED, an
  authority inflation (`grants_action:true` / `authority_delta>0`), or `claims_truth` without a
  verified claim.

## Proof Contract

14 focused tests + review gate. Content-addressed and stable; `grants_action:false`,
`claims_truth:false`, `authority_delta:0`, boundary all-false. `verify` rejects a `grants_action`
tamper and a vacuous boundary.

`npm run check` runs `dema-zero-overclaim-response-policy-check.mjs`.

## What this proves

That responses can be disciplined deterministically: honest labels enforced, overclaim blocked,
invented sources and authority inflation refused — before an answer is allowed to leave.

## What this does NOT prove

It does **not** verify a claim's truth, fetch evidence, invoke a model, or touch the network. It
enforces labeling and blocks overclaim; it cannot confirm a fact — only refuse to let an unproven one
ship as if proven. No daemon, no URP, no mint, no federation, no wallet.

## Commands

```bash
node --test tests/dema-zero-overclaim-response-policy.test.js
node scripts/review/dema-zero-overclaim-response-policy-check.mjs --json
npm run check
```
