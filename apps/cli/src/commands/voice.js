import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import {
  runNode0MaterializationPulseE2ePreview,
  NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_GO_PHRASE,
} from "../../../../packages/core/src/node0-materialization-pulse-e2e-preview.js";
import {
  SOVEREIGN_VOICE_TURN_PREVIEW_GO_PHRASE,
  runSovereignVoiceTurnPreview,
} from "../../../../packages/core/src/sovereign-voice-turn-preview.js";

function wantsJson(argv) {
  return argv.includes("--json");
}

function sha(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function buildVoiceDemoMission(fileText, fileSource) {
  const niyyahHash = `sha256:${sha(`voice-niyyah:${fileSource}`)}`;
  return {
    mission_id: "dema-voice-turn-demo",
    pulse_id: "dema-voice-pulse-demo",
    niyyah_hash: niyyahHash,
    file_text: fileText,
    file_source: fileSource,
    plan: {
      mission_id: "dema-voice-turn-demo",
      niyyah_hash: niyyahHash,
      chosen_branch_id: "voice-response-preview",
      branches: [
        {
          id: "voice-response-preview",
          title: "Preview-only voice response",
          summary: "Bind transcript to Pulse result and plan speech without audio.",
          risk_score: 0.1,
          ihsan_score: 0.95,
          estimated_cost: 1,
          consent_required: false,
          authority_delta: 0,
          evidence_refs: [],
        },
      ],
      rejected_branches: [],
    },
    fate: {
      verdict: "PERMIT",
      authority_delta: 0,
      grants_action: false,
      mint_allowed: false,
    },
    claims: {
      claims: [
        {
          id: "voice-preview-boundary",
          text: "voice response is preview-only",
          metric: "voice_turn_boundary",
          asserted_value: 1,
          kind: "testimony",
        },
      ],
      evidence: {},
    },
  };
}

function spokenResponseForPulse(pulse) {
  if (pulse.pulse_status === "sealed") {
    return `Pulse sealed as preview: reached ${pulse.reached_station} of ${pulse.station_count} stations. This is a bounded spoken-response plan only.`;
  }
  const last = Array.isArray(pulse.ladder) ? pulse.ladder[pulse.ladder.length - 1] : null;
  const station = last?.station ?? "unknown";
  return `Refusal: Pulse aborted at ${station}. This voice turn is blocked; no action or audio is authorized.`;
}

export async function runVoiceTurn({ filePath } = {}) {
  if (!filePath || typeof filePath !== "string" || filePath.startsWith("--")) {
    return { ok: false, reason_code: "missing_file", file: filePath ?? null, result: null };
  }
  const abs = resolve(filePath);
  let transcript;
  try {
    transcript = await readFile(abs, "utf8");
  } catch (err) {
    return {
      ok: false,
      reason_code: err?.code === "ENOENT" ? "file_not_found" : "read_failed",
      file: abs,
      result: null,
    };
  }
  const pulse = runNode0MaterializationPulseE2ePreview({
    consent: NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_GO_PHRASE,
    input: { mission: buildVoiceDemoMission(transcript, abs) },
  });
  const input = {
    session_id: `voice-session-${sha(abs).slice(0, 12)}`,
    turn_id: `voice-turn-${sha(transcript).slice(0, 12)}`,
    transcript_text: transcript,
    transcript_source: "local_transcript_file",
    pulse_result: pulse,
    spoken_response_text: spokenResponseForPulse(pulse),
    voice_profile: {
      id: "dema-sovereign-preview",
      mode: "planned_only",
      source: "cli",
    },
    tts_engine_plan: {
      engine: "planned_only",
      tts_invoked: false,
      audio_output: false,
    },
  };
  const result = runSovereignVoiceTurnPreview({
    consent: SOVEREIGN_VOICE_TURN_PREVIEW_GO_PHRASE,
    input,
  });
  return { ok: result.ok, file: abs, result };
}

function jsonView(out) {
  if (!out.result) return { refused: true, reason_code: out.reason_code, file: out.file };
  const r = out.result;
  return {
    preview_only: true,
    schema: r.schema,
    pulse_status: r.pulse_status,
    reached_station: r.reached_station,
    station_count: r.station_count,
    spoken_response_text: r.spoken_response_text,
    tts_invoked: r.tts_invoked,
    audio_generated: r.audio_generated,
    audio_played: r.audio_played,
    microphone_used: r.microphone_used,
    stt_invoked: r.stt_invoked,
    content_hash: r.content_hash,
    blocked_by: r.blocked_by,
  };
}

function renderHuman(out) {
  const r = out.result;
  if (!r) return `dema voice turn: ${out.reason_code}: ${out.file ?? ""}`;
  return [
    "DEMA · VOICE TURN — PREVIEW_ONLY",
    `  transcript: ${out.file}`,
    `  pulse: ${r.pulse_status} · reached ${r.reached_station}/${r.station_count}`,
    `  spoken_response: "${r.spoken_response_text}"`,
    "  tts: planned_only",
    `  audio_generated: ${r.audio_generated}`,
    `  microphone_used: ${r.microphone_used}`,
    `  content_hash: ${r.content_hash}`,
    `  boundary: all-false · authority_delta:${r.authority_delta} · mint_allowed:${r.mint_allowed}`,
  ].join("\n");
}

export async function cmd_voice(ctx) {
  const { argv } = ctx;
  const subcommand = argv[1];
  if (subcommand !== "turn") {
    throw new Error("Unknown voice command. Use `dema voice turn <file> [--json]`.");
  }
  const out = await runVoiceTurn({ filePath: argv[2] });
  if (wantsJson(argv)) {
    console.log(JSON.stringify(jsonView(out), null, 2));
  } else {
    console.log(renderHuman(out));
  }
  if (!out.result || !out.ok || out.result.pulse_status !== "sealed") {
    process.exitCode = 1;
  }
  process.exit(process.exitCode ?? 0);
}
