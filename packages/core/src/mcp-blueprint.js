const SCHEMA = "bizra.dema.mcp_integration_blueprint.v0.1";

const INTEGRATION_POINTS = [
  {
    id: "github.actions.read_only",
    server: "github-mcp-server",
    purpose: "inspect workflow metadata, runs, jobs, and logs for release triage",
    allowed_methods: [
      "actions_list:list_workflows",
      "actions_list:list_workflow_runs",
      "actions_list:list_workflow_jobs",
      "get_job_logs:failed_only"
    ],
    forbidden_methods: [
      "workflow_dispatch",
      "repository mutation",
      "secret read/write",
      "issue or PR posting without explicit operator consent"
    ],
    credential_source: "host_mcp_configuration",
    data_classification: "repository_metadata"
  },
  {
    id: "copilot.space.read_only",
    server: "github-mcp-server",
    purpose: "read operator-selected Copilot Space context when explicitly named",
    allowed_methods: ["list_copilot_spaces", "get_copilot_space"],
    forbidden_methods: ["copying secrets", "publishing space content", "implicit space scanning"],
    credential_source: "host_mcp_configuration",
    data_classification: "operator_selected_context"
  }
];

const SECURITY_CONTROLS = [
  {
    id: "auth.host_managed",
    rule: "Dema never stores MCP tokens; authentication stays in the host MCP layer.",
    test_anchor: "source scan must not introduce credentials or token literals"
  },
  {
    id: "consent.explicit_target",
    rule: "Every MCP operation must name server, tool, repository or resource, and purpose before use.",
    test_anchor: "preview requires concrete integration point metadata"
  },
  {
    id: "scope.read_first",
    rule: "Default MCP posture is read-only; mutations require exact consent and a separate governed path.",
    test_anchor: "blueprint boundary reports mcp_mutation_performed=false"
  },
  {
    id: "secrets.no_echo",
    rule: "Responses must be summarized without printing secrets, tokens, or credential-bearing config.",
    test_anchor: "formatter renders policies, not credential values"
  }
];

const API_DISCIPLINE = {
  validation: [
    "validate owner/repo/resource identifiers before MCP calls",
    "reject empty server names, tool names, and resource URIs",
    "treat MCP responses as untrusted until schema-shaped"
  ],
  batching: [
    "prefer list calls with bounded per_page values",
    "batch independent read-only metadata requests before log retrieval",
    "avoid fetching full logs unless a failed job or operator target requires it"
  ],
  retries: [
    "retry only idempotent read operations",
    "use small capped attempts with jitter in future runtime code",
    "do not retry mutation-like tools without fresh consent"
  ],
  circuit_breakers: [
    "open circuit on repeated auth failures",
    "open circuit on rate-limit responses until reset evidence exists",
    "degrade to local-only guidance when MCP server is unavailable"
  ]
};

const DATA_TRANSFORMATIONS = [
  {
    id: "workflow_metadata_summary",
    input: "GitHub workflow list or run metadata",
    output: "name, path, state, status, conclusion, and URL fields only",
    redaction: "drop tokens, environment dumps, and unrequested log bodies"
  },
  {
    id: "failed_job_log_excerpt",
    input: "bounded failed-job log tail",
    output: "error class, failing step, and suggested local reproduction command",
    redaction: "mask credential-like substrings before display"
  },
  {
    id: "copilot_space_context_digest",
    input: "operator-selected Copilot Space documents",
    output: "document titles, relevant excerpts, and citation paths",
    redaction: "do not persist or republish private space content"
  }
];

const PROOF_OF_TRUTH_CONVERGENCE = {
  formal: {
    label: "Formal",
    status: "integration_contract_preview",
    evidence_kind: "static_blueprint",
    certifies: false,
    claim: "MCP integration points, controls, and boundaries are schema-tagged for review."
  },
  cryptographic: {
    label: "Cryptographic",
    status: "host_mcp_auth_deferred",
    evidence_kind: "deferred_to_host",
    certifies: false,
    claim: "Dema does not store credentials or mint signed MCP access artifacts."
  },
  empirical: {
    label: "Empirical",
    status: "availability_must_be_checked_before_use",
    evidence_kind: "operator_or_session_check",
    certifies: false,
    claim: "A live MCP tool should be checked read-only before any operation plan depends on it."
  },
  economic: {
    label: "Economic",
    status: "closed_until_verified_impact",
    evidence_kind: "blocked_claim",
    certifies: false,
    claim: "MCP reads do not create token, reward, spend, or Proof-of-Impact claims."
  }
};

const BOUNDARY = {
  scope: "read-only-preview",
  mcp_call_performed_by_command: false,
  external_api_called_by_command: false,
  secrets_accessed: false,
  credentials_stored: false,
  mutation_performed: false,
  mcp_mutation_performed: false,
  receipt_minted: false,
  daemon_started: false,
  network_connection_attempted_by_command: false
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function buildMcpIntegrationBlueprint() {
  return {
    schema: SCHEMA,
    mode: "PREVIEW_ONLY",
    title: "Dema MCP Integration Blueprint",
    summary:
      "A secure-by-default contract for future MCP reads, validation, response shaping, and failure handling.",
    integration_points: clone(INTEGRATION_POINTS),
    security_controls: clone(SECURITY_CONTROLS),
    api_discipline: clone(API_DISCIPLINE),
    data_transformations: clone(DATA_TRANSFORMATIONS),
    proof_of_truth_convergence: clone(PROOF_OF_TRUTH_CONVERGENCE),
    boundary: clone(BOUNDARY)
  };
}

function appendRows(lines, rows, render) {
  for (const row of rows) lines.push(`  - ${render(row)}`);
}

export function formatMcpIntegrationBlueprint(blueprint) {
  const lines = [
    "DEMA MCP Integration Blueprint",
    "",
    `Mode: ${blueprint.mode}`,
    `Summary: ${blueprint.summary}`,
    "",
    "Integration points:"
  ];

  appendRows(
    lines,
    blueprint.integration_points,
    (point) => `${point.id} via ${point.server} credentials=${point.credential_source}: ${point.purpose}`
  );
  lines.push("");
  lines.push("Security controls:");
  appendRows(lines, blueprint.security_controls, (control) => `${control.id}: ${control.rule}`);
  lines.push("");
  lines.push("API discipline:");
  for (const [section, items] of Object.entries(blueprint.api_discipline)) {
    lines.push(`  ${section}: ${items.join("; ")}`);
  }
  lines.push("");
  lines.push("Data transformations:");
  appendRows(lines, blueprint.data_transformations, (item) => `${item.id}: ${item.output}`);
  lines.push("");
  lines.push("Proof-of-Truth Convergence:");
  for (const pillar of Object.values(blueprint.proof_of_truth_convergence)) {
    lines.push(`  ${pillar.label}: ${pillar.status} (${pillar.evidence_kind}; certifies=${pillar.certifies})`);
  }
  lines.push("");
  lines.push(
    "Boundary: preview-only; no MCP call by this command; no external API call by this command; no secrets; no mutation; no receipt minted."
  );

  return lines.join("\n");
}
