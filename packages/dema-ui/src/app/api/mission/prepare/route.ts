import { NextRequest, NextResponse } from "next/server";

import {
  BIZRA_PROMPT_MISSION_BRIDGE_TRUTH_LABEL,
  compileMissionProposal,
  verifyMissionProposal,
} from "@core/bizra-prompt-mission-bridge.js";
import { mergeNode0MissionContext, persistAttentionAllocation } from "../node0-runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_INTENT_BYTES = 64 * 1024;

export async function POST(request: NextRequest) {
  const compilerCodeHash = process.env.BIZRA_PROMPT_COMPILER_CODE_HASH;
  if (!compilerCodeHash) {
    return NextResponse.json(
      {
        ok: false,
        truth_label: BIZRA_PROMPT_MISSION_BRIDGE_TRUTH_LABEL,
        blocked_by: ["compiler_code_hash_unbound"],
      },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();
    const text = typeof body?.text === "string" ? body.text : "";
    if (Buffer.byteLength(text, "utf8") > MAX_INTENT_BYTES) {
      return NextResponse.json(
        { ok: false, blocked_by: ["intent_too_large"] },
        { status: 413 },
      );
    }

    const proposal = compileMissionProposal({
      text,
      context: mergeNode0MissionContext(body?.context),
      now_iso: new Date().toISOString(),
      compiler_code_hash: compilerCodeHash,
    });
    const verification = verifyMissionProposal(proposal, {
      expected_compiler_code_hash: compilerCodeHash,
      expected_context: proposal.context_snapshot,
    });

    if (!verification.ok) {
      return NextResponse.json(
        { ok: false, truth_label: BIZRA_PROMPT_MISSION_BRIDGE_TRUTH_LABEL, verification },
        { status: 422 },
      );
    }
    const allocation = persistAttentionAllocation(proposal);
    if (!allocation.ok) {
      return NextResponse.json(
        {
          ok: false,
          truth_label: BIZRA_PROMPT_MISSION_BRIDGE_TRUTH_LABEL,
          blocked_by: allocation.blocked_by,
        },
        { status: 503 },
      );
    }
    return NextResponse.json({
      ok: true,
      truth_label: BIZRA_PROMPT_MISSION_BRIDGE_TRUTH_LABEL,
      proposal,
      verification,
      allocation_receipt: allocation.receipt,
      allocation_receipt_reused: allocation.reused,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        truth_label: BIZRA_PROMPT_MISSION_BRIDGE_TRUTH_LABEL,
        blocked_by: [String((error as Error)?.message ?? error)],
      },
      { status: 400 },
    );
  }
}
