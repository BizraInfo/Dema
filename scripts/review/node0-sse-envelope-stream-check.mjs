#!/usr/bin/env node
// NODE0-SSE-ENVELOPE-STREAM-1A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  runNode0SseEnvelopeStream,
  NODE0_SSE_ENVELOPE_STREAM_SCHEMA,
  NODE0_SSE_ENVELOPE_STREAM_TRUTH_LABEL,
  NODE0_SSE_ENVELOPE_STREAM_GO_PHRASE,
} from "../../packages/core/src/node0-sse-envelope-stream.js";

const JSON_MODE = process.argv.includes("--json");

export function runNode0SseEnvelopeStreamCheck() {
  // Canonical fixture: one state transition, one pure heartbeat, one terminal —
  // the minimal stream that exercises every law this slice names.
  return runNode0SseEnvelopeStream({
    consent: NODE0_SSE_ENVELOPE_STREAM_GO_PHRASE,
    input: {
      stream_id: "prod02-execution-transport",
      frames: [
        { kind: "state", payload: { mission_id: "M1", phase: "CONDUCTION" } },
        { kind: "heartbeat", payload: {} },
        { kind: "stream_end", payload: { reason: "complete" } },
      ],
    },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode0SseEnvelopeStreamCheck();

  if (JSON_MODE) {
    // Strip heavy/non-summary fields here if the envelope carries them.
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - NODE0-SSE-ENVELOPE-STREAM-1A");
    console.log(`  schema: ${NODE0_SSE_ENVELOPE_STREAM_SCHEMA}`);
    console.log(`  truth: ${NODE0_SSE_ENVELOPE_STREAM_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
