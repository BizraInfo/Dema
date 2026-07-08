import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  PLAN_BRANCH_PREVIEW_SCHEMA,
  PLAN_BRANCH_PREVIEW_TRUTH_LABEL,
  PLAN_BRANCH_PREVIEW_GO_PHRASE,
  evaluatePlanBranches,
  planPlanBranchPreview,
  buildPlanBranchPreviewPayload,
  verifyPlanBranchPreview,
  runPlanBranchPreview,
} from "../packages/core/src/plan-branch-preview.js";
import { examplePlanBranchInput, H } from "../scripts/review/plan-branch-preview-fixtures.mjs";
import { runPlanBranchPreviewCheck } from "../scripts/review/plan-branch-preview-check.mjs";

const GO = PLAN_BRANCH_PREVIEW_GO_PHRASE;

function rehash(body) {
  const stable = (v) => {
    if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
    if (v && typeof v === "object") {
      return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
    }
    return JSON.stringify(v);
  };
  return `sha256:${createHash("sha256").update(stable(body), "utf8").digest("hex")}`;
}

test("plan fails closed without exact consent", () => {
  const r = planPlanBranchPreview({ consent: "wrong", input: examplePlanBranchInput() });
  assert.equal(r.eligible, false);
  assert.ok(r.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with valid branches", () => {
  const r = planPlanBranchPreview({ consent: GO, input: examplePlanBranchInput() });
  assert.equal(r.eligible, true, r.blocked_by.join(","));
});

test("evaluate rejects no candidates and missing chosen branch", () => {
  const r = evaluatePlanBranches({ mission_id: "m", niyyah_hash: H("a"), branches: [], chosen_branch_id: "", rejected_branches: [] });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("no_candidate_branches"));
  assert.ok(r.blocked_by.includes("chosen_branch_missing"));
});

test("evaluate rejects missing mission_id and malformed niyyah_hash", () => {
  const input = examplePlanBranchInput();
  const r = evaluatePlanBranches({ ...input, mission_id: "", niyyah_hash: "not-a-hash" });
  assert.ok(r.blocked_by.includes("mission_id_missing"));
  assert.ok(r.blocked_by.includes("niyyah_hash_malformed"));
});

test("evaluate rejects duplicate ids", () => {
  const input = examplePlanBranchInput();
  const r = evaluatePlanBranches({ ...input, branches: [input.branches[0], { ...input.branches[1], id: input.branches[0].id }] });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("duplicate_branch_id"));
});

test("evaluate rejects a branch with an empty id", () => {
  const input = examplePlanBranchInput();
  const r = evaluatePlanBranches({ ...input, branches: [input.branches[0], { ...input.branches[1], id: "" }, input.branches[2]] });
  assert.ok(r.blocked_by.includes("branch_id_missing"));
});

test("evaluate rejects chosen branch not in candidates", () => {
  const input = examplePlanBranchInput();
  const r = evaluatePlanBranches({ ...input, chosen_branch_id: "no-such-branch" });
  assert.ok(r.blocked_by.includes("chosen_branch_not_in_candidates"));
});

test("evaluate rejects chosen branch also rejected", () => {
  const input = examplePlanBranchInput();
  const r = evaluatePlanBranches({
    ...input,
    rejected_branches: [...input.rejected_branches, { branch_id: input.chosen_branch_id, rejection_reason: "higher_risk", rejection_basis: "bad" }],
  });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("chosen_branch_also_rejected"));
});

test("evaluate rejects unaccounted branch", () => {
  const input = examplePlanBranchInput();
  const r = evaluatePlanBranches({ ...input, rejected_branches: input.rejected_branches.slice(0, 1) });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.some((x) => x.startsWith("branch_unaccounted:")));
});

test("evaluate rejects duplicate rejected + rejected-not-in-candidates", () => {
  const input = examplePlanBranchInput();
  const dup = { branch_id: "branch-direct-action", rejection_reason: "higher_risk", rejection_basis: "x" };
  const ghost = { branch_id: "ghost-branch", rejection_reason: "higher_risk", rejection_basis: "x" };
  const r = evaluatePlanBranches({ ...input, rejected_branches: [...input.rejected_branches, dup, ghost] });
  assert.ok(r.blocked_by.includes("duplicate_rejected_branch:branch-direct-action"));
  assert.ok(r.blocked_by.includes("rejected_branch_not_in_candidates:ghost-branch"));
});

test("evaluate rejects invalid rejection reason and missing basis", () => {
  const input = examplePlanBranchInput();
  const r = evaluatePlanBranches({
    ...input,
    rejected_branches: [{ branch_id: "branch-direct-action", rejection_reason: "because_i_said_so", rejection_basis: "" }, input.rejected_branches[1]],
  });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("rejection_reason_invalid:branch-direct-action"));
  assert.ok(r.blocked_by.includes("rejection_basis_missing:branch-direct-action"));
});

