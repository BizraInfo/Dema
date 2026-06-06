const SCHEMA = "bizra.dema.optimization_roadmap_preview.v0.1";

const PMBOK_LENSES = [
  {
    id: "integration_management",
    focus:
      "keep roadmap slices coherent across product, proof, review gates, CI evidence, and operator UX",
    canon_source: "docs/LLM_SYSTEM_FLOW.md",
  },
  {
    id: "scope_management",
    focus: "separate Dema preview surfaces from governed Node0 runtime work",
    canon_source: "docs/ARCHITECTURE.md",
  },
  {
    id: "quality_management",
    focus:
      "map performance, test, check, guidance, and diff hygiene evidence without enforcing gates here",
    canon_source: "docs/TESTING.md",
  },
  {
    id: "schedule_management",
    focus:
      "sequence roadmap dependencies so CI/CD, quality, and proof evidence mature before runtime handoff",
    canon_source: "docs/ENGINEERING_DISCIPLINE.md",
  },
  {
    id: "communications_management",
    focus:
      "keep roadmap status, blockers, evidence anchors, and non-goals visible to operators and reviewers",
    canon_source: "docs/LLM_SYSTEM_FLOW.md",
  },
  {
    id: "risk_management",
    focus:
      "surface launch blockers, cascading dependencies, and proof gaps before execution",
    canon_source: "docs/ENGINEERING_DISCIPLINE.md",
  },
  {
    id: "stakeholder_management",
    focus: "keep operator-facing language proof-safe and non-overclaiming",
    canon_source: "README.md",
  },
];

const MANAGEMENT_BODY_OF_KNOWLEDGE = [
  {
    id: "mbok.integration",
    practice:
      "single roadmap schema for workstreams, dependencies, gates, and boundaries",
    advisory_signal:
      "one preview can be reviewed without changing runtime state",
    canon_source: "docs/LLM_SYSTEM_FLOW.md",
  },
  {
    id: "mbok.quality",
    practice: "verification ladder and performance-quality assurance evidence",
    advisory_signal:
      "quality posture is visible before any proposed gate is enforced",
    canon_source: "docs/TESTING.md",
  },
  {
    id: "mbok.risk",
    practice:
      "dependency graph review, blocker labels, and proof-safe language",
    advisory_signal: "unsafe sequencing remains blocked by preview status",
    canon_source: "docs/ENGINEERING_DISCIPLINE.md",
  },
  {
    id: "mbok.communications",
    practice: "operator-readable status, non-goals, and handoff constraints",
    advisory_signal:
      "stakeholders can distinguish advisory roadmap text from runtime authority",
    canon_source: "README.md",
  },
];

const SNR_LENSES = [
  {
    id: "snr.signal_preservation",
    signal:
      "roadmap outputs favor exact evidence anchors, deterministic statuses, and explicit non-effects",
    noise_guard:
      "avoid success claims, runtime implication, token language, or hidden automation language",
    canon_source: "docs/LLM_SYSTEM_FLOW.md",
  },
  {
    id: "snr.review_compression",
    signal:
      "each roadmap item carries one primary blueprint focus and one quality signal",
    noise_guard:
      "avoid sprawling implementation instructions or CI workflow edits in the preview",
    canon_source: "docs/TESTING.md",
  },
  {
    id: "snr.blocker_visibility",
    signal: "proposed gates carry non-enforcing status and ownership labels",
    noise_guard:
      "avoid implying a gate is active unless local checks already provide read-only evidence",
    canon_source: "scripts/release-readiness.mjs",
  },
];

const SAPE_LENSES = [
  {
    id: "symbolic",
    signal:
      "schema-tagged previews, finite gates, explicit blocked effects, and deterministic CI/CD labels",
    next_probe: "Preview stronger types for consent-spine actuator classes.",
    canon_source:
      "docs/superpowers/specs/2026-05-14-actuator-boundary-spine/01_specification.md",
  },
  {
    id: "abstraction",
    signal:
      "Dema acts as product face while Node0 remains governed runtime boundary",
    next_probe:
      "Keep roadmap items mapped to architecture, security, performance-quality, CI/CD, docs, or ethics.",
    canon_source: "docs/ARCHITECTURE.md",
  },
  {
    id: "probe",
    signal: "read-only checks turn doctrine into repeatable local evidence",
    next_probe:
      "Keep actuator, canon, and roadmap checks as advisory release evidence.",
    canon_source: "scripts/check.mjs",
  },
  {
    id: "elevation",
    signal: "Ihsan, Adl, and Amanah become reviewable engineering constraints",
    next_probe:
      "Attach ethical acceptance criteria to each future runtime handoff contract.",
    canon_source: "docs/02-architecture/node0-urp-ecosystem-transition.md",
  },
];

