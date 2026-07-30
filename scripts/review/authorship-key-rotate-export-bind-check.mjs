#!/usr/bin/env node
// DONE-GATE-ROTATE-EXPORT-BIND-1A static gate.
//
// Fail closed when tests/authorship-key-rotate.test.js imports rotation
// symbols that packages/receipts/src/authorship-key-store.js does not export,
// or when docs/CURRENT_LIMITS.md claims MEASURED for AUTHORSHIP-KEY-ROTATE
// while those exports are absent. Read-only — no network, keygen, or DEMA_HOME.

import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const TEST_PATH = "tests/authorship-key-rotate.test.js";
export const STORE_PATH = "packages/receipts/src/authorship-key-store.js";
export const LIMITS_PATH = "docs/CURRENT_LIMITS.md";
export const REQUIRED_SYMBOLS = Object.freeze([
  "KEY_ROTATE_CONSENT_PHRASE",
  "KEY_ROTATE_SCHEMA",
  "rotateAuthorshipKey",
]);

const JSON_MODE = process.argv.includes("--json");

export const SCAN_STATES = Object.freeze([
  "CODE",
  "LINE_COMMENT",
  "BLOCK_COMMENT",
  "SINGLE_QUOTE",
  "DOUBLE_QUOTE",
  "TEMPLATE",
  "TEMPLATE_EXPRESSION",
  "REGEX_LITERAL",
  "REGEX_CHARACTER_CLASS",
]);

// Keywords after which a `/` begins a regular expression rather than division.
const REGEX_PRECEDING_KEYWORDS = new Set([
  "return",
  "throw",
  "case",
  "yield",
  "await",
  "typeof",
  "instanceof",
  "in",
  "of",
  "new",
  "delete",
  "void",
  "do",
  "else",
]);

// Keywords that are VALUES, so a following `/` is division.
const VALUE_KEYWORDS = new Set(["this", "super", "true", "false", "null"]);

// Punctuator characters tokenised as a run. `/`, quotes and backticks are
// excluded because each needs its own classification.
const PUNCTUATOR_CHARS = new Set([
  ..."+-*%=<>!&|^~?:;,.()[]{}",
]);

const isIdentifierStart = (ch) => /[A-Za-z_$]/.test(ch);
const isIdentifierPart = (ch) => /[\w$]/.test(ch);

// Decide whether a `/` opens a regex literal, is a division operator, or is
// grammatically ambiguous. Ambiguity is NEVER resolved by assumption: `)` and
// `}` genuinely depend on parse context this token-level scanner does not have
// (`if (x) /re/.test(y)` vs `f(x) / y`; a block close vs an object-literal
// close), so those refuse instead of guessing.
export function classifySlash(lastToken) {
  if (!lastToken) return "regex"; // start of source: expression position
  switch (lastToken.kind) {
    case "identifier":
    case "number":
    case "value_keyword":
    case "string":
    case "template":
    case "regex":
      return "division";
    case "regex_keyword":
      return "regex";
    case "punctuator": {
      const text = lastToken.text;
      // Postfix ++/-- yield a value, so the following slash is division.
      if (text.endsWith("++") || text.endsWith("--")) return "division";
      const last = text[text.length - 1];
      if (last === ")" || last === "}") return "ambiguous";
      if (last === "]") return "division";
      return "regex";
    }
    default:
      return "ambiguous";
  }
}

