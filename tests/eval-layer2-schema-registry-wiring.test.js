// Eval Layer 2 · Schema Registry Wiring v0.1
//
// Locks: both new Layer 2 envelope schemas are auto-picked-up by
// envelope-schema-validator at module init from packages/core/schemas/. If
// either schema file is renamed, moved, or its $id mutates, this test
// catches the drift before any downstream code that relies on
// validateAgainstRegistry can silently miss it.

import test from "node:test";
import assert from "node:assert/strict";

import {
  KNOWN_SCHEMA_IDS,
  getKnownSchema,
  hasKnownSchema,
} from "../packages/core/src/envelope-schema-validator.js";

const EXPECTED_SCHEMAS = [
  "bizra.dema.eval_layer2_rubric_pack.v0.1",
  "bizra.dema.eval_layer2_judge_verdict.v0.1",
];

test("Layer 2 schemas appear in KNOWN_SCHEMA_IDS auto-load", () => {
  for (const id of EXPECTED_SCHEMAS) {
    assert.ok(
      KNOWN_SCHEMA_IDS.includes(id),
      `missing ${id} in KNOWN_SCHEMA_IDS — registry auto-load drift`,
    );
    assert.ok(hasKnownSchema(id), `hasKnownSchema(${id}) returned false`);
  }
});

test("Layer 2 schemas resolve to frozen, well-formed schema defs", () => {
  for (const id of EXPECTED_SCHEMAS) {
    const def = getKnownSchema(id);
    assert.ok(def, `getKnownSchema(${id}) returned undefined`);
    assert.equal(def.$id, id, `$id mismatch on ${id}`);
    assert.ok(
      def.properties && Object.keys(def.properties).length > 0,
      `${id} schema has empty properties — likely truncated or malformed`,
    );
    assert.ok(Array.isArray(def.required), `${id} schema missing required[]`);
    assert.ok(Object.isFrozen(def), `${id} schema must be frozen by registry`);
  }
});

test("Layer 2 schemas declare schema-field const matching their $id", () => {
  for (const id of EXPECTED_SCHEMAS) {
    const def = getKnownSchema(id);
    const schemaConst =
      def.properties && def.properties.schema && def.properties.schema.const;
    assert.equal(
      schemaConst,
      id,
      `${id}: properties.schema.const must equal $id — otherwise registry lookup will route but const check will fail`,
    );
  }
});
