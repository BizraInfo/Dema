import test from "node:test";
import assert from "node:assert/strict";

import { generateEd25519Keypair } from "../packages/receipts/src/authorship-signature.js";
import { buildNode0ProofChainLinkPayload } from "../packages/core/src/node0-proof-chain-link.js";
import { signChainHead, NODE0_SIGNED_CHAIN_HEAD_GO_PHRASE } from "../packages/core/src/node0-signed-chain-head.js";
import {
  planNode0UrpGenesisRootActivationPreview,
  buildNode0UrpGenesisRootActivationPreviewPayload,
  verifyNode0UrpGenesisRootActivationPreview,
  runNode0UrpGenesisRootActivationPreview,
  evaluateActivation,
  exampleGenesisRootInput,
  node0UrpGenesisRootDomainFlags,
  DOMAIN_FLAG_KEYS,
  NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_GO_PHRASE,
} from "../packages/core/src/node0-urp-genesis-root-activation-preview.js";
import { runNode0UrpGenesisRootActivationPreviewCheck } from "../scripts/review/node0-urp-genesis-root-activation-preview-check.mjs";

const GO = NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_GO_PHRASE;

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

function validInput(overrides = {}) {
  return { ...exampleGenesisRootInput(signedChainHead()), ...overrides };
}

test("valid input activates as local_preview_active", () => {
  const r = runNode0UrpGenesisRootActivationPreview({ consent: GO, input: validInput() });
  assert.equal(r.ok, true, r.blocked_by.join(", "));
  assert.equal(r.activation_status, "local_preview_active");
  assert.equal(r.mint_allowed, false);
  assert.match(r.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(r.signed_receipt_anchor_ref.schema, "bizra.dema.node0_signed_chain_head.v0.1");
});

test("consent phrase mismatch is fail-closed", () => {
  const r = runNode0UrpGenesisRootActivationPreview({ consent: "nope", input: validInput() });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("consent_phrase_mismatch"));
});

test("missing node0 identity blocks pending health", () => {
  const r = evaluateActivation(validInput({ node0_identity: undefined }));
  assert.equal(r.status, "blocked_pending_health");
  assert.ok(r.blocked_by.includes("missing_node0_identity"));
});

test("missing operator identity blocks pending health", () => {
  assert.equal(evaluateActivation(validInput({ operator_identity: undefined })).status, "blocked_pending_health");
});

test("missing signed receipt anchor blocks pending health", () => {
  const r = evaluateActivation(validInput({ signed_chain_head: undefined }));
  assert.equal(r.status, "blocked_pending_health");
  assert.ok(r.blocked_by.includes("missing_signed_receipt_anchor"));
});

test("missing consent scope blocks pending consent", () => {
  const r = evaluateActivation(validInput({ consent_scope_profile: undefined }));
  assert.equal(r.status, "blocked_pending_consent");
  assert.ok(r.blocked_by.includes("missing_consent_scope_profile"));
});

test("missing compute policy blocks pending resource policy", () => {
  assert.equal(evaluateActivation(validInput({ compute_resource_policy: undefined })).status, "blocked_pending_resource_policy");
});

test("missing data policy blocks pending data policy", () => {
  assert.equal(evaluateActivation(validInput({ data_resource_policy: undefined })).status, "blocked_pending_data_policy");
});

for (const flag of DOMAIN_FLAG_KEYS) {
  test(`domain flag ${flag}:true rejects as overclaim`, () => {
    const r = evaluateActivation(validInput({ boundary_flags: { ...node0UrpGenesisRootDomainFlags(), [flag]: true } }));
    assert.equal(r.status, "rejected_overclaim");
    assert.ok(r.blocked_by.includes(`${flag}_claimed`));
  });
}

test("public market wording rejects as overclaim", () => {
  const r = evaluateActivation(validInput({ declared_claims: ["the public market is live now"] }));
  assert.equal(r.status, "rejected_overclaim");
  assert.ok(r.blocked_by.includes("public_market_wording"));
});

test("simulated impact treated as verified rejects", () => {
  const r = evaluateActivation(validInput({ declared_claims: ["this simulated impact counts as verified impact"] }));
  assert.equal(r.status, "rejected_overclaim");
  assert.ok(r.blocked_by.includes("simulated_impact_as_verified"));
});

