import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  collectExportedNames,
  evaluateRotateExportBind,
  limitsClaimsMeasuredRotate,
  parseImportedRotateSymbols,
  scanSource,
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

// ROUND 2 — remote adjudication findings.
//
// Both blocks below FAIL at parent 018d3eb and pass after this repair. Measured
// at that SHA: cases 2 and 4 here returned detected=true, i.e. prose inside a
// nested template was emitted as code and manufactured an export the module
// never had. That is a false PASS in a fail-closed gate, so these are the
// attack, not a control.
describe("scanSource · nested template frames cannot leak interior text as code", () => {
  const SYMBOL = "rotateAuthorshipKey";
  const LEAK = "export { rotateAuthorshipKey }";

  it("1. flat template body is not code", () => {
    assert.equal(storeExportsSymbol(`const d = \`${LEAK}\`;`, SYMBOL), false);
  });

  it("2. nested template inside interpolation is not code (regressed at 018d3eb)", () => {
    assert.equal(
      storeExportsSymbol(`const d = \`\${\`${LEAK}\`}\`;`, SYMBOL),
      false,
    );
  });

  it("3. nested braces and a string inside interpolation are not code", () => {
    assert.equal(
      storeExportsSymbol(`const d = \`\${fn({ value: "${LEAK}" })}\`;`, SYMBOL),
      false,
    );
  });

  it("4. nested template inside a call inside interpolation is not code (regressed at 018d3eb)", () => {
    assert.equal(
      storeExportsSymbol(`const d = \`\${fn(\`${LEAK}\`)}\`;`, SYMBOL),
      false,
    );
  });

  it("5. escaped backticks and escaped ${ do not open or close a frame", () => {
    assert.equal(
      storeExportsSymbol(`const d = \`\\\`${LEAK}\\\`\`;`, SYMBOL),
      false,
    );
    assert.equal(
      storeExportsSymbol(`const d = \`\\\${${LEAK}}\`;`, SYMBOL),
      false,
    );
  });

  it("6. every non-code region blanks export-like text", () => {
    for (const source of [
      `// ${LEAK}`,
      `/*\n * ${LEAK}\n */`,
      `const d = '${LEAK}';`,
      `const d = "${LEAK}";`,
      `const d = \`${LEAK}\`;`,
    ]) {
      assert.equal(
        storeExportsSymbol(source, SYMBOL),
        false,
        `must not credit: ${JSON.stringify(source)}`,
      );
    }
  });

  it("7-8. real declarations and real named exports are still detected", () => {
    assert.equal(
      storeExportsSymbol("export function rotateAuthorshipKey() {}", SYMBOL),
      true,
    );
    assert.equal(
      storeExportsSymbol(
        "function rotateAuthorshipKey(){}\nexport { rotateAuthorshipKey };",
        SYMBOL,
      ),
      true,
    );
  });

  it("9-10. alias direction is read correctly", () => {
    assert.equal(
      storeExportsSymbol("export { rotateAuthorshipKey as legacyRotate };", SYMBOL),
      false,
    );
    assert.equal(
      storeExportsSymbol("export { legacyRotate as rotateAuthorshipKey };", SYMBOL),
      true,
    );
  });

  it("11. malformed input is an explicit scanner failure, never a PASS", () => {
    const malformed = {
      unterminated_template: "const d = `oops;",
      unterminated_block_comment: "/* oops",
      unterminated_double_quote: 'const d = "oops\n";',
      unbalanced_interpolation: "const d = `${fn(`;",
    };
    for (const [label, source] of Object.entries(malformed)) {
      const scan = scanSource(source);
      assert.equal(scan.ok, false, `${label}: scanner must refuse`);
      assert.equal(collectExportedNames(source).ok, false, `${label}: no names`);
      const report = evaluateRotateExportBind({
        storeSource: source,
        testExists: false,
      });
      assert.equal(report.ok, false, `${label}: gate must FAIL CLOSED`);
      assert.ok(
        report.reasons.some((r) => r.startsWith("store_source_unscannable")),
        `${label}: reason must name the scan failure`,
      );
    }
  });

  it("preserves newlines so blanking cannot shift line structure", () => {
    const source = "const a = 1;\n/* x\n y */\nexport const b = 2;\n";
    const scan = scanSource(source);
    assert.equal(scan.ok, true);
    assert.equal(scan.code.split("\n").length, source.split("\n").length);
  });
});

