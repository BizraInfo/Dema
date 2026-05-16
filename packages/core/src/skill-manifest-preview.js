// Operating canon (per docs/02-architecture/dema-skill-manifest-v0.1.md):
//   A skill declares its authority.
//   A skill names its tests.
//   A skill names which guardians must approve.
//   A skill that cannot name its denied effects is not a skill.
//
// This module is PREVIEW_ONLY. It records a typed manifest envelope for a
// Dema skill. It does NOT activate the skill, register a runner, invoke a
// model, mint a receipt, or import authority. active_now is always false.

export const SKILL_MANIFEST_PREVIEW_SCHEMA = "bizra.dema.skill_manifest_preview.v0.1";

export const SKILL_RISK_LEVELS = Object.freeze([
  "low",
  "medium",
  "high",
  "step_seven_tier"
]);

export const SKILL_RECEIPT_POLICIES = Object.freeze([
  "no_receipt",
  "preview_receipt",
  "step_seven_receipt"
]);

export const PAT_ROLE_IDS = Object.freeze([
  "intent_extractor",
  "permission_planner",
  "evidence_collector",
  "consent_drafter",
  "mission_proposer",
  "receipt_renderer",
  "memory_steward"
]);

export const SAT_ROLE_IDS = Object.freeze([
  "consent_verifier",
  "boundary_auditor",
  "ihsan_floor_checker",
  "evidence_chain_validator",
  "step7_gate_keeper"
]);

const OPERATIONS = Object.freeze(["read", "write", "execute", "call"]);
const SKILL_ID_RE = /^[a-z][a-z0-9_]*$/;

const RISK_LEVELS_SET = new Set(SKILL_RISK_LEVELS);
const RECEIPT_POLICIES_SET = new Set(SKILL_RECEIPT_POLICIES);
const PAT_ROLE_SET = new Set(PAT_ROLE_IDS);
const SAT_ROLE_SET = new Set(SAT_ROLE_IDS);
const OPERATIONS_SET = new Set(OPERATIONS);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function buildBoundary() {
  return {
    runtime: false,
    federation: false,
    mint: false,
    skill_activated: false,
    skill_invoked: false,
    receipt_minted: false,
    authority_imported: false
  };
}

function validate(input) {
  const errors = [];
  const {
    skill_id,
    risk_level,
    declared_effects,
    denied_effects,
    required_pat,
    required_sat,
    tests,
    receipt_policy
  } = input;

  // skill_id
  if (typeof skill_id !== "string" || skill_id.length === 0) {
    errors.push("skill_id must be a non-empty string");
  } else if (!SKILL_ID_RE.test(skill_id)) {
    errors.push("skill_id must match /^[a-z][a-z0-9_]*$/");
  }

  // risk_level
  if (!RISK_LEVELS_SET.has(risk_level)) {
    errors.push(`risk_level must be one of ${SKILL_RISK_LEVELS.join(", ")}`);
  }

  // declared_effects / denied_effects
  if (!isStringArray(declared_effects)) {
    errors.push("declared_effects must be an array of strings");
  } else {
    for (const op of declared_effects) {
      if (!OPERATIONS_SET.has(op)) errors.push(`declared_effects contains unknown op ${op}`);
    }
  }
  if (!isStringArray(denied_effects)) {
    errors.push("denied_effects must be an array of strings");
  } else {
    for (const op of denied_effects) {
      if (!OPERATIONS_SET.has(op)) errors.push(`denied_effects contains unknown op ${op}`);
    }
  }
  if (isStringArray(declared_effects) && isStringArray(denied_effects)) {
    const declSet = new Set(declared_effects);
    const overlap = denied_effects.filter((op) => declSet.has(op));
    if (overlap.length > 0) {
      errors.push(`declared_effects and denied_effects overlap: ${overlap.join(", ")}`);
    }
  }

  // required_pat
  if (!isStringArray(required_pat) || required_pat.length === 0) {
    errors.push("required_pat must be a non-empty array of PAT role ids");
  } else {
    for (const r of required_pat) {
      if (!PAT_ROLE_SET.has(r)) errors.push(`required_pat contains unknown role ${r}`);
    }
  }

  // required_sat
  if (!isStringArray(required_sat) || required_sat.length === 0) {
    errors.push("required_sat must be a non-empty array of SAT role ids");
  } else {
    for (const r of required_sat) {
      if (!SAT_ROLE_SET.has(r)) errors.push(`required_sat contains unknown role ${r}`);
    }
  }

  // tests
  if (!isStringArray(tests) || tests.length === 0) {
    errors.push("tests must be a non-empty array of test file paths");
  }

  // receipt_policy
  if (!RECEIPT_POLICIES_SET.has(receipt_policy)) {
    errors.push(`receipt_policy must be one of ${SKILL_RECEIPT_POLICIES.join(", ")}`);
  }

  // step_seven_tier coupling
  if (risk_level === "step_seven_tier") {
    if (receipt_policy !== "step_seven_receipt") {
      errors.push("risk_level=step_seven_tier requires receipt_policy=step_seven_receipt");
    }
    if (!isStringArray(required_sat) || !required_sat.includes("step7_gate_keeper")) {
      errors.push("risk_level=step_seven_tier requires step7_gate_keeper in required_sat");
    }
  }

  // execute requires high or step_seven_tier
  if (isStringArray(declared_effects) && declared_effects.includes("execute")) {
    if (risk_level !== "high" && risk_level !== "step_seven_tier") {
      errors.push("declared_effects containing 'execute' requires risk_level high or step_seven_tier");
    }
  }

  return errors;
}

export function buildSkillManifestPreview({
  skill_id,
  risk_level,
  declared_effects,
  denied_effects,
  required_pat,
  required_sat,
  tests,
  receipt_policy,
  now
} = {}) {
  const input = {
    skill_id,
    risk_level,
    declared_effects,
    denied_effects,
    required_pat,
    required_sat,
    tests,
    receipt_policy
  };
  const errors = validate(input);
  const valid = errors.length === 0;
  const generated_at = typeof now === "string" && now.length > 0 ? now : "1970-01-01T00:00:00.000Z";

  const envelope = {
    schema: SKILL_MANIFEST_PREVIEW_SCHEMA,
    mode: "PREVIEW_ONLY",
    truth_label: "DECLARED",
    valid,
    errors,
    skill_id: typeof skill_id === "string" ? skill_id : null,
    risk_level: RISK_LEVELS_SET.has(risk_level) ? risk_level : null,
    declared_effects: isStringArray(declared_effects) ? [...declared_effects] : [],
    denied_effects: isStringArray(denied_effects) ? [...denied_effects] : [],
    required_pat: isStringArray(required_pat) ? [...required_pat] : [],
    required_sat: isStringArray(required_sat) ? [...required_sat] : [],
    tests: isStringArray(tests) ? [...tests] : [],
    receipt_policy: RECEIPT_POLICIES_SET.has(receipt_policy) ? receipt_policy : null,
    active_now: false, // invariant — always false in v0.1
    generated_at,
    boundary: buildBoundary(),
    note: "Skill manifest only. Records a typed declaration. Does not activate or invoke the skill, does not mint, does not import authority."
  };

  return deepFreeze(clone(envelope));
}
