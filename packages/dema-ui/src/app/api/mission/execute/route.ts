import { NextRequest, NextResponse } from "next/server";

import {
  BIZRA_PROMPT_MISSION_BRIDGE_TRUTH_LABEL,
} from "@core/bizra-prompt-mission-bridge.js";
import {
  callGovernedRuntime,
  proposalBinding,
  verifySubmittedProposal,
} from "../node0-runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sameBinding(left: any, right: any) {
  return ["bridge_hash", "source_intent_hash", "compiler_identity_hash", "compiled_contract_hash", "context_hash"]
    .every((key) => left?.[key] === right?.[key]);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const proposal = body?.proposal;
    const { verification } = verifySubmittedProposal(proposal);
    if (!verification.ok) {
      return NextResponse.json(
        { ok: false, truth_label: BIZRA_PROMPT_MISSION_BRIDGE_TRUTH_LABEL, verification },
        { status: 422 },
      );
    }
    if (proposal.decision !== "PROPOSE_ONLY") {
      return NextResponse.json(
        { ok: false, blocked_by: ["consequential_request_requires_human_review"] },
        { status: 409 },
      );
    }

    const consentContext = body?.consent_context;
    const expectedBinding = proposalBinding(proposal);
    if (consentContext?.mission_id !== proposal.mission_id) {
      return NextResponse.json({ ok: false, blocked_by: ["mission_id_mismatch"] }, { status: 422 });
    }
    if (!sameBinding(consentContext?.proposal_binding, expectedBinding)) {
      return NextResponse.json({ ok: false, blocked_by: ["proposal_binding_mismatch"] }, { status: 422 });
    }
    if (typeof body?.phrase !== "string") {
      return NextResponse.json({ ok: false, blocked_by: ["exact_consent_required"] }, { status: 400 });
    }

    let pat: any = null;
    if (body?.pat_consent_context || body?.pat_phrase !== undefined) {
      if (!body?.pat_consent_context || typeof body?.pat_phrase !== "string") {
        return NextResponse.json({ ok: false, blocked_by: ["exact_pat_consent_required"] }, { status: 400 });
      }
      const patCall = await callGovernedRuntime("/api/pat-proposal", {
        mission_id: proposal.mission_id,
        prompt: proposal.source_text,
        proposal_binding: expectedBinding,
        consent_context: body.pat_consent_context,
        phrase: body.pat_phrase,
      });
      pat = patCall.data;
      if (pat?.ok !== true) {
        return NextResponse.json(
          { ok: false, truth_label: BIZRA_PROMPT_MISSION_BRIDGE_TRUTH_LABEL, proposal, verification, pat, governed: null },
          { status: patCall.status },
        );
      }
    }

    const governed = await callGovernedRuntime("/api/authorize", {
      consent_context: consentContext,
      phrase: body.phrase,
    });
    return NextResponse.json(
      {
        ok: governed.data?.ok === true,
        truth_label: BIZRA_PROMPT_MISSION_BRIDGE_TRUTH_LABEL,
        proposal,
        verification,
        pat,
        governed: governed.data,
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
