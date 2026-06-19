#!/usr/bin/env node
// AGENT-DNA-ROOT-COHERENCE-1A runner (READ-ONLY).
//
//   node scripts/review/agent-dna-root-coherence.mjs [--json]
//
// Gathers the real coherence inputs — sealed root canon, the 12-agent roster,
// the agent-DNA constitution text, and a LIVE probe of the Law-of-Assumption
// validator — then asks the pure kernel whether the founding principles are
// rooted across the agent DNA. Mutates nothing, signs nothing, seals nothing.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { verifyRootCanon } from "../verify-root-canon.mjs";
import { CANONICAL_AGENTS } from "../../packages/agents/src/agent-profile-registry.js";
import { validateAssumptionBoundary } from "../../packages/receipts/src/assumption-boundary-validator.js";
import {
  assessAgentDnaRootCoherence,
  AGENT_DNA_ROOT_COHERENCE_SCHEMA,
} from "../../packages/agents/src/agent-dna-root-coherence.js";

const JSON_MODE = process.argv.includes("--json");
const CONSTITUTION_PATH = join(
  process.cwd(),
  "docs/constitution/BIZRA_NODE0_AGENT_DNA_CONSTITUTION.md",
);

function loadConstitution() {
  try {
    return readFileSync(CONSTITUTION_PATH, "utf8");
  } catch {
    return ""; // fail closed → constitution checks miss
  }
}

// Probe the LoA validator both ways: a well-formed assumption-with-Ihsān
// envelope must be accepted; a boundary-less one must be rejected. Live only if
// it enforces the boundary, not merely exists.
function probeLoaValidatorLive() {
  try {
    const ok = validateAssumptionBoundary({
      claim_state: "A",
      assumption: "probe assumption",
      ground: "probe ground",
      boundary: "probe boundary between evidence and uncertainty",
      rejectable: true,
    });
    const bad = validateAssumptionBoundary({
      claim_state: "A",
      assumption: "probe assumption",
      ground: "probe ground",
      rejectable: true,
    });
    return ok?.valid === true && bad?.valid === false;
  } catch {
    return false;
  }
}

const rootCanon = await verifyRootCanon();
const report = assessAgentDnaRootCoherence({
  rootCanon,
  agents: CANONICAL_AGENTS,
  constitutionText: loadConstitution(),
  loaValidatorLive: probeLoaValidatorLive(),
});

if (JSON_MODE) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.coherent ? 0 : 1);
}

console.log("DEMA · Agent DNA ↔ Root Coherence gate (READ-ONLY)");
console.log(`  schema:    ${AGENT_DNA_ROOT_COHERENCE_SCHEMA}`);
console.log(`  truth:     ${report.truth_label}`);
console.log(
  `  roster:    ${report.agent_roster.total} (PAT ${report.agent_roster.pat} · SAT ${report.agent_roster.sat})`,
);
console.log("  checks:");
for (const [k, v] of Object.entries(report.checks)) {
  console.log(`    ${v ? "✓" : "✗"} ${k}`);
}
if (report.missing.length) {
  console.log(`  missing:   ${report.missing.join(", ")}`);
}
console.log(`  coherent:  ${report.coherent}`);
console.log("  boundary:  read-only · no mutation · no signing · no root change");

process.exit(report.coherent ? 0 : 1);
