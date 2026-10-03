// Founder-useful local closure helpers. Read models are derived; candidate
// persistence is confined to the campaign sandbox supplied by the caller.
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import * as nodeFs from "node:fs";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { buildNodeResourcesResponse, TelemetryExecError } from "../../../packages/dema-ui/src/lib/telemetry/node-resources-core.ts";
import { adaptNodeResourcesResponse, aggregateSituationState } from "../../../packages/dema-ui/src/lib/situation/situation-aggregator.ts";
import { projectNow, renderNowText } from "../../../packages/dema-ui/src/lib/situation/now-projection.ts";
import { freezeSituationState } from "../../../packages/dema-ui/src/lib/situation/situation-state.ts";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";
import { buildFounderPatHarnessCandidate, verifyFounderPatHarnessCandidate, FOUNDER_PAT_SEAT_ROLE_CONTRACTS } from "./founder-pat-harness.js";
import { buildLocalLlmProviderRoute } from "./local-llm-provider-router.js";
import { invokeDemaTalkLive } from "./dema-talk-loop-live.js";
import {
  NODE0_FATE_STAGED_EFFECT_REQUIRED_PHRASE,
  startFateStagedEffect,
  resumeFateStagedEffect,
  verifyNode0FateStagedEffect,
} from "./node0-fate-staged-effect.js";

export const FOUNDER_PAT_SEATS = Object.freeze([
  ["Archivist", "recover provenance and prior decisions"],
  ["Extractor", "extract the smallest actionable facts"],
  ["Cartographer", "map dependencies and boundaries"],
  ["Scout", "look for a safe next frontier"],
  ["Engineer", "identify the smallest implementation seam"],
  ["Builder", "draft a bounded implementation plan"],
  ["Scribe", "record the evidence and uncertainty"],
]);

const DEFAULT_RUNTIME_MISSION = "/home/bizra-operating-system/.dema/node0/runtime-mission";
export const SITUATION_COMMITMENT_SCHEMA = "bizra.dema.situation_commitment.v0.2";
const VOLATILE_KEYS = new Set(["observedAt", "validUntil", "observed_at", "valid_until", "measured_at", "generatedAt", "generated_at", "renderedAt", "rendered_at"]);
const NON_MATERIAL_RESOURCE_TELEMETRY_KEYS = new Set([
  "freeGB", "usedGB", "usedPct", "availGB", "1m", "5m", "15m", "uptimeHours", "memUsedMB", "utilPct",
]);

function safeJson(file) {
  try { return JSON.parse(readFileSync(file, "utf8")); } catch { return null; }
}

function writeJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function stableWithoutReadTimes(value, path = []) {
  if (Array.isArray(value)) {
    const normalized = value.map((child) => stableWithoutReadTimes(child, path));
    const resourcesIndex = path.indexOf("resources");
    const pathKey = resourcesIndex === -1 ? path.join("/") : path.slice(resourcesIndex).join("/");
    // Provider listing order is not decision-bearing. Canonicalize the set
    // without hiding changes to model identity or size.
    if (pathKey === "resources/node.models/value" || pathKey === "resources/node.storage/value") {
      return normalized.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
    }
    return normalized;
  }
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (VOLATILE_KEYS.has(key)) continue;
    const inResourceTelemetry = path.includes("resources") && path.at(-1) === "value";
    if (inResourceTelemetry && NON_MATERIAL_RESOURCE_TELEMETRY_KEYS.has(key)) continue;
    out[key] = stableWithoutReadTimes(child, [...path, key]);
  }
  return out;
}

export function projectSituationForCommitment(state) {
  return stableWithoutReadTimes(state);
}

export function situationCommitment(state) {
  return sha256CanonicalJsonV1(projectSituationForCommitment(state));
}

function realAdapters() {
  const exec = {
    run(command, args) {
      try {
        return execFileSync(command, args, { encoding: "utf8", timeout: 4000, maxBuffer: 65536, shell: false });
      } catch (error) {
        if (error?.code === "ENOENT") throw new TelemetryExecError("command_not_found");
        if (error?.code === "ETIMEDOUT" || error?.signal === "SIGTERM") throw new TelemetryExecError("command_timeout");
        throw new TelemetryExecError("command_nonzero_exit");
      }
    },
  };
  return {
    os: {
      cpuCount: () => os.cpus().length,
      cpuModel: () => os.cpus()[0]?.model ?? "unknown",
      totalMemBytes: () => os.totalmem(),
      freeMemBytes: () => os.freemem(),
      loadavg: () => os.loadavg(),
      uptimeSeconds: () => os.uptime(),
      platform: () => os.platform(),
      arch: () => os.arch(),
    },
    exec,
    fs: { existsSync, readdirSync },
    receiptsPath: path.resolve(process.cwd(), "docs/receipts"),
  };
}

