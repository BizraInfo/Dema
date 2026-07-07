import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  planNode0LocalMissionHarnessPreview,
  buildNode0LocalMissionHarnessPreviewPayload,
  verifyNode0LocalMissionHarnessPreview,
  runNode0LocalMissionHarnessPreview,
  composeMissionInput,
  exampleHarnessInput,
  NODE0_LOCAL_MISSION_HARNESS_PREVIEW_SCHEMA,
  NODE0_LOCAL_MISSION_HARNESS_PREVIEW_TRUTH_LABEL,
  NODE0_LOCAL_MISSION_HARNESS_PREVIEW_GO_PHRASE,
} from "../packages/core/src/node0-local-mission-harness-preview.js";
import {
  runNode0LocalMissionHarnessPreviewCheck,
} from "../scripts/review/node0-local-mission-harness-preview-check.mjs";
import { buildExampleCompositionRef } from "../scripts/review/node0-first-real-local-mission-pulse-preview-check.mjs";

const GO = NODE0_LOCAL_MISSION_HARNESS_PREVIEW_GO_PHRASE;

function sha256(v) {
  return createHash("sha256").update(v, "utf8").digest("hex");
}
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function compositionRef() {
  return buildExampleCompositionRef();
}
function validInput(overrides = {}) {
  return { ...exampleHarnessInput(compositionRef()), ...overrides };
}

// --- scaffold contract ---------------------------------------------------------------------------

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planNode0LocalMissionHarnessPreview({ consent: "wrong", input: validInput() });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with exact consent and well-formed input", () => {
  const plan = planNode0LocalMissionHarnessPreview({ consent: GO, input: validInput() });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
});

test("payload is content-addressed and carries an all-false boundary", () => {
  const payload = buildNode0LocalMissionHarnessPreviewPayload(validInput());
  assert.equal(payload.schema, NODE0_LOCAL_MISSION_HARNESS_PREVIEW_SCHEMA);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.boundary.file_mutation_performed, false);
  assert.equal(payload.boundary.model_invocation_performed, false);
});

test("verify accepts a freshly built payload", () => {
  const payload = buildNode0LocalMissionHarnessPreviewPayload(validInput());
  const v = verifyNode0LocalMissionHarnessPreview(payload);
  assert.equal(v.ok, true, v.blocked_by.join(", "));
});

test("verify rejects a tampered content_hash", () => {
  const payload = buildNode0LocalMissionHarnessPreviewPayload(validInput());
  assert.equal(verifyNode0LocalMissionHarnessPreview({ ...payload, content_hash: `sha256:${"0".repeat(64)}` }).ok, false);
});

test("verify rejects a field change that did not update the content_hash", () => {
  const payload = buildNode0LocalMissionHarnessPreviewPayload(validInput());
  assert.equal(verifyNode0LocalMissionHarnessPreview({ ...payload, truth_label: "FORGED" }).ok, false);
});

test("review gate closes the loop", () => {
  const result = runNode0LocalMissionHarnessPreviewCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, NODE0_LOCAL_MISSION_HARNESS_PREVIEW_SCHEMA);
});

test("orchestrator boundary stays all-false", () => {
  const result = runNode0LocalMissionHarnessPreview({ consent: GO, input: validInput() });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
  assert.equal(result.boundary.file_mutation_performed, false);
});

// --- harness contract ----------------------------------------------------------------------------

test("happy path: harness runs the pulse and shapes a preview receipt (committed_live false)", () => {
  const r = runNode0LocalMissionHarnessPreview({ consent: GO, input: validInput() });
  assert.equal(r.ok, true, r.blocked_by?.join(", "));
  assert.equal(r.status, "verified_preview_harness");
  assert.equal(r.harness_ready, true);
  assert.equal(r.receipt_artifact_preview.committed_live, false);
  assert.equal(r.receipt_artifact_preview.file_ref.content_read_performed, false);
  assert.match(r.receipt_target_relpath, /^mission\/receipts\/node0-local-mission-[0-9a-f]{8}\.json$/);
  assert.equal(r.mint_allowed, false);
});

