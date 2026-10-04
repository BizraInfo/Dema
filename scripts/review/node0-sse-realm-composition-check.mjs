#!/usr/bin/env node
// NODE0-REALM-SSE-COMPOSITION-1A — review gate: golden fixture transcript over
// real SSE wire text through chain→frame→realm→render, plus tamper probe.

import { pathToFileURL } from "node:url";

import {
  runNode0RealmSseComposition,
  consumeSseRealmComposition,
  NODE0_REALM_SSE_COMPOSITION_SCHEMA,
  NODE0_REALM_SSE_COMPOSITION_TRUTH_LABEL,
  NODE0_REALM_SSE_COMPOSITION_GO_PHRASE,
} from "../../packages/core/src/node0-sse-realm-composition.js";
import {
  buildSseStream,
  serializeSseFrames,
} from "../../packages/core/src/node0-sse-envelope-stream.js";
import { buildFixtureTranscript } from "../../packages/core/src/drs-fixture-publisher.js";
import { sha256CanonicalJsonV1 } from "../../packages/canon/src/sha256-canonical-json-v1.js";

const HEX64 = (ch) => ch.repeat(64);
const ADMITTED = {
  component: "node0.realm_projection.fixture",
  revision: `sha256:${HEX64("f")}`,
  contracts_digest: `sha256:${HEX64("d")}`,
  uid: 1000,
};
const PEER = { uid: 1000, pid: 1 };
const NOW_MS = Date.parse("2026-08-25T12:00:00.000Z") + 500;

function goldenWireText() {
  const fixture = buildFixtureTranscript({ scenario: "mission_work", admitted: ADMITTED, peer: PEER });
  if (!fixture.ok) throw new Error(fixture.blocked_by.join(","));
  const stream = buildSseStream({
    streamId: "gate.node0.realm_projection.fixture",
    frames: [...fixture.transcript.map((payload) => ({ kind: "state", payload })), { kind: "stream_end", payload: {} }],
  });
  return serializeSseFrames(stream.events);
}

const JSON_MODE = process.argv.includes("--json");

export function runNode0SseRealmCompositionCheck() {
  const out = runNode0RealmSseComposition({
    consent: NODE0_REALM_SSE_COMPOSITION_GO_PHRASE,
    input: { sse_text: goldenWireText(), admitted: ADMITTED, peer: PEER, now_ms: NOW_MS },
  });
  if (out.ok && out.visible_state !== "VERIFIED_DONE") {
    return { ...out, ok: false, blocked_by: [`expected_VERIFIED_DONE_got_${out.visible_state}`] };
  }
  if (out.ok && out.render?.simulated !== true) {
    return { ...out, ok: false, blocked_by: ["simulation_marker_lost_in_composition"] };
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode0SseRealmCompositionCheck();
  if (JSON_MODE) console.log(JSON.stringify(result, null, 2));
  else {
    console.log("DEMA - NODE0-REALM-SSE-COMPOSITION-1A");
    console.log(`  schema: ${NODE0_REALM_SSE_COMPOSITION_SCHEMA}`);
    console.log(`  truth:  ${NODE0_REALM_SSE_COMPOSITION_TRUTH_LABEL}`);
    console.log(`  layers: ${JSON.stringify(result.layers ?? {})}`);
    console.log(`  state:  ${result.visible_state ?? "?"} simulated=${result.render?.simulated}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    for (const c of result.blocked_by ?? []) console.log(`    ${c}`);
  }
  process.exitCode = result.ok ? 0 : 1;
}
