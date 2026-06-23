// NODE0-ROSETTA-CONSTITUTION-1A
//
// Pure, read-only "Rosetta Stone" for Node0/Dema: one frozen map that binds every
// capability to a real on-disk anchor and a truth label (IMPLEMENTED | DECLARED |
// DESIGNED_NOT_LIVE | UNKNOWN), cross-walked across the Telescript mobile-agent
// vocabulary, Dema's own primitives, and the SYNAPSE-CORE operating doctrine.
//
// This is NOT a runtime. It does not read files, sign, mint, network, federate, or
// run an autopoietic loop. Its only job is anti-drift: make it mechanically hard to
// claim a capability is live before it is. The labels here are derived from the
// adversarially-verified audit docs/audits/NODE0_DEMA_NORTHSTAR_AUDIT_1A.md.
//
// Purity is preserved (kernel-purity gate scans this tier): the kernel never touches
// the filesystem. Anchor-existence binding is done by `verifyNode0RosettaConstitution`
// via an INJECTED `anchorExists` predicate; the test backs it with the fs module, so
// CI asserts every IMPLEMENTED/DECLARED anchor really exists on disk.

import { sha256, stableStringify } from "../../consent/src/consent-common.js";

export const NODE0_ROSETTA_CONSTITUTION_PREVIEW_SCHEMA =
  "bizra.dema.node0_rosetta_constitution_preview.v0.1";

export const NODE0_ROSETTA_CONSTITUTION_TRUTH_LABEL =
  "NODE0_ROSETTA_CONSTITUTION_PREVIEW_ONLY";

const STATUS_VALUES = Object.freeze([
  "IMPLEMENTED",
  "DECLARED",
  "DESIGNED_NOT_LIVE",
  "UNKNOWN",
]);

// Telescript mobile-agent vocabulary  <->  Dema primitive  <->  SYNAPSE-CORE concept.
const ROSETTA_ROWS = Object.freeze([
  {
    telescript: "Agent",
    dema_primitive: "agent profile / PAT agent",
    synapse_core: "sub-agent (researcher/verifier/builder/critic)",
    anchor_path: "packages/agents/src/agent-profile-registry.js",
    status: "IMPLEMENTED",
    note: "Agent identity + profile registry exists and is tested.",
  },
  {
    telescript: "Place",
    dema_primitive: "Node0 / DEMA_HOME / Realm",
    synapse_core: "the local execution context",
    anchor_path: "packages/core/src/node0-homebase-state-preview.js",
    status: "DECLARED",
    note: "Home-base state is composed by a preview kernel (live-homebase.js only renders it); the persistent local context is DEMA_HOME, not a single wired runtime. Remote Places are Telesphere (not live).",
  },
  {
    telescript: "go",
    dema_primitive: "bounded-task + mission lifecycle",
    synapse_core: "SNR Strike behind the consent gate",
    anchor_path: "packages/tasks/src/bounded-task-runner.js",
    status: "IMPLEMENTED",
    note: "Fail-closed task lifecycle harness; live mutating execution stays DESIGNED_NOT_LIVE.",
  },
  {
    telescript: "Ticket",
    dema_primitive: "consent proof / typed GO",
    synapse_core: "FATE consent gate (§1)",
    anchor_path: "packages/consent/src/consent-common.js",
    status: "IMPLEMENTED",
    note: "Exact-string consent + cryptographic consent-proof are the travel authorization.",
  },
  {
    telescript: "Permit",
    dema_primitive: "boundary block / autonomy gate",
    synapse_core: "FATE action-class table",
    anchor_path: "packages/core/src/external-pattern-registry-preview.js",
    status: "IMPLEMENTED",
    note: "Capability is bounded by an all-false boundary block; authority is never imported.",
  },
  {
    telescript: "Stub",
    dema_primitive: "SAT verdict envelope",
    synapse_core: "verifier / critic pass",
    anchor_path: "packages/verifier/src/sat-placeholder.js",
    status: "DECLARED",
    note: "Verdict shape exists as a placeholder; the SAT runtime is not wired.",
  },
  {
    telescript: "Telesphere",
    dema_primitive: "URP shared world / federation",
    synapse_core: "autonomy contract §8 (the NODE0 executor)",
    anchor_path: "packages/core/src/shared-urp-world-preview.js",
    status: "DESIGNED_NOT_LIVE",
    note: "The network of Places is preview-only; no cross-node runtime exists.",
  },
  {
    telescript: "Proof-with-State",
    dema_primitive: "proof passport + receipt chain",
    synapse_core: "§0 bind-before-speak / EvidenceChain",
    anchor_path: "packages/receipts/src/proof-passport.js",
    status: "IMPLEMENTED",
    note: "Telescript principle: state carries its proof, never arbitrary code. This is the BIZRA spine.",
  },
]);

