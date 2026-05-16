# Phase 01 — Specification

## Scope

Specify a single preview-only module: **External Pattern Registry Preview**. The module declares a canonical, frozen map from external giants (MCP, A2A, AHK/AutoKey, hooks, smart contracts, Telescript, Pi.dev-style onboarding, OpenClaw-style control plane, Hermes-style messaging, Agent-as-a-Service, Harberger/COST economics) to BIZRA-native primitives and their existing on-disk surfaces.

The module is **preview-only**. It does not invoke MCP servers, send A2A messages, register hooks, run automation, execute contracts, transfer state, settle economics, or grant authority. It emits a deterministic JSON snapshot only.

This spec covers one module. It does **not** cover the broader "Integration Foundry" runtime, the 5 sibling preview modules suggested by upstream artifacts (`mcp-capability-descriptor-preview`, `a2a-message-envelope-preview`, `skill-manifest-preview`, `urp-resource-offer-preview`, `urp-carrying-cost-preview`), or any consent-ladder taxonomy that does not already exist on disk.

## Current facts (disk-verified)

- `docs/02-architecture/pat-builder-sat-validator.md` (19 H2 sections) declares `GateVerdict: PERMIT | REJECT | REVIEW | SCORE_ONLY` as the SAT verdict surface; sovereign-bypass is the anti-pattern.
- `packages/consent/src/consent-planner.js` builds the canonical `consent_plan_preview.v0.1` envelope from `MICRO_CONSENT_SHAPE = [mission_id, agent_id, resource_id, action, purpose, expires_at, commitment_hash]`.
- `packages/consent/src/consent-hash-preview.js` provides `bizra.dema.consent_hash_table_preview.v0.1` with `RESOURCE_TYPES = {file, path, command, service}` and `OPERATIONS = {read, write, execute, call}`.
- `packages/verifier/src/evidence-chain-preview.js` provides `bizra.dema.evidence_chain_preview.v0.1` with chain semantics (`prev_hash`, `event_hash`, `GENESIS_SENTINEL`, `CHAIN_BOUNDARY_FALSE_FIELDS`).
- `packages/verifier/src/ihsan-floor-preview.js` provides `bizra.dema.ihsan_floor_preview.v0.1` with `DEFAULT_IHSAN_FLOOR = 0.95`.
- `packages/verifier/src/melae-preview.js` provides `bizra.dema.melae_gate_preview.v0.1` (MELAE truth labels).
- `packages/core/src/node0-homebase-state-preview.js` (committed `13f32c5`) declares PAT-7 + SAT-5 local preview registries.
- `packages/core/src/shared-urp-world-preview.js` (committed `13f32c5`) declares the locked shared-URP world surface with nodes 1-4 in `ghost_hold`.
- `scripts/review/boundary-invariant-check.mjs` (committed `7e24611`) walks every `packages/*/src/*-preview.js` and asserts no authority-flag-named key is set to `true`. The new module **must** pass this lint.
- `~/.claude/.../memory/project_giants_integration_map.md` (operator memory, 2026-05-11) documents 11 giants and the "BIZRA absorbs value, not identity" doctrine. This spec lifts the in-tree-testable subset of that operator canon into the repo.
- 7-line operating canon (Mumu, 2026-05-16): *Observe the giant. Extract the pattern. Translate into BIZRA primitive. Put behind consent + EffectCap. Record with EvidenceChain. Expose through DEMA UX. Only then allow use.*

## Product objective

Give every external pattern a single canonical record that answers, before any runtime touch:

1. **Source** — what external system / pattern is being borrowed
2. **Extracted peak** — what specific mechanism is the borrowable signal
3. **BIZRA binding** — which existing on-disk primitive owns the safe translation
4. **Required consent shape** — which entry of `MICRO_CONSENT_SHAPE` must be filled before invocation
5. **Authority boundary** — what effects the binding will and will not perform
6. **SAT verdict required** — which `GateVerdict` outcome must hold to permit use
7. **Evidence required** — which receipt schemas must be emitted before allowing use
8. **Current status** — one of `{PLANNED, PREVIEW, BLOCKED}` only (never `LIVE` in this version)
9. **Blocked-by list** — explicit list of pre-conditions still open

The module emits this record set deterministically. Two calls return deeply-equal frozen objects with fresh references (matching the established `*-preview.js` contract).

## Functional requirements

### F-01 · Module exports

The module must export:
- `EXTERNAL_PATTERN_REGISTRY_PREVIEW_SCHEMA` — const string `"bizra.dema.external_pattern_registry_preview.v0.1"`
- `buildExternalPatternRegistryPreview()` — builder returning the registry envelope

No other exports are required at v0.

### F-02 · Registry envelope shape

The envelope returned by the builder must contain:
- `schema` (string, const)
- `mode` (string, const `"PREVIEW_ONLY"`)
- `truth_label` (string, const `"DECLARED"`)
- `note` (string, "Borrow pattern, reject hidden authority.")
- `safety_principle` (string, "Authority is never imported. Only patterns are.")
- `patterns` (array, ≥ 8 entries, ≤ 16 entries)
- `boundary` (object, all authority flags false)
- `summary` (object, counts per status)

### F-03 · Pattern record shape

