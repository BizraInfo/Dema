#!/usr/bin/env node
// PLAN-BRANCH-PREVIEW-1A — review gate. Binds the example candidate/chosen/rejected branch set and
// asserts the receipt is preview-only with an all-false boundary and rejected-branches-as-evidence.

import { pathToFileURL } from "node:url";

import {
  PLAN_BRANCH_PREVIEW_SCHEMA,
  PLAN_BRANCH_PREVIEW_TRUTH_LABEL,
  PLAN_BRANCH_PREVIEW_GO_PHRASE,
  runPlanBranchPreview,
} from "../../packages/core/src/plan-branch-preview.js";
import { examplePlanBranchInput } from "./plan-branch-preview-fixtures.mjs";

const JSON_MODE = process.argv.includes("--json");

export function runPlanBranchPreviewCheck() {
  return runPlanBranchPreview({
    consent: PLAN_BRANCH_PREVIEW_GO_PHRASE,
    input: examplePlanBranchInput(),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runPlanBranchPreviewCheck();
  const boundaryAllFalse = result.boundary && Object.values(result.boundary).every((v) => v === false);
  const ok =
    result.ok === true &&
    result.rejected_branches_are_evidence === true &&
    result.action_allowed === false &&
    result.authority_delta === 0 &&
    result.mint_allowed === false &&
    result.wallet_used === false &&
    result.federation_live === false &&
    boundaryAllFalse === true;

  if (JSON_MODE) {
    console.log(
      JSON.stringify(
        {
          schema: PLAN_BRANCH_PREVIEW_SCHEMA,
          truth_label: PLAN_BRANCH_PREVIEW_TRUTH_LABEL,
          preview_only: true,
          ok,
          status: result.status,
          mission_id: result.mission_id,
          candidate_count: result.candidate_count,
          chosen_branch_id: result.chosen_branch_id,
          rejected_branch_count: result.rejected_branch_count,
          rejected_branches_are_evidence: result.rejected_branches_are_evidence,
          content_hash: result.content_hash,
          action_allowed: result.action_allowed,
          authority_delta: result.authority_delta,
          mint_allowed: result.mint_allowed,
          wallet_used: result.wallet_used,
          federation_live: result.federation_live,
          boundary_all_false: boundaryAllFalse,
          blocked_by: result.blocked_by,
        },
        null,
        2,
      ),
    );
  } else {
    console.log("DEMA - PLAN-BRANCH-PREVIEW-1A (PREVIEW_ONLY · rejected branches are evidence)");
    console.log(`  schema: ${PLAN_BRANCH_PREVIEW_SCHEMA}`);
    console.log(`  truth: ${PLAN_BRANCH_PREVIEW_TRUTH_LABEL}`);
    console.log(`  status: ${result.status}`);
    console.log(`  chosen_branch_id: ${result.chosen_branch_id} · candidates: ${result.candidate_count} · rejected(evidence): ${result.rejected_branch_count}`);
    console.log(`  content_hash: ${result.content_hash}`);
    console.log(`  boundary_all_false: ${boundaryAllFalse} | authority_delta: ${result.authority_delta} | mint_allowed: ${result.mint_allowed}`);
    console.log(`  result: ${ok ? "PASS" : "FAIL"}`);
    if (!ok) for (const code of result.blocked_by || []) console.log(`    ${code}`);
  }

  if (!ok) process.exit(1);
}
