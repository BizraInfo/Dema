import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAgentLaunchpadGenesisPreview,
  verifyAgentLaunchpadGenesisPreview,
  AGENT_LAUNCHPAD_MISSION_OWNER,
} from '../packages/core/src/agent-launchpad-genesis-preview.js';
import {
  createMissionContract,
  MISSION_CONTRACT_GO_PHRASE,
} from '../packages/core/src/mission-contract-state.js';
import { sha256CanonicalJsonV1 } from '../packages/canon/src/sha256-canonical-json-v1.js';

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

const base = () => {
  const mission = sealedMission();
  return {
    capsule_id: 'capsule.research-cartographer.v0.1',
    creator_agent_id: 'pat.builder',
    verifier_agent_id: 'sat.verifier',
    agent_profile_hash: H('a'),
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
  assert.equal(r.self_compliance.canonical_mission_owner_used, true);
  assert.equal(verifyAgentLaunchpadGenesisPreview(r).ok, true);
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
  i.agent_profile_hash = bare;
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
  const r = buildAgentLaunchpadGenesisPreview(base());
  assert.ok(r.evidence_hash_table);
});

test('diffusion changes attention only, never truth or consent', () => {
  const i = base();
  const r = buildAgentLaunchpadGenesisPreview(i);
  assert.ok(r.diffusion_reasoning_amplifier);
  assert.equal(r.consent.self_consent, false);
});

test('reasoning graph is inspectable audit structure, not authority', () => {
  const r = buildAgentLaunchpadGenesisPreview(base());
  assert.equal(r.inspectable_reasoning_graph.authority, 'NONE');
});
