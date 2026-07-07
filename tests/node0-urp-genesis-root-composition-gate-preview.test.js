import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import { generateEd25519Keypair } from "../packages/receipts/src/authorship-signature.js";
import { buildNode0ProofChainLinkPayload } from "../packages/core/src/node0-proof-chain-link.js";
import { signChainHead, NODE0_SIGNED_CHAIN_HEAD_GO_PHRASE } from "../packages/core/src/node0-signed-chain-head.js";
import {
  buildNode0UrpGenesisRootActivationPreviewPayload,
  exampleGenesisRootInput,
} from "../packages/core/src/node0-urp-genesis-root-activation-preview.js";
import {
  planNode0UrpGenesisRootCompositionGatePreview,
  buildNode0UrpGenesisRootCompositionGatePreviewPayload,
  verifyNode0UrpGenesisRootCompositionGatePreview,
  runNode0UrpGenesisRootCompositionGatePreview,
  evaluateComposition,
  exampleCompositionInput,
  exampleCompositionSurfaces,
  KNOWN_URP_RESOURCE_SCHEMAS,
  KNOWN_URP_RESOURCE_KINDS,
  NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_SCHEMA,
  NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_TRUTH_LABEL,
  NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_GO_PHRASE,
} from "../packages/core/src/node0-urp-genesis-root-composition-gate-preview.js";
import { runNode0UrpGenesisRootCompositionGatePreviewCheck } from "../scripts/review/node0-urp-genesis-root-composition-gate-preview-check.mjs";

// Real schema constants from the eight resource kernels — the drift-guard source of truth.
import { URP_RESOURCE_OFFER_PREVIEW_SCHEMA } from "../packages/core/src/urp-resource-offer-preview.js";
import { NODE0_MULTI_DEVICE_URP_RESOURCE_MANIFEST_SCHEMA } from "../packages/core/src/node0-multi-device-urp-resource-manifest-preview.js";
import { URP_SHARED_RUNTIME_DISCOVERY_SCHEMA } from "../packages/core/src/urp-shared-runtime-discovery.js";
import { SHARED_URP_WORLD_PREVIEW_SCHEMA } from "../packages/core/src/shared-urp-world-preview.js";
import { URP_SUPPLY_REWARD_PREVIEW_SCHEMA } from "../packages/core/src/urp-supply-side-resource-reward-contract-preview.js";
import { URP_CARRYING_COST_PREVIEW_SCHEMA } from "../packages/core/src/urp-carrying-cost-preview.js";
import { URP_CONTRIBUTION_BENEFIT_PREVIEW_SCHEMA } from "../packages/core/src/urp-contribution-benefit-preview.js";
import { NODE_RESOURCE_PASSPORT_PREVIEW_SCHEMA } from "../packages/core/src/node-resource-passport-preview.js";

const GO = NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_GO_PHRASE;

// Local mirror of the kernel's content-address (test-only) so the launder test can forge + recompute.
function sha256(v) {
  return createHash("sha256").update(v, "utf8").digest("hex");
}
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function signedChainHead() {
  const keys = generateEd25519Keypair();
  const chain = buildNode0ProofChainLinkPayload([`sha256:${"1".repeat(64)}`, `sha256:${"2".repeat(64)}`]);
  return signChainHead({
    chain,
    consent: NODE0_SIGNED_CHAIN_HEAD_GO_PHRASE,
    privateKeyPem: keys.private_key_pem,
    publicKeyPem: keys.public_key_pem,
    publicKeyFingerprint: keys.public_key_fingerprint,
  });
}

function genesisPacket() {
  return buildNode0UrpGenesisRootActivationPreviewPayload(exampleGenesisRootInput(signedChainHead()));
}

function validInput(overrides = {}) {
  return { ...exampleCompositionInput(genesisPacket()), ...overrides };
}

function surfacesWith(kind, patch) {
  return exampleCompositionSurfaces().map((s) => (s.kind === kind ? { ...s, ...patch } : s));
}

// --- scaffold contract ---------------------------------------------------------------------------

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planNode0UrpGenesisRootCompositionGatePreview({ consent: "wrong", input: validInput() });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with exact consent and well-formed input", () => {
  const plan = planNode0UrpGenesisRootCompositionGatePreview({ consent: GO, input: validInput() });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
});

test("payload is content-addressed and carries an all-false boundary", () => {
  const payload = buildNode0UrpGenesisRootCompositionGatePreviewPayload(validInput());
  assert.equal(payload.schema, NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_SCHEMA);
  assert.equal(payload.truth_label, NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.boundary.execution_allowed, false);
  assert.equal(payload.boundary.live_execution_performed, false);
});

test("verify accepts a freshly built payload", () => {
  const payload = buildNode0UrpGenesisRootCompositionGatePreviewPayload(validInput());
  assert.equal(verifyNode0UrpGenesisRootCompositionGatePreview(payload).ok, true, verifyNode0UrpGenesisRootCompositionGatePreview(payload).blocked_by.join(", "));
});

