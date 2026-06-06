// Layer 1 schema-wiring tests — proves that artifact-safety-eval's
// scanSchema() delegates structural validation to envelope-schema-validator
// against the known-schema registry, and that the eval:layer1 CLI surfaces
// validation findings in --json output.
//
// Five scenarios required by the typed-GO for this slice:
//   1. valid proof-room bundle passes schema validation
//   2. malformed proof-room bundle fails schema validation
//   3. unknown schema is reported but handled safely
//   4. artifact-safety eval output validates against its own schema
//   5. eval:layer1 CLI reports schema validation in JSON output

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { evaluateArtifactSafety } from "../packages/core/src/artifact-safety-eval.js";
import { validateAgainstRegistry } from "../packages/core/src/envelope-schema-validator.js";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(
  new URL("../scripts/artifact-safety-check.mjs", import.meta.url),
);

// Minimal-but-valid proof-room bundle satisfying every required field of
// bizra.dema.proof_room_bundle.v0.1. repo_root is a redacted placeholder so
// the deterministic path scanner does not also fire.
const VALID_PROOF_ROOM_BUNDLE = Object.freeze({
  schema: "bizra.dema.proof_room_bundle.v0.1",
  mode: "PROOF_ROOM_CORE",
  truth_label: "PUBLIC_SAFE",
  ok: true,
  generated_at: "2026-05-23T10:00:00.000Z",
  repo_root: "<repo_root:redacted>",
  gates: [],
  self_harness: {},
  proof_convergence: {
    formal: "schema-tagged gate composition",
    cryptographic: "per-gate stdout_sha256 digests",
    empirical: "subprocess exit codes and TAP counts when --full",
    economic: "no token, revenue, or PoI claims in this bundle",
  },
  // Canonical 16-key preview boundary (see packages/core/src/preview-boundary.js).
  // The proof-room-bundle.v0.1.json schema now requires every key to be present
  // and exactly `false`, matching the real on-disk public-safe bundle shape.
  boundary: {
    filesystem_write_performed: false,
    network_used: false,
    runtime_execution_performed: false,
    model_loaded: false,
    model_invocation_performed: false,
    prompt_executed: false,
    external_call_performed: false,
    raw_corpus_scan_performed: false,
    raw_data_included: false,
    tool_executed: false,
    chain_advance_performed: false,
    receipt_mint_performed: false,
    federation_invoked: false,
    node_connection_performed: false,
    public_network_used: false,
    consent_collected: false,
  },
  next_safe_action: "Optional: redacted variant ready to share",
  redacted: true,
  repo_root_basename: "Dema",
  repo_root_sha256:
    "0000000000000000000000000000000000000000000000000000000000000000",
});

test("1 · valid proof-room bundle passes schema validation", () => {
  const result = evaluateArtifactSafety(VALID_PROOF_ROOM_BUNDLE);
  const schemaFindings = result.findings.filter((f) => f.kind === "SCHEMA");
  assert.equal(
    schemaFindings.length,
    0,
    `expected no SCHEMA findings, got: ${JSON.stringify(schemaFindings)}`,
  );
  assert.equal(result.verdict, "PUBLIC_SAFE");
});

test("2 · malformed proof-room bundle yields SCHEMA_VIOLATION", () => {
  const broken = {
    schema: "bizra.dema.proof_room_bundle.v0.1",
    mode: "INVALID_MODE",
    ok: "not-a-boolean",
    repo_root: "<repo_root:redacted>",
  };
  const result = evaluateArtifactSafety(broken);
  assert.equal(result.verdict, "SCHEMA_VIOLATION");

  const schemaBlockers = result.findings.filter(
    (f) => f.kind === "SCHEMA" && f.severity === "BLOCKER",
  );
  assert.ok(
    schemaBlockers.length >= 3,
    `expected ≥3 schema blockers, got ${schemaBlockers.length}`,
  );

  const codes = schemaBlockers.map((f) => f.pattern_id);
  assert.ok(codes.some((c) => c.startsWith("schema_")));
});

