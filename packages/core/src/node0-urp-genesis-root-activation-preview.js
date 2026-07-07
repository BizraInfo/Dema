// NODE0-URP-GENESIS-ROOT-ACTIVATION-PREVIEW-1A — Preview-only Node0 URP Genesis Root.
//
// Composes and validates a local resource-registry DESCRIPTOR: what Node0 declares it owns, permits,
// and shares (identity, machine/compute/data resource policies, consent scopes, a signed
// receipt-chain-head anchor, boundary flags). It is the first implementation of the reserved
// BIZRA_URP_GENESIS_PREVIEW slot (reward-eligibility-contract-preview.js:54).
//
// HONESTY: this ACTIVATES NOTHING. The 7 BIZRA components are isolated preview kernels, not a wired
// state machine (CURRENT_LIMITS.md / THIRD_FACT_CURRENT_STATE_DELTA.md). This descriptor is inert and
// content-addressed; it sits BELOW the ladder's gated `activate` rung. `local_preview_active` means the
// descriptor is composed, internally valid, and carries a signed receipt-chain-head anchor — NOT that a
// runtime is live. The receipt-chain-head anchor is signature-backed (via node0-signed-chain-head);
// other descriptor fields are content-addressed only (forge-and-recompute of non-anchor fields is a
// content-addressing limitation, closed later by a #341-composition slice, not claimed here).
//
// Pure kernel: no fs / network / process / clock / random. It VALIDATES a caller-provided
// `signed_chain_head` (produced by the gate/test with an injected ephemeral key) — the kernel generates
// no keys and binds no live identity. Boundary all-false · authority_delta 0 · grants_action false ·
// mint_allowed false.

import { createHash } from "node:crypto";
import {
  verifySignedChainHead,
  NODE0_SIGNED_CHAIN_HEAD_SCHEMA,
} from "./node0-signed-chain-head.js";

export const NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_SCHEMA = "bizra.dema.node0_urp_genesis_root_activation_preview.v0.1";
export const NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_TRUTH_LABEL = "NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_MEASURED_REPO";
export const NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_GO_PHRASE = "GO: node0 urp genesis root activation preview";

export const ACTIVATION_STATUSES = Object.freeze([
  "draft",
  "ready_for_local_activation",
  "local_preview_active",
  "blocked_pending_health",
  "blocked_pending_consent",
  "blocked_pending_resource_policy",
  "blocked_pending_data_policy",
  "rejected_overclaim",
]);

// Every domain flag MUST be false — a genesis-root descriptor grants no live capability.
export const DOMAIN_FLAG_KEYS = Object.freeze([
  "live_urp",
  "public_identity_genesis",
  "mint_allowed",
  "wallet_enabled",
  "settlement_enabled",
  "payment_enabled",
  "federation_enabled",
  "remote_execution_enabled",
  "public_market_enabled",
  "model_invocation_enabled",
  "daemon_enabled",
]);

const REQUIRED = Object.freeze({
  health: ["node0_identity", "bizra_project_identity", "operator_identity", "builder_space_pointer"],
  consent: ["consent_scope_profile"],
  resource: ["machine_resource_profile", "compute_resource_policy"],
  data: ["data_resource_policy"],
});

// Overclaim wording tripwires — scanned over the descriptor's declared_claims.
const OVERCLAIM_WORDING = Object.freeze([
  { code: "public_market_wording", re: /public market|market is live|live urp|urp is live|federation is live|mint(?:ing)? is live|wallet is live|settlement is live/i },
  { code: "simulated_impact_as_verified", re: /simulated impact.*(?:verified|real|counts)|treat(?:ing|ed)?\s+.*simulated.*as\s+(?:verified|real)/i },
  { code: "resource_cost_as_value", re: /cost (?:is|equals|=) value|measured cost.*value|resource cost.*value/i },
]);

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function present(v) {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (typeof v === "object") return Object.keys(v).length > 0;
  return true;
}

export function node0UrpGenesisRootActivationPreviewBoundary() {
  return Object.freeze({
    execution_allowed: false,
    daemon_started: false,
    network_used: false,
    token_minted: false,
    wallet_accessed: false,
    live_execution_performed: false,
    file_mutation_performed: false,
    model_invocation_performed: false,
  });
}

