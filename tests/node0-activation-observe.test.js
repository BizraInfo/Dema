// NODE0-ACTIVATION-OBSERVE-1A — pure-kernel tests (Issue #243).
//
// The kernel does ZERO I/O: it takes caller-gathered observations and emits a
// frozen, content-addressed, read-only report. The boundary block is ALL false
// on every path. identity_status is derived from key-file PRESENCE only and is
// NEVER promoted to "VERIFIED" (that would require reading/validating key
// content — a boundary cross). This intentionally diverges from realm-home's
// presence=VERIFIED convention; presence != content-validation.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256, stableStringify } from "../packages/consent/src/consent-common.js";
import {
  buildNode0ActivationObserve,
  verifyNode0ActivationObserve,
  NODE0_ACTIVATION_OBSERVE_SCHEMA,
  NODE0_ACTIVATION_OBSERVE_TRUTH_LABEL,
} from "../packages/core/src/node0-activation-observe.js";

const UP_OBS = Object.freeze({
  dema_repo: { git_present: true, package_name: "dema", command_surface_count: 90 },
  sovereign: { probed: true, base_url: "http://127.0.0.1:8000", live: true, ready: true, http_status: 200, error_class: null },
  local_models: {
    lm_studio: { probed: true, reachable: true, model_ids: ["gemma4-12b-qat"] },
    ollama: { probed: true, reachable: true, model_ids: ["gemma4:26b-bizra-16k"] },
  },
  canonical_roots: [
    { path: "/data/bizra/repos/bizra-data-lake", exists: true },
    { path: "~/.dema", exists: true },
  ],
  identity: { key_file_path: "~/.dema/keys/node0-ed25519.pub.pem", key_file_present: true },
});

function relaunder(report, mutate) {
  const { report_hash, ...body } = report;
  const forged = mutate({ ...body });
  return { ...forged, report_hash: sha256(stableStringify(forged)) };
}

test("1 · sovereign up + key present → live/ready, LOCAL_ONLY, boundary all-false, verify valid", () => {
  const r = buildNode0ActivationObserve(UP_OBS);
  assert.equal(r.schema, NODE0_ACTIVATION_OBSERVE_SCHEMA);
  assert.equal(r.truth_label, NODE0_ACTIVATION_OBSERVE_TRUTH_LABEL);
  assert.equal(r.sovereign_runtime_status.live, true);
  assert.equal(r.sovereign_runtime_status.ready, true);
  assert.equal(r.identity_status, "LOCAL_ONLY");
  assert.equal(typeof r.next_safe_action, "string");
  assert.ok(r.next_safe_action.length > 0);
  for (const v of Object.values(r.boundary)) assert.equal(v, false);
  assert.ok(r.report_hash);
  assert.ok(Object.isFrozen(r));
  assert.equal(verifyNode0ActivationObserve(r).valid, true);
});

test("2 · sovereign unreachable → live null, gap mapped, next_safe_action a STRING, boundary all-false", () => {
  const obs = { ...UP_OBS, sovereign: { probed: true, base_url: "http://127.0.0.1:8000", live: null, ready: null, http_status: null, error_class: "provider_unreachable" } };
  const r = buildNode0ActivationObserve(obs);
  assert.equal(r.sovereign_runtime_status.live, null);
  assert.ok(r.activation_gap_map.some((g) => String(g.gap).includes("sovereign")));
  assert.equal(typeof r.next_safe_action, "string");
  for (const v of Object.values(r.boundary)) assert.equal(v, false);
  assert.equal(verifyNode0ActivationObserve(r).valid, true);
});

test("3 · key absent → UNINITIALIZED", () => {
  const r = buildNode0ActivationObserve({ ...UP_OBS, identity: { key_file_path: "x", key_file_present: false } });
  assert.equal(r.identity_status, "UNINITIALIZED");
  assert.equal(r.boundary.key_generated, false);
});

