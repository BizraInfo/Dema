/**
 * Field-level claim/evidence binding for SituationState.
 *
 * This module is a pure read-model operation. It does not mint claims,
 * receipts or authority. UNKNOWN fields receive a limitation binding, not
 * synthetic support.
 */

import type {
  EvidenceView,
  Freshness,
  SituationState,
  TruthStatus,
} from "./situation-state.ts";

export const EVIDENCE_BINDING_SCHEMA = "bizra.dema.evidence_binding.v0.1" as const;

export interface EvidenceBinding {
  readonly schema: typeof EVIDENCE_BINDING_SCHEMA;
  readonly fieldRef: string;
  readonly claimRefs: readonly string[];
  readonly observationRefs: readonly string[];
  readonly receiptRefs: readonly string[];
  readonly provenanceRefs: readonly string[];
  readonly truth: TruthStatus;
  readonly freshness: Freshness;
  readonly proofCeiling: readonly string[];
  readonly notEstablished: readonly string[];
}

export interface EvidenceBindingValidation {
  readonly ok: boolean;
  readonly errors: readonly string[];
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim().length > 0))].sort();
}

function unknownFreshness(freshness: Freshness): Freshness {
  return { ...freshness, status: "UNKNOWN" };
}

function fieldClaims(evidence: EvidenceView, fieldRef: string): string[] {
  return evidence.claims
    .filter((claim) => claim.scope === fieldRef)
    .map((claim) => claim.claimId);
}

function supportFreshness(evidence: EvidenceView, binding: EvidenceBinding): Freshness[] {
  const claims = new Map(evidence.claims.map((claim) => [claim.claimId, claim]));
  const observations = new Map(evidence.observations.map((observation) => [observation.observationId, observation]));
  const receipts = new Map(evidence.receipts.map((receipt) => [receipt.receiptId, receipt]));
  const supported: Freshness[] = [];
  for (const ref of binding.observationRefs) {
    const observation = observations.get(ref);
    if (observation) supported.push(observation.freshness);
  }
  for (const ref of binding.receiptRefs) {
    const receipt = receipts.get(ref);
    if (receipt) supported.push(receipt.freshness);
  }
  for (const ref of binding.claimRefs) {
    const claim = claims.get(ref);
    if (!claim) continue;
    supported.push(claim.freshness);
    for (const observationRef of claim.observationRefs) {
      const observation = observations.get(observationRef);
      if (observation) supported.push(observation.freshness);
    }
    for (const receiptRef of claim.receiptRefs) {
      const receipt = receipts.get(receiptRef);
      if (receipt) supported.push(receipt.freshness);
    }
  }
  return supported;
}

function bindingShape(binding: EvidenceBinding): EvidenceBinding {
  return {
    ...binding,
    claimRefs: sortedUnique(binding.claimRefs),
    observationRefs: sortedUnique(binding.observationRefs),
    receiptRefs: sortedUnique(binding.receiptRefs),
    provenanceRefs: sortedUnique(binding.provenanceRefs),
    proofCeiling: sortedUnique(binding.proofCeiling),
    notEstablished: sortedUnique(binding.notEstablished),
  };
}

/** Normalize unordered evidence references without generating identifiers. */
export function normalizeEvidenceBinding(binding: EvidenceBinding): EvidenceBinding {
  return bindingShape(binding);
}

