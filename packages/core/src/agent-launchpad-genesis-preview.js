import { createHash } from 'node:crypto';

import {
  AGENT_PROFILE_SCHEMA,
  CANONICAL_AGENTS,
  computeStableProfileHash,
} from '../../agents/src/agent-profile-registry.js';
import {
  CONTRACT_FIELDS,
  inspectMissionContractFields,
} from './mission-contract-state.js';

export const AGENT_LAUNCHPAD_GENESIS_PREVIEW_SCHEMA =
  'bizra.dema.agent_launchpad_genesis_preview.v0.1';
export const AGENT_LAUNCHPAD_GENESIS_PREVIEW_TRUTH_LABEL =
  'AGENT_LAUNCHPAD_GENESIS_PREVIEW_ONLY';
/** AGENT-LAUNCHPAD-NO-SYNTHETIC-CONSENT-1A — mission digests bind via pure inspection. */
export const AGENT_LAUNCHPAD_MISSION_OWNER =
  'packages/core/src/mission-contract-state.js#inspectMissionContractFields';
/** AGENT-LAUNCHPAD-PROFILE-OWNER-BINDING-1D — profile digests bind to this owner. */
export const AGENT_LAUNCHPAD_PROFILE_OWNER =
  'packages/agents/src/agent-profile-registry.js#computeStableProfileHash';

const PAT_IDS = Object.freeze([
  'pat.dema',
  'pat.guardian',
  'pat.reasoner',
  'pat.builder',
  'pat.critic',
  'pat.archivist',
  'pat.teacher',
]);
const SAT_IDS = Object.freeze([
  'sat.verifier',
  'sat.compliance',
  'sat.resource',
  'sat.economist',
  'sat.evolution',
]);
const ALLOWED_EFFECT_CLASSES = Object.freeze([
  'C0_PURE',
  'C1_OBSERVE',
  'C2_DRAFT',
  'C3_REVERSIBLE_LOCAL',
]);
const EPISTEMIC = new Set(['OBSERVED', 'MEASURED', 'VERIFIED']);
const FRESHNESS = new Set(['CURRENT', 'STALE', 'UNKNOWN']);
const SHA256 = /^(?:sha256:)?[0-9a-f]{64}$/;
/** Exact Launchpad requested_boundaries vocabulary — unknown keys fail closed. */
const ALLOWED_REQUESTED_BOUNDARIES = Object.freeze([
  'mint',
  'reward_settlement',
  'federation',
  'public_launch',
  'signer_or_key',
  'dema_home_mutation',
]);
const ALLOWED_REQUESTED_BOUNDARY_SET = new Set(ALLOWED_REQUESTED_BOUNDARIES);

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v) ?? 'null').join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().flatMap((k) => {
      const v = stableStringify(value[k]);
      return v === undefined ? [] : [`${JSON.stringify(k)}:${v}`];
    }).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256Canonical(value) {
  return `sha256:${createHash('sha256').update(stableStringify(value), 'utf8').digest('hex')}`;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/// Deep-clone plain JSON-like values so preview freeze cannot seal caller drafts.
/// Uses a null-prototype object so own keys like `__proto__` survive as data.
function clonePlain(value) {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => clonePlain(item));
  const out = Object.create(null);
  for (const [key, child] of Object.entries(value)) {
    out[key] = clonePlain(child);
  }
  return out;
}

function validDigest(value) {
  return typeof value === 'string' && SHA256.test(value);
}

function normalizeDigest(value) {
  const raw = text(value);
  if (!validDigest(raw)) return '';
  return raw.startsWith('sha256:') ? raw : `sha256:${raw}`;
}

function exactContractFieldKeys(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const expected = [...CONTRACT_FIELDS].sort();
  const actual = Object.keys(body).sort();
  if (actual.length !== expected.length) return false;
  return expected.every((key, index) => actual[index] === key);
}