function freshness(observedAt, source, maxAgeMs = 300000) {
  const parsed = Date.parse(observedAt ?? "");
  const valid = Number.isFinite(parsed);
  const stale = !valid || Date.now() - parsed > maxAgeMs;
  return { observedAt: valid ? new Date(parsed).toISOString() : new Date().toISOString(), validUntil: null, status: stale ? "STALE" : "CURRENT", source };
}

function candidateSandboxRoot() {
  if (process.env.DEMA_FOUNDER_SANDBOX) return process.env.DEMA_FOUNDER_SANDBOX;
  if (process.env.DEMA_FOUNDER_CAMPAIGN_ROOT) return path.join(process.env.DEMA_FOUNDER_CAMPAIGN_ROOT, "sandbox", "founder-node");
  return null;
}

function missionOverlay() {
  // Candidate mission state is opt-in. A clean founder entry reads the
  // persisted Node0 runtime mission, never a campaign fixture.
  // An explicit runtime root always wins, including candidate qualification.
  // This keeps the lawful runtime owner ahead of the candidate sandbox.
  const root = process.env.DEMA_RUNTIME_MISSION_ROOT || (process.env.DEMA_FOUNDER_CLOSURE === "1" ? candidateSandboxRoot() : DEFAULT_RUNTIME_MISSION);
  if (!root) return null;
  const candidate = safeJson(path.join(root, "mission.json"));
  if (candidate?.contract?.mission_id) {
    const f = freshness(candidate.updated_at, "founder_candidate_mission");
    const frontier = candidate.frontier && typeof candidate.frontier === "object" ? candidate.frontier : {};
    const frontierStatus = ["OPEN", "READY", "BLOCKED", "WAITING", "CLOSED"].includes(frontier.status)
      ? frontier.status
      : candidate.state === "COMPLETED" || candidate.state === "SECOND_COMPLETED" ? "CLOSED" : "OPEN";
    return { source: "founder_candidate_mission", missionId: candidate.contract.mission_id, intent: candidate.contract.purpose, desiredState: candidate.contract.desired_state ?? candidate.contract.completion_conditions?.[0] ?? null, currentState: candidate.current_state ?? candidate.state ?? "PROPOSED", completionContract: JSON.stringify(candidate.contract.acceptance_criteria ?? []), truth: "OBSERVED", freshness: f, frontierId: frontier.id ?? `${candidate.contract.mission_id}/verification`, frontierStatus, blocker: frontier.blocker ?? candidate.blocker ?? null, causalExplanation: frontier.causal_explanation ?? (typeof candidate.frontier === "string" ? candidate.frontier : null), nextTransition: frontier.next_transition ?? candidate.next_transition ?? null };
  }
  const state = safeJson(path.join(root, "state.json"));
  const observation = safeJson(path.join(root, "observation.json"));
  const contract = state?.contract_fields;
  const id = contract?.mission_id;
  if (!id) return null;
  const f = freshness(observation?.observed_at, "node0_runtime_mission");
  const rejected = observation?.independently_rederived_verdict === "REJECT";
  return { source: "node0_runtime_mission", missionId: id, intent: contract.purpose ?? null, desiredState: contract.completion_conditions?.[0] ?? null, currentState: state?.supervisor_state?.stage ?? null, completionContract: JSON.stringify(contract.acceptance_criteria ?? []), truth: f.status === "STALE" ? "STALE" : "OBSERVED", freshness: f, frontierId: `${id}/independent-verification`, frontierStatus: rejected ? "BLOCKED" : "OPEN", blocker: rejected ? "independent_verification_reject" : null, causalExplanation: rejected ? "Persisted observation rejects the executor self-claim." : "Persisted mission state has no current closure proof." };
}