// The verified capability ledger (curated from the 36-entry audit truth-ledger).
const CAPABILITY_LEDGER = Object.freeze([
  // --- spine: genuinely implemented + tested ---
  c("zero_dependency_invariant", "Zero runtime + dev dependency invariant", "IMPLEMENTED", "package.json", "deps={} / devDeps={}, gate + CI enforced"),
  c("kernel_purity", "Kernel purity (no fs/net/exec in pure tier)", "IMPLEMENTED", "scripts/review/kernel-purity-check.mjs", "0 violations across packages"),
  c("exact_string_consent", "Exact-string consent gates", "IMPLEMENTED", "packages/receipts/src/authorship-key-store.js", "key init/sign/attest phrase-gated"),
  c("cryptographic_consent_proof", "Cryptographic consent proof (scope + freshness)", "IMPLEMENTED", "packages/receipts/src/consent-proof.js", "external-pubkey verify, 5-min window"),
  c("consent_nonce_replay_close", "Single-use consent nonce registry (replay close)", "IMPLEMENTED", "packages/receipts/src/consent-nonce-registry.js", "wired into verdict-attest"),
  c("proof_passport_verify", "Proof passport / deep verification", "IMPLEMENTED", "packages/receipts/src/proof-passport-verify.js", "chain integrity verified"),
  c("canonical_receipt", "Canonical content-addressed receipt", "IMPLEMENTED", "packages/receipts/src/canonical-receipt.js", "hash-bound receipts"),
  c("agent_dna_root_coherence", "Agent-DNA root coherence (Law of Assumption gate)", "IMPLEMENTED", "packages/agents/src/agent-dna-root-coherence.js", "fail-closed in npm check"),
  c("bounded_task_runner", "Bounded fail-closed task lifecycle", "IMPLEMENTED", "packages/tasks/src/bounded-task-runner.js", "gate -> run -> verify harness"),
  c("agent_profile_registry", "Agent profile registry", "IMPLEMENTED", "packages/agents/src/agent-profile-registry.js", "agent identity/profile"),
  // --- the "integrate" set: already preview kernels (shape exists, runtime not wired) ---
  c("mcp", "MCP capability descriptor (preview)", "DECLARED", "packages/consent/src/mcp-capability-descriptor-preview.js", "descriptor shape only; no server invocation"),
  c("a2a", "A2A message envelope (preview)", "DECLARED", "packages/consent/src/a2a-message-envelope-preview.js", "envelope shape only; no network call"),
  c("amana_smart_contract", "Amana smart-contract registry (preview)", "DECLARED", "packages/core/src/amana-contracts-preview.js", "local rule commitments; no settlement"),
  c("snr_engine", "SNR (signal-to-noise) scoring engine", "DECLARED", "packages/core/src/process-value-preview.js", "computeSNRValue; advisory only"),
  c("rsi_metric", "RSI (recursive self-improvement) metric", "DECLARED", "packages/core/src/process-value-preview.js", "computeProcessRsi; metric only, not autonomous"),
  c("shoulder_of_giants", "Shoulder-of-giants protocol mapping", "DECLARED", "packages/core/src/peak-self-loop-preview.js", "giants -> Dema surfaces; DECLARED mapping only"),
  c("external_pattern_registry", "External pattern registry (preview)", "DECLARED", "packages/core/src/external-pattern-registry-preview.js", "borrow pattern, reject authority"),
  c("dual_token_ledger", "Dual-token ledger (ECON-1A)", "DECLARED", "packages/econ/src/dual-token-ledger.js", "ledger shape; no mint/settlement"),
  c("urp_local", "URP local-only discovery/manifest", "DECLARED", "packages/core/src/urp-shared-runtime-discovery.js", "local index only; shared runtime not live"),
  c("post_quantum_crypto_policy", "Post-quantum crypto policy gate", "DECLARED", "packages/receipts/src/crypto-policy.js", "policy evaluator; unwired"),
  c("sat_verdict", "SAT verdict (placeholder)", "DECLARED", "packages/verifier/src/sat-placeholder.js", "PARTIAL_PLACEHOLDER never PERMIT"),
  c("pat_template", "PAT proposer template", "DECLARED", "packages/adk/src/pat-template.js", "template shape; dual-loop not live"),
  // --- designed, not live ---
  c("autopoietic_loop", "Autopoietic / autonomous self-modification loop", "DESIGNED_NOT_LIVE", "packages/core/src/peak-self-loop-preview.js", "not_autonomous_runtime:true"),
  c("urp_shared_runtime", "URP shared runtime (cross-node sync/pool)", "DESIGNED_NOT_LIVE", "packages/core/src/shared-urp-world-preview.js", "no cross-node runtime"),
  c("node_federation", "Node1/Node2 federation handoff", "DESIGNED_NOT_LIVE", "packages/core/src/network-fixture-preview.js", "fixture only; no live federation"),
  c("poi_token_mint", "PoI / token economy / Step-7 mint", "DESIGNED_NOT_LIVE", "packages/core/src/amana-contracts-preview.js", "blocked pre-amana; no mint"),
  c("canonical_third_fact_md", "Canonical Third Fact markdown", "DESIGNED_NOT_LIVE", "docs/public/third-fact-v0.1.md", "referenced ~15x but ABSENT on disk (sentinel)"),
]);

