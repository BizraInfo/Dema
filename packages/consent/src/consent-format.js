function appendPermissions(lines, permissions) {
  if (permissions.length === 0) {
    lines.push("  - none detected");
    return;
  }
  for (const p of permissions) {
    lines.push(`  - ${p.resource_id}  ${p.action}  purpose="${p.purpose}"`);
  }
}

function appendAnalogicalNotes(lines, notes) {
  if (notes.length === 0) {
    lines.push("  - none");
    return;
  }
  for (const note of notes) {
    lines.push(`  - ${note.severity}: ${note.code} - ${note.note}`);
  }
}

function appendProofOfTruth(lines, proofOfTruth) {
  for (const [pillar, value] of Object.entries(proofOfTruth)) {
    lines.push(`  ${pillar}: ${value.status} - ${value.proof}`);
  }
}

export function formatConsentPlanPreview(plan) {
  const lines = [
    "DEMA Consent Plan Preview",
    "",
    `Mode: ${plan.mode}`,
    `Intent: ${plan.mission_draft.natural_language}`,
    `Category: ${plan.mission_draft.category}`,
    `Risk: ${plan.mission_draft.risk_level}`,
    `commitment_hash: ${plan.commitment_hash}`,
    "",
    "Proposed permissions:"
  ];

  appendPermissions(lines, plan.permissions);
  lines.push("");
  lines.push("Analogical notes:");
  appendAnalogicalNotes(lines, plan.analogical_notes);
  lines.push("");
  lines.push("Proof-of-Truth:");
  appendProofOfTruth(lines, plan.proof_of_truth);
  lines.push("");
  lines.push("Boundary: preview-only; no approval; no capability minted; no execution.");

  return lines.join("\n");
}
