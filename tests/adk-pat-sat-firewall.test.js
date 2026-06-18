import { test } from "node:test";
import assert from "node:assert/strict";

import { buildAgentContract } from "../packages/adk/src/agent-contract.js";
import { validateAgentContract } from "../packages/adk/src/agent-validator.js";
import { buildPatAgentTemplate } from "../packages/adk/src/pat-template.js";
import { buildSatAgentTemplate } from "../packages/adk/src/sat-template.js";
import { AGENT_SCOPES, PRIVACY_CLASSES } from "../packages/adk/src/agent-scope.js";

test("PAT raw memory cannot be sent to SAT", () => {
  const contract = buildAgentContract({
    agent_id: "pat-bad",
    serves: "mumu",
    scope: AGENT_SCOPES.PRIVATE_PAT,
    privacy_class: PRIVACY_CLASSES.PAT_RAW_LOCAL,
    truth_label: "TEST",
    allowed_effects: ["READ_LOCAL_METADATA", "SEND_RAW_MEMORY_TO_SAT"],
    forbidden_effects: [
      "SIGN",
      "FEDERATE",
      "MINT_TOKEN",
      "EXPORT_PRIVATE_MEMORY",
    ],
    consent_policy: "GO only",
    proof_policy: "proof",
    receipt_policy: "receipt",
    what_this_proves: "x",
    what_this_does_not_prove: "y",
    stop_by_default: true,
  });
  const result = validateAgentContract(contract);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.code === "pat_sat_firewall"));
});

test("SAT cannot receive PAT raw memory effects", () => {
  const contract = buildAgentContract({
    agent_id: "sat-bad",
    serves: "bizra",
    scope: AGENT_SCOPES.SYSTEM_SAT_SUMMARY,
    privacy_class: PRIVACY_CLASSES.SAT_SUMMARY_ONLY,
    truth_label: "TEST",
    allowed_effects: ["VERIFY_RECEIPT", "RECEIVE_PAT_RAW_MEMORY"],
    forbidden_effects: [
      "SIGN",
      "FEDERATE",
      "MINT_TOKEN",
      "EXPORT_PRIVATE_MEMORY",
    ],
    consent_policy: "no raw PAT",
    proof_policy: "summary only",
    receipt_policy: "register summaries",
    what_this_proves: "x",
    what_this_does_not_prove: "y",
    stop_by_default: true,
  });
  const result = validateAgentContract(contract);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.code === "pat_sat_firewall"));
});

test("canonical PAT and SAT templates enforce firewall", () => {
  for (const build of [buildPatAgentTemplate, buildSatAgentTemplate]) {
    const contract = build();
    const result = validateAgentContract(contract);
    assert.equal(result.valid, true, build.name);
    assert.equal(contract.allowed_effects.includes("EXPORT_PRIVATE_MEMORY"), false);
    assert.equal(contract.allowed_effects.includes("RECEIVE_PAT_RAW_MEMORY"), false);
  }
});
