import { NextRequest, NextResponse } from "next/server";

import {
  BIZRA_PROMPT_MISSION_BRIDGE_TRUTH_LABEL,
  compileMissionProposal,
} from "@core/bizra-prompt-mission-bridge.js";
import { MAX_INTENT_BYTES, mergeNode0MissionContext, verifySubmittedProposal, missionRequirementResponse } from "../node0-runtime";
import { resolveTrustedRequirement } from "../trusted-requirement";
import { requireLocalSession } from "@/lib/auth/session-boundary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const denied = await requireLocalSession(request);
  if (denied) return denied;

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
    if (body && ["task_requirement", "proposal", "verification"].some(key => Object.hasOwn(body, key))) {
      return NextResponse.json(missionRequirementResponse(null, {
        ok: false, blocked_by: ["caller_requirement_claim_not_allowed"],
      }), { status: 422 });
    }
    const text = typeof body?.text === "string" ? body.text : "";
    if (Buffer.byteLength(text, "utf8") > MAX_INTENT_BYTES) {
      return NextResponse.json(
        { ok: false, blocked_by: ["intent_too_large"] },
        { status: 413 },
      );
    }

    const proposal = compileMissionProposal({
      text,
      context: mergeNode0MissionContext({}),
      now_iso: new Date().toISOString(),
      compiler_code_hash: compilerCodeHash,
      task_requirement: resolveTrustedRequirement(body?.task_id, { source_text: text }),
    });
    const { verification } = verifySubmittedProposal(proposal);
    // An isolated preview is not an attention receipt or production permission.
    return NextResponse.json(missionRequirementResponse(proposal, verification), {
      status: verification.ok ? 200 : 422,
    });
  } catch (error) {
    return NextResponse.json(
      missionRequirementResponse(null, { ok: false, blocked_by: [String((error as Error)?.message ?? error)] }),
      { status: 400 },
    );
  }
}
