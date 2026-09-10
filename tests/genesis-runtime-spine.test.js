// GENESIS_RUNTIME_SPINE_1A.0 — the runnable check for the URP-0 local ignition
// loop. Every test drives the REAL runtime against a REAL temporary directory:
// no fake filesystem, no stubbed verifier, no asserted booleans.

import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  URP0_EVENT_KINDS,
  URP0_HUMAN_ID,
  URP0_MISSION_ID,
  URP0_SAT_LANES,
  makeUrp0Event,
  reduceUrp0Events,
  urp0MissionConsentPhrase,
} from "../packages/genesis/src/urp0-kernel.js";
import {
  admissionConsentPhrase,
  buildAdmissionContract,
  buildMissionContract,
  classifyEntryName,
  deriveMissionResult,
  validateObservation,
} from "../packages/genesis/src/urp0-mission-kernel.js";
import {
  buildBlock0Candidate,
  judgeUrp0Mission,
  verifyBlock0Candidate,
  verifyUrp0Judgment,
} from "../packages/genesis/src/urp0-sat5.js";
import {
  buildSatEvidencePacket,
  isTypedSha256,
  packetIdentityDigest,
  verifySatEvidencePacket,
} from "../packages/genesis/src/urp0-sat-evidence.js";
import {
  admitHuman0,
  authorizeAndExecute,
  bindWorldCellSystemPlane,
  conservativeOffer,
  measurePossessed,
  missionConsentCard,
  patProposal,
  patProposalCard,
  replayFromDisk,
  sealBlock0,
  worldState,
} from "../scripts/genesis/urp0-runtime.mjs";
import {
  buildNode0IdentityProof,
  node0IdentityCommitment,
  PROVE_NODE0_IDENTITY_ACTION_TYPE,
  PROVE_NODE0_IDENTITY_CONSENT_PHRASE,
} from "../packages/genesis/src/node0-identity-proof.js";
import { buildConsentProof } from "../packages/receipts/src/consent-proof.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
  loadPublicKey,
} from "../packages/receipts/src/authorship-key-store.js";
import {
  appendEvent,
  loadEvents,
  readArtifact,
  readStableFileObject,
  resolveStateRootDir,
  statePermissions,
} from "../scripts/genesis/urp0-store.mjs";
import { loopbackOrigins, startUrp0Server } from "../scripts/genesis/urp0-server.mjs";
import { portFree, preflight } from "../scripts/genesis-node0.mjs";

// One isolated world per test: its own DEMA_HOME and its own source tree.
function makeWorld() {
  const base = mkdtempSync(join(tmpdir(), "genesis-spine-"));
  const demaHome = join(base, "dema-home");
  const source = join(base, "source");
  mkdirSync(join(source, "nested", "deeper"), { recursive: true });
  writeFileSync(join(source, "readme.md"), "# doc\n");
  writeFileSync(join(source, "kernel.js"), "export const x = 1;\n");
  writeFileSync(join(source, "data.json"), '{"a":1}\n');
  writeFileSync(join(source, "NOTICE"), "no extension\n");
  writeFileSync(join(source, "nested", "deeper", "pixel.png"), "not-really-a-png");
  const stateRootDir = join(demaHome, "genesis", "urp0");
  return { base, demaHome, source, stateRootDir, cleanup: () => rmSync(base, { recursive: true, force: true }) };
}

function admitPhrase() {
  const contract = buildAdmissionContract({ human_id: "HUMAN-0", node_id: "NODE0", roles: ["ARCHITECT", "FIRST_USER"] });
  return admissionConsentPhrase({ human_id: "HUMAN-0", node_id: "NODE0", contract_hash: contract.contract_hash });
}

test("stable artifact reads reject path races and non-regular files", () => {
  const w = makeWorld();
  try {
    const artifacts = join(w.stateRootDir, "artifacts");
    mkdirSync(artifacts, { recursive: true });
    const file = join(artifacts, "stable.json");
    writeFileSync(file, '{"ok":true}\n');

    const stable = readStableFileObject(file);
    assert.equal(stable.bytes.toString("utf8"), '{"ok":true}\n');
    assert.equal(stable.stat.isFile(), true);

    assert.equal(readArtifact(w.stateRootDir, "missing.json"), null);
    assert.throws(() => readStableFileObject(artifacts), /evidence_file_not_regular/);

    const link = join(artifacts, "link.json");
    symlinkSync(file, link);
    assert.throws(() => readStableFileObject(link), /evidence_file_symlink/);
  } finally {
    w.cleanup();
  }
});

// Drive the whole loop the way the browser does.
function runFullLoop(w, { root = w.source } = {}) {
  const admitted = admitHuman0(w.stateRootDir, { phrase: admitPhrase(), now_iso: new Date().toISOString() });
  assert.equal(admitted.ok, true, JSON.stringify(admitted.blocked_by));

  const card = missionConsentCard(w.stateRootDir, { root, now_iso: new Date().toISOString() });
  assert.equal(card.ok, true, JSON.stringify(card.blocked_by));

  const run = authorizeAndExecute(w.stateRootDir, {
    consent_context: card.consent_context,
    phrase: card.card.required_phrase,
    now_iso: new Date().toISOString(),
  });
  return { admitted, card, run };
}

test("URP-0 closes the full genesis loop and seals a Block0 local candidate", () => {
  const w = makeWorld();
  try {
    const { card, run } = runFullLoop(w);
    assert.equal(run.ok, true, JSON.stringify(run.blocked_by));

    // Five verifiers, all PASS, all re-derived.
    assert.equal(run.judgment.verifier_verdicts.length, 5);
    assert.deepEqual(run.judgment.verifier_verdicts.map((v) => v.id), URP0_SAT_LANES.map((l) => l.id));
    assert.equal(run.judgment.admissible, true, JSON.stringify(run.judgment.failing_verifiers));
    assert.equal(run.judgment.autonomous_ai_agent, false);

    // The mission actually counted the real tree.
    assert.equal(run.result.counts.files, 5);
    assert.ok(run.result.counts.directories >= 2);
    assert.equal(run.result.type_histogram.document, 1);
    assert.equal(run.result.type_histogram.code, 1);
    assert.equal(run.result.type_histogram.data, 1);
    assert.equal(run.result.type_histogram.no_extension, 1);
    assert.equal(run.result.type_histogram.image, 1);
    assert.equal(run.result.canonical_root, card.contract.canonical_root);

    // Source non-mutation, measured either side of the walk.
    assert.equal(run.source_fingerprint_before, run.source_fingerprint_after);

    // The world-state transition is real: the root moved.
    assert.notEqual(run.previous_state_root, run.resulting_state_root);

    const sealed = sealBlock0(w.stateRootDir, {
      repository_base_commit: "badb1c18e3fffae8fa26083e8e8d3bb9d96fdc1b",
      implementation_commit: "test",
      constitution_source_hash: "sha256:test",
      topology_source_hash: "sha256:test",
    });
    assert.equal(sealed.ok, true, JSON.stringify(sealed.blocked_by));
    assert.equal(sealed.block0.truth_label, "LOCAL_CANDIDATE");
    assert.equal(sealed.block0.economy.token_created, false);
    assert.equal(sealed.block0.economy.urp_treasury_balance, 0);
    assert.equal(sealed.block0.network.internet_gateway, false);
    assert.equal(verifyBlock0Candidate({ body: sealed.block0, block0_hash: sealed.block0_hash }).ok, true);
  } finally {
    w.cleanup();
  }
});

