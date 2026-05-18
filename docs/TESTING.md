# Dema Testing and Quality Matrix

This repo uses native Node.js tests and CLI smoke checks. The goal is behavior coverage: every public safety boundary should have a replayable local check.

## Commands

Run the full local gate:

```bash
npm test
npm run coverage
npm run check
npm run llm:guidance
npm run release:readiness
git diff --check
```

Run one test file:

```bash
node --test tests/status.test.js
```

Run one test name pattern:

```bash
node --test --test-name-pattern="bounded diagnostic" tests/status.test.js
```

## Test surfaces

| Test file | Surface covered |
|---|---|
| `tests/status.test.js` | Status formatting, readiness, setup idempotency, mission proposal, receipts, CLI basics. |
| `tests/active-kernel-banner.test.js` | Active-kernel banner, gateway probe, shell tokenization. |
| `tests/active-kernel-cli.test.js` | Bare CLI, task registry, task command, sovereign error path, executable bin. |
| `tests/ambient.test.js` | Ambient boundary report and preview-only constraints. |
| `tests/amana-contracts-preview.test.js` | Amana contract registry preview, external-code exclusion, path overlap, CLI output, and Step 7 blocked posture. |
| `tests/approval-gate.test.js` | Approval gate and exact-consent safety behavior. |
| `tests/behavioral-modulation.test.js` | Consent-bound visible guidance modulation preview, forbidden shaping rejection, evidence linkage, and CLI output. |
| `tests/consent-hash-preview.test.js` | ConsentHashTable preview hashing, exact lookup, revocation, expiry, no-authority boundary, and pure-module scope. |
| `tests/consent-planner.test.js` | Micro-consent planning, permission extraction, unsafe file filtering, JSON/human CLI output. |
| `tests/corpus-benchmark-schema-preview.test.js` | Corpus benchmark schema preview for metadata-only evaluation contracts, SNR/SAPE/Proof-of-Truth axes, D3/D4 eval-only quarantine/rejection, raw-content rejection, and no-runtime boundary. |
| `tests/corpus-data-tier-classifier-preview.test.js` | Corpus data-tier classifier preview for D0-D4 metadata-only signal classification, D3/D4 quarantine, raw-content rejection, no ingestion/upload/tuning/memory mutation/node sharing, and no-runtime boundary. |
| `tests/corpus-eval-scorecard-preview.test.js` | Corpus eval scorecard preview for aggregate metadata-only metric slots, Proof-of-Truth axes, no score computation, D3/D4 quarantine metric limitation, raw-content rejection, and no-runtime boundary. |
| `tests/corpus-gold-label-fixture-preview.test.js` | Corpus gold-label fixture preview for metadata-only rubric slots, D3/D4 no-label guards, ownership-not-consent boundary, raw-content rejection, and no-runtime boundary. |
| `tests/corpus-manual-review-queue-preview.test.js` | Corpus manual review queue preview for sanitized local metadata candidate prioritization, non-actionable D3/D4 lanes, ownership-not-consent boundary, raw-content rejection, and no-runtime boundary. |
| `tests/corpus-preview-index.test.js` | Corpus preview index integration across all corpus preview surfaces, schema compatibility, child boundary closure, ownership-not-consent boundary, no CLI wiring, and no-runtime boundary. |
| `tests/corpus-redaction-fixture-preview.test.js` | Corpus redaction fixture preview for metadata-only D0-D4 handling markers, D3 quarantine, D4 rejection, raw-content rejection, no real redaction, and no-runtime boundary. |
| `tests/corpus-scorecard-receipt-schema-preview.test.js` | Corpus scorecard receipt schema preview for future evidence field slots, required-field guards, no hash/seal computation, no receipt minting, raw-content rejection, and no-runtime boundary. |
| `tests/diagnostics-plan.test.js` | Self-diagnostics preview plan and non-execution boundary. |
| `tests/downloads-audit-preview.test.js` | Read-only downloads audit task, task receipt, placeholder SAT verdict formatting. |
| `tests/evidence-chain-preview.test.js` | EvidenceChain pure preview linking, receipt-domain rejection, tamper checks, no-authority formatting, and no-CLI wiring boundary. |
| `tests/evidence-receipt-preview.test.js` | No-mint evidence receipt preview hashing, boundary, and tamper checks. |
| `tests/gateway-http-adapter.test.js` | Gateway adapter probing and failure normalization. |
| `tests/actuator-check.test.js` | Raw actuator and EffectCap invariant static guard behavior. |
| `tests/canon-check.test.js` | Topology canon registry and forbidden topology drift guard. |
| `tests/effectcap-invariant.test.js` | Pre-runtime EffectCap invariant spec and negative tests. |
| `tests/integration-check.test.js` | CLI help, smoke gate, architecture map, and test-matrix integration guard. |
| `tests/ihsan-floor-preview.test.js` | Ihsan floor preview scalar validation, non-certifying boundary, formatter, and CLI output. |
| `tests/llm-guidance-check.test.js` | Canonical LLM flow guidance, root agent routing, and docs noise classification. |
| `tests/loop-emulator.test.js` | PAT/SAT loop design emulation preview, determinism, and no-runtime boundary. |
| `tests/melae-preview.test.js` | MELAE/SAPE preview scoring, fail-closed probe validation, SNR/Ihsan floor gates, and no-runtime boundary. |
| `tests/memory.test.js` | Local memory/profile reading and safe missing-state behavior. |
| `tests/model-corpus-manifest-preview.test.js` | Model corpus manifest preview for Node0 multi-model conversation assets, no raw ingestion/upload/tuning/memory mutation/node sharing, source allowlist, data tiers, and fail-closed malformed manifests. |
| `tests/mission-draft.test.js` | Intent-to-mission draft conversion and consent preview embedding. |
| `tests/mcp-blueprint.test.js` | MCP integration blueprint, no-MCP-call boundary, credential handling, and deterministic output. |
| `tests/models.test.js` | Local model inventory and no-inference behavior. |
| `tests/network-blueprint.test.js` | Node1/Node2 and phase-gated multi-node blueprint gates, no-network behavior, boundary booleans, authorization-phrase safety, determinism, mutation isolation. |
| `tests/network-fixture-preview.test.js` | Offline 5-slot fixture preview, no-socket/no-mint boundary, micro-compliance, micro-consent, analogical model, and no invented node names. |
| `tests/network-refusal-matrix-preview.test.js` | Partition/rejoin refusal matrix preview, no-socket/no-mint boundary, computed self-proactive checks, micro-compliance, micro-consent, and no topology or authorization drift. |
| `tests/node0-local-urp-proof.test.js` | Local URP proof boundaries. |
| `tests/node0-self-check.test.js` | Node0 self-check verification surface. |
| `tests/onboarding.test.js` | Guided CLI/TUI onboarding, inspiration doctrine, preview-only boundaries. |
| `tests/optimization-roadmap.test.js` | Advisory optimization roadmap, non-enforcing gates, blueprint coverage, and no-side-effect CLI output. |
| `tests/preview-primitive-shape.test.js` | Cross-preview shape contract for the 5 micro-primitives (self_proactive_harness, self_critique, micro_compliance, micro_consent, analogical_model); accepts the step7/corpus and network/process-value-fixture conventions documented in-file. |
| `tests/process-value-fixture-preview.test.js` | Offline Process Value fixture pack, golden canned evidence states including Step 7 hold posture, no-CLI/no-mint boundary, and fail-closed pack rejection. |
| `tests/process-value-preview.test.js` | Process Value Preview pure module, process RSI, SNR value, true-value scoring, deterministic harness metadata, Step 7 hold-only posture, fail-closed inputs, and no-runtime boundary. |
| `tests/priority-anchor.test.js` | Founding-file Merkle root algorithm and priority anchor behavior. |
| `tests/proof-forge-scripts.test.js` | Proof Forge Python script subprocess boundary, local evidence chain, summary output, and no-repo-write guarantee. |
| `tests/release-readiness.test.js` | Release-readiness report, workflow scan, dependency/installer/doc risk checks. |
| `tests/review-gate.test.js` | PR class and proof-scope guardrails. |
| `tests/safety-report.test.js` | Safety report preview and non-certification language. |
| `tests/sat-placeholder.test.js` | Receipt verifier dispatch, gateway handoff checks, exact consent, fail-closed behavior. |
| `tests/step7-consent-refusal-preview.test.js` | Step 7 consent refusal preview, broad-consent rejection, no observed-text echo, micro-compliance, micro-consent, no-CLI/no-mint boundary, and fail-closed malformed input. |
| `tests/node0-state-preview.test.js` | Node0 state preview (`dema state --json`): canonical schema + truth label `NODE0_LOCAL_SEED`, all runtime/federation/mint boundaries pinned false, PAT/SAT ownership split, exhaustively-false boundary object, deep-frozen output. |
| `tests/profile-foundation-preview.test.js` | Profile Intelligence Foundation Preview (`dema profiles`): canonical schemas for User/PAT/SAT/Mission/ContextCapsule, PAT/SAT ownership-loyalty invariant (never share), SAT user_control=false invariant, capsule selectivity (whitelisted fields only — never raw conversation or full payload), exhaustively-false boundaries, deep-frozen across all builders. |
| `tests/consent-card-preview.test.js` | Consent Card Preview (`dema consent-card`): canonical schema + truth label, `mode=preview_only`, default `allowed_effects=["draft_preview"]`, required blocked effects always present (runtime/federation/mint/Node1-2/raw-scan/public-network), adversarial filters (caller cannot smuggle runtime into allowed; non-strings dropped; duplicates dedup; empty falls back to draft_preview), SAT verdict status pinned `policy_preview` even when caller injects PERMIT, mission/PAT proposal selectivity (no raw intent/payload/internal state), 240-char PAT summary truncation, ADR-005 exact-string consent rule, decision options exact list, deeply-frozen across all sub-views, `canonical_mint` and `federation` boundary booleans pinned false regardless of caller input. |
| `tests/mission-loop-preview.test.js` | Mission Loop Preview (`dema mission-loop`): canonical schema + truth label, `preview_lifecycle_status` pinned `HOLD` across all phases (incl. approved), 6 canonical `lifecycle_phase` values reachable, composition of state + profile_foundation + consent_card preserves their boundary booleans (no flip to true), `local_model_invocation.routing_allowed` pinned false, `evidence_chain_event.chain_advance` and `receipt_preview.chain_advance` pinned false in all phases, evidence_chain_event and receipt_preview prepared only on `complete_preview_approved`, adversarial filters (raw evidence payload stripped via composition; unknown consent decisions do NOT shortcut to approved; raw mission intent stripped through consent_card view), operator override propagation, deeply-frozen across all sub-views and embedded primitives. |
| `tests/evidence-chain-event-preview.test.js` | EvidenceChain Event Preview (`dema evidence-event`): canonical schema + truth label, exactly 2 reachable `event_status` values (`not_prepared`, `prepared_not_recorded`) — `recorded` is structurally unreachable, `chain_advance` and `receipt_mint` pinned false across every input path including adversarial caller-injected flags, only `complete_preview_approved` mission loops yield `prepared_not_recorded` (decline/narrow/no-decision yield `not_prepared`), malformed mission loops (missing/wrong schema) yield `not_prepared`, evidence_refs stripped to `{id, schema, content_hash:null}` with adversarial fields (content, raw_payload, private_data, chain_advance, force_record) stripped, required blocked_effects always present, payload_policy declares `raw_payload_included=false` and `hash_only=true`, non-array evidence_refs handled gracefully, deeply-frozen across all sub-views. |
| `tests/local-llm-router-preview.test.js` | Local LLM Router Preview (`dema llm-router`): canonical schema + truth label, `routing_allowed=false` pinned at top, per-model, and per-role across all input paths, `invocation_status=not_invoked_preview_only` invariant, default inventory empty, role_map has exactly 5 canonical roles, role assignment from inventory hints, adversarial inputs (caller routing_allowed=true ignored; status=loaded/ready/running pinned to declared_preview_only; external_url/tool_execution/prompt_executed_log/api_key fields stripped; non-string ids filtered; unknown families coerced to 'other'; unknown roles coerced to 'abstain_or_unknown'; out-of-range size_gb nulled; duplicate ids deduplicated), abstain_policy defaults all three abstain conditions to true, consent_boundary declares `routing_requires=typed_GO_plus_chain_advance`, non-array inventoryHints handled gracefully, allowed_families is the canonical 8-entry list, deeply-frozen across all sub-views. |
| `tests/preview-boundary.test.js` | Canonical preview boundary (`packages/core/src/preview-boundary.js`): single source of safety vocabulary for every preview builder. Asserts 16 canonical keys (filesystem_write_performed, network_used, runtime_execution_performed, model_loaded, model_invocation_performed, prompt_executed, external_call_performed, raw_corpus_scan_performed, raw_data_included, tool_executed, chain_advance_performed, receipt_mint_performed, federation_invoked, node_connection_performed, public_network_used, consent_collected); every value false; object frozen; fresh object per call; `isCanonicalBoundary` accepts canonical objects and rejects extra keys, missing keys, truthy values, and non-frozen inputs; key naming convention (snake_case + action-past-tense suffix). |
| `tests/smoke-boundary.test.js` | Smoke-boundary canary (`scripts/smoke-boundary.mjs`): invokes the 6 spine CLI commands (state, profiles, consent-card, mission-loop, evidence-event, llm-router) via subprocess and verifies `isCanonicalBoundary()` on each emitted JSON output. Also runs the in-process builders directly. Emits `bizra.dema.smoke_boundary_report.v0.1` with `all_canonical` boolean and per-command results. Exit non-zero if any emitter is non-canonical. |
| `tests/preview-summary.test.js` | Compact summary builders for the two verbose preview surfaces (`dema profiles --summary`, `dema mission-loop --summary`): summary schema tagged with `_summary` suffix, `mode=summary`, `source_schema` traces back to the full preview, truth_label preserved as `NODE0_LOCAL_SEED`, 4 actor schemas (user/pat/sat/mission) and context_capsule_schema surfaced as strings, 6 mission-loop child schemas/statuses surfaced (state_load, profile_foundation, consent_card, local_model_invocation_status, evidence_chain_event_status, receipt_preview_status), boundary is the canonical 16-key frozen all-false object verified by `isCanonicalBoundary`, summary boundary equals full-preview boundary, summary deep-frozen at top + sub-view levels, line-budget invariant (≤40 lines pretty-printed), material reduction invariant (profile <1/4 of full, mission-loop <1/8 of full). Closes Lighthouse-pack v1.0 Gap 2 (cold-demo verbosity). |
| `tests/process-mining-preview.test.js` | Process Mining Preview (`dema process-mining`) — the 7th spine command and L1.5 operator-pattern mirror: canonical schema + truth label `NODE0_LOCAL_SEED`, `mode=preview_only`, deep-frozen across all sub-views, canonical 16-key boundary, `blocked_effects` includes `operator_judgment` (the miner explicitly does NOT judge), `self_critique.this_preview_acts_on_data=false` and `this_preview_offers_a_mirror=true` invariants, `ring_advancement_status` derived honestly from inputs (Ring 0 default, "pack sealed; Ring 1 not yet earned" when artifacts present without reviewer form, "Ring 1 earned" only when external reviewer form on record), `next_step_observable` always ends in `_observable` (never imperative), adversarial filters (non-primitive metric values like functions/symbols/objects silently dropped; null metrics yield `metrics_unavailable` status field, not crash; adversarial mining_scope object silently replaced with READ_ONLY default), deterministic given identical input. Summary variant (`dema process-mining --summary`): schema `bizra.dema.process_mining_summary.v0.1`, ≤40 lines pretty-printed, preserves ring_advancement_status + next_step_observable + boundary. |
| `tests/help-coverage.test.js` | HELP coverage integration invariant: extracts every `dema <command>` entry from the HELP constant in `apps/cli/src/index.js` and asserts each has a matching `case "<command>":` in `dispatch()` (modulo whitelist). Asserts all 8 spine surfaces (state, profiles, consent-card, mission-loop, evidence-event, llm-router, process-mining, key-maker-check) are listed in HELP. Asserts the "Spine preview surfaces" section header is present. Includes a unit test of the `extractHelpCommands` helper with plain/colon/subcommand variants. Lowercase-first regex prevents matching description words like "Active". |
| `tests/baseline-l1-diff.test.js` | L1 baseline diff tool (`scripts/baseline-l1-diff.mjs` · `npm run baseline:l1:diff`): reads two `bizra.dema.baseline_l1.v0.1` snapshots and emits a schema-tagged `bizra.dema.baseline_l1_diff.v0.1` delta with per-metric numerical change, pair metadata (sha · branch · measured_at), growth percentages with 0.1 precision, and a `verify_before_assert_trend` classification (`tests_keep_up_or_outpace_packages` · `tests_lag_packages_within_acceptable_range` · `tests_lag_packages_significantly` · `shrinking_packages` · `tests_only` · `no_change`). Rejects non-`baseline_l1.v0.1` inputs with non-zero exit. Includes canonical 16-key all-false boundary. 9 tests covering schema, deltas, pair metadata, trend classification for 4 distinct cases, malformed-input rejection, boundary canonical, and percentage rounding. |
| `tests/spine-contract.test.js` | Cross-cutting Spine Contract integration test: asserts the canonical spine has exactly 8 surfaces, that every spine builder emits a schema matching `/^bizra\.dema\.[a-z0-9_]+\.v\d+\.\d+$/`, `truth_label = NODE0_LOCAL_SEED`, canonical 16-key all-false boundary (verified via `isCanonicalBoundary`), deep-frozen at top level + boundary, `mode` field as string when present, and is deterministic when called with no args. Names are unique. Forces future 9th spine surface to be added to the contract list before it can land. |
| `tests/llm-adapter.test.js` | C1 · Local LLM Adapter (`dema llm-invoke`) — first runtime component per [ADR-008](06-adr/ADR-008-runtime-activation.md). 24 tests covering: preview surface (5) · adversarial input filtering (5) · invocation consent-gate (4) · mocked Ollama invocation behavior (6) · summary + exports (3) · 10-check Master Craftsmanship structural verification (3). Preview emits `bizra.dema.llm_invocation_preview.v0.1` with canonical 16-key boundary all-false. Invocation result emits `bizra.dema.llm_invocation_result.v0.1` with `effects_observed` reflecting what actually flipped (`model_invocation_performed`, `prompt_executed`, `consent_collected`, `network_used` all true on success; `public_network_used` pinned FALSE because localhost-bound). Model whitelist enforced (caller cannot smuggle non-whitelisted name). Consent phrase exact-match per ADR-005 (no fuzzy, no prefix, no case-insensitive). Adversarial filters: non-string model → empty; non-string prompt → empty; out-of-range timeout → default; non-localhost base URL → default in preview, refused in invoke. Failure modes (http_status, response_not_json, network_error, timeout, prompt_empty, prompt_too_long, model_not_in_whitelist, endpoint_not_localhost, consent_phrase_mismatch) all schema-tagged with specific `error_reason`. |
| `tests/key-maker-compliance.test.js` | Key Maker Compliance Envelope (`dema key-maker-check`) — the 8th spine command, bridges canon → code per [key-maker-epistemic-conduct-v0.1.md §10](02-architecture/key-maker-epistemic-conduct-v0.1.md). Canonical schema `bizra.dema.key_maker_compliance.v0.1` + truth label `NODE0_LOCAL_SEED` + `mode=epistemic_conduct_check`, deep-frozen at all sub-views, canonical 16-key boundary. Self-audits against the 5 invariants from canon §9: (1) assumption_declaration, (2) certainty_mapping, (3) constructive_reading, (4) opposing_view_search, (5) boundary_marker. Default-empty envelope trivially compliant (nothing to decompose). Invariant 5 fails when uncertain/assumed claims present but boundary_marker empty. Invariant 3 fails when `constructive_reading_applied=false`. Invariant 4 N/A when no opposing view examined; fails when examined without truth_found and without `searched_and_found_no_articulable_truth=true` honest-null flag. `key_types` filter rejects non-canonical entries (only 8 canonical: question/map/mirror/bridge/boundary_marker/lens/lantern/silence) and dedupes. Adversarial inputs (functions/symbols/objects in arrays) silently filtered. `micro_consent.mutation_authorized` pinned false at builder level (caller cannot inject true). Summary variant (`dema key-maker-check --summary`): schema `bizra.dema.key_maker_compliance_summary.v0.1`, ≤40 lines pretty-printed, preserves `overall_compliant` + `failed_invariants` + counts. |

