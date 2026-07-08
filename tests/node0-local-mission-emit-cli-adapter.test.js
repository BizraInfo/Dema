import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, stat, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

import {
  runMissionEmit,
  buildEphemeralCompositionRef,
  NODE0_LOCAL_MISSION_EMIT_GO_PHRASE,
  NODE0_LOCAL_MISSION_EMIT_ENVELOPE_SCHEMA,
} from "../apps/cli/src/commands/mission.js";
import {
  ARTIFACT_NAMES,
  node0LocalMissionArtifactEmissionPreviewBoundary,
} from "../packages/core/src/node0-local-mission-artifact-emission-preview.js";
import {
  runNode0MissionPilotCockpitPreview,
  NODE0_MISSION_PILOT_COCKPIT_PREVIEW_GO_PHRASE,
} from "../packages/core/src/node0-mission-pilot-cockpit-preview.js";

const GO = NODE0_LOCAL_MISSION_EMIT_GO_PHRASE;

async function scratch() {
  const base = await mkdtemp(join(process.env.TMPDIR || tmpdir(), "mission-emit-"));
  const filePath = join(base, "note.txt");
  const content = "founder note: emit the three artifacts.\nline two.\n";
  await writeFile(filePath, content, "utf8");
  const demaHome = join(base, "dema-home");
  await mkdir(demaHome, { recursive: true });
  return { base, filePath, content, demaHome };
}

function runDir(demaHome, runId) {
  return join(demaHome, "artifacts", "proofs", "node0-local-mission", runId);
}

test("fail-closed: no write without the exact consent phrase", async () => {
  const { filePath, demaHome } = await scratch();
  const out = await runMissionEmit({ file: filePath, consent: "wrong", demaHome });
  assert.equal(out.ok, true, JSON.stringify(out.emission?.blocked_by));
  assert.equal(out.wrote, false);
  assert.equal(out.write_refused_reason, "write_consent_required");
  assert.equal(out.artifact_paths_written.length, 0);
  // Nothing was written anywhere under the mission artifacts root.
  await assert.rejects(() => stat(runDir(demaHome, out.run_id)));
});

test("fail-closed: omitted consent also writes nothing", async () => {
  const { filePath, demaHome } = await scratch();
  const out = await runMissionEmit({ file: filePath, demaHome });
  assert.equal(out.wrote, false);
  await assert.rejects(() => readdir(join(demaHome, "artifacts")));
});

test("with exact consent: writes the three artifacts + one verification envelope under <DEMA_HOME>/…/<run_id>/", async () => {
  const { filePath, demaHome } = await scratch();
  const out = await runMissionEmit({ file: filePath, consent: GO, demaHome, nowIso: "2026-07-07T00:00:00.000Z" });
  assert.equal(out.ok, true, JSON.stringify(out.emission?.blocked_by));
  assert.equal(out.wrote, true);
  const dir = runDir(demaHome, out.run_id);
  const names = (await readdir(dir)).sort();
  // three preview artifacts PLUS one verification envelope (emission.json) — not "four artifacts".
  assert.deepEqual(names, ["dema_report.json", "emission.json", "receipt.json", "world_state_delta_preview.json"]);
  assert.equal(names.length, 4);
  // artifact_paths_written stays the THREE artifacts; the envelope has its own return field.
  assert.equal(out.artifact_paths_written.length, 3);
  for (const p of out.artifact_paths_written) assert.ok(p.startsWith(dir), p);
  assert.ok(out.envelope_path_written.startsWith(dir), out.envelope_path_written);
  assert.ok(out.envelope_path_written.endsWith("/emission.json"), out.envelope_path_written);
});

test("written artifacts are valid JSON and content_hash matches the kernel's", async () => {
  const { filePath, demaHome } = await scratch();
  const out = await runMissionEmit({ file: filePath, consent: GO, demaHome });
  const dir = runDir(demaHome, out.run_id);
  for (const name of ARTIFACT_NAMES) {
    const onDisk = JSON.parse(await readFile(join(dir, `${name}.json`), "utf8"));
    assert.match(onDisk.content_hash, /^sha256:[0-9a-f]{64}$/);
    assert.equal(onDisk.content_hash, out.emission.artifacts[name].content_hash);
    assert.equal(onDisk.committed_live, false);
  }
});

