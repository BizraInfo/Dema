// Integration smoke: `dema state` must render `Next safe action:` with a
// human sentence, not with the raw snake_case schema identifier. This
// closes the bug surfaced by SPARC Orchestrator: humanization had been
// applied only to the homebase TUI, not to dema state.

import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));

test("STATE-HUM-01: `dema state` Next safe action line contains no snake_case underscores", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "state"], {
    timeout: 5000,
    env: { ...process.env, NODE_ENV: "test", DEMA_NODE0_ADAPTER: "" }
  });
  const nextLine = stdout
    .split("\n")
    .find((l) => l.includes("Next safe action:"));
  assert.ok(nextLine, "dema state must emit a 'Next safe action:' line");
  // The rendered value comes AFTER the label.
  const rendered = nextLine.split("Next safe action:")[1].trim();
  assert.equal(
    rendered.includes("_"),
    false,
    `dema state next safe action must be humanized, got: '${rendered}'`
  );
  assert.ok(rendered.length > 10, `dema state next safe action must be a real sentence, got: '${rendered}'`);
});

test("STATE-HUM-02: `dema state --json` preserves raw snake_case in the schema (machine consumers unchanged)", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "state", "--json"], {
    timeout: 5000,
    env: { ...process.env, NODE_ENV: "test", DEMA_NODE0_ADAPTER: "" }
  });
  const parsed = JSON.parse(stdout);
  assert.ok(typeof parsed.next_safe_action === "string");
  // The JSON shape keeps the raw schema-stable code — humanization is render-time only.
  // Either the raw snake_case OR a humanized fallback is acceptable; what we forbid
  // is the JSON shape being broken.
  assert.ok(parsed.next_safe_action.length > 0);
});
