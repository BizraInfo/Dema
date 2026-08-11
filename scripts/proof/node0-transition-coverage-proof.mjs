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

/// Write calls whose first argument names the target path.
const WRITE_CALL =
  /(?<![\w$])(writeFileSync|appendFileSync|mkdirSync|rmSync|unlinkSync|copyFileSync|renameSync|createWriteStream)\s*\(/g;

/// The first argument of each write call, as source text. Balanced-paren aware so
/// `join(outDir, rel)` is captured whole rather than truncated at its first comma.
function writeTargets(code) {
  const targets = [];
  for (const m of code.matchAll(WRITE_CALL)) {
    let i = m.index + m[0].length;
    let depth = 1;
    let buf = "";
    while (i < code.length && depth > 0) {
      const c = code[i];
      if (c === "(") depth += 1;
      else if (c === ")") { depth -= 1; if (depth === 0) break; }
      if (depth === 1 && c === ",") break;
      buf += c;
      i += 1;
    }
    targets.push(buf.trim());
  }
  return targets;
}

/**
 * True when some WRITE in this source targets a path derived from `rootIdent`.
 *
 * This is how a "root" is told apart from a "scope": a directory the tool only
 * reads is an input, and a directory it writes into is state. Scanned as code so
 * a comment or string mentioning the root cannot manufacture a write — the same
 * law `callsMechanism` enforces, for the same reason.
 */
export function writesUnderRoot(source, rootIdent) {
  const code = stripCommentsAndStrings(source);
  const ref = new RegExp(boundedToken(rootIdent));
  return writeTargets(code).some((t) => ref.test(t));
}

/**
 * True when this source issues a state-changing HTTP call.
 *
 * The method literal is read from the ORIGINAL text, because here the string IS
 * the payload — `method: "POST"` is the evidence, and stripping strings would
 * erase exactly what is being measured. That is the opposite of the receipt-call
 * scan and deliberately so: there the string was camouflage, here it is the fact.
 */
export function hasMutatingHttpCall(source) {
  return /(?<![\w$])method\s*:\s*["'`]?(POST|PUT|PATCH|DELETE)/i.test(source);
}

/**
 * The domains the registry carried as UNDETERMINED, each with the measurement
 * that decides it and the CONTROL that makes a negative answer mean something.
 *
 * `control` must hold before `settled` is consulted. Without that ordering a
 * source the reader cannot see — empty, missing, renamed — would answer "no
 * writes" and "no mutating calls" and classify itself, which is how a
 * completeness count gets driven to zero by breaking the reader rather than by
 * measuring the tree.
 */
export const OPEN_DOMAINS = Object.freeze([
  Object.freeze({
    domain_id: "bizra_mumu_root",
    writer: "scripts/node0-mumu-loop.mjs",
    question: "authoritative state root, or read-only scan scope?",
    classification: "SCAN_SCOPE",
    // Control: the tool must actually write somewhere, or "writes nothing to the
    // root" is trivially true of a file that writes nothing at all.
    control: (src) => /(?<![\w$])(writeFileSync|appendFileSync|mkdirSync)\s*\(/.test(
      stripCommentsAndStrings(src)),
    settled: (src) => !writesUnderRoot(src, "root"),
    evidence: (src) =>
      `${writeTargets(stripCommentsAndStrings(src)).length} write target(s), none derived from the scan root`,
  }),
  Object.freeze({
    domain_id: "gateway_chain",
    writer: "packages/node-adapter/src/gateway-http-adapter.js",
    question: "does local code advance the gateway chain?",
    classification: "EXTERNAL_AUTHORITATIVE",
    // Control: it must genuinely speak HTTP, or "issues no mutating call" is
    // true of every file in the tree that never opens a socket.
    control: (src) => /(?<![\w$])fetch\s*\(/.test(stripCommentsAndStrings(src)),
    settled: (src) => !hasMutatingHttpCall(src),
    evidence: () => "HTTP client present; every call is a read (no POST/PUT/PATCH/DELETE)",
  }),
]);

/**
 * Classify each open domain from source. A domain is determined only when its
 * control holds AND its settling measurement passes; anything else stays
 * unclassified, which the kernel scores as REGISTRY_INCOMPLETE.
 */
export function classifyOpenDomains({ readSource }) {
  const determined = [];
  const undetermined = [];
  for (const d of OPEN_DOMAINS) {
    let src;
    try {
      src = readSource(d.writer);
    } catch (err) {
      undetermined.push({ domain_id: d.domain_id, reason: `unreadable:${err?.code ?? "unknown"}` });
      continue;
    }
    if (typeof src !== "string" || !d.control(src)) {
      undetermined.push({ domain_id: d.domain_id, reason: "control_absent" });
      continue;
    }
    if (!d.settled(src)) {
      undetermined.push({ domain_id: d.domain_id, reason: "measurement_refuted_classification" });
      continue;
    }
    determined.push({
      domain_id: d.domain_id,
      writer: d.writer,
      question: d.question,
      classification: d.classification,
      evidence: d.evidence(src),
      verified_by: "independent_source_trace",
    });
  }
  return {
    determined: Object.freeze(determined),
    undetermined: Object.freeze(undetermined),
    unclassified_count: undetermined.length,
  };
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

// The two domains the registry carried as open are now MEASURED rather than
// asserted. This number was a literal `2` with a comment naming them; a literal
// cannot become true by being edited, and editing it to `0` would have moved the
// canonical ledger without observing anything. It is derived here, and each
// domain's negative answer is gated behind a control so an unreadable writer
// stays unclassified instead of classifying itself.
const openRegistry = classifyOpenDomains({
  readSource: (rel) => readFileSync(join(REPO, rel), "utf8"),
});

const observation = buildTransitionCoverageObservation({
  registry: {
    unclassified_count: openRegistry.unclassified_count,
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
  open_domains_determined: openRegistry.determined,
  open_domains_undetermined: openRegistry.undetermined,
  what_this_does_not_prove:
    "Does not prove any domain outside the declared registry is receipted, and does not prove the two newly classified domains are harmless for any purpose other than transition-receipt coverage. Classification is a source trace over the writers named here; a writer that changes must be re-measured.",
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
