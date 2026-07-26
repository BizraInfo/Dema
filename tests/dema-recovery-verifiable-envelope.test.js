// DEMA-RECOVERY-MISSION-VERIFIABLE-ENVELOPE-1C — closes the evidence-export
// discontinuity: `dema recovery preview --proof-json` must emit the exact
// canonical builder payload already verified internally, so the serialized
// CLI artifact is independently acceptable to verifyDemaRecoveryMissionGatherer.
// ONE BUILD · ONE HASH · ONE PAYLOAD · ONE VERIFIER · TWO PRESENTATIONS.

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  verifyDemaRecoveryMissionGatherer,
  DEMA_RECOVERY_MISSION_GATHERER_GO_PHRASE,
} from "../packages/core/src/dema-recovery-mission-gatherer.js";
import {
  runDemaRecoveryMissionPreview,
  runDemaRecoveryMissionPreviewProof,
} from "../packages/core/src/dema-recovery-mission-cli-adapter.js";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const GO = DEMA_RECOVERY_MISSION_GATHERER_GO_PHRASE;

const ENVELOPE_KEYS = [
  "ok",
  "schema",
  "truth_label",
  "content_hash",
  "boundary",
  "blocked_by",
  "objective_text",
  "total_rows_in",
  "accepted_count",
  "excluded_count",
  "candidates",
  "chronology",
  "contradiction_map",
  "not_accessed_report",
];

const PAYLOAD_KEYS = [
  "schema",
  "truth_label",
  "canonicalization_algorithm",
  "hash_algorithm",
  "text_encoding",
  "objective_text",
  "source_boundary",
  "now_iso",
  "total_rows_in",
  "accepted_count",
  "excluded_count",
  "candidates",
  "chronology",
  "contradiction_map",
  "not_accessed_report",
  "content_read_allowed",
  "boundary",
  "content_hash",
];

// ── hermetic test corpus on disk (test-owned fixture, not the recovery corpus) ──
function makeCorpus() {
  const dir = mkdtempSync(join(tmpdir(), "rm-envelope-corpus-"));
  writeFileSync(join(dir, "alpha.md"), "# alpha\n");
  writeFileSync(join(dir, "beta.md"), "# beta\n");
  return dir;
}

function runCli(extraArgs, { root } = {}) {
  const corpus = root ?? makeCorpus();
  const r = spawnSync(
    process.execPath,
    [
      "bin/dema",
      "recovery",
      "preview",
      "--root",
      corpus,
      "--mission",
      "envelope slice test",
      "--consent",
      GO,
      "--max-files",
      "16",
      ...extraArgs,
    ],
    {
      cwd: REPO,
      encoding: "utf8",
      env: { ...process.env, DEMA_HOME: mkdtempSync(join(tmpdir(), "rm-envelope-home-")) },
    },
  );
  return { ...r, corpus };
}

// ── synthetic rows for kernel-level adapter tests (no fs involved) ──
const FIXTURE_ROOT = "/fixture/corpus";
const ROWS = Object.freeze([
  Object.freeze({
    root: FIXTURE_ROOT,
    relative_path: "alpha.md",
    extension: ".md",
    size_bytes: 8,
    mtime_iso: "2026-07-20T02:00:00.000Z",
  }),
  Object.freeze({
    root: FIXTURE_ROOT,
    relative_path: "beta.md",
    extension: ".md",
    size_bytes: 7,
    mtime_iso: "2026-07-20T03:00:00.000Z",
  }),
]);

function adapterProof(overrides = {}) {
  return runDemaRecoveryMissionPreviewProof({
    consent: GO,
    root: FIXTURE_ROOT,
    mission: "envelope slice test",
    exclude: [],
    maxFiles: 16,
    nowIso: "2026-07-21T00:00:00.000Z",
    gatherFiles: () => ROWS,
    ...overrides,
  });
}

function tampered(payload, mutate) {
  const copy = JSON.parse(JSON.stringify(payload));
  mutate(copy);
  return copy;
}

// ── T01 existing --json contract unchanged ──
test("T01 --json still emits the existing 14-key envelope", () => {
  const r = runCli(["--json"]);
  assert.equal(r.status, 0, r.stderr);
  const p = JSON.parse(r.stdout);
  assert.deepEqual(Object.keys(p), ENVELOPE_KEYS);
  assert.equal(p.ok, true);
  assert.equal(p.schema, "bizra.dema.recovery_mission_gatherer.v0.1");
});

