/**
 * DEMA Situation State v0.1.
 *
 * This is an immutable derived read model for NOW projections. It is not a
 * database, event log, authority store, mission registry, or receipt writer.
 * Existing domain authorities remain the sources; a later aggregator will
 * assemble this shape from them.
 */

import { validateEvidenceBindings } from "./evidence-binding.ts";

export const SITUATION_STATE_SCHEMA = "bizra.dema.situation_state.v0.1" as const;

export type TruthStatus =
  | "UNKNOWN"
  | "DESIGNED"
  | "DECLARED"
  | "AVAILABLE"
  | "ACTIVE"
  | "OBSERVED"
  | "MEASURED"
  | "VERIFIED"
  | "BLOCKED"
  | "OFFLINE"
  | "STALE"
  | "REFUSED"
  | "PREVIEW_ONLY";

export type FreshnessStatus = "CURRENT" | "STALE" | "UNKNOWN";

export interface Freshness {
  readonly observedAt: string;
  readonly validUntil: string | null;
  readonly status: FreshnessStatus;
  readonly source: string;
}

export interface SituationObservation<T = unknown> {
  readonly value: T | null;
  readonly truth: TruthStatus;
  readonly freshness: Freshness;
  readonly source: string;
  readonly reason?: string;
}

export interface IdentityRef {
  readonly id: string | null;
  readonly truth: TruthStatus;
  readonly source: string;
}

export interface SituationSubject {
  readonly human: IdentityRef;
  readonly node: IdentityRef;
  readonly lens: string;
}

export type ActorExistence = "DESIGNED" | "DECLARED" | "INSTANTIATED";
export type ActorAvailability = "UNKNOWN" | "AVAILABLE" | "OFFLINE";
export type ActorActivity = "IDLE" | "ACTIVE" | "BLOCKED";
export type ActorEvidenceState = "UNOBSERVED" | "MEASURED" | "VERIFIED" | "STALE";

/** Actor reality is deliberately multi-axis; no lossy liveness enum exists. */
export interface ActorReality {
  readonly existence: ActorExistence;
  readonly availability: ActorAvailability;
  readonly activity: ActorActivity;
  readonly evidenceState: ActorEvidenceState;
}

export interface ActorSnapshot {
  readonly actorId: string;
  readonly kind: "DEMA" | "PAT" | "SAT" | "SYSTEM";
  readonly role: string;
  readonly reality: ActorReality;
  readonly observation: Freshness;
  readonly evidenceRefs: readonly string[];
}

export interface MissionView {
  readonly missionId: string | null;
  readonly intent: string | null;
  readonly desiredState: string | null;
  readonly currentState: string | null;
  readonly completionContract: string | null;
  readonly truth: TruthStatus;
  readonly freshness: Freshness;
}

export type FrontierStatus = "OPEN" | "READY" | "BLOCKED" | "WAITING" | "CLOSED" | "UNKNOWN";

export interface FrontierView {
  readonly frontierId: string | null;
  readonly status: FrontierStatus;
  readonly blocker: string | null;
  readonly causalExplanation: string | null;
  readonly truth: TruthStatus;
  readonly freshness: Freshness;
}

export type AttentionSeverity = "INFORMATION" | "CHANGE" | "DECISION" | "BLOCKER" | "BOUNDARY";

export type AttentionStatus = "UNKNOWN" | "NONE_REQUIRED" | "REQUIRED";

export interface AttentionView {
  readonly status: AttentionStatus;
  readonly humanRequired: boolean | null;
  readonly severity: AttentionSeverity;
  readonly reason: string | null;
  readonly deadline: string | null;
  readonly freshness: Freshness;
}

export type Reversibility = "REVERSIBLE" | "PARTIAL" | "IRREVERSIBLE" | "UNKNOWN";

export interface AuthorityDelta {
  /** PREDICTED belongs to a recommendation; MEASURED belongs to a receipt. */
  readonly status: "NONE" | "PREDICTED" | "MEASURED" | "UNKNOWN";
  readonly value: number | null;
  readonly scope: string;
}

export interface RecommendationView {
  readonly proposedAction: string | null;
  readonly expectedStateDelta: string | null;
  readonly basisRefs: readonly string[];
  readonly reasonCode: string | null;
  readonly assumptionRefs: readonly string[];
  readonly confidence: number | null;
  readonly reversibility: Reversibility;
  readonly predictedAuthorityDelta: AuthorityDelta;
  readonly freshness: Freshness;
}

export interface AuthoritySnapshot {
  readonly status: "NONE" | "BOUNDED" | "ACTIVE" | "EXPIRED" | "UNKNOWN";
  readonly leaseId: string | null;
  readonly scope: readonly string[];
  readonly expiresAt: string | null;
  readonly permissions: readonly string[];
  readonly forbiddenBoundaries: readonly string[];
  readonly freshness: Freshness;
}

