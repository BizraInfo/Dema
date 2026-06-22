import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { evaluateZeroDep } from "../scripts/review/zero-dep-gate.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("evaluateZeroDep passes when both dependency maps are empty or absent", () => {
  assert.equal(evaluateZeroDep({}).ok, true);
  assert.equal(evaluateZeroDep({ dependencies: {}, devDependencies: {} }).ok, true);
});

test("evaluateZeroDep fails closed on any runtime dependency", () => {
  const r = evaluateZeroDep({ dependencies: { left_pad: "1.0.0" } });
  assert.equal(r.ok, false);
  assert.deepEqual(r.runtime_deps, ["left_pad"]);
});

test("evaluateZeroDep fails closed on any dev dependency", () => {
  const r = evaluateZeroDep({ devDependencies: { eslint: "9.0.0" } });
  assert.equal(r.ok, false);
  assert.deepEqual(r.dev_deps, ["eslint"]);
});

test("evaluateZeroDep output is frozen and schema-tagged", () => {
  const r = evaluateZeroDep({});
  assert.equal(r.schema, "bizra.dema.review.zero_dep_gate.v0.1");
  assert.ok(Object.isFrozen(r));
});

test("the real repo package.json honors the zero-dependency invariant", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.equal(evaluateZeroDep(pkg).ok, true);
});
