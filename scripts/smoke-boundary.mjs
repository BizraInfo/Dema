#!/usr/bin/env node
//
// smoke-boundary — Canary script for the canonical preview boundary.
//
// Invokes each spine CLI command and asserts that the emitted JSON has
// a `boundary` field that satisfies `isCanonicalBoundary()`. If any
// command emits a non-canonical boundary (extra keys · missing keys ·
// truthy values · non-frozen), this script exits non-zero.
//
// Use cases:
//   - `npm run smoke-boundary` for local verification
//   - CI gate (when GitHub Actions dispatch recovers)
//   - operator one-line check before promoting a new preview surface
//
// Operating law applied: the canonical boundary IS the safety contract.
// A drift detector at CLI-invocation time catches what type-checking
// cannot: an emitter that accidentally adds, removes, or flips a key.
//
// Read-only · no chain advance · no receipt mint · no model invocation.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  isCanonicalBoundaryShape,
  PREVIEW_BOUNDARY_CANONICAL_KEYS
} from "../packages/core/src/preview-boundary.js";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = join(__dirname, "..", "apps", "cli", "src", "index.js");

const SPINE_COMMANDS = Object.freeze([
  "state",
  "profiles",
  "consent-card",
  "mission-loop",
  "evidence-event",
  "llm-router",
  "process-mining",
  "key-maker-check"
]);

async function checkOne(cmd) {
  let stdout;
  try {
    const result = await execFileAsync("node", [CLI_PATH, cmd], { timeout: 10000 });
    stdout = result.stdout;
  } catch (err) {
    return {
      cmd,
      ok: false,
      reason: `exec_error: ${err.message?.split("\n")[0] ?? "unknown"}`
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (err) {
    return { cmd, ok: false, reason: "json_parse_error" };
  }

  if (!parsed || typeof parsed !== "object") {
    return { cmd, ok: false, reason: "non_object_output" };
  }
  if (!parsed.boundary) {
    return { cmd, ok: false, reason: "missing_boundary_field" };
  }
  // Use shape-only check: JSON.parse'd boundaries lose their freeze property
  // but should still match canonical key set + all-false values. The freeze
  // invariant is verified in-process by preview-boundary.test.js.
  if (!isCanonicalBoundaryShape(parsed.boundary)) {
    return { cmd, ok: false, reason: "non_canonical_boundary_shape" };
  }
  return { cmd, ok: true, reason: null };
}

export async function runSmokeBoundary() {
  const results = [];
  for (const cmd of SPINE_COMMANDS) {
    results.push(await checkOne(cmd));
  }
  const allCanonical = results.every((r) => r.ok);
  return {
    schema: "bizra.dema.smoke_boundary_report.v0.1",
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    commands_checked: results.length,
    canonical_keys_expected: PREVIEW_BOUNDARY_CANONICAL_KEYS.length,
    all_canonical: allCanonical,
    results,
    next_safe_action: allCanonical
      ? "promote_new_preview_surface_with_confidence"
      : "investigate_non_canonical_emitter"
  };
}

export const SMOKE_BOUNDARY_SPINE_COMMANDS = SPINE_COMMANDS;

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  runSmokeBoundary().then((report) => {
    console.log(JSON.stringify(report, null, 2));
    if (!report.all_canonical) {
      process.exit(1);
    }
  }).catch((err) => {
    console.error("smoke-boundary failed:", err);
    process.exit(2);
  });
}
