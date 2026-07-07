# Receipt: DEMA-SOCRATIC-CRITIC-PROCESS-SUPERVISION-PREVIEW-1A

Truth label: `DEMA_SOCRATIC_CRITIC_PREVIEW_MEASURED_REPO`.

## Slice

A **Socratic critic** for process supervision — the reasoning spine's middle layer:

```text
PAT proposes → Critic interrogates → SAT verifies → Receipt records
```

The critic does not ask "can we make this answer better?" It asks **"what would make this answer
false?"**. It raises question pressure on a proposed hypothesis *before* SAT verification, and never
grants authority, executes an action, or claims truth.

## The four Socratic gates (seven deterministic checks)

1. **Clarification** — what exactly is claimed? (vacuous claims refused)
2. **Constraint** — does the claim obey declared constraints (system law, consent, repo fact, policy)?
3. **Causal path** — can each intermediate cause→effect step be explained?
4. **Counterexample** — name one observation under which the claim is false.
5. **Falsification condition** — a falsifier must be stated.
6. **Uncertainty label** — certainty may not outrun evidence.
7. **Verified-vs-inferred split** — separate what is evidenced, inferred, and unknown.

## Hand-off status (never "verified" — that is SAT's word)

| Status | Trigger |
| --- | --- |
| `rejected_overclaim` | a declared constraint is violated, or certainty outruns evidence |
| `needs_revision` | the claim is vacuous |
| `blocked_by_missing_evidence` | no causal path, no falsifier, or no evidence |
| `ready_for_sat` | survives every gate — ready for SAT to verify (not yet verified) |

## Proof Contract

13 focused tests + the review gate. The critic output is content-addressed and carries
`grants_action: false`, `claims_truth: false`, `authority_delta: 0`, boundary all-false. `verify`
re-derives the body and rejects a `grants_action` tamper, an unknown status, and a vacuous boundary.

`npm run check` runs `dema-socratic-critic-process-supervision-preview-check.mjs`.

## What this proves

That a hypothesis can be interrogated deterministically and handed off with an honest status **before**
SAT — the process is supervised, not just the outcome.

## What this does NOT prove

It does **not** verify the claim (SAT's role), grant authority, execute an action, invoke a model, or
touch the network. `ready_for_sat` means *survived interrogation*, not *true*. No autonomous science
runtime, no agent activation, no URP, no mint, no federation.

## Commands

```bash
node --test tests/dema-socratic-critic-process-supervision-preview.test.js
node scripts/review/dema-socratic-critic-process-supervision-preview-check.mjs --json
npm run check
```
