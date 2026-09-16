import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { saveDemaRealmCheckpoint } from "../packages/core/src/dema-realm-checkpoint-writer.js";

const CLI_PATH = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));

function runFirstLook(home, missionPointer) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_PATH, "--json"], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        DEMA_HOME: home,
        BIZRA_ACTIVE_MISSION: missionPointer,
        DEMA_NO_TUI: "1",
        NO_COLOR: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk.toString("utf8")));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString("utf8")));
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

function runChat(home, lines) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_PATH, "chat"], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        DEMA_HOME: home,
        BIZRA_ACTIVE_MISSION: join(home, "active-mission.json"),
        DEMA_BANNER_INTERACTIVE: "0",
        NODE_ENV: "test",
        NO_COLOR: "1",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk.toString("utf8")));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString("utf8")));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(`${lines.join("\n")}\n`);
  });
}

test("Slice A: a fresh Dema process restores the same mission checkpoint", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-slice-a-"));
  const missionPointer = join(home, "active-mission.json");
  try {
    await writeFile(
      join(home, "profile.json"),
      JSON.stringify({ preferred_name: "Mumu", language_code: "en" }),
    );
    await writeFile(
      missionPointer,
      JSON.stringify({
        status: "OPEN",
        next_safe_action: "Rebind the current Node0 frontier",
        updated_at_utc: "2026-09-16T00:00:00.000Z",
      }),
    );
    const saved = await saveDemaRealmCheckpoint(
      {
        label: "Node0 source convergence",
        stage: "VERIFY",
        nextGear: "Continue the current frontier",
        resumeCommand: "dema chat",
      },
      { demaHome: home, now: new Date("2026-09-16T01:00:00.000Z") },
    );
    assert.equal(saved.saved, true);

    const checkpointBeforeReturn = await readFile(
      join(home, "realm", "last-checkpoint.json"),
      "utf8",
    );
    const chat = await runChat(home, ["DEMA, where were we?", "exit"]);
    assert.equal(chat.code, 0);
    assert.match(chat.stdout, /Routing your request to: dema --safe/);
    assert.match(chat.stdout, /Open mission/);
    assert.match(chat.stdout, /Last checkpoint/);
    assert.match(chat.stdout, /Node0 source convergence/);
    assert.match(chat.stdout, /Goodbye\./);
    assert.equal(
      await readFile(join(home, "realm", "last-checkpoint.json"), "utf8"),
      checkpointBeforeReturn,
    );

    const firstProcess = await runFirstLook(home, missionPointer);
    const secondProcess = await runFirstLook(home, missionPointer);

    assert.equal(firstProcess.greeting.text, "Welcome back, Mumu.");
    assert.equal(firstProcess.mission.present, true);
    assert.equal(firstProcess.checkpoint.present, true);
    assert.equal(firstProcess.checkpoint.label, "Node0 source convergence");
    assert.deepEqual(secondProcess.checkpoint, firstProcess.checkpoint);
    assert.equal(secondProcess.mission.status, "OPEN");
    assert.equal(secondProcess.boundary.runtime_execution_performed, false);
    assert.equal(secondProcess.boundary.network_used, false);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
