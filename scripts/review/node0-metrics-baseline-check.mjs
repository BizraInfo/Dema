#!/usr/bin/env node
// NODE0-METRICS-BASELINE-1A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  runNode0MetricsBaseline,
  NODE0_METRICS_BASELINE_SCHEMA,
  NODE0_METRICS_BASELINE_TRUTH_LABEL,
  NODE0_METRICS_BASELINE_GO_PHRASE,
} from "../../packages/core/src/node0-metrics-baseline.js";
import {
  makeNode0RealmEvent,
  NODE0_REALM_GENESIS_EVENT_ID,
} from "../../packages/core/src/node0-realm-state-kernel.js";

const JSON_MODE = process.argv.includes("--json");

// Canonical fixture: two declared missions, one completed through verdict and
// promotion, one attempted-but-unpromoted — so the utilization rate is a real
// fraction (0.5) and both metric paths (MEASURED and UNKNOWN) are exercised.
export function node0MetricsBaselineCheckFixture() {
  const events = [];
  let prev = NODE0_REALM_GENESIS_EVENT_ID;
  const push = (kind, payload) => {
    const event = makeNode0RealmEvent({ seq: events.length + 1, kind, payload, prev_event: prev });
    events.push(event);
    prev = event.event_id;
  };
  push("MISSION_DECLARED", { mission_id: "m-done", objective: "complete one bounded mission" });
  push("MISSION_DECLARED", { mission_id: "m-attempted", objective: "attempt without promotion" });
  push("AUTHORITY_NARROWED", { scopes: ["read_events", "derive_state"] });
  push("MISSION_VERDICT", { mission_id: "m-done", verdict: "PASS" });
  push("ASSET_PROMOTED", { mission_id: "m-done", asset_id: "a-done" });
  return { events };
}

export function runNode0MetricsBaselineCheck() {
  return runNode0MetricsBaseline({
    consent: NODE0_METRICS_BASELINE_GO_PHRASE,
    input: node0MetricsBaselineCheckFixture(),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode0MetricsBaselineCheck();

  if (JSON_MODE) {
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - NODE0-METRICS-BASELINE-1A");
    console.log(`  schema: ${NODE0_METRICS_BASELINE_SCHEMA}`);
    console.log(`  truth: ${NODE0_METRICS_BASELINE_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
