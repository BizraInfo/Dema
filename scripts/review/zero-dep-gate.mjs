#!/usr/bin/env node
// ZERO-DEP GATE (AUDIT P1a · w8amforab) — fail-closed enforcement of the
// zero-dependency invariant.
//
// The repo's load-bearing supply-chain posture is "0 runtime + 0 dev deps".
// Previously this was only snapshot-asserted in release-readiness.test.js; a new
// dependency could land and pass `npm run check` locally. This gate reads
// package.json and exits 1 if dependencies or devDependencies is non-empty, so
// the invariant is enforced in the local check chain, not merely measured.

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

export function evaluateZeroDep(pkg) {
  const runtime_deps = Object.keys(pkg?.dependencies ?? {});
  const dev_deps = Object.keys(pkg?.devDependencies ?? {});
  return Object.freeze({
    schema: "bizra.dema.review.zero_dep_gate.v0.1",
    ok: runtime_deps.length === 0 && dev_deps.length === 0,
    runtime_deps: Object.freeze(runtime_deps),
    dev_deps: Object.freeze(dev_deps),
  });
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const report = evaluateZeroDep(pkg);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    console.error(
      `[zero-dep] FAIL — zero-dependency invariant violated. ` +
        `runtime=[${report.runtime_deps.join(", ")}] dev=[${report.dev_deps.join(", ")}]. ` +
        `Dema must stay zero-dependency; remove the dependency or get an explicit scoped GO.`,
    );
    process.exit(1);
  }
  console.log("[zero-dep] OK — 0 runtime + 0 dev dependencies.");
}
