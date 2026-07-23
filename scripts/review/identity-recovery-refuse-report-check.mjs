#!/usr/bin/env node
// IDENTITY-RECOVERY-REFUSE-AND-REPORT-1E static gate.
//
// Founder decision: automatic root-of-trust recovery mutation is REJECTED.
// Detection/diagnosis is automatic and read-only; recovery mutation requires
// an explicitly consented C5 transaction (IDENTITY-EXPLICIT-RECOVERY-
// TRANSACTION-1F). This gate proves the decision STRUCTURALLY:
//
//  1. The rejected quarantine design is absent from packages/ and apps/
//     (forbidden symbols).
//  2. The read-only recovery surface (classifyPointerAuthority,
//     inspectIdentityRecovery) cannot REACH an authority-mutating function —
//     a function-dependency reachability check over the key store, not a
//     line-number or text-position scan.
//  3. init and migrate are actually wired through the classifier (a
//     refuse-and-report branch exists; the gate fails if it is removed).
//
// 1E.1 Finding B: extraction covers named declarations, var-assigned arrow
// functions and function expressions, and class declarations. Any callable
// syntax the extractor cannot attribute (object-literal methods at module
// top level, paren-free arrows, comma-expression arrows, …) FAILS CLOSED as
// `unsupported_callable_form` — the gate never claims complete reachability
// over syntax it did not parse. The repository has zero direct dependencies,
// so no AST parser is available without expanding supply-chain scope; this
// extended-extraction + fail-closed design is the sanctioned fallback.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const KEY_STORE = "packages/receipts/src/authorship-key-store.js";
const SCAN_ROOTS = ["packages", "apps"];
const SOURCE_EXTENSIONS = new Set([".js", ".mjs"]);

// The rejected automatic-quarantine design (PR #414) must stay extinct.
const FORBIDDEN_SYMBOLS = [
  "quarantineActivePointer",
  "attemptGenesisRecovery",
  "quarantine-active-key",
  "recovered_from",
];

// Read-only roots: nothing reachable from these may mutate authority state.
const READ_ONLY_ROOTS = ["classifyPointerAuthority", "inspectIdentityRecovery"];

// Authority-mutating callees (fs mutators + the module's own writers).
const MUTATORS = [
  "rename",
  "unlink",
  "mkdir",
  "copyFile",
  "writeFile",
  "rm",
  "rmdir",
  "generateEd25519Keypair",
  "writeKeyFile",
  "writeGeneration",
  "activateGeneration",
  "writeActivePointer",
  "repairGenerationMetadata",
  "writeIfAbsent",
  "acquireIdentityLease",
];
const WRITE_OPEN_FLAGS = /\bO_(?:WRONLY|RDWR|CREAT|TRUNC|EXCL|APPEND)\b/;

function extension(path) {
  const dot = path.lastIndexOf(".");
  return dot >= 0 ? path.slice(dot) : "";
}

function walk(dir, root, files) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git") continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path, root, files);
    } else if (SOURCE_EXTENSIONS.has(extension(entry))) {
      files.push(relative(root, path).split("\\").join("/"));
    }
  }
}