// SYNAPSE-CORE §1 FATE action-class table (sourced, not invented). `autonomous` =
// does NOT need to wake Mumu; it alone drives autonomy_coverage. `reversible` is a
// separate, honest per-class fact (e.g. run_code is autonomous-but-not-reversible).
const ACTION_CLASSES = Object.freeze([
  a("read", true, true), a("search", true, true), a("analyze", true, true),
  a("draft", true, true), a("plan", true, true), a("simulate", true, true),
  a("test_dry_run", true, true),
  a("write_edit_file", true, true), a("install_dependency", true, true),
  a("run_code", true, false), a("refactor", true, true),
  a("delete", false, false), a("force_push", false, false),
  a("branch_delete", false, false), a("close_pr", false, false),
  a("overwrite", false, false),
  a("signing", false, false), a("key_generation", false, false),
  a("mint", false, false), a("reward_settlement", false, false),
  a("secrets_modify", false, false), a("public_network_post", false, false),
]);

const BOUNDARY = Object.freeze({
  runtime: false,
  federation: false,
  mint: false,
  network: false,
  signing: false,
  key_generation: false,
  mcp_invoked: false,
  a2a_called: false,
  autopoietic_runtime: false,
  poi_scored: false,
  token_minted: false,
  file_write: false,
});

const CROSS_REF = Object.freeze({
  external_pattern_registry: Object.freeze({
    anchor_path: "packages/core/src/external-pattern-registry-preview.js",
    schema: "bizra.dema.external_pattern_registry_preview.v0.1",
    note: "The 'shoulders of giants' axis (giants -> BIZRA primitives) lives there, unchanged.",
  }),
});

const WHAT_THIS_PROVES = Object.freeze([
  "Node0/Dema's real capability surface can be expressed as one frozen, anchor-bound, truth-labeled map.",
  "The map's own verifier rejects phantom anchors and overclaimed statuses.",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "That any DECLARED or DESIGNED_NOT_LIVE capability is live.",
  "That federation, MCP, A2A, PoI, token, or an autopoietic runtime work.",
  "That the audit grades are measured facts (they are assessments).",
]);

function c(capability_key, capability, status, anchor_path, anchor_detail) {
  return { capability_key, capability, status, anchor_path, anchor_detail, evidence_ref: "docs/audits/NODE0_DEMA_NORTHSTAR_AUDIT_1A.md" };
}

