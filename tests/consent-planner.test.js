import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAnalogicalNotes,
  extractIntentShape
} from "../packages/consent/src/consent-extract.js";

test("intent extraction excludes unsafe home-relative file references from permissions", () => {
  const shape = extractIntentShape(
    "Fix ../secrets/auth.py and /tmp/root.js and ~/private/key.py then run pytest"
  );

  assert.deepEqual(shape.unsafe_file_references, [
    "../secrets/auth.py",
    "/tmp/root.js",
    "~/private/key.py"
  ]);

  assert.ok(shape.permissions.every((permission) => (
    permission.resource_id !== "file:../secrets/auth.py" &&
    permission.resource_id !== "file:/tmp/root.js" &&
    permission.resource_id !== "file:~/private/key.py"
  )));

  assert.ok(shape.permissions.some((p) => p.resource_id === "command:pytest"));
  assert.equal(shape.risk_level, "high");
});

test("unsafe file references produce a high-severity consent note", () => {
  const shape = extractIntentShape("Review ~/private/key.py");
  const notes = buildAnalogicalNotes(
    "Review ~/private/key.py",
    shape.permissions,
    shape.unsafe_file_references
  );

  assert.ok(notes.some((note) => (
    note.code === "unsafe_file_reference" &&
    note.severity === "high"
  )));
});
