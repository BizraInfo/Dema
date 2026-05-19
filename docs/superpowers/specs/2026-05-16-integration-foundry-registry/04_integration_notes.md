# Phase 04 — Integration Notes

## SNR extraction

Signal:

- Every external "giant" (MCP, A2A, AHK, hooks, smart contracts, Telescript, OpenClaw-style control plane, Hermes-style messaging, Pi.dev-style onboarding, Agent-as-a-Service, Harberger/COST economics) carries one borrowable pattern that can be safely translated into an existing BIZRA primitive.
- A canonical registry of these translations is testable and fail-closed.
- The seven-line operating canon (`Observe → Extract → Translate → Consent+EffectCap → EvidenceChain → DEMA UX → Allow use`) reduces to one data shape per pattern.
- `current_status` restricted to `{PLANNED, PREVIEW, BLOCKED}` makes "what is approved for live use" answerable by inspection.
- `GateVerdict` + `MICRO_CONSENT_SHAPE` + `OPERATIONS` already exist on disk and provide the vocabulary; no new taxonomy is required at v0.

Noise:

- A `C0..C5` consent ladder appears in upstream artifacts but is not on disk; codifying it requires a separate ADR.
- A full runtime "Integration Foundry" pipeline (10 stages from Intake to Allow) belongs in `bizra-omega` per ADR-003, not in Dema.
- Pattern records that try to express enforcement (rather than declaration) belong to later phases.
- Bombastic naming ("Foundry", "Master verdict", "Operating law") is descriptive, not operative — kept out of the schema and the source comments.

## HHMM mapping

Use these phase states for the future runtime that consumes the registry:

```text
OBSERVE:
  parse the pattern record's source and extracted_peak

CLASSIFY:
  resolve bizra_binding.on_disk_anchor; verify the primitive exists today

CONSTRAIN:
  apply effects_declared / effects_denied and the boundary invariant

HANDOFF:
  prepare a typed request only after micro_consent_field_required is filled
  and sat_verdict_required is satisfied

VERIFY:
  emit each evidence_schemas_required as a receipt before any side effect

ALLOW:
  permit invocation only when current_status transitions PLANNED → PREVIEW → LIVE,
  and every preceding stage has a green proof
```

Illegal transitions:

- `OBSERVE → ALLOW` skipping any of CLASSIFY / CONSTRAIN / HANDOFF / VERIFY.
- `CLASSIFY → ALLOW` while `current_status` is `BLOCKED`.
- `HANDOFF → ALLOW` while any `evidence_schemas_required` entry has no minted receipt.
- `VERIFY → ALLOW` while `sat_verdict_required` is `REJECT`.
- Any transition that would set a `boundary` flag to `true` without a corresponding ADR.

## Risk decomposition (per upstream giant)

| Giant | Imported-authority risk if naively adopted | Mitigation in spec |
|---|---|---|
| MCP | Tool with `write`/`execute` invoked unconditionally; credential or RCE leak path. | Record declares `effects_declared = [read]`, `effects_denied = [write, execute, call]`; `sat_verdict_required = REVIEW` before any invocation. Reference: `arxiv.org/abs/2504.03767` (MCP safety audit). |
| A2A | Two agents implicitly transfer authority via message scope drift. | `authority_imported: false` in BOUNDARY; record's `bizra_binding` points at `sat_verdict` not at the message envelope itself. |
| AHK / AutoKey | Hotkey escalates from "preview" intent to shell execution. | Record declares `effects_denied = [write, execute, call]`; `current_status: PLANNED` until an EffectCap-bound shortcut runner exists. |
| Hooks | Hook chain runs arbitrary shell. | `current_status: BLOCKED`; explicit blocker on Companion Change #1 (audit-hook truncation lift) per ADR-007. |
| Smart contracts | On-chain settlement before any local proof. | Bind to `amana_contracts_preview` (local-JSON-only); `current_status: PREVIEW` is acceptable because the local primitive already exists and is `preview-only`. |
| Telescript | Code travels before proof. | "State may travel before code; proof must travel with state." Bind to `shared_urp_world_preview` which currently keeps every node in `ghost_hold`. |
| Pi.dev onboarding | First-run skips proof gates. | Bind to `node0_homebase_state_preview`; no proof gate is skippable because the preview emits no `LIVE` status. |
| OpenClaw-style | Hidden agent task lifecycle. | Bind to `process_value_preview` which already emits a `self_proactive_harness` block per call. |
| Hermes-style | Authority leaks via envelope routing. | Bind to `sat_verdict`; record declares zero side-effecting effects. |
| Agent-as-a-Service | Public API before URP pilot. | `current_status: BLOCKED` until URP pilot has been reached and proven. |
| Harberger/COST | Forced transfer or application to private memory. | Spec explicitly forbids: `effects_denied = [write, execute, call]`, `sat_verdict_required = REJECT` until ADR allows it, blocker enumerates "private memory must remain forever excluded". |

