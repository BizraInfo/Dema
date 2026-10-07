import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAgentLaunchpadGenesisPreview,
  verifyAgentLaunchpadGenesisPreview,
} from '../packages/core/src/agent-launchpad-genesis-preview.js';

const H = (ch) => `sha256:${ch.repeat(64)}`;
const base = () => ({
  capsule_id: 'capsule.research-cartographer.v0.1',
  creator_agent_id: 'pat.builder',
  verifier_agent_id: 'sat.verifier',
  agent_profile_hash: H('a'),
  mission_contract_hash: H('b'),
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
});

test('valid capsule becomes structural candidate but never QUALIFICATION_READY or LAUNCHED', () => {
  const r = buildAgentLaunchpadGenesisPreview(base());
  assert.equal(r.state, 'STRUCTURALLY_READY_FOR_EXTERNAL_QUALIFICATION');
  assert.equal(r.qualification_candidate, true);
  assert.equal(r.qualification_ready, false);
  assert.equal(r.launched, false);
  assert.equal(r.pulse.verified, false);
  assert.equal(r.input.authority_delta, 0);
  assert.equal(verifyAgentLaunchpadGenesisPreview(r).ok, true);
});

test('unknown thirteenth agent cannot become creator', () => {
  const i = base();
  i.creator_agent_id = 'pat.marketing';
  const r = buildAgentLaunchpadGenesisPreview(i);
  assert.equal(r.state, 'BLOCKED');
  assert.ok(r.self_critique.findings.includes('structural_or_constitutional_blocker_present'));
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
  for (const k of ['mint', 'reward_settlement', 'federation', 'public_launch', 'signer_or_key', 'dema_home_mutation']) {
    const i = base();
    i.requested_boundaries = { [k]: true };
    const r = buildAgentLaunchpadGenesisPreview(i);
    assert.equal(r.state, 'BLOCKED', k);
  }
});

test('duplicate evidence digest adds zero epistemic weight', () => {
  const i = base();
  i.evidence.push({ ...i.evidence[0], id: 'e3' });
  const r = buildAgentLaunchpadGenesisPreview(i);
  assert.equal(r.admitted_evidence.length, 2);
  assert.equal(r.excluded_evidence.length, 1);
  assert.ok(r.excluded_evidence[0].gaps.includes('duplicate_evidence_digest'));
});

test('caller truth label without binding is excluded', () => {
  const i = base();
  i.evidence = [{
    id: 'fake', kind: 'test', ref: 'x', digest: 'bad', epistemic: 'VERIFIED',
    freshness: 'CURRENT', independent: true, scope_match: true,
  }];
  const r = buildAgentLaunchpadGenesisPreview(i);
  assert.equal(r.admitted_evidence.length, 0);
  assert.equal(r.excluded_evidence.length, 1);
});

test('chat history is refused as process-mining operational truth', () => {
  const i = base();
  i.chat_refs = ['chat://session'];
  const r = buildAgentLaunchpadGenesisPreview(i);
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.process_mining.chat_history_used, false);
});

test('HHMM and SNR are advisory only', () => {
  const r = buildAgentLaunchpadGenesisPreview(base());
  assert.equal(r.hhmm.advisory_only, true);
  assert.equal(r.hhmm.may_transition_authority, false);
  assert.equal(r.snr.ranking_only, true);
  assert.equal(r.snr.can_grant_authority, false);
});

test('self-consent is impossible in preview', () => {
  const r = buildAgentLaunchpadGenesisPreview(base());
  assert.equal(r.consent.self_consent, false);
  assert.equal(r.consent.human_consent_manufactured, false);
});

test('tampered report fails semantic re-derivation', () => {
  const r = buildAgentLaunchpadGenesisPreview(base());
  const tampered = structuredClone(r);
  tampered.state = 'LAUNCHED';
  tampered.launched = true;
  const v = verifyAgentLaunchpadGenesisPreview(tampered);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes('preview_cannot_be_launched'));
});

test('public preview boundary remains all false', () => {
  const r = buildAgentLaunchpadGenesisPreview(base());
  assert.deepEqual([...new Set(Object.values(r.boundary))], [false]);
});


test('hash table is content-addressed and duplicate evidence has no second admitted key', () => {
  const i = base();
  i.evidence.push({ ...i.evidence[0], id: 'duplicate' });
  const r = buildAgentLaunchpadGenesisPreview(i);
  const admittedKeys = Object.keys(r.evidence_hash_table.table).filter((k) => k.startsWith('sha256:'));
  assert.equal(admittedKeys.length, 2);
  assert.equal(r.evidence_hash_table.authority, 'NONE');
});

test('diffusion changes attention only, never truth or consent', () => {
  const r = buildAgentLaunchpadGenesisPreview(base());
  assert.equal(r.diffusion_reasoning_amplifier.mode, 'ATTENTION_ONLY');
  assert.equal(r.diffusion_reasoning_amplifier.may_change_truth_label, false);
  assert.equal(r.diffusion_reasoning_amplifier.may_change_consent, false);
  assert.equal(r.diffusion_reasoning_amplifier.authority_edges_diffused, false);
});

test('reasoning graph is inspectable audit structure, not authority', () => {
  const r = buildAgentLaunchpadGenesisPreview(base());
  assert.equal(r.inspectable_reasoning_graph.authority, 'NONE');
  assert.match(r.inspectable_reasoning_graph.disclosure, /NOT_PRIVATE_CHAIN_OF_THOUGHT/);
});