## Smoke checks

`npm run check` runs:

```text
node --test
npm run coverage
node apps/cli/src/index.js welcome
node apps/cli/src/index.js help
node apps/cli/src/index.js onboard
node apps/cli/src/index.js onboard --json
node apps/cli/src/index.js roadmap preview
node apps/cli/src/index.js roadmap preview --json
node apps/cli/src/index.js models
node apps/cli/src/index.js evidence receipt preview
node apps/cli/src/index.js evidence receipt preview --json
node apps/cli/src/index.js ihsan floor preview --score 0.97
node apps/cli/src/index.js ihsan floor preview --score 0.97 --json
node apps/cli/src/index.js behavior modulation preview --consent "GO: preview behavioral modulation only" --score 0.97 "Adjust tone to prioritize safety reminders"
node apps/cli/src/index.js behavior modulation preview --consent "GO: preview behavioral modulation only" --score 0.97 --json "Adjust tone to prioritize safety reminders"
node apps/cli/src/index.js diagnostics plan
node apps/cli/src/index.js diagnostics plan --json
node apps/cli/src/index.js consent plan "Fix auth.py and run pytest"
node apps/cli/src/index.js mission draft "Fix auth.py and run pytest"
node apps/cli/src/index.js mission draft --json "Fix auth.py and run pytest"
node apps/cli/src/index.js ambient
node apps/cli/src/index.js report safety
node apps/cli/src/index.js mcp blueprint
node apps/cli/src/index.js mcp blueprint --json
node apps/cli/src/index.js network blueprint
node apps/cli/src/index.js network blueprint --json
node apps/cli/src/index.js network fixture preview
node apps/cli/src/index.js network fixture preview --json
node apps/cli/src/index.js network refusal preview
node apps/cli/src/index.js network refusal preview --json
node apps/cli/src/index.js amana contracts preview
node apps/cli/src/index.js amana contracts preview --json
node apps/cli/src/index.js design emulate-loop
node apps/cli/src/index.js status
node apps/cli/src/index.js mission propose
node apps/cli/src/index.js monetize
node scripts/review/actuator-check.mjs
node scripts/review/canon-check.mjs
node scripts/review/integration-check.mjs
node scripts/llm-guidance-check.mjs
node scripts/node0-self-check.mjs --verify
```

## Quality expectations

Every new public surface should add or update tests for:

1. schema tag,
2. human output,
3. JSON output when available,
4. safe default,
5. non-execution boundary,
6. hostile or malformed input,
7. deterministic output when relevant.

## Coverage threshold

`npm run coverage` uses Node's native test coverage gate with enforced
thresholds:

```text
lines: 95
branches: 80
functions: 95
```

The primary GitHub Actions check and BIZRA Review Gate run this coverage command
after `npm test` and before `npm run check`.
