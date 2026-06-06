import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

function localDemaHome() {
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

function isoDate(now) {
  return now.toISOString().slice(0, 10);
}

export async function recordTodayTick({
  root = localDemaHome(),
  now = new Date(),
  status,
  source = "dema.cli.today",
} = {}) {
  const memoryRoot = join(root, "memory");
  await mkdir(memoryRoot, { recursive: true });

  const tick = {
    schema: "bizra.dema.today_tick.v0.1",
    date: isoDate(now),
    recordedAt: now.toISOString(),
    source,
    node0Ready: Boolean(status?.ready),
    consoleReady: Boolean(status?.consoleReady),
    activationGate: status?.activationGate ?? "unknown",
    daemonStatus: status?.daemonStatus ?? "unknown",
    missionExecuted: false,
    runtimePulse: { fired: false },
    nextArtifact: status?.proof?.nextArtifact ?? "ARTIFACT-011",
    nextAdmissibleAction: status?.nextAdmissibleAction ?? "complete_setup",
  };

  const tickPath = join(memoryRoot, "today.json");
  await writeFile(tickPath, `${JSON.stringify(tick, null, 2)}\n`, "utf8");
  return { path: tickPath, tick };
}

export async function readTodayTick(root = localDemaHome()) {
  const tickPath = join(root, "memory", "today.json");
  const raw = await readFile(tickPath, "utf8");
  return JSON.parse(raw);
}
