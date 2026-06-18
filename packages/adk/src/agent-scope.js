// BIZRA-ADK-AGENT-CONTRACT-1A · scope and privacy class vocabulary.

export const AGENT_CONTRACT_SCHEMA = "bizra.dema.adk_agent_contract.v0.1";
export const ADK_RECEIPT_PREVIEW_SCHEMA = "bizra.dema.adk_receipt_preview.v0.1";

export const AGENT_SCOPES = Object.freeze({
  PRIVATE_PAT: "PRIVATE_PAT",
  SYSTEM_SAT_SUMMARY: "SYSTEM_SAT_SUMMARY",
});

export const PRIVACY_CLASSES = Object.freeze({
  PAT_RAW_LOCAL: "PAT_RAW_LOCAL",
  SAT_SUMMARY_ONLY: "SAT_SUMMARY_ONLY",
});

export const PAT_ROLES = Object.freeze([
  "Mirror",
  "Architect",
  "Engineer",
  "Auditor",
  "Strategist",
  "Caretaker",
  "Scribe",
]);

export const SAT_ROLES = Object.freeze([
  "Proof Verifier",
  "Constitution Guard",
  "URP Registrar",
  "Risk Sentinel",
  "Impact Scorer",
]);

export function isPatScope(scope) {
  return scope === AGENT_SCOPES.PRIVATE_PAT;
}

export function isSatScope(scope) {
  return scope === AGENT_SCOPES.SYSTEM_SAT_SUMMARY;
}

export function isKnownScope(scope) {
  return Object.values(AGENT_SCOPES).includes(scope);
}

/** PAT scope must use PAT_RAW_LOCAL; SAT scope must use SAT_SUMMARY_ONLY. */
export function scopePrivacyAligned(scope, privacyClass) {
  if (isPatScope(scope)) return privacyClass === PRIVACY_CLASSES.PAT_RAW_LOCAL;
  if (isSatScope(scope)) return privacyClass === PRIVACY_CLASSES.SAT_SUMMARY_ONLY;
  return false;
}
