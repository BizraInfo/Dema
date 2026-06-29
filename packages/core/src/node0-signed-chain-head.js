// NODE0-SIGNED-CHAIN-HEAD-1A — Ed25519-sign the proof-chain head so one signature attests the whole receipt history.
//
// Composes #307 (Ed25519 receipt attestation) + #308 (append-only proof chain):
// verifies a #308 chain, then signs its head_hash. One signature transitively
// attests every receipt in the chain — alter or reorder any receipt and the head
// changes, so the signature no longer binds.
//
// Signing authority ≠ execution authority. Key material is injected/ephemeral — no
// persistent custody, no real-identity key generation, no §1 identity runtime.
// Pure kernel: no fs / network / process / clock / random (randomness is the
// injected keypair generator). Boundary stays all-false on execution.

import { createHash, createPublicKey } from "node:crypto";
import {
  signPayload,
  verifyPayload,
} from "../../receipts/src/authorship-signature.js";
import {
  buildNode0ProofChainLinkPayload,
  verifyNode0ProofChainLink,
  NODE0_PROOF_CHAIN_LINK_SCHEMA,
} from "./node0-proof-chain-link.js";

export const NODE0_SIGNED_CHAIN_HEAD_SCHEMA = "bizra.dema.node0_signed_chain_head.v0.1";
export const NODE0_SIGNED_CHAIN_HEAD_PAYLOAD_SCHEMA =
  "bizra.dema.node0_signed_chain_head_payload.v0.1";
export const NODE0_SIGNED_CHAIN_HEAD_TRUTH_LABEL = "NODE0_SIGNED_PROOF_CHAIN_HEAD";
export const NODE0_SIGNED_CHAIN_HEAD_GO_PHRASE =
  "GO: sign proof chain head attestation";

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

const EXPECTED_CONSENT_HASH = `sha256:${sha256(NODE0_SIGNED_CHAIN_HEAD_GO_PHRASE)}`;

function publicKeyFingerprintFromPem(publicKeyPem) {
  const der = createPublicKey(publicKeyPem).export({ type: "spki", format: "der" });
  return sha256(der.toString("hex"));
}

// Signing-discipline boundary. Signing the head attests authorship; it grants no
// execution power, holds no persistent key, and never emits the private key.
export function signedChainHeadBoundary() {
  return Object.freeze({
    signing_authority_not_execution: true,
    execution_authority_granted: false,
    network_used: false,
    federation_used: false,
    token_minted: false,
    wallet_accessed: false,
    private_key_exposed: false,
    persistent_key_custody: false,
    operator_path_mutation: false,
  });
}

function blockedSignedChainHead(plan, extraBlocks = []) {
  const blocked_by = [...new Set([...(plan?.blocked_by || []), ...extraBlocks])];
  return Object.freeze({
    schema: NODE0_SIGNED_CHAIN_HEAD_SCHEMA,
    truth_label: NODE0_SIGNED_CHAIN_HEAD_TRUTH_LABEL,
    signed: false,
    blocked_by: Object.freeze(blocked_by),
    boundary: signedChainHeadBoundary(),
  });
}

