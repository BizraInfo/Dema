#!/usr/bin/env node
// BLOCK0-LIVE-READINESS · read-only seal-ceremony precheck runner.
//
//   node scripts/block0-live-readiness.mjs            # uses $DEMA_HOME or ~/.dema
//   node scripts/block0-live-readiness.mjs --json     # machine-readable
//
// Reports what a Block0 seal ceremony requires from the live home. Read-only:
// loads the operator PUBLIC key only, never the private key, never signs,
// produces no proof, persists nothing, seals nothing. Producing the 11 signed
// slots IS the operator-only signing ceremony — this tool does not do it.

import { homedir } from "node:os";
import { join } from "node:path";
import {
  assessBlock0LiveReadiness,
  BLOCK0_LIVE_READINESS_SCHEMA,
} from "../packages/genesis/src/block0-live-readiness.js";

const HOME = process.env.DEMA_HOME || join(homedir(), ".dema");
const JSON_MODE = process.argv.includes("--json");

const report = await assessBlock0LiveReadiness({ demaHome: HOME });

if (JSON_MODE) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const mark = (s) =>
  s === "VERIFIABLE_NOW" ? "✓" : s === "NEEDS_OPERATOR_SIGNING" ? "✍" : "✗";

console.log("DEMA · Block0 live seal-ceremony readiness (READ-ONLY)");
console.log(`  schema:    ${BLOCK0_LIVE_READINESS_SCHEMA}`);
console.log(`  home:      ${HOME}`);
console.log(
  `  operator pubkey present: ${report.operator_pubkey_present ? "yes" : "NO"}`,
);
console.log(
  `  poi_rule verifiable now: ${report.poi_rule_verifiable ? "yes" : `no (${report.poi_rule_reason})`}`,
);
console.log("  slots:");
for (const [slot, info] of Object.entries(report.slots)) {
  console.log(`    ${mark(info.status)} ${slot.padEnd(32)} ${info.status}`);
}
console.log(
  `  summary:   ${report.needs_operator_signing_count}/12 slots require the operator's PRIVATE key (a signing ceremony).`,
);
console.log(
  "  note:      'sealable:true' is a CAPABILITY proof (test fixtures). A real seal is an",
);
console.log(
  "             operator-only signing ceremony; this tool performs none of it.",
);
