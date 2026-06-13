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

import { auditMarkdown } from "../claim-ledger-check.mjs";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const BASELINE_PATH = join(REPO_ROOT, "docs/claims/claim-corpus-baseline.json");
const SCHEMA = "bizra.dema.claim_corpus_gate.v0.1";

// Defined corpus scope for v0.1: README + top-level docs/*.md. Subdirectories
// (06-adr/, archive/, _absorbed/, …) are intentionally out — expand the scope
// deliberately, not by an unbounded glob.
export function corpusFiles(root = REPO_ROOT) {
  const files = [join(root, "README.md")];
  const docsDir = join(root, "docs");
  for (const name of readdirSync(docsDir).sort()) {
    if (name.endsWith(".md")) files.push(join(docsDir, name));
  }
  return files;
}

// Line-independent finding identity: editing a doc shifts line numbers but the
// claim text is stable, so the baseline survives unrelated edits.
export function findingKey(f) {
  return `${f.file}::${f.kind}::${(f.text || "").trim()}`;
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
  const { ok, added, removed } = evaluateCorpusGate({ current, baseline });

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
        },
        null,
        2,
      ),
    );
  } else {
    console.log(
      `[corpus-gate] current=${current.length} baseline=${baseline.length} new=${added.length} resolved=${removed.length}`,
    );
    for (const a of added) {
      console.log(`  NEW  ${a.kind}  ${a.file}: ${a.text.slice(0, 80)}`);
    }
    if (!ok) {
      console.log(
        "\n[corpus-gate] FAIL — new unlabeled claim(s). Label them " +
          "([MEASURED]/[CITED]/[DECLARED]/[PLANNED]) or, if accepted, run " +
          "`node scripts/claims/claim-corpus-gate.mjs --update-baseline`.",
      );
    } else if (removed.length > 0) {
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
