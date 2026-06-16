import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildBootstrapModePreview,
  BOOTSTRAP_MODE_SCHEMA,
} from "../packages/core/src/bootstrap-mode.js";
import { PREVIEW_BOUNDARY_CANONICAL_KEYS } from "../packages/core/src/preview-boundary.js";
import { ONBOARDING_LIFECYCLE_STAGE_IDS } from "../packages/core/src/onboarding-lifecycle.js";

function snapshotDir(dir) {
  return existsSync(dir) ? readdirSync(dir).sort() : [];
}

test("ephemeral bootstrap preview writes nothing to DEMA_HOME", () => {
  const home = mkdtempSync(join(tmpdir(), "dema-bootstrap-"));
  const prevHome = process.env.DEMA_HOME;
  process.env.DEMA_HOME = home;
  try {
    const before = snapshotDir(home);
    buildBootstrapModePreview();
    const after = snapshotDir(home);
    assert.deepEqual(after, before, "DEMA_HOME must be untouched");
    assert.deepEqual(after, [], "fresh DEMA_HOME stays empty");
  } finally {
    if (prevHome === undefined) delete process.env.DEMA_HOME;
    else process.env.DEMA_HOME = prevHome;
  }
});

test("boundary is the canonical 16-key, all-false, frozen attestation", () => {
  const result = buildBootstrapModePreview();
  assert.equal(result.schema, BOOTSTRAP_MODE_SCHEMA);
  assert.ok(Object.isFrozen(result.boundary), "boundary must be frozen");
  assert.deepEqual(
    Object.keys(result.boundary).sort(),
    [...PREVIEW_BOUNDARY_CANONICAL_KEYS].sort(),
    "boundary keys must be exactly the canonical set",
  );
  for (const [key, value] of Object.entries(result.boundary)) {
    assert.equal(value, false, `boundary.${key} must be false`);
  }
});

test("model-less by default — no model loaded, no invocation", () => {
  const result = buildBootstrapModePreview();
  assert.equal(result.model_status, "MODEL_UNKNOWN");
  assert.equal(result.model_route.boundary.model_invocation, false);
  assert.equal(result.model_route.registry.length, 0);
  assert.equal(result.boundary.model_invocation_performed, false);
  assert.equal(result.boundary.model_loaded, false);
});

test("completes the canonical 7 onboarding stages", () => {
  const result = buildBootstrapModePreview();
  assert.deepEqual(result.stages, [...ONBOARDING_LIFECYCLE_STAGE_IDS]);
  assert.equal(result.stages.length, 7);
});

test("wording is preview/session-ready only — no live-claim terms", () => {
  const result = buildBootstrapModePreview();
  assert.equal(result.mode, "ephemeral_preview");
  assert.equal(result.next_safe_message, "session ready");
  const declared = `${result.mode} ${result.truth_label} ${result.next_safe_message}`;
  for (const forbidden of ["node is born", "verified", "proof exists"]) {
    assert.ok(
      !declared.includes(forbidden),
      `kernel wording must not assert "${forbidden}"`,
    );
  }
});

test("result is deeply frozen (no post-hoc mutation)", () => {
  const result = buildBootstrapModePreview();
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.stages));
});
