import { NextRequest, NextResponse } from "next/server";

import {
  BIZRA_PROMPT_MISSION_BRIDGE_TRUTH_LABEL,
} from "@core/bizra-prompt-mission-bridge.js";
import {
  callGovernedRuntime,
  configuredMissionRoot,
  proposalBinding,
  verifySubmittedProposal,
} from "../node0-runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { verification } = verifySubmittedProposal(body?.proposal);
    if (!verification.ok) {
      return NextResponse.json(
        { ok: false, truth_label: BIZRA_PROMPT_MISSION_BRIDGE_TRUTH_LABEL, verification },
        { status: 422 },
      );
    }
    if (body?.proposal?.decision !== "PROPOSE_ONLY") {
      return NextResponse.json(
        { ok: false, blocked_by: ["consequential_request_requires_human_review"] },
        { status: 409 },
      );
    }

    const root = configuredMissionRoot();
    if (!root) {
      return NextResponse.json({ ok: false, blocked_by: ["mission_root_unbound"] }, { status: 503 });
    }
    if (body?.root !== undefined && body.root !== root) {
      return NextResponse.json({ ok: false, blocked_by: ["mission_root_not_allowed"] }, { status: 403 });
    }

    const binding = proposalBinding(body.proposal);
    const governed = await callGovernedRuntime("/api/consent-card", {
      root,
      mission_id: body.proposal.mission_id,
      proposal_binding: binding,
    });
    let pat = { ok: false, blocked_by: ["pat_card_not_requested"] };
    if (governed.data?.ok === true) {
      try {
        const patResponse = await callGovernedRuntime("/api/pat-card", {
          mission_id: body.proposal.mission_id,
          prompt: body.proposal.source_text,
          proposal_binding: binding,
        });
        pat = patResponse.data;
      } catch (error) {
        pat = { ok: false, blocked_by: [`pat_card_failed:${String((error as Error)?.message ?? error)}`] };
      }
    }
    return NextResponse.json(
      {
        ok: governed.data?.ok === true,
        truth_label: BIZRA_PROMPT_MISSION_BRIDGE_TRUTH_LABEL,
        proposal: body.proposal,
        verification,
        binding,
        governed: governed.data,
        pat,
      },
      { status: governed.status },
    );
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
