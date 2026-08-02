#!/usr/bin/env node
// NODE0-CLAIM-CORPUS-GATE-V0.1
//
// Baseline-ratchet gate over the real claim corpus. The claim-ledger scanner
// (scripts/claim-ledger-check.mjs, wired as `npm run claim:check`) flags
// unlabeled strong claims in prose. Until now nothing ran it across the actual
// docs — so every precision win was a one-shot, not a guarded invariant. This
// gate closes that gap.
//
// Honest by construction. It does NOT assert zero findings: the corpus
// legitimately carries narrative/vision claims. Instead it FREEZES the current
// reviewed state as a committed baseline and fails closed on any NEW finding.
// The count may only ratchet DOWN — a new unlabeled claim fails the gate until
// it is labeled ([MEASURED]/[CITED]/[DECLARED]/[PLANNED]) or the baseline is
// explicitly regenerated via `--update-baseline` (a visible, reviewable act).
// This is "status generated from state, never asserted" applied to claims.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, relative, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  auditMarkdown,
  extractClaimCitations,
} from "../claim-ledger-check.mjs";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const BASELINE_PATH = join(REPO_ROOT, "docs/claims/claim-corpus-baseline.json");
const REGISTER_PATH = join(
  REPO_ROOT,
  "docs/claims/node0-claim-register.v0.1.json",
);
const SCHEMA = "bizra.dema.claim_corpus_gate.v0.1";

// Defined corpus scope: README + top-level docs/*.md + docs/gtm/*.md.
// Other subdirectories (06-adr/, archive/, _absorbed/, …) stay intentionally
// out — expand the scope deliberately, not by an unbounded glob.
//
// docs/gtm/ added 2026-08-02 (DoD §15 box 9). The Claim Register §3 scope is
// "every public-facing surface", and its §24 defers a `claim-lint.mjs` over
// docs/public/** and docs/market/** — but neither directory exists, while
// docs/gtm/ does and is exactly that material: it was the largest public-facing
// surface in the tree with NO claim gate over it at all. Extending this ratchet
// beats a second parallel linter: same scanner, same baseline discipline, one
// gate to keep honest. Whichever of docs/public / docs/market appears later
// joins this list in its own reviewed slice.
const PUBLIC_FACING_SUBDIRS = ["gtm"];

export function corpusFiles(root = REPO_ROOT) {
  const files = [join(root, "README.md")];
  const docsDir = join(root, "docs");
  for (const name of readdirSync(docsDir).sort()) {
    if (name.endsWith(".md")) files.push(join(docsDir, name));
  }
  for (const sub of PUBLIC_FACING_SUBDIRS) {
    let entries;
    try {
      entries = readdirSync(join(docsDir, sub)).sort();
    } catch {
      continue; // not yet created — a future slice adds it
    }
    for (const name of entries) {
      if (name.endsWith(".md")) files.push(join(docsDir, sub, name));
    }
  }
  return files;
}

// Line-independent finding identity: editing a doc shifts line numbers but the
// claim text is stable, so the baseline survives unrelated edits.
export function findingKey(f) {
  return `${f.file}::${f.kind}::${(f.text || "").trim()}`;
}

// --- Claim ↔ knowledge-object provenance (mission step 3) -------------------
// A prose claim may cite its register entry via [claim:<ID>]. The scanner
// credits the citation as provenance; this gate verifies the cited id actually
// resolves to a real register entry — "no provenance without a knowledge
// object". A dangling citation fails closed.

export function registerIds(path = REGISTER_PATH) {
  try {
    const reg = JSON.parse(readFileSync(path, "utf8"));
    return new Set((reg.claims || []).map((c) => c.id).filter(Boolean));
  } catch {
    return new Set();
  }
}

