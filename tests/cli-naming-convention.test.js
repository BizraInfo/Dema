import test from "node:test";
import assert from "node:assert/strict";
import { REGISTERED_COMMANDS_LIST } from "../apps/cli/src/index.js";

// Documented legacy allowlists per ADR-012.
// Adding to these lists requires a scoped GO and ADR-012 update.
const COLON_ALLOWLIST = new Set(["status:json", "ambient:json"]);
const KEBAB_ALLOWLIST = new Set([
  "consent-card",
  "mission-loop",
  "evidence-event",
  "node-registry",
  "onboarding-lifecycle",
  "skill-growth-governor",
  "project-status",
  "craftsmanship-witness",
  "llm-router",
  "process-mining",
  "key-maker-check",
  "llm-invoke",
  // ADR-012 amendment 2026-05-19: extended allowlist to 13 entries with the
  // addition of `master-craftsmanship` (the external-audit surface that
  // consolidates the ADR-011 phase-4 compliance suite). Scoped exception
  // per the ADR's own amendment-by-typed-GO rule. See ADR-012 §Decision.
  "master-craftsmanship",
]);

function classify(command) {
  if (command.includes(":")) return "colon";
  if (command.includes("-")) return "kebab";
  if (command.includes(" ")) return "space-subcommand";
  return "single-word";
}

test("REGISTERED_COMMANDS_LIST is a non-empty array", () => {
  assert.ok(Array.isArray(REGISTERED_COMMANDS_LIST), "must be an array");
  assert.ok(REGISTERED_COMMANDS_LIST.length > 0, "must not be empty");
});

test("every entry has a non-empty command string and a description string", () => {
  for (const entry of REGISTERED_COMMANDS_LIST) {
    assert.ok(typeof entry.command === "string" && entry.command.length > 0,
      `entry missing command string: ${JSON.stringify(entry)}`);
    assert.ok(typeof entry.description === "string" && entry.description.length > 0,
      `entry missing description string: ${JSON.stringify(entry)}`);
  }
});

test("every command classifies into one of the four known patterns", () => {
  const known = new Set(["single-word", "space-subcommand", "kebab", "colon"]);
  for (const { command } of REGISTERED_COMMANDS_LIST) {
    const pattern = classify(command);
    assert.ok(known.has(pattern),
      `command "${command}" produced unknown pattern "${pattern}"`);
  }
});

test("no NEW colon-format commands beyond the documented allowlist", () => {
  for (const { command } of REGISTERED_COMMANDS_LIST) {
    if (classify(command) !== "colon") continue;
    assert.ok(COLON_ALLOWLIST.has(command),
      `"${command}" is a colon-format command not in the ADR-012 allowlist. ` +
      `Add to COLON_ALLOWLIST or use --json flag on an existing command instead.`);
  }
});

test("no NEW kebab commands beyond the documented legacy allowlist", () => {
  for (const { command } of REGISTERED_COMMANDS_LIST) {
    if (classify(command) !== "kebab") continue;
    assert.ok(KEBAB_ALLOWLIST.has(command),
      `"${command}" is a kebab command not in the ADR-012 legacy allowlist. ` +
      `Use space-subcommand pattern for new commands per ADR-012.`);
  }
});

test("colon allowlist entries are present in the registered list", () => {
  const registered = new Set(REGISTERED_COMMANDS_LIST.map((e) => e.command));
  for (const name of COLON_ALLOWLIST) {
    assert.ok(registered.has(name),
      `Allowlisted colon command "${name}" is missing from REGISTERED_COMMANDS_LIST — remove from allowlist or re-register.`);
  }
});

test("kebab allowlist entries are present in the registered list", () => {
  const registered = new Set(REGISTERED_COMMANDS_LIST.map((e) => e.command));
  for (const name of KEBAB_ALLOWLIST) {
    assert.ok(registered.has(name),
      `Allowlisted kebab command "${name}" is missing from REGISTERED_COMMANDS_LIST — remove from allowlist or re-register.`);
  }
});

test("pattern distribution matches ADR-012 counts (drift guard)", () => {
  const counts = { "single-word": 0, "space-subcommand": 0, "kebab": 0, "colon": 0 };
  for (const { command } of REGISTERED_COMMANDS_LIST) {
    counts[classify(command)] += 1;
  }
  // ADR-012 documents: single-word=17, space-subcommand=13 (top-level tokens),
  // kebab=13 (since 2026-05-19 amendment adding master-craftsmanship), colon=2.
  // If this test fails, update ADR-012 alongside.
  assert.equal(counts.kebab, 13,
    `Kebab count changed (expected 13, got ${counts.kebab}). Update ADR-012 allowlist.`);
  assert.equal(counts.colon, 2,
    `Colon count changed (expected 2, got ${counts.colon}). Update ADR-012 allowlist.`);
  // Single-word + space-subcommand bounds: check they are non-zero and reasonable.
  assert.ok(counts["single-word"] >= 10,
    `Single-word count suspiciously low: ${counts["single-word"]}`);
  assert.ok(counts["space-subcommand"] === 0,
    `REGISTERED_COMMANDS_LIST stores top-level tokens only; space-subcommand entries should be 0 (got ${counts["space-subcommand"]})`);
});
