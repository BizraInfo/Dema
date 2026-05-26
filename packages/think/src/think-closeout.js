import { sha256, stableStringify } from "../../consent/src/consent-common.js";

const LIVE_SCHEMA = "bizra.dema.think_live.v0.1";
const RECEIPT_SCHEMA = "bizra.dema.think_receipt.v0.1";
const ACCEPTED_SCHEMAS = [LIVE_SCHEMA, RECEIPT_SCHEMA];

function closeoutFromLiveEnvelope(envelope) {
  const payload = { ...envelope };
  delete payload.proof_hash;
  const recomputedHash = sha256(stableStringify(payload));
  const hashMatch = recomputedHash === envelope.proof_hash;

  const inv = envelope.invocation ?? {};
  const b = envelope.boundary ?? {};
  const be = envelope.boundary_evidence ?? {};

  const warnings = [];
  if (!inv.consent_phrase_verified)
    warnings.push("consent_phrase not verified");
  if (b.public_network_used) warnings.push("public network was used");
  if (b.filesystem_write_performed) warnings.push("filesystem write detected");
  if (b.receipt_mint_performed)
    warnings.push("receipt was minted unexpectedly");
  if (!hashMatch)
    warnings.push("proof_hash MISMATCH — envelope may be tampered");

  return {
    schema: "bizra.dema.think_closeout.v0.1",
    source_schema: envelope.schema,
    query: envelope.query ?? null,
    model: envelope.context_manifest?.model ?? null,
    mode: envelope.mode ?? null,
    invocation: {
      status: inv.status ?? null,
      model_responded: inv.model_responded ?? false,
      output_length_chars: inv.output_length_chars ?? 0,
      consent_verified: inv.consent_phrase_verified ?? false,
    },
    output_preview: envelope.output ? envelope.output.slice(0, 500) : null,
    verification: {
      proof_hash_match: hashMatch,
      recomputed_hash: recomputedHash,
      original_hash: envelope.proof_hash ?? null,
    },
    boundary_summary: {
      model_invocation_performed: b.model_invocation_performed ?? false,
      consent_collected: b.consent_collected ?? false,
      network_used: b.network_used ?? false,
      public_network_used: b.public_network_used ?? false,
      external_call_performed: b.external_call_performed ?? false,
      external_call_scope: be.external_call_scope ?? null,
      filesystem_write_performed: b.filesystem_write_performed ?? false,
      receipt_mint_performed: b.receipt_mint_performed ?? false,
    },
    evidence_summary: {
      model_invocation: be.model_invocation ?? null,
      public_network: be.public_network ?? null,
      filesystem_write: be.filesystem_write ?? null,
      receipt_minted: be.receipt_minted ?? null,
      memory_query: be.memory_query ?? null,
    },
    warnings,
    warning_count: warnings.length,
  };
}