test("evaluate rejects authority delta and out-of-range scores", () => {
  const input = examplePlanBranchInput();
  const r = evaluatePlanBranches({
    ...input,
    branches: [{ ...input.branches[0], authority_delta: 1, risk_score: 2, ihsan_score: -1 }, input.branches[1], input.branches[2]],
  });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("chosen_authority_delta_nonzero"));
  assert.ok(r.blocked_by.includes("branch_authority_delta_nonzero:branch-safe-readonly"));
  assert.ok(r.blocked_by.includes("risk_score_out_of_range:branch-safe-readonly"));
  assert.ok(r.blocked_by.includes("ihsan_score_out_of_range:branch-safe-readonly"));
});

test("payload is content-addressed, rejects action authority, marks rejected-as-evidence", () => {
  const p = buildPlanBranchPreviewPayload(examplePlanBranchInput());
  assert.equal(p.schema, PLAN_BRANCH_PREVIEW_SCHEMA);
  assert.equal(p.truth_label, PLAN_BRANCH_PREVIEW_TRUTH_LABEL);
  assert.match(p.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(p.rejected_branches_are_evidence, true);
  assert.equal(p.action_allowed, false);
  assert.equal(p.authority_delta, 0);
  assert.equal(p.boundary.network_used, false);
});

test("verify accepts fresh payload", () => {
  assert.equal(verifyPlanBranchPreview(buildPlanBranchPreviewPayload(examplePlanBranchInput())).ok, true);
});

test("verify rejects content hash tamper and non-object", () => {
  const p = buildPlanBranchPreviewPayload(examplePlanBranchInput());
  assert.equal(verifyPlanBranchPreview({ ...p, content_hash: H("0") }).ok, false);
  assert.equal(verifyPlanBranchPreview(null).ok, false);
});

test("verify rejects recomputed-hash laundering for authority/action/live fields", () => {
  const p = buildPlanBranchPreviewPayload(examplePlanBranchInput());
  for (const [field, value, code] of [
    ["authority_delta", 1, "authority_delta_nonzero"],
    ["action_allowed", true, "action_allowed_true"],
    ["grants_action", true, "grants_action_true"],
    ["mint_allowed", true, "mint_allowed_true"],
    ["wallet_used", true, "wallet_used_true"],
    ["federation_live", true, "federation_live_true"],
    ["model_invocation_performed", true, "model_invocation_true"],
  ]) {
    const { content_hash: _drop, ...body } = { ...p, [field]: value };
    const verdict = verifyPlanBranchPreview({ ...body, content_hash: rehash(body) });
    assert.equal(verdict.ok, false, field);
    assert.ok(verdict.blocked_by.includes(code), code);
  }
});

test("verify rejects malformed structure and contradictions", () => {
  const p = buildPlanBranchPreviewPayload(examplePlanBranchInput());
  for (const patch of [
    { schema: "bad" },
    { truth_label: "bad" },
    { mode: "live" },
    { mission_id: "" },
    { niyyah_hash: "bad" },
    { candidate_count: 0 },
    { chosen_branch_id: "" },
    { chosen_branch: null },
    { rejected_branches: "bad" },
    { candidate_branch_refs: "bad" },
    { rejected_branch_refs: "bad" },
    { rejected_branches_are_evidence: false },
    { evaluation_ok: false },
    { evaluation_blocked_by: ["x"] },
    { boundary: {} },
  ]) {
    const { content_hash: _drop, ...body } = { ...p, ...patch };
    assert.equal(verifyPlanBranchPreview({ ...body, content_hash: rehash(body) }).ok, false, JSON.stringify(patch));
  }
});

test("run closes the loop and self-probes tamper", () => {
  const r = runPlanBranchPreview({ consent: GO, input: examplePlanBranchInput() });
  assert.equal(r.ok, true, r.blocked_by?.join(","));
  assert.equal(r.status, "plan_branch_preview_bound");
  assert.equal(r.rejected_branches_are_evidence, true);
  assert.equal(r.authority_delta, 0);
  assert.equal(r.boundary.network_used, false);
});

test("run blocks wrong consent and invalid input", () => {
  assert.equal(runPlanBranchPreview({ consent: "no", input: examplePlanBranchInput() }).ok, false);
  const r = runPlanBranchPreview({ consent: GO, input: { branches: [] } });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.length > 0);
});

test("review gate passes", () => {
  const r = runPlanBranchPreviewCheck();
  assert.equal(r.ok, true, r.blocked_by?.join(","));
  assert.equal(r.schema, PLAN_BRANCH_PREVIEW_SCHEMA);
});

test("kernel remains pure: no fs / network / process / clock / random", () => {
  const src = readFileSync(fileURLToPath(new URL("../packages/core/src/plan-branch-preview.js", import.meta.url)), "utf8");
  assert.doesNotMatch(src, /node:fs|node:net|node:http|node:https|node:dns|child_process/);
  assert.doesNotMatch(src, /globalThis\.fetch|fetch\(/);
  assert.doesNotMatch(src, /Math\.random|Date\.now|new Date\(/);
  assert.doesNotMatch(src, /process\.(env|argv|exit)/);
});
