// NODE0-SPINE-RUNNER-CLI-1A — one consent-gated operator path through the measured proof spine.
//
// Composes #306 execute → #307 receipt attestation → #308 proof chain → #309 signed head.
// Sandbox-contained only; signing authority ≠ execution authority.
//
// Consent: the wrapper GO phrase authorizes the full measured spine run. Inner module
// GO phrases are composed programmatically and are not user-supplied bypass paths.
// Missing or wrong wrapper consent fails closed before any mutation, signing, or chain step.

import { sha256 } from "../../consent/src/consent-common.js";
import { join } from "node:path";

import {
  planReversibleRename,
  executeReversibleRename,
  verifyExecuteReceipt,
  undoReversibleRename,
  defaultNode0ReversibleExecuteGateFixture,
  NODE0_REVERSIBLE_EXECUTE_GATE_PROBE,
  NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
} from "./node0-reversible-execute-gate.js";
import {
  signExecuteReceiptAttestation,
  verifyExecuteReceiptAttestation,
  attestationBindsExecuteReceipt,
  attestationExposesPrivateKeyMaterial as receiptAttestationExposesPrivateKey,
  NODE0_RECEIPT_SIGNING_GO_PHRASE,
} from "./node0-receipt-signing-ed25519.js";
import {
  planNode0ProofChainLink,
  buildNode0ProofChainLinkPayload,
  verifyNode0ProofChainLink,
  NODE0_PROOF_CHAIN_LINK_GO_PHRASE,
} from "./node0-proof-chain-link.js";
import {
  signChainHead,
  verifySignedChainHead,
  signedChainHeadBindsChain,
  attestationExposesPrivateKeyMaterial as chainHeadAttestationExposesPrivateKey,
  NODE0_SIGNED_CHAIN_HEAD_GO_PHRASE,
} from "./node0-signed-chain-head.js";

export const NODE0_SPINE_RUNNER_SCHEMA = "bizra.dema.node0_spine_runner.v0.1";
export const NODE0_SPINE_RUNNER_TRUTH_LABEL =
  "NODE0_MEASURED_PROOF_SPINE_SANDBOX_RUN";
export const NODE0_SPINE_RUNNER_GO_PHRASE =
  "GO: run measured proof spine in sandbox";

const EXPECTED_SPINE_CONSENT_HASH = `sha256:${sha256(NODE0_SPINE_RUNNER_GO_PHRASE)}`;

function consentDelegation() {
  return Object.freeze({
    wrapper_authorizes_full_spine: true,
    inner_phrases_composed_not_user_bypassable: true,
    inner_consent_alone_insufficient: true,
    inner_module_phrases: Object.freeze([
      NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
      NODE0_RECEIPT_SIGNING_GO_PHRASE,
      NODE0_PROOF_CHAIN_LINK_GO_PHRASE,
      NODE0_SIGNED_CHAIN_HEAD_GO_PHRASE,
    ]),
  });
}

function buildReversibilitySummary({ executeReceipt, execVerify, proveUndo, undoResult }) {
  const backupPath = executeReceipt?.backup?.path ?? null;
  return Object.freeze({
    auto_undo_performed: proveUndo === true && undoResult?.proven === true,
    undo_available: executeReceipt?.boundary?.undo_available === true,
    backup_written: executeReceipt?.boundary?.backup_written === true,
    backup_path: backupPath,
    undo_manifest_present: Boolean(executeReceipt?.undo),
    execute_receipt_verified: execVerify?.ok === true,
    sandbox_containment_verified: execVerify?.ok === true,
    undo_proof_status:
      proveUndo === true
        ? undoResult?.proven === true
          ? "proven"
          : "failed"
        : "not_run",
    note:
      "Performs the sandbox mutation and retains resulting sandbox state. Proves reversibility via receipt backup/undo manifest; does not auto-rollback unless proveUndo is enabled (review gate only).",
  });
}

