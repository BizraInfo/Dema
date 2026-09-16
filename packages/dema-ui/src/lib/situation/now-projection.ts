/**
 * Pure human-facing projection of SituationState.
 *
 * This module deliberately has no route, fetch, persistence, authority or
 * renderer side effects. GUI/TUI/API surfaces can consume the same projection
 * without creating competing truth owners.
 */

import type { Freshness, SituationState, TruthStatus } from "./situation-state.ts";

export const NOW_PROJECTION_SCHEMA = "bizra.dema.now_projection.v0.1" as const;

export interface NowField {
  readonly label: string;
  readonly value: string;
  readonly truth: TruthStatus;
  readonly freshness: Freshness;
  readonly source: string;
}

export interface NowProjection {
  readonly schema: typeof NOW_PROJECTION_SCHEMA;
  readonly title: "NOW";
  readonly identity: NowField;
  readonly mission: NowField;
  readonly frontier: NowField;
  readonly attention: NowField;
  readonly authority: NowField;
  readonly resources: NowField;
  readonly proof: NowField;
  readonly next: NowField;
  readonly freshness: Freshness;
  readonly contradictions: readonly string[];
  readonly unresolvedGaps: readonly string[];
  readonly notEstablished: readonly string[];
}

function display(value: unknown, fallback = "UNKNOWN"): string {
  if (typeof value !== "string" || value.trim().length === 0) return fallback;
  return value.replace(/[\r\n\t]+/g, " ").trim().slice(0, 256);
}

function field(label: string, value: unknown, truth: TruthStatus, freshness: Freshness, source: string): NowField {
  return { label, value: display(value), truth, freshness, source };
}

function proofValue(state: SituationState): string {
  const ceiling = state.evidence.proofCeiling.join(", ");
  return ceiling.length > 0 ? ceiling : "UNKNOWN";
}

function resourceSummary(state: SituationState): { value: string; truth: TruthStatus } {
  const observations = Object.values(state.resources);
  const measured = observations.filter((observation) => observation.truth === "MEASURED" || observation.truth === "OBSERVED" || observation.truth === "VERIFIED").length;
  const stale = observations.filter((observation) => observation.truth === "STALE" || observation.freshness.status === "STALE").length;
  const offline = observations.filter((observation) => observation.truth === "OFFLINE").length;
  const unknown = observations.filter((observation) => observation.truth === "UNKNOWN").length;
  const truth: TruthStatus = measured > 0 ? "MEASURED" : "UNKNOWN";
  return { value: `${measured} measured · ${stale} stale · ${offline} offline · ${unknown} unknown`, truth };
}

/** Project only decision-bearing semantics; no field is upgraded here. */
export function projectNow(state: SituationState): NowProjection {
  const subject = state.subject.node.id ?? state.subject.human.id;
  const identityTruth = state.subject.node.id ? state.subject.node.truth : state.subject.human.truth;
  const identitySource = state.subject.node.id ? state.subject.node.source : state.subject.human.source;
  const missionValue = state.mission.missionId ?? state.mission.intent;
  const missionTruth = state.mission.truth;
  const frontierValue = state.frontier.frontierId ?? state.frontier.status;
  const attentionValue = state.attention.status === "REQUIRED"
    ? state.attention.reason ?? "HUMAN ATTENTION REQUIRED"
    : state.attention.status === "NONE_REQUIRED"
      ? "NONE_REQUIRED"
      : "UNKNOWN";
  const authorityValue = state.authority.current.status;
  const nextValue = state.recommendation.proposedAction ?? "UNKNOWN — no recommendation basis";
  const resources = resourceSummary(state);
  return {
    schema: NOW_PROJECTION_SCHEMA,
    title: "NOW",
    identity: field("WHERE", subject, identityTruth, state.observation, identitySource),
    mission: field("MISSION", missionValue, missionTruth, state.mission.freshness, state.mission.freshness.source),
    frontier: field("FRONTIER", frontierValue, state.frontier.truth, state.frontier.freshness, state.frontier.freshness.source),
    attention: field("ATTENTION", attentionValue, state.attention.status === "UNKNOWN" ? "UNKNOWN" : "OBSERVED", state.attention.freshness, state.attention.freshness.source),
    authority: field("AUTHORITY", authorityValue, state.authority.current.status === "UNKNOWN" ? "UNKNOWN" : "OBSERVED", state.authority.current.freshness, state.authority.current.freshness.source),
    resources: field("RESOURCE OBSERVATIONS", resources.value, resources.truth, state.observation, state.observation.source),
    proof: field("PROOF CEILING", proofValue(state), state.evidence.proofCeiling.length > 0 ? "DECLARED" : "UNKNOWN", state.observation, state.observation.source),
    next: field("NEXT", nextValue, state.recommendation.proposedAction ? "DECLARED" : "UNKNOWN", state.recommendation.freshness, state.recommendation.freshness.source),
    freshness: state.observation,
    contradictions: state.evidence.contradictions,
    unresolvedGaps: state.evidence.unresolvedGaps,
    notEstablished: state.evidence.notEstablished,
  };
}

/** Stable plain-text projection for a terminal or log surface. */
export function renderNowText(projection: NowProjection): string {
  const lines = [
    `DEMA · ${projection.title}`,
    "",
    `${projection.identity.label}  ${projection.identity.value} [${projection.identity.truth}]`,
    `${projection.mission.label}  ${projection.mission.value} [${projection.mission.truth}]`,
    `${projection.frontier.label}  ${projection.frontier.value} [${projection.frontier.truth}]`,
    `${projection.attention.label}  ${projection.attention.value} [${projection.attention.truth}]`,
    `${projection.authority.label}  ${projection.authority.value} [${projection.authority.truth}]`,
    `${projection.resources.label}  ${projection.resources.value} [${projection.resources.truth}]`,
    `${projection.proof.label}  ${projection.proof.value} [${projection.proof.truth}]`,
    `${projection.next.label}  ${projection.next.value} [${projection.next.truth}]`,
    `FRESHNESS  ${projection.freshness.status} · ${projection.freshness.observedAt}`,
  ];
  if (projection.contradictions.length > 0) lines.push(`CONTRADICTIONS  ${projection.contradictions.join(", ")}`);
  if (projection.unresolvedGaps.length > 0) lines.push(`OPEN GAPS  ${projection.unresolvedGaps.join(", ")}`);
  if (projection.notEstablished.length > 0) lines.push(`NOT ESTABLISHED  ${projection.notEstablished.join(", ")}`);
  return lines.join("\n");
}
