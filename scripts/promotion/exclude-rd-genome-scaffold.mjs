#!/usr/bin/env node
/**
 * G6-CANONICAL-PROMOTION-1A · DECLARED EXCLUSION — TASK-080.01 red-first scaffold
 *
 * Operator ruling 2026-08-25: KnownRed ≠ AcceptableGreen. The deliberately-red
 * RD-genome scaffold must not block promotion of unrelated measured slices,
 * and npm test must NOT be weakened to accommodate it. This script therefore
 * removes the scaffold AND its wiring from the CANDIDATE TREE ONLY:
 *
 *   1. packages/core/src/dema-capability-truth-registry.js  (REQUIRED id + row)
 *   2. tests/dema-capability-truth-registry.test.js         (counts 88 -> 87)
 *   3. scripts/check.mjs                                    (gate wiring line)
 *   4. docs/TESTING.md                                      (test + gate rows)
 *   5. docs/CURRENT_LIMITS.md                               (capability row)
 *
 * Idempotent. Never run against the live measured worktree by tests; it exists
 * so the promotion candidate can be exactly "everything measured EXCEPT the
 * open scaffold", with the exclusion itself reviewed and versioned here.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const REWRITE = [
  {
    path: "packages/core/src/dema-capability-truth-registry.js",
    transform(s) {
      s = s.replace(
        '  "NODE0_FATE_STAGED_EFFECT_1A",\n  "NODE0_RD_GENOME_ESTATE_1A",\n',
        '  "NODE0_FATE_STAGED_EFFECT_1A",\n',
      );
      const i = s.indexOf('capability_id: "NODE0_RD_GENOME_ESTATE_1A"');
      if (i >= 0) {
        const start = s.lastIndexOf("capability({", i);
        // Anchor on the LINE-START of the 4-space closer: a bare indexOf would
        // match inside deeper-indented closers (e.g. evidence()'s "      }),")
        // and cut mid-entry, orphaning the fields that follow.
        const closePat = "\n    }),\n";
        const m = s.indexOf(closePat, i);
        if (m < 0) throw new Error("exclusion_capability_close_not_found");
        const end = s.indexOf("\n", m + 1) + 1;
        s = s.slice(0, start) + s.slice(end);
      }
      return s;
    },
  },
  {
    path: "tests/dema-capability-truth-registry.test.js",
    transform(s) {
      return s.split(", 88)").join(", 87)");
    },
  },
  {
    path: "scripts/check.mjs",
    transform(s) {
      return s
        .split("\n")
        .filter((l) => !l.includes("node0-rd-genome-estate-check"))
        .join("\n");
    },
  },
  {
    path: "docs/TESTING.md",
    transform(s) {
      return s
        .split("\n")
        .filter((l) => !l.includes("rd-genome-estate"))
        .join("\n");
    },
  },
  {
    path: "docs/CURRENT_LIMITS.md",
    transform(s) {
      return s
        .split("\n")
        .filter((l) => !l.includes("NODE0_RD_GENOME_ESTATE"))
        .join("\n");
    },
  },
  {
    path: "scripts/review/canonical-json-v1-check.mjs",
    transform(s) {
      // The scaffold registered itself as a canonical-json consumer; with the
      // kernel excluded, leaving the registration would be a real ENOENT in
      // the candidate (T8 adoption-freeze correctly refuses missing files).
      return s
        .split("\n")
        .filter((l) => !l.includes("node0-rd-genome-estate"))
        .join("\n");
    },
  },
];

export function excludeRdGenomeScaffold(cwdFiles = REWRITE) {
  const changed = [];
  for (const { path, transform } of cwdFiles) {
    const before = readFileSync(path, "utf8");
    const after = transform(before);
    if (after !== before) {
      writeFileSync(path, after);
      changed.push(path);
    }
  }
  // Fail closed: after this runs, no scaffold reference may survive anywhere
  // a gate could reach it.
  for (const p of [
    "packages/core/src/dema-capability-truth-registry.js",
    "scripts/check.mjs",
    "tests/dema-capability-truth-registry.test.js",
  ]) {
    if (readFileSync(p, "utf8").includes("RD_GENOME_ESTATE")) {
      throw new Error(`exclusion_incomplete:${p}`);
    }
  }
  return { excluded_files_changed: changed };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const res = excludeRdGenomeScaffold();
  console.log(`rd-genome scaffold excluded from candidate (${res.excluded_files_changed.length} files rewritten)`);
}
