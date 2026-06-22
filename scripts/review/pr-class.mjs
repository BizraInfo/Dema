#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const REVIEW_CLASSES = {
  "proof/u1": {
    branchPrefixes: ["proof/u1-"],
  },
  "docs/u1-proof-pin": {
    branches: [
      "proof/u1-proof-pin",
      "docs/u1-proof-pin",
      "ci/u1-proof-pin-class",
    ],
  },
  "devops/release-readiness": {
    branches: ["devops/release-readiness", "ci/devops-release-readiness-class"],
  },
  "u2/dema-preview-surfaces": {
    branches: ["u2/dema-preview-surfaces", "ci/u2-dema-preview-class"],
  },
  "tooling/claim-ledger-checker": {
    branches: ["tooling/claim-ledger-checker", "ci/claim-ledger-checker-class"],
  },
  "u2.1/amana-kernel-contracts": {
    branches: [
      "u2.1/amana-kernel-contracts",
      "ci/u2.1-amana-kernel-contracts-class",
    ],
  },
  "policy/broad-scope": {
    // Kept in sync with the branch-class case resolver in
    // .github/workflows/bizra-review.yml. pr/* is the clean release-train
    // convention; refactor/* and test/* are accepted as broad-scope too.
    branchPrefixes: [
      "adr/",
      "policy/",
      "governance/",
      "tooling/",
      "season-",
      "fix/",
      "ci/",
      "docs/",
      "feat/",
      "chore/",
      "pr/",
      "refactor/",
      "test/",
    ],
  },
  "policy/merged-to-main": {
    branches: ["main"],
  },
};

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

export function currentBranch() {
  return (
    process.env.GITHUB_HEAD_REF ||
    execFileSync("git", ["branch", "--show-current"], {
      encoding: "utf8",
    }).trim()
  );
}

// Resolve a review class from a branch name. Exact `branches` win over
// `branchPrefixes`; unknown branches default to the most permissive
// `policy/broad-scope` (safe — it only applies advisory reviewer discipline).
// Lets proof-scope self-resolve a class for local `npm run check` while CI
// still passes --class explicitly. Mirrors the bizra-review.yml branch resolver.
export function resolveClassForBranch(branch) {
  if (branch) {
    for (const [reviewClass, policy] of Object.entries(REVIEW_CLASSES)) {
      if (policy.branches?.includes(branch)) return reviewClass;
    }
    for (const [reviewClass, policy] of Object.entries(REVIEW_CLASSES)) {
      if (policy.branchPrefixes?.some((prefix) => branch.startsWith(prefix))) {
        return reviewClass;
      }
    }
  }
  return "policy/broad-scope";
}

export function validatePrClass({ reviewClass, branch }) {
  const policy = REVIEW_CLASSES[reviewClass];
  if (!policy) {
    throw new Error(`Unsupported BIZRA review class: ${reviewClass}`);
  }

  const branchAllowed =
    !branch ||
    policy.branches?.includes(branch) ||
    policy.branchPrefixes?.some((prefix) => branch.startsWith(prefix));

  if (!branchAllowed) {
    throw new Error(`${reviewClass} PRs do not allow branch: ${branch}`);
  }

  return {
    schema: "bizra.dema.review.pr_class.v0.1",
    ok: true,
    class: reviewClass,
    branch,
    advisory_reviewers: ["CodeRabbit", "Copilot review"],
    required_gate: "BIZRA Review Gate",
  };
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const report = validatePrClass({
    reviewClass: argValue("--class"),
    branch: currentBranch(),
  });
  console.log(JSON.stringify(report, null, 2));
}
