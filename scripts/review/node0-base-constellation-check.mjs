#!/usr/bin/env node
// NODE0-BASE-CONSTELLATION-1A — review gate.
//
// Proves the constellation law on deterministic fixtures — no live /sys or
// /proc reads here, so the gate's verdict is the same on every machine:
//   1. a mounted sliver can never mask an unmounted terabyte (partition-level
//      reachability, dark capacity attributable to a named partition);
//   2. presence is never enrolment (a cabled companion stays enrolled=false);
//   3. the envelope grants nothing (boundary and device_effects all-false);
//   4. verify refuses every forged summary — and the gate plants those
//      forgeries itself, so a verify that stops refusing turns this gate RED.
//
// A green gate must say WHAT it verified: the result carries a named check
// list, and an empty list fails closed.

import { pathToFileURL } from "node:url";

import {
  buildBaseConstellation,
  verifyBaseConstellation,
  NODE0_BASE_CONSTELLATION_SCHEMA,
  NODE0_BASE_CONSTELLATION_TRUTH_LABEL,
  EXECUTION_ROLES,
} from "../../packages/core/src/node0-base-constellation.js";

const JSON_MODE = process.argv.includes("--json");

const SECTORS_PER_GB = 1e9 / 512;

// Canonical fixture — the measured NBC-01 defect shape: a 1024 GB disk whose
// only mounted partition is a 2 GB sliver, plus a whole unmounted disk and a
// cabled phone. Dark capacity MUST surface and the phone MUST NOT be enrolled.
export function node0BaseConstellationCheckFixture() {
  return {
    disks: [
      {
        name: "nvme9n9",
        sectors: Math.round(1024 * SECTORS_PER_GB),
        model: "FIXTURE-NVME",
        partitions: [
          { name: "nvme9n9p1", sectors: Math.round(2 * SECTORS_PER_GB) },
          { name: "nvme9n9p2", sectors: Math.round(1022 * SECTORS_PER_GB) },
        ],
      },
      { name: "sdz", sectors: Math.round(500 * SECTORS_PER_GB), model: "FIXTURE-SD", partitions: [] },
    ],
    mounts: [{ device: "/dev/nvme9n9p1", mountpoint: "/media/sliver" }],
    attached: [{ label: "mtp:host=FIXTURE_PHONE" }],
  };
}

function tamperControl(id, envelope, forge, expectedReason) {
  const verdict = verifyBaseConstellation({ ...envelope, ...forge });
  const refused = verdict.ok === false && verdict.reason === expectedReason;
  return {
    id,
    ok: refused,
    detail: refused
      ? `forged ${Object.keys(forge).join(",")} refused: ${verdict.reason}`
      : `CONTROL DID NOT FIRE — forged ${Object.keys(forge).join(",")} returned ${JSON.stringify(verdict)}`,
  };
}

export function runNode0BaseConstellationCheck() {
  const envelope = buildBaseConstellation(node0BaseConstellationCheckFixture());
  const host = envelope.bases.find((b) => b.base_id === "base:host");
  const companions = envelope.bases.filter((b) => b.base_id !== "base:host");
  const checks = [];

  const verified = verifyBaseConstellation(envelope);
  checks.push({
    id: "fixture_envelope_verifies",
    ok: verified.ok === true,
    detail: verified.ok
      ? "envelope totals re-derive from their own rows"
      : `verify refused honest fixture: ${verified.reason}`,
  });

  const darkDisk = host?.storage.find((d) => d.name === "nvme9n9");
  const darkPart = darkDisk?.partitions.find((p) => p.name === "nvme9n9p2");
  checks.push({
    id: "sliver_cannot_mask_dark_terabyte",
    ok:
      darkDisk?.dark_gb === 1022 &&
      darkPart?.reachable === false &&
      envelope.dark_capacity_gb === 1522,
    detail: `disk dark_gb=${darkDisk?.dark_gb} via named partition ${darkPart?.name} reachable=${darkPart?.reachable}; envelope dark_capacity_gb=${envelope.dark_capacity_gb}`,
  });

  checks.push({
    id: "unpartitioned_unmounted_disk_judged_whole",
    ok: host?.storage.find((d) => d.name === "sdz")?.dark_gb === 500,
    detail: `sdz dark_gb=${host?.storage.find((d) => d.name === "sdz")?.dark_gb}`,
  });

  checks.push({
    id: "presence_is_never_enrolment",
    ok:
      companions.length === 1 &&
      companions.every(
        (c) =>
          c.enrolled === false &&
          c.content_read === false &&
          c.execution_role === EXECUTION_ROLES.COMPANION,
      ) &&
      envelope.attached_not_enrolled === 1,
    detail: `companions=${companions.length}, enrolled=${companions.map((c) => c.enrolled).join(",")}, attached_not_enrolled=${envelope.attached_not_enrolled}`,
  });

  const boundaryEntries = Object.entries(envelope.boundary ?? {});
  checks.push({
    id: "boundary_all_false",
    ok:
      boundaryEntries.length > 0 &&
      boundaryEntries.every(([, value]) => value === false),
    detail: `${boundaryEntries.length} boundary keys, non-false: [${boundaryEntries
      .filter(([, v]) => v !== false)
      .map(([k]) => k)
      .join(",")}]`,
  });

  const effectEntries = Object.entries(envelope.device_effects ?? {});
  checks.push({
    id: "device_effects_all_false",
    ok:
      effectEntries.length === 4 &&
      effectEntries.every(([, value]) => value === false),
    detail: `${effectEntries.length} device-effect keys, non-false: [${effectEntries
      .filter(([, v]) => v !== false)
      .map(([k]) => k)
      .join(",")}]`,
  });

  checks.push(
    tamperControl(
      "tamper_dark_capacity_refused",
      envelope,
      { dark_capacity_gb: 0 },
      "envelope_dark_capacity_mismatch",
    ),
    tamperControl(
      "tamper_base_count_refused",
      envelope,
      { base_count: 9 },
      "base_count_mismatch",
    ),
    tamperControl(
      "tamper_attached_not_enrolled_refused",
      envelope,
      { attached_not_enrolled: 0 },
      "attached_not_enrolled_mismatch",
    ),
  );

  const blocked_by = checks.filter((c) => !c.ok).map((c) => c.id);
  if (checks.length === 0) blocked_by.push("vacuous_gate_no_checks_ran");

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: NODE0_BASE_CONSTELLATION_SCHEMA,
    truth_label: NODE0_BASE_CONSTELLATION_TRUTH_LABEL,
    checks: Object.freeze(checks.map((c) => Object.freeze(c))),
    blocked_by: Object.freeze(blocked_by),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode0BaseConstellationCheck();

  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA - NODE0-BASE-CONSTELLATION-1A");
    console.log(`  schema: ${result.schema}`);
    console.log(`  truth: ${result.truth_label}`);
    for (const check of result.checks) {
      console.log(`  ${check.ok ? "ok " : "FAIL"} ${check.id} — ${check.detail}`);
    }
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
