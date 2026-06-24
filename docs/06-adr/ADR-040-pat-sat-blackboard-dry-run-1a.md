# ADR-040 — PAT/SAT Blackboard Dry-Run (PAT-SAT-BLACKBOARD-DRY-RUN-1A)

- Status: Accepted
- Date: 2026-06-24
- Scope: Dema CLI / @bizra/dema-core preview surface

## Truth label

`PAT_SAT_BLACKBOARD_DRY_RUN_LOCAL_ONLY` — PREVIEW_ONLY. Coordination is
DESIGNED_NOT_LIVE. No agent runtime, model invocation, reward, token, PoI, or
federation arises from this surface.

## Context

The dual-loop design surfaces (ADR-era `agent-dual-loop-preview`, council and
mission previews) describe PAT and SAT as cooperating loops. There was no
deterministic, machine-checkable artifact showing *how* the two loops would
sequence shared-state writes under declared preconditions. Building a live
coordinator would cross the no-runtime invariant; an inspectable dry-run does
not.

A "blackboard" is a classic shared-state coordination pattern: knowledge
sources post entries when their preconditions are met. Modeling it as a pure
function of a `{pain, goal}` seed yields a replayable trace an operator can read
before any runtime is ever considered.

## Decision

Add a pure, deterministic kernel
`packages/core/src/pat-sat-blackboard-dry-run.js` exporting
`buildPatSatBlackboardDryRun({ pain, goal })` and
`verifyPatSatBlackboardDryRun(report)`.

- Eight fixed-priority knowledge sources, each contributing at most once:
  - PAT loop: `discover`, `draft`, `propose`, `self_critique`
  - SAT loop: `verify`, `gate`, `refuse_or_permit_preview`, `critique`
- A declared precondition dependency chain
  (`discover ← seed`; `draft ← discover`; `propose ← draft`;
  `self_critique ← propose`; `verify ← propose`; `gate ← verify`;
  `refuse_or_permit_preview ← gate`; `critique ← refuse_or_permit_preview`).
- A control loop that scans sources in fixed priority, picks the FIRST eligible
  (precondition true AND not yet posted), appends a board entry plus a
  coordination-trace step, and repeats until QUIESCENCE or
  `PAT_SAT_BLACKBOARD_MAX_STEPS` (32, a defensive halting guard not reached in
  normal runs — the chain quiesces after 8 posts).
- `final_state`: `BLOCKED_INTERVIEW_INCOMPLETE` (missing/empty pain or goal),
  `CAP_REACHED` (cap hit), or `QUIESCENT_CONSENT_READY` (chain quiesced).
- `preview_hash = sha256(stableStringify(envelope_without_preview_hash))`.
- A `dema agent-loop blackboard [--pain ...] [--goal ...] [--json]` subcommand
  under the already-registered `agent-loop` group (ADR-012; no new kebab
  command, no new `COMMAND_TABLE` entry).

The verifier re-derives the board, coordination trace, and preview hash from
`report.seed` and fails closed with specific reason codes
(`preview_hash_mismatch`, `board_relaundered`, `trace_mismatch`,
`boundary_not_all_false`, `truth_label_mismatch`).

## Consequence

Operators get a replayable, hash-bound view of how PAT/SAT *would* sequence
shared-state posts, without any live coordination. The verifier makes the
artifact tamper-evident: any mutation of board content, trace order, boundary,
or hash is detected. The surface stays inside the no-runtime invariant.

## Boundary (all-false)

The emitted `boundary` is the canonical preview boundary extended with three
dry-run-specific keys, all `false`:

- `live_coordination_performed: false`
- `agent_runtime_executed: false`
- `model_invoked: false`

Every boundary key is `false`. The envelope is deep-frozen.

## What this does NOT prove

- This is NOT a live PAT/SAT runtime.
- No agent executed.
- No model was invoked.
- No reward, token, PoI, or federation.
- Coordination is a DETERMINISTIC FUNCTION OF THE SEED, not emergent
  intelligence or RSI.
- Preconditions are declared scaffolding, not learned.
