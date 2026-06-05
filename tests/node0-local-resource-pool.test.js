import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  NODE0_LOCAL_RESOURCE_POOL_SCHEMA,
  ARTIFACT_CATEGORIES,
  classifyResourcePath,
  scanLocalRoot,
  buildNode0LocalResourcePoolReport,
} from "../scripts/review/node0-local-resource-pool.mjs";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(
  new URL("../scripts/review/node0-local-resource-pool.mjs", import.meta.url),
);

// ── Schema shape ──────────────────────────────────────────────────────────────

test("schema constant matches expected value", () => {
  assert.equal(
    NODE0_LOCAL_RESOURCE_POOL_SCHEMA,
    "bizra.dema.node0_local_resource_pool.v0.1",
  );
});

test("ARTIFACT_CATEGORIES contains all required categories", () => {
  const required = [
    "LOCAL_ASSET",
    "LOCAL_PROOF",
    "LOCAL_REPO",
    "LOCAL_DATASET",
    "LOCAL_COMPUTE_CAPABILITY",
    "HISTORICAL_ARTIFACT",
    "MIGRATION_CANDIDATE",
    "SECRET_REFERENCE_DO_NOT_READ",
    "UNKNOWN_REQUIRES_OPERATOR_REVIEW",
  ];
  for (const cat of required) {
    assert.ok(ARTIFACT_CATEGORIES.includes(cat), `Missing category: ${cat}`);
  }
});

test("hermetic report has required schema fields", async () => {
  const report = await buildNode0LocalResourcePoolReport({
    skipScan: true,
    generatedAt: "2026-06-05T00:00:00.000Z",
  });

  assert.equal(report.schema, NODE0_LOCAL_RESOURCE_POOL_SCHEMA);
  assert.equal(report.generated_at, "2026-06-05T00:00:00.000Z");
  assert.equal(report.hermetic, true);
  assert.ok(Array.isArray(report.repos));
  assert.ok(Array.isArray(report.proof_assets));
  assert.ok(Array.isArray(report.receipt_assets));
  assert.ok(Array.isArray(report.test_surfaces));
  assert.ok(Array.isArray(report.secret_reference_paths));
  assert.ok(Array.isArray(report.migration_candidates));
  assert.ok(typeof report.artifact_categories === "object");
  assert.ok(typeof report.summary === "object");
  assert.ok(typeof report.next_recommended_gate === "object");
});

test("hermetic report boundaries are all read-only safe", async () => {
  const report = await buildNode0LocalResourcePoolReport({
    skipScan: true,
    generatedAt: "2026-06-05T00:00:00.000Z",
  });

  assert.equal(report.boundaries.read_only, true);
  assert.equal(report.boundaries.network_used, false);
  assert.equal(report.boundaries.secret_content_read, false);
  assert.equal(report.boundaries.mutation_performed, false);
  assert.equal(report.boundaries.key_generated, false);
  assert.equal(report.boundaries.signing_performed, false);
  assert.equal(report.boundaries.block0_sealed, false);
  assert.equal(report.boundaries.federation_started, false);
});

// ── Secret path classification ─────────────────────────────────────────────

test("classifyResourcePath marks secret paths as SECRET_REFERENCE_DO_NOT_READ", () => {
  assert.equal(
    classifyResourcePath("runtime/keys/node0.pem"),
    "SECRET_REFERENCE_DO_NOT_READ",
  );
  assert.equal(
    classifyResourcePath("secrets/operator.key"),
    "SECRET_REFERENCE_DO_NOT_READ",
  );
  assert.equal(
    classifyResourcePath("path/to/id_ed25519"),
    "SECRET_REFERENCE_DO_NOT_READ",
  );
  assert.equal(
    classifyResourcePath("private/key.json"),
    "SECRET_REFERENCE_DO_NOT_READ",
  );
});

test("classifyResourcePath does not flag non-secret paths", () => {
  const safe = classifyResourcePath("docs/GENESIS_STATE.md");
  assert.notEqual(safe, "SECRET_REFERENCE_DO_NOT_READ");

  const proof = classifyResourcePath(
    "proof-of-priority/receipt.json",
    "CURRENT_CANON",
  );
  assert.notEqual(proof, "SECRET_REFERENCE_DO_NOT_READ");
});

