// First Light hardened filesystem primitives.
//
// State paths reject symlinked components. File reads and writes use one
// no-follow descriptor, explicit bounds, and descriptor metadata.

import { constants as fsConstants } from "node:fs";
import {
  lstat,
  mkdir,
  open,
  realpath,
  unlink,
} from "node:fs/promises";
import { parse, relative, resolve, sep } from "node:path";

function blocked(reason) {
  return { ok: false, blocked_by: [reason] };
}

export function firstLightFileIdentity(metadata) {
  return {
    device_id: String(metadata.dev),
    inode: String(metadata.ino),
    size_bytes: Number(metadata.size),
    mtime_ns: String(metadata.mtimeNs),
    ctime_ns: String(metadata.ctimeNs),
  };
}

export function firstLightIdentityMatches(expected, metadata) {
  const observed = firstLightFileIdentity(metadata);
  return (
    expected.device_id === observed.device_id &&
    expected.inode === observed.inode &&
    expected.size_bytes === observed.size_bytes &&
    expected.mtime_ns === observed.mtime_ns &&
    expected.ctime_ns === observed.ctime_ns
  );
}

export async function validateFirstLightStateRoot(
  statePath,
  { create = false } = {},
) {
  const target = resolve(statePath);
  const root = parse(target).root;
  const rel = relative(root, target);
  const parts = rel ? rel.split(sep).filter(Boolean) : [];
  let current = root;
  for (const part of parts) {
    current = resolve(current, part);
    let metadata;
    try {
      metadata = await lstat(current, { bigint: true });
    } catch (error) {
      if (error?.code !== "ENOENT") return blocked("state_root_unreadable");
      if (!create) return blocked("state_root_missing");
      try {
        await mkdir(current, { mode: 0o700 });
        metadata = await lstat(current, { bigint: true });
      } catch {
        return blocked("state_root_create_failed");
      }
    }
    if (metadata.isSymbolicLink()) return blocked("state_root_symlink");
    if (!metadata.isDirectory()) return blocked("state_root_not_directory");
  }
  try {
    if ((await realpath(target)) !== target) return blocked("state_root_symlink");
  } catch {
    return blocked(create ? "state_root_create_failed" : "state_root_missing");
  }
  return { ok: true, path: target };
}

export async function writeFirstLightJsonExclusive(path, value) {
  if (typeof fsConstants.O_NOFOLLOW !== "number") {
    throw new Error("nofollow_unsupported");
  }
  let handle;
  let created = false;
  try {
    handle = await open(
      path,
      fsConstants.O_WRONLY |
        fsConstants.O_CREAT |
        fsConstants.O_EXCL |
        fsConstants.O_NOFOLLOW,
      0o600,
    );
    created = true;
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await handle.sync();
  } catch (error) {
    if (created) await unlink(path).catch(() => {});
    throw error;
  } finally {
    await handle?.close().catch(() => {});
  }
}

export async function readFirstLightFileNoFollow(path, maxBytes) {
  if (typeof fsConstants.O_NOFOLLOW !== "number") {
    throw new Error("nofollow_unsupported");
  }
  let handle;
  try {
    handle = await open(
      path,
      fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
    );
    const before = await handle.stat({ bigint: true });
    if (!before.isFile()) throw new Error("not_regular_file");
    if (before.size > BigInt(maxBytes)) throw new Error("file_too_large");
    const target = Buffer.alloc(maxBytes + 1);
    let bytesRead = 0;
    while (bytesRead < target.length) {
      const chunk = await handle.read(
        target,
        bytesRead,
        target.length - bytesRead,
        bytesRead,
      );
      if (chunk.bytesRead === 0) break;
      bytesRead += chunk.bytesRead;
    }
    if (bytesRead > maxBytes) throw new Error("file_too_large");
    const after = await handle.stat({ bigint: true });
    if (
      !after.isFile() ||
      !firstLightIdentityMatches(firstLightFileIdentity(before), after) ||
      bytesRead !== Number(after.size)
    ) {
      throw new Error("file_changed_during_read");
    }
    return {
      buffer: target.subarray(0, bytesRead),
      metadata: after,
    };
  } finally {
    await handle?.close().catch(() => {});
  }
}

export async function syncFirstLightDirectory(path) {
  const handle = await open(
    path,
    fsConstants.O_RDONLY | (fsConstants.O_DIRECTORY ?? 0),
  );
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}
