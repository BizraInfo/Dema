import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  planNode0MissionPilotCockpitPreview,
  buildNode0MissionPilotCockpitPreviewPayload,
  verifyNode0MissionPilotCockpitPreview,
  runNode0MissionPilotCockpitPreview,
  deriveCockpitView,
  node0MissionPilotCockpitPreviewBoundary,
  NODE0_MISSION_PILOT_COCKPIT_PREVIEW_SCHEMA,
  NODE0_MISSION_PILOT_COCKPIT_PREVIEW_TRUTH_LABEL,
  NODE0_MISSION_PILOT_COCKPIT_PREVIEW_GO_PHRASE,
  COCKPIT_VIEW_SCHEMA,
} from "../packages/core/src/node0-mission-pilot-cockpit-preview.js";
import { buildNode0LocalMissionArtifactEmissionPreviewPayload } from "../packages/core/src/node0-local-mission-artifact-emission-preview.js";
import { buildExampleEmissionInput } from "../scripts/review/node0-local-mission-artifact-emission-preview-check.mjs";
import {
  runNode0MissionPilotCockpitPreviewCheck,
  buildExampleCockpitInput,
} from "../scripts/review/node0-mission-pilot-cockpit-preview-check.mjs";

const GO = NODE0_MISSION_PILOT_COCKPIT_PREVIEW_GO_PHRASE;

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

// A fresh, already-verified emission result (embeds harness → pulse → composition → genesis signature).
function buildExampleEmission() {
  return buildNode0LocalMissionArtifactEmissionPreviewPayload(buildExampleEmissionInput());
}
function validInput(overrides = {}) {
  return { emission: buildExampleEmission(), ...overrides };
}
// Forge one artifact body (keeping its stale content_hash unless mutate overrides it), then re-seal the
// emission envelope so only the artifact-level tamper is under test.
function forgeArtifact(name, mutate) {
  const emission = buildExampleEmission();
  const badArt = { ...emission.artifacts[name], ...mutate };
  return rehash({ ...emission, artifacts: { ...emission.artifacts, [name]: badArt } });
}

// --- scaffold contract (kept, not weakened) ------------------------------------------------------

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planNode0MissionPilotCockpitPreview({ consent: "wrong", input: validInput() });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with exact consent and well-formed input", () => {
  const plan = planNode0MissionPilotCockpitPreview({ consent: GO, input: validInput() });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
});

test("payload is content-addressed and carries an all-false boundary", () => {
  const payload = buildNode0MissionPilotCockpitPreviewPayload(validInput());
  assert.equal(payload.schema, NODE0_MISSION_PILOT_COCKPIT_PREVIEW_SCHEMA);
  assert.equal(payload.truth_label, NODE0_MISSION_PILOT_COCKPIT_PREVIEW_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.boundary.execution_allowed, false);
  assert.equal(payload.boundary.live_execution_performed, false);
});

test("verify accepts a freshly built payload", () => {
  const payload = buildNode0MissionPilotCockpitPreviewPayload(validInput());
  const v = verifyNode0MissionPilotCockpitPreview(payload);
  assert.equal(v.ok, true, v.blocked_by.join(", "));
});

test("verify rejects a tampered content_hash", () => {
  const payload = buildNode0MissionPilotCockpitPreviewPayload(validInput());
  const tampered = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  assert.equal(verifyNode0MissionPilotCockpitPreview(tampered).ok, false);
});

test("verify rejects a field change that did not update the content_hash", () => {
  const payload = buildNode0MissionPilotCockpitPreviewPayload(validInput());
  const forged = { ...payload, truth_label: "FORGED" };
  assert.equal(verifyNode0MissionPilotCockpitPreview(forged).ok, false);
});

test("review gate closes the loop: build -> verify -> tamper-reject", () => {
  const result = runNode0MissionPilotCockpitPreviewCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, NODE0_MISSION_PILOT_COCKPIT_PREVIEW_SCHEMA);
  assert.equal(result.truth_label, NODE0_MISSION_PILOT_COCKPIT_PREVIEW_TRUTH_LABEL);
});

test("orchestrator boundary stays all-false (no execution authority)", () => {
  const result = runNode0MissionPilotCockpitPreview({ consent: GO, input: validInput() });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
  assert.equal(result.boundary.live_execution_performed, false);
});

// --- cockpit render contract ---------------------------------------------------------------------