// ── T02/T03/T04/T05 proof mode emits the exact verifiable payload ──
test("T02-T05 --proof-json emits the full builder payload the existing verifier accepts", () => {
  const r = runCli(["--proof-json"]);
  assert.equal(r.status, 0, r.stderr);
  const p = JSON.parse(r.stdout);
  assert.deepEqual(Object.keys(p).sort(), [...PAYLOAD_KEYS].sort());
  assert.match(p.content_hash, /^sha256:[0-9a-f]{64}$/);
  const v = verifyDemaRecoveryMissionGatherer(p);
  assert.deepEqual(v, { ok: true, blocked_by: [] });
});

// ── T06-T12 tamper matrix at the verifier contract ──
test("T06 candidate field mutation is rejected", () => {
  const { proof_payload } = adapterProof();
  const v = verifyDemaRecoveryMissionGatherer(
    tampered(proof_payload, (c) => {
      c.candidates[0].asset_id += "x";
    }),
  );
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("content_hash_mismatch"));
});

test("T06b candidate rank mutation is rejected", () => {
  const { proof_payload } = adapterProof();
  const v = verifyDemaRecoveryMissionGatherer(
    tampered(proof_payload, (c) => {
      c.candidates[0].rank = 9;
    }),
  );
  assert.equal(v.ok, false);
});

test("T07 boundary boolean mutation is rejected", () => {
  const { proof_payload } = adapterProof();
  const v = verifyDemaRecoveryMissionGatherer(
    tampered(proof_payload, (c) => {
      c.boundary.network_used = true;
    }),
  );
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("boundary_not_all_false"));
});

test("T07b content_read_allowed mutation is rejected", () => {
  const { proof_payload } = adapterProof();
  const v = verifyDemaRecoveryMissionGatherer(
    tampered(proof_payload, (c) => {
      c.content_read_allowed = true;
    }),
  );
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("content_read_allowed_true"));
});

test("T08 canonicalization_algorithm mutation is rejected", () => {
  const { proof_payload } = adapterProof();
  const v = verifyDemaRecoveryMissionGatherer(
    tampered(proof_payload, (c) => {
      c.canonicalization_algorithm = "canonical-json-v2";
    }),
  );
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("canonicalization_algorithm_mismatch"));
});

test("T09 hash_algorithm mutation is rejected", () => {
  const { proof_payload } = adapterProof();
  const v = verifyDemaRecoveryMissionGatherer(
    tampered(proof_payload, (c) => {
      c.hash_algorithm = "sha1";
    }),
  );
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("hash_algorithm_mismatch"));
});

test("T10 text_encoding mutation is rejected", () => {
  const { proof_payload } = adapterProof();
  const v = verifyDemaRecoveryMissionGatherer(
    tampered(proof_payload, (c) => {
      c.text_encoding = "latin1";
    }),
  );
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("text_encoding_mismatch"));
});

test("T11 content_hash mutation is rejected", () => {
  const { proof_payload } = adapterProof();
  const v = verifyDemaRecoveryMissionGatherer(
    tampered(proof_payload, (c) => {
      c.content_hash = "sha256:" + "0".repeat(64);
    }),
  );
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("content_hash_mismatch"));
});

test("T12 removing a required declaration field is rejected", () => {
  const { proof_payload } = adapterProof();
  const v = verifyDemaRecoveryMissionGatherer(
    tampered(proof_payload, (c) => {
      delete c.canonicalization_algorithm;
    }),
  );
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("canonicalization_algorithm_mismatch"));
});

test("T12b appended unauthorized field is rejected (hash binds the whole body)", () => {
  const { proof_payload } = adapterProof();
  const v = verifyDemaRecoveryMissionGatherer(
    tampered(proof_payload, (c) => {
      c.injected = "extra";
    }),
  );
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("content_hash_mismatch"));
});

// ── T13 one build, two presentations ──
test("T13 --json and --proof-json derive from one build: single gather, projected preview", () => {
  let calls = 0;
  const result = adapterProof({
    gatherFiles: () => {
      calls += 1;
      return ROWS;
    },
  });
  assert.equal(calls, 1, "exactly one gather/build per execution");
  assert.equal(result.preview.ok, true);
  assert.equal(result.preview.content_hash, result.proof_payload.content_hash);
  assert.deepEqual(result.preview.candidates, result.proof_payload.candidates);
  assert.deepEqual(
    result.preview.not_accessed_report,
    result.proof_payload.not_accessed_report,
  );
  const legacy = runDemaRecoveryMissionPreview({
    consent: GO,
    root: FIXTURE_ROOT,
    mission: "envelope slice test",
    exclude: [],
    maxFiles: 16,
    nowIso: "2026-07-21T00:00:00.000Z",
    gatherFiles: () => ROWS,
  });
  assert.deepEqual(Object.keys(legacy), ENVELOPE_KEYS);
  assert.equal(legacy.content_hash, result.proof_payload.content_hash);
});

