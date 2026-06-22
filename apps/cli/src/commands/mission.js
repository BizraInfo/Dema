import { createNode0Adapter } from "../../../../packages/node-adapter/src/node0-adapter.js";
import {
  buildHealthSnapshot,
  saveHealthSnapshotReceipt,
  verifyHealthSnapshotReceipt,
  formatHealthSnapshotReceipt,
} from "../../../../packages/mission/src/health-snapshot.js";
import {
  buildMissionDraftPreview,
  formatMissionDraftPreview,
} from "../../../../packages/mission/src/mission-draft.js";
import {
  buildMissionManifest,
  formatMissionManifest,
} from "../../../../packages/mission/src/mission-manifest.js";
import {
  runMissionProbe,
  renderProbeText,
} from "../../../../packages/mission/src/mission-probe.js";
import {
  resolveMissionReceipt,
  buildCloseoutReport,
  renderCloseoutText,
} from "../../../../packages/mission/src/mission-closeout.js";
import { previewBoundedDiagnostic } from "../../../../packages/core/src/mission.js";
import { buildPainGoalInterview } from "../../../../packages/core/src/pain-goal-interview.js";
import { buildClosedDualLoopDryRun } from "../../../../packages/core/src/closed-dual-loop-dry-run.js";
import {
  wantsJson,
  humanHintLine,
} from "../../../../packages/core/src/output-mode.js";
import { statusWithLocalIdentity } from "../lib/status-identity.js";

