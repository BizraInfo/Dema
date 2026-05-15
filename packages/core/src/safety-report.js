const SCHEMA = "bizra.dema.safety_report_preview.v0.1";

const DEMO_LOOP = [
  "dema welcome",
  "dema setup",
  "dema models",
  "dema ambient",
  "dema consent plan \"Audit Downloads and send to Slack\"",
  "dema status",
  "dema doctor",
  "dema mission propose",
  "dema receipts",
  "dema monetize"
];

const BOUNDARY = {
  scope: "read-only",
  inference_invoked: false,
  execution_enabled: false,
  mutation_performed: false,
  capability_minted: false,
  receipt_minted: false,
  daemon_started: false
};

const PROOF_OF_TRUTH_CONVERGENCE = {
  formal: {
    label: "Formal",
    status: "schema_preview_only",
    evidence_kind: "static_surface",
    certifies: false,
    claim: "Dema can present a schema-tagged safety report shape and explicit blocked-effects boundary."
  },
  cryptographic: {
    label: "Cryptographic",
    status: "pending_upstream_receipt_or_commitment",
    evidence_kind: "deferred_to_node0",
    certifies: false,
    claim: "Hashes, receipt-chain linkage, and SAT-grade commitments remain upstream in Node0 / bizra-omega."
  },
  empirical: {
    label: "Empirical",
    status: "operator_review_required",
    evidence_kind: "operator_observation",
    certifies: false,
    claim: "The operator must inspect the demo loop outputs before treating the safety posture as measured."
  },
  economic: {
    label: "Economic",
    status: "closed_until_measured_impact",
    evidence_kind: "blocked_claim",
    certifies: false,
    claim: "No token, revenue, Proof-of-Impact, or value claim is made from this preview."
  }
};

const PROACTIVE_ACTIONS = [
  {
    code: "run.demo_loop",
    action: "Run the demo loop and capture blocker wording before talking to lighthouse users."
  },
  {
    code: "narrow.consent_scope",
    action: "Use consent planning to narrow any requested effect before Node0 handoff."
  },
  {
    code: "prepare.report_evidence",
    action: "Attach receipt or verifier evidence only after upstream Node0 emits it."
  }
];

const SELF_CRITIQUE_GAPS = [
  {
    code: "installer.packaging_pending",
    severity: "launch_blocker",
    note: "Developer install exists, but broad GTM needs packaged install, hashes, dry-run/check, and uninstall."
  },
  {
    code: "sat.real_verifier_pending",
    severity: "trust_gap",
    note: "Local verifier remains partial until SAT-facing receipt verification is fully wired."
  },
  {
    code: "report.evidence_pending",
    severity: "review",
    note: "This report is a buyer-facing preview, not a computed proof or canonical receipt."
  }
];

const TRUTH_SPINE_PREVIEWS = {
  ihsan_floor: {
    schema: "bizra.dema.ihsan_floor_preview.v0.1",
    status: "preview_only_external_scalar",
    certifies: false,
    note: "Dema can check an externally supplied Ihsan scalar against the upstream floor, but does not compute canonical Ihsan."
  },
  evidence_receipt: {
    schema: "bizra.dema.evidence_receipt_preview.v0.1",
    status: "preview_only_no_chain",
    certifies: false,
    digest_algo: "sha256",
    chain_id: "preview-only-no-chain",
    receipt_minted: false,
    note: "Dema can derive deterministic preview hashes without minting, signing, or advancing a Node0 chain."
  },
  behavioral_modulation: {
    schema: "bizra.dema.behavioral_modulation_preview.v0.1",
    status: "preview_only_consent_bound",
    certifies: false,
    receipt_minted: false,
    behavior_changed: false,
    note: "Dema can preview consent-bound behavioral modulation rules, constitutionally reject unsafe shaping, and attach a no-mint receipt preview."
  }
};

export function buildSafetyReportPreview({ now = new Date() } = {}) {
  return {
    schema: SCHEMA,
    generated_at: now.toISOString(),
    mode: "PREVIEW_ONLY",
    audience: "lighthouse_alpha_operator",
    title: "Sovereign Local AI Node Setup + Safety Audit",
    summary: {
      plain_language:
        "Dema can show what is local, what is consent-bound, what is blocked, and what evidence is still missing.",
      no_proof_computed:
        "No proof is computed by this command; it is a preview template for operator review."
    },
    proof_of_truth_convergence: PROOF_OF_TRUTH_CONVERGENCE,
    proactive_harness: {
      status: "preview",
      next_actions: PROACTIVE_ACTIONS
    },
    truth_spine_previews: TRUTH_SPINE_PREVIEWS,
    self_critique: {
      status: "open_gaps_visible",
      gaps: SELF_CRITIQUE_GAPS
    },
    demo_loop: DEMO_LOOP,
    boundary: BOUNDARY
  };
}

function appendBullets(lines, items) {
  for (const item of items) lines.push(`  - ${item}`);
}

export function formatSafetyReportPreview(report) {
  const lines = [
    "DEMA Safety Report Preview",
    "",
    `Mode: ${report.mode}`,
    `Offer: ${report.title}`,
    `Audience: ${report.audience}`,
    `Summary: ${report.summary.plain_language}`,
    `Note: ${report.summary.no_proof_computed}`,
    "",
    "Proof-of-Truth Convergence:"
  ];

  for (const pillar of Object.values(report.proof_of_truth_convergence)) {
    lines.push(
      `  ${pillar.label}: ${pillar.status} (${pillar.evidence_kind}; certifies=${pillar.certifies})`
    );
    lines.push(`    ${pillar.claim}`);
  }

  lines.push("");
  lines.push("Proactive harness:");
  for (const item of report.proactive_harness.next_actions) {
    lines.push(`  - ${item.code}: ${item.action}`);
  }

  lines.push("");
  lines.push("Truth spine previews:");
  for (const [name, preview] of Object.entries(report.truth_spine_previews)) {
    lines.push(`  - ${name}: ${preview.status} (${preview.schema}; certifies=${preview.certifies})`);
    lines.push(`    ${preview.note}`);
  }

  lines.push("");
  lines.push("Self-critique:");
  for (const gap of report.self_critique.gaps) {
    lines.push(`  - ${gap.severity}: ${gap.code} - ${gap.note}`);
  }

  lines.push("");
  lines.push("Demo loop:");
  appendBullets(lines, report.demo_loop);
  lines.push("");
  lines.push("Boundary: preview-only; no model inference; no execution; no mutation; no receipt minted.");

  return lines.join("\n");
}
