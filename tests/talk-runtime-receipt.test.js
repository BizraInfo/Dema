// LOCAL-TALK-RUNTIME-RECEIPT-1A — pure runtime-receipt kernel tests.
// Records METADATA about a live talk invocation as local evidence: provider,
// model, endpoint, duration, lengths, safety verdicts, a HASH of the consent
// phrase, the runtime boundary, and "no task executed". It must NOT store the
// raw prompt or raw response — privacy by construction.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import {
  buildTalkRuntimeReceipt,
  TALK_RUNTIME_RECEIPT_SCHEMA,
} from "../packages/core/src/talk-runtime-receipt.js";

const MODULE_PATH = fileURLToPath(
  new URL("../packages/core/src/talk-runtime-receipt.js", import.meta.url),
);

// A representative completed live-talk result (the shape invokeDemaTalkLive emits).
const COMPLETED = Object.freeze({
  schema: "bizra.dema.talk_loop_live_result.v0.1",
  invocation_status: "completed",
  provider: "lmstudio",
  model: "qwen2.5",
  target_endpoint: "http://localhost:1234/v1",
  endpoint_family: "openai_compatible",
  duration_ms: 1234,
  prompt_length_chars: 11,
  response_length_chars: 42,
  response_text_preview: "TOPSECRET_RESPONSE_BODY_SHOULD_NOT_PERSIST",
  prompt_safety_verdict: "LOCAL_TALK_OK",
  response_safety_verdict: "LOCAL_TALK_OK",
  verdict_role: "suggestion",
  consent_phrase_verified: true,
  boundary: Object.freeze({
    model_invocation_performed: true,
    model_loaded: true,
    prompt_executed: true,
    network_used: true,
    runtime_execution_performed: true,
    consent_collected: true,
    tool_executed: false,
    filesystem_write_performed: false,
    receipt_mint_performed: false,
    federation_invoked: false,
  }),
});

// Every key the receipt embeds, recursively — used to assert it never carries a
// false filesystem/mint claim from inside a written file.
function allKeys(obj, acc = new Set()) {
  if (!obj || typeof obj !== "object") return acc;
  for (const [k, v] of Object.entries(obj)) {
    acc.add(k);
    if (v && typeof v === "object") allKeys(v, acc);
  }
  return acc;
}

const CONSENT = "GO: invoke local LLM via lmstudio at qwen2.5";

test("schema + truth_label exact; deep-frozen", () => {
  const r = buildTalkRuntimeReceipt({ result: COMPLETED, consentPhrase: CONSENT, recordedAtIso: "2026-06-22T14:00:00.000Z" });
  assert.equal(r.schema, "bizra.dema.talk_runtime_receipt.v0.1");
  assert.equal(r.schema, TALK_RUNTIME_RECEIPT_SCHEMA);
  assert.equal(r.truth_label, "DEMA_TALK_RUNTIME_RECEIPT_LOCAL_ONLY");
  assert.equal(Object.isFrozen(r), true);
});

test("records the invocation metadata from the result", () => {
  const r = buildTalkRuntimeReceipt({ result: COMPLETED, consentPhrase: CONSENT, recordedAtIso: "2026-06-22T14:00:00.000Z" });
  assert.equal(r.provider, "lmstudio");
  assert.equal(r.model, "qwen2.5");
  assert.equal(r.endpoint_family, "openai_compatible");
  assert.equal(r.invocation_status, "completed");
  assert.equal(r.duration_ms, 1234);
  assert.equal(r.prompt_length_chars, 11);
  assert.equal(r.response_length_chars, 42);
  assert.equal(r.prompt_safety_verdict, "LOCAL_TALK_OK");
  assert.equal(r.verdict_role, "suggestion");
  assert.equal(r.recorded_at, "2026-06-22T14:00:00.000Z");
});

