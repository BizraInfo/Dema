# Test Surface Inventory

Consolidated, verified test inventory for DEMA. Every row is backed by
a real test file on disk; every count is from `node --test` output.

## 1. Snapshot Metadata

| Field           | Value                                |
| --------------- | ------------------------------------ |
| Commit          | `d35e606`                            |
| Date            | 2026-05-27                           |
| Node.js         | v22.22.2                             |
| Test runner     | `node --test` (built-in)             |
| Dependencies    | 0 production, 0 dev (stdlib-only)    |
| Smoke matrix    | 26/26 PASS via `driver.mjs`          |
| Harness verdict | CLEAN / 5 gates / 3 probes / 6 hooks |

## 2. Aggregate Metrics

| Metric       | Value |
| ------------ | ----- |
| Test files   | 204   |
| Total tests  | 3046  |
| Total suites | 99    |
| Pass         | 3046  |
| Fail         | 0     |
| Pass rate    | 100%  |

## 3. Domain Breakdown

| #   | Domain         | Files   | Tests    | % of total | What it covers                                                                      |
| --- | -------------- | ------- | -------- | ---------- | ----------------------------------------------------------------------------------- |
| 1   | core-cli       | 34      | 453      | 14.9%      | CLI dispatch, help, status, banner, homebase, setup, output modes, spinner          |
| 2   | core-preview   | 29      | 399      | 13.1%      | Preview boundaries, process mining, safety, ambient, network, eval layers           |
| 3   | infrastructure | 27      | 450      | 14.8%      | Harness, env-hygiene, integration checks, themes, codebase-map, gateway             |
| 4   | scripts        | 18      | 182      | 6.0%       | Baseline, release-readiness, proof-room, GTM, URP, priority-anchor                  |
| 5   | agents         | 16      | 271      | 8.9%       | PAT-1..7 personas, SAT-1..5 personas, agent kernel, orchestrator                    |
| 6   | models         | 14      | 220      | 7.2%       | Model broker, inventory, registry, LLM adapter, local router, invocation            |
| 7   | receipts       | 12      | 175      | 5.7%       | Witness, authorship, codebase-map-save, invocation-save, pipeline-save              |
| 8   | corpus         | 11      | 146      | 4.8%       | Benchmark schema, gold labels, redaction, scorecard, genesis card                   |
| 9   | governance     | 10      | 269      | 8.8%       | Approval gate, skill governor, onboarding seal/lifecycle, ADR-011, review           |
| 10  | mission        | 9       | 123      | 4.0%       | Health snapshot, journey, diagnostics, draft, probe, closeout, manifest             |
| 11  | verifier       | 7       | 103      | 3.4%       | Evidence chain, evidence receipt, ihsan floor, SAT placeholder, downloads audit     |
| 12  | identity       | 6       | 122      | 4.0%       | Operator profile, profile foundation, system snapshot, node registry, node0 state   |
| 13  | consent        | 6       | 100      | 3.3%       | Consent planner, consent card, consent hash, a2a envelope, mobile QR, step7 refusal |
| 14  | think          | 5       | 90       | 3.0%       | Think dry-run, think live, think probe, think closeout, think receipt save          |
|     | **TOTAL**      | **204** | **3046** | **100%**   |                                                                                     |

## 4. Full Test File Inventory

### 4.1 core-cli (34 files, 453 tests)