/// Bind caller mission body to the canonical mission-contract owner.
/// Hash-only self-attestation is refused. Semantics recompute through
/// inspectMissionContractFields (pure validation/hash) — never through the
/// consent-gated createMissionContract path. Binding ok means owner validation
/// succeeded; it does not establish human consent or authorize creation.
function bindMissionContractOwner({ mission_contract, mission_contract_hash } = {}) {
  const claimed = normalizeDigest(mission_contract_hash);
  const blockers = [];
  if (mission_contract == null) {
    blockers.push('mission_contract_body_required');
  } else if (!exactContractFieldKeys(mission_contract)) {
    blockers.push('mission_contract_shape_invalid');
  }
  if (!claimed) blockers.push('mission_contract_hash_invalid');

  let recomputed = null;
  if (blockers.length === 0) {
    const listFields = [
      mission_contract.acceptance_criteria,
      mission_contract.prohibited_outcomes,
      mission_contract.completion_conditions,
    ];
    if (listFields.some((field) => !Array.isArray(field))) {
      blockers.push('mission_contract_shape_invalid');
    } else {
      try {
        const inspected = inspectMissionContractFields({
          fields: {
            ...mission_contract,
            acceptance_criteria: [...mission_contract.acceptance_criteria],
            prohibited_outcomes: [...mission_contract.prohibited_outcomes],
            completion_conditions: [...mission_contract.completion_conditions],
          },
        });
        recomputed = inspected.contract_hash;
        if (inspected.contract_hash !== claimed) blockers.push('mission_contract_hash_mismatch');
      } catch (err) {
        blockers.push(typeof err?.code === 'string' ? err.code : 'mission_contract_semantics_invalid');
      }
    }
  }

  return Object.freeze({
    blockers: Object.freeze(blockers),
    binding: Object.freeze({
      owner: AGENT_LAUNCHPAD_MISSION_OWNER,
      algorithm: 'bizra.canonical-json.v1+sha256',
      canonical_mission_owner_used: blockers.length === 0,
      caller_hash_cannot_self_attest: true,
      claimed_hash: claimed || null,
      recomputed_hash: recomputed,
      ok: blockers.length === 0,
      validation_only: true,
      human_consent_established: false,
      creation_authorized: false,
    }),
  });
}

/// Bind caller profile identity to the canonical agent-profile owner.
/// Hash-only self-attestation is refused. Body must name the creator and a
/// CANONICAL_AGENTS row; stable hash re-derives through computeStableProfileHash.
function bindAgentProfileOwner({
  creator_agent_id,
  agent_profile,
  agent_profile_hash,
} = {}) {
  const claimed = normalizeDigest(agent_profile_hash);
  const blockers = [];
  const creator = text(creator_agent_id);
  const canonical = CANONICAL_AGENTS.find((a) => a.agent_id === creator) ?? null;

  if (!canonical) blockers.push('creator_not_in_canonical_agents');
  if (agent_profile == null) {
    blockers.push('agent_profile_body_required');
  } else if (!agent_profile || typeof agent_profile !== 'object' || Array.isArray(agent_profile)) {
    blockers.push('agent_profile_shape_invalid');
  } else {
    if (agent_profile.schema !== AGENT_PROFILE_SCHEMA) {
      blockers.push('agent_profile_schema_invalid');
    }
    if (agent_profile.agent_id !== creator) {
      blockers.push('agent_profile_creator_mismatch');
    }
    if (
      canonical &&
      (agent_profile.agent_class !== canonical.agent_class
        || agent_profile.agent_role !== canonical.agent_role)
    ) {
      blockers.push('agent_profile_canonical_role_mismatch');
    }
    if (typeof agent_profile.created_at_iso !== 'string' || !agent_profile.created_at_iso.trim()) {
      blockers.push('agent_profile_created_at_missing');
    }
  }
  if (!claimed) blockers.push('agent_profile_hash_invalid');

  let recomputed = null;
  if (blockers.length === 0) {
    const bare = computeStableProfileHash({
      agent_id: agent_profile.agent_id,
      agent_class: agent_profile.agent_class,
      agent_role: agent_profile.agent_role,
      created_at_iso: agent_profile.created_at_iso,
    });
    recomputed = normalizeDigest(bare);
    if (recomputed !== claimed) blockers.push('agent_profile_hash_mismatch');
  }

  return Object.freeze({
    blockers: Object.freeze(blockers),
    binding: Object.freeze({
      owner: AGENT_LAUNCHPAD_PROFILE_OWNER,
      algorithm: 'agent-profile-stable-identity-sha256',
      canonical_profile_owner_used: blockers.length === 0,
      caller_hash_cannot_self_attest: true,
      claimed_hash: claimed || null,
      recomputed_hash: recomputed,
      ok: blockers.length === 0,
    }),
  });
}

