#!/usr/bin/env node
import { createNode0Adapter } from "../../../packages/node-adapter/src/node0-adapter.js";
import {
  formatStatus,
  shouldUseColor,
} from "../../../packages/core/src/status.js";
import {
  buildSystemSnapshot,
  formatSystemSnapshot,
} from "../../../packages/core/src/system-snapshot.js";
import { readOperatorPreferredName } from "../../../packages/core/src/operator-profile.js";
import { buildNode0StatePreview } from "../../../packages/core/src/state.js";
import {
  buildProfileFoundationPreview,
  buildProfileFoundationSummary,
} from "../../../packages/core/src/profiles.js";
import { buildConsentCardPreview } from "../../../packages/core/src/consent-card-preview.js";
import {
  buildMissionLoopPreview,
  buildMissionLoopSummary,
} from "../../../packages/core/src/mission-loop-preview.js";
import { buildEvidenceChainEventPreviewFromInputs } from "../../../packages/core/src/evidence-chain-event-preview.js";
import { buildNodeRegistryPreview } from "../../../packages/core/src/node-registry-preview.js";
import { buildOnboardingLifecyclePreview } from "../../../packages/core/src/onboarding-lifecycle.js";
import { buildSkillGrowthGovernorPreview } from "../../../packages/core/src/skill-growth-governor.js";
import { buildProjectStatusPreview } from "../../../packages/core/src/project-status-preview.js";
import { buildCraftsmanshipWitnessPreview } from "../../../packages/core/src/craftsmanship-witness-preview.js";
import {
  auditArtifact,
  formatAuditReport,
} from "../../../packages/core/src/master-craftsmanship-audit.js";
import {
  buildCodebaseArchitectureMap,
  formatCodebaseMapSummary,
} from "../../../packages/core/src/codebase-architecture-map.js";
import {
  CODEBASE_MAP_SAVE_CONSENT,
  serializeCodebaseMapForSave,
  saveCodebaseMap,
} from "../../../packages/receipts/src/codebase-map-save.js";
import { runVerificationPipeline } from "../../../packages/core/src/multi-agent-orchestrator.js";
import {
  PIPELINE_RESULT_SAVE_CONSENT,
  serializePipelineResultForSave,
  savePipelineResult,
} from "../../../packages/receipts/src/pipeline-result-save.js";
import {
  formatOnboardingLifecyclePreview,
  formatNodeRegistryPreview,
  formatSkillGrowthGovernorPreview,
  formatProjectStatusPreview,
  resolveFormatterOptsFromEnv,
} from "../../../packages/core/src/tui-formatter.js";
import { buildLocalLLMRouterPreview } from "../../../packages/core/src/local-llm-router-preview.js";
import {
  buildModelBrokerPreview,
  routeForTask,
} from "../../../packages/models/src/model-broker-preview.js";
import {
  DEFAULT_SAMPLE_REGISTRY,
  buildRegistryFromConfig,
} from "../../../packages/models/src/model-registry-config-preview.js";
import {
  ROUTE_RECEIPT_SAVE_CONSENT,
  serializeRouteReceiptForSave,
  saveRouteReceipt,
} from "../../../packages/receipts/src/route-receipt-save.js";
import { invokeRoutedLocalModel } from "../../../packages/core/src/routed-llm-invocation.js";
import {
  INVOCATION_RESULT_SAVE_CONSENT,
  serializeInvocationResultForSave,
  saveInvocationResult,
} from "../../../packages/receipts/src/invocation-result-save.js";
import {
  VERIFICATION_RESULT_SAVE_CONSENT,
  serializeVerificationResultForSave,
  saveVerificationResult,
} from "../../../packages/receipts/src/verification-result-save.js";
import {
  verifyRoutedInvocationEnvelope,
  readEnvelopeFromFile,
  resolveLatestInvocationPath,
} from "../../../packages/core/src/routed-invocation-verifier.js";
import {
  buildProcessMiningPreview,
  buildProcessMiningSummary,
} from "../../../packages/core/src/process-mining-preview.js";
import {
  buildHarnessIntegration,
  buildHarnessIntegrationSummary,
  formatHarnessIntegration,
} from "../../../packages/core/src/harness-integration.js";
import {
  buildKeyMakerCompliancePreview,
  buildKeyMakerComplianceSummary,
} from "../../../packages/core/src/key-maker-compliance.js";
import {
  buildLLMInvocationPreview,
  buildLLMInvocationSummary,
  invokeLocalLLM,
} from "../../../packages/core/src/llm-adapter.js";
import {
  buildLocalModelInventoryScan,
  buildLocalModelInventorySummary,
} from "../../../packages/core/src/local-model-inventory-scan.js";
import { previewBoundedDiagnostic } from "../../../packages/core/src/mission.js";
import {
  buildMissionDraftPreview,
  formatMissionDraftPreview,
} from "../../../packages/mission/src/mission-draft.js";
import {
  buildDiagnosticsMissionPlan,
  formatDiagnosticsMissionPlan,
} from "../../../packages/mission/src/diagnostics-plan.js";
import { recordTodayTick } from "../../../packages/core/src/today.js";
import {
  listReceipts,
  readReceipt,
  formatReceiptList,
} from "../../../packages/receipts/src/receipt-store.js";
import {
  runSetup,
  checkSetup,
  removeSetup,
} from "../../../packages/installer/src/setup.js";
import {
  saveWitnessReceipt,
  buildWitnessAttestation,
  formatWitnessReceipt,
} from "../../../packages/receipts/src/witness-receipt.js";
import {
  verifyWitnessReceipt,
  findLatestWitness,
  formatWitnessVerification,
} from "../../../packages/receipts/src/witness-verify.js";
import {
  generateEd25519Keypair,
  buildSignedAuthorshipReceipt,
  verifyPayload,
  sha256 as authorshipSha256,
  AUTHORSHIP_SCHEMA,
} from "../../../packages/receipts/src/authorship-signature.js";
import {
  initAuthorshipKey,
  hasAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
} from "../../../packages/receipts/src/authorship-key-store.js";
import {
  signArtifact,
  SIGN_CONSENT_PHRASE,
} from "../../../packages/receipts/src/authorship-sign-command.js";
import {
  getLatestAuthorshipReceiptSummary,
  findLatestAuthorshipReceipt,
} from "../../../packages/receipts/src/authorship-latest.js";
import {
  verifyAuthorshipReceiptFile,
  formatAuthorshipVerification,
} from "../../../packages/receipts/src/authorship-verify.js";
import {
  buildAuthorshipCloseout,
  formatAuthorshipCloseout,
} from "../../../packages/receipts/src/authorship-closeout.js";
import {
  buildProofPassport,
  formatProofPassport,
} from "../../../packages/receipts/src/proof-passport.js";
import {
  verifyProofPassportFile,
  formatProofPassportVerification,
} from "../../../packages/receipts/src/proof-passport-verify.js";
import { verifyProofPassportDeep } from "../../../packages/receipts/src/proof-passport-deep-verify.js";
import { buildUrpLocalIndex } from "../../../packages/urp/src/local-index.js";
import { saveUrpLocalIndex } from "../../../packages/urp/src/local-index-writer.js";
import { listUrpLocalIndexes } from "../../../packages/urp/src/local-index-list.js";
import { verifyUrpLocalIndexFile } from "../../../packages/urp/src/local-index-verify.js";
import {
  gatherDemaRealmState,
  renderDemaRealmHome,
} from "../../../packages/core/src/dema-realm-home.js";
import {
  gatherDemaRealmBoard,
  renderDemaRealmBoard,
} from "../../../packages/core/src/dema-realm-board.js";
import {
  gatherDemaRealmCheckpoint,
  renderDemaRealmCheckpoint,
} from "../../../packages/core/src/dema-realm-checkpoint.js";
import { saveDemaRealmCheckpoint } from "../../../packages/core/src/dema-realm-checkpoint-writer.js";
import {
  gatherDemaRealmCouncil,
  renderDemaRealmCouncil,
} from "../../../packages/core/src/dema-realm-council.js";
import {
  buildHealthSnapshot,
  saveHealthSnapshotReceipt,
  verifyHealthSnapshotReceipt,
  formatHealthSnapshotReceipt,
} from "../../../packages/mission/src/health-snapshot.js";
import { runSetupWizard } from "../../../packages/core/src/setup-wizard.js";
import {
  readMemoryEntry,
  summarizeMemory,
} from "../../../packages/memory/src/memory-store.js";
import {
  formatBanner,
  gatherBannerInputs,
  probeGateway,
} from "../../../packages/core/src/banner.js";
import {
  buildAmbientAuditPreview,
  buildAmbientBoundary,
  buildAmbientManifestPreview,
  formatAmbientAuditPreview,
  formatAmbientBoundary,
  formatAmbientManifestPreview,
} from "../../../packages/core/src/ambient.js";
import {
  buildSovereignJourneyPreview,
  formatSovereignJourneyPreview,
} from "../../../packages/mission/src/journey.js";
import {
  buildSafetyReportPreview,
  formatSafetyReportPreview,
} from "../../../packages/core/src/safety-report.js";
import {
  buildNetworkBlueprint,
  formatNetworkBlueprint,
} from "../../../packages/core/src/network-blueprint.js";
import {
  buildOfflineNetworkFixturePreview,
  formatOfflineNetworkFixturePreview,
} from "../../../packages/core/src/network-fixture-preview.js";
import {
  buildNetworkRefusalMatrixPreview,
  formatNetworkRefusalMatrixPreview,
} from "../../../packages/core/src/network-refusal-matrix-preview.js";
import {
  buildAmanaContractsPreview,
  formatAmanaContractsPreview,
} from "../../../packages/core/src/amana-contracts-preview.js";
import {
  buildFirstRunPlan,
  formatFirstRunPlan,
  summarizeFirstRunOutcome,
} from "../../../packages/core/src/first-run.js";
import {
  gatherDevRoadmapState,
  formatDevRoadmapReport,
} from "../../../packages/core/src/roadmap-dev.js";
import {
  buildMcpIntegrationBlueprint,
  formatMcpIntegrationBlueprint,
} from "../../../packages/core/src/mcp-blueprint.js";
import {
  buildOptimizationRoadmapPreview,
  formatOptimizationRoadmapPreview,
} from "../../../packages/core/src/optimization-roadmap.js";
import {
  buildEvidenceReceiptPreview,
  formatEvidenceReceiptPreview,
} from "../../../packages/verifier/src/evidence-receipt-preview.js";
import {
  DEFAULT_IHSAN_FLOOR,
  evaluateIhsanFloorPreview,
  formatIhsanFloorPreview,
} from "../../../packages/verifier/src/ihsan-floor-preview.js";
import {
  emulateLoopDesign,
  formatLoopDesignEmulation,
} from "../../../packages/core/src/loop-emulator.js";
import {
  buildOnboardingGuide,
  formatOnboardingGuide,
} from "../../../packages/core/src/onboarding.js";
import {
  buildBehavioralModulationPreview,
  formatBehavioralModulationPreview,
} from "../../../packages/core/src/behavioral-modulation.js";
import { runShell } from "../../../packages/core/src/shell.js";
import { TASK_REGISTRY } from "../../../packages/tasks/src/downloads-audit-preview.js";
import {
  formatVerdict,
  verifyReceipt,
} from "../../../packages/verifier/src/sat-placeholder.js";
import {
  buildConsentPlanPreview,
  formatConsentPlanPreview,
} from "../../../packages/consent/src/consent-planner.js";
import {
  collectModelInventory,
  formatModelInventory,
} from "../../../packages/models/src/model-inventory.js";
import {
  highestLevel,
  levelLabel,
  requestApproval,
} from "../../../packages/core/src/approval-gate.js";
import { suggestCommands } from "../../../packages/core/src/command-suggester.js";
import {
  buildExplainPreview,
  formatExplainPreview,
  getPerspective,
} from "../../../packages/core/src/canon-glossary.js";
import {
  shouldShowIntro,
  renderIntroLine,
  recordIntroSeen,
} from "../../../packages/core/src/intro-line.js";
import {
  readBannerKey,
  runBannerKeyLoop,
} from "../../../packages/core/src/banner-keys.js";
import { runLiveHomebase } from "../../../packages/core/src/live-homebase.js";
import { humanizeNextAction } from "../../../packages/core/src/next-action-humanizer.js";
import {
  renderHelpRoot,
  renderHelpTopic,
  renderHelpCommand,
  renderHelpFlat,
  renderHelpUnknown,
} from "../../../packages/core/src/help-topics.js";
import {
  wantsJson,
  humanHintLine,
} from "../../../packages/core/src/output-mode.js";
import {
  resolveMissionReceipt,
  buildCloseoutReport,
  renderCloseoutText,
} from "../../../packages/mission/src/mission-closeout.js";
import {
  runMissionProbe,
  renderProbeText,
} from "../../../packages/mission/src/mission-probe.js";
import {
  buildMissionManifest,
  formatMissionManifest,
} from "../../../packages/mission/src/mission-manifest.js";
import {
  buildThinkDryRun,
  formatThinkDryRun,
} from "../../../packages/think/src/think-dry-run.js";
import {
  buildThinkLive,
  formatThinkLive,
} from "../../../packages/think/src/think-live.js";
import {
  buildThinkCloseout,
  formatThinkCloseout,
} from "../../../packages/think/src/think-closeout.js";
import {
  saveThinkReceipt,
  THINK_RECEIPT_SAVE_CONSENT,
} from "../../../packages/think/src/think-receipt-save.js";
import {
  runThinkProbe,
  renderThinkProbeText,
} from "../../../packages/think/src/think-probe.js";
import {
  evaluatePredicates,
  formatDoctorDashboard,
} from "../../../packages/core/src/doctor-dashboard.js";
import { createSpinner } from "../../../packages/core/src/spinner.js";
import {
  getRubricPack,
  formatRubricPackReport,
} from "../../../packages/core/src/eval-layer2-rubrics.js";
import {
  validatePastedJudgeVerdict,
  formatVerdictReport,
} from "../../../packages/core/src/eval-layer2-verdict-validator.js";

const adapter = createNode0Adapter();

async function statusWithLocalIdentity() {
  const status = await adapter.status();
  if (status?.human) return status;
  const human = await readOperatorPreferredName();
  return human ? { ...status, human } : status;
}

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

