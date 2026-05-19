import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildProcessValueFixturePackPreview,
  PROCESS_VALUE_FIXTURE_PACK_SCHEMA
} from "../packages/core/src/process-value-fixture-preview.js";

const modulePath = new URL("../packages/core/src/process-value-fixture-preview.js", import.meta.url);
const cliPath = new URL("../apps/cli/src/index.js", import.meta.url);

const forbiddenAuthorizationPatterns = [
  /\bI authorize\b/i,
  /GO:\s*/i,
  /--authorize\s+["'][^"']+["']/i
];

const expectedStates = new Map([
  ["clean_progress", ["proof_process_preview", "continue_verified_micro_slice"]],
  ["dirty_step7_gated", ["process_dirty", "restore_clean_baseline"]],
  ["clean_step7_hold", ["node0_proof_ready_step7_gated", "hold_step7_ceremony"]],
  ["noisy_failure", ["proof_process_preview", "reduce_noise_before_next_slice"]],
  ["node_connection_blocked", ["node_connection_gated", "continue_preview_only_readiness"]],
  ["malformed_rejected", ["preview_reject", "fix_malformed_process_inputs"]]
]);

test("buildProcessValueFixturePackPreview emits a schema-tagged offline fixture pack", () => {
  const pack = buildProcessValueFixturePackPreview();

  assert.equal(pack.schema, PROCESS_VALUE_FIXTURE_PACK_SCHEMA);
  assert.equal(pack.mode, "PREVIEW_ONLY");
  assert.equal(pack.verdict, "PARTIAL_PLACEHOLDER");
  assert.equal(pack.fixture_count, 6);
  assert.equal(pack.entries.length, 6);
  assert.equal(pack.all_expected_matched, true);
});

test("default fixture pack matches locked golden states", () => {
  const pack = buildProcessValueFixturePackPreview();

  for (const entry of pack.entries) {
    const expected = expectedStates.get(entry.id);
    assert.ok(expected, `unexpected fixture ${entry.id}`);
    assert.deepEqual(
      [entry.preview_summary.process_state, entry.preview_summary.next_safe_action],
      expected
    );
    assert.equal(entry.expected_match, true);
  }
});

test("dirty Step 7 fixture restores clean baseline before ceremony work", () => {
  const pack = buildProcessValueFixturePackPreview();
  const entry = pack.entries.find((candidate) => candidate.id === "dirty_step7_gated");

  assert.equal(entry.preview_summary.process_state, "process_dirty");
  assert.equal(entry.preview_summary.next_safe_action, "restore_clean_baseline");
});

test("clean Step 7 fixture locks ceremony into hold posture", () => {
  const pack = buildProcessValueFixturePackPreview();
  const entry = pack.entries.find((candidate) => candidate.id === "clean_step7_hold");

  assert.equal(entry.preview_summary.process_state, "node0_proof_ready_step7_gated");
  assert.equal(entry.preview_summary.next_safe_action, "hold_step7_ceremony");
  assert.equal(entry.expected_match, true);
  assert.equal(entry.boundary.receipt_minted, false);
  assert.equal(entry.boundary.authorization_emitted, false);
});

test("malformed inner fixture is separate from malformed pack rejection", () => {
  const pack = buildProcessValueFixturePackPreview();
  const entry = pack.entries.find((candidate) => candidate.id === "malformed_rejected");

  assert.equal(pack.verdict, "PARTIAL_PLACEHOLDER");
  assert.equal(entry.preview_summary.process_state, "preview_reject");
  assert.equal(entry.preview_summary.next_safe_action, "fix_malformed_process_inputs");
  assert.equal(entry.expected_match, true);
});

test("malformed fixture pack fails closed without entries", () => {
  const malformed = buildProcessValueFixturePackPreview({
    fixtures: [{
      id: "clean_progress",
      processEvents: [],
      proofSignals: [],
      blockers: [],
      now: "not-a-date"
    }]
  });

  assert.equal(malformed.verdict, "PREVIEW_REJECT");
  assert.equal(malformed.fixture_count, 0);
  assert.deepEqual(malformed.entries, []);
  assert.equal(malformed.reason, "fixture_now_must_be_iso_datetime");
  assert.equal(malformed.boundary.receipt_minted, false);
});

