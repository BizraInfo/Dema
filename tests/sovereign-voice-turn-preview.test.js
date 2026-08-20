import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  SOVEREIGN_VOICE_TURN_PREVIEW_SCHEMA,
  SOVEREIGN_VOICE_TURN_PREVIEW_TRUTH_LABEL,
  SOVEREIGN_VOICE_TURN_PREVIEW_GO_PHRASE,
  planSovereignVoiceTurnPreview,
  buildSovereignVoiceTurnPreviewPayload,
  verifySovereignVoiceTurnPreview,
  runSovereignVoiceTurnPreview,
  sovereignVoiceTurnPreviewBoundary,
} from "../packages/core/src/sovereign-voice-turn-preview.js";
import {
  exampleSealedVoiceTurnInput,
  exampleAbortedVoiceTurnInput,
} from "../scripts/review/sovereign-voice-turn-preview-fixtures.mjs";
import { runSovereignVoiceTurnPreviewCheck } from "../scripts/review/sovereign-voice-turn-preview-check.mjs";

const GO = SOVEREIGN_VOICE_TURN_PREVIEW_GO_PHRASE;
const run = (input) => runSovereignVoiceTurnPreview({ consent: GO, input });

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function rehash(body) {
  return `sha256:${createHash("sha256").update(stable(body), "utf8").digest("hex")}`;
}

function forge(payload, patch) {
  const { content_hash: _discard, ...body } = { ...payload, ...patch };
  return { ...body, content_hash: rehash(body) };
}

function assertAllFalse(boundary) {
  assert.ok(boundary && typeof boundary === "object" && !Array.isArray(boundary));
  assert.ok(Object.keys(boundary).length > 0);
  for (const [key, value] of Object.entries(boundary)) {
    assert.equal(value, false, key);
  }
}

test("1. plan rejects wrong consent", () => {
  const plan = planSovereignVoiceTurnPreview({
    consent: "GO: almost bind sovereign voice turn preview",
    input: exampleSealedVoiceTurnInput(),
  });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("2. plan accepts sealed voice-turn input", () => {
  const plan = planSovereignVoiceTurnPreview({ consent: GO, input: exampleSealedVoiceTurnInput() });
  assert.equal(plan.eligible, true, plan.blocked_by.join(","));
});

test("3. plan accepts aborted voice-turn input", () => {
  const plan = planSovereignVoiceTurnPreview({ consent: GO, input: exampleAbortedVoiceTurnInput() });
  assert.equal(plan.eligible, true, plan.blocked_by.join(","));
});

test("4. empty transcript rejected", () => {
  const plan = planSovereignVoiceTurnPreview({
    consent: GO,
    input: { ...exampleSealedVoiceTurnInput(), transcript_text: "   " },
  });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("transcript_text_required"));
});

test("5. invalid transcript_source rejected", () => {
  const plan = planSovereignVoiceTurnPreview({
    consent: GO,
    input: { ...exampleSealedVoiceTurnInput(), transcript_source: "microphone" },
  });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("transcript_source_invalid"));
});

test("6. sealed pulse builds voice-turn payload", () => {
  const payload = buildSovereignVoiceTurnPreviewPayload(exampleSealedVoiceTurnInput());
  assert.equal(payload.schema, SOVEREIGN_VOICE_TURN_PREVIEW_SCHEMA);
  assert.equal(payload.truth_label, SOVEREIGN_VOICE_TURN_PREVIEW_TRUTH_LABEL);
  assert.equal(payload.mode, "preview_only");
  assert.equal(payload.pulse_status, "sealed");
  assert.equal(payload.reached_station, 5);
  assert.equal(payload.station_count, 5);
  assert.equal(payload.tts_invoked, false);
  assert.equal(payload.audio_generated, false);
  assert.equal(payload.audio_played, false);
  assert.equal(payload.microphone_used, false);
  assert.equal(payload.stt_invoked, false);
  assertAllFalse(payload.boundary);
});

test("7. aborted pulse builds refusal voice-turn payload", () => {
  const payload = buildSovereignVoiceTurnPreviewPayload(exampleAbortedVoiceTurnInput());
  assert.equal(payload.pulse_status, "aborted");
  assert.equal(payload.reached_station, 1);
  assert.match(payload.spoken_response_text, /blocked|aborted|refusal/i);
  assert.equal(payload.action_allowed, false);
  assert.equal(payload.authority_delta, 0);
});

test("8. payload content hash deterministic", () => {
  const a = buildSovereignVoiceTurnPreviewPayload(exampleSealedVoiceTurnInput());
  const b = buildSovereignVoiceTurnPreviewPayload(exampleSealedVoiceTurnInput());
  assert.equal(a.content_hash, b.content_hash);
  assert.match(a.content_hash, /^sha256:[0-9a-f]{64}$/);
});

