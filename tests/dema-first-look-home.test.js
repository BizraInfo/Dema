import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildFirstLookHome,
  gatherFirstLookContext,
  renderFirstLookHome,
  FIRST_LOOK_HOME_SCHEMA,
} from "../packages/core/src/dema-first-look-home.js";
import { evaluateUxFirstLookEnvelope } from "../packages/core/src/ux-quality-gate.js";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
function ctxWith({ keyPresent = true, mission = null, now, constellation = null, council = null } = {}) {
  return {
    dema_home: "/nonexistent",
    profile: { source_present: true, preferred_name: "Mumu", language_code: null },
    key_present: keyPresent,
    mission,
    constellation,
    council,
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

test("FLM-05 the home screen composes bases and council when injected", () => {
  const envelope = buildFirstLookHome(
    ctxWith({
      mission: OPEN_MISSION,
      constellation: {
        bases: [{ base_id: "base:host" }, { base_id: "base:attached:x" }],
        dark_capacity_gb: 1022.1,
        attached_not_enrolled: 1,
      },
      council: { convened: true, seat_count: 7, reasoning_performed: false },
    }),
  );
  assert.equal(envelope.node.bases_known, 2);
  assert.equal(envelope.node.dark_capacity_gb, 1022.1);
  assert.equal(envelope.node.attached_not_enrolled, 1);
  assert.equal(envelope.node.council_seats, 7);
  // Carried verbatim: the home screen must never present convening as thinking.
  assert.equal(envelope.node.council_reasoning_performed, false);
  const text = renderFirstLookHome(envelope, { noColor: true });
  assert.match(text, /Your node/);
  assert.match(text, /1022\.1 GB unreachable/);
  assert.match(text, /not yet reasoning/);
});

test("FLM-06 NEGATIVE CONTROL — absent awareness degrades, it does not fabricate", () => {
  const envelope = buildFirstLookHome(ctxWith({ mission: OPEN_MISSION }));
  assert.equal(envelope.node.bases_known, null);
  assert.equal(envelope.node.council_seats, null);
  assert.equal(envelope.node.dark_capacity_gb, null);
  const text = renderFirstLookHome(envelope, { noColor: true });
  assert.doesNotMatch(text, /Your node/, "no section without evidence for it");
  // A council that refused must not be reported as seats.
  const refused = buildFirstLookHome(
    ctxWith({ council: { convened: false, reason: "authority_edge_refused" } }),
  );
  assert.equal(refused.node.council_seats, null);
  assert.equal(refused.node.council_reasoning_performed, null);
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

test("FLH-NODE-01 home card surfaces an injected constellation (injectable contract)", async () => {
  const { buildBaseConstellation } = await import(
    "../packages/core/src/node0-base-constellation.js"
  );
  const constellation = buildBaseConstellation({
    disks: [
      {
        name: "nvme0n1",
        model: "fixture-disk",
        sectors: 2000409,
        partitions: [
          { name: "nvme0n1p1", sectors: 1000204 },
          { name: "nvme0n1p2", sectors: 1000205 },
        ],
      },
    ],
    mounts: [{ device: "/dev/nvme0n1p1", mount_point: "/" }],
    attached: [],
  });
  const scratch = mkdtempSync(join(tmpdir(), "flh-unit-"));
  let envelope;
  try {
    const ctx = await gatherFirstLookContext({ demaHome: scratch });
    envelope = buildFirstLookHome({ ...ctx, constellation });
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  assert.equal(envelope.node.bases_known, 1);
  assert.equal(typeof envelope.node.dark_capacity_gb, "number");
});

test("FLH-NODE-02 bare CLI shows the node's real bases — the eyes reach the face", () => {
  // End-to-end against live /proc+/sys (same precedent as the constellation
  // CLI tests): the home card must not report null bases on a host that has
  // observable storage. Runs against a scratch DEMA_HOME, never operator state.
  const BIN = fileURLToPath(new URL("../bin/dema", import.meta.url));
  const scratch = mkdtempSync(join(tmpdir(), "flh-node-"));
  try {
    const out = execFileSync(
      "node",
      [BIN, "--json"],
      {
        env: { ...process.env, NO_COLOR: "1", DEMA_NO_TUI: "1", DEMA_HOME: scratch },
        timeout: 30000,
      },
    ).toString();
    const envelope = JSON.parse(out);
    assert.equal(
      typeof envelope.node.bases_known, "number",
      `home card must carry observed base count, got ${JSON.stringify(envelope.node)}`,
    );
    assert.ok(envelope.node.bases_known >= 1, "a booted Linux host always observes at least its own base");
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
