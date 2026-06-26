import test from "node:test";
import assert from "node:assert/strict";

import {
  buildConsentBridgeParityReport,
  verifyConsentBridgeParityReport,
  runConsentBridgeParityCheck,
  BRIDGE_ENV_COMMAND_AFFINITY,
  CONSENT_BRIDGE_PARITY_SCHEMA,
} from "../packages/core/src/consent-bridge-parity.js";
import { OPERATOR_BRIDGE_ENV_REGISTRY } from "../packages/core/src/operator-bridge-threat-model.js";

test("affinity map covers every bridge env var in registry", () => {
  const registry = OPERATOR_BRIDGE_ENV_REGISTRY.map((e) => e.name).sort();
  const affinity = BRIDGE_ENV_COMMAND_AFFINITY.map((a) => a.env_var).sort();
  assert.deepEqual(affinity, registry);
});

test("live parity report passes on current matrix + registry", () => {
  const report = buildConsentBridgeParityReport();
  assert.equal(report.schema, CONSENT_BRIDGE_PARITY_SCHEMA);
  assert.equal(
    report.ok,
    true,
    JSON.stringify(report.findings, null, 2),
  );
  assert.equal(verifyConsentBridgeParityReport(report).ok, true);
  assert.equal(report.external_runtime_command_count, 6);
});

test("fails when external_runtime command drops bridge reference", () => {
  const report = buildConsentBridgeParityReport();
  assert.equal(report.ok, true);
  const tampered = {
    ...report,
    ok: false,
    findings: [
      {
        code: "external_runtime_missing_bridge_reference",
        command: "status",
      },
    ],
  };
  assert.equal(verifyConsentBridgeParityReport(tampered).ok, false);
});

test("review gate helper passes", async () => {
  const { runConsentBridgeParityGateCheck } = await import(
    "../scripts/review/consent-bridge-parity-check.mjs"
  );
  const result = runConsentBridgeParityGateCheck();
  assert.equal(result.ok, true, JSON.stringify(result.report.findings, null, 2));
});

test("runConsentBridgeParityCheck returns frozen envelope", () => {
  const result = runConsentBridgeParityCheck();
  assert.equal(result.ok, true);
  assert.equal(Object.isFrozen(result), true);
});
