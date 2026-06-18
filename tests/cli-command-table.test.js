import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

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
  "witness",
  "authorship",
  "proof",
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
  "profiles",
  "consent-card",
  "mission-loop",
  "evidence-event",
  "node-registry",
  "onboarding-lifecycle",
  "skill-growth-governor",
  "project-status",
  "craftsmanship-witness",
  "master-craftsmanship",
  "codebase",
  "orchestrator",
  "covenant",
  "assets",
  "llm-router",
  "model-broker",
  "harness",
  "bootstrap",
  "seed",
  "process-mining",
  "key-maker-check",
  "llm-invoke",
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
  "receipts",
  "memory",
  "think",
  "models",
  "report",
  "network",
  "amana",
  "mcp",
  "roadmap",
  "eval",
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
