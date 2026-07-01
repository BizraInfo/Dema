import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  evaluateStylePillar,
  evaluateBannedStyleTools,
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

test("STYLE-PILLAR-05: the real repo honors the stdlib style-pillar micro-gate", () => {
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