test("3 · unknown schema is reported but does not block PUBLIC_SAFE", () => {
  const result = evaluateArtifactSafety({
    schema: "bizra.dema.unknown_envelope.v9.9",
    ok: true,
    payload: "some prose",
  });
  const schemaFindings = result.findings.filter((f) => f.kind === "SCHEMA");
  assert.equal(schemaFindings.length, 1);
  assert.equal(schemaFindings[0].pattern_id, "schema_unknown");
  assert.equal(schemaFindings[0].severity, "WARNING");
  assert.equal(result.verdict, "PUBLIC_SAFE");
});

test("3a · non-bizra namespace gets schema_namespace WARNING only", () => {
  const result = evaluateArtifactSafety({
    schema: "com.example.other.v1",
    ok: true,
  });
  const schemaFindings = result.findings.filter((f) => f.kind === "SCHEMA");
  assert.equal(schemaFindings.length, 1);
  assert.equal(schemaFindings[0].pattern_id, "schema_namespace");
  assert.equal(schemaFindings[0].severity, "WARNING");
  assert.equal(result.verdict, "PUBLIC_SAFE");
});

test("4 · artifact-safety eval output validates against its own schema", () => {
  const inner = evaluateArtifactSafety(VALID_PROOF_ROOM_BUNDLE);
  assert.equal(inner.schema, "bizra.dema.artifact_safety_eval.v0.1");
  const validation = validateAgainstRegistry(inner);
  assert.equal(validation.recognized, true);
  assert.equal(
    validation.ok,
    true,
    `expected artifact-safety envelope to self-validate; errors: ${JSON.stringify(
      validation.errors,
    )}`,
  );
  assert.equal(validation.truth_label, "MEASURED");
});

test("4a · self-validation also holds when verdict is SCHEMA_VIOLATION", () => {
  const inner = evaluateArtifactSafety({
    schema: "bizra.dema.proof_room_bundle.v0.1",
    mode: "INVALID_MODE",
  });
  assert.equal(inner.verdict, "SCHEMA_VIOLATION");
  const validation = validateAgainstRegistry(inner);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors));
});

test("5 · eval:layer1 CLI surfaces SCHEMA findings in --json output", async () => {
  const dir = await mkdtemp(join(tmpdir(), "artifact-safety-schema-wire-"));
  const path = join(dir, "malformed.json");
  await writeFile(
    path,
    JSON.stringify({
      schema: "bizra.dema.proof_room_bundle.v0.1",
      mode: "INVALID_MODE",
    }),
    "utf8",
  );
  await assert.rejects(
    async () => {
      await execFileAsync("node", [scriptPath, "--artifact", path, "--json"]);
    },
    (error) => {
      assert.equal(error.code, 1);
      const report = JSON.parse(error.stdout);
      assert.equal(report.verdict, "SCHEMA_VIOLATION");
      const schemaBlockers = report.findings.filter(
        (f) => f.kind === "SCHEMA" && f.severity === "BLOCKER",
      );
      assert.ok(schemaBlockers.length >= 1);
      return true;
    },
  );
});

test("5a · eval:layer1 CLI exits 0 + reports no SCHEMA findings on valid public-safe bundle", async () => {
  const dir = await mkdtemp(join(tmpdir(), "artifact-safety-schema-ok-"));
  const path = join(dir, "valid.json");
  await writeFile(path, JSON.stringify(VALID_PROOF_ROOM_BUNDLE), "utf8");
  const { stdout } = await execFileAsync("node", [
    scriptPath,
    "--artifact",
    path,
    "--json",
  ]);
  const report = JSON.parse(stdout);
  assert.equal(report.verdict, "PUBLIC_SAFE");
  const schemaFindings = report.findings.filter((f) => f.kind === "SCHEMA");
  assert.deepEqual(schemaFindings, []);
});