test("renders a cockpit_view with all required operator fields", () => {
  const r = runNode0MissionPilotCockpitPreview({ consent: GO, input: validInput() });
  assert.equal(r.ok, true, r.blocked_by?.join(", "));
  const view = r.cockpit_view;
  assert.equal(view.schema, COCKPIT_VIEW_SCHEMA);
  assert.equal(typeof view.mission_status, "string");
  assert.match(view.run_id, /^[0-9a-f]{16}$/);
  assert.match(view.receipt_hash, /^sha256:[0-9a-f]{64}$/);
  assert.ok(view.gates && typeof view.gates === "object");
  assert.ok(Array.isArray(view.gates.accepted));
  assert.ok(Array.isArray(view.gates.rejected));
  assert.ok(view.world_state_delta_preview && typeof view.world_state_delta_preview === "object");
  assert.ok(view.dema_report && typeof view.dema_report === "object");
  assert.equal(typeof view.what_happened, "string");
  assert.equal(typeof view.what_did_not_happen, "string");
  assert.equal(typeof view.next_safe_action, "string");
});

test("consumes all three artifacts: gates from pulse ladder, receipt hash, delta, dema report", () => {
  const emission = buildExampleEmission();
  const r = runNode0MissionPilotCockpitPreview({ consent: GO, input: { emission } });
  const view = r.cockpit_view;
  // receipt artifact surfaced by hash
  assert.equal(view.receipt_hash, emission.artifacts.receipt.content_hash);
  // world_state_delta artifact surfaced (operation + declared receipt hash)
  assert.equal(view.world_state_delta_preview.operation, emission.artifacts.world_state_delta_preview.operation);
  assert.equal(
    view.world_state_delta_preview.receipt_content_hash,
    emission.artifacts.world_state_delta_preview.declares.receipt_content_hash,
  );
  // dema_report artifact surfaced (status + next_safe_action)
  assert.equal(view.dema_report.status, emission.artifacts.dema_report.status);
  assert.equal(view.dema_report.next_safe_action, emission.artifacts.dema_report.next_safe_action);
  // all eight pulse gates accounted for
  assert.equal(view.gates.accepted.length + view.gates.rejected.length, 8);
});

test("verifies each artifact hash (valid emission passes)", () => {
  const r = runNode0MissionPilotCockpitPreview({ consent: GO, input: validInput() });
  assert.equal(r.ok, true, r.blocked_by?.join(", "));
});

test("refuses a tampered receipt artifact", () => {
  const r = runNode0MissionPilotCockpitPreview({ consent: GO, input: { emission: forgeArtifact("receipt", { mission_id: "TAMPERED" }) } });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("tampered_artifact:receipt"), r.blocked_by.join(", "));
});

test("refuses a tampered world_state_delta_preview artifact", () => {
  const r = runNode0MissionPilotCockpitPreview({ consent: GO, input: { emission: forgeArtifact("world_state_delta_preview", { operation: "TAMPERED_op" }) } });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("tampered_artifact:world_state_delta_preview"), r.blocked_by.join(", "));
});

test("refuses a tampered dema_report artifact", () => {
  const r = runNode0MissionPilotCockpitPreview({ consent: GO, input: { emission: forgeArtifact("dema_report", { status: "TAMPERED_status" }) } });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("tampered_artifact:dema_report"), r.blocked_by.join(", "));
});

test("world_state_delta_preview in the cockpit view shows applied:false", () => {
  const r = runNode0MissionPilotCockpitPreview({ consent: GO, input: validInput() });
  assert.equal(r.cockpit_view.world_state_delta_preview.applied, false);
  assert.equal(r.cockpit_view.world_state_delta_preview.committed_live, false);
});

test("cockpit body invariants: boundary all-false, committed_live false, authority 0, mint false", () => {
  const payload = buildNode0MissionPilotCockpitPreviewPayload(validInput());
  assert.equal(Object.values(payload.boundary).every((v) => v === false), true);
  assert.equal(payload.committed_live, false);
  assert.equal(payload.authority_delta, 0);
  assert.equal(payload.mint_allowed, false);
});

test("run envelope carries mint_allowed:false and authority_delta:0", () => {
  const r = runNode0MissionPilotCockpitPreview({ consent: GO, input: validInput() });
  assert.equal(r.mint_allowed, false);
  assert.equal(r.authority_delta, 0);
});

