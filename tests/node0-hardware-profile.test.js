import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256, stableStringify } from "../packages/consent/src/consent-common.js";
import {
  buildNode0HardwareProfile,
  verifyNode0HardwareProfile,
  NODE0_HARDWARE_PROFILE_SCHEMA,
  NODE0_HARDWARE_PROFILE_TRUTH_LABEL,
} from "../packages/core/src/node0-hardware-profile.js";

const TITAN_OBS = Object.freeze({
  platform: "linux",
  hostname: "Bizra-Node0",
  cpu_cores_logical: 32,
  memory_total_gb: 125,
  memory_available_gb: 87,
  gpus: Object.freeze([
    Object.freeze({
      name: "NVIDIA GeForce RTX 4090 Laptop GPU",
      memory_total_mib: 16376,
      memory_free_mib: 8456,
    }),
  ]),
  disk: Object.freeze({ mount: "/", total_gb: 937, free_gb: 481 }),
});

function relaunder(report, mutate) {
  const { profile_hash, ...body } = report;
  const forged = mutate({ ...body });
  return { ...forged, profile_hash: sha256(stableStringify(forged)) };
}

test("hardware profile emits schema, truth label, reference match for Titan-class obs", () => {
  const p = buildNode0HardwareProfile(TITAN_OBS);
  assert.equal(p.schema, NODE0_HARDWARE_PROFILE_SCHEMA);
  assert.equal(p.truth_label, NODE0_HARDWARE_PROFILE_TRUTH_LABEL);
  assert.equal(p.valid, true);
  assert.equal(p.reference_profile.matched, true);
  assert.equal(p.workstation_tier, "node0_reference_ultra");
  assert.equal(p.capacity_classes.compute, "ultra");
  assert.equal(p.capacity_classes.memory, "ultra");
  assert.equal(p.capacity_classes.gpu, "laptop_16gb");
  assert.equal(p.architecture_policies.layers.gpu_plane.exclusive_recommended, true);
  for (const v of Object.values(p.boundary)) assert.equal(v, false);
  assert.equal(verifyNode0HardwareProfile(p).valid, true);
});

test("missing cpu or memory fails closed", () => {
  const p = buildNode0HardwareProfile({ platform: "linux" });
  assert.equal(p.valid, false);
  assert.ok(p.blocked_by.includes("missing_cpu_cores_logical"));
});

test("forged boundary + recomputed hash → verify rejects", () => {
  const forged = relaunder(buildNode0HardwareProfile(TITAN_OBS), (b) => ({
    ...b,
    boundary: { ...b.boundary, policy_enforced: true },
  }));
  const v = verifyNode0HardwareProfile(forged);
  assert.equal(v.valid, false);
  assert.ok(v.blocked_by.some((x) => x.startsWith("boundary_not_false:")));
});

test("kernel imports no fs/net/http child_process", () => {
  const src = readFileSync(
    new URL("../packages/core/src/node0-hardware-profile.js", import.meta.url),
    "utf8",
  );
  assert.equal(/\bfrom\s+["']node:fs/.test(src), false);
  assert.equal(/\bfrom\s+["']node:child_process/.test(src), false);
  assert.equal(/\bfetch\s*\(/.test(src), false);
});
