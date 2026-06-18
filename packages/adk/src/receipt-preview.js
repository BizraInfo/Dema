// BIZRA-ADK-AGENT-CONTRACT-1A · receipt preview for validated contracts only.

import { ADK_RECEIPT_PREVIEW_SCHEMA } from "./agent-scope.js";
import { validateAgentContract } from "./agent-validator.js";
import { buildPreviewBoundary } from "../../core/src/preview-boundary.js";

/**
 * @param {object} rawContract
 */
export function buildAdkReceiptPreview(rawContract) {
  const validation = validateAgentContract(rawContract);
  if (!validation.valid) {
    return Object.freeze({
      schema: ADK_RECEIPT_PREVIEW_SCHEMA,
      built: false,
      error: "contract_invalid",
      validation_errors: validation.errors,
      boundary: buildPreviewBoundary(),
    });
  }

  const contract = validation.contract;
  if (!contract.what_this_proves || !contract.what_this_does_not_prove) {
    return Object.freeze({
      schema: ADK_RECEIPT_PREVIEW_SCHEMA,
      built: false,
      error: "receipt_fields_missing",
      boundary: buildPreviewBoundary(),
    });
  }

  return Object.freeze({
    schema: ADK_RECEIPT_PREVIEW_SCHEMA,
    built: true,
    truth_label: "ADK_AGENT_RECEIPT_PREVIEW",
    mode: "preview_only",
    agent_id: contract.agent_id,
    scope: contract.scope,
    serves: contract.serves,
    what_this_proves: contract.what_this_proves,
    what_this_does_not_prove: contract.what_this_does_not_prove,
    proof_policy: contract.proof_policy,
    receipt_policy: contract.receipt_policy,
    stop_by_default: contract.stop_by_default,
    lifecycle_terminal_step: "STOP",
    note: "Preview only — ADK v0.1 does not execute, sign, or federate agents.",
    boundary: buildPreviewBoundary(),
  });
}
