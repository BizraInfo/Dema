import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  buildSharedUrpWorldPreview,
  SHARED_URP_WORLD_PREVIEW_SCHEMA
} from "../packages/core/src/shared-urp-world-preview.js";

const modulePath = fileURLToPath(new URL("../packages/core/src/shared-urp-world-preview.js", import.meta.url));

test("Shared URP world preview emits the canonical schema", () => {
  const preview = buildSharedUrpWorldPreview();
  assert.equal(preview.schema, SHARED_URP_WORLD_PREVIEW_SCHEMA);
  assert.equal(preview.schema, "bizra.dema.shared_urp_world_preview.v0.1");
});

test("Shared URP world preview is PREVIEW_ONLY and DECLARED", () => {
  const preview = buildSharedUrpWorldPreview();
  assert.equal(preview.mode, "PREVIEW_ONLY");
  assert.equal(preview.truth_label, "DECLARED");
});

test("Shared URP world preview is locked_preview_only", () => {
  const preview = buildSharedUrpWorldPreview();
  assert.equal(preview.status, "locked_preview_only");
});

test("Shared URP world preview holds nodes 1-4 as ghost_hold and unreachable", () => {
  const preview = buildSharedUrpWorldPreview();
  assert.equal(preview.node_count, 4);
  assert.equal(preview.nodes.length, 4);
  const expectedIds = ["node1", "node2", "node3", "node4"];
  for (let i = 0; i < expectedIds.length; i++) {
    assert.equal(preview.nodes[i].id, expectedIds[i]);
    assert.equal(preview.nodes[i].status, "ghost_hold");
    assert.equal(preview.nodes[i].reachable, false);
    assert.equal(preview.nodes[i].federation_open, false);
  }
});

test("Shared URP world preview boundary keeps every authority flag false", () => {
  const preview = buildSharedUrpWorldPreview();
  for (const key of [
    "raw_data_exchange",
    "runtime_delegation",
    "federation",
    "economic_settlement",
    "shared_urp_publish",
    "cross_node_receipt_emission",
    "node_connection_attempted",
    "filesystem_write_performed"
  ]) {
    assert.equal(preview.boundary[key], false, `boundary.${key} must be false`);
  }
});

test("Shared URP world preview defaults all offer/manifest/event arrays to empty", () => {
  const preview = buildSharedUrpWorldPreview();
  assert.deepEqual(preview.resource_offers, []);
  assert.deepEqual(preview.skill_offers, []);
  assert.deepEqual(preview.knowledge_pack_manifests, []);
  assert.deepEqual(preview.impact_events, []);
});

test("Shared URP world preview blocked_actions includes the required slugs", () => {
  const preview = buildSharedUrpWorldPreview();
  for (const required of [
    "connect_node1",
    "shared_urp_publish",
    "runtime_start",
    "federation_start"
  ]) {
    assert.ok(preview.blocked_actions.includes(required), `blocked_actions must include ${required}`);
  }
});

test("Shared URP world preview emits a non-empty next_safe_action and unlock_condition", () => {
  const preview = buildSharedUrpWorldPreview();
  assert.equal(typeof preview.next_safe_action, "string");
  assert.ok(preview.next_safe_action.length > 0);
  assert.equal(typeof preview.unlock_condition, "string");
  assert.ok(preview.unlock_condition.length > 0);
});

test("Shared URP world preview is deterministic and deeply frozen", () => {
  const a = buildSharedUrpWorldPreview();
  const b = buildSharedUrpWorldPreview();
  assert.deepEqual(a, b);
  assert.ok(Object.isFrozen(a));
  assert.ok(Object.isFrozen(a.boundary));
  assert.ok(Object.isFrozen(a.nodes));
  assert.ok(Object.isFrozen(a.blocked_actions));
});

test("Shared URP world preview returns fresh objects on each call", () => {
  const a = buildSharedUrpWorldPreview();
  const b = buildSharedUrpWorldPreview();
  assert.notEqual(a, b);
  assert.notEqual(a.boundary, b.boundary);
  assert.notEqual(a.nodes, b.nodes);
});

test("Shared URP world preview module has no runtime or filesystem side effects", async () => {
  const body = await readFile(modulePath, "utf8");
  assert.ok(!/from ['"]node:fs/.test(body), "must not import node:fs");
  assert.ok(!/from ['"]node:child_process/.test(body), "must not import node:child_process");
  assert.ok(!/from ['"]node:http/.test(body), "must not import node:http");
  assert.ok(!/from ['"]node:net/.test(body), "must not import node:net");
  assert.ok(!/spawn\(|execSync\(|execFile\(|spawnSync\(/.test(body), "must not invoke processes");
});
