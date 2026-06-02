import { buildConsentPlanPreview } from "../../consent/src/consent-planner.js";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { validateMaxLength, VALIDATION_LIMITS } from "../../core/src/input-validator.js";

const SCHEMA = "bizra.dema.mission_draft_preview.v0.1";

function missionIdFor(intent) {
  return `mission_${sha256(intent).slice(0, 12)}`;
}

function domainForPermission(permission) {
  if (permission.resource_id.startsWith("file:")) {
    return permission.resource_id
      .slice("file:".length)
      .split("/")
      .pop()
      .replace(/\.[^.]+$/, "");
  }
  if (permission.resource_id.startsWith("path:")) {
    return permission.resource_id.slice("path:".length);
  }
  if (permission.resource_id.startsWith("service:")) {
    return permission.resource_id.slice("service:".length);
  }
  return null;
}

function dataDomains(permissions) {
  return [...new Set(permissions.map(domainForPermission).filter(Boolean))];
}

export async function buildMissionDraftPreview({ intent, now = new Date() } = {}) {
  const naturalLanguage = String(intent ?? "").trim();
  
  // Security: Validate intent length to prevent DoS via massive input strings
  const lengthValidation = await validateMaxLength(
    naturalLanguage,
    VALIDATION_LIMITS.MAX_INTENT_LENGTH,
    "intent"
  );
  
  if (!lengthValidation.accepted) {
    throw new Error(lengthValidation.rejected_detail);
  }
  
  if (!naturalLanguage) {
    throw new Error("Mission draft requires a non-empty intent.");
  }

  const consentPlan = await buildConsentPlanPreview({ intent: naturalLanguage, now });
  const mission = {
    id: missionIdFor(naturalLanguage),
    natural_language: naturalLanguage,
    category: consentPlan.mission_draft.category,
    data_domains: dataDomains(consentPlan.permissions),
    risk_level: consentPlan.mission_draft.risk_level,
    current_phase: "DRAFT_INTENT"
  };

  return {
    schema: SCHEMA,
    generated_at: now.toISOString(),
    mode: "PREVIEW_ONLY",
    mission,
    consent_plan: consentPlan,
    mission_commitment_hash: sha256(stableStringify(mission)),
    phase_gate: {
      current_phase: "DRAFT_INTENT",
      next_phase: "CONSENT_NEGOTIATION",
      requirement: "human reviews and approves a committed ConsentScope in governed Node0 runtime",
      consent_scope_committed: false,
      effect_caps_minted: false
    },
    boundary: {
      scope: "read-only",
      inference_invoked: false,
      approval_recorded: false,
      capability_minted: false,
      execution_enabled: false,
      mutation_performed: false,
      receipt_minted: false,
      daemon_started: false,
      network_connection_attempted: false,
      external_posting_performed: false
    }
  };
}

function appendPermissions(lines, permissions) {
  for (const permission of permissions) {
    lines.push(`  - ${permission.resource_id}  ${permission.action}  purpose="${permission.purpose}"`);
  }
  if (permissions.length === 0) lines.push("  - none detected");
}

export function formatMissionDraftPreview(draft) {
  const lines = [
    "DEMA Mission Draft Preview",
    "",
    `Mode: ${draft.mode}`,
    `mission_id: ${draft.mission.id}`,
    `intent: ${draft.mission.natural_language}`,
    `category: ${draft.mission.category}`,
    `risk: ${draft.mission.risk_level}`,
    `data_domains: ${draft.mission.data_domains.length > 0 ? draft.mission.data_domains.join(", ") : "none"}`,
    `current_phase: ${draft.mission.current_phase}`,
    `next_phase: ${draft.phase_gate.next_phase}`,
    `mission_commitment_hash: ${draft.mission_commitment_hash}`,
    `consent_commitment_hash: ${draft.consent_plan.commitment_hash}`,
    "",
    "Proposed permissions:"
  ];

  appendPermissions(lines, draft.consent_plan.permissions);
  lines.push("");
  lines.push("Analogical notes:");
  for (const note of draft.consent_plan.analogical_notes) {
    lines.push(`  - ${note.severity}: ${note.code} - ${note.note}`);
  }
  if (draft.consent_plan.analogical_notes.length === 0) lines.push("  - none");
  lines.push("");
  lines.push(`Gate: ${draft.phase_gate.requirement}`);
  lines.push(
    "Boundary: preview-only; no approval; no capability minted; no execution; no network; no external posting."
  );

  return lines.join("\n");
}