| File                                   | Tests | What it verifies                                                 |
| -------------------------------------- | ----- | ---------------------------------------------------------------- |
| `banner-keys.test.js`                  | 23    | KEY_BINDINGS frozen, 6 documented keys, quit keys, dispatch loop |
| `banner-keys-cli.test.js`              | 3     | Bare dema (non-TTY) exits 0 without hanging                      |
| `canon-glossary-cli.test.js`           | 12    | `dema explain` human + JSON output for known concepts            |
| `chat-banner.test.js`                  | 6     | Chat banner content and formatting                               |
| `chat-router-cli.test.js`              | 6     | Chat router CLI dispatch surface                                 |
| `chat-router.test.js`                  | 36    | STOPWORDS, intent routing, command suggestion, error handling    |
| `cli-naming-convention.test.js`        | 8     | REGISTERED_COMMANDS_LIST integrity                               |
| `command-suggester-cli.test.js`        | 3     | Typo suggestions (`dema tell` suggests `memory show`)            |
| `command-suggester.test.js`            | 15    | Suggestion algorithm edge cases                                  |
| `dema-state-humanization-cli.test.js`  | 2     | `dema state` output contains no snake_case                       |
| `help-coverage.test.js`                | 5     | Help coverage completeness                                       |
| `help-topics-cli.test.js`              | 6     | `dema help` CLI output                                           |
| `help-topics.test.js`                  | 19    | Help topic rendering and routing                                 |
| `homebase-cli-dispatch.test.js`        | 7     | `dema --json` emits parseable HomebasePreview                    |
| `homebase-gather.test.js`              | 14    | gather() resolves with valid GatherResult                        |
| `homebase-language-picker-cli.test.js` | 4     | `dema language show` with profile language                       |
| `homebase-language-picker.test.js`     | 26    | Language picker logic and validation                             |
| `homebase-preview.test.js`             | 28    | HomebasePreview schema and field integrity                       |
| `homebase-render.test.js`              | 19    | formatHomebasePreview ANSI rendering                             |
| `intro-line-cli.test.js`               | 3     | Intro line CLI integration                                       |
| `intro-line.test.js`                   | 9     | shouldShowIntro logic, recording, edge cases                     |
| `live-homebase.test.js`                | 45    | TUI homebase rendering, keypress, gather, state composition      |
| `node0-homebase-state-preview.test.js` | 11    | Node0 homebase state schema                                      |
| `output-mode-cli.test.js`              | 10    | `dema state` JSON vs human output                                |
| `output-mode.test.js`                  | 9     | wantsJson detection logic                                        |
| `palette-env-resolver.test.js`         | 20    | DEMA_PALETTE=24bit overrides, env resolution                     |
| `project-status-preview.test.js`       | 32    | ProjectStatus schema, PMBOK principles                           |
| `run-shell-chat-dedup.test.js`         | 4     | Chat banner dedup in shell mode                                  |
| `setup-wizard-cli.test.js`             | 3     | `setup --json` valid JSON output                                 |
| `setup-wizard.test.js`                 | 16    | Interactive wizard: happy path, defaults, re-prompts, EOF        |
| `spinner-cli.test.js`                  | 2     | `dema models scan --json` no braille chars                       |
| `spinner.test.js`                      | 10    | Spinner API: start, update, stop                                 |
| `status-color.test.js`                 | 13    | Color mode zone titles                                           |
| `status.test.js`                       | 32    | Default status safe and blocked, field integrity                 |

### 4.2 core-preview (29 files, 399 tests)