// Fail-closed plan: exact GO-phrase byte match + a positively verified #308 chain.
export function planSignedChainHead({ consent, chain } = {}) {
  const blocked_by = [];
  if (consent !== NODE0_SIGNED_CHAIN_HEAD_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  if (!chain || typeof chain !== "object" || chain.schema !== NODE0_PROOF_CHAIN_LINK_SCHEMA) {
    blocked_by.push("chain_schema_mismatch");
  } else if (!verifyNode0ProofChainLink(chain).ok) {
    blocked_by.push("chain_verify_failed");
  }
  return Object.freeze({
    schema: NODE0_SIGNED_CHAIN_HEAD_SCHEMA,
    truth_label: NODE0_SIGNED_CHAIN_HEAD_TRUTH_LABEL,
    consent_ok: !blocked_by.includes("consent_phrase_mismatch"),
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Canonical head payload — exactly what gets signed. Binds the chain head, its link
// count, and the chain content address so the signature commits to the whole chain.
export function buildSignedChainHeadPayload(chain) {
  const verified = verifyNode0ProofChainLink(chain);
  if (!verified.ok) {
    throw new Error(`chain_not_verified:${verified.reason}`);
  }
  return Object.freeze({
    schema: NODE0_SIGNED_CHAIN_HEAD_PAYLOAD_SCHEMA,
    chain_schema: chain.schema,
    head_hash: chain.head_hash,
    link_count: chain.links.length,
    chain_content_hash: chain.content_hash,
    truth_label: NODE0_SIGNED_CHAIN_HEAD_TRUTH_LABEL,
    boundary: signedChainHeadBoundary(),
  });
}

// Sign the head payload with injected Ed25519 key material. Never emits the private key.
export function signChainHead({
  chain,
  consent,
  privateKeyPem,
  publicKeyPem,
  publicKeyFingerprint,
  signedAt = "2026-06-29T00:00:00.000Z",
} = {}) {
  const plan = planSignedChainHead({ consent, chain });
  if (!plan.eligible) return blockedSignedChainHead(plan);
  if (!privateKeyPem || !publicKeyPem) {
    return blockedSignedChainHead(plan, ["signing_key_material_missing"]);
  }
  const fingerprint =
    publicKeyFingerprint || publicKeyFingerprintFromPem(publicKeyPem);
  const payload = buildSignedChainHeadPayload(chain);
  const signatureValue = signPayload(payload, privateKeyPem);
  return Object.freeze({
    schema: NODE0_SIGNED_CHAIN_HEAD_SCHEMA,
    truth_label: NODE0_SIGNED_CHAIN_HEAD_TRUTH_LABEL,
    signed: true,
    signed_at: signedAt,
    payload,
    signature: Object.freeze({
      algorithm: "ed25519",
      value: signatureValue,
      public_key_fingerprint: fingerprint,
      public_key_pem: publicKeyPem,
    }),
    consent: Object.freeze({
      go_phrase_hash: EXPECTED_CONSENT_HASH,
      mode: "exact_sign",
    }),
    blocked_by: Object.freeze([]),
    boundary: signedChainHeadBoundary(),
  });
}

// Public-key-only verification of the signed head.
export function verifySignedChainHead(attestation, { publicKeyPem } = {}) {
  if (!attestation || typeof attestation !== "object") {
    return { ok: false, reason: "attestation_not_object" };
  }
  if (attestation.schema !== NODE0_SIGNED_CHAIN_HEAD_SCHEMA) {
    return { ok: false, reason: "schema_mismatch" };
  }
  if (attestation.signed !== true) {
    return { ok: false, reason: "not_signed" };
  }
  const payload = attestation.payload;
  if (!payload || payload.schema !== NODE0_SIGNED_CHAIN_HEAD_PAYLOAD_SCHEMA) {
    return { ok: false, reason: "payload_schema_mismatch" };
  }
  const b = attestation.boundary;
  if (
    !b ||
    b.signing_authority_not_execution !== true ||
    b.execution_authority_granted !== false ||
    b.private_key_exposed !== false ||
    b.persistent_key_custody !== false
  ) {
    return { ok: false, reason: "boundary_invariant_violated" };
  }
  if (attestation.consent?.go_phrase_hash !== EXPECTED_CONSENT_HASH) {
    return { ok: false, reason: "consent_hash_invalid" };
  }
  const keyPem = publicKeyPem || attestation.signature?.public_key_pem;
  if (!keyPem || !attestation.signature?.value) {
    return { ok: false, reason: "public_key_or_signature_missing" };
  }
  if (!verifyPayload(payload, attestation.signature.value, keyPem)) {
    return { ok: false, reason: "signature_invalid" };
  }
  return { ok: true };
}

// Bind the signature to an actual chain: re-derive the head from the chain and
// require it match the signed payload. A tampered/reordered chain has a different
// head, so the bind fails even though the signature itself is valid.
export function signedChainHeadBindsChain(chain, attestation) {
  const verified = verifySignedChainHead(attestation);
  if (!verified.ok) return verified;
  if (!chain || typeof chain !== "object") {
    return { ok: false, reason: "chain_not_object" };
  }
  if (!verifyNode0ProofChainLink(chain).ok) {
    return { ok: false, reason: "chain_verify_failed" };
  }
  if (chain.head_hash !== attestation.payload.head_hash) {
    return { ok: false, reason: "head_hash_bind_failed" };
  }
  if (chain.content_hash !== attestation.payload.chain_content_hash) {
    return { ok: false, reason: "chain_content_hash_bind_failed" };
  }
  return { ok: true };
}

export function attestationExposesPrivateKeyMaterial(attestation) {
  const serialized = stableStringify(attestation);
  return (
    /BEGIN PRIVATE KEY/i.test(serialized) ||
    /private_key_pem/i.test(serialized) ||
    /"private_key"/i.test(serialized)
  );
}

// Orchestrator the review gate consumes: build chain -> sign head -> verify ->
// bind -> tamper-reject (rebuild chain with an altered receipt; its head differs,
// so the original signature must not bind) -> no private-key leak.
export function runNode0SignedChainHead({
  receiptHashes = [
    `sha256:${"1".repeat(64)}`,
    `sha256:${"2".repeat(64)}`,
    `sha256:${"3".repeat(64)}`,
  ],
  now = "2026-06-29T00:00:00.000Z",
  generateKeypair,
} = {}) {
  const blocked_by = [];
  const chain = buildNode0ProofChainLinkPayload(receiptHashes);

  const keys = typeof generateKeypair === "function" ? generateKeypair() : null;
  let attestation = null;
  let verify = null;
  let bind = null;
  let tamper_bind = null;

  if (!keys?.private_key_pem || !keys?.public_key_pem) {
    blocked_by.push("signing_keypair_missing");
  } else {
    attestation = signChainHead({
      chain,
      consent: NODE0_SIGNED_CHAIN_HEAD_GO_PHRASE,
      privateKeyPem: keys.private_key_pem,
      publicKeyPem: keys.public_key_pem,
      publicKeyFingerprint: keys.public_key_fingerprint,
      signedAt: now,
    });
    if (attestation.signed !== true) {
      blocked_by.push(...(attestation.blocked_by || []));
    } else {
      verify = verifySignedChainHead(attestation, {
        publicKeyPem: keys.public_key_pem,
      });
      if (!verify.ok) blocked_by.push(`verify:${verify.reason}`);

      bind = signedChainHeadBindsChain(chain, attestation);
      if (!bind.ok) blocked_by.push(`bind:${bind.reason}`);

      if (attestationExposesPrivateKeyMaterial(attestation)) {
        blocked_by.push("private_key_leaked_in_attestation");
      }

      // tamper: a chain with an altered first receipt yields a different head.
      const tamperedChain = buildNode0ProofChainLinkPayload([
        `sha256:${"f".repeat(64)}`,
        ...receiptHashes.slice(1),
      ]);
      tamper_bind = signedChainHeadBindsChain(tamperedChain, attestation);
      if (tamper_bind.ok) blocked_by.push("tamper_chain_bind_not_rejected");
    }
  }

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: NODE0_SIGNED_CHAIN_HEAD_SCHEMA,
    truth_label: NODE0_SIGNED_CHAIN_HEAD_TRUTH_LABEL,
    head_hash: chain.head_hash,
    link_count: chain.links.length,
    attestation_signed: attestation?.signed === true,
    verify_ok: verify?.ok === true,
    bind_ok: bind?.ok === true,
    tamper_chain_bind_rejected: tamper_bind?.ok === false,
    blocked_by: Object.freeze(blocked_by),
    boundary: signedChainHeadBoundary(),
  });
}