// Canonical all-false domain flags carried by every built descriptor.
export function node0UrpGenesisRootDomainFlags() {
  const flags = {};
  for (const k of DOMAIN_FLAG_KEYS) flags[k] = false;
  return Object.freeze(flags);
}

function validSignedAnchor(sch) {
  return (
    !!sch &&
    typeof sch === "object" &&
    sch.schema === NODE0_SIGNED_CHAIN_HEAD_SCHEMA &&
    verifySignedChainHead(sch).ok
  );
}

function deriveAnchorRef(sch) {
  return Object.freeze({
    schema: sch.schema,
    head_hash: sch.payload.head_hash,
    chain_content_hash: sch.payload.chain_content_hash,
    public_key_fingerprint: sch.signature.public_key_fingerprint,
  });
}

function scanOverclaimWording(input) {
  const claims = Array.isArray(input?.declared_claims) ? input.declared_claims.join(" \n ") : "";
  const hits = [];
  for (const o of OVERCLAIM_WORDING) if (o.re.test(claims)) hits.push(o.code);
  return hits;
}

// Fail-closed status resolver. Overclaim dominates; then health/consent/resource/data; else active.
export function evaluateActivation(input) {
  const overclaim = [];
  const bf = (input && typeof input.boundary_flags === "object" && input.boundary_flags) || {};
  for (const k of DOMAIN_FLAG_KEYS) if (bf[k] === true) overclaim.push(`${k}_claimed`);
  overclaim.push(...scanOverclaimWording(input));
  if (typeof input?.authority_delta === "number" && input.authority_delta > 0) overclaim.push("authority_delta_nonzero");
  if (input?.grants_action === true) overclaim.push("grants_action_true");
  if (input?.activation_status !== undefined && !ACTIVATION_STATUSES.includes(input.activation_status)) {
    overclaim.push("unknown_activation_status");
  }
  if (overclaim.length) return { status: "rejected_overclaim", blocked_by: Object.freeze([...new Set(overclaim)]) };

  const missingHealth = REQUIRED.health.filter((f) => !present(input?.[f]));
  if (!validSignedAnchor(input?.signed_chain_head)) missingHealth.push("signed_receipt_anchor");
  if (missingHealth.length) return { status: "blocked_pending_health", blocked_by: Object.freeze(missingHealth.map((f) => `missing_${f}`)) };

  const missingConsent = REQUIRED.consent.filter((f) => !present(input?.[f]));
  if (missingConsent.length) return { status: "blocked_pending_consent", blocked_by: Object.freeze(missingConsent.map((f) => `missing_${f}`)) };

  const missingResource = REQUIRED.resource.filter((f) => !present(input?.[f]));
  if (missingResource.length) return { status: "blocked_pending_resource_policy", blocked_by: Object.freeze(missingResource.map((f) => `missing_${f}`)) };

  const missingData = REQUIRED.data.filter((f) => !present(input?.[f]));
  if (missingData.length) return { status: "blocked_pending_data_policy", blocked_by: Object.freeze(missingData.map((f) => `missing_${f}`)) };

  return { status: "local_preview_active", blocked_by: Object.freeze([]) };
}