function authorityOverlay() {
  const runtimeRoot = process.env.DEMA_RUNTIME_MISSION_ROOT || (process.env.DEMA_FOUNDER_CLOSURE === "1" ? null : DEFAULT_RUNTIME_MISSION);
  if (runtimeRoot) {
    const runtime = safeJson(path.join(runtimeRoot, "state.json"));
    const runtimeContract = runtime?.contract_fields;
    if (!runtimeContract?.mission_id || !runtimeContract.authority_ceiling) return null;
    const source = "node0_runtime_mission_authority";
    const f = freshness(safeJson(path.join(runtimeRoot, "observation.json"))?.observed_at, source, 300000);
    return {
      status: f.status === "STALE" ? "EXPIRED" : "BOUNDED",
      leaseId: runtimeContract.mission_id,
      scope: [runtimeContract.scope ?? runtimeContract.authority_ceiling],
      expiresAt: null,
      permissions: [runtimeContract.authority_ceiling],
      forbiddenBoundaries: runtimeContract.prohibited_outcomes ?? [],
      freshness: f,
      actualAuthorityDelta: { status: "MEASURED", value: runtime?.supervisor_state?.authority_delta ?? 0, scope: source },
    };
  }
  if (process.env.DEMA_FOUNDER_CLOSURE === "1") {
    const root = candidateSandboxRoot();
    const lease = root ? safeJson(path.join(root, "authority.json")) : null;
    if (!lease || lease.authority_delta !== 0 || typeof lease.lease_id !== "string" || !Array.isArray(lease.scope)) return null;
    const source = "founder_candidate_authority";
    const f = freshness(lease.observed_at, source);
    return {
      status: f.status === "STALE" ? "EXPIRED" : "BOUNDED",
      leaseId: lease.lease_id,
      scope: lease.scope,
      expiresAt: typeof lease.expires_at === "string" ? lease.expires_at : null,
      permissions: Array.isArray(lease.permissions) ? lease.permissions : [],
      forbiddenBoundaries: Array.isArray(lease.forbidden) ? lease.forbidden : [],
      freshness: f,
      actualAuthorityDelta: { status: "NONE", value: 0, scope: source },
    };
  }
  const root = process.env.DEMA_FOUNDER_CAMPAIGN_ROOT;
  const contract = process.env.DEMA_FOUNDER_CLOSURE === "1" && root
    ? safeJson(path.join(root, "campaign-contract.json"))
    : null;
  if (!contract?.authority_lease) {
    const runtime = safeJson(path.join(DEFAULT_RUNTIME_MISSION, "state.json"));
    const runtimeContract = runtime?.contract_fields;
    if (!runtimeContract?.mission_id || !runtimeContract.authority_ceiling) {
      // No authoritative lease source is currently installed. Preserve the
      // UNKNOWN base projection instead of deriving authority from login or
      // runtime health.
      return null;
    }
    const source = "node0_runtime_mission_authority";
    const f = freshness(safeJson(path.join(DEFAULT_RUNTIME_MISSION, "observation.json"))?.observed_at, source, 300000);
    return {
      status: "BOUNDED",
      leaseId: runtimeContract.mission_id,
      scope: [runtimeContract.scope ?? runtimeContract.authority_ceiling],
      expiresAt: null,
      permissions: [runtimeContract.authority_ceiling],
      forbiddenBoundaries: runtimeContract.prohibited_outcomes ?? [],
      freshness: f,
      actualAuthorityDelta: { status: "MEASURED", value: runtime?.supervisor_state?.authority_delta ?? 0, scope: source },
    };
  }
  const source = "candidate_campaign_authority_lease";
  const f = freshness(new Date().toISOString(), source, 3600000);
  return { status: "BOUNDED", leaseId: contract.campaign_id ?? null, scope: ["candidate_sandbox_effect", "candidate_local_model_calls"], expiresAt: null, permissions: contract.authority_lease.allowed ?? [], forbiddenBoundaries: contract.authority_lease.forbidden ?? [], freshness: f, actualAuthorityDelta: { status: "NONE", value: 0, scope: "candidate campaign" } };
}

function actorOverlay(root) {
  const run = safeJson(path.join(root, "pat-run.json"));
  return FOUNDER_PAT_SEATS.map(([role], index) => {
    const roleId = FOUNDER_PAT_SEAT_ROLE_CONTRACTS[index]?.role_id;
    const result = run?.seat_receipts?.find((seat) => seat.role_id === roleId) ?? run?.seats?.find((seat) => seat.role === role);
    const candidateHarness = run?.mode === "candidate_harness";
    const reality = result ? candidateHarness ? { existence: "DECLARED", availability: "UNKNOWN", activity: "IDLE", evidenceState: "MEASURED" } : { existence: "INSTANTIATED", availability: result.status === "completed" ? "AVAILABLE" : "OFFLINE", activity: result.status === "completed" ? "IDLE" : "BLOCKED", evidenceState: "MEASURED" } : { existence: "DECLARED", availability: "UNKNOWN", activity: "IDLE", evidenceState: "UNOBSERVED" };
    const evidenceRefs = result ? [`pat:${role}:invocation`, ...(result.trace?.trace_id ? [result.trace.trace_id] : [])] : [];
    return { actorId: `pat-${role.toLowerCase()}`, kind: "PAT", role, reality, observation: freshness(run?.completed_at ?? new Date().toISOString(), "founder_pat_run"), evidenceRefs };
  });
}

