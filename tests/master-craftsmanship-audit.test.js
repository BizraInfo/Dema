// Master Craftsmanship Audit — unit tests
//
// Verifies auditArtifact against the 10 MC invariants for two canonical subjects:
//   1. tests/node-onboarding-adr011-compliance.test.js (must be 10/10)
//   2. packages/core/src/craftsmanship-witness-preview.js (must be 10/10)
// Plus adversarial and structural tests.

import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { readFile, stat } from "node:fs/promises";

import {
  auditArtifact,
  MASTER_CRAFTSMANSHIP_AUDIT_SCHEMA,
} from "../packages/core/src/master-craftsmanship-audit.js";
import { PREVIEW_BOUNDARY_CANONICAL_KEYS } from "../packages/core/src/preview-boundary.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const COMPLIANCE_PATH = "tests/node-onboarding-adr011-compliance.test.js";
const WITNESS_PATH = "packages/core/src/craftsmanship-witness-preview.js";

// ─── MA-01: schema field ───────────────────────────────────────────────────────

test("MA-01: auditArtifact emits correct schema", async () => {
  const result = await auditArtifact({ projectRoot: REPO_ROOT });
  assert.equal(result.schema, MASTER_CRAFTSMANSHIP_AUDIT_SCHEMA);
  assert.equal(result.schema, "bizra.dema.master_craftsmanship_audit.v0.1");
});

// ─── MA-02: truth_label, mode, audit_type ─────────────────────────────────────

test("MA-02: truth_label, mode, audit_type are correct", async () => {
  const result = await auditArtifact({ projectRoot: REPO_ROOT });
  assert.equal(result.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(result.mode, "preview_only");
  assert.equal(result.audit_type, "external_artifact_witness");
});

// ─── MA-03: boundary is canonical 16-key all-false ───────────────────────────

test("MA-03: boundary is canonical 16-key all-false", async () => {
  const result = await auditArtifact({ projectRoot: REPO_ROOT });
  assert.equal(Object.keys(result.boundary).length, PREVIEW_BOUNDARY_CANONICAL_KEYS.length);
  for (const key of PREVIEW_BOUNDARY_CANONICAL_KEYS) {
    assert.equal(result.boundary[key], false, `boundary.${key} must be false`);
  }
});

// ─── MA-04: output is frozen ──────────────────────────────────────────────────

test("MA-04: auditArtifact output is frozen", async () => {
  const result = await auditArtifact({ projectRoot: REPO_ROOT });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.boundary), true);
  assert.equal(Object.isFrozen(result.invariants), true);
  assert.equal(Object.isFrozen(result.failed_invariants), true);
  assert.throws(() => {
    "use strict";
    result.schema = "tampered";
  }, "mutation of frozen result must throw");
});

// ─── MA-05: invariants array has exactly 10 entries with witness_method ───────

test("MA-05: invariants array has 10 entries each with witness_method=external_audit", async () => {
  const result = await auditArtifact({ projectRoot: REPO_ROOT });
  assert.equal(result.invariants.length, 10);
  for (const inv of result.invariants) {
    assert.equal(inv.witness_method, "external_audit");
    assert.ok("id" in inv);
    assert.ok("satisfied" in inv);
    assert.ok("evidence" in inv);
  }
});

// ─── MA-06: ADR-011 compliance suite → COMPLIANT 10/10 ───────────────────────

test("MA-06: ADR-011 compliance suite audit is COMPLIANT 10/10", async () => {
  const result = await auditArtifact({
    artifactPath: COMPLIANCE_PATH,
    projectRoot: REPO_ROOT,
  });
  const failures = result.invariants
    .filter((i) => !i.satisfied)
    .map((i) => `${i.id}: ${JSON.stringify(i.evidence)}`);
  assert.deepEqual(failures, [],
    `Expected 10/10 but these invariants failed:\n${failures.join("\n")}`);
  assert.equal(result.overall_compliant, true);
  assert.equal(result.satisfied_count, 10);
  assert.equal(result.failed_invariants.length, 0);
});

