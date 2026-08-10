import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  usesLegacyWriter,
  writerIsRetired,
  stripComments,
  runLegacyConsentAuthorityCheck,
  LEGACY_MODULES,
  RETIRED_MARKER,
} from "../scripts/review/legacy-consent-authority-check.mjs";

/**
 * LEGACY-CONSENT-AUTHORITY-GATE — controls for the gate that keeps
 * LIVE_LEGACY_CONSENT_AUTHORITY at 0.
 *
 * The gate's headline output is a COUNT OF ZERO, and a zero is exactly what a
 * broken scan produces. Measured on this gate's own first draft: the import
 * check ran against string-blanked source, and an import specifier IS a string,
 * so that branch could never match. It reported 0 live callers on a tree it was
 * structurally unable to read. Every negative below is therefore paired with a
 * positive control that must FIRE.
 */

const A = "recordConsentNonce";
const MOD = "../receipts/src/consent-nonce-registry-atomic.js";

test("LCG · a use is detected in every form it really takes", async (t) => {
  await t.test("LCG-01: a named import of a legacy module is a use", () => {
    assert.equal(usesLegacyWriter(`import { ${A} } from "${MOD}";\n`), true);
  });

  await t.test("LCG-02: a MULTI-LINE import is a use", () => {
    assert.equal(usesLegacyWriter(`import {\n  ${A},\n  isConsentNonceUsed,\n} from "${MOD}";\n`), true);
  });

  await t.test("LCG-03: a dynamic import() of a legacy module is a use", () => {
    assert.equal(usesLegacyWriter(`const m = await import("${MOD}");\n`), true);
  });

  await t.test("LCG-04: a direct call is a use even with no import in this file", () => {
    assert.equal(usesLegacyWriter(`const r = await ${A}({ nonce });\n`), true);
  });

  await t.test("LCG-05: an aliased-namespace call is a use", () => {
    assert.equal(usesLegacyWriter(`const r = await legacy.${A}({ nonce });\n`), true);
  });
});

test("LCG · what is deliberately NOT a use", async (t) => {
  await t.test("LCG-10: reading the superseded store is allowed and must stay allowed", () => {
    assert.equal(usesLegacyWriter(`import { isConsentNonceUsed } from "${MOD}";\nif (await isConsentNonceUsed({ nonce })) return;\n`), true,
      "importing the MODULE is still a use — the import is the coupling");
    assert.equal(usesLegacyWriter(`if (await isConsentNonceUsed({ nonce })) return;\n`), false,
      "calling the reader, with no legacy import, is not a use");
  });

  await t.test("LCG-11: a comment showing an example import is not a use", () => {
    assert.equal(usesLegacyWriter(`// import { ${A} } from "${MOD}";\nexport const x = 1;\n`), false);
  });

  await t.test("LCG-12: a doc string naming the module is not a use", () => {
    assert.equal(usesLegacyWriter(`export const NOTE = "superseded by ${MOD}";\n`), false);
  });

  await t.test("LCG-13: the writer's name in a string constant is not a call", () => {
    assert.equal(usesLegacyWriter(`const NAME = "${A}";\nconsole.log(NAME);\n`), false);
  });

  await t.test("LCG-14: a longer identifier containing the name is not the writer", () => {
    assert.equal(usesLegacyWriter(`await my${A}Wrapper({ nonce });\n`), false);
  });
});

test("LCG · retirement is re-derived from the body, never trusted", async (t) => {
  const retiredBody = `export async function ${A}() {\n  return Object.freeze({ recorded: false, error: "${RETIRED_MARKER}" });\n}\nexport const other = 1;\n`;

  await t.test("LCG-20: POSITIVE CONTROL — a genuinely retired writer reads as retired", () => {
    assert.deepEqual(writerIsRetired(retiredBody), { retired: true, reason: null });
  });

  await t.test("LCG-21: a writer that writes again is caught", () => {
    const active = `export async function ${A}(a) {\n  await writeFile(p, JSON.stringify(a), { flag: "wx" });\n  return { recorded: true };\n}\nexport const other = 1;\n`;
    assert.equal(writerIsRetired(active).retired, false);
    assert.match(writerIsRetired(active).reason, /writeFile/);
  });

  await t.test("LCG-22: a writer that only mkdirs is still not retired", () => {
    const sneaky = `export async function ${A}() {\n  await mkdir(dir, { recursive: true });\n  return { recorded: false, error: "${RETIRED_MARKER}" };\n}\nexport const other = 1;\n`;
    assert.equal(writerIsRetired(sneaky).retired, false);
    assert.match(writerIsRetired(sneaky).reason, /mkdir/);
  });

  await t.test("LCG-23: the marker alone does not make a writer retired", () => {
    const lying = `export async function ${A}() {\n  await writeFileSync(p, "x");\n  return { error: "${RETIRED_MARKER}" };\n}\nexport const other = 1;\n`;
    assert.equal(writerIsRetired(lying).retired, false);
  });

  await t.test("LCG-24: a missing writer is reported, not silently passed", () => {
    assert.deepEqual(writerIsRetired("export const nothing = 1;\n"), { retired: false, reason: "writer_not_found" });
  });
});

test("LCG · stripComments keeps strings, which is the whole point", () => {
  const out = stripComments(`// note\nimport x from "path/consent-nonce-registry.js";\n`);
  assert.match(out, /consent-nonce-registry/, "an import specifier must survive comment stripping");
  assert.doesNotMatch(out, /note/);
});

test("LCG · the live tree passes, and the writers really are retired", () => {
  const report = runLegacyConsentAuthorityCheck();
  assert.equal(report.ok, true);
  assert.equal(report.live_legacy_consent_authority, 0, `live callers: ${report.live_callers.join(", ")}`);
  assert.deepEqual(report.live_callers, []);
  for (const w of report.writers) assert.equal(w.retired, true, `${w.module}: ${w.reason}`);
  // A scan that found nothing because it read nothing would also report 0.
  assert.ok(report.files_scanned > 100, "the scan must actually have read the tree");
  // And the modules it claims to have checked must be the ones on disk.
  for (const rel of LEGACY_MODULES) {
    assert.ok(readFileSync(rel, "utf8").includes(RETIRED_MARKER), `${rel} carries the retirement marker`);
  }
});