test("fixture ids are closed and unknown packs fail closed", () => {
  const malformed = buildProcessValueFixturePackPreview({
    fixtures: [{
      id: "invented_fixture",
      processEvents: [],
      proofSignals: [],
      blockers: [],
      now: "2026-05-15T00:00:00.000Z"
    }]
  });

  assert.equal(malformed.verdict, "PREVIEW_REJECT");
  assert.equal(malformed.reason, "fixture_id_not_allowlisted");
});

test("fixture pack keeps every authority boundary false", () => {
  const pack = buildProcessValueFixturePackPreview();
  const expectedFalseBoundaries = [
    "runtime_started",
    "federation_started",
    "socket_opened",
    "node_connection_attempted",
    "receipt_minted",
    "capability_minted",
    "authorization_emitted",
    "filesystem_write_performed",
    "cli_wired",
    "push_performed"
  ];

  for (const key of expectedFalseBoundaries) {
    assert.equal(pack.boundary[key], false, `${key} must remain false`);
    for (const entry of pack.entries) assert.equal(entry.boundary[key], false, `${entry.id}.${key}`);
  }
});

test("fixture pack emits micro-compliance, micro-consent, and analogy without authority", () => {
  const pack = buildProcessValueFixturePackPreview();
  const controls = pack.micro_compliance.map((item) => item.control);

  assert.ok(controls.includes("no_cli_wiring"));
  assert.ok(controls.includes("no_runtime_or_socket"));
  assert.ok(controls.includes("no_receipt_or_capability_mint"));
  assert.equal(pack.micro_consent.current_preview_requires_operator_authorization, false);
  assert.equal(pack.micro_consent.action_authorized_by_preview, false);
  assert.equal(pack.micro_consent.reusable_authorization_created, false);
  assert.equal(pack.analogical_model.analogy, "sealed calibration card deck");
  assert.equal(pack.analogical_model.boundary, "fixture_pack_not_process_engine");
});

test("fixture pack is deterministic, deeply frozen, and returns fresh objects", () => {
  const first = buildProcessValueFixturePackPreview();
  const second = buildProcessValueFixturePackPreview();

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.entries), true);
  assert.equal(Object.isFrozen(first.entries[0]), true);
  assert.equal(Object.isFrozen(first.entries[0].fixture.processEvents[0]), true);
  assert.equal(Object.isFrozen(first.micro_compliance[0]), true);
  assert.throws(() => {
    first.entries[0].boundary.runtime_started = true;
  }, TypeError);
});

test("fixture pack emits no reusable authorization phrase", () => {
  const serialized = JSON.stringify(buildProcessValueFixturePackPreview());

  for (const pattern of forbiddenAuthorizationPatterns) {
    assert.doesNotMatch(serialized, pattern);
  }
});

test("process value fixture pack has no CLI wiring", async () => {
  const cliSource = await readFile(cliPath, "utf8");

  assert.doesNotMatch(cliSource, /process-value-fixture-preview/);
  assert.doesNotMatch(cliSource, /process value fixture/i);
});

test("process value fixture pack module has no runtime or filesystem side effects", async () => {
  const source = await readFile(modulePath, "utf8");

  assert.doesNotMatch(source, /from\s+["']node:(net|dgram|http|https|tls|dns|worker_threads|vm|child_process|fs)["']/);
  assert.doesNotMatch(source, /\b(fetch|WebSocket|exec|execFile|spawn|spawnSync)\b/);
  assert.doesNotMatch(source, /\b(writeFile|appendFile|mkdir|rename|unlink|createWriteStream)\b/);
  assert.doesNotMatch(source, /\b(Date\.now|Math\.random|crypto\.random|process\.hrtime|performance\.now)\b/);
});