Each entry in `patterns[]` must be a frozen object with:
- `source` (string) — e.g. `"mcp"`, `"a2a"`, `"autohotkey"`, `"hooks"`, `"smart_contracts"`, `"telescript"`, `"pi_dev_onboarding"`, `"openclaw_control_plane"`, `"hermes_messaging"`, `"agent_as_a_service"`, `"harberger_cost"`
- `extracted_peak` (string) — one-sentence description of the borrowable mechanism
- `bizra_binding` (object) with:
  - `primitive` (string) — name of the existing on-disk primitive that owns the binding (e.g. `"consent_hash_table_preview"`, `"sat_verdict"`, `"evidence_chain_preview"`)
  - `on_disk_anchor` (string) — file path of the primitive's source on disk (must exist at spec-author time)
- `micro_consent_field_required` (string) — one of `MICRO_CONSENT_SHAPE` entries; `null` if not yet binding
- `sat_verdict_required` (string) — one of `{PERMIT, REJECT, REVIEW, SCORE_ONLY}` from `GateVerdict`
- `evidence_schemas_required` (array of strings) — schema names that must be emitted before use
- `effects_declared` (array of strings) — what the binding will do (subset of `consent-hash-preview` `OPERATIONS`)
- `effects_denied` (array of strings) — what the binding refuses to do
- `current_status` (string) — exactly one of `{"PLANNED", "PREVIEW", "BLOCKED"}`
- `blocked_by` (array of strings) — pre-conditions still open

### F-04 · Boundary invariant

The envelope's `boundary` object must include and set to `false`:
- `runtime`, `federation`, `mint`, `node_connection`, `economic_settlement`, `raw_data_exchange`, `authority_imported`, `mcp_server_invoked`, `a2a_network_call_made`, `hook_executed`, `automation_run`, `contract_executed`

The new module must pass `scripts/review/boundary-invariant-check.mjs` cleanly.

### F-05 · Status invariant

No entry may have `current_status = "LIVE"`. The status enum is intentionally restricted to `{PLANNED, PREVIEW, BLOCKED}` in this version. Promotion to `LIVE` requires a separate ADR + typed-GO + at least the four prior preview gates green.

### F-06 · Determinism

`buildExternalPatternRegistryPreview()` accepts no arguments. Two calls return objects that are `deepEqual` but `notEqual` (fresh references, deeply frozen). Matches the existing `consent-hash-preview` / `process-value-preview` / `node0-homebase-state-preview` contract.

### F-07 · Pure module

The module file must import only from Node built-ins that have no side effects (or no Node built-ins at all). The boundary-invariant lint must continue to pass with the new module included.

The corresponding test must contain an explicit static-import assertion (matching the pattern in `tests/node0-homebase-state-preview.test.js`): forbid `node:fs`, `node:http`, `node:net`, `node:child_process`.

## Out of scope

- **Implementation of the 5 sibling preview modules** (`mcp-capability-descriptor-preview`, `a2a-message-envelope-preview`, `skill-manifest-preview`, `urp-resource-offer-preview`, `urp-carrying-cost-preview`) — each requires its own spec.
- **Runtime Integration Foundry pipeline** — the 10-stage pipeline (Intake → Allow) suggested in upstream artifacts requires governed runtime + EvidenceChain minting, which Dema does not own (ADR-001, ADR-003).
- **`C0..C5` consent ladder** — the C-level taxonomy referenced in upstream artifacts is not on disk. This spec uses the existing `MICRO_CONSENT_SHAPE` fields + `GateVerdict` enum instead. A C-ladder, if desired, requires its own ADR.
- **Live promotion of any pattern** — `current_status: LIVE` is forbidden in v0 and is enforced by F-05.
- **MCP server invocation, A2A network calls, hook execution, contract execution, economic settlement** — all explicitly false in the boundary.
- **CLI verb wiring** — the module does not need a `dema integration ...` verb in v0. Programmatic consumers only.
- **Markdown rendering / DEMA UX** — out of scope for v0; DEMA UX exposure is a later phase.

## Acceptance criteria

1. `npm test` is green at HEAD + the new module + the new test file.
2. `node scripts/review/boundary-invariant-check.mjs` returns `ok: true` with `modules_scanned = 23` (was 22).
3. `npm run check`, `npm run llm:guidance`, `npm run release:readiness`, `git diff --check` all clean.
4. The new entry is added to `docs/TESTING.md` (matching the pattern this branch already established 3 times).
5. Every pattern record's `on_disk_anchor` field references a file path that exists at acceptance time.
6. Zero entries with `current_status = "LIVE"`.
7. The 7-line operating canon is restated at the head of the source module as a comment block (the only place comments are permitted in the file).

## References

- `docs/02-architecture/pat-builder-sat-validator.md` — GateVerdict source
- `packages/consent/src/consent-common.js` — MICRO_CONSENT_SHAPE source
- `packages/consent/src/consent-hash-preview.js` — RESOURCE_TYPES + OPERATIONS source
- `packages/verifier/src/evidence-chain-preview.js` — EvidenceChain schema source
- `packages/verifier/src/ihsan-floor-preview.js` — Ihsan floor source
- `packages/core/src/node0-homebase-state-preview.js` (this branch, commit `13f32c5`) — sibling preview-only module pattern to mirror
- `scripts/review/boundary-invariant-check.mjs` (this branch, commit `7e24611`) — lint the new module must pass
- `~/.claude/.../memory/project_giants_integration_map.md` — operator-side canon predecessor