test("written artifacts are mode 0600", async () => {
  const { filePath, demaHome } = await scratch();
  const out = await runMissionEmit({ file: filePath, consent: GO, demaHome });
  const dir = runDir(demaHome, out.run_id);
  for (const name of ARTIFACT_NAMES) {
    const st = await stat(join(dir, `${name}.json`));
    assert.equal(st.mode & 0o777, 0o600, `${name} mode`);
  }
  // no leftover .tmp files
  const names = await readdir(dir);
  assert.ok(!names.some((n) => n.endsWith(".tmp")), names.join(","));
});

test("source file is byte-identical after the run (read-only, no mutation)", async () => {
  const { filePath, content, demaHome } = await scratch();
  const before = createHash("sha256").update(await readFile(filePath)).digest("hex");
  await runMissionEmit({ file: filePath, consent: GO, demaHome });
  const afterBuf = await readFile(filePath);
  assert.equal(await readFile(filePath, "utf8"), content);
  assert.equal(createHash("sha256").update(afterBuf).digest("hex"), before);
});

test("boundary all-false, committed_live/mint/authority invariants hold on every artifact", async () => {
  const { filePath, demaHome } = await scratch();
  const out = await runMissionEmit({ file: filePath, consent: GO, demaHome });
  const expectedBoundary = node0LocalMissionArtifactEmissionPreviewBoundary();
  assert.deepEqual(out.emission.boundary, expectedBoundary);
  assert.equal(out.emission.mint_allowed, false);
  assert.equal(out.emission.authority_delta, 0);
  const dir = runDir(demaHome, out.run_id);
  for (const name of ARTIFACT_NAMES) {
    const onDisk = JSON.parse(await readFile(join(dir, `${name}.json`), "utf8"));
    assert.deepEqual(onDisk.boundary, expectedBoundary);
    assert.equal(onDisk.committed_live, false);
  }
});

test("rejects a relative path", async () => {
  const out = await runMissionEmit({ file: "relative/note.txt", consent: GO });
  assert.equal(out.ok, false);
  assert.equal(out.error, "path_must_be_absolute");
});

test("rejects a missing file", async () => {
  const out = await runMissionEmit({ file: "/no/such/file/xyz.txt", consent: GO });
  assert.equal(out.ok, false);
  assert.equal(out.error, "file_not_found_or_unreadable");
});

test("rejects a directory path", async () => {
  const { base } = await scratch();
  const out = await runMissionEmit({ file: base, consent: GO });
  assert.equal(out.ok, false);
  assert.equal(out.error, "path_is_directory");
});

test("rejects a missing file argument", async () => {
  const out = await runMissionEmit({ file: undefined, consent: GO });
  assert.equal(out.ok, false);
  assert.equal(out.error, "missing_file_argument");
});

test("deterministic run_id and artifact hashes for the same input (fixed composition ref)", async () => {
  const { filePath, demaHome } = await scratch();
  const compositionRef = buildEphemeralCompositionRef();
  const a = await runMissionEmit({ file: filePath, consent: GO, demaHome, compositionRef, nowIso: null });
  const b = await runMissionEmit({ file: filePath, consent: GO, demaHome, compositionRef, nowIso: null });
  assert.equal(a.run_id, b.run_id);
  for (const name of ARTIFACT_NAMES) {
    assert.equal(a.emission.artifacts[name].content_hash, b.emission.artifacts[name].content_hash);
  }
});

test("writes nothing outside the run_id dir (three artifacts + one envelope inside)", async () => {
  const { filePath, demaHome } = await scratch();
  const out = await runMissionEmit({ file: filePath, consent: GO, demaHome });
  const missionRoot = join(demaHome, "artifacts", "proofs", "node0-local-mission");
  const entries = await readdir(missionRoot);
  // exactly one run_id directory, nothing else
  assert.deepEqual(entries, [out.run_id]);
  // and that dir holds exactly the four files (three artifacts + emission.json envelope)
  const names = (await readdir(join(missionRoot, out.run_id))).sort();
  assert.deepEqual(names, ["dema_report.json", "emission.json", "receipt.json", "world_state_delta_preview.json"]);
});

