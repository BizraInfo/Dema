import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { canonicalizeJsonV1 } from "../packages/canon/src/canonical-json-v1.js";
import { buildAdmissionContract, admissionConsentPhrase } from "../packages/genesis/src/urp0-mission-kernel.js";
import {
  admitHuman0,
  authorizeAndExecute,
  bindWorldCellSystemPlane,
  missionConsentCard,
  worldState,
} from "../scripts/genesis/urp0-runtime.mjs";
import { appendEvent, readSatEvidencePacket, satEvidencePacketPath } from "../scripts/genesis/urp0-store.mjs";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

function makeWorld() {
  const base = mkdtempSync(join(tmpdir(), "g5b-realm-"));
  const root = join(base, "dema", "genesis", "urp0");
  const source = join(base, "source");
  mkdirSync(join(source, "nested", "deeper"), { recursive: true });
  for (const [path, contents] of [
    ["readme.md", "# doc\n"],
    ["kernel.js", "export const x = 1;\n"],
    ["data.json", '{"a":1}\n'],
    ["NOTICE", "no extension\n"],
    ["nested/deeper/pixel.png", "not-really-a-png"],
  ]) writeFileSync(join(source, path), contents);
  return { base, root, source, cleanup: () => rmSync(base, { recursive: true, force: true }) };
}

function setupQualifiedMission() {
  const world = makeWorld();
  const admission = buildAdmissionContract({ human_id: "HUMAN-0", node_id: "NODE0", roles: ["ARCHITECT", "FIRST_USER"] });
  const phrase = admissionConsentPhrase({ human_id: "HUMAN-0", node_id: "NODE0", contract_hash: admission.contract_hash });
  assert.equal(admitHuman0(world.root, { phrase, now_iso: new Date().toISOString() }).ok, true);
  const card = missionConsentCard(world.root, { root: world.source, now_iso: new Date().toISOString() });
  const run = authorizeAndExecute(world.root, {
    consent_context: card.consent_context,
    phrase: card.card.required_phrase,
    now_iso: new Date().toISOString(),
  });
  assert.equal(run.ok, true, JSON.stringify(run.blocked_by));
  assert.equal(bindWorldCellSystemPlane(world.root, {
    authority_source_sha256: "a".repeat(64),
    root_bindings: [{ path: world.source, sha256: "b".repeat(64) }],
    now_iso: new Date().toISOString(),
  }).ok, true);
  return { world, run };
}

function addWorldCell(root, run) {
  const attempt_id = run.sat_evidence_packet.attempt_id;
  const payload = {
    mission_id: "NODE0-STATE-BRIEF-MISSION-1A",
    dema_mission_id: run.contract.mission_id,
    dema_capsule_sha256: "a".repeat(64),
    output_sha256: "b".repeat(64),
    observation_sha256: "c".repeat(64),
    dema_receipt_sha256: "d".repeat(64),
    pat7_evidence_sha256: "e".repeat(64),
    pat7_count: 7,
    sat5_judgment_hash: run.judgment.judgment_hash.slice("sha256:".length),
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
    urp_attempt_id: attempt_id,
    urp_receipt_sha256: run.receipt_hash.slice("sha256:".length),
  };
  const completed = appendEvent(root, "WORLD_CELL_MISSION_COMPLETED", payload);
  assert.equal(completed.ok, true, JSON.stringify(completed.blocked_by));
}

test("SAT operationality is derived from a persisted packet and five fresh verdicts", () => {
  const { world, run } = setupQualifiedMission();
  try {
    const projection = worldState(world.root);
    assert.equal(projection.sat.status, "SAT5_OPERATIONAL_URP_GENESIS");
    assert.equal(projection.sat.operational, true);
    assert.equal(projection.sat.operational_proof.state, "OPERATIONAL_VERIFIED");
    assert.deepEqual(projection.sat.inventory.map(({ role_id, status, verdict, serves_node0, judges_node0 }) => ({
      role_id, status, verdict, serves_node0, judges_node0,
    })), [
      { role_id: "SAT-1", status: "MISSION_VERIFIED", verdict: "PASS", serves_node0: false, judges_node0: true },
      { role_id: "SAT-2", status: "MISSION_VERIFIED", verdict: "PASS", serves_node0: false, judges_node0: true },
      { role_id: "SAT-3", status: "MISSION_VERIFIED", verdict: "PASS", serves_node0: false, judges_node0: true },
      { role_id: "SAT-4", status: "MISSION_VERIFIED", verdict: "PASS", serves_node0: false, judges_node0: true },
      { role_id: "SAT-5", status: "MISSION_VERIFIED", verdict: "PASS", serves_node0: false, judges_node0: true },
    ]);
    assert.equal(projection.sat.operational_proof.packet_sha256, run.sat_evidence_packet_sha256);
  } finally {
    world.cleanup();
  }
});

