// BIZRA-ADK-AGENT-CONTRACT-1A · PAT agent contract templates.

import { buildAgentContract } from "./agent-contract.js";
import { AGENT_SCOPES, PRIVACY_CLASSES, PAT_ROLES } from "./agent-scope.js";

const PAT_ROLE_EFFECTS = Object.freeze({
  Mirror: Object.freeze(["READ_LOCAL_METADATA", "RENDER_SUMMARY"]),
  Architect: Object.freeze(["READ_LOCAL_METADATA", "DRAFT_PATCH"]),
  Engineer: Object.freeze(["READ_LOCAL_METADATA", "DRAFT_PATCH", "RUN_TESTS"]),
  Auditor: Object.freeze(["READ_LOCAL_METADATA", "RUN_TESTS", "VERIFY_RECEIPT"]),
  Strategist: Object.freeze(["READ_LOCAL_METADATA", "DRAFT_PATCH"]),
  Caretaker: Object.freeze(["READ_LOCAL_METADATA", "RENDER_SUMMARY"]),
  Scribe: Object.freeze(["READ_LOCAL_METADATA", "DRAFT_PATCH"]),
});

function normalizePatRole(role) {
  const match = PAT_ROLES.find((r) => r.toLowerCase() === String(role).toLowerCase());
  return match ?? "Engineer";
}

/**
 * @param {object} [opts]
 * @param {string} [opts.agent_id]
 * @param {string} [opts.role] - PAT role name or alias (e.g. engineer, pat-engineer)
 * @param {string} [opts.serves]
 */
export function buildPatAgentTemplate({
  agent_id = "pat-engineer",
  role = "Engineer",
  serves = "mumu",
} = {}) {
  let roleName = normalizePatRole(role);
  if (typeof role === "string" && role.includes("-")) {
    const tail = role.split("-").pop();
    roleName = normalizePatRole(tail);
  }

  const allowed = PAT_ROLE_EFFECTS[roleName] ?? PAT_ROLE_EFFECTS.Engineer;

  return buildAgentContract({
    agent_id,
    agent_role: roleName,
    serves,
    scope: AGENT_SCOPES.PRIVATE_PAT,
    privacy_class: PRIVACY_CLASSES.PAT_RAW_LOCAL,
    truth_label: "ADK_PAT_AGENT_TEMPLATE",
    allowed_effects: [...allowed],
    forbidden_effects: [
      "SIGN",
      "FEDERATE",
      "MINT_TOKEN",
      "EXPORT_PRIVATE_MEMORY",
      "SEND_RAW_MEMORY_TO_SAT",
      "NETWORK",
      "KEY_GENERATION",
      "WRITE_FILE",
    ],
    consent_required_for: ["WRITE_FILE", "NETWORK", "KEY_GENERATION"],
    consent_policy:
      "Exact-string GO required before any effect in consent_required_for; PAT never exports raw memory to SAT.",
    proof_policy:
      "Proof-of-Truth convergence required before any non-preview action; summaries only cross PAT/SAT boundary.",
    receipt_policy:
      "Every bounded action emits a receipt preview with what_this_proves and what_this_does_not_prove.",
    proof_required: true,
    what_this_proves:
      "This PAT agent may propose drafts and local reads for the operator within PRIVATE_PAT scope.",
    what_this_does_not_prove:
      "Does not prove execution occurred, network use, signing, federation, token mint, or SAT registration.",
    stop_by_default: true,
  });
}

export function listPatTemplateIds() {
  return Object.freeze([
    "pat-mirror",
    "pat-architect",
    "pat-engineer",
    "pat-auditor",
    "pat-strategist",
    "pat-caretaker",
    "pat-scribe",
  ]);
}
