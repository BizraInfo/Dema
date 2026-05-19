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
  "docs/UX_BLUEPRINT.md",
  "packages/core/src/ambient.js",
  "packages/core/src/safety-report.js",
  "packages/core/src/shell.js",
  "packages/consent/src/consent-common.js",
  "packages/consent/src/consent-extract.js",
  "packages/consent/src/consent-format.js",
  "packages/consent/src/consent-planner.js",
  "packages/mission/src/diagnostics-plan.js",
  "packages/mission/src/journey.js",
  "packages/mission/src/mission-draft.js",
  "packages/models/src/model-common.js",
  "packages/models/src/model-format.js",
  "packages/models/src/model-inventory.js",
  "packages/models/src/model-routing.js",
  "packages/models/src/model-safety.js",
  "scripts/check.mjs",
  "tests/ambient.test.js",
  "tests/consent-planner.test.js",
  "tests/diagnostics-plan.test.js",
  "tests/journey.test.js",
  "tests/mission-draft.test.js",
  "tests/models.test.js",
  "tests/safety-report.test.js"
];

const claimLedgerCheckerFiles = [
  "package.json",
  "scripts/claim-ledger-check.mjs",
  "tests/claim-ledger-check.test.js"
];

const amanaKernelContractFiles = [
  "packages/consent/src/consent-hash-table.js",
  "packages/capabilities/src/effect-cap.js",
  "packages/evidence/src/evidence-chain.js",
  "packages/impact/src/impact-event.js",
  "tests/consent-hash-table.test.js",
  "tests/effect-cap.test.js",
  "tests/evidence-chain.test.js",
  "tests/impact-event.test.js"
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

test("tooling/claim-ledger-checker PR class accepts only checker and policy branches", () => {
  assert.equal(validatePrClass({
    reviewClass: "tooling/claim-ledger-checker",
    branch: "tooling/claim-ledger-checker"
  }).ok, true);
  assert.equal(validatePrClass({
    reviewClass: "tooling/claim-ledger-checker",
    branch: "ci/claim-ledger-checker-class"
  }).ok, true);
  assert.throws(
    () => validatePrClass({ reviewClass: "tooling/claim-ledger-checker", branch: "tooling/random" }),
    /do not allow branch/
  );
  assert.throws(
    () => validatePrClass({ reviewClass: "tooling/claim-ledger-checker", branch: "u2/dema-preview-surfaces" }),
    /do not allow branch/
  );
});

test("tooling/claim-ledger-checker proof scope allows only claim checker files", () => {
  const report = validateProofScope({
    reviewClass: "tooling/claim-ledger-checker",
    files: claimLedgerCheckerFiles
  });

  assert.equal(report.ok, true);
  for (const unexpected of [
    "docs/ROADMAP.md",
    "apps/cli/src/index.js",
    "packages/core/src/ambient.js",
    "packages/node-adapter/src/gateway-http-adapter.js",
    "packages/receipts/src/receipt-store.js",
    "artifacts/proofs/node0-local-urp/self_check_report.json",
    ".github/workflows/check.yml"
  ]) {
    assert.throws(
      () => validateProofScope({
        reviewClass: "tooling/claim-ledger-checker",
        files: [...claimLedgerCheckerFiles, unexpected]
      }),
      /unexpected files/
    );
  }
  assert.throws(
    () => validateProofScope({
      reviewClass: "tooling/claim-ledger-checker",
      files: claimLedgerCheckerFiles.filter((file) => file !== "scripts/claim-ledger-check.mjs")
    }),
    /missing required file/
  );
});

test("tooling/claim-ledger-checker allows gate-policy files for the class policy PR itself", () => {
  const report = validateProofScope({
    reviewClass: "tooling/claim-ledger-checker",
    files: [
      ".github/workflows/bizra-review.yml",
      "scripts/review/pr-class.mjs",
      "scripts/review/proof-scope.mjs",
      "tests/review-gate.test.js"
    ]
  });

  assert.equal(report.ok, true);
});

test("u2.1/amana-kernel-contracts PR class accepts only contracts and policy branches", () => {
  assert.equal(validatePrClass({
    reviewClass: "u2.1/amana-kernel-contracts",
    branch: "u2.1/amana-kernel-contracts"
  }).ok, true);
  assert.equal(validatePrClass({
    reviewClass: "u2.1/amana-kernel-contracts",
    branch: "ci/u2.1-amana-kernel-contracts-class"
  }).ok, true);
  assert.throws(
    () => validatePrClass({ reviewClass: "u2.1/amana-kernel-contracts", branch: "u2/dema-preview-surfaces" }),
    /do not allow branch/
  );
  assert.throws(
    () => validatePrClass({ reviewClass: "u2.1/amana-kernel-contracts", branch: "u2.1/random" }),
    /do not allow branch/
  );
});

test("u2.1/amana-kernel-contracts proof scope allows only Amana contract files", () => {
  const report = validateProofScope({
    reviewClass: "u2.1/amana-kernel-contracts",
    files: amanaKernelContractFiles
  });

  assert.equal(report.ok, true);
  for (const unexpected of [
    "apps/cli/src/index.js",
    "docs/ROADMAP.md",
    "artifacts/proofs/node0-local-urp/self_check_report.json",
    "packages/node-adapter/src/gateway-http-adapter.js",
    "packages/receipts/src/receipt-store.js",
    "scripts/release-readiness.mjs",
    "packages/models/src/model-inventory.js",
    ".github/workflows/check.yml"
  ]) {
    assert.throws(
      () => validateProofScope({
        reviewClass: "u2.1/amana-kernel-contracts",
        files: [...amanaKernelContractFiles, unexpected]
      }),
      /unexpected files/
    );
  }
  assert.throws(
    () => validateProofScope({
      reviewClass: "u2.1/amana-kernel-contracts",
      files: amanaKernelContractFiles.filter((file) => file !== "packages/evidence/src/evidence-chain.js")
    }),
    /missing required file/
  );
});

test("u2.1/amana-kernel-contracts allows gate-policy files for the class policy PR itself", () => {
  const report = validateProofScope({
    reviewClass: "u2.1/amana-kernel-contracts",
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

test("existing proof classes remain strict and do not accept claim-ledger checker files", () => {
  for (const reviewClass of ["proof/u1", "docs/u1-proof-pin", "devops/release-readiness", "u2/dema-preview-surfaces"]) {
    assert.throws(
      () => validateProofScope({
        reviewClass,
        files: ["scripts/claim-ledger-check.mjs"]
      }),
      /unexpected files/
    );
  }
});

test("existing proof classes remain strict and do not accept Amana contract files", () => {
  for (const reviewClass of [
    "proof/u1",
    "docs/u1-proof-pin",
    "devops/release-readiness",
    "u2/dema-preview-surfaces",
    "tooling/claim-ledger-checker"
  ]) {
    assert.throws(
      () => validateProofScope({
        reviewClass,
        files: ["packages/evidence/src/evidence-chain.js"]
      }),
      /unexpected files/
    );
  }
});

test("policy/broad-scope PR class accepts adr/* and policy/* and governance/* and tooling/* and fix/* branches", () => {
  for (const branch of [
    "adr/007-accept-clean",
    "adr/008-something",
    "policy/proof-quality-broad-scope",
    "governance/charter-update",
    "tooling/env-hygiene-check",
    "fix/pr-50-followup-test-stabilization",
    "fix/something-broken"
  ]) {
    assert.equal(
      validatePrClass({ reviewClass: "policy/broad-scope", branch }).ok,
      true,
      `policy/broad-scope should accept ${branch}`
    );
  }
});

test("policy/broad-scope PR class rejects non-allowlisted branches", () => {
  for (const branch of ["feature/random", "main"]) {
    assert.throws(
      () => validatePrClass({ reviewClass: "policy/broad-scope", branch }),
      /do not allow branch/,
      `policy/broad-scope should reject ${branch}`
    );
  }
});

test("MAIN-01: policy/merged-to-main PR class accepts the literal main branch (canonical state)", () => {
  const out = validatePrClass({ reviewClass: "policy/merged-to-main", branch: "main" });
  assert.equal(out.ok, true);
  assert.equal(out.class, "policy/merged-to-main");
});

test("MAIN-02: policy/merged-to-main PR class rejects any non-main branch", () => {
  for (const branch of ["adr/something", "fix/random", "season-test", "feature/x"]) {
    assert.throws(
      () => validatePrClass({ reviewClass: "policy/merged-to-main", branch }),
      /do not allow branch/,
      `policy/merged-to-main must reject ${branch} (only main is valid for canonical-state class)`
    );
  }
});

test("MAIN-03: policy/merged-to-main proof scope accepts any file list (canonical state already gated upstream)", () => {
  const broadFileSet = [
    "docs/anything.md",
    "packages/random/src/foo.js",
    "tests/random.test.js",
    "scripts/anything.mjs",
    ".github/workflows/anything.yml"
  ];
  const report = validateProofScope({
    reviewClass: "policy/merged-to-main",
    files: broadFileSet
  });
  assert.equal(report.ok, true);
  assert.equal(report.class, "policy/merged-to-main");
});

test("MAIN-04: ci/* branches map to policy/broad-scope (parity with adr/* and fix/*)", () => {
  const out = validatePrClass({ reviewClass: "policy/broad-scope", branch: "ci/push-trigger-and-walkdir-tests" });
  assert.equal(out.ok, true);
});

test("MAIN-05: docs/* branches map to policy/broad-scope (parity with adr/* fix/* ci/*)", () => {
  const out = validatePrClass({ reviewClass: "policy/broad-scope", branch: "docs/canonize-step7-second-boundary-vocab" });
  assert.equal(out.ok, true);
});

test("policy/broad-scope proof scope accepts any file list and skips allowlist enforcement", () => {
  const broadFileSet = [
    "docs/anything.md",
    "packages/random/src/foo.js",
    "tests/random.test.js",
    "scripts/anything.mjs"
  ];

  const report = validateProofScope({
    reviewClass: "policy/broad-scope",
    files: broadFileSet
  });

  assert.equal(report.ok, true);
  assert.equal(report.enforcement, "advisory_reviewer_discipline");
  assert.deepEqual(report.changed_files, broadFileSet);
});

test("policy/broad-scope proof scope accepts empty file list", () => {
  const report = validateProofScope({ reviewClass: "policy/broad-scope", files: [] });
  assert.equal(report.ok, true);
  assert.equal(report.enforcement, "advisory_reviewer_discipline");
});
