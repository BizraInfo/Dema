#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import {
  SOVEREIGN_VOICE_TURN_PREVIEW_SCHEMA,
  SOVEREIGN_VOICE_TURN_PREVIEW_TRUTH_LABEL,
  SOVEREIGN_VOICE_TURN_PREVIEW_GO_PHRASE,
  runSovereignVoiceTurnPreview,
} from "../../packages/core/src/sovereign-voice-turn-preview.js";
import { exampleSealedVoiceTurnInput } from "./sovereign-voice-turn-preview-fixtures.mjs";

function allFalse(boundary) {
  return !!boundary &&
    typeof boundary === "object" &&
    !Array.isArray(boundary) &&
    Object.values(boundary).every((value) => value === false);
}

export function runSovereignVoiceTurnPreviewCheck() {
  const result = runSovereignVoiceTurnPreview({
    consent: SOVEREIGN_VOICE_TURN_PREVIEW_GO_PHRASE,
    input: exampleSealedVoiceTurnInput(),
  });
  const blocked_by = [...(result.blocked_by ?? [])];
  if (result.ok !== true) blocked_by.push("voice_turn_run_not_ok");
  if (result.pulse_status !== "sealed") blocked_by.push("pulse_status_not_sealed");
  for (const [field, code] of [
    ["tts_invoked", "tts_invoked_true"],
    ["audio_generated", "audio_generated_true"],
    ["audio_played", "audio_played_true"],
    ["microphone_used", "microphone_used_true"],
    ["stt_invoked", "stt_invoked_true"],
    ["model_invocation_performed", "model_invocation_performed_true"],
    ["network_used", "network_used_true"],
    ["action_allowed", "action_allowed_true"],
    ["mint_allowed", "mint_allowed_true"],
    ["wallet_used", "wallet_used_true"],
    ["federation_live", "federation_live_true"],
  ]) {
    if (result[field] !== false) blocked_by.push(code);
  }
  if (result.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
  if (!allFalse(result.boundary)) blocked_by.push("boundary_not_all_false");
  return {
    ok: blocked_by.length === 0,
    schema: SOVEREIGN_VOICE_TURN_PREVIEW_SCHEMA,
    truth_label: SOVEREIGN_VOICE_TURN_PREVIEW_TRUTH_LABEL,
    pulse_status: result.pulse_status,
    reached_station: result.reached_station,
    station_count: result.station_count,
    content_hash: result.content_hash,
    boundary: result.boundary,
    blocked_by: [...new Set(blocked_by)],
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runSovereignVoiceTurnPreviewCheck();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA - SOVEREIGN-VOICE-TURN-PREVIEW-1A");
    console.log(`  schema: ${result.schema}`);
    console.log(`  truth: ${result.truth_label}`);
    console.log(`  pulse: ${result.pulse_status} ${result.reached_station}/${result.station_count}`);
    console.log(`  content_hash: ${result.content_hash}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (result.blocked_by.length) {
      console.log(`  blocked_by: ${result.blocked_by.join(", ")}`);
    }
  }
  if (!result.ok) process.exit(1);
}
