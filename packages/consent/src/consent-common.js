import { createHash } from "node:crypto";

export const SCHEMA = "bizra.dema.consent_plan_preview.v0.1";

export const MICRO_CONSENT_SHAPE = [
  "mission_id",
  "agent_id",
  "resource_id",
  "action",
  "purpose",
  "expires_at",
  "commitment_hash"
];

export const PREVIEW_PROOF_OF_TRUTH = {
  formal: {
    status: "open_in_preview",
    proof: "permissions are structured and registry-shaped"
  },
  cryptographic: {
    status: "partial_preview",
    proof: "commitment_hash covers proposed permissions only"
  },
  empirical: {
    status: "operator_review_required",
    proof: "human can inspect and narrow before runtime"
  },
  economic: {
    status: "closed_until_verified_impact",
    proof: "no IMP, token, or value claim can arise from consent planning"
  }
};

export const PREVIEW_BOUNDARY = {
  scope: "read-only",
  inference_invoked: false,
  approval_recorded: false,
  capability_minted: false,
  execution_enabled: false,
  mutation_performed: false,
  receipt_minted: false
};

export function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableStringify(value[key])}`
    ));
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
