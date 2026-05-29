import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  evaluate,
  RULE_ID,
  REQUIRED_KEYS,
  ALLOWED_KEYS,
} from "../packages/rules/src/rule-canonical-shape.v0.1.js";

describe("rule-canonical-shape.v0.1 · pure evaluate", () => {
  it("exports stable RULE_ID = 'canonical-shape.v0.1'", () => {
    assert.equal(RULE_ID, "canonical-shape.v0.1");
  });

  it("REQUIRED_KEYS and ALLOWED_KEYS are frozen arrays", () => {
    assert.ok(Array.isArray(REQUIRED_KEYS));
    assert.ok(Array.isArray(ALLOWED_KEYS));
    assert.ok(Object.isFrozen(REQUIRED_KEYS));
    assert.ok(Object.isFrozen(ALLOWED_KEYS));
    // every required key must be in allowed
    for (const k of REQUIRED_KEYS) assert.ok(ALLOWED_KEYS.includes(k));
  });

  it("determinism: evaluate(x) twice → deep-equal", () => {
    const input = { name: "x", value: 42 };
    const r1 = evaluate(input);
    const r2 = evaluate(input);
    assert.deepEqual(r1, r2);
  });

  it("pass: input has exactly the required keys (and nothing else)", () => {
    const input = { name: "x", value: 42 };
    const r = evaluate(input);
    assert.equal(r.verdict, "pass");
    assert.deepEqual([...r.computed.input_keys].sort(), ["name", "value"]);
    assert.deepEqual([...r.computed.missing_required], []);
    assert.deepEqual([...r.computed.disallowed_keys], []);
  });

  it("pass: input has required + optional 'note' (within allowed set)", () => {
    const input = { name: "x", value: 42, note: "hello" };
    const r = evaluate(input);
    assert.equal(r.verdict, "pass");
    assert.deepEqual([...r.computed.input_keys].sort(), [
      "name",
      "note",
      "value",
    ]);
  });

  it("fail: missing a required key → missing_required surfaced", () => {
    const input = { name: "x" };
    const r = evaluate(input);
    assert.equal(r.verdict, "fail");
    assert.ok(r.computed.missing_required.includes("value"));
    assert.deepEqual([...r.computed.disallowed_keys], []);
  });

  it("fail: extra key outside allowed set → disallowed_keys surfaced", () => {
    const input = { name: "x", value: 42, intruder: "bad" };
    const r = evaluate(input);
    assert.equal(r.verdict, "fail");
    assert.ok(r.computed.disallowed_keys.includes("intruder"));
  });

  it("fail: non-object input (string) → verdict fail, error noted", () => {
    const r = evaluate("not an object");
    assert.equal(r.verdict, "fail");
    assert.ok(r.computed.error);
  });

  it("fail: null input → verdict fail", () => {
    const r = evaluate(null);
    assert.equal(r.verdict, "fail");
    assert.ok(r.computed.error);
  });

  it("fail: array input → verdict fail (not a canonical JSON object)", () => {
    const r = evaluate(["name", "value"]);
    assert.equal(r.verdict, "fail");
    assert.ok(r.computed.error);
  });

  it("computed is reconstructible: surfaces required/allowed/input/missing/disallowed key-sets", () => {
    const input = { name: "x", value: 42 };
    const r = evaluate(input);
    assert.ok(Array.isArray(r.computed.input_keys));
    assert.ok(Array.isArray(r.computed.required_keys));
    assert.ok(Array.isArray(r.computed.allowed_keys));
    assert.ok(Array.isArray(r.computed.missing_required));
    assert.ok(Array.isArray(r.computed.disallowed_keys));
  });

  it("output is frozen (cannot mutate verdict or computed)", () => {
    const r = evaluate({ name: "x", value: 42 });
    assert.ok(Object.isFrozen(r));
    assert.ok(Object.isFrozen(r.computed));
  });
});