test("world state binds the governed Node0 principal from the verified disk proof", async () => {
  const w = makeWorld();
  try {
    const admitted = admitHuman0(w.stateRootDir, { phrase: admitPhrase(), now_iso: "2026-09-10T12:59:00.000Z" });
    assert.equal(admitted.ok, true, JSON.stringify(admitted.blocked_by));
    await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: w.demaHome });
    const publicKeyPem = await loadPublicKey(w.demaHome);
    const createdAtIso = "2026-09-10T13:00:00.000Z";
    const identityId = node0IdentityCommitment({ operatorPubkeyPem: publicKeyPem, createdAtIso });
    const consent = await buildConsentProof({
      phrase: PROVE_NODE0_IDENTITY_CONSENT_PHRASE,
      actionScope: { action_type: PROVE_NODE0_IDENTITY_ACTION_TYPE, target_hash: identityId },
      demaHome: w.demaHome,
      nonce: "runtime-principal-test-nonce",
      createdAtIso,
      expiresAtIso: "2026-09-10T13:05:00.000Z",
    });
    assert.equal(consent.built, true);
    const proof = await buildNode0IdentityProof({ demaHome: w.demaHome, consentProof: consent.consent_proof, createdAtIso });
    assert.equal(proof.built, true, proof.error);
    mkdirSync(join(w.stateRootDir, "artifacts"), { recursive: true });
    writeFileSync(join(w.stateRootDir, "artifacts", "node0-identity-proof.json"), `${JSON.stringify(proof.proof)}\n`);

    const state = worldState(w.stateRootDir);
    assert.equal(state.node.principal_binding.status, "BOUND");
    assert.equal(state.node.principal, proof.proof.genesis_node_id);
    assert.equal(state.node.principal_binding.identity_proof_hash, `sha256:${proof.proof.node0_identity_proof_hash}`);
    assert.equal(state.node.principal_binding.authority_delta, 0);

    writeFileSync(join(w.stateRootDir, "artifacts", "node0-identity-proof.json"), `${JSON.stringify({ ...proof.proof, genesis_node_id: "0".repeat(64) })}\n`);
    const forged = worldState(w.stateRootDir);
    assert.equal(forged.node.principal, null);
    assert.equal(forged.node.principal_binding.status, "NOT_BOUND");
  } finally {
    w.cleanup();
  }
});

test("restart reconstructs the identical state root from persisted evidence alone", () => {
  const w = makeWorld();
  try {
    const { run } = runFullLoop(w);
    assert.equal(run.ok, true, JSON.stringify(run.blocked_by));
    sealBlock0(w.stateRootDir, { repository_base_commit: "x", implementation_commit: "y", constitution_source_hash: "h", topology_source_hash: "h" });

    const live = worldState(w.stateRootDir).urp.state_root;
    // A fresh reduction over the bytes on disk — nothing carried in memory.
    const disk = replayFromDisk(w.stateRootDir);
    assert.equal(disk.ok, true, JSON.stringify(disk.blocked_by));
    assert.equal(disk.state_root, live);
    assert.equal(disk.duplicate_human_registration, false);
    assert.equal(disk.duplicate_node_registration, false);
    assert.equal(disk.duplicate_mission_admission, false);

    // Local state is 0700 / 0600, proved by stat rather than by intent.
    const perms = statePermissions(w.stateRootDir);
    assert.equal(perms[w.stateRootDir], "700");
    assert.equal(perms[join(w.stateRootDir, "journal.ndjson")], "600");
  } finally {
    w.cleanup();
  }
});

test("world-cell completion does not self-certify SAT and refuses duplicates", () => {
  const w = makeWorld();
  try {
    const { run } = runFullLoop(w);
    assert.equal(run.ok, true, JSON.stringify(run.blocked_by));
    assert.equal(bindWorldCellSystemPlane(w.stateRootDir, {
      authority_source_sha256: "a".repeat(64),
      root_bindings: [{ path: "/fixture/root", sha256: "b".repeat(64) }],
      now_iso: "2026-09-07T00:00:00Z",
    }).ok, true);
    // The completion contract uses the World-Cell mission id end to end.
    // Rebind the fixture journal's otherwise fixed URP mission id before adding
    // the completion event, preserving the kernel's hash chain.
    const reboundMissionId = "NODE0-STATE-BRIEF-MISSION-1A";
    let previousEvent = "GENESIS";
    const rebound = loadEvents(w.stateRootDir).map((event, index) => {
      const payload = ["MISSION_DECLARED", "CONSENT_REQUESTED", "MISSION_AUTHORIZED", "MISSION_EXECUTED", "SAT_JUDGMENT_RECORDED", "RECEIPT_RECORDED"].includes(event.kind)
        ? { ...event.payload, mission_id: reboundMissionId }
        : event.payload;
      const next = makeUrp0Event({ seq: index + 1, kind: event.kind, payload, prev_event: previousEvent });
      previousEvent = next.event_id;
      return next;
    });
    writeFileSync(join(w.stateRootDir, "journal.ndjson"), `${rebound.map((event) => JSON.stringify(event)).join("\n")}\n`);
    const mission = Object.values(worldState(w.stateRootDir).missions).find((m) => m.status === "RECEIPTED");
    assert.ok(mission);
    const hash = "a".repeat(64);
    const payload = {
      mission_id: "NODE0-STATE-BRIEF-MISSION-1A",
      dema_mission_id: reboundMissionId,
      dema_capsule_sha256: hash,
      output_sha256: hash,
      observation_sha256: hash,
      dema_receipt_sha256: hash,
      pat7_evidence_sha256: hash,
      pat7_count: 7,
      sat5_judgment_hash: run.judgment.judgment_hash.replace(/^sha256:/, ""),
      sat5_all_pass: true,
      effect_count: 1,
      duplicate_effects: 0,
      recovery_status: "VERIFIED_PROCESS_REPLAY",
      authority_delta: 0,
      public_gateway: false,
      federation: false,
      node1_admitted: false,
      token_minted: false,
      completed_at: new Date().toISOString(),
      urp_attempt_id: mission.attempt_id,
      urp_receipt_sha256: run.receipt_hash.replace(/^sha256:/, ""),
    };
    const completed = appendEvent(w.stateRootDir, "WORLD_CELL_MISSION_COMPLETED", payload);
    assert.equal(completed.ok, true, JSON.stringify(completed.blocked_by));
    const completedState = worldState(w.stateRootDir);
    assert.equal(completedState.world_cell.mission_id, payload.mission_id);
    assert.equal(completedState.sat.status, "SAT5_EVIDENCE_UNVERIFIED");
    assert.deepEqual(completedState.sat.verification_blocked_by, ["evidence_packet_missing"]);
    assert.deepEqual(completedState.sat.inventory.map((entry) => ({
      role_id: entry.role_id,
      verdict: entry.verdict,
      evidence_ref: entry.evidence_ref,
    })), URP0_SAT_LANES.map((lane) => ({
      role_id: lane.id,
      verdict: undefined,
      evidence_ref: undefined,
    })));
    const duplicate = appendEvent(w.stateRootDir, "WORLD_CELL_MISSION_COMPLETED", payload);
    assert.equal(duplicate.ok, false);
    assert.deepEqual(duplicate.blocked_by, ["world_cell_already_completed"]);
  } finally {
    w.cleanup();
  }
});