const BLUEPRINT_COVERAGE = [
  {
    id: "blueprint.devops",
    domain: "devops",
    advisory_scope:
      "release hygiene, ownership labels, dependency visibility, and local verification sequencing",
    non_goal: "no CI workflow modification and no deployment path",
  },
  {
    id: "blueprint.ci_cd",
    domain: "ci_cd",
    advisory_scope:
      "immutable action review, proposed gate status, artifact naming, and check summarization",
    non_goal: "no gate enforcement and no hosted pipeline mutation",
  },
  {
    id: "blueprint.pipeline_automation",
    domain: "pipeline_automation",
    advisory_scope:
      "manual-to-automatable step inventory with consent and boundary labels",
    non_goal: "no automation runner, daemon, or dispatch",
  },
  {
    id: "blueprint.performance_quality_assurance",
    domain: "performance_quality_assurance",
    advisory_scope:
      "local-loop measurement contract, regression budget labels, and repeatable evidence anchors",
    non_goal: "no benchmark certification and no runtime performance claim",
  },
  {
    id: "blueprint.ethical_integrity",
    domain: "ethical_integrity",
    advisory_scope:
      "Ihsan, Adl, Amanah, consent clarity, and anti-overclaiming acceptance criteria",
    non_goal: "no identity-bound artifact and no economic claim",
  },
];

const ROADMAP_ITEMS = [
  {
    id: "R1",
    priority: 1,
    workstream: "security",
    title: "Actuator-class taxonomy for consent previews",
    outcome:
      "Operators can see whether an intent implies Bash, filesystem mutation, external call, GUI, mobile-agent, or spend risk.",
    evidence_anchor: "tests/consent-planner.test.js",
    depends_on: [],
    effect_class: "advisory_only",
    requires_upstream: false,
    blueprint_focus: "devops",
    management_knowledge_area: "scope_management",
    quality_signal: "boundary classification coverage",
    pipeline_surface: "manual_review",
    integrity_constraint:
      "exact-string consent remains required for any future operator action",
  },
  {
    id: "R2",
    priority: 2,
    workstream: "architecture",
    title: "Consent-spine preview command recommendation",
    outcome:
      "Intent, policy decision, and EffectCap handoff status render as one schema-tagged preview.",
    evidence_anchor: "packages/consent/src/consent-planner.js",
    depends_on: ["R1"],
    effect_class: "advisory_only",
    requires_upstream: false,
    blueprint_focus: "pipeline_automation",
    management_knowledge_area: "integration_management",
    quality_signal: "schema continuity",
    pipeline_surface: "local_cli_preview",
    integrity_constraint: "preview text must not imply runtime authority",
  },
  {
    id: "R3",
    priority: 3,
    workstream: "ci_cd",
    title: "Immutable CI action inventory",
    outcome:
      "CI launch blocker becomes a reviewable evidence inventory without changing workflows in this slice.",
    evidence_anchor: "scripts/release-readiness.mjs",
    depends_on: [],
    effect_class: "advisory_only",
    requires_upstream: false,
    blueprint_focus: "ci_cd",
    management_knowledge_area: "risk_management",
    quality_signal: "workflow supply-chain review",
    pipeline_surface: "hosted_ci_configuration",
    integrity_constraint: "no CI workflow modification from this preview",
  },
  {
    id: "R4",
    priority: 4,
    workstream: "pipeline",
    title: "Pipeline automation dry-run map",
    outcome:
      "Manual verification, advisory gates, and future automation candidates are separated by consent and effect class.",
    evidence_anchor: "docs/LLM_SYSTEM_FLOW.md",
    depends_on: ["R2", "R3"],
    effect_class: "advisory_only",
    requires_upstream: false,
    blueprint_focus: "pipeline_automation",
    management_knowledge_area: "schedule_management",
    quality_signal: "ordered handoff visibility",
    pipeline_surface: "local_gate_sequence",
    integrity_constraint:
      "no runner, daemon, dispatch, or hidden scheduler is introduced",
  },
  {
    id: "R5",
    priority: 5,
    workstream: "performance",
    title: "Local-loop performance quality envelope",
    outcome:
      "Design emulation can later consume measured Node0 profile data without upgrading claims.",
    evidence_anchor: "packages/core/src/loop-emulator.js",
    depends_on: ["R2", "R4"],
    effect_class: "advisory_only",
    requires_upstream: true,
    blueprint_focus: "performance_quality_assurance",
    management_knowledge_area: "quality_management",
    quality_signal: "measurement contract and regression-budget labels",
    pipeline_surface: "local_performance_review",
    integrity_constraint:
      "no benchmark certification or runtime performance claim",
  },
  {
    id: "R6",
    priority: 6,
    workstream: "documentation",
    title: "Receipt and verifier transparency matrix",
    outcome:
      "Docs distinguish preview, placeholder, partial, and certified states for receipt-facing users.",
    evidence_anchor: "docs/RECEIPTS.md",
    depends_on: [],
    effect_class: "advisory_only",
    requires_upstream: false,
    blueprint_focus: "devops",
    management_knowledge_area: "communications_management",
    quality_signal: "claim-state vocabulary",
    pipeline_surface: "release_notes_review",
    integrity_constraint: "receipt language remains read/list only in Dema",
  },
  {
    id: "R7",
    priority: 7,
    workstream: "management",
    title: "PMBOK risk and communications scorecard",
    outcome:
      "Reviewers can compare scope, quality, risk, schedule, and stakeholder signals before any runtime handoff proposal.",
    evidence_anchor: "docs/ENGINEERING_DISCIPLINE.md",
    depends_on: ["R3", "R5", "R6"],
    effect_class: "advisory_only",
    requires_upstream: true,
    blueprint_focus: "devops",
    management_knowledge_area: "risk_management",
    quality_signal: "management-body-of-knowledge traceability",
    pipeline_surface: "review_packet",
    integrity_constraint:
      "scorecard status is advisory and cannot certify readiness",
  },
  {
    id: "R8",
    priority: 8,
    workstream: "ethics",
    title: "Ethical integrity acceptance rubric",
    outcome:
      "Future runtime work can show Ihsan, Adl, and Amanah criteria before any execution path exists.",
    evidence_anchor: "docs/LLM_SYSTEM_FLOW.md",
    depends_on: ["R1", "R6", "R7"],
    effect_class: "advisory_only",
    requires_upstream: true,
    blueprint_focus: "ethical_integrity",
    management_knowledge_area: "stakeholder_management",
    quality_signal: "anti-overclaim and consent clarity review",
    pipeline_surface: "handoff_readiness_review",
    integrity_constraint:
      "no token, Proof-of-Impact, identity-bound, or economic claim",
  },
];