// ---- NODE0-LOCAL-MISSION-EMIT-CLI-ADAPTER-1A amendment: the verification ENVELOPE (emission.json) ----

test("verification envelope emission.json is written ONLY with the exact consent phrase", async () => {
  // With consent: emission.json exists.
  const withGo = await scratch();
  const okOut = await runMissionEmit({ file: withGo.filePath, consent: GO, demaHome: withGo.demaHome });
  assert.equal(okOut.wrote, true);
  assert.ok(okOut.envelope_path_written);
  await stat(okOut.envelope_path_written); // resolves = exists
  // Without consent: nothing written, no envelope path.
  const noGo = await scratch();
  const refused = await runMissionEmit({ file: noGo.filePath, consent: "wrong", demaHome: noGo.demaHome });
  assert.equal(refused.wrote, false);
  assert.equal(refused.envelope_path_written, null);
  await assert.rejects(() => readdir(join(noGo.demaHome, "artifacts")));
});

test("emission.json carries every required envelope field (three artifacts + one verification envelope framing)", async () => {
  const { filePath, demaHome } = await scratch();
  const out = await runMissionEmit({ file: filePath, consent: GO, demaHome, nowIso: null, compositionRef: buildEphemeralCompositionRef() });
  const env = JSON.parse(await readFile(out.envelope_path_written, "utf8"));

  assert.equal(env.schema, NODE0_LOCAL_MISSION_EMIT_ENVELOPE_SCHEMA);
  assert.match(env.run_id, /^[0-9a-f]{16}$/);
  assert.equal(env.run_id, out.run_id);
  assert.match(env.source_file_content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.match(env.emission_content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(env.emission_content_hash, out.emission.content_hash);
  assert.match(env.harness_content_hash, /^sha256:[0-9a-f]{64}$/);
  // per-artifact hashes for all three artifacts
  for (const name of ARTIFACT_NAMES) {
    assert.match(env.artifact_hashes[name], /^sha256:[0-9a-f]{64}$/);
    assert.equal(env.artifact_hashes[name], out.emission.artifacts[name].content_hash);
  }
  assert.equal(env.artifact_relative_paths.length, 3);
  // pulse ladder + reached station (upstream anchor projection)
  assert.ok(Array.isArray(env.pulse_ladder) && env.pulse_ladder.length > 0);
  for (const rung of env.pulse_ladder) assert.equal(typeof rung.ok, "boolean");
  assert.ok(typeof env.reached_station === "string" && env.reached_station.length > 0);
  assert.ok(Array.isArray(env.reached_stations));
  // consent + invariants
  assert.equal(env.consent_status, "operator write-consent phrase accepted");
  assert.deepEqual(env.boundary, node0LocalMissionArtifactEmissionPreviewBoundary());
  assert.equal(env.committed_live, false);
  assert.equal(env.authority_delta, 0);
  assert.equal(env.mint_allowed, false);
  assert.ok(env.what_this_proves.length > 0);
  assert.ok(env.what_this_does_not_prove.length > 0);
  // the nested, untouched, content-addressed emission (harness_result intact) — the cockpit's input.emission
  assert.ok(env.emission && typeof env.emission === "object");
  assert.equal(env.emission.content_hash, env.emission_content_hash);
  assert.ok(env.emission.harness_result && typeof env.emission.harness_result === "object");
});

test("SUFFICIENCY: disk emission.json re-verifies + renders in the cockpit kernel (unblocks the cockpit reader)", async () => {
  const { filePath, demaHome } = await scratch();
  const out = await runMissionEmit({ file: filePath, consent: GO, demaHome });
  const env = JSON.parse(await readFile(out.envelope_path_written, "utf8"));
  // The nested emission is the exact shape the cockpit kernel expects as input.emission.
  const cockpit = runNode0MissionPilotCockpitPreview({
    consent: NODE0_MISSION_PILOT_COCKPIT_PREVIEW_GO_PHRASE,
    input: { emission: env.emission },
  });
  assert.equal(cockpit.ok, true, JSON.stringify(cockpit.blocked_by));
  assert.equal(cockpit.status, "verified_preview_cockpit");
  // A rendered cockpit view including the gates panel.
  assert.ok(cockpit.cockpit_view, "cockpit_view rendered");
  assert.ok(cockpit.cockpit_view.gates, "gates panel present");
  assert.ok(Array.isArray(cockpit.cockpit_view.gates.ladder) && cockpit.cockpit_view.gates.ladder.length > 0);
  assert.equal(cockpit.cockpit_view.run_id, out.run_id);
});

test("EXCLUSION: emission.json holds no private key, no DID secret, and no raw source content", async () => {
  const { filePath, content, demaHome } = await scratch();
  const out = await runMissionEmit({ file: filePath, consent: GO, demaHome });
  const raw = await readFile(out.envelope_path_written, "utf8");
  const env = JSON.parse(raw);

  // No private-key MATERIAL (a PUBLIC key PEM is admissible; a private-key PEM is not).
  assert.equal(/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(raw), false, "private-key PEM present");
  // No field literally named private_key (the boundary flag `private_key_exposed` is a distinct, allowed name).
  assert.equal(/"private_key"\s*:/.test(raw), false, "raw private_key field present");
  assert.equal(/"privateKey"\s*:/.test(raw), false, "camel private key field present");
  // No DID secret / did: identifier.
  assert.equal(raw.includes("did:"), false, "did: identifier present");
  // No raw source body: the scratch content carries a marker string that must NOT appear (no excerpt consent).
  assert.ok(content.length > 0);
  assert.equal(raw.includes("emit the three artifacts"), false, "raw source body leaked");
  // Structured recursive scan: no admitted raw-content-bearing key holds a non-empty string.
  const RAW_KEYS = ["raw_content", "source_content", "file_content", "raw_excerpt", "excerpt", "plaintext", "file_bytes", "raw_text"];
  const hits = [];
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === "object") {
      for (const [k, val] of Object.entries(v)) {
        if (RAW_KEYS.includes(k) && typeof val === "string" && val.trim() !== "") hits.push(k);
        walk(val);
      }
    }
  };
  walk(env);
  assert.deepEqual(hits, [], `raw-content keys leaked: ${hits.join(",")}`);
  // Any private_key* key found must be a boolean boundary attestation (false), never key material.
  const badKeyMaterial = [];
  const walk2 = (v) => {
    if (Array.isArray(v)) return v.forEach(walk2);
    if (v && typeof v === "object") {
      for (const [k, val] of Object.entries(v)) {
        if (/private[_]?key/i.test(k) && typeof val === "string") badKeyMaterial.push(k);
        walk2(val);
      }
    }
  };
  walk2(env);
  assert.deepEqual(badKeyMaterial, [], `private-key material under: ${badKeyMaterial.join(",")}`);
});

