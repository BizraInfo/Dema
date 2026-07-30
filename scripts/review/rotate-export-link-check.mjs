#!/usr/bin/env node
// EXPORT-BIND-LINKER-2A — verify rotate exports through native module linking.
//
// WHY THIS EXISTS: the question "does the store export these three names?" is a
// MODULE-GRAPH question, not a text question. A text oracle answers it by
// pattern-matching source, and every way text can lie about structure becomes a
// separate defect: `export { X as Y }` (X is not exported), a commented-out
// export, an export inside a template or regex literal, and — the case that
// proves the category error — `export { X } from "./inner.js"` where inner.js
// does not export X. Text says yes; the graph says no. That set of divergences
// is unbounded, so hardening a scanner never terminates.
//
// Node already contains a correct ES module resolver. A named-import mismatch is
// a LINK-TIME error, raised before any module body evaluates. This gate asks the
// linker instead of reimplementing it.
//
// TWO SEPARATE QUESTIONS, never conflated:
//   MODULE TRUTH   — does the store legally provide the canonical imports?
//   DOCUMENT TRUTH — does CURRENT_LIMITS.md carry an explicit positive
//                    [MEASURED] AUTHORSHIP-KEY-ROTATE row that activates the bind?
//
// BOUNDARY: link only. `evaluate()` is never called on user-authored source, so
// no repository module body runs — not "we avoided it", but provably absent.
// Read-only: no network, no keygen, no DEMA_HOME, no mutation.
//
// PLATFORM: requires `node --experimental-vm-modules`. That is a REVIEW-GATE
// dependency only. It is NOT a Node0 runtime capability and confers nothing on
// the product. If the API is missing or changes, this gate fails loudly; it
// never falls back to text scanning and never manufactures a PASS.

import vm from "node:vm";
import { isBuiltin } from "node:module";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, extname, resolve as resolvePath, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = realpathSync(resolvePath(SELF_DIR, "..", ".."));

export const STORE_PATH = "packages/receipts/src/authorship-key-store.js";
export const TEST_PATH = "tests/authorship-key-rotate.test.js";
export const LIMITS_PATH = "docs/CURRENT_LIMITS.md";

export const REQUIRED_SYMBOLS = Object.freeze([
  "KEY_ROTATE_CONSENT_PHRASE",
  "KEY_ROTATE_SCHEMA",
  "rotateAuthorshipKey",
]);

export const ALLOWED_EXTENSIONS = Object.freeze([".js", ".mjs"]);

export const STATE = Object.freeze({
  LINKED: "LINKED_NOT_EVALUATED",
  PARSE_FAILED: "PARSE_FAILED",
  RESOLUTION_FAILED: "RESOLUTION_FAILED",
  LINK_FAILED: "LINK_FAILED",
  UNSUPPORTED_SPECIFIER: "UNSUPPORTED_SPECIFIER",
  PATH_ESCAPE_REFUSED: "PATH_ESCAPE_REFUSED",
  PLATFORM_UNAVAILABLE: "PLATFORM_UNAVAILABLE",
  CONSUMER_ABSENT: "CONSUMER_ABSENT_POLICY_PROBE_ACTIVE",
});

// States that mean "the resolver could not be sure", which must fail the gate
// rather than read as a clean negative.
const UNCERTAIN_STATES = Object.freeze([
  STATE.UNSUPPORTED_SPECIFIER,
  STATE.PATH_ESCAPE_REFUSED,
  STATE.PLATFORM_UNAVAILABLE,
]);

// Carries an explicit state so a resolver refusal is never collapsed into a
// generic link failure — or worse, into a pass.
class ResolverRefusal extends Error {
  constructor(state, message) {
    super(message);
    this.name = "ResolverRefusal";
    this.state = state;
  }
}

export function platformAvailable() {
  return (
    typeof vm.SourceTextModule === "function" &&
    typeof vm.SyntheticModule === "function"
  );
}

// ---------------------------------------------------------------- DOCUMENT TRUTH
// A bounded Markdown table-row reader. It never inspects JavaScript: the
// documentary state of the ledger is a property of the ledger, not of the code.
export function readMeasuredClaim(limitsSource) {
  const ROTATE = /AUTHORSHIP-KEY-ROTATE-\d+[A-Z]/;
  const rows = String(limitsSource ?? "")
    .split("\n")
    .filter((line) => line.trimStart().startsWith("|"));
  const rotateRows = rows.filter((row) => ROTATE.test(row));
  if (rotateRows.length === 0) return { claim: "ABSENT", rotate_rows: 0 };
  const measured = rotateRows.filter((row) => row.includes("[MEASURED]"));
  return {
    claim: measured.length > 0 ? "MEASURED" : "NOT_MEASURED",
    rotate_rows: rotateRows.length,
  };
}