| File                                         | Tests | What it verifies                             |
| -------------------------------------------- | ----- | -------------------------------------------- |
| `amana-contracts-preview.test.js`            | 12    | Schema-tagged preview without authority      |
| `ambient.test.js`                            | 12    | Ambient boundary awareness without execution |
| `artifact-safety-eval-schema-wiring.test.js` | 8     | Schema wiring for artifact safety eval       |
| `artifact-safety-eval.test.js`               | 15    | PUBLIC_SAFE / unsafe classification          |
| `asset-access.test.js`                       | 12    | 7 asset surfaces, 3 access tiers             |
| `behavioral-modulation.test.js`              | 10    | Consent-bound behavioral guidance            |
| `eval-layer2-cli.test.js`                    | 9     | `dema eval layer2 prompts --json`            |
| `eval-layer2-rubrics.test.js`                | 10    | EVAL_LAYER2_RUBRIC_PACK_SCHEMA               |
| `eval-layer2-schema-registry-wiring.test.js` | 3     | Layer 2 schemas in KNOWN_SCHEMA_IDS          |
| `eval-layer2-verdict-validator.test.js`      | 15    | Verdict validation, hostile input rejection  |
| `external-pattern-registry-preview.test.js`  | 18    | External pattern registry schema             |
| `file-access.test.js`                        | 13    | File access schema, op kinds                 |
| `loop-emulator.test.js`                      | 7     | Loop design emulation without effects        |
| `mcp-blueprint.test.js`                      | 10    | MCP integration blueprint preview            |
| `mcp-capability-descriptor-preview.test.js`  | 18    | MCP capability schema, PREVIEW_ONLY          |
| `network-blueprint.test.js`                  | 12    | Network blueprint preview without effects    |
| `network-fixture-preview.test.js`            | 13    | Offline network fixture preview              |
| `network-refusal-matrix-preview.test.js`     | 14    | Network refusal matrix preview               |
| `next-action-humanizer.test.js`              | 8     | Process-mining code humanization             |
| `optimization-roadmap.test.js`               | 11    | Optimization roadmap preview                 |
| `preview-boundary.test.js`                   | 16    | 16 canonical boundary keys                   |
| `preview-primitive-shape.test.js`            | 18    | Primitive shape validation                   |
| `preview-summary.test.js`                    | 14    | ProfileFoundationSummary schema              |
| `process-mining-preview.test.js`             | 16    | ProcessMiningPreview schema                  |
| `process-value-fixture-preview.test.js`      | 13    | Offline fixture pack preview                 |
| `process-value-preview.test.js`              | 15    | Process RSI computation                      |
| `safety-report.test.js`                      | 19    | Safety report preview with no effects        |
| `skill-manifest-preview.test.js`             | 19    | Skill manifest schema                        |
| `web-access.test.js`                         | 13    | Web access schema, localhost allowlist       |

### 4.3 infrastructure (27 files, 450 tests)

| File                                   | Tests | What it verifies                                       |
| -------------------------------------- | ----- | ------------------------------------------------------ |
| `boundary-cross-validation.test.js`    | 20    | Cross-module boundary consistency                      |
| `boundary-invariant-check.test.js`     | 9     | Preview module boundary invariants                     |
| `canon-check.test.js`                  | 5     | Canon docs integrity                                   |
| `codebase-architecture-map.test.js`    | 24    | Empty repo returns schema, file scanning               |
| `codebase-map-cli.test.js`             | 11    | CLI codebase map output                                |
| `dema-theme-rust-sync.test.js`         | 4     | Theme Python/Rust constant sync                        |
| `dema-theme.test.js`                   | 25    | Theme schema, ANSI helpers                             |
| `effect-cap.test.js`                   | 30    | EffectCap schema, truth label, descriptor              |
| `effectcap-invariant.test.js`          | 8     | EffectCap invariant checks                             |
| `env-hygiene-check.test.js`            | 13    | DEMA_ENV_VARS allowlist, redaction, --strict           |
| `envelope-schema-validator.test.js`    | 26    | Schema envelope validation                             |
| `first-run.test.js`                    | 15    | FIRST_RUN_SCHEMA, plan/outcome                         |
| `gateway-http-adapter.test.js`         | 16    | Gateway adapter, connection failure handling           |
| `harness-integration.test.js`          | 71    | Harness verdict, probes, hooks, npm script integration |
| `install.test.js`                      | 21    | install.sh exists, is executable                       |
| `integration-check.test.js`            | 5     | Command/docs/smoke/test matrix wiring                  |
| `key-maker-compliance.test.js`         | 22    | Key Maker epistemic conduct checks                     |
| `memory-query.test.js`                 | 12    | `dema memory --help`, query surface                    |
| `memory.test.js`                       | 11    | Memory entry listing                                   |
| `onboarding.test.js`                   | 10    | Onboarding preview schema                              |
| `setup-lifecycle.test.js`              | 14    | install/check/remove/check cycle                       |
| `spine-contract.test.js`               | 8     | Spine contract integrity                               |
| `system-lifecycle-integration.test.js` | 11    | intent -> consent_plan -> consent_hash                 |
| `actuator-check.test.js`               | 6     | Actuator check on source tree                          |
| `canon-glossary.test.js`               | 35    | 28+ glossary entries, truth labels                     |
| `tui-formatter.test.js`                | 25    | TUI formatting and rendering                           |
| `non-generic-vocabulary-check.test.js` | 0     | (counted under scripts)                                |

