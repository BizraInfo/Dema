/**
 * ADR-034 G-Ladder Layer Index Mock - Tests
 * [PROTOTYPE] [DESIGNED_NOT_LIVE] LOCAL_ONLY
 *
 * Tests the local section-1 production-checklist rollup only:
 * G-Ladder layer index, machine-readable index, claim-map, proof-gap register,
 * and release-readiness rollup.
 *
 * No G-Ladder runtime, index writer, registry, LCC aggregator, automatic layer
 * closure, delivery-check rewrite engine, claim-map writer, remote witness
 * collector, CI polling, GitHub API polling runtime, public publishing,
 * economic activation, Node1 activation, URP bridge, token logic, contracts,
 * marketplace, or Shariah-compliance claim is introduced.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createMockGLadderLayerIndex,
  loadExampleGLadderLayerIndexInput,
  G_LADDER_LAYER_INDEX_MOCK_CONSENT
} from '../scripts/g-ladder-layer-index-mock.mjs';

const forbiddenOutputKeys = [
  'index_written',
  'registry_written',
  'aggregation_performed',
  'automatic_closure_performed',
  'delivery_check_rewritten',
  'claim_map_written',
  'remote_witness_collected',
  'ci_polling_performed',
  'github_api_polling_performed',
  'datalake_synced',
  'cross_repo_write_performed',
  'runtime_bridge_active',
  'node1_sync',
  'urp_publication',
  'token_minted',
  'reward_authorized',
  'contract_call',
  'marketplace_signal',
  'public_receipt_url',
  'shariah_compliant'
];

test('requires exact consent for the G-Ladder Layer Index mock', () => {
  assert.throws(
    () => createMockGLadderLayerIndex({ requireConsent: 'GO' }, loadExampleGLadderLayerIndexInput()),
    /CONSENT_REQUIRED/
  );
});

test('emits deterministic machine-readable section-1 rollup', () => {
  const input = loadExampleGLadderLayerIndexInput();
  const first = createMockGLadderLayerIndex({ requireConsent: G_LADDER_LAYER_INDEX_MOCK_CONSENT }, input);
  const second = createMockGLadderLayerIndex({ requireConsent: G_LADDER_LAYER_INDEX_MOCK_CONSENT }, input);

  assert.equal(first.schema, 'bizra.g_ladder.layer_index.v0.1.local');
  assert.match(first.g_ladder_layer_index_id, /^sha256:[a-f0-9]{64}$/);
  assert.equal(first.g_ladder_layer_index_id, second.g_ladder_layer_index_id);
  assert.equal(first.prototype_posture, '[PROTOTYPE] [DESIGNED_NOT_LIVE] LOCAL_ONLY');
  assert.equal(first.checklist_section, 'proof_layer_closure');
});

test('closes PDF section-1 unmarked proof-layer checklist items as local mock evidence', () => {
  const rollup = createMockGLadderLayerIndex(
    { requireConsent: G_LADDER_LAYER_INDEX_MOCK_CONSENT },
    loadExampleGLadderLayerIndexInput()
  );

  assert.equal(rollup.layer_index.boundary_to_scaffold_to_mock_to_delivery_check_complete, true);
  assert.ok(rollup.layer_index.layers.length >= 5);
  assert.equal(rollup.machine_readable_layer_index.exists, true);
  assert.equal(rollup.claim_map.exists, true);
  assert.equal(rollup.proof_gap_register.exists, true);
  assert.equal(rollup.release_readiness_rollup.exists, true);
});

test('each indexed layer satisfies LCC-6 fields and exact-head remote witness shape', () => {
  const rollup = createMockGLadderLayerIndex(
    { requireConsent: G_LADDER_LAYER_INDEX_MOCK_CONSENT },
    loadExampleGLadderLayerIndexInput()
  );

  for (const layer of rollup.layer_index.layers) {
    assert.ok(layer.boundary_ref);
    assert.ok(layer.schema_ref);
    assert.ok(layer.test_scaffold_ref);
    assert.ok(layer.delivery_check_marker);
    assert.ok(layer.claim_map_status);
    assert.equal(layer.remote_witness_condition, 'four_exact_head_rails_completed_success');
    assert.equal(layer.run_ids.gitleaks > 0, true);
    assert.equal(layer.run_ids.codeql > 0, true);
    assert.equal(layer.run_ids.bizra_review_gate > 0, true);
    assert.equal(layer.run_ids.check > 0, true);
  }
});

test('claim-map preserves non-claim and blocked-production posture for every layer', () => {
  const rollup = createMockGLadderLayerIndex(
    { requireConsent: G_LADDER_LAYER_INDEX_MOCK_CONSENT },
    loadExampleGLadderLayerIndexInput()
  );

  assert.equal(rollup.claim_map.status, 'CONSOLIDATED_LOCAL_MOCK');
  assert.equal(rollup.claim_map.entries.length, rollup.layer_index.layers.length);
  for (const entry of rollup.claim_map.entries) {
    assert.equal(entry.public_claim_allowed, false);
    assert.equal(entry.production_claim_allowed, false);
    assert.equal(entry.economic_claim_allowed, false);
    assert.equal(entry.shariah_claim_allowed, false);
    assert.match(entry.claim_map_status, /NON_CLAIM|REVIEW_REQUIRED/);
  }
});

test('proof-gap register carries open gaps without erasing still-blocked invariants', () => {
  const rollup = createMockGLadderLayerIndex(
    { requireConsent: G_LADDER_LAYER_INDEX_MOCK_CONSENT },
    loadExampleGLadderLayerIndexInput()
  );

  assert.equal(rollup.proof_gap_register.status, 'OPEN_GAPS_CARRIED');
  assert.equal(rollup.proof_gap_register.gaps.length > 0, true);
  assert.equal(rollup.still_blocked_snapshot.node1, false);
  assert.equal(rollup.still_blocked_snapshot.public_urp_bridge, false);
  assert.equal(rollup.still_blocked_snapshot.shariah_compliance_claim, false);
});

test('release-readiness rollup blocks production claims while preserving local readiness evidence', () => {
  const rollup = createMockGLadderLayerIndex(
    { requireConsent: G_LADDER_LAYER_INDEX_MOCK_CONSENT },
    loadExampleGLadderLayerIndexInput()
  );

  assert.equal(rollup.release_readiness_rollup.local_proof_stream_ready, true);
  assert.equal(rollup.release_readiness_rollup.production_release_ready, false);
  assert.equal(rollup.release_readiness_rollup.public_claim_allowed, false);
  assert.equal(rollup.release_readiness_rollup.reason, 'PROTOTYPE_ONLY_STILL_BLOCKED_INVARIANTS_OPEN');
});

test('rejects forbidden inputs and promotion language', () => {
  const input = loadExampleGLadderLayerIndexInput();
  assert.throws(
    () => createMockGLadderLayerIndex(
      { requireConsent: G_LADDER_LAYER_INDEX_MOCK_CONSENT },
      { ...input, ci_polling_request: true }
    ),
    /FORBIDDEN_INPUT/
  );

  assert.throws(
    () => createMockGLadderLayerIndex(
      { requireConsent: G_LADDER_LAYER_INDEX_MOCK_CONSENT },
      { ...input, index_scope: 'public token reward launch' }
    ),
    /FORBIDDEN_PROMOTION/
  );
});

test('output excludes forbidden runtime, writer, public, economic, and certification fields', () => {
  const rollup = createMockGLadderLayerIndex(
    { requireConsent: G_LADDER_LAYER_INDEX_MOCK_CONSENT },
    loadExampleGLadderLayerIndexInput()
  );

  for (const key of forbiddenOutputKeys) {
    assert.equal(Object.hasOwn(rollup, key), false, `${key} must not be emitted`);
  }
});

test('mock module is pure local code without fs/http/net/child_process/fetch side effects', () => {
  const source = readFileSync(new URL('../scripts/g-ladder-layer-index-mock.mjs', import.meta.url), 'utf8');
  assert.equal(/node:(fs|http|https|net|child_process)/.test(source), false);
  assert.equal(/\bfetch\s*\(/.test(source), false);
  assert.equal(/writeFile|appendFile|createWriteStream/.test(source), false);
});
