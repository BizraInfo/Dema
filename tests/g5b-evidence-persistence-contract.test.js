// G5B-1A — durable, attempt-scoped SAT evidence.
// Every state mutation below is confined to a disposable temporary world.

import assert from "node:assert/strict";
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

import { canonicalizeJsonV1 } from "../packages/canon/src/canonical-json-v1.js";
import {
  SAT_EVIDENCE_PACKET_SCHEMA,
  buildSatEvidencePacket,
  verifySatEvidencePacket,
} from "../packages/genesis/src/urp0-sat-evidence.js";
import { buildAdmissionContract, admissionConsentPhrase } from "../packages/genesis/src/urp0-mission-kernel.js";
import { verifyUrp0Judgment } from "../packages/genesis/src/urp0-sat5.js";
import {
  admitHuman0,
  authorizeAndExecute,
  missionConsentCard,
} from "../scripts/genesis/urp0-runtime.mjs";
import {
  persistSatEvidencePacket,
  readSatEvidencePacket,
  satEvidencePacketPath,
} from "../scripts/genesis/urp0-store.mjs";

function makeWorld() {
  const base = mkdtempSync(join(tmpdir(), "g5b-evidence-"));
  const source = join(base, "source");
  mkdirSync(source, { recursive: true });
  writeFileSync(join(source, "readme.md"), "# evidence\n");
  return { base, source, stateRootDir: join(base, "dema-home", "genesis", "urp0"), cleanup: () => rmSync(base, { recursive: true, force: true }) };
}

function admissionPhrase() {
  const contract = buildAdmissionContract({ human_id: "HUMAN-0", node_id: "NODE0", roles: ["ARCHITECT", "FIRST_USER"] });
  return admissionConsentPhrase({ human_id: "HUMAN-0", node_id: "NODE0", contract_hash: contract.contract_hash });
}

function runMission(world) {
  const admitted = admitHuman0(world.stateRootDir, { phrase: admissionPhrase(), now_iso: new Date().toISOString() });
  assert.equal(admitted.ok, true, JSON.stringify(admitted.blocked_by));
  const card = missionConsentCard(world.stateRootDir, { root: world.source, now_iso: new Date().toISOString() });
  assert.equal(card.ok, true, JSON.stringify(card.blocked_by));
  const run = authorizeAndExecute(world.stateRootDir, {
    consent_context: card.consent_context,
    phrase: card.card.required_phrase,
    now_iso: new Date().toISOString(),
  });
  assert.equal(run.ok, true, JSON.stringify(run.blocked_by));
  return { card, run };
}

function packetInput(packet, overrides = {}) {
  return {
    mission_id: overrides.mission_id ?? packet.mission_id,
    attempt_id: overrides.attempt_id ?? packet.attempt_id,
    evidence: overrides.evidence ?? packet.evidence,
    judgment: overrides.judgment ?? packet.judgment,
    journal_binding: overrides.journal_binding ?? packet.journal_binding,
    effect_phase_declared_write_paths:
      overrides.effect_phase_declared_write_paths ?? packet.effects.effect_phase_declared_write_paths,
    control_plane_write_paths: overrides.control_plane_write_paths ?? packet.control_plane_write_paths,
  };
}