test("a near-match consent phrase is refused and grants no authority", () => {
  const w = makeWorld();
  try {
    admitHuman0(w.stateRootDir, { phrase: admitPhrase(), now_iso: new Date().toISOString() });
    const card = missionConsentCard(w.stateRootDir, { root: w.source, now_iso: new Date().toISOString() });

    // One trailing period. Nothing else changed.
    const run = authorizeAndExecute(w.stateRootDir, {
      consent_context: card.consent_context,
      phrase: `${card.card.required_phrase}.`,
      now_iso: new Date().toISOString(),
    });
    assert.equal(run.ok, false);
    assert.ok(run.blocked_by.includes("exact_consent_not_matched"));

    const state = worldState(w.stateRootDir);
    const attempt = Object.values(state.missions)[0];
    assert.equal(attempt.mission_id, URP0_MISSION_ID);
    assert.equal(attempt.status, "CONSENT_REQUESTED");
    assert.equal(Object.keys(state.receipts).length, 0);
    assert.equal(state.block0, null);

    // §14: the refused attempt is permanently on the record, and a FRESH attempt
    // id still lets the operator retry. One mistyped phrase must not poison the
    // mission for the life of the world.
    const retryCard = missionConsentCard(w.stateRootDir, { root: w.source, now_iso: new Date().toISOString() });
    const retry = authorizeAndExecute(w.stateRootDir, {
      consent_context: retryCard.consent_context,
      phrase: retryCard.card.required_phrase,
      now_iso: new Date().toISOString(),
    });
    assert.equal(retry.ok, true, JSON.stringify(retry.blocked_by));
    const after = worldState(w.stateRootDir);
    assert.equal(Object.keys(after.missions).length, 2);
    assert.equal(Object.values(after.missions).filter((m) => m.status === "CONSENT_REQUESTED").length, 1);
    assert.equal(Object.values(after.missions).filter((m) => m.status === "RECEIPTED").length, 1);
  } finally {
    w.cleanup();
  }
});

test("PAT proposal card and act fail closed when the Node0 principal is not bound", async () => {
  const w = makeWorld();
  try {
    admitHuman0(w.stateRootDir, { phrase: admitPhrase(), now_iso: new Date().toISOString() });
    const binding = {
      bridge_hash: "sha256:" + "a".repeat(64),
      source_intent_hash: "sha256:" + "b".repeat(64),
      compiler_identity_hash: "sha256:" + "c".repeat(64),
      compiled_contract_hash: "sha256:" + "d".repeat(64),
      context_hash: "sha256:" + "e".repeat(64),
    };
    const card = patProposalCard(w.stateRootDir, {
      mission_id: "MISSION-PAT-TEST",
      prompt: "Suggest a safe local next step.",
      proposal_binding: binding,
      now_iso: new Date().toISOString(),
    });
    assert.equal(card.ok, false);
    assert.ok(card.blocked_by.includes("node0_principal_not_bound"));
    const act = await patProposal(w.stateRootDir, {
      mission_id: "MISSION-PAT-TEST",
      prompt: "Suggest a safe local next step.",
      proposal_binding: binding,
      consent_context: null,
      phrase: "GO: invoke local LLM at qwen3:4b",
      now_iso: new Date().toISOString(),
    });
    assert.equal(act.ok, false);
    assert.ok(act.blocked_by.includes("node0_principal_not_bound"));
    assert.equal(act.authority_delta, 0);
  } finally {
    w.cleanup();
  }
});

