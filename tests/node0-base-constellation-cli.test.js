// NODE0-BASE-CONSTELLATION-WIRING-1A — the kernel's first caller.
//
// The kernel, gatherer, and seven NBC tests shipped 2026-08-19 with ZERO
// callers (control-verified): a node that can observe its own body had no
// surface a human could invoke. These tests pin the wiring — a real end-to-end
// run of `dema node0 constellation` against this host's actual /sys and /proc.

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  verifyBaseConstellation,
  NODE0_BASE_CONSTELLATION_SCHEMA,
  NODE0_BASE_CONSTELLATION_TRUTH_LABEL,
} from "../packages/core/src/node0-base-constellation.js";

const BIN = fileURLToPath(new URL("../bin/dema", import.meta.url));

function run(args) {
  return execFileSync("node", [BIN, ...args], {
    env: { ...process.env, NO_COLOR: "1", DEMA_NO_TUI: "1" },
    timeout: 20000,
  }).toString();
}

test("NBC-CLI-01 `dema node0 constellation --json` emits the observed envelope and it re-verifies", () => {
  const report = JSON.parse(run(["node0", "constellation", "--json"]));

  assert.equal(report.schema, NODE0_BASE_CONSTELLATION_SCHEMA);
  assert.equal(report.truth_label, NODE0_BASE_CONSTELLATION_TRUTH_LABEL);

  // The host is always base zero, always enrolled; attachment never implies
  // enrolment, so every non-host base must say enrolled=false.
  assert.equal(report.bases[0].base_id, "base:host");
  assert.equal(report.bases[0].enrolled, true);
  assert.ok(report.base_count >= 1);
  for (const companion of report.bases.slice(1)) {
    assert.equal(companion.enrolled, false, "a cable must never imply enrolment");
  }

  // Observation performs nothing: canonical boundary all-false, and the
  // device-specific effect flags all-false.
  assert.ok(Object.values(report.boundary).every((v) => v === false));
  for (const key of [
    "device_content_read",
    "device_mutated",
    "pairing_performed",
    "enrolment_performed",
  ]) {
    assert.equal(report.device_effects[key], false, `device_effects.${key}`);
  }

  // The printed totals re-derive from the printed rows — the same check the
  // command runs before it agrees to emit anything.
  assert.deepEqual(verifyBaseConstellation(report), { ok: true });
});

test("NBC-CLI-02 human output states the truth label and never hides dark capacity", () => {
  const out = run(["node0", "constellation"]);
  assert.match(out, new RegExp(NODE0_BASE_CONSTELLATION_TRUTH_LABEL));
  // The dark-capacity total is the fact this slice exists to surface (NBC-01):
  // it must appear even when it is zero, so silence can never mean "reachable".
  assert.match(out, /dark/i);
  assert.match(out, /reachable/i);
  // The command is an observer and must say so.
  assert.match(out, /read-only/i);
});

test("NBC-CLI-03 the subcommand is advertised by the node0 usage text", () => {
  // An unknown subcommand routes to the usage error; the new surface must be
  // listed there or it is wired but undiscoverable — the exact failure mode
  // this slice closes.
  const result = spawnSync("node", [BIN, "node0", "no-such-subcommand"], {
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", DEMA_NO_TUI: "1" },
    timeout: 20000,
  });
  assert.equal(result.status, 1, "unknown subcommand must exit 1");
  assert.match(result.stderr, /dema node0 constellation \[--json\]/);
});
