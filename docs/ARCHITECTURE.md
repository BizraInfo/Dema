# Dema Architecture

Dema is the local-first product face for BIZRA Node0. It is intentionally small: a Node.js CLI, pure modules, local state, adapter boundaries, and receipt viewing.

## Core shape

```mermaid
flowchart TD
  CLI["apps/cli/src/index.js"] --> Core["packages/core"]
  CLI --> Installer["packages/installer"]
  CLI --> Adapter["packages/node-adapter"]
  CLI --> Receipts["packages/receipts"]
  CLI --> Consent["packages/consent"]
  CLI --> Mission["packages/mission"]
  CLI --> Models["packages/models"]
  Adapter --> Default["default blocked status"]
  Adapter --> Gateway["optional governed Node0 gateway"]
  Receipts --> Home["DEMA_HOME or ~/.dema"]
  Installer --> Home
  Core --> Preview["preview-only reports and plans"]
```

## Runtime boundary

```text
Dema CLI
-> local preview / status / consent draft
-> Node0 adapter
-> governed runtime outside this repo
-> local receipt handoff
-> Dema receipt viewer
```

Dema does not own dangerous execution. It talks to adapters. Adapters talk to governed runtime. Receipts decide what can be inspected after the fact.

## Command-to-surface map

| Command | Primary surface | Effect boundary |
|---|---|---|
| `dema welcome` | CLI shell text | No state change. |
| `dema onboard` | `packages/core/src/onboarding.js` | Preview-only guide; no state change. |
| `dema setup` | `packages/installer` | Creates local skeleton only. |
| `dema status`, `dema status:json` | `packages/node-adapter`, `packages/core/status.js` | Reads adapter status. |
| `dema state` | `packages/core/state.js` | Emits Node0 state preview JSON (`bizra.dema.node0_state.v0.1`, truth label `NODE0_LOCAL_SEED`); preview-only, no adapter call, no runtime. |
| `dema profiles` | `packages/core/profiles.js` | Emits Profile Foundation Preview (`bizra.dema.profile_foundation.v0.1`): UserProfile / PATProfile / SATProfile / MissionProfile / ContextCapsule. Preview-only; ContextCapsule includes whitelisted fields only (no raw conversation, no full evidence payload). |
| `dema consent-card` | `packages/core/consent-card-preview.js` | Emits Consent Card Preview (`bizra.dema.consent_card_preview.v0.1`): mission + PAT proposal + SAT-style verdict + allowed/blocked effects + decision options. Required blocked effects (runtime, federation, mint, Node1/2 connection, raw scan, public network) are pinned non-overrideable; caller can ADD blocks but never REMOVE. SAT verdict status pinned `policy_preview`. Receipt preview status `not_minted`. Preview-only, deep-frozen, exhaustively-false boundary. |
| `dema mission-loop` | `packages/core/mission-loop-preview.js` | Emits Mission Loop Preview (`bizra.dema.mission_loop_preview.v0.1`): pure composition of `state` + `profiles` + `consent-card` plus 3 new lifecycle fields (local_model_invocation · evidence_chain_event · receipt_preview). `preview_lifecycle_status` pinned `HOLD` regardless of consent decision; `lifecycle_phase` derives from inputs across 6 canonical phases (ready · needs_pat_proposal · awaiting_consent · narrowing_scope · complete_preview_declined · complete_preview_approved). `routing_allowed`/`chain_advance`/`receipt_minted` pinned false. No runtime, no model invocation, no chain advance, no receipt mint. |
| `dema evidence-event` | `packages/core/evidence-chain-event-preview.js` | Emits EvidenceChain Event Preview (`bizra.dema.evidence_chain_event_preview.v0.1`): proof-instrumentation layer between lifecycle and runtime. Takes a mission_loop_preview snapshot as input; emits prepared (never recorded) event. Canonical `event_status` values: `not_prepared` (loop not in approved phase) or `prepared_not_recorded` (approved phase reached, event structured but not on chain). Status `recorded` is intentionally unreachable. `chain_advance` and `receipt_mint` pinned false. Payload policy: `raw_payload_included=false`, `hash_only=true`. evidence_refs stripped to {id, schema, content_hash:null}. |
| `dema llm-router` | `packages/core/local-llm-router-preview.js` | Emits Local LLM Router Preview (`bizra.dema.local_llm_router_preview.v0.1`): declarative-only routing layer. Inventory + role_map for 5 canonical roles (mission_intent_parse, pat_proposal_draft, consent_phrase_generate, evidence_summary, abstain_or_unknown). `routing_allowed=false` pinned at top level, per-model, and per-role. `invocation_status` pinned `not_invoked_preview_only`. Model status pinned `declared_preview_only` regardless of caller-claimed status. ABSTAIN is the universal fallback. Consent boundary declares `routing_requires=typed_GO_plus_chain_advance`. No model load, no prompt execution, no external call, no raw corpus scan, no tool execution. |
| `dema process-mining` (with `--summary`) | `packages/core/src/process-mining-preview.js` | Emits Process Mining Preview (`bizra.dema.process_mining_preview.v0.1`): L1.5 operator-pattern mirror. Surfaces `ring_advancement_status` + `next_step_observable` (always `_observable` suffix · never imperative). `blocked_effects` explicitly includes `operator_judgment` (the miner does NOT judge). `self_critique.this_preview_offers_a_mirror=true` invariant. Adversarial filters drop non-primitive metric values silently. Deterministic given identical input. Summary variant collapses metrics to counts. |
| `dema models scan` (with `--summary`) | `packages/core/src/local-model-inventory-scan.js` | C1.5 per [ADR-008](06-adr/ADR-008-runtime-activation.md): Local Model Inventory Scan. Emits `bizra.dema.local_model_inventory.v0.1` with canonical 16-key boundary, truth_label `LOCALHOST_READ_ONLY_SCAN`. Wraps existing `collectModelInventory` and adds HuggingFace cache scanner (`~/.cache/huggingface/hub`), `/data/bizra` secondary root scanner, per-record `file_type` and `usable_for` augmentation. All inference fields (usable_for) are naming-based hints, never claimed verified — A-grade per Key Maker V/D/A/U discipline. |
| `dema llm-invoke` (with `--model NAME --prompt TEXT`, `--invoke --consent`, and `--summary`) | `packages/core/src/llm-adapter.js` | C1 per [ADR-008](06-adr/ADR-008-runtime-activation.md): Local LLM Adapter. Preview emits `bizra.dema.llm_invocation_preview.v0.1` with canonical 16-key boundary all-false. `--invoke` flag with exact-string consent phrase (per [ADR-005](06-adr/ADR-005-operator-actions-require-explicit-consent.md)) calls Ollama at localhost. Result emits `bizra.dema.llm_invocation_result.v0.1` with `effects_observed` reflecting what flipped. Model whitelist (llama, qwen, mistral, mixtral, gemma, phi, deepseek, embed families). Localhost-bound by default (caller cannot redirect to non-localhost). Failure modes are schema-tagged (timeout, network_error, http_status_N, response_not_json, consent_phrase_mismatch, model_not_in_whitelist, prompt_empty, prompt_too_long, endpoint_not_localhost). 24 tests including mocked Ollama responses and abort-aware timeout. |
| `dema key-maker-check` (with `--door "<text>"` and `--summary`) | `packages/core/src/key-maker-compliance.js` | Emits Key Maker Compliance Envelope (`bizra.dema.key_maker_compliance.v0.1`): bridges canon → code from [Key Maker Epistemic Conduct v0.1](02-architecture/key-maker-epistemic-conduct-v0.1.md). Self-audits reasoning shape against 5 invariants: assumption_declaration · certainty_mapping · constructive_reading · opposing_view_search · boundary_marker. Emits `overall_compliant` + `failed_invariants` array. Fails closed when canon violated. `key_types` filter rejects non-canonical entries (8 canonical: question/map/mirror/bridge/boundary_marker/lens/lantern/silence). `micro_consent.mutation_authorized` pinned false at builder level. |
| `dema today` | `packages/core/today.js` | Records local continuity, not runtime pulse. |
| `dema doctor` | CLI readiness predicates | Exits nonzero when safety gates fail. |
| `dema ambient`, `dema ambient:json` | `packages/core/src/ambient.js` | Preview-only boundary report. |
| `dema diagnostics plan` | diagnostics plan surface | Preview-only; does not run checks. |
| `dema consent plan` | `packages/consent` | Drafts micro-consent; does not approve. |
| `dema mission draft` | `packages/mission` | Drafts intent; does not execute. |
| `dema mission propose` | `packages/core/mission.js` + FATE | Previews ARTIFACT-011 readiness only. |
| `dema receipts` | `packages/receipts` | Reads local receipt files. |
| `dema memory`, `dema memory show` | `packages/memory` | Reads local memory/profile entries only. |
| `dema models` | `packages/models` | Inventories local model surfaces; no inference. |
| `dema report safety` | safety report surface | Preview-only; not certification. |
| `dema network blueprint` | `packages/core/src/network-blueprint.js` | Node1/Node2 and phase-gated readiness preview only; no sockets, handshakes, or federation. |
| `dema network fixture preview` | `packages/core/src/network-fixture-preview.js` | Offline 5-slot schematic only; 0 live nodes, no sockets, no mint. |
| `dema network refusal preview` | `packages/core/src/network-refusal-matrix-preview.js` | Partition/rejoin refusal matrix preview only; no sockets, no simulation, no mint. |
| `dema amana contracts preview` | `packages/core/src/amana-contracts-preview.js` | Registry preview only; no external code import, execution, mint, or Step 7 unlock. |
| `dema mcp blueprint` | `packages/core/src/mcp-blueprint.js` | MCP integration contract only; no MCP tool call or credential access. |
| `dema roadmap preview` | `packages/core/src/optimization-roadmap.js` | Advisory roadmap only; no execution or gate enforcement. |
| `dema evidence receipt preview` | `packages/verifier/src/evidence-receipt-preview.js` | Receipt-shaped preview only; no mint, signature, chain advance, or write. |
| `dema ihsan floor preview` | `packages/verifier/src/ihsan-floor-preview.js` | Externally supplied scalar check only; no certification or runtime gate. |
| `dema behavior modulation preview` | `packages/core/src/behavioral-modulation.js` | Visible reversible guidance preview under exact consent; applies no behavior change. |
| `dema design emulate-loop` | `packages/core/src/loop-emulator.js` | Design emulation only; no agents, runtime, receipts, or local writes. |
| `dema task` | `packages/tasks` + verifier placeholder | Lists or runs registered local tasks behind autonomy gates. |
| `dema sovereign` | `~/.dema/kernel/sovereign_tui/sovereign.py` | View-only local scaffold render; no daemon or federation. |
| `dema monetize` | CLI shell text | Proof-safe offer boundary; no token, reward, or economic mint. |

