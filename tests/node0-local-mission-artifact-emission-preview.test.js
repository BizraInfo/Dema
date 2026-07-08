import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  planNode0LocalMissionArtifactEmissionPreview,
  buildNode0LocalMissionArtifactEmissionPreviewPayload,
  verifyNode0LocalMissionArtifactEmissionPreview,
  runNode0LocalMissionArtifactEmissionPreview,
  ARTIFACT_NAMES,
  NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_SCHEMA,
  NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_TRUTH_LABEL,
  NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_GO_PHRASE,
} from "../packages/core/src/node0-local-mission-artifact-emission-preview.js";
import {
  runNode0LocalMissionArtifactEmissionPreviewCheck,
  buildExampleEmissionInput,
} from "../scripts/review/node0-local-mission-artifact-emission-preview-check.mjs";

const GO = NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_GO_PHRASE;

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
function rehash(body) {
  const { content_hash, ...rest } = body;
  return { ...rest, content_hash: `sha256:${sha256(stableStringify(rest))}` };
}
// Fresh, independently-valid emitter input (a real harness result). Each call rebuilds the
// signature-backed anchor, so REUSE one input when asserting determinism.
function validInput(overrides = {}) {
  return { ...buildExampleEmissionInput(), ...overrides };
}

// --- scaffold contract (kept, not weakened) ------------------------------------------------------

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planNode0LocalMissionArtifactEmissionPreview({ consent: "wrong", input: validInput() });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with exact consent and well-formed input", () => {
  const plan = planNode0LocalMissionArtifactEmissionPreview({ consent: GO, input: validInput() });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
});

test("payload is content-addressed and carries an all-false boundary", () => {
  const payload = buildNode0LocalMissionArtifactEmissionPreviewPayload(validInput());
  assert.equal(payload.schema, NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_SCHEMA);
  assert.equal(payload.truth_label, NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.boundary.execution_allowed, false);
  assert.equal(payload.boundary.live_execution_performed, false);
});

test("verify accepts a freshly built payload", () => {
  const payload = buildNode0LocalMissionArtifactEmissionPreviewPayload(validInput());
  const v = verifyNode0LocalMissionArtifactEmissionPreview(payload);
  assert.equal(v.ok, true, v.blocked_by.join(", "));
});

test("verify rejects a tampered content_hash", () => {
  const payload = buildNode0LocalMissionArtifactEmissionPreviewPayload(validInput());
  const tampered = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  assert.equal(verifyNode0LocalMissionArtifactEmissionPreview(tampered).ok, false);
});

test("verify rejects a field change that did not update the content_hash", () => {
  const payload = buildNode0LocalMissionArtifactEmissionPreviewPayload(validInput());
  const forged = { ...payload, truth_label: "FORGED" };
  assert.equal(verifyNode0LocalMissionArtifactEmissionPreview(forged).ok, false);
});

test("review gate closes the loop: build -> verify -> tamper-reject", () => {
  const result = runNode0LocalMissionArtifactEmissionPreviewCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_SCHEMA);
  assert.equal(result.truth_label, NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_TRUTH_LABEL);
});

test("orchestrator boundary stays all-false (no execution authority)", () => {
  const result = runNode0LocalMissionArtifactEmissionPreview({ consent: GO, input: validInput() });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
  assert.equal(result.boundary.live_execution_performed, false);
});

// --- emission contract ---------------------------------------------------------------------------

test("emits exactly three artifacts: receipt, world_state_delta_preview, dema_report", () => {
  const r = runNode0LocalMissionArtifactEmissionPreview({ consent: GO, input: validInput() });
  assert.equal(r.ok, true, r.blocked_by?.join(", "));
  assert.deepEqual(Object.keys(r.artifacts).sort(), [...ARTIFACT_NAMES].sort());
  assert.equal(Object.keys(r.artifacts).length, 3);
  assert.equal(r.artifact_paths.length, 3);
  assert.ok(r.artifacts.receipt, "receipt exists");
  assert.ok(r.artifacts.world_state_delta_preview, "world_state_delta_preview exists");
  assert.ok(r.artifacts.dema_report, "dema_report exists");
});

test("all three artifacts are JSON-serializable objects", () => {
  const r = runNode0LocalMissionArtifactEmissionPreview({ consent: GO, input: validInput() });
  for (const name of ARTIFACT_NAMES) {
    const art = r.artifacts[name];
    const round = JSON.parse(JSON.stringify(art));
    assert.equal(typeof round, "object");
    assert.equal(round.content_hash, art.content_hash);
  }
});

test("all three artifacts are content-addressed (sha256:...)", () => {
  const r = runNode0LocalMissionArtifactEmissionPreview({ consent: GO, input: validInput() });
  for (const name of ARTIFACT_NAMES) {
    assert.match(r.artifacts[name].content_hash, /^sha256:[0-9a-f]{64}$/);
    assert.equal(r.artifacts[name].committed_live, false);
  }
});

