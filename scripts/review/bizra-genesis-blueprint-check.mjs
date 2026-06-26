#!/usr/bin/env node
// BIZRA-GENESIS-NODE0-TERMINAL-BLUEPRINT-1A — read-only blueprint verifier.

import {
  BIZRA_GENESIS_NODE0_TERMINAL_BLUEPRINT_SCHEMA,
  BIZRA_GENESIS_NODE0_TERMINAL_BLUEPRINT_TRUTH_LABEL,
  renderBizraGenesisNode0TerminalBlueprint,
  verifyBizraGenesisNode0TerminalBlueprint,
} from "../../packages/core/src/bizra-genesis-node0-terminal-blueprint.js";

const JSON_MODE = process.argv.includes("--json");
const PRINT = process.argv.includes("--print");

export function runBizraGenesisBlueprintCheck() {
  const output = renderBizraGenesisNode0TerminalBlueprint();
  const verified = verifyBizraGenesisNode0TerminalBlueprint(output);
  return Object.freeze({
    ok: verified.ok,
    schema: BIZRA_GENESIS_NODE0_TERMINAL_BLUEPRINT_SCHEMA,
    truth_label: BIZRA_GENESIS_NODE0_TERMINAL_BLUEPRINT_TRUTH_LABEL,
    verified,
    line_count: output.split("\n").length,
    output,
  });
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const result = runBizraGenesisBlueprintCheck();

  if (PRINT) {
    console.log(`\n${result.output}\n`);
  }

  if (JSON_MODE) {
    const { output: _omit, ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA · BIZRA genesis Node0 terminal blueprint (docs-only)");
    console.log(`  truth: ${result.truth_label}`);
    console.log(`  lines: ${result.line_count}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.verified.blocked_by) {
        console.log(`    ${code}`);
      }
    }
  }

  if (!result.ok) process.exit(1);
}
