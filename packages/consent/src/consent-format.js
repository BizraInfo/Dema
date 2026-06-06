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

function appendActuatorClasses(lines, classes) {
  if (!classes || classes.length === 0) {
    lines.push("  - none detected");
    return;
  }
  for (const actuatorClass of classes) lines.push(`  - ${actuatorClass}`);
}

function appendPolicyDecisions(lines, decisions) {
  if (!decisions || decisions.length === 0) {
    lines.push("  - none");
    return;
  }
  for (const decision of decisions) {
    lines.push(
      `  - ${decision.verdict}: ${decision.code} - ${decision.reason}`,
    );
  }
}

function appendProofOfTruth(lines, proofOfTruth) {
  for (const [pillar, value] of Object.entries(proofOfTruth)) {
    lines.push(`  ${pillar}: ${value.status} - ${value.proof}`);
  }
}

function appendHarnessGates(lines, gates) {
  for (const gate of gates) lines.push(`  - ${gate.gate}: pass=${gate.pass}`);
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
    "Proposed permissions:",
  ];

  appendPermissions(lines, plan.permissions);
  lines.push("");
  lines.push("Actuator classes:");
  appendActuatorClasses(lines, plan.actuator_classes);
  lines.push("");
  lines.push("Policy preview:");
  appendPolicyDecisions(lines, plan.policy_preview?.decisions);
  lines.push(
    `  effect_capability: ${plan.effect_capability.status}; minted=${plan.effect_capability.minted}`,
  );
  lines.push("");
  lines.push("Self-proactive harness:");
  lines.push(
    `  recommended_micro_action: ${plan.self_proactive_harness.recommended_micro_action}`,
  );
  appendHarnessGates(lines, plan.self_proactive_harness.gates);
  lines.push("");
  lines.push("Micro-compliance:");
  lines.push(
    `  policy_covers_detected_actuators: ${plan.micro_compliance.policy_covers_detected_actuators}`,
  );
  lines.push(
    `  no_policy_contradiction: ${plan.micro_compliance.no_policy_contradiction}`,
  );
  lines.push(`  no_runtime: ${plan.micro_compliance.no_runtime}`);
  lines.push(
    `  no_capability_mint: ${plan.micro_compliance.no_capability_mint}`,
  );
  lines.push("");
  lines.push("Self-critique:");
  lines.push(`  confidence: ${plan.self_critique.confidence}`);
  lines.push(`  weakest_link: ${plan.self_critique.weakest_link}`);
  lines.push(`  limitation: ${plan.self_critique.limitation}`);
  lines.push("");
  lines.push("Analogical model:");
  lines.push(
    `  ${plan.analogical_model.model}: ${plan.analogical_model.mapping}`,
  );
  lines.push("");
  lines.push("Analogical notes:");
  appendAnalogicalNotes(lines, plan.analogical_notes);
  lines.push("");
  lines.push("Proof-of-Truth:");
  appendProofOfTruth(lines, plan.proof_of_truth);
  lines.push("");
  lines.push(
    "Boundary: preview-only; no approval; no capability minted; no execution.",
  );

  return lines.join("\n");
}
