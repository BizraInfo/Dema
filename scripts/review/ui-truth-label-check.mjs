#!/usr/bin/env node
// UI-TRUTH-LABEL-GATE-1A — read-only review check.
//
// Fails when the onboarding ceremony teaches the wrong agent architecture.
//
// Why this exists: `packages/dema-ui/src/lib/game/ecosystem.ts` carried an
// accurate disclaimer in its header — "NOT the 12-role BIZRA agent fleet …
// does not compete with it as an authoritative source" — and the ceremony
// rendered that very roster anyway, under constitutional language ("Each has a
// SOUL and a boundary. They work for you; never the reverse"). The honest label
// existed in the source and was never rendered to the screen. Nothing caught it,
// because no gate reads the UI's claims.
//
// A source comment is not a truth label. A truth label is what the human sees.
//
// This gate is read-only: it reads source files and asserts nothing else.

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const SCHEMA = "bizra.dema.review.ui_truth_label.v0.1";

const UI = "packages/dema-ui/src";
const ECOSYSTEM = `${UI}/lib/game/ecosystem.ts`;
const FLEET_CANON = `${UI}/lib/game/fleet-canon.ts`;
const BOOT = `${UI}/components/game/SovereignBoot.tsx`;
const KERNEL = "packages/core/src/node0-agent-fleet-roles.js";

// Language that asserts a constitutional relationship rather than describing a
// simulation. Any beat carrying these must be showing the real fleet.
const CONSTITUTIONAL_PHRASES = Object.freeze([
  "work for you; never the reverse",
  "each has a soul and a boundary",
  "never certifies itself",
  "never secretly does your work",
]);

// Phrases that mark a surface as a simulation. A non-fleet roster must carry one.
const SIMULATION_MARKERS = Object.freeze([
  "not the fleet",
  "simulation",
  "no role contracts",
]);

function read(root, rel) {
  const abs = join(root, rel);
  return existsSync(abs) ? readFileSync(abs, "utf8") : null;
}

// The kernel is the authority; the UI mirror must not drift from it.
function fleetRoleIds(text) {
  return [...text.matchAll(/"((?:pat|sat)-\d+-[a-z-]+)"/g)].map((m) => m[1]);
}

export function evaluateUiTruthLabel({ repoRoot = REPO_ROOT } = {}) {
  const findings = [];
  let report_office_size = null;
  const files = { ECOSYSTEM, FLEET_CANON, BOOT, KERNEL };
  const text = {};
  for (const [name, rel] of Object.entries(files)) {
    const t = read(repoRoot, rel);
    if (t === null) findings.push(`missing_file:${rel}`);
    text[name] = t ?? "";
  }
  if (findings.length > 0) {
    return Object.freeze({ schema: SCHEMA, ok: false, findings: Object.freeze(findings) });
  }

  // 1 — the UI fleet mirror must match the kernel role ids exactly, in order.
  const kernelRoles = [...new Set(fleetRoleIds(text.KERNEL))];
  const uiRoles = [...new Set(fleetRoleIds(text.FLEET_CANON))];
  if (kernelRoles.length !== 12) findings.push(`kernel_fleet_not_12:${kernelRoles.length}`);
  if (uiRoles.join(",") !== kernelRoles.join(",")) {
    findings.push(`ui_fleet_drifted_from_kernel: ui=[${uiRoles.join(",")}] kernel=[${kernelRoles.join(",")}]`);
  }

  // 2 — the ceremony must render the canonical roster, not only the office one.
  //     Importing AGENTS from data.ts is what binds it to fleet-canon.
  if (!/\bAGENTS\b/.test(text.BOOT) || !/from "@\/lib\/game\/data"/.test(text.BOOT)) {
    findings.push("ceremony_does_not_render_canonical_fleet: SovereignBoot must import AGENTS from lib/game/data");
  }

  // 3 — beats must be addressed by id, not by index. Index-addressing is how the
  //     office roster silently took over the fleet beat when a step moved.
  if (/\bstep === \d/.test(text.BOOT)) {
    findings.push("ceremony_beat_addressed_by_index: use cur.id === \"<beat>\", not step === <n>");
  }

  // 4 — any ceremony beat naming the office roster must carry a simulation
  //     marker, and must NOT carry constitutional language.
  const officeBeat = text.ECOSYSTEM.match(/id: "office"[\s\S]*?\},/);
  if (!officeBeat) {
    findings.push("office_beat_absent: the non-fleet roster needs its own labeled beat");
  } else {
    const beat = officeBeat[0].toLowerCase();
    if (!SIMULATION_MARKERS.some((m) => beat.includes(m))) {
      findings.push(`office_beat_unlabeled: must contain one of [${SIMULATION_MARKERS.join(", ")}]`);
    }
    for (const phrase of CONSTITUTIONAL_PHRASES) {
      if (beat.includes(phrase)) findings.push(`office_beat_claims_constitution:${phrase}`);
    }
  }

  // 5 — the fleet beat must exist and must state the PAT/SAT trust boundary.
  const fleetBeat = text.ECOSYSTEM.match(/id: "fleet"[\s\S]*?\},/);
  if (!fleetBeat) {
    findings.push("fleet_beat_absent: onboarding must teach the canonical roster");
  } else {
    const beat = fleetBeat[0].toLowerCase();
    if (!beat.includes("never certifies itself")) findings.push("fleet_beat_missing_pat_boundary");
    if (!beat.includes("never secretly does your work")) findings.push("fleet_beat_missing_sat_boundary");
    if (!beat.includes("designed_not_live")) findings.push("fleet_beat_missing_truth_label");
  }

  // 6 — the office roster must not silently grow into fleet size. Eleven job
  //     functions is fine; twelve invites confusion with the role contracts.
  //     Scoped to the ORG_AGENTS array — an unscoped id scan also swallows
  //     OATH_STEPS and reports a nonsense total.
  const orgBlock = text.ECOSYSTEM.match(/export const ORG_AGENTS[\s\S]*?\n\];/);
  if (!orgBlock) {
    findings.push("org_agents_array_not_found");
  } else {
    // Shape-tolerant on purpose: a line-anchored regex missed a single-line
    // entry, so a 12th office agent could be added without tripping the count.
    const orgIds = [...orgBlock[0].matchAll(/\bid:\s*"([a-z]+)"/g)].map((m) => m[1]);
    if (orgIds.length >= 12) {
      findings.push(`office_roster_fleet_sized:${orgIds.length} — a non-fleet roster must not be 12+`);
    }
    report_office_size = orgIds.length;
  }

  return Object.freeze({
    schema: SCHEMA,
    ok: findings.length === 0,
    kernel_fleet_roles: Object.freeze(kernelRoles),
    ui_fleet_roles: Object.freeze(uiRoles),
    office_roster_size: report_office_size,
    findings: Object.freeze(findings),
    boundary: Object.freeze({
      read_only_audit: true,
      runtime_execution: false,
      mutation_performed: false,
      network_used: false,
    }),
  });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const i = process.argv.indexOf("--repo-root");
  const report = evaluateUiTruthLabel(i === -1 ? {} : { repoRoot: process.argv[i + 1] });
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    console.error(
      `[ui-truth-label] FAIL — ${report.findings.length} finding(s). ` +
        `A source comment is not a truth label; the human must see it on screen.`,
    );
    process.exit(1);
  }
  console.log(`[ui-truth-label] OK — fleet mirrors the kernel (${report.kernel_fleet_roles.length} roles); ceremony teaches it.`);
}