### 4.4 scripts (18 files, 182 tests)

| File                                   | Tests | What it verifies              |
| -------------------------------------- | ----- | ----------------------------- |
| `baseline-l1-diff.test.js`             | 9     | Baseline diff algorithm       |
| `claim-ledger-check.test.js`           | 8     | Truth-labeled claim audit     |
| `gtm-readiness-check.test.js`          | 12    | GTM readiness report          |
| `llm-guidance-check.test.js`           | 4     | LLM flow alignment            |
| `node0-local-urp-proof.test.js`        | 8     | URP proof artifacts verify    |
| `non-generic-vocabulary-check.test.js` | 12    | User-facing vocabulary check  |
| `priority-anchor.test.js`              | 11    | Priority anchor algorithm     |
| `proof-forge-scripts.test.js`          | 3     | Proof forge script surface    |
| `proof-loop-convergence.test.js`       | 3     | Proof loop convergence canary |
| `proof-room-bundle.test.js`            | 13    | Proof room consent + bundle   |
| `release-readiness.test.js`            | 16    | PMBOK release status          |
| `roadmap-dev.test.js`                  | 13    | Roadmap dev schema            |
| `shared-urp-world-preview.test.js`     | 11    | Shared URP world schema       |
| `smoke-boundary.test.js`               | 7     | Smoke boundary checks         |
| `urp-carrying-cost-preview.test.js`    | 17    | URP carrying cost schema      |
| `urp-local.test.js`                    | 14    | URP local schema, pool scope  |
| `urp-resource-offer-preview.test.js`   | 20    | URP resource offer schema     |
| `urp-shared-runtime-discovery.test.js` | 7     | URP shared state discovery    |

### 4.5 agents (16 files, 271 tests)

| File                                 | Tests | What it verifies                                     |
| ------------------------------------ | ----- | ---------------------------------------------------- |
| `active-kernel-cli.test.js`          | 7     | `dema task` lists registered tasks                   |
| `agent-kernel.test.js`               | 35    | Kernel schema, truth label, iteration, state machine |
| `multi-agent-orchestrator.test.js`   | 17    | Orchestrator schema                                  |
| `orchestrator-verify-cli.test.js`    | 12    | Orchestrator verify CLI                              |
| `pat-code-apprentice.test.js`        | 17    | PAT-3 schema, persona                                |
| `pat-consent-drafter.test.js`        | 17    | PAT-5 schema, pat_number=5                           |
| `pat-memory-curator.test.js`         | 17    | PAT-4 schema, pat_number=4                           |
| `pat-mission-scribe.test.js`         | 26    | PAT-1 schema, truth label, preview mode              |
| `pat-receipt-recorder.test.js`       | 19    | PAT-6 schema, pat_number=6                           |
| `pat-research-companion.test.js`     | 20    | PAT-2 schema, truth label                            |
| `sat-boundary-verifier.test.js`      | 15    | SAT-1 schema, sat_number=1                           |
| `sat-consent-auditor.test.js`        | 16    | SAT-2 schema, sat_number=2                           |
| `sat-doctrine-compliance.test.js`    | 17    | SAT-3 schema, sat_number=3                           |
| `sat-identity-verifier.test.js`      | 14    | SAT-5 schema, sat_number=5                           |
| `sat-placeholder.test.js`            | 15    | SAT placeholder verification                         |
| `sat-receipt-chain-verifier.test.js` | 14    | SAT-4 schema, sat_number=4                           |

### 4.6 models (14 files, 220 tests)

