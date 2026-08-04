import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import {
  classifySlash,
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

// ROUND 3 — regex-literal lexical closure.
//
// Measured at parent 26f76ad: four of the five fixtures below were VALID
// JavaScript that leaked an export from regex interior, because the scanner did
// not model regex literals and the interior backtick/quote opened a template or
// string frame. `/`x`export { rotateAuthorshipKey }/` reported the symbol as
// exported. These are the attack, not a control.
const SYMBOL = "rotateAuthorshipKey";
const exported = (src) => {
  const collected = collectExportedNames(src);
  return collected.ok && collected.names.has(SYMBOL);
};

describe("scanSource · regex literals cannot leak interior text as code", () => {
  it("1-2. fake named export and fake declaration inside a regex", () => {
    assert.equal(exported("const p = /`x`export { rotateAuthorshipKey }/;"), false);
    assert.equal(
      exported("const p = /`x`export function rotateAuthorshipKey() {}/;"),
      false,
    );
  });

  it("3. fake exports containing single and double quotes", () => {
    assert.equal(exported("const p = /'x'export { rotateAuthorshipKey }/;"), false);
    assert.equal(exported('const p = /"x"export { rotateAuthorshipKey }/;'), false);
  });

  it("4-6. character classes, escaped slashes, and mixed delimiters", () => {
    assert.equal(exported("const p = /[export { rotateAuthorshipKey }]/;"), false);
    assert.equal(exported("const p = /x\\/y export { rotateAuthorshipKey }/;"), false);
    assert.equal(exported("const p = /[/'\"`]export { rotateAuthorshipKey }/;"), false);
  });

  it("7-8. a regex containing // or /* does not become a comment", () => {
    assert.equal(
      exported("const p = /a\\/\\/b export { rotateAuthorshipKey }/;"),
      false,
    );
    assert.equal(
      exported("const p = /a\\/\\*b export { rotateAuthorshipKey }/;"),
      false,
    );
  });

  it("9. backticks and ${ } stay regex content", () => {
    assert.equal(
      exported("const p = /[$]{1}[`]export { rotateAuthorshipKey }/;"),
      false,
    );
  });

  it("a regex containing a backtick inside interpolation keeps frames aligned", () => {
    // This desynchronised the round-2 scanner: the regex backtick opened a
    // TEMPLATE frame from inside TEMPLATE_EXPRESSION.
    //
    // Asserting only that `rotateAuthorshipKey` is absent would be VACUOUS —
    // this fixture never contains that symbol, so the assertion would hold even
    // if every frame unwound wrongly. The load-bearing claim is that the REAL
    // trailing export is still reachable, which is only true if the regex and
    // template frames both closed at the right place.
    const source =
      'const t = `${x.replace(/[`]/g, "")}`;\nexport const other = 1;';
    const scan = scanSource(source);
    assert.equal(scan.ok, true, "frames must unwind, not refuse");
    const collected = collectExportedNames(source);
    assert.equal(collected.ok, true);
    assert.ok(
      collected.names.has("other"),
      "the trailing real export must survive the regex-in-interpolation",
    );
    assert.equal(collected.names.has(SYMBOL), false, "no phantom export");
    assert.equal(collected.names.size, 1, "exactly the one real export");
  });

  it("export-like text inside that same regex stays hidden", () => {
    // Negative variant of the frame-alignment fixture: the regex body now
    // carries the canonical symbol, and the real trailing export is still
    // present. Frames must unwind AND the regex interior must stay blanked.
    const source =
      'const t = `${x.replace(/[`]export { rotateAuthorshipKey }/g, "")}`;\n' +
      "export const other = 1;";
    const collected = collectExportedNames(source);
    assert.equal(collected.ok, true);
    assert.ok(collected.names.has("other"), "real export still reachable");
    assert.equal(
      collected.names.has(SYMBOL),
      false,
      "regex interior must not be collected",
    );
  });

  it("10-13. genuine exports still resolve, alias direction still respected", () => {
    assert.equal(exported("export function rotateAuthorshipKey() {}"), true);
    assert.equal(
      exported("function rotateAuthorshipKey(){}\nexport { rotateAuthorshipKey };"),
      true,
    );
    assert.equal(
      exported(
        "function rotateAuthorshipKey(){}\nexport { rotateAuthorshipKey as legacyRotate };",
      ),
      false,
    );
    assert.equal(
      exported(
        "function legacyRotate(){}\nexport { legacyRotate as rotateAuthorshipKey };",
      ),
      true,
    );
  });

  it("a genuine export after a regex line is still detected (frame pops)", () => {
    assert.equal(
      exported("const p = /a`b`/; export function rotateAuthorshipKey() {}"),
      true,
    );
  });

  it("14-17. division and division-assignment scan without becoming regex", () => {
    for (const src of [
      "const ratio = numerator / denominator;",
      "const ratio = a / b / c;",
      "let value = 8; value /= divisor;",
      "const pattern = /abc/;",
    ]) {
      const scan = scanSource(src);
      assert.equal(scan.ok, true, `must scan: ${src}`);
      assert.equal(exported(src), false);
    }
  });

  it("classifySlash separates operand from expression position", () => {
    assert.equal(classifySlash({ kind: "identifier", text: "a" }), "division");
    assert.equal(classifySlash({ kind: "number", text: "" }), "division");
    assert.equal(classifySlash({ kind: "punctuator", text: "=" }), "regex");
    assert.equal(classifySlash({ kind: "punctuator", text: "," }), "regex");
    assert.equal(classifySlash({ kind: "regex_keyword", text: "return" }), "regex");
    assert.equal(classifySlash({ kind: "punctuator", text: "++" }), "division");
    assert.equal(classifySlash({ kind: "punctuator", text: "]" }), "division");
    assert.equal(classifySlash(null), "regex");
    // Genuinely context-dependent: refuse rather than guess.
    assert.equal(classifySlash({ kind: "punctuator", text: ")" }), "ambiguous");
    assert.equal(classifySlash({ kind: "punctuator", text: "}" }), "ambiguous");
  });

  it("18-19. regex after return works; after ) it refuses rather than guesses", () => {
    const afterReturn =
      "function f(v){ return /a`b`export { rotateAuthorshipKey }/.test(v); }";
    assert.equal(scanSource(afterReturn).ok, true);
    assert.equal(exported(afterReturn), false);

    const afterParen =
      "function f(v){ if (v) /a`b`export { rotateAuthorshipKey }/.test(v); }";
    const scan = scanSource(afterParen);
    assert.equal(scan.ok, false);
    assert.equal(scan.reason, "ambiguous_slash_context");
    assert.equal(exported(afterParen), false);
  });

  it("20-22. malformed regex input fails the gate closed", () => {
    const cases = {
      unterminated_regex_literal: "const p = /abc;",
      unterminated_regex_character_class: "const p = /a[bc;",
      unterminated_regex: "const p = /abc\ndef/;",
    };
    for (const [reason, src] of Object.entries(cases)) {
      const scan = scanSource(src);
      assert.equal(scan.ok, false, `${reason}: must refuse`);
      assert.equal(scan.reason, reason);
      const report = evaluateRotateExportBind({
        storeSource: src,
        testExists: false,
      });
      assert.equal(report.ok, false, `${reason}: gate must FAIL CLOSED`);
      assert.ok(
        report.reasons.some((r) => r.startsWith("store_source_unscannable")),
      );
    }
  });

  it("23. a store of only regex decoys cannot satisfy a MEASURED rotation row", () => {
    const decoys = [
      "const a = /`x`export { rotateAuthorshipKey }/;",
      "const b = /`x`export { KEY_ROTATE_SCHEMA }/;",
      "const c = /`x`export { KEY_ROTATE_CONSENT_PHRASE }/;",
    ].join("\n");
    const report = evaluateRotateExportBind({
      storeSource: decoys,
      limitsSource: "| [MEASURED] rotation (AUTHORSHIP-KEY-ROTATE-1B) | ev |",
      testExists: false,
    });
    assert.equal(report.ok, false);
    assert.deepEqual(report.missing_exports, [
      "KEY_ROTATE_CONSENT_PHRASE",
      "KEY_ROTATE_SCHEMA",
      "rotateAuthorshipKey",
    ]);
  });

  it("24. the real authorship-key-store.js scans statically, without execution", () => {
    const path = new URL(
      "../packages/receipts/src/authorship-key-store.js",
      import.meta.url,
    );
    if (!existsSync(path)) return; // absent on branches that do not carry it
    const collected = collectExportedNames(readFileSync(path, "utf8"));
    assert.equal(collected.ok, true, "real store must scan");
    assert.ok(collected.names.size > 0, "real store must expose exports");
  });
});

// ROUND 4 — review closure.
//
// A whitespace-based `)`/`}` slash heuristic was proposed in review to stop
// `f(x) / y` being over-refused. It is unsafe, and this is the executable proof
// rather than an argument.
describe("slash ambiguity · a whitespace heuristic would reopen the bypass", () => {
  // Faithful simulation: the heuristic calls a whitespace-flanked slash after
  // `)`/`}` a DIVISION OPERATOR, so it is emitted as code and opens no frame.
  // Deleting it reproduces exactly the CODE text that scanner would collect.
  const asHeuristicWouldSee = (src) =>
    src.replace(/([)}])(\s+)\/(\s+)/g, "$1$2 $3");

  // Both are VALID JavaScript — a regex literal as a control-flow consequent.
  const REGEX_CONSEQUENTS = [
    "if (condition) / export { rotateAuthorshipKey } / .test(value);",
    "while (condition) / export function rotateAuthorshipKey() {} / .test(value);",
  ];

  it("the heuristic would collect a phantom export from regex bodies", () => {
    for (const source of REGEX_CONSEQUENTS) {
      const leaked = collectExportedNames(asHeuristicWouldSee(source));
      assert.equal(leaked.ok, true, "heuristic scan would succeed");
      assert.ok(
        leaked.names.has(SYMBOL),
        `heuristic leaks a phantom export from: ${source}`,
      );
    }
  });

  it("the current policy refuses those instead, and leaks nothing", () => {
    for (const source of REGEX_CONSEQUENTS) {
      const scan = scanSource(source);
      assert.equal(scan.ok, false);
      assert.equal(scan.reason, "ambiguous_slash_context");
      assert.equal(exported(source), false);
      const report = evaluateRotateExportBind({
        storeSource: source,
        testExists: false,
      });
      assert.equal(report.ok, false, "gate must fail closed");
    }
  });

  it("division after ) or } is over-refused, which is the acceptable cost", () => {
    // These are the cases the heuristic wanted to rescue. Refusing them costs a
    // refusal; mis-reading a regex consequent costs the gate's whole purpose.
    for (const source of ["f(x) / y;", "({ value: 1 }) / divisor;"]) {
      const scan = scanSource(source);
      assert.equal(scan.ok, false);
      assert.equal(scan.reason, "ambiguous_slash_context");
    }
  });

  it("whitespace is not a grammar: the two shapes are lexically identical", () => {
    const regexConsequent = "if (condition) / a / .test(value);";
    const division = "f(condition) / a / 2;";
    const surface = (s) => /\)\s+\/\s+/.test(s);
    assert.ok(surface(regexConsequent) && surface(division));
    // Same surface, opposite grammar — so the surface cannot decide it.
    assert.equal(scanSource(regexConsequent).reason, "ambiguous_slash_context");
    assert.equal(scanSource(division).reason, "ambiguous_slash_context");
  });
});