// Remove comments (first — apostrophes inside comments would derail string
// pairing), then string/template literals, so identifier scans never match
// prose or data.
function stripCommentsAndStrings(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/`(?:\\.|[^`\\])*`/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, '""')
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
}

function matchBalanced(source, openIndex, openCh, closeCh) {
  let depth = 0;
  for (let i = openIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === openCh) depth += 1;
    else if (ch === closeCh) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// Extract every module-level callable the gate understands, recording its
// source span so the residual (everything NOT attributed to a callable) can
// be checked for unsupported callable syntax.
function extractCallables(source) {
  const bodies = new Map();
  const spans = [];
  const record = (name, start, end) => {
    bodies.set(name, source.slice(start, end + 1));
    spans.push([start, end + 1]);
  };

  // 1. function declarations: [async] function name(params) { body }
  const decl = /(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  for (const match of source.matchAll(decl)) {
    const paramsEnd = matchBalanced(
      source,
      match.index + match[0].length - 1,
      "(",
      ")",
    );
    if (paramsEnd < 0) continue;
    const openBrace = source.indexOf("{", paramsEnd);
    if (openBrace < 0) continue;
    const end = matchBalanced(source, openBrace, "{", "}");
    if (end < 0) continue;
    record(match[1], match.index, end);
  }

  // 2. var-assigned callables: const name = [async] (params) => …  and
  //    const name = [async] function [inner](params) { … }
  const assigned =
    /(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(async\s*)?(function\b|\()/g;
  for (const match of source.matchAll(assigned)) {
    const name = match[1];
    if (bodies.has(name)) continue;
    if (match[3] === "function") {
      const parenIndex = source.indexOf("(", match.index + match[0].length - 1);
      if (parenIndex < 0) continue;
      const paramsEnd = matchBalanced(source, parenIndex, "(", ")");
      if (paramsEnd < 0) continue;
      const openBrace = source.indexOf("{", paramsEnd);
      if (openBrace < 0) continue;
      const end = matchBalanced(source, openBrace, "{", "}");
      if (end < 0) continue;
      record(name, match.index, end);
    } else {
      // Arrow candidate: params close then `=>`, then a block or expression.
      const parenIndex = match.index + match[0].length - 1;
      const paramsEnd = matchBalanced(source, parenIndex, "(", ")");
      if (paramsEnd < 0) continue;
      const arrow = source.slice(paramsEnd + 1).match(/^\s*=>/);
      if (!arrow) continue; // not an arrow → left for the residual fail-closed scan
      const afterArrow = paramsEnd + 1 + arrow[0].length;
      const rest = source.slice(afterArrow).match(/^\s*/);
      const bodyStart = afterArrow + rest[0].length;
      if (source[bodyStart] === "{") {
        const end = matchBalanced(source, bodyStart, "{", "}");
        if (end < 0) continue;
        record(name, match.index, end);
      } else {
        // Expression body: runs to the terminating semicolon at paren-depth 0.
        let depth = 0;
        let end = -1;
        for (let i = bodyStart; i < source.length; i += 1) {
          const ch = source[i];
          if (ch === "(" || ch === "[" || ch === "{") depth += 1;
          else if (ch === ")" || ch === "]" || ch === "}") depth -= 1;
          else if (ch === ";" && depth === 0) {
            end = i;
            break;
          }
        }
        if (end < 0) continue;
        record(name, match.index, end);
      }
    }
  }

  // 3. class declarations: the whole class body counts as one callable —
  //    every method inside is scanned and reachable via the class name.
  const cls = /(?:export\s+)?class\s+([A-Za-z_$][\w$]*)[^{]*\{/g;
  for (const match of source.matchAll(cls)) {
    const openBrace = match.index + match[0].length - 1;
    const end = matchBalanced(source, openBrace, "{", "}");
    if (end < 0) continue;
    record(match[1], match.index, end);
  }

  return { bodies, spans };
}

// Residual = module source minus every attributed callable span. Any callable
// syntax remaining there was NOT parsed into the graph → fail closed.
function residualCallableForms(source, spans) {
  const keep = [];
  let cursor = 0;
  for (const [start, end] of [...spans].sort((a, b) => a[0] - b[0])) {
    if (start > cursor) keep.push(source.slice(cursor, start));
    cursor = Math.max(cursor, end);
  }
  keep.push(source.slice(cursor));
  const residual = stripCommentsAndStrings(keep.join("\n"));
  const findings = [];
  if (/=>/.test(residual)) findings.push("arrow_function");
  if (/\bfunction\b/.test(residual)) findings.push("function_keyword");
  const methodLike = residual.match(
    /(?:^|[{,;\s])(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^()]*\)\s*\{/,
  );
  if (
    methodLike &&
    !["if", "for", "while", "switch", "catch", "return", "typeof"].includes(
      methodLike[1],
    )
  ) {
    findings.push("method_shorthand");
  }
  return findings;
}

// Reachability edges are BARE identifier references (not just call syntax) so
// helpers passed as callbacks stay in the graph. Over-connection is fail-safe.
function reachableFrom(roots, bodies) {
  const stripped = new Map(
    [...bodies].map(([name, body]) => [name, stripCommentsAndStrings(body)]),
  );
  const seen = new Set();
  const queue = roots.filter((r) => bodies.has(r));
  while (queue.length > 0) {
    const name = queue.pop();
    if (seen.has(name)) continue;
    seen.add(name);
    const body = stripped.get(name);
    for (const candidate of bodies.keys()) {
      if (seen.has(candidate)) continue;
      if (new RegExp(`\\b${candidate}\\b`).test(body)) queue.push(candidate);
    }
  }
  return { reachable: seen, stripped };
}

export async function runIdentityRecoveryRefuseReportCheck({
  sourceOverride = null,
} = {}) {
  const violations = [];

  // 1. Forbidden quarantine symbols across production source.
  if (sourceOverride === null) {
    const files = [];
    for (const scanRoot of SCAN_ROOTS) {
      const absolute = join(REPO_ROOT, scanRoot);
      if (!existsSync(absolute)) continue;
      walk(absolute, REPO_ROOT, files);
    }
    for (const file of files) {
      const body = readFileSync(join(REPO_ROOT, file), "utf8");
      for (const symbol of FORBIDDEN_SYMBOLS) {
        if (body.includes(symbol)) {
          violations.push({ file, kind: "forbidden_quarantine_symbol", symbol });
        }
      }
    }
  }

  const source =
    sourceOverride ?? readFileSync(join(REPO_ROOT, KEY_STORE), "utf8");

  for (const symbol of FORBIDDEN_SYMBOLS) {
    if (sourceOverride !== null && source.includes(symbol)) {
      violations.push({
        file: "<override>",
        kind: "forbidden_quarantine_symbol",
        symbol,
      });
    }
  }

  // 2a. Completeness: any callable form the extractor could not attribute
  // fails the gate — never a silent blind spot in the reachability graph.
  const { bodies, spans } = extractCallables(source);
  for (const form of residualCallableForms(source, spans)) {
    violations.push({
      file: sourceOverride !== null ? "<override>" : KEY_STORE,
      kind: "unsupported_callable_form",
      form,
    });
  }

  // 2b. Read-only reachability: no mutator reachable from the recovery
  // surface (bare-reference edges over comment/string-stripped bodies).
  for (const root of READ_ONLY_ROOTS) {
    if (!bodies.has(root)) {
      violations.push({ file: KEY_STORE, kind: "missing_read_only_root", root });
    }
  }
  const { reachable, stripped } = reachableFrom(READ_ONLY_ROOTS, bodies);
  for (const name of reachable) {
    const body = stripped.get(name);
    for (const mutator of MUTATORS) {
      if (new RegExp(`\\b${mutator}\\b`).test(body)) {
        violations.push({
          file: KEY_STORE,
          kind: "mutator_reachable_from_read_only_surface",
          function: name,
          mutator,
        });
      }
    }
    if (WRITE_OPEN_FLAGS.test(body)) {
      violations.push({
        file: KEY_STORE,
        kind: "write_open_flags_in_read_only_surface",
        function: name,
      });
    }
  }

  // 3. Wiring proof: init/migrate route invalid pointers through the
  // classifier's refuse-and-report branch.
  if (sourceOverride === null) {
    for (const wired of ["initAuthorshipKey", "migrateLegacyAuthorshipKey"]) {
      const body = bodies.get(wired);
      if (
        !body ||
        !/\bclassifyPointerAuthority\s*\(/.test(body) ||
        !/\b(?:initRecoveryRefusal|migrateRecoveryRefusal)\s*\(/.test(body)
      ) {
        violations.push({
          file: KEY_STORE,
          kind: "refuse_and_report_not_wired",
          function: wired,
        });
      }
    }
  }

  return Object.freeze({
    schema: "bizra.dema.identity_recovery_refuse_report_check.v0.1",
    ok: violations.length === 0,
    read_only_roots: READ_ONLY_ROOTS,
    reachable_functions: [...reachable].sort(),
    violations,
    boundary: Object.freeze({
      runtime_execution: false,
      mutation_performed: false,
      network_used: false,
    }),
  });
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const report = await runIdentityRecoveryRefuseReportCheck();
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}
