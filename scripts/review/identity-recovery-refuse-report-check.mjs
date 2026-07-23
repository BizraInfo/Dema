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

// Extract every `function name(...) { ... }` / `async function name(...)`
// declaration body by brace matching. Deterministic over the key store's
// declaration-only style; no line numbers involved.
function extractFunctions(source) {
  const bodies = new Map();
  const decl = /(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  for (const match of source.matchAll(decl)) {
    const name = match[1];
    const afterParen = match.index + match[0].length;
    // Skip the parameter list first — destructured params carry braces of
    // their own, so the body brace is the first one AFTER the params close.
    let parenDepth = 1;
    let paramsEnd = -1;
    for (let i = afterParen; i < source.length; i += 1) {
      const ch = source[i];
      if (ch === "(") parenDepth += 1;
      else if (ch === ")") {
        parenDepth -= 1;
        if (parenDepth === 0) {
          paramsEnd = i;
          break;
        }
      }
    }
    if (paramsEnd < 0) continue;
    const openBrace = source.indexOf("{", paramsEnd);
    if (openBrace < 0) continue;
    let depth = 0;
    let end = -1;
    for (let i = openBrace; i < source.length; i += 1) {
      const ch = source[i];
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end < 0) continue;
    bodies.set(name, source.slice(openBrace, end + 1));
  }
  return bodies;
}

function reachableFrom(roots, bodies) {
  const seen = new Set();
  const queue = roots.filter((r) => bodies.has(r));
  while (queue.length > 0) {
    const name = queue.pop();
    if (seen.has(name)) continue;
    seen.add(name);
    const body = bodies.get(name);
    for (const candidate of bodies.keys()) {
      if (seen.has(candidate)) continue;
      if (new RegExp(`\\b${candidate}\\s*\\(`).test(body)) queue.push(candidate);
    }
  }
  return seen;
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

  // 2. Read-only reachability: no mutator callable from the recovery surface.
  const bodies = extractFunctions(source);
  for (const root of READ_ONLY_ROOTS) {
    if (!bodies.has(root)) {
      violations.push({ file: KEY_STORE, kind: "missing_read_only_root", root });
    }
  }
  const reachable = reachableFrom(READ_ONLY_ROOTS, bodies);
  for (const name of reachable) {
    const body = bodies.get(name);
    for (const mutator of MUTATORS) {
      if (new RegExp(`\\b${mutator}\\s*\\(`).test(body)) {
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