const adapter = createNode0Adapter();

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export async function cmd_mission(ctx) {
  const { argv, subcommand } = ctx;
  if (subcommand === "interview") {
    // PAIN-GOAL-INTERVIEW-1A — local only, no model. Capture stated pain/goal,
    // propose (only propose) a first mission. Writes nothing.
    const interview = buildPainGoalInterview({
      pain: argValue(argv, "--pain"),
      goal: argValue(argv, "--goal"),
      urgency: argValue(argv, "--urgency"),
      help_style: argValue(argv, "--style"),
    });
    if (wantsJson(argv)) {
      console.log(JSON.stringify(interview, null, 2));
      process.exit(process.exitCode ?? 0);
    }
    const lines = ["DEMA · PAIN / GOAL INTERVIEW (local only · no model called)"];
    if (interview.interview_status !== "ready_for_first_mission_preview") {
      if (interview.interview_status === "partial") {
        lines.push(
          `  So far — pain: ${interview.pain_point ?? "(none)"} · goal: ${interview.desired_goal ?? "(none)"}`,
        );
        lines.push(`  Still needed: ${interview.missing_fields.join(", ")}`);
        lines.push("");
      }
      lines.push("  Tell me (use --pain, --goal, --urgency, --style):");
      for (const q of interview.interview_questions) lines.push(`    • ${q}`);
    } else {
      lines.push(`  Pain: ${interview.pain_point}`);
      lines.push(`  Goal: ${interview.desired_goal}`);
      lines.push(
        `  Urgency: ${interview.urgency_level} · help style: ${interview.preferred_help_style ?? "(unspecified)"}`,
      );
      lines.push("");
      lines.push("  First mission — PROPOSAL ONLY (not started):");
      lines.push(`    ${interview.first_mission_candidate.statement}`);
    }
    // Honesty guard — the captured-not-understood disclaimer fires whenever
    // anything was STATED (partial OR ready), not only when a mission is
    // proposed. The partial branch echoes the user's pain back, so it is the
    // surface most exposed to reading capture as comprehension.
    if (interview.pain_point || interview.desired_goal) {
      lines.push("");
      lines.push(
        "  I captured what you STATED — I have not understood you fully, run any model, or saved anything.",
      );
    }
    lines.push(humanHintLine("mission interview"));
    console.log(lines.join("\n"));
    process.exit(process.exitCode ?? 0);
  }
  if (subcommand === "plan") {
    // CLOSED-DUAL-LOOP-DRY-RUN-1A — local only, no model, no execution. Takes
    // the captured pain/goal, runs a DRY-RUN PAT-propose -> SAT-verify loop, and
    // presents a consent-ready plan. The loops are DESIGNED_NOT_LIVE scaffolds.
    const dryRun = buildClosedDualLoopDryRun({
      pain: argValue(argv, "--pain"),
      goal: argValue(argv, "--goal"),
      urgency: argValue(argv, "--urgency"),
      help_style: argValue(argv, "--style"),
    });
    if (wantsJson(argv)) {
      console.log(JSON.stringify(dryRun, null, 2));
      process.exit(process.exitCode ?? 0);
    }
    const lines = [
      "DEMA · CLOSED DUAL-LOOP DRY-RUN (local only · no model · nothing runs)",
    ];
    if (dryRun.dry_run_status !== "consent_ready") {
      lines.push(`  Not ready — still needed: ${dryRun.missing_fields.join(", ")}`);
      lines.push('  Run `dema mission interview` first to capture your pain + goal.');
    } else {
      const plan = dryRun.consent_ready_plan;
      lines.push(`  Mission: ${plan.mission}`);
      lines.push("");
      lines.push("  PAT proposed (a deterministic scaffold — NOT model reasoning):");
      for (const step of dryRun.pat_proposal.proposed_steps) lines.push(`    • ${step}`);
      lines.push("");
      lines.push(`  SAT verdict: ${dryRun.sat_verdict.gate_verdict}`);
      for (const c of dryRun.sat_verdict.checks) {
        lines.push(`    ${c.passed ? "✓" : "✗"} ${c.check}`);
      }
      lines.push("");
      lines.push("  Consent-ready plan — NOTHING has run.");
      lines.push(
        `  To ever execute it you would type the exact phrase: "${plan.execution_consent_required}"`,
      );
      lines.push("  (Execution is a separate, later, consented step — not built yet.)");
    }
    lines.push("");
    lines.push(
      "  Both loops are DESIGNED_NOT_LIVE — no model reasoned, no agent ran, nothing executed.",
    );
    lines.push(humanHintLine("mission plan"));
    console.log(lines.join("\n"));
    process.exit(process.exitCode ?? 0);
  }
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
      process.exit(process.exitCode ?? 0);
    }
    const result = await saveHealthSnapshotReceipt({ consent, dryRun });
    if (wantJsonM) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatHealthSnapshotReceipt(result));
    }
    if (!result.saved && result.reason !== "dry_run") process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }
  if (subcommand === "verify" && argv[2]) {
    const mPath = argv[2];
    const wantJsonMV = argv.includes("--json") || !process.stdout.isTTY;
    const mv = await verifyHealthSnapshotReceipt(mPath);
    console.log(
      wantJsonMV ? JSON.stringify(mv, null, 2) : JSON.stringify(mv, null, 2),
    );
    if (mv.verdict !== "VERIFIED") process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
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
      json ? JSON.stringify(draft, null, 2) : formatMissionDraftPreview(draft),
    );
    process.exit(process.exitCode ?? 0);
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
      process.exit(process.exitCode ?? 0);
    }
    if (wantJsonMF) {
      console.log(JSON.stringify(manifest, null, 2));
    } else {
      console.log(formatMissionManifest(manifest));
    }
    process.exit(process.exitCode ?? 0);
  }
  if (subcommand === "probe") {
    const wantJsonPR = wantsJson(argv);
    try {
      const { fileURLToPath: probeURL } = await import("node:url");
      const { dirname: probeDirname, join: probeJoin } =
        await import("node:path");
      // commands/ is one level deeper — need 4 levels to reach repo root
      const repoRoot = probeJoin(
        probeDirname(probeURL(import.meta.url)),
        "..",
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
    process.exit(process.exitCode ?? 0);
  }
  if (subcommand === "closeout") {
    const missionId = argv[2] && !argv[2].startsWith("-") ? argv[2] : undefined;
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
      process.exit(process.exitCode ?? 0);
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
      process.exit(process.exitCode ?? 0);
    }
    if (wantJsonCO) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(renderCloseoutText(report));
    }
    process.exit(process.exitCode ?? 0);
  }
  if (subcommand !== "propose") {
    throw new Error(
      'Unknown mission command. Use `dema mission draft "<intent>"` or `dema mission propose`.',
    );
  }
  const status = await statusWithLocalIdentity(adapter);
  const consent = argValue(argv, "--consent") ?? "";
  const proposePreview = previewBoundedDiagnostic(status, consent);
  if (wantsJson(argv)) {
    console.log(JSON.stringify(proposePreview, null, 2));
    process.exit(process.exitCode ?? 0);
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
  process.exit(process.exitCode ?? 0);
}
