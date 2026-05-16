export const AMANA_CONTRACTS_PREVIEW_SCHEMA = "bizra.dema.amana_contracts_preview.v0.1";

const BLOCKED_ACTIONS = [
  "runtime_start",
  "mission_execution",
  "federation",
  "node_handshake",
  "step7_mint",
  "receipt_mint",
  "capability_mint",
  "external_posting",
  "network_egress"
];

const PROOF_GATES = {
  no_runtime: "npm run check",
  no_overclaim: "node scripts/review/no-overclaim.mjs",
  actuator_boundary: "node scripts/review/actuator-check.mjs",
  effectcap_invariant: "node --test tests/effectcap-invariant.test.js",
  release_readiness: "npm run release:readiness"
};

const PRIMITIVES = [
  {
    id: "consent_hash_table",
    name: "ConsentHashTable",
    purpose: "Preview exact micro-consent scope commitments before any capability decision.",
    status: "external_candidate_not_imported",
    current_repo_overlap: [
      "packages/consent/src/consent-planner.js",
      "docs/superpowers/specs/2026-05-14-effectcap-invariant/01_specification.md"
    ],
    external_source_hint: "Downloads audit Dema amana kernel contracts snapshot",
    import_risk: "medium",
    required_proof: [
      "deterministic canonical hashing",
      "revocation represented before allow",
      "no secrets in commitment payload",
      "exact scope lookup only"
    ],
    blocked_actions: BLOCKED_ACTIONS
  },
  {
    id: "effect_cap_decision",
    name: "EffectCapDecision",
    purpose: "Preview deny-by-default capability decisions bound to committed consent.",
    status: "specified_not_runtime",
    current_repo_overlap: [
      "scripts/review/actuator-check.mjs",
      "tests/effectcap-invariant.test.js",
      "docs/superpowers/specs/2026-05-14-effectcap-invariant/03_negative_tests.md"
    ],
    external_source_hint: "Downloads audit Dema amana kernel contracts snapshot",
    import_risk: "high",
    required_proof: [
      "no caller provided execution closure",
      "unknown operation denies",
      "high risk actuator requires explicit consent",
      "policy rules cannot execute code"
    ],
    blocked_actions: BLOCKED_ACTIONS
  },
  {
    id: "evidence_chain",
    name: "EvidenceChain",
    purpose: "Preview append-only evidence links without writing or advancing a governed chain.",
    status: "external_candidate_not_imported",
    current_repo_overlap: [
      "packages/verifier/src/evidence-receipt-preview.js",
      "tests/evidence-receipt-preview.test.js"
    ],
    external_source_hint: "Downloads audit Dema amana kernel contracts snapshot",
    import_risk: "medium",
    required_proof: [
      "prev hash required after genesis",
      "tamper changes root",
      "no filesystem mutation",
      "no signature or receipt mint"
    ],
    blocked_actions: BLOCKED_ACTIONS
  },
  {
    id: "impact_event",
    name: "ImpactEvent",
    purpose: "Preview why impact and economic claims stay blocked until measured evidence exists.",
    status: "external_candidate_not_imported",
    current_repo_overlap: [
      "packages/core/src/optimization-roadmap.js",
      "scripts/review/no-overclaim.mjs"
    ],
    external_source_hint: "Downloads audit Dema amana kernel contracts snapshot",
    import_risk: "high",
    required_proof: [
      "measured evidence required",
      "economic mint remains false",
      "reward claim remains false",
      "global verification remains false"
    ],
    blocked_actions: BLOCKED_ACTIONS
  },
  {
    id: "claim_ledger_checker",
    name: "ClaimLedgerChecker",
    purpose: "Preview a Markdown claim gate for measured, cited, declared, planned, or removal labels.",
    status: "external_candidate_not_imported",
    current_repo_overlap: [
      "scripts/review/no-overclaim.mjs",
      "docs/LLM_SYSTEM_FLOW.md"
    ],
    external_source_hint: "Downloads audit claim ledger checker snapshots",
    import_risk: "low",
    required_proof: [
      "public claims are truth labeled",
      "economic claims require measured evidence",
      "planned claims cannot read as live",
      "existing no overclaim gate is not duplicated"
    ],
    blocked_actions: BLOCKED_ACTIONS
  },
  {
    id: "journey_preview",
    name: "JourneyPreview",
    purpose: "Preview first-run to proof journey language without implying live handoff.",
    status: "historical_preview_requires_truth_review",
    current_repo_overlap: [
      "packages/core/src/onboarding.js",
      "docs/USER_LIFECYCLE.md"
    ],
    external_source_hint: "Downloads audit journey preview snapshots",
    import_risk: "high",
    required_proof: [
      "command names match current CLI truth",
      "handoff language is future labeled",
      "no runtime or mission execution implied",
      "Step 7 remains blocked"
    ],
    blocked_actions: BLOCKED_ACTIONS
  }
];

const BOUNDARY = {
  scope: "read-only-preview",
  runtime_execution: false,
  execution_enabled: false,
  mutation_performed: false,
  filesystem_write_performed: false,
  capability_minted: false,
  receipt_minted: false,
  network_connection_attempted: false,
  network_egress: false,
  federation_initiated: false,
  node_handshake_performed: false,
  step7_mint_performed: false,
  external_posting_performed: false
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function buildAmanaContractsPreview() {
  return {
    schema: AMANA_CONTRACTS_PREVIEW_SCHEMA,
    mode: "PREVIEW_ONLY",
    truth_label: "DECLARED",
    title: "Amana Contract Registry Preview",
    summary:
      "Read-only registry of Amana-adjacent contract primitives found during external audit. " +
      "This previews integration risk and proof requirements only; it does not import or execute external code.",
    step7_status: "BLOCKED_PRE_AMANA",
    unblocks_step7: false,
    source_policy: {
      external_code_imported: false,
      external_code_invoked: false,
      implementation_copied: false,
      source_hints_are_descriptive_only: true
    },
    proof_gates: clone(PROOF_GATES),
    primitives: clone(PRIMITIVES),
    boundary: clone(BOUNDARY)
  };
}

function appendRows(lines, rows, render) {
  for (const row of rows) lines.push(`  - ${render(row)}`);
}

export function formatAmanaContractsPreview(preview) {
  const lines = [
    "DEMA Amana Contract Registry Preview",
    "",
    `Mode: ${preview.mode}`,
    `Truth label: ${preview.truth_label}`,
    `Step 7: ${preview.step7_status}`,
    `Unblocks Step 7: ${preview.unblocks_step7}`,
    "",
    preview.summary,
    "",
    "Primitives:"
  ];

  appendRows(
    lines,
    preview.primitives,
    (primitive) => (
      `${primitive.id} (${primitive.name}) status="${primitive.status}" ` +
      `risk="${primitive.import_risk}" purpose="${primitive.purpose}"`
    )
  );

  lines.push("");
  lines.push("Proof gates:");
  appendRows(
    lines,
    Object.entries(preview.proof_gates),
    ([id, command]) => `${id}: ${command}`
  );

  lines.push("");
  lines.push(
    "Boundary: preview-only; no external code import; no runtime; no execution; no mutation; no capability mint; no receipt mint; no network; no federation; no Step 7 mint."
  );

  return lines.join("\n");
}
