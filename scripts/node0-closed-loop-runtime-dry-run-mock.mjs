/**
 * ADR-035 Node0 Closed-Loop Runtime Dry-Run Mock
 * [PROTOTYPE]
 * [DESIGNED_NOT_LIVE]
 * LOCAL_ONLY
 *
 * Local dry-run runtime envelope only. It defines the closed-loop state labels
 * and policy expectations required by the production checklist Section 2.
 * No live runtime, daemon, command execution, process spawn, filesystem write,
 * network call, cross-repo write, Data Lake mutation, public publication,
 * Node1 activation, URP bridge, reward logic, token logic, contracts,
 * marketplace behavior, or Shariah-compliance claim is introduced.
 */

import { createHash } from 'node:crypto';

export const NODE0_CLOSED_LOOP_RUNTIME_DRY_RUN_MOCK_CONSENT =
  'GO: NODE0 CLOSED-LOOP RUNTIME DRY-RUN MOCK';

const ALLOWED_INPUT_FIELDS = new Set([
  'runtime_scope',
  'dry_run_intent',
  'input_ref',
  'validation_ref',
  'planning_ref',
  'execution_plan_ref',
  'reflection_ref',
  'receipt_expectation_ref',
  'digest_expectation_ref',
  'index_expectation_ref',
  'retry_policy_ref',
  'timeout_policy_ref',
  'idempotency_policy_ref',
  'lock_policy_ref',
  'operator_approval_status',
  'runtime_trace_id',
  'proof_gaps',
  'still_blocked_invariants',
  'consent_status',
  'review_status',
  'prototype_posture'
]);

const REQUIRED_SHA_FIELDS = [
  'input_ref',
  'validation_ref',
  'planning_ref',
  'execution_plan_ref',
  'reflection_ref',
  'receipt_expectation_ref',
  'digest_expectation_ref',
  'index_expectation_ref',
  'retry_policy_ref',
  'timeout_policy_ref',
  'idempotency_policy_ref',
  'lock_policy_ref'
];

const FORBIDDEN_PROMOTION_TERMS = new Set([
  'live runtime',
  'start runtime',
  'daemon',
  'command execution',
  'process spawn',
  'filesystem write',
  'network call',
  'cross repo write',
  'cross-repo write',
  'datalake mutation',
  'data lake mutation',
  'public url',
  'public receipt',
  'public launch',
  'node1',
  'urp bridge',
  'token',
  'reward',
  'payout',
  'contract',
  'marketplace',
  'shariah',
  'production ready',
  'guaranteed'
]);

