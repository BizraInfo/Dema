/**
 * Pure read-only assembly for the DEMA SituationState read model.
 *
 * Adapters hand this module untrusted observations. It normalizes and
 * validates those observations, preserves staleness/contradictions, and
 * returns an immutable projection. It never performs I/O, persists state,
 * invokes a model/tool, creates receipts, or grants authority.
 */

import {
  createUnknownSituationState,
  freezeSituationState,
  type ActorSnapshot,
  type AttentionSeverity,
  type EvidenceObservation,
  type Freshness,
  type SituationObservation,
  type SituationState,
  type TruthStatus,
} from "./situation-state.ts";
import { attachEvidenceBindings } from "./evidence-binding.ts";

const TRUTH_STATUSES = new Set<TruthStatus>([
  "UNKNOWN",
  "DESIGNED",
  "DECLARED",
  "AVAILABLE",
  "ACTIVE",
  "OBSERVED",
  "MEASURED",
  "VERIFIED",
  "BLOCKED",
  "OFFLINE",
  "STALE",
  "REFUSED",
  "PREVIEW_ONLY",
]);

const ATTENTION_SEVERITIES = new Set<AttentionSeverity>([
  "INFORMATION",
  "CHANGE",
  "DECISION",
  "BLOCKER",
  "BOUNDARY",
]);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/;
const RAW_STATUSES = new Set(["MEASURED", "UNAVAILABLE", "UNKNOWN"]);

export interface RawSourceObservation {
  readonly value?: unknown;
  readonly status?: unknown;
  readonly truth?: unknown;
  readonly source?: unknown;
  readonly observedAt?: unknown;
  readonly measured_at?: unknown;
  readonly validUntil?: unknown;
  readonly valid_until?: unknown;
  readonly staleAfterMs?: unknown;
  readonly stale_after_ms?: unknown;
  readonly reason?: unknown;
  readonly evidenceRefs?: unknown;
  readonly receiptRefs?: unknown;
}

export interface SituationInputBundle {
  readonly source?: unknown;
  readonly observedAt?: unknown;
  readonly observations?: unknown;
  readonly resources?: unknown;
  readonly subject?: unknown;
  readonly attention?: unknown;
  readonly recommendation?: unknown;
  readonly actors?: unknown;
  readonly contradictions?: unknown;
  readonly lineage?: unknown;
}

export interface AggregationOptions {
  readonly observedAt: string;
  readonly source?: string;
}

interface NormalizedObservation {
  readonly observation: SituationObservation;
  readonly error?: string;
}