const PROPOSED_GATES = [
  {
    id: "gate.required_local",
    command:
      "npm test && npm run check && npm run llm:guidance && git diff --check",
    status: "already_local_practice",
    enforcement_owner: "local_operator",
    effect_class: "advisory_only",
    enforced: false,
    blueprint_domain: "quality",
  },
  {
    id: "gate.release_readiness",
    command: "npm run release:readiness",
    status: "advisory_read_only",
    enforcement_owner: "local_operator",
    effect_class: "advisory_only",
    enforced: false,
    blueprint_domain: "devops",
  },
  {
    id: "gate.immutable_actions",
    command: "review immutable GitHub Actions pinning evidence",
    status: "not_enforced",
    enforcement_owner: "future_ci_pr",
    effect_class: "advisory_only",
    enforced: false,
    blueprint_domain: "ci_cd",
  },
  {
    id: "gate.coverage_threshold",
    command: "review coverage threshold proposal when tooling policy allows",
    status: "not_enforced",
    enforcement_owner: "future_quality_pr",
    effect_class: "advisory_only",
    enforced: false,
    blueprint_domain: "performance_quality_assurance",
  },
  {
    id: "gate.pipeline_dry_run",
    command: "review manual-to-automatable pipeline step map",
    status: "not_enforced",
    enforcement_owner: "future_devops_pr",
    effect_class: "advisory_only",
    enforced: false,
    blueprint_domain: "pipeline_automation",
  },
  {
    id: "gate.ethical_integrity",
    command:
      "review Ihsan, Adl, Amanah, consent clarity, and anti-overclaiming criteria",
    status: "not_enforced",
    enforcement_owner: "future_ethics_review",
    effect_class: "advisory_only",
    enforced: false,
    blueprint_domain: "ethical_integrity",
  },
];

const PROOF_OF_TRUTH_CONVERGENCE = {
  formal: {
    label: "Formal",
    status: "roadmap_schema_preview",
    evidence_kind: "static_plan",
    certifies: false,
    claim:
      "Roadmap items, dependencies, gates, and boundaries are explicit and schema-tagged.",
  },
  cryptographic: {
    label: "Cryptographic",
    status: "deferred_to_node0_receipts",
    evidence_kind: "future_commitment",
    certifies: false,
    claim:
      "This preview does not hash-commit runtime outcomes or mint receipts.",
  },
  empirical: {
    label: "Empirical",
    status: "local_gates_available",
    evidence_kind: "repeatable_commands",
    certifies: false,
    claim:
      "Local verification commands can check the current code surface before any roadmap item advances.",
  },
  economic: {
    label: "Economic",
    status: "closed_until_verified_impact",
    evidence_kind: "blocked_claim",
    certifies: false,
    claim:
      "No reward, token, passive income, or Proof-of-Impact value is claimed.",
  },
};

