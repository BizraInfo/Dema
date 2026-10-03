import { mkdir, readFile, readdir, writeFile, link, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { NextRequest, NextResponse } from "next/server";

import {
  BIZRA_ESTATE_CAPABILITY_ID,
  buildEstateCapability,
  buildEstateFounderReport,
  buildEstateObservation,
  capabilityIsEquivalent,
} from "@core/founder-estate-workflow.js";
import { sha256CanonicalJsonV1 } from "../../../../../../canon/src/sha256-canonical-json-v1.js";
import { BIZRA_PROMPT_MISSION_BRIDGE_TRUTH_LABEL } from "@core/bizra-prompt-mission-bridge.js";
import {
  proposalBinding,
  verifySubmittedProposal,
} from "../node0-runtime";
import { requireLocalSession } from "@/lib/auth/session-boundary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RECEIPT_SCHEMA = "bizra.dema.founder_estate_mission_receipt.v0.1";
const MISSION_ID_RE = /^MISSION-[0-9a-f]{16}$/;

function receiptRoot() {
  const root = process.env.BIZRA_FOUNDER_DEMA_HOME || process.env.DEMA_HOME;
  if (!root || !root.startsWith("/") || resolve(root) === "/") return null;
  return resolve(root);
}

function receiptDirectory() {
  const root = receiptRoot();
  return root ? join(root, "receipts", "founder-estate") : null;
}

function receiptPath(missionId: string) {
  if (!MISSION_ID_RE.test(missionId)) return null;
  const directory = receiptDirectory();
  return directory ? join(directory, `${missionId}.json`) : null;
}

function verifyReceipt(receipt: any) {
  if (!receipt || receipt.schema !== RECEIPT_SCHEMA || typeof receipt.receipt_hash !== "string") return false;
  const { receipt_hash: ignored, ...body } = receipt;
  return sha256CanonicalJsonV1(body) === receipt.receipt_hash;
}

async function readReceipt(missionId: string) {
  const target = receiptPath(missionId);
  if (!target) return null;
  try {
    const receipt = JSON.parse(await readFile(target, "utf8"));
    return verifyReceipt(receipt) ? { receipt, target } : null;
  } catch {
    return null;
  }
}

async function persistReceipt({ proposal, report, observation, target }: any) {
  const existing = await readReceipt(proposal.mission_id);
  if (existing) return { ok: true, receipt: existing.receipt, reused: true, target: existing.target };
  const directory = receiptDirectory();
  if (!directory || !target) return { ok: false, blocked_by: ["founder_estate_receipt_root_unbound"] };
  const body = {
    schema: RECEIPT_SCHEMA,
    mission_id: proposal.mission_id,
    source_text: proposal.source_text,
    source_intent_hash: proposal.source_intent_hash,
    proposal_binding: proposalBinding(proposal),
    capability_id: BIZRA_ESTATE_CAPABILITY_ID,
    capability: proposal.capability,
    report,
    observation,
    created_at_iso: observation.observed_at_iso,
    boundary: {
      read_only: true,
      network_used: false,
      model_invoked: false,
      destructive_effect: false,
      authority_delta: 0,
    },
  };
  const receipt = { ...body, receipt_hash: sha256CanonicalJsonV1(body) };
  try {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const temp = join(directory, `.${proposal.mission_id}.${process.pid}.${Date.now()}.tmp`);
    await writeFile(temp, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
    try {
      await link(temp, target);
      await unlink(temp);
    } catch (error) {
      try { await unlink(temp); } catch { /* best effort */ }
      const raced = await readReceipt(proposal.mission_id);
      if (raced) return { ok: true, receipt: raced.receipt, reused: true, target: raced.target };
      return { ok: false, blocked_by: [`founder_estate_receipt_persist_failed:${String((error as Error)?.message ?? error)}`] };
    }
    return { ok: true, receipt, reused: false, target };
  } catch (error) {
    return { ok: false, blocked_by: [`founder_estate_receipt_persist_failed:${String((error as Error)?.message ?? error)}`] };
  }
}

function reportSummary(receipt: any) {
  return {
    mission_id: receipt.mission_id,
    source_text: receipt.source_text,
    observed_at_iso: receipt.created_at_iso,
    result_hash: receipt.report?.proof?.observation_hash ?? null,
    totals: receipt.report?.what_i_found?.totals ?? null,
    truncated: receipt.report?.what_i_could_not_see?.truncated === true,
  };
}

export async function GET(request: NextRequest) {
  const denied = await requireLocalSession(request);
  if (denied) return denied;
  const missionId = request.nextUrl.searchParams.get("mission_id");
  if (missionId) {
    const found = await readReceipt(missionId);
    if (!found) return NextResponse.json({ ok: false, blocked_by: ["estate_mission_not_found_or_invalid"] }, { status: 404 });
    return NextResponse.json({ ok: true, mission_id: missionId, report: found.receipt.report, receipt_hash: found.receipt.receipt_hash });
  }
  const directory = receiptDirectory();
  if (!directory) return NextResponse.json({ ok: true, missions: [] });
  try {
    const names = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort().reverse().slice(0, 10);
    const missions: any[] = [];
    for (const name of names) {
      try {
        const receipt = JSON.parse(await readFile(join(directory, name), "utf8"));
        if (verifyReceipt(receipt)) missions.push(reportSummary(receipt));
      } catch { /* malformed evidence is not surfaced as a mission */ }
    }
    return NextResponse.json({ ok: true, missions });
  } catch (error: any) {
    if (error?.code === "ENOENT") return NextResponse.json({ ok: true, missions: [] });
    return NextResponse.json({ ok: false, blocked_by: ["estate_history_unavailable"] }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireLocalSession(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const proposal = body?.proposal;
    const { verification } = verifySubmittedProposal(proposal);
    if (!verification.ok) {
      return NextResponse.json({ ok: false, truth_label: BIZRA_PROMPT_MISSION_BRIDGE_TRUTH_LABEL, verification }, { status: 422 });
    }
    if (proposal?.decision !== "PROPOSE_ONLY") {
      return NextResponse.json({ ok: false, blocked_by: ["estate_observation_requires_read_only_proposal"] }, { status: 409 });
    }
    if (proposal?.capability?.id !== BIZRA_ESTATE_CAPABILITY_ID) {
      return NextResponse.json({ ok: false, blocked_by: ["estate_capability_not_selected"] }, { status: 422 });
    }
    if (proposal?.authority?.requested_effects?.length || proposal?.authority?.authority_delta !== 0) {
      return NextResponse.json({ ok: false, blocked_by: ["estate_observation_scope_not_read_only"] }, { status: 403 });
    }
    const expectedCapability = buildEstateCapability();
    if (!capabilityIsEquivalent(proposal.capability, expectedCapability)) {
      return NextResponse.json({ ok: false, blocked_by: ["estate_capability_binding_mismatch"] }, { status: 409 });
    }
    const target = receiptPath(proposal.mission_id);
    if (!target) return NextResponse.json({ ok: false, blocked_by: ["mission_id_invalid"] }, { status: 422 });
    const existing = await readReceipt(proposal.mission_id);
    if (existing) {
      return NextResponse.json({ ok: true, reused: true, proposal, verification, report: existing.receipt.report, receipt_hash: existing.receipt.receipt_hash });
    }
    const observation = await buildEstateObservation({ capability: proposal.capability });
    const report = buildEstateFounderReport({
      observation,
      missionId: proposal.mission_id,
      sourceText: proposal.source_text,
      evidenceRef: target as string,
    });
    const persisted = await persistReceipt({ proposal, report, observation, target });
    if (!persisted.ok) return NextResponse.json({ ok: false, blocked_by: persisted.blocked_by }, { status: 503 });
    return NextResponse.json({
      ok: true,
      reused: persisted.reused,
      truth_label: BIZRA_PROMPT_MISSION_BRIDGE_TRUTH_LABEL,
      proposal,
      verification,
      report: persisted.receipt.report,
      receipt_hash: persisted.receipt.receipt_hash,
      evidence_ref: persisted.target,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, blocked_by: [String((error as Error)?.message ?? error)] }, { status: 400 });
  }
}
