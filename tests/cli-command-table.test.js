import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

import { COMMAND_TABLE } from "../apps/cli/src/index.js";

const CLI = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));
const CLI_SOURCE = readFileSync(CLI, "utf8");

// Authoritative command surface — every routable `dema <command>` token that
// the historical god-switch handled (Track 2 dispatcher refactor, 2026-06-02).
// This list is the spec the command table must cover exactly: no command may
// silently lose its handler, and no orphan handler may appear without a command.
const COMMAND_SURFACE = [
  "active",
  "",
  "chat",
  "welcome",
  "first-run",
  "onboard",
  "preview-card",
  "language",
  "explain",
  "setup",
  "setup-check",
  "uninstall",
  "stand",
  "poi",
  "away",
  "witness",
  "authorship",
  "proof",
  "delivery",
  "foundation",
  "genesis",
  "attest",
  "verify-grounded",
  "urp",
  "realm",
  "homebase",
  "node0",
  "adk",
  "status",
  "status:json",
  "state",
  "node0-index",
  "start",
  "scan",
  "mirror",
  "talk",
  "canon",
  "steward",
  "profiles",
  "consent-card",
  "mission-loop",
  "evidence-event",
  "node-registry",
  "onboarding-lifecycle",
  "skill-growth-governor",
  "project-status",
  "craftsmanship-witness",
  "peak-self-loop",
  "agent-loop",
  "master-craftsmanship",
  "codebase",
  "corpus",
  "orchestrator",
  "covenant",
  "assets",
  "library",
  "recovery",
  "contribute",
  "economy",
  "demo",
  "llm-router",
  "model-broker",
  "harness",
  "bootstrap",
  "seed",
  "process-mining",
  "key-maker-check",
  "llm-invoke",
  "ask",
  "today",
  "doctor",
  "dashboard",
  "datalake",
  "ambient",
  "ambient:json",
  "journey",
  "diagnostics",
  "consent",
  "mission",
  "season",
  "recovery",
  "founder",
  "voice",
  "receipts",
  "memory",
  "think",
  "models",
  "monitors",
  "report",
  "network",
  "amana",
  "diffusion",
  "mcp",
  "roadmap",
  "eval",
  "hardware",
  "evidence",
  "ihsan",
  "behavior",
  "design",
  "task",
  "monetize",
  "sovereign",
  "help",
  "-h",
  "--help",
];

test("COMMAND_TABLE is exported as a non-null object", () => {
  assert.equal(typeof COMMAND_TABLE, "object");
  assert.notEqual(COMMAND_TABLE, null);
});

test("COMMAND_TABLE has a function handler for every command in the surface", () => {
  const missing = COMMAND_SURFACE.filter(
    (cmd) => typeof COMMAND_TABLE[cmd] !== "function",
  );
  assert.deepEqual(
    missing,
    [],
    `commands missing a table handler: ${missing.join(", ")}`,
  );
});

test("COMMAND_TABLE has no orphan handlers outside the known surface", () => {
  const surface = new Set(COMMAND_SURFACE);
  const orphans = Object.keys(COMMAND_TABLE).filter((cmd) => !surface.has(cmd));
  assert.deepEqual(
    orphans,
    [],
    `orphan handlers not in surface: ${orphans.join(", ")}`,
  );
});

test("prototype property command tokens fall through to the unknown-command suggester", () => {
  for (const token of ["constructor", "__defineSetter__", "toString"]) {
    const result = spawnSync("node", [CLI, token], {
      encoding: "utf8",
      env: { ...process.env, DEMA_NO_TUI: "1" },
    });
    assert.equal(
      result.status,
      0,
      `${token} should not throw via inherited COMMAND_TABLE lookup\nstderr:\n${result.stderr}`,
    );
    const displayedToken = token.toLowerCase();
    assert.match(
      result.stdout,
      new RegExp("I don\x27t have a `" + displayedToken + "` command\\."),
    );
  }
});

test("dashboard command avoids access-before-read TOCTOU pattern", () => {
  assert.doesNotMatch(CLI_SOURCE, /accessSync\(htmlPath/);
});

// ---------------------------------------------------------------------------
// UNREACHABLE-COMMAND GUARD
//
// Found 2026-07-25: `apps/cli/src/commands/recovery.js` had been present,
// complete, read-only and exact-string consent-gated for weeks, and was never
// imported by index.js. Every invocation got "I don't have a `recovery`
// command.", and all 20 T01..T20 envelope tests asserted against that reply.
//
// No gate could see it. The orphan-handler test above walks the OTHER
// direction: dispatcher entry -> declared surface. Nothing walked file ->
// dispatcher, so a command that exists but is unreachable was invisible.
//
// Reachability must follow dynamic `import()` as well as static `from`:
// `dema node0 spine-run` lazy-loads node0-spine-run.js from node0.js, so a
// static-only walk reports it as a false orphan.
// ---------------------------------------------------------------------------

const COMMANDS_DIR = fileURLToPath(new URL("../apps/cli/src/commands/", import.meta.url));

/** Modules reachable from `entry` through static and dynamic relative imports. */
function reachableFrom(entry) {
  const seen = new Set();
  const stack = [entry];
  while (stack.length > 0) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    let source;
    try {
      source = readFileSync(file, "utf8");
    } catch {
      continue; // a specifier that does not resolve to a file on disk
    }
    for (const m of source.matchAll(/from\s+"(\.[^"]+)"|import\(\s*"(\.[^"]+)"/g)) {
      stack.push(resolve(dirname(file), m[1] ?? m[2]));
    }
  }
  return seen;
}

/** Command files that export a `cmd*` entrypoint — gatherers and helpers do not. */
function commandEntrypointFiles() {
  return readdirSync(COMMANDS_DIR)
    .filter((n) => n.endsWith(".js"))
    .filter((n) => /export\s+(async\s+)?function\s+cmd/.test(readFileSync(join(COMMANDS_DIR, n), "utf8")))
    .map((n) => join(COMMANDS_DIR, n));
}

test("COMMAND-REACH-01: every cmd* command file is reachable from the CLI entrypoint", () => {
  const reachable = reachableFrom(CLI);
  const orphans = commandEntrypointFiles()
    .filter((f) => !reachable.has(f))
    .map((f) => f.slice(f.indexOf("apps/cli/")));
  assert.deepEqual(
    orphans,
    [],
    `command files exist but nothing routes to them: ${orphans.join(", ")}`,
  );
});

test("COMMAND-REACH-02: the guard detects a file nothing imports", () => {
  // Without this the guard could pass vacuously — an empty orphan list means
  // nothing only if the walk can actually report something.
  const reachable = reachableFrom(CLI);
  const files = commandEntrypointFiles();
  assert.ok(files.length > 50, `expected the real command surface, got ${files.length}`);
  assert.ok(files.every((f) => reachable.has(f)));
  const fabricated = join(COMMANDS_DIR, "__no-such-command__.js");
  assert.equal(reachable.has(fabricated), false, "walk must not claim an absent file is reachable");
});

test("COMMAND-REACH-03: reachability follows dynamic import(), not just static from", () => {
  // `dema node0 spine-run` is lazy-loaded, so a static-only walk would call it
  // an orphan and this guard would push someone to wire an already-wired file.
  const spineRun = join(COMMANDS_DIR, "node0-spine-run.js");
  assert.ok(reachableFrom(CLI).has(spineRun), "node0-spine-run.js is reached via await import()");
  assert.equal(reachableFrom(join(COMMANDS_DIR, "away.js")).has(spineRun), false);
});
