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
| `tests/corpus-data-tier-classifier-preview.test.js` | Corpus data-tier classifier preview for D0-D4 metadata-only signal classification, D3/D4 quarantine, raw-content rejection, no ingestion/upload/tuning/memory mutation/node sharing, and no-runtime boundary. |
| `tests/corpus-redaction-fixture-preview.test.js` | Corpus redaction fixture preview for metadata-only D0-D4 handling markers, D3 quarantine, D4 rejection, raw-content rejection, no real redaction, and no-runtime boundary. |
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
| `tests/process-value-fixture-preview.test.js` | Offline Process Value fixture pack, golden canned evidence states including Step 7 hold posture, no-CLI/no-mint boundary, and fail-closed pack rejection. |
| `tests/process-value-preview.test.js` | Process Value Preview pure module, process RSI, SNR value, true-value scoring, deterministic harness metadata, Step 7 hold-only posture, fail-closed inputs, and no-runtime boundary. |
| `tests/priority-anchor.test.js` | Founding-file Merkle root algorithm and priority anchor behavior. |
| `tests/proof-forge-scripts.test.js` | Proof Forge Python script subprocess boundary, local evidence chain, summary output, and no-repo-write guarantee. |
| `tests/release-readiness.test.js` | Release-readiness report, workflow scan, dependency/installer/doc risk checks. |
| `tests/review-gate.test.js` | PR class and proof-scope guardrails. |
| `tests/safety-report.test.js` | Safety report preview and non-certification language. |
| `tests/sat-placeholder.test.js` | Receipt verifier dispatch, gateway handoff checks, exact consent, fail-closed behavior. |
| `tests/step7-consent-refusal-preview.test.js` | Step 7 consent refusal preview, broad-consent rejection, no observed-text echo, micro-compliance, micro-consent, no-CLI/no-mint boundary, and fail-closed malformed input. |

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