test("emission.json is mode 0600, and the run dir still has no leftover .tmp files", async () => {
  const { filePath, demaHome } = await scratch();
  const out = await runMissionEmit({ file: filePath, consent: GO, demaHome });
  const st = await stat(out.envelope_path_written);
  assert.equal(st.mode & 0o777, 0o600, "emission.json mode");
  const names = await readdir(runDir(demaHome, out.run_id));
  assert.ok(!names.some((n) => n.endsWith(".tmp")), names.join(","));
});

test("envelope convenience fields bind to the source file hash and the emission hash", async () => {
  const { filePath, content, demaHome } = await scratch();
  const expectedSourceHash = `sha256:${createHash("sha256").update(content).digest("hex")}`;
  const out = await runMissionEmit({ file: filePath, consent: GO, demaHome });
  const env = JSON.parse(await readFile(out.envelope_path_written, "utf8"));
  // source_file_content_hash is the REAL sha256 of the source file bytes.
  assert.equal(env.source_file_content_hash, expectedSourceHash);
  // and it matches the hash the embedded harness recorded (no drift).
  assert.equal(
    env.source_file_content_hash,
    env.emission.harness_result.receipt_artifact_preview.file_ref.content_hash,
  );
  // emission_content_hash faithfully mirrors the nested content-addressed emission.
  assert.equal(env.emission_content_hash, env.emission.content_hash);
});