function spineRunnerBoundary() {
  return Object.freeze({
    sandbox_only: true,
    operator_mutation_outside_sandbox: false,
    daemon_runtime: false,
    network_use: false,
    hidden_execution: false,
    signing_authority_not_execution: true,
    execution_authority_granted: false,
    private_key_exposed: false,
  });
}

export function planNode0SpineRunner({ consent, sandboxRoot } = {}) {
  const blocked_by = [];
  if (consent !== NODE0_SPINE_RUNNER_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  if (!sandboxRoot || typeof sandboxRoot !== "string") {
    blocked_by.push("sandbox_root_missing");
  }
  return Object.freeze({
    schema: NODE0_SPINE_RUNNER_SCHEMA,
    truth_label: NODE0_SPINE_RUNNER_TRUTH_LABEL,
    consent_ok: !blocked_by.includes("consent_phrase_mismatch"),
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
    consent_delegation: consentDelegation(),
    boundary: spineRunnerBoundary(),
  });
}

export function runNode0SpineRunner({
  fs,
  sandboxRoot,
  consent,
  fixture = defaultNode0ReversibleExecuteGateFixture(),
  now = "2026-06-28T18:00:00.000Z",
  generateKeypair,
  proveUndo = false,
} = {}) {
  const boundary = spineRunnerBoundary();
  const base = {
    schema: NODE0_SPINE_RUNNER_SCHEMA,
    truth_label: NODE0_SPINE_RUNNER_TRUTH_LABEL,
    sandbox_root: sandboxRoot ?? null,
    boundary,
  };

  const plan = planNode0SpineRunner({ consent, sandboxRoot });
  const blocked_by = [...plan.blocked_by];

  if (
    !fs ||
    typeof fs.renameSync !== "function" ||
    typeof fs.realpathSync !== "function" ||
    typeof fs.lstatSync !== "function"
  ) {
    blocked_by.push("fs_adapter_missing");
  }

  let executeReceipt = null;
  let execVerify = null;
  let undoResult = null;
  let receiptAttestation = null;
  let proofChain = null;
  let chainHeadAttestation = null;

  let signingKeys = null;
  if (blocked_by.length === 0) {
    signingKeys =
      typeof generateKeypair === "function" ? generateKeypair() : null;
    if (!signingKeys?.private_key_pem || !signingKeys?.public_key_pem) {
      blocked_by.push("signing_keypair_missing");
    }
  }

  if (blocked_by.length === 0) {
    const probePath = join(sandboxRoot, NODE0_REVERSIBLE_EXECUTE_GATE_PROBE);
    if (!fs.existsSync(probePath)) {
      fs.writeFileSync(probePath, "loop probe payload\n");
    }
  }

  if (blocked_by.length === 0) {
    const execPlan = planReversibleRename({
      sandboxRoot,
      fileName: fixture.fileName,
      newName: fixture.newName,
      goPhrase: NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
      actionType: fixture.actionType,
    });
    if (!execPlan.eligible) {
      blocked_by.push(...execPlan.blocked_by.map((c) => `execute:${c}`));
    } else {
      executeReceipt = executeReversibleRename({ plan: execPlan, fs, now });
      if (executeReceipt.executed !== true) {
        blocked_by.push(...(executeReceipt.blocked_by || []).map((c) => `execute:${c}`));
      } else {
        execVerify = verifyExecuteReceipt(executeReceipt, { fs });
        if (!execVerify.ok) {
          blocked_by.push(`execute_receipt:${execVerify.reason}`);
        } else if (proveUndo === true) {
          undoResult = undoReversibleRename({ receipt: executeReceipt, fs });
          if (!undoResult.proven) {
            blocked_by.push(`undo_not_proven:${undoResult.reason ?? "unknown"}`);
          }
        }
      }
    }
  }

  if (blocked_by.length === 0 && executeReceipt && signingKeys) {
    const keys = signingKeys;
    receiptAttestation = signExecuteReceiptAttestation({
        receipt: executeReceipt,
        consent: NODE0_RECEIPT_SIGNING_GO_PHRASE,
        privateKeyPem: keys.private_key_pem,
        publicKeyPem: keys.public_key_pem,
        publicKeyFingerprint: keys.public_key_fingerprint,
        signedAt: now,
      });
      if (receiptAttestation.signed !== true) {
        blocked_by.push(
          ...(receiptAttestation.blocked_by || []).map((c) => `receipt_sign:${c}`),
        );
      } else {
        const verifyReceipt = verifyExecuteReceiptAttestation(receiptAttestation, {
          publicKeyPem: keys.public_key_pem,
        });
        if (!verifyReceipt.ok) {
          blocked_by.push(`receipt_verify:${verifyReceipt.reason}`);
        }
        const bindReceipt = attestationBindsExecuteReceipt(
          executeReceipt,
          receiptAttestation,
        );
        if (!bindReceipt.ok) {
          blocked_by.push(`receipt_bind:${bindReceipt.reason}`);
        }
        if (receiptAttestationExposesPrivateKey(receiptAttestation)) {
          blocked_by.push("receipt_private_key_leaked");
        }
      }

      if (blocked_by.length === 0) {
        const chainPlan = planNode0ProofChainLink({
          consent: NODE0_PROOF_CHAIN_LINK_GO_PHRASE,
          receiptHashes: [executeReceipt.content_hash],
        });
        if (!chainPlan.eligible) {
          blocked_by.push(...chainPlan.blocked_by.map((c) => `chain:${c}`));
        } else {
          proofChain = buildNode0ProofChainLinkPayload([executeReceipt.content_hash]);
          if (!verifyNode0ProofChainLink(proofChain).ok) {
            blocked_by.push("chain_verify_failed");
          }
        }
      }

      if (blocked_by.length === 0 && proofChain) {
        chainHeadAttestation = signChainHead({
          chain: proofChain,
          consent: NODE0_SIGNED_CHAIN_HEAD_GO_PHRASE,
          privateKeyPem: keys.private_key_pem,
          publicKeyPem: keys.public_key_pem,
          publicKeyFingerprint: keys.public_key_fingerprint,
          signedAt: now,
        });
        if (chainHeadAttestation.signed !== true) {
          blocked_by.push(
            ...(chainHeadAttestation.blocked_by || []).map((c) => `head_sign:${c}`),
          );
        } else {
          const verifyHead = verifySignedChainHead(chainHeadAttestation, {
            publicKeyPem: keys.public_key_pem,
          });
          if (!verifyHead.ok) {
            blocked_by.push(`head_verify:${verifyHead.reason}`);
          }
          const bindHead = signedChainHeadBindsChain(proofChain, chainHeadAttestation);
          if (!bindHead.ok) {
            blocked_by.push(`head_bind:${bindHead.reason}`);
          }
          if (chainHeadAttestationExposesPrivateKey(chainHeadAttestation)) {
            blocked_by.push("head_private_key_leaked");
          }
        }
      }
  }

  return Object.freeze({
    ...base,
    ok: blocked_by.length === 0,
    consent: Object.freeze({
      go_phrase_hash: EXPECTED_SPINE_CONSENT_HASH,
      mode: "exact_spine_run",
    }),
    consent_delegation: consentDelegation(),
    reversibility: buildReversibilitySummary({
      executeReceipt,
      execVerify,
      proveUndo,
      undoResult,
    }),
    execute_content_hash: executeReceipt?.content_hash ?? null,
    execute_state_hash: executeReceipt?.state_hash ?? null,
    receipt_attestation_signed: receiptAttestation?.signed === true,
    proof_chain_head_hash: proofChain?.head_hash ?? null,
    proof_chain_link_count: proofChain?.links?.length ?? 0,
    chain_head_attestation_signed: chainHeadAttestation?.signed === true,
    blocked_by: Object.freeze(blocked_by),
    execute_receipt: executeReceipt,
    receipt_attestation: receiptAttestation,
    proof_chain: proofChain,
    chain_head_attestation: chainHeadAttestation,
  });
}