export interface AuthorityView {
  readonly current: AuthoritySnapshot;
  readonly requiredForProposal: readonly string[];
  readonly requiredForEffect: readonly string[];
  readonly predictedAuthorityDelta: AuthorityDelta;
  readonly actualAuthorityDelta: AuthorityDelta;
}

export interface EvidenceClaim {
  readonly claimId: string;
  readonly text: string;
  readonly truth: TruthStatus;
  readonly scope: string;
  readonly observationRefs: readonly string[];
  readonly receiptRefs: readonly string[];
  readonly freshness: Freshness;
}

export interface EvidenceObservation {
  readonly observationId: string;
  readonly source: string;
  readonly truth: TruthStatus;
  readonly freshness: Freshness;
  readonly provenance: readonly string[];
}

export interface EvidenceReceiptRef {
  readonly receiptId: string;
  readonly truth: TruthStatus;
  readonly hash: string | null;
  readonly freshness: Freshness;
}

export interface EvidenceView {
  readonly claims: readonly EvidenceClaim[];
  readonly observations: readonly EvidenceObservation[];
  readonly provenance: readonly string[];
  readonly receipts: readonly EvidenceReceiptRef[];
  readonly bindings: readonly import("./evidence-binding.ts").EvidenceBinding[];
  readonly contradictions: readonly string[];
  readonly unresolvedGaps: readonly string[];
  readonly proofCeiling: readonly string[];
  readonly notEstablished: readonly string[];
}

export interface TrajectoryView {
  readonly availableNextStates: readonly string[];
  readonly simulatedStates: readonly string[];
  readonly predictedConstraints: readonly string[];
  readonly freshness: Freshness;
}

export interface SituationLineage {
  readonly situationId: string;
  readonly revision: number;
  readonly previousCommitment: string | null;
  readonly eventCursor: string | null;
  readonly derivedFrom: readonly string[];
  readonly sourceCommitments: readonly string[];
}

export interface SituationState {
  readonly schema: typeof SITUATION_STATE_SCHEMA;
  readonly subject: SituationSubject;
  readonly observation: Freshness;
  readonly mission: MissionView;
  readonly frontier: FrontierView;
  readonly attention: AttentionView;
  readonly recommendation: RecommendationView;
  readonly authority: AuthorityView;
  readonly actors: readonly ActorSnapshot[];
  readonly resources: Readonly<Record<string, SituationObservation>>;
  readonly evidence: EvidenceView;
  readonly trajectory: TrajectoryView;
  readonly lineage: SituationLineage;
}

export type SituationValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly errors: readonly string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Validate the invariant-bearing shape without creating or persisting truth.
 * This is intentionally small; source-specific validation belongs to each
 * domain authority and will feed the future aggregator.
 */
