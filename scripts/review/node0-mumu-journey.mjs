#!/usr/bin/env node
// N0-MUMU-CLI-2 — closed-loop journey composition check (read-only).

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  JOURNEY_STAGES,
  buildMumuJourney,
} from "../node0-mumu-cli.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const JSON_MODE = process.argv.includes("--json");

process.chdir(REPO_ROOT);

const journey = buildMumuJourney({ operator: "Mumu" });
const validStages = new Set(Object.values(JOURNEY_STAGES));

const ok =
  journey.schema === "bizra.dema.node0_mumu_cli_journey.v0.1" &&
  validStages.has(journey.stage) &&
  journey.boundary.read_only === true &&
  journey.boundary.runtime_execution_performed === false &&
  journey.boundary.token_minted === false &&
  journey.governed_loop_entry === "npm run node0" &&
  Array.isArray(journey.steps) &&
  journey.steps.length === 4;

if (JSON_MODE) {
  console.log(JSON.stringify({ ok, journey }, null, 2));
} else {
  console.log("DEMA · node0 mumu journey (read-only face)");
  console.log(`  stage: ${journey.stage}`);
  console.log(`  verify: ${journey.status_summary.verify_verdict}`);
  console.log(`  result: ${ok ? "PASS" : "FAIL"}`);
}

process.exit(ok ? 0 : 1);
