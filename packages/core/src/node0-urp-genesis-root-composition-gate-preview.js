// NODE0-URP-GENESIS-ROOT-COMPOSITION-GATE-PREVIEW-1A — Pure preview-only gate binding a Node0 URP
// genesis-root descriptor to existing URP resource-family preview surfaces under all-false boundary
// rules; activates nothing, mints nothing.
//
// This gate answers exactly ONE question:
//   "Is this genesis-root descriptor allowed to COMPOSE with these existing URP preview resources
//    WITHOUT activating live URP, minting, settlement, federation, daemon, model invocation, network,
//    or remote execution?"
//
// It does NOT run the resource kernels (they have heterogeneous shapes and most expose no verifier).
// The caller normalizes each real preview output into this gate's small injected-surface contract;
// the gate validates that normalized surface plus the genesis-root descriptor. The genesis-root packet
// is EMBEDDED whole and re-verified through verifyNode0UrpGenesisRootActivationPreview, whose
// signature-backed receipt-chain-head anchor is the INDEPENDENT anchor that defeats a
// forge-and-recompute launder of the composition body.
//
// Pure kernel: no fs / network / process / clock / random. createHash is a deterministic digest.
// Every claim here is a preview; the boundary is all-false.

import { createHash } from "node:crypto";
import {
  verifyNode0UrpGenesisRootActivationPreview,
  NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_SCHEMA,
} from "./node0-urp-genesis-root-activation-preview.js";

export const NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_SCHEMA = "bizra.dema.node0_urp_genesis_root_composition_gate_preview.v0.1";
export const NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_TRUTH_LABEL = "NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_MEASURED_REPO";
export const NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_GO_PHRASE = "GO: node0 urp genesis root composition gate preview";

// The genesis-root descriptor must be in this status to be composable.
export const GENESIS_COMPOSABLE_STATUS = "local_preview_active";

// The URP resource-family surfaces this gate is allowed to compose with the genesis-root descriptor.
// kind -> the real preview schema string exported by each resource kernel. These MIRROR the schema
// constants those kernels export; tests/node0-urp-genesis-root-composition-gate-preview.test.js imports
// the real constants and asserts this map stays in lockstep, so it cannot silently rot (drift guard).
export const KNOWN_URP_RESOURCE_SCHEMAS = Object.freeze({
  resource_offer: "bizra.dema.urp_resource_offer_preview.v0.1",
  multi_device_manifest: "bizra.node0.multi_device_urp_resource_manifest_preview.v0.1",
  shared_runtime_discovery: "bizra.dema.urp_shared_runtime_discovery.v0.1",
  shared_urp_world: "bizra.dema.shared_urp_world_preview.v0.1",
  supply_reward_contract: "bizra.urp.supply_side_resource_reward_contract_preview.v0.1",
  carrying_cost: "bizra.dema.urp_carrying_cost_preview.v0.1",
  contribution_benefit: "bizra.dema.urp_contribution_benefit_preview.v0.1",
  node_resource_passport: "bizra.dema.node_resource_passport_preview.v0.1",
});

export const KNOWN_URP_RESOURCE_KINDS = Object.freeze(Object.keys(KNOWN_URP_RESOURCE_SCHEMAS));

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

