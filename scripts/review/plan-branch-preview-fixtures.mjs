// Example plan-branch inputs for PLAN-BRANCH-PREVIEW-1A. Kept in scripts/review (not in the
// *-preview.js kernel) so that rejected-alternative names / boundary vocabulary in the fixtures never
// trip the static boundary-invariant check that scans preview kernels.

export const H = (c) => `sha256:${c.repeat(64)}`;

export function examplePlanBranchInput() {
  return {
    mission_id: "mission-plan-branch-1a",
    niyyah_hash: H("a"),
    chosen_branch_id: "branch-safe-readonly",
    branches: [
      {
        id: "branch-safe-readonly",
        title: "Preview-only evidence binding",
        summary: "Bind evidence without execution.",
        risk_score: 0.1,
        ihsan_score: 0.95,
        estimated_cost: 1,
        consent_required: false,
        authority_delta: 0,
        evidence_refs: [H("b")],
      },
      {
        id: "branch-direct-action",
        title: "Direct action",
        summary: "Would skip FATE and is rejected.",
        risk_score: 0.9,
        ihsan_score: 0.3,
        estimated_cost: 3,
        consent_required: true,
        authority_delta: 0,
        evidence_refs: [H("c")],
      },
      {
        id: "branch-model-claim",
        title: "Model claim",
        summary: "Would treat model output as truth and is rejected.",
        risk_score: 0.7,
        ihsan_score: 0.5,
        estimated_cost: 2,
        consent_required: true,
        authority_delta: 0,
        evidence_refs: [H("d")],
      },
    ],
    rejected_branches: [
      {
        branch_id: "branch-direct-action",
        rejection_reason: "unsafe_boundary",
        rejection_basis: "Would bypass FATE and action consent.",
        evidence_refs: [H("e")],
      },
      {
        branch_id: "branch-model-claim",
        rejection_reason: "overclaim_risk",
        rejection_basis: "Would treat model suggestion as authority.",
        evidence_refs: [H("f")],
      },
    ],
  };
}
