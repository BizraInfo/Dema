import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

import { checkEnvHygiene } from "../scripts/review/env-hygiene-check.mjs";

const EMPTY_ENV = Object.freeze({});

test("T-01 env-hygiene clean env returns ok=true and zero polluters", () => {
  const report = checkEnvHygiene({ env: EMPTY_ENV });
  assert.equal(report.ok, true);
  assert.equal(report.polluter_count, 0);
  assert.deepEqual([...report.polluters], []);
  assert.equal(report.remediation, null);
});

test("T-02 env-hygiene single DEMA_* var set produces one polluter", () => {
  const report = checkEnvHygiene({
    env: { DEMA_NODE0_ADAPTER: "gateway-http" },
  });
  assert.equal(report.ok, false);
  assert.equal(report.polluter_count, 1);
  assert.equal(report.polluters[0].name, "DEMA_NODE0_ADAPTER");
  assert.equal(report.polluters[0].value_length, "gateway-http".length);
  assert.equal(report.remediation, "env -u DEMA_NODE0_ADAPTER <command>");
});

test("T-03 env-hygiene all 10 fixture DEMA_* vars produce 10 polluters", () => {
  const env = {
    DEMA_DOWNLOADS_ROOT: "/tmp/a",
    DEMA_GATEWAY_URL: "http://localhost:1",
    DEMA_HOME: "/tmp/b",
    DEMA_LM_STUDIO_URL: "http://localhost:2",
    DEMA_LOCAL_ASSET_ROOT: "/tmp/local-assets",
    DEMA_MODEL_DOWNLOADS_ROOT: "/tmp/c",
    DEMA_MODELS_SKIP_TCP: "1",
    DEMA_NODE0_ADAPTER: "gateway-http",
    DEMA_NODE0_STATUS_COMMAND: "node -e 0",
    DEMA_OLLAMA_URL: "http://localhost:3",
  };
  const report = checkEnvHygiene({ env });
  assert.equal(report.ok, false);
  assert.equal(report.polluter_count, 10);
});

test("T-04 env-hygiene undefined value is NOT counted as set", () => {
  const report = checkEnvHygiene({ env: { DEMA_NODE0_ADAPTER: undefined } });
  assert.equal(report.ok, true);
  assert.equal(report.polluter_count, 0);
});

test("T-05 env-hygiene empty string value is NOT counted as set", () => {
  const report = checkEnvHygiene({ env: { DEMA_NODE0_ADAPTER: "" } });
  assert.equal(report.ok, true);
});

test("T-06 env-hygiene unrelated env vars are ignored", () => {
  const env = { HOME: "/home/x", PATH: "/usr/bin", NOT_A_DEMA_VAR: "x" };
  const report = checkEnvHygiene({ env });
  assert.equal(report.ok, true);
});

test("T-07 env-hygiene polluter record stores value LENGTH not the value", () => {
  const report = checkEnvHygiene({
    env: { DEMA_GATEWAY_URL: "http://secret:8080" },
  });
  assert.equal(report.polluters[0].value_length, "http://secret:8080".length);
  assert.equal(Object.hasOwn(report.polluters[0], "value"), false);
});

test("T-08 env-hygiene KNOWN_DEMA_ENV_VARS is frozen + lexically sorted", () => {
  const report = checkEnvHygiene({ env: EMPTY_ENV });
  const list = report.known_dema_env_vars;
  assert.equal(Object.isFrozen(list), true);
  const sorted = [...list].sort();
  assert.deepEqual([...list], sorted);
});

test("T-09 env-hygiene report itself is frozen", () => {
  const report = checkEnvHygiene({ env: EMPTY_ENV });
  assert.equal(Object.isFrozen(report), true);
  assert.equal(Object.isFrozen(report.polluters), true);
});

test("T-10 env-hygiene remediation uses correct env -u syntax for multiple vars", () => {
  const env = { DEMA_NODE0_ADAPTER: "x", DEMA_GATEWAY_URL: "y" };
  const report = checkEnvHygiene({ env });
  assert.equal(
    report.remediation,
    "env -u DEMA_GATEWAY_URL -u DEMA_NODE0_ADAPTER <command>",
  );
});

test("T-11 env-hygiene schema field is bizra.dema.review.env_hygiene.v0.1", () => {
  const report = checkEnvHygiene({ env: EMPTY_ENV });
  assert.equal(report.schema, "bizra.dema.review.env_hygiene.v0.1");
});

test("T-12 env-hygiene strict_mode field reflects input", () => {
  assert.equal(
    checkEnvHygiene({ env: EMPTY_ENV, strict: false }).strict_mode,
    false,
  );
  assert.equal(
    checkEnvHygiene({ env: EMPTY_ENV, strict: true }).strict_mode,
    true,
  );
});

test("T-13 env-hygiene KNOWN_DEMA_ENV_VARS is complete vs source-tree references", () => {
  // Forward-compat drift trap: any DEMA_* env var referenced in source code
  // but missing from KNOWN_DEMA_ENV_VARS will fail this test, forcing the
  // list to stay in sync with reality.
  const grepOutput = execFileSync(
    "grep",
    [
      "-rhE",
      "process\\.env\\.DEMA_[A-Z0-9_]+",
      "tests/",
      "packages/",
      "apps/",
      "scripts/",
    ],
    { encoding: "utf8" },
  );
  const referenced = new Set();
  for (const match of grepOutput.matchAll(/process\.env\.(DEMA_[A-Z0-9_]+)/g)) {
    referenced.add(match[1]);
  }
  const known = new Set(
    checkEnvHygiene({ env: EMPTY_ENV }).known_dema_env_vars,
  );
  const missing = [...referenced].filter((v) => !known.has(v)).sort();
  const stale = [...known].filter((v) => !referenced.has(v)).sort();
  assert.deepEqual(
    missing,
    [],
    `DEMA_* vars referenced in source but missing from KNOWN_DEMA_ENV_VARS: ${missing.join(", ")}`,
  );
  assert.deepEqual(
    stale,
    [],
    `DEMA_* vars in KNOWN_DEMA_ENV_VARS but not referenced in any source file: ${stale.join(", ")}`,
  );
});