// Lexical scanner reducing a module to CODE-only text, with every non-code
// region blanked and newlines preserved.
//
// It keeps an explicit FRAME STACK rather than a single in-string flag, because
// template literals nest: `${`inner`}` re-enters TEMPLATE from inside
// TEMPLATE_EXPRESSION. A flat scanner closes the outer template on the inner
// backtick and then emits the interior as code, which is exactly how prose can
// manufacture an export. Interpolation content is lexically tracked (so brace
// depth and nested quotes close the right scope) but still blanked, since an
// `export` is not legal in expression position and blanking can only fail
// closed.
//
// BOUNDED CONTRACT — read this before trusting it:
// Tracked: line comments, block comments, single- and double-quoted strings,
// template literals, `${...}` interpolation with nested frames and brace depth,
// regular-expression literals, regex character classes, regex flags, backslash
// escapes, and enough previous-token context to tell a regex from a division.
//
// Regex literals ARE now tracked. They previously were not, and that was a
// reproduced false-PASS: `/`x`export { rotateAuthorshipKey }/` is valid
// JavaScript in which the backticks opened and closed a template frame, so the
// regex interior was emitted as code and manufactured an export the module never
// had. The same held for interior single and double quotes.
//
// Slash classification is token-based, not character-based, and refuses rather
// than guesses. After `)` or `}` the grammar genuinely depends on parse context
// this scanner does not reconstruct, so such a slash returns
// `ambiguous_slash_context` and the scan fails. That is a deliberate
// over-refusal: it can reject source a real parser would accept, and it can
// never let regex contents reach the export collector.
//
// Still NOT modelled: JSX, TypeScript type syntax, HTML-comment legacy syntax,
// and `<!--`/`-->` line comments. Any of those may cause a refusal. The
// direction of every remaining gap is refusal or over-blanking, both of which
// fail the gate closed; none of them can raise the gate's confidence.
// The trust basis is that the scanned file is repo-controlled source under
// review, not that this is a JavaScript parser.
export function scanSource(source) {
  const stack = [{ state: "CODE", braceDepth: 0 }];
  const top = () => stack[stack.length - 1];
  let out = "";
  let i = 0;
  const n = source.length;
  const blank = (ch) => {
    out += ch === "\n" ? "\n" : " ";
  };
  // Last significant token, used only to classify a following `/`.
  let lastToken = null;

  while (i < n) {
    const state = top().state;
    const c = source[i];
    const d = source[i + 1];

    if (state === "CODE" || state === "TEMPLATE_EXPRESSION") {
      const inExpression = state === "TEMPLATE_EXPRESSION";
      const put = (ch) => {
        if (inExpression) blank(ch);
        else out += ch;
      };
      // Comments are recognised before any regex decision, per the grammar.
      if (c === "/" && d === "/") {
        stack.push({ state: "LINE_COMMENT", braceDepth: 0 });
        blank(" ");
        blank(" ");
        i += 2;
        continue;
      }
      if (c === "/" && d === "*") {
        stack.push({ state: "BLOCK_COMMENT", braceDepth: 0 });
        blank(" ");
        blank(" ");
        i += 2;
        continue;
      }
      if (c === "/") {
        const kind = classifySlash(lastToken);
        if (kind === "ambiguous") {
          return Object.freeze({
            ok: false,
            reason: "ambiguous_slash_context",
          });
        }
        if (kind === "regex") {
          stack.push({ state: "REGEX_LITERAL", braceDepth: 0 });
          blank(" ");
          i += 1;
          continue;
        }
        // division / division-assignment: an operator, never a literal
        lastToken = { kind: "punctuator", text: d === "=" ? "/=" : "/" };
        put(c);
        i += 1;
        continue;
      }
      if (c === "'" || c === '"') {
        stack.push({
          state: c === "'" ? "SINGLE_QUOTE" : "DOUBLE_QUOTE",
          braceDepth: 0,
        });
        blank(" ");
        i += 1;
        continue;
      }
      if (c === "`") {
        stack.push({ state: "TEMPLATE", braceDepth: 0 });
        blank(" ");
        i += 1;
        continue;
      }
      if (isIdentifierStart(c)) {
        let word = "";
        while (i < n && isIdentifierPart(source[i])) {
          word += source[i];
          put(source[i]);
          i += 1;
        }
        lastToken = {
          kind: REGEX_PRECEDING_KEYWORDS.has(word)
            ? "regex_keyword"
            : VALUE_KEYWORDS.has(word)
              ? "value_keyword"
              : "identifier",
          text: word,
        };
        continue;
      }
      if (c >= "0" && c <= "9") {
        while (i < n && /[\w.]/.test(source[i])) {
          put(source[i]);
          i += 1;
        }
        lastToken = { kind: "number", text: "" };
        continue;
      }
      if (PUNCTUATOR_CHARS.has(c)) {
        let text = "";
        while (i < n && PUNCTUATOR_CHARS.has(source[i])) {
          const ch = source[i];
          if (inExpression) {
            if (ch === "{") {
              top().braceDepth += 1;
            } else if (ch === "}") {
              if (top().braceDepth === 0) break;
              top().braceDepth -= 1;
            }
          }
          text += ch;
          put(ch);
          i += 1;
        }
        if (text.length === 0) {
          // `}` closing this interpolation frame.
          stack.pop();
          blank(" ");
          i += 1;
          continue;
        }
        lastToken = { kind: "punctuator", text };
        continue;
      }
      // Whitespace and anything not tokenised above: carried through without
      // disturbing lastToken, so `a\n/re/` still sees `a` as the last token.
      put(c);
      i += 1;
      continue;
    }

    if (state === "LINE_COMMENT") {
      if (c === "\n") {
        stack.pop();
        out += "\n";
        i += 1;
        continue;
      }
      blank(c);
      i += 1;
      continue;
    }

    if (state === "BLOCK_COMMENT") {
      if (c === "*" && d === "/") {
        stack.pop();
        blank(" ");
        blank(" ");
        i += 2;
        continue;
      }
      blank(c);
      i += 1;
      continue;
    }

    if (state === "SINGLE_QUOTE" || state === "DOUBLE_QUOTE") {
      const quote = state === "SINGLE_QUOTE" ? "'" : '"';
      if (c === "\\") {
        blank(" ");
        if (i + 1 < n) blank(source[i + 1]);
        i += 2;
        continue;
      }
      // A raw newline inside a quoted string is a syntax error; refuse rather
      // than guess where the string was meant to end.
      if (c === "\n") {
        return Object.freeze({
          ok: false,
          reason: `unterminated_${state.toLowerCase()}`,
        });
      }
      if (c === quote) {
        stack.pop();
        lastToken = { kind: "string", text: "" };
        blank(" ");
        i += 1;
        continue;
      }
      blank(c);
      i += 1;
      continue;
    }

    if (state === "REGEX_LITERAL" || state === "REGEX_CHARACTER_CLASS") {
      const inClass = state === "REGEX_CHARACTER_CLASS";
      if (c === "\\") {
        blank(" ");
        if (i + 1 < n) blank(source[i + 1]);
        i += 2;
        continue;
      }
      // A regex literal may not span a line terminator.
      if (c === "\n") {
        return Object.freeze({
          ok: false,
          reason: inClass
            ? "unterminated_regex_character_class"
            : "unterminated_regex",
        });
      }
      if (inClass) {
        if (c === "]") stack.pop();
        blank(c);
        i += 1;
        continue;
      }
      // `[` opens a character class in which `/` does NOT close the regex.
      if (c === "[") {
        stack.push({ state: "REGEX_CHARACTER_CLASS", braceDepth: 0 });
        blank(" ");
        i += 1;
        continue;
      }
      if (c === "/") {
        stack.pop();
        blank(" ");
        i += 1;
        // Consume trailing flags so they are not tokenised as an identifier.
        while (i < n && /[a-z]/.test(source[i])) {
          blank(" ");
          i += 1;
        }
        lastToken = { kind: "regex", text: "" };
        continue;
      }
      blank(c);
      i += 1;
      continue;
    }

    // TEMPLATE
    if (c === "\\") {
      blank(" ");
      if (i + 1 < n) blank(source[i + 1]);
      i += 2;
      continue;
    }
    if (c === "$" && d === "{") {
      stack.push({ state: "TEMPLATE_EXPRESSION", braceDepth: 0 });
      blank(" ");
      blank(" ");
      i += 2;
      continue;
    }
    if (c === "`") {
      stack.pop();
      lastToken = { kind: "template", text: "" };
      blank(" ");
      i += 1;
      continue;
    }
    blank(c);
    i += 1;
  }

  // EOF ends a line comment legally; anything else still open is malformed.
  while (top().state === "LINE_COMMENT") stack.pop();
  if (stack.length !== 1 || top().state !== "CODE") {
    return Object.freeze({
      ok: false,
      reason: `unterminated_${top().state.toLowerCase()}`,
    });
  }
  return Object.freeze({ ok: true, code: out });
}

