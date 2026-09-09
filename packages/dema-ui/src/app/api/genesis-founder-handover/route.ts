import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FOUNDER_DEMA_HOME = path.resolve(
  process.env.BIZRA_FOUNDER_DEMA_HOME ??
    process.env.DEMA_HOME ??
    "/home/bizra-operating-system/.dema",
);
const CAMPAIGN_ROOT = path.resolve(
  process.env.BIZRA_GENESIS_CAMPAIGN_ROOT ??
    "/home/bizra-operating-system/bizra-home/.campaigns/genesis-world-cell-commissioning-1a",
);
const MISSION_ID = "b3203ad6-f23b-42f8-9a45-7954c4a2107b";
const ARTIFACT_RELATIVE_PATH = "outputs/founder-brief.md";
const FINAL_EVIDENCE_PATH = path.join(CAMPAIGN_ROOT, "evidence/g6-founder-effect-final-1a.json");

type BoundFile = {
  bytes: Buffer;
  sha256: string;
  size: number;
  mode: string;
  device: number;
  inode: number;
};

function typedSha256(bytes: Buffer): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function isContained(filePath: string, rootPath: string): boolean {
  const file = path.resolve(filePath);
  const root = path.resolve(rootPath);
  return file === root || file.startsWith(`${root}${path.sep}`);
}

async function readBoundFile(filePath: string, rootPath: string): Promise<BoundFile> {
  if (!isContained(filePath, rootPath)) throw new Error("path_outside_bound_root");

  const flags = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0);
  const handle = await open(filePath, flags);
  try {
    const before = await handle.stat();
    if (!before.isFile()) throw new Error("not_regular_file");
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      bytes.length !== after.size
    ) {
      throw new Error("file_changed_during_read");
    }
    return {
      bytes,
      sha256: typedSha256(bytes),
      size: after.size,
      mode: (after.mode & 0o777).toString(8).padStart(3, "0"),
      device: Number(after.dev),
      inode: Number(after.ino),
    };
  } finally {
    await handle.close();
  }
}

