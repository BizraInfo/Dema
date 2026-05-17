#!/usr/bin/env node
import { createNode0Adapter } from "../../../packages/node-adapter/src/node0-adapter.js";
import { formatStatus } from "../../../packages/core/src/status.js";
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
import { buildLocalLLMRouterPreview } from "../../../packages/core/src/local-llm-router-preview.js";
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

const adapter = createNode0Adapter();

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

Tasks and views:
  dema task         List registered tasks
  dema task NAME    Run a registered task (read-only in v0.3.0)
  dema sovereign    Render local Sovereign Mission Interface (view-only)
  dema monetize     Show proof-safe first offer boundary
  dema help         Show this list

Dema v0.3.0 — Active Command Kernel. Local-first. Consent-bound. Receipt-aware.`;

async function dispatch(argv) {
  const command = argv[0] ?? "active";
  const subcommand = argv[1];

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

    case "setup":
      console.log(JSON.stringify(await runSetup(), null, 2));
      return;

    case "status": {
      const status = await adapter.status();
      console.log(formatStatus(status));
      return;
    }

    case "status:json": {
      const status = await adapter.status();
      console.log(JSON.stringify(status, null, 2));
      return;
    }

    case "state": {
      console.log(JSON.stringify(buildNode0StatePreview(), null, 2));
      return;
    }

    case "profiles": {
      const preview = argv.includes("--summary")
        ? buildProfileFoundationSummary()
        : buildProfileFoundationPreview();
      console.log(JSON.stringify(preview, null, 2));
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

    case "llm-router": {
      console.log(JSON.stringify(buildLocalLLMRouterPreview(), null, 2));
      return;
    }

    case "today": {
      const status = await adapter.status();
      const result = await recordTodayTick({ status });
      const memory = await summarizeMemory();
      console.log(JSON.stringify({ ...result, memory }, null, 2));
      return;
    }

    case "doctor": {
      const status = await adapter.status();
      const blockReasons = [];
      if (!status.ready) blockReasons.push("not ready");
      if (!status.consoleReady) blockReasons.push("console not ready");
      if (status.activationGate !== "EXPLICIT_GO_REQUIRED") {
        blockReasons.push(
          `activation gate is ${status.activationGate ?? "unknown"} (expected EXPLICIT_GO_REQUIRED)`
        );
      }
      if (status.daemonStatus === "running") blockReasons.push("daemon is running");

      const ready = blockReasons.length === 0;
      console.log(
        ready
          ? "Dema doctor: ready and consent-gated."
          : `Dema doctor: blocked — ${blockReasons.join("; ")}.`
      );
      console.log(formatStatus(status));
      process.exitCode = ready ? 0 : 1;
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
      const status = await adapter.status();
      const consent = argValue(argv, "--consent") ?? "";
      console.log(JSON.stringify(previewBoundedDiagnostic(status, consent), null, 2));
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

      const receipt = await task.run();
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

    case "help":
    case "-h":
    case "--help":
    default:
      console.log(HELP);
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
