import { test } from "node:test";
import assert from "node:assert/strict";

import { COMMAND_TABLE } from "../apps/cli/src/index.js";

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
  "attest",
  "verify-grounded",
  "urp",
  "realm",
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
  "llm-router",
  "model-broker",
  "harness",
  "process-mining",
  "key-maker-check",
  "llm-invoke",
  "today",
  "doctor",
  "dashboard",
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