interface NormalizedBundle {
  readonly resources: Record<string, SituationObservation>;
  readonly evidenceObservations: EvidenceObservation[];
  readonly provenance: string[];
  readonly contradictions: string[];
  readonly unresolvedGaps: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validIso(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE.test(value) && Number.isFinite(Date.parse(value));
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function validTruth(value: unknown): value is TruthStatus {
  return typeof value === "string" && TRUTH_STATUSES.has(value as TruthStatus);
}

function emptyFreshness(observedAt: string, source: string): Freshness {
  return { observedAt, validUntil: null, status: "UNKNOWN", source };
}

function unknownObservation(observedAt: string, source: string, reason: string): NormalizedObservation {
  return {
    observation: {
      value: null,
      truth: "UNKNOWN",
      freshness: emptyFreshness(observedAt, source),
      source,
      reason,
    },
    error: reason,
  };
}

function mapRawTruth(raw: Record<string, unknown>): TruthStatus | null {
  if (raw.truth !== undefined) return validTruth(raw.truth) ? raw.truth : null;
  if (raw.status === "MEASURED") return "MEASURED";
  if (raw.status === "UNAVAILABLE") return "OFFLINE";
  if (raw.status === "UNKNOWN") return "UNKNOWN";
  return null;
}

function normalizeObservation(
  raw: unknown,
  aggregateAt: string,
  fallbackSource: string,
  key: string,
): NormalizedObservation {
  if (!isRecord(raw)) return unknownObservation(aggregateAt, fallbackSource, `source_invalid:${key}`);

  const source = text(raw.source) ?? fallbackSource;
  const observedAt = raw.observedAt ?? raw.measured_at;
  const truth = mapRawTruth(raw);
  const rawStatus = raw.status;
  const hasValue = Object.prototype.hasOwnProperty.call(raw, "value");
  const rawValidUntil = raw.validUntil ?? raw.valid_until;
  const rawStaleAfterMs = raw.staleAfterMs ?? raw.stale_after_ms;
  const validUntil = rawValidUntil === null || rawValidUntil === undefined ? null : rawValidUntil;
  const staleAfterMs = rawStaleAfterMs === undefined || rawStaleAfterMs === null ? null : rawStaleAfterMs;

  if (rawStatus !== undefined && !RAW_STATUSES.has(String(rawStatus)) && raw.truth === undefined) {
    return unknownObservation(aggregateAt, source, `source_status_invalid:${key}`);
  }
  if (!truth || !validIso(observedAt)) return unknownObservation(aggregateAt, source, `source_observation_invalid:${key}`);
  if ((!hasValue || raw.value === null) && truth !== "UNKNOWN" && truth !== "OFFLINE") {
    return unknownObservation(aggregateAt, source, `source_value_missing:${key}`);
  }
  if (validUntil !== null && !validIso(validUntil)) {
    return unknownObservation(aggregateAt, source, `source_valid_until_invalid:${key}`);
  }
  if (staleAfterMs !== null && (!finiteNumber(staleAfterMs) || staleAfterMs <= 0 || staleAfterMs > 31_536_000_000)) {
    return unknownObservation(aggregateAt, source, `source_stale_after_invalid:${key}`);
  }

  const evidenceRefs = Array.isArray(raw.evidenceRefs) ? raw.evidenceRefs.filter((value): value is string => typeof value === "string" && value.length > 0) : [];
  const receiptRefs = Array.isArray(raw.receiptRefs) ? raw.receiptRefs.filter((value): value is string => typeof value === "string" && value.length > 0) : [];
  if (truth === "VERIFIED" && evidenceRefs.length === 0 && receiptRefs.length === 0) {
    return unknownObservation(aggregateAt, source, `verified_source_without_reference:${key}`);
  }

  const computedValidUntil = validUntil ?? (staleAfterMs === null ? null : new Date(Date.parse(observedAt) + staleAfterMs).toISOString());
  let freshnessStatus: Freshness["status"] = "UNKNOWN";
  if (truth !== "UNKNOWN" && truth !== "OFFLINE") {
    freshnessStatus = computedValidUntil === null || Date.parse(aggregateAt) <= Date.parse(computedValidUntil) ? "CURRENT" : "STALE";
  }
  const normalizedTruth = freshnessStatus === "STALE" && truth !== "UNKNOWN" && truth !== "OFFLINE" ? "STALE" : truth;
  const reason = typeof raw.reason === "string" && raw.reason.trim().length > 0 ? raw.reason.trim() : undefined;
  return {
    observation: {
      value: truth === "UNKNOWN" || truth === "OFFLINE" ? null : raw.value,
      truth: normalizedTruth,
      freshness: { observedAt, validUntil: computedValidUntil, status: freshnessStatus, source },
      source,
      ...(reason ? { reason } : {}),
    },
  };
}

function normalizeMap(raw: unknown, aggregateAt: string, fallbackSource: string): {
  values: Record<string, SituationObservation>;
  evidence: EvidenceObservation[];
  provenance: string[];
  gaps: string[];
} {
  if (!isRecord(raw)) {
    const unknown = unknownObservation(aggregateAt, fallbackSource, "source_map_missing");
    return {
      values: { situation: unknown.observation },
      evidence: [],
      provenance: [fallbackSource],
      gaps: [unknown.error ?? "source_map_missing"],
    };
  }

  const values: Record<string, SituationObservation> = {};
  const evidence: EvidenceObservation[] = [];
  const provenance: string[] = [];
  const gaps: string[] = [];
  for (const [key, rawValue] of Object.entries(raw)) {
    const normalized = normalizeObservation(rawValue, aggregateAt, fallbackSource, key);
    values[key] = normalized.observation;
    provenance.push(normalized.observation.source);
    if (normalized.error) gaps.push(normalized.error);
    evidence.push({
      observationId: `observation:${key}`,
      source: normalized.observation.source,
      truth: normalized.observation.truth,
      freshness: normalized.observation.freshness,
      provenance: [normalized.observation.source],
    });
  }
  if (Object.keys(values).length === 0) {
    const unknown = unknownObservation(aggregateAt, fallbackSource, "source_map_empty");
    values.situation = unknown.observation;
    gaps.push(unknown.error ?? "source_map_empty");
  }
  return { values, evidence, provenance: unique(provenance), gaps: unique(gaps) };
}

function normalizeSubject(raw: unknown, source: string): SituationState["subject"] {
  const unknown = { id: null, truth: "UNKNOWN" as const, source };
  if (!isRecord(raw)) return { human: unknown, node: unknown, lens: "NOW" };
  const identity = (value: unknown) => {
    if (!isRecord(value)) return unknown;
    const id = text(value.id);
    const truth = validTruth(value.truth) ? value.truth : "UNKNOWN";
    const identitySource = text(value.source) ?? source;
    return { id, truth, source: identitySource };
  };
  const lens = text(raw.lens) ?? "NOW";
  return { human: identity(raw.human), node: identity(raw.node), lens };
}

function unknownAttention(aggregateAt: string, source: string): SituationState["attention"] {
  return {
    status: "UNKNOWN",
    humanRequired: null,
    severity: "INFORMATION",
    reason: null,
    deadline: null,
    freshness: emptyFreshness(aggregateAt, source),
  };
}

function normalizeAttention(raw: unknown, aggregateAt: string, source: string): { value: SituationState["attention"]; gap?: string } {
  if (!isRecord(raw)) return { value: unknownAttention(aggregateAt, source), gap: "attention_source_not_bound" };
  const observation = normalizeObservation(raw.observation ?? raw, aggregateAt, source, "attention");
  const humanRequired = raw.humanRequired;
  const severity = raw.severity;
  if (typeof humanRequired !== "boolean" || typeof severity !== "string" || !ATTENTION_SEVERITIES.has(severity as AttentionSeverity) || observation.observation.truth === "UNKNOWN" || observation.observation.truth === "OFFLINE") {
    return { value: unknownAttention(aggregateAt, source), gap: observation.error ?? "attention_source_invalid" };
  }
  return {
    value: {
      status: humanRequired ? "REQUIRED" : "NONE_REQUIRED",
      humanRequired,
      severity: severity as AttentionSeverity,
      reason: typeof raw.reason === "string" ? raw.reason : null,
      deadline: validIso(raw.deadline) ? raw.deadline : null,
      freshness: observation.observation.freshness,
    },
  };
}

function normalizeActors(raw: unknown, aggregateAt: string, source: string): { values: ActorSnapshot[]; gaps: string[]; provenance: string[] } {
  if (!Array.isArray(raw)) return { values: [], gaps: ["actor_source_not_bound"], provenance: [] };
  const values: ActorSnapshot[] = [];
  const gaps: string[] = [];
  const provenance: string[] = [];
  for (const candidate of raw) {
    if (!isRecord(candidate) || !text(candidate.actorId) || !text(candidate.role) || !isRecord(candidate.reality)) {
      gaps.push("actor_source_invalid");
      continue;
    }
    const reality = candidate.reality;
    const existence = reality.existence;
    const availability = reality.availability;
    const activity = reality.activity;
    const evidenceState = reality.evidenceState;
    if (!["DESIGNED", "DECLARED", "INSTANTIATED"].includes(String(existence)) || !["UNKNOWN", "AVAILABLE", "OFFLINE"].includes(String(availability)) || !["IDLE", "ACTIVE", "BLOCKED"].includes(String(activity)) || !["UNOBSERVED", "MEASURED", "VERIFIED", "STALE"].includes(String(evidenceState))) {
      gaps.push("actor_reality_invalid");
      continue;
    }
    const observation = normalizeObservation(candidate.observation, aggregateAt, source, `actor:${candidate.actorId}`);
    if (observation.error) {
      gaps.push(observation.error);
      continue;
    }
    const kind = candidate.kind;
    if (!["DEMA", "PAT", "SAT", "SYSTEM"].includes(String(kind))) {
      gaps.push("actor_kind_invalid");
      continue;
    }
    const evidenceRefs = Array.isArray(candidate.evidenceRefs) ? candidate.evidenceRefs.filter((value): value is string => typeof value === "string" && value.length > 0) : [];
    values.push({
      actorId: String(candidate.actorId),
      kind: kind as ActorSnapshot["kind"],
      role: String(candidate.role),
      reality: { existence: existence as ActorSnapshot["reality"]["existence"], availability: availability as ActorSnapshot["reality"]["availability"], activity: activity as ActorSnapshot["reality"]["activity"], evidenceState: evidenceState as ActorSnapshot["reality"]["evidenceState"] },
      observation: observation.observation.freshness,
      evidenceRefs,
    });
    provenance.push(observation.observation.source);
  }
  return { values, gaps: unique(gaps), provenance: unique(provenance) };
}

function normalizeContradictions(raw: unknown): string[] {
  return Array.isArray(raw) ? unique(raw.filter((value): value is string => typeof value === "string")) : [];
}

function mergeObservationMaps(input: SituationInputBundle, aggregateAt: string, source: string): NormalizedBundle {
  const rawMaps = [input.observations, input.resources].filter((value): value is Record<string, unknown> => isRecord(value));
  if (rawMaps.length === 0) {
    const empty = normalizeMap(null, aggregateAt, source);
    return { resources: empty.values, evidenceObservations: empty.evidence, provenance: empty.provenance, contradictions: [], unresolvedGaps: empty.gaps };
  }

  const byKey = new Map<string, NormalizedObservation[]>();
  for (const map of rawMaps) {
    for (const [key, value] of Object.entries(map)) {
      const normalized = normalizeObservation(value, aggregateAt, source, key);
      const current = byKey.get(key) ?? [];
      current.push(normalized);
      byKey.set(key, current);
    }
  }

  const resources: Record<string, SituationObservation> = {};
  const evidenceObservations: EvidenceObservation[] = [];
  const provenance: string[] = [];
  const unresolvedGaps: string[] = [];
  const contradictions: string[] = normalizeContradictions(input.contradictions);
  for (const [key, candidates] of byKey.entries()) {
    const first = candidates[0];
    const differing = candidates.slice(1).some((candidate) => JSON.stringify(candidate.observation.value) !== JSON.stringify(first.observation.value) || candidate.observation.truth !== first.observation.truth);
    const selected = differing
      ? unknownObservation(aggregateAt, source, `source_conflict:${key}`)
      : first;
    if (differing) contradictions.push(`source_conflict:${key}`);
    resources[key] = selected.observation;
    if (selected.error) unresolvedGaps.push(selected.error);
    for (const candidate of candidates) {
      provenance.push(candidate.observation.source);
      evidenceObservations.push({
        observationId: `observation:${key}:${candidate.observation.source}`,
        source: candidate.observation.source,
        truth: candidate.observation.truth,
        freshness: candidate.observation.freshness,
        provenance: [candidate.observation.source],
      });
      if (candidate.error) unresolvedGaps.push(candidate.error);
    }
  }
  if (Object.keys(resources).length === 0) {
    const empty = unknownObservation(aggregateAt, source, "source_map_empty");
    resources.situation = empty.observation;
    unresolvedGaps.push(empty.error ?? "source_map_empty");
  }
  return { resources, evidenceObservations, provenance: unique(provenance), contradictions: unique(contradictions), unresolvedGaps: unique(unresolvedGaps) };
}

/** Convert the existing redacted node-resources response into read-only inputs. */
export function adaptNodeResourcesResponse(raw: unknown): SituationInputBundle {
  if (!isRecord(raw)) return { source: "node_resources_response", resources: null };
  if (raw.schema !== "bizra.dema.node_resources.local.v0.1") {
    return {
      source: "node_resources_response",
      observedAt: raw.measured_at,
      resources: {
        node_resources: {
          status: "UNKNOWN",
          value: null,
          source: "node_resources_response",
          measured_at: raw.measured_at,
          stale_after_ms: 5_000,
        },
      },
    };
  }
  const resources: Record<string, unknown> = {};
  const system = isRecord(raw.system) ? raw.system : {};
  for (const [key, value] of Object.entries(system)) resources[`system.${key}`] = value;
  for (const key of ["storage", "gpu", "models", "receipts"]) {
    if (key in raw) resources[`node.${key}`] = raw[key];
  }
  if (isRecord(raw.node0_boundary)) {
    for (const [key, value] of Object.entries(raw.node0_boundary)) resources[`node0_boundary.${key}`] = value;
  }
  return {
    source: "node_resources_response",
    observedAt: raw.measured_at,
    resources,
  };
}

/** Assemble one immutable perception snapshot from already-observed inputs. */
export function aggregateSituationState(rawInput: unknown, options: AggregationOptions = { observedAt: new Date().toISOString() }): Readonly<SituationState> {
  const aggregationTimeValid = validIso(options?.observedAt);
  const aggregateAt = aggregationTimeValid ? options.observedAt : new Date().toISOString();
  const input = isRecord(rawInput) ? rawInput as SituationInputBundle : {};
  const source = text(options?.source) ?? text(input.source) ?? "situation_aggregator";
  const base = createUnknownSituationState(aggregateAt, source);
  const merged = mergeObservationMaps(input, aggregateAt, source);
  const attention = normalizeAttention(input.attention, aggregateAt, source);
  const actors = normalizeActors(input.actors, aggregateAt, source);
  const gaps = unique([
    ...merged.unresolvedGaps,
    ...(aggregationTimeValid ? [] : ["aggregation_timestamp_invalid"]),
    attention.gap ?? "",
    ...actors.gaps,
    ...(input.observations || input.resources ? [] : ["read_only_sources_not_bound"]),
    "mission_source_not_bound",
    "authority_source_not_bound",
    "recommendation_not_generated",
  ]);
  const contradictions = merged.contradictions;
  const provenance = unique([source, ...merged.provenance, ...actors.provenance]);
  const evidenceObservations = [...merged.evidenceObservations];
  const state: SituationState = {
    ...base,
    subject: normalizeSubject(input.subject, source),
    observation: { observedAt: aggregateAt, validUntil: null, status: "CURRENT", source },
    attention: attention.value,
    actors: actors.values,
    resources: merged.resources,
    evidence: {
      ...base.evidence,
      observations: evidenceObservations,
      provenance,
      contradictions,
      unresolvedGaps: gaps,
      proofCeiling: ["SITUATION_AGGREGATOR_READ_ONLY"],
      notEstablished: ["mission_completion", "authority", "effect", "gui_or_tui_projection"],
    },
    lineage: {
      ...base.lineage,
      situationId: text(isRecord(input.lineage) ? input.lineage.situationId : null) ?? "uncommitted",
      revision: isRecord(input.lineage) && Number.isInteger(input.lineage.revision) && Number(input.lineage.revision) >= 0 ? Number(input.lineage.revision) : 0,
      derivedFrom: provenance,
    },
  };
  return freezeSituationState(attachEvidenceBindings(state));
}

export const __internal = { normalizeObservation, validIso };
