#!/usr/bin/env node
// DEMA-PRESENCE-1A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  runDemaPresence,
  DEMA_PRESENCE_SCHEMA,
  DEMA_PRESENCE_TRUTH_LABEL,
  DEMA_PRESENCE_GO_PHRASE,
} from "../../packages/core/src/dema-presence.js";

const JSON_MODE = process.argv.includes("--json");

export function runDemaPresenceCheck() {
  // Canonical fixture: a receipt-bound event stream shaped like the Node0 proof
  // chain — heartbeat → mission → PAT → consent → SAT → verified.
  return runDemaPresence({
    consent: DEMA_PRESENCE_GO_PHRASE,
    input: {
      events: [
        { kind: "heartbeat", receipt_hash: `sha256:${"77fc16c8".padEnd(64, "0")}`, seq: 1, emitted_at: "2026-08-25T03:00:00Z" },
        { kind: "mission_started", receipt_hash: `sha256:${"48a78ce6".padEnd(64, "0")}`, seq: 2, emitted_at: "2026-08-25T04:48:00Z" },
        { kind: "pat_started", receipt_hash: `sha256:${"48a78ce6".padEnd(64, "0")}`, seq: 3, emitted_at: "2026-08-25T04:49:00Z" },
        { kind: "consent_required", receipt_hash: `sha256:${"86ef608b".padEnd(64, "0")}`, seq: 4, emitted_at: "2026-08-25T04:50:00Z" },
        { kind: "sat_verifying", receipt_hash: `sha256:${"049efbce".padEnd(64, "0")}`, seq: 5, emitted_at: "2026-08-25T05:10:00Z" },
        { kind: "mission_verified", receipt_hash: `sha256:${"049efbce".padEnd(64, "0")}`, seq: 6, emitted_at: "2026-08-25T05:12:00Z" },
      ],
    },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runDemaPresenceCheck();

  if (JSON_MODE) {
    // Strip heavy/non-summary fields here if the envelope carries them.
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - DEMA-PRESENCE-1A");
    console.log(`  schema: ${DEMA_PRESENCE_SCHEMA}`);
    console.log(`  truth: ${DEMA_PRESENCE_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