describe("evaluateRotateExportBind · single-scan refactor is behaviour-preserving", () => {
  const MEASURED = "| [MEASURED] rotation (AUTHORSHIP-KEY-ROTATE-1B) | ev |";
  const STORES = {
    all_exported: [
      "export const KEY_ROTATE_CONSENT_PHRASE = 'ROTATE';",
      "export const KEY_ROTATE_SCHEMA = 'schema';",
      "export async function rotateAuthorshipKey() {}",
    ].join("\n"),
    none_exported: "export const unrelated = 1;",
    aliased_away: [
      "function rotateAuthorshipKey(){}",
      "export { rotateAuthorshipKey as legacyRotate };",
      "export const KEY_ROTATE_SCHEMA = 's';",
    ].join("\n"),
    commented_out: "// export async function rotateAuthorshipKey() {}",
  };

  it("the evaluator's verdict equals the per-symbol public contract", () => {
    for (const [label, storeSource] of Object.entries(STORES)) {
      const report = evaluateRotateExportBind({
        storeSource,
        limitsSource: MEASURED,
        testExists: false,
      });
      // storeExportsSymbol is still the public single-symbol contract; the
      // refactored evaluator must agree with it symbol for symbol.
      const expectedMissing = [
        "KEY_ROTATE_CONSENT_PHRASE",
        "KEY_ROTATE_SCHEMA",
        "rotateAuthorshipKey",
      ].filter((s) => !storeExportsSymbol(storeSource, s));
      assert.deepEqual(
        [...report.missing_exports].sort(),
        expectedMissing.sort(),
        `${label}: evaluator and storeExportsSymbol must agree`,
      );
      assert.equal(report.ok, expectedMissing.length === 0, label);
    }
  });

  it("imported-symbol binding also reads the single collected set", () => {
    const testSource = `import { rotateAuthorshipKey } ${STORE_IMPORT};`;
    const bound = evaluateRotateExportBind({
      testSource,
      storeSource: STORES.all_exported,
      testExists: true,
    });
    assert.equal(bound.ok, true);
    assert.deepEqual(bound.imported_symbols, ["rotateAuthorshipKey"]);

    const unbound = evaluateRotateExportBind({
      testSource,
      storeSource: STORES.aliased_away,
      testExists: true,
    });
    assert.equal(unbound.ok, false);
    assert.deepEqual(unbound.missing_exports, ["rotateAuthorshipKey"]);
    assert.ok(
      unbound.reasons.includes("test_imports_missing_store_exports"),
    );
  });

  it("unscannable source still fails before any membership check", () => {
    const report = evaluateRotateExportBind({
      storeSource: "const p = /unterminated;",
      limitsSource: MEASURED,
      testExists: true,
    });
    assert.equal(report.ok, false);
    assert.ok(
      report.reasons.some((r) => r.startsWith("store_source_unscannable")),
    );
    assert.deepEqual(report.imported_symbols, []);
  });

  it("storeExportsSymbol keeps its standalone public contract", () => {
    assert.equal(
      storeExportsSymbol("export function rotateAuthorshipKey() {}", SYMBOL),
      true,
    );
    assert.equal(storeExportsSymbol("const p = /unterminated;", SYMBOL), false);
  });
});