// ─── MA-07: craftsmanship-witness module → COMPLIANT 10/10 ───────────────────

test("MA-07: craftsmanship-witness module audit is COMPLIANT 10/10", async () => {
  const result = await auditArtifact({
    artifactPath: WITNESS_PATH,
    projectRoot: REPO_ROOT,
  });
  const failures = result.invariants
    .filter((i) => !i.satisfied)
    .map((i) => `${i.id}: ${JSON.stringify(i.evidence)}`);
  assert.deepEqual(failures, [],
    `Expected 10/10 but these invariants failed:\n${failures.join("\n")}`);
  assert.equal(result.overall_compliant, true);
});

// ─── MA-08: default subject is ADR-011 compliance file ───────────────────────

test("MA-08: no artifactPath defaults to ADR-011 compliance suite", async () => {
  const result = await auditArtifact({ projectRoot: REPO_ROOT });
  assert.ok(
    result.subject.path.includes("node-onboarding-adr011-compliance"),
    `Default subject must be ADR-011 compliance file, got: ${result.subject.path}`
  );
});

// ─── MA-09 ADVERSARIAL: nonexistent path → graceful error, not throw ──────────

test("MA-09 ADVERSARIAL: nonexistent artifact path → graceful error shape, no throw", async () => {
  let result;
  await assert.doesNotReject(async () => {
    result = await auditArtifact({
      artifactPath: "nonexistent/does-not-exist.js",
      projectRoot: REPO_ROOT,
    });
  }, "auditArtifact must not throw for missing file");
  assert.ok(result.subject.read_error !== null && result.subject.read_error !== undefined);
  assert.ok(
    result.subject.read_error.startsWith("read_failed"),
    `read_error must describe the failure, got: ${result.subject.read_error}`
  );
  assert.equal(result.overall_compliant, false);
  assert.equal(result.failed_invariants.length, 10, "All invariants must fail for unreadable file");
});

// ─── MA-10 ADVERSARIAL: empty file → invariants NOT satisfied ─────────────────

test("MA-10 ADVERSARIAL: empty artifact → all invariants not satisfied", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "dema-mca-"));
  const emptyPath = join(tmpDir, "empty.js");
  try {
    await writeFile(emptyPath, "");
    const result = await auditArtifact({
      artifactPath: emptyPath,
    });
    assert.equal(result.overall_compliant, false);
    assert.ok(result.failed_invariants.length > 0, "Empty file must fail at least one invariant");
    // Most/all probes fail on empty text
    assert.ok(result.satisfied_count < 10, "Not all invariants can pass for empty file");
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

// ─── MA-11 ADVERSARIAL: binary file → handled gracefully ─────────────────────

test("MA-11 ADVERSARIAL: binary file → all invariants fail with binary_file_skipped reason", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "dema-mca-"));
  const binPath = join(tmpDir, "binary.bin");
  try {
    // Write a buffer containing null bytes (binary signature)
    const buf = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE, 0x00]);
    await writeFile(binPath, buf);
    const result = await auditArtifact({ artifactPath: binPath });
    assert.equal(result.overall_compliant, false);
    const firstInvariant = result.invariants[0];
    assert.ok(
      firstInvariant.evidence.reason === "binary_file_skipped",
      `Expected binary_file_skipped, got: ${firstInvariant.evidence.reason}`
    );
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

// ─── MA-12: determinism — same file + same sha256 → same audit output ─────────

test("MA-12: deterministic — same file produces same sha256 and same verdict", async () => {
  const r1 = await auditArtifact({
    artifactPath: COMPLIANCE_PATH,
    projectRoot: REPO_ROOT,
  });
  const r2 = await auditArtifact({
    artifactPath: COMPLIANCE_PATH,
    projectRoot: REPO_ROOT,
  });
  assert.equal(r1.subject.sha256, r2.subject.sha256);
  assert.equal(r1.overall_compliant, r2.overall_compliant);
  assert.deepEqual(r1.failed_invariants, r2.failed_invariants);
});

// ─── MA-13: pure — builder does not write to disk ────────────────────────────

