// First Light filesystem boundary: metadata scope, consent nonce, persistence,
// and fresh-process verification. No model routing or consent decisions live
// here.

import {
  lstat,
  mkdir,
  readdir,
  realpath,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import {
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";

import { sha256CanonicalJsonV1 } from "../../../../packages/canon/src/sha256-canonical-json-v1.js";
import {
  firstLightFileIdentity,
  firstLightIdentityMatches,
  readFirstLightFileNoFollow,
  syncFirstLightDirectory,
  validateFirstLightStateRoot,
  writeFirstLightJsonExclusive,
} from "./first-light-safe-fs.js";

const MAX_FILES = 2_000;
export const FIRST_LIGHT_MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 24 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".md", ".txt", ".json"]);
const SKIPPED_DIRECTORIES = new Set([".git", ".next", "node_modules"]);

export function firstLightHashText(value) {
  return `sha256:${createHash("sha256").update(String(value), "utf8").digest("hex")}`;
}

export function firstLightBlocked(...reasons) {
  return {
    ok: false,
    blocked_by: [...new Set(reasons.flat().filter(Boolean))],
  };
}

function inside(root, candidate) {
  const rel = relative(root, candidate);
  return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

function relativePath(root, candidate) {
  return relative(root, candidate).split(sep).join("/");
}

export async function gatherFirstLightScope(rootPath) {
  if (!isAbsolute(rootPath ?? "")) return firstLightBlocked("absolute_root_required");
  let root;
  try {
    root = await realpath(resolve(rootPath));
    if (!(await stat(root)).isDirectory()) return firstLightBlocked("root_not_directory");
  } catch {
    return firstLightBlocked("root_unreadable");
  }

  const files = [];
  const skipped_symlinks = [];
  const skipped_oversized = [];
  const skipped_directories = [];
  let totalBytes = 0;
  let truncated = false;

  async function walk(dir) {
    if (truncated) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      throw new Error(`directory_unreadable:${relativePath(root, dir) || "."}`);
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const candidate = join(dir, entry.name);
      const rel = relativePath(root, candidate);
      if (entry.isSymbolicLink()) {
        skipped_symlinks.push(rel);
        continue;
      }
      if (entry.isDirectory()) {
        if (SKIPPED_DIRECTORIES.has(entry.name)) {
          skipped_directories.push(rel);
          continue;
        }
        await walk(candidate);
        if (truncated) return;
        continue;
      }
      if (!entry.isFile() || !ALLOWED_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;
      const metadata = await lstat(candidate, { bigint: true });
      if (!metadata.isFile()) continue;
      if (metadata.size > BigInt(FIRST_LIGHT_MAX_FILE_BYTES)) {
        skipped_oversized.push(rel);
        continue;
      }
      const sizeBytes = Number(metadata.size);
      if (files.length >= MAX_FILES || totalBytes + sizeBytes > MAX_TOTAL_BYTES) {
        truncated = true;
        return;
      }
      totalBytes += sizeBytes;
      files.push({
        relative_path: rel,
        ...firstLightFileIdentity(metadata),
      });
    }
  }

  try {
    await walk(root);
  } catch (error) {
    return firstLightBlocked(String(error.message || error));
  }
  if (truncated) return firstLightBlocked("scope_limit_exceeded");
  if (files.length === 0) return firstLightBlocked("no_supported_text_files");
  files.sort((a, b) => a.relative_path.localeCompare(b.relative_path));
  skipped_symlinks.sort();
  skipped_oversized.sort();
  skipped_directories.sort();
  const scopeBody = {
    root_path: root,
    files,
    file_count: files.length,
    total_bytes: totalBytes,
    allowed_extensions: [...ALLOWED_EXTENSIONS].sort(),
    skipped_symlinks,
    skipped_oversized,
    skipped_directories,
    content_read: false,
  };
  return {
    ok: true,
    scope: {
      ...scopeBody,
      root_set_hash: sha256CanonicalJsonV1(scopeBody),
    },
  };
}

export async function reserveFirstLightNonce(
  demaHome,
  prepared,
  reservedAtIso,
) {
  const nonceHash = firstLightHashText(prepared.envelope.nonce).slice("sha256:".length);
  const dir = join(demaHome, "first-light", "consent-nonces");
  const safeRoot = await validateFirstLightStateRoot(dir, { create: true });
  if (!safeRoot.ok) return safeRoot;
  try {
    await writeFirstLightJsonExclusive(
      join(dir, `${nonceHash}.json`),
      {
        nonce_hash: `sha256:${nonceHash}`,
        mission_id: prepared.mission_id,
        consent_context_hash: prepared.envelope.consent_context_hash,
        reserved_at_iso: reservedAtIso,
      },
    );
  } catch (error) {
    return firstLightBlocked(
      error?.code === "EEXIST" ? "nonce_replayed" : "nonce_reservation_failed",
    );
  }
  return { ok: true };
}

export async function readFirstLightDocuments(scope) {
  const documents = [];
  for (const expected of scope.files) {
    const candidate = resolve(scope.root_path, expected.relative_path);
    if (!inside(scope.root_path, candidate)) return firstLightBlocked("source_path_escape");
    try {
      const opened = await readFirstLightFileNoFollow(
        candidate,
        FIRST_LIGHT_MAX_FILE_BYTES,
      );
      const pathMetadata = await lstat(candidate, { bigint: true });
      if (
        pathMetadata.isSymbolicLink() ||
        !pathMetadata.isFile() ||
        !firstLightIdentityMatches(expected, opened.metadata) ||
        !firstLightIdentityMatches(expected, pathMetadata)
      ) {
        return firstLightBlocked(`source_identity_changed:${expected.relative_path}`);
      }
      const buffer = opened.buffer;
      if (buffer.length !== expected.size_bytes) {
        return firstLightBlocked(`source_size_changed:${expected.relative_path}`);
      }
      const sourceText = buffer.toString("utf8");
      if (!Buffer.from(sourceText, "utf8").equals(buffer)) {
        return firstLightBlocked(`source_not_utf8:${expected.relative_path}`);
      }
      documents.push({ relative_path: expected.relative_path, text: sourceText });
    } catch (error) {
      return firstLightBlocked(
        `source_read_failed:${expected.relative_path}:${error?.code ?? "unknown"}`,
      );
    }
  }
  return { ok: true, documents };
}

export async function persistFirstLightMission({
  demaHome,
  prepared,
  index,
  receipt,
  card,
  nowIso,
}) {
  const root = join(demaHome, "first-light");
  const missionDir = join(root, prepared.mission_id);
  const tempDir = join(
    root,
    `.${prepared.mission_id}.${randomBytes(12).toString("hex")}.tmp`,
  );
  const safeRoot = await validateFirstLightStateRoot(root, { create: true });
  if (!safeRoot.ok) return safeRoot;
  try {
    await mkdir(tempDir, { mode: 0o700 });
    const scopeRecord = {
      schema: "bizra.node0.first_light_scope.v0.1",
      mission_id: prepared.mission_id,
      state_root_path: prepared.dema_home,
      scope: prepared.scope,
      consent: {
        action_class: prepared.envelope.action_class,
        consent_context_hash: prepared.envelope.consent_context_hash,
        phrase_hash: prepared.envelope.phrase_hash,
        expires_at: prepared.envelope.expires_at,
      },
    };
    const state = {
      schema: "bizra.node0.first_light_state.v0.1",
      mission_id: prepared.mission_id,
      status: "PROVISIONAL",
      persisted_at_iso: nowIso,
      scope_record_hash: sha256CanonicalJsonV1(scopeRecord),
      index_hash: index.index_hash,
      receipt_id: receipt.receipt_id,
      proof_card_hash: card.proof_card_hash,
    };
    await writeFirstLightJsonExclusive(join(tempDir, "scope.json"), scopeRecord);
    await writeFirstLightJsonExclusive(join(tempDir, "index.json"), index);
    await writeFirstLightJsonExclusive(join(tempDir, "receipt.json"), receipt);
    await writeFirstLightJsonExclusive(join(tempDir, "proof-card.json"), card);
    await writeFirstLightJsonExclusive(join(tempDir, "state.json"), state);
    await syncFirstLightDirectory(tempDir);
    await rename(tempDir, missionDir);
    await syncFirstLightDirectory(root);
    return {
      ok: true,
      paths: {
        mission: missionDir,
        index: join(missionDir, "index.json"),
        receipt: join(missionDir, "receipt.json"),
        proof_card: join(missionDir, "proof-card.json"),
        state: join(missionDir, "state.json"),
      },
    };
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    return firstLightBlocked(
      ["EEXIST", "ENOTEMPTY"].includes(error?.code)
        ? "mission_already_exists"
        : "mission_persist_failed",
    );
  }
}

export async function finalizeFirstLightMission({
  demaHome,
  mission_id,
  receipt_id,
  completedAtIso,
}) {
  const root = join(demaHome, "first-light");
  const missionDir = join(root, mission_id);
  const safeMission = await validateFirstLightStateRoot(missionDir);
  if (!safeMission.ok) return safeMission;
  const token = randomBytes(12).toString("hex");
  const stateTemp = join(missionDir, `.state.${token}.tmp`);
  const latestTemp = join(root, `.latest.${token}.tmp`);
  try {
    const state = await readJson(join(missionDir, "state.json"));
    if (
      state.status !== "PROVISIONAL" ||
      state.mission_id !== mission_id ||
      state.receipt_id !== receipt_id
    ) {
      return firstLightBlocked("mission_finalize_context_mismatch");
    }
    await writeFirstLightJsonExclusive(stateTemp, {
      ...state,
      status: "COMPLETE",
      completed_at_iso: completedAtIso,
    });
    await rename(stateTemp, join(missionDir, "state.json"));
    await syncFirstLightDirectory(missionDir);
    await writeFirstLightJsonExclusive(latestTemp, {
      schema: "bizra.node0.first_light_latest.v0.1",
      mission_id,
      receipt_id,
    });
    await rename(latestTemp, join(root, "latest.json"));
    await syncFirstLightDirectory(root);
    return { ok: true };
  } catch {
    await rm(stateTemp, { force: true }).catch(() => {});
    await rm(latestTemp, { force: true }).catch(() => {});
    return firstLightBlocked("mission_finalize_failed");
  }
}

async function readJson(path) {
  const { buffer } = await readFirstLightFileNoFollow(
    path,
    FIRST_LIGHT_MAX_FILE_BYTES,
  );
  const value = buffer.toString("utf8");
  if (!Buffer.from(value, "utf8").equals(buffer)) throw new Error("json_not_utf8");
  return JSON.parse(value);
}
