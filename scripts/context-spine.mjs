#!/usr/bin/env node
// BIZRA-CONTEXT-SPINE-1A — bounded gatherer, projection writer, and lifecycle CLI.
// Local filesystem + Git only. No runtime, model, provider, or network effect.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { appendEvent, buildEvent } from "../packages/core/src/event-log.js";
import {
  buildContextEvent,
  buildContextLock,
  renderProjection,
  resolveContext,
  verifyContextLock,
  verifyProjection,
} from "../packages/core/src/context-spine.js";
import { sha256 } from "../packages/consent/src/consent-common.js";

const DEFAULT_REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_NODE_ROOT = resolve(DEFAULT_REPO_ROOT, "../..");
const PROJECTION_TARGETS = Object.freeze([
  ["codex", "AGENTS.md"],
  ["claude", "CLAUDE.md"],
]);

function pathInside(child, parent) {
  const rel = relative(resolve(parent), resolve(child));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function git(repoRoot, args) {
  try {
    return execFileSync("git", ["-C", repoRoot, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    throw new Error(`GIT_BIND_FAILED: ${error.stderr?.trim() || error.message}`);
  }
}

export function buildPhysicalState({ cwd, repoRoot } = {}) {
  const resolvedCwd = resolve(cwd || process.cwd());
  const resolvedRepoRoot = resolve(repoRoot || DEFAULT_REPO_ROOT);
  if (!pathInside(resolvedCwd, resolvedRepoRoot)) {
    throw new Error("REPO_ROOT_MISMATCH: cwd is outside repo root");
  }
  const status = execFileSync(
    "git",
    ["-C", resolvedRepoRoot, "status", "--porcelain=v1", "-z", "--untracked-files=all"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const branch = git(resolvedRepoRoot, ["symbolic-ref", "--short", "-q", "HEAD"]) || "DETACHED";
  return {
    cwd: resolvedCwd,
    repo_root: resolvedRepoRoot,
    repo: basename(resolvedRepoRoot),
    branch,
    head: git(resolvedRepoRoot, ["rev-parse", "HEAD"]),
    tree: git(resolvedRepoRoot, ["rev-parse", "HEAD^{tree}"]),
    dirty_digest: `sha256:${sha256(status)}`,
  };
}

function readRequired(path, label) {
  if (!existsSync(path)) throw new Error(`${label}_MISSING: ${path}`);
  return { path, content: readFileSync(path, "utf8") };
}

export function collectAncestorContexts({ cwd, repoRoot } = {}) {
  const resolvedCwd = resolve(cwd || process.cwd());
  const resolvedRepoRoot = resolve(repoRoot || DEFAULT_REPO_ROOT);
  if (!pathInside(resolvedCwd, resolvedRepoRoot)) {
    throw new Error("REPO_ROOT_MISMATCH: cwd is outside repo root");
  }

  const directories = [];
  for (let current = resolvedCwd; current !== resolvedRepoRoot; current = dirname(current)) {
    directories.push(current);
  }
  directories.reverse();
  return directories.flatMap((directory) => {
    const candidate = join(directory, "BIZRA.md");
    return existsSync(candidate) ? [readRequired(candidate, "SUBTREE_CONTEXT")] : [];
  });
}

export function collectContext({ cwd, repoRoot, nodeRoot } = {}) {
  const resolvedCwd = resolve(cwd || process.cwd());
  const resolvedRepoRoot = resolve(repoRoot || DEFAULT_REPO_ROOT);
  const resolvedNodeRoot = resolve(nodeRoot || DEFAULT_NODE_ROOT);
  const physical_state = buildPhysicalState({ cwd: resolvedCwd, repoRoot: resolvedRepoRoot });
  const node = readRequired(join(resolvedNodeRoot, "BIZRA.md"), "NODE_CONTEXT");
  const repository = readRequired(join(resolvedRepoRoot, "BIZRA.md"), "REPOSITORY_CONTEXT");
  const subtree = collectAncestorContexts({ cwd: resolvedCwd, repoRoot: resolvedRepoRoot });
  return {
    layers: [node, repository, ...subtree],
    physical_state,
  };
}

function optionValue(options, key, fallback) {
  return options[key] === undefined ? fallback : options[key];
}

function parseArgs(argv) {
  const command = argv[0] || "help";
  const options = {};
  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json" || arg === "--force") {
      options[arg.slice(2).replaceAll("-", "_")] = true;
      continue;
    }
    if (!arg.startsWith("--") || !argv[index + 1] || argv[index + 1].startsWith("--")) {
      throw new Error(`invalid option: ${arg}`);
    }
    options[arg.slice(2).replaceAll("-", "_")] = argv[++index];
  }
  return { command, options };
}

function missionFromOptions(options) {
  const mission_id = options.mission_id;
  const contract_version = optionValue(options, "contract_version", "1");
  const lease_id = options.lease_id;
  if (!mission_id || !lease_id) throw new Error("MISSION_REQUIRED: --mission-id and --lease-id");
  return { mission_id, contract_version, lease_id };
}

function sessionFromOptions(options) {
  const tool = options.tool;
  const session_id = options.session_id;
  if (!tool || !session_id) throw new Error("SESSION_REQUIRED: --tool and --session-id");
  return {
    tool,
    session_id,
    started_at: optionValue(options, "started_at", new Date().toISOString()),
  };
}

function demaHome(options) {
  return resolve(optionValue(options, "dema_home", process.env.DEMA_HOME || join(homedir(), ".dema")));
}

function writeAtomic(path, content, mode = 0o600) {
  mkdirSync(dirname(path), { recursive: true, mode: path.endsWith("context.lock.json") ? 0o700 : 0o755 });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, content, { encoding: "utf8", mode });
  renameSync(temporary, path);
}

function writeJson(path, value) {
  writeAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}

function resolvedForWrite(collected, mission) {
  return resolveContext({
    layers: collected.layers,
    operation_class: "write",
    mission,
  });
}

export function buildEventForAppend(input) {
  const draft = buildContextEvent(input);
  return buildEvent({
    ...draft,
    boundary: {
      ...draft.boundary,
      evidence_workspace_mutation: true,
      event_log_appended: true,
    },
  });
}

function projectionFiles(repoRoot, resolved) {
  return PROJECTION_TARGETS.map(([target, filename]) => ({
    target,
    path: join(repoRoot, filename),
    content: renderProjection({ target, resolved }),
  }));
}

export function writeProjections({ repoRoot, resolved, force = false } = {}) {
  const files = projectionFiles(resolve(repoRoot), resolved);
  for (const file of files) {
    if (existsSync(file.path) && !force) {
      throw new Error(`PROJECTION_TARGET_EXISTS: ${file.path}; pass --force inside the lease`);
    }
  }
  for (const file of files) writeAtomic(file.path, file.content, 0o644);
  return files.map(({ target, path }) => ({ target, path }));
}

function bind(options) {
  const repoRoot = resolve(optionValue(options, "repo_root", DEFAULT_REPO_ROOT));
  const nodeRoot = resolve(optionValue(options, "node_root", DEFAULT_NODE_ROOT));
  const collected = collectContext({ cwd: optionValue(options, "cwd", process.cwd()), repoRoot, nodeRoot });
  const mission = missionFromOptions(options);
  const session = sessionFromOptions(options);
  const resolved = resolvedForWrite(collected, mission);
  if (!resolved.ok) throw new Error(`CONTEXT_REFUSED: ${resolved.blocked_by.join(",")}`);
  const lock = buildContextLock({
    resolved,
    physical_state: collected.physical_state,
    mission,
    session,
    observed_at_iso: optionValue(options, "observed_at", new Date().toISOString()),
  });
  const home = demaHome(options);
  const lockPath = join(home, "context.lock.json");
  writeJson(lockPath, lock);
  const event = buildEventForAppend({ event_type: "CONTEXT_BOUND", lock, session, recorded_at_iso: options.recorded_at });
  const append = appendEvent({ home, event });
  return { resolved, lock, lock_path: lockPath, event, append };
}

function project(options) {
  const repoRoot = resolve(optionValue(options, "repo_root", DEFAULT_REPO_ROOT));
  const nodeRoot = resolve(optionValue(options, "node_root", DEFAULT_NODE_ROOT));
  const collected = collectContext({ cwd: optionValue(options, "cwd", repoRoot), repoRoot, nodeRoot });
  const mission = missionFromOptions(options);
  const resolved = resolvedForWrite(collected, mission);
  if (!resolved.ok) throw new Error(`CONTEXT_REFUSED: ${resolved.blocked_by.join(",")}`);
  return { resolved, projections: writeProjections({ repoRoot, resolved, force: options.force === true }) };
}

function closeSession(options) {
  const repoRoot = resolve(optionValue(options, "repo_root", DEFAULT_REPO_ROOT));
  const nodeRoot = resolve(optionValue(options, "node_root", DEFAULT_NODE_ROOT));
  const home = demaHome(options);
  const lockPath = join(home, "context.lock.json");
  if (!existsSync(lockPath)) throw new Error(`CONTEXT_LOCK_MISSING: ${lockPath}`);
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  const collected = collectContext({ cwd: optionValue(options, "cwd", process.cwd()), repoRoot, nodeRoot });
  const resolved = resolveContext({
    layers: collected.layers,
    operation_class: "write",
    mission: lock.mission,
  });
  const verified = verifyContextLock(lock, { resolved, physical_state: collected.physical_state });
  if (!verified.ok) throw new Error(`CONTEXT_LOCK_REFUSED: ${verified.blocked_by.join(",")}`);
  const session = sessionFromOptions(options);
  if (session.session_id !== lock.session.session_id || session.tool !== lock.session.tool) {
    throw new Error("SESSION_MISMATCH: close must use the bound session identity");
  }
  const event = buildEventForAppend({
      event_type: "SESSION_RECEIPT",
      lock,
      session,
      outcome: optionValue(options, "outcome", "ok"),
      summary: {
        next_frontier: optionValue(options, "next_frontier", "NONE"),
        receipt_status: "LOCAL_ONLY",
      },
      recorded_at_iso: options.recorded_at,
    });
  const append = appendEvent({ home, event });
  return { lock_path: lockPath, verified, event, append };
}

function verify(options) {
  const repoRoot = resolve(optionValue(options, "repo_root", DEFAULT_REPO_ROOT));
  const nodeRoot = resolve(optionValue(options, "node_root", DEFAULT_NODE_ROOT));
  const home = demaHome(options);
  const lockPath = join(home, "context.lock.json");
  if (!existsSync(lockPath)) throw new Error(`CONTEXT_LOCK_MISSING: ${lockPath}`);
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  const collected = collectContext({ cwd: optionValue(options, "cwd", process.cwd()), repoRoot, nodeRoot });
  const resolved = resolveContext({ layers: collected.layers, operation_class: "write", mission: lock.mission });
  const projectionResults = projectionFiles(repoRoot, resolved).map((file) => ({
    target: file.target,
    path: file.path,
    ...verifyProjection(readFileSync(file.path, "utf8"), { target: file.target, resolved }),
  }));
  return {
    lock_path: lockPath,
    lock: verifyContextLock(lock, { resolved, physical_state: collected.physical_state }),
    projections: projectionResults,
    effective_context_sha256: resolved.effective_context_sha256,
  };
}

function output(value, json) {
  if (json) console.log(JSON.stringify(value, null, 2));
  else console.log(JSON.stringify(value, null, 2));
}

function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (command === "help") {
    console.log("Usage: node scripts/context-spine.mjs <project|bind|close|verify> [options] --json");
    return;
  }
  const result =
    command === "project"
      ? project(options)
      : command === "bind"
        ? bind(options)
        : command === "close"
          ? closeSession(options)
          : command === "verify"
            ? verify(options)
            : (() => { throw new Error(`unknown command: ${command}`); })();
  output(result, options.json === true);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
