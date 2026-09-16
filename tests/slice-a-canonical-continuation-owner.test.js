import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadSeasonHead, resumeSeason, saveSeasonState } from "../packages/receipts/src/season-state-store.js";
import { saveDemaRealmCheckpoint } from "../packages/core/src/dema-realm-checkpoint-writer.js";
import { gatherFirstLookContext, buildFirstLookHome } from "../packages/core/src/dema-first-look-home.js";

const CLI = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));
const REPO = fileURLToPath(new URL("../", import.meta.url));
const COMMIT = "a".repeat(40);
const TREE = "b".repeat(40);
const SEASON = "node0-slice-a-owner";

const baseState = (over = {}) => ({
  season_id: SEASON,
  mission_id: "MISSION-A",
  mission_contract_hash: null,
  mission_phase: "IMPLEMENTATION",
  completed_steps: [],
  next_safe_action: "CONTINUE_LOCAL_CHECKPOINT",
  must_not_repeat: [],
  pending_consent: [],
  last_receipt_hash: null,
  repository_commit: COMMIT,
  repository_tree: TREE,
  saved_at: "2026-09-16T00:00:00Z",
  ...over,
});

async function newHome() {
  return mkdtemp(join(tmpdir(), "dema-slice-a-owner-"));
}

async function seedProjection(home, { missionId = "MISSION-A", next = "CONTINUE_LOCAL_CHECKPOINT" } = {}) {
  await writeFile(join(home, "profile.json"), JSON.stringify({ preferred_name: "Mumu", language_code: "en" }));
  await writeFile(join(home, "active-mission.json"), JSON.stringify({
    mission_id: missionId,
    status: "OPEN",
    next_safe_action: next,
    updated_at_utc: "2026-09-16T00:00:00Z",
  }));
}

async function seedRealmProjection(home, { next = "CONTINUE_LOCAL_CHECKPOINT", at = "2026-09-16T00:00:00Z" } = {}) {
  const saved = await saveDemaRealmCheckpoint(
    {
      label: "Node0 continuation projection",
      stage: "IMPLEMENTATION",
      nextGear: next,
    },
    { demaHome: home, now: new Date(at) },
  );
  assert.equal(saved.saved, true, JSON.stringify(saved));
}

function runChat(home, lines) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, "chat"], {
      cwd: REPO,
      env: {
        ...process.env,
        DEMA_HOME: home,
        DEMA_BANNER_INTERACTIVE: "0",
        NODE_ENV: "test",
        NO_COLOR: "1",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(`${lines.join("\n")}\n`);
  });
}