/** Validate referential integrity and prevent evidence-strength upgrades. */
export function validateEvidenceBindings(evidence: EvidenceView): EvidenceBindingValidation {
  const errors: string[] = [];
  const claims = new Map(evidence.claims.map((claim) => [claim.claimId, claim]));
  const observations = new Map(evidence.observations.map((observation) => [observation.observationId, observation]));
  const receipts = new Map(evidence.receipts.map((receipt) => [receipt.receiptId, receipt]));
  const provenance = new Set(evidence.provenance);

  for (const binding of evidence.bindings) {
    if (binding.schema !== EVIDENCE_BINDING_SCHEMA) errors.push(`binding_schema_invalid:${binding.fieldRef}`);
    if (!/^\/[A-Za-z0-9._/-]+$/.test(binding.fieldRef)) errors.push(`binding_field_ref_invalid:${binding.fieldRef}`);
    if (JSON.stringify(bindingShape(binding)) !== JSON.stringify(binding)) errors.push(`binding_refs_not_normalized:${binding.fieldRef}`);
    if (!Array.isArray(binding.proofCeiling) || binding.proofCeiling.length === 0) errors.push(`binding_proof_ceiling_missing:${binding.fieldRef}`);
    if (!Array.isArray(binding.notEstablished)) errors.push(`binding_not_established_missing:${binding.fieldRef}`);

    for (const ref of binding.claimRefs) if (!claims.has(ref)) errors.push(`binding_claim_missing:${binding.fieldRef}:${ref}`);
    for (const ref of binding.observationRefs) if (!observations.has(ref)) errors.push(`binding_observation_missing:${binding.fieldRef}:${ref}`);
    for (const ref of binding.receiptRefs) if (!receipts.has(ref)) errors.push(`binding_receipt_missing:${binding.fieldRef}:${ref}`);
    for (const ref of binding.provenanceRefs) if (!provenance.has(ref)) errors.push(`binding_provenance_missing:${binding.fieldRef}:${ref}`);

    const support = supportFreshness(evidence, binding);
    const hasDirectOrClaimSupport = binding.claimRefs.length > 0 || binding.observationRefs.length > 0 || binding.receiptRefs.length > 0;
    if (binding.truth === "VERIFIED" && !hasDirectOrClaimSupport) errors.push(`verified_binding_without_evidence:${binding.fieldRef}`);
    if (binding.truth !== "UNKNOWN" && !hasDirectOrClaimSupport) errors.push(`binding_truth_without_evidence:${binding.fieldRef}`);
    if (binding.freshness.status === "CURRENT" && hasDirectOrClaimSupport && support.length > 0 && support.every((freshness) => freshness.status !== "CURRENT")) {
      errors.push(`current_binding_stale_only:${binding.fieldRef}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

function fieldBinding(
  state: SituationState,
  fieldRef: string,
  truth: TruthStatus,
  freshness: Freshness,
  claimRefs: readonly string[],
  observationRefs: readonly string[],
  receiptRefs: readonly string[],
  provenanceRefs: readonly string[],
  proofCeiling: readonly string[],
  extraNotEstablished: readonly string[] = [],
): EvidenceBinding {
  const support = claimRefs.length + observationRefs.length + receiptRefs.length > 0;
  return bindingShape({
    schema: EVIDENCE_BINDING_SCHEMA,
    fieldRef,
    claimRefs,
    observationRefs,
    receiptRefs,
    provenanceRefs,
    truth: support ? truth : "UNKNOWN",
    freshness: support ? freshness : unknownFreshness(freshness),
    proofCeiling: support ? proofCeiling : ["NO_SUPPORTING_EVIDENCE"],
    notEstablished: [...state.evidence.notEstablished, ...state.evidence.contradictions, ...extraNotEstablished],
  });
}

/** Build deterministic bindings for the existing Situation read model. */
export function buildEvidenceBindings(state: SituationState): readonly EvidenceBinding[] {
  const bindings: EvidenceBinding[] = [];
  const evidence = state.evidence;

  for (const key of Object.keys(state.resources).sort()) {
    const fieldRef = `/resources/${key}`;
    const observationRefs = evidence.observations
      .filter((observation) => observation.observationId === `observation:${key}` || observation.observationId.startsWith(`observation:${key}:`))
      .map((observation) => observation.observationId);
    const selected = state.resources[key];
    const provenanceRefs = evidence.observations
      .filter((observation) => observationRefs.includes(observation.observationId))
      .flatMap((observation) => observation.provenance);
    bindings.push(fieldBinding(
      state,
      fieldRef,
      selected.truth,
      selected.freshness,
      fieldClaims(evidence, fieldRef),
      observationRefs,
      [],
      provenanceRefs,
      ["RESOURCE_OBSERVATION_ONLY"],
      ["mission_completion", "authority"],
    ));
  }

  const unknownSemanticFields: Array<[string, TruthStatus, Freshness]> = [
    ["/subject/node", state.subject.node.truth, unknownFreshness(state.observation)],
    ["/mission/currentState", state.mission.truth, state.mission.truth === "UNKNOWN" ? unknownFreshness(state.mission.freshness) : state.mission.freshness],
    ["/frontier/status", state.frontier.truth, state.frontier.truth === "UNKNOWN" ? unknownFreshness(state.frontier.freshness) : state.frontier.freshness],
    ["/attention/status", state.attention.status === "UNKNOWN" ? "UNKNOWN" : "OBSERVED", state.attention.status === "UNKNOWN" ? unknownFreshness(state.attention.freshness) : state.attention.freshness],
    ["/authority/current/status", state.authority.current.status === "UNKNOWN" ? "UNKNOWN" : "OBSERVED", state.authority.current.status === "UNKNOWN" ? unknownFreshness(state.authority.current.freshness) : state.authority.current.freshness],
    ["/recommendation/proposedAction", state.recommendation.proposedAction ? "DECLARED" : "UNKNOWN", state.recommendation.proposedAction ? state.recommendation.freshness : unknownFreshness(state.recommendation.freshness)],
  ];
  for (const [fieldRef, truth, freshness] of unknownSemanticFields) {
    bindings.push(fieldBinding(
      state,
      fieldRef,
      truth,
      freshness,
      fieldClaims(evidence, fieldRef),
      [],
      [],
      [],
      evidence.proofCeiling,
      ["field_not_bound"],
    ));
  }

  for (const actor of [...state.actors].sort((left, right) => left.actorId.localeCompare(right.actorId))) {
    bindings.push(fieldBinding(
      state,
      `/actors/${actor.actorId}/reality/activity`,
      "UNKNOWN",
      unknownFreshness(actor.observation),
      [],
      [],
      [],
      [],
      evidence.proofCeiling,
      ["actor_activity_not_bound"],
    ));
  }

  return Object.freeze(bindings.map((binding) => Object.freeze(binding)));
}

/** Attach bindings to a derived state without persisting or mutating authority. */
export function attachEvidenceBindings(state: SituationState): SituationState {
  return {
    ...state,
    evidence: {
      ...state.evidence,
      bindings: buildEvidenceBindings(state),
    },
  };
}