test("missing artifact rejects", () => {
  const emission = buildExampleEmission();
  const { receipt, ...rest } = emission.artifacts;
  const forged = rehash({ ...emission, artifacts: rest });
  const r = runNode0MissionPilotCockpitPreview({ consent: GO, input: { emission: forged } });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("missing_artifact:receipt"), r.blocked_by.join(", "));
});

test("malformed emission result rejects", () => {
  const r = runNode0MissionPilotCockpitPreview({ consent: GO, input: { emission: { not: "an emission" } } });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.length > 0);
});

test("non-object emission is refused at plan (missing_emission)", () => {
  const r = runNode0MissionPilotCockpitPreview({ consent: GO, input: { emission: null } });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("missing_emission"), r.blocked_by.join(", "));
});

test("deterministic: identical cockpit content_hash + view hash on rebuild from the same input", () => {
  const input = validInput();
  const a = buildNode0MissionPilotCockpitPreviewPayload(input);
  const b = buildNode0MissionPilotCockpitPreviewPayload(input);
  assert.equal(a.content_hash, b.content_hash);
  assert.equal(a.cockpit_view.content_hash, b.cockpit_view.content_hash);
  assert.equal(a.run_id, b.run_id);
});

test("cockpit_view is content-addressed (sha256 over the view body)", () => {
  const payload = buildNode0MissionPilotCockpitPreviewPayload(validInput());
  const view = payload.cockpit_view;
  assert.match(view.content_hash, /^sha256:[0-9a-f]{64}$/);
  const { content_hash, ...body } = view;
  assert.equal(content_hash, `sha256:${sha256(stableStringify(body))}`);
});

test("broken upstream emission/harness anchor rejects (forged + recomputed genesis)", () => {
  const emission = buildExampleEmission();
  const pv = emission.harness_result.pulse_verdict;
  const g = pv.composition_ref.genesis_root;
  const forgedGenesis = {
    ...g,
    signed_receipt_anchor: {
      ...g.signed_receipt_anchor,
      payload: { ...g.signed_receipt_anchor.payload, head_hash: `sha256:${"e".repeat(64)}` },
    },
  };
  const forgedPulse = { ...pv, composition_ref: { ...pv.composition_ref, genesis_root: forgedGenesis } };
  const forgedHarness = rehash({ ...emission.harness_result, pulse_verdict: forgedPulse });
  const forgedEmission = rehash({ ...emission, harness_result: forgedHarness });
  const r = runNode0MissionPilotCockpitPreview({ consent: GO, input: { emission: forgedEmission } });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.some((c) => c.startsWith("emission_verify:")), r.blocked_by.join(", "));
});

test("exact-string consent (GO phrase) is fail-closed at the orchestrator", () => {
  const r = runNode0MissionPilotCockpitPreview({ consent: "GO: wrong phrase", input: validInput() });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("consent_phrase_mismatch"), r.blocked_by.join(", "));
  assert.equal(r.cockpit_view, null);
});

// --- laundering-flag rejections (through the embedded source emission) ---------------------------

for (const flag of ["network_used", "model_invocation_performed", "federation", "wallet_accessed", "daemon_started", "token_minted"]) {
  test(`laundering flag declared on the source emission rejects: ${flag}`, () => {
    const emission = buildExampleEmission();
    const forged = rehash({ ...emission, declared_flags: { ...emission.declared_flags, [flag]: true } });
    const r = runNode0MissionPilotCockpitPreview({ consent: GO, input: { emission: forged } });
    assert.equal(r.ok, false);
    assert.ok(r.blocked_by.includes(`emission_verify:declared_${flag}`), r.blocked_by.join(", "));
  });
}

test("source committed_live:true rejects", () => {
  const forged = rehash({ ...buildExampleEmission(), committed_live: true });
  const r = runNode0MissionPilotCockpitPreview({ consent: GO, input: { emission: forged } });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("source_committed_live_true"), r.blocked_by.join(", "));
});

test("source authority_delta!=0 rejects", () => {
  const forged = rehash({ ...buildExampleEmission(), authority_delta: 4 });
  const r = runNode0MissionPilotCockpitPreview({ consent: GO, input: { emission: forged } });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("source_authority_delta_nonzero"), r.blocked_by.join(", "));
});

test("source mint_allowed:true rejects", () => {
  const forged = rehash({ ...buildExampleEmission(), mint_allowed: true });
  const r = runNode0MissionPilotCockpitPreview({ consent: GO, input: { emission: forged } });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("source_mint_allowed_true"), r.blocked_by.join(", "));
});