## Professional blueprint surfaces

Dema includes professional management, DevOps, and QA blueprint surfaces for planning only:

- `dema mcp blueprint` describes MCP integration boundaries, validation, retry, and redaction expectations without calling tools or accessing credentials.
- `dema amana contracts preview` classifies Amana-adjacent contract primitives, current overlap, import risk, and proof gates without importing external snapshot code or unblocking Step 7.
- `dema roadmap preview` organizes advisory architecture, security, performance, documentation, DevOps, QA, and ethics work without executing tasks or enforcing gates.
- `dema evidence receipt preview` demonstrates canonical hashing and placeholder verification without minting receipts, signing payloads, or advancing a chain.
- `dema ihsan floor preview` checks an externally supplied scalar against the floor without claiming canonical scoring, certification, or SAT admissibility.
- `dema behavior modulation preview` models visible, reversible guidance modulation under exact consent while rejecting covert persuasion, manipulation, and other unsafe shaping.
- `npm run release:readiness` reports release risks and launch blockers without deployment, certification, runtime execution, or token/economic claims.

## Behavioral modulation preview

Dema can model a consent-bound behavioral modulation as a preview artifact. This means a visible, reversible change to guidance behavior, such as tone, prioritization, safety-boundary emphasis, interface guidance, or recommendation style.