test("9. verify accepts fresh sealed payload", () => {
  const payload = buildSovereignVoiceTurnPreviewPayload(exampleSealedVoiceTurnInput());
  assert.equal(verifySovereignVoiceTurnPreview(payload).ok, true, verifySovereignVoiceTurnPreview(payload).blocked_by.join(","));
});

test("10. verify accepts fresh aborted payload", () => {
  const payload = buildSovereignVoiceTurnPreviewPayload(exampleAbortedVoiceTurnInput());
  assert.equal(verifySovereignVoiceTurnPreview(payload).ok, true, verifySovereignVoiceTurnPreview(payload).blocked_by.join(","));
});

test("11. verify rejects content-hash tamper", () => {
  const payload = buildSovereignVoiceTurnPreviewPayload(exampleSealedVoiceTurnInput());
  assert.ok(verifySovereignVoiceTurnPreview({ ...payload, content_hash: `sha256:${"0".repeat(64)}` }).blocked_by.includes("content_hash_mismatch"));
});

test("12. verify rejects recomputed-hash tts_invoked laundering", () => {
  const payload = buildSovereignVoiceTurnPreviewPayload(exampleSealedVoiceTurnInput());
  assert.ok(verifySovereignVoiceTurnPreview(forge(payload, { tts_invoked: true })).blocked_by.includes("tts_invoked_true"));
});

test("13. verify rejects recomputed-hash audio_generated laundering", () => {
  const payload = buildSovereignVoiceTurnPreviewPayload(exampleSealedVoiceTurnInput());
  assert.ok(verifySovereignVoiceTurnPreview(forge(payload, { audio_generated: true })).blocked_by.includes("audio_generated_true"));
});

test("14. verify rejects recomputed-hash audio_played laundering", () => {
  const payload = buildSovereignVoiceTurnPreviewPayload(exampleSealedVoiceTurnInput());
  assert.ok(verifySovereignVoiceTurnPreview(forge(payload, { audio_played: true })).blocked_by.includes("audio_played_true"));
});

test("15. verify rejects recomputed-hash microphone_used laundering", () => {
  const payload = buildSovereignVoiceTurnPreviewPayload(exampleSealedVoiceTurnInput());
  assert.ok(verifySovereignVoiceTurnPreview(forge(payload, { microphone_used: true })).blocked_by.includes("microphone_used_true"));
});

test("16. verify rejects recomputed-hash stt_invoked laundering", () => {
  const payload = buildSovereignVoiceTurnPreviewPayload(exampleSealedVoiceTurnInput());
  assert.ok(verifySovereignVoiceTurnPreview(forge(payload, { stt_invoked: true })).blocked_by.includes("stt_invoked_true"));
});

test("17. verify rejects recomputed-hash model_invocation laundering", () => {
  const payload = buildSovereignVoiceTurnPreviewPayload(exampleSealedVoiceTurnInput());
  assert.ok(verifySovereignVoiceTurnPreview(forge(payload, { model_invocation_performed: true })).blocked_by.includes("model_invocation_performed_true"));
});

test("18. verify rejects recomputed-hash network_used laundering", () => {
  const payload = buildSovereignVoiceTurnPreviewPayload(exampleSealedVoiceTurnInput());
  assert.ok(verifySovereignVoiceTurnPreview(forge(payload, { network_used: true })).blocked_by.includes("network_used_true"));
});

test("19. verify rejects authority/action/mint/wallet/federation laundering", () => {
  const payload = buildSovereignVoiceTurnPreviewPayload(exampleSealedVoiceTurnInput());
  for (const [patch, code] of [
    [{ action_allowed: true }, "action_allowed_true"],
    [{ authority_delta: 1 }, "authority_delta_nonzero"],
    [{ grants_action: true }, "grants_action_true"],
    [{ mint_allowed: true }, "mint_allowed_true"],
    [{ wallet_used: true }, "wallet_used_true"],
    [{ federation_live: true }, "federation_live_true"],
  ]) {
    assert.ok(verifySovereignVoiceTurnPreview(forge(payload, patch)).blocked_by.includes(code), code);
  }
});

test("20. verify rejects boundary flip", () => {
  const payload = buildSovereignVoiceTurnPreviewPayload(exampleSealedVoiceTurnInput());
  const boundary = { ...payload.boundary, network_used: true };
  assert.ok(verifySovereignVoiceTurnPreview(forge(payload, { boundary })).blocked_by.includes("boundary_not_all_false"));
});

test("21. aborted pulse with executed successfully language rejected", () => {
  const payload = buildSovereignVoiceTurnPreviewPayload({
    ...exampleAbortedVoiceTurnInput(),
    spoken_response_text: "Completed and executed successfully.",
  });
  assert.ok(verifySovereignVoiceTurnPreview(payload).blocked_by.includes("aborted_response_claims_completion"));
});