function normalizeEvidence(evidence = []) {
  if (!Array.isArray(evidence)) return [];
  const seenIds = new Set();
  return evidence.map((e, i) => {
    const baseId = text(e?.id) || `evidence.${i}`;
    let id = baseId;
    for (let n = i; seenIds.has(id); n += 1) id = `${baseId}#${n}`;
    seenIds.add(id);
    return {
      id,
      kind: text(e?.kind) || 'unknown',
      ref: text(e?.ref),
      digest: text(e?.digest),
      epistemic: text(e?.epistemic) || 'UNKNOWN',
      freshness: text(e?.freshness) || 'UNKNOWN',
      independent: e?.independent === true,
      scope_match: e?.scope_match === true,
    };
  });
}

function evaluateEvidence(evidence) {
  const admitted = [];
  const excluded = [];
  const digestSeen = new Map();

  for (const e of evidence) {
    const gaps = [];
    if (!e.ref) gaps.push('ref_missing');
    if (!validDigest(e.digest)) gaps.push('digest_missing_or_malformed');
    if (!EPISTEMIC.has(e.epistemic)) gaps.push('epistemic_not_admissible');
    if (!FRESHNESS.has(e.freshness)) gaps.push('freshness_invalid');
    if (e.scope_match !== true) gaps.push('scope_mismatch');

    if (gaps.length > 0) {
      excluded.push({ id: e.id, gaps });
      continue;
    }

    const key = e.digest.startsWith('sha256:') ? e.digest : `sha256:${e.digest}`;
    if (digestSeen.has(key)) {
      excluded.push({
        id: e.id,
        gaps: ['duplicate_evidence_digest'],
        duplicate_of: digestSeen.get(key),
      });
      continue;
    }
    digestSeen.set(key, e.id);
    admitted.push({ ...e, digest: key });
  }

  return { admitted, excluded };
}

function boundary() {
  return Object.freeze({
    runtime_execution_performed: false,
    human_consent_manufactured: false,
    fate_admission_manufactured: false,
    signer_or_key_operation_performed: false,
    dema_home_mutated: false,
    network_used: false,
    push_performed: false,
    merge_performed: false,
    deployment_performed: false,
    publication_performed: false,
    token_minted: false,
    reward_settled: false,
    federation_used: false,
    public_agent_identity_emitted: false,
  });
}

/// Serializable admit-time marker for malformed requested_boundaries.
/// Retained on report.input so verify can rederive the same refusal.
/// Own presence of this key (caller-supplied or admit-written) is never
/// permission — it always contributes requested_boundaries_malformed.
const REQUESTED_BOUNDARIES_MALFORMED_MARKER =
  '__dema_requested_boundaries_malformed_v1';

function malformedBoundaryRetention(extra = null) {
  const retained = Object.create(null);
  if (extra && typeof extra === 'object') {
    for (const key of Object.getOwnPropertyNames(extra).sort()) {
      retained[key] = extra[key];
    }
  }
  retained[REQUESTED_BOUNDARIES_MALFORMED_MARKER] = true;
  return Object.freeze(retained);
}

