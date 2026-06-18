import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildFirstLookHome,
  gatherFirstLookContext,
  renderFirstLookHome,
  FIRST_LOOK_HOME_SCHEMA,
} from "../packages/core/src/dema-first-look-home.js";
import { evaluateUxFirstLookEnvelope } from "../packages/core/src/ux-quality-gate.js";

test("first-look home schema and companion fields", async () => {
  const ctx = await gatherFirstLookContext();
  const envelope = buildFirstLookHome(ctx);
  assert.equal(envelope.schema, FIRST_LOOK_HOME_SCHEMA);
  assert.equal(envelope.mode, "preview_only");
  assert.equal(envelope.simple_actions.length, 3);
  assert.ok(envelope.greeting.text.length > 0);
  assert.ok(envelope.recommended_next_step.length > 0);
  assert.ok(envelope.proof_boundary.what_this_does_not_prove);
});

test("first-look render passes UX gate", async () => {
  const ctx = await gatherFirstLookContext();
  const envelope = buildFirstLookHome(ctx);
  const ux = evaluateUxFirstLookEnvelope(envelope);
  assert.equal(ux.pass, true, JSON.stringify(ux));
  const text = renderFirstLookHome(envelope, { noColor: true });
  assert.doesNotMatch(text, /Ring 0/i);
  assert.doesNotMatch(text, /\bURP\b/);
});

test("first-look greeting uses profile preferred_name", async () => {
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const home = await mkdtemp(join(tmpdir(), "dema-first-look-"));
  try {
    await writeFile(
      join(home, "profile.json"),
      JSON.stringify({ preferred_name: "Mumu", language_code: "en" }),
    );
    const ctx = await gatherFirstLookContext({ demaHome: home });
    const envelope = buildFirstLookHome(ctx);
    assert.match(envelope.greeting.text, /Mumu/);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
