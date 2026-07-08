import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  planLocalModelPulseBindingPreview,
  buildLocalModelPulseBindingPreviewPayload,
  verifyLocalModelPulseBindingPreview,
  runLocalModelPulseBindingPreview,
  evaluateLocalModelInvocationForPulse,
  LOCAL_MODEL_PULSE_BINDING_PREVIEW_SCHEMA,
  LOCAL_MODEL_PULSE_BINDING_PREVIEW_TRUTH_LABEL,
  LOCAL_MODEL_PULSE_BINDING_PREVIEW_GO_PHRASE,
} from "../packages/core/src/local-model-pulse-binding-preview.js";
import {
  exampleCompletedInvocationResult,
  exampleBlockedInvocationResult,
} from "../scripts/review/local-model-pulse-binding-fixtures.mjs";
import { runLocalModelPulseBindingPreviewCheck } from "../scripts/review/local-model-pulse-binding-preview-check.mjs";

const GO = LOCAL_MODEL_PULSE_BINDING_PREVIEW_GO_PHRASE;
const H = (c) => `sha256:${c.repeat(64)}`;
const INPUT = () => ({
  mission_id: "mission-local-model-1a",
  pulse_receipt_ref: H("a"),
  invocation_result: exampleCompletedInvocationResult(),
});

function rehash(body) {
  const stable = (v) => {
    if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
    if (v && typeof v === "object") {
      return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
    }
    return JSON.stringify(v);
  };
  return `sha256:${createHash("sha256").update(stable(body), "utf8").digest("hex")}`;
}

test("plan is fail-closed without exact consent and eligible with valid input", () => {
  assert.equal(planLocalModelPulseBindingPreview({ consent: "no", input: INPUT() }).eligible, false);
  const ok = planLocalModelPulseBindingPreview({ consent: GO, input: INPUT() });
  assert.equal(ok.eligible, true, ok.blocked_by.join(","));
});

test("plan rejects malformed input, missing invocation, missing mission, and bad pulse ref", () => {
  assert.ok(planLocalModelPulseBindingPreview({ consent: GO, input: null }).blocked_by.includes("input_not_object"));
  assert.ok(planLocalModelPulseBindingPreview({ consent: GO, input: { mission_id: "m", pulse_receipt_ref: null } }).blocked_by.includes("invocation_result_missing"));
  assert.ok(planLocalModelPulseBindingPreview({ consent: GO, input: { invocation_result: exampleCompletedInvocationResult(), pulse_receipt_ref: null } }).blocked_by.includes("mission_id_missing"));
  assert.ok(planLocalModelPulseBindingPreview({ consent: GO, input: { ...INPUT(), pulse_receipt_ref: "bad" } }).blocked_by.includes("pulse_receipt_ref_malformed"));
});

test("completed PUBLIC_SAFE suggestion is admissible", () => {
  const ev = evaluateLocalModelInvocationForPulse(exampleCompletedInvocationResult());
  assert.equal(ev.ok, true, ev.blocked_by.join(","));
  assert.equal(ev.suggestion_admissible, true);
  assert.equal(ev.failure_recordable, false);
});

test("blocked and failed invocations are recordable as failure evidence, not suggestions", () => {
  const blocked = evaluateLocalModelInvocationForPulse(exampleBlockedInvocationResult());
  assert.equal(blocked.ok, true, blocked.blocked_by.join(","));
  assert.equal(blocked.suggestion_admissible, false);
  assert.equal(blocked.failure_recordable, true);
  const failed = evaluateLocalModelInvocationForPulse({ ...exampleCompletedInvocationResult(), invocation_status: "failed", truth_label: "INVOCATION_FAILED" });
  assert.equal(failed.ok, true, failed.blocked_by.join(","));
  assert.equal(failed.failure_recordable, true);
});

test("unsafe completed prompt or response is rejected", () => {
  const badPrompt = evaluateLocalModelInvocationForPulse({ ...exampleCompletedInvocationResult(), prompt_safety_verdict: "FORBIDDEN_LIVE_CLAIM" });
  assert.equal(badPrompt.ok, false);
  assert.ok(badPrompt.blocked_by.includes("prompt_not_public_safe"));
  const badResponse = evaluateLocalModelInvocationForPulse({ ...exampleCompletedInvocationResult(), response_safety_verdict: "SECRET_LIKE" });
  assert.equal(badResponse.ok, false);
  assert.ok(badResponse.blocked_by.includes("response_not_public_safe"));
});

test("invalid schema/status/role/boundary are rejected", () => {
  assert.ok(evaluateLocalModelInvocationForPulse(null).blocked_by.includes("invocation_schema_mismatch"));
  assert.ok(evaluateLocalModelInvocationForPulse({ ...exampleCompletedInvocationResult(), schema: "x" }).blocked_by.includes("invocation_schema_mismatch"));
  assert.ok(evaluateLocalModelInvocationForPulse({ ...exampleCompletedInvocationResult(), invocation_status: "weird" }).blocked_by.includes("invocation_status_invalid"));
  assert.ok(evaluateLocalModelInvocationForPulse({ ...exampleCompletedInvocationResult(), verdict_role: "authority" }).blocked_by.includes("verdict_role_not_suggestion"));
  const badBoundary = { ...exampleCompletedInvocationResult().boundary, federation_invoked: true };
  assert.ok(evaluateLocalModelInvocationForPulse({ ...exampleCompletedInvocationResult(), boundary: badBoundary }).blocked_by.includes("runtime_strict_key_violation"));
});

