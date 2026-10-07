// NODE0-TRANSITION-COVERAGE-1A — the producer.
//
//   node scripts/proof/node0-transition-coverage-proof.mjs [--dema-home <p>] [--json]
//
// It RE-DERIVES each counterexample from source rather than asserting it:
// for every declared authoritative domain it reads the writer, checks whether
// the canonical receipt call appears anywhere in it, and — the control that makes
// the absence mean something — proves that same mechanism IS called elsewhere in
// the tree. Without that control, "no receipt here" is indistinguishable from
// "this tree receipts nothing".
//
// ── WHY DETECTION IS A CALL SCAN AND NOT A SUBSTRING TEST (repair 2026-08-10) ──
//
// Both questions above were previously answered with `source.includes(name)`.
// Measured against this producer at 36200ce, that failed in both directions:
//
//   ERASURE. Appending one comment to the writer —
//     `// NOTE: this generation transition does not yet call appendCanonicalReceipt.`
//   — set `receipt_call_present` true, dropped the counterexample, and moved
//   `receipt_per_transition` from VIOLATED to UNKNOWN in the canonical ledger.
//   A comment asserting the transition is UNRECEIPTED deleted the proof that it
//   is unreceipted. Prose must never be able to retract a measured refutation.
//
//   A CONTROL THAT STOPPED CONTROLLING. The caller control reported five files
//   on the unmodified tree; only two were call sites. `mission-corridor-closure.js`
//   mentions the mechanism in a comment, `canonical-ledger.js` DECLARES it, and
//   this producer holds the name in a string constant. Had the two real calls
//   ever been removed, three non-uses would have kept the control reading true.
//
// So both sides now scan CODE: comments, string and template literals are removed,
// declarations are excluded (defining a mechanism is not using it), and the name
// must appear as a call at an identifier boundary. This changes no schema, no
// kernel, and no hash input — the kernel still judges what it is handed.
//
// BOUNDARY: read-only over the repository plus one artefact write under the given
// DEMA_HOME. No network, no model, no spawn, no key material.

import { mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { sha256CanonicalJsonV1 } from "../../packages/canon/src/sha256-canonical-json-v1.js";
import { buildTransitionCoverageObservation } from "../../packages/core/src/node0-transition-coverage.js";
import { currentCoverageKernelHash, TRANSITION_COVERAGE_ARTEFACT_RELPATH } from "../../packages/core/src/node0-transition-coverage-adapter.js";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const argv = process.argv.slice(2);
const JSON_MODE = argv.includes("--json");
const hi = argv.indexOf("--dema-home");
const DEMA_HOME = hi !== -1 ? argv[hi + 1] : mkdtempSync(join(tmpdir(), "node0-coverage-"));

const RECEIPT_MECHANISM = "appendCanonicalReceipt";

/// The authoritative domains established by AUTHORITATIVE-TRANSITION-DOMAIN-REGISTRY.
/// Declared here as WHAT TO MEASURE; whether each is a violation is measured below.
const DOMAINS = Object.freeze([
  Object.freeze({
    domain_id: "authorship_identity_rotation",
    writer: "packages/receipts/src/authorship-key-store.js",
    transition: "rotateAuthorshipKey: active generation retired, successor installed",
    authority_source: "operator consent via `dema authorship rotate`",
    consumer_symbol: "authorship-key-store|active-key.json|loadActiveKey|readActiveKey",
  }),
  Object.freeze({
    domain_id: "consent_nonce_consumption",
    // CUTOVER 2026-08-10: the authoritative writer is now the CANONICAL claim,
    // not the superseded registry. Canon is explicit that this domain is
    // receipted BY CONSTRUCTION - "Existence of this file IS consumption. There
    // is NO second consumed record" - so requiring appendCanonicalReceipt here
    // would contradict the module the invariant is meant to protect. The claim
    // record is content-addressed (claim_hash) and that IS the evidence.
    writer: "packages/receipts/src/consent-nonce-claim.js",
    transition: "nonce claimed: future replay of the same consent proof is denied",
    authority_source: "KEYCONSENT-1A consent proof",
    consumer_symbol: "consent-nonce-claim|claimConsentNonce|inspectConsentNonce",
    self_evidencing: "claim_hash",
  }),
]);

/**
 * Blank every comment, string and template literal, leaving code in place.
 *
 * Written as one pass rather than a chain of replaces because the chain has no
 * safe order: strip strings first and an apostrophe in `// don't` opens a
 * literal that swallows the next line; strip comments first and the `//` inside
 * `"https://x"` eats the rest of that line. A scanner that knows which state it
 * is in has neither failure.
 *
 * ponytail: does not track regex literals, so `/["']/` could still mislead it.
 * No authoritative writer in this tree contains one; upgrade to a real lexer if
 * that stops being true.
 */
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

const boundedToken = (name) => `(?<![\\w$])${name}(?![\\w$])`;

/**
 * True when `name` is CALLED in this source. A declaration is removed first:
 * `canonical-ledger.js` defines the mechanism and never uses it, and counting a
 * definition as a use would let a tree where nothing receipts anything still
 * satisfy the "mechanism exists elsewhere" control.
 */
export function callsMechanism(source, name) {
  const code = stripCommentsAndStrings(source)
    .replace(new RegExp(`\\bfunction\\s+${name}\\s*\\(`, "g"), " ");
  return new RegExp(`${boundedToken(name)}\\s*\\(`).test(code);
}

/**
 * True when `name` appears in CODE — for domains whose own record IS the
 * receipt, where the evidence is a real field rather than a call. Same reason as
 * above: a comment naming the field is not the field.
 */
export function mentionsTokenInCode(source, name) {
  return new RegExp(boundedToken(name)).test(stripCommentsAndStrings(source));
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

function main() {
const FILES = ["packages", "apps", "bin", "scripts"].flatMap((d) => walk(join(REPO, d)));

// THE CONTROL: the canonical receipt mechanism must be CALLED somewhere, or an
// absence proves nothing about any individual writer. Scanned as code — a file
// that only names the mechanism in a comment, a string, or its own declaration
// is not a user of it, and counting one would let the control read true in a
// tree where the last real call had been deleted.
const mechanismCallers = FILES.filter((f) => callsMechanism(read(f), RECEIPT_MECHANISM)).map((f) => relative(REPO, f));
const mechanismExistsElsewhere = mechanismCallers.length > 0;

const counterexamples = DOMAINS.map((d) => {
  const src = read(join(REPO, d.writer));
  // Two ways a domain can be receipted: it calls the canonical mechanism, or its
  // own record IS the evidence (content-addressed, no second record by canon).
  // Both are read from code: a comment claiming either is not either.
  const selfEvidenced = Boolean(d.self_evidencing) && mentionsTokenInCode(src, d.self_evidencing);
  const receipt_call_present = callsMechanism(src, RECEIPT_MECHANISM) || selfEvidenced;
  const consumers = FILES.filter((f) => {
    const rel = relative(REPO, f);
    if (rel === d.writer) return false;
    return new RegExp(d.consumer_symbol).test(stripCommentsAndStrings(read(f)));
  }).length;
  return {
    ...d,
    classification: "AUTHORITATIVE",
    consumers_count: consumers,
    receipt_call_present,
    receipt_mechanism: selfEvidenced ? `self-evidencing:${d.self_evidencing}` : RECEIPT_MECHANISM,
    receipt_mechanism_exists_elsewhere: mechanismExistsElsewhere && !mechanismCallers.includes(d.writer),
    verified_by: "independent_source_trace",
  };
});

const observation = buildTransitionCoverageObservation({
  registry: {
    // Two domains remain open (BIZRA_MUMU_ROOT, gateway chain), so the registry is
    // NOT complete — which blocks SATISFIED and, by design, changes nothing about
    // a proven counterexample.
    unclassified_count: 2,
    authoritative_domains: DOMAINS.length,
    receipted_domains: counterexamples.filter((c) => c.receipt_call_present).length,
  },
  counterexamples,
  evidenceClass: "OBSERVED",
  observedAt: new Date().toISOString(),
  executedCodeHash: currentCoverageKernelHash(),
  hash: sha256CanonicalJsonV1,
});

const artefact = join(DEMA_HOME, TRANSITION_COVERAGE_ARTEFACT_RELPATH);
mkdirSync(dirname(artefact), { recursive: true });
writeFileSync(artefact, `${JSON.stringify(observation, null, 2)}\n`);

const report = {
  schema: "bizra.dema.node0_transition_coverage_proof.v0.1",
  dema_home: DEMA_HOME,
  artefact,
  coverage_verdict: observation.coverage_verdict,
  observed: observation.observed,
  proven_counterexamples: observation.counterexample_domains,
  rejected_counterexample_count: observation.rejected_counterexample_count,
  control_receipt_mechanism_callers: mechanismCallers,
  files_scanned: FILES.length,
  observation_hash: observation.observation_hash,
  what_this_does_not_prove:
    "Does not prove the registry is complete (two domains remain open), and does not prove any OTHER domain is receipted. It proves that at least one authoritative transition occurs without the canonical receipt.",
};
if (JSON_MODE) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`verdict:   ${report.coverage_verdict}   observed=${report.observed}`);
  console.log(`proven:    ${report.proven_counterexamples.join(", ")}`);
  console.log(`control:   ${RECEIPT_MECHANISM} called by ${mechanismCallers.length} file(s) - ${mechanismCallers.join(", ")}`);
  console.log(`scanned:   ${report.files_scanned} files`);
  console.log(`artefact:  ${artefact}`);
}
}

// Importable for its detector, runnable as the producer. Without this guard the
// tests that pin the detector would walk the repo and write an artefact just by
// importing the module.
if (process.argv[1] && process.argv[1].endsWith("node0-transition-coverage-proof.mjs")) main();