// All-false boundary invariant. These keys mirror the capability-truth-registry row boundary —
// keep them all false; flipping any one is an execution claim.
export function node0UrpGenesisRootCompositionGatePreviewBoundary() {
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

function boundaryAllFalse(b) {
  const keys = Object.keys(node0UrpGenesisRootCompositionGatePreviewBoundary());
  return (
    !!b &&
    typeof b === "object" &&
    !Array.isArray(b) &&
    Object.keys(b).length === keys.length &&
    keys.every((k) => b[k] === false)
  );
}

// Composed-level flags that must never be asserted true by a preview composition. A caller that
// declares any of these true is claiming a live capability the gate refuses to sanction.
const FORBIDDEN_COMPOSED_FLAGS = Object.freeze([
  "live_urp",
  "federation",
  "mint",
  "wallet",
  "settlement",
  "daemon",
  "network",
  "remote_execution",
]);

// Validate one normalized resource surface. Returns an array of blocked_by codes (suffixed :<i>).
function evaluateSurface(surface, i) {
  const b = [];
  if (!surface || typeof surface !== "object" || Array.isArray(surface)) {
    b.push(`surface_not_object:${i}`);
    return b;
  }
  if (!KNOWN_URP_RESOURCE_KINDS.includes(surface.kind)) {
    b.push(`unknown_resource_kind:${i}`);
  } else if (surface.schema !== KNOWN_URP_RESOURCE_SCHEMAS[surface.kind]) {
    b.push(`resource_schema_mismatch:${i}`);
  }
  if (surface.valid === false) b.push(`resource_not_valid:${i}`);
  if (!boundaryAllFalse(surface.boundary)) b.push(`resource_boundary_not_all_false:${i}`);
  if (surface.published === true) b.push(`resource_published:${i}`);
  if (surface.settlement_mode !== "preview_only") b.push(`settlement_not_preview_only:${i}`);
  if (surface.mint_allowed === true) b.push(`resource_mint_allowed:${i}`);
  if (surface.cost_as_impact === true) b.push(`cost_as_impact:${i}`);
  if (surface.raw_data_exchange === true) b.push(`raw_data_exchange:${i}`);
  if (surface.federation === true) b.push(`resource_federation:${i}`);
  if (surface.live === true) b.push(`resource_live:${i}`);
  if (surface.person_identifying === true) b.push(`person_identifying_leak:${i}`);
  return b;
}

// Core fail-closed composition evaluator. Content-addresses NOTHING here; returns the raw verdict
// facts { blocked_by, composed_surface_count, surface_results } that buildPayload seals.
export function evaluateComposition(input) {
  const blocked_by = [];
  const genesis = input?.genesis_root;

  // (1)-(3) genesis-root must verify, be local_preview_active, carry the right schema. The
  // genesis verifier deep-checks its all-false boundary + domain flags + signature anchor, so a
  // tampered/forged descriptor fails here — this is our independent anchor.
  const gv = verifyNode0UrpGenesisRootActivationPreview(genesis);
  if (!gv.ok) {
    blocked_by.push("genesis_root_invalid");
    for (const code of gv.blocked_by || []) blocked_by.push(`genesis:${code}`);
  }
  if (genesis?.schema !== NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_SCHEMA) {
    blocked_by.push("genesis_schema_mismatch");
  }
  if (genesis?.activation_status !== GENESIS_COMPOSABLE_STATUS) {
    blocked_by.push("genesis_not_local_preview_active");
  }

  // (7) no raw private data export declared by the genesis data policy.
  if (genesis?.data_resource_policy?.raw_content_leaves_node0 === true) {
    blocked_by.push("genesis_raw_content_leaves_node0");
  }

  // (8) owner binds to Node0 without person-identifying leakage.
  if (genesis?.node0_identity?.id !== "node0") blocked_by.push("owner_not_bound_to_node0");
  if (input?.person_identifying === true) blocked_by.push("person_identifying_leak");

  // (9) no composed-level overclaim of a live capability.
  const declared = input?.declared_flags;
  if (declared && typeof declared === "object") {
    for (const f of FORBIDDEN_COMPOSED_FLAGS) {
      if (declared[f] === true) blocked_by.push(`overclaim:${f}`);
    }
  }
  if (typeof input?.authority_delta === "number" && input.authority_delta > 0) {
    blocked_by.push("authority_delta_nonzero");
  }

  // (4)-(6) each composed URP resource surface must be a valid, unpublished, preview-only,
  // non-minting, non-cost-as-impact, no-raw-data surface from a known kernel.
  const surfaces = input?.resource_surfaces;
  const surface_results = [];
  if (!Array.isArray(surfaces) || surfaces.length === 0) {
    blocked_by.push("no_resource_surfaces");
  } else {
    for (let i = 0; i < surfaces.length; i += 1) {
      const codes = evaluateSurface(surfaces[i], i);
      for (const c of codes) blocked_by.push(c);
      surface_results.push(
        Object.freeze({
          kind: surfaces[i]?.kind ?? null,
          schema: surfaces[i]?.schema ?? null,
          ok: codes.length === 0,
        }),
      );
    }
  }

  return Object.freeze({
    blocked_by: Object.freeze([...new Set(blocked_by)]),
    composed_surface_count: surface_results.length,
    surface_results: Object.freeze(surface_results),
  });
}

// Fail-closed plan. Exact GO-phrase byte match — no fuzzy / partial consent. Absence of a block is
// never validation: positively require the composition shape.
export function planNode0UrpGenesisRootCompositionGatePreview({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  if (!input || typeof input !== "object") {
    blocked_by.push("input_not_object");
  } else {
    if (!input.genesis_root || typeof input.genesis_root !== "object") {
      blocked_by.push("missing_genesis_root");
    }
    if (!Array.isArray(input.resource_surfaces) || input.resource_surfaces.length === 0) {
      blocked_by.push("missing_resource_surfaces");
    }
  }
  return Object.freeze({
    schema: NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_SCHEMA,
    truth_label: NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Content-addressed composition verdict. Embeds the whole genesis-root descriptor (its signature-backed
// anchor is the independent launder defense). content_hash binds the entire body.
export function buildNode0UrpGenesisRootCompositionGatePreviewPayload(input) {
  const evalr = evaluateComposition(input);
  const body = {
    schema: NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_SCHEMA,
    truth_label: NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_TRUTH_LABEL,
    genesis_root: input?.genesis_root ?? null,
    genesis_root_content_hash: input?.genesis_root?.content_hash ?? null,
    genesis_activation_status: input?.genesis_root?.activation_status ?? null,
    composed_surfaces: evalr.surface_results,
    composed_surface_count: evalr.composed_surface_count,
    composition_ready: evalr.blocked_by.length === 0,
    blocked_by: evalr.blocked_by,
    boundary: node0UrpGenesisRootCompositionGatePreviewBoundary(),
    authority_delta: 0,
    grants_action: false,
    mint_allowed: false,
    live_urp: false,
    federation: false,
    daemon: false,
    network: false,
    wallet: false,
    settlement: false,
    what_this_proves:
      "A Node0 URP Genesis Root descriptor was checked as COMPOSABLE (local preview) with a declared set of existing URP resource-family preview surfaces: the genesis descriptor re-verifies through its signature-backed anchor and is local_preview_active; every composed surface carries a known URP preview schema, an all-false boundary, and stays unpublished, preview-only settlement, non-minting, non-cost-as-impact, and no-raw-data; a stable content hash binds the whole verdict.",
    what_this_does_not_prove:
      "It activates no live URP, publishes no offer, settles nothing, mints nothing, opens no wallet, federates nothing, runs no daemon, invokes no model, and touches no network. It does NOT run the resource kernels — it validates caller-normalized surfaces, so surface fidelity is the caller's responsibility; only the embedded genesis-root anchor is signature-backed (launder-resistant), the surfaces are content-addressed attestations. composition_ready is a preview readiness verdict, not a live composition.",
  };
  const content_hash = `sha256:${sha256(stableStringify(body))}`;
  return Object.freeze({ ...body, content_hash });
}

// Body-bound re-derivation verifier. Recomputes the content hash over the whole body, re-checks the
// invariants, and RE-VERIFIES the embedded genesis-root through its signature anchor — so a
// forge-and-recompute of the composition body is still rejected because re-signing the anchor needs
// a private key the forger does not have.
export function verifyNode0UrpGenesisRootCompositionGatePreview(payload) {
  if (!payload || typeof payload !== "object") {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["packet_not_object"]) });
  }
  const blocked_by = [];
  const { content_hash, ...body } = payload;
  if (content_hash !== `sha256:${sha256(stableStringify(body))}`) blocked_by.push("content_hash_mismatch");
  if (payload.schema !== NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_SCHEMA) blocked_by.push("schema_mismatch");
  if (payload.truth_label !== NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");
  if (payload.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
  if (payload.grants_action !== false) blocked_by.push("grants_action_true");
  if (payload.mint_allowed !== false) blocked_by.push("mint_allowed_true");
  for (const f of ["live_urp", "federation", "daemon", "network", "wallet", "settlement"]) {
    if (payload[f] !== false) blocked_by.push(`${f}_claimed`);
  }
  if (!boundaryAllFalse(payload.boundary)) blocked_by.push("boundary_not_all_false");
  if (
    !Array.isArray(payload.composed_surfaces) ||
    payload.composed_surface_count !== payload.composed_surfaces.length
  ) {
    blocked_by.push("composed_count_mismatch");
  }
  // Independent anchor: the embedded genesis-root re-verifies (signature-backed).
  const gv = verifyNode0UrpGenesisRootActivationPreview(payload.genesis_root);
  if (!gv.ok) blocked_by.push("genesis_anchor_invalid");
  if (payload.genesis_root_content_hash !== (payload.genesis_root?.content_hash ?? null)) {
    blocked_by.push("genesis_hash_ref_mismatch");
  }
  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_SCHEMA,
    truth_label: NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_TRUTH_LABEL,
    composed_surface_count: payload.composed_surface_count,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
  });
}

// Pure example resource surfaces — one per known kind, all normalized to the preview-safe contract.
export function exampleCompositionSurfaces() {
  return KNOWN_URP_RESOURCE_KINDS.map((kind) =>
    Object.freeze({
      kind,
      schema: KNOWN_URP_RESOURCE_SCHEMAS[kind],
      valid: true,
      boundary: node0UrpGenesisRootCompositionGatePreviewBoundary(),
      published: false,
      settlement_mode: "preview_only",
      mint_allowed: false,
      cost_as_impact: false,
      raw_data_exchange: false,
      federation: false,
      live: false,
      person_identifying: false,
    }),
  );
}

// Pure input assembler given an already-built genesis-root descriptor packet (the caller/gate builds
// it — the signed chain head needs keys, which the pure kernel never generates).
export function exampleCompositionInput(genesisRootPacket) {
  return {
    genesis_root: genesisRootPacket,
    resource_surfaces: exampleCompositionSurfaces(),
    person_identifying: false,
    authority_delta: 0,
    declared_flags: Object.freeze({
      live_urp: false,
      federation: false,
      mint: false,
      wallet: false,
      settlement: false,
      daemon: false,
      network: false,
      remote_execution: false,
    }),
  };
}

// Orchestrator the review gate consumes: plan -> build -> verify -> tamper-reject, failing closed.
export function runNode0UrpGenesisRootCompositionGatePreview({ consent, input } = {}) {
  const plan = planNode0UrpGenesisRootCompositionGatePreview({ consent, input });
  if (!plan.eligible) {
    return Object.freeze({
      ok: false,
      schema: NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_SCHEMA,
      truth_label: NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_TRUTH_LABEL,
      status: "blocked_pending_consent",
      composed_surface_count: 0,
      composition_ready: false,
      boundary: node0UrpGenesisRootCompositionGatePreviewBoundary(),
      mint_allowed: false,
      live_urp: false,
      federation: false,
      daemon: false,
      network: false,
      wallet: false,
      settlement: false,
      authority_delta: 0,
      grants_action: false,
      blocked_by: plan.blocked_by,
    });
  }

  const payload = buildNode0UrpGenesisRootCompositionGatePreviewPayload(input);
  const verified = verifyNode0UrpGenesisRootCompositionGatePreview(payload);
  const blocked_by = [];
  if (!payload.composition_ready) blocked_by.push(...payload.blocked_by);
  if (!verified.ok) blocked_by.push(...verified.blocked_by);

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_SCHEMA,
    truth_label: NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_TRUTH_LABEL,
    status: blocked_by.length === 0 ? "composition_ready_preview" : "composition_blocked",
    content_hash: payload.content_hash,
    composed_surface_count: payload.composed_surface_count,
    composition_ready: payload.composition_ready,
    boundary: payload.boundary,
    mint_allowed: false,
    live_urp: false,
    federation: false,
    daemon: false,
    network: false,
    wallet: false,
    settlement: false,
    authority_delta: 0,
    grants_action: false,
    what_this_proves: payload.what_this_proves,
    what_this_does_not_prove: payload.what_this_does_not_prove,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
  });
}