test("PAT consent binds the bounded Node0 wisdom capsule and refuses stale reuse", async () => {
  const w = makeWorld();
  const previousWisdomPath = process.env.BIZRA_NODE0_WISDOM_PATH;
  try {
    admitHuman0(w.stateRootDir, { phrase: admitPhrase(), now_iso: "2026-09-10T13:09:00.000Z" });
    await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: w.demaHome });
    const publicKeyPem = await loadPublicKey(w.demaHome);
    const createdAtIso = "2026-09-10T13:10:00.000Z";
    const identityId = node0IdentityCommitment({ operatorPubkeyPem: publicKeyPem, createdAtIso });
    const consent = await buildConsentProof({
      phrase: PROVE_NODE0_IDENTITY_CONSENT_PHRASE,
      actionScope: { action_type: PROVE_NODE0_IDENTITY_ACTION_TYPE, target_hash: identityId },
      demaHome: w.demaHome,
      nonce: "pat-wisdom-test-nonce",
      createdAtIso,
      expiresAtIso: "2026-09-10T13:15:00.000Z",
    });
    const proof = await buildNode0IdentityProof({ demaHome: w.demaHome, consentProof: consent.consent_proof, createdAtIso });
    assert.equal(proof.built, true, proof.error);
    mkdirSync(join(w.stateRootDir, "artifacts"), { recursive: true });
    writeFileSync(join(w.stateRootDir, "artifacts", "node0-identity-proof.json"), `${JSON.stringify(proof.proof)}\n`);

    const wisdomPath = join(w.demaHome, "memory", "node0-morning-closure-wisdom.json");
    mkdirSync(join(w.demaHome, "memory"), { recursive: true });
    const boundary = Object.fromEntries([
      "raw_chat_forwarded", "private_key_read", "private_key_emitted", "public_network_used",
      "federation_used", "economic_action_performed", "authority_changed", "consent_inferred",
      "house_acceptance_performed", "model_invocation_performed", "current_runtime_claimed",
    ].map((key) => [key, false]));
    const capsule = {
      schema: "bizra.dema.node0_morning_closure_wisdom.v0.1",
      status: "LOCAL_RETRIEVAL_CANDIDATE",
      admission_status: "CANDIDATE_NOT_ADMITTED",
      share_status: "local_only",
      knowledge: [{ id: "K-TEST", title: "Bound knowledge", claim: "Use evidence.", scope: "test", do_not_infer: "This is not authority." }],
      wisdom: [{ id: "W-TEST", title: "Scoped wisdom", rule: "Keep proposals local.", counterexample: "High priority is not permission.", scope: "test", authority_effect: "NONE" }],
      human_service_instructions: ["Address HUMAN-0 as Momo."],
      boundary,
    };
    writeFileSync(wisdomPath, `${JSON.stringify(capsule)}\n`);
    process.env.BIZRA_NODE0_WISDOM_PATH = wisdomPath;

    const binding = Object.fromEntries([
      "bridge_hash", "source_intent_hash", "compiler_identity_hash", "compiled_contract_hash", "context_hash",
    ].map((key) => [key, "sha256:" + "a".repeat(64)]));
    const card = patProposalCard(w.stateRootDir, {
      mission_id: "MISSION-PAT-WISDOM-TEST",
      prompt: "Suggest a safe local next step.",
      proposal_binding: binding,
      now_iso: "2026-09-10T13:11:00.000Z",
    });
    assert.equal(card.ok, true, JSON.stringify(card.blocked_by));
    assert.equal(card.card.wisdom_context_status, "BOUND_CANDIDATE");
    assert.match(card.card.wisdom_context_hash, /^sha256:[0-9a-f]{64}$/);
    assert.match(card.card.model_prompt_hash, /^sha256:[0-9a-f]{64}$/);
    assert.equal(card.consent_context.authority_delta, 0);

    writeFileSync(wisdomPath, `${JSON.stringify({ ...capsule, wisdom: [{ ...capsule.wisdom[0], rule: "Changed after card issuance." }] })}\n`);
    const stale = await patProposal(w.stateRootDir, {
      mission_id: "MISSION-PAT-WISDOM-TEST",
      prompt: "Suggest a safe local next step.",
      proposal_binding: binding,
      consent_context: card.consent_context,
      phrase: card.card.required_phrase,
      now_iso: "2026-09-10T13:12:00.000Z",
    });
    assert.equal(stale.ok, false);
    assert.ok(stale.blocked_by.includes("pat_consent_context_mismatch"));
    assert.equal(stale.authority_delta, 0);
    assert.equal(stale.effect_started, false);
  } finally {
    if (previousWisdomPath === undefined) delete process.env.BIZRA_NODE0_WISDOM_PATH;
    else process.env.BIZRA_NODE0_WISDOM_PATH = previousWisdomPath;
    w.cleanup();
  }
});

test("a replayed consent context cannot authorize a second mission", () => {
  const w = makeWorld();
  try {
    admitHuman0(w.stateRootDir, { phrase: admitPhrase(), now_iso: new Date().toISOString() });
    const card = missionConsentCard(w.stateRootDir, { root: w.source, now_iso: new Date().toISOString() });
    const first = authorizeAndExecute(w.stateRootDir, {
      consent_context: card.consent_context,
      phrase: card.card.required_phrase,
      now_iso: new Date().toISOString(),
    });
    assert.equal(first.ok, true, JSON.stringify(first.blocked_by));

    const replayed = authorizeAndExecute(w.stateRootDir, {
      consent_context: card.consent_context,
      phrase: card.card.required_phrase,
      now_iso: new Date().toISOString(),
    });
    assert.equal(replayed.ok, false);
    assert.ok(replayed.blocked_by.includes("duplicate_mission_declaration"));
  } finally {
    w.cleanup();
  }
});

test("an expired consent context is refused at act time", () => {
  const w = makeWorld();
  try {
    admitHuman0(w.stateRootDir, { phrase: admitPhrase(), now_iso: new Date().toISOString() });
    const issued = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const card = missionConsentCard(w.stateRootDir, { root: w.source, now_iso: issued });
    const run = authorizeAndExecute(w.stateRootDir, {
      consent_context: card.consent_context,
      phrase: card.card.required_phrase,
      now_iso: new Date().toISOString(),
    });
    assert.equal(run.ok, false);
    assert.ok(run.blocked_by.includes("consent_expired"), JSON.stringify(run.blocked_by));
  } finally {
    w.cleanup();
  }
});

test("a self-issued forever window is refused", () => {
  const w = makeWorld();
  try {
    admitHuman0(w.stateRootDir, { phrase: admitPhrase(), now_iso: new Date().toISOString() });
    const card = missionConsentCard(w.stateRootDir, { root: w.source, now_iso: new Date().toISOString() });
    const stretched = { ...card.consent_context, expires_at_iso: new Date(Date.now() + 86400000).toISOString() };
    const run = authorizeAndExecute(w.stateRootDir, {
      consent_context: stretched,
      phrase: card.card.required_phrase,
      now_iso: new Date().toISOString(),
    });
    assert.equal(run.ok, false);
    assert.ok(run.blocked_by.includes("consent_window_too_wide"));
  } finally {
    w.cleanup();
  }
});

test("symlinks are counted and never followed", () => {
  const w = makeWorld();
  try {
    const outside = join(w.base, "outside");
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(outside, "secret.txt"), "must never be counted\n");
    symlinkSync(outside, join(w.source, "escape-link"));

    const { run } = runFullLoop(w);
    assert.equal(run.ok, true, JSON.stringify(run.blocked_by));
    assert.equal(run.result.counts.symlinks, 1);
    assert.equal(run.result.observed.symlinks_followed, 0);
    assert.equal(run.result.observed.entries_outside_root, 0);
    // secret.txt sits behind the link: still 5 files, so the link was not walked.
    assert.equal(run.result.counts.files, 5);
  } finally {
    w.cleanup();
  }
});

