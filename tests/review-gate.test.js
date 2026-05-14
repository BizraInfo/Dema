import test from "node:test";
import assert from "node:assert/strict";

import { validatePrClass } from "../scripts/review/pr-class.mjs";
import { validateProofScope } from "../scripts/review/proof-scope.mjs";

const u1Files = [
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
];

test("docs/u1-proof-pin PR class accepts the proof-pin branch only", () => {
  const report = validatePrClass({
    reviewClass: "docs/u1-proof-pin",
    branch: "proof/u1-proof-pin"
  });

  assert.equal(report.ok, true);
  assert.throws(
    () => validatePrClass({ reviewClass: "docs/u1-proof-pin", branch: "proof/u1-random" }),
    /do not allow branch/
  );
});

test("docs/u1-proof-pin proof scope allows only the U1 proof pin document", () => {
  const report = validateProofScope({
    reviewClass: "docs/u1-proof-pin",
    files: ["docs/08-quality/U1_NODE0_LOCAL_URP_PROOF_PIN.md"]
  });

  assert.equal(report.ok, true);
  assert.throws(
    () => validateProofScope({ reviewClass: "docs/u1-proof-pin", files: ["scripts/check.mjs"] }),
    /unexpected files/
  );
  assert.throws(
    () => validateProofScope({
      reviewClass: "docs/u1-proof-pin",
      files: ["artifacts/proofs/node0-local-urp/self_check_report.json"]
    }),
    /unexpected files/
  );
  assert.throws(
    () => validateProofScope({ reviewClass: "docs/u1-proof-pin", files: ["package.json"] }),
    /unexpected files/
  );
  assert.throws(
    () => validateProofScope({ reviewClass: "docs/u1-proof-pin", files: ["docs/ROADMAP.md"] }),
    /unexpected files/
  );
});

test("devops/release-readiness PR class accepts only release-readiness branches", () => {
  const report = validatePrClass({
    reviewClass: "devops/release-readiness",
    branch: "devops/release-readiness"
  });

  assert.equal(report.ok, true);
  assert.throws(
    () => validatePrClass({ reviewClass: "devops/release-readiness", branch: "devops/random" }),
    /do not allow branch/
  );
});

test("devops/release-readiness proof scope allows only release-readiness files", () => {
  const devopsFiles = [
    "docs/DELIVERY_BLUEPRINT.md",
    "package.json",
    "scripts/check.mjs",
    "scripts/release-readiness.mjs",
    "tests/release-readiness.test.js"
  ];

  const report = validateProofScope({
    reviewClass: "devops/release-readiness",
    files: devopsFiles
  });

  assert.equal(report.ok, true);
  assert.throws(
    () => validateProofScope({
      reviewClass: "devops/release-readiness",
      files: [...devopsFiles, "artifacts/proofs/node0-local-urp/self_check_report.json"]
    }),
    /unexpected files/
  );
  assert.throws(
    () => validateProofScope({
      reviewClass: "devops/release-readiness",
      files: [...devopsFiles, "apps/cli/src/index.js"]
    }),
    /unexpected files/
  );
  assert.throws(
    () => validateProofScope({
      reviewClass: "devops/release-readiness",
      files: [...devopsFiles, "packages/node-adapter/src/gateway-http.js"]
    }),
    /unexpected files/
  );
  assert.throws(
    () => validateProofScope({
      reviewClass: "devops/release-readiness",
      files: [...devopsFiles, "packages/receipts/src/receipt-store.js"]
    }),
    /unexpected files/
  );
  assert.throws(
    () => validateProofScope({
      reviewClass: "devops/release-readiness",
      files: [...devopsFiles, "docs/ROADMAP.md"]
    }),
    /unexpected files/
  );
  assert.throws(
    () => validateProofScope({
      reviewClass: "devops/release-readiness",
      files: [...devopsFiles, ".github/workflows/check.yml"]
    }),
    /unexpected files/
  );
  assert.throws(
    () => validateProofScope({
      reviewClass: "devops/release-readiness",
      files: devopsFiles.filter((file) => file !== "scripts/release-readiness.mjs")
    }),
    /missing required file/
  );
});

test("devops/release-readiness allows gate-policy files for the class policy PR itself", () => {
  const report = validateProofScope({
    reviewClass: "devops/release-readiness",
    files: [
      ".github/workflows/bizra-review.yml",
      "scripts/review/pr-class.mjs",
      "scripts/review/proof-scope.mjs",
      "tests/review-gate.test.js"
    ]
  });

  assert.equal(report.ok, true);
});

test("proof/u1 remains strict and does not accept proof-pin docs", () => {
  assert.equal(validateProofScope({ reviewClass: "proof/u1", files: u1Files }).ok, true);
  assert.throws(
    () => validateProofScope({
      reviewClass: "proof/u1",
      files: [...u1Files, "docs/08-quality/U1_NODE0_LOCAL_URP_PROOF_PIN.md"]
    }),
    /unexpected files/
  );
});

test("docs/u1-proof-pin remains strict and does not accept DevOps docs", () => {
  assert.throws(
    () => validateProofScope({
      reviewClass: "docs/u1-proof-pin",
      files: ["docs/08-quality/U1_NODE0_LOCAL_URP_PROOF_PIN.md", "docs/DELIVERY_BLUEPRINT.md"]
    }),
    /unexpected files/
  );
});
