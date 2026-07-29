import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateRotateExportBind,
  parseImportedRotateSymbols,
  storeExportsSymbol,
} from "../scripts/review/authorship-key-rotate-export-bind-check.mjs";

const STORE_IMPORT =
  'from "../packages/receipts/src/authorship-key-store.js"';

describe("evaluateRotateExportBind", () => {
  it("passes when rotate test is absent (vacuous)", () => {
    const report = evaluateRotateExportBind({ testExists: false });
    assert.equal(report.ok, true);
    assert.equal(report.test_absent, true);
  });

  it("passes when test imports KEY_ROTATE_CONSENT_PHRASE and store exports it", () => {
    const testSource = `import { KEY_ROTATE_CONSENT_PHRASE } ${STORE_IMPORT};`;
    const storeSource = "export const KEY_ROTATE_CONSENT_PHRASE = 'ROTATE';";
    const report = evaluateRotateExportBind({
      testSource,
      storeSource,
      testExists: true,
    });
    assert.equal(report.ok, true);
    assert.deepEqual(report.imported_symbols, ["KEY_ROTATE_CONSENT_PHRASE"]);
  });

  it("fails when test imports KEY_ROTATE_CONSENT_PHRASE but store does not export it", () => {
    const testSource = `import { KEY_ROTATE_CONSENT_PHRASE } ${STORE_IMPORT};`;
    const storeSource = "export const KEY_INIT_CONSENT_PHRASE = 'INIT';";
    const report = evaluateRotateExportBind({
      testSource,
      storeSource,
      testExists: true,
    });
    assert.equal(report.ok, false);
    assert.deepEqual(report.missing_exports, ["KEY_ROTATE_CONSENT_PHRASE"]);
    assert.ok(report.reasons.includes("test_imports_missing_store_exports"));
  });

  it("fails when limits claims MEASURED AUTHORSHIP-KEY-ROTATE but store lacks exports", () => {
    const limitsSource =
      "| **MEASURED** Authorship key rotation (AUTHORSHIP-KEY-ROTATE-1B) | evidence |";
    const report = evaluateRotateExportBind({
      storeSource: "export const KEY_INIT_CONSENT_PHRASE = 'INIT';",
      limitsSource,
      testExists: false,
    });
    assert.equal(report.ok, false);
    assert.equal(report.test_absent, true);
    assert.ok(report.measured_claim);
    assert.ok(report.missing_exports.includes("KEY_ROTATE_CONSENT_PHRASE"));
    assert.ok(report.missing_exports.includes("KEY_ROTATE_SCHEMA"));
    assert.ok(report.missing_exports.includes("rotateAuthorshipKey"));
  });

  it("passes when limits claims MEASURED AUTHORSHIP-KEY-ROTATE and store exports all symbols", () => {
    const limitsSource =
      "| **MEASURED** Authorship key rotation (AUTHORSHIP-KEY-ROTATE-1B) | evidence |";
    const storeSource = [
      "export const KEY_ROTATE_CONSENT_PHRASE = 'ROTATE';",
      "export const KEY_ROTATE_SCHEMA = 'schema';",
      "export async function rotateAuthorshipKey() {}",
    ].join("\n");
    const report = evaluateRotateExportBind({
      storeSource,
      limitsSource,
      testExists: false,
    });
    assert.equal(report.ok, true);
    assert.equal(report.missing_exports.length, 0);
  });

  it("passes when limits is BLOCKED-only for rotate and test is absent", () => {
    const limitsSource =
      "| **BLOCKED** Authorship key rotation (AUTHORSHIP-KEY-ROTATE-1A) | evidence |";
    const report = evaluateRotateExportBind({
      storeSource: "export const KEY_INIT_CONSENT_PHRASE = 'INIT';",
      limitsSource,
      testExists: false,
    });
    assert.equal(report.ok, true);
    assert.equal(report.measured_claim, false);
  });
});

describe("parseImportedRotateSymbols", () => {
  it("collects rotate symbols from a multi-line import block", () => {
    const testSource = `import {
  initAuthorshipKey,
  rotateAuthorshipKey,
  KEY_ROTATE_CONSENT_PHRASE,
  KEY_ROTATE_SCHEMA,
} ${STORE_IMPORT};`;
    assert.deepEqual(parseImportedRotateSymbols(testSource), [
      "KEY_ROTATE_CONSENT_PHRASE",
      "KEY_ROTATE_SCHEMA",
      "rotateAuthorshipKey",
    ]);
  });
});

describe("storeExportsSymbol", () => {
  it("accepts named re-exports", () => {
    assert.equal(storeExportsSymbol("export { rotateAuthorshipKey };", "rotateAuthorshipKey"), true);
  });
});