test("founder bypass is rejected by the kernel, whatever the payload claims", () => {
  const events = [];
  const e = makeUrp0Event({
    seq: 1,
    kind: "HUMAN_REGISTERED",
    prev_event: "GENESIS",
    payload: {
      human_id: URP0_HUMAN_ID,
      roles: ["ARCHITECT", "FIRST_USER"],
      founder_bypass: true,
      self_approval: false,
      sat_exemption: false,
      mint_authority: false,
      treasury_authority: false,
      unbounded_resource_authority: false,
      admission_contract_hash: "sha256:x",
      consent_receipt_hash: "sha256:y",
    },
  });
  events.push(e);
  const out = reduceUrp0Events(events);
  assert.equal(out.ok, false);
  assert.deepEqual(out.blocked_by, ["founder_bypass_claimed:founder_bypass"]);
  assert.equal(out.state, null);
});

test("a tampered event payload breaks its own chain link", () => {
  const w = makeWorld();
  try {
    const { run } = runFullLoop(w);
    assert.equal(run.ok, true, JSON.stringify(run.blocked_by));
    const events = loadEvents(w.stateRootDir);
    const forged = events.map((ev) =>
      ev.kind === "MISSION_EXECUTED"
        ? { ...ev, payload: { ...ev.payload, result_hash: `sha256:${"0".repeat(64)}` } }
        : ev,
    );
    const out = reduceUrp0Events(forged);
    assert.equal(out.ok, false);
    assert.equal(out.blocked_by[0], "event_id_mismatch");
  } finally {
    w.cleanup();
  }
});

test("a forged ADMISSIBLE judgment is rejected because verdicts are re-derived", () => {
  const w = makeWorld();
  try {
    admitHuman0(w.stateRootDir, { phrase: admitPhrase(), now_iso: new Date().toISOString() });
    const card = missionConsentCard(w.stateRootDir, { root: w.source, now_iso: new Date().toISOString() });
    const run = authorizeAndExecute(w.stateRootDir, {
      consent_context: card.consent_context,
      phrase: card.card.required_phrase,
      now_iso: new Date().toISOString(),
    });
    assert.equal(run.ok, true, JSON.stringify(run.blocked_by));

    // Evidence that genuinely fails SAT-2: the submitted phrase never matched.
    const events = loadEvents(w.stateRootDir);
    const badEvidence = {
      events,
      admission_contract: buildAdmissionContract({ human_id: "HUMAN-0", node_id: "NODE0", roles: ["ARCHITECT", "FIRST_USER"] }).body,
      sat_set: worldState(w.stateRootDir).sat.registered,
      resource_offer: worldState(w.stateRootDir).resource_offer,
      contract: run.contract,
      contract_hash: run.contract_hash,
      consent_context: card.consent_context,
      consent_context_hash: card.consent_context_hash,
      submitted_phrase: "GO: something else entirely",
      authorized_at_iso: new Date().toISOString(),
      observation: run.observation,
      result: run.result,
      receipt_body: run.receipt,
      receipt_hash: run.receipt_hash,
      previous_state_root: run.previous_state_root,
      resulting_state_root: run.resulting_state_root,
      source_fingerprint_before: run.source_fingerprint_before,
      source_fingerprint_after: run.source_fingerprint_after,
      declared_write_paths: [],
      state_root_dir: w.stateRootDir,
    };
    const honest = judgeUrp0Mission(badEvidence);
    assert.equal(honest.admissible, false);
    assert.ok(honest.failing_verifiers.includes("SAT-2"));

    // Now forge it to ADMISSIBLE and recompute the hash. Re-derivation still wins.
    const forged = {
      ...honest,
      verifier_verdicts: honest.verifier_verdicts.map((v) => ({ ...v, verdict: "PASS", reasons: [] })),
      set_verdict: "ADMISSIBLE",
      admissible: true,
      failing_verifiers: [],
    };
    const check = verifyUrp0Judgment({ evidence: badEvidence, judgment: forged });
    assert.equal(check.ok, false);
    assert.ok(check.blocked_by.includes("admissibility_not_rederivable"));
  } finally {
    w.cleanup();
  }
});

test("missing evidence refuses rather than defaulting to pass", () => {
  const judgment = judgeUrp0Mission({ events: [] });
  assert.equal(judgment.admissible, false);
  assert.equal(judgment.evidence_complete, false);
  assert.equal(judgment.verifier_verdicts.length, 5);
  assert.equal(judgment.set_verdict, "REFUSED");
});

test("the resource offer is a strict fraction of what the node possesses", () => {
  const possessed = measurePossessed();
  const allowed = conservativeOffer(possessed);
  assert.ok(allowed.cpu_threads < possessed.cpu_threads);
  assert.ok(allowed.memory_bytes < possessed.memory_bytes);
  assert.ok(allowed.cpu_threads >= 1);
  assert.ok(allowed.wall_clock_seconds > 0);
});

test("the SAT set is the constitutional five, not the obsolete council", () => {
  assert.deepEqual(URP0_SAT_LANES.map((l) => l.id), ["SAT-1", "SAT-2", "SAT-3", "SAT-4", "SAT-5"]);
  const lanes = URP0_SAT_LANES.map((l) => l.lane).join(",");
  for (const obsolete of ["Guardian", "Reasoner", "Builder", "Critic", "Archivist"]) {
    assert.ok(!lanes.includes(obsolete), `obsolete council member leaked: ${obsolete}`);
  }
  assert.equal(URP0_EVENT_KINDS.filter(kind => kind !== "SYSTEM_PLANE_BOUND").length, 12);
  assert.ok(URP0_EVENT_KINDS.includes("SYSTEM_PLANE_BOUND"));
});

test("the required phrase is bound to the root and the contract", () => {
  const a = urp0MissionConsentPhrase({ mission_id: URP0_MISSION_ID, canonical_root: "/a", contract_hash: "sha256:1" });
  const b = urp0MissionConsentPhrase({ mission_id: URP0_MISSION_ID, canonical_root: "/b", contract_hash: "sha256:1" });
  const c = urp0MissionConsentPhrase({ mission_id: URP0_MISSION_ID, canonical_root: "/a", contract_hash: "sha256:2" });
  assert.notEqual(a, b);
  assert.notEqual(a, c);
});

test("state lives under DEMA_HOME, never beside the source", () => {
  const dir = resolveStateRootDir({ DEMA_HOME: "/tmp/example-dema-home" });
  assert.equal(dir, "/tmp/example-dema-home/genesis/urp0");
});

// --- launcher: the three defects the operator's first real run exposed --------

