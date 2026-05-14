import { createHash } from "node:crypto";

const SCHEMA = "bizra.dema.ambient_boundary.v0.1";
const AUDIT_SCHEMA = "bizra.dema.ambient_audit_preview.v0.1";
const MANIFEST_SCHEMA = "bizra.dema.ambient_manifest_preview.v0.1";

const ALLOWED_NOW = [
  "observe_local_readiness",
  "inventory_local_models",
  "summarize_next_safe_action",
  "prepare_exact_consent_handoff"
];

const BLOCKED_HERE = [
  "raw_bash_execution",
  "background_daemon",
  "model_inference_without_consent",
  "artifact_minting",
  "federation_action",
  "filesystem_mutation"
];

export function buildAmbientBoundary({ now = new Date() } = {}) {
  return {
    schema: SCHEMA,
    generated_at: now.toISOString(),
    mode: "PREVIEW_ONLY",
    signal: "ambient awareness is allowed; ambient execution requires governed Node0 consent",
    execution: {
      enabled: false,
      repository_role: "product_face_not_runtime",
      allowed_now: ALLOWED_NOW,
      blocked_here: BLOCKED_HERE,
      handoff_target: "bizra-data-lake/bizra-omega EffectCap runtime"
    },
    actuators: {
      bash: {
        risk: "maximal",
        reason: "universal OS actuator: files, processes, network, packages, services",
        rule: "No raw Bash; only declared Intent -> ConsentScope -> Policy -> EffectCap"
      },
      gui: {
        risk: "high",
        reason: "AHK-style GUI automation can mutate visible user state",
        rule: "Only via scoped gui.act capability outside Dema"
      },
      mobile_agent: {
        risk: "high",
        reason: "Telescript-style code/state movement needs host-attested limits",
        rule: "Only migrate serialized mission state plus bounded capabilities"
      }
    },
    micro_consent: {
      required_for: "every_effect",
      minimum_shape: [
        "mission_id",
        "agent_id",
        "resource_id",
        "action",
        "purpose",
        "expires_at",
        "commitment_hash"
      ],
      exact_consent_required: true
    },
    proof_of_truth: {
      formal: {
        status: "open_in_dema_preview",
        proof: "schema-tagged boundary plus blocked execution list"
      },
      cryptographic: {
        status: "deferred_to_runtime",
        proof: "ConsentScope and effect logs must be hash-committed by Node0"
      },
      empirical: {
        status: "open_in_dema_preview",
        proof: "operator can inspect current boundary before execution"
      },
      economic: {
        status: "closed_until_verified_impact",
        proof: "no IMP, token, or value claim can arise from this command"
      }
    },
    boundary: {
      scope: "read-only",
      inference_invoked: false,
      mutation_performed: false,
      daemon_started: false,
      receipt_minted: false
    }
  };
}

