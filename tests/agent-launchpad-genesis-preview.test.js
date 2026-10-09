import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAgentLaunchpadGenesisPreview,
  verifyAgentLaunchpadGenesisPreview,
  AGENT_LAUNCHPAD_MISSION_OWNER,
  AGENT_LAUNCHPAD_PROFILE_OWNER,
} from '../packages/core/src/agent-launchpad-genesis-preview.js';
import {
  createMissionContract,
  inspectMissionContractFields,
  isCreatedMissionContract,
  isMissionContractInspection,
  MISSION_CONTRACT_GO_PHRASE,
  MISSION_CONTRACT_INSPECTION_SCHEMA,
} from '../packages/core/src/mission-contract-state.js';
import {
  AGENT_PROFILE_SCHEMA,
  computeStableProfileHash,
} from '../packages/agents/src/agent-profile-registry.js';
import { sha256CanonicalJsonV1 } from '../packages/canon/src/sha256-canonical-json-v1.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const H = (ch) => `sha256:${ch.repeat(64)}`;

const MISSION_FIELDS = Object.freeze({
  mission_id: 'MISSION-LAUNCHPAD-1C',
  purpose: 'Bind launchpad mission hash to canonical owner',
  scope: 'packages/core/src preview only',
  acceptance_contract: Object.freeze({
    required_output_keys: Object.freeze(['patch', 'test_result']),
    forbidden_substrings: Object.freeze(['TODO']),
  }),
  acceptance_criteria: Object.freeze(['focused test green']),
  prohibited_outcomes: Object.freeze(['push', 'merge', 'mint']),
  authority_ceiling: 'local_reversible',
  iteration_budget: 2,
  completion_conditions: Object.freeze(['all acceptance criteria met']),
  escalation_rule: 'halt_and_report',
  created_at_iso: '2026-10-08T00:00:00.000Z',
});

function sealedMission() {
  return createMissionContract({
    fields: { ...MISSION_FIELDS, acceptance_criteria: [...MISSION_FIELDS.acceptance_criteria] },
    consent: MISSION_CONTRACT_GO_PHRASE,
  });
}

function sealedProfile(creator = 'pat.builder') {
  const [, roleRaw] = creator.split('.');
  const agent_role = roleRaw.charAt(0).toUpperCase() + roleRaw.slice(1);
  const agent_profile = {
    schema: AGENT_PROFILE_SCHEMA,
    agent_id: creator,
    agent_class: 'PAT',
    agent_role,
    created_at_iso: '2026-10-08T00:00:00.000Z',
  };
  return {
    agent_profile,
    agent_profile_hash: `sha256:${computeStableProfileHash(agent_profile)}`,
  };
}

const base = () => {
  const mission = sealedMission();
  const profile = sealedProfile();
  return {
    capsule_id: 'capsule.research-cartographer.v0.1',
    creator_agent_id: 'pat.builder',
    verifier_agent_id: 'sat.verifier',
    ...profile,
    mission_contract: mission.contract,
    mission_contract_hash: mission.contract_hash,
    verification_contract_hash: H('c'),
    effect_class: 'C2_DRAFT',
    authority_delta: 0,
    evidence: [
      {
        id: 'e1', kind: 'test', ref: 'tests/example.test.js', digest: H('d'),
        epistemic: 'MEASURED', freshness: 'CURRENT', independent: false, scope_match: true,
      },
      {
        id: 'e2', kind: 'sat', ref: 'receipt/sat.json', digest: H('e'),
        epistemic: 'VERIFIED', freshness: 'CURRENT', independent: true, scope_match: true,
      },
    ],
    receipt_refs: [H('f')],
    requested_boundaries: {},
  };
};

test('valid capsule becomes structural candidate but never QUALIFICATION_READY or LAUNCHED', () => {
  const r = buildAgentLaunchpadGenesisPreview(base());
  assert.equal(r.state, 'STRUCTURALLY_READY_FOR_EXTERNAL_QUALIFICATION');
  assert.equal(r.qualification_candidate, true);
  assert.equal(r.qualification_ready, false);
  assert.equal(r.launched, false);
  assert.equal(r.mission_owner_binding.ok, true);
  assert.equal(r.mission_owner_binding.owner, AGENT_LAUNCHPAD_MISSION_OWNER);
  assert.equal(r.profile_owner_binding.ok, true);
  assert.equal(r.profile_owner_binding.owner, AGENT_LAUNCHPAD_PROFILE_OWNER);
  assert.equal(r.self_compliance.canonical_mission_owner_used, true);
  assert.equal(r.self_compliance.canonical_profile_owner_used, true);
  assert.equal(verifyAgentLaunchpadGenesisPreview(r).ok, true);
});

test('1D hash-only profile digest cannot self-attest', () => {
  const i = base();
  delete i.agent_profile;
  const r = buildAgentLaunchpadGenesisPreview(i);
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.profile_owner_binding.ok, false);
  assert.equal(r.self_compliance.canonical_profile_owner_used, false);
});

