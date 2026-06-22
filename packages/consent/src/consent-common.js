import { createHash } from "node:crypto";

export const SCHEMA = "bizra.dema.consent_plan_preview.v0.1";

// Bound intent length to prevent DoS via oversized intent strings (hashing,
// stable-stringify, and lexical extraction all scale with input size). Sync +
// deterministic by design: no async, no timestamp. 10 KiB is generous for a
// natural-language intent while closing the unbounded-input hole.
export const MAX_INTENT_BYTES = 10 * 1024;

export function assertIntentWithinBound(intent, context = "Intent") {
  const byteLength = Buffer.byteLength(String(intent ?? ""), "utf8");
  if (byteLength > MAX_INTENT_BYTES) {
    throw new Error(
      `${context} exceeds maximum length of ${MAX_INTENT_BYTES} bytes (got ${byteLength} bytes).`,
    );
  }
}

export const MICRO_CONSENT_SHAPE = [
  "mission_id",
  "agent_id",
  "resource_id",
  "action",
  "purpose",
  "expires_at",
  "commitment_hash",
];

export const PREVIEW_PROOF_OF_TRUTH = {
  formal: {
    status: "open_in_preview",
    proof: "permissions are structured and registry-shaped",
  },
  cryptographic: {
    status: "partial_preview",
    proof: "commitment_hash covers proposed permissions only",
  },
  empirical: {
    status: "operator_review_required",
    proof: "human can inspect and narrow before runtime",
  },
  economic: {
    status: "closed_until_verified_impact",
    proof: "no IMP, token, or value claim can arise from consent planning",
  },
};

export const PREVIEW_BOUNDARY = {
  scope: "read-only",
  inference_invoked: false,
  approval_recorded: false,
  capability_minted: false,
  execution_enabled: false,
  mutation_performed: false,
  receipt_minted: false,
};

// Bounded against adversarial / cyclic input (AUDIT P2): a body deeper than
// MAX_DEPTH fails closed rather than exhausting the stack while canonicalizing
// for a hash. Real consent/receipt bodies are shallow; 100 is generous headroom.
export const STABLE_STRINGIFY_MAX_DEPTH = 100;

export function stableStringify(value) {
  const recur = (v, depth) => {
    if (depth > STABLE_STRINGIFY_MAX_DEPTH) {
      throw new RangeError(
        `stableStringify: max nesting depth ${STABLE_STRINGIFY_MAX_DEPTH} exceeded (possible cyclic or adversarial input)`,
      );
    }
    if (Array.isArray(v)) {
      return `[${v.map((item) => recur(item, depth + 1)).join(",")}]`;
    }
    if (v && typeof v === "object") {
      const entries = Object.keys(v)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${recur(v[key], depth + 1)}`);
      return `{${entries.join(",")}}`;
    }
    return JSON.stringify(v);
  };
  return recur(value, 0);
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