// The set of names this module actually EXPORTS — not the identifiers it
// mentions. `export { rotateAuthorshipKey as legacyRotate }` exports
// `legacyRotate`; the local name is not importable and must not satisfy the
// gate. `export * from` is unresolvable without following the module graph and
// is ignored rather than guessed. Returns ok:false when the source cannot be
// scanned, so callers fail closed instead of reading an empty set as "absent".
export function collectExportedNames(source) {
  const scan = scanSource(source);
  if (!scan.ok) {
    return Object.freeze({
      ok: false,
      reason: scan.reason,
      names: Object.freeze(new Set()),
    });
  }
  const names = new Set();
  const declRe =
    /\bexport\s+(?:async\s+)?(?:function\s*\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g;
  for (const match of scan.code.matchAll(declRe)) names.add(match[1]);
  for (const block of scan.code.matchAll(/\bexport\s*\{([^}]*)\}/g)) {
    for (const specifier of block[1].split(",")) {
      const parts = specifier.trim().split(/\s+as\s+/);
      const exported = parts[parts.length - 1].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(exported)) names.add(exported);
    }
  }
  return Object.freeze({ ok: true, names });
}

export function storeExportsSymbol(storeSource, symbol) {
  const collected = collectExportedNames(storeSource);
  return collected.ok && collected.names.has(symbol);
}

