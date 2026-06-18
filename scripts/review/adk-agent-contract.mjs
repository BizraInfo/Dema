#!/usr/bin/env node
// BIZRA-ADK-AGENT-CONTRACT-1A review gate (read-only).

import { validateAgentContract } from "../../packages/adk/src/agent-validator.js";
import { buildPatAgentTemplate } from "../../packages/adk/src/pat-template.js";
import { buildSatAgentTemplate } from "../../packages/adk/src/sat-template.js";
import { buildAdkReceiptPreview } from "../../packages/adk/src/receipt-preview.js";

const JSON_MODE = process.argv.includes("--json");

const pat = buildPatAgentTemplate({ agent_id: "pat-engineer" });
const sat = buildSatAgentTemplate({ agent_id: "sat-verifier" });
const patVal = validateAgentContract(pat);
const satVal = validateAgentContract(sat);
const patPreview = buildAdkReceiptPreview(pat);

const boundaryOk =
  pat.boundary.runtime_execution_performed === false &&
  pat.boundary.network_used === false &&
  pat.boundary.receipt_mint_performed === false;

const pass = patVal.valid && satVal.valid && patPreview.built && boundaryOk;

if (JSON_MODE) {
  console.log(
    JSON.stringify(
      {
        ok: pass,
        pat_valid: patVal.valid,
        sat_valid: satVal.valid,
        receipt_preview_built: patPreview.built,
      },
      null,
      2,
    ),
  );
} else {
  console.log("DEMA · BIZRA ADK agent contract (read-only)");
  console.log(`  pat-engineer: ${patVal.valid ? "PASS" : "FAIL"}`);
  console.log(`  sat-verifier: ${satVal.valid ? "PASS" : "FAIL"}`);
  console.log(`  receipt preview: ${patPreview.built ? "PASS" : "FAIL"}`);
  console.log(`  result: ${pass ? "PASS" : "FAIL"}`);
}

process.exit(pass ? 0 : 1);