// ── T14 failed internal verification emits no successful proof object ──
test("T14 kernel: wrong consent yields no proof payload and a fail-closed preview", () => {
  const r = adapterProof({ consent: "wrong phrase" });
  assert.equal(r.proof_payload, null);
  assert.equal(r.preview.ok, false);
  assert.ok(r.preview.blocked_by.length > 0);
});

test("T14b CLI: --proof-json with wrong consent exits 1 and emits nothing verifiable", () => {
  const corpus = makeCorpus();
  const r = spawnSync(
    process.execPath,
    [
      "bin/dema",
      "recovery",
      "preview",
      "--root",
      corpus,
      "--mission",
      "m",
      "--consent",
      "wrong phrase",
      "--proof-json",
    ],
    { cwd: REPO, encoding: "utf8", env: { ...process.env, DEMA_HOME: mkdtempSync(join(tmpdir(), "rm-envelope-home-")) } },
  );
  assert.equal(r.status, 1);
  const p = JSON.parse(r.stdout);
  assert.equal(p.ok, false);
  assert.equal(verifyDemaRecoveryMissionGatherer(p).ok, false);
});

// ── T15/T16 boundary law in proof mode ──
test("T15-T16 --proof-json declares metadata-only boundary and mutates nothing", () => {
  const corpus = makeCorpus();
  const before = ["alpha.md", "beta.md"].map((f) => JSON.stringify(statSync(join(corpus, f)).mtime));
  const r = runCli(["--proof-json"], { root: corpus });
  assert.equal(r.status, 0, r.stderr);
  const p = JSON.parse(r.stdout);
  assert.equal(p.content_read_allowed, false);
  assert.deepEqual(
    Object.values(p.boundary).every((v) => v === false),
    true,
  );
  const after = ["alpha.md", "beta.md"].map((f) => JSON.stringify(statSync(join(corpus, f)).mtime));
  assert.deepEqual(after, before);
});

// ── T17 flag exclusivity fails closed ──
test("T17 --json plus --proof-json fails closed", () => {
  const r = runCli(["--json", "--proof-json"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--json and --proof-json are mutually exclusive/);
});

// ── T18 human-readable mode unchanged ──
test("T18 text mode output is unchanged", () => {
  const r = runCli([]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^Dema recovery mission preview /);
  assert.match(r.stdout, /READ-ONLY preview\. No auto-selection/);
});

// ── T19 one-byte mutation of the serialized artifact is detected ──
test("T19 serialized proof artifact with one flipped byte in a hash-bound field fails", () => {
  const r = runCli(["--proof-json"]);
  assert.equal(r.status, 0, r.stderr);
  const flipped = r.stdout.replace("alpha.md", "alphA.md");
  assert.notEqual(flipped, r.stdout);
  const v = verifyDemaRecoveryMissionGatherer(JSON.parse(flipped));
  assert.equal(v.ok, false);
});

// ── T20 the serialized artifact verifies in a fresh independent process ──
test("T20 proof.json written to disk verifies in a separate verifier process", () => {
  const r = runCli(["--proof-json"]);
  assert.equal(r.status, 0, r.stderr);
  const dir = mkdtempSync(join(tmpdir(), "rm-envelope-proof-"));
  const proofPath = join(dir, "proof.json");
  writeFileSync(proofPath, r.stdout);
  const verifier = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { readFileSync } from "node:fs";
       import { verifyDemaRecoveryMissionGatherer } from ${JSON.stringify(
         new URL("../packages/core/src/dema-recovery-mission-gatherer.js", import.meta.url).href,
       )};
       const v = verifyDemaRecoveryMissionGatherer(JSON.parse(readFileSync(process.env.PROOF_PATH, "utf8")));
       console.log(JSON.stringify(v));
       process.exit(v.ok ? 0 : 1);`,
    ],
    {
      cwd: join(REPO, "tests"),
      encoding: "utf8",
      env: { ...process.env, PROOF_PATH: proofPath },
    },
  );
  assert.equal(verifier.status, 0, verifier.stdout + verifier.stderr);
  assert.deepEqual(JSON.parse(verifier.stdout.trim()), { ok: true, blocked_by: [] });
  const persisted = readFileSync(proofPath, "utf8");
  assert.equal(persisted, r.stdout);
});