The preview is gated by exact local consent, rejects covert or manipulative shaping, and links to a no-mint evidence receipt preview. It does not record approval, change runtime behavior, mint receipts, bind identity, or certify SAT admissibility.

See [02-architecture/behavioral-modulation-preview.md](02-architecture/behavioral-modulation-preview.md).

## Local state

All Dema-managed local state lives under:

```text
DEMA_HOME
```

or, by default:

```text
~/.dema/
```

Expected layout:

```text
~/.dema/
  profile.json
  config.local.json
  receipts/
  memory/
  logs/
  skills/
```

No hidden state location should be introduced.

## Adapter model

The default developer-machine state is blocked. If no Node0 adapter is connected, Dema should say so clearly instead of pretending readiness.

The current adapter path can shell out through `DEMA_NODE0_STATUS_COMMAND`; ADR-003 points the longer-term path toward the `bizra-cognition-gateway` HTTP surface inside the wider BIZRA substrate.

Adapter input is untrusted. Normalization must coerce values and preserve unknowns safely.

## Consent model

Consent is exact, narrow, and action-specific.

`dema consent plan` may produce a proposed scope and commitment hash, but that is not approval. `dema mission propose` may check the exact bounded-diagnostic phrase, but it still returns preview behavior in this repo.

## Receipt model

Dema reads receipts from local files. The governed runtime path creates receipt handoffs. This distinction is binding:

```text
Dema lists and shows.
Governed runtime issues.
```

## Node1 / Node2 and multi-node boundary

`dema network blueprint` is a readiness map only. `dema network fixture preview`
is an offline 5-slot schematic only: it reports 0 live nodes, 0 sockets, unnamed
phase slots, micro-compliance controls, micro-consent requirements, and inert
scenario shapes. `dema network refusal preview` renders a paper truth-table
refusal matrix for partition, rejoin, stale receipt, missing micro-consent, and
schema mismatch shapes. These commands may describe future Node1/Node2 handoff
contracts and canonical phase_3/phase_4 directions, but they must not:

- connect nodes,
- open sockets,
- perform a handshake,
- start federation,
- issue identity artifacts,
- mint receipts,
- execute runtime work.

## Engineering constraints

- Node.js >=20.
- ESM modules.
- Zero runtime dependencies.
- No build step.
- No npm workspaces.
- Package imports use relative paths.
- Tests use `node:test`.

## Verification commands

```bash
npm test
npm run check
npm run release:readiness
git diff --check
```

Docs-only changes should still keep these commands true unless explicitly documented otherwise.
