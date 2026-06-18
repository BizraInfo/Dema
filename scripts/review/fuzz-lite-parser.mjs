#!/usr/bin/env node
// FUZZ-LITE-1A — bounded deterministic parser property check.

import {
  stableStringify,
  sha256,
} from "../../packages/consent/src/consent-common.js";
import { runParserFuzzLite } from "../../packages/consent/src/parser-fuzz-lite.js";

const JSON_MODE = process.argv.includes("--json");

const report = runParserFuzzLite({ stableStringify, sha256 });

if (JSON_MODE) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("DEMA · fuzz-lite parser (bounded)");
  console.log(`  iterations: ${report.iterations}`);
  console.log(`  seed: ${report.seed}`);
  console.log(`  result: ${report.ok ? "PASS" : "FAIL"}`);
  if (!report.ok) {
    for (const failure of report.failures) {
      console.log(`    - ${failure.message}`);
    }
  }
}

process.exit(report.ok ? 0 : 1);