const BOUNDARY = {
  scope: "read-only-preview",
  inference_invoked: false,
  execution_enabled: false,
  mutation_performed: false,
  ci_workflow_modified: false,
  deployment_attempted: false,
  capability_minted: false,
  receipt_minted: false,
  daemon_started: false,
  network_connection_attempted: false,
  federation_initiated: false,
  gates_enforced: false,
  gate_enforcement_changed: false,
  roadmap_executed: false,
  items_dispatched: false,
  economic_claim_made: false,
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sortedItems() {
  return clone(ROADMAP_ITEMS).sort(
    (a, b) => a.priority - b.priority || a.id.localeCompare(b.id),
  );
}

function buildRiskGraph(items) {
  const nodes = items.map((item) => ({
    id: item.id,
    workstream: item.workstream,
    priority: item.priority,
  }));
  const edges = items.flatMap((item) =>
    item.depends_on.map((source) => ({
      from: source,
      to: item.id,
      risk: `${item.id} should not advance before ${source}`,
    })),
  );
  return { nodes, edges };
}

export function buildOptimizationRoadmapPreview() {
  const roadmap = sortedItems();
  return {
    schema: SCHEMA,
    mode: "PREVIEW_ONLY",
    title: "Dema Optimization Roadmap Preview",
    summary:
      "A unified advisory roadmap for architecture, security, DevOps, CI/CD, pipeline automation, performance-quality assurance, management practice, and ethical integrity.",
    pmbok_lenses: clone(PMBOK_LENSES),
    management_body_of_knowledge: clone(MANAGEMENT_BODY_OF_KNOWLEDGE),
    snr_lenses: clone(SNR_LENSES),
    sape_lenses: clone(SAPE_LENSES),
    blueprint_coverage: clone(BLUEPRINT_COVERAGE),
    roadmap_items: roadmap,
    risk_graph: buildRiskGraph(roadmap),
    proposed_gates: clone(PROPOSED_GATES),
    proof_of_truth_convergence: clone(PROOF_OF_TRUTH_CONVERGENCE),
    boundary: clone(BOUNDARY),
  };
}

function appendRows(lines, rows, render) {
  for (const row of rows) lines.push(`  - ${render(row)}`);
}

export function formatOptimizationRoadmapPreview(report) {
  const lines = [
    "DEMA Optimization Roadmap Preview",
    "",
    `Mode: ${report.mode}`,
    `Summary: ${report.summary}`,
    "",
    "PMBOK lenses:",
  ];

  appendRows(lines, report.pmbok_lenses, (lens) => `${lens.id}: ${lens.focus}`);
  lines.push("");
  lines.push("Management-body-of-knowledge:");
  appendRows(
    lines,
    report.management_body_of_knowledge,
    (lens) => `${lens.id}: ${lens.practice}`,
  );
  lines.push("");
  lines.push("SNR lenses:");
  appendRows(lines, report.snr_lenses, (lens) => `${lens.id}: ${lens.signal}`);
  lines.push("");
  lines.push("SAPE lenses:");
  appendRows(lines, report.sape_lenses, (lens) => `${lens.id}: ${lens.signal}`);
  lines.push("");
  lines.push("Blueprint coverage:");
  appendRows(
    lines,
    report.blueprint_coverage,
    (blueprint) => `${blueprint.domain}: ${blueprint.advisory_scope}`,
  );
  lines.push("");
  lines.push("Prioritized roadmap:");
  appendRows(
    lines,
    report.roadmap_items,
    (item) =>
      `${item.priority}. ${item.id} [${item.workstream}] ${item.title} (${item.effect_class})`,
  );
  lines.push("");
  lines.push("Cascading risk graph:");
  appendRows(
    lines,
    report.risk_graph.edges,
    (edge) => `${edge.from} -> ${edge.to}: ${edge.risk}`,
  );
  lines.push("");
  lines.push("Proposed gates:");
  appendRows(
    lines,
    report.proposed_gates,
    (gate) => `${gate.status}: ${gate.id} - ${gate.command}`,
  );
  lines.push("");
  lines.push("Proof-of-Truth Convergence:");
  for (const pillar of Object.values(report.proof_of_truth_convergence)) {
    lines.push(
      `  ${pillar.label}: ${pillar.status} (${pillar.evidence_kind}; certifies=${pillar.certifies})`,
    );
  }
  lines.push("");
  lines.push(
    "Boundary: preview-only; no execution; no mutation; no gates enforced; no roadmap dispatch; no receipt minted; no economic claim.",
  );

  return lines.join("\n");
}
