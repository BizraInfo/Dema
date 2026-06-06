import { test } from "node:test";
import assert from "node:assert/strict";

import { wantsJson, humanHintLine } from "../packages/core/src/output-mode.js";

// --- wantsJson ---

test("wantsJson returns false when argv is empty", () => {
  assert.equal(wantsJson([]), false);
});

test("wantsJson returns true when --json is present", () => {
  assert.equal(wantsJson(["state", "--json"]), true);
});

test("wantsJson returns true when --json is the only argument", () => {
  assert.equal(wantsJson(["--json"]), true);
});

test("wantsJson returns false when --json is absent among other flags", () => {
  assert.equal(wantsJson(["state", "--pretty", "--summary"]), false);
});

test("wantsJson returns false for non-array input (null)", () => {
  assert.equal(wantsJson(null), false);
});

test("wantsJson returns false for non-array input (undefined)", () => {
  assert.equal(wantsJson(undefined), false);
});

test("wantsJson does not match --json=true as the flag (exact token only)", () => {
  // The contract is exact token match, not prefix match.
  assert.equal(wantsJson(["--json=true"]), false);
});

// --- humanHintLine ---

test("humanHintLine interpolates the command name", () => {
  assert.equal(
    humanHintLine("state"),
    "Type `dema state --json` for machine-readable output.",
  );
});

test("humanHintLine works for multi-word command names", () => {
  assert.equal(
    humanHintLine("models scan"),
    "Type `dema models scan --json` for machine-readable output.",
  );
});
