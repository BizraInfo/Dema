import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateUxFirstLook,
  evaluateUxFirstLookEnvelope,
  FIRST_LOOK_FORBIDDEN_PATTERNS,
} from "../packages/core/src/ux-quality-gate.js";
import {
  buildFirstLookHome,
  gatherFirstLookContext,
} from "../packages/core/src/dema-first-look-home.js";

test("UX gate rejects internal jargon", () => {
  const bad = evaluateUxFirstLook(
    "Welcome back. Ring 0 URP gateway unreachable gather N=1",
  );
  assert.equal(bad.pass, false);
  assert.ok(bad.violations.length > 0);
});

test("UX gate requires companion markers", () => {
  const bad = evaluateUxFirstLook("Hello operator.");
  assert.equal(bad.pass, false);
  assert.ok(bad.missing.includes("recommended_next"));
});

test("first-look envelope passes UX gate", async () => {
  const ctx = await gatherFirstLookContext();
  const envelope = buildFirstLookHome(ctx);
  const result = evaluateUxFirstLookEnvelope(envelope);
  assert.equal(result.pass, true);
  assert.equal(FIRST_LOOK_FORBIDDEN_PATTERNS.length >= 8, true);
});