function closeoutFromReceipt(receipt) {
  const check = { ...receipt };
  delete check.receipt_hash;
  const recomputedHash = sha256(stableStringify(check));
  const hashMatch = recomputedHash === receipt.receipt_hash;

  const inv = receipt.invocation ?? {};
  const bs = receipt.boundary_summary ?? {};
  const es = receipt.evidence_summary ?? {};
  const se = receipt.source_envelope ?? {};

  const warnings = [];
  if (!inv.consent_verified) warnings.push("consent_phrase not verified");
  if (bs.public_network_used) warnings.push("public network was used");
  if (bs.filesystem_write_performed)
    warnings.push("filesystem write detected (source envelope)");
  if (bs.receipt_mint_performed)
    warnings.push("receipt was minted unexpectedly");
  if (!hashMatch)
    warnings.push("receipt_hash MISMATCH — receipt may be tampered");
  if (!se.proof_hash_verified)
    warnings.push("source envelope proof_hash was NOT verified at save time");

  return {
    schema: "bizra.dema.think_closeout.v0.1",
    source_schema: receipt.schema,
    query: receipt.query ?? null,
    model: receipt.model ?? null,
    mode: receipt.mode ?? null,
    invocation: {
      status: inv.status ?? null,
      model_responded: inv.model_responded ?? false,
      output_length_chars: inv.output_length_chars ?? 0,
      consent_verified: inv.consent_verified ?? false,
    },
    output_preview: receipt.output_preview ?? null,
    verification: {
      proof_hash_match: hashMatch,
      recomputed_hash: recomputedHash,
      original_hash: receipt.receipt_hash ?? null,
    },
    boundary_summary: {
      model_invocation_performed: bs.model_invocation_performed ?? false,
      consent_collected: bs.consent_collected ?? false,
      network_used: bs.network_used ?? false,
      public_network_used: bs.public_network_used ?? false,
      external_call_performed: bs.external_call_performed ?? false,
      external_call_scope: bs.external_call_scope ?? null,
      filesystem_write_performed: bs.filesystem_write_performed ?? false,
      receipt_mint_performed: bs.receipt_mint_performed ?? false,
    },
    evidence_summary: {
      model_invocation: es.model_invocation ?? null,
      public_network: es.public_network ?? null,
      filesystem_write: es.filesystem_write ?? null,
      receipt_minted: es.receipt_minted ?? null,
      memory_query: null,
    },
    warnings,
    warning_count: warnings.length,
  };
}

export function buildThinkCloseout(envelope) {
  if (!envelope || typeof envelope !== "object") {
    return {
      error:
        "Think closeout requires a valid think_live envelope or think_receipt.",
    };
  }
  if (!ACCEPTED_SCHEMAS.includes(envelope.schema)) {
    return {
      error: `Expected schema ${ACCEPTED_SCHEMAS.join(" or ")}, got ${envelope.schema ?? "none"}.`,
    };
  }

  if (envelope.schema === RECEIPT_SCHEMA) {
    return closeoutFromReceipt(envelope);
  }
  return closeoutFromLiveEnvelope(envelope);
}

export function formatThinkCloseout(closeout) {
  if (closeout.error) return closeout.error;

  const v = closeout.verification;
  const bs = closeout.boundary_summary;
  const es = closeout.evidence_summary;
  const hashStatus = v.proof_hash_match ? "PASS" : "MISMATCH";

  const lines = [
    "Think Closeout Report v0.1",
    "=".repeat(42),
    `  Query:          ${closeout.query ?? "unknown"}`,
    `  Model:          ${closeout.model ?? "unknown"}`,
    `  Mode:           ${closeout.mode ?? "unknown"}`,
    `  Status:         ${closeout.invocation.status ?? "unknown"}`,
    `  Output:         ${closeout.output_preview ? closeout.output_preview.slice(0, 80) + (closeout.output_preview.length > 80 ? "..." : "") : "none"}`,
    "",
    "  Consent:",
    `    Verified:     ${closeout.invocation.consent_verified ? "yes" : "NO"}`,
    "",
    "  Proof:",
    `    Hash Verified: ${hashStatus}`,
    "",
    "  Boundary:",
    `    model_invoked:   ${bs.model_invocation_performed} (${es.model_invocation ?? "?"})`,
    `    network_used:    ${bs.network_used}`,
    `    public_network:  ${bs.public_network_used} (${es.public_network ?? "?"})`,
    `    external_call:   ${bs.external_call_performed} (${bs.external_call_scope ?? "?"})`,
    `    fs_write:        ${bs.filesystem_write_performed} (${es.filesystem_write ?? "?"})`,
    `    receipt_minted:  ${bs.receipt_mint_performed} (${es.receipt_minted ?? "?"})`,
  ];

  if (closeout.warnings.length > 0) {
    lines.push("");
    lines.push("  Warnings:");
    for (const w of closeout.warnings) {
      lines.push(`    ! ${w}`);
    }
  }

  lines.push("");
  lines.push("=".repeat(42));
  return lines.join("\n");
}
