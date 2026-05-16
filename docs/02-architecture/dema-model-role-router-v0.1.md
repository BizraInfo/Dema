# Dema Model Role Router v0.1

**Status:** DECLARED design (preview-only spec; no implementation yet).
**Date:** 2026-05-16
**Scope:** Specify an additive layer on top of `packages/models/src/model-routing.js` that maps each of the existing 6 model roles to a typed effects-boundary contract. Does NOT propose new roles, new schemas beyond one new preview envelope, prompt invocation, model execution, or replacement of the existing routing recommendations.

## Current facts (disk-verified)

- `packages/models/src/model-routing.js` (60 LOC) exports `buildRoutingRecommendations(providers)` which already returns a 6-role recommendation object:
  ```
  coding · governance · reasoning · fast · embedding · vision
  ```
  Each entry is `{model, source, reason}` or `null`.
- `packages/models/src/model-inventory.js` (233 LOC) exports `collectModelInventory({...})` which is the canonical inventory source the router consumes.
- CLI: `dema models` already wires inventory → format output. **No new CLI verb is needed for v0.1.**
- On this Node0 at 2026-05-16 11:16 GST: 12 models inventoried (7 Ollama · 0 LM Studio reachable · 5 local GGUF). `buildRoutingRecommendations` produces all 6 role recommendations from the Ollama set; `Routing hints` section in the formatted output is currently empty (formatter does not yet render the per-role recommendations).
- `docs/02-architecture/pat-builder-sat-validator.md` declares `GateVerdict: PERMIT | REJECT | REVIEW | SCORE_ONLY`.
- `packages/consent/src/consent-common.js` declares `MICRO_CONSENT_SHAPE = [mission_id, agent_id, resource_id, action, purpose, expires_at, commitment_hash]`.
- `packages/consent/src/consent-hash-preview.js` declares `OPERATIONS = {read, write, execute, call}`.
- `scripts/review/boundary-invariant-check.mjs` (commit `7e24611`) walks `packages/*/src/*-preview.js` and asserts 46 authority flags stay false.

## What the existing module does NOT carry

Per a read of `model-routing.js` lines 1-60, each role recommendation has only `{model, source, reason}`. There is no:

- `effects_declared` — what the model is permitted to be used for
- `effects_denied` — what the model must never be invoked for
- `consent_level_required` — which `MICRO_CONSENT_SHAPE` field must be filled before a PAT role consumes this model
- `sat_verdict_required` — which `GateVerdict` outcome unblocks invocation
- Any boundary section asserting `runtime: false`, `prompt_invoked: false`, etc.

This v0.1 spec adds those metadata fields as a new preview envelope, **additive** to the existing routing recommendations (does not replace them).

## Product objective

Take `buildRoutingRecommendations(providers)` output and produce a new preview envelope that emits, for each of the 6 existing roles:

1. The recommended model (passed through from the existing function)
2. Permitted effects (subset of `OPERATIONS`)
3. Denied effects (subset of `OPERATIONS`)
4. Required `MICRO_CONSENT_SHAPE` field (which `null` permitted)
5. Required `GateVerdict` (which `null` permitted for read-only roles)
6. Whether the model is `local_only` (true for all v0.1 entries)
7. Whether prompt execution may happen via this layer (false for all v0.1 entries)

## Functional requirements

### F-01 · Module exports

```
packages/models/src/model-role-router-preview.js

export const MODEL_ROLE_ROUTER_PREVIEW_SCHEMA = "bizra.dema.model_role_router_preview.v0.1";
export function buildModelRoleRouterPreview(providers)
```

### F-02 · Envelope shape

```
{
  schema:        "bizra.dema.model_role_router_preview.v0.1",
  mode:          "PREVIEW_ONLY",
  truth_label:   "DECLARED",
  roles:         { coding, governance, reasoning, fast, embedding, vision },
  role_count:    6,
  boundary:      { runtime, federation, mint, prompt_invoked, model_started, network_used, ... all false },
  note:          "Role router only. Does not invoke models. Does not start runtime. Does not mint."
}
```

### F-03 · Per-role record shape

Each entry under `roles` must be:

```
{
  role:                       string (one of: coding, governance, reasoning, fast, embedding, vision),
  recommendation:             {model, source, reason} or null  -- passed through from existing function
  effects_declared:           array of OPERATIONS subset
  effects_denied:             array of OPERATIONS subset
  consent_field_required:     one of MICRO_CONSENT_SHAPE entries or null
  sat_verdict_required:       one of GateVerdict values or null
  local_only:                 true                              -- invariant for v0.1
  prompt_invocation_allowed:  false                             -- invariant for v0.1
}
```

### F-04 · v0.1 per-role bindings (proposed)

| Role | effects_declared | effects_denied | consent_field | sat_verdict |
|---|---|---|---|---|
| `coding` | `[read]` | `[write, execute, call]` | `action` | `REVIEW` |
| `governance` | `[read]` | `[write, execute, call]` | `purpose` | `REVIEW` |
| `reasoning` | `[read]` | `[write, execute, call]` | `purpose` | `REVIEW` |
| `fast` | `[read]` | `[write, execute, call]` | `null` | `SCORE_ONLY` |
| `embedding` | `[read]` | `[write, execute, call]` | `resource_id` | `REVIEW` |
| `vision` | `[read]` | `[write, execute, call]` | `resource_id` | `REVIEW` |

Every role declares `effects_denied` strictly. None permits write/execute/call in v0.1.

### F-05 · Boundary invariants

The envelope's `boundary` must include all of these as `false`:

```
runtime, federation, mint, prompt_invoked, model_started, network_used,
authority_imported, hook_executed, contract_executed
```

The new module must pass `scripts/review/boundary-invariant-check.mjs` (the 9 keys above will need to be added to `AUTHORITY_FLAGS` allowlist before lint runs on the new file).

### F-06 · Determinism

`buildModelRoleRouterPreview(providers)` takes only the inventory `providers` object (already deterministic from `collectModelInventory`). Two calls with the same `providers` argument return deep-equal frozen objects with fresh references — matches existing preview-module contract.

### F-07 · No CLI verb added in v0.1

The existing `dema models` continues to render inventory. A future `dema models --roles --json` flag could expose the role-router envelope, but that is **out of scope** for this spec and requires a separate ADR + typed-GO.

## Out of scope

- Prompt invocation, model warm-up, or any network call to Ollama/LM Studio beyond what `collectModelInventory` already does
- New role taxonomy (the 6 existing role names are kept)
- Renaming `model-routing.js`
- New CLI verb or flag
- Cross-role policy (multi-model routing chains)
- Cost/latency budgets per role
- Role-to-PAT-agent assignment (a separate concern)

## Acceptance criteria

1. New file `packages/models/src/model-role-router-preview.js` compiles, exports `MODEL_ROLE_ROUTER_PREVIEW_SCHEMA` + `buildModelRoleRouterPreview`.
2. New file `tests/model-role-router-preview.test.js` with ≥ 10 TDD anchors covering: schema, mode, roles count, each role record shape, effects validity, consent-field validity, GateVerdict validity, boundary all-false, deterministic, fresh-object-per-call, pure-module imports, boundary-invariant lint passes with `modules_scanned = 24`.
3. `scripts/review/boundary-invariant-check.mjs` `AUTHORITY_FLAGS` allowlist updated with the 9 new flags.
4. `docs/TESTING.md` registers the new test file.
5. `npm test`, `npm run check`, `npm run llm:guidance`, `npm run release:readiness`, `git diff --check` all clean.

## References (canonical sources)

- `packages/models/src/model-routing.js` — existing role names
- `packages/models/src/model-inventory.js` — inventory source
- `packages/consent/src/consent-common.js` — MICRO_CONSENT_SHAPE
- `packages/consent/src/consent-hash-preview.js` — OPERATIONS enum
- `docs/02-architecture/pat-builder-sat-validator.md` — GateVerdict enum
- `scripts/review/boundary-invariant-check.mjs` — boundary lint
- `docs/02-architecture/dema-tui-onboarding-design.md` — the cockpit that consumes role-router output
- `docs/02-architecture/dema-ux-proof-harness.md` — criterion G (Local-LLM-as-resource)

## Operating law

```
The router declares roles and effects.
The router does not invoke models.
The router does not import authority.
Every role denies write, execute, and call in v0.1.
```