test("verify rejects a tampered content_hash", () => {
  const payload = buildNode0UrpGenesisRootCompositionGatePreviewPayload(validInput());
  const tampered = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  assert.equal(verifyNode0UrpGenesisRootCompositionGatePreview(tampered).ok, false);
});

test("verify rejects a field change that did not update the content_hash", () => {
  const payload = buildNode0UrpGenesisRootCompositionGatePreviewPayload(validInput());
  const forged = { ...payload, truth_label: "FORGED" };
  assert.equal(verifyNode0UrpGenesisRootCompositionGatePreview(forged).ok, false);
});

test("review gate closes the loop: build -> verify -> tamper-reject", () => {
  const result = runNode0UrpGenesisRootCompositionGatePreviewCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_SCHEMA);
  assert.equal(result.truth_label, NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_TRUTH_LABEL);
});

test("orchestrator boundary stays all-false (no execution authority)", () => {
  const result = runNode0UrpGenesisRootCompositionGatePreview({ consent: GO, input: validInput() });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
  assert.equal(result.boundary.live_execution_performed, false);
});

// --- composition contract ------------------------------------------------------------------------

test("happy path: composition succeeds over the full known resource family", () => {
  const result = runNode0UrpGenesisRootCompositionGatePreview({ consent: GO, input: validInput() });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.status, "composition_ready_preview");
  assert.equal(result.composition_ready, true);
  assert.equal(result.composed_surface_count, KNOWN_URP_RESOURCE_KINDS.length);
  assert.equal(result.mint_allowed, false);
  assert.equal(result.live_urp, false);
  assert.equal(result.federation, false);
});

test("missing genesis descriptor rejects", () => {
  const result = runNode0UrpGenesisRootCompositionGatePreview({ consent: GO, input: validInput({ genesis_root: undefined }) });
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.includes("missing_genesis_root"));
});

test("invalid genesis content_hash rejects", () => {
  const bad = { ...genesisPacket(), content_hash: `sha256:${"0".repeat(64)}` };
  const result = runNode0UrpGenesisRootCompositionGatePreview({ consent: GO, input: validInput({ genesis_root: bad }) });
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.includes("genesis_root_invalid"), result.blocked_by.join(", "));
});

test("genesis boundary flag true rejects", () => {
  const g = genesisPacket();
  const bad = { ...g, boundary: { ...g.boundary, execution_allowed: true } };
  const result = runNode0UrpGenesisRootCompositionGatePreview({ consent: GO, input: validInput({ genesis_root: bad }) });
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.includes("genesis_root_invalid"), result.blocked_by.join(", "));
});

test("declared live_urp true rejects as overclaim", () => {
  const input = validInput({ declared_flags: { live_urp: true } });
  const result = runNode0UrpGenesisRootCompositionGatePreview({ consent: GO, input });
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.includes("overclaim:live_urp"), result.blocked_by.join(", "));
});

test("a surface asserting mint_allowed true rejects", () => {
  const input = validInput({ resource_surfaces: surfacesWith("multi_device_manifest", { mint_allowed: true }) });
  const result = runNode0UrpGenesisRootCompositionGatePreview({ consent: GO, input });
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.some((c) => c.startsWith("resource_mint_allowed:")), result.blocked_by.join(", "));
});

test("declared federation true rejects as overclaim", () => {
  const input = validInput({ declared_flags: { federation: true } });
  const result = runNode0UrpGenesisRootCompositionGatePreview({ consent: GO, input });
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.includes("overclaim:federation"), result.blocked_by.join(", "));
});

test("a published offer surface rejects", () => {
  const input = validInput({ resource_surfaces: surfacesWith("resource_offer", { published: true }) });
  const result = runNode0UrpGenesisRootCompositionGatePreview({ consent: GO, input });
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.some((c) => c.startsWith("resource_published:")), result.blocked_by.join(", "));
});

test("settlement not preview_only rejects", () => {
  const input = validInput({ resource_surfaces: surfacesWith("resource_offer", { settlement_mode: "live" }) });
  const result = runNode0UrpGenesisRootCompositionGatePreview({ consent: GO, input });
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.some((c) => c.startsWith("settlement_not_preview_only:")), result.blocked_by.join(", "));
});

test("reward-contract surface asserting mint_allowed true rejects", () => {
  const input = validInput({ resource_surfaces: surfacesWith("supply_reward_contract", { mint_allowed: true }) });
  const result = runNode0UrpGenesisRootCompositionGatePreview({ consent: GO, input });
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.some((c) => c.startsWith("resource_mint_allowed:")), result.blocked_by.join(", "));
});

test("cost_as_impact surface rejects", () => {
  const input = validInput({ resource_surfaces: surfacesWith("carrying_cost", { cost_as_impact: true }) });
  const result = runNode0UrpGenesisRootCompositionGatePreview({ consent: GO, input });
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.some((c) => c.startsWith("cost_as_impact:")), result.blocked_by.join(", "));
});

