/**
 * skill-contract.js — Skill contract validation kernel
 *
 * PREVIEW_ONLY — validates contract structure and compatibility.
 * Does not authorize execution, route, or expose skill bodies.
 *
 * Truth label: PREVIEW_ONLY
 * Boundary: authority_delta=0, execution_performed=false
 */

import { createHash } from 'node:crypto';

/**
 * Required fields for a valid skill contract.
 */
const REQUIRED_FIELDS = [
  'skill_id',
  'version',
  'capability_family',
  'lifecycle_phase',
  'applicability',
  'exclusions',
  'preconditions',
  'inputs',
  'outputs',
  'side_effects',
  'permissions',
  'resource_bindings',
  'truth_boundary',
  'projection_targets',
  'convergence'
];

/**
 * Valid lifecycle phases.
 */
const VALID_LIFECYCLE_PHASES = [
  'pre-implementation',
  'implementation',
  'post-implementation',
  'verification',
  'data-preparation',
  'routing',
  'evaluation',
  'always'
];

/**
 * Valid convergence levels (0–5).
 */
const CONVERGENCE_RAILS = ['formal', 'cryptographic', 'empirical', 'economic'];

/**
 * Validate a skill contract object.
 *
 * @param {object} contract — parsed contract.json
 * @param {object} [options]
 * @param {boolean} [options.strict=true] — reject unknown fields
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export function validateSkillContract(contract, options = {}) {
  const { strict = true } = options;
  const errors = [];
  const warnings = [];

  if (!contract || typeof contract !== 'object') {
    return { ok: false, errors: ['contract must be a non-null object'], warnings: [] };
  }

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (!(field in contract)) {
      errors.push(`missing required field: ${field}`);
    }
  }

  // Validate skill_id format (kebab-case)
  if (contract.skill_id) {
    if (!/^[a-z][a-z0-9-]*$/.test(contract.skill_id)) {
      errors.push(`skill_id must be kebab-case: ${contract.skill_id}`);
    }
  }

  // Validate version format (semver-ish)
  if (contract.version) {
    if (!/^\d+\.\d+\.\d+$/.test(contract.version)) {
      errors.push(`version must be semver (x.y.z): ${contract.version}`);
    }
  }

  // Validate lifecycle_phase
  if (contract.lifecycle_phase && !VALID_LIFECYCLE_PHASES.includes(contract.lifecycle_phase)) {
    warnings.push(`lifecycle_phase '${contract.lifecycle_phase}' is not in known set`);
  }

  // Validate array fields
  const arrayFields = [
    'applicability', 'exclusions', 'preconditions', 'inputs',
    'outputs', 'side_effects', 'permissions', 'resource_bindings',
    'projection_targets'
  ];
  for (const field of arrayFields) {
    if (contract[field] && !Array.isArray(contract[field])) {
      errors.push(`${field} must be an array`);
    }
  }

  // Validate convergence
  if (contract.convergence) {
    for (const rail of CONVERGENCE_RAILS) {
      const val = contract.convergence[rail];
      if (val === undefined) {
        warnings.push(`convergence.${rail} not specified`);
      } else if (typeof val !== 'number' || val < 0 || val > 5) {
        errors.push(`convergence.${rail} must be 0–5, got ${val}`);
      }
    }
  }

  // Validate projection_targets
  if (contract.projection_targets) {
    const validTargets = ['.claude', '.agents'];
    for (const t of contract.projection_targets) {
      if (!validTargets.includes(t)) {
        warnings.push(`projection_target '${t}' is not in known set`);
      }
    }
  }

  // Strict mode: reject unknown fields
  if (strict) {
    const knownFields = new Set(REQUIRED_FIELDS);
    knownFields.add('evidence_refs');
    for (const key of Object.keys(contract)) {
      if (!knownFields.has(key)) {
        warnings.push(`unknown field in strict mode: ${key}`);
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Compute the contract hash (SHA-256 of canonical JSON).
 *
 * @param {object} contract — parsed contract.json
 * @returns {string} hex digest
 */
export function computeContractHash(contract) {
  const canonical = JSON.stringify(contract, Object.keys(contract).sort()) ;
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Check whether two contracts are semantically compatible.
 * Same skill_id, same capability_family, compatible lifecycle phases.
 *
 * @param {object} a
 * @param {object} b
 * @returns {{ compatible: boolean, reasons: string[] }}
 */
export function checkContractCompatibility(a, b) {
  const reasons = [];

  if (a.skill_id !== b.skill_id) {
    reasons.push(`skill_id mismatch: ${a.skill_id} vs ${b.skill_id}`);
  }
  if (a.capability_family !== b.capability_family) {
    reasons.push(`capability_family mismatch: ${a.capability_family} vs ${b.capability_family}`);
  }
  if (a.lifecycle_phase !== b.lifecycle_phase) {
    reasons.push(`lifecycle_phase mismatch: ${a.lifecycle_phase} vs ${b.lifecycle_phase}`);
  }
  if (a.truth_boundary !== b.truth_boundary) {
    reasons.push(`truth_boundary mismatch: ${a.truth_boundary} vs ${b.truth_boundary}`);
  }

  return { compatible: reasons.length === 0, reasons };
}

/**
 * Build a default route card from a contract.
 * Does NOT authorize execution — it's a candidate descriptor.
 *
 * @param {object} contract
 * @returns {object} route card
 */
export function buildRouteCard(contract) {
  return {
    skill_id: contract.skill_id,
    version: contract.version,
    capability_family: contract.capability_family,
    lifecycle_phase: contract.lifecycle_phase,
    applicability: contract.applicability,
    exclusions: contract.exclusions,
    truth_boundary: contract.truth_boundary,
    projection_targets: contract.projection_targets
  };
}

export default {
  validateSkillContract,
  computeContractHash,
  checkContractCompatibility,
  buildRouteCard
};