function enrichState(base, mission, authority, actors) {
  const recommendation = mission?.nextTransition
    ? { ...base.recommendation, proposedAction: mission.nextTransition, expectedStateDelta: "candidate frontier advances only after independent verification", basisRefs: [`mission:${mission.missionId}`, mission.source], reasonCode: "persisted_frontier_next_transition", reversibility: "REVERSIBLE", predictedAuthorityDelta: { status: "NONE", value: 0, scope: "candidate_sandbox_only" }, freshness: mission.freshness }
    : base.recommendation;

  const updated = { ...base, mission: mission ? { missionId: mission.missionId, intent: mission.intent, desiredState: mission.desiredState, currentState: mission.currentState, completionContract: mission.completionContract, truth: mission.truth, freshness: mission.freshness } : base.mission, frontier: mission ? { frontierId: mission.frontierId, status: mission.frontierStatus, blocker: mission.blocker, causalExplanation: mission.causalExplanation, truth: mission.truth, freshness: mission.freshness } : base.frontier, actors };
  updated.recommendation = recommendation;
  if (authority) updated.authority = { ...base.authority, current: { ...base.authority.current, ...authority }, actualAuthorityDelta: authority.actualAuthorityDelta };
  const authoritySource = authority?.freshness?.source ?? null;
  const unresolvedGaps = updated.evidence.unresolvedGaps.filter((gap) =>
    !(mission && (gap === "mission_source_not_bound" || gap === "frontier_source_not_bound")) &&
    !(authoritySource && gap === "authority_source_not_bound"),
  );
  const evidence = { ...updated.evidence, unresolvedGaps, provenance: [...new Set([...updated.evidence.provenance, ...(mission ? [mission.source] : []), ...(authoritySource ? [authoritySource] : [])])], proofCeiling: [...new Set([...updated.evidence.proofCeiling, ...(mission ? ["PERSISTED_MISSION_OBSERVATION"] : []), ...(authoritySource === "candidate_campaign_authority_lease" ? ["CANDIDATE_LEASE_ONLY"] : authoritySource ? ["PERSISTED_AUTHORITY_OBSERVATION"] : [])])], notEstablished: [...new Set([...updated.evidence.notEstablished, "installed_runtime_promotion", "terminal_wizard_active", "public_deployment"]) ] };
  if (mission) {
    const obs = { observationId: "observation:mission", source: mission.source, truth: mission.truth, freshness: mission.freshness, provenance: [mission.source] };
    const claim = { claimId: "claim:mission:observed", text: `Mission ${mission.missionId} is present in the persisted mission source.`, truth: mission.truth, scope: "/mission/currentState", observationRefs: [obs.observationId], receiptRefs: [], freshness: mission.freshness };
    const frontierObs = { observationId: "observation:frontier", source: mission.source, truth: mission.truth, freshness: mission.freshness, provenance: [mission.source] };
    const frontierClaim = { claimId: "claim:frontier:observed", text: `Frontier ${mission.frontierId} is read from the persisted mission source.`, truth: mission.truth, scope: "/frontier/status", observationRefs: [frontierObs.observationId], receiptRefs: [], freshness: mission.freshness };
    evidence.observations = [...evidence.observations, obs, frontierObs];
    evidence.claims = [...evidence.claims, claim, frontierClaim];
  }
  if (authority) {
    const authorityObs = { observationId: "observation:authority", source: authority.freshness.source, truth: authority.status === "EXPIRED" ? "STALE" : "OBSERVED", freshness: authority.freshness, provenance: [authority.freshness.source] };
    const authorityClaim = { claimId: "claim:authority:observed", text: `Authority lease ${authority.leaseId ?? "unknown"} is read from the persisted authority source.`, truth: authorityObs.truth, scope: "/authority/current/status", observationRefs: [authorityObs.observationId], receiptRefs: [], freshness: authority.freshness };
    evidence.observations = [...evidence.observations, authorityObs];
    evidence.claims = [...evidence.claims, authorityClaim];
  }
  const state = { ...updated, evidence };
  return freezeSituationState(state);
}

export function readFounderSituation() {
  const resources = buildNodeResourcesResponse(realAdapters());
  const observedAt = resources.measured_at;
  const base = aggregateSituationState(adaptNodeResourcesResponse(resources), { observedAt, source: "founder_situation_read" });
  const sandbox = candidateSandboxRoot() || path.join(process.env.DEMA_FOUNDER_CAMPAIGN_ROOT || path.resolve(process.cwd(), ".campaign-founder"), "sandbox", "founder-node");
  const state = enrichState(base, missionOverlay(), authorityOverlay(), actorOverlay(sandbox));
  const commitment = situationCommitment(state);
  return Object.freeze({ schema: "bizra.dema.founder_situation.v0.1", commitment, situation: state, now: projectNow(state) });
}