/// Admit requested_boundaries fail-closed.
/// Retains a frozen own-key copy of the caller request so verify/rederivation
/// sees the same keys/values that produced blockers (no silent drop).
/// undefined = omitted request; {} = empty request; null = malformed.
function admitRequestedBoundaries(raw) {
  const blockers = [];

  if (raw === undefined) {
    return Object.freeze({
      requested_boundaries: Object.freeze(Object.create(null)),
      blockers: Object.freeze(blockers),
    });
  }

  if (raw === null) {
    blockers.push('requested_boundaries_malformed');
    return Object.freeze({
      requested_boundaries: malformedBoundaryRetention(),
      blockers: Object.freeze(blockers),
    });
  }

  if (typeof raw !== 'object' || Array.isArray(raw)) {
    blockers.push('requested_boundaries_malformed');
    return Object.freeze({
      requested_boundaries: malformedBoundaryRetention(),
      blockers: Object.freeze(blockers),
    });
  }

  const hasOwnSymbolKey = Reflect.ownKeys(raw).some((key) => typeof key === 'symbol');
  const retained = Object.create(null);
  const keys = Object.getOwnPropertyNames(raw).sort();
  for (const key of keys) {
    retained[key] = raw[key];
  }

  // Symbol keys are not JSON/report-serializable; stamp a deterministic marker
  // so rebuild refuses identically instead of silently becoming an empty admit.
  if (hasOwnSymbolKey) {
    retained[REQUESTED_BOUNDARIES_MALFORMED_MARKER] = true;
    blockers.push('requested_boundaries_malformed');
  }

  // Marker presence (admit-written or caller-supplied) is never permission.
  if (Object.prototype.hasOwnProperty.call(retained, REQUESTED_BOUNDARIES_MALFORMED_MARKER)) {
    blockers.push('requested_boundaries_malformed');
  }

  for (const key of Object.getOwnPropertyNames(retained).sort()) {
    if (key === REQUESTED_BOUNDARIES_MALFORMED_MARKER) continue;
    if (!ALLOWED_REQUESTED_BOUNDARY_SET.has(key)) {
      blockers.push(`unknown_requested_boundary:${key}`);
      continue;
    }
    const value = retained[key];
    if (value !== true && value !== false) {
      blockers.push(`requested_boundary_value_invalid:${key}`);
      continue;
    }
    if (value === true) {
      blockers.push(`forbidden_boundary_requested:${key}`);
    }
  }

  return Object.freeze({
    requested_boundaries: Object.freeze(retained),
    blockers: Object.freeze([...new Set(blockers)].sort()),
  });
}

function buildHypergraph({ creator, verifier, missionHash, profileHash, verificationHash, evidence }) {
  const nodes = [
    { id: creator, type: 'PAT_AGENT' },
    { id: verifier, type: 'SAT_VERIFIER' },
    { id: profileHash, type: 'AGENT_PROFILE_COMMITMENT' },
    { id: missionHash, type: 'MISSION_CONTRACT_COMMITMENT' },
    { id: verificationHash, type: 'VERIFICATION_CONTRACT_COMMITMENT' },
    ...evidence.map((e) => ({ id: e.digest, type: 'EVIDENCE', evidence_id: e.id })),
  ];
  const hyperedges = [
    {
      id: 'identity_and_mission_binding',
      members: [creator, profileHash, missionHash],
      relation: 'binds',
    },
    {
      id: 'verification_independence_binding',
      members: [creator, verifier, verificationHash],
      relation: 'must_remain_causally_separate_for_acceptance',
    },
    {
      id: 'evidence_support',
      members: [missionHash, verificationHash, ...evidence.map((e) => e.digest)],
      relation: 'supports_qualification_only',
    },
  ];
  return Object.freeze({
    nodes: Object.freeze(nodes),
    hyperedges: Object.freeze(hyperedges),
    authority_edges_diffused: false,
    semantic_similarity_grants_truth: false,
  });
}

function buildHhmmProjection({ blocked, admittedEvidenceCount, independentEvidenceCount }) {
  const system = blocked.length === 0 ? 'LOCAL_CANDIDATE' : 'DESIGNED';
  const mission = blocked.length === 0 ? 'PLAN' : 'UNDERSTAND';
  const evidence = independentEvidenceCount > 0
    ? 'MEASURED'
    : admittedEvidenceCount > 0
      ? 'OBSERVED'
      : 'UNKNOWN';
  return Object.freeze({
    L2_system: system,
    L1_mission: mission,
    L0_evidence: evidence,
    advisory_only: true,
    may_transition_authority: false,
    note: 'The projection may rank the likely phase; it cannot move the mission into authorization, execution, settlement, or launch.',
  });
}

