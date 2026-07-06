// MONITOR-GATHERER-1A — read-only collection of real repo surfaces into the
// raw-artifact shape the pure kernel derives from. This file owns ALL effects
// (fs, git, env); the derivation itself lives in packages/core and stays pure.
// No daemon, no network, no write path of any kind.

import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";

import {
  buildDemaCapabilityTruthRegistry,
  REQUIRED_CAPABILITY_IDS,
} from "../../../../packages/core/src/dema-capability-truth-registry.js";

const execFileAsync = promisify(execFile);
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const DEFAULT_LOG_DIR = "/data/bizra/logs";
const STALE_THRESHOLD_HOURS = 24;

async function newestGateLogAgeHours(dir, marker, nowMs) {
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return null;
  }
  let newest = null;
  for (const name of entries) {
    if (!name.includes(marker) || !name.endsWith(".log")) continue;
    try {
      const s = await stat(join(dir, name));
      if (!newest || s.mtimeMs > newest) newest = s.mtimeMs;
    } catch {
      /* unreadable entry — skip */
    }
  }
  if (newest === null) return null;
  return Math.round(Math.max(0, (nowMs - newest) / 36e5) * 100) / 100;
}

async function gitFacts() {
  const run = async (args) => (await execFileAsync("git", args, { cwd: REPO_ROOT })).stdout.trim();
  const head_sha = await run(["rev-parse", "--short", "HEAD"]);
  const porcelain = await run(["status", "--porcelain"]);
  const dirty_count = porcelain === "" ? 0 : porcelain.split("\n").length;
  return { head_sha, dirty_count };
}

async function readRepoText(relPath) {
  try {
    return await readFile(join(REPO_ROOT, relPath), "utf8");
  } catch {
    return "";
  }
}

async function standReceiptFacts(demaHome) {
  const dir = join(demaHome, "stand", "receipts");
  let names;
  try {
    names = (await readdir(dir)).filter((n) => n.endsWith(".json"));
  } catch {
    return [];
  }
  const out = [];
  for (const name of names.sort()) {
    let evidence_refs = 0;
    try {
      const parsed = JSON.parse(await readFile(join(dir, name), "utf8"));
      const gates = parsed?.input?.gates ?? {};
      evidence_refs = [gates.test?.log_path, gates.check?.log_path].filter(Boolean).length;
    } catch {
      /* unreadable receipt — fail closed to zero evidence refs */
    }
    out.push({ id: name, evidence_refs });
  }
  return out;
}

export async function collectMonitorRawFacts({ ciAvailableDeclared = true } = {}) {
  const nowMs = Date.now();
  const logDir = process.env.DEMA_STAND_LOG_DIR || DEFAULT_LOG_DIR;
  const demaHome = process.env.DEMA_HOME || join(homedir(), ".dema");

  const registryRows = buildDemaCapabilityTruthRegistry({}).capabilities.map((row) => ({
    capability_id: row.capability_id,
    source_paths: [...(row.evidence?.source_paths ?? [])],
    test_paths: [...(row.evidence?.test_paths ?? [])],
    review_gate_paths: [...(row.evidence?.review_gate_paths ?? [])],
  }));

  const uniqueTestPaths = [...new Set(registryRows.flatMap((r) => r.test_paths))];
  const test_paths_present = {};
  for (const p of uniqueTestPaths) {
    try {
      await stat(join(REPO_ROOT, p));
      test_paths_present[p] = true;
    } catch {
      test_paths_present[p] = false;
    }
  }

  const [git, test_age_hours, check_age_hours, check_source, current_limits_text, testing_text, receipts_raw] =
    await Promise.all([
      gitFacts(),
      newestGateLogAgeHours(logDir, "npm-test", nowMs),
      newestGateLogAgeHours(logDir, "npm-check", nowMs),
      readRepoText("scripts/check.mjs"),
      readRepoText("docs/CURRENT_LIMITS.md"),
      readRepoText("docs/TESTING.md"),
      standReceiptFacts(demaHome),
    ]);

  return {
    git,
    gate_logs: { test_age_hours, check_age_hours, stale_threshold_hours: STALE_THRESHOLD_HOURS },
    ci_available_declared: ciAvailableDeclared,
    registry: { required_ids: [...REQUIRED_CAPABILITY_IDS], rows: registryRows },
    artifacts: { check_source, current_limits_text, testing_text, test_paths_present },
    receipts_raw,
  };
}