function a(cls, autonomous, reversible) {
  return { class: cls, reversible, requires_typed_go: !autonomous, autonomous };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

function summarize(ledger) {
  const counts = { IMPLEMENTED: 0, DECLARED: 0, DESIGNED_NOT_LIVE: 0, UNKNOWN: 0 };
  for (const entry of ledger) counts[entry.status] += 1;
  return counts;
}

function buildRestProtection() {
  const autonomous_count = ACTION_CLASSES.filter((x) => x.autonomous === true).length;
  const total_count = ACTION_CLASSES.length;
  return {
    metric: "autonomy_coverage",
    definition_status: "IMPLEMENTED",
    live_measurement_status: "DESIGNED_NOT_LIVE",
    formula: "autonomous_action_classes / total_action_classes",
    action_classes: ACTION_CLASSES.map((x) => ({ ...x })),
    autonomous_count,
    total_count,
    autonomy_coverage: autonomous_count / total_count,
  };
}

export function buildNode0RosettaConstitutionPreview() {
  const rosetta = ROSETTA_ROWS.map((r) => ({ ...r }));
  const capability_ledger = CAPABILITY_LEDGER.map((c2) => ({ ...c2 }));
  const rest_protection = buildRestProtection();
  const status_summary = summarize(capability_ledger);

  const body = {
    schema: NODE0_ROSETTA_CONSTITUTION_PREVIEW_SCHEMA,
    truth_label: NODE0_ROSETTA_CONSTITUTION_TRUTH_LABEL,
    mode: "preview_only",
    rosetta,
    capability_ledger,
    rest_protection,
    boundary: { ...BOUNDARY },
    cross_ref: { external_pattern_registry: { ...CROSS_REF.external_pattern_registry } },
    status_summary,
    what_this_proves: [...WHAT_THIS_PROVES],
    what_this_does_not_prove: [...WHAT_THIS_DOES_NOT_PROVE],
  };

  return deepFreeze({
    ...body,
    constitution_hash: sha256(stableStringify(body)),
  });
}

export function verifyNode0RosettaConstitution(map, { anchorExists } = {}) {
  const blocked_by = [];

  if (!map || typeof map !== "object") {
    return { valid: false, blocked_by: ["map_not_object"] };
  }
  if (map.schema !== NODE0_ROSETTA_CONSTITUTION_PREVIEW_SCHEMA) {
    blocked_by.push("schema_invalid");
  }
  if (map.truth_label !== NODE0_ROSETTA_CONSTITUTION_TRUTH_LABEL) {
    blocked_by.push("truth_label_invalid");
  }

  // boundary must be entirely false
  if (!map.boundary || typeof map.boundary !== "object") {
    blocked_by.push("boundary_missing");
  } else {
    for (const [k, v] of Object.entries(map.boundary)) {
      if (v !== false) blocked_by.push(`boundary_not_false:${k}`);
    }
  }

  // status enum on every row + ledger entry
  const rosetta = Array.isArray(map.rosetta) ? map.rosetta : [];
  const ledger = Array.isArray(map.capability_ledger) ? map.capability_ledger : [];
  for (const row of rosetta) {
    if (!STATUS_VALUES.includes(row.status)) blocked_by.push(`status_invalid:${row.telescript}`);
  }
  for (const entry of ledger) {
    if (!STATUS_VALUES.includes(entry.status)) blocked_by.push(`status_invalid:${entry.capability_key}`);
  }

  // status_summary must equal recomputed counts over the ledger
  const recomputed = summarize(ledger);
  if (stableStringify(map.status_summary) !== stableStringify(recomputed)) {
    blocked_by.push("status_summary_mismatch");
  }

  // rest_protection math must show its work
  const rp = map.rest_protection;
  if (!rp || !Array.isArray(rp.action_classes)) {
    blocked_by.push("rest_protection_missing");
  } else {
    const autonomous = rp.action_classes.filter((x) => x.autonomous === true).length;
    if (rp.autonomous_count !== autonomous) blocked_by.push("autonomy_count_mismatch");
    if (rp.total_count !== rp.action_classes.length) blocked_by.push("autonomy_total_mismatch");
    if (rp.autonomy_coverage !== autonomous / rp.action_classes.length) {
      blocked_by.push("autonomy_coverage_mismatch");
    }
  }

  // cross-ref must be present
  if (!map.cross_ref || !map.cross_ref.external_pattern_registry) {
    blocked_by.push("cross_ref_missing");
  }

  // anchor-existence binding — fail closed if the predicate is not supplied
  if (typeof anchorExists !== "function") {
    blocked_by.push("anchor_existence_unverified");
  } else {
    for (const row of rosetta) {
      if ((row.status === "IMPLEMENTED" || row.status === "DECLARED") && !anchorExists(row.anchor_path)) {
        blocked_by.push(`anchor_missing:${row.telescript}:${row.anchor_path}`);
      }
    }
    for (const entry of ledger) {
      if ((entry.status === "IMPLEMENTED" || entry.status === "DECLARED") && !anchorExists(entry.anchor_path)) {
        blocked_by.push(`anchor_missing:${entry.capability_key}:${entry.anchor_path}`);
      }
    }
  }

  return { valid: blocked_by.length === 0, blocked_by };
}