export function parseImportedRotateSymbols(testSource) {
  const imported = new Set();
  const importRe =
    /import\s+(?:\{[^}]*\}|[^;\n]+)\s+from\s+['"][^'"]*authorship-key-store\.js['"]/gs;
  for (const block of testSource.matchAll(importRe)) {
    const text = block[0];
    for (const symbol of REQUIRED_SYMBOLS) {
      if (new RegExp(`\\b${symbol}\\b`).test(text)) imported.add(symbol);
    }
  }
  return [...imported];
}

export const ROTATE_IDENTIFIER = /AUTHORSHIP-KEY-ROTATE-\d+[A-Z]/;
// Explicit truth markers ONLY. The live ledger uses [MEASURED] (78 rows;
// **MEASURED** appears zero times but is accepted as the same explicit marker).
// Bare prose containing the word MEASURED is not a claim — the real BLOCKED
// rotation row says "Missing for MEASURED: an operator decision to re-land",
// which describes an ABSENT measurement and must never activate the bind.
export const MEASURED_MARKER = /\[MEASURED\]|\*\*MEASURED\*\*/;

// A row is a positive rotation measurement claim when THE SAME row carries both
// a rotate identifier and an explicit [MEASURED] marker. In this ledger one
// Markdown table row is one line, so the conjunction is evaluated per line and
// never across the document.
//
// The previous form cancelled the claim whenever the row contained the word
// BLOCKED. That was a bypass, not a safeguard: a genuine [MEASURED] rotation row
// legitimately describes blocked limitations or a blocked failure state in its
// prose, and one such word silently disarmed the honesty bind. Status is now
// read from the explicit marker alone; descriptive prose — including BLOCKED or
// [BLOCKED] appearing elsewhere in the row — cannot cancel it.
export function limitsClaimsMeasuredRotate(limitsSource) {
  if (!limitsSource) return false;
  return limitsSource
    .split("\n")
    .some((row) => ROTATE_IDENTIFIER.test(row) && MEASURED_MARKER.test(row));
}