// ------------------------------------------------------------------ RESOLVER
export function resolveLocalSpecifier(specifier, fromPath, repoRoot = REPO_ROOT) {
  if (!/^\.\.?\//.test(specifier)) {
    throw new ResolverRefusal(
      STATE.UNSUPPORTED_SPECIFIER,
      `not a relative specifier: ${specifier}`,
    );
  }
  if (!ALLOWED_EXTENSIONS.includes(extname(specifier))) {
    throw new ResolverRefusal(
      STATE.UNSUPPORTED_SPECIFIER,
      `extension not admitted: ${specifier}`,
    );
  }
  const absolute = resolvePath(dirname(fromPath), specifier);
  if (!existsSync(absolute)) {
    throw new ResolverRefusal(
      STATE.RESOLUTION_FAILED,
      `dependency not found: ${specifier}`,
    );
  }
  // realpath collapses symlinks BEFORE containment is judged, so a link out of
  // the tree is refused rather than followed.
  const real = realpathSync(absolute);
  const root = realpathSync(repoRoot);
  if (real !== root && !real.startsWith(root + sep)) {
    throw new ResolverRefusal(
      STATE.PATH_ESCAPE_REFUSED,
      `resolved outside the repository: ${specifier}`,
    );
  }
  return real;
}

// Export names come from the REAL platform namespace. Nothing is invented
// because an importer asked for it, so an unknown builtin fails closed.
async function builtinNamespaceModule(specifier, context) {
  const withScheme = specifier.startsWith("node:") ? specifier : `node:${specifier}`;
  if (!isBuiltin(withScheme)) {
    throw new ResolverRefusal(
      STATE.RESOLUTION_FAILED,
      `unknown builtin: ${specifier}`,
    );
  }
  const namespace = await import(withScheme);
  return new vm.SyntheticModule(Object.keys(namespace), () => {}, {
    identifier: withScheme,
    context,
  });
}

// -------------------------------------------------------------- LINK-ONLY CORE
export async function linkModuleGraph({ source, path, repoRoot = REPO_ROOT }) {
  if (!platformAvailable()) {
    return {
      state: STATE.PLATFORM_UNAVAILABLE,
      reason: "vm.SourceTextModule/SyntheticModule unavailable",
      user_modules_evaluated: 0,
    };
  }
  const context = vm.createContext({});
  const cache = new Map();

  const compile = (src, identifier) => {
    try {
      return new vm.SourceTextModule(src, {
        identifier,
        context,
        initializeImportMeta(meta) {
          meta.url = `file://${identifier}`;
        },
        importModuleDynamically() {
          throw new ResolverRefusal(
            STATE.UNSUPPORTED_SPECIFIER,
            `dynamic import refused: ${identifier}`,
          );
        },
      });
    } catch (error) {
      throw new ResolverRefusal(
        STATE.PARSE_FAILED,
        `${identifier}: ${error.message}`,
      );
    }
  };

  const linker = async (specifier, referencing) => {
    if (specifier.startsWith("node:") || isBuiltin(specifier)) {
      return builtinNamespaceModule(specifier, context);
    }
    if (!/^\.\.?\//.test(specifier)) {
      // Bare/package specifiers are refused rather than stubbed: a stub would
      // manufacture a linkable graph that does not exist.
      throw new ResolverRefusal(
        STATE.UNSUPPORTED_SPECIFIER,
        `package specifier refused: ${specifier}`,
      );
    }
    const real = resolveLocalSpecifier(specifier, referencing.identifier, repoRoot);
    const cached = cache.get(real);
    if (cached) return cached;
    const compiled = compile(readFileSync(real, "utf8"), real);
    // Cached BEFORE its own dependencies are linked, so an import cycle
    // terminates on the cache instead of recursing forever.
    cache.set(real, compiled);
    return compiled;
  };

  let entry;
  try {
    entry = compile(source, path);
  } catch (error) {
    return {
      state: error.state ?? STATE.PARSE_FAILED,
      reason: error.message,
      user_modules_evaluated: 0,
    };
  }

  try {
    await entry.link(linker);
  } catch (error) {
    return {
      state: error instanceof ResolverRefusal ? error.state : STATE.LINK_FAILED,
      reason: error.message,
      user_modules_evaluated: 0,
    };
  }

  if (entry.status !== "linked") {
    return {
      state: STATE.LINK_FAILED,
      reason: `unexpected module status: ${entry.status}`,
      user_modules_evaluated: 0,
    };
  }
  // No evaluate() call exists anywhere in this module, for the entry or for any
  // dependency, so no user body has run.
  return {
    state: STATE.LINKED,
    modules_linked: cache.size + 1,
    user_modules_evaluated: 0,
  };
}

