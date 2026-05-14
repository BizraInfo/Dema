#!/usr/bin/env node
import { execFileSync } from "node:child_process";

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
  "scripts/review/receipt-integrity.mjs"
]);

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function baseRef() {
  return process.env.BIZRA_REVIEW_BASE ||
    (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "origin/main");
}

function changedFiles() {
  return execFileSync("git", ["diff", "--name-only", `${baseRef()}...HEAD`], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

const reviewClass = argValue("--class");
if (reviewClass !== "proof/u1") throw new Error("proof-scope only supports --class proof/u1.");

const files = changedFiles();
const unexpected = files.filter((file) => !U1_FILES.has(file) && !GATE_FILES.has(file));
if (unexpected.length > 0) {
  throw new Error(`proof/u1 scope contains unexpected files: ${unexpected.join(", ")}`);
}

for (const required of [
  "scripts/node0-local-urp-proof.mjs",
  "scripts/node0-self-check.mjs",
  "tests/node0-local-urp-proof.test.js",
  "tests/node0-self-check.test.js"
]) {
  if (!files.includes(required)) throw new Error(`proof/u1 scope missing required file: ${required}`);
}

console.log(JSON.stringify({
  schema: "bizra.dema.review.proof_scope.v0.1",
  ok: true,
  class: reviewClass,
  changed_files: files,
  allowed_u1_files: [...U1_FILES],
  allowed_gate_files: [...GATE_FILES]
}, null, 2));