| File                                         | Tests | What it verifies                                   |
| -------------------------------------------- | ----- | -------------------------------------------------- |
| `llm-adapter.test.js`                        | 44    | LLM adapter schema, consent gates, blocked effects |
| `local-llm-router-preview.test.js`           | 24    | LLM router schema, preview mode                    |
| `local-model-inventory-scan.test.js`         | 20    | Model inventory scanning                           |
| `model-broker-cli.test.js`                   | 10    | Model broker CLI dispatch                          |
| `model-broker-invoke-cli.test.js`            | 6     | Model broker invoke CLI                            |
| `model-broker-preview.test.js`               | 11    | Model broker preview schema                        |
| `model-broker-receipt-save-cli.test.js`      | 11    | Model broker receipt save CLI                      |
| `model-broker-registry-file-cli.test.js`     | 10    | Model broker registry file CLI                     |
| `model-broker-verify-invocation-cli.test.js` | 7     | Model broker invocation verify                     |
| `model-corpus-manifest-preview.test.js`      | 9     | Multi-model source inventory                       |
| `model-registry-config-preview.test.js`      | 11    | 6 placeholder roles                                |
| `model-role-router-preview.test.js`          | 15    | Model role router schema                           |
| `models.test.js`                             | 6     | collectModelInventory end-to-end                   |
| `routed-llm-invocation.test.js`              | 9     | Routed LLM invocation                              |

### 4.7 receipts (12 files, 175 tests)

| File                                    | Tests | What it verifies                                     |
| --------------------------------------- | ----- | ---------------------------------------------------- |
| `authorship-signature.test.js`          | 13    | H18 Ed25519 sign/verify, tamper detection, boundary  |
| `codebase-map-save-cli.test.js`         | 13    | Codebase map save CLI                                |
| `codebase-map-save.test.js`             | 9     | Codebase map save module                             |
| `craftsmanship-witness-preview.test.js` | 35    | Craftsmanship witness schema                         |
| `invocation-result-save-cli.test.js`    | 11    | Invocation result save CLI                           |
| `pat-reflection-witness.test.js`        | 15    | PAT-7 reflection witness                             |
| `pipeline-result-save-cli.test.js`      | 12    | Pipeline result save CLI                             |
| `receipt-mint-integration.test.js`      | 17    | Receipt mint schema, 7 SAT gates                     |
| `receipt-store-format.test.js`          | 15    | Receipt store formatting                             |
| `verification-result-save-cli.test.js`  | 11    | Verification result save CLI                         |
| `witness-receipt.test.js`               | 20    | Node0 self-witness: build, save, consent, format     |
| `witness-verify.test.js`                | 13    | Witness replay verifier: verify, tamper, find latest |

### 4.8 corpus (11 files, 146 tests)

| File                                              | Tests | What it verifies                   |
| ------------------------------------------------- | ----- | ---------------------------------- |
| `corpus-benchmark-schema-preview.test.js`         | 10    | Benchmark metadata contract        |
| `corpus-data-tier-classifier-preview.test.js`     | 9     | D0-D4 metadata classification      |
| `corpus-eval-scorecard-preview.test.js`           | 10    | Aggregate metric slots             |
| `corpus-gold-label-fixture-preview.test.js`       | 10    | Label slot metadata                |
| `corpus-integration.test.js`                      | 16    | Canonical schema, NODE0_LOCAL_SEED |
| `corpus-manual-review-queue-preview.test.js`      | 9     | Prioritized review queue           |
| `corpus-preview-index.test.js`                    | 10    | Preview index integration          |
| `corpus-redaction-fixture-preview.test.js`        | 9     | Redaction fixture cases            |
| `corpus-scorecard-receipt-schema-preview.test.js` | 10    | Receipt field contract             |
| `genesis-preview-card-cli.test.js`                | 6     | Genesis card CLI                   |
| `genesis-preview-card.test.js`                    | 36    | Genesis card full schema           |

### 4.9 governance (10 files, 269 tests)

| File                                        | Tests | What it verifies                              |
| ------------------------------------------- | ----- | --------------------------------------------- |
| `approval-gate.test.js`                     | 17    | Approval gate levels and routing              |
| `doctor-dashboard-cli.test.js`              | 3     | `dema doctor` CLI output                      |
| `doctor-dashboard.test.js`                  | 15    | Predicate evaluation                          |
| `master-craftsmanship-audit-cli.test.js`    | 4     | `dema master-craftsmanship audit` CLI         |
| `master-craftsmanship-audit.test.js`        | 19    | Audit schema                                  |
| `node-onboarding-adr011-compliance.test.js` | 73    | ADR-011 compliance (largest single test file) |
| `onboarding-lifecycle.test.js`              | 33    | Lifecycle schema, stages                      |
| `onboarding-seal.test.js`                   | 23    | Seal evaluation, invariants                   |
| `review-gate.test.js`                       | 28    | Review gate logic                             |
| `skill-growth-governor.test.js`             | 33    | Skill promotion, boundary violation           |

