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

// Blank out comment bodies and string/template literal contents, preserving
// newlines so the remaining text is still structurally scannable. Regex
// literals are deliberately NOT tracked: the failure mode of mistaking one for
// a string is OVER-blanking, which can only hide an export and therefore only
// fails this gate closed. Under-blanking — treating prose as code — is the
// direction that manufactures a false PASS, and that cannot happen here.
export function stripCommentsAndLiterals(source) {
  let out = "";
  let i = 0;
  const n = source.length;
  while (i < n) {
    const c = source[i];
    const d = source[i + 1];
    if (c === "/" && d === "/") {
      while (i < n && source[i] !== "\n") {
        out += " ";
        i += 1;
      }
      continue;
    }
    if (c === "/" && d === "*") {
      out += "  ";
      i += 2;
      while (i < n && !(source[i] === "*" && source[i + 1] === "/")) {
        out += source[i] === "\n" ? "\n" : " ";
        i += 1;
      }
      out += i < n ? "  " : "";
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      out += " ";
      i += 1;
      while (i < n) {
        if (source[i] === "\\") {
          out += "  ";
          i += 2;
          continue;
        }
        if (source[i] === c) {
          out += " ";
          i += 1;
          break;
        }
        out += source[i] === "\n" ? "\n" : " ";
        i += 1;
      }
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

// The set of names this module actually EXPORTS — not the set of identifiers it
// happens to mention. `export { rotateAuthorshipKey as legacyRotate }` exports
// `legacyRotate`; the local name is not importable and must not satisfy the
// gate. `export * from` is unresolvable without following the graph and is
// therefore ignored (fails closed rather than guessing).
export function collectExportedNames(source) {
  const clean = stripCommentsAndLiterals(source);
  const names = new Set();
  const declRe =
    /\bexport\s+(?:async\s+)?(?:function\s*\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g;
  for (const match of clean.matchAll(declRe)) names.add(match[1]);
  for (const block of clean.matchAll(/\bexport\s*\{([^}]*)\}/g)) {
    for (const specifier of block[1].split(",")) {
      const parts = specifier.trim().split(/\s+as\s+/);
      const exported = parts[parts.length - 1].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(exported)) names.add(exported);
    }
  }
  return names;
}

export function storeExportsSymbol(storeSource, symbol) {
  return collectExportedNames(storeSource).has(symbol);
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

export function limitsClaimsMeasuredRotate(limitsSource) {
  if (!limitsSource) return false;
  return limitsSource.split("\n").some((line) => {
    if (!/AUTHORSHIP-KEY-ROTATE-\d+[A-Z]/.test(line)) return false;
    if (/\bBLOCKED\b/.test(line)) return false;
    return (
      /\*\*MEASURED\*\*|\[MEASURED\]|MEASURED\s+Authorship key rotation/i.test(
        line,
      ) && /MEASURED/.test(line)
    );
  });
}

export function evaluateRotateExportBind({
  testSource = "",
  storeSource = "",
  limitsSource = "",
  testExists = false,
} = {}) {
  const measuredClaim = limitsClaimsMeasuredRotate(limitsSource);
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