const HELP = `Dema CLI

Usage:
  dema              Active kernel — banner + setup-or-status + next safe task
  dema chat         Interactive shell (same surface as the bare CLI)

Orientation:
  dema welcome      Show the first-run orientation
  dema onboard [--json]
                    Guided zero-technical onboarding path; preview-only
  dema explain [<concept>]
                    Plain-language definition of a BIZRA/Dema concept (28 known)
  dema setup        Create local Dema folders/profile skeleton
  dema setup-check  Verify install integrity (paths + sha256 hashes)
  dema uninstall [--dry-run]
                    Remove local Dema data; requires --consent with exact phrase
  dema witness [--dry-run] [--json]
                    Node0 self-witness receipt; requires --consent to save
  dema witness verify [--file <path>] [--json]
                    Verify a witness receipt (latest or by path)
  dema mission run health [--dry-run] [--json]
                    Node0 health snapshot mission; requires --consent to save
  dema mission verify <path> [--json]
                    Verify a mission receipt
  dema authorship key init [--json]
                    Generate and persist Ed25519 keypair (requires --consent)
  dema authorship sign <artifact-path> [--json]
                    Sign a local artifact (requires --consent)
  dema authorship latest [--json]
                    Show the most recent authorship receipt (read-only)
  dema authorship closeout [--json]
                    Closeout summary: discover + verify latest receipt
  dema authorship verify <receipt.json> | --latest [--json]
                    Verify an Ed25519-signed authorship receipt (by path or latest)
  dema authorship demo [--json]
                    Generate ephemeral keypair, sign, verify (no disk write)

Proof:
  dema proof passport [--json]
                    Generate portable proof passport from local receipts
  dema proof passport verify <passport.json> [--deep] [--receipts-dir <dir>] [--json]
                    Verify a proof passport. Default: envelope only (hash + structure
                    + boundary). With --deep: also re-verifies each referenced
                    authorship receipt file against passport metadata.

URP:
  dema urp index --passport <passport.json> [--receipts-dir <dir>] [--json]
                    Build + persist a local content-addressed URP index from a
                    verified proof passport. LOCAL_INDEX_ONLY · MARKED_LOCAL_ONLY.
                    No share, no mint, no PoI, no federation, no network.
  dema urp list [--json]
                    Enumerate locally-persisted URP indexes under
                    $DEMA_HOME/urp/indexes/, verifying filename↔hash parity
                    per entry. Read-only. Exit 1 only on detected corruption.
  dema urp verify <index.json> [--json]
                    Verify a single local index file by path: schema +
                    body-hash recompute + filename↔hash parity + forbidden-
                    field check. Read-only. Exit 0 on VERIFIED, 1 on FAILED.

Dema Realm (UX-1A, UX-1B):
  dema realm [--json] [--no-color]
                    Wake Node0. 7-step boot sequence + BIZRA NODE0 · DEMA HOME
                    frame + 5 menu placeholders. Truth-labeled (DECLARED for
                    surfaces with no runtime yet). Read-only. No mutation, no
                    network. Menu dispatch is preview-only in v0 (UX-2A wires it).
  dema realm board [--json] [--no-color]
                    The 6-stage BIZRA lifecycle quest board: SEED · PREFLIGHT ·
                    FORGE · VERIFY · CLOSEOUT · ARCHIVE. Reads operator-curated
                    DEMA_HOME/realm/quest-board.json if present, else uses
                    built-in default reflecting the actual session ledger. Per-
                    quest status (DONE/ACTIVE/NEXT/READY/BLOCKED) honestly
                    labeled. Read-only.
  dema realm council [--json] [--no-color]
                    UX-1D Council Chamber: 5 declared council profiles —
                    Guardian (boundary/consent/risk), Reasoner (SAPE/graph
                    thinking), Builder (implementation/tests), Critic (self-
                    review/red-team), Archivist (receipts/memory/truth).
                    Profiles are DECLARED, NOT runtime-backed. Read-only.
  dema realm checkpoint [--json] [--no-color]
                    Checkpoint Journal v0 — where you stopped, what resumes.
                    Reads DEMA_HOME/realm/last-checkpoint.json + optional
                    DEMA_HOME/realm/timeline.json. Honest CHECKPOINT_ABSENT
                    state when no file. Read-only.
  dema realm checkpoint save --label "<text>"
                              [--stage <SEED|PREFLIGHT|FORGE|VERIFY|CLOSEOUT|ARCHIVE>]
                              [--next-gear <text>] [--resume "<cmd>"]
                              [--timeline-label <text>] [--json]
                    UX-2B persistence writer. Overwrites
                    DEMA_HOME/realm/last-checkpoint.json (atomic, mode 0o600)
                    AND appends one event to DEMA_HOME/realm/timeline.json
                    (append-only). Operator memory aid; no consent required.
                    Boundary honestly declares file_write_performed:true and
                    mutation_performed:true.

Readiness:
  dema status       Show human-readable Node0 status
  dema status:json  Show machine-readable status
  dema today        Record a local continuity tick + memory summary
  dema doctor       Validate readiness and consent gate
  dema dashboard    Open homebase dashboard in browser [--json for path only]

Preview planning:
  dema ambient      Show Ambient Sovereign Execution boundary (preview-only)
  dema ambient:json Show the ambient boundary as schema-tagged JSON
  dema diagnostics plan [--json]
                    Preview self-diagnostics harness; does not run checks
  dema consent plan [--json] "<intent>"
                    Preview a micro-consent scope; does not approve or execute
  dema mission draft [--json] "<intent>"
                    Preview Intent -> MissionDraft -> ConsentPlan
  dema mission propose [--consent "GO: Node0 bounded diagnostic activation only"]
                    Preview ARTIFACT-011 readiness; does not execute runtime
  dema model-broker route --task <kind> [--required-role <role>]
                          [--no-local-only] [--allow-unknown] [--max-size <class>]
                          [--registry-stdin | --use-local-registry | --registry-file <abs-path>]
                          [--save-receipt --consent "GO: save local model route receipt"]
                          [--invoke --prompt "<text>"
                                    --invoke-consent "GO: invoke local LLM at <selected_model_id>"
                                    [--timeout-ms <n>]
                                    [--save-invocation-result
                                     --save-invocation-consent "GO: save local model invocation result"]]
                          [--pretty]
                    Route a task through the local model broker preview;
                    emits a bizra.dema.local_model_route_receipt.v0.1 JSON to stdout.
                    Default registry is DEFAULT_SAMPLE_REGISTRY (placeholders only -> routes nothing).
                    --save-receipt (with exact --consent) persists the route receipt to
                    $DEMA_HOME/receipts/route-<sha256>.json (atomic; NOT canonical mint).
                    --invoke runs the routed local-LLM invocation through the existing adapter
                    (localhost-only, model-whitelist, prompt-length-bounded, exact-consent).
                    --invoke REQUIRES --save-receipt (route durability before invocation).
                    --invoke REQUIRES --prompt and --invoke-consent. In invoke mode, stdout
                    emits a bizra.dema.local_model_routed_invocation_result.v0.1 envelope
                    instead of the bare route receipt.
                    --save-invocation-result (with exact --save-invocation-consent) persists
                    the envelope to $DEMA_HOME/receipts/invocation-<sha256>.json (atomic;
                    preview-grade; NOT canonical chain-bound mint). Saves both success and
                    failure envelopes for audit. Requires --invoke (nothing to save without
                    an invocation envelope).
                    Does NOT call remote endpoints. NO PAT/SAT swarm. NO URP. NO token/economy.
  dema model-broker verify-invocation
                          [--invocation-result-file <abs-path> | --latest]
                          [--save-verification-result
                           --save-verification-consent "GO: save local model invocation verification"]
                          [--pretty]
                    Deterministic invariant checker for a saved routed invocation envelope.
                    Reads a saved invocation-<sha256>.json file (--invocation-result-file abs path,
                    or --latest reads newest from $DEMA_HOME/receipts/) and emits a
                    bizra.dema.local_model_routed_invocation_verification.v0.1 JSON envelope
                    with verdict (compliant/non_compliant), 17 invariant probes, evidence quality,
                    self-critique, warnings, and a canonical next_step recommendation.
                    --save-verification-result (with exact --save-verification-consent) persists
                    the verification envelope to $DEMA_HOME/receipts/verification-<sha256>.json
                    (atomic; saves both compliant and non_compliant for audit). Saved file
                    matches stdout byte-for-byte.
                    NOT canonical SAT-1..5 verification. NOT chain-bound mint. No model invocation.
                    No network. No mutation.

Local evidence:
  dema receipts     List local receipts
  dema receipts ID  Show by ID, artifact ID, exact path, or unique filename
  dema memory       List local memory entries (profile + ~/.dema/memory/*)
  dema memory show NAME
                    Show one memory entry by name (e.g. profile, bizra-context)
  dema models       Show local model inventory (read-only; no inference)
  dema models scan [--summary]
                    C1.5 · schema-tagged local model inventory scan (Ollama API · LM Studio API · GGUF files · HF cache · /data/bizra)
                    Read-only · no model load · no prompt execution · no public network · canonical 16-key boundary
  dema report safety [--json]
                    Preview the safety report; does not certify, execute, or mint
  dema network blueprint [--json]
                       Preview Node1/Node2 and phase-gated readiness; no federation
  dema network fixture preview [--json]
                       Preview offline 5-slot fixture; no sockets or mint
  dema network refusal preview [--json]
                       Preview partition/rejoin refusal matrix; no sockets or mint
  dema amana contracts preview [--json]
                        Preview Amana contract primitives; imports no external code
  dema mcp blueprint [--json]
                       Preview MCP integration contract; does not call MCP tools
  dema roadmap preview [--json]
                      Preview optimization roadmap; does not execute or enforce gates
  dema roadmap dev [--json]
                      Live dev anchor (branch · HEAD · dirty · main vs origin · recent on main · feat/* branches · anchor-doc presence); read-only
  dema eval layer2 prompts [--json]
                      Emit Layer 2 rubric pack (truthfulness · actionability · boundary_compliance); data-only, no LLM invocation
  dema eval layer2 verify <abs-path> [--json]
                      Validate an operator-pasted Layer 2 judge verdict file; structural + semantic checks; read-only; exit 1 on validation failure
  dema evidence receipt preview [--json]
                      Preview receipt-shaped evidence; does not mint, sign, or write
  dema ihsan floor preview [--score N] [--json]
                      Preview externally supplied Ihsan floor check; does not certify
  dema behavior modulation preview [--consent TEXT] [--score N] [--json] "<intent>"
                      Preview visible guidance modulation; does not apply behavior changes
  dema design emulate-loop [--json]
                      Preview PAT/SAT loop design assumptions; does not run agents

Spine preview surfaces (canonical 16-key boundary · NODE0_LOCAL_SEED):
  dema state               Node0 state preview; mission_centered + runtime/federation/mint=false
  dema profiles [--summary]
                           Profile foundation (User/PAT/SAT/Mission/ContextCapsule)
  dema consent-card        Consent card preview; allowed/blocked effects + decision options
  dema mission-loop [--summary]
                           Full lifecycle preview; preview_lifecycle_status pinned HOLD
  dema evidence-event      EvidenceChain event preview; chain_advance=false; hash-only refs
  dema node-registry [--pretty]
                           Node ordinal registry preview (v0.1e+f); accepted + ghost slots; no federation, no node_connection. --pretty = ANSI TUI render
  dema onboarding-lifecycle [--json]
                           Onboarding lifecycle preview (v0.1) · 7-stage flow (language→tech-level→node-role→purpose→resources→consent-constitution→first-mission) · ANSI TUI on TTY · JSON in --json or non-TTY
  dema skill-growth-governor [--json]
                           Skill Growth Governor preview (v0.1) · 5 promotion gates + 8 refusals · 4-line law: no learning without evaluation, no evaluation without evidence, no skill promotion without receipt, no overwrite without human consent
  dema project-status [--json]
                           Project Status preview (v0.1 · PMBOK 7th-edition-aligned) · stakeholders + value stream + risk register + quality posture + 12 principles · companion to docs/pm/PROJECT_CHARTER_AND_STATUS.md
  dema llm-router          Local LLM router preview; routing_allowed=false; abstain by default
  dema harness [--summary] [--json]
                           Unified harness integration; aggregates self-proactive, self-critique, micro-compliance, micro-consent + hook inventory
  dema process-mining [--summary]
                           Operator-pattern mirror; surfaces ring_advancement_status; blocks operator_judgment
  dema key-maker-check [--door "<text>"] [--summary]
                           Self-audits reasoning shape against the 5 Key Maker invariants; fails closed when violated
  dema llm-invoke [--model NAME --prompt TEXT] [--invoke --consent "GO: invoke local LLM at NAME"] [--summary]
                           C1 · local LLM adapter · preview-only by default; --invoke + exact consent calls Ollama at localhost
  dema master-craftsmanship audit [--json] [<path>]
                           External audit of any artifact against the 10 master-craftsmanship invariants. Default subject: tests/node-onboarding-adr011-compliance.test.js. Verdict: COMPLIANT (10/10) | PARTIAL (N/10) | NON-COMPLIANT. Exits 1 on non-compliant or missing path.
  dema orchestrator verify [--invocation-file <abs-path> | --latest] [--pretty]
                           [--save-pipeline-result --save-pipeline-consent "GO: save local orchestrator pipeline result"]
                           v0.1 SAT-1..5 pipeline exposure. Reads a saved invocation envelope and pipes it through the existing runVerificationPipeline() (multi-agent-orchestrator.js). Emits bizra.dema.orchestrator_verification_pipeline.v0.1 to stdout with per-SAT verdicts + aggregate verdict. Optional --save-pipeline-result persists to $DEMA_HOME/receipts/pipeline-<sha256>.json (atomic; preview-grade; saves both passed and non-passed pipelines). NOT chain-bound mint. NOT PAT execution. NO model invocation. NO network. NO URP. NO token/economy.
  dema codebase map <abs-path>
                           [--summary] [--json] [--max-files N] [--max-depth N] [--max-file-size N]
                           [--include-tests] [--hotspots] [--exclude PAT] [--no-default-exclude]
                           [--save-map --save-map-consent "GO: save local codebase architecture map"]
                           Read-only architecture map for any target repo (v0.1). Iterative bounded walker · stdlib only · deterministic. Default JSON (bizra.dema.codebase_architecture_map.v0.1) to stdout. --summary emits compact human summary. --hotspots enables content-reading hotspot probes. .env*, *secret*, *credential*, *.pem/.key/.crt/.p12, id_rsa* recorded as metadata only. Symlinks recorded but never followed. --save-map (with exact --save-map-consent) persists the envelope to $DEMA_HOME/receipts/codebase-map-<sha256>.json (atomic; 256 MiB serialized cap; preview persistence; NOT canonical chain-bound mint). --save-map cannot combine with --summary unless --json is also passed. NOT a model. NO network. NO mutation. NO chain-bound mint. NO PAT/SAT swarm. NO URP. NO token/economy.

Tasks and views:
  dema task         List registered tasks
  dema task NAME    Run a registered task (read-only in v{{DEMA_VERSION}})
  dema sovereign    Render local Sovereign Mission Interface (view-only)
  dema monetize     Show proof-safe first offer boundary
  dema help         Show this list

Dema v{{DEMA_VERSION}} — Active Command Kernel. Local-first. Consent-bound. Receipt-aware.`;

// Top-level tokens the switch handles. Used by the command suggester only.
const REGISTERED_COMMANDS_LIST = [
  { command: "status", description: "show Node0 readiness" },
  { command: "status:json", description: "machine-readable status" },
  { command: "state", description: "Node0 state preview" },
  { command: "profiles", description: "profile foundation preview" },
  { command: "consent-card", description: "consent card preview" },
  { command: "mission-loop", description: "full mission lifecycle preview" },
  { command: "evidence-event", description: "evidence chain event preview" },
  { command: "node-registry", description: "node ordinal registry preview" },
  {
    command: "onboarding-lifecycle",
    description: "onboarding lifecycle preview",
  },
  {
    command: "skill-growth-governor",
    description: "skill growth governor preview",
  },
  { command: "project-status", description: "project status preview" },
  {
    command: "craftsmanship-witness",
    description: "master-craftsmanship creation preview",
  },
  {
    command: "master-craftsmanship",
    description:
      "audit an artifact against the 10 master-craftsmanship invariants",
  },
  {
    command: "codebase",
    description:
      "read-only architecture map of any target repo (subcommand: map <abs-path>)",
  },
  {
    command: "orchestrator",
    description:
      "run the SAT-1..5 verification pipeline on a saved invocation envelope (subcommand: verify)",
  },
  { command: "llm-router", description: "local LLM router preview" },
  { command: "harness", description: "unified harness integration" },
  { command: "process-mining", description: "operator-pattern mirror" },
  {
    command: "key-maker-check",
    description: "self-audit reasoning against Key Maker invariants",
  },
  {
    command: "llm-invoke",
    description: "local LLM adapter (preview or live call)",
  },
  { command: "today", description: "record a local continuity tick" },
  { command: "doctor", description: "validate readiness and consent gate" },
  { command: "dashboard", description: "open homebase dashboard in browser" },
  {
    command: "ambient",
    description: "show Ambient Sovereign Execution boundary",
  },
  { command: "ambient:json", description: "ambient boundary as JSON" },
  { command: "diagnostics", description: "preview self-diagnostics harness" },
  { command: "consent", description: "preview a micro-consent scope" },
  { command: "mission", description: "preview mission draft or propose" },
  { command: "receipts", description: "list or show local receipts" },
  {
    command: "authorship",
    description: "verify or demo Ed25519 authorship receipts",
  },
  { command: "proof", description: "generate portable proof passport" },
  {
    command: "memory",
    description:
      "list/show local memory entries · query BIZRA Omega AgentDB (MC-A)",
  },
  { command: "models", description: "show local model inventory" },
  { command: "report", description: "preview safety report" },
  {
    command: "network",
    description: "preview network blueprint or refusal matrix",
  },
  { command: "amana", description: "preview Amana contract primitives" },
  { command: "mcp", description: "preview MCP integration contract" },
  { command: "roadmap", description: "preview optimization roadmap" },
  {
    command: "eval",
    description:
      "Layer 2 LLM-as-judge surfaces (subcommands: layer2 prompts | layer2 verify <abs-path>)",
  },
  { command: "evidence", description: "preview evidence receipt" },
  { command: "ihsan", description: "preview Ihsan floor check" },
  { command: "behavior", description: "preview behavioral modulation" },
  { command: "design", description: "preview PAT/SAT loop design assumptions" },
  { command: "task", description: "list or run registered tasks" },
  { command: "monetize", description: "show proof-safe first offer boundary" },
  { command: "sovereign", description: "render Sovereign Mission Interface" },
  { command: "language", description: "set or show preferred language" },
  { command: "welcome", description: "show first-run orientation" },
  { command: "onboard", description: "guided onboarding path" },
  {
    command: "explain",
    description: "plain-language definition of a BIZRA/Dema concept (28 known)",
  },
  {
    command: "setup",
    description: "create local Dema folders/profile skeleton",
  },
  {
    command: "setup-check",
    description: "verify local Dema install integrity (hashes + paths)",
  },
  {
    command: "uninstall",
    description: "remove local Dema data (consent-gated)",
  },
  {
    command: "witness",
    description: "Node0 self-witness receipt (consent-gated)",
  },
  { command: "help", description: "show full command list" },
];

async function readPackageVersion() {
  const { readFile } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const { dirname: vDir, join: vJoin } = await import("node:path");
  const here = vDir(fileURLToPath(import.meta.url));
  const pkgPath = vJoin(here, "..", "..", "..", "package.json");
  try {
    const raw = await readFile(pkgPath, "utf8");
    return JSON.parse(raw).version ?? "0.0.0-unknown";
  } catch {
    return "0.0.0-unknown";
  }
}

async function renderFullHelp() {
  const version = await readPackageVersion();
  return renderHelpFlat(HELP.replaceAll("{{DEMA_VERSION}}", version));
}