export function renderFounderNow({ json = false } = {}) {
  const envelope = readFounderSituation();
  if (json) return JSON.stringify({ ...envelope, state_commitment: envelope.commitment }, null, 2);
  return `${renderNowText(envelope.now)}\nSTATE COMMITMENT  ${envelope.commitment}\nPAT TEAM  ${envelope.situation.actors.map((actor) => `${actor.role}:${actor.reality.evidenceState}`).join(" · ")}`;
}

const UNSUPPORTED_ENTITY_PATTERN = /\b(?:Demarc Co\.?|Demaroot Foundation|John Smith|freelancers?|business association|school districts?)\b/i;
const EVIDENCE_REF_PATTERN = /\b(?:mission|observation|receipt|pat):[A-Za-z0-9_.:/-]+\b/gi;

/**
 * Keep model text subordinate to the mission/evidence contract. This is a
 * quarantine gate, not a claim validator: an admitted result is still only a
 * proposal until independently checked.
 */
export function groundPatOutput({ text, role, missionId = "founder-useful-local-closure", permittedEvidenceRefs = [`mission:${missionId}`] } = {}) {
  const raw = typeof text === "string" ? text.trim() : "";
  const hasSections = /FINDING/i.test(raw) && /UNCERTAINTY/i.test(raw) && /NEXT/i.test(raw);
  const mentionsMission = new RegExp(`(?:${missionId}|DEMA|founder|local)`, "i").test(raw);
  const unsupported = UNSUPPORTED_ENTITY_PATTERN.test(raw);
  const evidenceLine = raw.split("\n").find((line) => /^\s*EVIDENCE\s*:/i.test(line)) ?? "";
  const evidenceRefs = [...new Set(raw.match(EVIDENCE_REF_PATTERN) ?? [])];
  const allowedRefs = new Set(permittedEvidenceRefs);
  const groundedRefs = evidenceRefs.filter((ref) => allowedRefs.has(ref) && evidenceLine.includes(ref));
  const verdict = raw && hasSections && mentionsMission && groundedRefs.length > 0 && !unsupported
    ? "ADMITTED_PROPOSAL"
    : "QUARANTINED_PROPOSAL";
  return Object.freeze({
    role: role ?? null,
    verdict,
    truth: verdict === "ADMITTED_PROPOSAL" ? "MEASURED_MODEL_OUTPUT_UNVERIFIED_PROPOSAL" : "QUARANTINED_UNGROUNDED_PROPOSAL",
    basisRefs: verdict === "ADMITTED_PROPOSAL" ? [...groundedRefs, `pat:${role}:invocation`] : [],
    evidenceRefs,
    groundedRefs,
    unsupportedEntityDetected: unsupported,
    reason: verdict === "ADMITTED_PROPOSAL" ? null : groundedRefs.length === 0 ? "permitted_evidence_ref_missing" : "mission_grounding_failed",
  });
}

export function synthesizeGroundedPatProposals(admitted) {
  const seats = Array.isArray(admitted) ? admitted : [];
  if (seats.length === 0) {
    return "CONSENSUS: no mission-grounded PAT claims admitted.\nDISAGREEMENTS: all model outputs were quarantined for grounding failure.\nNEXT_SAFE_STEP: inspect the mission and evidence sources before asking PAT again.";
  }
  return `CONSENSUS: ${seats.length} mission-grounded proposals remain unverified.\nDISAGREEMENTS: independent verification is still required.\nNEXT_SAFE_STEP: inspect evidence before any effect.\nSOURCES: ${seats.flatMap((seat) => [...(seat.grounding?.groundedRefs ?? []), ...(seat.evidenceRef ? [seat.evidenceRef] : [])]).join(", ")}`;
}

function parseStructuredPatOutput(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return { claims: [], parse_status: "EMPTY" };
  const candidates = [raw, raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const claims = Array.isArray(parsed?.claims) ? parsed.claims.map((claim) => ({
        text: typeof claim?.text === "string" ? claim.text.trim() : "",
        class: typeof claim?.class === "string" ? claim.class : "unknown",
        evidence_refs: Array.isArray(claim?.evidence_refs) ? [...new Set(claim.evidence_refs.filter((ref) => typeof ref === "string" && ref.trim()))] : [],
      })).filter((claim) => claim.text) : [];
      return { claims, parse_status: "PARSED_JSON" };
    } catch {
      // Model prose is still retained as a proposal, but it has no harness
      // provenance until it supplies the structured claim contract.
    }
  }
  return { claims: [], parse_status: "QUARANTINED_UNSTRUCTURED" };
}