export function buildAmbientAuditPreview({ now = new Date() } = {}) {
  const boundary = buildAmbientBoundary({ now });
  return {
    schema: AUDIT_SCHEMA,
    generated_at: now.toISOString(),
    mode: "PREVIEW_ONLY",
    hidden_flow_pattern: "intent -> micro_consent -> capability -> effect -> evidence -> impact",
    snr: {
      signal: "EffectCap is the only legal side-effect path",
      noise_to_defer: [
        "autonomous shell loops",
        "token economics",
        "public federation",
        "mobile-agent migration"
      ]
    },
    sape_lenses: [
      {
        id: "security",
        finding: "Bash, GUI, and mobile-agent actuators are blocked in Dema and must remain behind governed capabilities."
      },
      {
        id: "architecture",
        finding: "Dema is the product face; Node0/bizra-omega owns runtime effects through EffectCap."
      },
      {
        id: "performance",
        finding: "Preview surfaces stay cheap and deterministic; runtime scheduling belongs to Node0 after consent."
      },
      {
        id: "ethics",
        finding: "Ihsan and micro-consent apply before every effect, not after evidence is produced."
      }
    ],
    hhmm_phases: ["UNDERSTAND", "PLAN", "ACT", "VERIFY", "SETTLE"],
    compliance_spine: {
      intent_declared: true,
      consent_required: true,
      policy_required: true,
      capability_required: true,
      effect_logged: "runtime_only",
      impact_claim_allowed: false
    },
    next_implementation: {
      id: "one_node_one_mission_diagnostic",
      command_path: "dema journey \"Run a bounded Node0 diagnostic and produce a safety readiness receipt\"",
      requirement: "handoff remains blocked until governed Node0 commits a ConsentScope"
    },
    proof_of_truth: boundary.proof_of_truth,
    boundary: {
      scope: "read-only-audit",
      inference_invoked: false,
      execution_enabled: false,
      mutation_performed: false,
      daemon_started: false,
      receipt_minted: false,
      impact_claimed: false
    }
  };
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

export function buildAmbientManifestPreview({ now = new Date() } = {}) {
  const manifestBody = {
    schema: MANIFEST_SCHEMA,
    generated_at: now.toISOString(),
    mode: "PREVIEW_ONLY",
    node_id: "node0",
    hardware: {
      source: "not_probed_in_dema_preview",
      ram_gb: null,
      gpu_vram_gb: null,
      disk_gb: null
    },
    sovereign_boundary: {
      readable_paths: ["operator_workspace", "dema_home"],
      writable_paths: [],
      executable_commands: [],
      network_access: false
    },
    urp_share_policy: {
      data_classes_allowed: ["public", "local_code"],
      no_foreign_personal_data: true,
      publication: "blocked_until_governed_node0_handoff"
    },
    micro_consent: {
      required_before: "any_manifest_publication_or_effect",
      capability_expansion_allowed: false,
      effectcap_required: true
    },
    signature: {
      status: "deferred_to_node0",
      reason: "Dema does not issue identity-bound signing artifacts"
    },
    proof_of_truth: {
      formal: "machine-readable boundary with empty write/execute grants",
      cryptographic: "hash commitment only; signature deferred to governed Node0",
      empirical: "operator can inspect manifest before any handoff",
      economic: "no reward, IMP, or impact claim from preview"
    },
    boundary: {
      scope: "read-only-manifest-preview",
      execution_enabled: false,
      mutation_performed: false,
      daemon_started: false,
      receipt_minted: false,
      identity_artifact_issued: false
    }
  };

  return {
    ...manifestBody,
    manifest_hash: sha256(manifestBody)
  };
}

function appendList(lines, label, items) {
  lines.push(`${label}:`);
  for (const item of items) lines.push(`  - ${item}`);
}

export function formatAmbientBoundary(boundary) {
  const lines = [
    "DEMA Ambient Sovereign Boundary",
    "",
    `Mode: ${boundary.mode}`,
    `Signal: ${boundary.signal}`,
    "",
    "Actuators:",
    `  Bash: ${boundary.actuators.bash.risk} risk - ${boundary.actuators.bash.reason}`,
    `  GUI: ${boundary.actuators.gui.risk} risk - ${boundary.actuators.gui.reason}`,
    `  Mobile agent: ${boundary.actuators.mobile_agent.risk} risk - ${boundary.actuators.mobile_agent.reason}`,
    ""
  ];

  appendList(lines, "Allowed now", boundary.execution.allowed_now);
  lines.push("");
  appendList(lines, "Blocked in Dema", boundary.execution.blocked_here);
  lines.push("");
  lines.push("Micro-consent:");
  lines.push(`  required_for: ${boundary.micro_consent.required_for}`);
  lines.push(`  exact_consent_required: ${boundary.micro_consent.exact_consent_required}`);
  lines.push(`  rule: ${boundary.actuators.bash.rule}`);
  lines.push("");
  lines.push("Proof-of-Truth:");
  for (const [pillar, value] of Object.entries(boundary.proof_of_truth)) {
    lines.push(`  ${pillar}: ${value.status} - ${value.proof}`);
  }
  lines.push("");
  lines.push(`Handoff target: ${boundary.execution.handoff_target}`);
  lines.push("Boundary: preview-only; no execution; no daemon; no receipt minted.");

  return lines.join("\n");
}

export function formatAmbientAuditPreview(audit) {
  const lines = [
    "DEMA Ambient Sovereign Execution Audit",
    "",
    `Mode: ${audit.mode}`,
    `Hidden flow: ${audit.hidden_flow_pattern}`,
    `SNR signal: ${audit.snr.signal}`,
    "",
    "SAPE lenses:"
  ];

  for (const lens of audit.sape_lenses) {
    lines.push(`  ${lens.id}: ${lens.finding}`);
  }
  lines.push("");
  lines.push(`HHMM phases: ${audit.hhmm_phases.join(" -> ")}`);
  lines.push("");
  lines.push("Micro-compliance spine:");
  for (const [key, value] of Object.entries(audit.compliance_spine)) {
    lines.push(`  ${key}: ${value}`);
  }
  lines.push("");
  lines.push("Proof-of-Truth Convergence:");
  for (const [pillar, value] of Object.entries(audit.proof_of_truth)) {
    lines.push(`  ${pillar}: ${value.status} - ${value.proof}`);
  }
  lines.push("");
  lines.push(`Next implementation: ${audit.next_implementation.id}`);
  lines.push(`Command path: ${audit.next_implementation.command_path}`);
  lines.push(`Requirement: ${audit.next_implementation.requirement}`);
  lines.push("Boundary: preview-only; no execution; no mutation; no receipt minted.");

  return lines.join("\n");
}

export function formatAmbientManifestPreview(manifest) {
  const lines = [
    "DEMA Ambient Capability Manifest Preview",
    "",
    `Mode: ${manifest.mode}`,
    `Node: ${manifest.node_id}`,
    `Manifest hash: ${manifest.manifest_hash}`,
    "",
    "Sovereign boundary:",
    `  Readable paths: ${manifest.sovereign_boundary.readable_paths.join(", ")}`,
    `  Writable paths: ${manifest.sovereign_boundary.writable_paths.length}`,
    `  Executable commands: ${manifest.sovereign_boundary.executable_commands.length}`,
    `  Network access: ${manifest.sovereign_boundary.network_access}`,
    "",
    "URP share policy:",
    `  Data classes allowed: ${manifest.urp_share_policy.data_classes_allowed.join(", ")}`,
    `  No foreign personal data: ${manifest.urp_share_policy.no_foreign_personal_data}`,
    `  Publication: ${manifest.urp_share_policy.publication}`,
    "",
    "Micro-consent:",
    `  Required before: ${manifest.micro_consent.required_before}`,
    `  EffectCap required: ${manifest.micro_consent.effectcap_required}`,
    "",
    `Signature: ${manifest.signature.status} - ${manifest.signature.reason}`,
    "Boundary: preview-only; no execution; no mutation; no identity artifact issued."
  ];

  return lines.join("\n");
}