## Boundary integration

The new module must be added to `scripts/review/boundary-invariant-check.mjs`'s scan set (it lives in `packages/core/src/`, already covered by `PREVIEW_DIRS`). The 6 module-specific authority flags introduced by this spec must be added to the `AUTHORITY_FLAGS` allowlist:

```text
authority_imported
mcp_server_invoked
a2a_network_call_made
hook_executed
automation_run
contract_executed
```

Failure mode: if these flags are absent from `AUTHORITY_FLAGS` and any of them is set to `true` in any module, the lint will silently miss the violation. Test T-18 (boundary-invariant lint passes with the new module included) is the canary.

## Out-of-tree dependencies

This spec does **not** require:

- A live `bizra-cognition-gateway` (it lives in `bizra-data-lake` per ADR-003).
- A loaded local model.
- Any network reachability.
- `npm install` of any package (Dema runs with zero dependencies).
- Any read access to `~/.dema/` (the module is pure data; the test only reads `packages/` and `docs/`).
- Any operator-side memory canon (the spec references operator memory only via the file path string; no read occurs).

## What this spec carries forward to sibling specs

Each of the 5 sibling modules (`mcp-capability-descriptor-preview`, `a2a-message-envelope-preview`, `skill-manifest-preview`, `urp-resource-offer-preview`, `urp-carrying-cost-preview`) will need its own spec bundle. The shape inherits from this spec:

- 01_specification.md — scope, current facts, product objective, functional requirements, out-of-scope, acceptance criteria, references
- 02_pseudocode.md — module layout, constants, builder pseudocode, edge cases (handled by static data)
- 03_tdd_anchors.md — 12-20 test cases enumerated with assertions
- 04_integration_notes.md — SNR extraction, HHMM mapping, risk decomposition, boundary integration

The most useful first sibling is likely `urp-carrying-cost-preview`, because Harberger/COST is the riskiest pattern and benefits most from explicit "what is forbidden" enumeration before any runtime exists. The second-most-useful is `skill-manifest-preview`, because every other sibling module can reuse the skill-manifest shape for declaring its own surface.

## Acceptance signal

The spec is "well-integrated" when, at acceptance time, the following are all true:

- `node scripts/review/boundary-invariant-check.mjs` returns `ok=true, scanned=23, clean=23` (was 22 before the new module).
- `docs/TESTING.md` registers `tests/external-pattern-registry-preview.test.js`.
- `docs/INDEX.md` registers the new spec bundle under § Superpowers specs and plans.
- Every `on_disk_anchor` in the 11 pattern records points at a file that exists in the repo at this branch.
- No record has `current_status: LIVE`.
- The 7-line operating canon appears verbatim in the module source as a comment-block, restated as a `OPERATING_CANON` constant, and asserted in test T-03.

These signals taken together prove the spec passes through every line of the canon it claims to enforce: Observe (the giants are named), Extract (the peak is per-record), Translate (`bizra_binding` references a real primitive), Put behind Consent + EffectCap (`micro_consent_field_required` + `sat_verdict_required`), Record with EvidenceChain (`evidence_schemas_required`), Expose through DEMA UX (deferred to a later phase; the registry is the data feed for DEMA UX), Only then allow use (`current_status` cannot be `LIVE` in v0).