describe("limitsClaimsMeasuredRotate · BLOCKED prose cannot cancel a MEASURED claim", () => {
  const ROW = (text) => `| ${text} |  evidence |`;

  it("1. rotate row with [MEASURED] is a claim", () => {
    assert.equal(
      limitsClaimsMeasuredRotate(
        ROW("[MEASURED] rotation (AUTHORSHIP-KEY-ROTATE-1B)"),
      ),
      true,
    );
  });

  it("2. prose 'blocked failure state' does not cancel it", () => {
    assert.equal(
      limitsClaimsMeasuredRotate(
        ROW(
          "[MEASURED] rotation (AUTHORSHIP-KEY-ROTATE-1B) describes a blocked failure state",
        ),
      ),
      true,
    );
  });

  it("3. a [BLOCKED] marker elsewhere in the row does not cancel it (regressed at 018d3eb)", () => {
    assert.equal(
      limitsClaimsMeasuredRotate(
        ROW(
          "[MEASURED] rotation (AUTHORSHIP-KEY-ROTATE-1B) note: the [BLOCKED] re-land path is separate",
        ),
      ),
      true,
    );
  });

  it("4. [BLOCKED] with no [MEASURED] is not a claim", () => {
    assert.equal(
      limitsClaimsMeasuredRotate(
        ROW("[BLOCKED] rotation (AUTHORSHIP-KEY-ROTATE-1A)"),
      ),
      false,
    );
  });

  it("5. [DESIGNED_NOT_LIVE] is not a claim", () => {
    assert.equal(
      limitsClaimsMeasuredRotate(
        ROW("[DESIGNED_NOT_LIVE] rotation (AUTHORSHIP-KEY-ROTATE-1A)"),
      ),
      false,
    );
  });

  it("6. an unrelated [MEASURED] row mentioning BLOCKED is not a rotate claim", () => {
    assert.equal(
      limitsClaimsMeasuredRotate(ROW("[MEASURED] something else, BLOCKED")),
      false,
    );
  });

  it("7. one measured rotate row among several is enough", () => {
    assert.equal(
      limitsClaimsMeasuredRotate(
        [
          ROW("[BLOCKED] rotation (AUTHORSHIP-KEY-ROTATE-1A)"),
          ROW("[MEASURED] rotation (AUTHORSHIP-KEY-ROTATE-1B)"),
        ].join("\n"),
      ),
      true,
    );
  });

  it("bare prose 'Missing for MEASURED' is not an explicit claim", () => {
    // The live ledger's BLOCKED rotate row contains exactly this phrasing; it
    // describes an ABSENT measurement and must not activate the bind.
    assert.equal(
      limitsClaimsMeasuredRotate(
        ROW(
          "**BLOCKED (re-land decision)** rotation (AUTHORSHIP-KEY-ROTATE-1A) — Missing for MEASURED: an operator decision",
        ),
      ),
      false,
    );
  });

  it("8. a measured rotate row with exports absent fails the gate closed", () => {
    const report = evaluateRotateExportBind({
      storeSource: "export const unrelated = 1;",
      limitsSource: ROW("[MEASURED] rotation (AUTHORSHIP-KEY-ROTATE-1B)"),
      testExists: false,
    });
    assert.equal(report.ok, false);
    assert.ok(report.measured_claim);
    assert.deepEqual(report.missing_exports, [
      "KEY_ROTATE_CONSENT_PHRASE",
      "KEY_ROTATE_SCHEMA",
      "rotateAuthorshipKey",
    ]);
  });
});
