import test from "node:test";
import assert from "node:assert/strict";
import * as nodeFs from "node:fs";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { generateEd25519Keypair } from "../packages/receipts/src/authorship-signature.js";
import {
  planNode0SpineRunner,
  runNode0SpineRunner,
  NODE0_SPINE_RUNNER_GO_PHRASE,
  NODE0_SPINE_RUNNER_SCHEMA,
  NODE0_SPINE_RUNNER_TRUTH_LABEL,
} from "../packages/core/src/node0-spine-runner.js";
import {
  verifyExecuteReceiptAttestation,
  attestationBindsExecuteReceipt,
} from "../packages/core/src/node0-receipt-signing-ed25519.js";
import {
  verifyNode0ProofChainLink,
} from "../packages/core/src/node0-proof-chain-link.js";
import {
  verifySignedChainHead,
  signedChainHeadBindsChain,
} from "../packages/core/src/node0-signed-chain-head.js";
import {
  NODE0_REVERSIBLE_EXECUTE_GATE_PROBE,
  NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
} from "../packages/core/src/node0-reversible-execute-gate.js";
import { runNode0SpineRunnerCheck } from "../scripts/review/node0-spine-runner-check.mjs";

const NOW = "2026-06-28T18:00:00.000Z";

function freshSandbox() {
  const root = mkdtempSync(join(tmpdir(), "node0-spine-runner-"));
  writeFileSync(join(root, NODE0_REVERSIBLE_EXECUTE_GATE_PROBE), "loop probe payload\n");
  return root;
}

test("plan refuses without the exact spine GO phrase", () => {
  const plan = planNode0SpineRunner({
    consent: "go: run measured proof spine in sandbox",
    sandboxRoot: "/tmp/sbx",
  });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan refuses missing wrapper consent", () => {
  const plan = planNode0SpineRunner({ sandboxRoot: "/tmp/sbx" });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan documents consent delegation (wrapper authorizes composed inner stages)", () => {
  const plan = planNode0SpineRunner({
    consent: NODE0_SPINE_RUNNER_GO_PHRASE,
    sandboxRoot: "/tmp/sbx",
  });
  assert.equal(plan.consent_delegation.wrapper_authorizes_full_spine, true);
  assert.equal(plan.consent_delegation.inner_consent_alone_insufficient, true);
  assert.ok(plan.consent_delegation.inner_module_phrases.includes(NODE0_REVERSIBLE_EXECUTE_GO_PHRASE));
});

test("plan is eligible with exact consent and sandbox root", () => {
  const plan = planNode0SpineRunner({
    consent: NODE0_SPINE_RUNNER_GO_PHRASE,
    sandboxRoot: "/tmp/sbx",
  });
  assert.equal(plan.eligible, true);
  assert.equal(plan.schema, NODE0_SPINE_RUNNER_SCHEMA);
  assert.equal(plan.truth_label, NODE0_SPINE_RUNNER_TRUTH_LABEL);
});

test("run blocks without fs adapter", () => {
  const result = runNode0SpineRunner({
    sandboxRoot: "/tmp/sbx",
    consent: NODE0_SPINE_RUNNER_GO_PHRASE,
  });
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.includes("fs_adapter_missing"));
});