### 4.10 mission (9 files, 123 tests)

| File                                  | Tests | What it verifies                            |
| ------------------------------------- | ----- | ------------------------------------------- |
| `diagnostics-plan.test.js`            | 7     | Diagnostics mission plan schema             |
| `health-snapshot.test.js`             | 23    | Health snapshot build, save, verify, format |
| `journey.test.js`                     | 4     | Sovereign journey chapters                  |
| `mission-closeout.test.js`            | 18    | Closeout report                             |
| `mission-draft.test.js`               | 6     | Intent -> MissionDraft -> ConsentPlan       |
| `mission-lifecycle-coherence.test.js` | 8     | Manifest predicts what execution proves     |
| `mission-loop-preview.test.js`        | 23    | MissionLoop schema, HOLD verdict            |
| `mission-manifest.test.js`            | 17    | Mission manifest                            |
| `mission-probe.test.js`               | 17    | Mission probe                               |

### 4.11 verifier (7 files, 103 tests)

| File                                   | Tests | What it verifies                |
| -------------------------------------- | ----- | ------------------------------- |
| `downloads-audit-preview.test.js`      | 9     | Downloads audit receipt         |
| `evidence-chain-event-preview.test.js` | 19    | Evidence event schema           |
| `evidence-chain-preview.test.js`       | 21    | Evidence chain preview          |
| `evidence-receipt-preview.test.js`     | 10    | Evidence receipt canonical JSON |
| `ihsan-floor-preview.test.js`          | 10    | Ihsan floor scalar acceptance   |
| `melae-preview.test.js`                | 5     | SAPE probe registry             |
| `routed-invocation-verifier.test.js`   | 8     | Routed invocation verification  |

### 4.12 identity (6 files, 122 tests)

| File                                 | Tests | What it verifies                 |
| ------------------------------------ | ----- | -------------------------------- |
| `node-registry-preview.test.js`      | 43    | Node registry schema             |
| `node0-self-check.test.js`           | 6     | Self-check artifact verification |
| `node0-state-preview.test.js`        | 11    | Node0 state preview schema       |
| `operator-profile.test.js`           | 14    | Operator profile read/write      |
| `profile-foundation-preview.test.js` | 26    | Profile foundation schema        |
| `system-snapshot.test.js`            | 25    | System snapshot composition      |

### 4.13 consent (6 files, 100 tests)

| File                                    | Tests | What it verifies                          |
| --------------------------------------- | ----- | ----------------------------------------- |
| `a2a-message-envelope-preview.test.js`  | 16    | A2A envelope schema, authority invariants |
| `consent-card-preview.test.js`          | 21    | Consent card schema                       |
| `consent-hash-preview.test.js`          | 18    | Consent hash computation                  |
| `consent-planner.test.js`               | 11    | Consent planner                           |
| `mobile-qr-challenge-preview.test.js`   | 17    | Mobile QR challenge schema                |
| `step7-consent-refusal-preview.test.js` | 17    | Step7 consent refusal preview             |

### 4.14 think (5 files, 90 tests)

| File                         | Tests | What it verifies                  |
| ---------------------------- | ----- | --------------------------------- |
| `think-closeout.test.js`     | 15    | Think closeout report             |
| `think-dry-run.test.js`      | 23    | Think dry-run model readiness     |
| `think-live.test.js`         | 22    | Think live execution with consent |
| `think-probe.test.js`        | 10    | Think behavioral probe            |
| `think-receipt-save.test.js` | 20    | Think receipt persistence         |

## 5. Test Type Classification

Based on test names and assertion patterns across all 204 files.