export function validateSituationState(input: unknown): SituationValidation {
  const errors: string[] = [];
  if (!isRecord(input)) return { ok: false, errors: ["situation_not_object"] };
  if (input.schema !== SITUATION_STATE_SCHEMA) errors.push("schema_mismatch");
  if (!isRecord(input.subject)) errors.push("subject_missing");
  if (!isRecord(input.observation)) errors.push("observation_missing");
  if (!isRecord(input.mission)) errors.push("mission_missing");
  if (!isRecord(input.frontier)) errors.push("frontier_missing");
  if (!isRecord(input.attention)) errors.push("attention_missing");
  if (!isRecord(input.recommendation)) errors.push("recommendation_missing");
  if (!isRecord(input.authority)) errors.push("authority_missing");
  if (!Array.isArray(input.actors)) errors.push("actors_missing");
  if (!isRecord(input.evidence)) errors.push("evidence_missing");
  if (!isRecord(input.trajectory)) errors.push("trajectory_missing");
  if (!isRecord(input.lineage)) errors.push("lineage_missing");

  const evidence = input.evidence;
  if (evidence && isRecord(evidence)) {
    if (!Array.isArray(evidence.proofCeiling) || evidence.proofCeiling.length === 0) {
      errors.push("proof_ceiling_missing");
    }
    if (!Array.isArray(evidence.notEstablished)) errors.push("not_established_missing");
    if (!Array.isArray(evidence.bindings)) {
      errors.push("evidence_bindings_missing");
    } else {
      errors.push(...validateEvidenceBindings(evidence as unknown as EvidenceView).errors);
    }
    if (Array.isArray(evidence.claims)) {
      for (const claim of evidence.claims) {
        if (!isRecord(claim)) {
          errors.push("claim_not_object");
          continue;
        }
        if (claim.truth === "VERIFIED" && (!Array.isArray(claim.observationRefs) || claim.observationRefs.length === 0) && (!Array.isArray(claim.receiptRefs) || claim.receiptRefs.length === 0)) {
          errors.push(`verified_claim_without_evidence:${String(claim.claimId ?? "unknown")}`);
        }
      }
    }
  }

  const lineage = input.lineage;
  if (lineage && isRecord(lineage)) {
    if (!hasText(lineage.situationId)) errors.push("lineage_situation_id_missing");
    if (!Number.isInteger(lineage.revision) || Number(lineage.revision) < 0) errors.push("lineage_revision_invalid");
  }

  const attention = input.attention;
  if (attention && isRecord(attention)) {
    const attentionStatus = attention.status;
    const humanRequired = attention.humanRequired;
    if (attentionStatus !== "UNKNOWN" && attentionStatus !== "NONE_REQUIRED" && attentionStatus !== "REQUIRED") {
      errors.push("attention_status_invalid");
    } else if (attentionStatus === "UNKNOWN" && humanRequired !== null) {
      errors.push("unknown_attention_must_not_be_false");
    } else if (attentionStatus === "NONE_REQUIRED" && humanRequired !== false) {
      errors.push("none_required_attention_mismatch");
    } else if (attentionStatus === "REQUIRED" && humanRequired !== true) {
      errors.push("required_attention_mismatch");
    }
  }

  const recommendation = input.recommendation;
  if (recommendation && isRecord(recommendation)) {
    const predicted = recommendation.predictedAuthorityDelta;
    if (!isRecord(predicted) || predicted.status === "MEASURED") {
      errors.push("recommendation_authority_delta_must_be_predicted");
    }
    if (!Array.isArray(recommendation.basisRefs)) errors.push("recommendation_basis_refs_missing");
    if (!Array.isArray(recommendation.assumptionRefs)) errors.push("recommendation_assumption_refs_missing");
    if (recommendation.proposedAction !== null && Array.isArray(recommendation.basisRefs) && recommendation.basisRefs.length === 0) {
      errors.push("recommendation_basis_missing");
    }
  }

  const authority = input.authority;
  if (authority && isRecord(authority)) {
    const predicted = authority.predictedAuthorityDelta;
    const actual = authority.actualAuthorityDelta;
    if (!isRecord(predicted) || predicted.status === "MEASURED") errors.push("authority_predicted_delta_invalid");
    if (!isRecord(actual) || actual.status === "PREDICTED") errors.push("authority_actual_delta_invalid");
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}

/** Freeze a validated snapshot; this does not persist it or make it authoritative. */
export function freezeSituationState(state: SituationState): Readonly<SituationState> {
  const result = validateSituationState(state);
  if (!result.ok) throw new Error(`invalid_situation_state:${result.errors.join(",")}`);
  return deepFreeze(state);
}

/** Safe empty read-model fixture for later aggregation tests; no live claims. */
export function createUnknownSituationState(observedAt: string, source = "situation_schema_fixture"): SituationState {
  const freshness: Freshness = { observedAt, validUntil: null, status: "UNKNOWN", source };
  const unknownObservation: SituationObservation = { value: null, truth: "UNKNOWN", freshness, source };
  const unknownDelta: AuthorityDelta = { status: "UNKNOWN", value: null, scope: "none" };
  return {
    schema: SITUATION_STATE_SCHEMA,
    subject: {
      human: { id: null, truth: "UNKNOWN", source },
      node: { id: null, truth: "UNKNOWN", source },
      lens: "NOW",
    },
    observation: freshness,
    mission: { missionId: null, intent: null, desiredState: null, currentState: null, completionContract: null, truth: "UNKNOWN", freshness },
    frontier: { frontierId: null, status: "UNKNOWN", blocker: null, causalExplanation: null, truth: "UNKNOWN", freshness },
    attention: { status: "UNKNOWN", humanRequired: null, severity: "INFORMATION", reason: null, deadline: null, freshness },
    recommendation: { proposedAction: null, expectedStateDelta: null, basisRefs: [], reasonCode: null, assumptionRefs: [], confidence: null, reversibility: "UNKNOWN", predictedAuthorityDelta: unknownDelta, freshness },
    authority: {
      current: { status: "UNKNOWN", leaseId: null, scope: [], expiresAt: null, permissions: [], forbiddenBoundaries: [], freshness },
      requiredForProposal: [],
      requiredForEffect: [],
      predictedAuthorityDelta: unknownDelta,
      actualAuthorityDelta: unknownDelta,
    },
    actors: [],
    resources: { situation: unknownObservation },
    evidence: { claims: [], observations: [], provenance: [], receipts: [], bindings: [], contradictions: [], unresolvedGaps: ["situation_aggregator_not_bound"], proofCeiling: ["SITUATION_SCHEMA_ONLY"], notEstablished: ["runtime_state", "authority", "mission_completion"] },
    trajectory: { availableNextStates: [], simulatedStates: [], predictedConstraints: [], freshness },
    lineage: { situationId: "unknown", revision: 0, previousCommitment: null, eventCursor: null, derivedFrom: [], sourceCommitments: [] },
  };
}
