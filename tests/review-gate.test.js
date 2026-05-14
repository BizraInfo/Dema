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

const u2DemaPreviewFiles = [
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

test("u2/dema-preview-surfaces PR class accepts only the preview and policy branches", () => {
  assert.equal(validatePrClass({
    reviewClass: "u2/dema-preview-surfaces",
    branch: "u2/dema-preview-surfaces"
  }).ok, true);
  assert.equal(validatePrClass({
    reviewClass: "u2/dema-preview-surfaces",
    branch: "ci/u2-dema-preview-class"
  }).ok, true);
  assert.throws(
    () => validatePrClass({ reviewClass: "u2/dema-preview-surfaces", branch: "u2/random" }),
    /do not allow branch/
  );
  assert.throws(
    () => validatePrClass({ reviewClass: "u2/dema-preview-surfaces", branch: "feat/dema-preview" }),
    /do not allow branch/
  );
});

test("u2/dema-preview-surfaces proof scope allows only the Dema preview surface files", () => {
  const report = validateProofScope({
    reviewClass: "u2/dema-preview-surfaces",
    files: u2DemaPreviewFiles
  });

  assert.equal(report.ok, true);
  assert.throws(
    () => validateProofScope({
      reviewClass: "u2/dema-preview-surfaces",
      files: [...u2DemaPreviewFiles, "package.json"]
    }),
    /unexpected files/
  );
  assert.throws(
    () => validateProofScope({
      reviewClass: "u2/dema-preview-surfaces",
      files: [...u2DemaPreviewFiles, "packages/node-adapter/src/gateway-http-adapter.js"]
    }),
    /unexpected files/
  );
  assert.throws(
    () => validateProofScope({
      reviewClass: "u2/dema-preview-surfaces",
      files: [...u2DemaPreviewFiles, ".github/workflows/check.yml"]
    }),
    /unexpected files/
  );
  assert.throws(
    () => validateProofScope({
      reviewClass: "u2/dema-preview-surfaces",
      files: [...u2DemaPreviewFiles, "artifacts/proofs/node0-local-urp/self_check_report.json"]
    }),
    /unexpected files/
  );
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

test("existing proof classes remain strict and do not accept U2 Dema preview files", () => {
  for (const reviewClass of ["proof/u1", "docs/u1-proof-pin", "devops/release-readiness"]) {
    assert.throws(
      () => validateProofScope({
        reviewClass,
        files: ["packages/mission/src/mission-draft.js"]
      }),
      /unexpected files/
    );
  }
});
