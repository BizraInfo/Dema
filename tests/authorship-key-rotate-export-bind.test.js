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

// Canonical named-export detection. The gate must answer "is this symbol
// IMPORTABLE from the store?" — not "does this identifier appear somewhere in
// the file?". A local name, an alias source, a comment or a string literal all
// mention the symbol without exporting it.
describe("storeExportsSymbol · canonical export-name matrix", () => {
  const SYMBOL = "rotateAuthorshipKey";

  it("1. export function declaration -> exported", () => {
    assert.equal(
      storeExportsSymbol("export function rotateAuthorshipKey() {}", SYMBOL),
      true,
    );
  });

  it("2. bare named export -> exported", () => {
    assert.equal(
      storeExportsSymbol(
        "function rotateAuthorshipKey() {}\nexport { rotateAuthorshipKey };",
        SYMBOL,
      ),
      true,
    );
  });

  it("3. renamed AWAY -> NOT exported (local name is not importable)", () => {
    assert.equal(
      storeExportsSymbol(
        "function rotateAuthorshipKey() {}\nexport { rotateAuthorshipKey as legacyRotate };",
        SYMBOL,
      ),
      false,
    );
  });

  it("4. renamed TO the required symbol -> exported", () => {
    assert.equal(
      storeExportsSymbol(
        "function legacyRotate() {}\nexport { legacyRotate as rotateAuthorshipKey };",
        SYMBOL,
      ),
      true,
    );
  });

  it("5. declared but never exported -> NOT exported", () => {
    assert.equal(
      storeExportsSymbol(
        "function rotateAuthorshipKey() {}\nexport { somethingElse };",
        SYMBOL,
      ),
      false,
    );
  });

  it("6. mentioned only in comments or strings -> NOT exported", () => {
    const inLineComment = "// export function rotateAuthorshipKey() {}";
    const inBlockComment =
      "/*\n * export { rotateAuthorshipKey }\n */\nexport const other = 1;";
    const inString = 'const doc = "export { rotateAuthorshipKey }";';
    const inTemplate = "const doc = `export function rotateAuthorshipKey(){}`;";
    for (const source of [
      inLineComment,
      inBlockComment,
      inString,
      inTemplate,
    ]) {
      assert.equal(
        storeExportsSymbol(source, SYMBOL),
        false,
        `must not credit a mention in: ${JSON.stringify(source)}`,
      );
    }
  });

  it("does not confuse a same-prefixed longer name", () => {
    assert.equal(
      storeExportsSymbol("export function rotateAuthorshipKeyPair() {}", SYMBOL),
      false,
    );
  });

  it("still detects const, let and async function forms", () => {
    assert.equal(
      storeExportsSymbol("export const rotateAuthorshipKey = () => {};", SYMBOL),
      true,
    );
    assert.equal(
      storeExportsSymbol("export let rotateAuthorshipKey = null;", SYMBOL),
      true,
    );
    assert.equal(
      storeExportsSymbol(
        "export async function rotateAuthorshipKey() {}",
        SYMBOL,
      ),
      true,
    );
  });
});

describe("evaluateRotateExportBind · alias and honesty regressions", () => {
  const MEASURED_LIMITS =
    "| **MEASURED** Authorship key rotation (AUTHORSHIP-KEY-ROTATE-1B) | evidence |";
  const ALL_EXPORTED = [
    "export const KEY_ROTATE_CONSENT_PHRASE = 'ROTATE';",
    "export const KEY_ROTATE_SCHEMA = 'schema';",
    "export async function rotateAuthorshipKey() {}",
  ].join("\n");

  it("an imported symbol renamed away in the store fails the bind", () => {
    const testSource = `import { rotateAuthorshipKey } ${STORE_IMPORT};`;
    const storeSource =
      "function rotateAuthorshipKey() {}\nexport { rotateAuthorshipKey as legacyRotate };";
    const report = evaluateRotateExportBind({
      testSource,
      storeSource,
      testExists: true,
    });
    assert.equal(report.ok, false);
    assert.deepEqual(report.missing_exports, ["rotateAuthorshipKey"]);
    assert.ok(report.reasons.includes("test_imports_missing_store_exports"));
  });

  it("7. rotation test absent stays non-applicable (documented vacuous pass)", () => {
    const report = evaluateRotateExportBind({
      storeSource: ALL_EXPORTED,
      testExists: false,
    });
    assert.equal(report.ok, true);
    assert.equal(report.test_absent, true);
    assert.deepEqual(report.imported_symbols, []);
  });

  it("8. MEASURED claim whose exports are only commented out FAILS CLOSED", () => {
    const storeSource = [
      "// export const KEY_ROTATE_CONSENT_PHRASE = 'ROTATE';",
      "// export const KEY_ROTATE_SCHEMA = 'schema';",
      "// export async function rotateAuthorshipKey() {}",
    ].join("\n");
    const report = evaluateRotateExportBind({
      storeSource,
      limitsSource: MEASURED_LIMITS,
      testExists: false,
    });
    assert.equal(report.ok, false);
    assert.ok(report.measured_claim);
    assert.deepEqual(report.missing_exports, [
      "KEY_ROTATE_CONSENT_PHRASE",
      "KEY_ROTATE_SCHEMA",
      "rotateAuthorshipKey",
    ]);
    assert.ok(
      report.reasons.includes("limits_measured_rotate_without_exports"),
    );
  });
});
