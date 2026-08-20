// `dema adk` — BIZRA-ADK-AGENT-CONTRACT-1A (define/validate/preview only).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { validateAgentContract } from "../../../../packages/adk/src/agent-validator.js";
import { buildAdkReceiptPreview } from "../../../../packages/adk/src/receipt-preview.js";
import { buildPatAgentTemplate } from "../../../../packages/adk/src/pat-template.js";
import { buildSatAgentTemplate } from "../../../../packages/adk/src/sat-template.js";
import {
  runAdkAdversarialSuite,
  runAdkContractHarness,
} from "../../../../packages/adk/src/test-harness.js";

function loadJsonFile(filePath) {
  const safe = resolve(filePath);
  const cwd = resolve(".");
  if (!safe.startsWith(cwd + "/") && safe !== cwd) {
    throw new Error("path traversal denied");
  }
  const raw = readFileSync(safe, "utf8");
  return JSON.parse(raw);
}

function printJson(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

export async function cmd_adk(ctx) {
  const { argv } = ctx;
  const wantJson = argv.includes("--json");
  const sub = argv[1];
  const action = argv[2];

  if (sub === "agent" && action === "validate") {
    const file = argv[3];
    if (!file) {
      console.error("usage: dema adk agent validate <contract.json> [--json]");
      process.exit(1);
    }
    try {
      const doc = loadJsonFile(file);
      const result = validateAgentContract(doc);
      if (wantJson) printJson(result);
      else {
        console.log(`ADK agent validate: ${result.valid ? "PASS" : "FAIL"}`);
        if (!result.valid) {
          for (const err of result.errors) {
            console.log(`  - [${err.code}] ${err.message}`);
          }
        }
      }
      process.exit(result.valid ? 0 : 1);
    } catch (e) {
      console.error(`adk validate error: ${e.message}`);
      process.exit(1);
    }
  }

  if (sub === "agent" && action === "template") {
    const name = argv[3];
    if (!name) {
      console.error(
        "usage: dema adk agent template <pat-engineer|sat-verifier|...> [--json]",
      );
      process.exit(1);
    }
    const lower = name.toLowerCase();
    let contract;
    if (lower.startsWith("pat")) {
      contract = buildPatAgentTemplate({ agent_id: name, role: name });
    } else if (lower.startsWith("sat")) {
      contract = buildSatAgentTemplate({ agent_id: name, role: name });
    } else {
      console.error(`unknown template id: ${name} (use pat-* or sat-* id)`);
      process.exit(1);
    }
    const validation = validateAgentContract(contract);
    if (wantJson) printJson({ template: contract, validation });
    else {
      console.log(`ADK template: ${name}`);
      console.log(`  scope: ${contract.scope}`);
      console.log(`  role: ${contract.agent_role}`);
      console.log(`  valid: ${validation.valid}`);
    }
    process.exit(validation.valid ? 0 : 1);
  }

  if (sub === "agent" && action === "receipt-preview") {
    const file = argv[3];
    if (!file) {
      console.error(
        "usage: dema adk agent receipt-preview <contract.json> [--json]",
      );
      process.exit(1);
    }
    try {
      const doc = loadJsonFile(file);
      const preview = buildAdkReceiptPreview(doc);
      if (wantJson) printJson(preview);
      else {
        console.log(
          `ADK receipt preview: ${preview.built ? "BUILT" : "REFUSED"}`,
        );
        if (preview.built) {
          console.log(`  proves: ${preview.what_this_proves}`);
          console.log(`  does_not_prove: ${preview.what_this_does_not_prove}`);
        } else {
          console.log(`  error: ${preview.error}`);
        }
      }
      process.exit(preview.built ? 0 : 1);
    } catch (e) {
      console.error(`adk receipt-preview error: ${e.message}`);
      process.exit(1);
    }
  }

  if (sub === "harness" && action === "run") {
    const file = argv[3];
    if (!file || file.startsWith("--")) {
      const report = runAdkAdversarialSuite();
      if (wantJson) printJson(report);
      else {
        console.log(`ADK harness suite: ${report.verdict}`);
        console.log(
          `  cases: ${report.case_count}  failed: ${report.failed_count}`,
        );
      }
      process.exit(report.verdict === "CLEAN" ? 0 : 1);
    }
    try {
      const doc = loadJsonFile(file);
      const report = runAdkContractHarness(doc);
      if (wantJson) printJson(report);
      else {
        console.log(`ADK harness: ${report.verdict}`);
        for (const check of report.checks) {
          if (!check.ok) {
            console.log(
              `  - ${check.name}: expected ${check.expected}, got ${check.actual}`,
            );
          }
        }
      }
      process.exit(report.verdict === "PASS" ? 0 : 1);
    } catch (e) {
      console.error(`adk harness error: ${e.message}`);
      process.exit(1);
    }
  }

  console.error(`usage:
  dema adk agent validate <contract.json> [--json]
  dema adk agent template <pat-engineer|sat-verifier|...> [--json]
  dema adk agent receipt-preview <contract.json> [--json]
  dema adk harness run [<contract.json>] [--json]`);
  process.exit(1);
}