test("raw_data_exchange surface rejects", () => {
  const input = validInput({ resource_surfaces: surfacesWith("resource_offer", { raw_data_exchange: true }) });
  const result = runNode0UrpGenesisRootCompositionGatePreview({ consent: GO, input });
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.some((c) => c.startsWith("raw_data_exchange:")), result.blocked_by.join(", "));
});

test("authority_delta > 0 rejects", () => {
  const result = runNode0UrpGenesisRootCompositionGatePreview({ consent: GO, input: validInput({ authority_delta: 1 }) });
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.includes("authority_delta_nonzero"), result.blocked_by.join(", "));
});

test("an unknown resource schema rejects", () => {
  const input = validInput({
    resource_surfaces: [
      { kind: "resource_offer", schema: "bizra.dema.NOT_A_REAL_SCHEMA.v0.1", valid: true, boundary: exampleCompositionSurfaces()[0].boundary, published: false, settlement_mode: "preview_only", mint_allowed: false, cost_as_impact: false, raw_data_exchange: false },
    ],
  });
  const result = runNode0UrpGenesisRootCompositionGatePreview({ consent: GO, input });
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.some((c) => c.startsWith("resource_schema_mismatch:")), result.blocked_by.join(", "));
});

test("forge-and-recompute of the embedded genesis anchor is still detected (signature anchor)", () => {
  const payload = buildNode0UrpGenesisRootCompositionGatePreviewPayload(validInput());
  const g = payload.genesis_root;
  const forgedGenesis = {
    ...g,
    signed_receipt_anchor: {
      ...g.signed_receipt_anchor,
      payload: { ...g.signed_receipt_anchor.payload, head_hash: `sha256:${"e".repeat(64)}` },
    },
  };
  const forgedBody = { ...payload, genesis_root: forgedGenesis };
  delete forgedBody.content_hash;
  const forged = { ...forgedBody, content_hash: `sha256:${sha256(stableStringify(forgedBody))}` };
  const v = verifyNode0UrpGenesisRootCompositionGatePreview(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("genesis_anchor_invalid"), v.blocked_by.join(", "));
});

test("composed_surface_count in a verdict cannot be forged past its surface list", () => {
  const payload = buildNode0UrpGenesisRootCompositionGatePreviewPayload(validInput());
  const forged = { ...payload, composed_surface_count: payload.composed_surface_count + 5 };
  assert.equal(verifyNode0UrpGenesisRootCompositionGatePreview(forged).ok, false);
});

// --- drift guard + purity ------------------------------------------------------------------------

test("KNOWN_URP_RESOURCE_SCHEMAS stays in lockstep with the real resource kernels (drift guard)", () => {
  assert.equal(KNOWN_URP_RESOURCE_SCHEMAS.resource_offer, URP_RESOURCE_OFFER_PREVIEW_SCHEMA);
  assert.equal(KNOWN_URP_RESOURCE_SCHEMAS.multi_device_manifest, NODE0_MULTI_DEVICE_URP_RESOURCE_MANIFEST_SCHEMA);
  assert.equal(KNOWN_URP_RESOURCE_SCHEMAS.shared_runtime_discovery, URP_SHARED_RUNTIME_DISCOVERY_SCHEMA);
  assert.equal(KNOWN_URP_RESOURCE_SCHEMAS.shared_urp_world, SHARED_URP_WORLD_PREVIEW_SCHEMA);
  assert.equal(KNOWN_URP_RESOURCE_SCHEMAS.supply_reward_contract, URP_SUPPLY_REWARD_PREVIEW_SCHEMA);
  assert.equal(KNOWN_URP_RESOURCE_SCHEMAS.carrying_cost, URP_CARRYING_COST_PREVIEW_SCHEMA);
  assert.equal(KNOWN_URP_RESOURCE_SCHEMAS.contribution_benefit, URP_CONTRIBUTION_BENEFIT_PREVIEW_SCHEMA);
  assert.equal(KNOWN_URP_RESOURCE_SCHEMAS.node_resource_passport, NODE_RESOURCE_PASSPORT_PREVIEW_SCHEMA);
  assert.equal(KNOWN_URP_RESOURCE_KINDS.length, 8);
});

test("evaluateComposition surfaces per-surface results with an accurate count", () => {
  const evalr = evaluateComposition(exampleCompositionInput(genesisPacket()));
  assert.equal(evalr.blocked_by.length, 0, evalr.blocked_by.join(", "));
  assert.equal(evalr.composed_surface_count, 8);
  assert.ok(evalr.surface_results.every((r) => r.ok === true));
});

test("kernel remains pure: no fs / network / process / clock / random", () => {
  const src = readFileSync(
    fileURLToPath(new URL("../packages/core/src/node0-urp-genesis-root-composition-gate-preview.js", import.meta.url)),
    "utf8",
  );
  assert.doesNotMatch(src, /node:fs|node:net|node:child_process|node:http|node:dns/);
  assert.doesNotMatch(src, /Math\.random|Date\.now|new Date\(/);
  assert.doesNotMatch(src, /process\.(env|argv|exit)/);
});