export function evaluateRotateExportBind({
  testSource = "",
  storeSource = "",
  limitsSource = "",
  testExists = false,
} = {}) {
  const measuredClaim = limitsClaimsMeasuredRotate(limitsSource);

  // Requirement: unscannable input fails the gate. An empty export set from a
  // malformed module is indistinguishable from "exports genuinely absent", so
  // refuse to answer rather than let ambiguity read as a vacuous PASS. This is
  // checked before test_absent, because the non-applicable path must not become
  // a way for unparseable source to slip through.
  const exportScan = collectExportedNames(storeSource);
  if (!exportScan.ok) {
    return Object.freeze({
      schema: "bizra.dema.authorship_key_rotate_export_bind_check.v0.1",
      ok: false,
      test_absent: !testExists,
      measured_claim: measuredClaim,
      missing_exports: Object.freeze([...REQUIRED_SYMBOLS]),
      imported_symbols: Object.freeze([]),
      reasons: Object.freeze([
        `store_source_unscannable:${exportScan.reason}`,
      ]),
      boundary: Object.freeze({
        runtime_execution: false,
        mutation_performed: false,
        network_used: false,
      }),
    });
  }

  const missingForHonesty = measuredClaim
    ? REQUIRED_SYMBOLS.filter((s) => !storeExportsSymbol(storeSource, s))
    : [];

  if (!testExists) {
    if (missingForHonesty.length > 0) {
      return Object.freeze({
        schema: "bizra.dema.authorship_key_rotate_export_bind_check.v0.1",
        ok: false,
        test_absent: true,
        measured_claim: true,
        missing_exports: Object.freeze(missingForHonesty),
        imported_symbols: Object.freeze([]),
        reasons: Object.freeze(["limits_measured_rotate_without_exports"]),
        boundary: Object.freeze({
          runtime_execution: false,
          mutation_performed: false,
          network_used: false,
        }),
      });
    }
    return Object.freeze({
      schema: "bizra.dema.authorship_key_rotate_export_bind_check.v0.1",
      ok: true,
      test_absent: true,
      measured_claim: measuredClaim,
      missing_exports: Object.freeze([]),
      imported_symbols: Object.freeze([]),
      reasons: Object.freeze([]),
      boundary: Object.freeze({
        runtime_execution: false,
        mutation_performed: false,
        network_used: false,
      }),
    });
  }

  const imported = parseImportedRotateSymbols(testSource);
  const missingFromImports = imported.filter(
    (s) => !storeExportsSymbol(storeSource, s),
  );
  const missing_exports = [
    ...new Set([...missingFromImports, ...missingForHonesty]),
  ];
  const reasons = [];
  if (missingFromImports.length > 0) {
    reasons.push("test_imports_missing_store_exports");
  }
  if (missingForHonesty.length > 0) {
    reasons.push("limits_measured_rotate_without_exports");
  }

  return Object.freeze({
    schema: "bizra.dema.authorship_key_rotate_export_bind_check.v0.1",
    ok: missing_exports.length === 0,
    test_absent: false,
    measured_claim: measuredClaim,
    missing_exports: Object.freeze(missing_exports),
    imported_symbols: Object.freeze(imported),
    reasons: Object.freeze(reasons),
    boundary: Object.freeze({
      runtime_execution: false,
      mutation_performed: false,
      network_used: false,
    }),
  });
}

export async function runAuthorshipKeyRotateExportBindCheck({
  repoRoot = REPO_ROOT,
} = {}) {
  const testAbsolute = join(repoRoot, TEST_PATH);
  const testExists = existsSync(testAbsolute);
  const storeSource = existsSync(join(repoRoot, STORE_PATH))
    ? readFileSync(join(repoRoot, STORE_PATH), "utf8")
    : "";
  const limitsAbsolute = join(repoRoot, LIMITS_PATH);
  const limitsSource = existsSync(limitsAbsolute)
    ? readFileSync(limitsAbsolute, "utf8")
    : "";
  const testSource = testExists ? readFileSync(testAbsolute, "utf8") : "";

  return evaluateRotateExportBind({
    testSource,
    storeSource,
    limitsSource,
    testExists,
  });
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const report = await runAuthorshipKeyRotateExportBindCheck();
  if (JSON_MODE) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(
      "DEMA · Authorship key rotate export bind check (DONE-GATE-ROTATE-EXPORT-BIND-1A)",
    );
    console.log(`  test_absent: ${report.test_absent}`);
    console.log(`  measured_claim: ${report.measured_claim}`);
    console.log(`  result: ${report.ok ? "PASS" : "FAIL"}`);
    if (!report.ok) {
      if (report.imported_symbols.length > 0) {
        console.log(`  imported: ${report.imported_symbols.join(", ")}`);
      }
      if (report.missing_exports.length > 0) {
        console.log(`  missing_exports: ${report.missing_exports.join(", ")}`);
      }
      for (const reason of report.reasons) console.log(`  reason: ${reason}`);
    }
  }
  if (!report.ok) process.exitCode = 1;
}
