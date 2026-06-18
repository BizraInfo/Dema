import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DATALAKE_DUAL_LOOP_PREVIEW_SCHEMA,
  DATALAKE_DUAL_LOOP_TRUTH_LABEL,
  DEFAULT_PROOF_GAPS,
  buildDatalakeDualLoopPreview,
  gatherDatalakeDualLoopPreview,
  renderDatalakeDualLoopPreview,
} from "../packages/core/src/datalake-dual-loop-preview.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const CLI_PATH = join(REPO_ROOT, "apps", "cli", "src", "index.js");
const FIXED_NOW = new Date("2026-06-18T10:00:00.000Z");

function runCli(args, { demaHome } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [CLI_PATH, ...args], {
      env: { ...process.env, DEMA_HOME: demaHome ?? join(REPO_ROOT, ".tmp-unused-home") },
      cwd: REPO_ROOT,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolvePromise({ code, stdout, stderr });
    });
  });
}

test("buildDatalakeDualLoopPreview composes face and body loops with bridge edge", () => {
  const preview = buildDatalakeDualLoopPreview({
    renderedAtIso: FIXED_NOW.toISOString(),
    boundaryRefs: {
      face_stage_refs: [],
      alignment_layer_refs: [],
      all_face_refs_present: true,
      all_alignment_refs_present: true,
    },
  });

  assert.equal(preview.schema, DATALAKE_DUAL_LOOP_PREVIEW_SCHEMA);
  assert.equal(preview.truth_label, DATALAKE_DUAL_LOOP_TRUTH_LABEL);
  assert.equal(preview.face_body_alignment_status, "REFERENCE_EXPECTATION_ONLY");
  assert.equal(preview.loops.dema_face.stage_count, 5);
  assert.equal(preview.loops.datalake_body.stage_count, 6);
  assert.equal(preview.bridge.runtime_sync, false);
  assert.equal(preview.boundary.runtime_sync_performed, false);
  assert.equal(preview.boundary.datalake_mutation_performed, false);
  assert.deepEqual(preview.proof_gaps, DEFAULT_PROOF_GAPS);

  const bridge = preview.edges.find((edge) => edge.relation === "aligns_with");
  assert.ok(bridge);
  assert.equal(bridge.from, "dema_face:alignment_ref");
  assert.equal(bridge.to, "datalake_body:body_artifact_ref");
});

test("gatherDatalakeDualLoopPreview resolves ADR-030 boundary refs on disk", async () => {
  const preview = await gatherDatalakeDualLoopPreview({
    now: FIXED_NOW,
    repoRoot: REPO_ROOT,
    exists: existsSync,
  });

  assert.equal(preview.summary.boundary_refs_ok, true);
  assert.ok(preview.boundary_refs.all_alignment_refs_present);
  assert.ok(
    preview.boundary_refs.alignment_layer_refs.some(
      (ref) => ref.field === "mock_ref" && ref.present,
    ),
  );
});

test("renderDatalakeDualLoopPreview includes loop stage labels", () => {
  const preview = buildDatalakeDualLoopPreview({
    renderedAtIso: FIXED_NOW.toISOString(),
  });
  const text = renderDatalakeDualLoopPreview(preview);
  assert.match(text, /DEMA · DATA LAKE DUAL-LOOP PREVIEW/);
  assert.match(text, /alignment_ref/);
  assert.match(text, /pat7_expectation/);
  assert.match(text, /no sync/);
});

test("dema datalake dual-loop-preview --json emits preview schema", async () => {
  const result = await runCli(["datalake", "dual-loop-preview", "--json"]);
  assert.equal(result.code, 0, result.stderr);
  const preview = JSON.parse(result.stdout);
  assert.equal(preview.schema, DATALAKE_DUAL_LOOP_PREVIEW_SCHEMA);
  assert.equal(preview.mode, "reference_expectation_only");
});
