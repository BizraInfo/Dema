#!/usr/bin/env node
import {
  buildAgentLaunchpadGenesisPreview,
  verifyAgentLaunchpadGenesisPreview,
} from '../../packages/core/src/agent-launchpad-genesis-preview.js';
import {
  createMissionContract,
  MISSION_CONTRACT_GO_PHRASE,
} from '../../packages/core/src/mission-contract-state.js';

const h = (c) => `sha256:${c.repeat(64)}`;
const mission = createMissionContract({
  fields: {
    mission_id: 'MISSION-LAUNCHPAD-REVIEW',
    purpose: 'Review-gate fixture for launchpad mission-owner bind',
    scope: 'packages/core/src preview only',
    acceptance_contract: {
      required_output_keys: ['patch', 'test_result'],
      forbidden_substrings: ['TODO'],
    },
    acceptance_criteria: ['review fixture verifies'],
    prohibited_outcomes: ['push', 'merge', 'mint'],
    authority_ceiling: 'local_reversible',
    iteration_budget: 1,
    completion_conditions: ['fixture green'],
    escalation_rule: 'halt_and_report',
    created_at_iso: '2026-10-08T00:00:00.000Z',
  },
  consent: MISSION_CONTRACT_GO_PHRASE,
});

const report = buildAgentLaunchpadGenesisPreview({
  capsule_id: 'capsule.review-fixture.v0.1',
  creator_agent_id: 'pat.builder',
  verifier_agent_id: 'sat.verifier',
  agent_profile_hash: h('a'),
  mission_contract: mission.contract,
  mission_contract_hash: mission.contract_hash,
  verification_contract_hash: h('c'),
  effect_class: 'C2_DRAFT',
  authority_delta: 0,
  evidence: [],
  receipt_refs: [],
  requested_boundaries: {},
});
const verified = verifyAgentLaunchpadGenesisPreview(report);
const ok = verified.ok === true
  && report.launched === false
  && report.qualification_ready === false
  && report.mission_owner_binding?.ok === true
  && report.state === 'STRUCTURALLY_READY_FOR_EXTERNAL_QUALIFICATION';
console.log(JSON.stringify({
  ok,
  schema: report.schema,
  truth_label: report.truth_label,
  state: report.state,
  qualification_candidate: report.qualification_candidate,
  qualification_ready: report.qualification_ready,
  launched: report.launched,
  authority_delta: report.input.authority_delta,
  mission_owner_binding: report.mission_owner_binding,
  verified,
}, null, 2));
process.exit(ok ? 0 : 1);
