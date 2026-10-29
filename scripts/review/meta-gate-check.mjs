#!/usr/bin/env node
// META-GATE-CHECK-1A — executable rule-to-gate review check (read-only).
//
// Enforces the governing law on the repository's own invariant inventory:
// "No rule without an executable gate and negative control." It imports the
// declared CANONICAL_META_GATE_INVENTORY and the pure auditor, then:
//   1. audits the declared inventory (every row must be a
//      VERIFIED_FALSIFIABLE_CONTROL), and
//   2. verifies on disk (existsSync) that every declared executableGatePath
//      and negativeControlTestPath actually exists — the anti-phantom-path
//      guard: a rule that points at a gate or a negative-control test that is
//      not on disk is a wish, not a control, and fails closed here.
// Exit 0 with a deterministic summary when every invariant is backed by a real
// on-disk gate and negative-control test; exit 1 fail-closed otherwise.

import { existsSync } from "node:fs";
import { dirname, join, isAbsolute } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  CANONICAL_META_GATE_INVENTORY,
  auditMetaGateInventory,
  META_GATE_INVENTORY_SCHEMA,
} from "../../packages/core/src/meta-gate-inventory.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");

const JSON_MODE = process.argv.includes("--json");

function resolveRepoPath(relOrAbs) {
  return isAbsolute(relOrAbs) ? relOrAbs : join(REPO_ROOT, relOrAbs);
}

export function runMetaGateCheck() {
  const audit = auditMetaGateInventory(CANONICAL_META_GATE_INVENTORY);

  const missingPaths = [];
  for (const row of CANONICAL_META_GATE_INVENTORY) {
    if (!existsSync(resolveRepoPath(row.executableGatePath))) {
      missingPaths.push({ invariantId: row.invariantId, kind: "gate", path: row.executableGatePath });
    }
    if (!existsSync(resolveRepoPath(row.negativeControlTestPath))) {
      missingPaths.push({
        invariantId: row.invariantId,
        kind: "negative_control_test",
        path: row.negativeControlTestPath,
      });
    }
  }

  const ok = audit.allEnforcedAndFalsifiable === true && missingPaths.length === 0;

  return {
    schema: "bizra.dema.review.meta_gate_check.v0.1",
    ok,
    inventory_schema: META_GATE_INVENTORY_SCHEMA,
    inventory_hash: audit.inventory_hash,
    invariant_count: CANONICAL_META_GATE_INVENTORY.length,
    all_enforced_and_falsifiable: audit.allEnforcedAndFalsifiable,
    rows: audit.rows.map((r) => ({
      invariantId: r.invariantId,
      classification: r.classification,
    })),
    missing_paths: missingPaths,
    boundary: {
      read_only_audit: true,
      runtime_execution: false,
      network_used: false,
      mutation_performed: false,
      authority_delta: 0,
    },
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = runMetaGateCheck();

  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA - Meta-gate rule-to-gate inventory");
    console.log(`  schema: ${result.inventory_schema}`);
    console.log(`  inventory_hash: ${result.inventory_hash}`);
    console.log(`  invariants: ${result.invariant_count}`);
    console.log(`  all_enforced_and_falsifiable: ${result.all_enforced_and_falsifiable}`);
    for (const row of result.rows) {
      console.log(`    ${row.invariantId}: ${row.classification}`);
    }
    if (result.missing_paths.length > 0) {
      console.log("  MISSING ON DISK:");
      for (const m of result.missing_paths) {
        console.log(`    ${m.invariantId} (${m.kind}): ${m.path}`);
      }
    }
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
  }

  if (!result.ok) process.exit(1);
}
