import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function rehash(body) {
  const stable = (v) => {
    if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
    if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
    return JSON.stringify(v);
  };
  return `sha256:${createHash("sha256").update(stable(body), "utf8").digest("hex")}`;
}

import {
  planNode0MaterializationPulseE2ePreview,
  buildNode0MaterializationPulseE2ePreviewPayload,
  verifyNode0MaterializationPulseE2ePreview,
  runNode0MaterializationPulseE2ePreview,
  runPulseStationLadder,
  PULSE_STATIONS,
  NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_SCHEMA,
  NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_TRUTH_LABEL,
  NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_GO_PHRASE,
} from "../packages/core/src/node0-materialization-pulse-e2e-preview.js";
import { runNode0MaterializationPulseE2ePreviewCheck } from "../scripts/review/node0-materialization-pulse-e2e-preview-check.mjs";
import {
  exampleE2eMission,
  exampleInjectionMission,
  exampleSecretMission,
  exampleBadPlanMission,
  exampleFateRejectMission,
  exampleOverclaimMission,
} from "../scripts/review/materialization-pulse-e2e-fixtures.mjs";

const GO = NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_GO_PHRASE;
const run = (mission) => runNode0MaterializationPulseE2ePreview({ consent: GO, input: { mission } });
const rungOf = (r, station) => r.ladder.find((x) => x.station === station);

// --- scaffold contract ---------------------------------------------------------------------------

test("plan fails closed without consent / without a mission", () => {
  assert.equal(planNode0MaterializationPulseE2ePreview({ consent: "x", input: { mission: {} } }).eligible, false);
  assert.equal(planNode0MaterializationPulseE2ePreview({ consent: GO, input: {} }).eligible, false);
  assert.equal(planNode0MaterializationPulseE2ePreview({ consent: GO, input: { mission: {} } }).eligible, true);
});