test("source boundary flip rejects", () => {
  const emission = buildExampleEmission();
  const forged = rehash({ ...emission, boundary: { ...emission.boundary, network_used: true } });
  const r = runNode0MissionPilotCockpitPreview({ consent: GO, input: { emission: forged } });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("source_boundary_not_all_false"), r.blocked_by.join(", "));
});

test("artifact declaring committed_live:true (self-consistent) rejects", () => {
  const emission = buildExampleEmission();
  const badReceipt = rehash({ ...emission.artifacts.receipt, committed_live: true });
  const forged = rehash({ ...emission, artifacts: { ...emission.artifacts, receipt: badReceipt } });
  const r = runNode0MissionPilotCockpitPreview({ consent: GO, input: { emission: forged } });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("artifact_committed_live:receipt"), r.blocked_by.join(", "));
});

test("artifact with a malformed content_hash rejects", () => {
  const forged = forgeArtifact("receipt", { content_hash: "not-a-sha256" });
  const r = runNode0MissionPilotCockpitPreview({ consent: GO, input: { emission: forged } });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("artifact_hash_malformed:receipt"), r.blocked_by.join(", "));
});

// --- verify guard-path coverage (fail-closed defensive branches) ---------------------------------

test("verify rejects a non-object payload", () => {
  const v = verifyNode0MissionPilotCockpitPreview(null);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("packet_not_object"));
});

test("verify rejects a payload with no source_emission", () => {
  const payload = buildNode0MissionPilotCockpitPreviewPayload(validInput());
  const { source_emission, ...rest } = payload;
  const forged = rehash(rest);
  const v = verifyNode0MissionPilotCockpitPreview(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("source_emission_missing"), v.blocked_by.join(", "));
});

test("verify rejects a payload with no cockpit_view", () => {
  const payload = buildNode0MissionPilotCockpitPreviewPayload(validInput());
  const { cockpit_view, ...rest } = payload;
  const forged = rehash(rest);
  const v = verifyNode0MissionPilotCockpitPreview(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("cockpit_view_missing"), v.blocked_by.join(", "));
});

test("verify rejects a cockpit_view whose hash was not updated after a field change", () => {
  const payload = buildNode0MissionPilotCockpitPreviewPayload(validInput());
  const badView = { ...payload.cockpit_view, mission_status: "HACKED" };
  const forged = rehash({ ...payload, cockpit_view: badView });
  const v = verifyNode0MissionPilotCockpitPreview(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("cockpit_view_hash_mismatch"), v.blocked_by.join(", "));
});

test("verify rejects a self-consistent cockpit_view not derived from the source (view swap)", () => {
  const payload = buildNode0MissionPilotCockpitPreviewPayload(validInput());
  const swapped = rehash({ ...payload.cockpit_view, mission_status: "swapped_but_sealed" });
  const forged = rehash({ ...payload, cockpit_view: swapped });
  const v = verifyNode0MissionPilotCockpitPreview(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("cockpit_view_source_mismatch"), v.blocked_by.join(", "));
});

test("verify rejects a stale source_emission_content_hash ref", () => {
  const payload = buildNode0MissionPilotCockpitPreviewPayload(validInput());
  const forged = rehash({ ...payload, source_emission_content_hash: `sha256:${"1".repeat(64)}` });
  const v = verifyNode0MissionPilotCockpitPreview(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("source_emission_hash_ref_mismatch"), v.blocked_by.join(", "));
});

test("verify rejects a cockpit body with committed_live flipped", () => {
  const payload = buildNode0MissionPilotCockpitPreviewPayload(validInput());
  const forged = rehash({ ...payload, committed_live: true });
  const v = verifyNode0MissionPilotCockpitPreview(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("committed_live_true"), v.blocked_by.join(", "));
});

test("verify rejects a cockpit body with authority_delta flipped", () => {
  const payload = buildNode0MissionPilotCockpitPreviewPayload(validInput());
  const forged = rehash({ ...payload, authority_delta: 9 });
  const v = verifyNode0MissionPilotCockpitPreview(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("authority_delta_nonzero"), v.blocked_by.join(", "));
});

test("verify rejects a cockpit body with mint_allowed flipped", () => {
  const payload = buildNode0MissionPilotCockpitPreviewPayload(validInput());
  const forged = rehash({ ...payload, mint_allowed: true });
  const v = verifyNode0MissionPilotCockpitPreview(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("mint_allowed_true"), v.blocked_by.join(", "));
});

