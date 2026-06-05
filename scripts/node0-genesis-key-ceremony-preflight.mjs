#!/usr/bin/env node
// NODE0-GENESIS-KEY-CEREMONY-1A preflight runner (read-only).
//
//   node scripts/node0-genesis-key-ceremony-preflight.mjs
//   node scripts/node0-genesis-key-ceremony-preflight.mjs --json
//   node scripts/node0-genesis-key-ceremony-preflight.mjs --provenance-json docs/08-quality/CROSS_REPO_GENESIS_PROVENANCE_2026_06_05.json

import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  assessNode0GenesisKeyCeremonyPreflight,
  NODE0_GENESIS_KEY_CEREMONY_PREFLIGHT_SCHEMA,
} from "../packages/genesis/src/node0-genesis-key-ceremony-preflight.js";

const JSON_MODE = process.argv.includes("--json");
const HOME = process.env.DEMA_HOME || join(homedir(), ".dema");

function loadProvenanceGate() {
  const flagIdx = process.argv.indexOf("--provenance-json");
  const path =
    flagIdx >= 0 && process.argv[flagIdx + 1]
      ? process.argv[flagIdx + 1]
      : join(
          process.cwd(),
          "docs/08-quality/CROSS_REPO_GENESIS_PROVENANCE_2026_06_05.json",
        );

  if (!existsSync(path)) return "NODE0-GENESIS-KEY-CEREMONY-1A";

  try {
    const doc = JSON.parse(readFileSync(path, "utf8"));
    return doc.next_gate?.gate ?? "NODE0-GENESIS-KEY-CEREMONY-1A";
  } catch {
    return "NODE0-GENESIS-KEY-CEREMONY-1A";
  }
}

const report = await assessNode0GenesisKeyCeremonyPreflight({
  demaHome: HOME,
  provenanceNextGate: loadProvenanceGate(),
});

if (JSON_MODE) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.cleared_for_key_init ? 0 : 1);
}

console.log("DEMA · Node0 genesis key ceremony preflight (READ-ONLY)");
console.log(`  schema:   ${NODE0_GENESIS_KEY_CEREMONY_PREFLIGHT_SCHEMA}`);
console.log(`  home:     ${HOME}`);
console.log(`  gate:     ${report.provenance_next_gate}`);
console.log(
  `  cleared:  ${report.cleared_for_key_init ? "YES — operator may run key init" : "NO"}`,
);
if (report.recommended_command) {
  console.log(`  next:     ${report.recommended_command}`);
}
if (report.blockers.length) {
  console.log("  blockers:");
  for (const b of report.blockers) {
    console.log(`    - ${b.code}: ${b.message}`);
  }
}
console.log(
  `  block0:   pubkey=${report.block0_summary.operator_pubkey_present} ceremony=${report.block0_summary.ceremony_required} signing_slots=${report.block0_summary.needs_operator_signing_count}`,
);

process.exit(report.cleared_for_key_init ? 0 : 1);
