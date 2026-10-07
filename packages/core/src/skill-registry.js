/**
 * skill-registry.js — Canonical skill registry kernel
 *
 * PREVIEW_ONLY — loads and queries the skills-src/ registry.
 * Does not route, authorize, or execute skills.
 *
 * Pure kernel: all I/O is injected via the `io` parameter.
 * No node:fs, no node:net, no side effects.
 *
 * Truth label: PREVIEW_ONLY
 * Boundary: authority_delta=0, execution_performed=false
 */

import { createHash } from 'node:crypto';
import { validateSkillContract, computeContractHash } from './skill-contract.js';

/**
 * Load the canonical registry from an injected data source.
 *
 * @param {object} io — injected I/O (purity by injection)
 * @param {function} io.readFileSync — read a file path, return string content
 * @param {function} io.existsSync — check if a path exists, return boolean
 * @param {string} [io.root] — repo root (default: '.')
 * @param {object} [options]
 * @param {boolean} [options.validate=true] — validate all contracts
 * @returns {{ ok: boolean, registry: object, skills: object[], errors: string[] }}
 */
export function loadRegistry(io, options = {}) {
  const root = io.root || '.';
  const shouldValidate = options.validate !== false;
  const errors = [];

  const registryPath = `${root}/skills-src/registry.json`;
  if (!io.existsSync(registryPath)) {
    return { ok: false, registry: null, skills: [], errors: [`registry not found: ${registryPath}`] };
  }

  let registry;
  try {
    registry = JSON.parse(io.readFileSync(registryPath, 'utf8'));
  } catch (e) {
    return { ok: false, registry: null, skills: [], errors: [`failed to parse registry: ${e.message}`] };
  }

  // Validate schema
  if (registry.schema !== 'bizra.skill-registry/v1') {
    errors.push(`unexpected registry schema: ${registry.schema}`);
  }

  const skills = [];
  for (const entry of registry.skills || []) {
    const contractPath = `${root}/${entry.contract_path}`;
    if (!io.existsSync(contractPath)) {
      errors.push(`contract not found for ${entry.skill_id}: ${contractPath}`);
      continue;
    }

    let contract;
    try {
      contract = JSON.parse(io.readFileSync(contractPath, 'utf8'));
    } catch (e) {
      errors.push(`failed to parse contract for ${entry.skill_id}: ${e.message}`);
      continue;
    }

    if (shouldValidate) {
      const validation = validateSkillContract(contract);
      if (!validation.ok) {
        errors.push(`invalid contract for ${entry.skill_id}: ${validation.errors.join('; ')}`);
      }
    }

    skills.push({
      skill_id: entry.skill_id,
      version: entry.version,
      contract,
      contract_hash: computeContractHash(contract)
    });
  }

  const registryHash = computeRegistryHash(registry);

  return {
    ok: errors.length === 0,
    registry,
    registry_hash: registryHash,
    skills,
    errors
  };
}

/**
 * Query the registry for skills matching a capability family.
 *
 * @param {object[]} skills — loaded skills from loadRegistry
 * @param {string} family — capability_family to match
 * @returns {object[]} matching skills
 */
export function queryByFamily(skills, family) {
  return skills.filter(s => s.contract.capability_family === family);
}

/**
 * Query the registry for skills matching a lifecycle phase.
 *
 * @param {object[]} skills
 * @param {string} phase
 * @returns {object[]}
 */
export function queryByPhase(skills, phase) {
  return skills.filter(s => s.contract.lifecycle_phase === phase);
}

/**
 * Query the registry for skills whose applicability matches a text hint.
 * Simple substring match — not semantic.
 *
 * @param {object[]} skills
 * @param {string} hint — text to match against applicability array
 * @returns {object[]}
 */
export function queryByApplicability(skills, hint) {
  const lower = hint.toLowerCase();
  return skills.filter(s =>
    s.contract.applicability.some(a => a.toLowerCase().includes(lower))
  );
}

/**
 * Find the best candidate skill for a given query hint.
 * Returns candidates sorted by number of applicability matches, descending.
 *
 * @param {object[]} skills
 * @param {string} hint
 * @returns {object[]}
 */
export function findCandidates(skills, hint) {
  const lower = hint.toLowerCase();
  const scored = skills.map(s => {
    const matches = s.contract.applicability.filter(a =>
      a.toLowerCase().includes(lower)
    ).length;
    const excludes = s.contract.exclusions.some(e =>
      e.toLowerCase().includes(lower)
    );
    return { ...s, match_score: matches, excluded: excludes };
  });

  return scored
    .filter(s => s.match_score > 0 && !s.excluded)
    .sort((a, b) => b.match_score - a.match_score);
}

/**
 * Compute SHA-256 hash of the registry object.
 *
 * @param {object} registry
 * @returns {string}
 */
export function computeRegistryHash(registry) {
  const canonical = JSON.stringify(registry, Object.keys(registry).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

export default {
  loadRegistry,
  queryByFamily,
  queryByPhase,
  queryByApplicability,
  findCandidates,
  computeRegistryHash
};
