// LEGACY-CONSENT-AUTHORITY-CHECK — LIVE_LEGACY_CONSENT_AUTHORITY must stay 0.
//
//   node scripts/review/legacy-consent-authority-check.mjs [--json]
//
// Consent cutover part 3 retired the two superseded consumption writers: they
// create nothing, for any caller. This gate is the other half — it keeps the
// retirement from being quietly undone, in either of the two ways it could be:
//
//   1. A live source starts CALLING a legacy writer again. Harmless today
//      because the writer refuses, but it means a decision path believes it is
//      consuming consent when it is not, which is worse than the original defect.
//
//   2. A legacy writer starts WRITING again. The gate re-derives that each
//      retired writer's body still creates nothing, rather than trusting the
//      comment that says so.
//
// Reads are explicitly ALLOWED and must stay allowed: the canonical claim
// consults the superseded namespaces for REFUSAL, and a gate that forbade
// reading would force the estate to forget what it already spent.
//
// BOUNDARY: read-only over the repository. No network, no model, no spawn, no
// filesystem write.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const JSON_MODE = process.argv.includes("--json");

export const LEGACY_MODULES = Object.freeze([
  "packages/receipts/src/consent-nonce-registry.js",
  "packages/receipts/src/consent-nonce-registry-atomic.js",
]);

export const LEGACY_WRITER = "recordConsentNonce";
export const RETIRED_MARKER = "legacy_consent_authority_retired";

/// Live tiers only. `tests/` legitimately imports the retired writers to prove
/// they refuse, and `scripts/` holds this gate, which must name them to check
/// them — scanning either would make the gate report itself.
const LIVE_DIRS = Object.freeze(["packages", "apps", "bin"]);

/// Comments and string literals are not code. Blanked in one pass, because a
/// replace chain has no safe order: strings-first lets an apostrophe in a
/// comment swallow a line, comments-first lets the `//` inside a URL do the
/// same. Same reasoning as node0-transition-coverage-proof.mjs.
export function stripCommentsAndStrings(text) {
  const out = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    const d = text[i + 1];
    if (c === "/" && d === "/") {
      while (i < n && text[i] !== "\n") { out.push(" "); i += 1; }
      continue;
    }
    if (c === "/" && d === "*") {
      while (i < n && !(text[i] === "*" && text[i + 1] === "/")) {
        out.push(text[i] === "\n" ? "\n" : " ");
        i += 1;
      }
      out.push(" ", " ");
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      out.push(" ");
      i += 1;
      while (i < n && text[i] !== quote) {
        if (text[i] === "\\") { out.push(" "); i += 1; }
        if (i < n) { out.push(text[i] === "\n" ? "\n" : " "); i += 1; }
      }
      out.push(" ");
      i += 1;
      continue;
    }
    out.push(c);
    i += 1;
  }
  return out.join("");
}

/// Comments only — string literals SURVIVE. The two checks below need different
/// tools and getting this wrong makes the gate silently unreachable: an import
/// specifier IS a string, so testing for one against string-blanked source can
/// never match, and the gate would pass on a tree full of imports. Measured on
/// the first draft of this file.
export function stripComments(text) {
  const out = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    const d = text[i + 1];
    if (c === "/" && d === "/") {
      while (i < n && text[i] !== "\n") { out.push(" "); i += 1; }
      continue;
    }
    if (c === "/" && d === "*") {
      while (i < n && !(text[i] === "*" && text[i + 1] === "/")) {
        out.push(text[i] === "\n" ? "\n" : " ");
        i += 1;
      }
      out.push(" ", " ");
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      out.push(c);
      i += 1;
      while (i < n && text[i] !== quote) {
        if (text[i] === "\\") { out.push(text[i]); i += 1; }
        if (i < n) { out.push(text[i]); i += 1; }
      }
      out.push(quote);
      i += 1;
      continue;
    }
    out.push(c);
    i += 1;
  }
  return out.join("");
}

const LEGACY_SPECIFIER = "[^\"']*consent-nonce-registry[^\"']*";