function buildSNR({ admittedEvidenceCount, independentEvidenceCount, excludedEvidenceCount, blockerCount }) {
  const signal = admittedEvidenceCount + independentEvidenceCount;
  const noise = excludedEvidenceCount + blockerCount;
  const score = signal + noise === 0 ? 0 : Number((signal / (signal + noise)).toFixed(4));
  return Object.freeze({
    score,
    signal,
    noise,
    ranking_only: true,
    can_promote_epistemic_state: false,
    can_grant_authority: false,
    law: 'AmplificationQuality <= AdmissionQuality',
  });
}


function buildEvidenceHashTable(admitted, excluded) {
  const table = {};
  for (const e of admitted) {
    table[e.digest] = Object.freeze({
      evidence_id: e.id,
      ref: e.ref,
      epistemic: e.epistemic,
      freshness: e.freshness,
      declared_independent: e.independent,
      scope_match: e.scope_match,
      admitted_for_attention: true,
    });
  }
  for (const e of excluded) {
    const key = `excluded:${e.id}`;
    table[key] = Object.freeze({
      evidence_id: e.id,
      admitted_for_attention: false,
      gaps: Object.freeze([...(e.gaps ?? [])]),
    });
  }
  return Object.freeze({
    table: Object.freeze(table),
    duplicate_weight_rule: 'same_digest_adds_zero_epistemic_weight',
    authority: 'NONE',
  });
}

function buildDiffusionAttention({ admitted, independentEvidenceCount, hypergraph }) {
  const evidenceMass = Math.min(1, admitted.length / 4);
  const independenceMass = Math.min(1, independentEvidenceCount / 2);
  return Object.freeze({
    mode: 'ATTENTION_ONLY',
    mission_attention: Number((0.65 * evidenceMass + 0.35 * independenceMass).toFixed(4)),
    verification_attention: Number((0.35 * evidenceMass + 0.65 * independenceMass).toFixed(4)),
    node_count: hypergraph.nodes.length,
    hyperedge_count: hypergraph.hyperedges.length,
    contradiction_damping: true,
    unverified_source_amplification: 0,
    authority_edges_diffused: false,
    may_change_truth_label: false,
    may_change_consent: false,
  });
}

function buildInspectableReasoningGraph({ state, admitted, excluded }) {
  const evidenceNodes = admitted.map((e) => ({
    id: `e:${e.id}`,
    type: 'EVIDENCE',
    digest: e.digest,
  }));
  return Object.freeze({
    disclosure: 'INSPECTABLE_DECISION_GRAPH_NOT_PRIVATE_CHAIN_OF_THOUGHT',
    nodes: Object.freeze([
      ...evidenceNodes,
      { id: 'c:structural_candidate', type: 'CLAIM', label: state },
      { id: 'h:canonical_binding', type: 'HYPOTHESIS', label: 'canonical subject binding still requires an external owner/verifier' },
      { id: 'g:prod06', type: 'GATE', label: 'PROD-06 real effect + observation + trusted receipt + recovery' },
      { id: 's:next', type: 'SPEARPOINT', label: 'bind the capsule compiler to canonical profile/mission/verifier owners without widening authority' },
    ]),
    edges: Object.freeze([
      ...evidenceNodes.map((n) => ({ from: n.id, to: 'c:structural_candidate', relation: 'supports_shape' })),
      { from: 'c:structural_candidate', to: 'h:canonical_binding', relation: 'does_not_establish' },
      { from: 'h:canonical_binding', to: 'g:prod06', relation: 'blocked_by' },
      { from: 'g:prod06', to: 's:next', relation: 'selects_spearpoint' },
    ]),
    excluded_evidence_count: excluded.length,
    authority: 'NONE',
  });
}

