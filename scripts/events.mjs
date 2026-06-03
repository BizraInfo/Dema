#!/usr/bin/env node
// OBS-1A · read-only observability event-log reader.
//
// Prints recent entries from $DEMA_HOME/events/log.jsonl and reports chain
// integrity. Read-only: never writes, never networks, never mints. Exits 1 if
// content/chain verification fails (tamper detected) so it can double as a
// local integrity check.
//
// Usage: node scripts/events.mjs [--json] [--limit N]

import { homedir } from "node:os";
import { join } from "node:path";
import { readEvents } from "../packages/core/src/event-log.js";

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const home = process.env.DEMA_HOME || join(homedir(), ".dema");
const limit = Number.parseInt(arg("--limit", "20"), 10);
const wantJson = process.argv.includes("--json");

const result = readEvents({
  home,
  limit: Number.isInteger(limit) ? limit : 20,
});

const report = {
  schema: "bizra.dema.event_log_read.v0.1",
  home,
  count: result.count,
  shown: result.entries.length,
  verified: result.verified,
  chain_intact: result.chain_intact,
  corrupt_lines: result.corrupt_lines,
  entries: result.entries,
  boundary: {
    read_only: true,
    network_used: false,
    private_key_loaded: false,
    receipt_minted: false,
    operator_dema_home_mutated: false,
  },
};

if (wantJson) {
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} else {
  console.log("DEMA · Event Log (OBS-1A · read-only)");
  console.log(`  home:          ${home}`);
  console.log(
    `  events:        ${result.count} (showing ${result.entries.length})`,
  );
  console.log(
    `  integrity:     content ${result.verified ? "VERIFIED" : "FAILED"} · chain ${result.chain_intact ? "INTACT" : "BROKEN"}` +
      (result.corrupt_lines
        ? ` · ${result.corrupt_lines} corrupt line(s)`
        : ""),
  );
  for (const e of result.entries) {
    console.log(
      `    ${e.recorded_at_iso}  ${String(e.command).padEnd(16)} ${String(e.outcome).padEnd(8)} ${e.correlation_id}`,
    );
  }
  console.log("  boundary:      read-only · no network · no keys · no mint");
}

if (!result.verified || !result.chain_intact) process.exitCode = 1;
