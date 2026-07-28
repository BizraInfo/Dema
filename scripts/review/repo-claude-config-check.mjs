#!/usr/bin/env node
// CONFIG-SLICE-A — repo Claude harness tracking gate.
//
// Proves the stable repo harness (.claude/ rules, agents, skills, hooks,
// settings.json) stays reviewable in git while volatile or machine-local
// state stays off-tree. Read-only: inspects .gitignore, the index, and
// tracked file contents. No network, no runtime, no model invocation.

import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { hasSecretPattern } from "./secret-pattern.js";

const SCHEMA = "bizra.dema.review.repo_claude_config_check.v0.1";
const TRUTH_LABEL = "CONFIG_SLICE_A_REPO_CLAUDE_TRACKING_LOCAL_ONLY";

const VOLATILE_PROBES = [
  ".claude/hooks/logs/probe.jsonl",
  ".claude/bus/probe.json",
  ".claude/.cc-writes/probe",
  ".claude/settings.local.json",
  ".claude/skills/dema-slice-scaffold-workspace/probe",
];

const FORBIDDEN_TRACKED = /settings\.local\.json|hooks\/logs\/|\.claude\/bus\/|\.cc-writes/;

const failures = [];

function check(name, pass, detail) {
  if (!pass) failures.push(`${name}: ${detail}`);
  console.log(`  ${pass ? "PASS" : "FAIL"} ${name}${pass ? "" : ` — ${detail}`}`);
}

const gitignoreLines = readFileSync(".gitignore", "utf8")
  .split("\n")
  .map((line) => line.trim());
check(
  "no_wholesale_claude_ignore",
  !gitignoreLines.includes(".claude/") && !gitignoreLines.includes(".claude"),
  ".gitignore ignores .claude/ wholesale — harness is unreviewable",
);

for (const probe of VOLATILE_PROBES) {
  const ignored = spawnSync("git", ["check-ignore", "-q", probe]).status === 0;
  check(`volatile_ignored:${probe}`, ignored, "volatile path is not ignored");
}

const tracked = execFileSync("git", ["ls-files", ".claude"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

check(
  "rules_tracked",
  tracked.some((f) => f.startsWith(".claude/rules/")),
  "no .claude/rules files tracked",
);
check(
  "agents_tracked",
  tracked.some((f) => f.startsWith(".claude/agents/")),
  "no .claude/agents files tracked",
);
check(
  "skills_tracked",
  tracked.some((f) => f.startsWith(".claude/skills/")),
  "no .claude/skills files tracked",
);
check(
  "hooks_tracked",
  tracked.some((f) => f.startsWith(".claude/hooks/") && f.endsWith(".mjs")),
  "no .claude/hooks/*.mjs files tracked",
);
check(
  "settings_tracked",
  tracked.includes(".claude/settings.json"),
  ".claude/settings.json (hook wiring) is not tracked",
);

const forbidden = tracked.filter((f) => FORBIDDEN_TRACKED.test(f));
check(
  "no_volatile_tracked",
  forbidden.length === 0,
  `volatile paths tracked: ${forbidden.join(", ")}`,
);

const secretHits = tracked.filter((f) => hasSecretPattern(readFileSync(f, "utf8")));
check(
  "no_secret_patterns_tracked",
  secretHits.length === 0,
  `secret-like content in: ${secretHits.join(", ")}`,
);

console.log(`  schema: ${SCHEMA}`);
console.log(`  truth: ${TRUTH_LABEL}`);
console.log(`  tracked_claude_files: ${tracked.length}`);
console.log(`  result: ${failures.length === 0 ? "PASS" : "FAIL"}`);
console.log("  boundary: read-only · no network · no runtime · no model invocation");

if (failures.length > 0) {
  console.error(`repo-claude-config-check failed:\n${failures.map((f) => `  - ${f}`).join("\n")}`);
  process.exit(1);
}
