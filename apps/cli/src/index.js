#!/usr/bin/env node
import { createNode0Adapter } from "../../../packages/node-adapter/src/node0-adapter.js";
import { formatStatus } from "../../../packages/core/src/status.js";
import { previewBoundedDiagnostic } from "../../../packages/core/src/mission.js";
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
import { runShell } from "../../../packages/core/src/shell.js";
import { TASK_REGISTRY } from "../../../packages/tasks/src/downloads-audit-preview.js";
import {
  formatVerdict,
  verifyReceipt
} from "../../../packages/verifier/src/sat-placeholder.js";
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
  dema welcome      Show the first-run orientation
  dema setup        Create local Dema folders/profile skeleton
  dema status       Show human-readable Node0 status
  dema status:json  Show machine-readable status
  dema today        Record a local continuity tick + memory summary
  dema doctor       Validate readiness and consent gate
  dema mission propose [--consent "GO: Node0 bounded diagnostic activation only"]
                    Preview ARTIFACT-011 readiness; does not execute runtime
  dema receipts     List local receipts
  dema receipts ID  Show one receipt by ID, artifact ID, or path suffix
  dema memory       List local memory entries (profile + ~/.dema/memory/*)
  dema memory show NAME
                    Show one memory entry by name (e.g. profile, bizra-context)
  dema task         List registered tasks
  dema task NAME    Run a registered task (read-only in v0.3.0)
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
      console.log(`Welcome to Dema.

Your node is local-first.
Your actions are consent-bound.
Your important steps can produce receipts.

Next:
1. Run setup
2. Check status
3. Preview first bounded diagnostic`);
      return;

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

    case "mission": {
      if (subcommand !== "propose") {
        throw new Error("Unknown mission command. Use `dema mission propose`.");
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
      const { spawnSync } = await import("node:child_process");
      const home = process.env.HOME || process.env.USERPROFILE;
      const scaffold = `${home}/.dema/kernel/sovereign_tui/sovereign.py`;
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
