import {
  buildAgentDualLoopPreview,
  formatAgentDualLoopPreview,
} from "../../../../packages/core/src/agent-dual-loop-preview.js";
import { buildPatSatBlackboardDryRun } from "../../../../packages/core/src/pat-sat-blackboard-dry-run.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function formatBlackboard(report) {
  const lines = [
    "Dema · PAT/SAT blackboard dry-run (PREVIEW_ONLY)",
    "",
    `  seed.pain: ${report.seed.pain ?? "(missing)"}`,
    `  seed.goal: ${report.seed.goal ?? "(missing)"}`,
    "",
    "  board:",
  ];
  for (const entry of report.board) {
    lines.push(
      `    ${entry.step}. [${entry.loop}] ${entry.source_id} -> ${entry.entry_type}: ${entry.summary}`,
    );
  }
  if (report.board.length === 0) {
    lines.push("    (empty)");
  }
  lines.push("");
  lines.push(`  final_state: ${report.final_state}`);
  lines.push("  boundary: all-false; no model, no runtime, no reward");
  return lines.join("\n");
}

function formatLiveBlackboard(env) {
  const lp = env.live_propose;
  const lines = [
    `Dema · PAT/SAT blackboard LIVE (suggestion-only) — ${env.truth_label}`,
    "",
    `  seed.pain: ${env.seed.pain ?? "(missing)"}`,
    `  seed.goal: ${env.seed.goal ?? "(missing)"}`,
    "",
    `  live propose: status=${lp.invocation_status} · ${lp.provider ?? "—"}/${lp.model ?? "—"} · role=${lp.verdict_role}`,
  ];
  if (lp.invocation_status === "completed") {
    lines.push(`    suggestion: ${lp.suggestion_preview ?? "(none)"}`);
  } else {
    lines.push(`    ${lp.error_reason ?? "no call made"}`);
    if (lp.required_consent) {
      lines.push(`    exact consent required: "${lp.required_consent}"`);
    }
  }
  lines.push("");
  lines.push(
    `  boundary: model_invocation=${env.boundary.model_invocation_performed === true} · the 10 forbidden keys all false`,
  );
  lines.push(
    "  autonomy: NONE — one suggestion, no self-driving loop, no identity, no mint, no daemon",
  );
  lines.push(`  live_hash: ${env.live_hash.slice(0, 16)}…`);
  return lines.join("\n");
}

export async function cmd_agent_loop(ctx) {
  const { argv, subcommand } = ctx;

  if (subcommand === "dual-preview") {
    const preview = buildAgentDualLoopPreview();
    if (wantsJson(argv)) {
      console.log(JSON.stringify(preview, null, 2));
    } else {
      console.log(formatAgentDualLoopPreview(preview));
    }
    process.exit(process.exitCode ?? 0);
  }

  if (subcommand === "blackboard") {
    const pain = argValue(argv, "--pain") ?? null;
    const goal = argValue(argv, "--goal") ?? null;
    const dryRun = buildPatSatBlackboardDryRun({ pain, goal });

    // LIVE PATH — one consent-gated, suggestion-only local-model call for the PAT
    // `propose` seat (reuses the sanctioned invokeDemaTalkLive gate). Without
    // --consent the gate refuses before any call. NOT autonomous coordination.
    if (argv.includes("--live")) {
      const { invokeDemaTalkLive } = await import(
        "../../../../packages/core/src/dema-talk-loop-live.js"
      );
      const { buildLiveBlackboardProposePrompt, composeLiveBlackboard } =
        await import("../../../../packages/core/src/pat-sat-blackboard-live.js");
      const provider = argValue(argv, "--provider") ?? "ollama";
      const model = argValue(argv, "--model") ?? "whiterabbitneo-v3:7b-q4_K_M";
      const consent = argValue(argv, "--consent") ?? "";
      const prompt = buildLiveBlackboardProposePrompt({ pain, goal });
      const liveResult = await invokeDemaTalkLive({
        provider,
        model,
        prompt,
        consentPhrase: consent,
        fetchImpl: ctx.fetchImpl,
      });
      const envelope = composeLiveBlackboard({ dryRun, liveResult });
      if (wantsJson(argv)) {
        console.log(JSON.stringify(envelope, null, 2));
      } else {
        console.log(formatLiveBlackboard(envelope));
      }
      process.exit(process.exitCode ?? 0);
    }

    if (wantsJson(argv)) {
      console.log(JSON.stringify(dryRun, null, 2));
    } else {
      console.log(formatBlackboard(dryRun));
    }
    process.exit(process.exitCode ?? 0);
  }

  throw new Error(
    "Unknown agent-loop command. Use `dema agent-loop dual-preview [--json]` or `dema agent-loop blackboard [--pain ...] [--goal ...] [--json]`.",
  );
}