test("mission_id is derived deterministically from the file content hash", () => {
  const mi = composeMissionInput({
    fileRef: { path: "/x/y.txt", content_hash: `sha256:${"c".repeat(64)}` },
    compositionRef: compositionRef(),
    candidate: { claim: "c", task: "t", boundary: "b" },
  });
  assert.equal(mi.mission.mission_id, `node0-local-mission-${"c".repeat(8)}`);
  assert.equal(mi.input_packet.raw_content_leaves_node0, false);
});

function rejects(overrides, code) {
  const r = runNode0LocalMissionHarnessPreview({ consent: GO, input: validInput(overrides) });
  assert.equal(r.ok, false, `expected reject for ${code}`);
  assert.ok(r.blocked_by.some((c) => c === code || c.startsWith(code)), `${code} not in [${r.blocked_by.join(", ")}]`);
}

test("missing file_ref rejects", () => rejects({ file_ref: undefined }, "missing_file_ref"));
test("file_ref missing content_hash rejects", () => rejects({ file_ref: { path: "/x", size_bytes: 1, content_read_performed: false } }, "file_ref_missing_content_hash"));
test("missing composition_ref rejects", () => rejects({ composition_ref: undefined }, "missing_composition_ref"));
test("missing candidate rejects", () => rejects({ candidate_extraction: undefined }, "missing_candidate_extraction"));

test("an excerpt without content-read consent rejects", () => {
  rejects(
    { file_ref: { path: "/x", size_bytes: 10, content_hash: `sha256:${"d".repeat(64)}`, content_read_performed: false, excerpt: "leaked text" } },
    "excerpt_without_content_consent",
  );
});

test("file_ref asserting raw_content_leaves_node0 rejects", () => {
  rejects(
    { file_ref: { path: "/x", size_bytes: 10, content_hash: `sha256:${"e".repeat(64)}`, content_read_performed: false, raw_content_leaves_node0: true } },
    "raw_content_leaves_node0",
  );
});

test("a candidate that overclaims (via the pulse) is surfaced as a pulse block", () => {
  rejects({ candidate_extraction: { claim: "live URP is activated", task: "t", boundary: "b" } }, "pulse:");
});

test("an invalid composition_ref is surfaced as a pulse block", () => {
  const bad = { ...compositionRef(), content_hash: `sha256:${"0".repeat(64)}` };
  rejects({ composition_ref: bad }, "pulse:");
});

test("verify rejects a receipt marked committed_live", () => {
  const payload = buildNode0LocalMissionHarnessPreviewPayload(validInput());
  const forged = { ...payload, receipt_artifact_preview: { ...payload.receipt_artifact_preview, committed_live: true } };
  const v = verifyNode0LocalMissionHarnessPreview(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("receipt_committed_live") || v.blocked_by.includes("content_hash_mismatch"));
});

test("forge-and-recompute on the embedded pulse/composition/genesis chain is still detected", () => {
  const payload = buildNode0LocalMissionHarnessPreviewPayload(validInput());
  const pv = payload.pulse_verdict;
  const g = pv.composition_ref.genesis_root;
  const forgedGenesis = {
    ...g,
    signed_receipt_anchor: { ...g.signed_receipt_anchor, payload: { ...g.signed_receipt_anchor.payload, head_hash: `sha256:${"e".repeat(64)}` } },
  };
  const forgedPulse = { ...pv, composition_ref: { ...pv.composition_ref, genesis_root: forgedGenesis } };
  const forgedBody = { ...payload, pulse_verdict: forgedPulse };
  delete forgedBody.content_hash;
  const forged = { ...forgedBody, content_hash: `sha256:${sha256(stableStringify(forgedBody))}` };
  const v = verifyNode0LocalMissionHarnessPreview(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("pulse_anchor_invalid"), v.blocked_by.join(", "));
});

// --- purity --------------------------------------------------------------------------------------

test("kernel remains pure: no fs / network / process / clock / random", () => {
  const src = readFileSync(
    fileURLToPath(new URL("../packages/core/src/node0-local-mission-harness-preview.js", import.meta.url)),
    "utf8",
  );
  assert.doesNotMatch(src, /node:fs|node:net|node:child_process|node:http|node:dns/);
  assert.doesNotMatch(src, /Math\.random|Date\.now|new Date\(/);
  assert.doesNotMatch(src, /process\.(env|argv|exit)/);
});