function buildRuntimePatReceipt({ missionId, roleContract, prompt, result, claims, grounding, startedAt, completedAt }) {
  const roleId = roleContract.role_id;
  const subtaskRef = `${missionId}/pat/${roleId}`;
  const traceId = `pat7.runtime.trace.${missionId}.${roleId}`;
  const invocationId = `pat7.runtime.invocation.${missionId}.${roleId}`;
  const resultId = `pat7.runtime.result.${missionId}.${roleId}`;
  const output = typeof result?.response_text_preview === "string" ? result.response_text_preview : null;
  const input = {
    mission_id: missionId,
    seat_id: roleId,
    role: roleContract.role_id,
    subtask_ref: subtaskRef,
    permitted_evidence_refs: [`mission:${missionId}`],
    prompt_hash: sha256CanonicalJsonV1(prompt),
  };
  const inputHash = sha256CanonicalJsonV1(input);
  const evidenceRefs = [...new Set(claims.flatMap((claim) => claim.evidence_refs))];
  const resultBody = {
    schema: "bizra.dema.pat.runtime_result.v0.1",
    result_id: resultId,
    invocation_id: invocationId,
    trace_id: traceId,
    mission_id: missionId,
    seat_id: roleId,
    role: roleContract.role_id,
    status: result?.invocation_status === "completed" ? "COMPLETED" : "FAILED",
    model: result?.model ?? null,
    output_hash: sha256CanonicalJsonV1(output),
    claims,
    grounding_status: grounding?.verdict ?? "QUARANTINED_NO_PERMITTED_EVIDENCE",
    evidence_refs: evidenceRefs,
    output_truth_ceiling: "MEASURED_MODEL_OUTPUT_UNVERIFIED_PROPOSAL",
  };
  const traceBody = {
    schema: "bizra.dema.pat.runtime_trace.v0.1",
    trace_id: traceId,
    invocation_id: invocationId,
    result_id: resultId,
    mission_id: missionId,
    seat_id: roleId,
    role: roleContract.role_id,
    status: resultBody.status,
    input_hash: inputHash,
    output_hash: resultBody.output_hash,
    evidence_refs: evidenceRefs,
  };
  return {
    schema: "bizra.dema.pat.runtime_seat_receipt.v0.1",
    receipt_status: resultBody.status,
    mission_id: missionId,
    seat_id: roleId,
    role: roleContract.role_id,
    subtask_ref: subtaskRef,
    model: result?.model ?? null,
    provider: result?.provider ?? null,
    started_at: startedAt,
    completed_at: completedAt,
    invocation: {
      schema: "bizra.dema.pat.runtime_invocation.v0.1",
      invocation_id: invocationId,
      mission_id: missionId,
      seat_id: roleId,
      role: roleContract.role_id,
      subtask_ref: subtaskRef,
      input_hash: inputHash,
      prompt_hash: input.prompt_hash,
      permitted_evidence_refs: input.permitted_evidence_refs,
      status: resultBody.status,
      trace_id: traceId,
    },
    result: { ...resultBody, result_hash: sha256CanonicalJsonV1(resultBody) },
    trace: { ...traceBody, trace_hash: sha256CanonicalJsonV1(traceBody) },
  };
}

function sandboxRoot() {
  const root = candidateSandboxRoot() || path.join(process.env.DEMA_FOUNDER_CAMPAIGN_ROOT || path.resolve(process.cwd(), ".campaign-founder"), "sandbox", "founder-node");
  mkdirSync(root, { recursive: true });
  return root;
}