export function scanCitations(files, root = REPO_ROOT) {
  const citations = [];
  for (const abs of files) {
    let body;
    try {
      body = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    const rel = relative(root, abs);
    body.split(/\r?\n/).forEach((line, i) => {
      for (const id of extractClaimCitations(line)) {
        citations.push({ file: rel, line: i + 1, id });
      }
    });
  }
  return citations;
}

export function verifyCitations({ citations, validIds }) {
  const dangling = citations.filter((c) => !validIds.has(c.id));
  return { ok: dangling.length === 0, dangling };
}

export function scanCorpus(files, root = REPO_ROOT) {
  const findings = [];
  for (const abs of files) {
    let body;
    try {
      body = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    const rel = relative(root, abs);
    for (const fnd of auditMarkdown({ file: rel, body }).findings) {
      findings.push({
        file: rel,
        kind: fnd.kind,
        text: (fnd.text || "").trim(),
      });
    }
  }
  return findings;
}

export function evaluateCorpusGate({ current, baseline }) {
  const baseSet = new Set(baseline.map(findingKey));
  const curSet = new Set(current.map(findingKey));
  const added = current.filter((f) => !baseSet.has(findingKey(f)));
  const removed = baseline.filter((f) => !curSet.has(findingKey(f)));
  return { ok: added.length === 0, added, removed };
}

export function loadBaseline(path = BASELINE_PATH) {
  try {
    return JSON.parse(readFileSync(path, "utf8")).findings || [];
  } catch {
    return [];
  }
}

function writeBaseline(current, path = BASELINE_PATH) {
  const sorted = [...current].sort((a, b) =>
    findingKey(a).localeCompare(findingKey(b)),
  );
  const payload = {
    schema: "bizra.dema.claim_corpus_baseline.v0.1",
    note: "Frozen reviewed claim-corpus state. Regenerate only via --update-baseline; every entry is an accepted, unresolved unlabeled-claim finding.",
    count: sorted.length,
    findings: sorted,
  };
  writeFileSync(path, JSON.stringify(payload, null, 2) + "\n");
}

export function main(argv = process.argv.slice(2)) {
  const files = corpusFiles();
  const current = scanCorpus(files);

  if (argv.includes("--update-baseline")) {
    writeBaseline(current);
    console.log(
      `[corpus-gate] baseline updated: ${current.length} findings across ${files.length} files`,
    );
    return 0;
  }

  const baseline = loadBaseline();
  const ratchet = evaluateCorpusGate({ current, baseline });
  const { added, removed } = ratchet;

  // Provenance integrity: every [claim:ID] citation in the corpus must resolve
  // to a real register entry (mission: no provenance without a knowledge object).
  const citations = scanCitations(files);
  const cite = verifyCitations({ citations, validIds: registerIds() });

  const ok = ratchet.ok && cite.ok;

  if (argv.includes("--json")) {
    console.log(
      JSON.stringify(
        {
          schema: SCHEMA,
          ok,
          current: current.length,
          baseline: baseline.length,
          added,
          removed,
          citations: citations.length,
          dangling_citations: cite.dangling,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(
      `[corpus-gate] current=${current.length} baseline=${baseline.length} new=${added.length} resolved=${removed.length}`,
    );
    console.log(
      `[corpus-gate] citations=${citations.length} dangling=${cite.dangling.length}`,
    );
    for (const a of added) {
      console.log(`  NEW  ${a.kind}  ${a.file}: ${a.text.slice(0, 80)}`);
    }
    for (const d of cite.dangling) {
      console.log(`  DANGLING CITATION  ${d.file}:${d.line}  [claim:${d.id}]`);
    }
    if (!ratchet.ok) {
      console.log(
        "\n[corpus-gate] FAIL — new unlabeled claim(s). Label them " +
          "([MEASURED]/[CITED]/[DECLARED]/[PLANNED]/[claim:<REGISTER-ID>]) or, " +
          "if accepted, run `node scripts/claims/claim-corpus-gate.mjs --update-baseline`.",
      );
    }
    if (!cite.ok) {
      console.log(
        "\n[corpus-gate] FAIL — citation(s) reference a register id that does " +
          "not exist. Add the claim to docs/claims/node0-claim-register.v0.1.json " +
          "or fix the citation. No provenance without a knowledge object.",
      );
    }
    if (ok && removed.length > 0) {
      console.log(
        `[corpus-gate] OK — ${removed.length} baseline finding(s) resolved; ` +
          "run --update-baseline to ratchet the baseline down.",
      );
    }
  }
  return ok ? 0 : 1;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exit(main());
}