test("world_state delta is a declared, not-applied preview", () => {
  const r = runNode0LocalMissionArtifactEmissionPreview({ consent: GO, input: validInput() });
  const wsd = r.artifacts.world_state_delta_preview;
  assert.equal(wsd.applied, false);
  assert.equal(wsd.committed_live, false);
  assert.equal(wsd.operation, "append_preview");
  assert.equal(wsd.declares.would_append_receipt, true);
  assert.equal(wsd.declares.receipt_content_hash, r.artifacts.receipt.content_hash);
});

test("dema_report artifact carries status + next_safe_action", () => {
  const r = runNode0LocalMissionArtifactEmissionPreview({ consent: GO, input: validInput() });
  const dr = r.artifacts.dema_report;
  assert.equal(typeof dr.status, "string");
  assert.equal(typeof dr.next_safe_action, "string");
});

test("deterministic: identical run_id and artifact hashes on rebuild from the same input", () => {
  const input = validInput();
  const a = buildNode0LocalMissionArtifactEmissionPreviewPayload(input);
  const b = buildNode0LocalMissionArtifactEmissionPreviewPayload(input);
  assert.equal(a.run_id, b.run_id);
  assert.equal(a.content_hash, b.content_hash);
  for (const name of ARTIFACT_NAMES) {
    assert.equal(a.artifacts[name].content_hash, b.artifacts[name].content_hash);
  }
});

test("run_id and target dirs are stable and bounded", () => {
  const r = runNode0LocalMissionArtifactEmissionPreview({ consent: GO, input: validInput() });
  assert.match(r.run_id, /^[0-9a-f]{16}$/);
  for (const name of ARTIFACT_NAMES) {
    const expected = new RegExp(`^artifacts/proofs/node0-local-mission/${r.run_id}/${name}\\.json$`);
    assert.ok(
      r.artifact_paths.some((p) => expected.test(p)),
      `${name} path missing in ${r.artifact_paths.join(", ")}`,
    );
  }
});

// --- fail-closed rejections ----------------------------------------------------------------------

function rejects(overrides, code) {
  const r = runNode0LocalMissionArtifactEmissionPreview({ consent: GO, input: validInput(overrides) });
  assert.equal(r.ok, false, `expected reject for ${code}`);
  assert.ok(
    r.blocked_by.some((c) => c === code || c.startsWith(code)),
    `${code} not in [${r.blocked_by.join(", ")}]`,
  );
}

test("missing mission (harness) result rejects", () => {
  const r = runNode0LocalMissionArtifactEmissionPreview({ consent: GO, input: { harness_result: undefined } });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("missing_harness_result"), r.blocked_by.join(", "));
});

test("malformed pulse result rejects (broken harness pulse_verdict)", () => {
  const input = validInput();
  const broken = rehash({ ...input.harness_result, pulse_verdict: { schema: "bogus" } });
  const r = runNode0LocalMissionArtifactEmissionPreview({ consent: GO, input: { harness_result: broken } });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.some((c) => c.startsWith("harness_verify:")), r.blocked_by.join(", "));
});

test("committed_live:true rejects (forged + recomputed receipt artifact)", () => {
  const payload = buildNode0LocalMissionArtifactEmissionPreviewPayload(validInput());
  const forgedReceipt = rehash({ ...payload.artifacts.receipt, committed_live: true });
  const forgedBody = rehash({
    ...payload,
    artifacts: { ...payload.artifacts, receipt: forgedReceipt },
  });
  const v = verifyNode0LocalMissionArtifactEmissionPreview(forgedBody);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("artifact_committed_live:receipt"), v.blocked_by.join(", "));
});

test("authority_delta>0 rejects", () => rejects({ authority_delta: 5 }, "emitter_authority_delta_nonzero"));
test("mint_allowed:true rejects", () => rejects({ mint_allowed: true }, "emitter_mint_allowed"));
test("request_live_commit:true rejects", () => rejects({ request_live_commit: true }, "emitter_request_live_commit"));
test("network_used:true (declared) rejects", () => rejects({ declared_flags: { network_used: true } }, "declared_network_used"));
test("model_invocation_performed:true (declared) rejects", () => rejects({ declared_flags: { model_invocation_performed: true } }, "declared_model_invocation_performed"));
test("federation:true (declared) rejects", () => rejects({ declared_flags: { federation: true } }, "declared_federation"));
test("wallet_accessed:true (declared) rejects", () => rejects({ declared_flags: { wallet_accessed: true } }, "declared_wallet_accessed"));
test("daemon_started:true (declared) rejects", () => rejects({ declared_flags: { daemon_started: true } }, "declared_daemon_started"));
test("token_minted:true (declared) rejects", () => rejects({ declared_flags: { token_minted: true } }, "declared_token_minted"));

test("raw source content copied into an artifact rejects", () => {
  const payload = buildNode0LocalMissionArtifactEmissionPreviewPayload(validInput());
  const leaked = rehash({ ...payload.artifacts.receipt, raw_content: "SECRET file bytes leaked into the artifact" });
  const forgedBody = rehash({ ...payload, artifacts: { ...payload.artifacts, receipt: leaked } });
  const v = verifyNode0LocalMissionArtifactEmissionPreview(forgedBody);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("raw_content_leaked:receipt:raw_content"), v.blocked_by.join(", "));
});

