// BIZRA-ADK-AGENT-CONTRACT-1A · SAT agent contract templates.

import { buildAgentContract } from "./agent-contract.js";
import { AGENT_SCOPES, PRIVACY_CLASSES, SAT_ROLES } from "./agent-scope.js";

const SAT_ROLE_EFFECTS = Object.freeze({
  "Proof Verifier": Object.freeze(["VERIFY_RECEIPT", "REGISTER_PROOF"]),
  "Constitution Guard": Object.freeze(["VERIFY_RECEIPT", "CLASSIFY_RISK"]),
  "URP Registrar": Object.freeze(["REGISTER_PROOF", "RENDER_SUMMARY"]),
  "Risk Sentinel": Object.freeze(["CLASSIFY_RISK", "VERIFY_RECEIPT"]),
  "Impact Scorer": Object.freeze(["SCORE_IMPACT", "RENDER_SUMMARY"]),
});

function normalizeSatRole(role) {
  const needle = String(role).toLowerCase().replace(/-/g, " ");
  const match = SAT_ROLES.find((r) => r.toLowerCase() === needle);
  if (match) return match;
  if (needle.includes("verifier")) return "Proof Verifier";
  if (needle.includes("guard")) return "Constitution Guard";
  if (needle.includes("registrar")) return "URP Registrar";
  if (needle.includes("risk")) return "Risk Sentinel";
  if (needle.includes("impact") || needle.includes("scorer")) return "Impact Scorer";
  return "Proof Verifier";
}

/**
 * @param {object} [opts]
 * @param {string} [opts.agent_id]
 * @param {string} [opts.role]
 * @param {string} [opts.serves]
 */
export function buildSatAgentTemplate({
  agent_id = "sat-verifier",
  role = "Proof Verifier",
  serves = "bizra_system",
} = {}) {
  let roleName = normalizeSatRole(role);
  if (typeof role === "string" && role.includes("-")) {
    const tail = role.split("-").slice(1).join("-");
    roleName = normalizeSatRole(tail);
  }

  const allowed = SAT_ROLE_EFFECTS[roleName] ?? SAT_ROLE_EFFECTS["Proof Verifier"];

  return buildAgentContract({
    agent_id,
    agent_role: roleName,
    serves,
    scope: AGENT_SCOPES.SYSTEM_SAT_SUMMARY,
    privacy_class: PRIVACY_CLASSES.SAT_SUMMARY_ONLY,
    truth_label: "ADK_SAT_AGENT_TEMPLATE",
    allowed_effects: [...allowed],
    forbidden_effects: [
      "SIGN",
      "FEDERATE",
      "MINT_TOKEN",
      "EXPORT_PRIVATE_MEMORY",
      "RECEIVE_PAT_RAW_MEMORY",
      "READ_PAT_RAW_MEMORY",
      "SEND_RAW_MEMORY_TO_SAT",
      "NETWORK",
      "KEY_GENERATION",
      "WRITE_FILE",
    ],
    consent_required_for: [],
    consent_policy:
      "SAT receives proof summaries only; never raw PAT memory; no autonomous execution in ADK v0.1.",
    proof_policy:
      "Verify, classify, and register proof summaries — refuse when evidence is incomplete.",
    receipt_policy:
      "Registration and verification receipts must state what_this_proves and what_this_does_not_prove.",
    proof_required: true,
    what_this_proves:
      "This SAT agent may verify and classify proof summaries within SYSTEM_SAT_SUMMARY scope.",
    what_this_does_not_prove:
      "Does not prove PAT raw memory was accessed, operator consent, live execution, signing, federation, or economic settlement.",
    stop_by_default: true,
  });
}

export function listSatTemplateIds() {
  return Object.freeze([
    "sat-verifier",
    "sat-constitution-guard",
    "sat-urp-registrar",
    "sat-risk-sentinel",
    "sat-impact-scorer",
  ]);
}