test('1D profile body for a different agent than creator is BLOCKED', () => {
  const i = base();
  i.agent_profile = { ...i.agent_profile, agent_id: 'pat.critic', agent_role: 'Critic' };
  i.agent_profile_hash = `sha256:${computeStableProfileHash(i.agent_profile)}`;
  const r = buildAgentLaunchpadGenesisPreview(i);
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.profile_owner_binding.ok, false);
});

test('1D profile shape/schema/created_at refusals stay owner-bound fail-closed', () => {
  for (const patch of [
    { agent_profile: ['not-an-object'] },
    { agent_profile: { ...sealedProfile().agent_profile, schema: 'wrong.schema' } },
    { agent_profile: { ...sealedProfile().agent_profile, created_at_iso: '   ' } },
  ]) {
    const r = buildAgentLaunchpadGenesisPreview({ ...base(), ...patch });
    assert.equal(r.state, 'BLOCKED', JSON.stringify(patch.agent_profile?.schema ?? patch.agent_profile));
    assert.equal(r.profile_owner_binding.ok, false);
    assert.equal(r.qualification_ready, false);
    assert.equal(r.launched, false);
  }
});

test('1C hash-only mission digest cannot self-attest', () => {
  const i = base();
  delete i.mission_contract;
  const r = buildAgentLaunchpadGenesisPreview(i);
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.qualification_candidate, false);
  assert.equal(r.mission_owner_binding.ok, false);
  assert.equal(r.self_compliance.canonical_mission_owner_used, false);
  assert.equal(r.self_compliance.caller_hash_cannot_self_attest, true);
});

test('1C mismatched mission body vs claimed hash is BLOCKED', () => {
  const i = base();
  i.mission_contract_hash = H('9');
  const r = buildAgentLaunchpadGenesisPreview(i);
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.mission_owner_binding.ok, false);
});

test('1C malformed mission shape is BLOCKED', () => {
  const i = base();
  i.mission_contract = { mission_id: 'only-one-field' };
  const r = buildAgentLaunchpadGenesisPreview(i);
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.mission_owner_binding.ok, false);
});

test('1C vacuous mission semantics are BLOCKED even when body hash matches keys-only digest', () => {
  const i = base();
  const vacuous = {
    ...i.mission_contract,
    acceptance_criteria: [],
    acceptance_contract: {},
    iteration_budget: -1,
  };
  i.mission_contract = vacuous;
  // Attacker hashes the vacuous body with the byte algorithm but skips owner validation.
  i.mission_contract_hash = sha256CanonicalJsonV1(vacuous);
  const r = buildAgentLaunchpadGenesisPreview(i);
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.mission_owner_binding.ok, false);
  assert.equal(r.qualification_candidate, false);
});

test('1C string list fields are not coerced into a different bindable body', () => {
  const i = base();
  i.mission_contract = {
    ...i.mission_contract,
    acceptance_criteria: 'green',
  };
  // Hash of the string-shaped body must not become a structural candidate via array coercion.
  i.mission_contract_hash = sha256CanonicalJsonV1(i.mission_contract);
  const r = buildAgentLaunchpadGenesisPreview(i);
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.mission_owner_binding.ok, false);
  assert.ok(r.structural_blockers.includes('mission_contract_shape_invalid'));
});

test('F1: deepFreeze seals nested hypergraph/reasoning nodes inside pre-frozen arrays', () => {
  const r = buildAgentLaunchpadGenesisPreview(base());
  assert.equal(r.state, 'STRUCTURALLY_READY_FOR_EXTERNAL_QUALIFICATION');
  assert.throws(() => { r.hypergraph.nodes[0].id = 'mutated'; }, TypeError);
  assert.throws(() => { r.hypergraph.hyperedges[0].members.push('x'); }, TypeError);
  assert.throws(() => { r.inspectable_reasoning_graph.nodes[0].id = 'mutated'; }, TypeError);
  assert.throws(() => { r.inspectable_reasoning_graph.edges[0].relation = 'mutated'; }, TypeError);
  assert.equal(verifyAgentLaunchpadGenesisPreview(r).ok, true);
});

test('F2: receipt_refs/chat_refs object entries stay caller-mutable after preview', () => {
  const receiptObj = { metadata: { note: 'draft' } };
  const chatObj = { thread: { id: 't1' } };
  const i = base();
  i.receipt_refs = [H('f'), receiptObj];
  i.chat_refs = [chatObj];
  const r = buildAgentLaunchpadGenesisPreview(i);
  assert.equal(r.state, 'BLOCKED'); // chat_refs still block process-mining path
  assert.notEqual(r.input.receipt_refs[1], receiptObj);
  assert.notEqual(r.input.chat_refs[0], chatObj);
  receiptObj.metadata.note = 'post-preview';
  chatObj.thread.id = 't2';
  assert.equal(receiptObj.metadata.note, 'post-preview');
  assert.equal(chatObj.thread.id, 't2');
  assert.equal(r.input.receipt_refs[1].metadata.note, 'draft');
  assert.equal(r.input.chat_refs[0].thread.id, 't1');
});

