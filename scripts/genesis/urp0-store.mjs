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

import {
  chmodSync,
  closeSync,
  constants as FS_CONSTANTS,
  existsSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { canonicalizeJsonV1 } from "../../packages/canon/src/canonical-json-v1.js";
import { makeUrp0Event, reduceUrp0Events, URP0_GENESIS_EVENT_ID } from "../../packages/genesis/src/urp0-kernel.js";
import {
  packetIdentityDigest,
  verifySatEvidencePacket,
} from "../../packages/genesis/src/urp0-sat-evidence.js";

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

function bytesSha256(bytes) {
  return "sha256:" + createHash("sha256").update(bytes).digest("hex");
}

function sameStat(a, b) {
  return a.dev === b.dev &&
    a.ino === b.ino &&
    a.size === b.size &&
    a.mode === b.mode &&
    a.mtimeMs === b.mtimeMs &&
    a.ctimeMs === b.ctimeMs;
}

function readStableFileObject(path) {
  const link = lstatSync(path);
  if (link.isSymbolicLink()) throw new Error("evidence_file_symlink");
  if (!link.isFile()) throw new Error("evidence_file_not_regular");
  const noFollow = FS_CONSTANTS.O_NOFOLLOW ?? 0;
  const fd = openSync(path, FS_CONSTANTS.O_RDONLY | noFollow);
  try {
    const before = fstatSync(fd);
    if (!before.isFile()) throw new Error("evidence_file_not_regular");
    const bytes = readFileSync(fd);
    const after = fstatSync(fd);
    if (!sameStat(before, after)) throw new Error("evidence_file_changed_during_read");
    return { bytes, stat: after };
  } finally {
    closeSync(fd);
  }
}

function fsyncDirectory(path) {
  const fd = openSync(path, FS_CONSTANTS.O_RDONLY | (FS_CONSTANTS.O_DIRECTORY ?? 0));
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function assertWithin(rootDir, path) {
  const root = realpathSync(rootDir);
  const candidate = resolve(path);
  const rel = relative(root, candidate);
  if (rel === "" || (rel !== ".." && !rel.startsWith(".." + sep) && !isAbsolute(rel))) {
    return root;
  }
  throw new Error("evidence_path_outside_state_root");
}

function ensurePrivateDirectory(rootDir, targetDir) {
  const root = assertWithin(rootDir, targetDir);
  const target = resolve(targetDir);
  const rel = relative(root, target);
  let current = root;
  for (const part of rel === "" ? [] : rel.split(sep)) {
    current = join(current, part);
    let entry;
    try {
      entry = lstatSync(current);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      mkdirSync(current, { mode: 0o700 });
      entry = lstatSync(current);
    }
    if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error("evidence_directory_not_private");
    chmodSync(current, 0o700);
  }
}

function assertPrivatePacketPath(stateRootDir, packetPath) {
  const root = assertWithin(stateRootDir, packetPath);
  const target = resolve(packetPath);
  const rel = relative(root, target);
  const parts = rel.split(sep);
  const filePart = parts.pop();
  let current = root;
  for (const part of parts) {
    current = join(current, part);
    const entry = lstatSync(current);
    if (entry.isSymbolicLink() || !entry.isDirectory() || (entry.mode & 0o777) !== 0o700) {
      throw new Error("evidence_directory_not_private");
    }
  }
  const file = lstatSync(join(current, filePart));
  if (file.isSymbolicLink()) throw new Error("evidence_file_symlink");
  if (!file.isFile() || (file.mode & 0o777) !== 0o600) {
    throw new Error("evidence_file_not_private");
  }
}

function packetDirectory(stateRootDir, ids) {
  const identity = packetIdentityDigest(ids).slice("sha256:".length);
  return join(resolve(stateRootDir), "artifacts", "sat-evidence", identity);
}

export function satEvidencePacketPath(stateRootDir, ids) {
  return join(packetDirectory(stateRootDir, ids), "packet.json");
}

export function journalPrefixBinding(stateRootDir, events) {
  if (!Array.isArray(events) || events.length === 0) {
    return { ok: false, blocked_by: ["journal_binding_empty"] };
  }
  try {
    const path = journalPath(stateRootDir);
    const { bytes, stat } = readStableFileObject(path);
    let newlineCount = 0;
    let prefixEnd = -1;
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0x0a) {
        newlineCount += 1;
        if (newlineCount === events.length) {
          prefixEnd = i + 1;
          break;
        }
      }
    }
    if (prefixEnd < 0) return { ok: false, blocked_by: ["journal_prefix_incomplete"] };
    const prefix = bytes.subarray(0, prefixEnd);
    const lines = prefix.toString("utf8").split("\n").filter(Boolean);
    if (lines.length !== events.length) return { ok: false, blocked_by: ["journal_prefix_line_count_mismatch"] };
    for (const [index, line] of lines.entries()) {
      const parsed = JSON.parse(line);
      if (parsed.event_id !== events[index]?.event_id || parsed.seq !== events[index]?.seq || parsed.kind !== events[index]?.kind) {
        return { ok: false, blocked_by: ["journal_prefix_event_mismatch"] };
      }
    }
    return {
      ok: true,
      blocked_by: [],
      binding: {
        path,
        event_count: events.length,
        head_event_id: events.at(-1)?.event_id,
        prefix_sha256: bytesSha256(prefix),
        prefix_byte_length: prefix.length,
        file_identity: { device: stat.dev, inode: stat.ino, size: stat.size },
      },
    };
  } catch (error) {
    return { ok: false, blocked_by: [error?.message ?? "journal_binding_failed"] };
  }
}

