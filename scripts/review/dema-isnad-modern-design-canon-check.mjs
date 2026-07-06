#!/usr/bin/env node
// DEMA-ISNAD-MODERN-TUI-DESIGN-CANON-1A — review gate (READ-ONLY · DOCS-ONLY).
//
//   node scripts/review/dema-isnad-modern-design-canon-check.mjs [--json]
//
// Verifies the Isnad Modern design-canon docs carry the enforced doctrine markers and the required
// cockpit UX sections, and make NO implementation / live-runtime / mint / URP / federation claim.
// It reads three docs and builds nothing — no runtime, no network, no mutation.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const DEMA_ISNAD_MODERN_DESIGN_CANON_SCHEMA = "bizra.dema.isnad_modern_design_canon.v0.1";
export const DEMA_ISNAD_MODERN_DESIGN_CANON_TRUTH_LABEL = "DESIGN_CANON_DOCS_ONLY";

const DESIGN_SYSTEM_DOC = "docs/design/DEMA_ISNAD_MODERN_DESIGN_SYSTEM_v0_1.md";
const TUI_BLUEPRINT_DOC = "docs/design/DEMA_TUI_HOMEBASE_BLUEPRINT_v0_1.md";
const RECEIPT_DOC = "docs/receipts/DEMA_ISNAD_MODERN_TUI_DESIGN_CANON_1A.md";

// The enforced doctrine spine — every marker must appear verbatim in the design-system doc.
export const REQUIRED_MARKERS = Object.freeze([
  "ZERO-EXTERNAL-REQUEST",
  "GOLD ONLY WHERE PROOF EXISTS",
  "EVERY NUMBER WEARS AN EVIDENCE CHIP",
  "ARABIC IS FIRST-CLASS",
  "CONSENT IS NEVER MYSTERIOUS",
  "ERRORS ARE NEVER MYSTERIOUS",
  "PROOF STATUS IS NEVER HIDDEN",
  "DOCS-ONLY · NO RUNTIME",
]);

// Every cockpit UX contract must be specified in the blueprint.
export const REQUIRED_SECTIONS = Object.freeze([
  "Dynamic slash-command UX",
  "Prompt library UX",
  "Prompt-chain UX",
  "File / input-context UX",
  "Receipt rail UX",
  "Mission cockpit UX",
  "Proof Room UX",
]);

// Affirmative overclaims that must never appear in a docs-only canon (negations like "no live
// runtime" / "no GUI/TUI implementation" deliberately do NOT match these).
export const FORBIDDEN_CLAIMS = Object.freeze([
  [/\bruntime shipped\b/i, "runtime shipped claim"],
  [/\b(GUI|TUI) implemented\b/i, "gui/tui implemented claim"],
  [/\bmint(ing)? (is )?(live|enabled)\b/i, "mint-live claim"],
  [/\bURP (is )?live\b/i, "urp-live claim"],
  [/\bfederation (is )?live\b/i, "federation-live claim"],
  [/\bproduction[- ]ready\b/i, "production-ready claim"],
]);

// Pure assessment over the doc texts — no fs, injectable for tests.
export function assessDesignCanon({ designSystem, blueprint, receipt } = {}) {
  const blocked_by = [];
  const has = (x) => typeof x === "string" && x.length > 0;

  if (!has(designSystem)) blocked_by.push("design_system_doc_missing");
  if (!has(blueprint)) blocked_by.push("blueprint_doc_missing");
  if (!has(receipt)) blocked_by.push("receipt_doc_missing");

  if (has(designSystem)) {
    for (const marker of REQUIRED_MARKERS) {
      if (!designSystem.includes(marker)) blocked_by.push(`missing_marker:${marker}`);
    }
  }
  if (has(blueprint)) {
    for (const section of REQUIRED_SECTIONS) {
      if (!blueprint.includes(section)) blocked_by.push(`missing_section:${section}`);
    }
  }

  const corpus = [designSystem, blueprint, receipt].filter(has).join("\n");
  for (const [re, label] of FORBIDDEN_CLAIMS) {
    if (re.test(corpus)) blocked_by.push(`forbidden_claim:${label}`);
  }

  return Object.freeze({
    schema: DEMA_ISNAD_MODERN_DESIGN_CANON_SCHEMA,
    truth_label: DEMA_ISNAD_MODERN_DESIGN_CANON_TRUTH_LABEL,
    docs_only: true,
    ok: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

function readDoc(rel) {
  try {
    return readFileSync(join(process.cwd(), rel), "utf8");
  } catch {
    return "";
  }
}

export function runDemaIsnadModernDesignCanonCheck() {
  return assessDesignCanon({
    designSystem: readDoc(DESIGN_SYSTEM_DOC),
    blueprint: readDoc(TUI_BLUEPRINT_DOC),
    receipt: readDoc(RECEIPT_DOC),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runDemaIsnadModernDesignCanonCheck();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA - DEMA-ISNAD-MODERN-TUI-DESIGN-CANON-1A (docs-only, no runtime)");
    console.log(`  schema: ${DEMA_ISNAD_MODERN_DESIGN_CANON_SCHEMA}`);
    console.log(`  truth:  ${DEMA_ISNAD_MODERN_DESIGN_CANON_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    for (const code of result.blocked_by) console.log(`    ${code}`);
  }
  if (!result.ok) process.exit(1);
}