test("MA-13: pure — injectable fs mock confirms no writes performed", async () => {
  let writeCount = 0;
  // Mock fs that tracks writes and reads from real fs for the audit subject
  const mockFs = {
    readFile: async (path) => readFile(path),
    stat: async (path) => stat(path),
    writeFile: async () => { writeCount++; },
    mkdir: async () => { writeCount++; },
  };
  await auditArtifact({
    artifactPath: COMPLIANCE_PATH,
    projectRoot: REPO_ROOT,
    fs: mockFs,
  });
  assert.equal(writeCount, 0, "auditArtifact must not write any files");
});

// ─── MA-14: failed_invariants list is complete and matches invariants array ───

test("MA-14: failed_invariants is complete and consistent with invariants array", async () => {
  const result = await auditArtifact({
    artifactPath: "nonexistent/no.js",
    projectRoot: REPO_ROOT,
  });
  const fromArray = result.invariants.filter((i) => !i.satisfied).map((i) => i.id);
  assert.deepEqual([...result.failed_invariants].sort(), fromArray.sort());
});

// ─── MA-15: T-1..T-18 anchor parsing for ADR-011 compliance file ──────────────

test("MA-15: ADR-011 compliance file contains T-1..T-18 anchors (regression)", async () => {
  const result = await auditArtifact({
    artifactPath: COMPLIANCE_PATH,
    projectRoot: REPO_ROOT,
  });
  const { t_n_anchors } = result.audit_summary;
  // Must include T-1 through T-18
  for (let i = 1; i <= 18; i++) {
    assert.ok(
      t_n_anchors.includes(`T-${i}`),
      `audit_summary.t_n_anchors must contain T-${i}`
    );
  }
  assert.equal(t_n_anchors.length, 18, "Exactly T-1..T-18 expected");
});

// ─── MA-16: P1..P10 anchor parsing for ADR-011 compliance file ───────────────

test("MA-16: ADR-011 compliance file contains P1..P10 anchors (regression)", async () => {
  const result = await auditArtifact({
    artifactPath: COMPLIANCE_PATH,
    projectRoot: REPO_ROOT,
  });
  const { p_n_anchors } = result.audit_summary;
  for (let i = 1; i <= 10; i++) {
    assert.ok(
      p_n_anchors.includes(`P${i}`),
      `audit_summary.p_n_anchors must contain P${i}`
    );
  }
});

// ─── MA-17: schema_references ≥ 3 for compliance file (regression) ───────────

test("MA-17: ADR-011 compliance file has schema_references ≥ 3 (regression on craftsmanship)", async () => {
  const result = await auditArtifact({
    artifactPath: COMPLIANCE_PATH,
    projectRoot: REPO_ROOT,
  });
  assert.ok(
    result.audit_summary.schema_references >= 3,
    `Expected schema_references≥3, got ${result.audit_summary.schema_references}`
  );
});

// ─── MA-18: ADR cross-references include ADR-011 for compliance file ──────────

test("MA-18: ADR cross-references include ADR-011 for compliance file", async () => {
  const result = await auditArtifact({
    artifactPath: COMPLIANCE_PATH,
    projectRoot: REPO_ROOT,
  });
  assert.ok(
    result.audit_summary.adr_cross_references.includes("ADR-011"),
    `Expected ADR-011 in adr_cross_references, got: ${result.audit_summary.adr_cross_references.join(", ")}`
  );
});

// ─── MA-19: subject block has required fields ────────────────────────────────

test("MA-19: subject block has path, size_bytes, sha256, last_modified_utc", async () => {
  const result = await auditArtifact({
    artifactPath: COMPLIANCE_PATH,
    projectRoot: REPO_ROOT,
  });
  assert.ok(typeof result.subject.path === "string" && result.subject.path.length > 0);
  assert.ok(typeof result.subject.size_bytes === "number" && result.subject.size_bytes > 0);
  assert.ok(/^[0-9a-f]{64}$/.test(result.subject.sha256), "sha256 must be 64 hex chars");
  assert.ok(typeof result.subject.last_modified_utc === "string");
});