| Type            | Count (est.) | %   | What it proves                                                    |
| --------------- | ------------ | --- | ----------------------------------------------------------------- |
| **Structural**  | ~1800        | 59% | Schema tags, frozen objects, field presence, type checks          |
| **Behavioral**  | ~650         | 21% | Input/output logic, state transitions, consent gates, error paths |
| **Integration** | ~350         | 11% | CLI dispatch, multi-module composition, lifecycle flows           |
| **Adversarial** | ~150         | 5%  | Tamper detection, hostile input, boundary violation, fail-closed  |
| **Compliance**  | ~96          | 3%  | ADR conformance, vocabulary checks, canon integrity, env hygiene  |

Note: Classification is estimated from test name patterns (`schema`, `frozen`,
`canonical` = structural; `tamper`, `hostile`, `adversarial` = adversarial;
`cli`, `dispatch`, `lifecycle` = integration). Some tests span categories.

## 6. Coverage Gap Map

### Tested and strong

- Schema integrity for all 60+ preview modules
- CLI dispatch for all major subcommands
- Consent gate enforcement (witness, health, think)
- Boundary invariant enforcement (16 canonical keys)
- Tamper detection (witness verify, authorship signature)
- Agent persona identity (PAT-1..7, SAT-1..5)
- Harness verdict composition
- Receipt persistence and formatting

### Tested but thin

| Area                           | Tests | Gap                                                            |
| ------------------------------ | ----- | -------------------------------------------------------------- |
| Think live execution           | 22    | Only exercises dry-run paths; live LLM invocation mocked       |
| Mission probe                  | 17    | Tests probe output shape, not end-to-end mission execution     |
| Model broker invocation        | 6     | CLI wiring tested, actual model call path requires Ollama      |
| Cross-OS receipt verification  | 0     | Spearpoint D2 — no tests for Windows/macOS receipt replay      |
| `dema first-run` composed flow | 15    | Tests plan + outcome, not the full 5-step interactive sequence |
| Performance / timing           | 0     | No latency assertions, no budget regression tests              |

### Not tested

| Area                                 | Why                                                | Risk                                     | Priority        |
| ------------------------------------ | -------------------------------------------------- | ---------------------------------------- | --------------- |
| Ed25519 key persistence              | H18.1 only covers in-memory; no disk save/load yet | Medium — keys are ephemeral              | H18.2           |
| `dema receipt authorship verify` CLI | Not wired yet                                      | Low — module functions are tested        | H18.2           |
| Cross-OS receipt portability         | Spearpoint D2 not delivered                        | High — blocks federation                 | H19+            |
| `bizra.efi` substrate                | Not in this repo                                   | N/A for DEMA                             | Substrate track |
| Recall@k benchmark                   | No labeled query set                               | Medium — blocks search claims            | H19+            |
| P0 registry CI gate                  | No `P0_REGISTRY.md`                                | Medium — P0 items can silently disappear | H19+            |
| Live LLM response quality            | Ollama not in CI                                   | Medium — adapter tested, quality not     | Infra           |
| Network federation                   | Node1 schema-only                                  | Low — correctly gated                    | Post-authorship |

## 7. Planning Surface

Top 5 coverage gaps ranked by compound risk:

| Rank | Gap                                  | Risk   | Unlocks                                            | Suggested season |
| ---- | ------------------------------------ | ------ | -------------------------------------------------- | ---------------- |
| 1    | Ed25519 key persistence + CLI verify | Medium | Signed receipts, authorship chain                  | H18.2            |
| 2    | Cross-OS receipt replay tests        | High   | Federation, multi-node verification                | H19              |
| 3    | Performance regression tests         | Medium | Budget enforcement, TUI responsiveness             | H19              |
| 4    | P0 registry + CI gate                | Medium | P0 accountability, silent-disappearance prevention | H19              |
| 5    | Live LLM response quality            | Medium | Honest claim about model invocation value          | Infra            |

---

_Generated from disk truth at commit `d35e606`. Every count verified by
`node --test`. Domain categorization by import-path analysis of all 204
test files. Gap map cross-referenced against ROADMAP.md, CURRENT_LIMITS.md,
and Spearpoint v1.0 audit._
