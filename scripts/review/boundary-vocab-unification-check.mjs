#!/usr/bin/env node
// BOUNDARY-VOCAB-UNIFICATION-1A — registry integrity gate.

import { pathToFileURL } from "node:url";

import {
  BOUNDARY_VOCAB_ADR_ENTRIES,
  BOUNDARY_VOCAB_UNIFICATION_ADR_ID,
  allAdrJustifiedBoundaryKeys,
  verifyBoundarySynonymAnnotations,
} from "../../packages/core/src/boundary-vocab-registry.js";
import {
  PREVIEW_BOUNDARY_CANONICAL_KEYS,
  buildPreviewBoundary,
  isCanonicalBoundary,
} from "../../packages/core/src/boundary-schema.js";

const JSON_MODE = process.argv.includes("--json");

function sorted(keys) {
  return [...keys].sort();
}

export function runBoundaryVocabUnificationCheck() {
  const blocked_by = [];

  if (!Object.isFrozen(PREVIEW_BOUNDARY_CANONICAL_KEYS)) {
    blocked_by.push("canonical_keys_not_frozen");
  }

  const boundary = buildPreviewBoundary();
  if (!isCanonicalBoundary(boundary)) {
    blocked_by.push("canonical_boundary_invalid");
  }

  if (BOUNDARY_VOCAB_UNIFICATION_ADR_ID !== "ADR-BOUNDARY-VOCAB-UNIFICATION-1A") {
    blocked_by.push("adr_id_mismatch");
  }

  const canonicalEntries = BOUNDARY_VOCAB_ADR_ENTRIES.filter(
    (e) => e.classification === "CANONICAL",
  );
  if (canonicalEntries.length !== 1) {
    blocked_by.push("canonical_adr_entry_count_invalid");
  } else if (
    sorted(canonicalEntries[0].keys).join("|") !==
    sorted(PREVIEW_BOUNDARY_CANONICAL_KEYS).join("|")
  ) {
    blocked_by.push("canonical_adr_keys_mismatch");
  }

  const allowed = new Set(allAdrJustifiedBoundaryKeys());
  for (const entry of BOUNDARY_VOCAB_ADR_ENTRIES) {
    if (!entry.rationale || entry.keys.length === 0) {
      blocked_by.push(`adr_entry_incomplete:${entry.id}`);
    }
    for (const key of entry.keys) {
      if (!allowed.has(key)) {
        blocked_by.push(`undocumented_key:${entry.id}:${key}`);
      }
    }
  }

  blocked_by.push(...verifyBoundarySynonymAnnotations());

  return Object.freeze({
    ok: blocked_by.length === 0,
    adr_id: BOUNDARY_VOCAB_UNIFICATION_ADR_ID,
    canonical_key_count: PREVIEW_BOUNDARY_CANONICAL_KEYS.length,
    adr_entry_count: BOUNDARY_VOCAB_ADR_ENTRIES.length,
    blocked_by: Object.freeze(blocked_by),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runBoundaryVocabUnificationCheck();
  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA - boundary vocab unification");
    console.log(`  adr: ${result.adr_id}`);
    console.log(`  canonical_keys: ${result.canonical_key_count}`);
    console.log(`  adr_entries: ${result.adr_entry_count}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by) console.log(`    ${code}`);
    }
  }
  if (!result.ok) process.exit(1);
}
