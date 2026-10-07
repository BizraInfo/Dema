#!/usr/bin/env node
// BIZRA-PROMPT-COMPILER-0A — review gate: canonical trigger compiles to the
// full phase graph; doctrine names refuse to be silently swallowed; tamper
// probe proves the contract is content-addressed.

import { pathToFileURL } from "node:url";
import {
  compilePrompt,
  BIZRA_PROMPT_COMPILER_SCHEMA,
  BIZRA_PROMPT_COMPILER_TRUTH_LABEL,
  BIZRA_PROMPT_COMPILER_GO_PHRASE,
} from "../../packages/core/src/bizra-prompt-compiler.js";
import { sha256CanonicalJsonV1 } from "../../packages/canon/src/sha256-canonical-json-v1.js";

const CANONICAL_TRIGGER = `
Run the full authorized terrain. Conduct process mining over the history,
apply SAPE deep probe and HHMM latent-state discovery, compare branches with
graph of thoughts, filter through SNR, run the signal-gated diffusion
amplifier, classify failures with DEMA-FDE dual diagnostic, pass every finding
through the Ihsan gate, then select the minimum provable spearpoint and
implement it red-first with receipts. Engage the primordial activation protocol.
`;

const JSON_MODE = process.argv.includes("--json");

export function runBizraPromptCompilerCheck() {
  const compiled = compilePrompt({ text: CANONICAL_TRIGGER, hash: sha256CanonicalJsonV1 });

  const blocked_by = [...compiled.blocked_by];
  if (compiled.operators.length < 10) blocked_by.push("undercompiled_trigger");
  if (!compiled.precedence_chain.includes("one_spearpoint")) blocked_by.push("no_spearpoint_phase");
  // Sensitivity probe: removing MEANING (the spearpoint clause) must change
  // both structure and hash. Pure whitespace flips SHOULD NOT — compilation
  // extracts structure, not prose bytes.
  const withoutSpear = compilePrompt({
    text: CANONICAL_TRIGGER.split("select the minimum provable")[0],
    hash: sha256CanonicalJsonV1,
  });
  if (withoutSpear.content_hash === compiled.content_hash) {
    blocked_by.push("tamper_probe_passed");
  }
  if (withoutSpear.precedence_chain.includes("one_spearpoint")) {
    blocked_by.push("spearpoint_removal_not_detected");
  }
  const ok = blocked_by.length === 0;

  return Object.freeze({
    ok,
    schema: BIZRA_PROMPT_COMPILER_SCHEMA,
    truth_label: BIZRA_PROMPT_COMPILER_TRUTH_LABEL,
    go_phrase: BIZRA_PROMPT_COMPILER_GO_PHRASE.length > 0 ? "bound" : "missing",
    operators_compiled: compiled.operators.length,
    phases: compiled.phase_order.length,
    precedence_chain: compiled.precedence_chain,
    uncompiled_reported: compiled.uncompiled_tokens.length,
    boundary: compiled.boundary,
    blocked_by: Object.freeze(blocked_by),
    content_hash: compiled.content_hash,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = runBizraPromptCompilerCheck();
  if (JSON_MODE) console.log(JSON.stringify(r, null, 2));
  else {
    console.log("DEMA - BIZRA-PROMPT-COMPILER-0A");
    console.log(`  schema: ${BIZRA_PROMPT_COMPILER_SCHEMA}`);
    console.log(`  truth:  ${BIZRA_PROMPT_COMPILER_TRUTH_LABEL}`);
    console.log(`  ops=${r.operators_compiled} phases=${r.phases} chain=${r.precedence_chain.join(">")}`);
    console.log(`  uncompiled reported: ${r.uncompiled_reported}`);
    console.log(`  result: ${r.ok ? "PASS" : "FAIL"}`);
    for (const c of r.blocked_by) console.log(`    ${c}`);
  }
  process.exitCode = r.ok ? 0 : 1;
}