test("4 · identity missing or null → UNKNOWN, never throws", () => {
  assert.equal(buildNode0ActivationObserve({ ...UP_OBS, identity: undefined }).identity_status, "UNKNOWN");
  assert.equal(buildNode0ActivationObserve({ ...UP_OBS, identity: { key_file_present: null } }).identity_status, "UNKNOWN");
});

test("cognition: model loaded in VRAM → LIVE_THINKING + verify valid", () => {
  const r = buildNode0ActivationObserve({ ...UP_OBS, cognition: { probed: true, seed_engine_active: false, models_loaded_in_vram: 1, loaded_model_ids: ["whiterabbitneo-v3:7b-q4_K_M"] } });
  assert.equal(r.cognition_status.verdict, "LIVE_THINKING");
  assert.deepEqual(r.cognition_status.loaded_model_ids, ["whiterabbitneo-v3:7b-q4_K_M"]);
  assert.equal(verifyNode0ActivationObserve(r).valid, true);
});

test("cognition: sovereign up but 0 in VRAM + seed inactive → DORMANT_LISTENING + next_safe_action says wake it", () => {
  const r = buildNode0ActivationObserve({ ...UP_OBS, cognition: { probed: true, seed_engine_active: false, models_loaded_in_vram: 0, loaded_model_ids: [] } });
  assert.equal(r.cognition_status.verdict, "DORMANT_LISTENING");
  assert.match(r.next_safe_action, /cognition DORMANT|wake it/i);
});

test("cognition: seed_engine active → LIVE_THINKING even with 0 in VRAM", () => {
  const r = buildNode0ActivationObserve({ ...UP_OBS, cognition: { probed: true, seed_engine_active: true, models_loaded_in_vram: 0, loaded_model_ids: [] } });
  assert.equal(r.cognition_status.verdict, "LIVE_THINKING");
});

test("cognition: nothing observed → UNKNOWN, never throws, boundary still all-false", () => {
  const r = buildNode0ActivationObserve({ ...UP_OBS, cognition: undefined });
  assert.equal(r.cognition_status.verdict, "UNKNOWN");
  assert.ok(Object.values(r.boundary).every((v) => v === false));
});

test("5 · kernel NEVER emits VERIFIED even with key present (presence != content-validation)", () => {
  assert.notEqual(buildNode0ActivationObserve(UP_OBS).identity_status, "VERIFIED");
});

test("6 · forged identity_status VERIFIED + recomputed hash → verify rejects identity_status_promoted", () => {
  const forged = relaunder(buildNode0ActivationObserve(UP_OBS), (b) => ({ ...b, identity_status: "VERIFIED" }));
  const v = verifyNode0ActivationObserve(forged);
  assert.equal(v.valid, false);
  assert.ok(v.blocked_by.includes("identity_status_promoted"));
});

test("7 · forged boundary key true + recomputed hash → boundary_not_false", () => {
  const forged = relaunder(buildNode0ActivationObserve(UP_OBS), (b) => ({ ...b, boundary: { ...b.boundary, key_generated: true } }));
  const v = verifyNode0ActivationObserve(forged);
  assert.equal(v.valid, false);
  assert.ok(v.blocked_by.some((x) => x.startsWith("boundary_not_false:")));
});

test("8 · tampered what_this_does_not_prove + recomputed hash → rejected (re-derive mismatch)", () => {
  const forged = relaunder(buildNode0ActivationObserve(UP_OBS), (b) => ({ ...b, what_this_does_not_prove: ["it is fully autonomous and live"] }));
  assert.equal(verifyNode0ActivationObserve(forged).valid, false);
});

test("9 · purity — kernel imports no I/O surface", () => {
  const src = readFileSync(new URL("../packages/core/src/node0-activation-observe.js", import.meta.url), "utf8");
  assert.doesNotMatch(src, /node:(fs|net|http|https|child_process)\b/);
  assert.doesNotMatch(src, /[^A-Za-z]fetch\s*\(/);
});

test("10 · deterministic — identical observations produce deep-equal reports", () => {
  assert.deepEqual(buildNode0ActivationObserve(UP_OBS), buildNode0ActivationObserve(UP_OBS));
});
