import test from "node:test";
import assert from "node:assert/strict";
import { evaluateConsent } from "../packages/fate/src/fate.js";

const REQUIRED = "GO: Node0 bounded diagnostic activation only";

// GATE-2-RED: fuzzy consent must be REJECTED
test("GATE-2-RED: fuzzy consent 'GO: anything' is rejected", () => {
  const result = evaluateConsent({
    phrase: "GO: anything at all",
    requiredPhrase: REQUIRED,
  });
  assert.equal(result.accepted, false, "fuzzy consent must not be accepted");
  assert.equal(result.verdict, "BLOCK");
});

// GATE-2-RED: prefix-only consent is rejected
test("GATE-2-RED: prefix-only 'GO: ' is rejected", () => {
  const result = evaluateConsent({
    phrase: "GO: ",
    requiredPhrase: REQUIRED,
  });
  assert.equal(result.accepted, false, "prefix-only consent must not be accepted");
});

// GATE-2-GREEN: exact consent is accepted
test("GATE-2-GREEN: exact consent is accepted", () => {
  const result = evaluateConsent({
    phrase: REQUIRED,
    requiredPhrase: REQUIRED,
  });
  assert.equal(result.accepted, true, "exact consent must be accepted");
  assert.equal(result.verdict, "PERMIT_PREVIEW");
});

// GATE-2-GREEN: empty consent is rejected
test("GATE-2-GREEN: empty consent is rejected", () => {
  const result = evaluateConsent({
    phrase: "",
    requiredPhrase: REQUIRED,
  });
  assert.equal(result.accepted, false, "empty consent must not be accepted");
});

// GATE-2-GREEN: null consent is rejected
test("GATE-2-GREEN: null consent is rejected", () => {
  const result = evaluateConsent({
    phrase: null,
    requiredPhrase: REQUIRED,
  });
  assert.equal(result.accepted, false, "null consent must not be accepted");
});