test("PRIVACY — stores NO raw prompt or raw response, only lengths + a consent HASH", () => {
  const r = buildTalkRuntimeReceipt({ result: COMPLETED, consentPhrase: CONSENT, recordedAtIso: "2026-06-22T14:00:00.000Z" });
  const serialized = JSON.stringify(r);
  // The raw response body must never appear in the receipt.
  assert.doesNotMatch(serialized, /TOPSECRET_RESPONSE_BODY/);
  // The consent phrase is HASHED, not stored raw.
  assert.doesNotMatch(serialized, /GO: invoke local LLM/);
  const expected = createHash("sha256").update(CONSENT).digest("hex");
  assert.equal(r.consent_phrase_sha256, expected);
  assert.equal(r.consent_phrase_sha256.length, 64);
});

test("no_task_executed + standing guarantees true; invocation_effects = the call's effects", () => {
  const r = buildTalkRuntimeReceipt({ result: COMPLETED, consentPhrase: CONSENT, recordedAtIso: "2026-06-22T14:00:00.000Z" });
  assert.equal(r.no_task_executed, true);
  assert.equal(r.no_runtime_autonomy, true);
  assert.equal(r.no_token_poi_or_federation, true);
  // invocation_effects reflects what the MODEL CALL did (permissive keys only).
  assert.equal(r.invocation_effects.model_invocation_performed, true);
  assert.equal(r.invocation_effects.consent_collected, true);
  assert.match(r.note, /opt-in|--receipt|model call/i);
});

test("BOUNDARY HONESTY — a persisted receipt makes NO false filesystem/mint claim", () => {
  // The receipt IS a write + a mint; it must never embed a machine-readable
  // filesystem_write_performed:false or receipt_mint_performed:false anywhere.
  const r = buildTalkRuntimeReceipt({ result: COMPLETED, consentPhrase: CONSENT, recordedAtIso: "2026-06-22T14:00:00.000Z" });
  const keys = allKeys(r);
  assert.equal(keys.has("filesystem_write_performed"), false);
  assert.equal(keys.has("receipt_mint_performed"), false);
  assert.doesNotMatch(JSON.stringify(r), /"filesystem_write_performed":\s*false/);
  assert.doesNotMatch(JSON.stringify(r), /"receipt_mint_performed":\s*false/);
});

test("content-addressed receipt_id (64-hex), deterministic for the same inputs", () => {
  const a = buildTalkRuntimeReceipt({ result: COMPLETED, consentPhrase: CONSENT, recordedAtIso: "2026-06-22T14:00:00.000Z" });
  const b = buildTalkRuntimeReceipt({ result: COMPLETED, consentPhrase: CONSENT, recordedAtIso: "2026-06-22T14:00:00.000Z" });
  assert.equal(a.receipt_id.length, 64);
  assert.equal(a.receipt_id, b.receipt_id);
  // A different time → a different receipt id (distinct event).
  const c = buildTalkRuntimeReceipt({ result: COMPLETED, consentPhrase: CONSENT, recordedAtIso: "2026-06-22T15:00:00.000Z" });
  assert.notEqual(a.receipt_id, c.receipt_id);
});

test("records a REFUSED attempt too (evidence the gate fired) with no consent hash when none given", () => {
  const refused = { invocation_status: "refused", provider: "lmstudio", model: "qwen2.5", error_reason: "consent_phrase_mismatch", boundary: { model_invocation_performed: false } };
  const r = buildTalkRuntimeReceipt({ result: refused, consentPhrase: "", recordedAtIso: "2026-06-22T14:00:00.000Z" });
  assert.equal(r.invocation_status, "refused");
  assert.equal(r.consent_phrase_sha256, null);
  assert.equal(r.no_task_executed, true);
});

test("module imports no node fs/net/http/child_process directly (crypto is allowed)", () => {
  const source = readFileSync(MODULE_PATH, "utf8");
  assert.doesNotMatch(source, /from\s+["']node:(fs|fs\/promises|net|http|https|child_process)["']/);
});