test('preview clones mission/profile drafts so caller objects stay mutable', () => {
  const mission = sealedMission();
  const profile = sealedProfile();
  // Fresh mutable drafts (not the already-frozen owner outputs).
  const agent_profile = {
    ...profile.agent_profile,
    skills: ['draft'],
    current_task_ownership: 'caller',
  };
  const mission_contract = {
    ...MISSION_FIELDS,
    acceptance_criteria: [...MISSION_FIELDS.acceptance_criteria],
    prohibited_outcomes: [...MISSION_FIELDS.prohibited_outcomes],
    completion_conditions: [...MISSION_FIELDS.completion_conditions],
    acceptance_contract: { ...MISSION_FIELDS.acceptance_contract },
  };
  const i = {
    ...base(),
    agent_profile,
    agent_profile_hash: `sha256:${computeStableProfileHash(agent_profile)}`,
    mission_contract,
    mission_contract_hash: mission.contract_hash,
  };
  const r = buildAgentLaunchpadGenesisPreview(i);
  assert.equal(r.state, 'STRUCTURALLY_READY_FOR_EXTERNAL_QUALIFICATION');
  agent_profile.skills.push('post-preview');
  agent_profile.current_task_ownership = 'still-caller';
  mission_contract.acceptance_criteria.push('post-preview');
  assert.deepEqual(agent_profile.skills, ['draft', 'post-preview']);
  assert.equal(agent_profile.current_task_ownership, 'still-caller');
  assert.ok(mission_contract.acceptance_criteria.includes('post-preview'));
  assert.equal(r.input.agent_profile.skills.length, 1);
  assert.notEqual(r.input.agent_profile, agent_profile);
  assert.notEqual(r.input.mission_contract, mission_contract);
});

test('structural blockers name verification digest and effect-class refusals', () => {
  const badDigest = buildAgentLaunchpadGenesisPreview({
    ...base(),
    verification_contract_hash: 'not-a-digest',
  });
  assert.equal(badDigest.state, 'BLOCKED');
  assert.ok(badDigest.structural_blockers.includes('verification_contract_hash_invalid'));

  const badEffect = buildAgentLaunchpadGenesisPreview({
    ...base(),
    effect_class: 'C9_FORBIDDEN',
  });
  assert.equal(badEffect.state, 'BLOCKED');
  assert.ok(badEffect.structural_blockers.includes('effect_class_not_preview_eligible'));
});

test('duplicate evidence ids keep distinct excluded hash-table entries', () => {
  const i = base();
  i.evidence = [
    {
      id: 'dup', kind: 'test', ref: '', digest: H('1'),
      epistemic: 'MEASURED', freshness: 'CURRENT', independent: false, scope_match: false,
    },
    {
      id: 'dup', kind: 'test', ref: 'tests/x.test.js', digest: 'bad',
      epistemic: 'MEASURED', freshness: 'CURRENT', independent: false, scope_match: false,
    },
    {
      id: 'dup#1', kind: 'test', ref: '', digest: 'also-bad',
      epistemic: 'MEASURED', freshness: 'CURRENT', independent: false, scope_match: false,
    },
  ];
  const r = buildAgentLaunchpadGenesisPreview(i);
  assert.equal(r.excluded_evidence.length, 3);
  assert.ok(r.evidence_hash_table.table['excluded:dup']);
  assert.ok(r.evidence_hash_table.table['excluded:dup#1']);
  assert.ok(r.evidence_hash_table.table['excluded:dup#1#2']);
  assert.ok(r.evidence_hash_table.table['excluded:dup'].gaps.includes('ref_missing'));
  assert.ok(r.evidence_hash_table.table['excluded:dup#1'].gaps.includes('digest_missing_or_malformed'));
});

test('clonePlain preserves own __proto__ data keys for mission nesting', () => {
  const mission_contract = {
    ...MISSION_FIELDS,
    acceptance_criteria: [...MISSION_FIELDS.acceptance_criteria],
    prohibited_outcomes: [...MISSION_FIELDS.prohibited_outcomes],
    completion_conditions: [...MISSION_FIELDS.completion_conditions],
    acceptance_contract: {
      ...MISSION_FIELDS.acceptance_contract,
      expected: JSON.parse('{"__proto__":"ok"}'),
    },
  };
  // Re-seal with the __proto__ data key so claimed hash matches owner output.
  const sealed = createMissionContract({
    fields: mission_contract,
    consent: MISSION_CONTRACT_GO_PHRASE,
  });
  const i = {
    ...base(),
    mission_contract,
    mission_contract_hash: sealed.contract_hash,
  };
  const r = buildAgentLaunchpadGenesisPreview(i);
  assert.equal(r.state, 'STRUCTURALLY_READY_FOR_EXTERNAL_QUALIFICATION');
  assert.equal(
    Object.prototype.hasOwnProperty.call(r.input.mission_contract.acceptance_contract.expected, '__proto__')
      || Object.getOwnPropertyDescriptor(r.input.mission_contract.acceptance_contract.expected, '__proto__') != null
      || r.input.mission_contract.acceptance_contract.expected['__proto__'] === 'ok',
    true,
  );
  assert.equal(r.mission_owner_binding.ok, true);
});