export async function runFounderPatMission({ model = "phi3:mini", provider = "ollama", timeoutMs = 20000 } = {}) {
  const root = sandboxRoot();
  const seats = [];
  const mission = safeJson(path.join(root, "mission.json"));
  const missionId = mission?.contract?.mission_id ?? "founder-useful-local-closure";
  const missionEvidence = [{ evidence_ref: `mission:${missionId}`, source_ref: "candidate_mission_contract", source_sha256: sha256CanonicalJsonV1(mission?.contract ?? { mission_id: missionId }) }];
  const startedAt = new Date().toISOString();
  for (const [index, [role, duty]] of FOUNDER_PAT_SEATS.entries()) {
    const roleContract = FOUNDER_PAT_SEAT_ROLE_CONTRACTS[index];
    const prompt = `Return JSON only. You are PAT seat ${roleContract.role_id} (${role}). Mission id: ${missionId}. Duty: ${duty}. The permitted evidence reference is mission:${missionId}. Return {"claims":[{"text":"...","class":"supported_claim|inference|hypothesis|proposal|unknown","evidence_refs":["mission:${missionId}"]}]}. Use only that permitted evidence. Do not invent people, companies, domains, metrics, or historical facts. This is a bounded proposal only; do not claim execution or authority.`;
    const route = buildLocalLlmProviderRoute({ provider, model, prompt });
    const seatStarted = new Date().toISOString();
    const result = await invokeDemaTalkLive({ provider, model, prompt, consentPhrase: route.consent_phrase, timeoutMs });
    const seatCompleted = new Date().toISOString();
    const parsed = parseStructuredPatOutput(result.response_text_preview);
    const evidenceRefs = parsed.claims.flatMap((claim) => claim.evidence_refs);
    const permittedRef = `mission:${missionId}`;
    const unsupportedEntityDetected = UNSUPPORTED_ENTITY_PATTERN.test(result.response_text_preview ?? "");
    const acceptedClaims = parsed.claims.filter((claim) => claim.class !== "supported_claim" && claim.evidence_refs.length > 0 && claim.evidence_refs.every((ref) => ref === permittedRef));
    const quarantinedClaims = parsed.claims.filter((claim) => !acceptedClaims.includes(claim));
    const grounding = Object.freeze({
      role,
      verdict: result.invocation_status === "completed" && acceptedClaims.length > 0 && !unsupportedEntityDetected ? "ADMITTED_PROPOSAL" : "QUARANTINED_PROPOSAL",
      truth: "MEASURED_MODEL_OUTPUT_UNVERIFIED_PROPOSAL",
      basisRefs: acceptedClaims.flatMap((claim) => claim.evidence_refs),
      evidenceRefs,
      groundedRefs: acceptedClaims.flatMap((claim) => claim.evidence_refs),
      unsupportedEntityDetected,
      parseStatus: parsed.parse_status,
      quarantinedClaims,
      reason: parsed.claims.length === 0 ? "structured_claims_required" : acceptedClaims.length === 0 ? "supported_claim_requires_direct_evidence" : unsupportedEntityDetected ? "unsupported_entity" : null,
    });
    seats.push({ seatId: `pat-${role.toLowerCase()}`, role, role_id: roleContract.role_id, duty, provider, model, status: result.invocation_status === "completed" ? "completed" : "failed", invocationTruth: result.truth_label, outputTruthCeiling: grounding.truth, grounding, claims: parsed.claims, accepted_claims: acceptedClaims, quarantined_claims: quarantinedClaims, parse_status: parsed.parse_status, result: result.response_text_preview, error: result.error_reason, evidenceRef: `pat:${role}:invocation`, evidence_refs: evidenceRefs, runtime_receipt: buildRuntimePatReceipt({ missionId, roleContract, prompt, result, claims: acceptedClaims, grounding, startedAt: seatStarted, completedAt: seatCompleted }) });
  }
  const completed = seats.filter((seat) => seat.status === "completed");
  const seatOutputs = seats.map((seat) => ({ role_id: seat.role_id, output_text: JSON.stringify({ claims: seat.accepted_claims }), evidence_refs: seat.accepted_claims.flatMap((claim) => claim.evidence_refs) }));
  const harnessRecord = buildFounderPatHarnessCandidate({ mission_id: missionId, permitted_evidence: missionEvidence, seat_outputs: seatOutputs });
  const admitted = seats.filter((seat) => seat.grounding?.verdict === "ADMITTED_PROPOSAL" && seat.accepted_claims.length > 0);
  const synthesis = harnessRecord.synthesis?.output_text ?? synthesizeGroundedPatProposals(admitted);
  const synthesis_claims = seats.flatMap((seat) => [
    ...seat.accepted_claims.map((claim) => ({ ...claim, seat_id: seat.role_id, status: "ADMITTED_PROPOSAL" })),
    ...seat.quarantined_claims.map((claim) => ({ ...claim, seat_id: seat.role_id, status: "QUARANTINED_UNSUPPORTED_CLAIM" })),
  ]);
  const run = { schema: "bizra.dema.pat7.run.v0.2", started_at: startedAt, completed_at: new Date().toISOString(), mission: missionId, mission_id: missionId, outputTruthCeiling: admitted.length > 0 ? "MEASURED_MODEL_OUTPUT_UNVERIFIED_PROPOSAL" : "QUARANTINED_UNGROUNDED_PROPOSAL", seats, seat_receipts: seats.map((seat) => seat.runtime_receipt), all_seats_invoked: seats.length === 7, completed_seats: completed.length, grounded_seats: admitted.length, synthesis_status: "DETERMINISTIC_HARNESS", synthesis_truth: admitted.length > 0 ? "MEASURED_MODEL_OUTPUT_UNVERIFIED_PROPOSAL" : "QUARANTINED_UNGROUNDED_PROPOSAL", synthesis, synthesis_claims, synthesisEvidenceRefs: harnessRecord.synthesis?.evidence_refs ?? [], harness_record: harnessRecord, harness_verification: verifyFounderPatHarnessCandidate(harnessRecord), authority_delta: 0 };
  writeJson(path.join(root, "pat-run.json"), run);
  return run;
}

