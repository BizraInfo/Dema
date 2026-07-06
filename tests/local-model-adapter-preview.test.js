import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  planLocalModelAdapterPreview,
  buildLocalModelAdapterPreviewPayload,
  verifyLocalModelAdapterPreview,
  runLocalModelAdapterPreview,
  LOCAL_MODEL_ADAPTER_PREVIEW_SCHEMA,
  LOCAL_MODEL_ADAPTER_PREVIEW_TRUTH_LABEL,
  LOCAL_MODEL_ADAPTER_PREVIEW_GO_PHRASE,
} from "../packages/core/src/local-model-adapter-preview.js";
import { runLocalModelAdapterPreviewCheck } from "../scripts/review/local-model-adapter-preview-check.mjs";

// RED-FIRST: each test encodes part of the LOCAL-MODEL-ADAPTER-PREVIEW-1A proof contract. They fail until
// the kernel bodies are implemented. Build to green — do not soften the asserts.

// Mirrors the real `dema models discover` report shape
// (bizra.dema.model_discover.v0.1: provider_discovery + prefixed model names).
const FIXTURE_INPUT = {
  discovery: {
    schema: "bizra.dema.model_discover.v0.1",
    provider_discovery: {
      ollama: { reachable: true, model_count: 2 },
      lm_studio: { reachable: false, model_count: 0 },
      llamacpp: { reachable: false, model_count: 0 },
    },
    models: ["ollama:whiterabbitneo-v3:7b-q4_K_M", "ollama:nomic-embed-text:latest"],
  },
};

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planLocalModelAdapterPreview({ consent: "wrong", input: {} });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with exact consent and well-formed input", () => {
  const plan = planLocalModelAdapterPreview({ consent: LOCAL_MODEL_ADAPTER_PREVIEW_GO_PHRASE, input: FIXTURE_INPUT });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
});

test("payload is content-addressed and carries an all-false boundary", () => {
  const payload = buildLocalModelAdapterPreviewPayload(FIXTURE_INPUT);
  assert.equal(payload.schema, LOCAL_MODEL_ADAPTER_PREVIEW_SCHEMA);
  assert.equal(payload.truth_label, LOCAL_MODEL_ADAPTER_PREVIEW_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.boundary.execution_allowed, false);
  assert.equal(payload.boundary.live_execution_performed, false);
});

test("verify accepts a freshly built payload", () => {
  const payload = buildLocalModelAdapterPreviewPayload(FIXTURE_INPUT);
  assert.equal(verifyLocalModelAdapterPreview(payload).ok, true);
});

test("verify rejects a tampered content_hash", () => {
  const payload = buildLocalModelAdapterPreviewPayload(FIXTURE_INPUT);
  const tampered = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  assert.equal(verifyLocalModelAdapterPreview(tampered).ok, false);
});

test("verify rejects a field change that did not update the content_hash", () => {
  // Internal-consistency check: a field changed but the stored hash did not, so
  // recompute-over-body must differ from content_hash.
  //
  // NOTE the harder launder this scaffold does NOT yet defend against: changing a
  // field AND recomputing the hash so the body is self-consistent. Internal
  // consistency alone cannot catch that — you need an INDEPENDENT anchor
  // (a signature over the payload, or an externally measured state hash). When
  // this slice gains one, add a test that forges + recomputes and still expects
  // rejection. Until then, do not claim launder-resistance.
  const payload = buildLocalModelAdapterPreviewPayload(FIXTURE_INPUT);
  const forged = { ...payload, truth_label: "FORGED" };
  assert.equal(verifyLocalModelAdapterPreview(forged).ok, false);
});

test("review gate closes the loop: build -> verify -> tamper-reject", () => {
  const result = runLocalModelAdapterPreviewCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, LOCAL_MODEL_ADAPTER_PREVIEW_SCHEMA);
  assert.equal(result.truth_label, LOCAL_MODEL_ADAPTER_PREVIEW_TRUTH_LABEL);
});

test("orchestrator boundary stays all-false (no execution authority)", () => {
  const result = runLocalModelAdapterPreview({ consent: LOCAL_MODEL_ADAPTER_PREVIEW_GO_PHRASE, input: FIXTURE_INPUT });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
  assert.equal(result.boundary.live_execution_performed, false);
});

test("model is always null and runtime derives from first reachable provider", () => {
  const payload = buildLocalModelAdapterPreviewPayload(FIXTURE_INPUT);
  assert.equal(payload.model, null);
  assert.equal(payload.mode, "preview_only");
  assert.equal(payload.runtime, "ollama");
  assert.equal(payload.models_visible.length, 2);
});

test("no reachable provider derives runtime unknown, never a guess", () => {
  const payload = buildLocalModelAdapterPreviewPayload({
    discovery: {
      provider_discovery: { ollama: { reachable: false }, lm_studio: { reachable: false } },
      models: [],
    },
  });
  assert.equal(payload.runtime, "unknown");
  assert.equal(verifyLocalModelAdapterPreview(payload).ok, true);
});

test("verify rejects a laundered envelope: model forged AND hash recomputed", () => {
  // The field contract is the independent anchor here: model must be null, so a
  // self-consistent body claiming a live model still fails.
  const payload = buildLocalModelAdapterPreviewPayload(FIXTURE_INPUT);
  const { content_hash: _drop, ...body } = { ...payload, model: "ollama:forged-live-claim" };
  const laundered = verifyLocalModelAdapterPreview({
    ...body,
    content_hash: rehash(body),
  });
  assert.equal(laundered.ok, false);
  assert.ok(laundered.blocked_by.includes("model_not_null"));
});

test("verify rejects a laundered non-canonical boundary, including empty {}", () => {
  const payload = buildLocalModelAdapterPreviewPayload(FIXTURE_INPUT);
  const { content_hash: _drop, ...body } = { ...payload, boundary: {} };
  const laundered = verifyLocalModelAdapterPreview({ ...body, content_hash: rehash(body) });
  assert.equal(laundered.ok, false);
  assert.ok(laundered.blocked_by.includes("boundary_not_canonical_all_false"));
});

test("forbidden fields are refused at plan time and at verify time", () => {
  const dirtyInput = { discovery: { ...FIXTURE_INPUT.discovery, wallet: "0xdead" } };
  const plan = planLocalModelAdapterPreview({ consent: LOCAL_MODEL_ADAPTER_PREVIEW_GO_PHRASE, input: dirtyInput });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("forbidden_field_present:wallet"));

  const payload = buildLocalModelAdapterPreviewPayload(FIXTURE_INPUT);
  const { content_hash: _drop, ...body } = { ...payload, mint: true };
  const laundered = verifyLocalModelAdapterPreview({ ...body, content_hash: rehash(body) });
  assert.equal(laundered.ok, false);
  assert.ok(laundered.blocked_by.includes("forbidden_field_present:mint"));
});

// Recompute a content hash the same way the kernel does, for launder fixtures.
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
