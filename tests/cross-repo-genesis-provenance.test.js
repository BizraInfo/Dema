import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  CROSS_REPO_GENESIS_PROVENANCE_SCHEMA,
  REPO_CATALOG,
  classifyArtifact,
  dedupeArtifacts,
  deriveNextGate,
  isSecretPath,
  inferArtifactType,
  migrationDecision,
  scanLocalPaths,
  buildCrossRepoGenesisProvenanceReport,
} from "../scripts/review/cross-repo-genesis-provenance.mjs";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(
  new URL(
    "../scripts/review/cross-repo-genesis-provenance.mjs",
    import.meta.url,
  ),
);

test("isSecretPath blocks key-like paths without reading content", () => {
  assert.equal(isSecretPath("runtime/keys/node0.pem"), true);
  assert.equal(isSecretPath("secrets/operator.key"), true);
  assert.equal(isSecretPath("id_ed25519"), true);
  assert.equal(isSecretPath("docs/GENESIS_100_GATE.md"), false);
});

test("classifyArtifact marks Dema genesis kernel as CURRENT_CANON", () => {
  assert.equal(
    classifyArtifact({
      repoName: "Dema",
      filePath: "packages/genesis/src/block0-live-readiness.js",
      archived: false,
      canonRole: "CURRENT_CANON",
    }),
    "CURRENT_CANON",
  );
});

test("classifyArtifact marks secret paths as SECRET_REFERENCE_DO_NOT_READ", () => {
  assert.equal(
    classifyArtifact({
      repoName: "bizra-data-lake",
      filePath: "runtime/secrets/genesis.key",
      archived: false,
      canonRole: "HISTORICAL_CANON",
    }),
    "SECRET_REFERENCE_DO_NOT_READ",
  );
});

test("classifyArtifact marks archived repo code as MIGRATION_CANDIDATE", () => {
  assert.equal(
    classifyArtifact({
      repoName: "bizra-node0-genesis",
      filePath: "rust/src/genesis.rs",
      archived: true,
      canonRole: "ARCHIVED_REFERENCE",
      artifactType: "code",
    }),
    "MIGRATION_CANDIDATE",
  );
});

test("migrationDecision maps status classes to honest actions", () => {
  assert.equal(migrationDecision("CURRENT_CANON"), "INHERIT_ACTIVE");
  assert.equal(
    migrationDecision("SECRET_REFERENCE_DO_NOT_READ"),
    "OPERATOR_REVIEW",
  );
  assert.equal(migrationDecision("REJECTED_OR_SUPERSEDED"), "IGNORE");
});

test("deriveNextGate recommends key ceremony when live home lacks pubkey", () => {
  const gate = deriveNextGate({
    artifacts: [],
    block0LiveReadiness: { ceremony_required: true },
    operatorPubkeyPresent: false,
  });
  assert.equal(gate.gate, "NODE0-GENESIS-KEY-CEREMONY-1A");
});

test("deriveNextGate recommends migrate review when archive code exists without live key", () => {
  const gate = deriveNextGate({
    artifacts: [
      {
        status_class: "MIGRATION_CANDIDATE",
        migration_decision: "OPERATOR_REVIEW_BEFORE_MIGRATE",
      },
    ],
    block0LiveReadiness: { ceremony_required: true },
    operatorPubkeyPresent: false,
  });
  assert.equal(gate.gate, "MIGRATE-HISTORICAL-GENESIS-PROOF-1A");
});

test("dedupeArtifacts collapses duplicate repo:path keys", () => {
  const rows = dedupeArtifacts([
    { repo: "BizraInfo/Dema", path: "a.js" },
    { repo: "BizraInfo/Dema", path: "a.js" },
    { repo: "BizraInfo/Dema", path: "b.js" },
  ]);
  assert.equal(rows.length, 2);
});

test("scanLocalPaths finds genesis filenames without reading secret files", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-cross-repo-scan-"));
  await mkdir(join(root, "docs"), { recursive: true });
  await mkdir(join(root, "runtime", "keys"), { recursive: true });
  await writeFile(
    join(root, "docs", "GENESIS_STATE.md"),
    "# genesis\n",
    "utf8",
  );
  await writeFile(join(root, "runtime", "keys", "node.pem"), "SECRET", "utf8");

  const hits = scanLocalPaths(root, "BizraInfo/bizra-data-lake", [
    "genesis",
    "keys",
  ]);
  const paths = hits.map((h) => h.path);
  assert.ok(paths.includes("docs/GENESIS_STATE.md"));
  assert.ok(paths.some((p) => p.includes("runtime/keys/")));
  for (const hit of hits) {
    assert.notEqual(hit.evidence, "SECRET");
    if (isSecretPath(hit.path)) {
      assert.equal(hit.evidence, "path-only (secret guard)");
    }
  }
});

test("buildCrossRepoGenesisProvenanceReport hermetic shape with overrides", async () => {
  const overrides = [
    {
      repo: "BizraInfo/Dema",
      path: "packages/genesis/src/block0-manifest.js",
      source: "fixture",
      query: "block0",
      evidence: "fixture",
    },
  ];
  const report = await buildCrossRepoGenesisProvenanceReport({
    skipGh: true,
    artifactOverrides: overrides,
    block0LiveReadiness: {
      operator_pubkey_present: false,
      ceremony_required: true,
    },
  });

  assert.equal(report.schema, CROSS_REPO_GENESIS_PROVENANCE_SCHEMA);
  assert.equal(report.ok, true);
  assert.equal(report.repos.length, REPO_CATALOG.length);
  assert.equal(report.boundary.read_only_audit, true);
  assert.equal(report.boundary.private_key_read, false);
  assert.equal(report.boundary.signing_performed, false);
  assert.ok(report.artifacts.length >= 1);
  assert.equal(report.next_gate.gate, "NODE0-GENESIS-KEY-CEREMONY-1A");
});

test("cross-repo provenance CLI emits schema-tagged JSON", async () => {
  const { stdout } = await execFileAsync("node", [scriptPath, "--no-block0"], {
    env: { ...process.env, CROSS_REPO_SKIP_GH: "1" },
    timeout: 30_000,
  });
  const report = JSON.parse(stdout);
  assert.equal(report.schema, CROSS_REPO_GENESIS_PROVENANCE_SCHEMA);
  assert.equal(report.boundary.mutation_performed, false);
});