export function runFounderMission({ missionId = "founder-useful-local-closure", purpose = "Qualify one bounded local DEMA founder loop" } = {}) {
  const root = sandboxRoot();
  const now = new Date().toISOString();
  const mission = { contract: { mission_id: missionId, purpose, acceptance_criteria: ["PAT-7 returns bounded suggestions", "one sandbox effect is independently verified", "restart reconstruction is lossless"], completion_conditions: ["second fresh mission completes"], authority_ceiling: "candidate_sandbox_only" }, state: "PROPOSED", current_state: "PROPOSED", frontier: { id: `${missionId}/qualification`, status: "OPEN", objective: "PAT-7 qualification and recoverable bounded effect", blocker: "PAT-7 harness and recovery evidence pending", causal_explanation: "Candidate state is newly bound and has no completion receipt yet.", next_transition: "Run the harness-owned PAT-7 trace and independently verify the candidate effect." }, updated_at: now };
  writeJson(path.join(root, "mission.json"), mission);
  return mission;
}

export function runFounderEffect({ name = "effect-a" } = {}) {
  const root = sandboxRoot();
  const effectRoot = path.join(root, "effects", name);
  mkdirSync(effectRoot, { recursive: true });
  const source = `${name}.before.txt`;
  const target = `${name}.after.txt`;
  writeFileSync(path.join(effectRoot, source), `candidate bounded effect ${name}\n`, "utf8");
  const situation = readFounderSituation();
  const action = { schema: "bizra.dema.action_commitment.v0.1", situation_commitment: situation.commitment, mission_id: situation.situation.mission.missionId, capability: { id: "node0.fate.staged.rename", version: "v0.1", digest: sha256CanonicalJsonV1({ id: "node0.fate.staged.rename", version: "v0.1" }) }, target: { sandbox: name, source, destination: target }, predicted_effects: ["rename_one_candidate_file"], forbidden_effects: ["network", "authority_widening", "production_mutation"], verification: "source absent and destination bytes equal before digest", recovery: "resume journal without re-execution", authority_scope: "candidate_sandbox_only" };
  const actionCommitment = sha256CanonicalJsonV1(action);
  writeJson(path.join(effectRoot, "action-preview.json"), { action, action_commitment: actionCommitment });
  const started = startFateStagedEffect({ fs: requireFs(), scopeDir: effectRoot, operatorPhrase: NODE0_FATE_STAGED_EFFECT_REQUIRED_PHRASE, fileName: source, newName: target });
  const verified = started.envelope ? verifyNode0FateStagedEffect(started.envelope) : { ok: false, reason: started.phase };
  const receipt = { schema: "bizra.dema.founder_effect_receipt.v0.1", action, action_commitment: actionCommitment, fate: started, verified, authority_delta: 0, effect_scope: effectRoot };
  writeJson(path.join(root, `${name}.receipt.json`), receipt);
  const missionFile = path.join(root, "mission.json");
  const mission = safeJson(missionFile);
  if (mission?.contract) writeJson(missionFile, { ...mission, state: name === "effect-b" ? "SECOND_COMPLETED" : "COMPLETED", current_state: name === "effect-b" ? "SECOND_COMPLETED" : "COMPLETED", frontier: { ...(mission.frontier && typeof mission.frontier === "object" ? mission.frontier : {}), status: "CLOSED", blocker: null, causal_explanation: "Effect receipt and byte-level verification are present in the candidate sandbox.", next_transition: "Founder review of the candidate handoff." }, updated_at: new Date().toISOString() });
  return { ...receipt, action_commitment: actionCommitment, source, target };
}

function requireFs() {
  return nodeFs;
}

export function resumeFounderEffect({ name = "effect-a" } = {}) {
  const root = sandboxRoot();
  const resumed = resumeFateStagedEffect({ fs: requireFs(), scopeDir: path.join(root, "effects", name) });
  writeJson(path.join(root, `${name}.resume.json`), resumed);
  return resumed;
}