test("payload is content-addressed, suggestion-only, all-false binding boundary", () => {
  const p = buildLocalModelPulseBindingPreviewPayload(INPUT());
  assert.equal(p.schema, LOCAL_MODEL_PULSE_BINDING_PREVIEW_SCHEMA);
  assert.equal(p.truth_label, LOCAL_MODEL_PULSE_BINDING_PREVIEW_TRUTH_LABEL);
  assert.match(p.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(p.suggestion_admissible, true);
  assert.equal(p.public_claim_safe, false);
  assert.equal(p.action_allowed, false);
  assert.equal(p.authority_delta, 0);
  assert.equal(p.boundary.model_invocation_performed, false);
});

test("verify accepts fresh payload and rejects content hash tamper", () => {
  const p = buildLocalModelPulseBindingPreviewPayload(INPUT());
  assert.equal(verifyLocalModelPulseBindingPreview(p).ok, true);
  assert.equal(verifyLocalModelPulseBindingPreview({ ...p, content_hash: H("0") }).ok, false);
});

test("verify rejects authority, public-claim, mint, wallet, federation laundering with recomputed hash", () => {
  const p = buildLocalModelPulseBindingPreviewPayload(INPUT());
  for (const [field, value, code] of [
    ["authority_delta", 1, "authority_delta_nonzero"],
    ["grants_action", true, "grants_action_true"],
    ["public_claim_safe", true, "public_claim_safe_true"],
    ["action_allowed", true, "action_allowed_true"],
    ["mint_allowed", true, "mint_allowed_true"],
    ["wallet_used", true, "wallet_used_true"],
    ["federation_live", true, "federation_live_true"],
  ]) {
    const { content_hash: _drop, ...body } = { ...p, [field]: value };
    const verdict = verifyLocalModelPulseBindingPreview({ ...body, content_hash: rehash(body) });
    assert.equal(verdict.ok, false, field);
    assert.ok(verdict.blocked_by.includes(code), code);
  }
});

test("verify rejects malformed references and state contradictions", () => {
  const p = buildLocalModelPulseBindingPreviewPayload(INPUT());
  for (const patch of [
    { mission_id: "" },
    { pulse_receipt_ref: "bad" },
    { source_invocation_ref: "bad" },
    { source_schema: "x" },
    { verdict_role: "authority" },
    { mode: "live" },
    { schema: "x" },
    { truth_label: "x" },
    { boundary: {} },
    { suggestion_admissible: true, failure_recordable: true },
    { suggestion_admissible: false, failure_recordable: false },
    { invocation_status: "failed", suggestion_admissible: true },
    { prompt_safety_verdict: "BAD", suggestion_admissible: true },
    { response_safety_verdict: "BAD", suggestion_admissible: true },
    { evaluation_blocked_by: "nope" },
    { evaluation_blocked_by: ["x"], suggestion_admissible: true },
  ]) {
    const { content_hash: _drop, ...body } = { ...p, ...patch };
    assert.equal(verifyLocalModelPulseBindingPreview({ ...body, content_hash: rehash(body) }).ok, false, JSON.stringify(patch));
  }
});

test("run closes the loop and rejects tamper probes", () => {
  const r = runLocalModelPulseBindingPreview({ consent: GO, input: INPUT() });
  assert.equal(r.ok, true, r.blocked_by?.join(","));
  assert.equal(r.status, "local_model_suggestion_bound");
  assert.equal(r.action_allowed, false);
  assert.equal(r.boundary.network_used, false);
});

test("review gate passes with the canonical completed fixture", () => {
  const r = runLocalModelPulseBindingPreviewCheck();
  assert.equal(r.ok, true, r.blocked_by?.join(","));
  assert.equal(r.schema, LOCAL_MODEL_PULSE_BINDING_PREVIEW_SCHEMA);
  assert.equal(r.truth_label, LOCAL_MODEL_PULSE_BINDING_PREVIEW_TRUTH_LABEL);
});

test("run blocks wrong consent and malformed invocation", () => {
  assert.equal(runLocalModelPulseBindingPreview({ consent: "no", input: INPUT() }).ok, false);
  const r = runLocalModelPulseBindingPreview({ consent: GO, input: { ...INPUT(), invocation_result: { schema: "bad" } } });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.length > 0);
});

test("kernel remains pure: no fs / network / process / clock / random", () => {
  const src = readFileSync(
    fileURLToPath(new URL("../packages/core/src/local-model-pulse-binding-preview.js", import.meta.url)),
    "utf8",
  );
  assert.doesNotMatch(src, /node:fs|node:net|node:child_process|node:http|node:dns/);
  assert.doesNotMatch(src, /Math\.random|Date\.now|new Date\(/);
  assert.doesNotMatch(src, /process\.(env|argv|exit)/);
});