async function dispatch(argv) {
  const command = argv[0] ?? "active";
  const subcommand = argv[1];

  // --version / -v intercept (top-level flag OR explicit command).
  // Returns the package.json version so a release manifest is verifiable
  // from CLI without parsing it externally. JSON output via --json.
  if (
    command === "--version" ||
    command === "-v" ||
    command === "version" ||
    argv.includes("--version")
  ) {
    const version = await readPackageVersion();
    if (argv.includes("--json")) {
      console.log(
        JSON.stringify(
          { schema: "bizra.dema.cli_version.v0.1", name: "dema", version },
          null,
          2,
        ),
      );
    } else {
      console.log(`dema ${version}`);
    }
    return;
  }

  // Homebase TUI v0.1 phases 4+5 dispatch · 14th canonical spine surface.
  // Bare `dema` routes to either:
  //   · TTY → ANSI homebase frame (phase-4 · static render · v0.1a)
  //   · non-TTY / --json / DEMA_NO_TUI / NODE_ENV=test → JSON form (phase-5)
  // The active-kernel interactive shell remains accessible via explicit
  // `dema chat` or `dema --interactive` opt-outs (preserved for backwards-compat).
  // v0.1 ships the STATIC frame · no interactive keypress · no affordance
  // spawn · operator types subcommands explicitly (e.g., `dema receipts`).
  // Interactive layer deferred to v0.2 with explicit ADR for the dep decision.
  const isBareInvocation =
    (command === "active" || command === "" || command === "--json") &&
    !argv.includes("--chat") &&
    !argv.includes("--interactive");
  if (isBareInvocation) {
    const wantJson =
      argv.includes("--json") ||
      !process.stdout.isTTY ||
      Boolean(process.env.DEMA_NO_TUI) ||
      process.env.NODE_ENV === "test";
    const { join: pathJoin } = await import("node:path");
    const { homedir } = await import("node:os");
    const demaHome = process.env.DEMA_HOME || pathJoin(homedir(), ".dema");
    const showIntro = await shouldShowIntro({ home: demaHome });
    if (showIntro) {
      // In JSON mode write intro to stderr so stdout stays machine-parseable.
      const introStream = wantJson ? process.stderr : process.stdout;
      introStream.write(renderIntroLine() + "\n\n");
      await recordIntroSeen({ home: demaHome });
    }
    const [{ gather }, { buildHomebasePreview }] = await Promise.all([
      import("../../../packages/core/src/homebase-gather.js"),
      import("../../../packages/core/src/homebase-preview.js"),
    ]);
    const gathered = await gather();
    const preview = buildHomebasePreview({ gather: gathered });
    if (wantJson) {
      process.stdout.write(JSON.stringify(preview, null, 2) + "\n");
      return;
    }
    // TTY path · render ANSI frame via existing zero-dep formatter.
    const [{ formatHomebasePreview }, { resolveFormatterOptsFromEnv }] =
      await Promise.all([
        import("../../../packages/core/src/tui-formatter.js"),
        import("../../../packages/core/src/tui-formatter.js"),
      ]);
    const opts = resolveFormatterOptsFromEnv(process.env);
    process.stdout.write(formatHomebasePreview(preview, opts) + "\n");

    const bannerInteractive =
      process.stdin.isTTY &&
      process.stdout.isTTY &&
      process.env.DEMA_BANNER_INTERACTIVE !== "0";

    if (bannerInteractive) {
      const liveMode = process.env.DEMA_HOMEBASE_LIVE !== "0";
      if (liveMode) {
        await runLiveHomebase({
          gatherFn: gather,
          buildPreviewFn: buildHomebasePreview,
          dispatchFn: dispatch,
          stdin: process.stdin,
          stdout: process.stdout,
          opts,
        });
      } else {
        await runBannerKeyLoop({
          readKey: readBannerKey,
          dispatchFn: dispatch,
          readKeyOpts: { stdin: process.stdin, stdout: process.stdout },
        });
      }
    }
    return;
  }

  switch (command) {
    case "active":
    case "":
      return runActiveKernel({ interactive: process.stdin.isTTY });

    case "chat":
      return runActiveKernel({ interactive: true, force: true });

    case "welcome":
      console.log(formatOnboardingGuide(buildOnboardingGuide()));
      return;

    case "first-run": {
      const dryRun = argv.includes("--dry-run");
      const wantJson = argv.includes("--json");
      const plan = buildFirstRunPlan({ dry_run: dryRun });

      if (wantJson && argv.includes("--plan-only")) {
        console.log(JSON.stringify(plan, null, 2));
        return;
      }

      // Human header. In JSON mode we still emit the header on stderr so
      // stdout stays machine-parseable.
      const headerStream = wantJson ? process.stderr : process.stdout;
      headerStream.write(formatFirstRunPlan(plan) + "\n\n");

      // Step 1: welcome
      headerStream.write("==> 1. Welcome\n");
      headerStream.write(
        formatOnboardingGuide(buildOnboardingGuide()) + "\n\n",
      );

      // Step 2: setup (skipped under --dry-run)
      headerStream.write("==> 2. Setup\n");
      if (dryRun) {
        headerStream.write(
          "[dry-run] would call runSetup() · would create ~/.dema/ if missing\n\n",
        );
      } else {
        const result = await runSetup();
        headerStream.write(JSON.stringify(result, null, 2) + "\n\n");
      }

      // Step 3: status
      headerStream.write("==> 3. Status\n");
      const status = await statusWithLocalIdentity();
      const color = !argv.includes("--no-color") && shouldUseColor();
      headerStream.write(formatStatus(status, { color }) + "\n\n");

      // Step 4: doctor
      headerStream.write("==> 4. Doctor\n");
      const predicates = evaluatePredicates(status);
      const noColor =
        Boolean(process.env.NO_COLOR) ||
        process.env.TERM === "dumb" ||
        argv.includes("--no-color");
      headerStream.write(
        formatDoctorDashboard(predicates, { color: !noColor }) + "\n\n",
      );

      // Step 5: next safe action
      headerStream.write("==> 5. Next safe action\n");
      const outcome = summarizeFirstRunOutcome({
        status,
        predicates,
        dry_run: dryRun,
      });
      headerStream.write(outcome.suggested_next + "\n");

      if (wantJson) {
        // stdout payload (machine-parseable) — separate from human header.
        console.log(
          JSON.stringify({ plan, outcome, predicates, status }, null, 2),
        );
      }

      // first-run exit semantics: the COMMAND succeeded if it walked all 5
      // steps. Doctor verdicts are informational and surfaced via
      // outcome.suggested_next, not via exit code. The operator should
      // never see a "first-run failed" error simply because the system
      // is not yet fully ready — that's exactly the state first-run is
      // designed to help diagnose.
      process.exitCode = 0;
      return;
    }

    case "onboard": {
      if (argv.includes("--preview-card")) {
        const { join: pcJoin } = await import("node:path");
        const { homedir: pcHd } = await import("node:os");
        const { buildGenesisPreviewCard } =
          await import("../../../packages/core/src/genesis-preview-card.js");
        const { writeGenesisPreviewCard, readOperatorLanguage } =
          await import("../../../packages/core/src/operator-profile.js");
        const pcHome = process.env.DEMA_HOME || pcJoin(pcHd(), ".dema");
        const langResult = await readOperatorLanguage(pcHome);
        const timestamp = new Date().toISOString();
        const card = buildGenesisPreviewCard({
          candidate: {
            primary_language: langResult.language_code,
            secondary_language: langResult.secondary_language_code,
          },
          timestamp,
        });
        await writeGenesisPreviewCard({ home: pcHome, card });
        if (argv.includes("--json")) {
          console.log(JSON.stringify(card, null, 2));
        } else {
          console.log(`Genesis Preview Card`);
          console.log(`  schema:             ${card.schema}`);
          console.log(`  mode:               ${card.mode}`);
          console.log(`  truth_label:        ${card.truth_label}`);
          console.log(
            `  receipt_id_preview: ${card.would_mint_if_consented.receipt_id_preview}`,
          );
          console.log(
            `  consent_phrase:     ${card.would_mint_if_consented.consent_phrase_required}`,
          );
          console.log(`  stored_at:          ${card.card_storage.path}`);
          console.log(
            `\nNo mint has occurred. Type the consent phrase to mint (separate typed-GO required).`,
          );
        }
        return;
      }
      const guide = buildOnboardingGuide();
      console.log(
        argv.includes("--json")
          ? JSON.stringify(guide, null, 2)
          : formatOnboardingGuide(guide),
      );
      return;
    }

    case "preview-card": {
      const { join: pcJoin2 } = await import("node:path");
      const { homedir: pcHd2 } = await import("node:os");
      const { readGenesisPreviewCards } =
        await import("../../../packages/core/src/operator-profile.js");
      const pcHome2 = process.env.DEMA_HOME || pcJoin2(pcHd2(), ".dema");

      if (!subcommand || subcommand === "show") {
        // dema preview-card show [<receipt_id_preview>] [--json]
        const hashArg = argv[2] && !argv[2].startsWith("--") ? argv[2] : null;
        const wantJson2 = argv.includes("--json");
        const cards = await readGenesisPreviewCards(pcHome2);

        if (hashArg) {
          const match = cards.find(
            (c) => c?.would_mint_if_consented?.receipt_id_preview === hashArg,
          );
          if (!match) {
            console.log(`preview-card: card not found for hash ${hashArg}`);
            return;
          }
          console.log(
            wantJson2
              ? JSON.stringify(match, null, 2)
              : `receipt_id_preview: ${match.would_mint_if_consented.receipt_id_preview}`,
          );
          return;
        }

        if (cards.length === 0) {
          console.log("no preview cards stored yet");
          return;
        }

        if (wantJson2) {
          console.log(JSON.stringify(cards, null, 2));
          return;
        }
        for (const c of cards) {
          console.log(
            `  ${c?.would_mint_if_consented?.receipt_id_preview ?? "unknown"}`,
          );
        }
        return;
      }
      return;
    }

    case "language": {
      const { join: pathJoin } = await import("node:path");
      const { homedir: hd } = await import("node:os");
      const { readOperatorLanguage } =
        await import("../../../packages/core/src/operator-profile.js");
      const { resolveOperatorLanguage, LANGUAGE_OPTIONS } =
        await import("../../../packages/core/src/homebase-language-picker.js");
      const langHome = process.env.DEMA_HOME || pathJoin(hd(), ".dema");

      // dema language show [--json]
      if (subcommand === "show") {
        const result = await readOperatorLanguage(langHome);
        if (argv.includes("--json")) {
          console.log(
            JSON.stringify(
              {
                schema: "bizra.dema.language_state.v0.1",
                language_code: result.language_code,
                secondary_language_code: result.secondary_language_code,
                source: result.source,
              },
              null,
              2,
            ),
          );
          return;
        }
        if (result.source === "absent" || result.language_code === null) {
          console.log(
            "Language: not set yet. Run `dema language` to set your preferred language.",
          );
        } else {
          const opt = LANGUAGE_OPTIONS.find(
            (o) => o.code === result.language_code,
          );
          const label = opt ? opt.label : result.language_code;
          console.log(`Language: ${label} (${result.language_code})`);
          if (result.secondary_language_code) {
            const opt2 = LANGUAGE_OPTIONS.find(
              (o) => o.code === result.secondary_language_code,
            );
            const label2 = opt2 ? opt2.label : result.secondary_language_code;
            console.log(
              `Secondary: ${label2} (${result.secondary_language_code})`,
            );
          }
        }
        return;
      }

      // dema language [--reset] — interactive picker
      const resetLanguage =
        argv.includes("--reset") || subcommand === "--reset";
      const picked = await resolveOperatorLanguage({
        home: langHome,
        stdin: process.stdin,
        stdout: process.stdout,
        resetLanguage,
        skipPrompt: false,
      });
      if (argv.includes("--json")) {
        console.log(JSON.stringify(picked, null, 2));
      }
      return;
    }

    case "explain": {
      // Parse perspective flags — these are mutually exclusive; last one wins.
      const PERSP_FLAGS = [
        "--simple",
        "--technical",
        "--arabic",
        "--game",
        "--all",
      ];
      let perspFlag = null;
      for (const f of PERSP_FLAGS) {
        if (argv.includes(f)) perspFlag = f;
      }
      const wantJson = argv.includes("--json");

      // Strip all flags to isolate the concept token.
      const conceptArgs = argv.slice(1).filter((a) => !a.startsWith("--"));
      const concept = conceptArgs[0] ?? null;

      // No-flag default behaves identically to --simple (preserves existing behavior).
      if (!perspFlag || perspFlag === "--simple") {
        const preview = buildExplainPreview(concept);
        if (wantJson) {
          // Add perspectives map (simple only) for JSON output.
          const persp = concept
            ? {
                simple:
                  getPerspective(concept, "simple") ?? preview.short ?? null,
              }
            : undefined;
          const out =
            persp !== undefined ? { ...preview, perspectives: persp } : preview;
          console.log(JSON.stringify(out, null, 2));
          return;
        }
        console.log(formatExplainPreview(preview));
        if (concept === "dema") {
          const { join: pj } = await import("node:path");
          const { homedir: hd } = await import("node:os");
          const explainHome = process.env.DEMA_HOME || pj(hd(), ".dema");
          await recordIntroSeen({
            home: explainHome,
            suppressedBy: "user-explain",
          });
        }
        return;
      }

      // --all, --technical, --arabic, --game paths require a concept.
      const preview = buildExplainPreview(concept);

      // Listing or not-found fall through to standard formatter for these flags too.
      if (!concept || preview.mode === "listing" || preview.matched === false) {
        console.log(formatExplainPreview(preview));
        return;
      }

      const PERSPECTIVES_ORDER = ["simple", "technical", "game", "arabic"];

      if (perspFlag === "--all") {
        if (wantJson) {
          const perspMap = {};
          for (const p of PERSPECTIVES_ORDER) {
            const t = getPerspective(concept, p);
            if (t !== null) perspMap[p] = t;
          }
          console.log(
            JSON.stringify({ ...preview, perspectives: perspMap }, null, 2),
          );
          return;
        }
        const lines = [preview.title, ""];
        for (const p of PERSPECTIVES_ORDER) {
          const text = getPerspective(concept, p);
          lines.push(`── ${p.toUpperCase()} ──`);
          if (text !== null) {
            lines.push("  " + text);
          } else {
            lines.push(
              `  ⚠ The ${p} perspective for this concept is not yet authored.`,
            );
          }
          lines.push("");
        }
        lines.push(`  Truth label: ${preview.truth_label}`);
        if (preview.see_also && preview.see_also.length > 0) {
          lines.push("");
          lines.push("  See also: " + preview.see_also.join(", "));
        }
        console.log(lines.join("\n"));
        return;
      }

      // Single named perspective: --technical, --arabic, --game.
      const perspName = perspFlag.slice(2); // strip leading "--"
      const text = getPerspective(concept, perspName);

      if (wantJson) {
        const perspMap = text !== null ? { [perspName]: text } : {};
        console.log(
          JSON.stringify({ ...preview, perspectives: perspMap }, null, 2),
        );
        return;
      }

      if (text === null) {
        const available = PERSPECTIVES_ORDER.filter(
          (p) => getPerspective(concept, p) !== null,
        );
        console.log(
          [
            preview.title,
            "  " + (getPerspective(concept, "simple") ?? preview.short),
            "",
            `  ⚠ The ${perspName} perspective for this concept is not yet authored.`,
            `  Available perspectives: ${available.join(", ") || "simple"}`,
            `  Type \`dema explain ${concept}\` for the simple form, or`,
            `       \`dema explain --all ${concept}\` for all available perspectives.`,
          ].join("\n"),
        );
        return;
      }

      console.log(
        [
          preview.title,
          "  " + text,
          "",
          `  Truth label: ${preview.truth_label}`,
          preview.see_also && preview.see_also.length > 0
            ? "  See also: " + preview.see_also.join(", ")
            : null,
        ]
          .filter(Boolean)
          .join("\n"),
      );
      return;
    }

    case "setup": {
      const isJsonMode = argv.includes("--json") || !process.stdout.isTTY;
      if (isJsonMode) {
        console.log(JSON.stringify(await runSetup(), null, 2));
      } else {
        await runSetupWizard();
        await runSetup();
      }
      return;
    }

    case "setup-check": {
      const result = await checkSetup();
      console.log(JSON.stringify(result, null, 2));
      if (result.verdict !== "INTACT") process.exitCode = 1;
      return;
    }

    case "uninstall": {
      const consent = argValue(argv, "--consent") ?? "";
      const dryRun = argv.includes("--dry-run");
      const result = await removeSetup(undefined, { consent, dryRun });
      console.log(JSON.stringify(result, null, 2));
      if (!result.removed && result.reason !== "dry_run") process.exitCode = 1;
      return;
    }

    case "witness": {
      const subCmd = argv[1] ?? "";
      if (subCmd === "verify") {
        const filePath = argValue(argv, "--file") ?? "";
        const wantJsonV = argv.includes("--json") || !process.stdout.isTTY;
        const receiptPath = filePath || (await findLatestWitness());
        if (!receiptPath) {
          console.error(
            'No witness receipt found. Run `dema witness --consent "WITNESS NODE0 STATE"` first.',
          );
          process.exitCode = 1;
          return;
        }
        const vResult = await verifyWitnessReceipt(receiptPath);
        if (wantJsonV) {
          console.log(JSON.stringify(vResult, null, 2));
        } else {
          console.log(formatWitnessVerification(vResult));
        }
        if (vResult.verdict !== "VERIFIED") process.exitCode = 1;
        return;
      }
      const consent = argValue(argv, "--consent") ?? "";
      const dryRun = argv.includes("--dry-run");
      const wantJson = argv.includes("--json") || !process.stdout.isTTY;
      if (dryRun && !consent) {
        const att = await buildWitnessAttestation();
        if (wantJson) {
          console.log(
            JSON.stringify(
              { ...att, saved: false, reason: "dry_run", dry_run: true },
              null,
              2,
            ),
          );
        } else {
          console.log(
            formatWitnessReceipt({ ...att, saved: false, reason: "dry_run" }),
          );
        }
        return;
      }
      const result = await saveWitnessReceipt({ consent, dryRun });
      if (wantJson) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatWitnessReceipt(result));
      }
      if (!result.saved && result.reason !== "dry_run") process.exitCode = 1;
      return;
    }

    case "authorship": {
      const subCmdA = argv[1] ?? "";
      const wantJsonA = wantsJson(argv);

      if (subCmdA === "key" && (argv[2] === "init" || !argv[2])) {
        const consent = argValue(argv, "--consent") ?? "";
        const result = await initAuthorshipKey({ consent });
        if (wantJsonA) {
          console.log(JSON.stringify(result, null, 2));
        } else if (result.initialized) {
          console.log("Authorship Key Initialized");
          console.log("=".repeat(40));
          console.log(`  Fingerprint: ${result.public_key_fingerprint}`);
          console.log(`  Private key: ${result.private_key_path}`);
          console.log(`  Public key:  ${result.public_key_path}`);
        } else if (result.error === "consent_required") {
          console.error(
            `Consent required. Use: --consent "${KEY_INIT_CONSENT_PHRASE}"`,
          );
        } else if (result.error === "key_already_exists") {
          console.error(
            `Key already exists at ${result.private_key_path}. Use dema authorship key rotate (future) to replace.`,
          );
        }
        if (!result.initialized) process.exitCode = 1;
        return;
      }

      if (subCmdA === "sign") {
        const artifactPath = argv[2];
        const consent = argValue(argv, "--consent") ?? "";
        const result = await signArtifact({ artifactPath, consent });
        if (wantJsonA) {
          console.log(JSON.stringify(result, null, 2));
        } else if (result.signed) {
          console.log("Authorship Receipt Signed");
          console.log("=".repeat(40));
          console.log(`  Artifact SHA256: ${result.artifact_sha256}`);
          console.log(`  Fingerprint:     ${result.public_key_fingerprint}`);
          console.log(`  Receipt:         ${result.receipt_path}`);
          console.log(`  Self-verified:   ${result.self_verified}`);
        } else if (result.error === "consent_required") {
          console.error(
            `Consent required. Use: --consent "${SIGN_CONSENT_PHRASE}"`,
          );
        } else {
          console.error(`Signing failed: ${result.error}`);
        }
        if (!result.signed) process.exitCode = 1;
        return;
      }

      if (subCmdA === "latest") {
        const summary = await getLatestAuthorshipReceiptSummary();
        if (wantJsonA) {
          console.log(JSON.stringify(summary, null, 2));
        } else if (summary.found) {
          console.log("Latest Authorship Receipt");
          console.log("=".repeat(40));
          console.log(`  File: ${summary.receipt_filename}`);
          console.log(`  Path: ${summary.receipt_path}`);
        } else {
          console.log("No authorship receipts found.");
        }
        if (!summary.found) process.exitCode = 1;
        return;
      }

      if (subCmdA === "closeout") {
        const closeout = await buildAuthorshipCloseout();
        if (wantJsonA) {
          console.log(JSON.stringify(closeout, null, 2));
        } else {
          console.log(formatAuthorshipCloseout(closeout));
        }
        if (!closeout.verified) process.exitCode = 1;
        return;
      }

      if (subCmdA === "verify") {
        let receiptPath = argv[2];
        const useLatest = argv.includes("--latest");

        if (useLatest) {
          const latest = await findLatestAuthorshipReceipt();
          if (!latest) {
            const err = {
              schema: "bizra.dema.authorship_verify_result.v0.1",
              verified: false,
              verdict: "FAILED",
              error: "no_authorship_receipts_found",
            };
            console.log(
              wantJsonA
                ? JSON.stringify(err, null, 2)
                : "No authorship receipts found.",
            );
            process.exitCode = 1;
            return;
          }
          receiptPath = latest.path;
        }

        if (!receiptPath) {
          console.error(
            "Usage: dema authorship verify <receipt.json> | --latest [--json]",
          );
          process.exitCode = 1;
          return;
        }

        const result = await verifyAuthorshipReceiptFile(receiptPath);
        if (wantJsonA) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(formatAuthorshipVerification(result));
        }
        if (!result.verified) process.exitCode = 1;
        return;
      }

      if (subCmdA === "demo") {
        const keys = generateEd25519Keypair();
        const demoHash = authorshipSha256("dema-authorship-demo");
        const receipt = buildSignedAuthorshipReceipt({
          artifact_path: "demo/ephemeral-artifact.txt",
          artifact_sha256: demoHash,
          private_key_pem: keys.private_key_pem,
          public_key_pem: keys.public_key_pem,
          public_key_fingerprint: keys.public_key_fingerprint,
        });
        const { signature, ...payload } = receipt;
        const ok = verifyPayload(payload, signature.value, keys.public_key_pem);
        const out = {
          schema: "bizra.dema.authorship_demo.v0.1",
          mode: "EPHEMERAL_DEMO",
          receipt,
          self_verify: ok ? "VERIFIED" : "FAILED",
          boundary: {
            network_used: false,
            key_persisted: false,
            receipt_saved: false,
            mutation_performed: false,
          },
        };
        if (wantJsonA) {
          console.log(JSON.stringify(out, null, 2));
        } else {
          console.log("Ed25519 Authorship Demo (ephemeral)");
          console.log("=".repeat(40));
          console.log(`  Key fingerprint: ${keys.public_key_fingerprint}`);
          console.log(`  Artifact:        ${receipt.artifact.path}`);
          console.log(`  SHA256:          ${receipt.artifact.sha256}`);
          console.log(
            `  Signed:          yes (${receipt.signature.algorithm})`,
          );
          console.log(`  Self-verify:     ${ok ? "VERIFIED" : "FAILED"}`);
          console.log("");
          console.log("  No keys or receipts were saved to disk.");
        }
        if (!ok) process.exitCode = 1;
        return;
      }

      console.error(
        "Usage: dema authorship key init | sign <path> | latest | closeout | verify <receipt> | demo",
      );
      process.exitCode = 1;
      return;
    }

    case "proof": {
      const proofSub = argv[1] ?? "";
      const wantJsonP = wantsJson(argv);

      if (proofSub === "passport" && argv[2] === "verify") {
        const positional = argv.slice(3).filter((a) => !a.startsWith("--"));
        const passportPath = positional[0];
        const deep = argv.includes("--deep");
        const receiptsDir = argValue(argv, "--receipts-dir");

        if (!passportPath) {
          console.error(
            "Usage: dema proof passport verify <passport.json> [--deep] [--receipts-dir <dir>] [--json]",
          );
          process.exitCode = 1;
          return;
        }

        if (deep) {
          const { readFile } = await import("node:fs/promises");
          let passport;
          try {
            passport = JSON.parse(await readFile(passportPath, "utf8"));
          } catch {
            const err = {
              verified: false,
              verdict: "FAILED",
              error: "cannot_read_passport",
              passport_path: passportPath,
            };
            console.log(
              wantJsonP
                ? JSON.stringify(err, null, 2)
                : `FAILED: cannot read ${passportPath}`,
            );
            process.exitCode = 1;
            return;
          }
          const { join: joinPath } = await import("node:path");
          const { homedir: getHome } = await import("node:os");
          const envHome = process.env.DEMA_HOME;
          const resolvedDir =
            receiptsDir ??
            joinPath(envHome ?? joinPath(getHome(), ".dema"), "receipts");
          const deepResult = await verifyProofPassportDeep(passport, {
            receiptsDir: resolvedDir,
          });
          if (wantJsonP) {
            console.log(JSON.stringify(deepResult, null, 2));
          } else {
            const lines = [
              `Proof Passport Deep Verification: ${deepResult.verdict}`,
              `  Scope:    ${deepResult.verification_scope}`,
              `  Receipts: ${deepResult.receipt_results.length}`,
            ];
            const failed = deepResult.receipt_results.filter(
              (r) => !r.verified,
            );
            if (failed.length > 0) {
              lines.push(`  Failed:   ${failed.length}`);
              for (const r of failed) {
                lines.push(
                  `    - ${r.receipt_filename}: ${r.error ?? "metadata_mismatch"}`,
                );
              }
            }
            lines.push(`  Truth:    ${deepResult.truth_label}`);
            console.log(lines.join("\n"));
          }
          if (!deepResult.verified) process.exitCode = 1;
          return;
        }

        const result = await verifyProofPassportFile(passportPath);
        if (wantJsonP) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(formatProofPassportVerification(result));
        }
        if (!result.verified) process.exitCode = 1;
        return;
      }

      if (proofSub === "passport") {
        const passport = await buildProofPassport();
        if (wantJsonP) {
          console.log(JSON.stringify(passport, null, 2));
        } else {
          console.log(formatProofPassport(passport));
        }
        if (
          passport.aggregate.verdict === "EMPTY" ||
          passport.aggregate.verdict === "NONE_VERIFIED"
        ) {
          process.exitCode = 1;
        }
        return;
      }
      console.error(
        "Usage: dema proof passport [--json] | dema proof passport verify <path>",
      );
      process.exitCode = 1;
      return;
    }

    case "urp": {
      const urpSub = argv[1] ?? "";
      const wantJsonU = wantsJson(argv);

      if (urpSub === "index") {
        const passportPath = argValue(argv, "--passport");
        const receiptsDir = argValue(argv, "--receipts-dir");

        if (!passportPath) {
          console.error(
            "Usage: dema urp index --passport <passport.json> [--receipts-dir <dir>] [--json]",
          );
          process.exitCode = 1;
          return;
        }

        const { readFile } = await import("node:fs/promises");
        let passport;
        try {
          const raw = await readFile(passportPath, "utf8");
          try {
            passport = JSON.parse(raw);
          } catch {
            const err = {
              schema: "bizra.dema.urp_local_index_cli_result.v0.1",
              indexed: false,
              written: false,
              error: "invalid_passport_json",
              passport_path: passportPath,
            };
            console.log(
              wantJsonU
                ? JSON.stringify(err, null, 2)
                : `FAILED: invalid JSON in ${passportPath}`,
            );
            process.exitCode = 1;
            return;
          }
        } catch {
          const err = {
            schema: "bizra.dema.urp_local_index_cli_result.v0.1",
            indexed: false,
            written: false,
            error: "cannot_read_passport",
            passport_path: passportPath,
          };
          console.log(
            wantJsonU
              ? JSON.stringify(err, null, 2)
              : `FAILED: cannot read ${passportPath}`,
          );
          process.exitCode = 1;
          return;
        }

        const { join: joinPath } = await import("node:path");
        const { homedir: getHome } = await import("node:os");
        const envHome = process.env.DEMA_HOME;
        const resolvedReceiptsDir =
          receiptsDir ??
          joinPath(envHome ?? joinPath(getHome(), ".dema"), "receipts");
        const buildResult = await buildUrpLocalIndex(passport, {
          receiptsDir: resolvedReceiptsDir,
        });
        if (!buildResult.indexed) {
          const out = {
            schema: "bizra.dema.urp_local_index_cli_result.v0.1",
            indexed: false,
            written: false,
            error: buildResult.error,
            verification: buildResult.verification,
          };
          if (wantJsonU) {
            console.log(JSON.stringify(out, null, 2));
          } else {
            console.log(
              `FAILED: ${buildResult.error} · LOCAL_INDEX_ONLY · MARKED_LOCAL_ONLY`,
            );
          }
          process.exitCode = 1;
          return;
        }

        const writeResult = await saveUrpLocalIndex(buildResult);
        const out = {
          schema: "bizra.dema.urp_local_index_cli_result.v0.1",
          indexed: true,
          written: writeResult.written,
          truth_label: "LOCAL_VERIFIED_RESOURCE_INDEX",
          mode: "LOCAL_INDEX_ONLY",
          share_status: "MARKED_LOCAL_ONLY",
          write_result: writeResult,
        };
        if (wantJsonU) {
          console.log(JSON.stringify(out, null, 2));
        } else if (writeResult.written) {
          console.log(
            [
              `URP Local Index: WRITTEN`,
              `  Index hash: ${writeResult.index_hash}`,
              `  Index path: ${writeResult.index_path}`,
              `  Mode:       LOCAL_INDEX_ONLY`,
              `  Share:      MARKED_LOCAL_ONLY`,
              `  Truth:      LOCAL_VERIFIED_RESOURCE_INDEX`,
            ].join("\n"),
          );
        } else {
          console.log(
            `FAILED: writer rejected · ${writeResult.error} · LOCAL_INDEX_ONLY · MARKED_LOCAL_ONLY`,
          );
        }
        if (!writeResult.written) process.exitCode = 1;
        return;
      }

      if (urpSub === "list") {
        const result = await listUrpLocalIndexes();
        if (wantJsonU) {
          console.log(JSON.stringify(result, null, 2));
        } else if (result.count === 0) {
          console.log(
            [
              "URP Local Indexes: (none)",
              `  Dir: ${result.indexes_dir}`,
              `  LOCAL_INDEX_ONLY · MARKED_LOCAL_ONLY`,
            ].join("\n"),
          );
        } else {
          const lines = [
            `URP Local Indexes: ${result.count}`,
            `  Dir: ${result.indexes_dir}`,
          ];
          for (const e of result.entries) {
            if (e.error) {
              lines.push(
                `  ! ${e.filename}: ${e.error}${e.message ? " · " + e.message : ""}`,
              );
            } else {
              const integ =
                e.filename_hash_matches && e.body_hash_intact
                  ? "OK"
                  : "CORRUPT";
              lines.push(
                `  - ${e.filename}  receipts=${e.receipts_count ?? "?"}  ${e.truth_label ?? ""}  [${integ}]`,
              );
            }
          }
          lines.push(`  LOCAL_INDEX_ONLY · MARKED_LOCAL_ONLY`);
          console.log(lines.join("\n"));
        }
        if (result.corruption_detected) process.exitCode = 1;
        return;
      }

      if (urpSub === "verify") {
        const positional = argv.slice(2).filter((a) => !a.startsWith("--"));
        const indexPath = positional[0];

        if (!indexPath) {
          console.error("Usage: dema urp verify <index.json> [--json]");
          process.exitCode = 1;
          return;
        }

        const result = await verifyUrpLocalIndexFile(indexPath);
        if (wantJsonU) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          const lines = [
            `URP Local Index Verify: ${result.verdict}`,
            `  File: ${indexPath}`,
          ];
          if (result.verified) {
            lines.push(`  Index hash: ${result.index_hash}`);
            lines.push(
              `  Filename↔hash: ${result.filename_hash_matches === null ? "n/a (non-canonical filename)" : result.filename_hash_matches ? "OK" : "MISMATCH"}`,
            );
            lines.push(`  Receipts:    ${result.receipts_count ?? "?"}`);
            lines.push(`  Truth:       ${result.truth_label}`);
          } else {
            lines.push(`  Error:       ${result.error}`);
            if (result.declared && result.recomputed) {
              lines.push(`  Declared:    ${result.declared}`);
              lines.push(`  Recomputed:  ${result.recomputed}`);
            }
            if (result.field) {
              lines.push(`  Forbidden field: ${result.field}`);
            }
            lines.push(`  Truth:       ${result.truth_label}`);
          }
          lines.push(`  LOCAL_INDEX_ONLY · MARKED_LOCAL_ONLY`);
          console.log(lines.join("\n"));
        }
        if (!result.verified) process.exitCode = 1;
        return;
      }

      console.error(
        "Usage: dema urp index --passport <passport.json> [--receipts-dir <dir>] [--json]\n       dema urp list [--json]\n       dema urp verify <index.json> [--json]",
      );
      process.exitCode = 1;
      return;
    }

    case "realm": {
      const realmSub = argv[1] ?? "";
      const wantJsonR = wantsJson(argv);
      const noColor = argv.includes("--no-color") || !shouldUseColor();

      if (realmSub === "board") {
        const board = await gatherDemaRealmBoard();
        if (wantJsonR) {
          console.log(JSON.stringify(board, null, 2));
          return;
        }
        console.log(renderDemaRealmBoard(board, { useColor: !noColor }));
        return;
      }

      if (realmSub === "council") {
        const council = gatherDemaRealmCouncil();
        if (wantJsonR) {
          console.log(JSON.stringify(council, null, 2));
          return;
        }
        console.log(renderDemaRealmCouncil(council, { useColor: !noColor }));
        return;
      }

      if (realmSub === "checkpoint") {
        const checkpointSub = argv[2] ?? "";

        if (checkpointSub === "save") {
          const label = argValue(argv, "--label");
          const stage = argValue(argv, "--stage");
          const nextGear = argValue(argv, "--next-gear");
          const resumeCommand = argValue(argv, "--resume");
          const timelineLabel = argValue(argv, "--timeline-label");
          const result = await saveDemaRealmCheckpoint({
            label,
            stage,
            nextGear,
            resumeCommand,
            timelineLabel,
          });
          if (wantJsonR) {
            console.log(JSON.stringify(result, null, 2));
          } else if (result.saved) {
            console.log(
              [
                `Checkpoint saved.`,
                `  Label:    ${result.checkpoint.label}`,
                `  Stage:    ${result.checkpoint.stage ?? "—"}`,
                `  Resume:   ${result.checkpoint.resume_command}`,
                `  Next:     ${result.checkpoint.next_gear ?? "—"}`,
                `  Sealed:   ${result.checkpoint.sealed_at_iso}`,
                `  Path:     ${result.checkpoint_path}`,
                `  Mode:     ${result.mode_octal ?? "—"}`,
                `  Timeline: ${result.timeline_total_events} events (latest: ${result.timeline_event_appended.at} · ${result.timeline_event_appended.label})`,
                `  Truth:    ${result.truth_label}`,
              ].join("\n"),
            );
          } else {
            console.error(
              `Checkpoint NOT saved · error: ${result.error}` +
                (result.max_length
                  ? ` (max ${result.max_length}, received ${result.received_length})`
                  : ""),
            );
            process.exitCode = 1;
          }
          return;
        }

        const cp = await gatherDemaRealmCheckpoint();
        if (wantJsonR) {
          console.log(JSON.stringify(cp, null, 2));
          return;
        }
        console.log(renderDemaRealmCheckpoint(cp, { useColor: !noColor }));
        return;
      }

      const state = await gatherDemaRealmState();
      if (wantJsonR) {
        console.log(JSON.stringify(state, null, 2));
        return;
      }
      console.log(renderDemaRealmHome(state, { useColor: !noColor }));
      return;
    }

    case "status": {
      if (argv.includes("--full")) {
        const snapshot = buildSystemSnapshot();
        if (wantsJson(argv)) {
          console.log(JSON.stringify(snapshot, null, 2));
        } else {
          console.log(formatSystemSnapshot(snapshot));
        }
        return;
      }
      const status = await statusWithLocalIdentity();
      const color = argv.includes("--no-color") ? false : shouldUseColor();
      console.log(formatStatus(status, { color }));
      return;
    }

    case "status:json": {
      const status = await statusWithLocalIdentity();
      console.log(JSON.stringify(status, null, 2));
      return;
    }

    case "state": {
      const statePreview = buildNode0StatePreview();
      if (wantsJson(argv)) {
        console.log(JSON.stringify(statePreview, null, 2));
        return;
      }
      console.log(
        [
          "Dema state",
          `  Node: ${statePreview.node} · Operator: ${statePreview.operator}`,
          `  Mission-centered: ${statePreview.mission_centered}`,
          `  Runtime autonomous daemon: ${statePreview.runtime.autonomous_daemon}`,
          `  Federation: ${statePreview.runtime.federation}`,
          `  Minting: ${statePreview.runtime.minting}`,
          `  Next safe action: ${humanizeNextAction(statePreview.next_safe_action)}`,
          humanHintLine("state"),
        ].join("\n"),
      );
      return;
    }

    case "profiles": {
      const wantsSummary = argv.includes("--summary");
      const profilePreview = wantsSummary
        ? buildProfileFoundationSummary()
        : buildProfileFoundationPreview();
      if (wantsJson(argv)) {
        console.log(JSON.stringify(profilePreview, null, 2));
        return;
      }
      if (wantsSummary) {
        const actors = profilePreview.actors;
        console.log(
          [
            "Dema profiles (summary)",
            `  User: ${actors.user}`,
            `  PAT:  ${actors.pat}`,
            `  SAT:  ${actors.sat}`,
            `  Mission: ${actors.mission}`,
            `  Context capsule: ${profilePreview.context_capsule_schema}`,
            humanHintLine("profiles"),
          ].join("\n"),
        );
      } else {
        const p = profilePreview;
        console.log(
          [
            "Dema profiles",
            `  User: ${p.user.schema} · operator: ${p.user.identity.name}`,
            `  PAT:  ${p.pat.schema} · owner: ${p.pat.owner}`,
            `  SAT:  ${p.sat.schema} · owner: ${p.sat.owner}`,
            `  Mission: ${p.mission.schema} · status: ${p.mission.status}`,
            `  Context capsule: ${p.context_capsule.schema}`,
            humanHintLine("profiles"),
          ].join("\n"),
        );
      }
      return;
    }

    case "consent-card": {
      console.log(JSON.stringify(buildConsentCardPreview(), null, 2));
      return;
    }

    case "mission-loop": {
      const preview = argv.includes("--summary")
        ? buildMissionLoopSummary()
        : buildMissionLoopPreview();
      console.log(JSON.stringify(preview, null, 2));
      return;
    }

    case "evidence-event": {
      console.log(
        JSON.stringify(buildEvidenceChainEventPreviewFromInputs(), null, 2),
      );
      return;
    }

    case "node-registry": {
      const preview = buildNodeRegistryPreview();
      if (argv.includes("--pretty")) {
        console.log(
          formatNodeRegistryPreview(preview, resolveFormatterOptsFromEnv()),
        );
        return;
      }
      console.log(JSON.stringify(preview, null, 2));
      return;
    }

    case "onboarding-lifecycle": {
      const preview = buildOnboardingLifecyclePreview();
      if (argv.includes("--json")) {
        console.log(JSON.stringify(preview, null, 2));
        return;
      }
      // Default: pretty TUI on TTY, JSON when redirected
      if (process.stdout.isTTY) {
        console.log(
          formatOnboardingLifecyclePreview(
            preview,
            resolveFormatterOptsFromEnv(),
          ),
        );
      } else {
        console.log(JSON.stringify(preview, null, 2));
      }
      return;
    }

    case "skill-growth-governor": {
      const preview = buildSkillGrowthGovernorPreview();
      if (argv.includes("--json")) {
        console.log(JSON.stringify(preview, null, 2));
        return;
      }
      if (process.stdout.isTTY) {
        console.log(
          formatSkillGrowthGovernorPreview(
            preview,
            resolveFormatterOptsFromEnv(),
          ),
        );
      } else {
        console.log(JSON.stringify(preview, null, 2));
      }
      return;
    }

    case "project-status": {
      const preview = buildProjectStatusPreview();
      if (argv.includes("--json")) {
        console.log(JSON.stringify(preview, null, 2));
        return;
      }
      if (process.stdout.isTTY) {
        console.log(
          formatProjectStatusPreview(preview, resolveFormatterOptsFromEnv()),
        );
      } else {
        console.log(JSON.stringify(preview, null, 2));
      }
      return;
    }

    case "craftsmanship-witness": {
      // 15th canonical spine surface · the master-craftsmanship creation
      // (proactive self micro harness + micro consent + RSI micro process
      //  mining + master craftsmanship · all in one preview).
      // Inputs are caller-declared (zero I/O in builder); CLI passes empty
      // defaults · operator can pipe their own slice_history/rsi_signals etc.
      console.log(JSON.stringify(buildCraftsmanshipWitnessPreview(), null, 2));
      return;
    }

    case "master-craftsmanship": {
      // External audit surface — audits arbitrary artifacts against the 10
      // MASTER_CRAFTSMANSHIP_INVARIANTS. Default subject is the ADR-011
      // phase-4 compliance suite.
      // Usage:
      //   dema master-craftsmanship audit [--json] [<path>]
      const mcSubcommand = argv[1];
      if (mcSubcommand !== "audit") {
        console.log(
          "Usage: dema master-craftsmanship audit [--json] [<path>]\n" +
            "  Default path: tests/node-onboarding-adr011-compliance.test.js",
        );
        process.exitCode = 1;
        return;
      }
      const mcJsonFlag = argv.includes("--json");
      // Path is any non-flag arg after the subcommand
      const mcPathArg = argv.slice(2).find((a) => !a.startsWith("--"));
      const { fileURLToPath: mcFURL } = await import("node:url");
      const { dirname: mcDirname, join: mcJoin } = await import("node:path");
      const projectRoot = mcJoin(
        mcDirname(mcFURL(import.meta.url)),
        "../../..",
      );
      const result = await auditArtifact({
        artifactPath: mcPathArg,
        projectRoot,
      });
      if (mcJsonFlag) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatAuditReport(result));
      }
      if (!result.overall_compliant) process.exitCode = 1;
      return;
    }

    case "codebase": {
      // v0.1 · read-only codebase architecture map.
      // Usage: dema codebase map <abs-path> [flags]
      const cbSubcommand = argv[1];
      if (cbSubcommand !== "map") {
        process.stderr.write(
          "Usage: dema codebase map <abs-path> [--summary] [--json] [--max-files N] [--max-depth N] [--max-file-size N] [--include-tests] [--hotspots] [--exclude PAT] [--no-default-exclude]\n",
        );
        process.exitCode = 1;
        return;
      }
      const { isAbsolute: cbIsAbsolute } = await import("node:path");
      const cbPath = argv.slice(2).find((a) => !a.startsWith("--"));
      if (!cbPath) {
        process.stderr.write("dema codebase map: <abs-path> is required\n");
        process.exitCode = 1;
        return;
      }
      if (!cbIsAbsolute(cbPath)) {
        process.stderr.write(
          `dema codebase map: <abs-path> must be absolute (got: ${cbPath})\n`,
        );
        process.exitCode = 1;
        return;
      }
      const cbSummary = argv.includes("--summary");
      const cbJsonForce = argv.includes("--json");
      const cbIncludeTests = argv.includes("--include-tests");
      const cbHotspots = argv.includes("--hotspots");
      const cbNoDefaultExclude = argv.includes("--no-default-exclude");
      const cbSaveMap = argv.includes("--save-map");
      // v0.2 (this slice): --save-map cannot combine with --summary unless
      // --json is also passed (saved file must match stdout byte-for-byte;
      // a human summary text saved to codebase-map-<sha>.json is a category
      // error). Fail-closed mirrors PR #85 "--save-invocation-result requires
      // --invoke" early-validation pattern.
      if (cbSaveMap && cbSummary && !cbJsonForce) {
        process.stderr.write(
          "dema codebase map: --save-map requires JSON output; cannot combine with --summary unless --json is also provided\n",
        );
        process.exitCode = 1;
        return;
      }
      const parseIntOrNull = (s) => {
        if (typeof s !== "string") return undefined;
        const n = Number.parseInt(s, 10);
        return Number.isFinite(n) && n >= 0 ? n : undefined;
      };
      const cbMaxFiles = parseIntOrNull(argValue(argv, "--max-files"));
      const cbMaxDepth = parseIntOrNull(argValue(argv, "--max-depth"));
      const cbMaxFileSize = parseIntOrNull(argValue(argv, "--max-file-size"));
      const cbExtraExclusions = [];
      for (let i = 0; i < argv.length - 1; i++) {
        if (argv[i] === "--exclude") cbExtraExclusions.push(argv[i + 1]);
      }
      const envelope = await buildCodebaseArchitectureMap(cbPath, {
        maxFiles: cbMaxFiles,
        maxDepth: cbMaxDepth,
        maxFileSize: cbMaxFileSize,
        includeTests: cbIncludeTests,
        hotspots: cbHotspots,
        extraExclusions: cbExtraExclusions,
        useDefaultExclusions: !cbNoDefaultExclude,
      });
      // Single serializer shared by save + stdout (byte-for-byte invariant).
      // pretty=false matches the v0.1 CLI behavior; --pretty is not exposed
      // by codebase-map yet.
      const cbOut = serializeCodebaseMapForSave(envelope, { pretty: false });
      // v0.2: save BEFORE any stdout write. If save fails, exit non-zero
      // without polluting stdout.
      if (cbSaveMap) {
        const cbSaveConsent = argValue(argv, "--save-map-consent") ?? null;
        const cbSaveResult = await saveCodebaseMap(envelope, {
          demaHome: process.env.DEMA_HOME,
          consent: cbSaveConsent,
          pretty: false,
        });
        if (!cbSaveResult.saved) {
          if (cbSaveResult.reason === "consent_missing") {
            process.stderr.write(
              `dema codebase map: --save-map requires --save-map-consent "${CODEBASE_MAP_SAVE_CONSENT}"\n`,
            );
          } else if (cbSaveResult.reason === "consent_mismatch") {
            process.stderr.write(
              `dema codebase map: --save-map consent phrase mismatch; required: "${CODEBASE_MAP_SAVE_CONSENT}"\n`,
            );
          } else if (cbSaveResult.reason === "oversized_serialized_envelope") {
            process.stderr.write(
              `dema codebase map: --save-map failed (serialized envelope ${cbSaveResult.serialized_bytes} bytes exceeds ${cbSaveResult.max_saved_bytes} byte cap)\n`,
            );
          } else {
            process.stderr.write(
              `dema codebase map: --save-map failed (${cbSaveResult.reason}): ${cbSaveResult.error_message ?? "unknown"}\n`,
            );
          }
          process.exitCode = 1;
          return;
        }
        process.stderr.write(`saved codebase map to: ${cbSaveResult.path}\n`);
      }
      if (envelope.error_reason) {
        process.stderr.write(
          `dema codebase map: ${envelope.error_reason}${envelope.error_message ? ": " + envelope.error_message : ""}\n`,
        );
        process.stdout.write(cbOut);
        process.exitCode = 1;
        return;
      }
      if (cbSummary && !cbJsonForce) {
        process.stdout.write(formatCodebaseMapSummary(envelope) + "\n");
      } else {
        process.stdout.write(cbOut);
      }
      if (envelope.partial) process.exitCode = 1;
      return;
    }

    case "orchestrator": {
      // v0.1 · SAT-1..5 pipeline exposure. Reads a saved invocation envelope
      // and pipes it through the existing runVerificationPipeline() from
      // multi-agent-orchestrator.js. NOT chain-bound mint. NOT PAT execution.
      // No model invocation. No network.
      const orcSub = argv[1];
      if (orcSub !== "verify") {
        process.stderr.write(
          'Usage: dema orchestrator verify [--invocation-file <abs-path> | --latest] [--pretty] [--save-pipeline-result --save-pipeline-consent "GO: save local orchestrator pipeline result"]\n',
        );
        process.exitCode = 1;
        return;
      }
      const { isAbsolute: orcIsAbsolute } = await import("node:path");
      const orcFile = argValue(argv, "--invocation-file") ?? null;
      const orcLatest = argv.includes("--latest");
      const orcPretty = argv.includes("--pretty");
      const orcSave = argv.includes("--save-pipeline-result");

      if (orcFile && orcLatest) {
        process.stderr.write(
          "dema orchestrator verify: --invocation-file and --latest are mutually exclusive\n",
        );
        process.exitCode = 1;
        return;
      }
      if (!orcFile && !orcLatest) {
        process.stderr.write(
          "dema orchestrator verify: one of --invocation-file <abs-path> or --latest is required\n",
        );
        process.exitCode = 1;
        return;
      }

      let orcTargetPath;
      if (orcFile) {
        if (!orcIsAbsolute(orcFile)) {
          process.stderr.write(
            `dema orchestrator verify: --invocation-file path must be absolute (got: ${orcFile})\n`,
          );
          process.exitCode = 1;
          return;
        }
        orcTargetPath = orcFile;
      } else {
        const latest = await resolveLatestInvocationPath({
          demaHome: process.env.DEMA_HOME,
        });
        if (!latest) {
          process.stderr.write(
            "dema orchestrator verify: no invocation-*.json files found in $DEMA_HOME/receipts/\n",
          );
          process.exitCode = 1;
          return;
        }
        orcTargetPath = latest;
      }

      let orcReadResult;
      try {
        orcReadResult = await readEnvelopeFromFile(orcTargetPath);
      } catch (err) {
        if (err?.code === "ENOENT") {
          process.stderr.write(
            `dema orchestrator verify: envelope file not found: ${orcTargetPath}\n`,
          );
        } else if (err instanceof SyntaxError) {
          process.stderr.write(
            `dema orchestrator verify: malformed envelope JSON at ${orcTargetPath}: ${err.message}\n`,
          );
        } else {
          process.stderr.write(
            `dema orchestrator verify: envelope read failed at ${orcTargetPath}: ${err?.message ?? err}\n`,
          );
        }
        process.exitCode = 1;
        return;
      }

      const pipeline = runVerificationPipeline({
        artifact: orcReadResult.envelope,
      });
      // Attach source linkage (Q8: preserve source artifact hash) without
      // mutating the frozen pipeline object — wrap via a fresh frozen shape.
      const pipelineWithSource = Object.freeze({
        ...pipeline,
        source: Object.freeze({
          path: orcTargetPath,
          source_invocation_result_hash: orcReadResult.sourceHash,
        }),
      });

      const pipelineOut = serializePipelineResultForSave(pipelineWithSource, {
        pretty: orcPretty,
      });

      if (orcSave) {
        const orcSaveConsent =
          argValue(argv, "--save-pipeline-consent") ?? null;
        const saveResult = await savePipelineResult(pipelineWithSource, {
          demaHome: process.env.DEMA_HOME,
          consent: orcSaveConsent,
          pretty: orcPretty,
        });
        if (!saveResult.saved) {
          if (saveResult.reason === "consent_missing") {
            process.stderr.write(
              `dema orchestrator verify: --save-pipeline-result requires --save-pipeline-consent "${PIPELINE_RESULT_SAVE_CONSENT}"\n`,
            );
          } else if (saveResult.reason === "consent_mismatch") {
            process.stderr.write(
              `dema orchestrator verify: --save-pipeline-result consent phrase mismatch; required: "${PIPELINE_RESULT_SAVE_CONSENT}"\n`,
            );
          } else {
            process.stderr.write(
              `dema orchestrator verify: --save-pipeline-result failed (${saveResult.reason}): ${saveResult.error_message ?? "unknown"}\n`,
            );
          }
          process.exitCode = 1;
          return;
        }
        process.stderr.write(`saved pipeline result to: ${saveResult.path}\n`);
      }

      process.stdout.write(pipelineOut);
      if (!pipelineWithSource.passed) process.exitCode = 1;
      return;
    }

    case "llm-router": {
      console.log(JSON.stringify(buildLocalLLMRouterPreview(), null, 2));
      return;
    }

    case "model-broker": {
      // CLI preview for the local model broker + registry config + verifier.
      // v0.1 (PR #81): --registry-stdin + DEFAULT_SAMPLE_REGISTRY.
      // v0.2 (PR #82): --use-local-registry + --registry-file <abs-path>
      // v0.2 (PR #83): --save-receipt + exact consent
      // v0.1 (PR #84): --invoke + --invoke-consent + bridge to llm-adapter
      // v0.1 (PR #85): --save-invocation-result + exact consent
      // v0.1 (this slice): verify-invocation action — deterministic
      //   invariant checker over saved invocation envelopes.
      // Emits route receipt OR routed invocation envelope OR verification
      // envelope JSON to stdout depending on action + flags. Does NOT invoke
      // any model except through the explicit --invoke gate. Does NOT call
      // network outside the adapter. Does NOT mint receipts.
      const action = argv[1];
      if (action === "verify-invocation") {
        // ─── verify-invocation deterministic invariant checker ──────────────
        const explicitFile = argValue(argv, "--invocation-result-file") ?? null;
        const useLatest = argv.includes("--latest");
        const pretty = argv.includes("--pretty");

        if (explicitFile && useLatest) {
          process.stderr.write(
            "dema model-broker verify-invocation: --invocation-result-file and --latest are mutually exclusive\n",
          );
          process.exitCode = 1;
          return;
        }
        if (!explicitFile && !useLatest) {
          process.stderr.write(
            "dema model-broker verify-invocation: one of --invocation-result-file <abs-path> or --latest is required\n",
          );
          process.exitCode = 1;
          return;
        }

        const { isAbsolute: pathIsAbsolute } = await import("node:path");

        let targetPath;
        let sourceKind;
        if (explicitFile) {
          if (!pathIsAbsolute(explicitFile)) {
            process.stderr.write(
              `dema model-broker verify-invocation: --invocation-result-file path must be absolute (got: ${explicitFile})\n`,
            );
            process.exitCode = 1;
            return;
          }
          targetPath = explicitFile;
          sourceKind = "file";
        } else {
          const latest = await resolveLatestInvocationPath({
            demaHome: process.env.DEMA_HOME,
          });
          if (!latest) {
            process.stderr.write(
              "dema model-broker verify-invocation: no invocation-*.json files found in $DEMA_HOME/receipts/\n",
            );
            process.exitCode = 1;
            return;
          }
          targetPath = latest;
          sourceKind = "latest";
        }

        let readResult;
        try {
          readResult = await readEnvelopeFromFile(targetPath);
        } catch (err) {
          if (err?.code === "ENOENT") {
            process.stderr.write(
              `dema model-broker verify-invocation: envelope file not found: ${targetPath}\n`,
            );
          } else if (err instanceof SyntaxError) {
            process.stderr.write(
              `dema model-broker verify-invocation: malformed envelope JSON at ${targetPath}: ${err.message}\n`,
            );
          } else {
            process.stderr.write(
              `dema model-broker verify-invocation: envelope read failed at ${targetPath}: ${err?.message ?? err}\n`,
            );
          }
          process.exitCode = 1;
          return;
        }

        const verification = verifyRoutedInvocationEnvelope(
          readResult.envelope,
          {
            source: {
              kind: sourceKind,
              path: targetPath,
              source_invocation_result_hash: readResult.sourceHash,
            },
          },
        );

        // v0.1 (this slice): --save-verification-result + exact consent.
        // Single serialization shared by save + stdout (byte-for-byte).
        const verificationOut = serializeVerificationResultForSave(
          verification,
          { pretty },
        );
        const saveVerificationFlag = argv.includes(
          "--save-verification-result",
        );
        if (saveVerificationFlag) {
          const saveConsent =
            argValue(argv, "--save-verification-consent") ?? null;
          const saveResult = await saveVerificationResult(verification, {
            demaHome: process.env.DEMA_HOME,
            consent: saveConsent,
            pretty,
          });
          if (!saveResult.saved) {
            if (saveResult.reason === "consent_missing") {
              process.stderr.write(
                `dema model-broker verify-invocation: --save-verification-result requires --save-verification-consent "${VERIFICATION_RESULT_SAVE_CONSENT}"\n`,
              );
            } else if (saveResult.reason === "consent_mismatch") {
              process.stderr.write(
                `dema model-broker verify-invocation: --save-verification-result consent phrase mismatch; required: "${VERIFICATION_RESULT_SAVE_CONSENT}"\n`,
              );
            } else {
              process.stderr.write(
                `dema model-broker verify-invocation: --save-verification-result failed (${saveResult.reason}): ${saveResult.error_message ?? "unknown"}\n`,
              );
            }
            process.exitCode = 1;
            return;
          }
          process.stderr.write(
            `saved verification result to: ${saveResult.path}\n`,
          );
        }

        process.stdout.write(verificationOut);

        if (verification.verdict !== "compliant") {
          process.exitCode = 1;
        }
        return;
      }

      if (action !== "route") {
        process.stderr.write(
          `dema model-broker: unknown action '${action ?? ""}' (expected: route | verify-invocation)\n`,
        );
        process.exitCode = 1;
        return;
      }

      // --save-verification-result is only valid for verify-invocation; reject
      // here so the operator gets a precise pointer instead of silent ignore.
      if (
        argv.includes("--save-verification-result") ||
        argv.includes("--save-verification-consent")
      ) {
        process.stderr.write(
          "dema model-broker route: --save-verification-result is only valid for the 'verify-invocation' action\n",
        );
        process.exitCode = 1;
        return;
      }

      const taskKind = argValue(argv, "--task") ?? null;
      const requiredRole = argValue(argv, "--required-role") ?? null;
      const maxSizeClass = argValue(argv, "--max-size") ?? null;
      const localOnly = !argv.includes("--no-local-only");
      const allowUnknown = argv.includes("--allow-unknown");
      const pretty = argv.includes("--pretty");
      const useStdinRegistry = argv.includes("--registry-stdin");
      const useLocalRegistry = argv.includes("--use-local-registry");
      const explicitRegistryFile = argValue(argv, "--registry-file") ?? null;

      // Mutual exclusion: only one registry input mode at a time.
      const registryInputCount =
        (useStdinRegistry ? 1 : 0) +
        (useLocalRegistry ? 1 : 0) +
        (explicitRegistryFile ? 1 : 0);
      if (registryInputCount > 1) {
        process.stderr.write(
          "dema model-broker route: --registry-stdin, --registry-file, and --use-local-registry are mutually exclusive (pass at most one)\n",
        );
        process.exitCode = 1;
        return;
      }

      if (!taskKind && !requiredRole) {
        process.stderr.write(
          "dema model-broker route: --task <kind> or --required-role <role> is required\n",
        );
        process.exitCode = 1;
        return;
      }

      // 1 MB cap on registry file size (matches packages/receipts/src/receipt-store.js).
      const MAX_REGISTRY_FILE_BYTES = 1024 * 1024;

      let registry = DEFAULT_SAMPLE_REGISTRY;
      if (useStdinRegistry) {
        let raw = "";
        try {
          for await (const chunk of process.stdin) raw += chunk;
        } catch (err) {
          process.stderr.write(
            `dema model-broker route: stdin read failed: ${err?.message ?? err}\n`,
          );
          process.exitCode = 1;
          return;
        }
        try {
          const parsed = JSON.parse(raw);
          registry = buildRegistryFromConfig(parsed);
        } catch (err) {
          process.stderr.write(
            `dema model-broker route: malformed --registry-stdin JSON: ${err?.message ?? err}\n`,
          );
          process.exitCode = 1;
          return;
        }
      } else if (useLocalRegistry || explicitRegistryFile) {
        // Resolve target path.
        const { join: pathJoin, isAbsolute: pathIsAbsolute } =
          await import("node:path");
        const { homedir } = await import("node:os");
        const { open } = await import("node:fs/promises");

        let targetPath;
        if (explicitRegistryFile) {
          if (!pathIsAbsolute(explicitRegistryFile)) {
            process.stderr.write(
              `dema model-broker route: --registry-file path must be absolute (got: ${explicitRegistryFile}). Use --use-local-registry for default DEMA_HOME location.\n`,
            );
            process.exitCode = 1;
            return;
          }
          targetPath = explicitRegistryFile;
        } else {
          // --use-local-registry: $DEMA_HOME/models/registry.json (env override
          // honored; falls back to ~/.dema per repo convention).
          const home = process.env.DEMA_HOME || pathJoin(homedir(), ".dema");
          targetPath = pathJoin(home, "models", "registry.json");
        }

        // Read-only load through a single file handle with bounded read.
        // The handle approach closes the TOCTOU race that a stat()+readFile()
        // pattern leaves open: between stat() and readFile() an attacker
        // could swap the file with a larger one and bypass the size cap. By
        // reading at most MAX+1 bytes from a single open handle, we never
        // allocate more than MAX+1 even if the file grows under us, and we
        // never trust a separate stat() call.
        let fh = null;
        try {
          fh = await open(targetPath, "r");
          const buffer = Buffer.alloc(MAX_REGISTRY_FILE_BYTES + 1);
          const { bytesRead } = await fh.read(
            buffer,
            0,
            MAX_REGISTRY_FILE_BYTES + 1,
            0,
          );
          if (bytesRead > MAX_REGISTRY_FILE_BYTES) {
            process.stderr.write(
              `dema model-broker route: registry file too large: exceeds ${MAX_REGISTRY_FILE_BYTES} bytes\n`,
            );
            process.exitCode = 1;
            return;
          }
          const raw = buffer.subarray(0, bytesRead).toString("utf8");
          const parsed = JSON.parse(raw);
          registry = buildRegistryFromConfig(parsed);
        } catch (err) {
          if (err?.code === "ENOENT") {
            process.stderr.write(
              `dema model-broker route: registry file not found: ${targetPath}\n`,
            );
          } else if (err instanceof SyntaxError) {
            process.stderr.write(
              `dema model-broker route: malformed registry file JSON at ${targetPath}: ${err.message}\n`,
            );
          } else {
            process.stderr.write(
              `dema model-broker route: registry file load failed at ${targetPath}: ${err?.message ?? err}\n`,
            );
          }
          process.exitCode = 1;
          return;
        } finally {
          if (fh) {
            try {
              await fh.close();
            } catch {
              /* best-effort close */
            }
          }
        }
      }

      const broker = buildModelBrokerPreview({ registry });
      const routeOpts = {
        local_only: localOnly,
        allow_unknown: allowUnknown,
      };
      if (taskKind) routeOpts.task_kind = taskKind;
      if (requiredRole) routeOpts.required_role = requiredRole;
      if (maxSizeClass) routeOpts.max_size_class = maxSizeClass;

      const receipt = routeForTask(broker, routeOpts);

      const saveReceiptFlag = argv.includes("--save-receipt");
      const invokeFlag = argv.includes("--invoke");
      const saveInvocationResultFlag = argv.includes(
        "--save-invocation-result",
      );

      // Early validation: --save-invocation-result requires --invoke (no
      // envelope exists to save without invocation).
      if (saveInvocationResultFlag && !invokeFlag) {
        process.stderr.write(
          "dema model-broker route: --save-invocation-result requires --invoke (no envelope to save without invocation)\n",
        );
        process.exitCode = 1;
        return;
      }

      // v0.1 (this slice): --invoke runs the routed local-LLM invocation.
      // Hard ordering: route → save route receipt → invoke selected model.
      // --invoke REQUIRES --save-receipt + --prompt + --invoke-consent.
      if (invokeFlag) {
        if (!saveReceiptFlag) {
          process.stderr.write(
            "dema model-broker route: --invoke requires --save-receipt for route durability before invocation.\n",
          );
          process.exitCode = 1;
          return;
        }
        const prompt = argValue(argv, "--prompt") ?? "";
        if (typeof prompt !== "string" || prompt.length === 0) {
          process.stderr.write(
            'dema model-broker route: --invoke requires --prompt "<text>"\n',
          );
          process.exitCode = 1;
          return;
        }
        const invokeConsent = argValue(argv, "--invoke-consent") ?? "";
        if (typeof invokeConsent !== "string" || invokeConsent.length === 0) {
          process.stderr.write(
            'dema model-broker route: --invoke requires --invoke-consent "GO: invoke local LLM at <selected_model_id>"\n',
          );
          process.exitCode = 1;
          return;
        }
        // Step 1: save first (route durability before invocation).
        const consent = argValue(argv, "--consent") ?? "";
        const saveResult = await saveRouteReceipt(receipt, {
          demaHome: process.env.DEMA_HOME,
          consent,
          pretty,
        });
        if (!saveResult.saved) {
          if (saveResult.reason === "consent_missing") {
            process.stderr.write(
              `dema model-broker route: --save-receipt requires --consent "${ROUTE_RECEIPT_SAVE_CONSENT}"\n`,
            );
          } else if (saveResult.reason === "consent_mismatch") {
            process.stderr.write(
              `dema model-broker route: --save-receipt consent phrase mismatch; required: "${ROUTE_RECEIPT_SAVE_CONSENT}"\n`,
            );
          } else {
            process.stderr.write(
              `dema model-broker route: --save-receipt failed (${saveResult.reason}): ${saveResult.error_message ?? "unknown"}\n`,
            );
          }
          process.exitCode = 1;
          return;
        }
        process.stderr.write(`saved receipt to: ${saveResult.path}\n`);

        // Step 2: invoke routed local model via the bridge → adapter.
        const timeoutMsArg = argValue(argv, "--timeout-ms");
        const timeoutMs =
          timeoutMsArg !== undefined
            ? Number.parseInt(timeoutMsArg, 10)
            : undefined;
        const envelope = await invokeRoutedLocalModel({
          routeReceipt: receipt,
          prompt,
          invokeConsent,
          timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : undefined,
        });

        // Serialize ONCE so stdout and any saved file match byte-for-byte
        // (architect-locked invariant; mirrors PR #83 route-receipt-save).
        const envelopeContent = serializeInvocationResultForSave(envelope, {
          pretty,
        });

        // Step 3 (optional): persist envelope to disk under explicit consent.
        // v0.1 invocation result SAVE (mirrors v0.2 route receipt SAVE from
        // PR #83). Preview-grade save (NOT canonical chain-bound mint).
        // Saves BOTH success and failure envelopes for audit.
        if (saveInvocationResultFlag) {
          const saveInvocationConsent =
            argValue(argv, "--save-invocation-consent") ?? "";
          const saveInvResult = await saveInvocationResult(envelope, {
            demaHome: process.env.DEMA_HOME,
            consent: saveInvocationConsent,
            pretty,
          });
          if (!saveInvResult.saved) {
            if (saveInvResult.reason === "consent_missing") {
              process.stderr.write(
                `dema model-broker route: --save-invocation-result requires --save-invocation-consent "${INVOCATION_RESULT_SAVE_CONSENT}"\n`,
              );
            } else if (saveInvResult.reason === "consent_mismatch") {
              process.stderr.write(
                `dema model-broker route: --save-invocation-result consent phrase mismatch; required: "${INVOCATION_RESULT_SAVE_CONSENT}"\n`,
              );
            } else {
              process.stderr.write(
                `dema model-broker route: --save-invocation-result failed (${saveInvResult.reason}): ${saveInvResult.error_message ?? "unknown"}\n`,
              );
            }
            // Still emit the envelope to stdout so the operator can see the
            // result they were trying to save.
            process.stdout.write(envelopeContent);
            process.exitCode = 1;
            return;
          }
          process.stderr.write(
            `saved invocation result to: ${saveInvResult.path}\n`,
          );
        }

        // Step 4: stdout emits the envelope (replaces the bare route receipt).
        process.stdout.write(envelopeContent);

        // Non-zero exit on adapter-reported failure so operators can chain
        // routed invocation into scripts that fail-fast on missing/refused
        // models.
        if (
          envelope.invocation_result === null ||
          envelope.invocation_result.invocation_status === "failed"
        ) {
          process.exitCode = 1;
        }
        return;
      }

      // Non-invoke path: stdout = route receipt; optionally save.
      const content = serializeRouteReceiptForSave(receipt, { pretty });
      process.stdout.write(content);

      // v0.2: --save-receipt persists the route receipt to
      // $DEMA_HOME/receipts/route-<sha256>.json under exact-string consent.
      // Preview-grade SAVE (not canonical chain-bound MINT per ADR-008 §C12).
      if (saveReceiptFlag) {
        const consent = argValue(argv, "--consent") ?? "";
        const result = await saveRouteReceipt(receipt, {
          demaHome: process.env.DEMA_HOME,
          consent,
          pretty,
        });
        if (!result.saved) {
          if (result.reason === "consent_missing") {
            process.stderr.write(
              `dema model-broker route: --save-receipt requires --consent "${ROUTE_RECEIPT_SAVE_CONSENT}"\n`,
            );
          } else if (result.reason === "consent_mismatch") {
            process.stderr.write(
              `dema model-broker route: --save-receipt consent phrase mismatch; required: "${ROUTE_RECEIPT_SAVE_CONSENT}"\n`,
            );
          } else {
            process.stderr.write(
              `dema model-broker route: --save-receipt failed (${result.reason}): ${result.error_message ?? "unknown"}\n`,
            );
          }
          process.exitCode = 1;
          return;
        }
        process.stderr.write(`saved receipt to: ${result.path}\n`);
      }
      return;
    }

    case "harness": {
      const harness = argv.includes("--summary")
        ? buildHarnessIntegrationSummary()
        : buildHarnessIntegration();
      if (argv.includes("--json")) {
        console.log(JSON.stringify(harness, null, 2));
      } else {
        console.log(formatHarnessIntegration(buildHarnessIntegration()));
      }
      return;
    }

    case "process-mining": {
      const preview = argv.includes("--summary")
        ? buildProcessMiningSummary()
        : buildProcessMiningPreview();
      console.log(JSON.stringify(preview, null, 2));
      return;
    }

    case "key-maker-check": {
      const door = argValue(argv, "--door") ?? "";
      const preview = argv.includes("--summary")
        ? buildKeyMakerComplianceSummary({ door })
        : buildKeyMakerCompliancePreview({ door });
      console.log(JSON.stringify(preview, null, 2));
      return;
    }

    case "llm-invoke": {
      // C1 spine surface (per ADR-008 §C1) · two modes:
      //   no --invoke    → preview-only · canonical boundary all false
      //   --invoke       → actual Ollama call · requires --consent exact phrase
      const model = argValue(argv, "--model") ?? "";
      const prompt = argValue(argv, "--prompt") ?? "";
      const consent = argValue(argv, "--consent") ?? "";
      const ollamaBaseUrl = argValue(argv, "--base") ?? undefined;
      const wantsSummary = argv.includes("--summary");
      const wantsInvoke = argv.includes("--invoke");

      if (!wantsInvoke) {
        const preview = wantsSummary
          ? buildLLMInvocationSummary({ model, prompt, ollamaBaseUrl })
          : buildLLMInvocationPreview({ model, prompt, ollamaBaseUrl });
        console.log(JSON.stringify(preview, null, 2));
        return;
      }

      // --invoke flag present · real HTTP call to Ollama · consent-gated
      const result = await invokeLocalLLM({
        model,
        prompt,
        consentPhrase: consent,
        ollamaBaseUrl,
      });
      console.log(JSON.stringify(result, null, 2));
      if (result.invocation_status === "failed") {
        process.exitCode = 1;
      }
      return;
    }

    case "today": {
      const status = await statusWithLocalIdentity();
      const result = await recordTodayTick({ status });
      const memory = await summarizeMemory();
      if (wantsJson(argv)) {
        console.log(JSON.stringify({ ...result, memory }, null, 2));
        return;
      }
      const tick = result.tick;
      console.log(
        [
          "Dema today",
          `  Continuity tick recorded — ${tick.date}`,
          `  NODE0_READY=${tick.node0Ready} · Activation gate: ${tick.activationGate}`,
          `  ${memory.count} memory entries summarized at ${result.path}`,
          `  Next artifact: ${tick.nextArtifact}`,
          humanHintLine("today"),
        ].join("\n"),
      );
      return;
    }

    case "doctor": {
      const status = await statusWithLocalIdentity();
      const predicates = evaluatePredicates(status);
      const anyFail = predicates.some((p) => p.status === "fail");

      if (wantsJson(argv)) {
        const verdict = anyFail ? "blocked" : "ready and consent-gated";
        console.log(
          JSON.stringify(
            {
              schema: "bizra.dema.doctor_dashboard.v0.1",
              verdict,
              predicates,
              status,
            },
            null,
            2,
          ),
        );
        process.exitCode = anyFail ? 1 : 0;
        return;
      }

      const noColor =
        Boolean(process.env.NO_COLOR) ||
        process.env.TERM === "dumb" ||
        argv.includes("--no-color");
      console.log(formatDoctorDashboard(predicates, { color: !noColor }));
      process.exitCode = anyFail ? 1 : 0;
      return;
    }

    case "dashboard": {
      const { fileURLToPath } = await import("node:url");
      const { dirname, join, resolve } = await import("node:path");
      const {
        readFileSync,
        writeFileSync,
        accessSync,
        constants,
        mkdtempSync,
      } = await import("node:fs");
      const { tmpdir } = await import("node:os");

      const here = dirname(fileURLToPath(import.meta.url));
      const htmlPath = resolve(
        join(
          here,
          "..",
          "..",
          "..",
          "docs",
          "tui",
          "dema-homebase-dashboard-v0.1.html",
        ),
      );

      try {
        accessSync(htmlPath, constants.R_OK);
      } catch {
        console.log("Dashboard not found: " + htmlPath);
        process.exitCode = 1;
        return;
      }

      if (wantsJson(argv)) {
        console.log(
          JSON.stringify(
            { schema: "bizra.dema.dashboard.v0.1", path: htmlPath },
            null,
            2,
          ),
        );
        return;
      }

      const status = await statusWithLocalIdentity();
      const version = await readPackageVersion();
      const statusPayload = {
        node: status.node || "Node0",
        human: status.human || "unknown",
        ready: status.ready,
        consoleReady: status.consoleReady,
        activationGate: status.activationGate || "BLOCKED",
        daemonStatus: status.daemonStatus,
        missionExecuted: status.missionExecuted,
        runtimePulse: status.runtimePulse,
        modelConnected: status.modelConnected,
        nextAction: status.nextAdmissibleAction || "complete_setup",
        version,
        generated_at: new Date().toISOString(),
      };

      const useStatic = argv.includes("--static");
      let openPath = htmlPath;

      if (!useStatic) {
        const html = readFileSync(htmlPath, "utf8");
        const injection = `<script>window.__DEMA_STATUS__=${JSON.stringify(statusPayload)};</script>`;
        const filled = html.replace("</body>", injection + "\n</body>");
        const tmp = mkdtempSync(join(tmpdir(), "dema-dashboard-"));
        openPath = join(tmp, "dashboard.html");
        writeFileSync(openPath, filled, "utf8");
      }

      const opener =
        process.platform === "darwin"
          ? "open"
          : process.platform === "win32"
            ? "start"
            : "xdg-open";
      const { execFile } = await import("node:child_process");
      execFile(opener, [openPath], () => {});
      console.log(
        useStatic
          ? "Opening static dashboard: " + openPath
          : "Opening live dashboard: " + openPath,
      );
      return;
    }

    case "ambient": {
      if (subcommand === "--manifest") {
        const manifest = buildAmbientManifestPreview();
        console.log(
          argv.includes("--json")
            ? JSON.stringify(manifest, null, 2)
            : formatAmbientManifestPreview(manifest),
        );
        return;
      }
      if (subcommand === "audit") {
        const audit = buildAmbientAuditPreview();
        console.log(
          argv.includes("--json")
            ? JSON.stringify(audit, null, 2)
            : formatAmbientAuditPreview(audit),
        );
        return;
      }
      console.log(formatAmbientBoundary(buildAmbientBoundary()));
      return;
    }

    case "ambient:json": {
      console.log(JSON.stringify(buildAmbientBoundary(), null, 2));
      return;
    }

    case "journey": {
      const json = argv.includes("--json");
      const intent = argv
        .slice(1)
        .filter((arg) => arg !== "--json")
        .join(" ")
        .trim();
      const journey = buildSovereignJourneyPreview({ intent });
      console.log(
        json
          ? JSON.stringify(journey, null, 2)
          : formatSovereignJourneyPreview(journey),
      );
      return;
    }

    case "diagnostics": {
      if (subcommand !== "plan") {
        throw new Error(
          "Unknown diagnostics command. Use `dema diagnostics plan [--json]`.",
        );
      }
      const plan = buildDiagnosticsMissionPlan();
      console.log(
        argv.includes("--json")
          ? JSON.stringify(plan, null, 2)
          : formatDiagnosticsMissionPlan(plan),
      );
      return;
    }

    case "consent": {
      if (subcommand !== "plan") {
        throw new Error(
          'Unknown consent command. Use `dema consent plan "<intent>"`.',
        );
      }
      const json = argv.includes("--json");
      const intent = argv
        .slice(2)
        .filter((arg) => arg !== "--json")
        .join(" ")
        .trim();
      if (!intent)
        throw new Error('Usage: dema consent plan [--json] "<intent>"');
      const plan = buildConsentPlanPreview({ intent });
      console.log(
        json ? JSON.stringify(plan, null, 2) : formatConsentPlanPreview(plan),
      );
      return;
    }

    case "mission": {
      if (subcommand === "run" && argv[2] === "health") {
        const consent = argValue(argv, "--consent") ?? "";
        const dryRun = argv.includes("--dry-run");
        const wantJsonM = argv.includes("--json") || !process.stdout.isTTY;
        if (dryRun && !consent) {
          const snap = await buildHealthSnapshot();
          if (wantJsonM) {
            console.log(
              JSON.stringify(
                { ...snap, saved: false, reason: "dry_run", dry_run: true },
                null,
                2,
              ),
            );
          } else {
            console.log(
              formatHealthSnapshotReceipt({
                ...snap,
                saved: false,
                reason: "dry_run",
              }),
            );
          }
          return;
        }
        const result = await saveHealthSnapshotReceipt({ consent, dryRun });
        if (wantJsonM) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(formatHealthSnapshotReceipt(result));
        }
        if (!result.saved && result.reason !== "dry_run") process.exitCode = 1;
        return;
      }
      if (subcommand === "verify" && argv[2]) {
        const mPath = argv[2];
        const wantJsonMV = argv.includes("--json") || !process.stdout.isTTY;
        const mv = await verifyHealthSnapshotReceipt(mPath);
        console.log(
          wantJsonMV
            ? JSON.stringify(mv, null, 2)
            : JSON.stringify(mv, null, 2),
        );
        if (mv.verdict !== "VERIFIED") process.exitCode = 1;
        return;
      }
      if (subcommand === "draft") {
        const json = argv.includes("--json");
        const intent = argv
          .slice(2)
          .filter((arg) => arg !== "--json")
          .join(" ")
          .trim();
        if (!intent)
          throw new Error('Usage: dema mission draft [--json] "<intent>"');
        const draft = buildMissionDraftPreview({ intent });
        draft.pre_execution_manifest = buildMissionManifest("health_snapshot", {
          now: new Date(),
        });
        console.log(
          json
            ? JSON.stringify(draft, null, 2)
            : formatMissionDraftPreview(draft),
        );
        return;
      }
      if (subcommand === "manifest") {
        const missionType =
          argv[2] && !argv[2].startsWith("-") ? argv[2] : undefined;
        const wantJsonMF = wantsJson(argv);
        const manifest = buildMissionManifest(missionType);
        if (manifest.error) {
          if (wantJsonMF) {
            console.log(
              JSON.stringify(
                {
                  schema: "bizra.dema.mission_manifest.v0.1",
                  error: manifest.error,
                },
                null,
                2,
              ),
            );
          } else {
            console.error(manifest.error);
          }
          process.exitCode = 1;
          return;
        }
        if (wantJsonMF) {
          console.log(JSON.stringify(manifest, null, 2));
        } else {
          console.log(formatMissionManifest(manifest));
        }
        return;
      }
      if (subcommand === "probe") {
        const wantJsonPR = wantsJson(argv);
        try {
          const { fileURLToPath: probeURL } = await import("node:url");
          const { dirname: probeDirname, join: probeJoin } =
            await import("node:path");
          const repoRoot = probeJoin(
            probeDirname(probeURL(import.meta.url)),
            "..",
            "..",
            "..",
          );
          const report = await runMissionProbe(repoRoot);
          if (wantJsonPR) {
            console.log(JSON.stringify(report, null, 2));
          } else {
            console.log(renderProbeText(report));
          }
          if (report.verdict === "FAILED") process.exitCode = 1;
        } catch (err) {
          if (wantJsonPR) {
            console.log(
              JSON.stringify(
                {
                  schema: "bizra.dema.mission_probe.v0.1",
                  error: err.message,
                },
                null,
                2,
              ),
            );
          } else {
            console.error(`Probe error: ${err.message}`);
          }
          process.exitCode = 2;
        }
        return;
      }
      if (subcommand === "closeout") {
        const missionId =
          argv[2] && !argv[2].startsWith("-") ? argv[2] : undefined;
        const wantJsonCO = wantsJson(argv);
        const resolved = await resolveMissionReceipt(missionId);
        if (resolved.error) {
          if (wantJsonCO) {
            console.log(
              JSON.stringify(
                {
                  schema: "bizra.dema.mission_closeout.v0.1",
                  error: resolved.error,
                },
                null,
                2,
              ),
            );
          } else {
            console.error(resolved.error);
          }
          process.exitCode = 1;
          return;
        }
        const report = buildCloseoutReport(
          resolved.receipt,
          resolved.path,
          resolved.filename,
        );
        if (report.error) {
          if (wantJsonCO) {
            console.log(
              JSON.stringify(
                {
                  schema: "bizra.dema.mission_closeout.v0.1",
                  error: report.error,
                },
                null,
                2,
              ),
            );
          } else {
            console.error(report.error);
          }
          process.exitCode = 1;
          return;
        }
        if (wantJsonCO) {
          console.log(JSON.stringify(report, null, 2));
        } else {
          console.log(renderCloseoutText(report));
        }
        return;
      }
      if (subcommand !== "propose") {
        throw new Error(
          'Unknown mission command. Use `dema mission draft "<intent>"` or `dema mission propose`.',
        );
      }
      const status = await statusWithLocalIdentity();
      const consent = argValue(argv, "--consent") ?? "";
      const proposePreview = previewBoundedDiagnostic(status, consent);
      if (wantsJson(argv)) {
        console.log(JSON.stringify(proposePreview, null, 2));
        return;
      }
      console.log(
        [
          "Dema mission propose",
          `  Action: ${proposePreview.action}`,
          `  Executes: ${proposePreview.executes}`,
          `  Proposal allowed: ${proposePreview.proposal.allowed}`,
          `  Consent accepted: ${proposePreview.consent.accepted}`,
          `  Next: ${proposePreview.next}`,
          humanHintLine("mission propose"),
        ].join("\n"),
      );
      return;
    }

    case "receipts": {
      const selector = argv.slice(1).find((a) => !a.startsWith("-"));
      if (selector) {
        console.log(JSON.stringify(await readReceipt(selector), null, 2));
      } else {
        const allReceipts = await listReceipts();
        if (wantsJson(argv)) {
          console.log(JSON.stringify(allReceipts, null, 2));
        } else {
          console.log(formatReceiptList(allReceipts));
        }
      }
      return;
    }

    case "memory": {
      const action = subcommand;
      if (action === "--help" || action === "-h") {
        console.log(
          [
            "dema memory — local memory entries + BIZRA Omega AgentDB query (MC-A v0.1)",
            "",
            "USAGE",
            "  dema memory [list]                       List Dema auto-memory entries",
            "  dema memory show <name>                  Show one memory entry by name",
            '  dema memory query "<text>" [--top N]     Query BIZRA Omega AgentDB (MC-A)',
            "    [--json]",
            "",
            "MC-A query: spawns ~/.dema/bin/agent-db-query · AgentDB.search() facade",
            "  Discipline: read-only · no LLM · no mission loop · no receipt mint",
            "  Override Omega root with BIZRA_OMEGA_ROOT env var (default: /data/bizra/dema-runtime-arch-wt)",
            "  Override wrapper path with DEMA_AGENT_DB_QUERY_PATH (test only)",
          ].join("\n"),
        );
        return;
      }
      if (!action || action === "list") {
        console.log(JSON.stringify(await summarizeMemory(), null, 2));
      } else if (action === "show") {
        const name = argv[2];
        if (!name) throw new Error("Usage: dema memory show <name>");
        console.log(JSON.stringify(await readMemoryEntry(name), null, 2));
      } else if (action === "query") {
        // MC-A v0.1 · read-only operator-local memory query against BIZRA
        // Omega AgentDB. Bridges Dema JS → ~/.dema/bin/agent-db-query (Python)
        // → AgentDB.search() facade. Per ADR-022 doctrine the Omega substrate
        // stays outside this repo. Discipline: read-only · no LLM · no mission
        // loop · no chain mint · schema-envelope-bound (NOT receipt-bound).
        const queryText = argv[2];
        if (!queryText || queryText.startsWith("-")) {
          console.error(
            'dema memory query: missing <text> argument. Usage: dema memory query "<text>" [--top N]',
          );
          process.exitCode = 2;
          return;
        }
        const memTopArg = argValue(argv, "--top");
        let memTop = memTopArg ? parseInt(memTopArg, 10) : 3;
        if (!Number.isInteger(memTop) || memTop < 1 || memTop > 20) {
          console.error(
            `dema memory query: --top out of range: must be integer in [1, 20] (got '${memTopArg}')`,
          );
          process.exitCode = 2;
          return;
        }
        const memWantsJson = argv.includes("--json");

        const { existsSync: memExistsSync } = await import("node:fs");
        const { spawnSync: memSpawnSync } = await import("node:child_process");
        const { homedir: memHomedir } = await import("node:os");
        const { join: memJoinPath } = await import("node:path");

        const wrapperPath =
          process.env.DEMA_AGENT_DB_QUERY_PATH ||
          memJoinPath(memHomedir(), ".dema", "bin", "agent-db-query");

        // Defensive snippet truncation: even if the wrapper misbehaves and
        // returns snippets longer than 200 chars, Dema must keep its boundary
        // claim honest (memory_domain_boundary.snippet_max_chars: 200).
        const truncateHits = (rawHits) => {
          if (!Array.isArray(rawHits)) return [];
          return rawHits.map((h) => {
            const snippet =
              typeof h?.snippet === "string"
                ? h.snippet.slice(0, 200)
                : h?.snippet;
            return { ...h, snippet };
          });
        };

        const buildMemEnv = ({
          wrapperExit,
          wrapperDurationMs,
          wrapperEnvelope,
          errorMessage,
        }) => ({
          schema: "bizra.dema.memory_query_result.v0.1",
          tool_version: "dema-memory-query-v0.1",
          generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
          query: queryText,
          top: memTop,
          hits: truncateHits(wrapperEnvelope?.hits),
          hits_count: wrapperEnvelope?.hits_count ?? 0,
          wrapper_invoked: wrapperPath,
          wrapper_exit_code: wrapperExit,
          wrapper_duration_ms: wrapperDurationMs,
          omega_root_used: wrapperEnvelope?.omega_root_used ?? null,
          error: errorMessage ?? null,
          verdict_role: "suggestion",
          consent: {
            consent_mode: "typed_command_read_only",
            consent_level: "C0_OPERATOR_LOCAL_READ",
            exact_string_consent_required: false,
          },
          boundary: {
            filesystem_write_performed: false,
            network_used: false,
            runtime_execution_performed: true,
            model_loaded: false,
            model_invocation_performed: false,
            prompt_executed: false,
            external_call_performed: false,
            raw_corpus_scan_performed: false,
            raw_data_included: false,
            tool_executed: false,
            chain_advance_performed: false,
            receipt_mint_performed: false,
            federation_invoked: false,
            node_connection_performed: false,
            public_network_used: false,
            consent_collected: true,
          },
          memory_domain_boundary: {
            memory_snippet_included: true,
            raw_memory_dump_included: false,
            snippet_max_chars: 200,
            public_safe: false,
            operator_local_only: true,
          },
        });

        if (!memExistsSync(wrapperPath)) {
          const env = buildMemEnv({
            wrapperExit: -1,
            wrapperDurationMs: 0,
            wrapperEnvelope: null,
            errorMessage: `wrapper not found at ${wrapperPath} — install or set DEMA_AGENT_DB_QUERY_PATH`,
          });
          if (memWantsJson) {
            console.log(JSON.stringify(env, null, 2));
          } else {
            console.error(
              `dema memory query: wrapper not found at ${wrapperPath}`,
            );
            console.error(
              "  install ~/.dema/bin/agent-db-query or set DEMA_AGENT_DB_QUERY_PATH",
            );
          }
          process.exitCode = 1;
          return;
        }
        const memT0 = Date.now();
        const memResult = memSpawnSync(
          "python3",
          [
            wrapperPath,
            "--query",
            queryText,
            "--top",
            String(memTop),
            "--json",
          ],
          { encoding: "utf8", timeout: 30000 },
        );
        const memDuration = Date.now() - memT0;
        let memWrapperEnv = null;
        let memErrMsg = null;
        if (memResult.error) {
          memErrMsg = `spawn failed: ${memResult.error.message}`;
        } else if (memResult.signal === "SIGTERM") {
          memErrMsg = `wrapper timeout after 30000ms`;
        } else {
          try {
            memWrapperEnv = JSON.parse(memResult.stdout || "{}");
          } catch (e) {
            memErrMsg = `wrapper stdout not JSON: ${e.message}`;
          }
        }
        const memExit = memResult.status ?? -1;
        // Propagate wrapper non-zero exit into env.error so the Dema exit code
        // honestly reflects the subprocess outcome. Without this, a wrapper
        // exit 3 + valid JSON stdout would silently let Dema exit 0.
        if (!memErrMsg && memExit !== 0) {
          const wrappedErr =
            memWrapperEnv &&
            typeof memWrapperEnv.error === "string" &&
            memWrapperEnv.error
              ? memWrapperEnv.error
              : `wrapper exited with code ${memExit}`;
          memErrMsg = wrappedErr;
        }
        const env = buildMemEnv({
          wrapperExit: memExit,
          wrapperDurationMs: memDuration,
          wrapperEnvelope: memWrapperEnv,
          errorMessage: memErrMsg,
        });
        if (memWantsJson) {
          console.log(JSON.stringify(env, null, 2));
        } else {
          console.log(
            `Dema memory query: ${env.hits_count} hit(s) for "${env.query}" (top=${env.top})`,
          );
          for (const h of env.hits) {
            console.log(
              `  · ${h.id} [score ${h.score}] — ${h.snippet?.slice(0, 80) ?? ""}…`,
            );
          }
          if (env.error) console.error(`error: ${env.error}`);
        }
        process.exitCode = env.error ? 1 : 0;
        return;
      } else {
        throw new Error(
          'Unknown memory command. Use `dema memory [list]` or `dema memory show <name>` or `dema memory query "<text>" [--top N]`.',
        );
      }
      return;
    }

    case "think": {
      if (argv.includes("--probe")) {
        const wantJsonTP = wantsJson(argv);
        try {
          const { fileURLToPath: tpURL } = await import("node:url");
          const { dirname: tpDirname, join: tpJoin } =
            await import("node:path");
          const tpRepoRoot = tpJoin(
            tpDirname(tpURL(import.meta.url)),
            "..",
            "..",
            "..",
          );
          const tpReport = await runThinkProbe(tpRepoRoot);
          if (wantJsonTP) {
            console.log(JSON.stringify(tpReport, null, 2));
          } else {
            console.log(renderThinkProbeText(tpReport));
          }
          if (tpReport.verdict === "FAILED") process.exitCode = 1;
        } catch (err) {
          if (wantJsonTP) {
            console.log(
              JSON.stringify(
                {
                  schema: "bizra.dema.think_probe.v0.1",
                  error: err.message,
                },
                null,
                2,
              ),
            );
          } else {
            console.error(`Think probe error: ${err.message}`);
          }
          process.exitCode = 2;
        }
        return;
      }

      const closeoutPath = argValue(argv, "--closeout");
      if (closeoutPath) {
        const wantJsonTC = wantsJson(argv);
        try {
          const {
            readFile: tcReadFile,
            readdir: tcReaddir,
            stat: tcStat,
          } = await import("node:fs/promises");
          const { join: tcJoin } = await import("node:path");
          const { homedir: tcHd } = await import("node:os");
          let raw;
          if (closeoutPath === "latest") {
            const tcHome = process.env.DEMA_HOME || tcJoin(tcHd(), ".dema");
            const tcDir = tcJoin(tcHome, "receipts");
            let tcFiles;
            try {
              tcFiles = (await tcReaddir(tcDir)).filter(
                (f) => f.startsWith("think-") && f.endsWith(".json"),
              );
            } catch {
              tcFiles = [];
            }
            if (tcFiles.length === 0) {
              const noMsg =
                "No think receipts found. Run a think with --save-receipt first.";
              if (wantJsonTC) {
                console.log(
                  JSON.stringify(
                    { schema: "bizra.dema.think_closeout.v0.1", error: noMsg },
                    null,
                    2,
                  ),
                );
              } else {
                console.error(noMsg);
              }
              process.exitCode = 1;
              return;
            }
            const withMtime = await Promise.all(
              tcFiles.map(async (f) => {
                const fp = tcJoin(tcDir, f);
                const s = await tcStat(fp);
                return { path: fp, mtime: s.mtimeMs };
              }),
            );
            withMtime.sort((a, b) => b.mtime - a.mtime);
            raw = await tcReadFile(withMtime[0].path, "utf8");
          } else {
            raw = await tcReadFile(closeoutPath, "utf8");
          }
          const envelope = JSON.parse(raw);
          const closeout = buildThinkCloseout(envelope);
          if (closeout.error) {
            if (wantJsonTC) {
              console.log(
                JSON.stringify(
                  {
                    schema: "bizra.dema.think_closeout.v0.1",
                    error: closeout.error,
                  },
                  null,
                  2,
                ),
              );
            } else {
              console.error(closeout.error);
            }
            process.exitCode = 1;
          } else if (wantJsonTC) {
            console.log(JSON.stringify(closeout, null, 2));
          } else {
            console.log(formatThinkCloseout(closeout));
          }
        } catch (err) {
          if (wantsJson(argv)) {
            console.log(
              JSON.stringify(
                {
                  schema: "bizra.dema.think_closeout.v0.1",
                  error: err.message,
                },
                null,
                2,
              ),
            );
          } else {
            console.error(`Think closeout error: ${err.message}`);
          }
          process.exitCode = 2;
        }
        return;
      }

      const hasDryRun = argv.includes("--dry-run");
      const thinkConsent = argValue(argv, "--consent") ?? "";
      const modelConsent = argValue(argv, "--model-consent") ?? "";
      const thinkModel = argValue(argv, "--model") ?? "";
      const wantJsonTH = wantsJson(argv);

      if (hasDryRun && thinkConsent) {
        const msg = "Cannot use both --dry-run and --consent.";
        if (wantJsonTH) {
          console.log(
            JSON.stringify(
              { schema: "bizra.dema.think_dry_run.v0.1", error: msg },
              null,
              2,
            ),
          );
        } else {
          console.error(msg);
        }
        process.exitCode = 1;
        return;
      }

      if (!hasDryRun && !thinkConsent) {
        const msg =
          'Specify --dry-run or --consent "RUN LOCAL THINK".\n' +
          "Usage:\n" +
          '  dema think "<query>" --dry-run [--json]\n' +
          '  dema think "<query>" --consent "RUN LOCAL THINK" --model-consent "<phrase>" [--json]';
        if (wantJsonTH) {
          console.log(
            JSON.stringify(
              { schema: "bizra.dema.think_live.v0.1", error: msg },
              null,
              2,
            ),
          );
        } else {
          console.error(msg);
        }
        process.exitCode = 1;
        return;
      }

      const saveConsentVal = argValue(argv, "--save-consent") ?? "";
      const thinkQuery = argv
        .slice(1)
        .filter(
          (a) =>
            a !== "--dry-run" &&
            a !== "--json" &&
            a !== "--no-color" &&
            a !== "--consent" &&
            a !== thinkConsent &&
            a !== "--model-consent" &&
            a !== modelConsent &&
            a !== "--model" &&
            a !== thinkModel &&
            a !== "--save-receipt" &&
            a !== "--save-consent" &&
            a !== saveConsentVal,
        )
        .join(" ")
        .trim();

      if (!thinkQuery) {
        const msg =
          'Missing query. Usage: dema think "<query>" --dry-run [--json]';
        if (wantJsonTH) {
          console.log(
            JSON.stringify(
              { schema: "bizra.dema.think_dry_run.v0.1", error: msg },
              null,
              2,
            ),
          );
        } else {
          console.error(msg);
        }
        process.exitCode = 1;
        return;
      }

      if (hasDryRun) {
        try {
          const thinkEnvelope = await buildThinkDryRun(thinkQuery);
          if (thinkEnvelope.error) {
            if (wantJsonTH) {
              console.log(
                JSON.stringify(
                  {
                    schema: "bizra.dema.think_dry_run.v0.1",
                    error: thinkEnvelope.error,
                  },
                  null,
                  2,
                ),
              );
            } else {
              console.error(thinkEnvelope.error);
            }
            process.exitCode = 1;
            return;
          }
          if (wantJsonTH) {
            console.log(JSON.stringify(thinkEnvelope, null, 2));
          } else {
            console.log(formatThinkDryRun(thinkEnvelope));
          }
        } catch (err) {
          if (wantJsonTH) {
            console.log(
              JSON.stringify(
                { schema: "bizra.dema.think_dry_run.v0.1", error: err.message },
                null,
                2,
              ),
            );
          } else {
            console.error(`Think error: ${err.message}`);
          }
          process.exitCode = 2;
        }
        return;
      }

      try {
        const liveEnvelope = await buildThinkLive(thinkQuery, {
          thinkConsent,
          modelConsent,
          model: thinkModel,
        });
        if (liveEnvelope.error) {
          if (wantJsonTH) {
            console.log(
              JSON.stringify(
                {
                  schema: "bizra.dema.think_live.v0.1",
                  error: liveEnvelope.error,
                },
                null,
                2,
              ),
            );
          } else {
            console.error(liveEnvelope.error);
          }
          process.exitCode = 1;
          return;
        }
        if (wantJsonTH) {
          console.log(JSON.stringify(liveEnvelope, null, 2));
        } else {
          console.log(formatThinkLive(liveEnvelope));
        }

        if (argv.includes("--save-receipt")) {
          const saveConsent = argValue(argv, "--save-consent") ?? "";
          const saveResult = await saveThinkReceipt(liveEnvelope, {
            demaHome: process.env.DEMA_HOME,
            consent: saveConsent,
            pretty: true,
          });
          if (!saveResult.saved) {
            if (saveResult.reason === "consent_missing") {
              console.error(
                `dema think: --save-receipt requires --save-consent "${THINK_RECEIPT_SAVE_CONSENT}"\n`,
              );
            } else if (saveResult.reason === "consent_mismatch") {
              console.error(
                `dema think: --save-receipt consent phrase mismatch; required: "${THINK_RECEIPT_SAVE_CONSENT}"\n`,
              );
            } else {
              console.error(
                `dema think: --save-receipt failed (${saveResult.reason}): ${saveResult.error_message ?? "unknown"}\n`,
              );
            }
            process.exitCode = 1;
          } else {
            console.error(`saved receipt to: ${saveResult.path}\n`);
          }
        }
      } catch (err) {
        if (wantJsonTH) {
          console.log(
            JSON.stringify(
              { schema: "bizra.dema.think_live.v0.1", error: err.message },
              null,
              2,
            ),
          );
        } else {
          console.error(`Think error: ${err.message}`);
        }
        process.exitCode = 2;
      }
      return;
    }

    case "models": {
      // dema models scan [--json]      → C1.5 · schema-tagged local inventory scan
      // dema models                    → existing human-readable inventory
      if (subcommand === "scan") {
        const spinner = createSpinner({
          stdout: process.stdout,
          label: "Scanning local model inventory…",
        });
        spinner.start();
        const scan = await buildLocalModelInventoryScan();
        spinner.stop();
        const scanOutput = argv.includes("--summary")
          ? buildLocalModelInventorySummary(scan)
          : scan;
        if (wantsJson(argv)) {
          console.log(JSON.stringify(scanOutput, null, 2));
          return;
        }
        const providers = scan.providers || {};
        const ollama = providers.ollama || {};
        const lms = providers.lm_studio || {};
        const dl = providers.downloads || {};
        console.log(
          [
            "Dema models scan",
            `  Total models found: ${scan.total_models ?? 0}`,
            `  Ollama: ${ollama.reachable ? "reachable" : "unreachable"} · ${ollama.model_count ?? 0} model(s)`,
            `  LM Studio: ${lms.reachable ? "reachable" : "unreachable"} · ${lms.model_count ?? 0} model(s)`,
            `  Downloads: ${dl.model_count ?? 0} GGUF file(s)`,
            `  Boundary: read-only; local probes only; no model invoked`,
            humanHintLine("models scan"),
          ].join("\n"),
        );
        return;
      }
      const inventory = await collectModelInventory();
      console.log(formatModelInventory(inventory));
      return;
    }

    case "report": {
      if (subcommand !== "safety") {
        throw new Error(
          "Unknown report command. Use `dema report safety [--json]`.",
        );
      }
      const report = buildSafetyReportPreview();
      console.log(
        argv.includes("--json")
          ? JSON.stringify(report, null, 2)
          : formatSafetyReportPreview(report),
      );
      return;
    }

    case "network": {
      if (subcommand === "blueprint") {
        const blueprint = buildNetworkBlueprint();
        console.log(
          argv.includes("--json")
            ? JSON.stringify(blueprint, null, 2)
            : formatNetworkBlueprint(blueprint),
        );
        return;
      }
      if (subcommand === "fixture" && argv[2] === "preview") {
        const preview = buildOfflineNetworkFixturePreview();
        console.log(
          argv.includes("--json")
            ? JSON.stringify(preview, null, 2)
            : formatOfflineNetworkFixturePreview(preview),
        );
        return;
      }
      if (subcommand === "refusal" && argv[2] === "preview") {
        const preview = buildNetworkRefusalMatrixPreview();
        console.log(
          argv.includes("--json")
            ? JSON.stringify(preview, null, 2)
            : formatNetworkRefusalMatrixPreview(preview),
        );
        return;
      }
      throw new Error(
        "Unknown network command. Use `dema network blueprint [--json]`, `dema network fixture preview [--json]`, or `dema network refusal preview [--json]`.",
      );
    }

    case "amana": {
      const amanaCommand = argv[1];
      const amanaSubcommand = argv[2];
      if (amanaCommand !== "contracts" || amanaSubcommand !== "preview") {
        throw new Error(
          "Unknown amana command. Use `dema amana contracts preview [--json]`.",
        );
      }
      const preview = buildAmanaContractsPreview();
      console.log(
        argv.includes("--json")
          ? JSON.stringify(preview, null, 2)
          : formatAmanaContractsPreview(preview),
      );
      return;
    }

    case "mcp": {
      if (subcommand !== "blueprint") {
        throw new Error(
          "Unknown mcp command. Use `dema mcp blueprint [--json]`.",
        );
      }
      const blueprint = buildMcpIntegrationBlueprint();
      console.log(
        argv.includes("--json")
          ? JSON.stringify(blueprint, null, 2)
          : formatMcpIntegrationBlueprint(blueprint),
      );
      return;
    }

    case "roadmap": {
      if (subcommand === "preview") {
        const report = buildOptimizationRoadmapPreview();
        console.log(
          argv.includes("--json")
            ? JSON.stringify(report, null, 2)
            : formatOptimizationRoadmapPreview(report),
        );
        return;
      }
      if (subcommand === "dev") {
        const state = await gatherDevRoadmapState({ cwd: process.cwd() });
        console.log(
          argv.includes("--json")
            ? JSON.stringify(state, null, 2)
            : formatDevRoadmapReport(state),
        );
        return;
      }
      throw new Error(
        "Unknown roadmap command. Use `dema roadmap preview [--json]` or `dema roadmap dev [--json]`.",
      );
    }

    case "eval": {
      const evalCommand = argv[1];
      const evalSubcommand = argv[2];
      const asJson = argv.includes("--json");

      if (evalCommand !== "layer2") {
        throw new Error(
          "Unknown eval command. Use `dema eval layer2 prompts [--json]` or `dema eval layer2 verify <abs-path> [--json]`.",
        );
      }

      if (evalSubcommand === "prompts") {
        const pack = getRubricPack();
        console.log(
          asJson ? JSON.stringify(pack, null, 2) : formatRubricPackReport(pack),
        );
        return;
      }

      if (evalSubcommand === "verify") {
        const verdictPath = argv[3];
        if (!verdictPath) {
          throw new Error(
            "Missing <abs-path>. Use `dema eval layer2 verify <abs-path-to-pasted-verdict.json> [--json]`.",
          );
        }
        const { isAbsolute: pathIsAbsolute, resolve: pathResolve } =
          await import("node:path");
        if (!pathIsAbsolute(verdictPath)) {
          throw new Error(
            "`dema eval layer2 verify` requires an absolute path to the pasted verdict file.",
          );
        }
        const { readFile: readVerdictFile } = await import("node:fs/promises");
        let parsed;
        try {
          const raw = await readVerdictFile(pathResolve(verdictPath), "utf8");
          parsed = JSON.parse(raw);
        } catch (readErr) {
          throw new Error(
            `Failed to read or parse verdict file at ${verdictPath}: ${readErr && readErr.message ? readErr.message : readErr}`,
          );
        }
        const result = validatePastedJudgeVerdict(parsed);
        console.log(
          asJson
            ? JSON.stringify(result, null, 2)
            : formatVerdictReport(result),
        );
        // Exit 0 only when the documented success state holds. truth_label is
        // the authoritative contract surface (see docs/TESTING.md row); gating
        // on it directly prevents drift if a future truth_label value is added.
        if (result.truth_label !== "MEASURED") {
          process.exitCode = 1;
        }
        return;
      }

      throw new Error(
        "Unknown eval layer2 subcommand. Use `dema eval layer2 prompts [--json]` or `dema eval layer2 verify <abs-path> [--json]`.",
      );
    }

    case "evidence": {
      const receiptCommand = argv[1];
      const receiptSubcommand = argv[2];
      if (receiptCommand !== "receipt" || receiptSubcommand !== "preview") {
        throw new Error(
          "Unknown evidence command. Use `dema evidence receipt preview [--json]`.",
        );
      }
      const receipt = buildEvidenceReceiptPreview();
      console.log(
        argv.includes("--json")
          ? JSON.stringify(receipt, null, 2)
          : formatEvidenceReceiptPreview(receipt),
      );
      return;
    }

    case "ihsan": {
      const floorCommand = argv[1];
      const floorSubcommand = argv[2];
      if (floorCommand !== "floor" || floorSubcommand !== "preview") {
        throw new Error(
          "Unknown ihsan command. Use `dema ihsan floor preview [--score N] [--json]`.",
        );
      }
      const scoreArg = argValue(argv, "--score");
      const score =
        scoreArg === undefined ? DEFAULT_IHSAN_FLOOR : Number(scoreArg);
      const preview = evaluateIhsanFloorPreview({ score });
      console.log(
        argv.includes("--json")
          ? JSON.stringify(preview, null, 2)
          : formatIhsanFloorPreview(preview),
      );
      return;
    }

    case "behavior": {
      const behaviorCommand = argv[1];
      const behaviorSubcommand = argv[2];
      if (
        behaviorCommand !== "modulation" ||
        behaviorSubcommand !== "preview"
      ) {
        throw new Error(
          'Unknown behavior command. Use `dema behavior modulation preview [--consent TEXT] [--score N] [--json] "<intent>"`.',
        );
      }
      const consentPhrase = argValue(argv, "--consent") ?? "";
      const scoreArg = argValue(argv, "--score");
      const ihsanScore = scoreArg === undefined ? 0.95 : Number(scoreArg);
      const intentParts = [];
      for (let index = 3; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === "--json") continue;
        if (arg === "--consent" || arg === "--score") {
          index += 1;
          continue;
        }
        intentParts.push(arg);
      }
      const preview = buildBehavioralModulationPreview({
        intent: intentParts.join(" ").trim(),
        consentPhrase,
        ihsanScore,
      });
      console.log(
        argv.includes("--json")
          ? JSON.stringify(preview, null, 2)
          : formatBehavioralModulationPreview(preview),
      );
      return;
    }

    case "design": {
      if (subcommand !== "emulate-loop") {
        throw new Error(
          "Unknown design command. Use `dema design emulate-loop [--json]`.",
        );
      }
      const report = emulateLoopDesign();
      console.log(
        argv.includes("--json")
          ? JSON.stringify(report, null, 2)
          : formatLoopDesignEmulation(report),
      );
      return;
    }

    case "task": {
      if (!subcommand) {
        // List tasks.
        const list = Object.values(TASK_REGISTRY).map((t) => ({
          id: t.id,
          autonomy_level: t.autonomy_level,
          description: t.description,
        }));
        console.log(
          JSON.stringify(
            { schema: "bizra.dema.task_list.v0.1", tasks: list },
            null,
            2,
          ),
        );
        return;
      }
      const task = TASK_REGISTRY[subcommand];
      if (!task) throw new Error(`Unknown task: ${subcommand}`);

      // Approval gate per A4.5 + B1.2 design. L0/L1/L2 auto-approve
      // (no prompt). L3+ requires interactive approval. L4 routes
      // through FATE evaluateConsent. L5 is unconditionally refused.
      // Fail-closed: a malformed/missing autonomy_level (highestLevel
      // returns null) is refused, not silently downgraded.
      const level = highestLevel(task.autonomy_level);
      if (level === null) {
        console.log(
          `Refused: task ${task.id} has malformed or missing autonomy_level ` +
            `(got: ${JSON.stringify(task.autonomy_level)}). Expected L0..L5.`,
        );
        return { refused: true, reason: "malformed_autonomy_level" };
      }
      if (level >= 3) {
        const approval = await requestApproval({
          autonomyLevel: levelLabel(level),
          action: `task ${task.id}`,
          scope: task.scope ?? task.description ?? null,
          requireExactPhrase: task.requireExactPhrase,
        });
        if (!approval.approved) {
          console.log(`Refused: ${approval.refused_reason}`);
          return { refused: true, reason: approval.refused_reason };
        }
      }

      const taskSpinner = createSpinner({
        stdout: process.stdout,
        label: `Running ${task.id}…`,
      });
      taskSpinner.start();
      const receipt = await task.run();
      taskSpinner.stop();
      // Route through verifyReceipt dispatcher (per v0.3.2 spec acceptance
      // criterion #5; see docs/02-architecture/sat-verifier-sibling-spec.md).
      // Dispatcher fails closed on unknown schema; task receipts route to the
      // placeholder logic, gateway-issued receipts route to the gateway-handoff
      // verifier. Caps at PARTIAL_PLACEHOLDER per spec — never returns PERMIT
      // from local logic; SAT-5 PERMIT is reserved for upstream Rust roster.
      const verdict = verifyReceipt(receipt);
      console.log(task.format(receipt));
      console.log("");
      console.log(formatVerdict(verdict));
      return;
    }

    case "monetize":
      console.log(
        [
          "Dema monetize: safe offer guardian.",
          "Allowed now: Sovereign Local AI Node Setup + Safety Audit.",
          "Blocked: token claims, passive income claims, AGI claims, public federation claims.",
        ].join("\n"),
      );
      return;

    case "sovereign": {
      // Sovereign Mission Interface — 7-panel cockpit renderer
      // Delegates to the Python scaffold at ~/.dema/kernel/sovereign_tui/sovereign.py
      // Schema: bizra.dema.sovereign_tui_render.v0.1
      const { existsSync } = await import("node:fs");
      const { join } = await import("node:path");
      const { spawnSync } = await import("node:child_process");
      const home = process.env.HOME || process.env.USERPROFILE;
      const demaHome =
        process.env.DEMA_HOME || (home ? join(home, ".dema") : null);
      if (!demaHome) {
        console.error(
          "dema sovereign: unable to resolve DEMA_HOME (set DEMA_HOME or HOME).",
        );
        process.exit(1);
      }
      const scaffold = join(
        demaHome,
        "kernel",
        "sovereign_tui",
        "sovereign.py",
      );
      if (!existsSync(scaffold)) {
        console.error(`dema sovereign: scaffold not found: ${scaffold}`);
        process.exit(1);
      }
      const result = spawnSync("python3", [scaffold, ...argv.slice(1)], {
        stdio: "inherit",
      });
      if (result.error) {
        console.error(
          `dema sovereign: failed to spawn python3: ${result.error.message}`,
        );
        process.exit(1);
      }
      // status null without error is unusual; fail-safe to non-zero
      process.exit(result.status ?? 1);
    }

    case "help": {
      const helpArg = argv[1];
      if (!helpArg) {
        console.log(renderHelpRoot());
        return;
      }
      if (helpArg === "--all") {
        console.log(await renderFullHelp());
        return;
      }
      // Try topic first, then command detail, then unknown.
      const topicOutput = renderHelpTopic(helpArg);
      if (topicOutput !== null) {
        console.log(topicOutput);
        return;
      }
      const commandOutput = renderHelpCommand(helpArg);
      if (commandOutput !== null) {
        console.log(commandOutput);
        return;
      }
      console.log(renderHelpUnknown(helpArg));
      return;
    }

    // -h and --help emit the full flat list (opt-in backward-compat path).
    case "-h":
    case "--help":
      console.log(await renderFullHelp());
      return;

    default: {
      const result = suggestCommands(command, REGISTERED_COMMANDS_LIST);
      const lines = [
        `I don't have a \`${result.missingToken || command}\` command.`,
        "",
      ];
      if (result.matched === "natural-language" || result.matched === "close") {
        lines.push("Did you mean:");
        for (const s of result.suggestions) {
          lines.push(`  - dema ${s.command.padEnd(32)} — ${s.description}`);
        }
      } else {
        lines.push(
          "I couldn't find a close match. Type `dema help` for the full list.",
        );
      }
      lines.push("", "Type `dema help` to see everything I can do.");
      console.log(lines.join("\n"));
      return;
    }
  }
}