// The substantive proof this gate could not give on #441 alone: run it against
// #440's REAL sources, which carry the rotation test, the rotate exports, and
// the [MEASURED] ledger row. Read via git so neither PR is modified. Skipped
// where the ref is unavailable (a shallow CI clone), because a skipped
// cross-branch probe must never read as a failure — or as a pass.
describe("cross-PR substantive proof against #440's real sources", () => {
  const REF = "feat/authorship-key-rotate-1b-on-main";
  const readFromRef = (path) => {
    for (const ref of [REF, `origin/${REF}`]) {
      try {
        return execFileSync("git", ["show", `${ref}:${path}`], {
          encoding: "utf8",
          maxBuffer: 64 * 1024 * 1024,
          stdio: ["ignore", "pipe", "ignore"],
        });
      } catch {
        /* try the next ref */
      }
    }
    return null;
  };

  it("binds test imports to real exports under a real MEASURED row", () => {
    const testSource = readFromRef("tests/authorship-key-rotate.test.js");
    const storeSource = readFromRef(
      "packages/receipts/src/authorship-key-store.js",
    );
    const limitsSource = readFromRef("docs/CURRENT_LIMITS.md");
    if (!testSource || !storeSource || !limitsSource) {
      // Ref unavailable — no claim either way.
      return;
    }
    const collected = collectExportedNames(storeSource);
    assert.equal(collected.ok, true, "#440 store must scan statically");

    const report = evaluateRotateExportBind({
      testSource,
      storeSource,
      limitsSource,
      testExists: true,
    });
    assert.equal(report.test_absent, false, "rotation test is present on #440");
    assert.equal(report.measured_claim, true, "#440 ledger claims MEASURED");
    assert.deepEqual(report.missing_exports, [], "every symbol is exported");
    assert.equal(report.ok, true, "substantive bind must PASS");
    assert.ok(
      report.imported_symbols.length > 0,
      "the bind must actually have imported symbols to check",
    );
  });

  it("mutating #440's store away from canonical names fails the bind", () => {
    const testSource = readFromRef("tests/authorship-key-rotate.test.js");
    const storeSource = readFromRef(
      "packages/receipts/src/authorship-key-store.js",
    );
    const limitsSource = readFromRef("docs/CURRENT_LIMITS.md");
    if (!testSource || !storeSource || !limitsSource) return;
    // Real-source negative mutation: rename the rotation export away, exactly
    // the alias defect from round 1, on real bytes rather than a fixture.
    const mutated = storeSource.replace(
      /export\s+(async\s+)?function\s+rotateAuthorshipKey/,
      "function rotateAuthorshipKey",
    );
    assert.notEqual(mutated, storeSource, "mutation must actually apply");
    const report = evaluateRotateExportBind({
      testSource,
      storeSource: mutated,
      limitsSource,
      testExists: true,
    });
    assert.equal(report.ok, false, "removing the export must fail the bind");
    assert.ok(report.missing_exports.includes("rotateAuthorshipKey"));
  });
});
