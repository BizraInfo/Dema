import { NextRequest, NextResponse } from "next/server";

import {
  BIZRA_PROMPT_MISSION_BRIDGE_TRUTH_LABEL,
} from "@core/bizra-prompt-mission-bridge.js";
import {
  callGovernedRuntime,
  configuredMissionRoot,
  proposalBinding,
  verifySubmittedProposal,
  missionRequirementResponse,
} from "../node0-runtime";
import { requireLocalSession } from "@/lib/auth/session-boundary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sameBinding(left: any, right: any) {
  return ["bridge_hash", "source_intent_hash", "compiler_identity_hash", "compiled_contract_hash", "context_hash", "requirement_binding_hash"]
    .every((key) => left?.[key] === right?.[key]);
}

export async function POST(request: NextRequest) {
  const denied = await requireLocalSession(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const proposal = body?.proposal;
    const { verification } = verifySubmittedProposal(proposal);
    if (!verification.ok) {
      return NextResponse.json(
        missionRequirementResponse(proposal, verification),
        { status: 422 },
      );
    }
    const refuse = (code: string, status: number) => NextResponse.json(
      missionRequirementResponse(proposal, { ok: false, blocked_by: [code] }), { status },
    );
    if (body?.task_id !== undefined && body.task_id !== proposal?.task_requirement?.task_id) {
      return refuse("task_id_mismatch", 422);
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
      return refuse("mission_id_mismatch", 422);
    }
    if (!sameBinding(consentContext?.proposal_binding, expectedBinding)) {
      return refuse("proposal_binding_mismatch", 422);
    }
    if (typeof body?.phrase !== "string") {
      return refuse("exact_consent_required", 400);
    }
    const missionRoot = configuredMissionRoot();
    if (!missionRoot) {
      return refuse("mission_root_unbound", 503);
    }
    if (consentContext?.canonical_root !== missionRoot) {
      return refuse("consent_context_root_mismatch", 403);
    }
    const governedConsentContext = { ...consentContext, canonical_root: missionRoot };
    if (verification.requirement_verdict === "OPERATION_MATCH_PREVIEW_ONLY") {
      return NextResponse.json(missionRequirementResponse(proposal, verification));
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
      consent_context: governedConsentContext,
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
      missionRequirementResponse(null, { ok: false, blocked_by: [String((error as Error)?.message ?? error)] }),
      { status: 400 },
    );
  }
}