test("payload is content-addressed with an all-false boundary", () => {
  const p = buildNode0MaterializationPulseE2ePreviewPayload({ mission: exampleE2eMission() });
  assert.match(p.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(p.boundary.model_invocation_performed, false);
  assert.equal(p.station_count, PULSE_STATIONS.length);
});

test("verify accepts a fresh sealed payload and rejects tamper", () => {
  const p = buildNode0MaterializationPulseE2ePreviewPayload({ mission: exampleE2eMission() });
  assert.equal(verifyNode0MaterializationPulseE2ePreview(p).ok, true, verifyNode0MaterializationPulseE2ePreview(p).blocked_by.join(","));
  assert.equal(verifyNode0MaterializationPulseE2ePreview({ ...p, truth_label: "X" }).ok, false);
  assert.equal(verifyNode0MaterializationPulseE2ePreview({ ...p, content_hash: `sha256:${"0".repeat(64)}` }).ok, false);
  assert.equal(verifyNode0MaterializationPulseE2ePreview(null).ok, false);
});

test("review gate: clean mission SEALS with a full green ladder", () => {
  const r = runNode0MaterializationPulseE2ePreviewCheck();
  assert.equal(r.ok, true, r.blocked_by?.join(","));
  assert.equal(r.pulse_status, "sealed");
  assert.equal(r.reached_station, 5);
});

// --- the train runs: the acceptance matrix -------------------------------------------------------

test("1. clean mission → sealed, 5-rung ladder all green", () => {
  const r = run(exampleE2eMission());
  assert.equal(r.ok, true, r.blocked_by?.join(","));
  assert.equal(r.pulse_status, "sealed");
  assert.equal(r.ladder.length, 5);
  assert.ok(r.ladder.every((x) => x.ok === true));
  assert.equal(r.claims_public_safe, true);
});

test("2. injection file → abort @ rung 1 (sanitize BLOCKED)", () => {
  const r = run(exampleInjectionMission());
  assert.equal(r.pulse_status, "aborted");
  assert.equal(r.reached_station, 1);
  assert.equal(rungOf(r, "sanitize").ok, false);
  assert.equal(r.pulse_receipt, null);
});

test("3. secret file → abort @ rung 1 (QUARANTINED)", () => {
  const r = run(exampleSecretMission());
  assert.equal(r.pulse_status, "aborted");
  assert.equal(r.reached_station, 1);
  assert.equal(rungOf(r, "sanitize").verdict, "QUARANTINED");
});

test("4. unaccounted plan branch → abort @ rung 2", () => {
  const r = run(exampleBadPlanMission());
  assert.equal(r.pulse_status, "aborted");
  assert.equal(r.reached_station, 2);
  assert.equal(rungOf(r, "plan_branch").ok, false);
});

test("5. FATE reject → abort @ rung 3", () => {
  const r = run(exampleFateRejectMission());
  assert.equal(r.pulse_status, "aborted");
  assert.equal(r.reached_station, 3);
  assert.equal(rungOf(r, "fate").ok, false);
});

test("6. overclaim → SEALS but claims_public_safe is false (claim rejection does not abort)", () => {
  const r = run(exampleOverclaimMission());
  assert.equal(r.pulse_status, "sealed");
  assert.equal(r.reached_station, 5);
  assert.equal(r.claims_public_safe, false);
});

test("7. content hash is deterministic", () => {
  const a = buildNode0MaterializationPulseE2ePreviewPayload({ mission: exampleE2eMission() });
  const b = buildNode0MaterializationPulseE2ePreviewPayload({ mission: exampleE2eMission() });
  assert.equal(a.content_hash, b.content_hash);
});

test("8. verify rejects a forged ladder hash (ladder must match the sealed envelope)", () => {
  const p = buildNode0MaterializationPulseE2ePreviewPayload({ mission: exampleE2eMission() });
  const tampered = {
    ...p,
    ladder: p.ladder.map((x) => (x.station === "sanitize" ? { ...x, content_hash: `sha256:${"1".repeat(64)}` } : x)),
  };
  const { content_hash: _d, ...body } = tampered;
  assert.equal(verifyNode0MaterializationPulseE2ePreview({ ...body, content_hash: rehash(body) }).ok, false);
});

test("9. verify rejects laundered authority even with a recomputed hash", () => {
  const p = buildNode0MaterializationPulseE2ePreviewPayload({ mission: exampleE2eMission() });
  const { content_hash: _d, ...body } = { ...p, authority_delta: 1 };
  assert.equal(verifyNode0MaterializationPulseE2ePreview({ ...body, content_hash: rehash(body) }).ok, false);
});

test("10. an aborted pulse must not carry a pulse_receipt (verify enforces)", () => {
  const p = buildNode0MaterializationPulseE2ePreviewPayload({ mission: exampleInjectionMission() });
  assert.equal(p.pulse_receipt, null);
  assert.equal(verifyNode0MaterializationPulseE2ePreview(p).ok, true, verifyNode0MaterializationPulseE2ePreview(p).blocked_by.join(","));
});

test("runPulseStationLadder is directly callable and deterministic", () => {
  const a = runPulseStationLadder(exampleE2eMission());
  assert.equal(a.pulse_status, "sealed");
  assert.equal(a.ladder.length, 5);
  const empty = runPulseStationLadder({});
  assert.equal(empty.pulse_status, "aborted");
});

test("run blocks on wrong consent", () => {
  const r = runNode0MaterializationPulseE2ePreview({ consent: "no", input: { mission: exampleE2eMission() } });
  assert.equal(r.ok, false);
  assert.equal(r.status, "blocked_pending_consent");
});

// --- branch coverage: verify rejection paths + build defaults ------------------------------------

test("verify rejects an invalid pulse_status and a final_verdict mismatch", () => {
  const p = buildNode0MaterializationPulseE2ePreviewPayload({ mission: exampleE2eMission() });
  const bad1 = { ...p, pulse_status: "weird", final_verdict: "weird" };
  { const { content_hash: _d, ...b } = bad1; assert.ok(verifyNode0MaterializationPulseE2ePreview({ ...b, content_hash: rehash(b) }).blocked_by.includes("pulse_status_invalid")); }
  const bad2 = { ...p, final_verdict: "aborted" };
  { const { content_hash: _d, ...b } = bad2; assert.ok(verifyNode0MaterializationPulseE2ePreview({ ...b, content_hash: rehash(b) }).blocked_by.includes("final_verdict_mismatch")); }
});

test("verify rejects a missing/empty ladder", () => {
  const p = buildNode0MaterializationPulseE2ePreviewPayload({ mission: exampleE2eMission() });
  const { content_hash: _d, ...b } = { ...p, ladder: [] };
  assert.ok(verifyNode0MaterializationPulseE2ePreview({ ...b, content_hash: rehash(b) }).blocked_by.includes("ladder_missing"));
});

test("verify rejects a sealed pulse that did not reach rung 5", () => {
  const p = buildNode0MaterializationPulseE2ePreviewPayload({ mission: exampleE2eMission() });
  const { content_hash: _d, ...b } = { ...p, reached_station: 3 };
  assert.ok(verifyNode0MaterializationPulseE2ePreview({ ...b, content_hash: rehash(b) }).blocked_by.includes("sealed_without_full_ladder"));
});

test("verify rejects a sealed pulse whose embedded envelope is broken", () => {
  const p = buildNode0MaterializationPulseE2ePreviewPayload({ mission: exampleE2eMission() });
  const brokenEnv = { ...p.pulse_receipt, content_hash: `sha256:${"0".repeat(64)}` };
  const { content_hash: _d, ...b } = { ...p, pulse_receipt: brokenEnv };
  assert.ok(verifyNode0MaterializationPulseE2ePreview({ ...b, content_hash: rehash(b) }).blocked_by.includes("embedded_pulse_receipt_invalid"));
});

test("verify rejects a ladder plan/claim hash that does not match the sealed envelope", () => {
  const p = buildNode0MaterializationPulseE2ePreviewPayload({ mission: exampleE2eMission() });
  const t1 = { ...p, ladder: p.ladder.map((x) => (x.station === "plan_branch" ? { ...x, content_hash: `sha256:${"2".repeat(64)}` } : x)) };
  { const { content_hash: _d, ...b } = t1; assert.ok(verifyNode0MaterializationPulseE2ePreview({ ...b, content_hash: rehash(b) }).blocked_by.includes("ladder_plan_hash_mismatch")); }
  const t2 = { ...p, ladder: p.ladder.map((x) => (x.station === "claim_gate" ? { ...x, content_hash: `sha256:${"3".repeat(64)}` } : x)) };
  { const { content_hash: _d, ...b } = t2; assert.ok(verifyNode0MaterializationPulseE2ePreview({ ...b, content_hash: rehash(b) }).blocked_by.includes("ladder_claim_hash_mismatch")); }
});

test("verify rejects an aborted pulse that carries a pulse_receipt or a non-blocked last rung", () => {
  const p = buildNode0MaterializationPulseE2ePreviewPayload({ mission: exampleInjectionMission() });
  const withReceipt = { ...p, pulse_receipt: { anything: true } };
  { const { content_hash: _d, ...b } = withReceipt; assert.ok(verifyNode0MaterializationPulseE2ePreview({ ...b, content_hash: rehash(b) }).blocked_by.includes("aborted_with_pulse_receipt")); }
  const okLast = { ...p, ladder: p.ladder.map((x, i) => (i === p.ladder.length - 1 ? { ...x, ok: true } : x)) };
  { const { content_hash: _d, ...b } = okLast; assert.ok(verifyNode0MaterializationPulseE2ePreview({ ...b, content_hash: rehash(b) }).blocked_by.includes("aborted_without_blocked_rung")); }
});

test("verify rejects laundered authority/grants/mint/boundary/schema fields (recomputed hash)", () => {
  const p = buildNode0MaterializationPulseE2ePreviewPayload({ mission: exampleE2eMission() });
  for (const [patch, code] of [
    [{ authority_delta: 1 }, "authority_delta_nonzero"],
    [{ grants_action: true }, "grants_action_true"],
    [{ mint_allowed: true }, "mint_allowed_true"],
    [{ boundary: {} }, "boundary_not_all_false"],
    [{ schema: "bad" }, "schema_mismatch"],
  ]) {
    const { content_hash: _d, ...b } = { ...p, ...patch };
    assert.ok(verifyNode0MaterializationPulseE2ePreview({ ...b, content_hash: rehash(b) }).blocked_by.includes(code), code);
  }
});

test("a FATE authority/mint violation (not REJECT) also aborts at rung 3", () => {
  const m = { ...exampleE2eMission(), fate: { verdict: "PERMIT", authority_delta: 1, grants_action: false, mint_allowed: false } };
  const r = run(m);
  assert.equal(r.pulse_status, "aborted");
  assert.equal(r.reached_station, 3);
  assert.equal(rungOf(r, "fate").ok, false);
});

test("a mission with prev_pulse + explicit ids seals (exercises the non-default branches)", () => {
  const m = { ...exampleE2eMission(), prev_pulse: `sha256:${"a".repeat(64)}`, pulse_id: "p-2", mission_id: "m-2" };
  const r = run(m);
  assert.equal(r.pulse_status, "sealed");
  assert.equal(r.mission_id, "m-2");
});

test("build applies defaults for a minimal mission (missing optional fields)", () => {
  const p = buildNode0MaterializationPulseE2ePreviewPayload({ mission: { plan: {}, claims: {}, fate: {} } });
  // empty file_text → sanitizer ALLOWED → proceeds to plan, which fails → abort @ rung 2
  assert.equal(p.pulse_status, "aborted");
  assert.equal(p.mission_id, null);
  assert.equal(verifyNode0MaterializationPulseE2ePreview(p).ok, true, verifyNode0MaterializationPulseE2ePreview(p).blocked_by.join(","));
});

// --- purity --------------------------------------------------------------------------------------

test("kernel remains pure: no fs / network / process / clock / random", () => {
  const src = readFileSync(fileURLToPath(new URL("../packages/core/src/node0-materialization-pulse-e2e-preview.js", import.meta.url)), "utf8");
  assert.doesNotMatch(src, /node:fs|node:net|node:http|node:https|node:dns|child_process/);
  assert.doesNotMatch(src, /globalThis\.fetch|fetch\(/);
  assert.doesNotMatch(src, /Math\.random|Date\.now|new Date\(/);
  assert.doesNotMatch(src, /process\.(env|argv|exit)/);
});
