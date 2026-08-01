// PEAK-VERIFY-ADMISSION-1B — judge-free verifier admission gate (ADR-049 Action #2).
// Pure kernel: decides whether a proposed act's success is self-verifiable without judgment.
// Preview/admission only — does not execute acts, re-insert inputs, or start a loop.
//
// 1B weld (SAT-XVERIFY-20260731T163000 F1+F2, schema v0.1 → v0.2):
//   F1 — a verifier is admitted only with its exact bindings. "A NAMED test
//        suite exits 0 at an EXACT SHA" (ADR-049): a verifier named without
//        bindings is a category, not an executable check. Fail closed per key.
//   F2 — proposer ≠ certifier, structurally. "Any metric the acting party
//        computes about itself" is inadmissible; certifier identity is now
//        part of the schema, and certifier === proposer refuses.
//   F3 — the dead independent_recompute escape hatch is removed. Dead
//        parameters on a gate invite drift.

import { buildAllFalseBoundaryFromKeys } from "./boundary-schema.js";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";

export const VERIFICATION_ADMISSION_SCHEMA =
  "bizra.dema.verification_admission.v0.2";
export const VERIFICATION_ADMISSION_TRUTH_LABEL =
  "PEAK_VERIFY_ADMISSION_PREVIEW_ONLY";

export const ADMISSIBLE_VERIFIERS = Object.freeze([
  "hash_equality",
  "restore_test",
  "suite_exit_0",
  "schema_validate",
  "content_address_rederive",
]);

export const INADMISSIBLE_VERIFIERS = Object.freeze([
  "llm_as_judge",
  "model_self_assessment",
  "vibes",
  "self_metric_without_independent_recompute",
]);

const ADMISSIBLE_SET = new Set(ADMISSIBLE_VERIFIERS);
const INADMISSIBLE_SET = new Set(INADMISSIBLE_VERIFIERS);

// F1 — exact bindings each verifier class must carry to be executable
// without judgment. `requires`: every key, non-empty string. `requiresOneOf`:
// at least one key, non-empty string. Empty/whitespace never counts as bound.
export const VERIFIER_BINDINGS = Object.freeze({
  hash_equality: Object.freeze({
    requires: Object.freeze([]),
    requiresOneOf: Object.freeze([
      "expected_pre_sha256",
      "expected_post_sha256",
    ]),
  }),
  restore_test: Object.freeze({
    requires: Object.freeze(["backup_ref", "target_ref"]),
    requiresOneOf: Object.freeze([]),
  }),
  suite_exit_0: Object.freeze({
    requires: Object.freeze(["suite", "command", "tree_sha"]),
    requiresOneOf: Object.freeze([]),
  }),
  schema_validate: Object.freeze({
    requires: Object.freeze(["schema"]),
    requiresOneOf: Object.freeze([]),
  }),
  content_address_rederive: Object.freeze({
    requires: Object.freeze(["content_address"]),
    requiresOneOf: Object.freeze([]),
  }),
});

export const VERIFICATION_ADMISSION_BOUNDARY_KEYS = Object.freeze([
  "runtime_execution_performed",
  "file_write_performed",
  "model_invocation_performed",
  "network_call_performed",
  "self_modification_performed",
  "autonomous_loop_started",
  "action_execution_performed",
  "daemon_started",
  "signing_performed",
  "key_generation_performed",
  "mint_performed",
  "token_or_reward_activated",
  "poi_activation_performed",
  "federation_started",
  "mcp_runtime_started",
  "a2a_runtime_started",
  "reinsert_as_next_input_performed",
]);

