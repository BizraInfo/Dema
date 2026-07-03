// DEMA-STAND-1A — `dema stand` Morning Standing Receipt CLI.
//
// Read-only gatherer: git metadata (spawned `git`, no mutation) plus newest
// gate-log metadata under the local logs dir. Composition happens in the pure
// kernel (packages/core/src/dema-stand.js). The ONLY write path is the
// standing receipt under $DEMA_HOME/stand/receipts, and it requires the exact
// consent phrase. No network, no model call, no content scan, no mint, no URP.

import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, rename, realpath, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { promisify } from "node:util";

import {
  runDemaStand,
  DEMA_STAND_GO_PHRASE,
  DEMA_STAND_TRUTH_LABEL,
} from "../../../../packages/core/src/dema-stand.js";

const execFileAsync = promisify(execFile);

const DEFAULT_LOG_DIR = "/data/bizra/logs";
const COMMIT_KIND_PREFIXES = new Set(["docs", "feat", "fix", "adr"]);

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

async function gitSummary(cwd) {
  const run = async (args) =>
    (await execFileAsync("git", args, { cwd })).stdout.trim();
  const head = await run(["rev-parse", "--short", "HEAD"]);
  const branch = await run(["rev-parse", "--abbrev-ref", "HEAD"]);
  const porcelain = await run(["status", "--porcelain"]);
  const dirty_files = porcelain
    ? porcelain.split("\n").filter(Boolean).length
    : 0;
  let ahead = null;
  try {
    const counted = Number(await run(["rev-list", "--count", "@{upstream}..HEAD"]));
    ahead = Number.isInteger(counted) && counted >= 0 ? counted : null;
  } catch {
    ahead = null; // no upstream configured — honest null, not zero
  }
  const logRaw = await run(["log", "-5", "--format=%h%x09%s"]);
  const recent_commits = logRaw
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [sha, subject = ""] = line.split("\t");
      const prefix = subject.split(":")[0].trim().toLowerCase();
      return { sha, kind: COMMIT_KIND_PREFIXES.has(prefix) ? prefix : "other" };
    });
  return { git: { head, branch, dirty_files, ahead }, recent_commits };
}

