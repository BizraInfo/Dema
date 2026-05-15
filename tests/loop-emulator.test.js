import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  emulateLoopDesign,
  formatLoopDesignEmulation
} from "../packages/core/src/loop-emulator.js";

const modulePath = fileURLToPath(new URL("../packages/core/src/loop-emulator.js", import.meta.url));
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));
const execFileAsync = promisify(execFile);

test("emulateLoopDesign emits a schema-tagged preview without effects", () => {
  const report = emulateLoopDesign();

  assert.equal(report.schema, "bizra.dema.loop_design_emulation_preview.v0.1");
  assert.equal(report.mode, "PREVIEW_ONLY");
  assert.equal(report.truth_label, "DESIGN_EMULATION_NOT_RUNTIME_RECEIPT");
  assert.deepEqual(report.lenses, ["hardware", "performance", "data", "impact"]);
  assert.equal(report.boundary.runtime_execution, false);
  assert.equal(report.boundary.pat_sat_runtime_spawned, false);
  assert.equal(report.boundary.receipt_minted, false);
  assert.equal(report.boundary.local_state_written, false);
});

test("emulateLoopDesign is deterministic for a fixed seed", () => {
  const first = emulateLoopDesign({ seed: 42 });
  const second = emulateLoopDesign({ seed: 42 });

  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.notEqual(
    JSON.stringify(emulateLoopDesign({ seed: 7 }).scales.node0_solo.raw_counts),
    JSON.stringify(first.scales.node0_solo.raw_counts)
  );
});

test("emulateLoopDesign keeps runtime and receipt claims proof-safe", () => {
  const report = emulateLoopDesign();
  const serialized = JSON.stringify(report);

  assert.doesNotMatch(serialized, /"receipt_id"/);
  assert.doesNotMatch(serialized, /"chain_head"/);
  assert.doesNotMatch(serialized, /"executed":true/);
  assert.ok(report.self_critique.length >= 3);
  assert.equal(report.scales.global_1m.truth_basis, "DERIVED_EXTRAPOLATION");
  assert.equal(report.scales.global_1m.impact.certifies_economic_value, false);
});

test("formatLoopDesignEmulation renders boundary and scale summaries", () => {
  const output = formatLoopDesignEmulation(emulateLoopDesign());

  assert.match(output, /DEMA Loop Design Emulation/);
  assert.match(output, /DESIGN_EMULATION_NOT_RUNTIME_RECEIPT/);
  assert.match(output, /no runtime execution/);
  assert.match(output, /global_1m/);
  assert.match(output, /Self-critique/);
});

test("dema design emulate-loop exposes the preview without runtime execution", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "design", "emulate-loop", "--json"]);
  const output = JSON.parse(stdout);

  assert.equal(output.schema, "bizra.dema.loop_design_emulation_preview.v0.1");
  assert.equal(output.mode, "PREVIEW_ONLY");
  assert.equal(output.boundary.runtime_execution, false);
  assert.equal(output.boundary.network_connection_attempted, false);
});

test("loop emulator module has no filesystem or network side effects", async () => {
  const source = await readFile(modulePath, "utf8");

  assert.doesNotMatch(source, /from "node:(fs|net|http|https|tls|dgram)"/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
});

test("loop emulator spawns SAT work only after PAT DoD pass", async () => {
  const source = await readFile(modulePath, "utf8");

  assert.doesNotMatch(source, /pat\.dod_result === "PASS" \|\| pat\.gate_decision === "PERMIT"/);
  assert.match(source, /pat\.dod_result === "PASS"/);
});