test('unknown thirteenth agent cannot become creator', () => {
  const i = base();
  i.creator_agent_id = 'pat.thirteenth';
  const r = buildAgentLaunchpadGenesisPreview(i);
  assert.equal(r.state, 'BLOCKED');
});

test('SAT cannot be creator of user-facing launch capsule', () => {
  const i = base();
  i.creator_agent_id = 'sat.verifier';
  const r = buildAgentLaunchpadGenesisPreview(i);
  assert.equal(r.state, 'BLOCKED');
});

test('authority growth blocks qualification', () => {
  const i = base();
  i.authority_delta = 1;
  const r = buildAgentLaunchpadGenesisPreview(i);
  assert.equal(r.state, 'BLOCKED');
});

test('economic/public/federation requests fail closed', () => {
  for (const key of ['mint', 'reward_settlement', 'federation', 'public_launch', 'signer_or_key', 'dema_home_mutation']) {
    const i = base();
    i.requested_boundaries = { [key]: true };
    const r = buildAgentLaunchpadGenesisPreview(i);
    assert.equal(r.state, 'BLOCKED');
  }
});

test('duplicate evidence digest adds zero epistemic weight', () => {
  const i = base();
  i.evidence.push({
    id: 'e3', kind: 'test', ref: 'tests/dup.test.js', digest: H('d'),
    epistemic: 'MEASURED', freshness: 'CURRENT', independent: false, scope_match: true,
  });
  const r = buildAgentLaunchpadGenesisPreview(i);
  assert.equal(r.admitted_evidence.length, 2);
  assert.ok(r.excluded_evidence.some((e) => e.id === 'e3'));
});

test('caller truth label without binding is excluded', () => {
  const i = base();
  i.evidence.push({
    id: 'eX', kind: 'claim', ref: 'x', digest: H('7'),
    epistemic: 'UNKNOWN', freshness: 'CURRENT', independent: true, scope_match: true,
  });
  const r = buildAgentLaunchpadGenesisPreview(i);
  assert.ok(r.excluded_evidence.some((e) => e.id === 'eX'));
});

test('chat history is refused as process-mining operational truth', () => {
  const i = base();
  i.chat_refs = ['chat://thread-1'];
  const r = buildAgentLaunchpadGenesisPreview(i);
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.process_mining.chat_history_used, false);
});

test('HHMM and SNR are advisory only', () => {
  const r = buildAgentLaunchpadGenesisPreview(base());
  assert.ok(r.hhmm);
  assert.ok(r.snr);
  assert.equal(r.qualification_ready, false);
  assert.equal(r.launched, false);
});

test('self-consent is impossible in preview', () => {
  const r = buildAgentLaunchpadGenesisPreview(base());
  assert.equal(r.consent.self_consent, false);
  assert.equal(r.consent.human_consent_manufactured, false);
});

test('tampered report fails semantic re-derivation', () => {
  const r = buildAgentLaunchpadGenesisPreview(base());
  const forged = { ...r, launched: true, report_hash: r.report_hash };
  assert.equal(verifyAgentLaunchpadGenesisPreview(forged).ok, false);
});

test('forged qualification_ready fails body-bound verify even with original report_hash', () => {
  const r = buildAgentLaunchpadGenesisPreview(base());
  const forged = { ...r, qualification_ready: true };
  const v = verifyAgentLaunchpadGenesisPreview(forged);
  assert.equal(v.ok, false);
  assert.ok(
    v.blocked_by.includes('report_body_mismatch')
      || v.blocked_by.includes('qualification_ready_must_be_false'),
  );
});

test('verify fails closed on invalid schema, truth label, missing input, hash mismatch, and boundary poison', () => {
  assert.equal(verifyAgentLaunchpadGenesisPreview(null).ok, false);
  assert.deepEqual(verifyAgentLaunchpadGenesisPreview({ schema: 'nope' }).blocked_by, ['invalid_schema']);

  const r = buildAgentLaunchpadGenesisPreview(base());
  assert.ok(verifyAgentLaunchpadGenesisPreview({ ...r, truth_label: 'WRONG' }).blocked_by.includes('invalid_truth_label'));
  assert.ok(verifyAgentLaunchpadGenesisPreview({ ...r, input: null }).blocked_by.includes('input_missing'));
  assert.ok(
    verifyAgentLaunchpadGenesisPreview({ ...r, report_hash: H('0') }).blocked_by.includes('semantic_rederivation_mismatch'),
  );
  assert.ok(
    verifyAgentLaunchpadGenesisPreview({
      ...r,
      boundary: { ...r.boundary, network_used: true },
    }).blocked_by.includes('boundary_not_false'),
  );
});

