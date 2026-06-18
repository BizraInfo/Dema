import { test } from "node:test";
import assert from "node:assert/strict";

import { buildAgentContract } from "../packages/adk/src/agent-contract.js";
import { validateAgentContract } from "../packages/adk/src/agent-validator.js";
import { buildAdkReceiptPreview } from "../packages/adk/src/receipt-preview.js";
import { buildPatAgentTemplate } from "../packages/adk/src/pat-template.js";
import { buildSatAgentTemplate } from "../packages/adk/src/sat-template.js";
import { AGENT_SCOPES, PRIVACY_CLASSES } from "../packages/adk/src/agent-scope.js";
import { isCanonicalBoundary } from "../packages/core/src/preview-boundary.js";

function validPatContract(overrides = {}) {
  return buildAgentContract({
    agent_id: "pat-test",
    serves: "mumu",
    scope: AGENT_SCOPES.PRIVATE_PAT,
    privacy_class: PRIVACY_CLASSES.PAT_RAW_LOCAL,
    truth_label: "TEST",
    allowed_effects: ["READ_LOCAL_METADATA", "DRAFT_PATCH"],
    forbidden_effects: [
      "SIGN",
      "FEDERATE",
      "MINT_TOKEN",
      "EXPORT_PRIVATE_MEMORY",
      "SEND_RAW_MEMORY_TO_SAT",
      "NETWORK",
      "KEY_GENERATION",
      "WRITE_FILE",
    ],
    consent_policy: "Exact GO only.",
    proof_policy: "Proof required.",
    receipt_policy: "Receipt preview required.",
    what_this_proves: "May draft locally.",
    what_this_does_not_prove: "Does not prove execution.",
    stop_by_default: true,
    ...overrides,
  });
}

test("missing scope is refused", () => {
  const contract = validPatContract({ scope: "" });
  const result = validateAgentContract(contract);
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((e) => e.code === "invalid_scope" || e.code === "missing_guardrail_field"),
  );
});

test("stop_by_default must be true", () => {
  const contract = validPatContract({ stop_by_default: false });
  const result = validateAgentContract(contract);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.code === "stop_by_default_required"));
});

test("signing/federation/token effects forbidden by default", () => {
  const contract = validPatContract({
    allowed_effects: ["READ_LOCAL_METADATA", "SIGN", "FEDERATE", "MINT_TOKEN"],
    forbidden_effects: ["EXPORT_PRIVATE_MEMORY"],
  });
  const result = validateAgentContract(contract);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.code === "forbidden_effect_allowed"));
});

test("receipt preview requires what_this_does_not_prove", () => {
  const contract = validPatContract({ what_this_does_not_prove: "" });
  const preview = buildAdkReceiptPreview(contract);
  assert.equal(preview.built, false);
});

test("valid PAT template passes validation", () => {
  const contract = buildPatAgentTemplate({ agent_id: "pat-engineer" });
  const result = validateAgentContract(contract);
  assert.equal(result.valid, true);
  assert.ok(isCanonicalBoundary(contract.boundary));
});

test("valid SAT template passes validation", () => {
  const contract = buildSatAgentTemplate({ agent_id: "sat-verifier" });
  const result = validateAgentContract(contract);
  assert.equal(result.valid, true);
});

test("receipt preview builds for valid contract", () => {
  const contract = buildPatAgentTemplate();
  const preview = buildAdkReceiptPreview(contract);
  assert.equal(preview.built, true);
  assert.ok(preview.what_this_does_not_prove.length > 0);
  assert.ok(isCanonicalBoundary(preview.boundary));
});
