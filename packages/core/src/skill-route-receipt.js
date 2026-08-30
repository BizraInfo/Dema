/**
 * skill-route-receipt.js — Route receipt emission kernel
 *
 * PREVIEW_ONLY — builds and validates route receipts.
 * Does not authorize execution or mint economic receipts.
 *
 * Truth label: PREVIEW_ONLY
 * Boundary: authority_delta=0, execution_performed=false
 */

import { createHash } from 'node:crypto';

/**
 * Build a route receipt for a routing decision.
 *
 * @param {object} params
 * @param {string} params.query_hash — SHA-256 of the user query
 * @param {string} params.environment_hash — SHA-256 of the environment context
 * @param {string} params.registry_root — SHA-256 of the registry at routing time
 * @param {string} params.router_version — version of the router
 * @param {Array<{skill_id: string, score: number}>} params.candidates — scored candidates
 * @param {string|null} params.selected_skill — the skill selected (or null for NO_SKILL)
 * @param {string|null} params.selected_family — capability_family of selected
 * @param {Array<{skill_id: string, reason: string}>} [params.rejected_siblings] — rejected
 * @param {boolean} params.contract_match — whether selected matched its contract
 * @param {number} params.context_tokens_exposed — tokens exposed to executing model
 * @param {string} params.policy_decision — ALLOW_READ_ONLY | DENY | HOLD
 * @param {boolean} params.execution_authorized — false in preview mode
 * @param {string} params.outcome — ROUTE_ONLY | EXECUTED | DENIED | NO_SKILL
 * @param {string} [params.verifier] — who verified
 * @returns {object} route receipt
 */
export function buildRouteReceipt(params) {
  const receipt = {
    schema: 'bizra.skill-route-receipt/v1',
    receipt_kind: 'ROUTE_RECEIPT',
    cryptographic_receipt: false,

    query_hash: params.query_hash,
    environment_hash: params.environment_hash,
    registry_root: params.registry_root,
    router_version: params.router_version || 'unknown',

    candidates: (params.candidates || []).map(c => ({
      skill_id: c.skill_id,
      score: c.score
    })),

    selected_skill: params.selected_skill,
    selected_family: params.selected_family || null,
    rejected_siblings: params.rejected_siblings || [],

    contract_match: params.contract_match || false,
    context_tokens_exposed: params.context_tokens_exposed || 0,
    policy_decision: params.policy_decision || 'HOLD',
    execution_authorized: false, // always false in preview
    outcome: params.outcome || 'ROUTE_ONLY',
    verifier: params.verifier || null,

    timestamp: new Date().toISOString(),
    boundary: {
      execution_performed: false,
      authority_delta: 0,
      side_effects_performed: false,
      autonomous_loop_started: false
    }
  };

  receipt.receipt_hash = computeReceiptHash(receipt);
  return receipt;
}

/**
 * Validate a route receipt.
 *
 * @param {object} receipt
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateRouteReceipt(receipt) {
  const errors = [];

  if (!receipt || typeof receipt !== 'object') {
    return { ok: false, errors: ['receipt must be a non-null object'] };
  }

  if (receipt.schema !== 'bizra.skill-route-receipt/v1') {
    errors.push(`unexpected schema: ${receipt.schema}`);
  }

  if (!receipt.query_hash) errors.push('missing query_hash');
  if (!receipt.environment_hash) errors.push('missing environment_hash');
  if (!receipt.registry_root) errors.push('missing registry_root');

  if (receipt.execution_authorized !== false) {
    errors.push('execution_authorized must be false in preview mode');
  }

  if (!receipt.boundary) {
    errors.push('missing boundary');
  } else {
    if (receipt.boundary.execution_performed !== false) {
      errors.push('boundary.execution_performed must be false');
    }
    if (receipt.boundary.authority_delta !== 0) {
      errors.push('boundary.authority_delta must be 0');
    }
  }

  // Verify receipt hash if present
  if (receipt.receipt_hash) {
    const copy = { ...receipt };
    delete copy.receipt_hash;
    const expected = computeReceiptHash(copy);
    if (receipt.receipt_hash !== expected) {
      errors.push(`receipt_hash mismatch: expected ${expected.substring(0, 12)}...`);
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Compute SHA-256 hash of a receipt (excluding the hash field itself).
 *
 * @param {object} receipt
 * @returns {string}
 */
export function computeReceiptHash(receipt) {
  const copy = { ...receipt };
  delete copy.receipt_hash;
  const canonical = JSON.stringify(copy, Object.keys(copy).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * NO_SKILL outcome reasons — first-class taxonomy.
 */
export const NO_SKILL_REASONS = [
  'no_applicable_skill',
  'confidence_below_threshold',
  'contract_ambiguity',
  'policy_refusal',
  'router_failure',
  'exclusion_match',
  'lifecycle_mismatch'
];

/**
 * Build a NO_SKILL receipt.
 *
 * @param {object} params
 * @param {string} params.reason — one of NO_SKILL_REASONS
 * @param {string} params.query_hash
 * @param {string} params.environment_hash
 * @param {string} params.registry_root
 * @returns {object} route receipt with outcome=NO_SKILL
 */
export function buildNoSkillReceipt(params) {
  if (!NO_SKILL_REASONS.includes(params.reason)) {
    throw new Error(`invalid NO_SKILL reason: ${params.reason}. Valid: ${NO_SKILL_REASONS.join(', ')}`);
  }

  return buildRouteReceipt({
    ...params,
    selected_skill: null,
    selected_family: null,
    candidates: [],
    rejected_siblings: [],
    contract_match: false,
    context_tokens_exposed: 0,
    policy_decision: 'HOLD',
    outcome: 'NO_SKILL'
  });
}

export default {
  buildRouteReceipt,
  validateRouteReceipt,
  computeReceiptHash,
  buildNoSkillReceipt,
  NO_SKILL_REASONS
};