test("22. sealed pulse with empty spoken response rejected", () => {
  const payload = buildSovereignVoiceTurnPreviewPayload({
    ...exampleSealedVoiceTurnInput(),
    spoken_response_text: "",
  });
  assert.ok(verifySovereignVoiceTurnPreview(payload).blocked_by.includes("spoken_response_text_required"));
});

test("23. run sealed fixture succeeds", () => {
  const result = run(exampleSealedVoiceTurnInput());
  assert.equal(result.ok, true, result.blocked_by.join(","));
  assert.equal(result.pulse_status, "sealed");
  assert.equal(result.tts_invoked, false);
});

test("24. run aborted fixture succeeds as bounded refusal", () => {
  const result = run(exampleAbortedVoiceTurnInput());
  assert.equal(result.ok, true, result.blocked_by.join(","));
  assert.equal(result.pulse_status, "aborted");
  assert.match(result.spoken_response_text, /blocked|aborted|refusal/i);
});

test("25. review gate passes", () => {
  const result = runSovereignVoiceTurnPreviewCheck();
  assert.equal(result.ok, true, result.blocked_by.join(","));
  assert.equal(result.pulse_status, "sealed");
  assertAllFalse(result.boundary);
});

test("26. kernel purity scan passes", () => {
  const source = readFileSync(
    fileURLToPath(new URL("../packages/core/src/sovereign-voice-turn-preview.js", import.meta.url)),
    "utf8",
  );
  assert.doesNotMatch(source, /from\s+["']node:fs|from\s+["']fs|fetch\s*\(|child_process|process\.|Date\.|new Date|Math\.random/);
  assert.match(source, /from\s+["']node:crypto["']/);
  assert.deepEqual(Object.values(sovereignVoiceTurnPreviewBoundary()).every((value) => value === false), true);
});

// ── BILINGUAL RESPONSE GUARDS (Arabic) ──────────────────────────────────────
// The response-language guards must recognise the operator's own language, not
// only English. Measured before this: an honest Arabic refusal on an aborted
// pulse failed verification (Dema could not say "no" in Arabic), and a dishonest
// Arabic completion claim laundered through the completion guard unseen.

test("27. aborted pulse with honest Arabic refusal verifies bounded", () => {
  const payload = buildSovereignVoiceTurnPreviewPayload({
    ...exampleAbortedVoiceTurnInput(),
    spoken_response_text: "رفض: توقّفت النبضة. هذا الدور الصوتي محظور، لا إجراء ولا صوت.",
  });
  const v = verifySovereignVoiceTurnPreview(payload);
  assert.equal(v.ok, true, v.blocked_by.join(","));
  assert.ok(!v.blocked_by.includes("aborted_response_not_refusal"));
});

test("28. aborted pulse with Arabic false-completion claim is caught", () => {
  const payload = buildSovereignVoiceTurnPreviewPayload({
    ...exampleAbortedVoiceTurnInput(),
    spoken_response_text: "اكتمل الأمر بنجاح ونُفِّذ الإجراء.",
  });
  assert.ok(
    verifySovereignVoiceTurnPreview(payload).blocked_by.includes("aborted_response_claims_completion"),
  );
});

test("29. English refusal masking an Arabic completion claim is caught", () => {
  const payload = buildSovereignVoiceTurnPreviewPayload({
    ...exampleAbortedVoiceTurnInput(),
    spoken_response_text: "Refusal noted, لكن اكتمل الأمر بنجاح ونُفِّذ الإجراء.",
  });
  assert.ok(
    verifySovereignVoiceTurnPreview(payload).blocked_by.includes("aborted_response_claims_completion"),
  );
});

test("30. sealed pulse with Arabic status is not flagged refusal-only", () => {
  const payload = buildSovereignVoiceTurnPreviewPayload({
    ...exampleSealedVoiceTurnInput(),
    spoken_response_text: "خُتمت النبضة كمعاينة: بلغت 5 من 5 محطات. هذه خطة استجابة صوتية محدودة فقط.",
  });
  const v = verifySovereignVoiceTurnPreview(payload);
  assert.equal(v.ok, true, v.blocked_by.join(","));
  assert.ok(!v.blocked_by.includes("sealed_response_refusal_only"));
});

test("31. English guard behaviour is preserved byte-for-byte", () => {
  const ok = buildSovereignVoiceTurnPreviewPayload({
    ...exampleAbortedVoiceTurnInput(),
    spoken_response_text: "Refusal: Pulse aborted. This voice turn is blocked; no action or audio.",
  });
  assert.equal(verifySovereignVoiceTurnPreview(ok).ok, true);
  const bad = buildSovereignVoiceTurnPreviewPayload({
    ...exampleAbortedVoiceTurnInput(),
    spoken_response_text: "Completed and executed successfully.",
  });
  assert.ok(verifySovereignVoiceTurnPreview(bad).blocked_by.includes("aborted_response_claims_completion"));
});
