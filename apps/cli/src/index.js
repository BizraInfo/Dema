#!/usr/bin/env node
import { createNode0Adapter } from "../../../packages/node-adapter/src/node0-adapter.js";
import { formatStatus, shouldUseColor } from "../../../packages/core/src/status.js";
import { readOperatorPreferredName } from "../../../packages/core/src/operator-profile.js";
import { buildNode0StatePreview } from "../../../packages/core/src/state.js";
import {
  buildProfileFoundationPreview,
  buildProfileFoundationSummary
} from "../../../packages/core/src/profiles.js";
import { buildConsentCardPreview } from "../../../packages/core/src/consent-card-preview.js";
import {
  buildMissionLoopPreview,
  buildMissionLoopSummary
} from "../../../packages/core/src/mission-loop-preview.js";
import { buildEvidenceChainEventPreviewFromInputs } from "../../../packages/core/src/evidence-chain-event-preview.js";
import { buildNodeRegistryPreview } from "../../../packages/core/src/node-registry-preview.js";
import { buildOnboardingLifecyclePreview } from "../../../packages/core/src/onboarding-lifecycle.js";
import { buildSkillGrowthGovernorPreview } from "../../../packages/core/src/skill-growth-governor.js";
import { buildProjectStatusPreview } from "../../../packages/core/src/project-status-preview.js";
import { buildCraftsmanshipWitnessPreview } from "../../../packages/core/src/craftsmanship-witness-preview.js";
import {
  formatOnboardingLifecyclePreview,
  formatNodeRegistryPreview,
  formatSkillGrowthGovernorPreview,
  formatProjectStatusPreview,
  resolveFormatterOptsFromEnv
} from "../../../packages/core/src/tui-formatter.js";
import { buildLocalLLMRouterPreview } from "../../../packages/core/src/local-llm-router-preview.js";
import {
  buildProcessMiningPreview,
  buildProcessMiningSummary
} from "../../../packages/core/src/process-mining-preview.js";
import {
  buildKeyMakerCompliancePreview,
  buildKeyMakerComplianceSummary
} from "../../../packages/core/src/key-maker-compliance.js";
import {
  buildLLMInvocationPreview,
  buildLLMInvocationSummary,
  invokeLocalLLM
} from "../../../packages/core/src/llm-adapter.js";
import {
  buildLocalModelInventoryScan,
  buildLocalModelInventorySummary
} from "../../../packages/core/src/local-model-inventory-scan.js";
import { previewBoundedDiagnostic } from "../../../packages/core/src/mission.js";
import {
  buildMissionDraftPreview,
  formatMissionDraftPreview
} from "../../../packages/mission/src/mission-draft.js";
import {
  buildDiagnosticsMissionPlan,
  formatDiagnosticsMissionPlan
} from "../../../packages/mission/src/diagnostics-plan.js";
import { recordTodayTick } from "../../../packages/core/src/today.js";
import { listReceipts, readReceipt } from "../../../packages/receipts/src/receipt-store.js";
import { runSetup } from "../../../packages/installer/src/setup.js";
import { runSetupWizard } from "../../../packages/core/src/setup-wizard.js";
import {
  readMemoryEntry,
  summarizeMemory
} from "../../../packages/memory/src/memory-store.js";
import {
  formatBanner,
  gatherBannerInputs,
  probeGateway
} from "../../../packages/core/src/banner.js";
import {
  buildAmbientBoundary,
  formatAmbientBoundary
} from "../../../packages/core/src/ambient.js";
import {
  buildSafetyReportPreview,
  formatSafetyReportPreview
} from "../../../packages/core/src/safety-report.js";
import {
  buildNetworkBlueprint,
  formatNetworkBlueprint
} from "../../../packages/core/src/network-blueprint.js";
import {
  buildOfflineNetworkFixturePreview,
  formatOfflineNetworkFixturePreview
} from "../../../packages/core/src/network-fixture-preview.js";
import {
  buildNetworkRefusalMatrixPreview,
  formatNetworkRefusalMatrixPreview
} from "../../../packages/core/src/network-refusal-matrix-preview.js";
import {
  buildAmanaContractsPreview,
  formatAmanaContractsPreview
} from "../../../packages/core/src/amana-contracts-preview.js";
import {
  buildMcpIntegrationBlueprint,
  formatMcpIntegrationBlueprint
} from "../../../packages/core/src/mcp-blueprint.js";
import {
  buildOptimizationRoadmapPreview,
  formatOptimizationRoadmapPreview
} from "../../../packages/core/src/optimization-roadmap.js";
import {
  buildEvidenceReceiptPreview,
  formatEvidenceReceiptPreview
} from "../../../packages/verifier/src/evidence-receipt-preview.js";
import {
  DEFAULT_IHSAN_FLOOR,
  evaluateIhsanFloorPreview,
  formatIhsanFloorPreview
} from "../../../packages/verifier/src/ihsan-floor-preview.js";
import {
  emulateLoopDesign,
  formatLoopDesignEmulation
} from "../../../packages/core/src/loop-emulator.js";
import {
  buildOnboardingGuide,
  formatOnboardingGuide
} from "../../../packages/core/src/onboarding.js";
import {
  buildBehavioralModulationPreview,
  formatBehavioralModulationPreview
} from "../../../packages/core/src/behavioral-modulation.js";
import { runShell } from "../../../packages/core/src/shell.js";
import { TASK_REGISTRY } from "../../../packages/tasks/src/downloads-audit-preview.js";
import {
  formatVerdict,
  verifyReceipt
} from "../../../packages/verifier/src/sat-placeholder.js";
import {
  buildConsentPlanPreview,
  formatConsentPlanPreview
} from "../../../packages/consent/src/consent-planner.js";
import {
  collectModelInventory,
  formatModelInventory
} from "../../../packages/models/src/model-inventory.js";
import {
  highestLevel,
  levelLabel,
  requestApproval
} from "../../../packages/core/src/approval-gate.js";
import { suggestCommands } from "../../../packages/core/src/command-suggester.js";
import {
  buildExplainPreview,
  formatExplainPreview
} from "../../../packages/core/src/canon-glossary.js";
import {
  shouldShowIntro,
  renderIntroLine,
  recordIntroSeen
} from "../../../packages/core/src/intro-line.js";
import { readBannerKey, KEY_BINDINGS } from "../../../packages/core/src/banner-keys.js";
import {
  renderHelpRoot,
  renderHelpTopic,
  renderHelpCommand,
  renderHelpFlat,
  renderHelpUnknown,
} from "../../../packages/core/src/help-topics.js";
import { wantsJson, humanHintLine } from "../../../packages/core/src/output-mode.js";
import {
  evaluatePredicates,
  formatDoctorDashboard
} from "../../../packages/core/src/doctor-dashboard.js";
import { createSpinner } from "../../../packages/core/src/spinner.js";

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