// Newest matching gate log: status is parsed from real run markers, and when a
// log has none it is treated as MISSING (unbindable evidence), never as pass.
async function newestGateLog(dir, marker, nowMs, kind) {
  const missing = { status: "missing", age_hours: null, log_path: null, ...(kind === "test" ? { tests_total: null } : {}) };
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return missing;
  }
  let newest = null;
  for (const name of entries) {
    if (!name.includes(marker) || !name.endsWith(".log")) continue;
    try {
      const s = await stat(join(dir, name));
      if (!newest || s.mtimeMs > newest.mtimeMs) newest = { name, mtimeMs: s.mtimeMs };
    } catch {
      /* unreadable entry — skip */
    }
  }
  if (!newest) return missing;
  const log_path = join(dir, newest.name);
  const age_hours = Math.round(Math.max(0, (nowMs - newest.mtimeMs) / 36e5) * 100) / 100;
  let content = "";
  try {
    content = await readFile(log_path, "utf8");
  } catch {
    return missing;
  }
  if (kind === "test") {
    const failMatch = content.match(/^# fail (\d+)/m);
    const totalMatch = content.match(/^# tests (\d+)/m);
    if (!failMatch) return { ...missing, log_path };
    return {
      status: Number(failMatch[1]) === 0 ? "pass" : "fail",
      tests_total: totalMatch ? Number(totalMatch[1]) : null,
      age_hours,
      log_path,
    };
  }
  if (/Clean run: 0 failures/.test(content)) {
    return { status: "pass", age_hours, log_path };
  }
  if (/Exit 1|FAIL/.test(content)) {
    return { status: "fail", age_hours, log_path };
  }
  return { ...missing, log_path };
}

async function readBlockersFile(path) {
  if (!path) return [];
  if (!isAbsolute(path)) {
    throw new Error("--blockers must be an absolute path to a JSON array");
  }
  const parsed = JSON.parse(await readFile(path, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error("--blockers file must contain a JSON array of {id, lens, label}");
  }
  return parsed;
}

async function gatherStandInput(argv) {
  const nowMs = Date.now();
  const logDir = process.env.DEMA_STAND_LOG_DIR || DEFAULT_LOG_DIR;
  const { git, recent_commits } = await gitSummary(process.cwd());
  const [testGate, checkGate] = await Promise.all([
    newestGateLog(logDir, "npm-test", nowMs, "test"),
    newestGateLog(logDir, "npm-check", nowMs, "check"),
  ]);
  const blockers = await readBlockersFile(argValue(argv, "--blockers"));
  const drain = argValue(argv, "--drain") ?? null;
  return {
    observed_at_iso: new Date(nowMs).toISOString(),
    git,
    gates: { test: testGate, check: checkGate },
    blockers,
    drain,
    recent_commits,
  };
}

async function writeStandingReceipt(payload) {
  const home = process.env.DEMA_HOME || join(homedir(), ".dema");
  const dir = join(home, "stand", "receipts");
  await mkdir(dir, { recursive: true });
  const realDir = await realpath(dir);
  const day = payload.observed_at_iso.slice(0, 10);
  const hash8 = payload.content_hash.replace("sha256:", "").slice(0, 8);
  const finalPath = join(realDir, `stand-${day}-${hash8}.json`);
  const tmpPath = `${finalPath}.tmp`;
  await writeFile(tmpPath, JSON.stringify(payload, null, 2), {
    encoding: "utf8",
    mode: 0o600,
    flag: "w",
  });
  await rename(tmpPath, finalPath);
  return finalPath;
}

function gateLine(name, gate) {
  const age = gate.age_hours === null ? "age unknown" : `${gate.age_hours}h old`;
  const total = gate.tests_total ? ` · ${gate.tests_total} tests` : "";
  return `${name} ${gate.status.toUpperCase()}${total} · ${age}`;
}

function renderCard(payload, receiptPath) {
  const { git } = payload.input;
  const fdeCounts = ["inward", "outward", "authority", "economic"]
    .map((k) => `${k.toUpperCase()} ${payload.fde[k].length}`)
    .join(" · ");
  const lines = [
    `DEMA · MORNING STANDING — ${DEMA_STAND_TRUTH_LABEL}`,
    `  observed  ${payload.observed_at_iso}`,
    `  git       ${git.branch} @ ${git.head} · ${git.dirty_files} dirty · ahead ${git.ahead ?? "?"}`,
    `  gates     ${gateLine("test", payload.input.gates.test)} | ${gateLine("check", payload.input.gates.check)}`,
    `  standing  tree_clean=${payload.standing.tree_clean} · stale_proof=${payload.standing.stale_proof}${payload.standing.stale_reasons.length ? ` (${payload.standing.stale_reasons.join(", ")})` : ""}`,
    `  lens      ${payload.fde.lens} [${fdeCounts}]`,
    `  orbit     ${payload.orbit.warning ? `WARNING — ${payload.orbit.reason}` : "ok"}`,
    `  drain     ${payload.drain.status === "declared" ? payload.drain.declared : "not declared (pass --drain less|same|more)"}`,
    "",
    `  ONE ACTION → ${payload.next_action.label}`,
  ];
  if (payload.next_action.command) {
    lines.push(`     $ ${payload.next_action.command}`);
  }
  lines.push(
    "",
    `  receipt   ${receiptPath ?? `not written (requires --receipt --consent "${DEMA_STAND_GO_PHRASE}")`}`,
    "  boundary  read-only compose · no mint · no URP · no network · no live autonomy",
  );
  return lines.join("\n");
}

export async function cmd_stand(ctx) {
  const { argv } = ctx;
  const wantJson = argv.includes("--json");
  const wantReceipt = argv.includes("--receipt");

  let input;
  try {
    input = await gatherStandInput(argv);
  } catch (error) {
    console.error(`Dema error: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const result = runDemaStand({ consent: DEMA_STAND_GO_PHRASE, input });
  if (!result.ok) {
    const message = `standing composition blocked: ${result.blocked_by.join(", ")}`;
    if (wantJson) {
      console.log(JSON.stringify({ ok: false, blocked_by: result.blocked_by }, null, 2));
    } else {
      console.error(`Dema error: ${message}`);
    }
    process.exitCode = 1;
    return;
  }

  let receiptPath = null;
  if (wantReceipt) {
    const consent = argValue(argv, "--consent");
    if (consent !== DEMA_STAND_GO_PHRASE) {
      console.error(
        `Dema error: receipt write requires the exact consent phrase --consent "${DEMA_STAND_GO_PHRASE}"`,
      );
      process.exitCode = 1;
      return;
    }
    receiptPath = await writeStandingReceipt(result.payload);
  }

  if (wantJson) {
    console.log(
      JSON.stringify(
        { ...result.payload, receipt_path: receiptPath },
        null,
        2,
      ),
    );
    return;
  }
  console.log(renderCard(result.payload, receiptPath));
}