function json(bytes: Buffer): Record<string, any> {
  const value = JSON.parse(bytes.toString("utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("json_object_required");
  }
  return value;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function blocked(reason: string) {
  return NextResponse.json(
    {
      schema: "bizra.dema.genesis_founder_handover.v0.1",
      truth_label: "GENESIS_FOUNDER_HANDOVER_UNAVAILABLE",
      blocked_by: [reason],
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET() {
  try {
    const finalEvidence = await readBoundFile(FINAL_EVIDENCE_PATH, CAMPAIGN_ROOT);
    const final = json(finalEvidence.bytes);
    if (final.schema !== "bizra.genesis.g6_founder_effect_final.v1") throw new Error("final_evidence_schema");
    if (final.mission_id !== MISSION_ID) throw new Error("mission_binding");

    const missionRoot = path.join(FOUNDER_DEMA_HOME, "kernel/mission_lifecycle/missions", MISSION_ID);
    const artifactPath = path.join(missionRoot, ARTIFACT_RELATIVE_PATH);
    const capsulePath = path.join(missionRoot, "capsule.yaml");
    if (path.resolve(final.saved_artifact?.path) !== artifactPath) throw new Error("artifact_binding");
    if (path.resolve(final.durable_mission?.capsule_path) !== capsulePath) throw new Error("capsule_binding");

    const artifact = await readBoundFile(artifactPath, missionRoot);
    const capsule = await readBoundFile(capsulePath, missionRoot);
    const ledgerPath = path.join(FOUNDER_DEMA_HOME, "receipts/canonical-ledger.ndjson");
    if (path.resolve(final.canonical_receipt?.ledger_path) !== ledgerPath) throw new Error("ledger_binding");
    const ledger = await readBoundFile(ledgerPath, FOUNDER_DEMA_HOME);

    if (artifact.sha256 !== final.saved_artifact.sha256 || artifact.size !== final.saved_artifact.bytes) {
      throw new Error("artifact_hash_mismatch");
    }
    if (artifact.mode !== "600") throw new Error("artifact_permissions");
    if (capsule.sha256 !== final.durable_mission.capsule_sha256) throw new Error("capsule_hash_mismatch");
    if (ledger.sha256 !== final.canonical_receipt.ledger_sha256_after) throw new Error("ledger_hash_mismatch");

    const ledgerLines = ledger.bytes.toString("utf8").trimEnd().split("\n").filter(Boolean);
    if (ledgerLines.length !== final.canonical_receipt.ledger_lines_after) throw new Error("ledger_count_mismatch");
    const receipt = ledgerLines.map((line) => JSON.parse(line)).find(
      (entry) => entry?.receipt_id === final.canonical_receipt.receipt_id,
    );
    if (!receipt || receipt.canonical_body?.saved_artifact?.sha256 !== artifact.sha256) {
      throw new Error("receipt_artifact_binding");
    }
    if (final.durable_mission.state !== "archived" || final.durable_mission.effect_records !== 1) {
      throw new Error("durable_mission_not_archived");
    }
    if (final.durable_mission.duplicate_effects !== 0 || final.operations?.duplicate_effects !== 0) {
      throw new Error("duplicate_effect_detected");
    }
    if (final.authority?.authority_delta !== 0 || final.operations?.authority_delta !== 0) {
      throw new Error("authority_delta_nonzero");
    }

    const statusCommand = [
      `DEMA_HOME=${shellQuote(FOUNDER_DEMA_HOME)}`,
      "python3",
      shellQuote(path.join(FOUNDER_DEMA_HOME, "kernel/mission_lifecycle/kernel.py")),
      "status",
      shellQuote(MISSION_ID),
    ].join(" ");

    return NextResponse.json(
      {
        schema: "bizra.dema.genesis_founder_handover.v0.1",
        truth_label: "MEASURED_LOCAL",
        observed_at_iso: new Date().toISOString(),
        display: {
          title: "Node0 Founder Brief",
          mission_text: "Prepare my current Node0 Founder Brief.",
          snapshot_scope: "saved time-scoped result; not current closure truth",
          human_usefulness_review: "NOT_OBSERVED",
        },
        mission: {
          mission_id: MISSION_ID,
          attempt_id: final.attempt_id,
          state: final.durable_mission.state,
          effect_records: final.durable_mission.effect_records,
          duplicate_effects: final.durable_mission.duplicate_effects,
        },
        artifact: {
          relative_path: ARTIFACT_RELATIVE_PATH,
          bytes: artifact.size,
          mode: artifact.mode,
          sha256: artifact.sha256,
          device: artifact.device,
          inode: artifact.inode,
          content: artifact.bytes.toString("utf8"),
        },
        evidence: {
          final_evidence_path: FINAL_EVIDENCE_PATH,
          final_evidence_sha256: finalEvidence.sha256,
          final_evidence_schema: final.schema,
          capsule_sha256: capsule.sha256,
          receipt_id: final.canonical_receipt.receipt_id,
          ledger_sha256: ledger.sha256,
          ledger_lines: ledgerLines.length,
          source_commit: final.source?.commit,
          source_tree: final.source?.tree,
          observer: final.quality_and_independence?.observer,
          observer_limits: final.quality_and_independence?.shared_dependencies,
        },
        authority: {
          root_mode: final.authority?.root_mode,
          authority_delta: final.authority?.authority_delta,
          historical_a005_incident: final.authority?.historical_a005_incident,
        },
        recovery: {
          status_command: statusCommand,
          policy: "read the archived capsule and exact target; never rerun the writer",
          result: final.recovery?.recovery_command_result,
          observer_result: final.recovery?.fresh_observer_result,
          reopened_without_reexecution: final.recovery?.reopened_result_without_writer,
          archived_replay_attempt: final.recovery?.archived_replay_attempt,
        },
        sat: {
          status: final.sat?.status,
          verdicts: final.sat?.five_verdicts,
          owner: final.sat?.owner,
          principal: final.sat?.principal,
          logical_home: final.sat?.logical_home,
          serves_node0: final.sat?.serves_node0,
          judges_node0: final.sat?.judges_node0,
        },
        boundary: {
          local_only: final.operations?.public_gateway === false,
          public_gateway: final.operations?.public_gateway,
          federation: final.operations?.federation,
          node1: final.operations?.node1,
          economy: final.operations?.economy,
          model_calls: final.operations?.model_calls,
          consequential_effects: final.operations?.consequential_effects,
        },
        proof_ceiling: "G6_FOUNDER_EFFECT_CANONICAL_RECEIPT_AND_RECOVERY_LOCAL",
        node0_closed: false,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "handover_read_failed";
    return blocked(reason.replace(/[^a-z0-9_]+/gi, "_").toLowerCase());
  }
}