test("wrong wrapper consent fails closed before sandbox mutation", () => {
  const root = freshSandbox();
  try {
    const result = runNode0SpineRunner({
      fs: nodeFs,
      sandboxRoot: root,
      consent: "wrong",
      now: NOW,
      generateKeypair: generateEd25519Keypair,
    });
    assert.equal(result.ok, false);
    assert.ok(result.blocked_by.includes("consent_phrase_mismatch"));
    assert.equal(nodeFs.existsSync(join(root, NODE0_REVERSIBLE_EXECUTE_GATE_PROBE)), true);
    assert.equal(result.execute_content_hash, null);
    assert.equal(result.receipt_attestation_signed, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("inner execute consent alone cannot run the spine", () => {
  const root = freshSandbox();
  try {
    const result = runNode0SpineRunner({
      fs: nodeFs,
      sandboxRoot: root,
      consent: NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
      now: NOW,
      generateKeypair: generateEd25519Keypair,
    });
    assert.equal(result.ok, false);
    assert.ok(result.blocked_by.includes("consent_phrase_mismatch"));
    assert.equal(nodeFs.existsSync(join(root, NODE0_REVERSIBLE_EXECUTE_GATE_PROBE)), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("run completes measured spine in sandbox (happy path)", () => {
  const root = freshSandbox();
  try {
    const result = runNode0SpineRunner({
      fs: nodeFs,
      sandboxRoot: root,
      consent: NODE0_SPINE_RUNNER_GO_PHRASE,
      now: NOW,
      generateKeypair: generateEd25519Keypair,
    });
    assert.equal(result.ok, true, result.blocked_by.join(", "));
    assert.match(result.execute_content_hash, /^sha256:[0-9a-f]{64}$/);
    assert.match(result.proof_chain_head_hash, /^sha256:[0-9a-f]{64}$/);
    assert.equal(result.proof_chain_link_count, 1);
    assert.equal(result.receipt_attestation_signed, true);
    assert.equal(result.chain_head_attestation_signed, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("receipt attestation verifies and binds execute receipt", () => {
  const root = freshSandbox();
  try {
    const result = runNode0SpineRunner({
      fs: nodeFs,
      sandboxRoot: root,
      consent: NODE0_SPINE_RUNNER_GO_PHRASE,
      now: NOW,
      generateKeypair: generateEd25519Keypair,
    });
    const verified = verifyExecuteReceiptAttestation(result.receipt_attestation);
    assert.equal(verified.ok, true);
    const bind = attestationBindsExecuteReceipt(
      result.execute_receipt,
      result.receipt_attestation,
    );
    assert.equal(bind.ok, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("proof chain verifies with execute receipt content_hash anchor", () => {
  const root = freshSandbox();
  try {
    const result = runNode0SpineRunner({
      fs: nodeFs,
      sandboxRoot: root,
      consent: NODE0_SPINE_RUNNER_GO_PHRASE,
      now: NOW,
      generateKeypair: generateEd25519Keypair,
    });
    assert.equal(verifyNode0ProofChainLink(result.proof_chain).ok, true);
    assert.equal(
      result.proof_chain.links[0].receipt_content_hash,
      result.execute_content_hash,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("signed chain head verifies and binds proof chain", () => {
  const root = freshSandbox();
  try {
    const result = runNode0SpineRunner({
      fs: nodeFs,
      sandboxRoot: root,
      consent: NODE0_SPINE_RUNNER_GO_PHRASE,
      now: NOW,
      generateKeypair: generateEd25519Keypair,
    });
    assert.equal(verifySignedChainHead(result.chain_head_attestation).ok, true);
    assert.equal(
      signedChainHeadBindsChain(result.proof_chain, result.chain_head_attestation).ok,
      true,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("boundary holds sandbox-only and signing≠execution", () => {
  const root = freshSandbox();
  try {
    const result = runNode0SpineRunner({
      fs: nodeFs,
      sandboxRoot: root,
      consent: NODE0_SPINE_RUNNER_GO_PHRASE,
      now: NOW,
      generateKeypair: generateEd25519Keypair,
    });
    assert.equal(result.boundary.sandbox_only, true);
    assert.equal(result.boundary.signing_authority_not_execution, true);
    assert.equal(result.boundary.execution_authority_granted, false);
    assert.equal(result.boundary.daemon_runtime, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("reversibility envelope exposes backup/undo without auto-rollback by default", () => {
  const root = freshSandbox();
  try {
    const result = runNode0SpineRunner({
      fs: nodeFs,
      sandboxRoot: root,
      consent: NODE0_SPINE_RUNNER_GO_PHRASE,
      now: NOW,
      generateKeypair: generateEd25519Keypair,
    });
    assert.equal(result.ok, true);
    assert.equal(result.reversibility.auto_undo_performed, false);
    assert.equal(result.reversibility.undo_proof_status, "not_run");
    assert.equal(result.reversibility.undo_available, true);
    assert.equal(result.reversibility.backup_written, true);
    assert.equal(result.reversibility.undo_manifest_present, true);
    assert.equal(result.reversibility.execute_receipt_verified, true);
    assert.ok(result.reversibility.backup_path);
    assert.match(result.reversibility.note, /does not auto-rollback/i);
    assert.equal(nodeFs.existsSync(join(root, "node0-governed-action-candidate.txt")), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("review gate proves undo when proveUndo is enabled", () => {
  const gate = runNode0SpineRunnerCheck();
  assert.equal(gate.ok, true, gate.blocked_by?.join(", "));
  assert.equal(gate.reversibility.undo_proof_status, "proven");
  assert.equal(gate.reversibility.auto_undo_performed, true);
});

test("consent hash is recorded on successful run", () => {
  const root = freshSandbox();
  try {
    const result = runNode0SpineRunner({
      fs: nodeFs,
      sandboxRoot: root,
      consent: NODE0_SPINE_RUNNER_GO_PHRASE,
      now: NOW,
      generateKeypair: generateEd25519Keypair,
    });
    assert.equal(result.consent.mode, "exact_spine_run");
    assert.match(result.consent.go_phrase_hash, /^sha256:[0-9a-f]{64}$/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("run leaves renamed file inside sandbox after execute", () => {
  const root = freshSandbox();
  try {
    const result = runNode0SpineRunner({
      fs: nodeFs,
      sandboxRoot: root,
      consent: NODE0_SPINE_RUNNER_GO_PHRASE,
      now: NOW,
      generateKeypair: generateEd25519Keypair,
    });
    assert.equal(result.ok, true);
    assert.equal(nodeFs.existsSync(join(root, "node0-governed-action-candidate.txt")), true);
    assert.equal(nodeFs.existsSync(join(root, NODE0_REVERSIBLE_EXECUTE_GATE_PROBE)), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