const FORBIDDEN_OUTPUT_KEYS = [
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

const STATE_SEQUENCE = Object.freeze([
  'input',
  'validation',
  'planning',
  'execution',
  'reflection',
  'receipt',
  'digest',
  'index'
]);

const STILL_BLOCKED_SNAPSHOT = Object.freeze({
  production_scoring: false,
  economic_scoring: false,
  reward_eligibility_implementation: false,
  reward_logic: false,
  receipt_minting: false,
  public_receipt_writing: false,
  publishing: false,
  bridging: false,
  contracts: false,
  token_logic: false,
  marketplace: false,
  public_economic_copy: false,
  node1: false,
  public_urp_bridge: false,
  shariah_compliance_claim: false
});

export function createMockNode0ClosedLoopRuntimeDryRun(
  { requireConsent },
  input = loadExampleNode0ClosedLoopRuntimeDryRunInput()
) {
  if (requireConsent !== NODE0_CLOSED_LOOP_RUNTIME_DRY_RUN_MOCK_CONSENT) {
    throw new Error('CONSENT_REQUIRED: exact "GO: NODE0 CLOSED-LOOP RUNTIME DRY-RUN MOCK" required');
  }

  validateInput(input);

  const runtime_trace_id = input.runtime_trace_id || hashObject({
    runtime_scope: input.runtime_scope,
    dry_run_intent: input.dry_run_intent,
    input_ref: input.input_ref,
    execution_plan_ref: input.execution_plan_ref
  });

  const body = {
    schema: 'bizra.node0.closed_loop_runtime_dry_run.v0.1.local',
    runtime_dry_run_id: null,
    runtime_scope: input.runtime_scope,
    dry_run_intent: input.dry_run_intent,
    status: 'DRY_RUN_READY_FOR_REVIEW',
    dry_run_only: true,
    state_sequence: Object.freeze(STATE_SEQUENCE.map(name => Object.freeze({
      name,
      dry_run_only: true,
      side_effects_allowed: false,
      live_execution_allowed: false
    }))),
    failure_safe_abort: Object.freeze({
      status: 'ABORTS_CLOSED',
      invalid_input: 'ABORT_BEFORE_PLANNING',
      forbidden_input: 'ABORT_BEFORE_PLANNING',
      missing_consent: 'ABORT_BEFORE_WRITE_CAPABLE_PATH',
      unknown_state: 'ABORT_CLOSED',
      blocked_invariant_conflict: 'ABORT_CLOSED',
      replay_mismatch: 'ABORT_CLOSED'
    }),
    retry_policy: Object.freeze({
      finite: true,
      max_attempts: 1,
      deterministic_for_identical_input: true,
      bypasses_validation: false,
      bypasses_consent: false,
      downgrades_blocked_invariants: false,
      repeated_abort_remains_abort: true,
      retry_engine_implemented: false
    }),
    timeout_policy: Object.freeze({
      explicit_max_duration_required: true,
      max_duration_ms: 1000,
      timeout_result: 'ABORTED_TIMEOUT',
      writes_receipt_on_timeout: false,
      advances_digest_or_index_on_timeout: false,
      preserves_trace_and_proof_gaps: true,
      timer_engine_implemented: false
    }),
    idempotency_policy: Object.freeze({
      deterministic_state_ids_required: true,
      replay_safe_receipts_required: true,
      duplicate_advancement_allowed: false,
      hidden_mutable_state_allowed: false,
      external_reconciliation_allowed: false,
      idempotency_store_implemented: false
    }),
    local_only_execution_locks: Object.freeze({
      required_for_future_write_capable_path: true,
      policy_ref: input.lock_policy_ref,
      lock_acquired: false,
      lockfile_written: false,
      cross_repo_coordination: false
    }),
    operator_approval_gate: Object.freeze({
      exact_consent_required: true,
      approval_collected: false,
      operator_approval_status: input.operator_approval_status,
      consent_persisted: false,
      consent_inferred: false
    }),
    trace: Object.freeze({
      runtime_trace_id,
      local_only: true,
      secret: false,
      public: false,
      bound_to_input_ref: input.input_ref
    }),
    replay_safe_execution_receipt: Object.freeze({
      expected_shape_only: true,
      receipt_expectation_ref: input.receipt_expectation_ref,
      receipt_minted: false,
      receipt_written: false,
      receipt_published: false,
      replay_mismatch_policy: 'ABORT_CLOSED'
    }),
    digest_index_expectation: Object.freeze({
      digest_expectation_ref: input.digest_expectation_ref,
      index_expectation_ref: input.index_expectation_ref,
      reference_only: true,
      digest_written: false,
      index_written: false
    }),
    release_claims: Object.freeze({
      production_ready: false,
      public_claim_allowed: false,
      economic_claim_allowed: false,
      shariah_claim_allowed: false
    }),
    proof_gaps: Object.freeze([...input.proof_gaps]),
    still_blocked_invariants: Object.freeze([...input.still_blocked_invariants]),
    still_blocked_snapshot: STILL_BLOCKED_SNAPSHOT,
    created_at: new Date(0).toISOString(),
    prototype_posture: input.prototype_posture || '[PROTOTYPE] [DESIGNED_NOT_LIVE] LOCAL_ONLY'
  };

  const runtime_dry_run_id = hashObject({
    ...body,
    runtime_dry_run_id: 'pending'
  }, NODE0_CLOSED_LOOP_RUNTIME_DRY_RUN_MOCK_CONSENT);

  const output = deepFreeze({
    ...body,
    runtime_dry_run_id
  });

  for (const key of FORBIDDEN_OUTPUT_KEYS) {
    if (Object.hasOwn(output, key)) {
      throw new Error(`FORBIDDEN_OUTPUT: ${key} must never be present`);
    }
  }

  return output;
}

export function loadExampleNode0ClosedLoopRuntimeDryRunInput() {
  return {
    runtime_scope: 'local closed-loop runtime dry-run review',
    dry_run_intent: 'simulate Node0 loop state labels without side effects',
    input_ref: 'sha256:runtime-input-ex-g61',
    validation_ref: 'sha256:runtime-validation-ex-g61',
    planning_ref: 'sha256:runtime-planning-ex-g61',
    execution_plan_ref: 'sha256:runtime-execution-plan-ex-g61',
    reflection_ref: 'sha256:runtime-reflection-ex-g61',
    receipt_expectation_ref: 'sha256:runtime-receipt-expectation-ex-g61',
    digest_expectation_ref: 'sha256:runtime-digest-expectation-ex-g61',
    index_expectation_ref: 'sha256:runtime-index-expectation-ex-g61',
    retry_policy_ref: 'sha256:runtime-retry-policy-ex-g61',
    timeout_policy_ref: 'sha256:runtime-timeout-policy-ex-g61',
    idempotency_policy_ref: 'sha256:runtime-idempotency-policy-ex-g61',
    lock_policy_ref: 'sha256:runtime-lock-policy-ex-g61',
    operator_approval_status: 'required_not_collected',
    runtime_trace_id: null,
    proof_gaps: [
      'GAP_NO_LIVE_RUNTIME_IMPLEMENTATION',
      'GAP_NO_RUNTIME_WRITER',
      'GAP_NO_TRACE_WRITER',
      'GAP_NO_RECEIPT_MINTING',
      'GAP_NO_DIGEST_OR_INDEX_WRITE',
      'GAP_REFERENCE_EXPECTATION_ONLY'
    ],
    still_blocked_invariants: [
      'NO_PRODUCTION_SCORING',
      'NO_ECONOMIC_SCORING',
      'NO_REWARD_ELIGIBILITY_IMPLEMENTATION',
      'NO_REWARD_LOGIC',
      'NO_RECEIPT_MINTING',
      'NO_PUBLIC_RECEIPT_WRITING',
      'NO_PUBLISHING',
      'NO_BRIDGING',
      'NO_CONTRACTS',
      'NO_TOKEN_LOGIC',
      'NO_MARKETPLACE',
      'NO_PUBLIC_ECONOMIC_COPY',
      'NO_NODE1',
      'NO_PUBLIC_URP_BRIDGE',
      'NO_SHARIAH_COMPLIANCE_CLAIM'
    ],
    consent_status: 'required',
    review_status: 'local_review_only',
    prototype_posture: '[PROTOTYPE] [DESIGNED_NOT_LIVE] LOCAL_ONLY'
  };
}

function validateInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('VALIDATION_FAILED: input must be object');
  }

  for (const key of Object.keys(input)) {
    if (!ALLOWED_INPUT_FIELDS.has(key)) {
      throw new Error(`FORBIDDEN_INPUT: field "${key}" not allowed`);
    }
  }

  if (!input.runtime_scope) {
    throw new Error('VALIDATION_FAILED: runtime_scope required');
  }
  if (!input.dry_run_intent) {
    throw new Error('VALIDATION_FAILED: dry_run_intent required');
  }

  for (const field of REQUIRED_SHA_FIELDS) {
    if (!input[field] || !String(input[field]).startsWith('sha256:')) {
      throw new Error(`VALIDATION_FAILED: ${field} must start with sha256:`);
    }
  }

  if (
    input.runtime_trace_id !== null &&
    input.runtime_trace_id !== undefined &&
    !String(input.runtime_trace_id).startsWith('sha256:')
  ) {
    throw new Error('VALIDATION_FAILED: runtime_trace_id must be null or sha256:');
  }

  if (!Array.isArray(input.proof_gaps) || input.proof_gaps.length === 0) {
    throw new Error('VALIDATION_FAILED: proof_gaps must be non-empty array');
  }

  if (!Array.isArray(input.still_blocked_invariants) || input.still_blocked_invariants.length === 0) {
    throw new Error('VALIDATION_FAILED: still_blocked_invariants must be non-empty array');
  }

  if (input.operator_approval_status !== 'required_not_collected') {
    throw new Error('VALIDATION_FAILED: operator_approval_status must equal required_not_collected');
  }

  const promotionInput = {
    runtime_scope: input.runtime_scope,
    dry_run_intent: input.dry_run_intent,
    consent_status: input.consent_status,
    review_status: input.review_status,
    prototype_posture: input.prototype_posture
  };
  const serialized = JSON.stringify(promotionInput).toLowerCase();
  for (const term of FORBIDDEN_PROMOTION_TERMS) {
    if (serialized.includes(term)) {
      throw new Error(`FORBIDDEN_PROMOTION: detected "${term}"`);
    }
  }
}

function hashObject(value, salt = '') {
  return `sha256:${createHash('sha256')
    .update(JSON.stringify(value) + salt)
    .digest('hex')}`;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}