test("verify rejects a cockpit body with a flipped boundary", () => {
  const payload = buildNode0MissionPilotCockpitPreviewPayload(validInput());
  const forged = rehash({ ...payload, boundary: { ...payload.boundary, daemon_started: true } });
  const v = verifyNode0MissionPilotCockpitPreview(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("boundary_not_all_false"), v.blocked_by.join(", "));
});

test("plan rejects a non-object input", () => {
  const plan = planNode0MissionPilotCockpitPreview({ consent: GO, input: null });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("input_not_object"));
});

test("buildPayload with a non-object emission is not cockpit_ready (emission_not_object)", () => {
  const payload = buildNode0MissionPilotCockpitPreviewPayload({ emission: null });
  assert.equal(payload.cockpit_ready, false);
  assert.ok(payload.blocked_by.includes("emission_not_object"), payload.blocked_by.join(", "));
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
});

// --- deriveCockpitView unit branches (rejected gates / reached_station / null guard) --------------

test("deriveCockpitView surfaces rejected gates and the furthest reached station", () => {
  const synthEmission = {
    run_id: "abc0000000000000",
    artifacts: {
      receipt: { content_hash: `sha256:${"a".repeat(64)}` },
      world_state_delta_preview: { operation: "append_preview", applied: false, committed_live: false, note: "n", declares: { would_append_receipt: true, receipt_content_hash: `sha256:${"a".repeat(64)}` } },
      dema_report: { status: "blocked_preview_pulse", next_safe_action: "repair", what_happened: "rejected" },
    },
    harness_result: {
      pulse_verdict: {
        stage_results: [
          { stage: "PERCEIVE", ok: true },
          { stage: "CONSENT", ok: false },
          { stage: "RESOURCE_SELECT", ok: false },
        ],
        blocked_by: ["missing_consent"],
      },
    },
  };
  const view = deriveCockpitView(synthEmission);
  assert.deepEqual([...view.gates.accepted], ["PERCEIVE"]);
  assert.ok(view.gates.rejected.includes("CONSENT"));
  assert.equal(view.gates.reached_station, "PERCEIVE");
  assert.deepEqual([...view.gates.blocked_by], ["missing_consent"]);
  assert.equal(view.mission_status, "blocked_preview_pulse");
});

test("deriveCockpitView with a first-stage failure reports reached_station null", () => {
  const view = deriveCockpitView({
    run_id: "def0000000000000",
    artifacts: {},
    harness_result: { pulse_verdict: { stage_results: [{ stage: "PERCEIVE", ok: false }] } },
  });
  assert.equal(view.gates.reached_station, null);
  assert.deepEqual([...view.gates.accepted], []);
});

test("deriveCockpitView tolerates a null/empty emission (all-null view, still content-addressed)", () => {
  const view = deriveCockpitView(null);
  assert.equal(view.schema, COCKPIT_VIEW_SCHEMA);
  assert.equal(view.mission_status, null);
  assert.equal(view.receipt_hash, null);
  assert.deepEqual([...view.gates.accepted], []);
  assert.deepEqual([...view.gates.blocked_by], []);
  assert.match(view.content_hash, /^sha256:[0-9a-f]{64}$/);
});

test("boundary helper is all-false and frozen", () => {
  const b = node0MissionPilotCockpitPreviewBoundary();
  assert.equal(Object.values(b).every((v) => v === false), true);
  assert.equal(Object.isFrozen(b), true);
});

test("example cockpit input builds a verifiable emission", () => {
  const { emission } = buildExampleCockpitInput();
  const r = runNode0MissionPilotCockpitPreview({ consent: GO, input: { emission } });
  assert.equal(r.ok, true, r.blocked_by?.join(", "));
});

// --- purity --------------------------------------------------------------------------------------

test("kernel remains pure: no fs / network / process / clock / random", () => {
  const src = readFileSync(
    fileURLToPath(new URL("../packages/core/src/node0-mission-pilot-cockpit-preview.js", import.meta.url)),
    "utf8",
  );
  assert.doesNotMatch(src, /node:fs|node:net|node:child_process|node:http|node:dns/);
  assert.doesNotMatch(src, /Math\.random|Date\.now|new Date\(/);
  assert.doesNotMatch(src, /process\.(env|argv|exit)/);
});
