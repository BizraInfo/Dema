#!/usr/bin/env node
import { execFileSync } from "node:child_process";

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function currentBranch() {
  return process.env.GITHUB_HEAD_REF ||
    execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
}

const reviewClass = argValue("--class");
if (reviewClass !== "proof/u1") {
  throw new Error("BIZRA Review Gate supports only --class proof/u1 in this checkout.");
}

const branch = currentBranch();
if (branch && !branch.startsWith("proof/u1-")) {
  throw new Error(`proof/u1 PRs must use a proof/u1-* branch; got ${branch}`);
}

console.log(JSON.stringify({
  schema: "bizra.dema.review.pr_class.v0.1",
  ok: true,
  class: reviewClass,
  branch,
  advisory_reviewers: ["CodeRabbit", "Copilot review"],
  required_gate: "BIZRA Review Gate"
}, null, 2));