export function readSatEvidencePacket(stateRootDir, ids) {
  const path = satEvidencePacketPath(stateRootDir, ids);
  try {
    assertPrivatePacketPath(stateRootDir, path);
    const { bytes, stat } = readStableFileObject(path);
    const text = bytes.toString("utf8");
    const packet = JSON.parse(text);
    if (canonicalizeJsonV1(packet) + "\n" !== text) {
      return { ok: false, blocked_by: ["evidence_packet_bytes_not_canonical"] };
    }
    const verified = verifySatEvidencePacket(packet);
    if (!verified.ok) return { ok: false, blocked_by: [...verified.blocked_by] };
    if (packet.mission_id !== ids.mission_id || packet.attempt_id !== ids.attempt_id) {
      return { ok: false, blocked_by: ["evidence_packet_identity_mismatch"] };
    }
    return {
      ok: true,
      blocked_by: [],
      path,
      packet,
      byte_hash: bytesSha256(bytes),
      file_identity: { device: stat.dev, inode: stat.ino, size: stat.size, mode: stat.mode & 0o777 },
    };
  } catch (error) {
    const code = error?.code === "ENOENT" ? "evidence_packet_missing" : (error?.message ?? "evidence_packet_read_failed");
    return { ok: false, blocked_by: [code] };
  }
}

export function persistSatEvidencePacket(stateRootDir, packet) {
  const verified = verifySatEvidencePacket(packet);
  if (!verified.ok) return { ok: false, blocked_by: [...verified.blocked_by] };
  const ids = { mission_id: packet.mission_id, attempt_id: packet.attempt_id };
  const path = satEvidencePacketPath(stateRootDir, ids);
  const identityDir = packetDirectory(stateRootDir, ids);
  const parentDir = dirname(identityDir);
  const bytes = Buffer.from(canonicalizeJsonV1(packet) + "\n", "utf8");
  const byte_hash = bytesSha256(bytes);

  try {
    ensurePrivateDirectory(stateRootDir, parentDir);
    let identityExists = true;
    try {
      const entry = lstatSync(identityDir);
      if (entry.isSymbolicLink() || !entry.isDirectory() || (entry.mode & 0o777) !== 0o700) {
        return { ok: false, blocked_by: ["evidence_identity_directory_not_private"] };
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      identityExists = false;
      try {
        mkdirSync(identityDir, { mode: 0o700 });
        chmodSync(identityDir, 0o700);
      } catch (mkdirError) {
        if (mkdirError.code !== "EEXIST") throw mkdirError;
        identityExists = true;
        const raced = lstatSync(identityDir);
        if (raced.isSymbolicLink() || !raced.isDirectory() || (raced.mode & 0o777) !== 0o700) {
          return { ok: false, blocked_by: ["evidence_identity_directory_not_private"] };
        }
      }
    }

    if (identityExists) {
      const existing = readSatEvidencePacket(stateRootDir, ids);
      if (!existing.ok) return existing;
      if (existing.byte_hash === byte_hash) {
        return { ok: true, blocked_by: [], idempotent: true, path, byte_hash, packet: existing.packet };
      }
      return { ok: false, blocked_by: ["evidence_packet_conflict"] };
    }

    const tempPath = join(identityDir, ".packet." + process.pid + "." + randomUUID() + ".tmp");
    const fd = openSync(tempPath, FS_CONSTANTS.O_WRONLY | FS_CONSTANTS.O_CREAT | FS_CONSTANTS.O_EXCL, 0o600);
    try {
      writeFileSync(fd, bytes);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    writeLog.push(tempPath);
    renameSync(tempPath, path);
    fsyncDirectory(identityDir);
    fsyncDirectory(parentDir);
    writeLog.push(path);

    const readback = readSatEvidencePacket(stateRootDir, ids);
    if (!readback.ok) return readback;
    if (readback.byte_hash !== byte_hash) return { ok: false, blocked_by: ["evidence_packet_readback_hash_mismatch"] };
    return { ok: true, blocked_by: [], idempotent: false, path, byte_hash, packet: readback.packet };
  } catch (error) {
    return { ok: false, blocked_by: [error?.message ?? "evidence_packet_persist_failed"] };
  }
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
