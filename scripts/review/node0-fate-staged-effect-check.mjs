#!/usr/bin/env node
// NODE0-FATE-STAGED-EFFECT-1A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  runNode0FateStagedEffect,
  NODE0_FATE_STAGED_EFFECT_REQUIRED_PHRASE,
  NODE0_FATE_STAGED_EFFECT_SCHEMA,
  NODE0_FATE_STAGED_EFFECT_TRUTH_LABEL,
  NODE0_FATE_STAGED_EFFECT_GO_PHRASE,
} from "../../packages/core/src/node0-fate-staged-effect.js";

const JSON_MODE = process.argv.includes("--json");

const HEX64 = (ch) => ch.repeat(64);

// Canonical gate fixture: one fresh composition over a real temp scope.
// Proves FATE permit → stage → gate-executed rename → independent observation
// → committed envelope with exactly-once count and body-bound hash.
export function runNode0FateStagedEffectCheck() {
  const nodeFs = createRequire(import.meta.url)("node:fs");
  const dir = nodeFs.mkdtempSync(join(tmpdir(), "fse-gate-"));
  try {
    nodeFs.writeFileSync(join(dir, "alpha.txt"), "genesis-bytes\n");
    return runNode0FateStagedEffect({
      consent: NODE0_FATE_STAGED_EFFECT_GO_PHRASE,
      input: {
        fs: nodeFs,
        scopeDir: dir,
        operatorPhrase: NODE0_FATE_STAGED_EFFECT_REQUIRED_PHRASE,
        fileName: "alpha.txt",
        newName: "beta.txt",
      },
    });
  } finally {
    nodeFs.rmSync(dir, { recursive: true, force: true });
  }
}


if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode0FateStagedEffectCheck();

  if (JSON_MODE) {
    // Strip heavy/non-summary fields here if the envelope carries them.
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - NODE0-FATE-STAGED-EFFECT-1A");
    console.log(`  schema: ${NODE0_FATE_STAGED_EFFECT_SCHEMA}`);
    console.log(`  truth: ${NODE0_FATE_STAGED_EFFECT_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