// ---------------------------------------------------------------------- PROBES
// Authoritative regardless of whether the rotation test exists: it asks the
// canonical policy question directly of the store.
export async function runPolicyProbe({
  repoRoot = REPO_ROOT,
  storePath = STORE_PATH,
  symbols = REQUIRED_SYMBOLS,
} = {}) {
  const required = [...symbols];
  const storeAbsolute = resolvePath(repoRoot, storePath);
  if (!existsSync(storeAbsolute)) {
    return {
      state: STATE.RESOLUTION_FAILED,
      reason: `store absent: ${storePath}`,
      required_symbols: required,
    };
  }
  const probePath = resolvePath(
    dirname(storeAbsolute),
    "__rotate_policy_probe__.mjs",
  );
  const source = `import { ${required.join(", ")} } from "./${basename(storeAbsolute)}";\n`;
  const result = await linkModuleGraph({ source, path: probePath, repoRoot });
  return { ...result, required_symbols: required };
}

export async function runConsumerProbe({
  repoRoot = REPO_ROOT,
  testPath = TEST_PATH,
} = {}) {
  const absolute = resolvePath(repoRoot, testPath);
  if (!existsSync(absolute)) {
    return { state: STATE.CONSUMER_ABSENT, user_modules_evaluated: 0 };
  }
  return linkModuleGraph({
    source: readFileSync(absolute, "utf8"),
    path: absolute,
    repoRoot,
  });
}

// ------------------------------------------------------------------- COMPOSITE
export async function runRotateExportLinkCheck({ repoRoot = REPO_ROOT } = {}) {
  const limitsAbsolute = resolvePath(repoRoot, LIMITS_PATH);
  const document = readMeasuredClaim(
    existsSync(limitsAbsolute) ? readFileSync(limitsAbsolute, "utf8") : "",
  );

  if (!platformAvailable()) {
    return Object.freeze({
      schema: "bizra.dema.rotate_export_link_check.v0.1",
      ok: false,
      policy_claim: document.claim,
      policy_probe: Object.freeze({
        state: STATE.PLATFORM_UNAVAILABLE,
        required_symbols: Object.freeze([...REQUIRED_SYMBOLS]),
      }),
      consumer_probe: Object.freeze({ state: STATE.PLATFORM_UNAVAILABLE }),
      user_modules_evaluated: 0,
      experimental_vm_modules: false,
      reasons: Object.freeze(["platform_unavailable:vm.SourceTextModule"]),
      boundary: Object.freeze({
        runtime_execution: false,
        mutation_performed: false,
        network_used: false,
      }),
    });
  }

  const policy = await runPolicyProbe({ repoRoot });
  const consumer = await runConsumerProbe({ repoRoot });
  const reasons = [];

  // DOCUMENT TRUTH activates MODULE TRUTH. A positive [MEASURED] claim must be
  // backed by a linkable graph; with no claim there is nothing to bind, and the
  // documentary state is reported without asserting runtime capability.
  if (document.claim === "MEASURED" && policy.state !== STATE.LINKED) {
    reasons.push(`measured_claim_without_linkable_exports:${policy.state}`);
  }
  for (const [label, probe] of [
    ["policy", policy],
    ["consumer", consumer],
  ]) {
    if (UNCERTAIN_STATES.includes(probe.state)) {
      reasons.push(`resolver_uncertainty:${label}:${probe.state}`);
    }
  }

  const evaluated =
    (policy.user_modules_evaluated ?? 0) + (consumer.user_modules_evaluated ?? 0);
  if (evaluated !== 0) reasons.push(`user_module_evaluated:${evaluated}`);

  return Object.freeze({
    schema: "bizra.dema.rotate_export_link_check.v0.1",
    ok: reasons.length === 0,
    policy_claim: document.claim,
    policy_probe: Object.freeze({
      state: policy.state,
      required_symbols: Object.freeze([...REQUIRED_SYMBOLS]),
      ...(policy.reason ? { reason: policy.reason } : {}),
    }),
    consumer_probe: Object.freeze({
      state: consumer.state,
      ...(consumer.reason ? { reason: consumer.reason } : {}),
    }),
    user_modules_evaluated: evaluated,
    experimental_vm_modules: true,
    reasons: Object.freeze(reasons),
    boundary: Object.freeze({
      runtime_execution: false,
      mutation_performed: false,
      network_used: false,
    }),
  });
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await runRotateExportLinkCheck();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("DEMA · Rotate export link check (EXPORT-BIND-LINKER-2A)");
    console.log(`  policy_claim:    ${report.policy_claim}`);
    console.log(`  policy_probe:    ${report.policy_probe.state}`);
    console.log(`  consumer_probe:  ${report.consumer_probe.state}`);
    console.log(`  user_modules_evaluated: ${report.user_modules_evaluated}`);
    console.log(`  result: ${report.ok ? "PASS" : "FAIL"}`);
    for (const reason of report.reasons) console.log(`  reason: ${reason}`);
  }
  if (!report.ok) process.exitCode = 1;
}
