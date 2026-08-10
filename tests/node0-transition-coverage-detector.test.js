import test from "node:test";
import assert from "node:assert/strict";

import {
  stripCommentsAndStrings,
  callsMechanism,
  mentionsTokenInCode,
} from "../scripts/proof/node0-transition-coverage-proof.mjs";

/**
 * NODE0-TRANSITION-COVERAGE-DETECTOR-1A.
 *
 * The defect this guards, MEASURED end to end on 36200ce before repair.
 *
 * The producer for `receipt_per_transition` decided "does this authoritative
 * writer call the canonical receipt mechanism?" with a raw-source substring
 * test. Two consequences were reproduced against the real producer:
 *
 *   1. Appending ONE comment line to the writer —
 *        `// NOTE: this generation transition does not yet call
 *         appendCanonicalReceipt.`
 *      — a comment that states the opposite of what it caused — erased the
 *      proven counterexample. The canonical ledger moved
 *      `receipt_per_transition` from VIOLATED to UNKNOWN. Prose deleted a
 *      measured refutation.
 *
 *   2. The control that makes a counterexample mean anything
 *      (`receipt_mechanism_exists_elsewhere`) reported five callers on the
 *      unmodified tree. Only two were call sites. The other three were
 *      `mission-corridor-closure.js` (a comment), `canonical-ledger.js` (the
 *      declaration, not a use), and the producer itself (a string constant).
 *      A control satisfiable by prose has stopped controlling.
 *
 * The asymmetry in node0-transition-coverage.js is what makes this severe: a
 * counterexample is REJECTED unless `receipt_call_present === false`, so a
 * false positive on the writer does not weaken the row — it deletes the only
 * evidence the row is refuted by, and UNKNOWN is indistinguishable from
 * "nobody looked".
 *
 * Every negative below is paired with a positive control, because a detector
 * that answered `false` unconditionally would satisfy the negatives alone.
 */

const M = "appendCanonicalReceipt";

test("NTCD · comments and strings are not code", async (t) => {
  await t.test("NTCD-01: the exact measured line-comment does not count as a call", () => {
    const src = `export function rotate() { return 1; }\n// NOTE: this generation transition does not yet call ${M}.\n`;
    assert.equal(callsMechanism(src, M), false);
  });

  await t.test("NTCD-02: a block comment does not count as a call", () => {
    const src = `/* we should probably ${M}({ body }) here one day */\nexport function rotate() {}\n`;
    assert.equal(callsMechanism(src, M), false);
  });

  await t.test("NTCD-03: a string constant naming the mechanism is not a call", () => {
    const src = `const RECEIPT_MECHANISM = "${M}";\nconsole.log(RECEIPT_MECHANISM);\n`;
    assert.equal(callsMechanism(src, M), false);
  });

  await t.test("NTCD-04: a template literal naming the mechanism is not a call", () => {
    const src = "const msg = `call " + M + "({}) next`;\n";
    assert.equal(callsMechanism(src, M), false);
  });

  await t.test("NTCD-05: a single-quoted literal naming the mechanism is not a call", () => {
    const src = `const m = '${M}';\n`;
    assert.equal(callsMechanism(src, M), false);
  });
});

test("NTCD · POSITIVE CONTROLS — real calls must still be detected", async (t) => {
  await t.test("NTCD-06: a plain awaited call is a call", () => {
    const src = `const r = await ${M}({ body });\n`;
    assert.equal(callsMechanism(src, M), true);
  });

  await t.test("NTCD-07: a member call is a call", () => {
    const src = `const r = await ledger.${M}({ body });\n`;
    assert.equal(callsMechanism(src, M), true);
  });

  await t.test("NTCD-08: whitespace before the paren is still a call", () => {
    const src = `${M}\n  ({ body });\n`;
    assert.equal(callsMechanism(src, M), true);
  });

  await t.test("NTCD-09: a real call survives alongside a comment about it", () => {
    const src = `// ${M} is consent-gated\nawait ${M}({ body });\n`;
    assert.equal(callsMechanism(src, M), true);
  });
});

test("NTCD · a declaration is a definition, not a use", async (t) => {
  await t.test("NTCD-10: the exported declaration alone is not a caller", () => {
    const src = `export async function ${M}({ demaHome }) {\n  return { ok: true };\n}\n`;
    assert.equal(callsMechanism(src, M), false);
  });

  await t.test("NTCD-11: a declaration plus an internal recursive call IS a use", () => {
    const src = `export async function ${M}(a) {\n  if (a.retry) return ${M}({ ...a, retry: false });\n  return { ok: true };\n}\n`;
    assert.equal(callsMechanism(src, M), true);
  });

  await t.test("NTCD-12: importing the symbol without calling it is not a use", () => {
    const src = `import { ${M} } from "./canonical-ledger.js";\nexport const x = 1;\n`;
    assert.equal(callsMechanism(src, M), false);
  });
});

test("NTCD · identifier boundaries", async (t) => {
  await t.test("NTCD-13: a longer identifier that contains the name is not the mechanism", () => {
    const src = `await my${M}Wrapper({ body });\n`;
    assert.equal(callsMechanism(src, M), false);
  });

  await t.test("NTCD-14: a prefixed identifier is not the mechanism", () => {
    const src = `await legacy_${M}({ body });\n`;
    assert.equal(callsMechanism(src, M), false);
  });
});

test("NTCD · self-evidencing tokens are read from code, never prose", async (t) => {
  await t.test("NTCD-15: a comment mentioning the token does not self-evidence a domain", () => {
    const src = `// the record is content-addressed by claim_hash\nexport const x = 1;\n`;
    assert.equal(mentionsTokenInCode(src, "claim_hash"), false);
  });

  await t.test("NTCD-16: POSITIVE CONTROL — the token as a real property does self-evidence", () => {
    const src = `export const record = Object.freeze({ claim_hash: digest });\n`;
    assert.equal(mentionsTokenInCode(src, "claim_hash"), true);
  });
});

test("NTCD · stripCommentsAndStrings keeps code and drops prose", async (t) => {
  await t.test("NTCD-17: code survives, comment and string do not", () => {
    const out = stripCommentsAndStrings(`const a = "hidden"; // note\nrun(a);\n`);
    assert.match(out, /run\(a\)/);
    assert.doesNotMatch(out, /hidden/);
    assert.doesNotMatch(out, /note/);
  });

  await t.test("NTCD-18: a URL inside a string cannot leak its // as a comment", () => {
    const out = stripCommentsAndStrings(`const u = "https://x.example/a"; keep(u);\n`);
    assert.match(out, /keep\(u\)/);
  });
});
