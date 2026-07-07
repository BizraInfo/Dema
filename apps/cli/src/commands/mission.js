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

// NODE0-LOCAL-MISSION-HARNESS-PREVIEW-1A — `dema mission pulse <file>` effect layer.
import { mkdir, readFile as readFileFs, realpath, rename, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { createHash } from "node:crypto";
import { generateEd25519Keypair } from "../../../../packages/receipts/src/authorship-signature.js";
import { buildNode0ProofChainLinkPayload } from "../../../../packages/core/src/node0-proof-chain-link.js";
import { signChainHead, NODE0_SIGNED_CHAIN_HEAD_GO_PHRASE } from "../../../../packages/core/src/node0-signed-chain-head.js";
import {
  buildNode0UrpGenesisRootActivationPreviewPayload,
  exampleGenesisRootInput,
} from "../../../../packages/core/src/node0-urp-genesis-root-activation-preview.js";
import {
  buildNode0UrpGenesisRootCompositionGatePreviewPayload,
  exampleCompositionInput,
} from "../../../../packages/core/src/node0-urp-genesis-root-composition-gate-preview.js";
import {
  runNode0LocalMissionHarnessPreview,
  NODE0_LOCAL_MISSION_HARNESS_PREVIEW_GO_PHRASE,
} from "../../../../packages/core/src/node0-local-mission-harness-preview.js";

export const MISSION_EXCERPT_GO_PHRASE = "GO: include local excerpt in mission packet";
const EXCERPT_MAX_CHARS = 280;

const adapter = createNode0Adapter();

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

// Build an ephemeral composition reference (preview): a fresh signed genesis anchor composed with the
// example URP resource-family surfaces. Keys are ephemeral — no live Node0 identity is bound.
function buildEphemeralCompositionRef() {
  const keys = generateEd25519Keypair();
  const chain = buildNode0ProofChainLinkPayload([`sha256:${"1".repeat(64)}`, `sha256:${"2".repeat(64)}`]);
  const signedChainHead = signChainHead({
    chain,
    consent: NODE0_SIGNED_CHAIN_HEAD_GO_PHRASE,
    privateKeyPem: keys.private_key_pem,
    publicKeyPem: keys.public_key_pem,
    publicKeyFingerprint: keys.public_key_fingerprint,
  });
  const genesis = buildNode0UrpGenesisRootActivationPreviewPayload(exampleGenesisRootInput(signedChainHead));
  return buildNode0UrpGenesisRootCompositionGatePreviewPayload(exampleCompositionInput(genesis));
}

async function writeMissionReceipt(artifact, demaHome) {
  const home = demaHome || process.env.DEMA_HOME || join(homedir(), ".dema");
  const dir = join(home, "mission", "receipts");
  await mkdir(dir, { recursive: true });
  const realDir = await realpath(dir);
  const finalPath = join(realDir, `${artifact.mission_id}.json`);
  const tmpPath = `${finalPath}.tmp`;
  await writeFile(tmpPath, JSON.stringify(artifact, null, 2), { encoding: "utf8", mode: 0o600, flag: "w" });
  await rename(tmpPath, finalPath);
  return finalPath;
}

// Testable I/O core for `dema mission pulse`. Reads one file (read-only), runs the PURE harness kernel,
// optionally writes the receipt. Never touches process/console. demaHome + nowIso are injectable.
export async function runMissionPulseHarness({
  file,
  consent,
  wantReceipt = false,
  excerptConsent,
  claim,
  task,
  boundary,
  demaHome,
  nowIso,
}) {
  if (!file || typeof file !== "string" || file.startsWith("--")) {
    return { ok: false, error: "missing_file_argument" };
  }
  let st;
  try {
    st = await stat(file);
  } catch {
    return { ok: false, error: "file_not_found_or_unreadable" };
  }
  if (st.isDirectory()) return { ok: false, error: "path_is_directory" };

  const real = await realpath(file);
  const bytes = await readFileFs(real); // read-only, to compute the hash
  const content_hash = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  const contentReadPerformed = excerptConsent === MISSION_EXCERPT_GO_PHRASE;
  const excerpt = contentReadPerformed ? bytes.toString("utf8").slice(0, EXCERPT_MAX_CHARS) : undefined;

  const file_ref = {
    path: real,
    size_bytes: st.size,
    mtime_iso: st.mtime.toISOString(),
    content_hash,
    content_read_performed: contentReadPerformed,
    raw_content_leaves_node0: false,
    ...(excerpt !== undefined ? { excerpt } : {}),
  };

  const result = runNode0LocalMissionHarnessPreview({
    consent: consent ?? "",
    input: {
      file_ref,
      composition_ref: buildEphemeralCompositionRef(),
      candidate_extraction: { claim, task, boundary },
      now_iso: nowIso ?? null,
    },
  });

  let receiptPath = null;
  if (wantReceipt) {
    if (consent !== NODE0_LOCAL_MISSION_HARNESS_PREVIEW_GO_PHRASE) {
      return { ok: false, error: "receipt_requires_consent", result };
    }
    if (result.ok) receiptPath = await writeMissionReceipt(result.receipt_artifact_preview, demaHome);
  }

  return { ok: result.ok, result, receiptPath, source_basename: basename(real) };
}

export async function cmd_mission(ctx) {
  const { argv, subcommand } = ctx;
  if (subcommand === "pulse") {
    // NODE0-LOCAL-MISSION-HARNESS-PREVIEW-1A — read one named file, run the pure mission pulse,
    // shape a preview receipt. PREVIEW_ONLY. No daemon, no network, no model, no source mutation.
    const wantJsonMP = wantsJson(argv);
    const out = await runMissionPulseHarness({
      file: argv[2],
      consent: argValue(argv, "--consent"),
      wantReceipt: argv.includes("--receipt"),
      excerptConsent: argValue(argv, "--excerpt-consent"),
      claim: argValue(argv, "--claim"),
      task: argValue(argv, "--task"),
      boundary: argValue(argv, "--boundary"),
      nowIso: new Date().toISOString(),
    });
    if (out.error && !out.result) {
      const usage = `dema mission pulse <file> --consent "${NODE0_LOCAL_MISSION_HARNESS_PREVIEW_GO_PHRASE}" --claim "…" --task "…" --boundary "…" [--receipt] [--excerpt-consent "${MISSION_EXCERPT_GO_PHRASE}"]`;
      if (wantJsonMP) {
        console.log(JSON.stringify({ preview_only: true, ok: false, error: out.error, usage }, null, 2));
      } else {
        console.error(`Dema error: ${out.error}. Usage: ${usage}`);
      }
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    const r = out.result;
    if (wantJsonMP) {
      console.log(
        JSON.stringify(
          {
            preview_only: true,
            schema: r.schema,
            status: r.status,
            ok: out.ok,
            harness_ready: r.harness_ready,
            content_hash: r.content_hash,
            receipt_target_relpath: r.receipt_target_relpath,
            receipt_written: out.receiptPath,
            receipt_committed_live: r.receipt_artifact_preview?.committed_live,
            boundary: r.boundary,
            mint_allowed: r.mint_allowed,
            authority_delta: r.authority_delta,
            dema_report: r.dema_report,
            blocked_by: r.blocked_by,
            error: out.error ?? null,
          },
          null,
          2,
        ),
      );
    } else {
      const lines = [
        "DEMA · LOCAL MISSION PULSE — PREVIEW_ONLY (no model · no daemon · read-only source)",
        `  status: ${r.status}`,
        `  content_hash: ${r.content_hash}`,
        `  receipt: ${out.receiptPath ?? `not written (add --receipt --consent "${NODE0_LOCAL_MISSION_HARNESS_PREVIEW_GO_PHRASE}")`}`,
        `  boundary: all-false · mint_allowed:${r.mint_allowed} · authority_delta:${r.authority_delta}`,
      ];
      if (r.dema_report) lines.push(`  dema: ${r.dema_report.status} — ${r.dema_report.next_safe_action}`);
      if (out.error) lines.push(`  ${out.error}`);
      if (!out.ok) for (const c of r.blocked_by || []) lines.push(`    ${c}`);
      lines.push(humanHintLine("mission pulse"));
      console.log(lines.join("\n"));
    }
    if (!out.ok) process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }
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
    // Optional --baseline attaches a measured eval-route preview (talk_env_hint)
    // for operator reference — PREVIEW only, no talk invocation.
    let routing_preview = null;
    const baselinePath = argValue(argv, "--baseline");
    if (baselinePath) {
      const { isAbsolute, resolve } = await import("node:path");
      const { readFile } = await import("node:fs/promises");
      if (!isAbsolute(baselinePath)) {
        throw new Error("`dema mission plan --baseline` requires an absolute path to the baseline JSON file.");
      }
      const { buildModelRoutingPreview } = await import(
        "../../../../packages/core/src/model-routing-preview.js"
      );
      let baseline;
      try {
        baseline = JSON.parse(await readFile(resolve(baselinePath), "utf8"));
      } catch (readErr) {
        throw new Error(
          `Failed to read or parse baseline file: ${readErr && readErr.message ? readErr.message : readErr}`,
        );
      }
      routing_preview = buildModelRoutingPreview({
        baseline,
        generated_at_iso: new Date().toISOString(),
      });
    }
    const dryRun = buildClosedDualLoopDryRun({
      pain: argValue(argv, "--pain"),
      goal: argValue(argv, "--goal"),
      urgency: argValue(argv, "--urgency"),
      help_style: argValue(argv, "--style"),
      routing_preview,
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
      const ctx = dryRun.measured_routing_context;
      if (ctx?.talk_env_hint?.env) {
        lines.push("");
        lines.push("  Measured routing context (PREVIEW — does not invoke talk):");
        lines.push(`    export DEMA_TALK_PROVIDER=${ctx.talk_env_hint.env.DEMA_TALK_PROVIDER}`);
        lines.push(`    export DEMA_TALK_MODEL=${ctx.talk_env_hint.env.DEMA_TALK_MODEL}`);
        lines.push(`    dema talk … --consent "${ctx.talk_env_hint.consent_phrase}"`);
      }
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