function runFirstLook(home) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, "--json"], {
      cwd: REPO,
      env: {
        ...process.env,
        DEMA_HOME: home,
        DEMA_NO_TUI: "1",
        NO_COLOR: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`first-look exited ${code}: ${stderr}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`first-look JSON invalid: ${error.message}\n${stdout}`));
      }
    });
  });
}

test("Slice A owner map: verified Season HEAD is authoritative and projections are surfaced", async () => {
  const home = await newHome();
  try {
    await seedProjection(home);
    const saved = await saveSeasonState({ demaHome: home, state: baseState() });
    assert.equal(saved.ok, true, JSON.stringify(saved));

    const ctx = await gatherFirstLookContext({
      demaHome: home,
      missionPointerPath: join(home, "active-mission.json"),
    });
    const homeView = buildFirstLookHome(ctx);
    assert.equal(homeView.continuation.status, "VERIFIED");
    assert.equal(homeView.continuation.owner, "season-state-store/HEAD.json");
    assert.equal(homeView.continuation.mission_id, "MISSION-A");
    assert.equal(homeView.continuation.state_sequence, 1);
    assert.equal(homeView.continuation.receipt_verified, true);
    assert.equal(homeView.continuation.projections.mission_pointer.status, "MATCHING");

    await seedRealmProjection(home);
    const withRealm = await gatherFirstLookContext({ demaHome: home });
    assert.equal(withRealm.continuation.projections.realm_checkpoint.status, "MATCHING");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Slice A owner map: verified owner remains authoritative when projections are absent", async () => {
  const home = await newHome();
  try {
    await saveSeasonState({ demaHome: home, state: baseState() });
    const result = await gatherFirstLookContext({
      demaHome: home,
      missionPointerPath: join(home, "missing-projection.json"),
    });
    assert.equal(result.continuation.status, "VERIFIED");
    assert.equal(result.continuation.projection_only, undefined);
    assert.equal(result.continuation.projections.mission_pointer.status, "ABSENT");
    assert.equal(result.continuation.projections.realm_checkpoint.status, "ABSENT");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Slice A continuation: natural language records C1 through the existing Season writer and survives a fresh process", async () => {
  const home = await newHome();
  try {
    await seedProjection(home);
    const c0 = await saveSeasonState({ demaHome: home, state: baseState() });
    assert.equal(c0.ok, true, JSON.stringify(c0));

    const chat = await runChat(home, ["Continue my Node0 closure work.", "exit"]);
    assert.equal(chat.code, 0, chat.stderr);
    assert.match(chat.stdout, /Routing your request to: dema season continue/);
    assert.match(chat.stdout, /checkpoint/i);
    assert.match(chat.stdout, /Goodbye\./);

    const c1 = await loadSeasonHead({ demaHome: home, seasonId: SEASON });
    assert.equal(c1.ok, true, JSON.stringify(c1));
    assert.equal(c1.state.state_sequence, 2);
    assert.equal(c1.state.mission_id, c0.state.mission_id);
    assert.equal(c1.state.last_receipt_hash, c0.receipt.receipt_hash);
    assert.equal(c1.state.next_safe_action, c0.state.next_safe_action);

    const returned = await runFirstLook(home);
    assert.equal(returned.greeting.text, "Welcome back, Mumu.");
    assert.equal(returned.continuation.state_sequence, 2);
    assert.equal(returned.continuation.mission_id, "MISSION-A");
    assert.equal(returned.continuation.authority_delta, 0);
    assert.equal(returned.boundary.network_used, false);
    assert.equal(returned.boundary.runtime_execution_performed, false);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Slice A owner matrix: projections never become continuation truth", async () => {
  const home = await newHome();
  try {
    await seedProjection(home);
    const projectionOnly = await gatherFirstLookContext({ demaHome: home });
    assert.equal(projectionOnly.continuation.status, "ABSENT");
    assert.equal(projectionOnly.continuation.projection_only, true);
    assert.equal(projectionOnly.continuation.projections.mission_pointer.status, "PRESENT_UNBOUND");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Slice A owner matrix: multiple Seasons are a visible ambiguity", async () => {
  const home = await newHome();
  try {
    await saveSeasonState({ demaHome: home, state: baseState() });
    await saveSeasonState({
      demaHome: home,
      state: baseState({ season_id: "node0-slice-a-owner-2", mission_id: "MISSION-B" }),
    });
    const result = await gatherFirstLookContext({ demaHome: home });
    assert.equal(result.continuation.status, "CONTRADICTION");
    assert.equal(result.continuation.reason, "season_ambiguous");
    assert.deepEqual(result.continuation.season_ids, [SEASON, "node0-slice-a-owner-2"]);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Slice A owner matrix: stale projections are exposed while the verified owner wins", async () => {
  const home = await newHome();
  try {
    await seedProjection(home);
    await seedRealmProjection(home, { at: "2026-09-15T23:00:00Z" });
    await saveSeasonState({ demaHome: home, state: baseState() });
    const result = await gatherFirstLookContext({ demaHome: home });
    assert.equal(result.continuation.status, "VERIFIED");
    assert.equal(result.continuation.projections.mission_pointer.status, "MATCHING");
    assert.equal(result.continuation.projections.realm_checkpoint.status, "STALE");
    assert.equal(result.continuation.next_safe_action, "CONTINUE_LOCAL_CHECKPOINT");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Slice A owner matrix: malformed canonical HEAD blocks read-only recovery", async () => {
  const home = await newHome();
  try {
    await seedProjection(home);
    await saveSeasonState({ demaHome: home, state: baseState() });
    const headPath = join(home, "seasons", SEASON, "HEAD.json");
    const headBefore = await readFile(headPath, "utf8");
    await writeFile(headPath, "{");
    const result = await gatherFirstLookContext({ demaHome: home });
    assert.equal(result.continuation.status, "BLOCKED");
    assert.equal(result.continuation.reason, "malformed_head");
    assert.equal(result.continuation.authority_delta, 0);
    assert.equal(await readFile(headPath, "utf8"), "{");
    assert.notEqual(headBefore, "{");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Slice A owner matrix: malformed Realm projection is visible without displacing the canonical owner", async () => {
  const home = await newHome();
  try {
    await seedProjection(home);
    await saveSeasonState({ demaHome: home, state: baseState() });
    const checkpointPath = join(home, "realm", "last-checkpoint.json");
    await mkdir(join(home, "realm"), { recursive: true });
    await writeFile(checkpointPath, "{");
    const result = await gatherFirstLookContext({ demaHome: home });
    assert.equal(result.continuation.status, "VERIFIED");
    assert.equal(result.checkpoint.checkpoint_present, false);
    assert.equal(result.checkpoint.truth_label, "CHECKPOINT_MALFORMED");
    assert.equal(result.continuation.projections.realm_checkpoint.status, "ABSENT");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Slice A owner matrix: repository mismatch refuses continuation without mutating the owner", async () => {
  const home = await newHome();
  try {
    await saveSeasonState({ demaHome: home, state: baseState() });
    const headBefore = await readFile(join(home, "seasons", SEASON, "HEAD.json"), "utf8");
    const result = await resumeSeason({
      demaHome: home,
      seasonId: SEASON,
      repositoryCommit: "c".repeat(40),
      repositoryTree: TREE,
    });
    assert.equal(result.outcome, "REPOSITORY_MISMATCH");
    assert.equal(await readFile(join(home, "seasons", SEASON, "HEAD.json"), "utf8"), headBefore);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Slice A owner matrix: invalid receipt blocks trust in the owner", async () => {
  const home = await newHome();
  try {
    await seedProjection(home);
    const saved = await saveSeasonState({ demaHome: home, state: baseState() });
    const receipt = JSON.parse(await readFile(saved.receipt_path, "utf8"));
    receipt.saved_at = "2026-09-16T00:00:01Z";
    await writeFile(saved.receipt_path, JSON.stringify(receipt, null, 2) + "\n");
    const result = await gatherFirstLookContext({ demaHome: home });
    assert.equal(result.continuation.status, "BLOCKED");
    assert.equal(result.continuation.reason, "receipt_hash_mismatch");
    assert.equal(result.continuation.authority_delta, 0);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Slice A owner matrix: pending consent survives continuation without becoming approval", async () => {
  const home = await newHome();
  try {
    await seedProjection(home);
    const saved = await saveSeasonState({
      demaHome: home,
      state: baseState({
        must_not_repeat: ["GO: already-consumed local effect"],
        pending_consent: [{ phrase: "GO: bounded local effect", scope: "local" }],
      }),
    });
    assert.equal(saved.ok, true, JSON.stringify(saved));
    const chat = await runChat(home, ["Continue my Node0 closure work.", "exit"]);
    assert.equal(chat.code, 0, chat.stderr);
    const resumed = await loadSeasonHead({ demaHome: home, seasonId: SEASON });
    assert.equal(resumed.ok, true, JSON.stringify(resumed));
    assert.deepEqual(resumed.state.pending_consent, [
      { phrase: "GO: bounded local effect", scope: "local" },
    ]);
    assert.deepEqual(resumed.state.must_not_repeat, ["GO: already-consumed local effect"]);
    assert.equal(resumed.state.state_sequence, 2);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Slice A owner contradictions are visible and read-only recovery does not rewrite state", async () => {
  const cases = [
    ["mission_id", { missionId: "MISSION-B" }, "mission_id_mismatch"],
    ["next_action", { next: "VERIFY_OTHER" }, "next_safe_action_mismatch"],
  ];
  for (const [, projection, reason] of cases) {
    const home = await newHome();
    try {
      await seedProjection(home, projection);
      await saveSeasonState({ demaHome: home, state: baseState() });
      const headBefore = await readFile(join(home, "seasons", SEASON, "HEAD.json"), "utf8");
      const view = buildFirstLookHome(await gatherFirstLookContext({
        demaHome: home,
        missionPointerPath: join(home, "active-mission.json"),
      }));
      assert.equal(view.continuation.status, "CONTRADICTION");
      assert.ok(view.continuation.contradictions.some((entry) => entry.reason === reason));
      assert.equal(await readFile(join(home, "seasons", SEASON, "HEAD.json"), "utf8"), headBefore);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  }
});