// Fail-closed consent plan (exact GO-phrase byte match + input object).
export function planNode0UrpGenesisRootActivationPreview({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_GO_PHRASE) blocked_by.push("consent_phrase_mismatch");
  if (!input || typeof input !== "object") blocked_by.push("input_not_object");
  return Object.freeze({
    schema: NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_SCHEMA,
    truth_label: NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Compose the 13-field descriptor + content hash. Only called for a local_preview_active input.
export function buildNode0UrpGenesisRootActivationPreviewPayload(input) {
  const evalr = evaluateActivation(input);
  const body = {
    schema: NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_SCHEMA,
    truth_label: NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_TRUTH_LABEL,
    node0_identity: input.node0_identity ?? null,
    bizra_project_identity: input.bizra_project_identity ?? null,
    operator_identity: input.operator_identity ?? null,
    machine_resource_profile: input.machine_resource_profile ?? null,
    compute_resource_policy: input.compute_resource_policy ?? null,
    data_resource_policy: input.data_resource_policy ?? null,
    consent_scope_profile: input.consent_scope_profile ?? null,
    signed_receipt_anchor: validSignedAnchor(input.signed_chain_head) ? input.signed_chain_head : null,
    signed_receipt_anchor_ref: validSignedAnchor(input.signed_chain_head) ? deriveAnchorRef(input.signed_chain_head) : null,
    builder_space_pointer: input.builder_space_pointer ?? null,
    activation_status: evalr.status,
    boundary_flags: node0UrpGenesisRootDomainFlags(),
    boundary: node0UrpGenesisRootActivationPreviewBoundary(),
    authority_delta: 0,
    grants_action: false,
    mint_allowed: false,
    what_this_proves:
      "A Node0 URP Genesis Root descriptor was composed and validated as a LOCAL PREVIEW: required identity/resource/consent fields present, a signature-backed receipt-chain-head anchor attached, every live/mint/federation/remote/daemon flag false, and a stable content hash produced.",
    what_this_does_not_prove:
      "It activates no live URP, mints nothing, opens no wallet/settlement/payment, federates nothing, runs no daemon, invokes no model, and binds no live Node0 identity. The receipt-chain-head anchor is signature-backed; other descriptor fields are content-addressed only. local_preview_active is a descriptor state, not a live runtime.",
  };
  const content_hash = `sha256:${sha256(stableStringify(body))}`;
  return Object.freeze({ ...body, content_hash });
}

// Body-bound verifier. Re-derives the content hash, re-verifies the anchor signature, deep-checks the
// boundary + domain flags + invariants. For local_preview_active, required fields + anchor must hold.
export function verifyNode0UrpGenesisRootActivationPreview(packet) {
  if (!packet || typeof packet !== "object") {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["packet_not_object"]) });
  }
  const blocked_by = [];
  const { content_hash, ...body } = packet;
  if (content_hash !== `sha256:${sha256(stableStringify(body))}`) blocked_by.push("content_hash_mismatch");
  if (!ACTIVATION_STATUSES.includes(packet.activation_status)) blocked_by.push("unknown_activation_status");

  if (packet.activation_status === "local_preview_active") {
    const sca = packet.signed_receipt_anchor;
    if (!validSignedAnchor(sca)) {
      blocked_by.push("signed_receipt_anchor_invalid");
    } else {
      const ref = packet.signed_receipt_anchor_ref;
      if (!ref || ref.head_hash !== sca.payload.head_hash || ref.chain_content_hash !== sca.payload.chain_content_hash) {
        blocked_by.push("anchor_ref_mismatch");
      }
    }
    for (const f of [...REQUIRED.health, ...REQUIRED.consent, ...REQUIRED.resource, ...REQUIRED.data]) {
      if (!present(packet[f])) blocked_by.push(`missing_${f}`);
    }
  }

  if (packet.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
  if (packet.grants_action !== false) blocked_by.push("grants_action_true");
  if (packet.mint_allowed !== false) blocked_by.push("mint_allowed_true");

  const bkeys = Object.keys(node0UrpGenesisRootActivationPreviewBoundary());
  const pb = packet.boundary;
  if (!pb || typeof pb !== "object" || Object.keys(pb).length !== bkeys.length || bkeys.some((k) => pb[k] !== false)) {
    blocked_by.push("boundary_not_all_false");
  }
  const df = packet.boundary_flags;
  if (!df || typeof df !== "object" || Object.keys(df).length !== DOMAIN_FLAG_KEYS.length || DOMAIN_FLAG_KEYS.some((k) => df[k] !== false)) {
    blocked_by.push("domain_flags_not_all_false");
  }

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_SCHEMA,
    truth_label: NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_TRUTH_LABEL,
    activation_status: packet.activation_status,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
  });
}

