#!/usr/bin/env node
import {
  buildAgentLaunchpadGenesisPreview,
  verifyAgentLaunchpadGenesisPreview,
} from '../../packages/core/src/agent-launchpad-genesis-preview.js';

const h = (c) => `sha256:${c.repeat(64)}`;
const report = buildAgentLaunchpadGenesisPreview({
  capsule_id: 'capsule.review-fixture.v0.1',
  creator_agent_id: 'pat.builder',
  verifier_agent_id: 'sat.verifier',
  agent_profile_hash: h('a'),
  mission_contract_hash: h('b'),
  verification_contract_hash: h('c'),
  effect_class: 'C2_DRAFT',
  authority_delta: 0,
  evidence: [],
  receipt_refs: [],
  requested_boundaries: {},
});
const verified = verifyAgentLaunchpadGenesisPreview(report);
const ok = verified.ok === true && report.launched === false && report.qualification_ready === false;
console.log(JSON.stringify({
  ok,
  schema: report.schema,
  truth_label: report.truth_label,
  state: report.state,
  qualification_candidate: report.qualification_candidate,
  qualification_ready: report.qualification_ready,
  launched: report.launched,
  authority_delta: report.input.authority_delta,
  verified,
}, null, 2));
process.exit(ok ? 0 : 1);
