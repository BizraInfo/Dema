/**
 * ADR-035 Node0 Closed-Loop Runtime Dry-Run Mock - Tests
 * [PROTOTYPE] [DESIGNED_NOT_LIVE] LOCAL_ONLY
 *
 * Exercises a pure local dry-run envelope only. No live runtime, daemon,
 * command execution, process spawn, filesystem write, network call, cross-repo
 * write, Data Lake mutation, public publication, Node1 activation, URP bridge,
 * reward logic, token logic, contracts, marketplace behavior, or
 * Shariah-compliance claim is introduced.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createMockNode0ClosedLoopRuntimeDryRun,
  loadExampleNode0ClosedLoopRuntimeDryRunInput,
  NODE0_CLOSED_LOOP_RUNTIME_DRY_RUN_MOCK_CONSENT
} from '../scripts/node0-closed-loop-runtime-dry-run-mock.mjs';

const forbiddenOutputKeys = [
  'live_runtime_started',
  'daemon_started',
  'command_executed',
  'process_spawned',
  'filesystem_write_performed',
  'network_call_performed',
  'cross_repo_write_performed',
  'datalake_mutated',
  'runtime_bridge_active',
  'node1_sync',
  'urp_publication',
  'receipt_minted',
  'receipt_written',
  'digest_written',
  'index_written',
  'token_minted',
  'reward_authorized',
  'contract_call',
  'marketplace_signal',
  'public_receipt_url',
  'shariah_compliant'
];

test('requires exact consent for the runtime dry-run mock', () => {
  assert.throws(
    () => createMockNode0ClosedLoopRuntimeDryRun(
      { requireConsent: 'GO' },
      loadExampleNode0ClosedLoopRuntimeDryRunInput()
    ),
    /CONSENT_REQUIRED/
  );
});

test('emits deterministic dry-run envelope with sha256 ID', () => {
  const input = loadExampleNode0ClosedLoopRuntimeDryRunInput();
  const first = createMockNode0ClosedLoopRuntimeDryRun(
    { requireConsent: NODE0_CLOSED_LOOP_RUNTIME_DRY_RUN_MOCK_CONSENT },
    input
  );
  const second = createMockNode0ClosedLoopRuntimeDryRun(
    { requireConsent: NODE0_CLOSED_LOOP_RUNTIME_DRY_RUN_MOCK_CONSENT },
    input
  );

  assert.equal(first.schema, 'bizra.node0.closed_loop_runtime_dry_run.v0.1.local');
  assert.match(first.runtime_dry_run_id, /^sha256:[a-f0-9]{64}$/);
  assert.equal(first.runtime_dry_run_id, second.runtime_dry_run_id);
  assert.equal(first.prototype_posture, '[PROTOTYPE] [DESIGNED_NOT_LIVE] LOCAL_ONLY');
});

test('defines all runtime loop states as dry-run-only labels', () => {
  const dryRun = createMockNode0ClosedLoopRuntimeDryRun(
    { requireConsent: NODE0_CLOSED_LOOP_RUNTIME_DRY_RUN_MOCK_CONSENT },
    loadExampleNode0ClosedLoopRuntimeDryRunInput()
  );

  assert.deepEqual(
    dryRun.state_sequence.map(state => state.name),
    ['input', 'validation', 'planning', 'execution', 'reflection', 'receipt', 'digest', 'index']
  );
  for (const state of dryRun.state_sequence) {
    assert.equal(state.dry_run_only, true);
    assert.equal(state.side_effects_allowed, false);
    assert.equal(state.live_execution_allowed, false);
  }
});

test('carries failure-safe abort, retry, timeout, and idempotency policies', () => {
  const dryRun = createMockNode0ClosedLoopRuntimeDryRun(
    { requireConsent: NODE0_CLOSED_LOOP_RUNTIME_DRY_RUN_MOCK_CONSENT },
    loadExampleNode0ClosedLoopRuntimeDryRunInput()
  );

  assert.equal(dryRun.failure_safe_abort.status, 'ABORTS_CLOSED');
  assert.equal(dryRun.failure_safe_abort.invalid_input, 'ABORT_BEFORE_PLANNING');
  assert.equal(dryRun.retry_policy.finite, true);
  assert.equal(dryRun.retry_policy.bypasses_validation, false);
  assert.equal(dryRun.timeout_policy.timeout_result, 'ABORTED_TIMEOUT');
  assert.equal(dryRun.timeout_policy.writes_receipt_on_timeout, false);
  assert.equal(dryRun.idempotency_policy.duplicate_advancement_allowed, false);
  assert.equal(dryRun.idempotency_policy.hidden_mutable_state_allowed, false);
});

test('carries local-only lock policy, operator approval gate, and trace ID', () => {
  const dryRun = createMockNode0ClosedLoopRuntimeDryRun(
    { requireConsent: NODE0_CLOSED_LOOP_RUNTIME_DRY_RUN_MOCK_CONSENT },
    loadExampleNode0ClosedLoopRuntimeDryRunInput()
  );

  assert.equal(dryRun.local_only_execution_locks.required_for_future_write_capable_path, true);
  assert.equal(dryRun.local_only_execution_locks.lock_acquired, false);
  assert.equal(dryRun.local_only_execution_locks.lockfile_written, false);
  assert.equal(dryRun.operator_approval_gate.exact_consent_required, true);
  assert.equal(dryRun.operator_approval_gate.approval_collected, false);
  assert.equal(dryRun.trace.runtime_trace_id.startsWith('sha256:'), true);
  assert.equal(dryRun.trace.local_only, true);
  assert.equal(dryRun.trace.public, false);
});

test('carries replay-safe receipt expectation without minting, writing, or publishing', () => {
  const dryRun = createMockNode0ClosedLoopRuntimeDryRun(
    { requireConsent: NODE0_CLOSED_LOOP_RUNTIME_DRY_RUN_MOCK_CONSENT },
    loadExampleNode0ClosedLoopRuntimeDryRunInput()
  );

  assert.equal(dryRun.replay_safe_execution_receipt.expected_shape_only, true);
  assert.equal(dryRun.replay_safe_execution_receipt.receipt_minted, false);
  assert.equal(dryRun.replay_safe_execution_receipt.receipt_written, false);
  assert.equal(dryRun.replay_safe_execution_receipt.receipt_published, false);
  assert.equal(dryRun.replay_safe_execution_receipt.replay_mismatch_policy, 'ABORT_CLOSED');
  assert.equal(dryRun.digest_index_expectation.digest_written, false);
  assert.equal(dryRun.digest_index_expectation.index_written, false);
});

test('preserves still-blocked invariants and production/public/economic non-claims', () => {
  const dryRun = createMockNode0ClosedLoopRuntimeDryRun(
    { requireConsent: NODE0_CLOSED_LOOP_RUNTIME_DRY_RUN_MOCK_CONSENT },
    loadExampleNode0ClosedLoopRuntimeDryRunInput()
  );

  assert.equal(dryRun.still_blocked_snapshot.production_scoring, false);
  assert.equal(dryRun.still_blocked_snapshot.economic_scoring, false);
  assert.equal(dryRun.still_blocked_snapshot.node1, false);
  assert.equal(dryRun.still_blocked_snapshot.public_urp_bridge, false);
  assert.equal(dryRun.still_blocked_snapshot.shariah_compliance_claim, false);
  assert.equal(dryRun.release_claims.production_ready, false);
  assert.equal(dryRun.release_claims.public_claim_allowed, false);
  assert.equal(dryRun.release_claims.economic_claim_allowed, false);
});

test('rejects forbidden inputs and live-runtime promotion language', () => {
  const input = loadExampleNode0ClosedLoopRuntimeDryRunInput();

  assert.throws(
    () => createMockNode0ClosedLoopRuntimeDryRun(
      { requireConsent: NODE0_CLOSED_LOOP_RUNTIME_DRY_RUN_MOCK_CONSENT },
      { ...input, command_execution_request: true }
    ),
    /FORBIDDEN_INPUT/
  );

  assert.throws(
    () => createMockNode0ClosedLoopRuntimeDryRun(
      { requireConsent: NODE0_CLOSED_LOOP_RUNTIME_DRY_RUN_MOCK_CONSENT },
      { ...input, dry_run_intent: 'start live runtime daemon' }
    ),
    /FORBIDDEN_PROMOTION/
  );
});

test('output excludes forbidden runtime, writer, public, economic, and certification fields', () => {
  const dryRun = createMockNode0ClosedLoopRuntimeDryRun(
    { requireConsent: NODE0_CLOSED_LOOP_RUNTIME_DRY_RUN_MOCK_CONSENT },
    loadExampleNode0ClosedLoopRuntimeDryRunInput()
  );

  for (const key of forbiddenOutputKeys) {
    assert.equal(Object.hasOwn(dryRun, key), false, `${key} must not be emitted`);
  }
});

test('mock module is pure local code without fs/http/net/child_process/fetch side effects', () => {
  const source = readFileSync(
    new URL('../scripts/node0-closed-loop-runtime-dry-run-mock.mjs', import.meta.url),
    'utf8'
  );
  assert.equal(/node:(fs|http|https|net|child_process)/.test(source), false);
  assert.equal(/\bfetch\s*\(/.test(source), false);
  assert.equal(/writeFile|appendFile|createWriteStream/.test(source), false);
});
