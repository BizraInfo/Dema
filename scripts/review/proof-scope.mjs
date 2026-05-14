#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const U1_FILES = new Set([
  "artifacts/proofs/node0-local-urp/critic_report_001.json",
  "artifacts/proofs/node0-local-urp/node0_local_urp_status.json",
  "artifacts/proofs/node0-local-urp/poi_sandbox_record.json",
  "artifacts/proofs/node0-local-urp/sat5_urp_registration.json",
  "artifacts/proofs/node0-local-urp/self_check_report.json",
  "artifacts/proofs/node0-local-urp/urp_knowledge_pack_receipt.json",
  "artifacts/proofs/node0-local-urp/urp_local_registry.json",
  "artifacts/proofs/node0-local-urp/urp_resource_offer_receipt.json",
  "artifacts/proofs/node0-local-urp/urp_skill_registry_receipt.json",
  "scripts/check.mjs",
  "scripts/node0-local-urp-proof.mjs",
  "scripts/node0-self-check.mjs",
  "tests/node0-local-urp-proof.test.js",
  "tests/node0-self-check.test.js"
]);

const GATE_FILES = new Set([
  ".github/workflows/bizra-review.yml",
  "scripts/review/no-overclaim.mjs",
  "scripts/review/pr-class.mjs",
  "scripts/review/proof-scope.mjs",
  "scripts/review/receipt-integrity.mjs",
  "tests/review-gate.test.js"
]);

const U1_PROOF_PIN_FILES = new Set([
  "docs/08-quality/U1_NODE0_LOCAL_URP_PROOF_PIN.md"
]);

const DEVOPS_RELEASE_READINESS_FILES = new Set([
  "docs/DELIVERY_BLUEPRINT.md",
  "package.json",
  "scripts/check.mjs",
  "scripts/release-readiness.mjs",
  "tests/release-readiness.test.js"
]);

const U2_DEMA_PREVIEW_SURFACE_FILES = new Set([
  "README.md",
  "apps/cli/src/index.js",
  "packages/core/src/ambient.js",
  "packages/core/src/safety-report.js",
  "packages/core/src/shell.js",
  "packages/consent/src/consent-common.js",
  "packages/consent/src/consent-extract.js",
  "packages/consent/src/consent-format.js",
  "packages/consent/src/consent-planner.js",
  "packages/mission/src/diagnostics-plan.js",
  "packages/mission/src/mission-draft.js",
  "packages/models/src/model-inventory.js",
  "scripts/check.mjs",
  "tests/ambient.test.js",
  "tests/consent-planner.test.js",
  "tests/diagnostics-plan.test.js",
  "tests/mission-draft.test.js",
  "tests/models.test.js",
  "tests/safety-report.test.js"
]);

const REVIEW_CLASSES = {
  "proof/u1": {
    primaryFiles: U1_FILES,
    requiredFiles: [
      "scripts/node0-local-urp-proof.mjs",
      "scripts/node0-self-check.mjs",
      "tests/node0-local-urp-proof.test.js",
      "tests/node0-self-check.test.js"
    ]
  },
  "docs/u1-proof-pin": {
    primaryFiles: U1_PROOF_PIN_FILES,
    requiredFiles: []
  },
  "devops/release-readiness": {
    primaryFiles: DEVOPS_RELEASE_READINESS_FILES,
    requiredFiles: [
      "docs/DELIVERY_BLUEPRINT.md",
      "package.json",
      "scripts/check.mjs",
      "scripts/release-readiness.mjs",
      "tests/release-readiness.test.js"
    ]
  },
  "u2/dema-preview-surfaces": {
    primaryFiles: U2_DEMA_PREVIEW_SURFACE_FILES,
    requiredFiles: []
  }
};

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function baseRef() {
  return process.env.BIZRA_REVIEW_BASE ||
    (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "origin/main");
}

export function changedFiles() {
  return execFileSync("git", ["diff", "--name-only", `${baseRef()}...HEAD`], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

export function validateProofScope({ reviewClass, files }) {
  const policy = REVIEW_CLASSES[reviewClass];
  if (!policy) throw new Error(`Unsupported proof-scope class: ${reviewClass}`);

  const unexpected = files.filter((file) => !policy.primaryFiles.has(file) && !GATE_FILES.has(file));
  if (unexpected.length > 0) {
    throw new Error(`${reviewClass} scope contains unexpected files: ${unexpected.join(", ")}`);
  }

  const includesPrimaryFile = files.some((file) => policy.primaryFiles.has(file));
  if (includesPrimaryFile) {
    for (const required of policy.requiredFiles) {
      if (!files.includes(required)) throw new Error(`${reviewClass} scope missing required file: ${required}`);
    }
  }

  return {
    schema: "bizra.dema.review.proof_scope.v0.1",
    ok: true,
    class: reviewClass,
    changed_files: files,
    allowed_files: [...policy.primaryFiles],
    allowed_gate_files: [...GATE_FILES]
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const report = validateProofScope({
    reviewClass: argValue("--class"),
    files: changedFiles()
  });
  console.log(JSON.stringify(report, null, 2));
}