test("classifyResourcePath does not flag private-pilot or operator-review doc paths", () => {
  // private-pilot is a beta program artifact, not a private key
  assert.notEqual(
    classifyResourcePath("artifacts/proofs/node0-private-pilot-status.json"),
    "SECRET_REFERENCE_DO_NOT_READ",
  );
  // operator-review doc is documentation, not a secret file
  assert.notEqual(
    classifyResourcePath(
      "docs/08-quality/SECRET_REFERENCE_OPERATOR_REVIEW_2026_06_05.md",
    ),
    "SECRET_REFERENCE_DO_NOT_READ",
  );
});

// ── Deterministic category output ─────────────────────────────────────────

test("classifyResourcePath: proof paths → LOCAL_PROOF", () => {
  assert.equal(
    classifyResourcePath("artifacts/node0-receipt.json", "CURRENT_CANON"),
    "LOCAL_PROOF",
  );
  assert.equal(
    classifyResourcePath("docs/genesis-provenance.md", "CURRENT_CANON"),
    "LOCAL_PROOF",
  );
});

test("classifyResourcePath: archived code → MIGRATION_CANDIDATE", () => {
  assert.equal(
    classifyResourcePath("src/genesis.rs", "ARCHIVED_REFERENCE"),
    "MIGRATION_CANDIDATE",
  );
  assert.equal(
    classifyResourcePath("lib/index.js", "HISTORICAL_CANON"),
    "MIGRATION_CANDIDATE",
  );
});

test("classifyResourcePath: archived doc → HISTORICAL_ARTIFACT", () => {
  assert.equal(
    classifyResourcePath("README.md", "ARCHIVED_REFERENCE"),
    "HISTORICAL_ARTIFACT",
  );
});

test("classifyResourcePath: active code → LOCAL_COMPUTE_CAPABILITY", () => {
  assert.equal(
    classifyResourcePath("src/index.js", "CURRENT_CANON"),
    "LOCAL_COMPUTE_CAPABILITY",
  );
});

test("classifyResourcePath: data file → LOCAL_DATASET", () => {
  assert.equal(
    classifyResourcePath("data/manifest.json", "CURRENT_CANON"),
    "LOCAL_DATASET",
  );
});

// ── No network by default ─────────────────────────────────────────────────

test("hermetic report: network_used is false", async () => {
  const report = await buildNode0LocalResourcePoolReport({
    skipScan: true,
    generatedAt: "2026-06-05T00:00:00.000Z",
  });
  assert.equal(report.boundaries.network_used, false);
});

test("live report with demaRoot fixture: network_used remains false", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-pool-test-"));
  await writeFile(
    join(root, "package.json"),
    '{"name":"dema-fixture"}',
    "utf8",
  );

  const report = await buildNode0LocalResourcePoolReport({
    demaRoot: root,
    demaHome: join(root, ".dema-nonexistent"),
    generatedAt: "2026-06-05T00:00:00.000Z",
  });
  assert.equal(report.boundaries.network_used, false);
  assert.equal(report.hermetic, false);
});

// ── Missing path handled safely ───────────────────────────────────────────

test("scanLocalRoot returns empty results for non-existent root", () => {
  const result = scanLocalRoot("/tmp/__dema_nonexistent_fixture_xyz__");
  assert.equal(result.file_count, 0);
  assert.deepEqual(result.proof_assets, []);
  assert.deepEqual(result.secret_reference_paths, []);
});

test("repo with missing local root → status PATH_NOT_EXISTS or NOT_CONFIGURED, never throws", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-pool-missing-"));
  const report = await buildNode0LocalResourcePoolReport({
    demaRoot: root,
    demaHome: join(root, ".dema-no"),
    generatedAt: "2026-06-05T00:00:00.000Z",
  });
  for (const repo of report.repos) {
    assert.ok(
      ["FOUND", "PATH_NOT_EXISTS", "NOT_CONFIGURED"].includes(repo.status),
      `Unexpected status: ${repo.status}`,
    );
  }
});

// ── Secret paths in scan: classified, not read ────────────────────────────

