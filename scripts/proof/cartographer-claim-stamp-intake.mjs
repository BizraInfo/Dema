#!/usr/bin/env node
/**
 * CARTOGRAPHER-CLAIM-STAMP-INTAKE-1A — map-only proof CLI.
 *
 * Usage:
 *   node scripts/proof/cartographer-claim-stamp-intake.mjs --root <abs-dir>
 *
 * Exit 0 = assessment ran (including honest BLOCKED). Exit 2 = usage error.
 * Never mutates the scanned directory. Never promotes PDF-only roots to GREEN.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  assessCartographerIntake,
  CARTOGRAPHER_INTAKE_TRUTH,
} from "../../packages/core/src/cartographer-claim-stamp-intake.js";

function parseArgs(argv) {
  let root = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--root" && argv[i + 1]) {
      root = argv[++i];
    } else if (argv[i] === "--help" || argv[i] === "-h") {
      return { help: true };
    }
  }
  return { root };
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help || !args.root) {
    process.stderr.write(
      "Usage: node scripts/proof/cartographer-claim-stamp-intake.mjs --root <abs-dir>\n",
    );
    process.exitCode = args.help ? 0 : 2;
    return null;
  }

  const intakeRoot = resolve(args.root);
  const result = assessCartographerIntake({
    intakeRoot,
    listNames: (dir) => readdirSync(dir),
    readText: (p) => readFileSync(p, "utf8"),
    pathJoin: join,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  // Exit 0 even when BLOCKED — the honest BLOCKED is the proof for PDF-only roots.
  // Exit 1 only when the assessor itself could not run (should not happen after IO inject).
  if (result.truth_label === CARTOGRAPHER_INTAKE_TRUTH.BLOCKED && result.missing?.includes("intake_io")) {
    process.exitCode = 1;
  } else {
    process.exitCode = 0;
  }
  return result;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

export { main };