Readiness:
  dema status       Show human-readable Node0 status
  dema status:json  Show machine-readable status
  dema today        Record a local continuity tick + memory summary
  dema doctor       Validate readiness and consent gate

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
  dema process-mining [--summary]
                           Operator-pattern mirror; surfaces ring_advancement_status; blocks operator_judgment
  dema key-maker-check [--door "<text>"] [--summary]
                           Self-audits reasoning shape against the 5 Key Maker invariants; fails closed when violated
  dema llm-invoke [--model NAME --prompt TEXT] [--invoke --consent "GO: invoke local LLM at NAME"] [--summary]
                           C1 · local LLM adapter · preview-only by default; --invoke + exact consent calls Ollama at localhost

Tasks and views:
  dema task         List registered tasks
  dema task NAME    Run a registered task (read-only in v0.3.0)
  dema sovereign    Render local Sovereign Mission Interface (view-only)
  dema monetize     Show proof-safe first offer boundary
  dema help         Show this list

Dema v0.3.0 — Active Command Kernel. Local-first. Consent-bound. Receipt-aware.`;

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
  { command: "onboarding-lifecycle", description: "onboarding lifecycle preview" },
  { command: "skill-growth-governor", description: "skill growth governor preview" },
  { command: "project-status", description: "project status preview" },
  { command: "craftsmanship-witness", description: "master-craftsmanship creation preview" },
  { command: "llm-router", description: "local LLM router preview" },
  { command: "process-mining", description: "operator-pattern mirror" },
  { command: "key-maker-check", description: "self-audit reasoning against Key Maker invariants" },
  { command: "llm-invoke", description: "local LLM adapter (preview or live call)" },
  { command: "today", description: "record a local continuity tick" },
  { command: "doctor", description: "validate readiness and consent gate" },
  { command: "ambient", description: "show Ambient Sovereign Execution boundary" },
  { command: "ambient:json", description: "ambient boundary as JSON" },
  { command: "diagnostics", description: "preview self-diagnostics harness" },
  { command: "consent", description: "preview a micro-consent scope" },
  { command: "mission", description: "preview mission draft or propose" },
  { command: "receipts", description: "list or show local receipts" },
  { command: "memory", description: "list or show local memory entries" },
  { command: "models", description: "show local model inventory" },
  { command: "report", description: "preview safety report" },
  { command: "network", description: "preview network blueprint or refusal matrix" },
  { command: "amana", description: "preview Amana contract primitives" },
  { command: "mcp", description: "preview MCP integration contract" },
  { command: "roadmap", description: "preview optimization roadmap" },
  { command: "evidence", description: "preview evidence receipt" },
  { command: "ihsan", description: "preview Ihsan floor check" },
  { command: "behavior", description: "preview behavioral modulation" },
  { command: "design", description: "preview PAT/SAT loop design assumptions" },
  { command: "task", description: "list or run registered tasks" },
  { command: "monetize", description: "show proof-safe first offer boundary" },
  { command: "sovereign", description: "render Sovereign Mission Interface" },
  { command: "welcome", description: "show first-run orientation" },
  { command: "onboard", description: "guided onboarding path" },
  { command: "explain", description: "plain-language definition of a BIZRA/Dema concept (28 known)" },
  { command: "setup", description: "create local Dema folders/profile skeleton" },
  { command: "help", description: "show full command list" }
];

async function dispatch(argv) {
  const command = argv[0] ?? "active";
  const subcommand = argv[1];

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
    const [{ formatHomebasePreview }, { resolveFormatterOptsFromEnv }] = await Promise.all([
      import("../../../packages/core/src/tui-formatter.js"),
      import("../../../packages/core/src/tui-formatter.js"),
    ]);
    const opts = resolveFormatterOptsFromEnv(process.env);
    process.stdout.write(formatHomebasePreview(preview, opts) + "\n");

    // Keyboard dispatch — enabled only when both stdin and stdout are TTY
    // and the operator has not opted out via DEMA_BANNER_INTERACTIVE=0.
    const bannerInteractive =
      process.stdin.isTTY &&
      process.stdout.isTTY &&
      process.env.DEMA_BANNER_INTERACTIVE !== "0";

    if (bannerInteractive) {
      const key = await readBannerKey({
        stdin: process.stdin,
        stdout: process.stdout
      });
      const subArgv = key ? KEY_BINDINGS[key] : null;
      if (subArgv) {
        await dispatch(subArgv);
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

    case "onboard": {
      const guide = buildOnboardingGuide();
      console.log(
        argv.includes("--json")
          ? JSON.stringify(guide, null, 2)
          : formatOnboardingGuide(guide)
      );
      return;
    }

    case "explain": {
      const wantJson = argv.includes("--json");
      // Strip --json from arg list to isolate the concept token
      const conceptArgs = argv.slice(1).filter((a) => a !== "--json");
      const concept = conceptArgs[0] ?? null;
      const preview = buildExplainPreview(concept);
      if (wantJson) {
        console.log(JSON.stringify(preview, null, 2));
        return;
      }
      console.log(formatExplainPreview(preview));
      // Operator used `dema explain dema` — counts as intentional engagement; suppress intro.
      if (concept === "dema") {
        const { join: pj } = await import("node:path");
        const { homedir: hd } = await import("node:os");
        const explainHome = process.env.DEMA_HOME || pj(hd(), ".dema");
        await recordIntroSeen({ home: explainHome, suppressedBy: "user-explain" });
      }
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

    case "status": {
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
      console.log([
        "Dema state",
        `  Node: ${statePreview.node} · Operator: ${statePreview.operator}`,
        `  Mission-centered: ${statePreview.mission_centered}`,
        `  Runtime autonomous daemon: ${statePreview.runtime.autonomous_daemon}`,
        `  Federation: ${statePreview.runtime.federation}`,
        `  Minting: ${statePreview.runtime.minting}`,
        `  Next safe action: ${statePreview.next_safe_action}`,
        humanHintLine("state")
      ].join("\n"));
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
        console.log([
          "Dema profiles (summary)",
          `  User: ${actors.user}`,
          `  PAT:  ${actors.pat}`,
          `  SAT:  ${actors.sat}`,
          `  Mission: ${actors.mission}`,
          `  Context capsule: ${profilePreview.context_capsule_schema}`,
          humanHintLine("profiles")
        ].join("\n"));
      } else {
        const p = profilePreview;
        console.log([
          "Dema profiles",
          `  User: ${p.user.schema} · operator: ${p.user.identity.name}`,
          `  PAT:  ${p.pat.schema} · owner: ${p.pat.owner}`,
          `  SAT:  ${p.sat.schema} · owner: ${p.sat.owner}`,
          `  Mission: ${p.mission.schema} · status: ${p.mission.status}`,
          `  Context capsule: ${p.context_capsule.schema}`,
          humanHintLine("profiles")
        ].join("\n"));
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
      console.log(JSON.stringify(buildEvidenceChainEventPreviewFromInputs(), null, 2));
      return;
    }

    case "node-registry": {
      const preview = buildNodeRegistryPreview();
      if (argv.includes("--pretty")) {
        console.log(formatNodeRegistryPreview(preview, resolveFormatterOptsFromEnv()));
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
        console.log(formatOnboardingLifecyclePreview(preview, resolveFormatterOptsFromEnv()));
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
        console.log(formatSkillGrowthGovernorPreview(preview, resolveFormatterOptsFromEnv()));
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
        console.log(formatProjectStatusPreview(preview, resolveFormatterOptsFromEnv()));
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

    case "llm-router": {
      console.log(JSON.stringify(buildLocalLLMRouterPreview(), null, 2));
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
        ollamaBaseUrl
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
      console.log([
        "Dema today",
        `  Continuity tick recorded — ${tick.date}`,
        `  NODE0_READY=${tick.node0Ready} · Activation gate: ${tick.activationGate}`,
        `  ${memory.count} memory entries summarized at ${result.path}`,
        `  Next artifact: ${tick.nextArtifact}`,
        humanHintLine("today")
      ].join("\n"));
      return;
    }

    case "doctor": {
      const status = await statusWithLocalIdentity();
      const predicates = evaluatePredicates(status);
      const anyFail = predicates.some((p) => p.status === "fail");

      if (wantsJson(argv)) {
        const verdict = anyFail ? "blocked" : "ready and consent-gated";
        console.log(JSON.stringify({ schema: "bizra.dema.doctor_dashboard.v0.1", verdict, predicates, status }, null, 2));
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

    case "ambient": {
      console.log(formatAmbientBoundary(buildAmbientBoundary()));
      return;
    }

    case "ambient:json": {
      console.log(JSON.stringify(buildAmbientBoundary(), null, 2));
      return;
    }

    case "diagnostics": {
      if (subcommand !== "plan") {
        throw new Error("Unknown diagnostics command. Use `dema diagnostics plan [--json]`.");
      }
      const plan = buildDiagnosticsMissionPlan();
      console.log(
        argv.includes("--json")
          ? JSON.stringify(plan, null, 2)
          : formatDiagnosticsMissionPlan(plan)
      );
      return;
    }

    case "consent": {
      if (subcommand !== "plan") {
        throw new Error("Unknown consent command. Use `dema consent plan \"<intent>\"`.");
      }
      const json = argv.includes("--json");
      const intent = argv.slice(2).filter((arg) => arg !== "--json").join(" ").trim();
      if (!intent) throw new Error("Usage: dema consent plan [--json] \"<intent>\"");
      const plan = buildConsentPlanPreview({ intent });
      console.log(json ? JSON.stringify(plan, null, 2) : formatConsentPlanPreview(plan));
      return;
    }

    case "mission": {
      if (subcommand === "draft") {
        const json = argv.includes("--json");
        const intent = argv.slice(2).filter((arg) => arg !== "--json").join(" ").trim();
        if (!intent) throw new Error("Usage: dema mission draft [--json] \"<intent>\"");
        const draft = buildMissionDraftPreview({ intent });
        console.log(json ? JSON.stringify(draft, null, 2) : formatMissionDraftPreview(draft));
        return;
      }
      if (subcommand !== "propose") {
        throw new Error("Unknown mission command. Use `dema mission draft \"<intent>\"` or `dema mission propose`.");
      }
      const status = await statusWithLocalIdentity();
      const consent = argValue(argv, "--consent") ?? "";
      const proposePreview = previewBoundedDiagnostic(status, consent);
      if (wantsJson(argv)) {
        console.log(JSON.stringify(proposePreview, null, 2));
        return;
      }
      console.log([
        "Dema mission propose",
        `  Action: ${proposePreview.action}`,
        `  Executes: ${proposePreview.executes}`,
        `  Proposal allowed: ${proposePreview.proposal.allowed}`,
        `  Consent accepted: ${proposePreview.consent.accepted}`,
        `  Next: ${proposePreview.next}`,
        humanHintLine("mission propose")
      ].join("\n"));
      return;
    }

    case "receipts": {
      const selector = argv[1];
      if (selector) {
        console.log(JSON.stringify(await readReceipt(selector), null, 2));
      } else {
        console.log(JSON.stringify(await listReceipts(), null, 2));
      }
      return;
    }

    case "memory": {
      const action = subcommand;
      if (!action || action === "list") {
        console.log(JSON.stringify(await summarizeMemory(), null, 2));
      } else if (action === "show") {
        const name = argv[2];
        if (!name) throw new Error("Usage: dema memory show <name>");
        console.log(JSON.stringify(await readMemoryEntry(name), null, 2));
      } else {
        throw new Error(
          "Unknown memory command. Use `dema memory [list]` or `dema memory show <name>`."
        );
      }
      return;
    }

    case "models": {
      // dema models scan [--json]      → C1.5 · schema-tagged local inventory scan
      // dema models                    → existing human-readable inventory
      if (subcommand === "scan") {
        const spinner = createSpinner({ stdout: process.stdout, label: "Scanning local model inventory…" });
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
        console.log([
          "Dema models scan",
          `  Total models found: ${scan.total_models ?? 0}`,
          `  Ollama: ${ollama.reachable ? "reachable" : "unreachable"} · ${ollama.model_count ?? 0} model(s)`,
          `  LM Studio: ${lms.reachable ? "reachable" : "unreachable"} · ${lms.model_count ?? 0} model(s)`,
          `  Downloads: ${dl.model_count ?? 0} GGUF file(s)`,
          `  Boundary: read-only; local probes only; no model invoked`,
          humanHintLine("models scan")
        ].join("\n"));
        return;
      }
      const inventory = await collectModelInventory();
      console.log(formatModelInventory(inventory));
      return;
    }

    case "report": {
      if (subcommand !== "safety") {
        throw new Error("Unknown report command. Use `dema report safety [--json]`.");
      }
      const report = buildSafetyReportPreview();
      console.log(
        argv.includes("--json")
          ? JSON.stringify(report, null, 2)
          : formatSafetyReportPreview(report)
      );
      return;
    }

    case "network": {
      if (subcommand === "blueprint") {
        const blueprint = buildNetworkBlueprint();
        console.log(
          argv.includes("--json")
            ? JSON.stringify(blueprint, null, 2)
            : formatNetworkBlueprint(blueprint)
        );
        return;
      }
      if (subcommand === "fixture" && argv[2] === "preview") {
        const preview = buildOfflineNetworkFixturePreview();
        console.log(
          argv.includes("--json")
            ? JSON.stringify(preview, null, 2)
            : formatOfflineNetworkFixturePreview(preview)
        );
        return;
      }
      if (subcommand === "refusal" && argv[2] === "preview") {
        const preview = buildNetworkRefusalMatrixPreview();
        console.log(
          argv.includes("--json")
            ? JSON.stringify(preview, null, 2)
            : formatNetworkRefusalMatrixPreview(preview)
        );
        return;
      }
      throw new Error(
        "Unknown network command. Use `dema network blueprint [--json]`, `dema network fixture preview [--json]`, or `dema network refusal preview [--json]`."
      );
    }

    case "amana": {
      const amanaCommand = argv[1];
      const amanaSubcommand = argv[2];
      if (amanaCommand !== "contracts" || amanaSubcommand !== "preview") {
        throw new Error("Unknown amana command. Use `dema amana contracts preview [--json]`.");
      }
      const preview = buildAmanaContractsPreview();
      console.log(
        argv.includes("--json")
          ? JSON.stringify(preview, null, 2)
          : formatAmanaContractsPreview(preview)
      );
      return;
    }

    case "mcp": {
      if (subcommand !== "blueprint") {
        throw new Error("Unknown mcp command. Use `dema mcp blueprint [--json]`.");
      }
      const blueprint = buildMcpIntegrationBlueprint();
      console.log(
        argv.includes("--json")
          ? JSON.stringify(blueprint, null, 2)
          : formatMcpIntegrationBlueprint(blueprint)
      );
      return;
    }

    case "roadmap": {
      if (subcommand !== "preview") {
        throw new Error("Unknown roadmap command. Use `dema roadmap preview [--json]`.");
      }
      const report = buildOptimizationRoadmapPreview();
      console.log(
        argv.includes("--json")
          ? JSON.stringify(report, null, 2)
          : formatOptimizationRoadmapPreview(report)
      );
      return;
    }

    case "evidence": {
      const receiptCommand = argv[1];
      const receiptSubcommand = argv[2];
      if (receiptCommand !== "receipt" || receiptSubcommand !== "preview") {
        throw new Error("Unknown evidence command. Use `dema evidence receipt preview [--json]`.");
      }
      const receipt = buildEvidenceReceiptPreview();
      console.log(
        argv.includes("--json")
          ? JSON.stringify(receipt, null, 2)
          : formatEvidenceReceiptPreview(receipt)
      );
      return;
    }

    case "ihsan": {
      const floorCommand = argv[1];
      const floorSubcommand = argv[2];
      if (floorCommand !== "floor" || floorSubcommand !== "preview") {
        throw new Error("Unknown ihsan command. Use `dema ihsan floor preview [--score N] [--json]`.");
      }
      const scoreArg = argValue(argv, "--score");
      const score = scoreArg === undefined ? DEFAULT_IHSAN_FLOOR : Number(scoreArg);
      const preview = evaluateIhsanFloorPreview({ score });
      console.log(
        argv.includes("--json")
          ? JSON.stringify(preview, null, 2)
          : formatIhsanFloorPreview(preview)
      );
      return;
    }

    case "behavior": {
      const behaviorCommand = argv[1];
      const behaviorSubcommand = argv[2];
      if (behaviorCommand !== "modulation" || behaviorSubcommand !== "preview") {
        throw new Error('Unknown behavior command. Use `dema behavior modulation preview [--consent TEXT] [--score N] [--json] "<intent>"`.');
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
        ihsanScore
      });
      console.log(
        argv.includes("--json")
          ? JSON.stringify(preview, null, 2)
          : formatBehavioralModulationPreview(preview)
      );
      return;
    }

    case "design": {
      if (subcommand !== "emulate-loop") {
        throw new Error("Unknown design command. Use `dema design emulate-loop [--json]`.");
      }
      const report = emulateLoopDesign();
      console.log(
        argv.includes("--json")
          ? JSON.stringify(report, null, 2)
          : formatLoopDesignEmulation(report)
      );
      return;
    }

    case "task": {
      if (!subcommand) {
        // List tasks.
        const list = Object.values(TASK_REGISTRY).map((t) => ({
          id: t.id,
          autonomy_level: t.autonomy_level,
          description: t.description
        }));
        console.log(JSON.stringify({ schema: "bizra.dema.task_list.v0.1", tasks: list }, null, 2));
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
            `(got: ${JSON.stringify(task.autonomy_level)}). Expected L0..L5.`
        );
        return { refused: true, reason: "malformed_autonomy_level" };
      }
      if (level >= 3) {
        const approval = await requestApproval({
          autonomyLevel: levelLabel(level),
          action: `task ${task.id}`,
          scope: task.scope ?? task.description ?? null,
          requireExactPhrase: task.requireExactPhrase
        });
        if (!approval.approved) {
          console.log(`Refused: ${approval.refused_reason}`);
          return { refused: true, reason: approval.refused_reason };
        }
      }

      const taskSpinner = createSpinner({ stdout: process.stdout, label: `Running ${task.id}…` });
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
      console.log([
        "Dema monetize: safe offer guardian.",
        "Allowed now: Sovereign Local AI Node Setup + Safety Audit.",
        "Blocked: token claims, passive income claims, AGI claims, public federation claims."
      ].join("\n"));
      return;

    case "sovereign": {
      // Sovereign Mission Interface — 7-panel cockpit renderer
      // Delegates to the Python scaffold at ~/.dema/kernel/sovereign_tui/sovereign.py
      // Schema: bizra.dema.sovereign_tui_render.v0.1
      const { existsSync } = await import("node:fs");
      const { join } = await import("node:path");
      const { spawnSync } = await import("node:child_process");
      const home = process.env.HOME || process.env.USERPROFILE;
      const demaHome = process.env.DEMA_HOME || (home ? join(home, ".dema") : null);
      if (!demaHome) {
        console.error("dema sovereign: unable to resolve DEMA_HOME (set DEMA_HOME or HOME).");
        process.exit(1);
      }
      const scaffold = join(demaHome, "kernel", "sovereign_tui", "sovereign.py");
      if (!existsSync(scaffold)) {
        console.error(`dema sovereign: scaffold not found: ${scaffold}`);
        process.exit(1);
      }
      const result = spawnSync("python3", [scaffold, ...argv.slice(1)], {
        stdio: "inherit"
      });
      if (result.error) {
        console.error(`dema sovereign: failed to spawn python3: ${result.error.message}`);
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
        console.log(renderHelpFlat(HELP));
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
      console.log(renderHelpFlat(HELP));
      return;

    default: {
      const result = suggestCommands(command, REGISTERED_COMMANDS_LIST);
      const lines = [`I don't have a \`${result.missingToken || command}\` command.`, ""];
      if (result.matched === "natural-language" || result.matched === "close") {
        lines.push("Did you mean:");
        for (const s of result.suggestions) {
          lines.push(`  - dema ${s.command.padEnd(32)} — ${s.description}`);
        }
      } else {
        lines.push("I couldn't find a close match. Type `dema help` for the full list.");
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
      dispatchCommand: dispatch
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
  process.argv[1] && (process.argv[1].endsWith("/index.js") || process.argv[1].endsWith("/dema"));

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
