#!/usr/bin/env node
// NODE0-REALM-STATE-KERNEL-1A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  runNode0RealmStateKernel,
  makeNode0RealmEvent,
  NODE0_REALM_GENESIS_EVENT_ID,
  NODE0_REALM_STATE_KERNEL_SCHEMA,
  NODE0_REALM_STATE_KERNEL_TRUTH_LABEL,
  NODE0_REALM_STATE_KERNEL_GO_PHRASE,
} from "../../packages/core/src/node0-realm-state-kernel.js";

const JSON_MODE = process.argv.includes("--json");

// Canonical fixture: declare -> checkpoint -> narrow authority -> verdict -> promote.
// Exercises every event kind once through a valid hash chain.
export function node0RealmStateKernelCheckFixture() {
  const events = [];
  let prev = NODE0_REALM_GENESIS_EVENT_ID;
  const push = (kind, payload) => {
    const event = makeNode0RealmEvent({ seq: events.length + 1, kind, payload, prev_event: prev });
    events.push(event);
    prev = event.event_id;
  };
  push("MISSION_DECLARED", { mission_id: "m-fixture", objective: "prove deterministic realm replay" });
  push("MISSION_CHECKPOINT", { mission_id: "m-fixture" });
  push("AUTHORITY_NARROWED", { scopes: ["read_events", "derive_state"] });
  push("MISSION_VERDICT", { mission_id: "m-fixture", verdict: "PASS" });
  push("ASSET_PROMOTED", { mission_id: "m-fixture", asset_id: "a-fixture" });
  return { events };
}

export function runNode0RealmStateKernelCheck() {
  return runNode0RealmStateKernel({
    consent: NODE0_REALM_STATE_KERNEL_GO_PHRASE,
    input: node0RealmStateKernelCheckFixture(),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode0RealmStateKernelCheck();

  if (JSON_MODE) {
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - NODE0-REALM-STATE-KERNEL-1A");
    console.log(`  schema: ${NODE0_REALM_STATE_KERNEL_SCHEMA}`);
    console.log(`  truth: ${NODE0_REALM_STATE_KERNEL_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