test("the packet survives producer death and fresh-process readback", () => {
  const world = makeWorld();
  try {
    const { card, run } = runMission(world);
    const packet = run.sat_evidence_packet;
    const ids = { mission_id: packet.mission_id, attempt_id: packet.attempt_id };
    const initial = readSatEvidencePacket(world.stateRootDir, ids);
    assert.equal(initial.ok, true, JSON.stringify(initial.blocked_by));
    assert.equal(initial.packet.schema, SAT_EVIDENCE_PACKET_SCHEMA);
    assert.equal(initial.packet.evidence_contract_version, "v1");
    assert.equal(verifySatEvidencePacket(initial.packet).ok, true);
    assert.equal(verifyUrp0Judgment({
      evidence: initial.packet.evidence,
      judgment: initial.packet.judgment,
    }).ok, true);

    const packetPath = initial.path;
    assert.ok(initial.packet.control_plane_write_paths.includes(packetPath));
    assert.ok(!initial.packet.effects.effect_phase_declared_write_paths.includes(packetPath));
    assert.equal(initial.packet.journal_binding.event_count, initial.packet.evidence.events.length);
    assert.equal(initial.packet.journal_binding.head_event_id, initial.packet.evidence.events.at(-1).event_id);
    for (const value of Object.values(initial.packet.digest_bindings)) assert.match(value, /^sha256:[0-9a-f]{64}$/);
    assert.equal(initial.file_identity.mode, 0o600);
    assert.equal((lstatSync(dirname(packetPath)).mode & 0o777), 0o700);
    assert.equal(initial.packet.authority.submitted_phrase, card.card.required_phrase);

    // Remove only the disposable packet identity and let a different process
    // become the producer. The live runtime/service is never involved here.
    rmSync(dirname(packetPath), { recursive: true, force: true });
    const childScript = [
      'import { readFileSync } from "node:fs";',
      'import { persistSatEvidencePacket } from "./scripts/genesis/urp0-store.mjs";',
      'const stateRoot = process.argv[1];',
      'const result = persistSatEvidencePacket(stateRoot, JSON.parse(readFileSync(0, "utf8")));',
      'if (!result.ok) { console.error(JSON.stringify(result)); process.exitCode = 1; }',
      'else console.log(JSON.stringify({ ok: result.ok, idempotent: result.idempotent, byte_hash: result.byte_hash }));',
    ].join("\n");
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", childScript, world.stateRootDir], {
      cwd: resolve("."),
      input: JSON.stringify(packet),
      encoding: "utf8",
    });
    assert.equal(child.status, 0, child.stderr);
    assert.ok(!child.stdout.includes(card.card.required_phrase));

    const fresh = readSatEvidencePacket(world.stateRootDir, ids);
    assert.equal(fresh.ok, true, JSON.stringify(fresh.blocked_by));
    assert.equal(fresh.byte_hash, run.sat_evidence_packet_sha256);
    assert.equal(fresh.packet.semantic_commitment, packet.semantic_commitment);
  } finally {
    world.cleanup();
  }
});

test("packet persistence is write-once, idempotent for identical bytes, and conflict-safe", () => {
  const world = makeWorld();
  try {
    const { run } = runMission(world);
    const packet = run.sat_evidence_packet;
    const ids = { mission_id: packet.mission_id, attempt_id: packet.attempt_id };
    const before = readSatEvidencePacket(world.stateRootDir, ids);
    assert.equal(before.ok, true, JSON.stringify(before.blocked_by));
    const beforeStat = lstatSync(before.path, { bigint: true });

    const identical = persistSatEvidencePacket(world.stateRootDir, packet);
    assert.equal(identical.ok, true, JSON.stringify(identical.blocked_by));
    assert.equal(identical.idempotent, true);
    const afterStat = lstatSync(before.path, { bigint: true });
    assert.equal(afterStat.ino, beforeStat.ino);
    assert.equal(afterStat.mtimeNs, beforeStat.mtimeNs);

    const changed = buildSatEvidencePacket(packetInput(packet, {
      control_plane_write_paths: [before.path, join(world.stateRootDir, "control-plane-marker.json")],
    }));
    assert.equal(changed.ok, true, JSON.stringify(changed.blocked_by));
    const conflict = persistSatEvidencePacket(world.stateRootDir, changed.packet);
    assert.equal(conflict.ok, false);
    assert.deepEqual(conflict.blocked_by, ["evidence_packet_conflict"]);
  } finally {
    world.cleanup();
  }
});