test("preflight refuses a port that is already held, naming the port", async () => {
  const squatter = createServer();
  await new Promise((r) => squatter.listen(0, "127.0.0.1", r));
  const taken = squatter.address().port;
  try {
    assert.equal(await portFree(taken), false);

    const gaps = await preflight({ needUi: false, apiPort: taken });
    assert.equal(gaps.length, 1, JSON.stringify(gaps));
    assert.match(gaps[0], new RegExp(`^api_port_in_use:${taken}`));
    // The message has to be actionable, not just true.
    assert.match(gaps[0], /ss -tlnp/);
    assert.match(gaps[0], /GENESIS_API_PORT/);
  } finally {
    await new Promise((r) => squatter.close(r));
  }
  // Freed again once the squatter lets go.
  assert.equal(await portFree(taken), true);
});

test("preflight passes when the ports are free", async () => {
  const probe = createServer();
  await new Promise((r) => probe.listen(0, "127.0.0.1", r));
  const free = probe.address().port;
  await new Promise((r) => probe.close(r));
  assert.deepEqual(await preflight({ needUi: false, apiPort: free }), []);
});

test("CORS follows the UI port instead of hardcoding 3000", async () => {
  const w = makeWorld();
  const uiPort = 3117; // deliberately not 3000
  const { server, url } = await startUrp0Server({ stateRootDir: w.stateRootDir, port: 0, uiPort });
  try {
    const allowed = await fetch(`${url}/readyz`, { headers: { origin: `http://127.0.0.1:${uiPort}` } });
    assert.equal(allowed.headers.get("access-control-allow-origin"), `http://127.0.0.1:${uiPort}`);

    const alsoAllowed = await fetch(`${url}/readyz`, { headers: { origin: `http://localhost:${uiPort}` } });
    assert.equal(alsoAllowed.headers.get("access-control-allow-origin"), `http://localhost:${uiPort}`);

    // The old hardcoded origin is NOT blessed when the UI runs elsewhere...
    const stale = await fetch(`${url}/readyz`, { headers: { origin: "http://127.0.0.1:3000" } });
    assert.equal(stale.headers.get("access-control-allow-origin"), null);

    // ...and no origin at all is still refused a CORS header.
    const foreign = await fetch(`${url}/readyz`, { headers: { origin: "http://evil.example" } });
    assert.equal(foreign.headers.get("access-control-allow-origin"), null);
  } finally {
    await new Promise((r) => server.close(r));
    w.cleanup();
  }
});

test("loopbackOrigins covers both loopback spellings and nothing else", () => {
  assert.deepEqual(loopbackOrigins(3000), ["http://127.0.0.1:3000", "http://localhost:3000"]);
  assert.deepEqual(loopbackOrigins(3117), ["http://127.0.0.1:3117", "http://localhost:3117"]);
});

// These are deliberately direct negative controls for the governed kernels.
// The runtime tests prove the happy path; these controls prove that malformed
// evidence cannot become a green mission merely because the caller supplied it.
test("mission shape validators preserve UNKNOWN and refuse malformed evidence", () => {
  const w = makeWorld();
  try {
    const { run } = runFullLoop(w);
    assert.equal(classifyEntryName("README"), "no_extension");
    assert.equal(classifyEntryName(".env"), "no_extension");
    assert.equal(classifyEntryName("file."), "no_extension");
    assert.equal(classifyEntryName("file.unknown"), "other");

    const validBinding = Object.fromEntries([
      "bridge_hash",
      "source_intent_hash",
      "compiler_identity_hash",
      "compiled_contract_hash",
      "context_hash",
    ].map((key) => [key, "sha256:" + "a".repeat(64)]));
    assert.equal(buildMissionContract({ canonical_root: w.source, limits: run.contract.limits, proposal_binding: validBinding }).body.proposal_binding.bridge_hash, validBinding.bridge_hash);
    assert.throws(() => buildMissionContract({ canonical_root: w.source, proposal_binding: "invalid" }), /proposal_binding_invalid/);
    assert.throws(() => buildMissionContract({ canonical_root: w.source, proposal_binding: { unexpected: true } }), /proposal_binding_shape_invalid/);
    assert.throws(() => buildMissionContract({ canonical_root: w.source, proposal_binding: { ...validBinding, bridge_hash: "bad" } }), /proposal_binding_hash_invalid:bridge_hash/);

    assert.deepEqual(validateObservation(null), ["observation_not_object"]);
    const observation = run.observation;
    for (const [mutate, expected] of [
      [(o) => delete o.root_realpath, "root_realpath_missing"],
      [(o) => { o.counts = null; }, "counts_missing"],
      [(o) => { o.counts.files = -1; }, "count_invalid:files"],
      [(o) => { o.total_file_bytes = -1; }, "total_file_bytes_invalid"],
      [(o) => { o.type_histogram = null; }, "type_histogram_missing"],
      [(o) => { o.type_histogram.unexpected = 1; }, "type_category_unknown:unexpected"],
      [(o) => { o.type_histogram.document = -1; }, "type_count_invalid:document"],
      [(o) => { o.skipped_reasons = null; }, "skipped_reasons_missing"],
      [(o) => { o.skipped_reasons.unexpected = 1; }, "skip_reason_unknown:unexpected"],
      [(o) => { o.skipped_reasons.permission_denied = -1; }, "skip_count_invalid:permission_denied"],
      [(o) => { o.symlinks_followed = -1; }, "observation_invalid:symlinks_followed"],
      [(o) => { o.contents_read = true; }, "observation_must_be_false:contents_read"],
      [(o) => { o.limits_honored = "unknown"; }, "limits_honored_invalid"],
    ]) {
      const candidate = structuredClone(observation);
      mutate(candidate);
      assert.ok(validateObservation(candidate).includes(expected), expected);
    }

    const wrongContractHash = deriveMissionResult({ contract: run.contract, contract_hash: "sha256:" + "0".repeat(64), observation });
    assert.ok(wrongContractHash.blocked_by.includes("contract_hash_mismatch"));
    for (const [field, expected] of [
      ["entries_outside_root", "root_containment_violated"],
      ["symlinks_followed", "symlink_followed"],
      ["limits_honored", "limits_exceeded"],
      ["root_realpath", "root_realpath_mismatch"],
    ]) {
      const candidate = structuredClone(observation);
      candidate[field] = field === "root_realpath" ? "/other-root" : (field === "limits_honored" ? false : 1);
      const result = deriveMissionResult({ contract: run.contract, contract_hash: run.contract_hash, observation: candidate });
      assert.ok(result.blocked_by.includes(expected), expected);
    }
  } finally {
    w.cleanup();
  }
});