function buildProcessMining(receiptRefs, chatRefs) {
  const blocked = [];
  if (Array.isArray(chatRefs) && chatRefs.length > 0) {
    blocked.push('chat_history_not_admissible_as_operational_truth');
  }
  const receipts = Array.isArray(receiptRefs)
    ? receiptRefs.filter((r) => typeof r === 'string' && validDigest(r))
      .map((r) => r.startsWith('sha256:') ? r : `sha256:${r}`)
    : [];
  return Object.freeze({
    source: 'receipt_refs_only',
    receipt_refs: Object.freeze([...new Set(receipts)]),
    chat_history_used: false,
    blocked_by: Object.freeze(blocked),
    result: receipts.length > 0 ? 'CANDIDATE_TRACE_SET' : 'NO_ADMISSIBLE_TRACE_SET',
    may_promote_learning: false,
  });
}

export function buildAgentLaunchpadGenesisPreview(input = {}) {
  const agentProfileDraft =
    input.agent_profile &&
    typeof input.agent_profile === 'object' &&
    !Array.isArray(input.agent_profile)
      ? clonePlain(input.agent_profile)
      : null;
  const missionContractDraft =
    input.mission_contract &&
    typeof input.mission_contract === 'object' &&
    !Array.isArray(input.mission_contract)
      ? clonePlain(input.mission_contract)
      : null;

  const missionBind = bindMissionContractOwner({
    mission_contract: missionContractDraft,
    mission_contract_hash: input.mission_contract_hash,
  });
  const profileBind = bindAgentProfileOwner({
    creator_agent_id: input.creator_agent_id,
    agent_profile: agentProfileDraft,
    agent_profile_hash: input.agent_profile_hash,
  });

  const normalized = {
    capsule_id: text(input.capsule_id),
    creator_agent_id: text(input.creator_agent_id),
    verifier_agent_id: text(input.verifier_agent_id),
    agent_profile: agentProfileDraft,
    agent_profile_hash: profileBind.binding.claimed_hash || text(input.agent_profile_hash),
    mission_contract: missionContractDraft,
    mission_contract_hash: missionBind.binding.claimed_hash || text(input.mission_contract_hash),
    verification_contract_hash: text(input.verification_contract_hash),
    effect_class: text(input.effect_class),
    authority_delta: Number.isFinite(input.authority_delta) ? input.authority_delta : null,
    evidence: normalizeEvidence(input.evidence),
    receipt_refs: Array.isArray(input.receipt_refs) ? [...input.receipt_refs] : [],
    chat_refs: Array.isArray(input.chat_refs) ? [...input.chat_refs] : [],
    requested_boundaries: null, // filled after fail-closed admission
  };

  const boundaryAdmit = admitRequestedBoundaries(input.requested_boundaries);
  normalized.requested_boundaries = boundaryAdmit.requested_boundaries;

  const blocked = [];
  if (!normalized.capsule_id) blocked.push('capsule_id_missing');
  if (!PAT_IDS.includes(normalized.creator_agent_id)) {
    blocked.push('creator_must_be_existing_canonical_pat');
  }
  if (!SAT_IDS.includes(normalized.verifier_agent_id)) {
    blocked.push('verifier_must_be_existing_canonical_sat');
  }
  blocked.push(...profileBind.blockers);
  blocked.push(...missionBind.blockers);
  if (!validDigest(normalized.verification_contract_hash)) blocked.push('verification_contract_hash_invalid');
  if (!ALLOWED_EFFECT_CLASSES.includes(normalized.effect_class)) blocked.push('effect_class_not_preview_eligible');
  if (normalized.authority_delta !== 0) blocked.push('authority_delta_must_equal_zero');
  blocked.push(...boundaryAdmit.blockers);

  const { admitted, excluded } = evaluateEvidence(normalized.evidence);
  const independentEvidenceCount = admitted.filter((e) => e.independent).length;
  const processMining = buildProcessMining(normalized.receipt_refs, normalized.chat_refs);
  blocked.push(...processMining.blocked_by);

  const structuralReady = blocked.length === 0;
  const state = structuralReady ? 'STRUCTURALLY_READY_FOR_EXTERNAL_QUALIFICATION' : 'BLOCKED';
  const snr = buildSNR({
    admittedEvidenceCount: admitted.length,
    independentEvidenceCount,
    excludedEvidenceCount: excluded.length,
    blockerCount: blocked.length,
  });
  const hhmm = buildHhmmProjection({
    blocked,
    admittedEvidenceCount: admitted.length,
    independentEvidenceCount,
  });
  const hypergraph = buildHypergraph({
    creator: normalized.creator_agent_id,
    verifier: normalized.verifier_agent_id,
    missionHash: normalized.mission_contract_hash,
    profileHash: normalized.agent_profile_hash,
    verificationHash: normalized.verification_contract_hash,
    evidence: admitted,
  });
  const evidenceHashTable = buildEvidenceHashTable(admitted, excluded);
  const diffusionAttention = buildDiffusionAttention({ admitted, independentEvidenceCount, hypergraph });
  const reasoningGraph = buildInspectableReasoningGraph({ state, admitted, excluded });

  const content = {
    schema: AGENT_LAUNCHPAD_GENESIS_PREVIEW_SCHEMA,
    truth_label: AGENT_LAUNCHPAD_GENESIS_PREVIEW_TRUTH_LABEL,
    input: normalized,
    state,
    qualification_candidate: structuralReady,
    qualification_ready: false,
    launched: false,
    launch_state: 'DESIGNED_BLOCKED_BY_PROD06_REAL_EFFECT_AND_RUNTIME_RECEIPT',
    structural_blockers: Object.freeze([...blocked]),
    admitted_evidence: admitted,
    excluded_evidence: excluded,
    mission_owner_binding: missionBind.binding,
    profile_owner_binding: profileBind.binding,
    snr,
    hhmm,
    hypergraph,
    evidence_hash_table: evidenceHashTable,
    diffusion_reasoning_amplifier: diffusionAttention,
    inspectable_reasoning_graph: reasoningGraph,
    process_mining: processMining,
    consent: {
      self_consent: false,
      human_consent_manufactured: false,
      exact_human_grant_required_for_consequential_effect: true,
      status: 'NOT_CONSUMED_IN_PREVIEW',
    },
    self_critique: {
      can_hold: true,
      can_grant: false,
      findings: Object.freeze([
        admitted.length === 0 ? 'no_admitted_evidence' : null,
        independentEvidenceCount === 0 ? 'no_declared_independent_evidence' : null,
        missionBind.binding.ok
          ? 'mission_owner_bound_via_canonical_json_v1'
          : 'mission_owner_binding_blocked',
        profileBind.binding.ok
          ? 'profile_owner_bound_via_stable_identity_hash'
          : 'profile_owner_binding_blocked',
        'verification_subject_binding_still_open',
        'causal_independence_not_established_by_agent_ids',
        structuralReady ? null : 'structural_or_constitutional_blocker_present',
      ].filter(Boolean)),
    },
    self_compliance: {
      authority_delta_zero: normalized.authority_delta === 0,
      canonical_pat_creator: PAT_IDS.includes(normalized.creator_agent_id),
      canonical_sat_verifier: SAT_IDS.includes(normalized.verifier_agent_id),
      canonical_mission_owner_used: missionBind.binding.ok === true,
      canonical_profile_owner_used: profileBind.binding.ok === true,
      caller_hash_cannot_self_attest: true,
      no_protected_act: Object.getOwnPropertyNames(normalized.requested_boundaries).every(
        (k) => ALLOWED_REQUESTED_BOUNDARY_SET.has(k) && normalized.requested_boundaries[k] === false,
      ),
      may_refuse: true,
      may_grant_authority: false,
    },
    pulse: {
      verified: false,
      status: 'NOT_VERIFIED',
      blocked_by: Object.freeze([
        'prod06_real_effect_not_bound',
        'human_grant_not_consumed',
        'fate_admission_not_consumed',
        'independent_postcondition_not_bound',
        'trusted_runtime_receipt_not_bound',
        'restart_exactly_once_not_bound',
        'human_usefulness_not_measured',
      ]),
    },
    proof_of_truth_convergence: {
      formal: structuralReady ? 2 : 1,
      cryptographic: missionBind.binding.ok ? 2 : 0,
      empirical: 0,
      economic: 0,
      level: missionBind.binding.ok ? 2 : 1,
      ceiling: missionBind.binding.ok
        ? 'MISSION_OWNER_BOUND_PREVIEW_STILL_NO_PROD06_LAUNCH'
        : 'IMPLEMENTED_PREVIEW_CONTRACT_ONLY_NO_CANONICAL_BINDING',
    },
    boundary: boundary(),
    what_this_proves: [
      'A launch-capsule proposal can be structurally constrained to one canonical PAT id, one canonical SAT id, a mission contract body re-sealed by the canonical mission-contract owner, a profile identity body re-hashed by the canonical agent-profile stable-hash owner, a verification digest field, a bounded effect class, evidence identities, and a zero-authority-delta contract.',
      'Caller-supplied mission_contract_hash or agent_profile_hash alone cannot self-attest: missing/mismatched bodies block STRUCTURALLY_READY.',
      'Duplicate or structurally unbound evidence cannot increase the preview evidence count.',
      'SNR, HHMM, content-addressed hash indexing, diffusion attention, hypergraph, process mining, self-critique, and self-compliance remain advisory/projection layers outside the authority path.',
    ],
    what_this_does_not_prove: [
      'Profile-owner and mission-owner binds do not prove verifier causal independence, semantic admission, signed profile trust, or PROD-06 readiness.',
      'No agent has been launched or executed.',
      'No human consent or FATE admission has been created or consumed.',
      'No governed runtime/effect receipt has been issued.',
      'No Proof-of-Impact, reward, token, marketplace, federation, or public identity is live.',
      'QUALIFICATION_READY is not PROD-06 readiness and is not Node0 closure.',
    ],
  };

  const report_hash = sha256Canonical(content);
  return deepFreeze({ ...content, report_hash });
}

