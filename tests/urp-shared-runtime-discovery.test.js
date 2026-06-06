import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { runVerificationPipeline } from "../packages/core/src/multi-agent-orchestrator.js";
import {
  buildUrpSharedRuntimeDiscovery,
  buildUrpSharedStateManifest,
  evaluateUrpSharedWriteBoundary,
  FORBIDDEN_WRITE_KINDS,
  URP_SHARED_MANIFEST_RELATIVE_PATH,
  URP_SHARED_RUNTIME_DISCOVERY_SCHEMA,
  URP_SHARED_STATE_MANIFEST_SCHEMA,
} from "../packages/core/src/urp-shared-runtime-discovery.js";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(
  new URL("../scripts/urp-shared-discovery.mjs", import.meta.url),
);

function verifiedPipeline() {
  return runVerificationPipeline({ artifact: buildUrpSharedStateManifest() });
}

test("buildUrpSharedStateManifest is discovery-only with UKE not connected", () => {
  const manifest = buildUrpSharedStateManifest();
  assert.equal(manifest.schema, URP_SHARED_STATE_MANIFEST_SCHEMA);
  assert.equal(manifest.mode, "DISCOVERY_ONLY");
  assert.equal(manifest.uke_cortex.status, "not_connected");
  assert.equal(manifest.uke_cortex.auto_ingest, false);
  assert.equal(
    manifest.manifest_relative_path,
    URP_SHARED_MANIFEST_RELATIVE_PATH,
  );
  assert.equal(manifest.boundary.filesystem_write_performed, false);
  assert.equal(manifest.boundary.network_used, false);
  assert.equal(manifest.urp_discovery_flags.uke_auto_ingest_performed, false);
  assert.equal(manifest.urp_discovery_flags.pat_private_memory_exported, false);
});

test("evaluateUrpSharedWriteBoundary refuses forbidden write kinds", () => {
  for (const kind of FORBIDDEN_WRITE_KINDS) {
    const result = evaluateUrpSharedWriteBoundary({
      write_kind: kind,
      sat_pipeline: verifiedPipeline(),
      consent_phrase: "GO: share abc into URP soil",
      discovery_only: true,
    });
    assert.equal(result.allowed, false);
    assert.ok(
      result.violations.some(
        (v) =>
          v.code === "forbidden_write_kind" ||
          v.code === "discovery_only_no_persist",
      ),
    );
  }
});

test("evaluateUrpSharedWriteBoundary requires SAT pipeline_verified", () => {
  const result = evaluateUrpSharedWriteBoundary({
    write_kind: "manifest_append_entry",
    candidate: {
      candidate_id: "x",
      tier: "URP_SHAREABLE",
      contains_private_pat_memory: false,
    },
    sat_pipeline: {
      schema: "bizra.dema.orchestrator_verification_pipeline.v0.1",
      overall_verdict: "pipeline_violated",
      passed: false,
    },
    consent_phrase: "GO: share x into URP soil",
    discovery_only: true,
  });
  assert.equal(result.allowed, false);
  assert.ok(
    result.violations.some((v) => v.code === "sat_pipeline_not_verified"),
  );
});

test("evaluateUrpSharedWriteBoundary blocks PAT private memory export", () => {
  const result = evaluateUrpSharedWriteBoundary({
    write_kind: "manifest_append_entry",
    candidate: {
      candidate_id: "leak",
      tier: "URP_SHAREABLE",
      contains_private_pat_memory: true,
    },
    sat_pipeline: verifiedPipeline(),
    consent_phrase: "GO: share leak into URP soil",
    discovery_only: true,
  });
  assert.equal(result.allowed, false);
  assert.ok(
    result.violations.some((v) => v.code === "pat_private_memory_blocked"),
  );
});

test("evaluateUrpSharedWriteBoundary always refuses persist in discovery_only mode", () => {
  const result = evaluateUrpSharedWriteBoundary({
    write_kind: "manifest_append_entry",
    candidate: {
      candidate_id: "ok-1",
      tier: "URP_SHAREABLE",
      contains_private_pat_memory: false,
    },
    sat_pipeline: verifiedPipeline(),
    consent_phrase: "GO: share ok-1 into URP soil",
    discovery_only: true,
  });
  assert.equal(result.allowed, false);
  assert.ok(
    result.violations.some((v) => v.code === "discovery_only_no_persist"),
  );
  assert.equal(result.filesystem_write_performed, false);
});

test("buildUrpSharedRuntimeDiscovery composes manifest and boundary sample", () => {
  const report = buildUrpSharedRuntimeDiscovery({
    sat_pipeline: verifiedPipeline(),
  });
  assert.equal(report.schema, URP_SHARED_RUNTIME_DISCOVERY_SCHEMA);
  assert.equal(report.mode, "DISCOVERY_ONLY");
  assert.equal(report.urp_discovery_flags.uke_auto_ingest_performed, false);
  assert.equal(report.urp_discovery_flags.pat_private_memory_exported, false);
  assert.equal(
    report.urp_discovery_flags.shared_urp_network_publish_performed,
    false,
  );
  assert.ok(Object.isFrozen(report));
});

test("urp-shared-discovery script exits 0 with --json", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    [scriptPath, "--json"],
    { encoding: "utf8" },
  );
  const payload = JSON.parse(stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.discovery.schema, URP_SHARED_RUNTIME_DISCOVERY_SCHEMA);
});