test("SAT evidence and judgment kernels fail closed across tamper classes", () => {
  const w = makeWorld();
  try {
    const { card, run } = runFullLoop(w);
    const packet = run.sat_evidence_packet;
    const packetInput = (overrides = {}) => ({
      mission_id: overrides.mission_id ?? packet.mission_id,
      attempt_id: overrides.attempt_id ?? packet.attempt_id,
      evidence: overrides.evidence ?? structuredClone(packet.evidence),
      judgment: overrides.judgment ?? structuredClone(packet.judgment),
      journal_binding: overrides.journal_binding ?? structuredClone(packet.journal_binding),
      effect_phase_declared_write_paths: overrides.effect_phase_declared_write_paths ?? structuredClone(packet.effects.effect_phase_declared_write_paths),
      control_plane_write_paths: overrides.control_plane_write_paths ?? structuredClone(packet.control_plane_write_paths),
    });
    const evidence = packet.evidence;
    const rebuild = (mutate) => {
      const candidate = structuredClone(evidence);
      mutate(candidate);
      return candidate;
    };
    const refuse = (mutate, lane = null) => {
      const judgment = judgeUrp0Mission(rebuild(mutate));
      assert.equal(judgment.admissible, false);
      if (lane) assert.ok(judgment.failing_verifiers.includes(lane), lane);
      return judgment;
    };

    assert.equal(isTypedSha256("sha256:" + "a".repeat(64)), true);
    assert.equal(isTypedSha256("sha256:bad"), false);
    assert.match(packetIdentityDigest({ mission_id: packet.mission_id, attempt_id: packet.attempt_id }), /^sha256:[0-9a-f]{64}$/);
    for (const input of [
      {},
      { mission_id: "m", attempt_id: "a", evidence: null, judgment: null, journal_binding: null, effect_phase_declared_write_paths: [], control_plane_write_paths: [] },
      { mission_id: "m", attempt_id: "a", evidence: {}, judgment: {}, journal_binding: {}, effect_phase_declared_write_paths: ["/outside"], control_plane_write_paths: undefined },
    ]) assert.equal(buildSatEvidencePacket(input).ok, false);

    assert.equal(verifySatEvidencePacket(null).ok, false);
    const invalidInputs = [
      ["events", (e) => { e.events = []; }, "events_malformed"],
      ["elapsed", (e) => { delete e.observation.elapsed_ms; }, "observation_elapsed_ms_missing_or_invalid"],
      ["contract", (e) => { e.contract = null; }, "contract_mission_id_mismatch"],
      ["consent", (e) => { e.consent_context = null; }, "consent_mission_id_mismatch"],
      ["receipt body", (e) => { e.receipt_body = null; }, "provisional_result_hash_missing"],
      ["write set", (e) => { e.declared_write_paths = ["/different"]; }, "effect_write_set_mismatch"],
      ["state root", (e) => { e.state_root_dir = ""; }, "state_root_dir_missing"],
      ["attempt events", (e) => { e.events = e.events.map((event) => ({ ...event, payload: { ...event.payload, attempt_id: "other" } })); }, "attempt_events_missing"],
      ["event mission", (e) => { e.events[4].payload.mission_id = "other"; }, "event_mission_id_mismatch"],
      ["judgment binding", (e) => { e.judgment_hash = "sha256:" + "0".repeat(64); }, "judgment_hash_binding_mismatch"],
    ];
    for (const [label, mutate, expected] of invalidInputs) {
      const result = buildSatEvidencePacket(packetInput({ evidence: rebuild(mutate) }));
      assert.equal(result.ok, false, label);
      assert.ok(result.blocked_by.includes(expected), label + ": " + expected);
    }

    for (const [label, mutate, expected] of [
      ["effect path", (input) => { input.effect_phase_declared_write_paths = ["/outside"]; }, "effect_write_path_outside_state_root"],
      ["control path", (input) => { input.control_plane_write_paths = ["/outside"]; }, "control_write_path_outside_state_root"],
      ["event count", (input) => { input.journal_binding.event_count = 0; }, "journal_event_count_mismatch"],
      ["event head", (input) => { input.journal_binding.head_event_id = "bad"; }, "journal_head_event_mismatch"],
      ["journal path", (input) => { input.journal_binding.path = "/outside/journal"; }, "journal_path_outside_state_root"],
      ["prefix digest", (input) => { input.journal_binding.prefix_sha256 = "bad"; }, "digest_malformed:journal_binding.prefix_sha256"],
      ["judgment digest", (input) => { input.judgment.judgment_hash = "bad"; }, "digest_malformed:judgment.judgment_hash"],
      ["empty journal", (input) => { input.journal_binding.event_count = 0; }, "journal_event_count_empty"],
      ["bad head digest", (input) => { input.evidence.events.at(-1).event_id = "bad"; input.journal_binding.head_event_id = "bad"; }, "journal_head_event_id_malformed"],
    ]) {
      const input = packetInput({ evidence: structuredClone(evidence) });
      mutate(input);
      const result = buildSatEvidencePacket(input);
      assert.equal(result.ok, false, label);
      assert.ok(result.blocked_by.includes(expected), label + ": " + expected);
    }

    assert.equal(buildSatEvidencePacket(packetInput({ evidence: rebuild((e) => { e.result = { bad: 1n }; }) })).ok, false);
    assert.equal(verifySatEvidencePacket({ ...packet, semantic_commitment: "bad" }).ok, false);
    assert.equal(verifySatEvidencePacket({ ...packet, evidence: { ...packet.evidence, result: { bad: 1n } } }).ok, false);

    refuse((e) => { e.events[0].prev_event = "wrong"; }, "SAT-1");
    refuse((e) => { e.events[0].event_id = "wrong"; }, "SAT-1");
    refuse((e) => { e.events[0].payload = { bad: 1n }; }, "SAT-1");
    refuse((e) => { e.events = e.events.filter((event) => event.kind !== "MISSION_EXECUTED"); }, "SAT-1");
    refuse((e) => { e.receipt_body.contract_hash = "bad"; }, "SAT-1");
    refuse((e) => { e.consent_context_hash = "bad"; }, "SAT-2");
    refuse((e) => { e.consent_context.canonical_root = "/other"; }, "SAT-2");
    refuse((e) => { e.consent_context.permitted_operation = "BAD"; }, "SAT-2");
    refuse((e) => { e.consent_context.nonce = ""; }, "SAT-2");
    refuse((e) => { e.authorized_at_iso = "9999-01-01T00:00:00.000Z"; }, "SAT-2");
    refuse((e) => { e.authorized_at_iso = "0000-01-01T00:00:00.000Z"; }, "SAT-2");
    refuse((e) => { e.events = e.events.filter((event) => event.kind !== "CONSENT_REQUESTED"); }, "SAT-2");
    refuse((e) => { e.result = { bad: 1n }; }, "SAT-3");
    refuse((e) => { e.result.token_price = "1"; }, "SAT-3");
    refuse((e) => { e.receipt_body.token_minted = true; }, "SAT-3");
    refuse((e) => { e.contract.type = "UNBOUNDED"; }, "SAT-3");
    refuse((e) => { e.contract.metadata_only = false; }, "SAT-3");
    refuse((e) => { e.contract.limits.max_entries = 0; }, "SAT-3");
    refuse((e) => { e.result.counts.files = 0; e.result.total_file_bytes = 1; }, "SAT-3");
    refuse((e) => { e.result.type_histogram.document += 1; }, "SAT-3");
    refuse((e) => { e.resource_offer.network = true; }, "SAT-4");
    refuse((e) => { e.contract.network = true; }, "SAT-4");
    refuse((e) => { e.observation.network_used = true; }, "SAT-4");
    refuse((e) => { e.resource_offer.unrestricted_shell = true; }, "SAT-4");
    refuse((e) => { e.resource_offer.unrestricted_filesystem = true; }, "SAT-4");
    refuse((e) => { e.observation.entries_outside_root = 1; }, "SAT-4");
    refuse((e) => { e.observation.symlinks_followed = 1; }, "SAT-4");
    refuse((e) => { e.observation.contents_read = true; }, "SAT-4");
    refuse((e) => { e.observation.contents_hashed = true; }, "SAT-4");
    refuse((e) => { e.source_fingerprint_before = ""; }, "SAT-4");
    refuse((e) => { e.source_fingerprint_after = ""; }, "SAT-4");
    refuse((e) => { e.source_fingerprint_after = "different"; }, "SAT-4");
    refuse((e) => { e.contract.limits.max_entries = undefined; }, "SAT-4");
    refuse((e) => { e.contract.limits.max_entries = 0; }, "SAT-4");
    refuse((e) => { e.contract.limits.wall_clock_seconds = undefined; }, "SAT-4");
    refuse((e) => { e.contract.limits.wall_clock_seconds = 0; e.observation.elapsed_ms = 1; }, "SAT-4");
    refuse((e) => { e.observation.limits_honored = false; }, "SAT-4");
    refuse((e) => { e.declared_write_paths = undefined; }, "SAT-4");
    refuse((e) => { e.declared_write_paths = ["/outside"]; }, "SAT-4");
    refuse((e) => { e.result.entries = ["private-path"]; }, "SAT-4");
    refuse((e) => { e.admission_contract.founder_bypass = true; }, "SAT-5");
    refuse((e) => { e.events[0].payload.founder_bypass = true; }, "SAT-5");
    refuse((e) => { e.events[0].kind = "NODE_REGISTERED"; }, "SAT-5");
    refuse((e) => { e.events.push(e.events[0]); }, "SAT-5");
    refuse((e) => { e.consent_context.nonce = ""; }, "SAT-5");
    refuse((e) => { e.events[5].kind = "MISSION_AUTHORIZED"; }, "SAT-5");
    for (const field of ["implementation", "autonomous_agents", "count", "status"]) {
      refuse((e) => { e.sat_set[field] = field === "count" ? 4 : (field === "autonomous_agents" ? true : "WRONG"); }, "SAT-5");
    }
    refuse((e) => { e.result = { bad: 1n }; }, "SAT-5");
    refuse((e) => {
      Object.assign(e.result, {
        federation_used: true,
        public_gateway_enabled: true,
        node1_admitted: true,
        network_used: true,
        autonomous_ai_agent: true,
        live_sat_agent: true,
      });
    }, "SAT-5");

    const sealed = sealBlock0(w.stateRootDir, {
      repository_base_commit: "badb1c18e3fffae8fa26083e8e8d3bb9d96fdc1b",
      implementation_commit: "test",
      constitution_source_hash: "sha256:test",
      topology_source_hash: "sha256:test",
    });
    const badBlock = structuredClone(sealed.block0);
    Object.assign(badBlock, {
      schema: "bad",
      truth_label: "MAINNET",
      sources: { ...badBlock.sources, implementation_commit: "MAINNET PUBLIC_GENESIS FINAL_NETWORK_BLOCK0" },
      economy: { ...badBlock.economy, live_mint: true, token_created: true, founder_asset_valuation: "STARTED", urp_treasury_balance: 1 },
      network: { internet_gateway: true, node1_admission: true },
      human: { ...badBlock.human, founder_bypass: true },
      sat5: { ...badBlock.sat5, admissible: false, autonomous_ai_agent: true },
      boundary: {},
    });
    const badBlockVerdict = verifyBlock0Candidate({ body: badBlock, block0_hash: sealed.block0_hash });
    assert.equal(badBlockVerdict.ok, false);
    for (const expected of [
      "block0_hash_not_rederivable", "schema_mismatch", "truth_label_not_local_candidate",
      "forbidden_label:MAINNET", "forbidden_label:PUBLIC_GENESIS", "forbidden_label:FINAL_NETWORK_BLOCK0",
      "mint_claimed", "treasury_nonzero", "founder_valuation_started", "gateway_claimed",
      "node1_claimed", "founder_bypass_claimed", "sealed_without_admissible_judgment",
      "autonomous_sat_claimed", "boundary_not_canonical_all_false",
    ]) assert.ok(badBlockVerdict.blocked_by.includes(expected), expected);
    assert.equal(verifyBlock0Candidate({ body: null, block0_hash: null }).ok, false);
    const candidate = buildBlock0Candidate({
      constitution_source_hash: "sha256:test",
      topology_source_hash: "sha256:test",
      repository_base_commit: "base",
      implementation_commit: "impl",
      human: worldState(w.stateRootDir).human,
      node: worldState(w.stateRootDir).node,
      urp_state_root: worldState(w.stateRootDir).urp.state_root,
      judgment: run.judgment,
      resource_offer_receipt_hash: "sha256:test",
      contract_hash: run.contract_hash,
      consent_receipt_hash: run.consent_receipt_hash,
      result_hash: run.result_hash,
      receipt_hash: run.receipt_hash,
      restart_replay: {
        state_root_preserved: true,
        receipt_replay_verified: true,
        duplicate_human_registration: false,
        duplicate_node_registration: false,
        duplicate_mission_admission: false,
      },
    });
    assert.equal(verifyBlock0Candidate(candidate).ok, true);
    assert.equal(verifyUrp0Judgment({ evidence, judgment: run.judgment }).ok, true);
    assert.equal(card.card.writes_performed, false);
  } finally {
    w.cleanup();
  }
});
