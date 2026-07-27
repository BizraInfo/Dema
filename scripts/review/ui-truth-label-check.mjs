#!/usr/bin/env node
/**
 * UI truth-label gate — read-only source audit.
 *
 * Found 2026-07-25: `AutopoieticLoop.tsx` rendered `● LIVE` driven by a client-side
 * boolean toggle, for a capability canon holds as DESIGNED_NOT_LIVE. The label existed
 * in `lib/game/data.ts` but never reached the screen.
 *
 * A truth label the user cannot see is a comment, not a disclosure. This gate fails
 * the build when a component renders a liveness word for a capability that is not live.
 *
 * It does NOT ban the words — a genuinely live surface may say LIVE. It bans them in
 * components tied to a not-live capability, and requires those components to render a
 * TruthLabelBadge.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
// `--ui-root <dir>` exists so the gate can be pointed at a fixture. Without it a
// test could only assert "exit 0 on the real tree", which passes just as well
// when the gate is broken — a check that cannot be made to fail proves nothing.
const rootArg = process.argv.indexOf("--ui-root");
const UI_ROOT =
  rootArg !== -1 && process.argv[rootArg + 1]
    ? process.argv[rootArg + 1]
    : join(REPO, "packages/dema-ui/src/components");

/** Capabilities canon holds as not-live. Components named for these must not claim liveness. */
const NOT_LIVE_COMPONENTS = Object.freeze([
  "AutopoieticLoop",
  "VerificationMesh",
  "EvolutionGraph",
  "EcosystemView",
  "WorldMap",
  "ProofRailDashboard",
  "AgentPanel",
  "AgentDetailDialog",
]);

/** Rendered liveness claims — matched inside JSX text/string literals only. */
const LIVENESS_CLAIM = /(?:^|[\s"'>({[])(?:●\s*)?(LIVE|RUNNING|ACTIVE NOW|ONLINE)(?:[\s"'<)}\],]|$)/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git" || entry === ".next") continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (entry.endsWith(".tsx")) out.push(path);
  }
  return out;
}

const findings = [];
const scanned = [];

for (const file of walk(UI_ROOT)) {
  const rel = relative(REPO, file);
  const base = file.split("/").pop().replace(/\.tsx$/, "");
  if (!NOT_LIVE_COMPONENTS.includes(base)) continue;
  scanned.push(rel);

  const source = readFileSync(file, "utf8");
  const lines = source.split("\n");

  lines.forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, "");
    if (code.trimStart().startsWith("*") || code.trimStart().startsWith("/*")) return;
    // Deliberately `.match()`: the actuator gate matches a bare substring and
    // cannot distinguish a RegExp method call from a shell-spawning one.
    const m = code.match(LIVENESS_CLAIM);
    if (m) {
      findings.push({
        file: rel,
        line: i + 1,
        label: "ui.liveness_claim_on_not_live_capability",
        match: m[1],
      });
    }
  });

  // A component is labeled if it renders the badge directly OR passes a `truth`
  // prop to a primitive that renders one (Panel / SceneHeader). Checking only for
  // the literal "TruthLabelBadge" would flag correctly-labeled components — the
  // gate must test the behaviour, not the spelling.
  const rendersBadge = source.includes("<TruthLabelBadge");
  const passesTruthProp = /\btruth=["{]/.test(source);
  if (!rendersBadge && !passesTruthProp) {
    findings.push({
      file: rel,
      line: 1,
      label: "ui.missing_truth_label_badge",
      match: base,
    });
  }
}

const report = {
  schema: "bizra.dema.review.ui_truth_label.v0.1",
  ok: findings.length === 0,
  scanned_components: scanned.sort(),
  not_live_components: [...NOT_LIVE_COMPONENTS].sort(),
  findings,
  boundary: {
    read_only_audit: true,
    runtime_execution_performed: false,
    network_used: false,
  },
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