test('non-independent admitted evidence projects HHMM L0 as OBSERVED', () => {
  const i = base();
  i.evidence = [
    {
      id: 'e1', kind: 'test', ref: 'tests/example.test.js', digest: H('d'),
      epistemic: 'MEASURED', freshness: 'CURRENT', independent: false, scope_match: true,
    },
  ];
  const r = buildAgentLaunchpadGenesisPreview(i);
  assert.equal(r.hhmm.L0_evidence, 'OBSERVED');
});

test('unknown verifier SAT id is BLOCKED', () => {
  const i = base();
  i.verifier_agent_id = 'sat.not-a-canonical';
  const r = buildAgentLaunchpadGenesisPreview(i);
  assert.equal(r.state, 'BLOCKED');
});

test('empty evidence yields UNKNOWN HHMM L0 and zero SNR score branch', () => {
  const i = base();
  i.evidence = [];
  i.receipt_refs = [];
  const r = buildAgentLaunchpadGenesisPreview(i);
  assert.equal(r.hhmm.L0_evidence, 'UNKNOWN');
  assert.equal(r.snr.score, 0);
  assert.equal(r.process_mining.result, 'NO_ADMISSIBLE_TRACE_SET');
});

test('bare hex digests and non-array evidence/receipts normalize without throwing', () => {
  const i = base();
  const bare = 'f'.repeat(64);
  i.agent_profile_hash = i.agent_profile_hash.replace(/^sha256:/, '');
  i.verification_contract_hash = bare;
  i.mission_contract_hash = i.mission_contract_hash.replace(/^sha256:/, '');
  i.evidence = [
    {
      id: 'e1', kind: 'test', ref: 'tests/example.test.js', digest: bare,
      epistemic: 'MEASURED', freshness: 'CURRENT', independent: true, scope_match: true,
    },
  ];
  i.receipt_refs = [bare, 12, null];
  const r = buildAgentLaunchpadGenesisPreview(i);
  assert.equal(r.state, 'STRUCTURALLY_READY_FOR_EXTERNAL_QUALIFICATION');
  assert.equal(r.admitted_evidence[0].digest, `sha256:${bare}`);
  assert.equal(r.process_mining.result, 'CANDIDATE_TRACE_SET');
});

test('shape and effect refusals cover remaining blocked branches', () => {
  for (const patch of [
    { capsule_id: '' },
    { agent_profile_hash: 'not-a-digest' },
    { effect_class: 'C9_FORBIDDEN' },
    { mission_contract: ['array'] },
  ]) {
    const r = buildAgentLaunchpadGenesisPreview({ ...base(), ...patch });
    assert.equal(r.state, 'BLOCKED', JSON.stringify(patch));
  }
  const nonArrayEvidence = buildAgentLaunchpadGenesisPreview({ ...base(), evidence: { not: 'array' } });
  assert.equal(Array.isArray(nonArrayEvidence.admitted_evidence), true);
  assert.equal(nonArrayEvidence.admitted_evidence.length, 0);
});

test('public preview boundary remains all false', () => {
  const r = buildAgentLaunchpadGenesisPreview(base());
  assert.ok(Object.values(r.boundary).every((v) => v === false));
});

test('hash table is content-addressed and duplicate evidence has no second admitted key', () => {
  const i = base();
  const before = buildAgentLaunchpadGenesisPreview(i);
  const digests = before.admitted_evidence.map((e) => e.digest);
  assert.ok(digests.length >= 1);
  for (const digest of digests) {
    assert.equal(before.evidence_hash_table.table[digest]?.admitted_for_attention, true);
  }
  i.evidence.push({
    id: 'e-dup', kind: 'test', ref: 'tests/dup2.test.js', digest: digests[0],
    epistemic: 'MEASURED', freshness: 'CURRENT', independent: true, scope_match: true,
  });
  const after = buildAgentLaunchpadGenesisPreview(i);
  assert.equal(after.admitted_evidence.length, before.admitted_evidence.length);
  assert.ok(after.excluded_evidence.some((e) => e.gaps?.includes('duplicate_evidence_digest')));
  assert.equal(after.snr.signal, before.snr.signal);
});

test('diffusion changes attention only, never truth or consent', () => {
  const low = buildAgentLaunchpadGenesisPreview({ ...base(), evidence: [] });
  const high = buildAgentLaunchpadGenesisPreview(base());
  assert.ok(high.diffusion_reasoning_amplifier.mission_attention > low.diffusion_reasoning_amplifier.mission_attention);
  assert.equal(high.diffusion_reasoning_amplifier.may_change_truth_label, false);
  assert.equal(high.diffusion_reasoning_amplifier.may_change_consent, false);
  assert.equal(high.consent.self_consent, false);
});

test('reasoning graph is inspectable audit structure, not authority', () => {
  const r = buildAgentLaunchpadGenesisPreview(base());
  assert.equal(r.inspectable_reasoning_graph.authority, 'NONE');
});