test("resource cost claimed as value rejects", () => {
  const r = evaluateActivation(validInput({ declared_claims: ["measured cost is value"] }));
  assert.equal(r.status, "rejected_overclaim");
  assert.ok(r.blocked_by.includes("resource_cost_as_value"));
});

test("authority_delta > 0 rejects", () => {
  const r = evaluateActivation(validInput({ authority_delta: 1 }));
  assert.equal(r.status, "rejected_overclaim");
  assert.ok(r.blocked_by.includes("authority_delta_nonzero"));
});

test("grants_action:true rejects", () => {
  assert.ok(evaluateActivation(validInput({ grants_action: true })).blocked_by.includes("grants_action_true"));
});

test("an unknown/live activation_status rejects", () => {
  const r = evaluateActivation(validInput({ activation_status: "live_public_urp" }));
  assert.equal(r.status, "rejected_overclaim");
  assert.ok(r.blocked_by.includes("unknown_activation_status"));
});

test("built descriptor carries all-false boundary and domain flags", () => {
  const d = buildNode0UrpGenesisRootActivationPreviewPayload(validInput());
  assert.equal(d.activation_status, "local_preview_active");
  assert.ok(Object.values(d.boundary).every((v) => v === false));
  assert.ok(DOMAIN_FLAG_KEYS.every((k) => d.boundary_flags[k] === false));
  assert.equal(verifyNode0UrpGenesisRootActivationPreview(d).ok, true);
});

test("content hash is stable for identical input", () => {
  const sch = signedChainHead();
  const a = buildNode0UrpGenesisRootActivationPreviewPayload(exampleGenesisRootInput(sch));
  const b = buildNode0UrpGenesisRootActivationPreviewPayload(exampleGenesisRootInput(sch));
  assert.equal(a.content_hash, b.content_hash);
});

test("naive field tamper (no recompute) rejects", () => {
  const d = buildNode0UrpGenesisRootActivationPreviewPayload(validInput());
  const r = verifyNode0UrpGenesisRootActivationPreview({ ...d, machine_resource_profile: { cpu_cores: 999 } });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("content_hash_mismatch"));
});

test("tampering the receipt-root anchor is rejected (signature-backed)", () => {
  // The run orchestrator's internal forge-and-recompute self-check (tamper head_hash + recompute the
  // content hash → still signature_invalid) is exercised by the "valid input → ok:true" test, since a
  // missed forge would surface as "forge_and_recompute_not_detected". Here we assert the verify-level
  // rejection of a tampered anchor directly.
  const d = buildNode0UrpGenesisRootActivationPreviewPayload(validInput());
  const forgedAnchor = { ...d.signed_receipt_anchor, payload: { ...d.signed_receipt_anchor.payload, head_hash: `sha256:${"e".repeat(64)}` } };
  const r = verifyNode0UrpGenesisRootActivationPreview({ ...d, signed_receipt_anchor: forgedAnchor });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("content_hash_mismatch") || r.blocked_by.includes("signed_receipt_anchor_invalid"));
});

test("boundary false→true tamper rejects", () => {
  const d = buildNode0UrpGenesisRootActivationPreviewPayload(validInput());
  const r = verifyNode0UrpGenesisRootActivationPreview({ ...d, boundary: { ...d.boundary, token_minted: true } });
  assert.ok(r.blocked_by.includes("content_hash_mismatch") || r.blocked_by.includes("boundary_not_all_false"));
});

test("plan is fail-closed on consent and a non-object input", () => {
  assert.ok(planNode0UrpGenesisRootActivationPreview({ consent: "no", input: {} }).blocked_by.includes("consent_phrase_mismatch"));
  assert.ok(planNode0UrpGenesisRootActivationPreview({ consent: GO, input: null }).blocked_by.includes("input_not_object"));
});

test("review gate closes the loop and mints nothing", () => {
  const gate = runNode0UrpGenesisRootActivationPreviewCheck();
  assert.equal(gate.ok, true, gate.blocked_by?.join(", "));
  assert.equal(gate.activation_status, "local_preview_active");
  assert.equal(gate.mint_allowed, false);
  assert.equal(gate.boundary.token_minted, false);
});
