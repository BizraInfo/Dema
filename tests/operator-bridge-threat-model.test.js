import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  buildOperatorBridgeThreatModelReport,
  verifyOperatorBridgeThreatModelReport,
  OPERATOR_BRIDGE_ADR_REL_PATH,
  OPERATOR_BRIDGE_ENV_REGISTRY,
  OPERATOR_BRIDGE_THREAT_MODEL_SCHEMA,
} from "../packages/core/src/operator-bridge-threat-model.js";

test("bridge env registry is frozen with high-trust Node0 entries", () => {
  assert.ok(OPERATOR_BRIDGE_ENV_REGISTRY.length >= 7);
  for (const entry of OPERATOR_BRIDGE_ENV_REGISTRY) {
    assert.ok(Object.isFrozen(entry));
    assert.match(entry.name, /^DEMA_/);
  }
  const highTrust = OPERATOR_BRIDGE_ENV_REGISTRY.filter(
    (e) => e.trust_level === "high",
  );
  assert.deepEqual(
    highTrust.map((e) => e.name).sort(),
    [
      "DEMA_GATEWAY_URL",
      "DEMA_NODE0_ADAPTER",
      "DEMA_NODE0_STATUS_COMMAND",
    ].sort(),
  );
});

test("ADR-042 documents every registered bridge env var", () => {
  assert.ok(existsSync(OPERATOR_BRIDGE_ADR_REL_PATH));
  const adrText = readFileSync(OPERATOR_BRIDGE_ADR_REL_PATH, "utf8");
  const report = buildOperatorBridgeThreatModelReport({
    adrText,
    adrExists: true,
  });
  assert.equal(report.ok, true, JSON.stringify(report.findings, null, 2));
  assert.equal(report.schema, OPERATOR_BRIDGE_THREAT_MODEL_SCHEMA);
  assert.equal(verifyOperatorBridgeThreatModelReport(report).ok, true);
});

test("gate fails when a high-trust env var is missing from ADR text", () => {
  const adrText = readFileSync(OPERATOR_BRIDGE_ADR_REL_PATH, "utf8").replace(
    /DEMA_NODE0_STATUS_COMMAND/g,
    "REDACTED",
  );
  const report = buildOperatorBridgeThreatModelReport({
    adrText,
    adrExists: true,
  });
  assert.equal(report.ok, false);
  assert.ok(
    report.findings.some((f) => f.code === "bridge_env_undocumented"),
  );
});

test("review gate helper passes on live ADR-042", async () => {
  const { runOperatorBridgeThreatModelCheck } = await import(
    "../scripts/review/operator-bridge-threat-model-check.mjs"
  );
  const result = runOperatorBridgeThreatModelCheck();
  assert.equal(result.ok, true, JSON.stringify(result.report.findings, null, 2));
});
