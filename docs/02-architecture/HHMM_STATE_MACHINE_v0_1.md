# HHMM State-Machine Kernel v0.1

- **Schema:** `bizra.dema.hhmm_state_machine.v0.1`
- **Live source of truth:** `packages/core/src/hhmm-state-machine.js` (a real, imported, tested kernel — not a daemon).
- **Status:** the first *live* framework kernel from the V2 audit's framework-maturity list (HHMM was previously `DESIGNED_NOT_LIVE`).

## What it is

A deterministic state-machine kernel that models the Node0/Dema **lifecycle** as explicit transitions over **observable evidence**. It is "HHMM-inspired" only in *shape* — states, emissions, and an inferred state with a confidence. It is **not** neural, **not** machine learning, and **not** learned probabilistic inference. The "hidden" aspect of an HHMM is represented honestly as `inferred_state_confidence`, a value read from a **fixed deterministic rule table** (`confidence_by_emission`), never estimated from data. `machine.learned_probabilistic_inference` is `false` and `verifyHhmmMachine` fails closed if that is ever flipped.

## Lifecycle states

`declared → preview → tested_preview → merge_ready → merged`, with three off-ramps: `gate_blocked` (a gate failed; recoverable on `ci_green`), `designed_not_live` (design-only; **cannot** promote to `merged`), and `rejected` (claim overreach). `merged`, `rejected`, and `designed_not_live` are terminal — any further observation fails closed.

## Emissions (observable evidence)

`code_anchor_present`, `tests_passed`, `check_passed`, `guidance_passed`, `ci_green`, `pr_merged` (lifecycle spine), and `gate_failed`, `claim_overreach`, `designed_only` (global off-ramps from any active state). An unknown or malformed observation fails closed with a `reason_code`.

## API

- `buildHhmmStateMachine({ states, transitions, emissions, initial_state })` → frozen machine (canonical Node0 lifecycle when called with no args).
- `classifyHhmmObservation({ machine, observation })` → `{ valid, observation, reason_code, confidence }`.
- `transitionHhmmState({ machine, current_state, observation })` → `{ valid, from, to, observation, reason_code, confidence }`.
- `runHhmmTrace({ machine, observations })` → `{ valid, initial_state, final_state, path, step_count, inferred_state_confidence, trace_hash }`. The `trace_hash` is `sha256` over the machine + observations + resulting path — deterministic and reproducible.
- `verifyHhmmMachine(machine)` → `{ valid, blocked_by }` (rejects unknown states, transition targets, emissions, non-false boundary, or an ML-inference overclaim).

## Boundary — what this is not

`boundary` is entirely `false`: no runtime execution, no autonomous loop, no self-modification, no file write, no model call, no network, no signing/key/mint, no PoI/token/reward, no MCP/A2A/federation. The kernel reads evidence and returns frozen verdicts — nothing else. Promoting the higher HHMM levels (full 3-level session/topic/turn modelling) to live remains a future slice.
