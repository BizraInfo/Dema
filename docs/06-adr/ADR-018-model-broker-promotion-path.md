# ADR-018: Model Broker Promotion Path — localhost-only · Ollama v0.1

**Status:** Accepted (via typed-GO `a + c in parallel` on 2026-05-23 GST)
**Date:** 2026-05-23 GST
**Authors:** Coordinator (Claude Opus 4.7) at Mumu's direction · output of the `planner` subagent (run_id `a5957ed47760eb9a3`) with full Dema doctrine context + per-file disk read of the existing model-broker preview surface.
**Supersedes:** none
**Related:** ADR-001 Dema is One Face · ADR-002 No Shadow State · ADR-005 Operator Actions Require Explicit Consent · ADR-014 Three-Runtime Architecture Canonization · ADR-015 LLM is Suggestion · Verifier is Authority · ADR-016 Eval Layer 2 Scaffold-Only
**Implements:** `docs/A_PLUS_BLUEPRINT_v0_1.md` — the **flagship critical-path slice** that takes Dema's model-broker from `DESIGNED_NOT_LIVE` toward `MEASURED` local model invocation. Identified by 4-source convergence (in-session state report · external assessor 2026-05-23 · A+ blueprint §6 · operator question) as load-bearing for the Node0/DEMA flagship goal.
**Evidence:** planner output 2026-05-23 (run_id `a5957ed47760eb9a3`) · disk reads of `packages/core/src/llm-adapter.js` · `packages/core/src/routed-llm-invocation.js` · `packages/core/src/routed-invocation-verifier.js` · `packages/models/src/*.js` · `packages/core/src/preview-boundary.js`

---

## Operating canon

> **The LLM is a suggestion engine; the verifier is authority (ADR-015). Localhost-Ollama is a MEASURED-eligible invocation lane; remote provider is constitutionally forbidden. The promotion is naming what exists, not building from scratch.**

---

## Disk-truth grounding · why this is promotion, not greenfield

Before writing this ADR, the planner subagent read the existing model-broker surface end-to-end. The finding was decisive enough to reshape the slice:

- **`packages/core/src/llm-adapter.js` ALREADY** contains a working `invokeLocalLLM()` that does an Ollama localhost HTTP call, enforces an `ALLOWED_MODEL_FAMILIES` whitelist, enforces ADR-005 exact-string consent (`"GO: invoke local LLM at <model>"`), bounds prompts to 100,000 chars, defaults timeout to 60 s with `AbortController`, and emits `bizra.dema.llm_invocation_result.v0.1` whose `effects_observed` is a 16-key shape with `model_invocation_performed`/`model_loaded`/`prompt_executed` flipping `true` on success.
- **`packages/core/src/routed-llm-invocation.js` ALREADY** bridges `model-broker route` output to `invokeLocalLLM()` and emits `bizra.dema.local_model_routed_invocation_result.v0.1`.
- **`packages/core/src/routed-invocation-verifier.js`** (PR #87, MEASURED) runs 17 deterministic invariant probes over the saved envelope — this is the structural SAT-1..5-aligned check.
- **`packages/models/src/model-broker-preview.js`** produces route receipts under `bizra.dema.local_model_route_receipt.v0.1`.
- **`packages/core/src/preview-boundary.js`** declares the canonical 16-key all-false boundary; `isCanonicalBoundary()` requires structure + all-false + frozen.
- **`packages/core/schemas/`** contains 5 schema files; **no schema file exists** for `llm_invocation_result`, `local_model_route_receipt`, `local_model_routed_invocation_result`, `local_model_routed_invocation_verification`, or `local_model_availability_probe` — those schemas live as in-code string constants only.

**Implication:** ADR-018 is **"name what already exists, define its boundary class, materialize the schemas-on-disk, harden prompt-injection containment, and promote `CURRENT_LIMITS.md` rows from preview-labelled to MEASURED."** Greenfield design is rejected up-front. Effort drops from a hypothetical ~40h greenfield estimate to a planner-grounded ~10h promotion estimate.

---

## Context

This is the **flagship critical-path** slice. The 4-source convergence on 2026-05-23 named model-broker promotion as the load-bearing next step (state report · external assessor · A+ blueprint · operator framing).

Four constitutional / design constraints bind v0.1:

### C1 · Localhost-Ollama vs remote-provider sharply distinguished

The boundary at stake: ADR-015 binds "LLM is suggestion, verifier is authority." User-scope `CLAUDE.md` halt-gate forbids "remote LLM/provider calls from the runtime." Two cases are **different boundary classes**:

- **Localhost Ollama / LM Studio**: model on operator's machine, talks to localhost only, no network egress. MEASURED-eligible for v0.1.
- **Remote provider** (Anthropic / OpenAI / etc.): cross-machine, requires API key, egress traffic. Constitutionally forbidden from runtime. Out of scope for v0.x; reserved to never-or-future amendment ADR.

ADR-018 commits v0.1 to **localhost-only**. The existing string check `baseUrl.startsWith("http://localhost"|"http://127.0.0.1")` is hardened in this slice to also gate post-DNS-resolution (reject if loopback resolves to non-loopback IP).

### C2 · Promotion delta, not greenfield

The 11 model-related modules already exist. Plan describes what CHANGES from preview to MEASURED for each. Greenfield rejected.

### C3 · Canonical 16-key boundary handling — sibling vocab

The current canonical preview-boundary (`packages/core/src/preview-boundary.js`) declares 16 keys all-`false` for preview emissions, including `model_invocation_performed` and `model_loaded`. After this slice, these keys will sometimes be `true` for the model-invocation-result envelope. This is a breaking-change to the canonical-boundary-all-false invariant.

**Resolution**: introduce a **sibling vocab** — `isRuntimeEmissionBoundary` distinct from `isCanonicalBoundary`. The preview-boundary canon stays all-false (every existing preview module unchanged). The runtime-emission boundary has the same 16-key shape, but selectively `true` for legitimate runtime acts (`runtime_execution_performed`, `model_loaded`, `model_invocation_performed`, `prompt_executed`, `network_used`, `consent_collected`). Ten other keys MUST remain `false` (`public_network_used`, `external_call_performed`, `chain_advance_performed`, `receipt_mint_performed`, `federation_invoked`, `node_connection_performed`, `raw_corpus_scan_performed`, `raw_data_included`, `tool_executed`, `filesystem_write_performed`).

### C4 · Prompt-injection containment (Layer 1 bidirectional)

When Dema sends operator-supplied input to a local model, the input could contain prompt-injection content. The model's output could be hijacked.

**Resolution**: Layer 1 `evaluateArtifactSafety` is run on BOTH directions of every model call.
- Inbound: prompt scanned pre-fetch. Forbidden-live-claim or path-leak → `truth_label: INVOCATION_BLOCKED`, `prompt_safety_verdict: BLOCKED`, refuse to call Ollama.
- Outbound: response_text scanned post-fetch. Leakage → `response_safety_verdict: REDACTED`, `response_text_preview: [REDACTED: <verdict>]`. Operator sees redaction-only preview.

### C5 · SAT/FATE honest framing — not agent-team

The operator's draft GO referenced "SAT and FATE inspect model output." Honest framing:
- **SAT-1..5 verification pipeline** (orchestrator-verify v0.1, MEASURED, PR #90) inspects the model-invocation-result envelope **structurally**.
- **PAT-7 / SAT-5 live agent teams** are `DESIGNED_NOT_LIVE`. They cannot inspect anything yet. **NOT promoted by this slice.**
- **FATE** exact-string consent gate (MEASURED) gates the operator's authorization to act on model output (not the inspection itself).

This slice promotes the structural lane only. Live agent teams remain deferred.

## Decision

**v0.1 ships localhost-only model invocation with Ollama as the provider, the existing `llm-adapter.js` + `routed-llm-invocation.js` modules promoted from preview-labelled to MEASURED, 3 schema files materialized on disk, a sibling runtime-emission boundary added to `preview-boundary.js`, bidirectional Layer 1 safety scanning on every invocation, and monotonic per-invocation consent freshness.**

### Why Ollama (not LM Studio) for v0.1

1. `packages/core/src/llm-adapter.js` already targets Ollama at `http://localhost:11434/api/generate`; changing provider in v0.1 expands blast radius for no win.
2. Ollama is reproducible by CLI (`ollama list` / `ollama serve`), already detected by `model-safety.js` exposure check, and inventoried by `model-inventory.js` + `local-model-inventory-scan.js` — every other surface already speaks Ollama-shaped records.
3. LM Studio detection is present in inventory + safety but its API surface is a separate adapter; deferring to v0.2 holds v0.1 to **one provider · one HTTP shape · one whitelist**.
4. The localhost-only constraint is enforced by existing string check + new DNS-loopback post-check in this slice; ADR-018 canonizes this check as a constitutional invariant.
5. Remote-provider (Anthropic / OpenAI / non-localhost) is constitutionally forbidden from runtime per user-scope CLAUDE.md + ADR-015; ADR-018 reserves this lane to a never-or-future amendment ADR and ships v0.1 with localhost as a hard-bound axis.

### v0.2 promotion path

Once v0.1 implementation lands MEASURED:
- LM Studio adapter as second provider (separate ADR if needed)
- `dema model-broker pick` TUI surface (still consent-bound)
- Streaming protocol with progressive Layer 1 scan (requires its own ADR on partial-output safety)
- Ensemble routing ("ask 3 models, compare") — 1 consent per model
- MCP integration (separate ADR)

---

## Decomposition · 8 sub-tasks (~10h total)

| # | Goal | Effort | Touched / new files | Promotion delta |
|---|---|---|---|---|
| **S1** | Author this ADR | 1h | NEW: `docs/06-adr/ADR-018-model-broker-promotion-path.md` (THIS FILE) | docs-only |
| **S2** | Materialize 5 schema files for already-emitted envelopes | 2h | NEW: `packages/core/schemas/llm-invocation-request.v0.1.json` · `packages/core/schemas/llm-invocation-result.v0.1.json` · `packages/core/schemas/local-model-availability-probe.v0.1.json` · `packages/core/schemas/local-model-route-receipt.v0.1.json` · `packages/core/schemas/local-model-routed-invocation-result.v0.1.json` · TOUCH: `packages/core/src/envelope-schema-validator.js` (auto-registers via `loadKnownSchemasFromDir`) | PROMOTE: in-code string-constants → on-disk validated registry entries |
| **S3** | Add `isRuntimeEmissionBoundary()` sibling-vocab distinct from `isCanonicalBoundary()` | 1.5h | TOUCH: `packages/core/src/preview-boundary.js` (export `RUNTIME_EMISSION_BOUNDARY_KEYS` + `isRuntimeEmissionBoundary()` + `isRuntimeEmissionBoundaryShape()` + `buildRuntimeEmissionBoundary()`) · TOUCH: `tests/preview-boundary.test.js` | NEW sibling shape: 6 keys MAY be `true` on MEASURED truth_label; 10 keys MUST be `false` always |
| **S4** | Migrate `llm-adapter.js` result envelope to canonical sibling boundary shape | 1h | TOUCH: `packages/core/src/llm-adapter.js` (rename `effects_observed` → `boundary`; key set unified) · TOUCH: `tests/llm-adapter.test.js` | PROMOTE: result envelope now passes `isRuntimeEmissionBoundaryShape()`; backwards-compat alias `effects_observed` retained one cycle |
| **S5** | Bidirectional Layer 1 scan (inbound prompt + outbound response) | 2h | TOUCH: `packages/core/src/llm-adapter.js` (call `evaluateArtifactSafety()` on prompt pre-fetch and on response_text post-fetch; result envelope carries `prompt_safety_verdict` + `response_safety_verdict`) · NEW test block in `tests/llm-adapter.test.js` | PROMOTE: Layer 1 gates BOTH directions; failures → `truth_label: INVOCATION_BLOCKED` or `response_safety_verdict: REDACTED` |
| **S6** | Monotonic per-invocation consent freshness | 0.5h | TOUCH: `packages/core/src/llm-adapter.js` (consent token bound to monotonic counter + per-process random) · TOUCH: `tests/llm-adapter.test.js` (one-shot consent test) | PROMOTE: replaying the same consent phrase in the same process does NOT re-authorize a second invocation |
| **S7** | Update truth-map docs | 0.5h | TOUCH: `docs/CURRENT_LIMITS.md` (move llm-adapter + routed-llm-invocation + route-receipt + verifier rows into MEASURED table) · TOUCH: `docs/ROADMAP.md` (mark slice closed) · TOUCH: `docs/ARCHITECTURE.md` (command map rows for new CLI surfaces) | PROMOTE: `CURRENT_LIMITS.md` row movement IS the promotion |
| **S8** | Verification + sample-fixture round-trip | 1.5h | NEW: `tests/fixtures/model-broker-promotion/` (1 valid availability-probe · 1 valid invocation-result · 1 valid request · 1 valid route-receipt · 1 valid routed envelope · 3 invalid variants) · NEW: `tests/model-broker-promotion-fixtures.test.js` | PROMOTE: fixtures are the durable evidence that schemas validate runtime envelopes |

Test-count budget: floor **2,588** · expected new floor after IMPLEMENTATION slice ≥ **2,616**.

---

## Module boundary (after the IMPLEMENTATION slice lands)

| Module | Path | Schema id(s) emitted | Exported surface | Status |
|---|---|---|---|---|
| **Local LLM adapter** (Ollama HTTP, localhost-only) | `packages/core/src/llm-adapter.js` | `bizra.dema.llm_invocation_request.v0.1` (NEW · materialized) · `bizra.dema.llm_invocation_result.v0.1` (PROMOTED · schema file NEW) | `invokeLocalLLM({ model, prompt, consentPhrase, ollamaBaseUrl, timeoutMs, fetchImpl })` · `buildLLMInvocationPreview({...})` · `llmAdapterConsentPhraseFor(model)` | **PROMOTED FROM preview** |
| **Routed invocation bridge** | `packages/core/src/routed-llm-invocation.js` | `bizra.dema.local_model_routed_invocation_result.v0.1` (PROMOTED · schema file NEW) | `invokeRoutedLocalModel({ routeReceipt, prompt, invokeConsent, timeoutMs, fetchImpl })` | **PROMOTED FROM preview** |
| **Routed invocation verifier** (17→18 probes) | `packages/core/src/routed-invocation-verifier.js` | `bizra.dema.local_model_routed_invocation_verification.v0.1` | `verifyRoutedInvocationEnvelope(envelope, { source })` · `readEnvelopeFromFile(absPath)` · `INVARIANT_NAMES` | **EXTENDED** (new invariant `verdict_role_is_suggestion` per R12) |
| **Model broker route receipt** | `packages/models/src/model-broker-preview.js` | `bizra.dema.local_model_route_receipt.v0.1` (PROMOTED · schema file NEW) | `buildModelBrokerPreview({ registry, providers })` · `routeForTask(broker, opts)` · `brokerRouteOnce({ registry, providers, ...routeOpts })` | **PROMOTED** (file rename deferred to v0.2) |
| **Local model availability probe** | `packages/core/src/llm-adapter.js` (extend) | `bizra.dema.local_model_availability_probe.v0.1` (NEW · schema file NEW) | `probeLocalModelAvailability({ ollamaBaseUrl, timeoutMs, fetchImpl })` | **NEW** |
| **Preview boundary** (now bifurcated) | `packages/core/src/preview-boundary.js` | n/a | `buildPreviewBoundary()` (UNCHANGED) · `isCanonicalBoundary(b)` (UNCHANGED) · `RUNTIME_EMISSION_BOUNDARY_KEYS` (NEW) · `isRuntimeEmissionBoundary(b)` (NEW) · `isRuntimeEmissionBoundaryShape(b)` (NEW) · `buildRuntimeEmissionBoundary()` (NEW) | **EXTENDED** · canonical preview-boundary semantics preserved verbatim |
| **FATE consent gate** | `packages/fate/src/fate.js` | `bizra.dema.fate_consent.v0.1` | `evaluateConsent({ phrase, requiredPhrase })` | **UNCHANGED** · authoritative gate inside `invokeLocalLLM` |

Total: 7 modules. 2 PROMOTED · 1 NEW · 2 EXTENDED · 2 UNCHANGED.

---

## Envelope schemas needed (5 new files on disk)

### `bizra.dema.llm_invocation_request.v0.1`
Required: `schema` (const) · `truth_label` (enum: `OPERATOR_INTENT`) · `requested_model` (string · whitelisted family) · `prompt_length_chars` (uint ≤ 100,000) · `target_endpoint` (string · regex localhost) · `consent_required` (string · exact-pattern) · `boundary` (preview-boundary all-false).
Optional: `prompt_truncated` (bool) · `timeout_ms` (uint ≤ 600,000) · `requested_by` (string) · `request_id` (uuid v4).
Consumed by: `invokeLocalLLM()` pre-check · paste-back preview UX.

### `bizra.dema.llm_invocation_result.v0.1` (PROMOTED)
Required: `schema` · `truth_label` (enum: `MEASURED` | `INVOCATION_FAILED` | `INVOCATION_BLOCKED`) · `mode` (const `invocation_result`) · `invocation_status` (enum: `completed` | `failed` | `blocked`) · `model_invoked` (string) · `prompt_length_chars` (uint) · `response_length_chars` (uint) · `response_text_preview` (string ≤ 500 chars) · `duration_ms` (uint) · `target_endpoint` (regex localhost) · `target_is_localhost` (const `true`) · `consent_phrase_verified` (bool · MUST be `true` on `completed`) · `verdict_role` (const `suggestion`) · `boundary` (runtime-emission · 6 keys may be `true` per S3 spec).
Optional: `error_reason` (string · required when status ≠ `completed`) · `prompt_safety_verdict` (Layer 1 verdict) · `response_safety_verdict` (Layer 1 verdict) · `request_id` (uuid v4) · `response_raw_keys` (array ≤ 50).
**This is the envelope that legitimately carries `boundary.model_invocation_performed: true`.** No other envelope in v0.1 does.
Consumed by: `routed-llm-invocation.js` · `routed-invocation-verifier.js` · `dema model-broker invoke` CLI · `dema orchestrator verify` SAT-1..5 pipeline · `invocation-result-save` to `$DEMA_HOME/receipts/`.

### `bizra.dema.local_model_availability_probe.v0.1` (NEW)
Required: `schema` · `truth_label` (enum: `LOCALHOST_READ_ONLY_SCAN`) · `target_endpoint` (regex localhost) · `target_is_localhost` (const `true`) · `reachable` (bool) · `boundary` (runtime-emission · only `network_used` MAY be `true`).
Optional: `http_status` (uint) · `model_count` (uint) · `models_seen` (array ≤ 50 · IDs only) · `error_reason` (string · required when `reachable=false`) · `probe_duration_ms` (uint).
Consumed by: `dema model-broker status` · `dema doctor` health surface.

### `bizra.dema.local_model_route_receipt.v0.1` (PROMOTED)
Required: `schema` · `timestamp` (iso) · `selected_model_id` (string · nullable) · `selected_model_role` (enum · nullable) · `selected_model_locality` (enum: `local`) · `reason` (string) · `rejected_candidates` (array ≤ 100) · `verdict_role` (const `suggestion`) · `boundary` (8-key broker-boundary all-false) · `canon_refs` (array).
Consumed by: `invokeRoutedLocalModel()` · `routed-invocation-verifier.js`.

### `bizra.dema.local_model_routed_invocation_result.v0.1` (PROMOTED)
Required: `schema` · `route_receipt` (embedded) · `selected_model_id` (string · nullable) · `invocation_result` (embedded · nullable when `selected_model_id===null`) · `boundary` (9-key envelope-boundary) · `warnings` (array).
Consumed by: `dema model-broker invoke` · `invocation-result-save` · `routed-invocation-verifier` · `dema orchestrator verify`.

### Registration step (mandatory)
All schemas above must be auto-picked-up by `validateAgainstRegistry()` via the existing `loadKnownSchemasFromDir` mechanism. This wires them into `npm run eval:layer1` — any envelope claiming one of these schemas is structurally validated by Layer 1 in CI.

---

## Risks (12 enumerated)

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | Network egress slips in (Ollama proxied to remote, or `OLLAMA_HOST` env var pointing non-localhost) | **CRITICAL** | Existing `baseUrl.startsWith` gate + NEW `dns.lookup` post-check rejecting non-loopback resolution. Test: pass `http://localhost.attacker.com` → expect rejection. |
| R2 | Operator-private prompt content leaks into a shareable artifact | HIGH | Saved `invocation-result.json` subject to Layer 1 scan; `LEAKAGE_DETECTED` blocks save unless operator types `GO save private invocation result locally only`. |
| R3 | Prompt injection from operator-supplied input | HIGH | S5 inbound Layer 1 scan; injection → refuse-to-call, NOT sanitize-and-pass-through. |
| R4 | Model output contains forbidden_live_claims / path leakage / secret tokens | HIGH | S5 outbound Layer 1 scan; on hit → `REDACTED` verdict + redacted preview. |
| R5 | Local Ollama unavailable / not running / wrong port | MED | `probeLocalModelAvailability()` runs first; unreachable → CLI exits 1 with `next_step: "ensure local Ollama is running at <endpoint>"`. |
| R6 | Model loading timeout / no bound | MED | `AbortController` + default 60s + hard ceiling 600s. Test: `timeoutMs=10` against slow-mock → expect `error_reason: "timeout_after_10ms"`. |
| R7 | Model invocation result treated as authoritative (ADR-015 violation) | **CRITICAL** | `verdict_role: "suggestion"` enum-const enforced by schema; SAT-1..5 18th probe `verdict_role_is_suggestion`; Layer 1 adds `FORBIDDEN_AUTHORITY_CLAIM` check. |
| R8 | Hidden persistence — invocation results auto-saved without consent | HIGH | `invokeLocalLLM()` does NOT touch fs (line 27 comment + no `fs` import). Save lane is SEPARATE `invocation-result-save` CLI with own save-consent. Invariant: invoke and save are two consents, never one. |
| R9 | Canonical-boundary-all-false invariant broken by careless test rewrites | HIGH | `isRuntimeEmissionBoundary` distinct from `isCanonicalBoundary`. Existing tests using `isCanonicalBoundary` on preview envelopes unchanged. New tests use new check. Lint: no production source sets canonical-boundary key `true` and still emits `buildPreviewBoundary()`. |
| R10 | Operator types GO once and runtime keeps invoking model on subsequent runs (consent freshness) | **CRITICAL** | S6 monotonic per-invocation consent. Amended exact-string: `"GO: invoke local LLM at <model> · attempt <N>"` where `<N>` is per-process counter the operator reads from the preview and types back. Replay of old phrase fails byte-comparison. |
| R11 | Schema-registry drift — schema file present but `validateAgainstRegistry` missing | MED | S8 lint: registry export must contain every `*.v0.1.json` file under `packages/core/schemas/`. Test `tests/model-broker-promotion-fixtures.test.js` asserts every new schema id is in `KNOWN_SCHEMA_IDS`. |
| R12 | `verdict_role: "suggestion"` field stripped or forged downstream | MED | Field required by schema; structural validation rejects missing field. `routed-invocation-verifier.js` gets 18th invariant probe `verdict_role_is_suggestion` enforcing the const. |

---

## Invariants (12 · all bind v0.1)

1. **0 prod deps · 0 dev deps.** Verified by `package.json` inspection in CI.
2. **No remote provider call.** Localhost string check + DNS-loopback post-check (R1). No SDK install. No outbound to non-loopback IP.
3. **No mint · no federation · no token claim · no daemon · no public send.** Per-envelope boundary checks enforce.
4. **Test count never decreases.** Floor: 2,588. CI fails if `node --test tests/*.test.js` reports fewer.
5. **`eval:layer1` CLI semantics unchanged.** Only addition: 5 more schema ids are recognized.
6. **FATE exact-string consent required for every model invocation.** Per R10: each invocation re-confirms with monotonic counter; NO session-cached consent.
7. **All emitted envelopes deep-frozen.** `Object.freeze` on outer object + nested objects.
8. **SAT-1..5 pipeline runs over every model-invocation-result envelope.** `dema orchestrator verify` MEASURED surface (PR #90) is fed the saved invocation envelope path.
9. **Model output always tagged `verdict_role: "suggestion"`.** Per ADR-015 · schema-enforced enum const.
10. **PAT-7 / SAT-5 live agent teams remain `DESIGNED_NOT_LIVE`.** `git diff` of IMPLEMENTATION slice must not touch `packages/core/src/pat-*.js` or `packages/core/src/sat-*-verifier.js`.
11. **Runtime-emission boundary has its OWN canonical-check function distinct from `isCanonicalBoundary`.** Per S3 / C3.
12. **No raw corpus scan · no tool execution from LLM result.** `boundary.raw_corpus_scan_performed === false` · `boundary.tool_executed === false` always. LLM output is text-only; no eval(), no Function constructor, no shell pipe.

---

## Verification strategy

### Existing tests that MUST still pass (regression floor 2,588)

`tests/preview-boundary.test.js` (canonical 16-key all-false preserved) · `tests/llm-adapter.test.js` · `tests/routed-llm-invocation.test.js` · `tests/routed-invocation-verifier.test.js` (extended to 18 probes per R12) · `tests/model-broker-preview.test.js` · `tests/model-broker-cli.test.js` · `tests/model-broker-invoke-cli.test.js` · `tests/model-broker-verify-invocation-cli.test.js` · `tests/model-broker-receipt-save-cli.test.js` · `tests/model-broker-registry-file-cli.test.js` · `tests/invocation-result-save-cli.test.js` · `tests/pipeline-result-save-cli.test.js` · `tests/orchestrator-verify-cli.test.js` · `tests/envelope-schema-validator.test.js` (registry extended) · `tests/artifact-safety-eval.test.js` · `tests/artifact-safety-eval-schema-wiring.test.js` · `tests/local-model-inventory-scan.test.js` · `tests/local-llm-router-preview.test.js`.

### New tests added (~28 estimated)

| File | Approx | Locks |
|---|---|---|
| `tests/preview-boundary.test.js` | +4 | runtime-emission shape · strict freeze · disagreement with `isCanonicalBoundary` · key-set equality |
| `tests/llm-adapter.test.js` | +8 | prompt-injection inbound → blocked · response-leak outbound → redacted · monotonic consent · DNS loopback check · runtime-emission boundary shape on result · backwards-compatible `effects_observed` alias one cycle · `verdict_role: "suggestion"` present · deep-freeze |
| `tests/routed-invocation-verifier.test.js` | +1 | probe #18 `verdict_role_is_suggestion` |
| `tests/envelope-schema-validator.test.js` | +5 | one per new schema id |
| `tests/model-broker-promotion-fixtures.test.js` (NEW) | ≥10 | valid availability-probe · valid invocation-result · valid request · valid route-receipt · valid routed envelope · 3 invalid variants (missing `verdict_role` · canonical-boundary forged-true · `target_is_localhost: false`) · registry-completeness · deep-freeze |

Estimated new floor: **≥ 2,616**.

### Gate sequence (operator-runnable · exact commands)

```bash
# 1. baseline floor
node --test tests/*.test.js 2>&1 | tail -5     # expect ≥ 2588

# 2. full local gate after IMPLEMENTATION slice
npm test
npm run check
npm run llm:guidance
npm run eval:layer1 -- --artifact "$(pwd)/artifacts/proofs/proof-room-v0.1-public-safe/proof-room-bundle.json" --json
git diff --check

# 3. Layer 1 self-validation on sample invocation fixtures
npm run eval:layer1 -- --artifact "$(pwd)/tests/fixtures/model-broker-promotion/invocation-result.valid.json"

# 4. operator-side pre-push orchestrator
~/.dema/bin/mu-test-all

# 5. Pipeline round-trip (only after real Ollama on operator's machine)
dema model-broker status                          # availability probe
dema model-broker route --task synthesis          # route receipt
dema model-broker invoke <route-receipt-path>     # writes invocation envelope under DEMA_HOME/receipts
dema model-broker verify-invocation <env-path>    # 18 probes; exit 0
dema orchestrator verify <env-path>               # SAT-1..5 over the envelope
```

### Tests proving constitutional invariants

| Invariant | Test |
|---|---|
| No remote call | reject `http://attacker.com` · reject `http://localhost.attacker.com` (DNS-loopback) |
| No hidden write | grep `fs.write` / `writeFile` in `llm-adapter.js` returns zero; explicit test mocks `fs` and asserts no calls |
| No daemon | grep `setInterval` / `setTimeout` (except one-shot abort timer) in adapter + bridge returns expected lines only |
| No federation | every fixture has `boundary.federation_invoked === false` |
| No token claim | grep `token_economy` / `mint` / `chain_advance` in adapter source — all assignments `false` |
| Timeout-handled | mock `fetch` that never resolves → `error_reason` startsWith `timeout_after_` |
| Injection-bounded | inbound scan blocks · outbound scan redacts |
| Layer 1 self-validation | `eval:layer1 --artifact <invocation-result.valid.json>` exits 0; `<missing-verdict-role.invalid.json>` exits 1 |

---

## Explicit non-goals (12)

| # | Non-goal | v0.2+ candidate |
|---|---|---|
| NG1 | No remote provider (Anthropic / OpenAI / non-loopback) | Reserved to never-or-future amendment ADR superseding §C1. |
| NG2 | No PAT-7 promotion. PAT-* modules remain `DESIGNED_NOT_LIVE`. | v0.x via separate slice gated on Mission Lifecycle Kernel runtime activation. |
| NG3 | No SAT-5 live agent-team. `sat-*-verifier.js` modules remain deterministic structural verifiers. | v0.3 candidate: SAT probes optionally wrapped by an LLM-suggestion lane via this same broker. Requires its own ADR. |
| NG4 | No model fine-tuning · no training · no LoRA. | Out of scope forever for Dema-runtime; belongs to `bizra-omega` Python lane per ADR-014. |
| NG5 | No model selection UI / TUI picker. Operator picks model by typing model name into consent phrase. | v0.2: `dema model-broker pick` TUI surface, still consent-bound. |
| NG6 | No auto-retry on failure. One invocation per typed consent. | v0.2: `--retry-on <reason>` flag with own per-retry consent. |
| NG7 | No result persistence by default. `invokeLocalLLM` does not write. | Already partitioned correctly; this NG re-asserts the invariant. |
| NG8 | No streaming protocol in v0.1. `stream: false` hardcoded. | v0.2: streaming with progressive Layer 1 scan; needs own ADR on partial-output safety. |
| NG9 | No multi-model routing within a single invocation. One route → one model → one result. | v0.2: ensemble routing; 1 consent per model. |
| NG10 | No MCP integration in v0.1. | v0.x slice tied to MCP runtime ADR (separate). |
| NG11 | No LLM judgment over constitutional gates. Per ADR-015. | Never. ADR-015 is the upper bound. |
| NG12 | No autonomy on receipts. Model never authorizes a mint, never decides chain advancement, never approves a FATE refusal. | Per ADR-005 + ADR-015. Hardline. |

---

## Typed-GO line for the IMPLEMENTATION slice

After this ADR is saved and reviewed, the IMPLEMENTATION slice (S2..S8) is started by the operator typing exactly:

```text
GO ship model-broker-local-invocation-v0-1 with Ollama localhost-only resolution,
covering invocation-request + invocation-result + availability-probe + route-receipt
+ routed-invocation-result schemas, runtime-emission-boundary distinct from canonical
preview-boundary, inbound + outbound Layer 1 prompt-and-response safety scan,
monotonic per-invocation consent freshness, verdict_role suggestion on every result
envelope, no remote provider, no PAT-7 promotion, no SAT-5 agent-team, no model
fine-tuning, no streaming, no auto-retry, no result persistence by default, no MCP,
no LLM judgment over constitutional gates, no autonomy on receipts
```

Exact-string. Byte-comparison. No fuzzy match. Any deviation halts.

---

## Consequences

### Positive

- **First MEASURED local model invocation in Dema runtime.** Closes the load-bearing gap to "Node0 + DEMA runs with complete local-models architecture."
- **Schema-on-disk contract for every model-related envelope.** Layer 1 in CI now structurally validates runtime emissions; drift catches at PR time.
- **Sibling-vocab boundary handling.** Preview-boundary canon stays intact; runtime emissions get their own honestly-named vocabulary.
- **Bidirectional Layer 1 safety scanning.** Prompt-injection bounded; output-leakage bounded.
- **Monotonic consent freshness.** No session-cached invocations; every model call costs an operator-typed phrase.
- **Clean v0.2 promotion paths.** LM Studio, streaming, MCP, ensemble — each has a named non-goal in this ADR and a clean entry point in v0.2.

### Negative

- v0.1 cannot pick model via TUI; operator types model name into consent phrase (NG5).
- No streaming · no auto-retry · no aggregation in v0.1 (NG6, NG8, NG9).
- LM Studio remains deferred (one provider in v0.1).
- Five-schema materialization is a small one-time cost; future model-related schemas must follow the same pattern.

### Trade-off accepted

The slice is small (~10h) and load-bearing. The narrowness of "Ollama-only · localhost-only · one provider · no streaming · no UI · one-shot consent" is **deliberate**. Every v0.2 expansion will require its own ADR. v0.1's job is to cross the "Dema invokes a model" line once, safely.

---

## When this ADR changes

This ADR is `v0.1`. Material edits to:
- §C1 (localhost vs remote) require a new ADR + operator-typed GO + invariant update.
- §C3 (sibling boundary vocabulary) require an extension ADR if more boundary keys flip to legitimate-true.
- §C5 (SAT/FATE framing) require a separate ADR for PAT-7 or SAT-5 live-agent promotion.

Editorial refinements that do not change a decision may land through standard PR.

Last refreshed: 2026-05-23.
