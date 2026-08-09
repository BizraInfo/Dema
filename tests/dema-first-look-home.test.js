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

// MISSION-POINTER WIRE. Measured 2026-08-09: `dema` greeted the operator and
// recommended reading receipts while a real mission was open, because nothing
// in the tree read ACTIVE_MISSION.json (0 references, positive control passed).
// The human was therefore the pointer. These pin the wire and its fail-soft.
async function seededHome(t, profile = { preferred_name: "Mumu" }) {
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const home = await mkdtemp(join(tmpdir(), "dema-first-look-mission-"));
  await writeFile(join(home, "profile.json"), JSON.stringify(profile));
  t.after(() => rm(home, { recursive: true, force: true }));
  return home;
}

// The kernel is pure, so these build ctx directly — no temp home, no key
// fixture, no machine coupling.
function ctxWith({ keyPresent = true, mission = null, now } = {}) {
  return {
    dema_home: "/nonexistent",
    profile: { source_present: true, preferred_name: "Mumu", language_code: null },
    key_present: keyPresent,
    mission,
    now: now ?? new Date("2026-08-09T05:00:00Z"),
  };
}

const OPEN_MISSION = Object.freeze({
  status: "SEASON_TEST_STATUS",
  next_safe_action: "DO_THE_NAMED_THING",
  updated_at_utc: "2026-08-09T00:00:00Z",
});

test("FLM-01 an open mission outranks the generic next step", () => {
  const envelope = buildFirstLookHome(ctxWith({ mission: OPEN_MISSION }));
  assert.match(envelope.recommended_next_step, /DO_THE_NAMED_THING/);
  assert.equal(envelope.mission.present, true);
  assert.equal(envelope.mission.status, "SEASON_TEST_STATUS");
  assert.equal(envelope.mission.age_hours, 5);
  // The pointer must never read as authority.
  assert.equal(envelope.mission.authority, "descriptive_only");
  assert.match(renderFirstLookHome(envelope, { noColor: true }), /Open mission/);
});

test("FLM-01b setup still outranks the mission — you cannot sign without a key", () => {
  const envelope = buildFirstLookHome(
    ctxWith({ keyPresent: false, mission: OPEN_MISSION }),
  );
  assert.match(envelope.recommended_next_step, /authorship key/);
  // The mission is still SHOWN, just not recommended over setup.
  assert.equal(envelope.mission.present, true);
});

test("FLM-02 NEGATIVE CONTROL — no pointer keeps the generic next step", async (t) => {
  const { join } = await import("node:path");
  const home = await seededHome(t);
  const ctx = await gatherFirstLookContext({
    demaHome: home,
    missionPointerPath: join(home, "definitely-absent.json"),
  });
  const envelope = buildFirstLookHome(ctx);
  assert.equal(envelope.mission.present, false);
  assert.doesNotMatch(envelope.recommended_next_step, /Continue the open mission/);
  assert.doesNotMatch(
    renderFirstLookHome(envelope, { noColor: true }),
    /Open mission/,
  );
});

test("FLM-03 a malformed pointer degrades, it does not take the home screen down", async (t) => {
  const { writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const home = await seededHome(t);
  const pointer = join(home, "broken.json");
  await writeFile(pointer, "{ this is not json");
  const ctx = await gatherFirstLookContext({
    demaHome: home,
    missionPointerPath: pointer,
  });
  const envelope = buildFirstLookHome(ctx);
  assert.equal(envelope.mission.present, false);
  assert.ok(envelope.recommended_next_step.length > 0);
});

test("FLM-04 a pointer without next_safe_action does not fabricate one", async (t) => {
  const { writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const home = await seededHome(t);
  const pointer = join(home, "no-action.json");
  await writeFile(pointer, JSON.stringify({ status: "SOME_STATUS" }));
  const ctx = await gatherFirstLookContext({
    demaHome: home,
    missionPointerPath: pointer,
  });
  const envelope = buildFirstLookHome(ctx);
  assert.equal(envelope.mission.present, true);
  assert.equal(envelope.mission.next_safe_action, null);
  assert.doesNotMatch(envelope.recommended_next_step, /Continue the open mission/);
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
