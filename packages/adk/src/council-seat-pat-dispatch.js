// UX-3B · Consent-gated council seat → PAT dispatch (preview-only).
//
// Bridges council-route seat mapping to ADK PAT agent contracts. Exact-string
// consent required before emitting contract + receipt preview. Never executes
// PAT runtime, network, keys, or file writes.

import {
  COUNCIL_SEAT_PAT_ROUTES,
  councilPatDispatchConsentPhrase,
  normalizeCouncilSeatToken,
} from "../../core/src/council-seat-pat-routing.js";
import { buildPreviewBoundary } from "../../core/src/preview-boundary.js";
import { buildPatAgentTemplate } from "./pat-template.js";
import { validateAgentContract } from "./agent-validator.js";
import { buildAdkReceiptPreview } from "./receipt-preview.js";

export const COUNCIL_SEAT_PAT_DISPATCH_SCHEMA =
  "bizra.dema.council_seat_pat_dispatch_preview.v0.1";

export { councilPatDispatchConsentPhrase } from "../../core/src/council-seat-pat-routing.js";

export function consentMatchesCouncilPatDispatch({ seat, consent_phrase }) {
  const required = councilPatDispatchConsentPhrase(seat);
  if (!required) return false;
  const provided =
    typeof consent_phrase === "string" ? consent_phrase.trim() : "";
  return provided === required;
}

/**
 * @param {object} [opts]
 * @param {string} [opts.seat]
 * @param {string} [opts.consent_phrase]
 * @param {Date} [opts.now]
 */
export function buildCouncilSeatPatDispatchPreview({
  seat = null,
  consent_phrase = "",
  now = new Date(),
} = {}) {
  const boundary = buildPreviewBoundary();
  const resolved =
    typeof seat === "string" ? normalizeCouncilSeatToken(seat) : null;

  if (!resolved) {
    return Object.freeze({
      schema: COUNCIL_SEAT_PAT_DISPATCH_SCHEMA,
      truth_label: "ADK_PAT_DISPATCH_PREVIEW",
      mode: "preview_only",
      dispatch_status: seat ? "seat_unresolved" : "seat_required",
      seat_requested: typeof seat === "string" ? seat : null,
      selected_seat: null,
      consent_phrase_required: null,
      consent_phrase_provided:
        typeof consent_phrase === "string" && consent_phrase.trim()
          ? consent_phrase.trim()
          : null,
      consent_match: false,
      agent_contract: null,
      contract_valid: false,
      receipt_preview: null,
      disclaimer:
        "Council PAT dispatch is preview-only. No PAT runtime is executed.",
      rendered_at_iso: now.toISOString(),
      boundary,
    });
  }

  const required = councilPatDispatchConsentPhrase(resolved);
  const provided =
    typeof consent_phrase === "string" ? consent_phrase.trim() : "";
  const consentMatch = provided === required;

  if (!consentMatch) {
    return Object.freeze({
      schema: COUNCIL_SEAT_PAT_DISPATCH_SCHEMA,
      truth_label: "ADK_PAT_DISPATCH_PREVIEW",
      mode: "preview_only",
      dispatch_status: "consent_required",
      seat_requested: seat,
      selected_seat: resolved,
      council_role: COUNCIL_SEAT_PAT_ROUTES[resolved].council_role,
      pat_role: COUNCIL_SEAT_PAT_ROUTES[resolved].pat_role,
      pat_agent_id: COUNCIL_SEAT_PAT_ROUTES[resolved].pat_agent_id,
      consent_phrase_required: required,
      consent_phrase_provided: provided || null,
      consent_match: false,
      agent_contract: null,
      contract_valid: false,
      receipt_preview: null,
      disclaimer:
        "Council PAT dispatch is preview-only. No PAT runtime is executed.",
      rendered_at_iso: now.toISOString(),
      boundary,
    });
  }

  const route = COUNCIL_SEAT_PAT_ROUTES[resolved];
  const agent_contract = buildPatAgentTemplate({
    agent_id: route.pat_agent_id,
    role: route.pat_role,
  });
  const validation = validateAgentContract(agent_contract);
  const receipt_preview = buildAdkReceiptPreview(agent_contract);

  return Object.freeze({
    schema: COUNCIL_SEAT_PAT_DISPATCH_SCHEMA,
    truth_label: "ADK_PAT_DISPATCH_PREVIEW",
    mode: "preview_only",
    dispatch_status: "dispatched_preview_only",
    seat_requested: seat,
    selected_seat: resolved,
    council_role: route.council_role,
    pat_role: route.pat_role,
    pat_agent_id: route.pat_agent_id,
    consent_phrase_required: required,
    consent_phrase_provided: provided,
    consent_match: true,
    agent_contract,
    contract_valid: validation.valid,
    receipt_preview,
    disclaimer:
      "Dispatched preview only — ADK v0.1 does not execute PAT runtime.",
    rendered_at_iso: now.toISOString(),
    boundary,
  });
}

export function formatCouncilSeatPatDispatchResponse(preview) {
  if (preview.dispatch_status === "dispatched_preview_only") {
    const receiptBuilt = preview.receipt_preview?.built === true;
    return [
      "> Council seat → PAT dispatch (preview only)",
      "",
      `  Seat:      ${preview.selected_seat} · ${preview.council_role}`,
      `  PAT:       ${preview.pat_role} (${preview.pat_agent_id})`,
      `  Contract:  ${preview.contract_valid ? "VALID" : "INVALID"}`,
      `  Receipt:   ${receiptBuilt ? "preview built" : "preview refused"}`,
      "",
      "  No PAT runtime was executed.",
    ].join("\n");
  }

  if (preview.dispatch_status === "consent_required") {
    return [
      "> Council seat → PAT dispatch requires exact-string consent",
      "",
      `  Seat:     ${preview.selected_seat} · ${preview.pat_role} (${preview.pat_agent_id})`,
      `  Required: ${preview.consent_phrase_required}`,
      "",
      "  Re-run with:",
      `    dema realm council-dispatch --seat ${preview.selected_seat} --consent "${preview.consent_phrase_required}"`,
    ].join("\n");
  }

  return [
    "> Council seat → PAT dispatch (seat required)",
    "",
    "  Usage:",
    "    dema realm council-dispatch --seat Guardian [--consent \"GO: dispatch PAT from council seat Guardian\"]",
  ].join("\n");
}