export function verifyAgentLaunchpadGenesisPreview(report) {
  const blocked_by = [];
  if (!report || report.schema !== AGENT_LAUNCHPAD_GENESIS_PREVIEW_SCHEMA) {
    return Object.freeze({ ok: false, blocked_by: ['invalid_schema'] });
  }
  if (report.truth_label !== AGENT_LAUNCHPAD_GENESIS_PREVIEW_TRUTH_LABEL) {
    blocked_by.push('invalid_truth_label');
  }
  if (!report.input || typeof report.input !== 'object') {
    blocked_by.push('input_missing');
  } else {
    const rebuilt = buildAgentLaunchpadGenesisPreview(report.input);
    if (rebuilt.report_hash !== report.report_hash) {
      blocked_by.push('semantic_rederivation_mismatch');
    }
    // Bind submitted body (excluding report_hash) to the rebuilt body so a
    // caller cannot forge qualification_ready/launched/etc. while keeping the
    // original report_hash that only covers the honest rebuild path.
    const { report_hash: _submittedHash, ...submittedBody } = report;
    const { report_hash: _rebuiltHash, ...rebuiltBody } = rebuilt;
    if (sha256Canonical(submittedBody) !== sha256Canonical(rebuiltBody)) {
      blocked_by.push('report_body_mismatch');
    }
  }
  if (report.launched !== false) blocked_by.push('preview_cannot_be_launched');
  if (report.qualification_ready !== false) {
    blocked_by.push('qualification_ready_must_be_false');
  }
  if (report.boundary && Object.values(report.boundary).some((v) => v !== false)) {
    blocked_by.push('boundary_not_false');
  }
  return Object.freeze({
    ok: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
    verification_mode: 'semantic_rederivation_v0_1',
    authority_eligible: false,
  });
}

export const CANONICAL_LAUNCHPAD_PAT_IDS = PAT_IDS;
export const CANONICAL_LAUNCHPAD_SAT_IDS = SAT_IDS;
