import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  evaluateStylePillar,
  evaluateBannedStyleTools,
  listJsSourceFiles,
  scanFileStyle,
  SCHEMA,
  SLICE_ID,
} from "../scripts/review/style-pillar-check.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("STYLE-PILLAR-01: scanFileStyle flags CRLF, tabs, trailing space, missing newline", () => {
  const findings = scanFileStyle("bad.js", "\ra \nb\td\nend");
  const rules = findings.map((f) => f.rule);
  assert.ok(rules.includes("crlf"));
  assert.ok(rules.includes("tab_character"));
  assert.ok(rules.includes("trailing_whitespace"));
  assert.ok(rules.includes("missing_final_newline"));
});

test("STYLE-PILLAR-02: scanFileStyle passes clean LF-only source", () => {
  assert.deepEqual(scanFileStyle("ok.js", "const x = 1;\n"), []);
});

test("STYLE-PILLAR-03: evaluateBannedStyleTools fails closed on eslint devDependency", () => {
  const hits = evaluateBannedStyleTools({ devDependencies: { eslint: "9.0.0" } });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].name, "eslint");
});

test("STYLE-PILLAR-04: evaluateStylePillar output is frozen and schema-tagged", () => {
  const report = evaluateStylePillar({
    root: ROOT,
    packageJson: { dependencies: {}, devDependencies: {}, scripts: {} },
  });
  assert.equal(report.schema, SCHEMA);
  assert.equal(report.slice, SLICE_ID);
  assert.ok(Object.isFrozen(report));
  assert.ok(report.zero_dep_safe);
});

test("STYLE-PILLAR-05: generated Next.js output is outside the source gate", (t) => {
  const root = mkdtempSync(join(tmpdir(), "dema-style-next-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "packages", "ui", ".next"), { recursive: true });
  writeFileSync(
    join(root, "packages", "ui", ".next", "bundle.js"),
    "generated-without-final-newline",
  );
  writeFileSync(
    join(root, "packages", "ui", "source.js"),
    "export const clean = true;\n",
  );

  assert.deepEqual(listJsSourceFiles(root, ["packages"]), [
    "packages/ui/source.js",
  ]);
});

test("STYLE-PILLAR-06: source discovery never follows external or cyclic symlinks", (t) => {
  const root = mkdtempSync(join(tmpdir(), "dema-style-link-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const outside = mkdtempSync(join(tmpdir(), "dema-style-private-"));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  mkdirSync(join(root, "packages", "ui"), { recursive: true });
  writeFileSync(join(outside, "private.js"), "private-without-final-newline");
  symlinkSync(outside, join(root, "packages", "ui", "linked-private"));
  symlinkSync(".", join(root, "packages", "ui", "cycle"));

  assert.deepEqual(listJsSourceFiles(root, ["packages"]), []);
});

test("STYLE-PILLAR-07: the real repo honors the stdlib style-pillar micro-gate", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const report = evaluateStylePillar({ root: ROOT, packageJson: pkg });
  assert.equal(
    report.ok,
    true,
    `style findings: ${JSON.stringify(report.findings)} banned: ${JSON.stringify(report.banned_style_tools)}`,
  );
  assert.ok(report.files_scanned > 100);
  assert.ok(report.pillar_score_estimate >= 32);
});