const CANONICAL_BOUNDARY = buildAllFalseBoundaryFromKeys(
  VERIFICATION_ADMISSION_BOUNDARY_KEYS,
);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function admitResult({
  self_verifiable,
  named_verifier,
  refusal_reason,
  proposed_act,
  proposer,
  certifier,
  bindings,
}) {
  const body = {
    schema: VERIFICATION_ADMISSION_SCHEMA,
    truth_label: VERIFICATION_ADMISSION_TRUTH_LABEL,
    self_verifiable,
    named_verifier,
    refusal_reason,
    proposed_act: proposed_act || null,
    proposer: proposer || null,
    certifier: certifier || null,
    bindings: bindings && typeof bindings === "object" ? { ...bindings } : null,
    admissible_verifiers: ADMISSIBLE_VERIFIERS,
    inadmissible_verifiers: INADMISSIBLE_VERIFIERS,
    reinsert_eligible: self_verifiable === true,
    what_this_proves:
      "Whether a proposed act names a judge-free verifier admissible for sealed re-insert as next INPUT",
    what_this_does_not_prove:
      "That any act ran, that VERIFY passed empirically, that a loop closed, or that autonomy is live",
    boundary: { ...CANONICAL_BOUNDARY },
  };
  return deepFreeze({
    ...body,
    content_hash: sha256(stableStringify(body)),
  });
}

/**
 * Decide whether a proposed act may be treated as self-verifiable for Peak loop law.
 *
 * @param {object} [input]
 * @param {string} [input.proposed_act] typed act id / description
 * @param {string} [input.verifier] named verifier class
 * @param {string} [input.proposer] identity of the acting party
 * @param {string} [input.certifier] identity of the party computing the check —
 *   required, and structurally forbidden from equalling the proposer (F2)
 * @param {object} [input.bindings] exact bindings per VERIFIER_BINDINGS (F1)
 */
export function evaluateVerificationAdmission({
  proposed_act = "",
  verifier = "",
  proposer = "",
  certifier = "",
  bindings = {},
} = {}) {
  const act = text(proposed_act);
  const named = text(verifier);
  const who = text(proposer);
  const cert = text(certifier);
  const bound =
    bindings && typeof bindings === "object" && !Array.isArray(bindings)
      ? bindings
      : {};
  const base = { proposed_act: act, proposer: who, certifier: cert, bindings: bound };

  if (!act) {
    return admitResult({
      self_verifiable: false,
      named_verifier: named || null,
      refusal_reason: "proposed_act_required",
      ...base,
    });
  }

  if (!named) {
    return admitResult({
      self_verifiable: false,
      named_verifier: null,
      refusal_reason: "verifier_required",
      ...base,
    });
  }

  if (INADMISSIBLE_SET.has(named)) {
    return admitResult({
      self_verifiable: false,
      named_verifier: named,
      refusal_reason: `inadmissible_verifier:${named}`,
      ...base,
    });
  }

  if (!ADMISSIBLE_SET.has(named)) {
    return admitResult({
      self_verifiable: false,
      named_verifier: named,
      refusal_reason: "unknown_verifier",
      ...base,
    });
  }

  // F2 — the check must have a named certifier, and it may not be the actor.
  if (!cert) {
    return admitResult({
      self_verifiable: false,
      named_verifier: named,
      refusal_reason: "certifier_required",
      ...base,
    });
  }
  if (who && cert === who) {
    return admitResult({
      self_verifiable: false,
      named_verifier: named,
      refusal_reason: "self_certification",
      ...base,
    });
  }

  // F1 — the verifier must be executable: every exact binding present.
  const contract = VERIFIER_BINDINGS[named];
  for (const key of contract.requires) {
    if (!text(bound[key])) {
      return admitResult({
        self_verifiable: false,
        named_verifier: named,
        refusal_reason: `unbound_verifier:${named}:${key}`,
        ...base,
      });
    }
  }
  if (
    contract.requiresOneOf.length > 0 &&
    !contract.requiresOneOf.some((key) => text(bound[key]))
  ) {
    return admitResult({
      self_verifiable: false,
      named_verifier: named,
      refusal_reason: `unbound_verifier:${named}:one_of:${contract.requiresOneOf.join("|")}`,
      ...base,
    });
  }

  return admitResult({
    self_verifiable: true,
    named_verifier: named,
    refusal_reason: null,
    ...base,
  });
}

/** Fail-closed Peak default: no proposed act → not reinsert-eligible. */
export function buildPeakVerificationAdmissionDefault() {
  return evaluateVerificationAdmission({});
}
