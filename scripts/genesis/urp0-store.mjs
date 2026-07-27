// BIZRA-GENESIS-NODE0-URP-LOCAL-IGNITION-1A · GENESIS_RUNTIME_SPINE_1A.0
//
// I/O TIER — durable URP-0 journal. This is the only module in the genesis spine
// permitted to write, and it may write nowhere but the authorized state root.
//
// Guarantees:
//   append-only          a new event may only extend the chain from the head
//   hash-chained         prev_event links every event to its predecessor
//   deterministic root   the state root is a pure function of the journal
//   atomic persistence   tmp file + fsync + rename, never a partial journal
//   restart reconstruct  state is rebuilt from the journal alone
//   duplicate rejection  refused by the kernel before anything touches disk
//   0700 dirs / 0600 files
//   no hidden writes     every path written is recorded in declaredWritePaths()

import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync, existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { makeUrp0Event, reduceUrp0Events, URP0_GENESIS_EVENT_ID } from "../../packages/genesis/src/urp0-kernel.js";

export const JOURNAL_FILENAME = "journal.ndjson";

// Append-only log of every path this process wrote, in order. An ARRAY, not a
// Set: callers snapshot the length and diff, so "what did THIS mission write"
// stays answerable even when the same path is written twice. A Set would dedupe
// the second write away and make the no-hidden-writes check vacuous.
const writeLog = [];

// All local state lives under DEMA_HOME or ~/.dema — never beside the source.
export function resolveStateRootDir(env = process.env) {
  const home = env.DEMA_HOME && env.DEMA_HOME !== "" ? env.DEMA_HOME : join(homedir(), ".dema");
  return resolve(join(home, "genesis", "urp0"));
}

export function journalPath(stateRootDir) {
  return join(stateRootDir, JOURNAL_FILENAME);
}

export function writeLogLength() {
  return writeLog.length;
}

// Every distinct path written since the given mark. This is the evidence SAT-4
// judges: a write anywhere but the authorized state root shows up here.
export function declaredWritePaths(since = 0) {
  return [...new Set(writeLog.slice(since))].sort();
}

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
}

// tmp + fsync + rename. The journal is rewritten whole on each append rather
// than O_APPENDed, because rename is the only genuinely atomic filesystem
// primitive available here and a torn append would corrupt the chain.
// ponytail: whole-file rewrite; the genesis journal is a dozen events. If it
// ever grows past a few thousand, segment it — do not switch to raw append.
function atomicWrite(path, text) {
  ensureDir(dirname(path));
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, text, { mode: 0o600 });
  const fd = openSync(tmp, "r+");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, path);
  writeLog.push(path);
}

export function loadEvents(stateRootDir) {
  const path = journalPath(stateRootDir);
  if (!existsSync(path)) return [];
  const text = readFileSync(path, "utf8");
  const lines = text.split("\n").filter((l) => l !== "");
  return lines.map((line, i) => {
    try {
      return JSON.parse(line);
    } catch {
      throw new Error(`journal_line_unparseable:${i + 1}`);
    }
  });
}

// Reconstruct authoritative state from persisted evidence alone. A journal that
// does not replay is a hard failure — never a fresh start, which would silently
// discard history.
export function reconstruct(stateRootDir) {
  const events = loadEvents(stateRootDir);
  const replay = reduceUrp0Events(events);
  return { events, replay };
}

// Append one event. The kernel validates the WHOLE resulting journal before a
// single byte is written, so an invalid transition can never reach disk.
export function appendEvent(stateRootDir, kind, payload) {
  const events = loadEvents(stateRootDir);
  const current = reduceUrp0Events(events);
  if (!current.ok) {
    return { ok: false, blocked_by: current.blocked_by, event: null, replay: current };
  }
  const head = current.state?.head ?? { seq: 0, event_id: URP0_GENESIS_EVENT_ID };
  const event = makeUrp0Event({ seq: head.seq + 1, kind, payload, prev_event: head.event_id });
  const candidate = [...events, event];
  const next = reduceUrp0Events(candidate);
  if (!next.ok) {
    return { ok: false, blocked_by: next.blocked_by, event: null, replay: next };
  }
  atomicWrite(journalPath(stateRootDir), `${candidate.map((e) => JSON.stringify(e)).join("\n")}\n`);
  return { ok: true, blocked_by: [], event, replay: next };
}

// A named side artifact (receipt, judgment, block0) written beside the journal.
// Content-addressed filenames so a rerun is idempotent rather than duplicating.
export function writeArtifact(stateRootDir, name, body) {
  const path = join(stateRootDir, "artifacts", name);
  atomicWrite(path, `${JSON.stringify(body, null, 2)}\n`);
  return path;
}

export function readArtifact(stateRootDir, name) {
  const path = join(stateRootDir, "artifacts", name);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

// Mode proof for the evidence pack: the operator can see 0700/0600 was actually
// applied, not merely requested.
export function statePermissions(stateRootDir) {
  const out = {};
  const dir = stateRootDir;
  if (existsSync(dir)) out[dir] = (statSync(dir).mode & 0o777).toString(8).padStart(3, "0");
  const jp = journalPath(stateRootDir);
  if (existsSync(jp)) out[jp] = (statSync(jp).mode & 0o777).toString(8).padStart(3, "0");
  const art = join(stateRootDir, "artifacts");
  if (existsSync(art)) out[art] = (statSync(art).mode & 0o777).toString(8).padStart(3, "0");
  return out;
}
