#!/usr/bin/env node
// DEMA-FDE-ISNAD-REPLAY-CAPSULE-PREVIEW-0A — review gate. Runs the slice proof loop
// (build a content-addressed capsule → verify PERMIT → replay it model-free → block a
// forged route) and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  runFdeIsnadReplayCapsulePreview,
  FDE_ISNAD_REPLAY_CAPSULE_SCHEMA,
  FDE_ISNAD_REPLAY_CAPSULE_EVAL_SCHEMA,
  FDE_ISNAD_REPLAY_CAPSULE_TRUTH_LABEL,
} from "../../packages/core/src/fde-isnad-replay-capsule-preview.js";

const JSON_MODE = process.argv.includes("--json");

// Canonical capsule input: a mission stopped on an implementation defect, with a full
// Isnād lineage (origin → first appearance → author/model → evidence → verifier →
// status). Only hashes + enum labels are bound — never raw evidence text.
const CANONICAL_INPUT = {
  event_hash: `sha256:${"a".repeat(64)}`,
  diagnosis: "implementation_defect",
  source_lineage: [
    { step: 0, ref_hash: `sha256:${"1".repeat(64)}`, role: "origin" },
    { step: 1, ref_hash: `sha256:${"2".repeat(64)}`, role: "first_appearance" },
    { step: 2, ref_hash: `sha256:${"3".repeat(64)}`, role: "author_or_model" },
    { step: 3, ref_hash: `sha256:${"4".repeat(64)}`, role: "evidence" },
    { step: 4, ref_hash: `sha256:${"5".repeat(64)}`, role: "verifier" },
    { step: 5, ref_hash: `sha256:${"6".repeat(64)}`, role: "status" },
  ],
};

export function runFdeIsnadReplayCapsulePreviewCheck() {
  return runFdeIsnadReplayCapsulePreview({ input: CANONICAL_INPUT });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runFdeIsnadReplayCapsulePreviewCheck();

  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA - DEMA-FDE-ISNAD-REPLAY-CAPSULE-PREVIEW-0A");
    console.log(`  capsule_schema: ${FDE_ISNAD_REPLAY_CAPSULE_SCHEMA}`);
    console.log(`  eval_schema: ${FDE_ISNAD_REPLAY_CAPSULE_EVAL_SCHEMA}`);
    console.log(`  truth: ${FDE_ISNAD_REPLAY_CAPSULE_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