/// A USE is an import of a legacy module or a call to its writer. Reading via
/// `isConsentNonceUsed` is deliberately NOT a use, and neither is prose.
export function usesLegacyWriter(source) {
  // Imports: comments gone, strings kept, and the full statement shape required
  // so a doc string that merely NAMES the module is not a use.
  const withStrings = stripComments(source);
  if (new RegExp(`\\bimport\\b[^;]*?\\bfrom\\s*["']${LEGACY_SPECIFIER}["']`).test(withStrings)) return true;
  if (new RegExp(`\\bimport\\s*\\(\\s*["']${LEGACY_SPECIFIER}["']`).test(withStrings)) return true;
  // Calls: strings gone too, so a constant holding the writer's name is not a call.
  return new RegExp(`(?<![\\w$])${LEGACY_WRITER}\\s*\\(`).test(stripCommentsAndStrings(source));
}

/// A retired writer's body must contain no filesystem write and must return the
/// retirement marker. Re-derived from the source rather than taken on trust.
export function writerIsRetired(source) {
  const code = stripCommentsAndStrings(source);
  const start = code.indexOf(`function ${LEGACY_WRITER}`);
  if (start === -1) return { retired: false, reason: "writer_not_found" };
  // The body runs to the next top-level `export`, which is how these modules are
  // laid out; a writer that grew past that would be reported rather than missed.
  const rest = code.slice(start);
  const end = rest.indexOf("\nexport ");
  const body = end === -1 ? rest : rest.slice(0, end);
  for (const forbidden of ["writeFile", "mkdir", "rename", "appendFile", "createWriteStream", "writeFileSync"]) {
    if (new RegExp(`(?<![\\w$])${forbidden}\\s*\\(`).test(body)) {
      return { retired: false, reason: `writer_body_calls_${forbidden}` };
    }
  }
  if (!source.includes(RETIRED_MARKER)) return { retired: false, reason: "no_retirement_marker" };
  return { retired: true, reason: null };
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next" || e.name === ".git") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

const read = (p) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };

export function runLegacyConsentAuthorityCheck({ repo = REPO } = {}) {
  const files = LIVE_DIRS.flatMap((d) => walk(join(repo, d)));
  const legacySet = new Set(LEGACY_MODULES);

  const live_callers = files
    .map((f) => relative(repo, f).split("\\").join("/"))
    .filter((rel) => !legacySet.has(rel))
    .filter((rel) => usesLegacyWriter(read(join(repo, rel))));

  const writers = LEGACY_MODULES.map((rel) => {
    const src = read(join(repo, rel));
    return { module: rel, ...(src ? writerIsRetired(src) : { retired: false, reason: "module_unreadable" }) };
  });

  const unretired = writers.filter((w) => !w.retired);
  const ok = live_callers.length === 0 && unretired.length === 0;

  return Object.freeze({
    schema: "bizra.dema.legacy_consent_authority.v0.1",
    ok,
    live_legacy_consent_authority: live_callers.length,
    live_callers: Object.freeze(live_callers),
    writers: Object.freeze(writers),
    files_scanned: files.length,
    scanned_dirs: LIVE_DIRS,
    reads_are_allowed:
      "isConsentNonceUsed and the legacy namespaces stay readable — the canonical claim consults them for REFUSAL",
    what_this_does_not_prove:
      "Does not prove the canonical claim is correct, and does not scan tests/ or scripts/, which legitimately name the retired writers.",
  });
}

function main() {
  const report = runLegacyConsentAuthorityCheck();
  if (JSON_MODE) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("DEMA - LEGACY-CONSENT-AUTHORITY (cutover part 3)");
    console.log(`  LIVE_LEGACY_CONSENT_AUTHORITY: ${report.live_legacy_consent_authority}`);
    for (const c of report.live_callers) console.log(`  !! LIVE CALLER  ${c}`);
    for (const w of report.writers) {
      console.log(`  ${w.retired ? "+ retired" : "!! ACTIVE "}  ${w.module}${w.reason ? ` (${w.reason})` : ""}`);
    }
    console.log(`  scanned ${report.files_scanned} files across ${report.scanned_dirs.join(", ")}`);
    console.log("  Boundary: read-only audit; reads of the superseded stores remain allowed.");
    console.log(`  result: ${report.ok ? "PASS" : "FAIL"}`);
  }
  process.exit(report.ok ? 0 : 1);
}

if (process.argv[1] && process.argv[1].endsWith("legacy-consent-authority-check.mjs")) main();
