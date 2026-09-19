import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const page = readFileSync(resolve(root, "packages/dema-ui/src/app/world/page.tsx"), "utf8");
const model = readFileSync(resolve(root, "packages/dema-ui/src/lib/world-projection-model.ts"), "utf8");
const combined = `${page}\n${model}`;

test("world route unifies mission, realm and presentation without creating authority", () => {
  assert.match(page, /href="\/"/);
  assert.match(page, /href="\/realm"/);
  assert.match(model, /route: "\/world"/);
  assert.match(model, /authority_delta: 0/);
  assert.match(model, /runtime_effects: false/);
});

test("world route is read-only and executes no model supplied code", () => {
  assert.doesNotMatch(combined, /new Function\s*\(|\beval\s*\(/);
  assert.doesNotMatch(combined, /fetch\s*\(|\/api\//);
  assert.doesNotMatch(combined, /PrismaClient|process\.env|localStorage|sessionStorage/);
  assert.doesNotMatch(page, /^["']use client["'];?/m);
});

test("world projection carries exact source anchors", () => {
  assert.match(model, /d526126c4a7dee216b5c1d2f20c994fb7a6fb9c326fcf5fdb210d00bc43c7ebd/);
  assert.match(model, /3f5664ec4398236c08e2a4117d504a09bd05952a/);
  assert.match(model, /53e636c81e2677756bc3b6b3178cb651c17ceb02/);
});

test("truth vocabulary remains closed and non-promotional", () => {
  const labels = [...model.matchAll(/(?:truth|state): "([A-Z_]+)"/g)].map((m) => m[1]);
  const allowed = new Set(["MEASURED", "SOURCE_BOUND", "DESIGNED_NOT_LIVE", "UNKNOWN"]);
  assert.ok(labels.length >= 9);
  assert.ok(labels.every((label) => allowed.has(label)));
  assert.doesNotMatch(combined, /SEALED & OPTIMAL|execution-ready|1,000,000 Active Nodes/i);
});
