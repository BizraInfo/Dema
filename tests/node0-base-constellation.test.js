// NODE0-BASE-CONSTELLATION-1A — what Node0 can observe of its own body.
//
// Pure-kernel tests: observations are injected, so nothing here depends on the
// host's disks, its session, or whether a phone happens to be plugged in.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildBaseConstellation,
  verifyBaseConstellation,
  NODE0_BASE_CONSTELLATION_SCHEMA,
  EXECUTION_ROLES,
} from "../packages/core/src/node0-base-constellation.js";

const GB = 1e9 / 512; // sectors per decimal GB

function disk(name, gb, partitions = [], model = "TEST") {
  return { name, sectors: Math.round(gb * GB), model, partitions };
}
function part(name, gb) {
  return { name, sectors: Math.round(gb * GB) };
}

test("NBC-01 REGRESSION — a mounted sliver must not mask an unmounted terabyte", () => {
  // MEASURED DEFECT 2026-08-09: reachability computed per DISK reported a
  // 1024 GB drive as fully reachable because a 2 GB partition on it was
  // mounted, hiding a 1020 GB unmounted partition — and contradicted lsblk.
  const envelope = buildBaseConstellation({
    disks: [
      disk("nvme2n1", 1024, [
        part("nvme2n1p1", 1),
        part("nvme2n1p2", 2),
        part("nvme2n1p3", 1021),
      ]),
    ],
    mounts: [{ device: "/dev/nvme2n1p2", mountpoint: "/media/stick" }],
    attached: [],
  });
  const host = envelope.bases[0];
  assert.equal(host.total_capacity_gb, 1024);
  assert.equal(host.reachable_capacity_gb, 2);
  assert.equal(host.dark_capacity_gb, 1022);
  // The dark capacity must be attributable to a named partition, not a total.
  const dark = host.storage[0].partitions.filter((p) => !p.reachable);
  assert.deepEqual(
    dark.map((p) => p.name),
    ["nvme2n1p1", "nvme2n1p3"],
  );
});

test("NBC-02 POSITIVE CONTROL — a fully mounted disk reports zero dark", () => {
  const envelope = buildBaseConstellation({
    disks: [disk("nvme0n1", 2048, [part("nvme0n1p1", 2048)])],
    mounts: [{ device: "/dev/nvme0n1p1", mountpoint: "/data" }],
    attached: [],
  });
  assert.equal(envelope.bases[0].dark_capacity_gb, 0);
  assert.equal(envelope.bases[0].reachable_capacity_gb, 2048);
});

test("NBC-03 a cabled device is a base, but presence is not enrolment", () => {
  const envelope = buildBaseConstellation({
    disks: [],
    mounts: [],
    attached: [{ label: "mtp:host=SAMSUNG_Android_TEST" }],
  });
  assert.equal(envelope.base_count, 2);
  assert.equal(envelope.attached_not_enrolled, 1);
  const companion = envelope.bases[1];
  assert.equal(companion.execution_role, EXECUTION_ROLES.COMPANION);
  assert.equal(companion.enrolled, false, "a cable must never imply enrolment");
  assert.equal(companion.content_read, false);
  // The host keeps the autonomous role; the two are never conflated.
  assert.equal(envelope.bases[0].execution_role, EXECUTION_ROLES.HOST);
});

test("NBC-04 the boundary stays all-false — observation performs nothing", () => {
  const envelope = buildBaseConstellation({
    disks: [disk("nvme0n1", 100, [part("nvme0n1p1", 100)])],
    mounts: [{ device: "/dev/nvme0n1p1", mountpoint: "/" }],
    attached: [{ label: "mtp:host=X" }],
  });
  assert.equal(envelope.schema, NODE0_BASE_CONSTELLATION_SCHEMA);
  // Canonical boundary keys, owned by preview-boundary.js — asserted here so a
  // future edit cannot quietly flip one while observing devices.
  for (const key of [
    "content_read",
    "filesystem_write_performed",
    "runtime_execution_performed",
    "network_used",
  ]) {
    assert.equal(envelope.boundary[key], false, `boundary.${key} must be false`);
  }
  // Device-specific effects live outside the canonical key set, not inside it.
  for (const key of [
    "device_content_read",
    "device_mutated",
    "pairing_performed",
    "enrolment_performed",
  ]) {
    assert.equal(
      envelope.device_effects[key],
      false,
      `device_effects.${key} must be false`,
    );
  }
  assert.match(envelope.what_this_does_not_prove, /custody/);
});

test("NBC-05 verify re-derives totals and rejects a tampered summary", () => {
  const envelope = buildBaseConstellation({
    disks: [disk("nvme2n1", 1024, [part("nvme2n1p2", 2), part("nvme2n1p3", 1021)])],
    mounts: [{ device: "/dev/nvme2n1p2", mountpoint: "/media/stick" }],
    attached: [],
  });
  assert.deepEqual(verifyBaseConstellation(envelope), { ok: true });

  // Hand-edit the dark total to hide the unreachable terabyte.
  const host = { ...envelope.bases[0], dark_capacity_gb: 0 };
  const tampered = { ...envelope, bases: [host] };
  assert.equal(verifyBaseConstellation(tampered).ok, false);
  assert.equal(verifyBaseConstellation(tampered).reason, "dark_capacity_mismatch");
});

test("NBC-06 no observations degrades honestly rather than throwing", () => {
  const envelope = buildBaseConstellation({});
  assert.equal(envelope.base_count, 1);
  assert.equal(envelope.bases[0].total_capacity_gb, 0);
  assert.equal(envelope.attached_not_enrolled, 0);
  assert.deepEqual(verifyBaseConstellation(envelope), { ok: true });
});

test("NBC-07 an unpartitioned disk is judged whole, not skipped", () => {
  const mounted = buildBaseConstellation({
    disks: [disk("sda", 500)],
    mounts: [{ device: "/dev/sda", mountpoint: "/mnt/raw" }],
    attached: [],
  });
  assert.equal(mounted.bases[0].reachable_capacity_gb, 500);
  const unmounted = buildBaseConstellation({
    disks: [disk("sda", 500)],
    mounts: [],
    attached: [],
  });
  assert.equal(unmounted.bases[0].dark_capacity_gb, 500);
});