test("a fresh process re-derives SAT operationality from durable evidence", () => {
  const { world } = setupQualifiedMission();
  try {
    const journalBefore = readFileSync(join(world.root, "journal.ndjson"));
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
      import { worldState } from "./scripts/genesis/urp0-runtime.mjs";
      const state = worldState(process.argv[1]);
      console.log(JSON.stringify({
        status: state.sat.status,
        operational: state.sat.operational,
        verification_state: state.sat.verification_state,
        lanes: state.sat.inventory.map(({ role_id, verdict }) => ({ role_id, verdict })),
        proof_state: state.sat.operational_proof?.state,
      }));
    `, world.root], { cwd: process.cwd(), encoding: "utf8" });
    assert.equal(child.status, 0, child.stderr);
    const observed = JSON.parse(child.stdout);
    assert.deepEqual(observed, {
      status: "SAT5_OPERATIONAL_URP_GENESIS",
      operational: true,
      verification_state: "OPERATIONAL_VERIFIED",
      lanes: [
        { role_id: "SAT-1", verdict: "PASS" },
        { role_id: "SAT-2", verdict: "PASS" },
        { role_id: "SAT-3", verdict: "PASS" },
        { role_id: "SAT-4", verdict: "PASS" },
        { role_id: "SAT-5", verdict: "PASS" },
      ],
      proof_state: "OPERATIONAL_VERIFIED",
    });
    assert.deepEqual(readFileSync(join(world.root, "journal.ndjson")), journalBefore);
  } finally {
    world.cleanup();
  }
});

test("a World-Cell completion label without its packet is not SAT operationality", () => {
  const { world, run } = setupQualifiedMission();
  try {
    const ids = { mission_id: run.contract.mission_id, attempt_id: run.sat_evidence_packet.attempt_id };
    rmSync(satEvidencePacketPath(world.root, ids));
    addWorldCell(world.root, run);
    const projection = worldState(world.root);
    assert.equal(projection.sat.status, "SAT5_EVIDENCE_UNVERIFIED");
    assert.equal(projection.sat.operational, false);
    assert.ok(projection.sat.verification_blocked_by.includes("evidence_packet_missing"));
    assert.equal(projection.sat.inventory.every((lane) => lane.verdict === undefined), true);
  } finally {
    world.cleanup();
  }
});

test("a semantically tampered packet fails closed even when its JSON is canonical", () => {
  const { world, run } = setupQualifiedMission();
  try {
    const path = run.sat_evidence_packet_path;
    const packet = JSON.parse(readFileSync(path, "utf8"));
    packet.evidence.result = { ...packet.evidence.result, counts: { ...packet.evidence.result.counts, files: 999 } };
    writeFileSync(path, `${canonicalizeJsonV1(packet)}\n`);
    const projection = worldState(world.root);
    assert.equal(projection.sat.operational, false);
    assert.ok(projection.sat.verification_blocked_by.includes("semantic_commitment_not_rederivable"));
  } finally {
    world.cleanup();
  }
});

test("missing persisted judgment fails closed instead of inheriting the journal PASS", () => {
  const { world, run } = setupQualifiedMission();
  try {
    rmSync(join(world.root, "artifacts", `sat5-judgment-${run.sat_evidence_packet.attempt_id}.json`));
    const projection = worldState(world.root);
    assert.equal(projection.sat.operational, false);
    assert.ok(projection.sat.verification_blocked_by.includes("sat_judgment_artifact_missing"));
  } finally {
    world.cleanup();
  }
});

test("attempt artifacts do not overwrite prior generic evidence", () => {
  const { world, run: first } = setupQualifiedMission();
  try {
    const genericPath = join(world.root, "artifacts", "sat5-judgment.json");
    writeFileSync(genericPath, readFileSync(join(world.root, "artifacts", `sat5-judgment-${first.sat_evidence_packet.attempt_id}.json`)), { mode: 0o600 });
    const genericBefore = readFileSync(genericPath);
    const card = missionConsentCard(world.root, { root: world.source, now_iso: new Date().toISOString() });
    const second = authorizeAndExecute(world.root, {
      consent_context: card.consent_context,
      phrase: card.card.required_phrase,
      now_iso: new Date().toISOString(),
    });
    assert.equal(second.ok, true, JSON.stringify(second.blocked_by));
    const scopedPath = join(world.root, "artifacts", `sat5-judgment-${second.sat_evidence_packet.attempt_id}.json`);
    assert.notEqual(scopedPath, genericPath);
    assert.deepEqual(readFileSync(genericPath), genericBefore);
    assert.equal(JSON.parse(readFileSync(scopedPath, "utf8")).judgment_hash, second.judgment.judgment_hash);
    assert.equal(worldState(world.root).sat.operational, true);
    assert.notEqual(first.sat_evidence_packet.attempt_id, second.sat_evidence_packet.attempt_id);
  } finally {
    world.cleanup();
  }
});

test("packet readback remains attempt-scoped", () => {
  const { world, run } = setupQualifiedMission();
  try {
    const read = readSatEvidencePacket(world.root, {
      mission_id: run.contract.mission_id,
      attempt_id: "different-attempt",
    });
    assert.equal(read.ok, false);
    assert.deepEqual(read.blocked_by, ["evidence_packet_missing"]);
  } finally {
    world.cleanup();
  }
});