// A pure example input assembler (given a caller-produced signed chain head). Used by the gate/test.
export function exampleGenesisRootInput(signedChainHead) {
  return {
    node0_identity: { id: "node0", label: "BIZRA Node0" },
    bizra_project_identity: { id: "bizra", label: "BIZRA" },
    operator_identity: { id: "operator", label: "founder / Node0 operator" },
    machine_resource_profile: { cpu_cores: 16, ram_gb: 64, storage_gb: 4096, gpu: "present" },
    compute_resource_policy: { max_utilization: 0.5, availability_windows: ["local_only"], remote_execution: false },
    data_resource_policy: { default_mode: "metadata_only", content_access: "explicit_consent_only", raw_content_leaves_node0: false },
    consent_scope_profile: { scopes: ["metadata_only"], user_is_sole_authority: true },
    signed_chain_head: signedChainHead,
    builder_space_pointer: "docs/BUILDER_SPACE.md (preview)",
    boundary_flags: node0UrpGenesisRootDomainFlags(),
    declared_claims: ["BIZRA URP local preview activated; Node0 resource registry composed; measured resource is not value; no mint; no federation."],
  };
}

// Orchestrator the gate consumes: plan -> evaluate -> build (only if active) -> verify -> anchor
// forge-and-recompute self-check.
export function runNode0UrpGenesisRootActivationPreview({ consent, input } = {}) {
  const plan = planNode0UrpGenesisRootActivationPreview({ consent, input });
  if (!plan.eligible) {
    return Object.freeze({
      ok: false,
      schema: NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_SCHEMA,
      truth_label: NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_TRUTH_LABEL,
      activation_status: "blocked_pending_consent",
      boundary: node0UrpGenesisRootActivationPreviewBoundary(),
      domain_flags: node0UrpGenesisRootDomainFlags(),
      authority_delta: 0,
      grants_action: false,
      mint_allowed: false,
      blocked_by: plan.blocked_by,
    });
  }

  const evalr = evaluateActivation(input);
  if (evalr.status !== "local_preview_active") {
    return Object.freeze({
      ok: false,
      schema: NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_SCHEMA,
      truth_label: NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_TRUTH_LABEL,
      activation_status: evalr.status,
      boundary: node0UrpGenesisRootActivationPreviewBoundary(),
      domain_flags: node0UrpGenesisRootDomainFlags(),
      authority_delta: 0,
      grants_action: false,
      mint_allowed: false,
      blocked_by: evalr.blocked_by,
    });
  }

  const descriptor = buildNode0UrpGenesisRootActivationPreviewPayload(input);
  const verdict = verifyNode0UrpGenesisRootActivationPreview(descriptor);

  // Forge-and-recompute the receipt-root anchor: tamper the signed head_hash AND recompute the
  // descriptor content hash. Content-addressing would be self-consistent, but the anchor SIGNATURE
  // still rejects it — proving the receipt root is signature-backed, not merely content-addressed.
  const forgedAnchor = {
    ...descriptor.signed_receipt_anchor,
    payload: { ...descriptor.signed_receipt_anchor.payload, head_hash: `sha256:${"e".repeat(64)}` },
  };
  const forgedBody = { ...descriptor, signed_receipt_anchor: forgedAnchor };
  delete forgedBody.content_hash;
  const forged = { ...forgedBody, content_hash: `sha256:${sha256(stableStringify(forgedBody))}` };
  const forgeCaught = verifyNode0UrpGenesisRootActivationPreview(forged).ok === false;

  const blocked_by = [];
  if (!verdict.ok) blocked_by.push(...verdict.blocked_by);
  if (!forgeCaught) blocked_by.push("forge_and_recompute_not_detected");

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_SCHEMA,
    truth_label: NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_TRUTH_LABEL,
    activation_status: descriptor.activation_status,
    content_hash: descriptor.content_hash,
    signed_receipt_anchor_ref: descriptor.signed_receipt_anchor_ref,
    boundary: node0UrpGenesisRootActivationPreviewBoundary(),
    domain_flags: node0UrpGenesisRootDomainFlags(),
    authority_delta: 0,
    grants_action: false,
    mint_allowed: false,
    blocked_by: Object.freeze(blocked_by),
  });
}