test("tampered artifact content_hash rejects", () => {
  const payload = buildNode0LocalMissionArtifactEmissionPreviewPayload(validInput());
  const badReceipt = { ...payload.artifacts.receipt, content_hash: `sha256:${"0".repeat(64)}` };
  const forgedBody = rehash({ ...payload, artifacts: { ...payload.artifacts, receipt: badReceipt } });
  const v = verifyNode0LocalMissionArtifactEmissionPreview(forgedBody);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("artifact_content_hash_mismatch:receipt"), v.blocked_by.join(", "));
});

test("forge-and-recompute laundering rejects (upstream pulse/composition/genesis anchor broken)", () => {
  const payload = buildNode0LocalMissionArtifactEmissionPreviewPayload(validInput());
  const pv = payload.harness_result.pulse_verdict;
  const g = pv.composition_ref.genesis_root;
  const forgedGenesis = {
    ...g,
    signed_receipt_anchor: {
      ...g.signed_receipt_anchor,
      payload: { ...g.signed_receipt_anchor.payload, head_hash: `sha256:${"e".repeat(64)}` },
    },
  };
  const forgedPulse = { ...pv, composition_ref: { ...pv.composition_ref, genesis_root: forgedGenesis } };
  const forgedHarness = rehash({ ...payload.harness_result, pulse_verdict: forgedPulse });
  const forgedBody = rehash({ ...payload, harness_result: forgedHarness });
  const v = verifyNode0LocalMissionArtifactEmissionPreview(forgedBody);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("harness_anchor_invalid"), v.blocked_by.join(", "));
});

// --- guard-path coverage (fail-closed defensive branches) ----------------------------------------

test("plan rejects a non-object input", () => {
  const plan = planNode0LocalMissionArtifactEmissionPreview({ consent: GO, input: null });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("input_not_object"));
});

test("verify rejects a non-object payload", () => {
  const v = verifyNode0LocalMissionArtifactEmissionPreview(null);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("packet_not_object"));
});

test("verify rejects a payload whose artifacts field is not an object", () => {
  const payload = buildNode0LocalMissionArtifactEmissionPreviewPayload(validInput());
  const forged = rehash({ ...payload, artifacts: "nope" });
  const v = verifyNode0LocalMissionArtifactEmissionPreview(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("artifacts_missing"), v.blocked_by.join(", "));
});

test("verify rejects a payload with a null artifact", () => {
  const payload = buildNode0LocalMissionArtifactEmissionPreviewPayload(validInput());
  const forged = rehash({ ...payload, artifacts: { ...payload.artifacts, receipt: null } });
  const v = verifyNode0LocalMissionArtifactEmissionPreview(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("artifact_missing:receipt"), v.blocked_by.join(", "));
});

test("verify rejects a flipped emission boundary", () => {
  const payload = buildNode0LocalMissionArtifactEmissionPreviewPayload(validInput());
  const forged = rehash({ ...payload, boundary: { ...payload.boundary, network_used: true } });
  const v = verifyNode0LocalMissionArtifactEmissionPreview(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("boundary_not_all_false"), v.blocked_by.join(", "));
});

test("verify rejects a laundering flag declared on the emission payload", () => {
  const payload = buildNode0LocalMissionArtifactEmissionPreviewPayload(validInput());
  const forged = rehash({ ...payload, declared_flags: { ...payload.declared_flags, federation: true } });
  const v = verifyNode0LocalMissionArtifactEmissionPreview(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("declared_federation"), v.blocked_by.join(", "));
});

test("build with a harness result lacking a content hash yields run_id 'unknown' and stays not-ready", () => {
  const payload = buildNode0LocalMissionArtifactEmissionPreviewPayload({ harness_result: { note: "no hash here" } });
  assert.equal(payload.run_id, "unknown");
  assert.equal(payload.emission_ready, false);
});

test("nested raw content inside an array is detected", () => {
  const payload = buildNode0LocalMissionArtifactEmissionPreviewPayload(validInput());
  const leaked = rehash({ ...payload.artifacts.receipt, notes: [{ raw_content: "nested secret bytes" }] });
  const forged = rehash({ ...payload, artifacts: { ...payload.artifacts, receipt: leaked } });
  const v = verifyNode0LocalMissionArtifactEmissionPreview(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("raw_content_leaked:receipt:raw_content"), v.blocked_by.join(", "));
});

// --- purity --------------------------------------------------------------------------------------

test("kernel remains pure: no fs / network / process / clock / random", () => {
  const src = readFileSync(
    fileURLToPath(new URL("../packages/core/src/node0-local-mission-artifact-emission-preview.js", import.meta.url)),
    "utf8",
  );
  assert.doesNotMatch(src, /node:fs|node:net|node:child_process|node:http|node:dns/);
  assert.doesNotMatch(src, /Math\.random|Date\.now|new Date\(/);
  assert.doesNotMatch(src, /process\.(env|argv|exit)/);
});