test("scanLocalRoot: secret paths classified, not read, evidence never leaks content", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-pool-secret-"));
  await mkdir(join(root, "runtime", "keys"), { recursive: true });
  await mkdir(join(root, "docs"), { recursive: true });

  await writeFile(
    join(root, "runtime", "keys", "node.pem"),
    "SENSITIVE_CONTENT",
    "utf8",
  );
  await writeFile(
    join(root, "docs", "GENESIS_README.md"),
    "# genesis\n",
    "utf8",
  );

  const scan = scanLocalRoot(root, "CURRENT_CANON");

  assert.ok(
    scan.secret_reference_paths.some((p) => p.includes("keys")),
    "Secret key path not captured",
  );

  // No secret content in any field
  const serialized = JSON.stringify(scan);
  assert.ok(
    !serialized.includes("SENSITIVE_CONTENT"),
    "Secret content leaked into scan output",
  );
});

// ── Paths redacted in committed report ────────────────────────────────────

test("buildNode0LocalResourcePoolReport redacts absolute paths by default", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-pool-redact-"));
  const report = await buildNode0LocalResourcePoolReport({
    demaRoot: root,
    demaHome: join(root, ".dema"),
    generatedAt: "2026-06-05T00:00:00.000Z",
  });

  if (report.dema_root !== null && report.dema_root !== undefined) {
    assert.ok(
      !report.dema_root.startsWith("/home/"),
      `dema_root should be redacted, got: ${report.dema_root}`,
    );
  }
  for (const repo of report.repos) {
    if (repo.local_root !== null) {
      assert.notEqual(
        repo.local_root,
        root,
        "Absolute local_root leaked into report",
      );
    }
  }
});

// ── Hermetic fixtureOverride round-trip ───────────────────────────────────

test("hermetic fixtureOverride surfaces user-supplied fixture", async () => {
  const fixture = {
    repos: [{ name: "Dema", status: "FOUND", file_count: 42 }],
    proof_assets: [
      {
        repo: "BizraInfo/Dema",
        path: "proof/receipt.json",
        category: "LOCAL_PROOF",
      },
    ],
    receipt_assets: [],
    test_surfaces: [],
    secret_reference_paths: [],
    migration_candidates: [],
    artifact_categories: Object.fromEntries(
      [
        "LOCAL_ASSET",
        "LOCAL_PROOF",
        "LOCAL_REPO",
        "LOCAL_DATASET",
        "LOCAL_COMPUTE_CAPABILITY",
        "HISTORICAL_ARTIFACT",
        "MIGRATION_CANDIDATE",
        "SECRET_REFERENCE_DO_NOT_READ",
        "UNKNOWN_REQUIRES_OPERATOR_REVIEW",
      ].map((c) => [c, 0]),
    ),
  };
  const report = await buildNode0LocalResourcePoolReport({
    skipScan: true,
    generatedAt: "2026-06-05T00:00:00.000Z",
    fixtureOverride: fixture,
  });
  assert.equal(report.hermetic, true);
  assert.equal(report.repos.length, 1);
  assert.equal(report.proof_assets.length, 1);
  assert.equal(report.summary.proof_asset_count, 1);
});

// ── next_recommended_gate carries blocker ─────────────────────────────────

test("hermetic report: next_recommended_gate is BLOCKED_BY_UNRESOLVED_PROVENANCE", async () => {
  const report = await buildNode0LocalResourcePoolReport({
    skipScan: true,
    generatedAt: "2026-06-05T00:00:00.000Z",
  });
  assert.equal(
    report.next_recommended_gate.gate,
    "BLOCKED_BY_UNRESOLVED_PROVENANCE",
  );
});

// ── CLI emits schema-tagged JSON ──────────────────────────────────────────

test("CLI emits valid schema-tagged JSON in hermetic mode", async () => {
  const { stdout } = await execFileAsync("node", [scriptPath], {
    env: { ...process.env, NODE0_POOL_SKIP_SCAN: "1" },
    timeout: 30_000,
  });
  const report = JSON.parse(stdout);
  assert.equal(report.schema, NODE0_LOCAL_RESOURCE_POOL_SCHEMA);
  assert.equal(report.hermetic, true);
  assert.equal(report.boundaries.mutation_performed, false);
  assert.equal(report.boundaries.secret_content_read, false);
  assert.ok(typeof report.next_recommended_gate === "object");
  assert.ok(typeof report.next_recommended_gate.gate === "string");
});
