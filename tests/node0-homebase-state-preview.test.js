import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  buildNode0HomebaseStatePreview,
  NODE0_HOMEBASE_STATE_PREVIEW_SCHEMA,
} from "../packages/core/src/node0-homebase-state-preview.js";

const modulePath = fileURLToPath(
  new URL(
    "../packages/core/src/node0-homebase-state-preview.js",
    import.meta.url,
  ),
);

test("Node0 homebase state preview emits the canonical schema", () => {
  const preview = buildNode0HomebaseStatePreview();
  assert.equal(preview.schema, NODE0_HOMEBASE_STATE_PREVIEW_SCHEMA);
  assert.equal(preview.schema, "bizra.dema.node0_homebase_state_preview.v0.1");
});

test("Node0 homebase state preview is PREVIEW_ONLY and DECLARED", () => {
  const preview = buildNode0HomebaseStatePreview();
  assert.equal(preview.mode, "PREVIEW_ONLY");
  assert.equal(preview.truth_label, "DECLARED");
});

test("Node0 homebase state preview names player and devices per Node0-space canon", () => {
  const preview = buildNode0HomebaseStatePreview();
  assert.equal(preview.player, "momo");
  assert.equal(preview.primary_device, "MSI laptop");
  assert.equal(preview.companion_device, "Z Fold 6");
});

test("Node0 homebase state preview carries PAT-7 and SAT-5 registries", () => {
  const preview = buildNode0HomebaseStatePreview();
  assert.equal(preview.pat_count, 7);
  assert.equal(preview.sat_count, 5);
  assert.equal(preview.pat_registry.length, 7);
  assert.equal(preview.sat_registry.length, 5);
  for (const entry of preview.pat_registry) {
    assert.match(entry.id, /^PAT-[1-7]$/);
    assert.equal(entry.scope, "local_only");
  }
  for (const entry of preview.sat_registry) {
    assert.match(entry.id, /^SAT-[1-5]$/);
    assert.equal(entry.verdict_surface, "PERMIT|REJECT|REVIEW|SCORE_ONLY");
  }
});

test("Node0 homebase state preview marks local URP active_local_only and shared URP locked_preview_only", () => {
  const preview = buildNode0HomebaseStatePreview();
  assert.equal(preview.local_urp_status, "active_local_only");
  assert.equal(preview.shared_urp_status, "locked_preview_only");
});

test("Node0 homebase state preview boundary keeps every authority flag false", () => {
  const preview = buildNode0HomebaseStatePreview();
  for (const key of [
    "runtime",
    "federation",
    "mint",
    "node_connection",
    "economic_settlement",
    "raw_data_exchange",
    "step7_authorization_observed",
    "filesystem_write_performed",
  ]) {
    assert.equal(preview.boundary[key], false, `boundary.${key} must be false`);
  }
});

test("Node0 homebase state preview blocked_actions includes the required slugs", () => {
  const preview = buildNode0HomebaseStatePreview();
  for (const required of [
    "connect_node1",
    "shared_urp_publish",
    "runtime_start",
    "federation_start",
  ]) {
    assert.ok(
      preview.blocked_actions.includes(required),
      `blocked_actions must include ${required}`,
    );
  }
});

test("Node0 homebase state preview emits a non-empty next_safe_action", () => {
  const preview = buildNode0HomebaseStatePreview();
  assert.equal(typeof preview.next_safe_action, "string");
  assert.ok(preview.next_safe_action.length > 0);
});

test("Node0 homebase state preview is deterministic and deeply frozen", () => {
  const a = buildNode0HomebaseStatePreview();
  const b = buildNode0HomebaseStatePreview();
  assert.deepEqual(a, b);
  assert.ok(Object.isFrozen(a));
  assert.ok(Object.isFrozen(a.boundary));
  assert.ok(Object.isFrozen(a.pat_registry));
  assert.ok(Object.isFrozen(a.sat_registry));
  assert.ok(Object.isFrozen(a.blocked_actions));
});

test("Node0 homebase state preview returns fresh objects on each call", () => {
  const a = buildNode0HomebaseStatePreview();
  const b = buildNode0HomebaseStatePreview();
  assert.notEqual(a, b);
  assert.notEqual(a.boundary, b.boundary);
});

test("Node0 homebase state preview module has no runtime or filesystem side effects", async () => {
  const body = await readFile(modulePath, "utf8");
  assert.ok(!/from ['"]node:fs/.test(body), "must not import node:fs");
  assert.ok(
    !/from ['"]node:child_process/.test(body),
    "must not import node:child_process",
  );
  assert.ok(!/from ['"]node:http/.test(body), "must not import node:http");
  assert.ok(!/from ['"]node:net/.test(body), "must not import node:net");
  assert.ok(
    !/spawn\(|execSync\(|execFile\(|spawnSync\(/.test(body),
    "must not invoke processes",
  );
});