async function runActiveKernel({ interactive = false, force = false } = {}) {
  const inputs = await gatherBannerInputs();
  const banner = formatBanner(inputs);

  if (interactive) {
    await runShell({
      greeting: banner,
      dispatchCommand: dispatch,
      statusProvider: () => statusWithLocalIdentity(),
    });
    return;
  }

  console.log(banner);
  if (force) {
    // chat was requested but we aren't in a TTY. Be explicit.
    console.log("");
    console.log("(stdin is not a TTY — interactive shell skipped.)");
  }
}

// Allow tests to import dispatch + runActiveKernel without firing main().
const isDirectInvocation =
  process.argv[1] &&
  (process.argv[1].endsWith("/index.js") || process.argv[1].endsWith("/dema"));

if (isDirectInvocation) {
  dispatch(process.argv.slice(2))
    .then((result) => {
      // Refusal sentinel from the task gate translates to exit 1 only at
      // the top-level CLI boundary. Inside `dema chat` (where dispatch is
      // invoked from runShell) the refusal stays a per-turn outcome and
      // does not taint the parent process exit code.
      if (result?.refused) process.exit(1);
    })
    .catch((error) => {
      console.error("Dema error:", error?.message ?? error);
      process.exit(1);
    });
}

export { dispatch, runActiveKernel };
export { probeGateway };
export { REGISTERED_COMMANDS_LIST };