// ── AGENT-LAUNCHPAD-NO-SYNTHETIC-CONSENT-1A ───────────────────────────────────
test('1A: Launchpad source path does not synthesize MISSION_CONTRACT_GO_PHRASE', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(
    join(here, '../packages/core/src/agent-launchpad-genesis-preview.js'),
    'utf8',
  );
  assert.equal(src.includes('MISSION_CONTRACT_GO_PHRASE'), false);
  assert.equal(/createMissionContract\s*\(/.test(src), false);
  assert.match(src, /inspectMissionContractFields/);
});

test('1A: unconsented draft with matching inspect hash can owner-bind structurally', () => {
  const fields = {
    ...MISSION_FIELDS,
    acceptance_criteria: [...MISSION_FIELDS.acceptance_criteria],
    prohibited_outcomes: [...MISSION_FIELDS.prohibited_outcomes],
    completion_conditions: [...MISSION_FIELDS.completion_conditions],
  };
  const inspected = inspectMissionContractFields({ fields });
  const i = base();
  i.mission_contract = fields;
  i.mission_contract_hash = inspected.contract_hash;
  const r = buildAgentLaunchpadGenesisPreview(i);
  assert.equal(r.mission_owner_binding.ok, true);
  assert.equal(r.mission_owner_binding.validation_only, true);
  assert.equal(r.mission_owner_binding.human_consent_established, false);
  assert.equal(r.mission_owner_binding.creation_authorized, false);
  assert.equal(r.mission_owner_binding.owner, AGENT_LAUNCHPAD_MISSION_OWNER);
  assert.match(AGENT_LAUNCHPAD_MISSION_OWNER, /#inspectMissionContractFields$/);
  assert.equal(r.launched, false);
  assert.equal(r.qualification_ready, false);
  assert.equal(r.boundary.human_consent_manufactured, false);
  assert.equal(r.self_compliance.may_grant_authority, false);
});

test('1A: structural owner bind does not launch or authorize creation', () => {
  const r = buildAgentLaunchpadGenesisPreview(base());
  assert.equal(r.mission_owner_binding.ok, true);
  assert.equal(r.mission_owner_binding.validation_only, true);
  assert.equal(r.mission_owner_binding.human_consent_established, false);
  assert.equal(r.mission_owner_binding.creation_authorized, false);
  assert.equal(r.launched, false);
  assert.equal(r.qualification_ready, false);
  assert.equal(r.input.authority_delta, 0);
  assert.equal(r.consent.status, 'NOT_CONSUMED_IN_PREVIEW');
});

test('1C: Launchpad inspect path uses inspection envelope, not created-contract schema', () => {
  const fields = {
    ...MISSION_FIELDS,
    acceptance_criteria: [...MISSION_FIELDS.acceptance_criteria],
    prohibited_outcomes: [...MISSION_FIELDS.prohibited_outcomes],
    completion_conditions: [...MISSION_FIELDS.completion_conditions],
  };
  const inspected = inspectMissionContractFields({ fields });
  assert.equal(isMissionContractInspection(inspected), true);
  assert.equal(isCreatedMissionContract(inspected), false);
  assert.equal(inspected.schema, MISSION_CONTRACT_INSPECTION_SCHEMA);
  const i = base();
  i.mission_contract = fields;
  i.mission_contract_hash = inspected.contract_hash;
  const r = buildAgentLaunchpadGenesisPreview(i);
  assert.equal(r.mission_owner_binding.ok, true);
  assert.equal(r.mission_owner_binding.creation_authorized, false);
  assert.equal(r.launched, false);
  assert.equal(r.qualification_ready, false);
  assert.equal(r.input.authority_delta, 0);
});

// ── DEMA-PR490-F4-UNKNOWN-BOUNDARY-REJECTION-1A ───────────────────────────────
test('F4: unknown authority keys true are BLOCKED and retained for rederivation', () => {
  for (const key of ['network', 'runtime_execution', 'push', 'deployment']) {
    const i = base();
    i.requested_boundaries = { [key]: true };
    const r = buildAgentLaunchpadGenesisPreview(i);
    assert.equal(r.state, 'BLOCKED');
    assert.ok(r.structural_blockers.includes(`unknown_requested_boundary:${key}`));
    assert.equal(r.input.requested_boundaries[key], true);
    assert.equal(r.launched, false);
    assert.equal(r.qualification_ready, false);
    assert.equal(verifyAgentLaunchpadGenesisPreview(r).ok, true);
  }
});

test('F4: unknown authority keys false are still BLOCKED (no silent drop)', () => {
  const i = base();
  i.requested_boundaries = { network: false };
  const r = buildAgentLaunchpadGenesisPreview(i);
  assert.equal(r.state, 'BLOCKED');
  assert.ok(r.structural_blockers.includes('unknown_requested_boundary:network'));
  assert.equal(r.input.requested_boundaries.network, false);
  assert.equal(verifyAgentLaunchpadGenesisPreview(r).ok, true);
});

test('F4: known keys false are allowed; known true remains forbidden', () => {
  const allowed = buildAgentLaunchpadGenesisPreview({
    ...base(),
    requested_boundaries: {
      mint: false,
      reward_settlement: false,
      federation: false,
      public_launch: false,
      signer_or_key: false,
      dema_home_mutation: false,
    },
  });
  assert.equal(allowed.state, 'STRUCTURALLY_READY_FOR_EXTERNAL_QUALIFICATION');
  assert.equal(allowed.self_compliance.no_protected_act, true);
  assert.equal(verifyAgentLaunchpadGenesisPreview(allowed).ok, true);

  const blocked = buildAgentLaunchpadGenesisPreview({
    ...base(),
    requested_boundaries: { mint: true },
  });
  assert.equal(blocked.state, 'BLOCKED');
  assert.ok(blocked.structural_blockers.includes('forbidden_boundary_requested:mint'));
});

test('F4: non-boolean boundary values refuse without coercion', () => {
  for (const value of ['true', 1, null, undefined, {}, []]) {
    const i = base();
    i.requested_boundaries = { mint: value };
    const r = buildAgentLaunchpadGenesisPreview(i);
    assert.equal(r.state, 'BLOCKED', `value=${JSON.stringify(value)}`);
    assert.ok(r.structural_blockers.includes('requested_boundary_value_invalid:mint'));
    if (value === undefined) {
      assert.equal(
        r.input.requested_boundaries.mint.__dema_requested_boundary_value_invalid_v1,
        'undefined',
      );
    } else if (value !== null && typeof value === 'object') {
      assert.notEqual(r.input.requested_boundaries.mint, value);
      assert.deepEqual(
        Object.getOwnPropertyNames(r.input.requested_boundaries.mint).sort(),
        Object.getOwnPropertyNames(value).sort(),
      );
      for (const k of Object.getOwnPropertyNames(value)) {
        assert.equal(r.input.requested_boundaries.mint[k], value[k]);
      }
    } else {
      assert.equal(r.input.requested_boundaries.mint, value);
    }
    assert.equal(verifyAgentLaunchpadGenesisPreview(r).ok, true);
  }
});

test('F4: malformed requested_boundaries object fails closed', () => {
  for (const bad of ['mint', 1, true, ['mint']]) {
    const i = base();
    i.requested_boundaries = bad;
    const r = buildAgentLaunchpadGenesisPreview(i);
    assert.equal(r.state, 'BLOCKED');
    assert.ok(r.structural_blockers.includes('requested_boundaries_malformed'));
    assert.equal(verifyAgentLaunchpadGenesisPreview(r).ok, true);
  }
});

test('F4: own __proto__ unknown key is refused and retained', () => {
  // Null-prototype own data key (avoid Object.defineProperty(__proto__, boolean),
  // which CodeQL flags as an invalid prototype value).
  const raw = Object.create(null);
  raw['__proto__'] = false;
  const i = base();
  i.requested_boundaries = raw;
  const r = buildAgentLaunchpadGenesisPreview(i);
  assert.equal(r.state, 'BLOCKED');
  assert.ok(r.structural_blockers.includes('unknown_requested_boundary:__proto__'));
  assert.equal(Object.getOwnPropertyDescriptor(r.input.requested_boundaries, '__proto__')?.value, false);
  assert.equal(verifyAgentLaunchpadGenesisPreview(r).ok, true);
});

test('F4: object boundary values are cloned; undefined survives JSON round-trip verify', () => {
  const draft = { note: 'draft' };
  const withObj = buildAgentLaunchpadGenesisPreview({
    ...base(),
    requested_boundaries: { mint: draft },
  });
  assert.equal(withObj.state, 'BLOCKED');
  assert.notEqual(withObj.input.requested_boundaries.mint, draft);
  draft.note = 'post-preview';
  assert.equal(withObj.input.requested_boundaries.mint.note, 'draft');
  assert.equal(verifyAgentLaunchpadGenesisPreview(withObj).ok, true);

  const withUndef = buildAgentLaunchpadGenesisPreview({
    ...base(),
    requested_boundaries: { mint: undefined },
  });
  assert.equal(withUndef.state, 'BLOCKED');
  const roundTrip = JSON.parse(JSON.stringify(withUndef));
  assert.equal(verifyAgentLaunchpadGenesisPreview(roundTrip).ok, true);
});

test('F4: boundary refusal survives rederivation; tamper is rejected', () => {
  const i = base();
  i.requested_boundaries = { push: true };
  const r = buildAgentLaunchpadGenesisPreview(i);
  assert.equal(r.state, 'BLOCKED');
  assert.equal(verifyAgentLaunchpadGenesisPreview(r).ok, true);

  const laundered = {
    ...r,
    state: 'STRUCTURALLY_READY_FOR_EXTERNAL_QUALIFICATION',
    qualification_candidate: true,
    structural_blockers: [],
  };
  assert.equal(verifyAgentLaunchpadGenesisPreview(laundered).ok, false);
});

test('F4: empty and omitted requested_boundaries keep valid preview; no authority elevation', () => {
  const empty = buildAgentLaunchpadGenesisPreview(base());
  assert.equal(empty.state, 'STRUCTURALLY_READY_FOR_EXTERNAL_QUALIFICATION');
  assert.equal(empty.launched, false);
  assert.equal(empty.qualification_ready, false);
  assert.equal(empty.mission_owner_binding.human_consent_established, false);
  assert.equal(empty.mission_owner_binding.creation_authorized, false);
  assert.equal(empty.self_compliance.may_grant_authority, false);
  assert.equal(verifyAgentLaunchpadGenesisPreview(empty).ok, true);

  const omitted = base();
  delete omitted.requested_boundaries;
  const r = buildAgentLaunchpadGenesisPreview(omitted);
  assert.equal(r.state, 'STRUCTURALLY_READY_FOR_EXTERNAL_QUALIFICATION');
  assert.equal(r.launched, false);
  assert.equal(r.qualification_ready, false);
});

// ── DEMA-PR490-F4-EDGE-CLOSURE-1C ─────────────────────────────────────────────
test('F4-1C: undefined omission and empty {} remain admissible', () => {
  const omitted = base();
  delete omitted.requested_boundaries;
  const o = buildAgentLaunchpadGenesisPreview(omitted);
  assert.equal(o.state, 'STRUCTURALLY_READY_FOR_EXTERNAL_QUALIFICATION');
  assert.equal(verifyAgentLaunchpadGenesisPreview(o).ok, true);

  const empty = buildAgentLaunchpadGenesisPreview({ ...base(), requested_boundaries: {} });
  assert.equal(empty.state, 'STRUCTURALLY_READY_FOR_EXTERNAL_QUALIFICATION');
  assert.equal(verifyAgentLaunchpadGenesisPreview(empty).ok, true);
});

test('F4-1C: explicit null is malformed, retained, and verifiable', () => {
  const i = base();
  i.requested_boundaries = null;
  const r = buildAgentLaunchpadGenesisPreview(i);
  assert.equal(r.state, 'BLOCKED');
  assert.ok(r.structural_blockers.includes('requested_boundaries_malformed'));
  assert.equal(r.input.requested_boundaries.__dema_requested_boundaries_malformed_v1, true);
  assert.equal(r.launched, false);
  assert.equal(r.qualification_ready, false);
  assert.equal(verifyAgentLaunchpadGenesisPreview(r).ok, true);
});

test('F4-1C: own Symbol keys refuse with verifiable malformed marker', () => {
  for (const value of [true, false]) {
    const raw = Object.create(null);
    raw[Symbol('network')] = value;
    const i = base();
    i.requested_boundaries = raw;
    const r = buildAgentLaunchpadGenesisPreview(i);
    assert.equal(r.state, 'BLOCKED', `symbol value=${value}`);
    assert.ok(r.structural_blockers.includes('requested_boundaries_malformed'));
    assert.equal(r.input.requested_boundaries.__dema_requested_boundaries_malformed_v1, true);
    assert.equal(verifyAgentLaunchpadGenesisPreview(r).ok, true);
  }
});

test('F4-1C: non-enumerable unknown and caller marker never grant permission', () => {
  const nonEnum = Object.create(null);
  Object.defineProperty(nonEnum, 'network', {
    value: false, enumerable: false, configurable: true, writable: true,
  });
  const r1 = buildAgentLaunchpadGenesisPreview({ ...base(), requested_boundaries: nonEnum });
  assert.equal(r1.state, 'BLOCKED');
  assert.ok(r1.structural_blockers.includes('unknown_requested_boundary:network'));
  assert.equal(verifyAgentLaunchpadGenesisPreview(r1).ok, true);

  const markerOnly = Object.create(null);
  markerOnly.__dema_requested_boundaries_malformed_v1 = false;
  const r2 = buildAgentLaunchpadGenesisPreview({ ...base(), requested_boundaries: markerOnly });
  assert.equal(r2.state, 'BLOCKED');
  assert.ok(r2.structural_blockers.includes('requested_boundaries_malformed'));
  assert.equal(verifyAgentLaunchpadGenesisPreview(r2).ok, true);
});

test('F4-1C: throwing getter never yields READY; tamper of BLOCKED fails verify', () => {
  const raw = Object.create(null);
  Object.defineProperty(raw, 'mint', {
    enumerable: true, configurable: true,
    get() { throw new Error('getter_trap'); },
  });
  let threw = false;
  try {
    buildAgentLaunchpadGenesisPreview({ ...base(), requested_boundaries: raw });
  } catch (e) {
    threw = e?.message === 'getter_trap';
  }
  assert.equal(threw, true);

  const blocked = buildAgentLaunchpadGenesisPreview({
    ...base(),
    requested_boundaries: { push: true },
  });
  assert.equal(blocked.state, 'BLOCKED');
  assert.equal(verifyAgentLaunchpadGenesisPreview(blocked).ok, true);
  assert.equal(verifyAgentLaunchpadGenesisPreview({
    ...blocked,
    state: 'STRUCTURALLY_READY_FOR_EXTERNAL_QUALIFICATION',
    qualification_candidate: true,
    structural_blockers: [],
  }).ok, false);
});