test("packet validation and readback fail closed for missing, forged, raced, or unsafe evidence", () => {
  const world = makeWorld();
  try {
    const { run } = runMission(world);
    const packet = run.sat_evidence_packet;
    const base = packetInput(packet);
    const mutateEvidence = (mutate) => {
      const evidence = JSON.parse(JSON.stringify(packet.evidence));
      mutate(evidence);
      return buildSatEvidencePacket({ ...base, evidence });
    };

    for (const [label, mutate, expected] of [
      ["consent context", (e) => delete e.consent_context, "evidence_missing:consent_context"],
      ["submitted phrase", (e) => delete e.submitted_phrase, "evidence_missing:submitted_phrase"],
      ["elapsed time", (e) => delete e.observation.elapsed_ms, "observation_elapsed_ms_missing_or_invalid"],
      ["write set", (e) => delete e.declared_write_paths, "evidence_missing:declared_write_paths"],
      ["journal binding", null, "journal_binding_missing"],
    ]) {
      const result = label === "journal binding"
        ? buildSatEvidencePacket({ ...base, journal_binding: undefined })
        : mutateEvidence(mutate);
      assert.equal(result.ok, false, label);
      assert.ok(result.blocked_by.includes(expected), label + ": " + JSON.stringify(result.blocked_by));
    }

    const wrongMission = buildSatEvidencePacket(packetInput(packet, { mission_id: "OTHER-MISSION" }));
    assert.equal(wrongMission.ok, false);
    assert.ok(wrongMission.blocked_by.includes("contract_mission_id_mismatch"));
    const wrongAttempt = buildSatEvidencePacket(packetInput(packet, { attempt_id: "OTHER-ATTEMPT" }));
    assert.equal(wrongAttempt.ok, false);
    assert.ok(wrongAttempt.blocked_by.includes("attempt_events_missing"));

    const outside = buildSatEvidencePacket(packetInput(packet, {
      control_plane_write_paths: [join(world.base, "outside-control.json")],
    }));
    assert.equal(outside.ok, false);
    assert.ok(outside.blocked_by.includes("control_write_path_outside_state_root"));

    const wrongAlgorithm = mutateEvidence((e) => { e.receipt_hash = "blake3:" + "a".repeat(64); });
    assert.equal(wrongAlgorithm.ok, false);
    assert.ok(wrongAlgorithm.blocked_by.includes("digest_malformed:provisional_receipt_hash"));

    const traversalPath = satEvidencePacketPath(world.stateRootDir, {
      mission_id: "../escape",
      attempt_id: "../../attempt",
    });
    assert.ok(traversalPath.startsWith(resolve(world.stateRootDir) + "/"));
    assert.equal(traversalPath.includes("/../"), false);

    const ids = { mission_id: packet.mission_id, attempt_id: packet.attempt_id };
    const stored = readSatEvidencePacket(world.stateRootDir, ids);
    assert.equal(stored.ok, true, JSON.stringify(stored.blocked_by));
    const original = readFileSync(stored.path, "utf8");

    const forged = { ...packet, semantic_commitment: "sha256:" + "0".repeat(64) };
    writeFileSync(stored.path, canonicalizeJsonV1(forged) + "\n");
    const semanticMismatch = readSatEvidencePacket(world.stateRootDir, ids);
    assert.equal(semanticMismatch.ok, false);
    assert.ok(semanticMismatch.blocked_by.includes("semantic_commitment_not_rederivable"));
    writeFileSync(stored.path, original);

    writeFileSync(stored.path, original.slice(0, Math.floor(original.length / 2)));
    const truncated = readSatEvidencePacket(world.stateRootDir, ids);
    assert.equal(truncated.ok, false);
    writeFileSync(stored.path, original);

    const backup = stored.path + ".backup";
    const outsideFile = join(world.base, "outside.txt");
    writeFileSync(outsideFile, "private fixture\n");
    renameSync(stored.path, backup);
    symlinkSync(outsideFile, stored.path);
    const symlink = readSatEvidencePacket(world.stateRootDir, ids);
    assert.equal(symlink.ok, false);
    unlinkSync(stored.path);
    renameSync(backup, stored.path);

    chmodSync(stored.path, 0o640);
    const badPermissions = readSatEvidencePacket(world.stateRootDir, ids);
    assert.equal(badPermissions.ok, false);
    assert.ok(badPermissions.blocked_by.includes("evidence_file_not_private"));
    chmodSync(stored.path, 0o600);

    writeFileSync(stored.path, "not-json\n");
    const malformed = readSatEvidencePacket(world.stateRootDir, ids);
    assert.equal(malformed.ok, false);
    writeFileSync(stored.path, original);
    assert.equal(readSatEvidencePacket(world.stateRootDir, ids).ok, true);
  } finally {
    world.cleanup();
  }
});
