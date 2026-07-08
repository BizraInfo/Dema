# NODE0-MATERIALIZATION-PULSE-E2E-PREVIEW-1A — Design

Date: 2026-07-08 · Status: approved (brainstorming) · Truth label: PREVIEW_ONLY

## Goal

Make the assembled Materialization Pulse **run**. After 12 preview slices built five tested
"stations" (sanitizer → plan-branch → FATE → claim-gate → pulse-receipt envelope + mind→Pulse
binding), nothing takes a real mission through them. This slice is the orchestrator that runs ONE
real local mission end-to-end — the Pulse spec's own acceptance test — with zero live execution.

## Approach (A, approved)

A **pure composition orchestrator** that runs the existing station kernels in sequence (imports their
`run/build` fns — no re-implementation), plus a **thin CLI** `dema mission run <file>` that reads one
real file read-only and feeds its sanitized text + a **built-in example mission** into the kernel.

## Units

1. `packages/core/src/node0-materialization-pulse-e2e-preview.js` — pure orchestrator kernel.
2. `dema mission run <file>` — subcommand on the existing `mission` command (ADR-012-clean).
3. `scripts/review/materialization-pulse-e2e-fixtures.mjs` — the built-in example mission (kept out of
   the scanned kernel because it names unsafe rejected branches).

## The chain (ordered)

```
rung 1  sanitize(file_text)      → input_safety{ sanitizer_receipt(hash), verdict }
rung 2  plan-branch(branches)    → plan{ plan_root(hash), rejected_branch_count }
rung 3  FATE(consent/boundary)   → fate{ verdict, authority_delta:0, mint_allowed:false }
rung 4  claim-gate(claims,evid)  → claim_binding{ claim_gate_receipt(hash), rejected, unknown } + claims_public_safe
rung 5  assemble #351 envelope   → SEALED or ABORTED Pulse receipt (binds all the above + niyyah + execution:preview)
```

Each rung → ladder entry `{ station, ok, verdict, content_hash, blocked_by[] }`.

## Atomicity (inherited from #351, not re-invented)

- sanitize ALLOWED → proceed; BLOCKED or QUARANTINED → abort @ rung 1 (only cleared input runs a mission).
- plan-branch not ok, or FATE = REJECT → abort at that rung.
- claim-gate with rejected public claims → NO abort; sets `claims_public_safe: false`.
- all gates pass → `pulse_status: sealed`; any block → `aborted`, chain stops, receipt records where + why.

## Output receipt

`{ schema, mission_id, ladder[], reached_station, pulse_status, pulse_receipt(#351 envelope),
final_verdict, content_hash, boundary(all-false), does_not_prove }`. `verify` re-derives the ladder +
re-runs the envelope check → a forged rung is rejected.

## Boundary

Kernel meta-boundary 8-key all-false; Pulse boundary 6-key all-false; authority_delta 0; mint_allowed
false; no model, network, or mint; CLI reads one file read-only.

## does_not_prove

Runs no live model, executes no real-world action, publishes/mints nothing. `sealed` means "the
assembled preview stations passed on this input," NOT "the mission was executed" or "the claims are true."

## Test matrix

clean→sealed(5 green) · injection→abort@1 · secret→abort@1(QUARANTINED) · unaccounted-branch→abort@2 ·
FATE REJECT→abort@3 · overclaim→sealed+claims_public_safe:false · deterministic hash · forged rung/
laundered authority→verify rejects · CLI on real temp file → ladder + exit code · purity + ≥84% branch.
